export interface ContentSourceResult {
  source: 'gemini' | 'notion' | 'claude' | 'chatgpt' | 'recipe_site' | 'blog' | 'documentation' | 'generic' | 'naver_cafe';
  confidence: number;
}

export function detectContentSource(html: string, textContent?: string): ContentSourceResult {
  console.log('[Content Source Detection] 분석 시작:', {
    hasHtml: !!html,
    htmlLength: html?.length || 0,
    hasText: !!textContent,
    textLength: textContent?.length || 0,
    textPreview: textContent?.substring(0, 100) || 'N/A'
  });

  // Claude 감지
  const claudeScore = calculateClaudeScore(html);
  console.log('[Content Source] Claude 점수:', claudeScore);
  if (claudeScore > 0.7) {
    return {
      source: 'claude',
      confidence: claudeScore
    };
  }

  // ChatGPT 감지
  const chatgptScore = calculateChatGPTScore(html);
  console.log('[Content Source] ChatGPT 점수:', chatgptScore);
  if (chatgptScore > 0.7) {
    return {
      source: 'chatgpt',
      confidence: chatgptScore
    };
  }

  // Gemini 감지 - HTML과 텍스트 모두 검사
  const geminiHtmlScore = calculateGeminiScore(html);
  const geminiTextScore = textContent ? calculateGeminiTextScore(textContent) : 0;
  const geminiScore = Math.max(geminiHtmlScore, geminiTextScore);
  console.log('[Content Source] Gemini 점수:', { html: geminiHtmlScore, text: geminiTextScore, final: geminiScore });
  if (geminiScore > 0.7) {
    return {
      source: 'gemini',
      confidence: geminiScore
    };
  }

  // Notion 감지 (기존 로직 + 강화)
  const notionScore = calculateNotionScore(html);
  console.log('[Content Source] Notion 점수:', notionScore);
  if (notionScore > 0.7) {
    return {
      source: 'notion',
      confidence: notionScore
    };
  }

  // 레시피 사이트 감지
  const recipeScore = calculateRecipeScore(html);
  console.log('[Content Source] Recipe 점수:', recipeScore);
  if (recipeScore > 0.6) {
    return {
      source: 'recipe_site',
      confidence: recipeScore
    };
  }

  // 블로그 감지
  const blogScore = calculateBlogScore(html);
  console.log('[Content Source] Blog 점수:', blogScore);
  if (blogScore > 0.6) {
    return {
      source: 'blog',
      confidence: blogScore
    };
  }

  // 네이버 카페 감지
  const naverCafeScore = calculateNaverCafeScore(html);
  console.log('[Content Source] Naver Cafe 점수:', naverCafeScore);
  if (naverCafeScore > 0.7) {
    return {
      source: 'naver_cafe',
      confidence: naverCafeScore
    };
  }

  // 문서/위키 감지
  const docScore = calculateDocScore(html);
  console.log('[Content Source] Doc 점수:', docScore);
  if (docScore > 0.6) {
    return {
      source: 'documentation',
      confidence: docScore
    };
  }

  console.log('[Content Source] 기본값 반환: generic');
  return {
    source: 'generic',
    confidence: 0.5
  };
}

function calculateClaudeScore(html: string): number {
  let score = 0;

  // 1차 식별자 (높은 신뢰도) - Claude Desktop 및 Web
  const primaryPatterns = [
    'class="text-text-',  // Claude 특유의 텍스트 클래스
    'data-testid="conversation-turn-',  // 대화 턴 식별자
    'class="font-claude-',  // Claude 폰트 클래스
    'class="flex-col gap-',  // Claude UI 레이아웃 패턴
    'anthropic.com',  // Anthropic 도메인
    'claude.ai'  // Claude AI 도메인
  ];

  for (const pattern of primaryPatterns) {
    if (html.includes(pattern)) {
      score += 0.25;
    }
  }

  // 2차 식별자 (중간 신뢰도)
  const secondaryPatterns = [
    'role="article"',  // 대화 아티클 구조
    'data-lexical-',  // Lexical 에디터 속성
    'prose-mirror',  // ProseMirror 에디터 (Claude가 사용)
    'class="group relative"',  // Claude UI 그룹 패턴
    'data-state="closed"'  // Claude UI 상태
  ];

  for (const pattern of secondaryPatterns) {
    if (html.includes(pattern)) {
      score += 0.15;
    }
  }

  // 3차 - Tailwind CSS 클래스 패턴 (Claude는 Tailwind 사용)
  const tailwindCount = (html.match(/\b(flex|grid|gap|p|m|text|bg|border|rounded)-\d+\b/g) || []).length;
  if (tailwindCount > 20) score += 0.1;

  return Math.min(score, 1.0);
}

function calculateChatGPTScore(html: string): number {
  let score = 0;

  // 1차 식별자 (높은 신뢰도) - ChatGPT Web 및 Desktop
  const primaryPatterns = [
    'data-message-author-role=',  // ChatGPT 메시지 역할 속성
    'class="markdown prose',  // ChatGPT 마크다운 렌더링
    'data-testid="conversation-',  // ChatGPT 대화 테스트 ID
    'openai.com',  // OpenAI 도메인
    'chatgpt.com',  // ChatGPT 도메인
    'class="gizmo-'  // ChatGPT 특유의 gizmo 클래스
  ];

  for (const pattern of primaryPatterns) {
    if (html.includes(pattern)) {
      score += 0.25;
    }
  }

  // 2차 식별자 (중간 신뢰도)
  const secondaryPatterns = [
    'data-scroll-anchor',  // ChatGPT 스크롤 앵커
    'class="agent-turn"',  // ChatGPT 에이전트 턴
    'class="human-turn"',  // ChatGPT 사용자 턴
    'data-message-id=',  // ChatGPT 메시지 ID
    'class="result-streaming'  // ChatGPT 스트리밍 결과
  ];

  for (const pattern of secondaryPatterns) {
    if (html.includes(pattern)) {
      score += 0.15;
    }
  }

  // 3차 - React 컴포넌트 패턴 (ChatGPT는 React 사용)
  const reactCount = (html.match(/data-react|__react|react-/g) || []).length;
  if (reactCount > 5) score += 0.1;

  // 코드 블록 패턴 (ChatGPT 특유의 코드 렌더링)
  if (html.includes('hljs') || html.includes('language-')) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

function calculateGeminiScore(html: string): number {
  let score = 0;

  // 1차 식별자 (높은 신뢰도)
  const primaryPatterns = [
    '<chat-app', '<bard-', 'gstatic.com/lamda/images/gemini_sparkle',
    'data-test-id="bard-text"'
  ];

  for (const pattern of primaryPatterns) {
    if (html.includes(pattern)) {
      score += 0.3;
    }
  }

  // 2차 식별자 (중간 신뢰도)
  const secondaryPatterns = [
    'gem_spark', '<bot-list', 'temp-chat-icon', 'pill-ui-logo-container'
  ];

  for (const pattern of secondaryPatterns) {
    if (html.includes(pattern)) {
      score += 0.15;
    }
  }

  // 복합 패턴 분석
  const angularCount = (html.match(/ng-|_nghost-|_ngcontent-/g) || []).length;
  const materialCount = (html.match(/mat-|mdc-|gds-/g) || []).length;
  const googleCount = (html.match(/jslog|data-hveid|google-symbols/g) || []).length;

  if (angularCount > 10) score += 0.1;
  if (materialCount > 5) score += 0.1;
  if (googleCount > 3) score += 0.1;

  return Math.min(score, 1.0);
}

function calculateNotionScore(html: string): number {
  let score = 0;

  // 최상위 식별자
  const topLevelPatterns = [
    '.notion-html', '#notion-app', '[data-notion-version]'
  ];

  for (const pattern of topLevelPatterns) {
    if (html.includes(pattern)) {
      score += 0.4;
    }
  }

  // 콘텐츠 블록 식별자
  const contentPatterns = [
    '[data-content-editable-leaf="true"]',
    '.notion-table-cell-text',
    '.notion-table-row'
  ];

  for (const pattern of contentPatterns) {
    if (html.includes(pattern)) {
      score += 0.2;
    }
  }

  return Math.min(score, 1.0);
}

function calculateRecipeScore(html: string): number {
  let score = 0;

  // Schema.org 구조화 데이터
  if (html.includes('"@type":"Recipe"') || html.includes('application/ld+json')) {
    score += 0.4;
  }

  // 일반적인 레시피 클래스
  const recipePatterns = [
    '.recipe', '.ingredient', '.instruction', '.cooking-time', '.prep-time'
  ];

  for (const pattern of recipePatterns) {
    if (html.includes(pattern)) {
      score += 0.1;
    }
  }

  // 인기 레시피 사이트
  const sitePatterns = [
    'allrecipes.com', 'food.com', 'epicurious.com', '만개의레시피', '쿡패드'
  ];

  for (const pattern of sitePatterns) {
    if (html.includes(pattern)) {
      score += 0.3;
    }
  }

  return Math.min(score, 1.0);
}

function calculateBlogScore(html: string): number {
  let score = 0;

  // WordPress
  if (html.includes('.wp-') || html.includes('wp-content') || html.includes('wordpress')) {
    score += 0.3;
  }

  // 일반적인 블로그 구조
  const blogPatterns = [
    '.post', '.article', '.blog-content', '.entry-content'
  ];

  for (const pattern of blogPatterns) {
    if (html.includes(pattern)) {
      score += 0.15;
    }
  }

  // 메타데이터
  if (html.includes('"@type":"BlogPosting"') || html.includes('article[role="article"]')) {
    score += 0.2;
  }

  // 인기 플랫폼
  const platformPatterns = [
    'tistory.com', 'naver.com/blog', 'medium.com', 'velog.io'
  ];

  for (const pattern of platformPatterns) {
    if (html.includes(pattern)) {
      score += 0.3;
    }
  }

  return Math.min(score, 1.0);
}

function calculateDocScore(html: string): number {
  let score = 0;

  // 문서 플랫폼
  const docPlatforms = ['.gitbook', '.confluence', '.markdown-body'];

  for (const pattern of docPlatforms) {
    if (html.includes(pattern)) {
      score += 0.3;
    }
  }

  // GitHub
  if (html.includes('github.com')) {
    score += 0.2;
  }

  // 기술 문서 사이트
  if (html.includes('docs.') || html.includes('.documentation') || html.includes('.api-docs')) {
    score += 0.2;
  }

  // 일반적인 문서 구조
  const structurePatterns = [
    '.table-of-contents', '.sidebar', 'nav[role="navigation"]'
  ];

  for (const pattern of structurePatterns) {
    if (html.includes(pattern)) {
      score += 0.1;
    }
  }

  return Math.min(score, 1.0);
}

function calculateGeminiTextScore(text: string): number {
  console.log('[Gemini Text Score] 분석 시작:', text.substring(0, 200));
  let score = 0;

  // @docs/rule/gemini-drag-text.md 패턴에 맞게 수정
  // 1차 식별자 (높은 신뢰도) - 텍스트 시작 패턴
  if (text.trim().startsWith('Gemini')) {
    console.log('[Gemini Text Score] "Gemini"로 시작함 - 0.5점 추가');
    score += 0.5;
  }

  // 2차 식별자 - 컨텍스트 패턴
  const contextPatterns = [
    'Gemini와의 대화',
    'Gemini는 인물 등에 관한 정보 제공 시 실수를 할 수 있으니',
    '개인 정보 보호 및 Gemini'
  ];

  for (const pattern of contextPatterns) {
    if (text.includes(pattern)) {
      console.log(`[Gemini Text Score] 컨텍스트 패턴 "${pattern}" 발견 - 0.3점 추가`);
      score += 0.3;
    }
  }

  // // 3차 식별자 - 마크다운 패턴 (Gemini 응답 특징) -> 다른 AI응답도 될 수 있음. 제거
  // const markdownPatterns = ['```', '**', '##', '* ', '1. '];
  // let markdownMatches = 0;
  // for (const pattern of markdownPatterns) {
  //   if (text.includes(pattern)) {
  //     markdownMatches++;
  //   }
  // }

  // if (markdownMatches >= 2) {
  //   console.log(`[Gemini Text Score] 마크다운 패턴 ${markdownMatches}개 발견 - 0.2점 추가`);
  //   score += 0.2;
  // }

  console.log('[Gemini Text Score] 최종 점수:', score);
  return Math.min(score, 1.0);
}

function calculateNaverCafeScore(html: string): number {
  let score = 0;

  // 1차 식별자 (높은 신뢰도) - 네이버 카페 특유의 구조
  const primaryPatterns = [
    'cafe.naver.com',
    'se-viewer',
    'title_text',
    'WriterInfo'
  ];

  for (const pattern of primaryPatterns) {
    if (html.includes(pattern)) {
      score += 0.25;
    }
  }

  // 2차 식별자 (중간 신뢰도)
  const secondaryPatterns = [
    'se-main-container',
    'article_info',
    'comment_list',
    'se-text-paragraph',
    'se-image-resource'
  ];

  for (const pattern of secondaryPatterns) {
    if (html.includes(pattern)) {
      score += 0.15;
    }
  }

  return Math.min(score, 1.0);
}