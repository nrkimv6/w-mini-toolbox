/**
 * 자동 감지 규칙 정의
 * PRD에서 정의한 6가지 입력 방법의 감지 규칙
 */

export interface DetectionRule {
  clipboardTypes: number | number[];
  requiredTypes?: string[];
  htmlPatterns?: string[];
  textPatterns?: string[];
  excludePatterns?: string[];
  confidence: number;
  description: string;
}

/**
 * 6가지 입력 방법별 감지 규칙
 */
export const DETECTION_RULES: Record<string, DetectionRule> = {
  // 1. Notion 드래그앤드롭: 4개 타입 + notion 전용 타입
  'notion-drag': {
    clipboardTypes: 4,
    requiredTypes: ['text/_notion-blocks-v3-production'],
    htmlPatterns: ['.notion-html', '#notion-app', 'data-notion-version'],
    confidence: 0.99,
    description: 'Notion 드래그앤드롭 - 4개 타입 + Notion 전용 MIME 타입'
  },
  
  // 2. Notion 개발자도구: 1개 HTML + notion 패턴
  'notion-devtools': {
    clipboardTypes: 1,
    requiredTypes: ['text/html'],
    htmlPatterns: ['.notion-', 'data-content-editable-leaf'],
    confidence: 0.90,
    description: 'Notion 개발자도구 - HTML만 + Notion 패턴'
  },
  
  // 3. Notion 텍스트: 1개 텍스트 + AWS S3 경로 패턴
  'notion-text': {
    clipboardTypes: 1,
    requiredTypes: ['text/plain'],
    textPatterns: ['s3-us-west-2.amazonaws.com/secure.notion-static.com/'],
    confidence: 0.85,
    description: 'Notion 텍스트 복사 - AWS S3 경로 포함'
  },
  
  // 4. Gemini 드래그앤드롭: 2개 타입 + angular 패턴
  'gemini-drag': {
    clipboardTypes: 2,
    requiredTypes: ['text/plain', 'text/html'],
    htmlPatterns: ['<chat-app', '<bard-', 'ng-', 'mat-'],
    confidence: 0.95,
    description: 'Gemini 드래그앤드롭 - 2개 타입 + Angular/Material 패턴'
  },
  
  // 5. Gemini 개발자도구: 1개 HTML + gemini 패턴
  'gemini-devtools': {
    clipboardTypes: 1,
    requiredTypes: ['text/html'],
    htmlPatterns: ['<chat-app', '<bard-', 'ng-'],
    confidence: 0.90,
    description: 'Gemini 개발자도구 - HTML만 + Gemini 패턴'
  },
  
  // 6. Gemini 텍스트: 1개 텍스트 + Gemini 특정 문자열
  'gemini-text': {
    clipboardTypes: 1,
    requiredTypes: ['text/plain'],
    textPatterns: ['^Gemini', 'Gemini와의 대화'],
    confidence: 0.80,
    description: 'Gemini 텍스트 복사 - "Gemini"로 시작 또는 대화 컨텍스트'
  },
  
  // Fallback 규칙들
  'generic-html': {
    clipboardTypes: [1, 2],
    requiredTypes: ['text/html'],
    excludePatterns: ['.notion-', '<chat-app', '<bard-'],
    confidence: 0.50,
    description: '일반 HTML - Notion/Gemini 패턴 없음'
  },
  
  'generic-text': {
    clipboardTypes: 1,
    requiredTypes: ['text/plain'],
    excludePatterns: ['secure.notion-static.com', '^Gemini'],
    confidence: 0.30,
    description: '일반 텍스트 - 특별한 패턴 없음'
  }
};

/**
 * 감지된 입력 방법을 기존 Matrix 형식으로 매핑
 */
export const DETECTION_TO_MATRIX_MAP: Record<string, { inputMethod: string; contentSource: string }> = {
  'notion-drag': { inputMethod: 'drag_drop', contentSource: 'notion' },
  'notion-devtools': { inputMethod: 'developer_copy', contentSource: 'notion' },
  'notion-text': { inputMethod: 'clipboard_paste', contentSource: 'notion' },
  
  'gemini-drag': { inputMethod: 'drag_drop', contentSource: 'gemini' },
  'gemini-devtools': { inputMethod: 'developer_copy', contentSource: 'gemini' },
  'gemini-text': { inputMethod: 'clipboard_paste', contentSource: 'gemini' },
  
  'generic-html': { inputMethod: 'drag_drop', contentSource: 'generic' },
  'generic-text': { inputMethod: 'clipboard_paste', contentSource: 'generic' }
};

/**
 * 감지 규칙 검증 함수
 */
export function validateDetectionRule(ruleId: string, rule: DetectionRule): string[] {
  const errors: string[] = [];
  
  if (rule.confidence < 0 || rule.confidence > 1) {
    errors.push(`${ruleId}: confidence must be between 0 and 1`);
  }
  
  if (!rule.description || rule.description.trim() === '') {
    errors.push(`${ruleId}: description is required`);
  }
  
  // 타입 검증
  const clipboardTypes = Array.isArray(rule.clipboardTypes) 
    ? rule.clipboardTypes 
    : [rule.clipboardTypes];
  
  if (clipboardTypes.some(count => count < 1 || count > 10)) {
    errors.push(`${ruleId}: clipboardTypes must be between 1 and 10`);
  }
  
  return errors;
}

/**
 * 모든 감지 규칙 검증
 */
export function validateAllDetectionRules(): string[] {
  const allErrors: string[] = [];
  
  for (const [ruleId, rule] of Object.entries(DETECTION_RULES)) {
    const errors = validateDetectionRule(ruleId, rule);
    allErrors.push(...errors);
  }
  
  return allErrors;
}

/**
 * 규칙 ID에서 사람이 읽을 수 있는 이름으로 변환
 */
export function getRuleDisplayName(ruleId: string): string {
  const displayNames: Record<string, string> = {
    'notion-drag': '🖱️ Notion 드래그앤드롭',
    'notion-devtools': '👨‍💻 Notion 개발자도구',
    'notion-text': '📋 Notion 텍스트',
    'gemini-drag': '🖱️ Gemini 드래그앤드롭',
    'gemini-devtools': '👨‍💻 Gemini 개발자도구', 
    'gemini-text': '📋 Gemini 텍스트',
    'generic-html': '🌐 일반 HTML',
    'generic-text': '📝 일반 텍스트'
  };
  
  return displayNames[ruleId] || ruleId;
}

/**
 * 신뢰도별 색상 클래스 반환 (UI용)
 */
export function getConfidenceColorClass(confidence: number): string {
  if (confidence >= 0.9) return 'text-green-600';
  if (confidence >= 0.7) return 'text-yellow-600';
  if (confidence >= 0.5) return 'text-orange-600';
  return 'text-red-600';
}