# nrkimv6 Public Repo GCP Free-Tier 적용 로드맵 — TODO 12

> 계획서: [plan](./2026-06-08_public_gcp_free_tier_roadmap.md)
> 대상 프로젝트: w-mini-toolbox
> 실행순서: 12
> 선행조건: 없음
> branch:
> worktree:
> worktree-owner:
> 테스트명령: Svelte 변경 시 npm check, live 검증은 merge 이후
> 진행률: 0/7 (0%)
> 요약: screenshot tool 결과를 사용자가 명시적으로 선택할 때만 Cloud Storage로 export하는 PoC를 설계한다.

## TODO

### Phase 1: Export UX Boundary

1. - [ ] **screenshot state 확인** — 저장 대상 축소
   - [ ] `src/routes/screenshot/+page.svelte`: export 진입점 후보를 확인한다
   - [ ] `src/lib/tools/screenshot/stores/imageHistory.ts`: local history와 cloud export 대상 차이를 문서화한다

2. - [ ] **Cloud Storage 정책 작성** — opt-in export
   - [ ] `docs/plan`: GCS export는 opt-in이고 기본 local-only라고 명시한다
   - [ ] `docs/plan`: signed URL, retention, bucket 공개 금지 기준을 작성한다
   - [ ] `docs/plan`: GCS export 기능을 옵션 플래그(`ENABLE_GCS_EXPORT`, 기본값 `false`)로 gate하고, 기본 disable·명시적 opt-in 시에만 활성화하는 기준을 작성한다 (non-US 리전 또는 5GB 초과 시 과금)

### 검증 기준 (RIGHT-BICEP TC)

- **R**ight: export 진입점과 cloud export 대상이 정의된다.
- **B**oundary: signed URL retention, bucket 공개 금지 기준과 5GB·non-US 리전 경계가 명시된다.
- **I**nverse: 기본 local-only — opt-in이 아니면 GCS 업로드가 0건임을 역검증한다.
- **C**ross-check: local imageHistory와 cloud export 대상 차이를 교차 확인한다.
- **E**rror: signed URL 발급 주체(서버 서명 endpoint)가 없는 client-only 구조에서는 export 기능을 비활성으로 두고, 서명 backend 의존성을 명시한다.
- **P**erformance/cost: `ENABLE_GCS_EXPORT=false` 기본값에서 생성 객체 0개 → 과금 0.

---

*진행률: 0/7 (0%)*
