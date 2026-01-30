/**
 * Content Detection Engine for Auto-Conversion Rules
 * Automatically detects the source type (Gemini, Notion, Generic HTML) of input content
 */

export interface DetectionResult {
	// rule: 'auto' | 'gemini' | 'notion' | 'generic';
	rule:  'gemini' | 'notion' | 'generic' | 'claude' | 'chatgpt';
	confidence: number; // 0.0 ~ 1.0
	patterns: string[]; // 매치된 패턴들
	reason: string; // 감지 근거 설명
	warning?: string; // 경고 메시지 (선택적)
}

export interface DetectionPattern {
	name: string;
	test: (html: string) => boolean;
	weight: number;
	description: string;
}

/**
 * Gemini Detection Patterns
 */
const GEMINI_PATTERNS: DetectionPattern[] = [
	// Primary patterns (95%+ confidence)
	{
		name: 'gemini-conversation-selectors',
		test: (html) => {
			// 3개 셀렉터가 모두 있는지 확인
			return html.includes('user-query-container') && 
				   html.includes('user-query-bubble-container') && 
				   html.includes('response-container');
		},
		weight: 60,
		description: 'Gemini conversation structure with all required selectors'
	},
	{
		name: 'chat-app-tag',
		test: (html) => html.includes('<chat-app'),
		weight: 50,
		description: 'Chat app main container tag'
	},
	{
		name: 'bard-components',
		test: (html) => /<bard-[^>]*>/i.test(html),
		weight: 45,
		description: 'Bard/Gemini specific components'
	},
	{
		name: 'chat-window-content',
		test: (html) => html.includes('chat-window-content'),
		weight: 40,
		description: 'Gemini chat window content container'
	},
	{
		name: 'gemini-text-in-bard-test-id',
		test: (html) => html.includes('data-test-id="bard-text"') && html.includes('Gemini'),
		weight: 40,
		description: 'Gemini text in bard test element'
	},
	{
		name: 'gemini-sparkle-resource',
		test: (html) => html.includes('gstatic.com/lamda/images/gemini_sparkle'),
		weight: 35,
		description: 'Gemini sparkle icon resource'
	},

	// Secondary patterns (80%+ confidence)
	{
		name: 'gem-spark-icon',
		test: (html) => html.includes('gem_spark') && html.includes('Gems'),
		weight: 25,
		description: 'Gem spark icon with Gems text'
	},
	{
		name: 'bot-list-components',
		test: (html) => html.includes('<bot-list') || html.includes('<conversations-list'),
		weight: 20,
		description: 'Bot list or conversations list components'
	},
	{
		name: 'temp-chat-icon',
		test: (html) => html.includes('temp-chat-icon'),
		weight: 15,
		description: 'Temporary chat icon component'
	},
	{
		name: 'pill-ui-container',
		test: (html) => html.includes('pill-ui-logo-container'),
		weight: 15,
		description: 'Pill UI logo container'
	},

	// Tertiary patterns (60%+ confidence)
	{
		name: 'angular-attributes',
		test: (html) => {
			const matches = html.match(/(_nghost-|_ngcontent-|ng-)/g);
			return matches ? matches.length > 10 : false;
		},
		weight: 10,
		description: 'High count of Angular framework attributes'
	},
	{
		name: 'material-design-classes',
		test: (html) => {
			const matches = html.match(/(mat-|mdc-|gds-)/g);
			return matches ? matches.length > 5 : false;
		},
		weight: 8,
		description: 'Material Design component classes'
	},
	{
		name: 'google-tracking-attributes',
		test: (html) => {
			const matches = html.match(/(jslog|data-hveid|google-symbols)/g);
			return matches ? matches.length > 3 : false;
		},
		weight: 5,
		description: 'Google tracking and logging attributes'
	}
];

/**
 * Claude Detection Patterns
 */
const CLAUDE_PATTERNS: DetectionPattern[] = [
	// Primary patterns (95%+ confidence)
	{
		name: 'claude-user-message-testid',
		test: (html) => html.includes('data-testid="user-message"'),
		weight: 50,
		description: 'Claude user message test identifier'
	},
	{
		name: 'claude-domain-reference',
		test: (html) => html.includes('claude.ai') || html.includes('anthropic.com'),
		weight: 45,
		description: 'Claude or Anthropic domain references'
	},
	{
		name: 'claude-whitespace-classes',
		test: (html) => html.includes('whitespace-pre-wrap break-words'),
		weight: 40,
		description: 'Claude message content whitespace classes'
	},
	{
		name: 'claude-font-user-message',
		test: (html) => html.includes('font-user-message'),
		weight: 40,
		description: 'Claude user message font class'
	},
	{
		name: 'claude-text-classes',
		test: (html) => html.includes('class="text-text-') || html.includes('text-[0.9375rem]'),
		weight: 35,
		description: 'Claude specific text styling classes'
	},
	{
		name: 'claude-bg-classes',
		test: (html) => html.includes('bg-bg-000') || html.includes('bg-bg-300'),
		weight: 30,
		description: 'Claude background color classes'
	},

	// Secondary patterns (80%+ confidence)
	{
		name: 'claude-styrene-font',
		test: (html) => html.includes('styreneB') || html.includes('font-family: styrene'),
		weight: 30,
		description: 'Claude Styrene font family'
	},
	{
		name: 'anthropic-font-variables',
		test: (html) => {
			const matches = html.match(/__variable_[a-f0-9]{6}/g);
			return matches ? matches.length > 3 : false;
		},
		weight: 25,
		description: 'Anthropic CSS font variable naming pattern'
	},
	{
		name: 'claude-tailwind-patterns',
		test: (html) => {
			const claudeTailwindPatterns = [
				'group relative inline-flex',
				'whitespace-pre-wrap',
				'break-words',
				'text-text-',
				'bg-bg-',
				'border-border-'
			];
			return claudeTailwindPatterns.filter(pattern => html.includes(pattern)).length >= 3;
		},
		weight: 25,
		description: 'Claude-specific Tailwind CSS patterns'
	},
	{
		name: 'lexical-editor-attributes',
		test: (html) => html.includes('data-lexical-') || html.includes('prose-mirror'),
		weight: 15,
		description: 'Lexical or ProseMirror editor attributes'
	},
	{
		name: 'claude-build-identifier',
		test: (html) => html.includes('data-build-id='),
		weight: 10,
		description: 'Claude application build identifier'
	}
];

/**
 * ChatGPT Detection Patterns
 */
const CHATGPT_PATTERNS: DetectionPattern[] = [
	// Primary patterns (95%+ confidence)
	{
		name: 'chatgpt-og-site-name',
		test: (html) => html.includes('property="og:site_name" content="ChatGPT"'),
		weight: 50,
		description: 'ChatGPT Open Graph site name meta tag'
	},
	{
		name: 'openai-domain-reference',
		test: (html) => html.includes('chatgpt.com') || html.includes('openai.com') || html.includes('oaistatic.com'),
		weight: 45,
		description: 'OpenAI or ChatGPT domain references'
	},
	{
		name: 'message-author-role',
		test: (html) => html.includes('data-message-author-role='),
		weight: 40,
		description: 'ChatGPT message author role attributes'
	},
	{
		name: 'markdown-prose-classes',
		test: (html) => html.includes('class="markdown prose"'),
		weight: 35,
		description: 'ChatGPT markdown prose rendering classes'
	},

	// Secondary patterns (80%+ confidence)
	{
		name: 'chatgpt-build-identifier',
		test: (html) => /data-build=\"prod-[a-f0-9]+\"/i.test(html),
		weight: 25,
		description: 'ChatGPT production build identifier'
	},
	{
		name: 'react-component-patterns',
		test: (html) => {
			const reactPatterns = ['data-react', '__react', 'react-'];
			return reactPatterns.some(pattern => html.includes(pattern));
		},
		weight: 20,
		description: 'React framework component patterns'
	},
	{
		name: 'code-highlighting-classes',
		test: (html) => html.includes('hljs') || html.includes('language-'),
		weight: 15,
		description: 'Code syntax highlighting classes'
	},
	{
		name: 'oai-static-resources',
		test: (html) => html.includes('cdn.oaistatic.com'),
		weight: 10,
		description: 'OpenAI static CDN resource references'
	}
];

/**
 * Notion Detection Patterns  
 */
const NOTION_PATTERNS: DetectionPattern[] = [
	// Primary patterns (90%+ confidence)
	{
		name: 'notion-html-class',
		test: (html) => html.includes('class="notion-html"') || html.includes('class="notion-body"'),
		weight: 50,
		description: 'Notion HTML root classes'
	},
	{
		name: 'notion-version-attribute',
		test: (html) => /data-notion-version="[^"]*"/i.test(html),
		weight: 40,
		description: 'Notion version data attribute'
	},
	{
		name: 'notion-app-container',
		test: (html) => html.includes('id="notion-app"'),
		weight: 35,
		description: 'Notion app main container'
	},

	// Secondary patterns (80%+ confidence)  
	{
		name: 'notion-prefix-classes',
		test: (html) => {
			const matches = html.match(/class="[^"]*notion-[^"]*"/g);
			return matches ? matches.length > 5 : false;
		},
		weight: 25,
		description: 'Multiple notion- prefixed classes'
	},
	{
		name: 'content-editable-leaf',
		test: (html) => html.includes('data-content-editable-leaf="true"'),
		weight: 20,
		description: 'Notion content editable leaf blocks'
	},
	{
		name: 'notion-table-structure',
		test: (html) => html.includes('notion-table-row') && html.includes('notion-table-cell'),
		weight: 15,
		description: 'Notion table structure classes'
	},
	{
		name: 'notion-cursor-listener',
		test: (html) => html.includes('notion-cursor-listener'),
		weight: 10,
		description: 'Notion cursor listener component'
	}
];

/**
 * Detect Gemini content with confidence scoring
 */
export function detectGemini(html: string): DetectionResult {
	const matchedPatterns: string[] = [];
	let totalWeight = 0;
	let maxPossibleWeight = 0;

	// Calculate matched patterns and weights
	for (const pattern of GEMINI_PATTERNS) {
		maxPossibleWeight += pattern.weight;
		if (pattern.test(html)) {
			matchedPatterns.push(pattern.name);
			totalWeight += pattern.weight;
		}
	}

	const confidence = totalWeight / maxPossibleWeight;
	const reason = matchedPatterns.length > 0 
		? `Detected patterns: ${matchedPatterns.join(', ')}`
		: 'No Gemini patterns found';

	// 3개 셀렉터가 없지만 다른 Gemini 패턴이 감지된 경우 경고 추가
	const hasConversationSelectors = matchedPatterns.includes('gemini-conversation-selectors');
	const hasOtherGeminiPatterns = matchedPatterns.some(pattern => pattern !== 'gemini-conversation-selectors');
	
	let warning: string | undefined;
	if (!hasConversationSelectors && hasOtherGeminiPatterns && confidence > 0.5) {
		warning = 'Gemini 대화 내역을 찾을 수 없습니다. 대화 내용을 드래그하여 다시 요청해 주세요.';
	}

	return {
		rule: 'gemini',
		confidence,
		patterns: matchedPatterns,
		reason,
		warning
	};
}

/**
 * Detect Claude content with confidence scoring
 */
export function detectClaude(html: string): DetectionResult {
	const matchedPatterns: string[] = [];
	let totalWeight = 0;
	let maxPossibleWeight = 0;

	// Calculate matched patterns and weights
	for (const pattern of CLAUDE_PATTERNS) {
		maxPossibleWeight += pattern.weight;
		if (pattern.test(html)) {
			matchedPatterns.push(pattern.name);
			totalWeight += pattern.weight;
		}
	}

	const confidence = totalWeight / maxPossibleWeight;
	const reason = matchedPatterns.length > 0
		? `Detected patterns: ${matchedPatterns.join(', ')}`
		: 'No Claude patterns found';

	return {
		rule: 'claude',
		confidence,
		patterns: matchedPatterns,
		reason
	};
}

/**
 * Detect ChatGPT content with confidence scoring
 */
export function detectChatGPT(html: string): DetectionResult {
	const matchedPatterns: string[] = [];
	let totalWeight = 0;
	let maxPossibleWeight = 0;

	// Calculate matched patterns and weights
	for (const pattern of CHATGPT_PATTERNS) {
		maxPossibleWeight += pattern.weight;
		if (pattern.test(html)) {
			matchedPatterns.push(pattern.name);
			totalWeight += pattern.weight;
		}
	}

	const confidence = totalWeight / maxPossibleWeight;
	const reason = matchedPatterns.length > 0
		? `Detected patterns: ${matchedPatterns.join(', ')}`
		: 'No ChatGPT patterns found';

	return {
		rule: 'chatgpt',
		confidence,
		patterns: matchedPatterns,
		reason
	};
}

/**
 * Detect Notion content with confidence scoring
 */
export function detectNotion(html: string): DetectionResult {
	const matchedPatterns: string[] = [];
	let totalWeight = 0;
	let maxPossibleWeight = 0;

	// Calculate matched patterns and weights
	for (const pattern of NOTION_PATTERNS) {
		maxPossibleWeight += pattern.weight;
		if (pattern.test(html)) {
			matchedPatterns.push(pattern.name);
			totalWeight += pattern.weight;
		}
	}

	const confidence = totalWeight / maxPossibleWeight;
	const reason = matchedPatterns.length > 0
		? `Detected patterns: ${matchedPatterns.join(', ')}`
		: 'No Notion patterns found';

	return {
		rule: 'notion',
		confidence,
		patterns: matchedPatterns,
		reason
	};
}

/**
 * Main auto-detection function
 * Returns the most confident detection result
 */
export function detectContentType(html: string): DetectionResult {
	if (!html || html.trim().length === 0) {
		return {
			rule: 'generic',
			confidence: 1.0,
			patterns: [],
			reason: 'Empty or no content provided'
		};
	}

	// Run all detection algorithms
	const claudeResult = detectClaude(html);
	const chatgptResult = detectChatGPT(html);
	const geminiResult = detectGemini(html);
	const notionResult = detectNotion(html);

	// Apply confidence thresholds and priority rules
	const CLAUDE_THRESHOLD = 0.85; // 85%
	const CHATGPT_THRESHOLD = 0.85; // 85%
	const GEMINI_THRESHOLD = 0.80; // 80%
	const NOTION_THRESHOLD = 0.70; // 70%

	console.log('🔍 Content Detection Results:');
	console.log(`  Claude: ${(claudeResult.confidence * 100).toFixed(1)}% - ${claudeResult.reason}`);
	console.log(`  ChatGPT: ${(chatgptResult.confidence * 100).toFixed(1)}% - ${chatgptResult.reason}`);
	console.log(`  Gemini: ${(geminiResult.confidence * 100).toFixed(1)}% - ${geminiResult.reason}`);
	console.log(`  Notion: ${(notionResult.confidence * 100).toFixed(1)}% - ${notionResult.reason}`);

	// Priority: Claude ≥ ChatGPT ≥ Gemini ≥ Notion > Generic
	if (claudeResult.confidence >= CLAUDE_THRESHOLD) {
		console.log('✅ Detected as Claude content');
		return claudeResult;
	}

	if (chatgptResult.confidence >= CHATGPT_THRESHOLD) {
		console.log('✅ Detected as ChatGPT content');
		return chatgptResult;
	}

	if (geminiResult.confidence >= GEMINI_THRESHOLD) {
		console.log('✅ Detected as Gemini content');
		return geminiResult;
	}

	if (notionResult.confidence >= NOTION_THRESHOLD) {
		console.log('✅ Detected as Notion content');
		return notionResult;
	}

	// Fallback to generic HTML
	console.log('📄 Defaulting to Generic HTML');
	return {
		rule: 'generic',
		confidence: 1.0,
		patterns: ['fallback'],
		reason: 'No specific patterns detected, using generic HTML conversion'
	};
}

/**
 * Get human-readable rule name
 */
export function getRuleDisplayName(rule: DetectionResult['rule']): string {
	const names = {
		// auto: '🤖 자동 감지',
		claude: '💬 Claude',
		chatgpt: '🤖 ChatGPT',
		gemini: '🤖 Gemini',
		notion: '📝 Notion', 
		generic: '🔧 범용 HTML'
	};
	return names[rule] || '알 수 없음';
}

/**
 * Utility function for performance testing
 */
export function benchmarkDetection(html: string, iterations = 100): {
	averageTime: number;
	result: DetectionResult;
} {
	const start = performance.now();
	
	let result: DetectionResult = { rule: 'generic', confidence: 0, patterns: [], reason: '' };
	for (let i = 0; i < iterations; i++) {
		result = detectContentType(html);
	}
	
	const end = performance.now();
	const averageTime = (end - start) / iterations;
	
	return { averageTime, result };
}