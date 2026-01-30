# 미니 도구모음 (Mini Toolbox)

> 간단하고 유용한 웹 도구들을 모아놓은 프로젝트

## 포함된 도구

### HTML → Markdown 변환기
- **URL**: `/html-to-md`
- **설명**: HTML을 깔끔한 마크다운으로 변환
- **지원**: Notion, Claude, ChatGPT, Gemini 등 다양한 소스

## 기술 스택

- **SvelteKit 2** + **Svelte 5** (Runes)
- **Tailwind CSS**
- **TypeScript**
- **Cloudflare Workers** 배포

## 주요 라이브러리

- `turndown` - HTML to Markdown 변환
- `dompurify` - XSS 방지
- `marked` - Markdown 렌더링

## 개발

\`\`\`bash
npm install
npm run dev
\`\`\`

## 빌드

\`\`\`bash
npm run build
\`\`\`

## 배포

Cloudflare Pages로 자동 배포됩니다.

- **도메인**: `toolbox.woory.day`
- **Build command**: `npm run build`
- **Build output**: `.svelte-kit/cloudflare`

## 향후 추가 예정

- JSON Formatter
- Base64 Encoder/Decoder
- Color Picker
- QR Code Generator
- Regex Tester
- Script Parser (wtools-old 이식)
