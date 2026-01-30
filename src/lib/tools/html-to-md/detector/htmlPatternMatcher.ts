/**
 * HTML 패턴 매칭기
 * HTML 내용에서 특정 소스(Gemini, Notion 등)의 패턴을 감지
 */

export interface PatternMatchResult {
  source: string;
  confidence: number;
  matchedPatterns: string[];
}

/**
 * 각 소스별 HTML 패턴 정의
 */
const HTML_PATTERNS = {
  // Gemini 패턴 (우선순위 순)
  gemini: {
    primary: ['<chat-app', '<bard-', 'gstatic.com/lamda/images/gemini'],
    secondary: ['gem_spark', '<bot-list', 'temp-chat-icon'],
    framework: ['ng-', '_nghost-', '_ngcontent-', 'mat-', 'mdc-', 'gds-']
  },
  
  // Notion 패턴
  notion: {
    primary: ['.notion-html', '#notion-app', 'data-notion-version'],
    content: ['data-content-editable-leaf', '.notion-table-cell-text', 'role="textbox"'],
    structure: ['.notion-', 'notion-cursor-listener', '.notion-table-']
  }
} as const;

/**
 * HTML에서 패턴 매칭 수행
 */
export function matchHtmlPatterns(html: string): PatternMatchResult[] {
  const results: PatternMatchResult[] = [];
  
  // Gemini 패턴 매칭
  const geminiResult = matchGeminiPatterns(html);
  if (geminiResult.confidence > 0) {
    results.push(geminiResult);
  }
  
  // Notion 패턴 매칭
  const notionResult = matchNotionPatterns(html);
  if (notionResult.confidence > 0) {
    results.push(notionResult);
  }
  
  // 결과를 신뢰도 순으로 정렬
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Gemini 패턴 매칭
 */
function matchGeminiPatterns(html: string): PatternMatchResult {
  const matchedPatterns: string[] = [];
  let confidence = 0;
  
  // Primary 패턴 (가중치 높음)
  for (const pattern of HTML_PATTERNS.gemini.primary) {
    if (html.includes(pattern)) {
      matchedPatterns.push(pattern);
      confidence += 0.40; // 각각 40% 가중치
    }
  }
  
  // Secondary 패턴
  for (const pattern of HTML_PATTERNS.gemini.secondary) {
    if (html.includes(pattern)) {
      matchedPatterns.push(pattern);
      confidence += 0.20; // 각각 20% 가중치
    }
  }
  
  // Framework 패턴 (Angular, Material Design)
  let frameworkMatches = 0;
  for (const pattern of HTML_PATTERNS.gemini.framework) {
    if (html.includes(pattern)) {
      frameworkMatches++;
    }
  }
  
  // 프레임워크 패턴이 3개 이상 있으면 추가 신뢰도
  if (frameworkMatches >= 3) {
    matchedPatterns.push(`${frameworkMatches} framework patterns`);
    confidence += 0.30;
  }
  
  return {
    source: 'gemini',
    confidence: Math.min(confidence, 1.0), // 최대 100%
    matchedPatterns
  };
}

/**
 * Notion 패턴 매칭
 */
function matchNotionPatterns(html: string): PatternMatchResult {
  const matchedPatterns: string[] = [];
  let confidence = 0;
  
  // Primary 패턴 (가중치 높음)
  for (const pattern of HTML_PATTERNS.notion.primary) {
    if (html.includes(pattern)) {
      matchedPatterns.push(pattern);
      confidence += 0.50; // 각각 50% 가중치
    }
  }
  
  // Content 패턴
  for (const pattern of HTML_PATTERNS.notion.content) {
    if (html.includes(pattern)) {
      matchedPatterns.push(pattern);
      confidence += 0.25; // 각각 25% 가중치
    }
  }
  
  // Structure 패턴 (notion- 접두사 패턴들)
  let structureMatches = 0;
  for (const pattern of HTML_PATTERNS.notion.structure) {
    if (html.includes(pattern)) {
      structureMatches++;
    }
  }
  
  // 구조 패턴이 2개 이상 있으면 추가 신뢰도
  if (structureMatches >= 2) {
    matchedPatterns.push(`${structureMatches} structure patterns`);
    confidence += 0.20;
  }
  
  return {
    source: 'notion',
    confidence: Math.min(confidence, 1.0), // 최대 100%
    matchedPatterns
  };
}

/**
 * 최고 신뢰도의 소스 반환
 */
export function getBestHtmlMatch(html: string): PatternMatchResult | null {
  const results = matchHtmlPatterns(html);
  
  if (results.length === 0) {
    return null;
  }
  
  // 가장 높은 신뢰도의 결과 반환
  return results[0];
}

/**
 * 특정 임계값 이상의 신뢰도를 가진 매칭만 반환
 */
export function getReliableHtmlMatches(html: string, threshold = 0.6): PatternMatchResult[] {
  return matchHtmlPatterns(html).filter(result => result.confidence >= threshold);
}