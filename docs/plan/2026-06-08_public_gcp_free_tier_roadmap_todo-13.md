# nrkimv6 Public Repo GCP Free-Tier 적용 로드맵 — TODO 13

> 계획서: [plan](./2026-06-08_public_gcp_free_tier_roadmap.md)
> 대상 프로젝트: w-mini-toolbox
> 실행순서: 13
> 선행조건: 없음
> branch:
> worktree:
> worktree-owner:
> 테스트명령: Svelte 변경 시 npm check, API key live 검증 금지
> 진행률: 0/6 (0%)
> 요약: HTML-to-MD 도구에 Gemini Developer API 기반 optional assist를 설계하되 client secret 노출을 금지한다.

## TODO

### Phase 1: AI Assist Boundary

1. - [ ] **기능 진입점 확인** — optional assist만 허용
   - [ ] `src/routes/html-to-md/+page.svelte`: 변환 결과 후처리 버튼 후보를 확인한다
   - [ ] `src/lib/tools/html-to-md/converter/converter.ts`: deterministic 변환과 AI assist 경계를 분리한다

2. - [ ] **Gemini API secret 경계 작성** — client key 노출 금지
   - [ ] `docs/plan`: Gemini 호출은 server-side proxy가 있을 때만 허용한다고 명시한다
   - [ ] `docs/plan`: free-tier quota guard와 user opt-in 조건을 작성한다

### 검증 기준 (RIGHT-BICEP TC)

- **R**ight: optional assist 진입점이 정의되고 deterministic 변환과 AI assist 경계가 정확히 분리된다.
- **B**oundary: free-tier quota guard와 user opt-in 경계가 명시된다.
- **I**nverse: client 번들/네트워크에 Gemini API key가 0건 노출됨을 역검증한다.
- **C**ross-check: deterministic 변환 결과와 AI assist 결과를 교차 확인한다(assist 실패 시 deterministic 경로 보존).
- **E**rror: server-side proxy가 없으면 Gemini 호출을 비활성으로 두고 proxy 의존성을 명시한다(client key 직접 호출 금지).
- **P**erformance/cost: free-tier quota 초과 방지 기준과 opt-in 시에만 호출하는 조건이 있다.

---

*진행률: 0/6 (0%)*
