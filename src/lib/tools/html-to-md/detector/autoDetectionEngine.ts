/**
 * 자동 감지 엔진
 * 모든 분석 컴포넌트를 통합하여 최종 입력 방법을 감지
 */

import { analyzeClipboardTypes, getPossibleInputMethods, type ClipboardInfo } from './clipboardTypeAnalyzer';
import { matchHtmlPatterns, getBestHtmlMatch } from './htmlPatternMatcher';
import { matchTextPatterns, getBestTextMatch } from './textPatternMatcher';
import { DETECTION_RULES, DETECTION_TO_MATRIX_MAP, type DetectionRule } from './detectionRules';

export interface DetectionResult {
  inputMethod: string;      // 'drag_drop', 'developer_copy', 'clipboard_paste'
  contentSource: string;    // 'gemini', 'notion', 'generic'
  confidence: number;       // 0.0 ~ 1.0
  rawDetection: string;     // 'notion-drag', 'gemini-text' 등
  clipboardInfo: ClipboardInfo;
  analysis: {
    possibleMethods: string[];
    htmlMatches: any[];
    textMatches: any[];
    selectedRule: DetectionRule;
  };
}

/**
 * 메인 자동 감지 함수
 */
export function detectInputSource(clipboardData: DataTransfer): DetectionResult {
  // 1차: 클립보드 타입 분석
  const clipboardInfo = analyzeClipboardTypes(clipboardData);
  const possibleMethods = getPossibleInputMethods(clipboardInfo);
  
  // 2차: HTML/텍스트 패턴 매칭
  const htmlMatches = clipboardInfo.hasHtml ? 
    matchHtmlPatterns(clipboardData.getData('text/html')) : [];
  const textMatches = clipboardInfo.hasText ? 
    matchTextPatterns(clipboardData.getData('text/plain')) : [];
  
  // 3차: 최적 규칙 선택
  const bestDetection = selectBestRule(possibleMethods, htmlMatches, textMatches, clipboardInfo);
  
  // Matrix 형식으로 변환
  const matrixMapping = DETECTION_TO_MATRIX_MAP[bestDetection.ruleId];
  
  return {
    inputMethod: matrixMapping?.inputMethod || 'clipboard_paste',
    contentSource: matrixMapping?.contentSource || 'generic',
    confidence: bestDetection.confidence,
    rawDetection: bestDetection.ruleId,
    clipboardInfo,
    analysis: {
      possibleMethods,
      htmlMatches,
      textMatches,
      selectedRule: bestDetection.rule
    }
  };
}

/**
 * 최적 규칙 선택 로직
 */
function selectBestRule(
  possibleMethods: string[],
  htmlMatches: any[],
  textMatches: any[],
  clipboardInfo: ClipboardInfo
): { ruleId: string; rule: DetectionRule; confidence: number } {
  
  const candidates: Array<{ ruleId: string; rule: DetectionRule; score: number }> = [];
  
  // 가능한 방법들에 대해 점수 계산
  for (const methodId of possibleMethods) {
    const rule = DETECTION_RULES[methodId];
    if (!rule) continue;
    
    let score = rule.confidence; // 기본 신뢰도
    
    // HTML 패턴 매칭 점수 추가
    if (rule.htmlPatterns && htmlMatches.length > 0) {
      const htmlBonus = calculateHtmlBonus(rule.htmlPatterns, htmlMatches);
      score = Math.min(score + htmlBonus, 1.0);
    }
    
    // 텍스트 패턴 매칭 점수 추가
    if (rule.textPatterns && textMatches.length > 0) {
      const textBonus = calculateTextBonus(rule.textPatterns, textMatches);
      score = Math.min(score + textBonus, 1.0);
    }
    
    // 타입 개수 정확도 보너스
    if (isExactTypeMatch(rule.clipboardTypes, clipboardInfo.typeCount)) {
      score = Math.min(score + 0.1, 1.0);
    }
    
    // 필수 타입 확인
    if (rule.requiredTypes && !hasRequiredTypes(rule.requiredTypes, clipboardInfo.types)) {
      score *= 0.5; // 필수 타입이 없으면 점수 반감
    }
    
    // 제외 패턴 확인
    if (rule.excludePatterns && hasExcludePatterns(rule.excludePatterns, clipboardInfo, htmlMatches, textMatches)) {
      score *= 0.3; // 제외 패턴이 있으면 점수 대폭 감소
    }
    
    candidates.push({ ruleId: methodId, rule, score });
  }
  
  // 점수 순으로 정렬하고 최고 점수 반환
  candidates.sort((a, b) => b.score - a.score);
  
  const best = candidates[0] || {
    ruleId: 'generic-text',
    rule: DETECTION_RULES['generic-text'],
    score: 0.1
  };
  
  return {
    ruleId: best.ruleId,
    rule: best.rule,
    confidence: best.score
  };
}

/**
 * HTML 패턴 매칭 보너스 계산
 */
function calculateHtmlBonus(rulePatterns: string[], htmlMatches: any[]): number {
  let bonus = 0;
  
  for (const match of htmlMatches) {
    // 매칭된 패턴들이 규칙 패턴과 일치하는지 확인
    for (const pattern of rulePatterns) {
      if (match.matchedPatterns.some((mp: string) => mp.includes(pattern))) {
        bonus += match.confidence * 0.2; // 최대 20% 보너스
      }
    }
  }
  
  return Math.min(bonus, 0.3); // 최대 30% 보너스
}

/**
 * 텍스트 패턴 매칭 보너스 계산
 */
function calculateTextBonus(rulePatterns: string[], textMatches: any[]): number {
  let bonus = 0;
  
  for (const match of textMatches) {
    for (const pattern of rulePatterns) {
      if (match.matchedPatterns.some((mp: string) => mp.includes(pattern) || pattern.includes(mp))) {
        bonus += match.confidence * 0.15; // 최대 15% 보너스
      }
    }
  }
  
  return Math.min(bonus, 0.25); // 최대 25% 보너스
}

/**
 * 타입 개수 정확 매칭 확인
 */
function isExactTypeMatch(ruleTypes: number | number[], actualCount: number): boolean {
  if (Array.isArray(ruleTypes)) {
    return ruleTypes.includes(actualCount);
  }
  return ruleTypes === actualCount;
}

/**
 * 필수 타입 확인
 */
function hasRequiredTypes(requiredTypes: string[], actualTypes: string[]): boolean {
  return requiredTypes.every(reqType => actualTypes.includes(reqType));
}

/**
 * 제외 패턴 확인
 */
function hasExcludePatterns(
  excludePatterns: string[], 
  clipboardInfo: ClipboardInfo, 
  htmlMatches: any[], 
  textMatches: any[]
): boolean {
  // HTML에서 제외 패턴 확인
  for (const match of htmlMatches) {
    for (const pattern of excludePatterns) {
      if (match.matchedPatterns.some((mp: string) => mp.includes(pattern))) {
        return true;
      }
    }
  }
  
  // 텍스트에서 제외 패턴 확인  
  for (const match of textMatches) {
    for (const pattern of excludePatterns) {
      if (match.matchedPatterns.some((mp: string) => mp.includes(pattern))) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 감지 결과 요약 (디버깅용)
 */
export function summarizeDetection(result: DetectionResult): string {
  const { rawDetection, confidence, inputMethod, contentSource } = result;
  const confidencePercent = Math.round(confidence * 100);
  
  return `${rawDetection} (${confidencePercent}% 신뢰도) → ${inputMethod} + ${contentSource}`;
}

/**
 * 감지 결과의 신뢰도가 임계값 이상인지 확인
 */
export function isReliableDetection(result: DetectionResult, threshold = 0.7): boolean {
  return result.confidence >= threshold;
}

/**
 * 빠른 감지 (간단한 버전)
 * UI에서 실시간으로 보여줄 때 사용
 */
export function quickDetect(clipboardData: DataTransfer): { source: string; method: string; confidence: number } {
  const clipboardInfo = analyzeClipboardTypes(clipboardData);
  
  // Notion 4개 타입 즉시 감지
  if (clipboardInfo.hasNotionTypes && clipboardInfo.typeCount === 4) {
    return { source: 'notion', method: 'drag', confidence: 0.99 };
  }
  
  // Gemini 2개 타입 즉시 감지
  if (clipboardInfo.typeCount === 2 && clipboardInfo.hasHtml && clipboardInfo.hasText) {
    return { source: 'gemini', method: 'drag', confidence: 0.90 };
  }
  
  // 1개 타입은 더 정밀한 분석 필요
  if (clipboardInfo.typeCount === 1) {
    return { source: 'unknown', method: 'unknown', confidence: 0.3 };
  }
  
  return { source: 'generic', method: 'unknown', confidence: 0.5 };
}