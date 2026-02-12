# mini-toolbox html-to-md 수정 계획서

> 작성일: 2026-01-30
> 문제: 기존 wtools-old의 핵심 기능을 누락하고 과도하게 간소화함
> 상태: 완료 (2026-01-30)

---

## 문제 분석

### 누락된 핵심 기능

#### 1. InputPanel 기능 누락
**기존 (wtools-old):**
- ✅ 클립보드에서 여러 포맷 읽기 (HTML, Text)
- ✅ 포맷 선택기 UI
- ✅ Enhanced Detection (자동 소스 감지)
- ✅ 파일 업로드
- ✅ 입력 내용 복사/다운로드
- ✅ 디바운스 처리
- ✅ 모바일 자동 스크롤

**현재 구현:**
- ❌ 단순 textarea만 존재
- ❌ 클립보드 기능 없음
- ❌ 파일 업로드 없음
- ❌ 자동 감지 없음

#### 2. OutputPanel 기능 누락
**기존 (wtools-old):**
- ✅ 미리보기 모드 (렌더링된 마크다운 보기)
- ✅ 텍스트/미리보기 토글
- ✅ 복사 버튼 (상태 피드백)
- ✅ 다운로드 (.md 파일)
- ✅ 자동 정리 옵션

**현재 구현:**
- ❌ 단순 readonly textarea
- ❌ 미리보기 없음
- ❌ 다운로드 없음
- ⚠️ 복사만 alert로 처리

#### 3. RuleSelector 완전 누락
**기존 (wtools-old):**
- ✅ Notion, Claude, ChatGPT, Gemini 등 소스별 변환 규칙
- ✅ 자동 감지 모드
- ✅ 규칙 설명 표시

**현재 구현:**
- ❌ 완전히 누락
- ❌ 기본 변환만 지원

#### 4. OptionsPanel 완전 누락
**기존 (wtools-old):**
- ✅ 세부 변환 옵션 (빈 줄 제거, 링크 변환 등)
- ✅ 설정 저장

**현재 구현:**
- ❌ 완전히 누락

#### 5. stores 기능 축소
**기존 (wtools-old):**
- ✅ 복잡한 상태 관리 (설정, 언어, UI 상태)
- ✅ localStorage 자동 저장

**현재 구현:**
- ⚠️ 기본 상태만 정의
- ❌ 저장 기능 없음

---

## 수정 계획

| 우선순위 | 항목 | 설명 | 난이도 |
|:-------:|------|------|:------:|
| P0 | InputPanel 완전 이식 | 클립보드, 포맷 선택, 자동 감지 | 높음 |
| P0 | OutputPanel 완전 이식 | 미리보기, 다운로드 | 중간 |
| P0 | RuleSelector 이식 | 소스별 변환 규칙 선택 | 중간 |
| P1 | OptionsPanel 이식 | 세부 옵션 설정 | 낮음 |
| P0 | stores 연결 수정 | import 경로 수정, 컴포넌트 연결 | 중간 |
| P1 | stores 기능 완성 | localStorage 저장, 복잡한 상태 관리 | 중간 |
| P2 | i18n 제거 작업 | 한국어로 하드코딩 | 낮음 |

**⚠️ 의존성 순서:**
1. P0-0 (파일 복사) → 선행 필수
2. P0-5 (stores 연결) → P0-1~P0-4와 병행 필수 (경로 문제 해결)
3. P0-1, P0-2, P0-3 → 병렬 가능 (각 컴포넌트 수정)
4. P0-4 (+page.svelte) → P0-1~P0-3 완료 후
5. P1 (stores 기능, OptionsPanel) → P0 완료 후

---

## P0 완료 상태 (2026-01-30)

### ✅ 완료된 작업

**P0-0: 누락 파일 복사**
- ✅ `RuleSelector.svelte` 복사
- ✅ `OutputRuleSelector.svelte` 복사
- ✅ `outputProcessor.ts` 복사

**P0-5: stores 연결 수정**
- ✅ Svelte 5 runes → writable 패턴으로 변경
- ✅ 모든 stores를 `writable()` 사용
- ✅ import 경로 통일 (`$lib/stores/html-to-md.svelte.js`)

**P0-1: InputPanel 수정**
- ✅ i18n 제거 및 한국어 하드코딩
- ✅ `@tabler/icons-svelte` → `lucide-svelte` 변경
- ✅ import 경로 수정
- ✅ settings import 제거 → `currentInputRule.set()` 사용
- ✅ debounce 함수 직접 구현

**P0-2: OutputPanel 수정**
- ✅ i18n 제거 및 한국어 하드코딩
- ✅ 아이콘 변경
- ✅ import 경로 수정

**P0-3: RuleSelector/OutputRuleSelector 수정**
- ✅ i18n 제거 및 한국어 하드코딩
- ✅ 아이콘 변경
- ✅ import 경로 수정
- ✅ settings import 제거 → `currentInputRule.set()` 사용

**P0-4: +page.svelte 수정**
- ✅ 간소화된 코드 제거
- ✅ InputPanel/OutputPanel 컴포넌트 조합
- ✅ 실시간 변환 로직 구현 ($effect)
- ✅ 경고 메시지 배너 추가
- ✅ stores를 local $state로 구독하여 $effect와 호환

**기타 수정:**
- ✅ autoClear.ts import 경로 수정
- ✅ 빌드 에러 수정 (Cannot assign to import)
- ✅ 빌드 성공 (31.72s)

**커밋:**
- ✅ `3eff7bc` - feat: P0 단계 완료

## P1 완료 상태 (2026-01-30)

### ✅ 완료된 작업

**P1-1: stores localStorage 저장/로드 추가**
- ✅ `inputHtml` 자동 저장 (autoSaveInput 옵션)
- ✅ `currentInputRule` localStorage 저장/복원
- ✅ `userOptions` localStorage 저장/복원
- ✅ storage.ts import 경로 수정 (`$lib/tools/html-to-md/converter/converter.js`)
- ✅ createInputHtmlStore, createCurrentInputRuleStore, createUserOptionsStore 함수 구현
- ✅ 빌드 성공

**P1-2: OptionsPanel 이식**
- ✅ wtools-old에서 OptionsPanel.svelte 복사
- ✅ i18n 제거 및 한국어 하드코딩
- ✅ settings store 제거 → `userOptions` 직접 사용
- ✅ Svelte 5 `$state` 사용
- ✅ 옵션 토글 동작 확인
- ✅ 빌드 성공

**커밋:**
- ✅ `2b57c48` - feat: P1 단계 완료

---

## 최종 결과

### ✅ 완전히 이식된 컴포넌트
1. ✅ **InputPanel** - 클립보드, 포맷 선택, 자동 감지, 파일 업로드
2. ✅ **OutputPanel** - 미리보기, 다운로드, OutputRuleSelector
3. ✅ **RuleSelector** - 소스별 변환 규칙 선택
4. ✅ **OutputRuleSelector** - 출력 규칙 선택
5. ✅ **OptionsPanel** - 추가 설정 (자동 지우기, 자동 저장)
6. ✅ **+page.svelte** - 실시간 변환 로직, 컴포넌트 조합

### ✅ 완성된 기능
- ✅ 클립보드 다중 포맷 지원 (HTML, Text, File)
- ✅ Enhanced Detection (자동 소스 감지)
- ✅ 소스별 파싱 로직 (Gemini, Notion, Claude, ChatGPT)
- ✅ 실시간 변환
- ✅ 미리보기 모드
- ✅ localStorage 저장/로드
- ✅ 옵션 설정 (자동 지우기, 자동 저장)
- ✅ 반응형 디자인

### 📊 빌드 통계
- **SSR**: 62.15 kB (+ storage 후 증가)
- **Client**: 112.41 kB
- **빌드 시간**: 약 32초
- **빌드 상태**: ✅ 성공

### 🎯 교훈
- ✅ 기존 코드는 이유가 있어서 복잡함
- ✅ 이식 시에는 먼저 **완전히 이식**하고, 나중에 리팩토링
- ✅ 임의로 "간소화"하지 말 것
- ✅ Svelte 5 runes vs writable 패턴 충돌 주의
- ✅ stores는 cross-component 데이터 흐름에 필수

---

## 구현 전 상태 (참고용)

**이미 복사된 파일:**
- ✅ `mini-toolbox/src/lib/components/InputPanel.svelte` (898줄, wtools-old 원본)
- ✅ `mini-toolbox/src/lib/components/OutputPanel.svelte` (wtools-old 원본)
- ✅ `mini-toolbox/src/lib/tools/html-to-md/utils/clipboard.ts`
- ✅ `mini-toolbox/src/lib/tools/html-to-md/utils/autoClear.ts`
- ✅ `mini-toolbox/src/lib/tools/html-to-md/utils/storage.ts`
- ✅ `mini-toolbox/src/lib/tools/html-to-md/detector/*` (여러 파일)
- ✅ `mini-toolbox/src/lib/tools/html-to-md/converter/converter.ts`
- ✅ `mini-toolbox/src/lib/stores/html-to-md.svelte.ts` (Svelte 5 runes 버전, 간소화됨)

**누락된 파일 (P0-0에서 해결):**
- ✅ `RuleSelector.svelte` (소스 선택 UI) → P0-0에서 복사
- ✅ `OutputRuleSelector.svelte` (OutputPanel에서 import 중) → P0-0에서 복사
- ✅ `outputProcessor.ts` (OutputPanel에서 import 중) → P0-0에서 복사

**수정 필요 파일:**
- ⚠️ `InputPanel.svelte` - i18n, 아이콘, import 경로 수정 필요
- ⚠️ `OutputPanel.svelte` - i18n, 아이콘, import 경로 수정 필요
- ⚠️ `+page.svelte` - 컴포넌트를 사용하도록 수정 필요 (현재 간소화된 버전)
- ⚠️ `stores/html-to-md.svelte.ts` - wtools-old의 stores.ts 기능 완전 이식 필요

---

## 구현 단계

### P0-0: 누락 파일 복사 (선행 작업)

**체크리스트:**
1. [ ] `wtools-old/app/src/lib/components/OutputRuleSelector.svelte` 파일 확인
2. [ ] `mini-toolbox/src/lib/components/OutputRuleSelector.svelte`로 복사
3. [ ] `wtools-old/app/src/lib/components/RuleSelector.svelte` 파일 확인
4. [ ] `mini-toolbox/src/lib/components/RuleSelector.svelte`로 복사
5. [ ] `wtools-old/app/src/lib/converter/outputProcessor.ts` 파일 확인
6. [ ] `mini-toolbox/src/lib/tools/html-to-md/converter/outputProcessor.ts`로 복사

### P0-1: InputPanel 수정 (이미 복사됨)

**참조:**
- 현재 파일: `d:\work\project\service\wtools\mini-toolbox\src\lib\components\InputPanel.svelte` (898줄)
- 클립보드 유틸: `d:\work\project\service\wtools\mini-toolbox\src\lib\tools\html-to-md\utils\clipboard.ts` (347줄)
- Enhanced Detector: `d:\work\project\service\wtools\mini-toolbox\src\lib\tools\html-to-md\detector\enhancedDetector.ts` (100줄)

**클립보드 다중 포맷 지원 확인:**
- ✅ `clipboard.ts`의 `readClipboardFormats()` 함수 (104-245줄)
- ✅ 지원 포맷: `text/html`, `text/plain`, `image/*`, `application/*` 등
- ✅ `ClipboardContent` 인터페이스: `type`, `label`, `content`, `available`, `blob`, `isFile`, `fileName` 속성 (90-98줄)
- ✅ 모바일 폴백: `clipboard.read()` 실패 시 `readText()` 사용 (178-200줄)

**체크리스트 (파일이 이미 복사되어 있으므로 수정만 필요):**
1. [ ] `mini-toolbox/src/lib/components/InputPanel.svelte` 파일 열기
2. [ ] i18n 관련 import 제거
   - 삭제: `import { t } from 'svelte-i18n';`
3. [ ] 모든 `$t()` 호출을 한국어 문자열로 교체
   - 예: `$t('input.title')` → `"입력"`
   - 예: `$t('common.paste')` → `"붙여넣기"`
   - 예: `$t('common.clear')` → `"지우기"`
   - 예: `$t('common.loading')` → `"로딩..."`
   - 예: `$t('input.clipboardFormats')` → `"클립보드 포맷"`
   - 예: `$t('input.formatsAvailable', ...)` → 템플릿 리터럴로 변경
   - 예: `$t('input.globalPasteDetected')` → `"붙여넣기 감지됨"`
   - 예: `$t('input.placeholder')` → `"HTML을 붙여넣으세요..."`
4. [ ] `@tabler/icons-svelte` import를 `lucide-svelte`로 변경
   - `IconClipboard` → `Clipboard`
   - `IconClipboardText` → `FileText`
   - `IconFile` → `File`
   - `IconTrash` → `Trash2`
   - `IconClipboardCopy as IconPaste` → `ClipboardPaste`
   - `IconRefresh` → `RefreshCw`
   - `IconWorld` → `Globe`
   - `IconPhoto` → `Image`
   - `IconDownload` → `Download`
   - `IconArrowsSort` → `ArrowUpDown`
5. [ ] import 경로 수정
   - `$lib/utils/clipboard.js` → `$lib/tools/html-to-md/utils/clipboard.js`
   - `$lib/utils/autoClear.js` → `$lib/tools/html-to-md/utils/autoClear.js`
   - `$lib/detector/enhancedDetector.js` → `$lib/tools/html-to-md/detector/enhancedDetector.js`
   - `$lib/converter/converter.js` → `$lib/tools/html-to-md/converter/converter.js`
   - `../stores.js` → `$lib/stores/html-to-md.svelte.js` (또는 stores 구조 맞춤)
6. [ ] Svelte 5 문법 확인 (필요 시 $: → $derived 등 변환)
7. [ ] 빌드 테스트: `npm run build` 에러 없음 확인
8. [ ] 테스트: 붙여넣기 버튼 클릭 → 여러 포맷 표시 확인
9. [ ] 테스트: HTML/Plain Text 포맷 선택 → 내용 적용 확인

### P0-2: OutputPanel 수정 (이미 복사됨)

**참조:**
- 현재 파일: `d:\work\project\service\wtools\mini-toolbox\src\lib\components\OutputPanel.svelte` (453줄)

**체크리스트 (파일이 이미 복사되어 있으므로 수정만 필요):**
1. [ ] `mini-toolbox/src/lib/components/OutputPanel.svelte` 파일 열기
2. [ ] i18n 관련 import 제거
   - 삭제: `import { t } from 'svelte-i18n';`
3. [ ] 모든 `$t()` 호출을 한국어 문자열로 교체
   - 예: `$t('output.title')` → `"출력"`
   - 예: `$t('common.copy')` → `"복사"`
   - 예: `$t('common.copied')` → `"복사됨"`
   - 예: `$t('common.download')` → `"다운로드"`
   - 예: `$t('common.downloaded')` → `"다운로드됨"`
   - 예: `$t('common.failed')` → `"실패"`
   - 예: `$t('common.noContent')` → `"내용 없음"`
   - 예: `$t('output.placeholder')` → `"변환된 마크다운이 여기에 표시됩니다..."`
4. [ ] `@tabler/icons-svelte` → `lucide-svelte` 변경
   - `IconClipboard` → `Clipboard`
   - `IconDownload` → `Download`
   - `IconFileText` → `FileText`
5. [ ] import 경로 수정
   - `../stores.js` → `$lib/stores/html-to-md.svelte.js`
   - `../converter/converter.js` → `$lib/tools/html-to-md/converter/converter.js`
   - `$lib/utils/autoClear.js` → `$lib/tools/html-to-md/utils/autoClear.js`
   - `../converter/outputProcessor.js` → `$lib/tools/html-to-md/converter/outputProcessor.js`
   - `./OutputRuleSelector.svelte` → 경로 확인 (P0-0에서 복사 후)
6. [ ] marked 라이브러리 import 확인
   - `import { marked } from 'marked';`
7. [ ] Svelte 5 문법 확인 (필요 시 $: → $derived 등 변환)
8. [ ] 빌드 테스트: `npm run build` 에러 없음 확인
9. [ ] 테스트: 미리보기 모드 → 마크다운 렌더링 확인
10. [ ] 테스트: 다운로드 버튼 → .md 파일 저장 확인
11. [ ] 테스트: 복사 버튼 → 클립보드 복사 확인

### P0-3: RuleSelector/OutputRuleSelector 수정 (P0-0에서 복사됨)

**참조:**
- RuleSelector: `mini-toolbox/src/lib/components/RuleSelector.svelte` (P0-0에서 복사)
- OutputRuleSelector: `mini-toolbox/src/lib/components/OutputRuleSelector.svelte` (P0-0에서 복사)
- Converter: `mini-toolbox/src/lib/tools/html-to-md/converter/converter.ts` (658줄)

**중요:** RuleSelector는 OptionsPanel 내부에서 사용됨 (별도 배치 아님)

**파싱 로직 사전 정의 케이스 확인:**
- ✅ **Gemini**: CSS selector 기반 파싱 (parseGeminiConversationsFromHtml, 329-387줄)
- ✅ **Notion**: .notion-page-content selector (582-585줄)
- ✅ **Claude**: data-lexical, data-testid 속성 정리 (89-92줄)
- ✅ **ChatGPT**: data-message, data-scroll-anchor 속성 정리 (112-115줄)

**체크리스트 (P0-0 완료 후 수정):**
1. [ ] `mini-toolbox/src/lib/components/RuleSelector.svelte` 파일 열기
2. [ ] i18n 관련 import 제거
3. [ ] 모든 `$t()` 호출을 한국어 문자열로 교체
4. [ ] `@tabler/icons-svelte` → `lucide-svelte` 변경
5. [ ] import 경로 수정
   - `$lib/converter/converter.js` → `$lib/tools/html-to-md/converter/converter.js`
   - `../stores.js` → `$lib/stores/html-to-md.svelte.js`
6. [ ] `mini-toolbox/src/lib/components/OutputRuleSelector.svelte` 동일하게 수정
7. [ ] 빌드 테스트
8. [ ] 테스트: 소스 선택 → 규칙 적용 확인

### P0-4: +page.svelte 수정 (컴포넌트 조합 + 실시간 변환)

**문제:**
- 현재 `+page.svelte`는 간소화된 버전으로, InputPanel/OutputPanel 컴포넌트를 사용하지 않음
- 실시간 변환 로직이 누락됨

**참조:**
- 현재 파일: `mini-toolbox/src/routes/html-to-md/+page.svelte` (119줄)
- wtools-old 참고: `wtools-old/app/src/routes/html-to-md/+page.svelte` (564줄)

**핵심: 실시간 변환 로직 (wtools-old +page.svelte 17-45줄)**
- `$: if ($inputHtml || $currentInputRule) { ... }` reactive statement
- detectContentType → convertHtmlToMarkdown → outputMarkdown.set()
- warningMessage 처리

**체크리스트:**
1. [ ] 현재 `+page.svelte` 파일 열기
2. [ ] 간소화된 코드 제거
   - 직접 구현된 textarea 입출력 제거
   - 인라인 `let inputValue`, `let outputValue` 제거
   - 인라인 `$effect`, `clearInput`, `copyOutput` 함수 제거
3. [ ] stores import 추가
   - `import { inputHtml, outputMarkdown, isConverting, currentInputRule, warningMessage } from '$lib/stores/html-to-md.svelte.js';`
4. [ ] converter/detector import 추가
   - `import { convertHtmlToMarkdown } from '$lib/tools/html-to-md/converter/converter.js';`
   - `import { detectContentType } from '$lib/tools/html-to-md/detector/contentDetector.js';`
5. [ ] **실시간 변환 로직 추가 (핵심!)**
   - Svelte 5: `$effect()` 사용
   - inputHtml 변경 시 → detectContentType → convertHtmlToMarkdown → outputMarkdown 업데이트
6. [ ] 컴포넌트 import 추가
   - `import InputPanel from '$lib/components/InputPanel.svelte';`
   - `import OutputPanel from '$lib/components/OutputPanel.svelte';`
   - `import OptionsPanel from '$lib/components/OptionsPanel.svelte';` (RuleSelector 포함)
7. [ ] 레이아웃 구성
   - 헤더 영역 유지
   - 2열 그리드로 InputPanel, OutputPanel 배치
   - 푸터에 OptionsPanel 배치 (RuleSelector 포함됨)
8. [ ] 경고 메시지 배너 추가
   - `{#if $warningMessage}` 조건부 렌더링
9. [ ] 빌드 테스트: `npm run build` 에러 없음 확인
10. [ ] 테스트: 전체 플로우 동작 확인
    - 붙여넣기 → 포맷 선택 → 자동 감지 → 변환 → 복사/다운로드

### P1-2: OptionsPanel 이식 (P0 완료 후)

**참조:**
- 원본: `wtools-old/app/src/lib/components/OptionsPanel.svelte` (307줄)

**주의:** OptionsPanel은 RuleSelector를 내부에서 사용함

**체크리스트:**
1. [ ] `wtools-old/app/src/lib/components/OptionsPanel.svelte` 파일 열기
2. [ ] 파일 내용 전체 복사
3. [ ] `mini-toolbox/src/lib/components/OptionsPanel.svelte` 파일 생성
4. [ ] 복사한 내용 붙여넣기
5. [ ] i18n 부분 한국어로 교체
6. [ ] `@tabler/icons-svelte` → `lucide-svelte` 변경
7. [ ] import 경로 수정
   - `./RuleSelector.svelte` → 경로 확인
   - `../stores.js` → `$lib/stores/html-to-md.svelte.js`
8. [ ] 옵션 설정 stores 연동 확인
9. [ ] 테스트: 빈 줄 제거 옵션 토글 → 변환 결과 변경 확인
10. [ ] 테스트: 옵션 저장 → localStorage 저장 확인

### P0-5: stores 연결 수정 (P0-1~P0-4와 병행 필수)

**참조:**
- 현재: `mini-toolbox/src/lib/stores/html-to-md.svelte.ts`
- 원본: `wtools-old/app/src/lib/stores.ts` (145줄)
- storage 유틸: `mini-toolbox/src/lib/tools/html-to-md/utils/storage.ts`

**문제:**
- InputPanel/OutputPanel이 `../stores.js`를 import하는데 경로가 맞지 않음
- 컴포넌트들이 P0-1~P0-4 수정 시 stores를 import해야 함

**체크리스트 (P0-1~P0-4 수정 전/중 처리):**
1. [ ] 현재 `mini-toolbox/src/lib/stores/html-to-md.svelte.ts` 파일 열기
2. [ ] 필요한 store가 모두 export되는지 확인
   - `inputHtml`, `outputMarkdown`, `isConverting`, `isPreviewMode`
   - `warningMessage`, `selectedFormat`, `settings`
   - `currentInputRule`, `userOptions`
3. [ ] 누락된 store 추가 (wtools-old 참고)
4. [ ] storage.ts import 경로 확인
   - `$lib/tools/html-to-md/utils/storage.js`
5. [ ] types/options.ts 경로 확인
6. [ ] 빌드 테스트: store import 에러 없음 확인

### P1-1: stores 기능 완성 (P0 완료 후)

**체크리스트:**
1. [ ] localStorage 저장/로드 로직 완성
   - `$effect()` 사용하여 자동 저장
2. [ ] inputHtml 자동 저장 기능 확인
3. [ ] settings store 전체 기능 확인
4. [ ] 테스트: 옵션 변경 → localStorage 저장 확인
5. [ ] 테스트: 페이지 새로고침 → 설정 복원 확인

### P2: i18n 제거 정리

**체크리스트:**
1. [ ] 모든 컴포넌트에서 `$t()` 사용 검색
2. [ ] 각 `$t()` 호출을 한국어 문자열로 교체
3. [ ] `svelte-i18n` import 제거
4. [ ] package.json에서 `svelte-i18n` 의존성 확인
5. [ ] 사용하지 않으면 제거
6. [ ] 테스트: 빌드 성공 확인
7. [ ] 테스트: 모든 UI 텍스트 한국어 표시 확인

---

## 반성

- ❌ "간소화"라는 명목으로 핵심 기능을 임의로 제거함
- ❌ 기존 코드의 기능을 제대로 파악하지 않음
- ❌ 사용자 경험을 고려하지 않음
- ❌ 검증 없이 "간단한 버전"을 만듦

**교훈:**
- ✅ 기존 코드는 이유가 있어서 복잡함
- ✅ 이식 시에는 먼저 **완전히 이식**하고, 나중에 리팩토링
- ✅ 임의로 "간소화"하지 말 것

---

*상태: 수정 계획 작성 완료*
