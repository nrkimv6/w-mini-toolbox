/**
 * Clipboard utilities for reading multiple content types
 */

/**
 * Check and request clipboard permissions (for mobile/PWA)
 * Note: This function must be called within a user gesture (click/touch) on mobile
 */
export async function checkClipboardPermission(): Promise<boolean> {
	if (!navigator.clipboard) {
		console.log('Clipboard API not available');
		return false;
	}

	try {
		// Check if permissions API is available and supports clipboard-read
		if ('permissions' in navigator) {
			try {
				const readPermission = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
				
				if (readPermission.state === 'granted') {
					return true;
				} else if (readPermission.state === 'prompt') {
					// For mobile, we need to actually try reading to trigger the permission
					console.log('Permission is in prompt state, trying to read...');
					return false; // Let the actual read attempt handle the permission
				} else {
					console.log('Clipboard permission denied');
					return false;
				}
			} catch (permError) {
				// clipboard-read might not be supported in permissions API
				console.log('Clipboard permission query not supported, falling back to direct access');
			}
		}
		
		// Fallback: Most mobile browsers don't support permission query for clipboard
		// Just return false and let the actual clipboard operation handle permissions
		return false;
	} catch (error) {
		console.error('Error checking clipboard permission:', error);
		return false;
	}
}

/**
 * Request clipboard permission with user-friendly messaging
 * Must be called within a user gesture (click/touch) on mobile
 */
export async function requestClipboardPermission(): Promise<{ granted: boolean, message: string }> {
	if (!navigator.clipboard) {
		return {
			granted: false,
			message: '이 브라우저에서는 클립보드 API를 지원하지 않습니다.'
		};
	}

	try {
		// Try to read clipboard (this will trigger permission prompt if needed)
		// On mobile, this must be called within a user gesture
		console.log('Requesting clipboard permission by attempting to read...');
		const text = await navigator.clipboard.readText();
		console.log('Clipboard access granted, got text:', text ? `${text.length} characters` : 'empty');
		return {
			granted: true,
			message: '클립보드 접근 권한이 허용되었습니다.'
		};
	} catch (error: any) {
		console.error('Clipboard permission request failed:', error);
		
		if (error.name === 'NotAllowedError') {
			return {
				granted: false,
				message: '클립보드 접근 권한이 거부되었습니다. 모바일에서는 붙여넣기 버튼을 직접 눌러주세요.'
			};
		} else if (error.name === 'NotFoundError') {
			return {
				granted: false,
				message: '클립보드가 비어있습니다. 먼저 복사할 내용을 선택해주세요.'
			};
		} else {
			return {
				granted: false,
				message: `클립보드 접근 중 오류가 발생했습니다: ${error.message}`
			};
		}
	}
}

export interface ClipboardContent {
	type: string;
	label: string;
	content: string;
	available: boolean;
	blob?: Blob;
	isFile?: boolean;
	fileName?: string;
}

/**
 * Read all available clipboard formats
 * Must be called within a user gesture (click/touch) on mobile
 */
export async function readClipboardFormats(): Promise<ClipboardContent[]> {
	const formats: ClipboardContent[] = [];
	
	try {
		// Check if clipboard API is available
		if (!navigator.clipboard) {
			throw new Error('클립보드 API가 지원되지 않습니다. 최신 브라우저를 사용해주세요.');
		}

		console.log('Attempting to read clipboard formats...');
		
		// Try to read clipboard items (for modern browsers - desktop mainly)
		if ('read' in navigator.clipboard) {
			try {
				console.log('Trying to read clipboard items...');
				const items = await navigator.clipboard.read();
			
			for (const item of items) {
				// Check each MIME type
				for (const type of item.types) {
					if (type === 'text/html') {
						const blob = await item.getType(type);
						const content = await blob.text();
						formats.push({
							type: 'text/html',
							label: 'HTML',
							content,
							available: true,
							blob,
							isFile: false
						});
					} else if (type === 'text/plain') {
						const blob = await item.getType(type);
						const content = await blob.text();
						formats.push({
							type: 'text/plain',
							label: 'Plain Text',
							content,
							available: true,
							blob,
							isFile: false
						});
					} else if (type.startsWith('image/')) {
						// Handle images
						const blob = await item.getType(type);
						const url = URL.createObjectURL(blob);
						const extension = type.split('/')[1];
						const fileName = `clipboard-image.${extension}`;
						formats.push({
							type,
							label: `Image (${extension.toUpperCase()})`,
							content: url,
							available: true,
							blob,
							isFile: true,
							fileName
						});
					} else if (type.startsWith('application/') || type.includes('office') || type.includes('document')) {
						// Handle files (documents, etc.)
						const blob = await item.getType(type);
						const extension = getFileExtensionFromMimeType(type);
						const fileName = `clipboard-file${extension}`;
						formats.push({
							type,
							label: `File (${type.split('/')[1].toUpperCase()})`,
							content: `[File: ${fileName}]`,
							available: true,
							blob,
							isFile: true,
							fileName
						});
					}
				}
			}
			} catch (readError) {
				console.log('clipboard.read() failed, falling back to readText:', readError);
				// Fallback to readText for mobile browsers that don't support clipboard.read()
				const text = await navigator.clipboard.readText();
				if (text) {
					formats.push({
						type: 'text/plain',
						label: 'Plain Text',
						content: text,
						available: true
					});
					
					// Check if it looks like HTML
					if (text.includes('<') && text.includes('>')) {
						formats.push({
							type: 'text/html',
							label: 'HTML (detected)',
							content: text,
							available: true
						});
					}
				}
			}
		} else {
			// Fallback to readText for older browsers
			const text = await navigator.clipboard.readText();
			if (text) {
				formats.push({
					type: 'text/plain',
					label: 'Plain Text',
					content: text,
					available: true
				});
				
				// Check if it looks like HTML
				if (text.includes('<') && text.includes('>')) {
					formats.push({
						type: 'text/html',
						label: 'HTML (detected)',
						content: text,
						available: true
					});
				}
			}
		}
	} catch (error: any) {
		console.error('Failed to read clipboard:', error);
		
		let errorMessage = 'Unknown error';
		if (error.name === 'NotAllowedError') {
			errorMessage = '클립보드 접근 권한이 필요합니다. 붙여넣기 버튼을 다시 클릭해주세요.';
		} else if (error.name === 'NotFoundError') {
			errorMessage = '클립보드가 비어있습니다. 먼저 복사할 내용을 선택해주세요.';
		} else if (error.message) {
			errorMessage = error.message;
		}
		
		// Return empty format options with error message
		formats.push({
			type: 'error',
			label: 'Error',
			content: errorMessage,
			available: false
		});
	}
	
	return formats;
}

/**
 * Read specific clipboard format
 */
export async function readClipboardFormat(type: string): Promise<string> {
	try {
		if (type === 'text/plain') {
			return await navigator.clipboard.readText();
		}
		
		if ('read' in navigator.clipboard) {
			const items = await navigator.clipboard.read();
			for (const item of items) {
				if (item.types.includes(type)) {
					const blob = await item.getType(type);
					return await blob.text();
				}
			}
		}
		
		// Fallback to readText
		return await navigator.clipboard.readText();
	} catch (error) {
		console.error(`Failed to read clipboard format ${type}:`, error);
		throw error;
	}
}

/**
 * Paste from clipboard with format selection
 */
export async function pasteFromClipboard(): Promise<{ formats: ClipboardContent[], selectedContent?: string }> {
	const formats = await readClipboardFormats();
	
	// Auto-select HTML if available, otherwise plain text
	const htmlFormat = formats.find(f => f.type === 'text/html' && f.available);
	const textFormat = formats.find(f => f.type === 'text/plain' && f.available);
	
	const selectedContent = htmlFormat?.content || textFormat?.content;
	
	return {
		formats,
		selectedContent
	};
}

/**
 * Get file extension from MIME type
 */
function getFileExtensionFromMimeType(mimeType: string): string {
	const mimeMap: Record<string, string> = {
		'application/pdf': '.pdf',
		'application/msword': '.doc',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
		'application/vnd.ms-excel': '.xls',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
		'application/vnd.ms-powerpoint': '.ppt',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
		'application/zip': '.zip',
		'application/x-zip-compressed': '.zip',
		'application/json': '.json',
		'application/xml': '.xml',
		'text/csv': '.csv',
		'text/xml': '.xml',
		'image/png': '.png',
		'image/jpeg': '.jpg',
		'image/gif': '.gif',
		'image/webp': '.webp',
		'image/svg+xml': '.svg'
	};
	
	return mimeMap[mimeType] || '.bin';
}

/**
 * Download file from clipboard content
 */
export async function downloadFile(content: ClipboardContent): Promise<void> {
	if (!content.blob || !content.isFile) {
		console.error('Cannot download: not a file or blob missing');
		return;
	}
	
	try {
		const url = URL.createObjectURL(content.blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = content.fileName || 'clipboard-file';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		
		// Clean up the object URL to prevent memory leaks
		setTimeout(() => URL.revokeObjectURL(url), 100);
		
		// Return promise for async handling
		return Promise.resolve();
	} catch (error) {
		console.error('Failed to download file:', error);
		return Promise.reject(error);
	}
}