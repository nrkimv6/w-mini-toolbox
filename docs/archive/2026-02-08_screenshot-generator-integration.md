# screenshot-generator → mini-toolbox 통합

> 작성일: 2026-02-08
> 대상 프로젝트: mini-toolbox, screenshot-generator
> 상태: 아카이브됨(2026-02-08_screenshot-generator-integration_todo.md)
> 세부계획: 검토됨
> 진행률: 0/22 (0%)
>
> **실행 TODO:**
> - [screenshot-generator 통합 TODO](../../docs/plan/2026-02-08_screenshot-generator-integration_todo.md)

---

## 개요

screenshot-generator(screenshot.woory.day)를 mini-toolbox(tool.woory.day)의 `/screenshot` 라우트로 통합한다.

**근거:**
- 동일 기술 스택 (SvelteKit 2 + Svelte 5 + Tailwind CSS)
- mini-toolbox가 웹 도구 모음으로 설계되어 자연스러운 통합 대상
- 독립 프로젝트 유지보수 비용 절감 (중복 의존성, 배포 설정 등)
- screenshot-generator는 DB 없이 클라이언트 전용 → 통합 시 서버 사이드 충돌 없음

## 구현 항목

| 우선순위 | 항목 | 설명 | 난이도 |
|:-------:|------|------|:------:|
| P0 | 의존성 병합 | html2canvas, jszip 추가 | 낮음 |
| P0 | types/stores 이관 | config types, stores를 mini-toolbox 구조로 이식 | 낮음 |
| P0 | 컴포넌트 이관 | 13개 컴포넌트를 `lib/tools/screenshot/` 하위로 이관 | 높음 |
| P0 | 라우트 생성 | `/screenshot` 라우트 + 메인 페이지 구성 | 중간 |
| P1 | 홈 등록 | data.ts에 도구 등록, 아이콘 매핑 | 낮음 |
| P1 | i18n 통합 | screenshot-generator의 i18n을 mini-toolbox 공통으로 승격 | 중간 |
| P1 | UI 통합 | 토스트(svelte-sonner), 다이얼로그 등 공통 컴포넌트 활용 | 중간 |
| P2 | SSR 방어 | html2canvas 동적 import, browser guard 처리 | 낮음 |
| P2 | 리다이렉트 | screenshot.woory.day → tool.woory.day/screenshot 설정 | 낮음 |
| P3 | screenshot-generator 프로젝트 정리 | deprecated 표시 또는 아카이브 | 낮음 |

## 기술적 고려사항

### 의존성 차이 분석

| 패키지 | screenshot-generator | mini-toolbox | 통합 전략 |
|--------|---------------------|-------------|----------|
| bits-ui | ^1.0.0 | ^2.15.4 | mini-toolbox 버전 유지, 마이그레이션 필요 |
| html2canvas | ^1.4.1 | 없음 | 추가 |
| jszip | ^3.10.1 | 없음 | 추가 |
| lucide-svelte | ^0.469.0 | ^0.563.0 | mini-toolbox 버전 유지 |
| tailwind-merge | ^2.5.4 | ^3.4.0 | mini-toolbox 버전 유지 |
| svelte-sonner | 없음 | ^1.0.7 | 기존 Toast → svelte-sonner 교체 |

### bits-ui 마이그레이션 (1.x → 2.x)

screenshot-generator는 bits-ui 1.x 사용. mini-toolbox는 2.x. 주요 변경점:
- API 구조 변경 가능 (Dialog, Tabs 등)
- 컴포넌트 import 경로 변경
- **영향 범위**: InputDialog, ConfirmDialog, ConfigPanel (탭 사용)

### SSR 방어 전략

html2canvas는 DOM 전용 라이브러리로 SSR에서 로드 불가:
```typescript
// 동적 import 패턴
const html2canvas = (await import('html2canvas')).default;
```
- mini-toolbox는 adapter-cloudflare (SSR 가능) → 반드시 `browser` guard 필요
- screenshot-generator는 adapter-static이었으므로 기존 코드에 guard 없을 수 있음

### i18n 전략

screenshot-generator의 자체 i18n(svelte/store 기반)을 mini-toolbox 공통으로 확장:
- `lib/i18n/` 폴더를 공통으로 승격
- 도구별 번역 키 네임스페이스: `screenshot.xxx`, `htmlToMd.xxx`
- 기존 html-to-md는 한국어 고정 → i18n 적용은 선택

### 파일 구조 (통합 후)

```
mini-toolbox/src/
├── routes/
│   ├── +page.svelte              # 홈 (도구 목록)
│   ├── html-to-md/               # 기존
│   └── screenshot/
│       └── +page.svelte          # 스크린샷 생성기 메인
├── lib/
│   ├── tools/
│   │   ├── html-to-md/           # 기존
│   │   └── screenshot/
│   │       ├── components/       # 13개 컴포넌트
│   │       ├── stores/           # 설정/히스토리 스토어
│   │       ├── types/            # config.ts
│   │       ├── i18n/             # 번역 (또는 공통으로 승격)
│   │       └── utils.ts
│   ├── i18n/                     # 공통 i18n (선택)
│   └── data.ts                   # 도구 등록
```

---

*상태: 검토 대기 | 진행률: 0/22 (0%)*
