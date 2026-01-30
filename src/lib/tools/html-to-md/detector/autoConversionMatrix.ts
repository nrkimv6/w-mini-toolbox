/**
 * 자동 변환 매트릭스 (자동 감지 기반 시스템
 */

import { detectInputSource, type DetectionResult } from './autoDetectionEngine';
// 기존 Matrix 임포트 (점진적 대체를 위해 유지)
const CONVERSION_MATRIX: Record<string, Record<string, string>> = {
  'drag_drop': {
    'gemini': 'gemini_rich',
    'notion': 'notion_blocks',
    'recipe_site': 'recipe_structured',
    'blog': 'blog_clean',
    'documentation': 'doc_formatted',
    'generic': 'generic_clean'
  },
  'developer_copy': {
    'gemini': 'gemini_clean',
    'notion': 'notion_clean',
    'recipe_site': 'recipe_clean',
    'blog': 'blog_minimal',
    'documentation': 'doc_structured',
    'generic': 'generic_minimal'
  },
  'clipboard_paste': {
    'gemini': 'gemini_formatted',
    'notion': 'notion_formatted',
    'recipe_site': 'recipe_formatted',
    'blog': 'blog_formatted',
    'documentation': 'doc_clean',
    'generic': 'generic_formatted'
  }
};

const CONVERT_RULE_DESCRIPTIONS: Record<string, string> = {
  'gemini_rich': 'Gemini 드래그 - 대화 구조 유지, 코드 블록 보존',
  'gemini_clean': 'Gemini 개발자 도구 - 앱 UI 요소 제거',
  'gemini_formatted': 'Gemini 클립보드 - 기본 포맷팅 적용',
  'notion_blocks': 'Notion 드래그 - 블록 구조 유지, 테이블 변환',
  'notion_clean': 'Notion 개발자 도구 - 메타데이터 정리',
  'notion_formatted': 'Notion 클립보드 - 표준 변환',
  'recipe_structured': '레시피 사이트 - 재료/조리법 구조화',
  'recipe_clean': '레시피 개발자 도구 - 핵심 내용만 추출',
  'recipe_formatted': '레시피 클립보드 - 기본 변환',
  'blog_clean': '블로그 - 본문만 추출, 사이드바 제거',
  'blog_minimal': '블로그 개발자 도구 - 최소한 변환',
  'blog_formatted': '블로그 클립보드 - 표준 변환',
  'doc_formatted': '문서 - 목차 구조 유지, 링크 정리',
  'doc_structured': '문서 개발자 도구 - 구조 보존',
  'doc_clean': '문서 클립보드 - 기본 정리',
  'generic_clean': '일반 사이트 - 불필요한 태그 제거',
  'generic_minimal': '일반 개발자 도구 - 최소 변환',
  'generic_formatted': '일반 클립보드 - 표준 변환'
};

export interface AutoConversionResult {
  rule: string;
  description: string;
  detection: DetectionResult;
  confidence: number;
  isAutoDetected: boolean;
}

/**
 * 자동 감지를 통한 최적 변환 규칙 결정
 * 기존 getOptimalRule()을 대체하는 메인 함수
 */
export function getOptimalRuleAuto(clipboardData: DataTransfer): AutoConversionResult {
  // 1. 자동 감지 실행
  const detection = detectInputSource(clipboardData);
  
  // 2. 기존 Matrix로부터 변환 규칙 획득
  const rule = CONVERSION_MATRIX[detection.inputMethod]?.[detection.contentSource] || 'generic_formatted';
  const description = CONVERT_RULE_DESCRIPTIONS[rule] || '표준 변환';
  
  return {
    rule,
    description,
    detection,
    confidence: detection.confidence,
    isAutoDetected: true
  };
}

/**
 * 수동 선택을 위한 기존 방식 (하위 호환성)
 */
export function getOptimalRuleManual(inputMethod: string, contentSource: string): AutoConversionResult {
  const rule = CONVERSION_MATRIX[inputMethod]?.[contentSource] || 'generic_formatted';
  const description = CONVERT_RULE_DESCRIPTIONS[rule] || '표준 변환';
  
  return {
    rule,
    description,
    detection: {
      inputMethod,
      contentSource,
      confidence: 1.0, // 수동 선택이므로 100%
      rawDetection: `${contentSource}-${inputMethod}`,
      clipboardInfo: { typeCount: 0, types: [], hasNotionTypes: false, hasHtml: false, hasText: false },
      analysis: {
        possibleMethods: [],
        htmlMatches: [],
        textMatches: [],
        selectedRule: { clipboardTypes: 0, confidence: 1.0, description: 'Manual selection' }
      }
    },
    confidence: 1.0,
    isAutoDetected: false
  };
}

/**
 * 통합 변환 규칙 함수 (자동/수동 통합)
 */
export function getOptimalRule(
  inputMethodOrClipboard: string | DataTransfer,
  contentSource?: string
): AutoConversionResult {
  // DataTransfer 객체가 전달되면 자동 감지
  if (inputMethodOrClipboard instanceof DataTransfer) {
    return getOptimalRuleAuto(inputMethodOrClipboard);
  }
  
  // 문자열이 전달되면 수동 선택 (기존 방식)
  if (typeof inputMethodOrClipboard === 'string' && contentSource) {
    return getOptimalRuleManual(inputMethodOrClipboard, contentSource);
  }
  
  // 잘못된 파라미터
  throw new Error('Invalid parameters: expected DataTransfer for auto-detection or (string, string) for manual selection');
}

/**
 * 자동 감지 신뢰도가 낮을 때 수동 선택 옵션 제공
 */
export function getSuggestedOptions(detection: DetectionResult): Array<{
  inputMethod: string;
  contentSource: string;
  rule: string;
  description: string;
  displayName: string;
}> {
  const suggestions = [];
  
  // 현재 감지된 결과
  const currentRule = CONVERSION_MATRIX[detection.inputMethod]?.[detection.contentSource];
  if (currentRule) {
    suggestions.push({
      inputMethod: detection.inputMethod,
      contentSource: detection.contentSource,
      rule: currentRule,
      description: CONVERT_RULE_DESCRIPTIONS[currentRule],
      displayName: `${getDisplayName(detection.contentSource)} - ${getInputMethodDisplayName(detection.inputMethod)} (자동 감지)`
    });
  }
  
  // 다른 가능성들 (confidence가 낮을 때)
  if (detection.confidence < 0.8) {
    const alternatives = [
      { method: 'drag_drop', source: 'generic' },
      { method: 'clipboard_paste', source: 'generic' },
      { method: 'developer_copy', source: 'generic' }
    ];
    
    for (const alt of alternatives) {
      const rule = CONVERSION_MATRIX[alt.method]?.[alt.source];
      if (rule && rule !== currentRule) {
        suggestions.push({
          inputMethod: alt.method,
          contentSource: alt.source,
          rule,
          description: CONVERT_RULE_DESCRIPTIONS[rule],
          displayName: `${getDisplayName(alt.source)} - ${getInputMethodDisplayName(alt.method)}`
        });
      }
    }
  }
  
  return suggestions;
}

/**
 * 감지 결과 검증 및 신뢰도 향상 제안
 */
export function validateDetectionResult(result: AutoConversionResult): {
  isReliable: boolean;
  warnings: string[];
  suggestions: string[];
} {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  const isReliable = result.confidence >= 0.7;
  
  if (result.confidence < 0.5) {
    warnings.push('감지 신뢰도가 매우 낮습니다');
    suggestions.push('수동으로 입력 방법을 선택해주세요');
  } else if (result.confidence < 0.7) {
    warnings.push('감지 신뢰도가 낮습니다');
    suggestions.push('결과를 확인하고 필요시 수정해주세요');
  }
  
  if (result.detection.rawDetection.includes('generic')) {
    suggestions.push('더 정확한 감지를 위해 HTML 전체를 복사해보세요');
  }
  
  return { isReliable, warnings, suggestions };
}

// 기존 함수들 재사용 (하위 호환성)
export function getDisplayName(source: string): string {
  const displayNames: Record<string, string> = {
    'gemini': '🤖 Gemini',
    'notion': '📝 Notion',
    'recipe_site': '🍳 레시피 사이트',
    'blog': '📰 블로그',
    'documentation': '📚 문서/위키',
    'generic': '🌐 일반 웹사이트'
  };
  
  return displayNames[source] || source;
}

export function getInputMethodDisplayName(method: string): string {
  const displayNames: Record<string, string> = {
    'drag_drop': '🖱️ 드래그 앤 드롭',
    'developer_copy': '👨‍💻 개발자 도구',
    'clipboard_paste': '📋 클립보드 복사'
  };
  
  return displayNames[method] || method;
}

/**
 * 디버그 정보 출력 (개발 중에만 사용)
 */
export function debugDetection(result: AutoConversionResult): void {
  if (process.env.NODE_ENV === 'development') {
    console.group('🔍 Auto Detection Debug');
    console.log('Result:', result.rule);
    console.log('Confidence:', Math.round(result.confidence * 100) + '%');
    console.log('Raw Detection:', result.detection.rawDetection);
    console.log('Clipboard Info:', result.detection.clipboardInfo);
    console.log('Analysis:', result.detection.analysis);
    console.groupEnd();
  }
}