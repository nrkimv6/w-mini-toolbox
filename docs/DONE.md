# DONE (최근 20개)

- [x] 2026-02-08: screenshot-generator → mini-toolbox 통합 (from: plan/2026-02-08_screenshot-generator-integration_todo.md)
  - Phase 1-3: 의존성, 컴포넌트, 라우트 이관 완료 (28개 항목)
  - html2canvas, jszip 패키지 추가
  - 11개 Svelte 컴포넌트 + i18n + 스토어 이관
  - `/screenshot` 라우트 생성 + 홈 페이지 등록
  - 빌드 테스트 성공 (adapter-cloudflare)
  - **수동 검증 필요**: 기능 테스트, 도메인 리다이렉트, 프로젝트 아카이브 (MANUAL_TASKS.md 참조)

- [x] 2026-02-05: LOW 결함 수정 (MT-7) — console.log 제거 (from: plan/2026-02-04_mini-toolbox-defect-fix.md)
  - MT-7 (LOW): InputPanel.svelte 디버깅 console.log 5개 제거
  - MT-8 (LOW): Svelte 4/5 혼용 — 향후 마이그레이션 시 일괄 처리 (참고사항)
  - **결함 감사 8/8 완료 (100%)**

- [x] 2026-02-04: CRITICAL 결함 수정 (MT-1, MT-2) + LOW 정리 (MT-6) (from: plan/2026-02-04_mini-toolbox-defect-fix.md)
  - MT-1 (CRITICAL): 루트 페이지 생성 (`src/routes/+page.svelte`) — 404 해결
  - MT-2 (CRITICAL): CSS 커스텀 속성 정의 (`app.css`) — 색상/테두리/반경 스타일 복구
  - MT-6 (LOW): 미사용 인증 시스템 제거 (`+layout.svelte`) — 불필요한 로딩 딜레이 제거
  - 빌드 성공 확인

- [x] 2026-02-04: MEDIUM 결함 수정 (MT-3~5) (from: plan/2026-02-04_mini-toolbox-defect-fix.md)
  - MT-3 (MEDIUM): InputPanel 모바일 스크롤 셀렉터 오타 수정 (`.panel-headSourceRule` → `.panel-header`)
  - MT-4 (MEDIUM): RuleSelector CSS 중첩 구조 수정 (전역 스코프 누출 방지)
  - MT-5 (MEDIUM): OptionsPanel 미사용 이벤트 디스패처 제거 (Svelte 4/5 혼용 정리)
  - 빌드 성공 확인

- [x] 2026-01-30: 모바일 반응형 레이아웃 버그 수정 - 스크롤로 OutputPanel 접근 가능
- [x] 2026-01-30: mini-toolbox 프로젝트 생성 (plan/2026-01-30_mini-toolbox.md)
- [x] 2026-01-30: HTML→Markdown 변환기 이식 및 Svelte 5 마이그레이션
- [x] 2026-01-30: 간소화된 UI로 기본 변환 기능 구현
