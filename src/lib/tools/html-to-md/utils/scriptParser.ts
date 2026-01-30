export interface ScriptData {
	script: string;
	title?: string;
	videoLength?: number;
	source?: 'json' | 'text' | 'xml' | 'csv';
}

export interface ParsingRule {
	name: string;
	description: string;
	scriptPath: string;
	titlePath?: string;
	lengthPath?: string;
}

export interface ParsingResult {
	success: boolean;
	data?: ScriptData;
	error?: string;
	detectedFormat?: string;
}

// 사전 정의된 파싱 규칙들
export const DEFAULT_PARSING_RULES: ParsingRule[] = [
	{
		name: 'YouTube Refined',
		description: 'YouTube Refined 확장프로그램 JSON 형식',
		scriptPath: 'resources[0].refinedScriptData.data.script',
		titlePath: 'resources[0].title'
	},
	{
		name: 'YouTube Whisper',
		description: 'Whisper 기반 스크립트 JSON',
		scriptPath: 'resources[0].scriptData.data.title',
		titlePath: 'resources[0].title'
	},
	{
		name: 'Direct Script',
		description: '직접적인 스크립트 객체',
		scriptPath: 'script',
		titlePath: 'title'
	},
	{
		name: 'Transcript Array',
		description: '배열 형태의 대화록',
		scriptPath: 'transcript[*].text',
		titlePath: 'metadata.title'
	}
];

/**
 * 입력 데이터의 형식을 자동 감지
 */
export function detectFormat(input: string): 'json' | 'text' | 'xml' | 'csv' | 'unknown' {
	if (!input || input.trim().length === 0) {
		return 'unknown';
	}

	const trimmed = input.trim();

	// JSON 형식 확인
	if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
		(trimmed.startsWith('[') && trimmed.endsWith(']'))) {
		try {
			JSON.parse(trimmed);
			return 'json';
		} catch {
			// JSON 파싱 실패 시 다른 형식 확인
		}
	}

	// XML 형식 확인
	if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
		return 'xml';
	}

	// CSV 형식 확인 (쉼표가 있고 여러 줄인 경우)
	if (trimmed.includes(',') && trimmed.includes('\n')) {
		const lines = trimmed.split('\n');
		if (lines.length > 1) {
			const firstLine = lines[0].split(',');
			const secondLine = lines[1].split(',');
			if (firstLine.length === secondLine.length) {
				return 'csv';
			}
		}
	}

	// 기본적으로 텍스트로 처리
	return 'text';
}

/**
 * JSON 경로를 통해 값 추출
 */
function getValueByPath(obj: any, path: string): any {
	if (!path) return undefined;

	// 배열 인덱스 처리 (예: resources[0])
	const pathParts = path.split('.');
	let current = obj;

	for (const part of pathParts) {
		if (part.includes('[') && part.includes(']')) {
			const [key, indexStr] = part.split('[');
			const index = indexStr.replace(']', '');

			if (key) {
				current = current?.[key];
			}

			if (index === '*') {
				// 배열의 모든 요소에서 값 추출
				if (Array.isArray(current)) {
					return current.map(item => item).join(' ');
				}
			} else {
				const idx = parseInt(index);
				if (!isNaN(idx) && Array.isArray(current)) {
					current = current[idx];
				}
			}
		} else {
			current = current?.[part];
		}

		if (current === undefined || current === null) {
			return undefined;
		}
	}

	return current;
}

/**
 * JSON 데이터에서 스크립트 파싱
 */
export function parseScriptJson(jsonText: string, rule?: ParsingRule): ParsingResult {
	try {
		const data = JSON.parse(jsonText);
		const rulesToTry = rule ? [rule] : DEFAULT_PARSING_RULES;

		for (const currentRule of rulesToTry) {
			const script = getValueByPath(data, currentRule.scriptPath);

			if (script && typeof script === 'string' && script.trim().length > 0) {
				const title = currentRule.titlePath ?
					getValueByPath(data, currentRule.titlePath) : undefined;

				return {
					success: true,
					data: {
						script: script.trim(),
						title: title || undefined,
						source: 'json'
					},
					detectedFormat: 'json'
				};
			}
		}

		return {
			success: false,
			error: 'script-parser.errors.no-script',
			detectedFormat: 'json'
		};

	} catch (error) {
		return {
			success: false,
			error: 'script-parser.errors.invalid-json',
			detectedFormat: 'json'
		};
	}
}

/**
 * 텍스트 데이터에서 스크립트 추출
 */
export function parseScriptText(text: string): ParsingResult {
	const trimmed = text.trim();

	if (trimmed.length === 0) {
		return {
			success: false,
			error: 'script-parser.errors.empty-script',
			detectedFormat: 'text'
		};
	}

	return {
		success: true,
		data: {
			script: trimmed,
			source: 'text'
		},
		detectedFormat: 'text'
	};
}

/**
 * 파일명 생성
 */
export function generateFilename(title?: string): string {
	if (title && title.trim().length > 0) {
		// 파일명에 사용할 수 없는 문자 제거
		const cleanTitle = title
			.replace(/[<>:"/\\|?*]/g, '')
			.replace(/\s+/g, '_')
			.substring(0, 100); // 최대 100자

		return `${cleanTitle}.txt`;
	}

	// 기본 파일명에 타임스탬프 추가
	const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
	return `script_${timestamp}.txt`;
}

/**
 * 텍스트 파일 다운로드
 */
export function downloadTextFile(content: string, filename: string): void {
	const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
	const url = URL.createObjectURL(blob);

	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.style.display = 'none';

	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	URL.revokeObjectURL(url);
}

/**
 * 클립보드에 텍스트 복사
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(text);
			return true;
		} else {
			// 폴백: 임시 textarea 사용
			const textArea = document.createElement('textarea');
			textArea.value = text;
			textArea.style.position = 'fixed';
			textArea.style.left = '-999999px';
			textArea.style.top = '-999999px';
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();

			const result = document.execCommand('copy');
			document.body.removeChild(textArea);
			return result;
		}
	} catch (error) {
		console.error('Failed to copy text:', error);
		return false;
	}
}