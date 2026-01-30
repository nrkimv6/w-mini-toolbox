import type { OutputRule } from '../components/OutputRuleSelector.svelte';

/**
 * 출력 규칙에 따라 마크다운을 후처리하는 함수들
 */

// 원본 - 변환된 마크다운을 그대로 출력
function processRaw(markdown: string): string {
	return markdown;
}

// 서식 정리 - 들여쓰기와 줄바꿈을 정리하여 가독성 향상
function processFormatted(markdown: string): string {
	return markdown
		// 헤딩 앞뒤 적절한 여백 추가
		.replace(/^(#{1,6}\s.+)$/gm, '\n$1\n')
		// 목록 아이템 간 적절한 간격 유지
		.replace(/^(\s*[-*+]\s.+)$/gm, '$1')
		// 코드 블록 앞뒤 여백 추가
		.replace(/^```/gm, '\n```')
		.replace(/^```$/gm, '```\n')
		// 연속된 빈 줄을 2개로 제한
		.replace(/\n{3,}/g, '\n\n')
		// 문단 간 적절한 여백
		.replace(/([.!?])\n([A-Z가-힣])/g, '$1\n\n$2')
		.trim();
}

// 정리된 텍스트 - 불필요한 요소를 제거하고 핵심 내용만 추출
function processClean(markdown: string): string {
	return markdown
		// 이미지 제거 (alt 텍스트만 남김)
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, '[$1]')
		// 링크를 텍스트로 변환
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		// 인라인 코드를 일반 텍스트로
		.replace(/`([^`]+)`/g, '$1')
		// 볼드/이탤릭 제거
		.replace(/(\*{1,2}|_{1,2})([^*_]+)\1/g, '$2')
		// 취소선 제거
		.replace(/~~([^~]+)~~/g, '$1')
		// 테이블을 간단한 텍스트로 변환
		.replace(/\|([^|\n]+)\|/g, '$1')
		.replace(/\|[-:|\s]+\|/g, '')
		// HTML 태그 제거
		.replace(/<[^>]+>/g, '')
		// 연속된 빈 줄 정리
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

// 구조화 - 헤딩과 목록을 명확히 구분하여 구조적으로 정리
function processStructured(markdown: string): string {
	let processed = markdown;
	
	// 헤딩 레벨별 구조화
	processed = processed
		// 각 헤딩 앞에 구분선 추가 (레벨 1, 2만)
		.replace(/^(#{1,2}\s.+)$/gm, '\n---\n\n$1\n')
		// 목록을 구조적으로 정리
		.replace(/^(\s*)([-*+])\s(.+)$/gm, (match, indent, marker, content) => {
			const level = indent.length / 2;
			const indentStr = '  '.repeat(level);
			return `${indentStr}• ${content}`;
		})
		// 번호 있는 목록 구조화
		.replace(/^(\s*)(\d+\.)\s(.+)$/gm, (match, indent, number, content) => {
			const level = indent.length / 2;
			const indentStr = '  '.repeat(level);
			return `${indentStr}${number} ${content}`;
		});
	
	// 연속된 구분선 제거
	processed = processed
		.replace(/\n---\n\n---\n/g, '\n---\n')
		.replace(/^\n---\n/, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	
	return processed;
}

// 최소 - 핵심 텍스트만 남기고 모든 서식 제거
function processMinimal(markdown: string): string {
	return markdown
		// 모든 마크다운 서식 제거
		.replace(/^#{1,6}\s*/gm, '') // 헤딩
		.replace(/^\s*[-*+]\s*/gm, '• ') // 목록
		.replace(/^\s*\d+\.\s*/gm, '') // 번호 목록
		.replace(/^\s*>\s*/gm, '') // 인용
		.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // 볼드/이탤릭
		.replace(/_([^_]+)_/g, '$1') // 언더스코어
		.replace(/~~([^~]+)~~/g, '$1') // 취소선
		.replace(/`([^`]+)`/g, '$1') // 인라인 코드
		.replace(/```[\s\S]*?```/g, '') // 코드 블록 제거
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, '[$1]') // 이미지
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 링크
		.replace(/\|([^|\n]+)\|/g, '$1') // 테이블
		.replace(/\|[-:|\s]+\|/g, '')
		// 연속된 공백과 줄바꿈 정리
		.replace(/[ \t]+/g, ' ')
		.replace(/\n{2,}/g, '\n')
		.trim();
}

// 마크다운 최적화 - 빈 링크 제거, 서식 정리 등 마크다운 품질 개선
function processMarkdownOptimize(markdown: string): string {
	let processed = markdown;
	
	// 빈 링크와 이미지 제거
	processed = processed
		// 빈 링크 제거 - 다양한 패턴 처리
		.replace(/\[[\s\n]*\]\([^)]*\)/g, '') // 빈 텍스트 링크 제거
		.replace(/\[\s*\]\([^)]*\)/g, '') // 공백만 있는 링크 제거
		.replace(/\[\]\([^)]*\)/g, '') // 완전히 빈 링크 제거
		// 빈 이미지 제거
		.replace(/!\[[\s\n]*\]\([^)]*\)/g, '') // 빈 이미지 제거
		.replace(/!\[\s*\]\([^)]*\)/g, '') // 공백만 있는 이미지 제거
		.replace(/!\[\]\([^)]*\)/g, '') // 완전히 빈 이미지 제거
		// 불필요한 백슬래시 제거
		.replace(/\\([#>[\]_*`])/g, '$1')
		// 중복된 구두점 정리
		.replace(/([.!?]){2,}/g, '$1')
		// 문장 끝 공백 제거
		.replace(/\s+$/gm, '');
		
	// 마크다운 구조 정리 - 순서가 중요함
	processed = processed
		// 먼저 과도한 빈 줄 정리 (3개 이상 → 2개)
		.replace(/\n{3,}/g, '\n\n')
		// 헤딩 앞뒤 빈 줄 확보 (헤딩은 앞뒤로 빈 줄이 있어야 가독성이 좋음)
		.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2') // 헤딩 앞에 빈 줄
		.replace(/(#{1,6}\s.+)\n([^#\n\s])/g, '$1\n\n$2') // 헤딩 뒤에 빈 줄 (다음이 헤딩이나 빈 줄이 아닌 경우)
		// 리스트 앞뒤 빈 줄 확보
		.replace(/([^\n])\n(\s*[-*+]\s)/g, '$1\n\n$2')
		.replace(/(\s*[-*+]\s.+)\n([^\n\s*-])/g, '$1\n\n$2')
		// 코드 블록 앞뒤 빈 줄 확보
		.replace(/([^\n])\n(```)/g, '$1\n\n$2')
		.replace(/(```[^\n]*\n[\s\S]*?```)\n([^\n])/g, '$1\n\n$2')
		// 인용구 앞뒤 빈 줄 확보
		.replace(/([^\n>])\n(>\s)/g, '$1\n\n$2')
		.replace(/(>\s.+)\n([^>\n])/g, '$1\n\n$2')
		// 최종적으로 3개 이상의 연속 빈 줄을 2개로 제한
		.replace(/\n{3,}/g, '\n\n')
		// 시작과 끝 공백 제거
		.trim();
		
	return processed;
}

// Gemini 포맷1 - 사용자/AI 대화형 구조
function processGeminiFormat1(markdown: string): string {
	const now = new Date();
	const title = extractTitle(markdown) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	
	// HTML에서 사용자와 AI 응답 구분하여 파싱
	const conversations = parseGeminiConversations(markdown);
	
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

// Gemini 포맷2 - QA형 구조
function processGeminiFormat2(markdown: string): string {
	const now = new Date();
	const title = extractTitle(markdown) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	
	const conversations = parseGeminiConversations(markdown);
	
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

// Gemini 포맷3 - 인용형 구조
function processGeminiFormat3(markdown: string): string {
	const conversations = parseGeminiConversations(markdown);
	
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

// Gemini 포맷4 - 코드형 구조
function processGeminiFormat4(markdown: string): string {
	const conversations = parseGeminiConversations(markdown);
	
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

// Claude 포맷1 - 대화형 구조
function processClaudeFormat1(markdown: string): string {
	const now = new Date();
	const title = extractTitle(markdown) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	
	const conversations = parseClaudeConversations(markdown);
	
	let result = `# ${title}\n\n`;
	
	conversations.forEach((conv, index) => {
		if (conv.type === 'user') {
			result += `---\n\n## 사용자\n\n${conv.content}\n\n`;
		} else if (conv.type === 'ai') {
			result += `---\n\n## Claude\n\n${conv.content}\n\n`;
		}
	});
	
	return result.trim();
}

// Claude 포맷2 - QA형 구조
function processClaudeFormat2(markdown: string): string {
	const now = new Date();
	const title = extractTitle(markdown) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	
	const conversations = parseClaudeConversations(markdown);
	
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

// Claude 포맷3 - 인용형 구조
function processClaudeFormat3(markdown: string): string {
	const conversations = parseClaudeConversations(markdown);
	
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

// Claude 포맷4 - 코드형 구조
function processClaudeFormat4(markdown: string): string {
	const conversations = parseClaudeConversations(markdown);
	
	let result = '';
	
	conversations.forEach((conv, index) => {
		if (conv.type === 'user') {
			result += `**사용자**\n\`\`\`\n${conv.content}\n\`\`\`\n\n`;
		} else if (conv.type === 'ai') {
			result += `**Claude**\n\`\`\`\n${conv.content}\n\`\`\`\n\n`;
		}
	});
	
	return result.trim();
}

// 제목 추출 함수 - HTML과 마크다운 모두 지원
function extractTitle(content: string): string | null {
	console.log('🔍 extractTitle() called with content length:', content.length);
	console.log('🔍 Content preview:', content.substring(0, 500));
	
	// HTML에서 제목 추출 시도
	const hasH1 = content.includes('<h1');
	const hasH2 = content.includes('<h2');
	const hasTitle = content.includes('<title');
	console.log('🔍 HTML heading check:', { hasH1, hasH2, hasTitle });
	
	if (hasH1 || hasH2 || hasTitle) {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(content, 'text/html');
			
			// 1. <title> 태그 먼저 확인 (단, 기본값이 아닌 경우만)
			const titleTag = doc.querySelector('title');
			console.log('🔍 Found title tag:', titleTag ? titleTag.outerHTML : 'null');
			if (titleTag && titleTag.textContent && titleTag.textContent.trim() !== 'Claude') {
				const title = titleTag.textContent.trim();
				console.log('✅ Extracted title tag:', title);
				return title;
			}
			
			// 2. <h1> 제목 확인 (가장 우선순위가 높음)
			const h1 = doc.querySelector('h1');
			console.log('🔍 Found h1 element:', h1 ? h1.outerHTML : 'null');
			if (h1 && h1.textContent) {
				const title = h1.textContent.trim();
				console.log('✅ Extracted h1 title:', title);
				return title;
			}
			
			// 3. <h2> 제목 확인
			const h2 = doc.querySelector('h2');
			console.log('🔍 Found h2 element:', h2 ? h2.outerHTML : 'null');
			if (h2 && h2.textContent) {
				const title = h2.textContent.trim();
				console.log('✅ Extracted h2 title:', title);
				return title;
			}
			
			console.log('❌ No valid HTML headings found');
		} catch (error) {
			console.log('❌ HTML title extraction failed:', error);
		}
	}
	
	// 마크다운에서 제목 추출 시도
	const headingMatch = content.match(/^#+\s+(.+)$/m);
	console.log('🔍 Markdown heading match:', headingMatch);
	if (headingMatch) {
		const title = headingMatch[1].trim();
		console.log('✅ Extracted markdown title:', title);
		return title;
	}
	
	console.log('❌ No title found, using default');
	return null;
}

// Gemini 대화 파싱 함수 - HTML에서 CSS selector를 사용하여 파싱
function parseGeminiConversations(htmlContent: string): Array<{type: 'user' | 'ai', content: string}> {
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
			console.log('Gemini parsing: Missing required selectors, falling back to simple parsing');
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
		
		// 대안 방법: 더 넓은 범위의 셀렉터로 시도
		if (conversations.length === 0) {
			console.log('Gemini parsing: Trying alternative parsing method');
			
			// 더 일반적인 셀렉터들로 시도
			const alternativeSelectors = [
				'[data-message-id]',
				'[role="button"]',
				'.message',
				'div[class*="message"]',
				'article',
				'section'
			];
			
			for (const selector of alternativeSelectors) {
				const elements = doc.querySelectorAll(selector);
				if (elements.length > 0) {
					elements.forEach((element, index) => {
						const content = element.textContent?.trim() || '';
						if (content && content.length > 20) { // 의미있는 텍스트만
							const type = index % 2 === 0 ? 'user' : 'ai';
							conversations.push({type, content});
						}
					});
					
					if (conversations.length > 0) break;
				}
			}
		}
		
		// 파싱 결과가 없으면 폴백 사용
		if (conversations.length === 0) {
			console.log('Gemini parsing: No conversations found, falling back to simple parsing');
			return parseConversationsFallback(htmlContent);
		}
		
	} catch (error) {
		console.error('Gemini conversation parsing error:', error);
		return parseConversationsFallback(htmlContent);
	}
	
	return conversations;
}

// Claude 대화 파싱 함수 - HTML에서 CSS selector를 사용하여 파싱
function parseClaudeConversations(htmlContent: string): Array<{type: 'user' | 'ai', content: string}> {
	const conversations: Array<{type: 'user' | 'ai', content: string}> = [];
	
	try {
		// HTML을 파싱하기 위해 DOMParser 사용
		const parser = new DOMParser();
		const doc = parser.parseFromString(htmlContent, 'text/html');
		
		// 1. 사용자 메시지 찾기: data-testid="user-message"와 .font-user-message 클래스를 모두 가진 요소
		// 각 사용자 메시지는 하나의 컨테이너에 여러 <p> 태그를 가질 수 있음
		const userMessageElements = doc.querySelectorAll('[data-testid="user-message"].font-user-message');
		console.log('Claude parsing: Found', userMessageElements.length, 'user message elements');
		
		const userMessages: Array<{content: string, element: Element}> = [];
		userMessageElements.forEach(userEl => {
			// 각 사용자 메시지 컨테이너 내의 모든 텍스트를 하나로 결합
			const paragraphs = userEl.querySelectorAll('p');
			const links = userEl.querySelectorAll('a');
			
			const textParts: string[] = [];
			
			// p 태그들의 내용을 순서대로 수집
			paragraphs.forEach(p => {
				const text = p.textContent?.trim();
				if (text && text.length > 0) {
					textParts.push(text);
				}
			});
			
			// 링크들도 별도로 처리
			links.forEach(a => {
				const text = a.textContent?.trim();
				const href = a.getAttribute('href');
				if (text && text.length > 0 && !textParts.some(part => part.includes(text))) {
					// 링크가 이미 p 태그에 포함되어 있지 않은 경우만 추가
					if (href) {
						textParts.push(`${text} (${href})`);
					} else {
						textParts.push(text);
					}
				}
			});
			
			// p 태그가 없는 경우 전체 텍스트 사용
			if (textParts.length === 0) {
				const fallbackText = userEl.textContent?.trim();
				if (fallbackText && fallbackText.length > 0) {
					textParts.push(fallbackText);
				}
			}
			
			const combinedContent = textParts.join('\n\n');
			if (combinedContent && combinedContent.length > 0) {
				userMessages.push({
					content: combinedContent,
					element: userEl
				});
				console.log('Claude parsing: Found user message:', combinedContent.substring(0, 100));
			}
		});
		
		// 2. AI 메시지 찾기: data-is-streaming 속성을 가진 요소들
		const aiMessageElements = doc.querySelectorAll('[data-is-streaming]');
		console.log('Claude parsing: Found', aiMessageElements.length, 'AI message elements');
		
		const aiMessages: Array<{content: string, element: Element}> = [];
		aiMessageElements.forEach(aiEl => {
			// AI 메시지 내용 추출 - 마크다운 컨테이너 우선 검색
			let content = '';
			const markdownContainer = aiEl.querySelector('.standard-markdown, .progressive-markdown');
			
			if (markdownContainer) {
				// 마크다운 컨테이너에서 구조화된 내용 추출
				const elements = markdownContainer.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, pre, blockquote');
				const textParts: string[] = [];
				
				elements.forEach(el => {
					if (el.tagName === 'UL' || el.tagName === 'OL') {
						// 리스트 항목들을 처리
						const listItems = Array.from(el.querySelectorAll('li')).map(li => `• ${li.textContent?.trim()}`);
						if (listItems.length > 0) {
							textParts.push(listItems.join('\n'));
						}
					} else {
						const text = el.textContent?.trim();
						if (text && text.length > 0) {
							textParts.push(text);
						}
					}
				});
				
				content = textParts.join('\n\n');
			}
			
			// 마크다운 컨테이너가 없거나 내용이 없는 경우 전체 텍스트 사용
			if (!content || content.length === 0) {
				content = aiEl.textContent?.trim() || '';
			}
			
			if (content && content.length > 0) {
				aiMessages.push({
					content: content,
					element: aiEl
				});
				console.log('Claude parsing: Found AI message:', content.substring(0, 100));
			}
		});
		
		// 3. 메시지들을 DOM 순서대로 정렬
		// HTML에서 나타나는 순서대로 사용자와 AI 메시지를 배치
		const allMessageElements = [...userMessages.map(msg => ({...msg, type: 'user' as const})), 
									  ...aiMessages.map(msg => ({...msg, type: 'ai' as const}))];
		
		// DOM 순서로 정렬 (element의 위치 기준)
		allMessageElements.sort((a, b) => {
			const position = a.element.compareDocumentPosition(b.element);
			if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
				return -1; // a가 b보다 앞에 있음
			}
			if (position & Node.DOCUMENT_POSITION_PRECEDING) {
				return 1; // a가 b보다 뒤에 있음
			}
			return 0; // 같은 위치
		});
		
		// 최종 결과에 추가
		allMessageElements.forEach(msg => {
			conversations.push({
				type: msg.type,
				content: msg.content
			});
		});
		
		console.log('Claude parsing: Total conversations found:', conversations.length);
		console.log('Claude parsing: Message types:', conversations.map(c => c.type).join(', '));
		
		// 파싱 결과가 없으면 폴백 사용
		if (conversations.length === 0) {
			console.log('Claude parsing: No conversations found, falling back to simple parsing');
			return parseConversationsFallback(htmlContent);
		}
		
	} catch (error) {
		console.error('Claude conversation parsing error:', error);
		return parseConversationsFallback(htmlContent);
	}
	
	return conversations;
}

// 폴백 파싱 함수 - selector가 작동하지 않을 때 사용
function parseConversationsFallback(content: string): Array<{type: 'user' | 'ai', content: string}> {
	const conversations: Array<{type: 'user' | 'ai', content: string}> = [];
	
	// HTML에서 텍스트 추출
	try {
		const parser = new DOMParser();
		const doc = parser.parseFromString(content, 'text/html');
		const fullText = doc.body.textContent || content;
		
		// 텍스트를 문단 단위로 분할 (빈 줄로 구분)
		const paragraphs = fullText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
		
		// 첫 번째 문단이 질문이라고 가정하고, 이후 번갈아 가며 처리
		paragraphs.forEach((paragraph, index) => {
			const cleanParagraph = paragraph.replace(/\s+/g, ' ').trim();
			if (cleanParagraph.length > 10) { // 의미있는 텍스트만
				const type = index % 2 === 0 ? 'user' : 'ai';
				conversations.push({type, content: cleanParagraph});
			}
		});
		
		// 결과가 없으면 전체를 하나의 사용자 메시지로 처리
		if (conversations.length === 0 && fullText.trim().length > 0) {
			conversations.push({type: 'user', content: fullText.trim()});
		}
		
	} catch (error) {
		console.error('Fallback parsing error:', error);
		// 최후의 방법: 전체를 하나의 사용자 메시지로 처리
		if (content.trim().length > 0) {
			conversations.push({type: 'user', content: content.trim()});
		}
	}
	
	return conversations;
}

/**
 * HTML 태그 패턴을 감지하는 함수
 */
function containsHtmlTags(content: string): boolean {
	// 일반적인 HTML 태그 패턴 감지
	const htmlTagPattern = /<\/?[a-z][\s\S]*>/i;
	return htmlTagPattern.test(content);
}

/**
 * HTML로 끝나는 텍스트인지 확인
 */
function endsWithHtml(content: string): boolean {
	// 텍스트 끝부분에 HTML 태그가 있는지 확인
	const trimmed = content.trim();
	const htmlEndPattern = /<\/[a-z]+>\s*$/i;
	return htmlEndPattern.test(trimmed);
}

/**
 * 선택된 출력 규칙에 따라 마크다운을 처리
 */
export function applyOutputRule(
	markdown: string, 
	rule: OutputRule, 
	inputFormat?: string, 
	inputType?: string
): string {
	if (!markdown.trim()) {
		return markdown;
	}

	// 입력 타입과 포맷 정보 로깅 (디버깅용)
	console.log('Processing with:', { rule, inputFormat, inputType, isHtml: containsHtmlTags(markdown), endsWithHtml: endsWithHtml(markdown) });

	try {
		switch (rule) {
			case 'raw':
				return processRaw(markdown);
			case 'formatted':
				return processFormatted(markdown);
			case 'clean':
				return processClean(markdown);
			case 'structured':
				return processStructured(markdown);
			case 'minimal':
				return processMinimal(markdown);
			case 'markdown_optimize':
				return processMarkdownOptimize(markdown);
			case 'gemini_format1':
			case 'gemini_format2':
			case 'gemini_format3':
			case 'gemini_format4':
				// Gemini 전용 포맷은 converter.ts에서 HTML 단계에서 직접 처리됨
				return processRaw(markdown);
			case 'claude_format1':
				return processClaudeFormat1(markdown);
			case 'claude_format2':
				return processClaudeFormat2(markdown);
			case 'claude_format3':
				return processClaudeFormat3(markdown);
			case 'claude_format4':
				return processClaudeFormat4(markdown);
			default:
				return processRaw(markdown);
		}
	} catch (error) {
		console.error('Output processing error:', error);
		return markdown; // 오류 시 원본 반환
	}
}

/**
 * 출력 규칙 목록을 반환
 */
export function getOutputRuleDescription(rule: OutputRule): string {
	const descriptions = {
		raw: '변환된 마크다운을 그대로 출력',
		formatted: '들여쓰기와 줄바꿈을 정리하여 가독성 향상',
		clean: '불필요한 요소를 제거하고 핵심 내용만 추출',
		structured: '헤딩과 목록을 명확히 구분하여 구조적으로 정리',
		minimal: '핵심 텍스트만 남기고 모든 서식 제거',
		markdown_optimize: '빈 링크 제거, 서식 정리 등 마크다운 품질 개선',
		gemini_format1: '## 사용자/AI 헤딩으로 대화 구조화',
		gemini_format2: '## 질문/답변 형태로 구조화',
		gemini_format3: '질문과 답변을 인용구로 구조화',
		gemini_format4: '사용자/Gemini를 코드 블록으로 구조화',
		claude_format1: '## 사용자/Claude 헤딩으로 대화 구조화',
		claude_format2: '## 질문/답변 형태로 구조화',
		claude_format3: '질문과 답변을 인용구로 구조화',
		claude_format4: '사용자/Claude를 코드 블록으로 구조화'
	};
	
	return descriptions[rule] || descriptions.raw;
}