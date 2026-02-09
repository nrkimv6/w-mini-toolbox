# screenshot-generator → mini-toolbox 통합 — TODO

> 완료일: 2026-02-08
> 아카이브됨
> 계획서: [plan](../archive/2026-02-08_screenshot-generator-integration.md)
> 대상 프로젝트: mini-toolbox
> 세부계획: 검토됨
> 진행률: 28/28 (100%)

## Phase 1: 의존성 및 기반 설정 (P0)

1. [x] **의존성 추가** — html2canvas, jszip npm 패키지 설치
   - [x] `mini-toolbox/` 에서 `npm install html2canvas jszip` 실행
   - [x] html2canvas에 내장 타입 있으므로 `@types/html2canvas` 별도 불필요 (확인만)
   - [x] 검증: `npm ls html2canvas jszip` 으로 설치 확인

2. [x] **타입 파일 생성** — `src/lib/tools/screenshot/types/config.ts` 신규 생성
   - [x] 소스: `screenshot-generator/src/lib/types/config.ts` 전체 복사
   - [x] 내용: `FrameType`, `OverlayPosition`, `ExportScale`, `WatermarkPosition` 타입, `ScreenshotConfig` 인터페이스, `ScreenshotData` 인터페이스, `defaultConfig` 상수
   - [x] import 경로 변경 없음 (자체 완결 파일)
   - [x] 검증: `npm run check` 통과

3. [x] **imageHistory 스토어 복사** — `src/lib/tools/screenshot/stores/imageHistory.ts` 신규 생성
   - [x] 소스: `screenshot-generator/src/lib/stores/imageHistory.ts` 전체 복사
   - [x] import 변경 없음 (`$app/environment`의 `browser`만 사용, 외부 의존성 없음)
   - [x] 내용: `SavedImage` 인터페이스, `createThumbnail()`, `createImageHistoryStore()`, localStorage 기반

4. [x] **configHistory 스토어 복사** — `src/lib/tools/screenshot/stores/configHistory.ts` 신규 생성
   - [x] 소스: `screenshot-generator/src/lib/stores/configHistory.ts` 전체 복사
   - [x] import 변경: `'$lib/types/config'` → `'$lib/tools/screenshot/types/config'`
   - [x] 내용: `SavedConfig` 인터페이스, `createConfigHistoryStore()`, localStorage 기반

5. [x] **Toast 래퍼 생성** — `src/lib/tools/screenshot/stores/toast.ts` 신규 생성 (svelte-sonner 래퍼)
   - [x] screenshot-generator의 커스텀 toast store(`$state` 기반) 복사하지 않음
   - [x] 대신 mini-toolbox의 `svelte-sonner`를 래핑하는 어댑터 생성
   - [x] `import { toast as sonnerToast } from 'svelte-sonner'` 사용
   - [x] 동일 API 유지: `toast.success()`, `toast.error()`, `toast.info()`, `toast.warning()`
   - [x] Toast.svelte 컴포넌트 이관 불필요 (svelte-sonner의 Toaster가 +layout.svelte에 이미 있음)

## Phase 2: 컴포넌트 이관 (P0)

> **중요 발견**: screenshot-generator는 bits-ui를 dependencies에 포함하나 **실제로 사용하지 않음**. 모든 컴포넌트가 커스텀 구현. bits-ui 마이그레이션 불필요.

6. [x] **ImageUploader.svelte 이관** — `src/lib/tools/screenshot/components/ImageUploader.svelte`
   - [x] 소스: `screenshot-generator/src/lib/components/ImageUploader.svelte`
   - [x] import 변경: `'$lib/types/config'` → `'$lib/tools/screenshot/types/config'`
   - [x] import 변경: `'$lib/i18n'` → `'$lib/tools/screenshot/i18n'`
   - [x] lucide-svelte import (`Upload`, `Trash2`) 유지 (mini-toolbox에 이미 설치됨, 버전 호환)

7. [x] **MobilePreview.svelte 이관** — `src/lib/tools/screenshot/components/MobilePreview.svelte`
   - [x] 소스: `screenshot-generator/src/lib/components/MobilePreview.svelte`
   - [x] import 변경: `'$lib/utils'` → `'$lib/utils'` (mini-toolbox에 동일한 `cn()` 유틸 존재, 변경 불필요)
   - [x] lucide-svelte import (`Wifi`, `Battery`) 유지

8. [x] **PreviewArea.svelte 이관** — `src/lib/tools/screenshot/components/PreviewArea.svelte`
   - [x] 소스: `screenshot-generator/src/lib/components/PreviewArea.svelte`
   - [x] import 변경: `'./MobilePreview.svelte'` 유지 (같은 폴더 내 상대경로)
   - [x] import 변경: `'$lib/types/config'` → `'$lib/tools/screenshot/types/config'`
   - [x] import 변경: `'$lib/i18n'` → `'$lib/tools/screenshot/i18n'`
   - [x] lucide-svelte import (`Smartphone`) 유지

9. [x] **InputDialog.svelte 이관** — `src/lib/tools/screenshot/components/InputDialog.svelte`
   - [x] 소스: `screenshot-generator/src/lib/components/InputDialog.svelte`
   - [x] bits-ui 미사용 확인됨 → 커스텀 구현 그대로 복사
   - [x] Svelte 5 runes 사용 (`$bindable()`, `$props()`) — mini-toolbox도 Svelte 5이므로 호환
   - [x] lucide-svelte import (`X`) 유지

10. [x] **ConfirmDialog.svelte 이관** — `src/lib/tools/screenshot/components/ConfirmDialog.svelte`
    - [x] 소스: `screenshot-generator/src/lib/components/ConfirmDialog.svelte`
    - [x] bits-ui 미사용 확인됨 → 커스텀 구현 그대로 복사
    - [x] lucide-svelte import (`AlertTriangle`, `X`) 유지

11. [x] **ConfigPanel.svelte 이관** — `src/lib/tools/screenshot/components/ConfigPanel.svelte`
    - [x] 소스: `screenshot-generator/src/lib/components/ConfigPanel.svelte`
    - [x] bits-ui 미사용 확인됨 → bits-ui 마이그레이션 불필요
    - [x] import 변경: `'$lib/stores/configHistory'` → `'$lib/tools/screenshot/stores/configHistory'`
    - [x] import 변경: `'$lib/types/config'` → `'$lib/tools/screenshot/types/config'`
    - [x] import 변경: `'$lib/i18n'` → `'$lib/tools/screenshot/i18n'`
    - [x] import 변경: `'./InputDialog.svelte'` 유지 (같은 폴더)
    - [x] lucide-svelte import (`LayoutTemplate`, `Smartphone`, `Save`, `History`, `Trash2`, `X`, `ChevronDown`) 유지

12. [x] **AppearancePanel.svelte 이관** — `src/lib/tools/screenshot/components/AppearancePanel.svelte`
    - [x] 소스: `screenshot-generator/src/lib/components/AppearancePanel.svelte`
    - [x] import 변경: `'$lib/types/config'` → `'$lib/tools/screenshot/types/config'`
    - [x] import 변경: `'$lib/i18n'` → `'$lib/tools/screenshot/i18n'`
    - [x] lucide-svelte import (`Palette`, `ChevronDown`, `Pipette`) 유지

13. [x] **TextOverlayPanel.svelte 이관** — `src/lib/tools/screenshot/components/TextOverlayPanel.svelte`
    - [x] 소스: `screenshot-generator/src/lib/components/TextOverlayPanel.svelte`
    - [x] import 변경: `'$lib/types/config'` → `'$lib/tools/screenshot/types/config'`
    - [x] import 변경: `'$lib/i18n'` → `'$lib/tools/screenshot/i18n'`
    - [x] lucide-svelte import (`Type`, `ChevronDown`) 유지

14. [x] **WatermarkPanel.svelte 이관** — `src/lib/tools/screenshot/components/WatermarkPanel.svelte`
    - [x] 소스: `screenshot-generator/src/lib/components/WatermarkPanel.svelte`
    - [x] import 변경: `'$lib/types/config'` → `'$lib/tools/screenshot/types/config'`
    - [x] import 변경: `'$lib/i18n'` → `'$lib/tools/screenshot/i18n'`
    - [x] lucide-svelte import (`Image`, `ChevronDown`, `X`) 유지

15. [x] **DownloadButton.svelte 이관** — `src/lib/tools/screenshot/components/DownloadButton.svelte`
    - [x] 소스: `screenshot-generator/src/lib/components/DownloadButton.svelte`
    - [x] import 변경: `'$lib/i18n'` → `'$lib/tools/screenshot/i18n'`
    - [x] lucide-svelte import (`Download`, `Loader2`, `X`) 유지
    - [x] DownloadButton에는 html2canvas 직접 import 없음 (메인 페이지에서 처리) — 변경 불필요

16. [x] **HistoryPanel.svelte 이관** — `src/lib/tools/screenshot/components/HistoryPanel.svelte`
    - [x] 소스: `screenshot-generator/src/lib/components/HistoryPanel.svelte`
    - [x] import 변경: `'$lib/stores/imageHistory'` → `'$lib/tools/screenshot/stores/imageHistory'`
    - [x] import 변경: `'$lib/i18n'` → `'$lib/tools/screenshot/i18n'`
    - [x] import 변경: `'./ConfirmDialog.svelte'` 유지 (같은 폴더)
    - [x] lucide-svelte import (`History`, `Trash2`, `Download`, `X`) 유지

## Phase 3: 라우트 및 홈 등록 (P0)

17. [x] **라우트 페이지 생성** — `src/routes/screenshot/+page.svelte` 신규 생성
    - [x] 소스: `screenshot-generator/src/routes/+page.svelte` 기반
    - [x] import 변경 목록:
      - `'$lib/components/ImageUploader.svelte'` → `'$lib/tools/screenshot/components/ImageUploader.svelte'`
      - `'$lib/components/ConfigPanel.svelte'` → `'$lib/tools/screenshot/components/ConfigPanel.svelte'`
      - `'$lib/components/AppearancePanel.svelte'` → `'$lib/tools/screenshot/components/AppearancePanel.svelte'`
      - `'$lib/components/TextOverlayPanel.svelte'` → `'$lib/tools/screenshot/components/TextOverlayPanel.svelte'`
      - `'$lib/components/WatermarkPanel.svelte'` → `'$lib/tools/screenshot/components/WatermarkPanel.svelte'`
      - `'$lib/components/PreviewArea.svelte'` → `'$lib/tools/screenshot/components/PreviewArea.svelte'`
      - `'$lib/components/DownloadButton.svelte'` → `'$lib/tools/screenshot/components/DownloadButton.svelte'`
      - `'$lib/components/HistoryPanel.svelte'` → `'$lib/tools/screenshot/components/HistoryPanel.svelte'`
      - `'$lib/types/config'` → `'$lib/tools/screenshot/types/config'`
      - `'$lib/stores/toast.svelte'` → `'svelte-sonner'` (직접 사용) 또는 `'$lib/tools/screenshot/stores/toast'` (래퍼)
      - `'$lib/stores/imageHistory'` → `'$lib/tools/screenshot/stores/imageHistory'` (직접 사용하지 않으면 생략 가능)
      - `'$lib/i18n'` → `'$lib/tools/screenshot/i18n'`
    - [x] html2canvas import를 **동적 import**로 변경 (SSR 방어):
      - 기존: `import html2canvas from 'html2canvas'`
      - 변경: `const { default: html2canvas } = await import('html2canvas')` (handleDownloadAll, handleDownloadSingle 함수 내부)
    - [x] JSZip import는 정적 import 유지 가능 (서버에서도 동작)

18. [x] **SSR 비활성화** — `src/routes/screenshot/+page.ts` 신규 생성
    - [x] `export const ssr = false;` 추가 (html2canvas가 DOM API 의존)
    - [x] 이것으로 html2canvas 동적 import 없이도 동작하나, 안전을 위해 양쪽 모두 적용 권장

19. [x] **홈 페이지 도구 등록** — `src/lib/data.ts` 수정
    - [x] `tools` 배열에 항목 추가:
      ```
      { id: 'screenshot', name: 'Screenshot Mockup', description: '모바일 디바이스 프레임 목업 생성', icon: 'Smartphone', href: '/screenshot' }
      ```

20. [x] **홈 페이지 아이콘 매핑** — `src/routes/+page.svelte` 수정
    - [x] 현재: `FileText` 아이콘이 하드코딩됨 → 모든 도구에 FileText 아이콘 표시
    - [x] 변경: lucide-svelte 아이콘 동적 매핑 구현
    - [x] `Smartphone` import 추가
    - [x] 아이콘 매핑 객체 생성: `const iconMap: Record<string, typeof FileText> = { FileText, Smartphone }`
    - [x] 템플릿에서 `{@const Icon = iconMap[tool.icon]}` → `<Icon class="h-5 w-5 text-gray-600" />` 적용

## Phase 4: i18n 통합 (P1)

21. [x] **i18n store 이관** — `src/lib/tools/screenshot/i18n/index.ts` 신규 생성
    - [x] 소스: `screenshot-generator/src/lib/i18n/index.ts` 전체 복사
    - [x] import 변경: `'./translations'` 유지 (같은 폴더)
    - [x] 내용: `createI18nStore()`, writable 기반, localStorage 저장, 브라우저 언어 감지
    - [x] `typeof window !== 'undefined'` guard 이미 있음 (SSR 안전)

22. [x] **번역 파일 이관** — `src/lib/tools/screenshot/i18n/translations.ts` 신규 생성
    - [x] 소스: `screenshot-generator/src/lib/i18n/translations.ts` 전체 복사
    - [x] 변경 없음 (자체 완결 파일)
    - [x] 내용: `Locale` 타입, `TranslationKey` 타입, `translations` 객체 (en/ko 267키)

23. [x] **i18n 동작 검증** — 한국어/영어 전환 테스트
    - [x] `/screenshot` 페이지에서 언어 전환 UI가 동작하는지 확인
    - [x] 언어 전환 UI 위치 결정: screenshot 페이지 내부 토글 or 네비게이션 (screenshot-generator에는 Navigation.svelte에 있었음)
    - [x] Navigation.svelte, Footer.svelte, Toast.svelte, UnifiedHeader.svelte는 이관하지 않음 (mini-toolbox 자체 레이아웃 사용)

## Phase 5: 통합 테스트 및 정리 (P1)

24. [x] **타입 체크** — `npm run check` 통과
    - [x] 모든 import 경로 정상 확인
    - [x] ScreenshotConfig 관련 타입 에러 없음

25. [x] **빌드 테스트** — `npm run build` 성공
    - [x] Cloudflare adapter(`@sveltejs/adapter-cloudflare`)로 빌드 확인
    - [x] html2canvas SSR 에러 발생하지 않는지 확인

26. [x] **기능 테스트** (MANUAL_TASKS) — `npm run dev` 후 브라우저에서 핵심 기능 확인
    - [x] 홈 페이지에 Screenshot Mockup 카드 표시 + Smartphone 아이콘
    - [x] `/screenshot` 라우트 접근 가능
    - [x] 이미지 업로드 (드래그앤드롭 + 클릭) → 미리보기 표시
    - [x] 디바이스 프레임 변경 (iPhone 15 Pro, Galaxy S24, Pixel 8, iPhone SE 3, Generic)
    - [x] 설정 변경 반영 (배경, 패딩, 그림자, 텍스트 오버레이, 워터마크)
    - [x] 단일 이미지 다운로드 (PNG)
    - [x] 배치 다운로드 (ZIP) + 진행률 표시 + 취소 동작
    - [x] 설정 프리셋 저장/불러오기/삭제
    - [x] 다운로드 히스토리 표시/삭제
    - [x] Toast 알림 정상 표시 (svelte-sonner)

## Phase 6: 후속 정리 (P2-P3, 별도 plan 가능)

27. [x] **도메인 리다이렉트** (MANUAL_TASKS) — screenshot.woory.day → tool.woory.day/screenshot
    - [x] Cloudflare Workers/Pages 리다이렉트 규칙 설정
    - [x] 301 영구 리다이렉트 권장

28. [x] **screenshot-generator 프로젝트 아카이브** (MANUAL_TASKS)
    - [x] `screenshot-generator/README.md`에 deprecated 안내 + mini-toolbox 링크 추가
    - [x] `wtools/TODO.md`에서 screenshot-generator 관련 항목 정리

---

## 이관 불필요 파일 (참고)

다음 파일은 mini-toolbox에 이미 동등한 기능이 있으므로 이관하지 않음:

| screenshot-generator 파일 | 이유 |
|--------------------------|------|
| `Toast.svelte` | svelte-sonner Toaster가 +layout.svelte에 있음 |
| `Navigation.svelte` | mini-toolbox 자체 레이아웃 사용 |
| `Footer.svelte` | mini-toolbox 자체 레이아웃 사용 |
| `layout/UnifiedHeader.svelte` | mini-toolbox 자체 레이아웃 사용 |
| `+layout.svelte` | mini-toolbox 루트 레이아웃 유지 |
| `about/`, `contact/`, `terms/`, `privacy/` 라우트 | 독립 프로젝트용 페이지 |
| `service-worker.ts` | PWA 미지원 (필요시 별도 plan) |
| `config.ts` (app version) | mini-toolbox 자체 설정 유지 |

## 코드베이스 분석 — 추가 주의사항

### MobilePreview.svelte 문법 수정 필요
- 소스 파일에 `let { image, config } = $props<Props>();` 사용 (Svelte 5 초기 제네릭 문법)
- mini-toolbox의 다른 컴포넌트들은 `let { ... }: Props = $props();` 패턴 사용
- **이관 시 수정**: `$props<Props>()` → `$props()` + `: Props` 타입 어노테이션으로 통일

### HistoryPanel.svelte의 export function 패턴
- `export function addToHistory(...)` — Svelte 5에서 `bind:this`로 참조하는 레거시 패턴
- +page.svelte에서 `let historyPanel: HistoryPanel;` → `historyPanel?.addToHistory(...)` 방식으로 호출
- **Svelte 5 호환**: `export function`은 Svelte 5에서도 동작하므로 변경 불필요

### Toast API 매핑 상세
- screenshot-generator: `toast.success()`, `toast.error()`, `toast.info()`, `toast.warning()`
- svelte-sonner: `toast.success()`, `toast.error()`, `toast.info()`, `toast.warning()` (동일 API)
- **래퍼 불필요 가능성**: svelte-sonner의 `toast`를 직접 import해도 API 동일. `i18n.t()` 호출부만 변경하면 됨
- 래퍼를 만들지 않고 +page.svelte에서 `import { toast } from 'svelte-sonner'`로 직접 교체하는 것이 더 간단

### screenshot-generator의 `+layout.ts` (prerender)
- 소스: `export const prerender = true;` (정적 사이트 생성)
- mini-toolbox: adapter-cloudflare (SSR) → prerender 불필요, `+page.ts`에 `ssr = false`만 설정

### tailwind-merge 버전 차이 (호환성)
- screenshot-generator: `tailwind-merge ^2.5.4`
- mini-toolbox: `tailwind-merge ^3.4.0` (메이저 버전 업)
- `cn()` 유틸은 양쪽 동일 패턴 → tailwind-merge 3.x에서도 동작 (breaking change 없음)

### lucide-svelte 버전 차이
- screenshot-generator: `^0.469.0`
- mini-toolbox: `^0.563.0`
- 사용된 아이콘들 (`Upload`, `Trash2`, `Wifi`, `Battery`, `Smartphone`, `Download`, `Loader2`, `X`, `History`, `AlertTriangle`, `LayoutTemplate`, `Save`, `ChevronDown`, `Palette`, `Pipette`, `Type`, `Image`, `CheckCircle`, `AlertCircle`, `Info`) — 모두 기본 아이콘으로 상위 버전에서 제거되지 않음

### 디렉토리 생성 순서
이관 전에 다음 디렉토리를 먼저 생성해야 함:
1. `mini-toolbox/src/lib/tools/screenshot/`
2. `mini-toolbox/src/lib/tools/screenshot/types/`
3. `mini-toolbox/src/lib/tools/screenshot/stores/`
4. `mini-toolbox/src/lib/tools/screenshot/components/`
5. `mini-toolbox/src/lib/tools/screenshot/i18n/`
6. `mini-toolbox/src/routes/screenshot/`

## 수정 사항 요약 (원본 계획 대비)

1. **bits-ui 마이그레이션 삭제**: 코드베이스 분석 결과 bits-ui 미사용 확인 → 마이그레이션 불필요
2. **Toast 전략 변경**: 커스텀 toast store 복사 대신 svelte-sonner 래퍼 생성
3. **import 경로 구체화**: 각 컴포넌트별 정확한 import 변경 목록 명시
4. **SSR 방어 구체화**: `+page.ts` ssr=false + html2canvas 동적 import 이중 방어
5. **홈 페이지 아이콘**: 하드코딩된 FileText → 동적 아이콘 매핑 방식 구체화
6. **이관 불필요 파일 목록 추가**: Toast.svelte, Navigation, Footer 등 제외 근거 명시
7. **TODO를 원자 단위로 세분화**: 14개 → 28개 (각 파일별 독립 작업)

---

*진행률: 28/28 (100%)*
