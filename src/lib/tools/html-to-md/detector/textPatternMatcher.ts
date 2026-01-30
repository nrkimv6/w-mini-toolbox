/**
 * 텍스트 패턴 매칭기
 * 순수 텍스트에서 특정 소스의 패턴을 감지
 */

import type { PatternMatchResult } from './htmlPatternMatcher';

/**
 * 각 소스별 텍스트 패턴 정의
 */
const TEXT_PATTERNS = {
  notion: {
    // AWS S3 경로 패턴
    resourcePaths: [
      's3-us-west-2.amazonaws.com/secure.notion-static.com/',
      'secure.notion-static.com'
    ],
    // Notion 특유의 텍스트 패턴
    contentPatterns: [
      'notion.so/',
      'Notion'
    ]
  },
  
  gemini: {
    // Gemini 특정 문자열 패턴
    startPatterns: [
      'Gemini'  // 텍스트가 "Gemini"로 시작
    ],
    contextPatterns: [
      'Gemini와의 대화',
      'Bard', // 이전 이름
      '구글 AI'
    ],
    // 마크다운 패턴 (Gemini 응답 특징)
    markdownPatterns: [
      '```',  // 코드 블록
      '**',   // 볼드
      '##',   // 헤딩
      '* ',   // 리스트
      '1. '   // 번호 리스트
    ]
  }
} as const;

/**
 * 텍스트에서 패턴 매칭 수행
 */
export function matchTextPatterns(text: string): PatternMatchResult[] {
  const results: PatternMatchResult[] = [];
  
  // Notion 패턴 매칭
  const notionResult = matchNotionTextPatterns(text);
  if (notionResult.confidence > 0) {
    results.push(notionResult);
  }
  
  // Gemini 패턴 매칭
  const geminiResult = matchGeminiTextPatterns(text);
  if (geminiResult.confidence > 0) {
    results.push(geminiResult);
  }
  
  // 결과를 신뢰도 순으로 정렬
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Notion 텍스트 패턴 매칭
 */
function matchNotionTextPatterns(text: string): PatternMatchResult {
  const matchedPatterns: string[] = [];
  let confidence = 0;
  
  // AWS S3 경로 패턴 (가장 확실한 지표)
  for (const pattern of TEXT_PATTERNS.notion.resourcePaths) {
    if (text.includes(pattern)) {
      matchedPatterns.push(pattern);
      confidence += 0.60; // 높은 가중치
    }
  }
  
  // 콘텐츠 패턴
  for (const pattern of TEXT_PATTERNS.notion.contentPatterns) {
    if (text.includes(pattern)) {
      matchedPatterns.push(pattern);
      confidence += 0.20;
    }
  }
  
  return {
    source: 'notion',
    confidence: Math.min(confidence, 1.0),
    matchedPatterns
  };
}

/**
 * Gemini 텍스트 패턴 매칭
 */
function matchGeminiTextPatterns(text: string): PatternMatchResult {
  const matchedPatterns: string[] = [];
  let confidence = 0;
  
  // 시작 패턴 (텍스트 첫 부분)
  const trimmedText = text.trim();
  for (const pattern of TEXT_PATTERNS.gemini.startPatterns) {
    if (trimmedText.startsWith(pattern)) {
      matchedPatterns.push(`starts with "${pattern}"`);
      confidence += 0.50; // 높은 가중치
    }
  }
  
  // 컨텍스트 패턴
  for (const pattern of TEXT_PATTERNS.gemini.contextPatterns) {
    if (text.includes(pattern)) {
      matchedPatterns.push(pattern);
      confidence += 0.40;
    }
  }
  
  // 마크다운 패턴 (여러 개 있을 때만 의미있음)
  let markdownMatches = 0;
  for (const pattern of TEXT_PATTERNS.gemini.markdownPatterns) {
    if (text.includes(pattern)) {
      markdownMatches++;
    }
  }
  
  if (markdownMatches >= 2) {
    matchedPatterns.push(`${markdownMatches} markdown patterns`);
    confidence += 0.30;
  }
  
  return {
    source: 'gemini',
    confidence: Math.min(confidence, 1.0),
    matchedPatterns
  };
}

/**
 * 최고 신뢰도의 텍스트 매칭 결과 반환
 */
export function getBestTextMatch(text: string): PatternMatchResult | null {
  const results = matchTextPatterns(text);
  
  if (results.length === 0) {
    return null;
  }
  
  return results[0];
}

/**
 * 특정 임계값 이상의 신뢰도를 가진 텍스트 매칭만 반환
 */
export function getReliableTextMatches(text: string, threshold = 0.5): PatternMatchResult[] {
  return matchTextPatterns(text).filter(result => result.confidence >= threshold);
}

/**
 * 텍스트에서 URL 패턴 추출 (디버깅 용도)
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/g;
  return text.match(urlRegex) || [];
}

/**
 * 텍스트 분석 요약 (디버깅 용도)
 */
export function analyzeTextContent(text: string): {
  length: number;
  lines: number;
  urls: string[];
  hasMarkdown: boolean;
  preview: string;
} {
  const urls = extractUrls(text);
  const lines = text.split('\n').length;
  const hasMarkdown = TEXT_PATTERNS.gemini.markdownPatterns.some(pattern => 
    text.includes(pattern)
  );
  
  return {
    length: text.length,
    lines,
    urls,
    hasMarkdown,
    preview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
  };
}