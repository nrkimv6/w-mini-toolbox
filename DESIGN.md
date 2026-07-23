# DESIGN.md — mini-toolbox 디자인 시스템 계약 (Paper Archive)

> 작성일: 2026-07-23
> 근거: `2026-07-23_transcript-viewer-session-explorer-design-port_todo-1.md` Phase 1(토큰 배선) 완료분을 `src/app.css`/`tailwind.config.js` 실제 파일에서 재확인해 옮김.
> 범위: 이 문서는 **시각 계약**이다. 컴포넌트 구현은 다루지 않는다(컴포넌트는 `_todo-2` 이후 소유).
> 이후 모든 design prompt와 React→Svelte 이식은 이 문서를 기준값으로 삼는다.

---

## 1. 팔레트

### 1.1 토큰 표

모든 색상 토큰은 `src/app.css`의 `:root`/`.dark`에 **oklch 성분값**(`--x: <l> <c> <h>`, alpha 없이)으로 저장되고, `tailwind.config.js`의 `theme.extend.colors`에서 `oklch(var(--x) / <alpha-value>)` 형태로 매핑된다. 이 매핑 방식 덕분에 **모든 색상 토큰에 alpha 유틸(`/40`, `/60`, `/5` 등)이 예외 없이 적용된다.**

| 토큰 | 용도 | 라이트 성분값 | 다크 성분값 |
|---|---|---|---|
| `canvas` | 페이지 배경(body) | `0.985 0.002 90` | 라이트 값 상속(재정의 없음, 1.3절 참조) |
| `surface` | 카드/aside 배경 | `0.975 0.003 90` | 라이트 값 상속 |
| `background` | 입력창/버튼 등 표면 배경 | `1 0 0` | `0.129 0.042 264.695` |
| `foreground` | 기본 텍스트 | `0.18 0.01 260` | `0.984 0.003 247.858` |
| `card` | 카드 배경 | `1 0 0` | `0.208 0.042 265.755` |
| `card-foreground` | 카드 텍스트 | `0.18 0.01 260` | `0.984 0.003 247.858` |
| `popover` | 팝오버 배경 | `1 0 0` | `0.208 0.042 265.755` |
| `popover-foreground` | 팝오버 텍스트 | `0.18 0.01 260` | `0.984 0.003 247.858` |
| `primary` | 주요 액션/강조 | `0.22 0.01 260` | `0.929 0.013 255.508` |
| `primary-foreground` | primary 위 텍스트 | `0.985 0.002 90` | `0.208 0.042 265.755` |
| `secondary` | 보조 배경(호버/배지) | `0.955 0.004 260` | `0.279 0.041 260.031` |
| `secondary-foreground` | secondary 위 텍스트 | `0.22 0.01 260` | `0.984 0.003 247.858` |
| `muted` | 저채도 배경 | `0.96 0.004 260` | `0.279 0.041 260.031` |
| `muted-foreground` | 보조 텍스트(메타/라벨) | `0.48 0.01 260` | `0.704 0.04 256.788` |
| `accent` | 강조 배경 | `0.955 0.004 260` | `0.279 0.041 260.031` |
| `accent-foreground` | accent 위 텍스트 | `0.22 0.01 260` | `0.984 0.003 247.858` |
| `destructive` | 오류/삭제 | `0.55 0.2 27` | `0.704 0.191 22.216` |
| `destructive-foreground` | destructive 위 텍스트 | `0.985 0.002 90` | `0.984 0.003 247.858` |
| `warning` | 경고 | `0.72 0.15 70` | 라이트 값 상속 |
| `warning-foreground` | 경고 텍스트 | `0.28 0.08 60` | 라이트 값 상속 |
| `warning-soft` | 경고 배경(soft) | `0.97 0.04 85` | 라이트 값 상속 |
| `success` | 성공 | `0.62 0.14 155` | 라이트 값 상속 |
| `border` | 테두리 | `0.9 0.006 260` | `1 0 0`(alpha는 사용처에서 지정, 1.3절) |
| `input` | 입력창 테두리 | `0.9 0.006 260` | `1 0 0`(alpha는 사용처에서 지정, 1.3절) |
| `ring` | 포커스 링 | `0.55 0.02 260` | `0.551 0.027 264.364` |

미이식 토큰(`--chart-1~5`, `--sidebar-*`)은 22절 "미채택 항목"에 별도 기술한다.

### 1.2 alpha 사용법

Tailwind `<alpha-value>` 매핑 덕분에 색상 유틸 뒤에 `/<percent>`를 붙이면 해당 색의 alpha 버전이 그대로 생성된다.

```
bg-secondary/40       secondary 배경, 40% 불투명도
hover:bg-secondary/60 secondary 배경, 호버 시 60%
border-warning/40      warning 테두리, 40%
bg-destructive/5       destructive 배경, 5%(오류 배너 저채도 배경)
focus:ring-ring/40      포커스 링, 40%
```

이 계약은 팔레트의 **모든** 토큰(`canvas`, `card`, `primary`, `border`, `ring` 등)에 예외 없이 성립한다 — 개별 토큰마다 alpha 유틸 생성 여부를 따로 확인할 필요가 없다.

### 1.3 다크 모드 `border`/`input`의 alpha 특례

소스(`session-explorer-main`)의 다크 모드 원본 값은 `--border: oklch(1 0 0 / 10%)`, `--input: oklch(1 0 0 / 15%)`로 **토큰 자체에 alpha가 내장**되어 있었다. 이 프로젝트는 성분값만 저장하는 매핑 방식(`oklch(var(--x) / <alpha-value>)`)을 쓰므로 alpha를 토큰에 내장할 수 없다.

**규칙**: 다크 모드에서 `border`/`input`을 쓸 때는 반드시 사용처에서 `border-border/10`, `border-input/15`로 alpha를 명시한다. `border-border`/`border-input`을 alpha 없이 쓰면 원본 대비 훨씬 진한 흰색 테두리가 그려져 원본 시각과 어긋난다.

### 1.4 하드코딩 금지 규칙

- `gray-*`, `purple-*`, `bg-white`, `text-black` 같은 Tailwind 팔레트 하드코딩 클래스는 신규 코드에서 금지한다. 항상 위 표의 semantic 토큰(`bg-canvas`, `text-foreground`, `border-border` 등)을 사용한다.
- 색상이 필요한데 표에 맞는 토큰이 없으면 임의로 하드코딩하지 말고 토큰 추가를 먼저 검토한다.

**예외 현황(2026-07-23 기준)**: `src/routes/screenshot/+page.svelte` 및 하위 컴포넌트(`AppearancePanel.svelte`, `ConfigPanel.svelte` 등), `src/routes/html-to-md/+page.svelte`는 이 Phase 시점에 여전히 `gray-*`/`purple-*`/`bg-white` 하드코딩 클래스를 사용 중이다(Phase 1 항목 3의 grep 집계: 총 10개 파일 107건). 이 child는 컴포넌트를 수정하지 않으므로 이 예외는 그대로 남아 있으며, 제거는 별도 계획서 소관이다.

---

## 2. 타이포그래피

### 2.1 sans/mono 구분

- **sans**(`font-sans`, 기본값): 산문, 제목, 설명 텍스트.
- **mono**(`font-mono`): 식별자·수치·경로·시각·브랜치명 등 "기계가 만든 값"을 표시할 때. 소스 근거: 세션 메타 라인(`flex flex-wrap gap-x-4 ... font-mono text-[11px]`, 750~756)과 브랜치 배지(`rounded-sm bg-secondary ... font-mono text-[10px]`, 730~733)가 모두 mono다.

### 2.2 폰트 매핑

`tailwind.config.js`의 `theme.extend.fontFamily`에 실제 반영된 값:

- `sans`: `Inter Variable`, `Pretendard`, `-apple-system`, `Segoe UI`, `Malgun Gothic`, `ui-sans-serif`, `system-ui`, `sans-serif`
- `mono`: `JetBrains Mono Variable`, `ui-monospace`, `SFMono-Regular`, `Menlo`, `monospace`

`Inter Variable`/`JetBrains Mono Variable`는 `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`로 self-host 설치되며(외부 폰트 요청 0건), `src/app.css` 최상단에서 `@import`된다.

### 2.3 크기 단계

| 클래스 | 용도 | 소스 근거 |
|---|---|---|
| `text-[9px]` | 배지 텍스트(가장 작은 단계) | 725, 736, 743 |
| `text-[10px]` uppercase | 섹션 라벨/카운트/kicker | 157(kicker), 315(aside 라벨) |
| `text-[11px]` | mono 메타 라인, 보조 안내 문구 | 386, 618, 750~756 |
| `text-xs` | 컨트롤(버튼, 입력, 필터) | 409(버튼), 493(입력) |
| `text-sm` | 본문 텍스트 | 163, 318 |
| `text-lg` | 서브 제목(카드/섹션 헤더) | 364, 590 |
| `text-2xl` | 페이지 제목(h1) | 160 |

### 2.4 자간

- 라벨/kicker: `tracking-[0.22em]`(157, 315, 361, 506, 524, 547)
- 배지/메타: `tracking-wider`(701, 726, 736, 743)
- 제목: `tracking-tight`(160, 227, 590, 697)

---

## 3. 간격·라디우스

### 3.1 컨테이너

- 페이지 컨테이너: `mx-auto max-w-[1400px] px-6 py-10`(소스 124)

### 3.2 라디우스 3단 규칙

`src/app.css`에 정의된 라디우스 스케일(`--radius: 0.5rem` 기준):

```
--radius-sm: calc(var(--radius) - 4px)   /* 0.25rem */
--radius-md: calc(var(--radius) - 2px)   /* 0.375rem */
--radius-lg: var(--radius)               /* 0.5rem */
--radius-xl: calc(var(--radius) + 4px)   /* 0.75rem */
--radius-2xl: calc(var(--radius) + 8px)  /* 1rem */
```

용도별 3단 규칙:

| 클래스 | 라디우스 | 용도 | 소스 근거 |
|---|---|---|---|
| `rounded-xl` | `--radius-xl` | 카드(진입/스캔/목록/aside 컨테이너) | 314(aside), 357(스캔 카드) |
| `rounded-md` | `--radius-md` | 컨트롤(버튼, 입력창, 필터 행) | 218, 368, 518 |
| `rounded-sm` | `--radius-sm` | 배지(역할/오류/브랜치) | 726, 731, 736, 743 |

`--radius-2xl`은 `tailwind.config.js`의 `theme.extend.borderRadius`에 매핑되어 있으나 소스(`index.tsx`)에서 직접 사용되는 지점은 확인되지 않았다 — 스케일 완결성을 위해 매핑만 유지한다.

---

## 4. 상태 표현

### 4.1 경고(warning)

```
border-warning/40 bg-warning-soft text-warning-foreground
```
소스 근거: 부분 파싱 실패 details 카드(`rounded-md border border-warning/40 bg-warning-soft`, 613), 경고 배지(`border-warning/40 bg-warning-soft ... text-warning-foreground`, 743~745).

### 4.2 오류(destructive)

```
border-destructive/40 bg-destructive/5 text-destructive
```
소스 근거: 오류 배너(`role="alert"`, `rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-xs text-destructive`, 277~284).

### 4.3 빈 상태(empty)

점선 보더 카드: `rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center`(소스 769~785, `EmptyList`). 안내 문구 + 필터 초기화 버튼(`rounded-md border border-border bg-background`, 776~779) 조합.

### 4.4 로딩(loading)

인디터미넛 바: 트랙 `h-1 overflow-hidden rounded-full bg-secondary`, 채움 `h-full w-1/3 animate-pulse rounded-full bg-primary`(소스 391~393).

**`animate-pulse`는 Tailwind core 유틸이며 플러그인 없이 동작한다.** 별개로 `package.json`의 `devDependencies`에 `tailwindcss-animate: ^1.0.7`이 설치돼 있으나, **실제 `tailwind.config.js`의 `plugins`는 `[]`로 미등록 상태**임을 이 Phase에서 확인했다(파일 78행). 이 child는 `tailwind.config.js`를 추가로 수정하지 않으므로 등록 여부는 사실만 기록하며, `tailwindcss-animate`가 제공하는 `animate-in`/`animate-out` 계열 유틸(예: 다이얼로그/토스트 트랜지션)이 필요해지면 별도 계획서에서 `plugins: [require('tailwindcss-animate')]` 등록을 진행한다.

---

## 5. 접근성

- **포커스 링**: `focus:ring-2 focus:ring-ring/40`(소스 518, 검색 입력). `ring-ring/40`은 `ring` 토큰이 `<alpha-value>` 매핑되어 있어야 성립하며, 1절 `ring` 토큰 매핑이 이 계약의 전제다.
- **처리 중/오류 상태 알림**: 스캔 진행 패널은 `role="status" aria-live="polite"`(소스 355~356)로 스크린리더에 진행 상태를 알린다.
- **장식 아이콘**: 의미 전달용이 아닌 아이콘은 `aria-hidden`을 붙인다(예: 경고 아이콘 `<AlertTriangle ... aria-hidden />`, 소스 745; 취소 버튼 `<X ... aria-hidden />`, 370; 별 아이콘 `<Star ... aria-hidden />`, 759~762).

---

## 6. 한국어 UI 규칙

- 소스(`session-explorer-main`)의 영문 카피는 이식 대상이 **아니다**. 모든 화면 텍스트(라벨, 버튼, 안내 문구, 오류 메시지)는 한국어로 작성한다.
- `Inter Variable`에는 한글 글리프가 없다. `--font-sans` 폴백 체인의 `Pretendard`/`Malgun Gothic` 등 한글 폰트가 실제 한글 렌더를 담당한다.
- `body`에 적용된 `font-feature-settings: "cv11", "ss01", "ss03"`는 라틴 문자 OpenType 기능(대체 자형)이므로 **한글 본문에는 적용되지 않는다** — 한글 텍스트의 시각은 폴백 폰트(`Pretendard` 등)의 기본 렌더링을 그대로 따른다.

---

## 7. 미채택 항목

| 항목 | 사유 |
|---|---|
| 다크 모드 토글 UI | 이 프로젝트에 다크 모드 전환 진입점이 없다. `.dark` 토큰 정의는 향후 대비용으로만 존재한다 |
| shadcn `src/components/ui/*` | React 전용 컴포넌트 구현체이며 Svelte 이식 대상이 아니다(원자 토큰/유틸만 이식) |
| 영문 카피 | 6절 한국어 UI 규칙에 따라 전량 한국어로 대체 |
| Tailwind v4 | 이 프로젝트는 Tailwind v3.4.17을 사용하며(소스는 v4 `@theme inline` 문법), v3의 `theme.extend` 방식으로 동등 매핑했다 |
| `--chart-1~5` | 소스의 `index.tsx`가 차트 관련 UI를 사용하지 않아 미이식 |
| `--sidebar-*` | 소스의 `index.tsx`가 사이드바 레이아웃을 사용하지 않아 미이식(현재 UI는 상단 헤더 + 2열 그리드 구조) |
| `--radius-3xl`/`--radius-4xl` | 소스의 `index.tsx`에서 사용 지점이 확인되지 않아 미이식 |
