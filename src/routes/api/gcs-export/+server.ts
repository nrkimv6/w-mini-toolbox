import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ------------------------------------------------------------------
// JWT / OAuth2 helpers (SubtleCrypto — no Node.js dependency)
// ------------------------------------------------------------------

/**
 * Base64url-encode an ArrayBuffer or typed-array view.
 */
function base64urlEncode(buf: BufferSource): string {
	const bytes: Uint8Array = ArrayBuffer.isView(buf)
		? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
		: new Uint8Array(buf);
	let str = '';
	for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
	return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Sign a string with an RSA-SHA256 private key imported from PEM (PKCS#8).
 */
async function rsaSign(pemKey: string, data: string): Promise<string> {
	// Strip PEM headers and decode base64
	const pemContents = pemKey
		.replace(/-----BEGIN PRIVATE KEY-----/, '')
		.replace(/-----END PRIVATE KEY-----/, '')
		.replace(/\s/g, '');
	const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

	const cryptoKey = await crypto.subtle.importKey(
		'pkcs8',
		binaryDer.buffer,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign']
	);

	const encoder = new TextEncoder();
	const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(data));
	return base64urlEncode(signature);
}

/**
 * Build a signed JWT for a GCS service account and exchange it for an
 * OAuth2 access token using the Google token endpoint.
 */
async function getAccessToken(serviceAccountJson: string): Promise<string> {
	const sa = JSON.parse(serviceAccountJson) as {
		client_email: string;
		private_key: string;
	};

	const now = Math.floor(Date.now() / 1000);
	const header = base64urlEncode(
		new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
	);
	const claimSet = base64urlEncode(
		new TextEncoder().encode(
			JSON.stringify({
				iss: sa.client_email,
				scope: 'https://www.googleapis.com/auth/devstorage.read_write',
				aud: 'https://oauth2.googleapis.com/token',
				exp: now + 3600,
				iat: now
			})
		)
	);
	const signingInput = `${header}.${claimSet}`;
	const signature = await rsaSign(sa.private_key, signingInput);
	const jwt = `${signingInput}.${signature}`;

	const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt
		})
	});

	if (!tokenRes.ok) {
		const body = await tokenRes.text();
		throw new Error(`OAuth2 token exchange failed: ${tokenRes.status} ${body}`);
	}

	const data = (await tokenRes.json()) as { access_token: string };
	return data.access_token;
}

/**
 * Generate a V4 signed URL for read access (expiry 1 hour).
 * Uses GCS XML API signing via SubtleCrypto (RSA-SHA256).
 */
async function signedDownloadUrl(
	serviceAccountJson: string,
	bucket: string,
	objectName: string
): Promise<string> {
	const sa = JSON.parse(serviceAccountJson) as {
		client_email: string;
		private_key: string;
	};

	const expiry = 3600; // seconds
	const now = new Date();
	const datestamp = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
	const requestTimestamp =
		now
			.toISOString()
			.replace(/[-:]/g, '')
			.replace(/\.\d+Z$/, '') + 'Z'; // YYYYMMDDTHHMMSSz
	const credentialScope = `${datestamp}/auto/storage/goog4_request`;
	const credential = `${sa.client_email}/${credentialScope}`;

	const canonicalHeaders = 'host:storage.googleapis.com\n';
	const signedHeaders = 'host';

	const encodedObjectName = encodeURIComponent(objectName).replace(/%2F/g, '/');
	const canonicalUri = `/${bucket}/${encodedObjectName}`;

	const queryParams = new URLSearchParams({
		'X-Goog-Algorithm': 'GOOG4-RSA-SHA256',
		'X-Goog-Credential': credential,
		'X-Goog-Date': requestTimestamp,
		'X-Goog-Expires': String(expiry),
		'X-Goog-SignedHeaders': signedHeaders
	});
	// Sort params for canonical form
	queryParams.sort();
	const canonicalQueryString = queryParams.toString();

	const canonicalRequest = [
		'GET',
		canonicalUri,
		canonicalQueryString,
		canonicalHeaders,
		signedHeaders,
		'UNSIGNED-PAYLOAD'
	].join('\n');

	const encoder = new TextEncoder();
	const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest));
	const hashHex = Array.from(new Uint8Array(hashBuf))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	const stringToSign = [
		'GOOG4-RSA-SHA256',
		requestTimestamp,
		credentialScope,
		hashHex
	].join('\n');

	const signatureBytes = await (async () => {
		const pemContents = sa.private_key
			.replace(/-----BEGIN PRIVATE KEY-----/, '')
			.replace(/-----END PRIVATE KEY-----/, '')
			.replace(/\s/g, '');
		const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
		const cryptoKey = await crypto.subtle.importKey(
			'pkcs8',
			binaryDer.buffer,
			{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
			false,
			['sign']
		);
		return crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(stringToSign));
	})();

	const signature = Array.from(new Uint8Array(signatureBytes))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	return `https://storage.googleapis.com${canonicalUri}?${canonicalQueryString}&X-Goog-Signature=${signature}`;
}

// ------------------------------------------------------------------
// Request handler
// ------------------------------------------------------------------

export const POST: RequestHandler = async ({ request, platform }) => {
	// Server-side feature gate: private env var (never exposed to client bundle)
	const enableGcsExport =
		(platform?.env as Record<string, string> | undefined)?.ENABLE_GCS_EXPORT ??
		env.ENABLE_GCS_EXPORT;

	if (enableGcsExport !== 'true') {
		throw error(404, 'Not found');
	}

	// Load GCS credentials
	const serviceAccountKey =
		(platform?.env as Record<string, string> | undefined)?.GCS_SERVICE_ACCOUNT_KEY ??
		env.GCS_SERVICE_ACCOUNT_KEY;
	const gcsBucket =
		(platform?.env as Record<string, string> | undefined)?.GCS_BUCKET_NAME ??
		env.GCS_BUCKET_NAME;

	if (!serviceAccountKey || !gcsBucket) {
		throw error(503, 'GCS configuration missing');
	}

	// Parse multipart form data
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		throw error(400, 'Invalid form data');
	}

	const file = formData.get('file');
	if (!file || !(file instanceof File)) {
		throw error(415, 'Missing or invalid file field');
	}

	// Content-type guard: images only
	if (!file.type.startsWith('image/')) {
		throw error(415, 'Only image files are accepted');
	}

	// Size guard
	if (file.size > MAX_FILE_SIZE) {
		throw error(413, `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
	}

	// Build GCS object name
	const timestamp = Date.now();
	const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
	const objectName = `screenshots/${timestamp}_${safeName}`;

	try {
		// Get OAuth2 access token
		const accessToken = await getAccessToken(serviceAccountKey);

		// Upload via GCS JSON REST API
		const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(gcsBucket)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;

		const arrayBuffer = await file.arrayBuffer();
		const uploadRes = await fetch(uploadUrl, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': file.type
			},
			body: arrayBuffer
		});

		if (!uploadRes.ok) {
			const body = await uploadRes.text();
			console.error('GCS upload failed:', uploadRes.status, body);
			throw error(502, 'Upload to GCS failed');
		}

		// Generate signed download URL (1-hour expiry, V4 signing)
		const downloadUrl = await signedDownloadUrl(serviceAccountKey, gcsBucket, objectName);

		return json({ url: downloadUrl, objectName });
	} catch (err) {
		if (err instanceof Response) throw err; // re-throw SvelteKit errors
		console.error('GCS export error:', err);
		throw error(500, 'Internal server error');
	}
};
