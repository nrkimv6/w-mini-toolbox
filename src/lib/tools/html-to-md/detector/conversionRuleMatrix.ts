export const CONVERSION_MATRIX: Record<string, Record<string, string>> = {
  'drag_drop': {
    'gemini': 'gemini_rich',
    'notion': 'notion_blocks',
    'claude': 'claude_drag_html',
    'chatgpt': 'chatgpt_drag_html',
    'recipe_site': 'recipe_structured',
    'blog': 'blog_clean',
    'documentation': 'doc_formatted',
    'generic': 'generic_clean'
  },
  'developer_copy': {
    'gemini': 'gemini_clean',
    'notion': 'notion_clean',
    'claude': 'claude_dev_html',
    'chatgpt': 'chatgpt_dev_html',
    'recipe_site': 'recipe_clean',
    'blog': 'blog_minimal',
    'documentation': 'doc_structured',
    'generic': 'generic_minimal'
  },
  'clipboard_paste': {
    'gemini': 'gemini_formatted',
    'notion': 'notion_formatted',
    'claude': 'claude_drag_text',
    'chatgpt': 'chatgpt_drag_text',
    'recipe_site': 'recipe_formatted',
    'blog': 'blog_formatted',
    'documentation': 'doc_clean',
    'generic': 'generic_formatted'
  },
  'desktop_app_drag': {
    'claude': 'claude_desktop_drag',
    'chatgpt': 'chatgpt_desktop_drag',
    'generic': 'generic_clean'
  }
};

// export const CONVERT_RULE_DESCRIPTIONS: Record<string, string> = {
//   'gemini_rich': 'Gemini 드래그 - 대화 구조 유지, 코드 블록 보존',
//   'gemini_clean': 'Gemini 개발자 도구 - 앱 UI 요소 제거',
//   'gemini_formatted': 'Gemini 클립보드 - 기본 포맷팅 적용',
//   'notion_blocks': 'Notion 드래그 - 블록 구조 유지, 테이블 변환',
//   'notion_clean': 'Notion 개발자 도구 - 메타데이터 정리',
//   'notion_formatted': 'Notion 클립보드 - 표준 변환',
//   'claude_desktop_drag': 'Claude Desktop 드래그 - 앱 UI 요소 정리, 대화 구조 유지',
//   'claude_drag_text': 'Claude 드래그 텍스트 - 최소한의 텍스트 정리',
//   'claude_drag_html': 'Claude 드래그 HTML - HTML 속성 정리, 구조 보존',
//   'claude_dev_html': 'Claude 개발자 도구 - 복잡한 HTML 구조 정리',
//   'chatgpt_desktop_drag': 'ChatGPT Desktop 드래그 - 앱 UI 요소 정리',
//   'chatgpt_drag_text': 'ChatGPT 드래그 텍스트 - 텍스트 기반 정리',
//   'chatgpt_drag_html': 'ChatGPT 드래그 HTML - HTML 구조 정리',
//   'chatgpt_dev_html': 'ChatGPT 개발자 도구 - 메타 속성 및 복잡한 구조 정리',
//   'recipe_structured': '레시피 사이트 - 재료/조리법 구조화',
//   'recipe_clean': '레시피 개발자 도구 - 핵심 내용만 추출',
//   'recipe_formatted': '레시피 클립보드 - 기본 변환',
//   'blog_clean': '블로그 - 본문만 추출, 사이드바 제거',
//   'blog_minimal': '블로그 개발자 도구 - 최소한 변환',
//   'blog_formatted': '블로그 클립보드 - 표준 변환',
//   'doc_formatted': '문서 - 목차 구조 유지, 링크 정리',
//   'doc_structured': '문서 개발자 도구 - 구조 보존',
//   'doc_clean': '문서 클립보드 - 기본 정리',
//   'generic_clean': '일반 사이트 - 불필요한 태그 제거',
//   'generic_minimal': '일반 개발자 도구 - 최소 변환',
//   'generic_formatted': '일반 클립보드 - 표준 변환'
// };

///감지된 입력유형
export function getOptimalRule(inputMethod: string, contentSource: string): string {
  return CONVERSION_MATRIX[inputMethod]?.[contentSource] || 'generic_formatted';
}

// export function getInputRuleDescription(rule: string): string {
//   return CONVERT_RULE_DESCRIPTIONS[rule] || '표준 변환';
// }

export function getDisplayName(source: string): string {
  const displayNames: Record<string, string> = {
    'gemini': '🤖 Gemini',
    'notion': '📝 Notion',
    'claude': '🤖 Claude',
    'chatgpt': '💬 ChatGPT',
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
    'clipboard_paste': '📋 클립보드 복사',
    'desktop_app_drag': '🖥️ 데스크톱 앱 드래그'
  };
  
  return displayNames[method] || method;
}