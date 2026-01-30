/**
 * 클립보드 MIME 타입 분석기
 * 클립보드 데이터의 타입 개수와 종류를 분석하여 입력 방법 추정
 */

export interface ClipboardInfo {
  typeCount: number;
  types: string[];
  hasNotionTypes: boolean;
  hasHtml: boolean;
  hasText: boolean;
}

/**
 * 클립보드 데이터 타입 분석
 */
export function analyzeClipboardTypes(clipboardData: DataTransfer): ClipboardInfo {
  const types = Array.from(clipboardData.types);
  
  const analysis: ClipboardInfo = {
    typeCount: types.length,
    types: types,
    hasNotionTypes: types.some(type => 
      type.includes('_notion-blocks-v3-production') || 
      type.includes('_notion-page-source-production')
    ),
    hasHtml: types.includes('text/html'),
    hasText: types.includes('text/plain')
  };
  
  return analysis;
}

/**
 * 클립보드 타입 기반 1차 필터링
 * 타입 개수로 가능한 입력 방법들을 좁힘
 */
export function getPossibleInputMethods(clipboardInfo: ClipboardInfo): string[] {
  const { typeCount, hasNotionTypes } = clipboardInfo;
  
  // Notion 전용 타입이 있으면 Notion 확정
  if (hasNotionTypes) {
    if (typeCount === 4) {
      return ['notion-drag'];
    }
    // Notion이지만 4개가 아닌 경우 (예외적 상황)
    return ['notion-drag', 'notion-devtools'];
  }
  
  // 타입 개수로 후보군 결정
  switch (typeCount) {
    case 4:
      return ['notion-drag']; // 일반적으로 4개는 Notion만
      
    case 2:
      return ['gemini-drag']; // 2개는 보통 Gemini 드래그앤드롭
      
    case 1:
      // HTML만 있으면 개발자도구, 텍스트만 있으면 텍스트 복사
      if (clipboardInfo.hasHtml) {
        return ['notion-devtools', 'gemini-devtools', 'generic-html'];
      }
      if (clipboardInfo.hasText) {
        return ['notion-text', 'gemini-text', 'generic-text'];
      }
      return ['generic-unknown'];
      
    default:
      // 3개, 5개 이상은 예외적 상황
      return ['generic-html'];
  }
}

/**
 * 클립보드 분석 결과를 사람이 읽을 수 있는 형태로 변환
 */
export function formatClipboardInfo(clipboardInfo: ClipboardInfo): string {
  const { typeCount, types, hasNotionTypes } = clipboardInfo;
  
  let description = `${typeCount}개 타입: ${types.join(', ')}`;
  
  if (hasNotionTypes) {
    description += ' (Notion 전용 타입 포함)';
  }
  
  return description;
}