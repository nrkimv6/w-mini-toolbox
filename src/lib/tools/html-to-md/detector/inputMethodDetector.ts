export interface InputMethodResult {
  method: 'drag_drop' | 'developer_copy' | 'clipboard_paste';
  confidence: number;
  typeCount: number;
}

export function detectInputMethod(clipboardData: Record<string, string>): InputMethodResult {
  const types = Object.keys(clipboardData);
  const itemCount = types.length;
  
  // 드래그 앤 드롭 감지
  if (itemCount >= 2) {
    const hasCustomTypes = types.some(type => 
      type.includes('_notion-') || 
      type.includes('_') && !type.startsWith('text/') ||
      !type.startsWith('text/') && !type.startsWith('image/')
    );
    
    if (hasCustomTypes) {
      return {
        method: 'drag_drop',
        confidence: 0.95,
        typeCount: itemCount
      };
    }
    
    // 복수 타입이지만 커스텀 타입이 없는 경우
    return {
      method: 'drag_drop',
      confidence: 0.80,
      typeCount: itemCount
    };
  }
  
  // 개발자 도구 복사 감지
  if (itemCount === 1 && types.includes('text/plain')) {
    const content = clipboardData['text/plain'];
    const isFormattedHTML = content.includes('<!DOCTYPE') || 
                           content.includes('<html') ||
                           /^\s*</.test(content);
    
    if (isFormattedHTML) {
      return {
        method: 'developer_copy',
        confidence: 0.85,
        typeCount: itemCount
      };
    }
  }
  
  // 클립보드 붙여넣기 (기본값)
  return {
    method: 'clipboard_paste',
    confidence: 0.70,
    typeCount: itemCount
  };
}