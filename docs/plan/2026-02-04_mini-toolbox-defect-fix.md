# Mini Toolbox 결함 수정 계획서

> **작성일**: 2026-02-04
> **대상 프로젝트**: `mini-toolbox`
> **소스 경로**: `D:\work\project\service\wtools\mini-toolbox\src\`
> **감사 기반**: 소스 코드 정적 분석 결과

---

## 목차

1. [CRITICAL 우선순위](#1-critical-우선순위)
   - [MT-1: 루트 페이지 부재로 404 발생](#mt-1-루트-페이지-부재로-404-발생)
   - [MT-2: CSS 커스텀 속성 미정의](#mt-2-css-커스텀-속성-미정의)
2. [MEDIUM 우선순위](#2-medium-우선순위)
   - [MT-3: InputPanel 셀렉터 오타로 모바일 스크롤 실패](#mt-3-inputpanel-셀렉터-오타로-모바일-스크롤-실패)
   - [MT-4: RuleSelector CSS 중첩 구조 오류](#mt-4-ruleselector-css-중첩-구조-오류)
   - [MT-5: OptionsPanel 미사용 이벤트 디스패치](#mt-5-optionspanel-미사용-이벤트-디스패치)
3. [LOW 우선순위](#3-low-우선순위)
   - [MT-6~8: 미사용 인증 시스템, console.log, $: reactive 간섭](#mt-68-미사용-인증-시스템-consolelog--reactive-간섭)
4. [테스트 체크리스트](#4-테스트-체크리스트)

---

## 1. CRITICAL 우선순위

### MT-1: 루트 페이지 부재로 404 발생

**심각도**: CRITICAL - 사이트 방문 시 즉시 404 에러

**현상**: `src/routes/+page.svelte`가 존재하지 않아 `/` 경로 접근 시 SvelteKit이 404를 반환한다. 에러 페이지(`+error.svelte`)의 "홈으로" 링크(`href="/"`)도 다시 404로 순환된다. 유일한 도구 페이지는 `/html-to-md`에 있지만, 사용자가 이를 알 수 없다.

**파일 위치**: `mini-toolbox\src\routes\` (파일 부재)

**근거**: 현재 routes 디렉토리 구조:
```
src/routes/
  +error.svelte       ← 404 시 표시되는 에러 페이지
  +layout.svelte       ← 레이아웃 (authStore 로딩)
  html-to-md/
    +page.svelte       ← 유일한 도구 페이지
```

에러 페이지의 홈 링크:
```svelte
<!-- +error.svelte 9행 -->
<a href="/" class="mt-4 inline-block text-blue-600 hover:underline">홈으로</a>
```

도구 데이터 (`data.ts`):
```typescript
export const tools: Tool[] = [
    {
        id: 'html-to-md',
        name: 'HTML → Markdown',
        description: 'HTML을 깔끔한 마크다운으로 변환',
        icon: 'FileText',
        href: '/html-to-md'
    }
];
```

**수정**: `src/routes/+page.svelte` 신규 생성. `data.ts`의 도구 목록을 카드 형태로 표시.

**수정 후 코드** (`src/routes/+page.svelte` 신규):
```svelte
<script lang="ts">
    import { tools } from '$lib/data';
    import { FileText } from 'lucide-svelte';
</script>

<svelte:head>
    <title>Mini Toolbox</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center px-4">
    <h1 class="mb-2 text-3xl font-bold">Mini Toolbox</h1>
    <p class="mb-8 text-gray-500">가볍고 빠른 웹 도구 모음</p>

    <div class="grid w-full max-w-md gap-4">
        {#each tools as tool}
            <a
                href={tool.href}
                class="flex items-center gap-4 rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50"
            >
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    <FileText class="h-5 w-5 text-gray-600" />
                </div>
                <div>
                    <h2 class="font-semibold">{tool.name}</h2>
                    <p class="text-sm text-gray-500">{tool.description}</p>
                </div>
            </a>
        {/each}
    </div>
</div>
```

**수정 범위**: 1개 파일 신규 생성

---

### MT-2: CSS 커스텀 속성 미정의

**심각도**: CRITICAL - 다수 컴포넌트의 색상/테두리/반경 스타일이 깨짐

**현상**: `app.css`에서 `--foreground`, `--primary`, `--border`, `--muted-foreground`, `--secondary`, `--radius` 등의 CSS 커스텀 속성을 정의하지 않는다. 그러나 `InputPanel.svelte`, `OutputPanel.svelte`, `OptionsPanel.svelte`, `autoClear.ts` 등 여러 파일에서 `hsl(var(--foreground))`, `hsl(var(--primary))` 등을 광범위하게 사용한다.

**파일 위치**: `mini-toolbox\src\app.css` (1~11행)

**현재 코드**:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
    html,
    body {
        @apply h-full bg-white text-gray-900;
    }
}
```

**영향받는 파일** (대표 예시):
```css
/* InputPanel.svelte 577행 */
color: hsl(var(--foreground));          /* --foreground 미정의 → 색상 깨짐 */

/* InputPanel.svelte 591행 */
border: 1px solid hsl(var(--border));   /* --border 미정의 → 테두리 없음 */

/* OptionsPanel.svelte 160행 */
color: hsl(var(--foreground));

/* OptionsPanel.svelte 167행 */
border: 1px solid hsl(var(--border));
border-radius: calc(var(--radius) / 2); /* --radius 미정의 → 반경 0 */

/* autoClear.ts 46~49행 */
background: hsl(var(--primary));
color: hsl(var(--primary-foreground));
border-radius: var(--radius);
```

**수정 후 코드** (`app.css`):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
    :root {
        --background: 0 0% 100%;
        --foreground: 240 10% 3.9%;

        --card: 0 0% 100%;
        --card-foreground: 240 10% 3.9%;

        --primary: 280 60% 50%;
        --primary-foreground: 0 0% 98%;

        --secondary: 240 4.8% 95.9%;
        --secondary-foreground: 240 5.9% 10%;

        --muted: 240 4.8% 95.9%;
        --muted-foreground: 240 3.8% 46.1%;

        --accent: 240 4.8% 95.9%;
        --accent-foreground: 240 5.9% 10%;

        --destructive: 0 84.2% 60.2%;
        --destructive-foreground: 0 0% 98%;

        --border: 240 5.9% 90%;
        --input: 240 5.9% 90%;
        --ring: 240 10% 3.9%;

        --radius: 0.5rem;
    }

    html,
    body {
        @apply h-full bg-white text-gray-900;
    }
}
```

**참고**: 프로젝트의 보라색 테마(`hsl(280 60% ...)` 패턴)에 맞게 `--primary`를 `280 60% 50%`으로 설정. `screenshot-generator`의 `app.css`를 참고하여 전체 shadcn/ui 호환 변수 세트를 추가.

**수정 범위**: 1개 파일 수정 (`app.css`)

---

## 2. MEDIUM 우선순위

### MT-3: InputPanel 셀렉터 오타로 모바일 스크롤 실패 ✅ 완료

**심각도**: MEDIUM - 모바일에서 변환 후 출력 패널로 자동 스크롤 불가

**현상**: `scrollToOutputOnMobile()` 함수가 `.panel-headSourceRule` 셀렉터를 사용하지만, 실제 OutputPanel의 클래스명은 `.panel-header`이다. `querySelector`가 `null`을 반환하여 스크롤이 동작하지 않는다.

**파일 위치**: `mini-toolbox\src\lib\components\InputPanel.svelte` (244행)

**적용된 수정**: 셀렉터를 `.panel-header`로 수정

**현재 코드**:
```typescript
// InputPanel.svelte 239~252행
function scrollToOutputOnMobile() {
    // 모바일에서만 동작 (768px 이하)
    if (window.innerWidth > 768) return;

    const outputPanel = document.querySelector('.output-panel .panel-headSourceRule');
    //                                                         ^^^^^^^^^^^^^^^^^^
    //                                                         오타: panel-header가 아닌
    //                                                         panel-headSourceRule
    if (outputPanel) {
        outputPanel.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}
```

**OutputPanel 실제 마크업** (68행):
```svelte
<div class="panel-header">
```

**수정 후 코드**:
```typescript
function scrollToOutputOnMobile() {
    if (window.innerWidth > 768) return;

    const outputPanel = document.querySelector('.output-panel .panel-header');
    if (outputPanel) {
        outputPanel.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}
```

**수정 범위**: 1개소 변경 (244행)

---

### MT-4: RuleSelector CSS 중첩 구조 오류 ✅ 완료

**심각도**: MEDIUM - 일부 반응형 스타일이 의도치 않은 범위에 적용

**현상**: `RuleSelector.svelte`의 `<style>` 블록에서 `@keyframes gentleIn` 정의가 두 번 등장하고(215행, 272행), 272행의 `@keyframes gentleIn` 블록 닫힘 이후(281행)에 `.rule-label`, `.rule-select`, `.detection-info`, `.confidence` 규칙이 미디어 쿼리 밖 전역 스코프에 노출된다. 이로 인해 768px 반응형 스타일과 전역 스타일이 충돌한다.

**파일 위치**: `mini-toolbox\src\lib\components\RuleSelector.svelte` (270~319행)

**적용된 수정**: 중복 `@keyframes` 제거 및 스타일을 `@media (max-width: 640px)` 블록으로 감쌈

**현재 코드** (문제 구간):
```css
/* 270행: @media (max-width: 768px) 블록이 여기서 닫힘 */
}

@keyframes gentleIn {       /* 272행: 두 번째 중복 정의 */
    0% {
        transform: translateX(-10px) scale(0.98);
        opacity: 0;
    }
    100% {
        transform: translateX(0) scale(1);
        opacity: 1;
    }
}
    .rule-label {            /* 282행: 전역 스코프에 노출 (의도: 480px 미디어 쿼리 내부?) */
        font-size: 0.8rem;
        text-align: left;
        flex-shrink: 0;
        white-space: nowrap;
    }

    .rule-select {
        font-size: 0.8rem;
        min-width: unset;
        flex: 1;
        padding: 0.5rem 0.75rem;
    }

    .detection-info {
        font-size: 0.7rem;
    }

    .confidence {
        font-size: 0.65rem;
    }

@media (max-width: 480px) { /* 304행 */
```

**수정 후 코드**:
```css
}
/* 중복 @keyframes gentleIn 제거 (215행 정의만 유지) */

@media (max-width: 640px) {
    .rule-label {
        font-size: 0.8rem;
        text-align: left;
        flex-shrink: 0;
        white-space: nowrap;
    }

    .rule-select {
        font-size: 0.8rem;
        min-width: unset;
        flex: 1;
        padding: 0.5rem 0.75rem;
    }

    .detection-info {
        font-size: 0.7rem;
    }

    .confidence {
        font-size: 0.65rem;
    }
}

@media (max-width: 480px) {
```

**수정 범위**: 1개 파일 수정 (RuleSelector.svelte 270~303행 재구성)

---

### MT-5: OptionsPanel 미사용 이벤트 디스패치 ✅ 완료

**심각도**: MEDIUM - Dead code이며, Svelte 5 `$state`와 Svelte 4 `createEventDispatcher` 혼용

**현상**: `OptionsPanel.svelte`에서 `createEventDispatcher()`로 `'settingsToggle'` 이벤트를 dispatch하지만, 이 컴포넌트를 사용하는 `html-to-md/+page.svelte`에서 해당 이벤트를 수신하지 않는다. 또한 Svelte 5의 `$state`와 Svelte 4의 `createEventDispatcher`가 혼용되어 있다.

**파일 위치**: `mini-toolbox\src\lib\components\OptionsPanel.svelte` (6~11행)

**적용된 수정**: `createEventDispatcher` import 및 dispatch 호출 제거

**현재 코드**:
```typescript
// OptionsPanel.svelte 6~11행
import { createEventDispatcher } from 'svelte';

const dispatch = createEventDispatcher();
let isExpanded = $state(false);

function togglePanel() {
    isExpanded = !isExpanded;
    dispatch('settingsToggle', { isExpanded });
}
```

**사용처 확인** (`html-to-md/+page.svelte`):
```svelte
<!-- +page.svelte — 이벤트 핸들러 없음 -->
<OptionsPanel />
```

**수정 후 코드**:
```typescript
let isExpanded = $state(false);

function togglePanel() {
    isExpanded = !isExpanded;
}
```

`createEventDispatcher` import와 `dispatch` 호출을 모두 제거.

**수정 범위**: 1개 파일 수정 (OptionsPanel.svelte), 3행 삭제

---

## 3. LOW 우선순위

### MT-6~8: 미사용 인증 시스템, console.log, $: reactive 간섭

#### MT-6: 미사용 인증 시스템 (LOW)

**현상**: `auth.svelte.ts`에 전체 Supabase 인증 스토어가 구현되어 있고, `+layout.svelte`에서 `authStore.initialize()`를 호출하고 `authStore.loading` 동안 스피너를 표시한다. 그러나 `mini-toolbox`는 인증이 필요 없는 프로젝트로, 모든 도구가 공개 접근이다. 인증 초기화로 인해 불필요한 Supabase 네트워크 요청과 로딩 딜레이가 발생한다.

**파일 위치**:
- `mini-toolbox\src\lib\stores\auth.svelte.ts` (전체 파일)
- `mini-toolbox\src\routes\+layout.svelte` (5, 9~11, 17~19행)

**현재 코드** (`+layout.svelte`):
```svelte
<script lang="ts">
    import { onMount } from 'svelte';
    import { Toaster } from 'svelte-sonner';
    import '../app.css';
    import { authStore } from '$lib/stores/auth.svelte';

    let { children } = $props();

    onMount(async () => {
        await authStore.initialize();
    });
</script>

<Toaster position="top-center" />

<div class="min-h-screen bg-white">
    {#if authStore.loading}
        <div class="flex h-screen items-center justify-center">
            <div class="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
        </div>
    {:else}
        {@render children()}
    {/if}
</div>
```

**수정 방향**: 인증 관련 코드 전체 제거. `+layout.svelte`를 단순화.

**수정 후 코드**:
```svelte
<script lang="ts">
    import { Toaster } from 'svelte-sonner';
    import '../app.css';

    let { children } = $props();
</script>

<Toaster position="top-center" />

<div class="min-h-screen bg-white">
    {@render children()}
</div>
```

#### MT-7: console.log 제거 (LOW)

**현상**: `InputPanel.svelte`에 디버깅용 `console.log`가 6개소 존재.

**파일 위치**: `mini-toolbox\src\lib\components\InputPanel.svelte` (83, 87, 115, 117, 217행)

**대표 예시**:
```typescript
// 83행
console.log('Loading clipboard formats...');
// 87행
console.log('Loaded clipboard formats:', clipboardFormats);
// 115행
console.log('Available formats:', availableFormats.length);
// 117행
console.log('showFormatSelector:', showFormatSelector);
// 217행
console.log(`Auto-switching from ${$currentInputRule} to ${mappedRule} ...`);
```

**수정 방향**: 모든 디버깅 `console.log` 제거. `console.error`는 유지.

#### MT-8: $: reactive 간섭 가능성 (LOW)

**현상**: Svelte 5 runes(`$state`, `$effect`)와 Svelte 4 스토어(`writable`, `$store` 문법)가 혼용되어 있다. 현재 동작하지만, 향후 마이그레이션 시 의도치 않은 반응성 충돌 가능성이 있다.

**수정 방향**: 향후 전면 Svelte 5 마이그레이션 시 일괄 처리. 현재는 코드 리뷰 시 참고 사항으로만 유지.

---

## 4. 테스트 체크리스트

### MT-1 테스트
- [ ] `/` 접근 시 도구 목록 페이지가 정상 렌더링되는가?
- [ ] "HTML -> Markdown" 카드 클릭 시 `/html-to-md`로 이동하는가?
- [ ] 에러 페이지의 "홈으로" 링크가 도구 목록으로 이동하는가?

### MT-2 테스트
- [ ] InputPanel의 텍스트 색상이 정상 표시되는가? (이전: 투명/없음)
- [ ] OptionsPanel의 테두리선과 배경색이 보이는가?
- [ ] OutputPanel의 버튼 스타일이 정상인가?
- [ ] autoClear 알림 배너의 배경/글자 색상이 표시되는가?

### MT-3 테스트
- [ ] 모바일 뷰(768px 이하)에서 변환 후 출력 패널로 자동 스크롤되는가?

### MT-4 테스트
- [ ] 640px 이하 화면에서 RuleSelector의 라벨/셀렉트 크기가 적절한가?
- [ ] 480px 이하 화면에서 추가 축소가 적용되는가?
- [ ] 데스크탑에서 RuleSelector 크기가 이전과 동일한가?

### MT-5 테스트
- [ ] OptionsPanel 토글 버튼 클릭 시 설정 패널이 펼쳐지는가?
- [ ] 콘솔에 이벤트 관련 경고가 없는가?

### MT-6 테스트
- [ ] 페이지 로딩 시 스피너 없이 즉시 콘텐츠가 표시되는가?
- [ ] Supabase 관련 네트워크 요청이 발생하지 않는가?
