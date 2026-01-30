import TurndownService from 'turndown';
import { detectContentType, getRuleDisplayName, type DetectionResult } from '../detector/contentDetector.js';

// 규칙 타입 정의
export type SourceRule ='default' | 'gemini' | 'notion' | 'claude' | 'chatgpt';
// | 'claude_desktop_drag' | 'claude_drag_text' | 'claude_drag_html' | 'claude_dev_html' | 'chatgpt_desktop_drag' | 'chatgpt_drag_text' | 'chatgpt_drag_html' | 'chatgpt_dev_html';

// 규칙별 설정
const ruleConfigs = {
	// auto: {
	// 	name: '🤖 자동 감지',
	// 	description: '입력 내용을 분석하여 최적 규칙 자동 선택',
	// 	config: {
	// 		headingStyle: 'atx' as const,
	// 		bulletListMarker: '-' as const,
	// 		codeBlockStyle: 'fenced' as const
	// 	},
	// 	postProcess: (markdown: string) => markdown // Will be replaced by detected rule
	// },
	default: {
		name: '🔧 범용 HTML',
		description: '일반적인 HTML to Markdown 변환',
		config: {
			headingStyle: 'atx' as const,
			bulletListMarker: '-' as const,
			codeBlockStyle: 'fenced' as const
		},
		postProcess: (markdown: string) => markdown
	},
	gemini: {
		name: '🤖 Gemini',
		description: 'Google Gemini 대화 내용 변환에 최적화',
		config: {
			headingStyle: 'atx' as const,
			bulletListMarker: '-' as const,
			codeBlockStyle: 'fenced' as const
		},
		postProcess: (markdown: string) => {
			return markdown
				// 백슬래시 이스케이핑 문제 해결 - 단계적으로 처리
				.replace(/\\{4,}/g, '\\') // 4개 이상의 백슬래시를 1개로
				.replace(/\\{3}/g, '\\') // 3개 백슬래시를 1개로  
				.replace(/\\{2}/g, '\\') // 2개 백슬래시를 1개로
				// 마크다운 특수문자 앞의 불필요한 백슬래시 제거
				.replace(/\\([#>[\]_*`])/g, '$1')
				// 줄 시작 부분의 백슬래시 정리
				.replace(/^\\\s*/gm, '')
				// _ngcontent 관련 정리는 HTML 전처리에서 처리
				;
		}
	},
	notion: {
		name: '📝 Notion', 
		description: 'Notion 페이지 내용 변환에 최적화',
		config: {
			headingStyle: 'atx' as const,
			bulletListMarker: '-' as const,
			codeBlockStyle: 'fenced' as const
		},
		postProcess: (markdown: string) => {
			return markdown
				// 헤딩 앞의 백슬래시 제거
				.replace(/^\\(#+\s)/gm, '$1')
				.replace(/\\(#+)/g, '$1')
				// 이미지 마크다운 백슬래시 제거
				.replace(/!\\(\[.*?\])/g, '!$1')
				// blockquote 백슬래시 제거
				.replace(/^\\(>\s)/gm, '$1')
				.replace(/\\(>)/g, '$1')
				// script 태그 완전 제거
				.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
				// 일반적인 백슬래시 이스케이핑 문제 해결
				.replace(/\\([*_`])/g, '$1')
				// 줄 시작 부분의 백슬래시 정리
				.replace(/^\\\s*/gm, '');
		}
	},
	claude: {
		name: '🤖 Claude',
		description: 'Claude 대화 내용 변환에 최적화',
		config: {
			headingStyle: 'atx' as const,
			bulletListMarker: '-' as const,
			codeBlockStyle: 'fenced' as const
		},
		postProcess: (markdown: string) => {
			return markdown
				// Claude 특유의 HTML 요소 정리
				.replace(/class="[^"]*"/g, '')
				.replace(/data-testid="[^"]*"/g, '')
				.replace(/data-lexical-[^=]*="[^"]*"/g, '')
				.replace(/role="[^"]*"/g, '')
				// 백슬래시 이스케이핑 정리
				.replace(/\\{4,}/g, '\\')
				.replace(/\\{3}/g, '\\')
				.replace(/\\{2}/g, '\\')
				.replace(/\\([#>[\]_*`])/g, '$1')
				.replace(/^\\\s*/gm, '');
		}
	},
	chatgpt: {
		name: '💬 ChatGPT',
		description: 'ChatGPT 대화 내용 변환에 최적화',
		config: {
			headingStyle: 'atx' as const,
			bulletListMarker: '-' as const,
			codeBlockStyle: 'fenced' as const
		},
		postProcess: (markdown: string) => {
			return markdown
				// ChatGPT 특유의 HTML 요소 정리
				.replace(/data-message-[^=]*="[^"]*"/g, '')
				.replace(/class="[^"]*"/g, '')
				.replace(/data-testid="[^"]*"/g, '')
				.replace(/data-scroll-anchor/g, '')
				// 백슬래시 이스케이핑 정리
				.replace(/\\{4,}/g, '\\')
				.replace(/\\{3}/g, '\\')
				.replace(/\\{2}/g, '\\')
				.replace(/\\([#>[\]_*`])/g, '$1')
				.replace(/^\\\s*/gm, '');
		}
	}
	// claude_desktop_drag: {
	// 	name: '🤖 Claude Desktop 드래그',
	// 	description: 'Claude Desktop 앱에서 드래그한 HTML 내용 변환',
	// 	config: {
	// 		headingStyle: 'atx' as const,
	// 		bulletListMarker: '-' as const,
	// 		codeBlockStyle: 'fenced' as const
	// 	},
	// 	postProcess: (markdown: string) => {
	// 		return markdown
	// 			// Claude Desktop 특유의 HTML 요소 정리
	// 			.replace(/class="[^"]*"/g, '')
	// 			.replace(/style="[^"]*"/g, '')
	// 			.replace(/data-[^=]*="[^"]*"/g, '')
	// 			.replace(/aria-[^=]*="[^"]*"/g, '')
	// 			.replace(/role="[^"]*"/g, '')
	// 			.replace(/tabindex="[^"]*"/g, '')
	// 			// 백슬래시 이스케이핑 정리
	// 			.replace(/\\{4,}/g, '\\')
	// 			.replace(/\\{3}/g, '\\')
	// 			.replace(/\\{2}/g, '\\')
	// 			.replace(/\\([#>[\]_*`])/g, '$1')
	// 			.replace(/^\\\s*/gm, '');
	// 	}
	// },
	// claude_drag_text: {
	// 	name: '🤖 Claude 드래그 텍스트',
	// 	description: 'Claude에서 드래그한 텍스트 내용 변환',
	// 	config: {
	// 		headingStyle: 'atx' as const,
	// 		bulletListMarker: '-' as const,
	// 		codeBlockStyle: 'fenced' as const
	// 	},
	// 	postProcess: (markdown: string) => {
	// 		return markdown
	// 			// 텍스트 기반이므로 최소한의 정리만
	// 			.replace(/\n{3,}/g, '\n\n')
	// 			.trim();
	// 	}
	// },
	// claude_drag_html: {
	// 	name: '🤖 Claude 드래그 HTML',
	// 	description: 'Claude에서 드래그한 HTML 내용 변환',
	// 	config: {
	// 		headingStyle: 'atx' as const,
	// 		bulletListMarker: '-' as const,
	// 		codeBlockStyle: 'fenced' as const
	// 	},
	// 	postProcess: (markdown: string) => {
	// 		return markdown
	// 			// Claude 특유의 HTML 구조 정리
	// 			.replace(/class="[^"]*"/g, '')
	// 			.replace(/style="[^"]*"/g, '')
	// 			.replace(/<div[^>]*>/g, '')
	// 			.replace(/<\/div>/g, '')
	// 			.replace(/\\([*_`#>])/g, '$1')
	// 			.replace(/^\\\s*/gm, '');
	// 	}
	// },
	// claude_dev_html: {
	// 	name: '🤖 Claude 개발자 도구',
	// 	description: 'Claude 개발자 도구에서 복사한 HTML 변환',
	// 	config: {
	// 		headingStyle: 'atx' as const,
	// 		bulletListMarker: '-' as const,
	// 		codeBlockStyle: 'fenced' as const
	// 	},
	// 	postProcess: (markdown: string) => {
	// 		return markdown
	// 			// 개발자 도구의 복잡한 HTML 속성 제거
	// 			.replace(/class="[^"]*"/g, '')
	// 			.replace(/style="[^"]*"/g, '')
	// 			.replace(/data-[^=]*="[^"]*"/g, '')
	// 			.replace(/id="[^"]*"/g, '')
	// 			.replace(/<span[^>]*>/g, '')
	// 			.replace(/<\/span>/g, '')
	// 			.replace(/\\([*_`#>])/g, '$1');
	// 	}
	// },
	// chatgpt_desktop_drag: {
	// 	name: '💬 ChatGPT Desktop 드래그',
	// 	description: 'ChatGPT Desktop 앱에서 드래그한 HTML 내용 변환',
	// 	config: {
	// 		headingStyle: 'atx' as const,
	// 		bulletListMarker: '-' as const,
	// 		codeBlockStyle: 'fenced' as const
	// 	},
	// 	postProcess: (markdown: string) => {
	// 		return markdown
	// 			// ChatGPT Desktop 특유의 요소 정리
	// 			.replace(/class="[^"]*"/g, '')
	// 			.replace(/style="[^"]*"/g, '')
	// 			.replace(/data-[^=]*="[^"]*"/g, '')
	// 			.replace(/aria-[^=]*="[^"]*"/g, '')
	// 			// ChatGPT의 메타 속성 제거
	// 			.replace(/property="[^"]*"/g, '')
	// 			.replace(/content="[^"]*"/g, '')
	// 			.replace(/\\([*_`#>])/g, '$1');
	// 	}
	// },
	// chatgpt_drag_text: {
	// 	name: '💬 ChatGPT 드래그 텍스트',
	// 	description: 'ChatGPT에서 드래그한 텍스트 내용 변환',
	// 	config: {
	// 		headingStyle: 'atx' as const,
	// 		bulletListMarker: '-' as const,
	// 		codeBlockStyle: 'fenced' as const
	// 	},
	// 	postProcess: (markdown: string) => {
	// 		return markdown
	// 			// 텍스트 기반 정리
	// 			.replace(/\n{3,}/g, '\n\n')
	// 			.trim();
	// 	}
	// },
	// chatgpt_drag_html: {
	// 	name: '💬 ChatGPT 드래그 HTML',
	// 	description: 'ChatGPT에서 드래그한 HTML 내용 변환',
	// 	config: {
	// 		headingStyle: 'atx' as const,
	// 		bulletListMarker: '-' as const,
	// 		codeBlockStyle: 'fenced' as const
	// 	},
	// 	postProcess: (markdown: string) => {
	// 		return markdown
	// 			// ChatGPT HTML 구조 정리
	// 			.replace(/class="[^"]*"/g, '')
	// 			.replace(/style="[^"]*"/g, '')
	// 			.replace(/<div[^>]*>/g, '')
	// 			.replace(/<\/div>/g, '')
	// 			.replace(/\\([*_`#>])/g, '$1');
	// 	}
	// },
	// chatgpt_dev_html: {
	// 	name: '💬 ChatGPT 개발자 도구',
	// 	description: 'ChatGPT 개발자 도구에서 복사한 HTML 변환',
	// 	config: {
	// 		headingStyle: 'atx' as const,
	// 		bulletListMarker: '-' as const,
	// 		codeBlockStyle: 'fenced' as const
	// 	},
	// 	postProcess: (markdown: string) => {
	// 		return markdown
	// 			// ChatGPT 개발자 도구의 복잡한 구조 정리
	// 			.replace(/class="[^"]*"/g, '')
	// 			.replace(/style="[^"]*"/g, '')
	// 			.replace(/data-[^=]*="[^"]*"/g, '')
	// 			.replace(/id="[^"]*"/g, '')
	// 			.replace(/<span[^>]*>/g, '')
	// 			.replace(/<\/span>/g, '')
	// 			.replace(/property="[^"]*"/g, '')
	// 			.replace(/content="[^"]*"/g, '')
	// 			.replace(/\\([*_`#>])/g, '$1');
	// 	}
	// }
};

// 현재 활성 규칙을 저장하는 변수
let currentRule: SourceRule = 'default';
let turndownService = new TurndownService(ruleConfigs.default.config);
let lastDetectionResult: DetectionResult | null = null;

// HTML 태그 존재 여부 확인
function hasHtmlTags(text: string): boolean {
	const htmlTagRegex = /<\/?[a-z][\s\S]*>/i;
	return htmlTagRegex.test(text);
}

// 첫 번째 제목 추출 (파일명용)
function extractFirstHeading(markdown: string): string {
	const headingMatch = markdown.match(/^#+\s+(.+)$/m);
	if (headingMatch && headingMatch[1]) {
		return headingMatch[1].trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
	}
	return 'untitled';
}

// 공백 정리
function cleanupMarkdown(markdown: string): string {
	return markdown
		.replace(/\n{3,}/g, '\n\n') // 연속된 빈 줄을 2개까지만 허용
		.trim(); // 시작과 끝 공백 제거
}

// 입력 핸들링 규칙 설정정 함수
export function setSourceRule(rule: SourceRule): void {
	currentRule = rule;
	turndownService = new TurndownService(ruleConfigs[rule].config);
}

// 현재 입력 규칙 가져오기
export function getCurrentSourceRule(): SourceRule {
	return currentRule;
}

// 규칙 목록 가져오기
export function getAvailableRules(): Array<{key: SourceRule, name: string, description: string}> {
	return Object.entries(ruleConfigs).map(([key, config]) => ({
		key: key as SourceRule,
		name: config.name,
		description: config.description
	}));
}

// Gemini 대화 파싱 함수 - HTML에서 CSS selector를 사용하여 파싱
function parseGeminiConversationsFromHtml(htmlContent: string): Array<{type: 'user' | 'ai', content: string}> {
	const conversations: Array<{type: 'user' | 'ai', content: string}> = [];
	
	try {
		// HTML을 파싱하기 위해 DOMParser 사용
		const parser = new DOMParser();
		const doc = parser.parseFromString(htmlContent, 'text/html');
		
		// 3개 셀렉터 모두 확인 - 하나라도 없으면 폴백 사용
		const userQueryContainers = doc.querySelectorAll('.user-query-container');
		const userQueryBubbleContainers = doc.querySelectorAll('.user-query-bubble-container');
		const responseContainers = doc.querySelectorAll('.response-container');
		
		// 3개 셀렉터가 모두 존재하는지 확인
		const hasAllSelectors = userQueryContainers.length > 0 && 
								userQueryBubbleContainers.length > 0 && 
								responseContainers.length > 0;
		
		if (!hasAllSelectors) {
			console.log('Gemini parsing: Missing required selectors, using fallback');
			return parseConversationsFallback(htmlContent);
		}
		
		// 사용자 질문 추출 (두 셀렉터 모두 사용)
		const userQueries = doc.querySelectorAll('.user-query-container, .user-query-bubble-container');
		const aiResponses = doc.querySelectorAll('.response-container');
		
		// 사용자 질문과 AI 응답을 순서대로 매칭
		const maxLength = Math.max(userQueries.length, aiResponses.length);
		
		for (let i = 0; i < maxLength; i++) {
			if (userQueries[i]) {
				const userContent = userQueries[i].textContent?.trim() || '';
				if (userContent) {
					conversations.push({type: 'user', content: userContent});
				}
			}
			
			if (aiResponses[i]) {
				const aiContent = aiResponses[i].textContent?.trim() || '';
				if (aiContent) {
					conversations.push({type: 'ai', content: aiContent});
				}
			}
		}
		
		// 파싱 결과가 없으면 폴백 사용
		if (conversations.length === 0) {
			console.log('Gemini parsing: No conversations found, using fallback');
			return parseConversationsFallback(htmlContent);
		}
		
	} catch (error) {
		console.error('Gemini conversation parsing error:', error);
		return parseConversationsFallback(htmlContent);
	}
	
	return conversations;
}

// 폴백 파싱 함수 - selector가 작동하지 않을 때 사용
function parseConversationsFallback(content: string): Array<{type: 'user' | 'ai', content: string}> {
	// 마크다운으로 변환된 내용에서 패턴을 찾아 파싱
	const lines = content.split('\n');
	const conversations: Array<{type: 'user' | 'ai', content: string}> = [];
	let currentContent = '';
	let currentType: 'user' | 'ai' = 'user';
	let isFirstEntry = true;
	
	for (const line of lines) {
		if (line.trim()) {
			if (isFirstEntry) {
				currentType = 'user';
				isFirstEntry = false;
			} else if (currentContent.length > 200) { // 임의의 구분점
				conversations.push({type: currentType, content: currentContent.trim()});
				currentContent = line;
				currentType = currentType === 'user' ? 'ai' : 'user';
			} else {
				currentContent += '\n' + line;
			}
		}
	}
	
	if (currentContent.trim()) {
		conversations.push({type: currentType, content: currentContent.trim()});
	}
	
	return conversations;
}

// Gemini 전용 변환 함수들을 추가
function convertGeminiToFormat1(html: string): string {
	// chat-window-content 내용만 추출 (대화 내용만)
	let processedHtml = html;
	const chatWindowContentMatch = processedHtml.match(/<chat-window-content[^>]*>([\s\S]*?)<\/chat-window-content>/i);
	if (chatWindowContentMatch) {
		processedHtml = chatWindowContentMatch[1];
	}
	
	const conversations = parseGeminiConversationsFromHtml(processedHtml);
	const now = new Date();
	const title = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	
	let result = `# ${title}\n\n`;
	
	conversations.forEach((conv, index) => {
		if (conv.type === 'user') {
			result += `---\n\n## 사용자\n\n${conv.content}\n\n`;
		} else if (conv.type === 'ai') {
			result += `---\n\n## AI\n\n${conv.content}\n\n`;
		}
	});
	
	return result.trim();
}

function convertGeminiToFormat2(html: string): string {
	// chat-window-content 내용만 추출 (대화 내용만)
	let processedHtml = html;
	const chatWindowContentMatch = processedHtml.match(/<chat-window-content[^>]*>([\s\S]*?)<\/chat-window-content>/i);
	if (chatWindowContentMatch) {
		processedHtml = chatWindowContentMatch[1];
	}
	
	const conversations = parseGeminiConversationsFromHtml(processedHtml);
	const now = new Date();
	const title = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	
	let result = `# ${title}\n\n`;
	let questionCount = 1;
	
	for (let i = 0; i < conversations.length; i += 2) {
		const question = conversations[i];
		const answer = conversations[i + 1];
		
		if (question && question.type === 'user') {
			result += `## 질문${questionCount}\n\n${question.content}\n\n`;
			if (answer && answer.type === 'ai') {
				result += `${answer.content}\n\n---\n\n`;
			}
			questionCount++;
		}
	}
	
	return result.replace(/---\n\n$/, '').trim();
}

function convertGeminiToFormat3(html: string): string {
	// chat-window-content 내용만 추출 (대화 내용만)
	let processedHtml = html;
	const chatWindowContentMatch = processedHtml.match(/<chat-window-content[^>]*>([\s\S]*?)<\/chat-window-content>/i);
	if (chatWindowContentMatch) {
		processedHtml = chatWindowContentMatch[1];
	}
	
	const conversations = parseGeminiConversationsFromHtml(processedHtml);
	
	let result = '';
	let questionCount = 1;
	
	for (let i = 0; i < conversations.length; i += 2) {
		const question = conversations[i];
		const answer = conversations[i + 1];
		
		if (question && question.type === 'user') {
			result += `## 질문${questionCount}\n> ${question.content}\n\n`;
			if (answer && answer.type === 'ai') {
				result += `## 답변${questionCount}\n> ${answer.content}\n\n---\n\n`;
			}
			questionCount++;
		}
	}
	
	return result.replace(/---\n\n$/, '').trim();
}

function convertGeminiToFormat4(html: string): string {
	// chat-window-content 내용만 추출 (대화 내용만)
	let processedHtml = html;
	const chatWindowContentMatch = processedHtml.match(/<chat-window-content[^>]*>([\s\S]*?)<\/chat-window-content>/i);
	if (chatWindowContentMatch) {
		processedHtml = chatWindowContentMatch[1];
	}
	
	const conversations = parseGeminiConversationsFromHtml(processedHtml);
	
	let result = '';
	
	conversations.forEach((conv, index) => {
		if (conv.type === 'user') {
			result += `**사용자**\n\`\`\`\n${conv.content}\n\`\`\`\n\n`;
		} else if (conv.type === 'ai') {
			result += `**Gemini**\n\`\`\`\n${conv.content}\n\`\`\`\n\n`;
		}
	});
	
	return result.trim();
}

// 현재 선택된 출력 규칙을 저장하는 변수
let currentOutputRule: string | null = null;

// 출력 규칙 설정 함수
export function setOutputRule(rule: string): void {
	currentOutputRule = rule;
}

// 2-pass 변환 함수
export function convertHtmlToMarkdown(html: string): string {
	if (!html.trim()) {
		return '';
	}

	try {
		// Use current rule directly
		let effectiveRule = currentRule;
		
		// Gemini 전용 출력 규칙이 선택되었고 Gemini 규칙인 경우 HTML에서 직접 변환
		if (effectiveRule === 'gemini' && currentOutputRule) {
			switch (currentOutputRule) {
				case 'gemini_format1':
					return convertGeminiToFormat1(html);
				case 'gemini_format2':
					return convertGeminiToFormat2(html);
				case 'gemini_format3':
					return convertGeminiToFormat3(html);
				case 'gemini_format4':
					return convertGeminiToFormat4(html);
			}
		}
		
		// HTML 전처리
		let processedHtml = html;
		
		if (effectiveRule === 'gemini') {
			// Gemini: chat-window-content 내용만 추출 (대화 내용만)
			const chatWindowContentMatch = processedHtml.match(/<chat-window-content[^>]*>([\s\S]*?)<\/chat-window-content>/i);
			if (chatWindowContentMatch) {
				processedHtml = chatWindowContentMatch[1];
				console.log('Extracted chat-window-content:', processedHtml.substring(0, 200) + '...');
			} else {
				// chat-window-content가 없으면 infinite-scroller로 폴백
				const infiniteScrollerMatch = processedHtml.match(/<infinite-scroller[^>]*>([\s\S]*?)<\/infinite-scroller>/i);
				if (infiniteScrollerMatch) {
					processedHtml = infiniteScrollerMatch[1];
					console.log('Fallback to infinite-scroller:', processedHtml.substring(0, 200) + '...');
				}
			}
			// _ngcontent 속성 제거
			processedHtml = processedHtml.replace(/\s+_ngcontent[^=]*="[^"]*"/g, '');
		} else if (effectiveRule === 'notion') {
			// Notion: .notion-page-content 내용만 추출
			const notionPageContentMatch = processedHtml.match(/<[^>]*class="[^"]*notion-page-content[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);
			if (notionPageContentMatch) {
				processedHtml = notionPageContentMatch[1];
			}
		}
		
		// 모든 규칙에서 script 태그 제거
		processedHtml = processedHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

		// 1차 변환
		let markdown = turndownService.turndown(processedHtml);
		
		// HTML 태그가 남아있으면 2차 변환 수행
		if (hasHtmlTags(markdown)) {
			// 개행을 <br />로 치환
			const modifiedHtml = markdown.replace(/\n/g, '<br />');
			// 2차 변환
			markdown = turndownService.turndown(modifiedHtml);
		}
		
		// 규칙별 후처리 적용
		markdown = ruleConfigs[effectiveRule].postProcess(markdown);
		
		// 공백 정리
		return cleanupMarkdown(markdown);
	} catch (error) {
		console.error('Conversion error:', error);
		return 'Error: Failed to convert HTML to Markdown';
	}
}

// 파일명 생성 함수
export function generateFilename(markdown: string): string {
	const now = new Date();
	const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
	const time = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-mm-ss
	const heading = extractFirstHeading(markdown);
	
	return `${date}_${time}_${heading}.md`;
}

// 클립보드에 복사
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (error) {
		console.error('Failed to copy to clipboard:', error);
		return false;
	}
}

// 파일 다운로드
export function downloadAsFile(content: string, filename: string): void {
	const blob = new Blob([content], { type: 'text/markdown' });
	const url = URL.createObjectURL(blob);
	
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	
	URL.revokeObjectURL(url);
}

// 마지막 감지 결과 조회
export function getLastDetectionResult(): DetectionResult | null {
	return lastDetectionResult;
}

// 현재 유효 규칙 조회 (자동 감지 시 실제 적용된 규칙)
export function getEffectiveRule(): SourceRule {
	console.log('getEffectiveRule', currentRule);
	return currentRule;
}