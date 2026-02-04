# Mini Toolbox - 수동 작업 (사용자 처리 필요)

> **작성일**: 2026-02-04
> **이유**: Claude가 물리적으로 할 수 없는 작업들

---

## 📋 배포 관련 (P2)

### 1. Cloudflare Pages 프로젝트 생성
- [ ] Cloudflare Dashboard 접속
- [ ] Pages 섹션에서 새 프로젝트 생성
- [ ] GitHub 리포지토리 연결: `wservice-mini-toolbox`
- [ ] 빌드 설정:
  - Build command: `npm run build`
  - Build output directory: `.svelte-kit/cloudflare`
  - Root directory: `/`

### 2. 환경 변수 설정 (필요시)
- [ ] Cloudflare Pages 프로젝트 설정에서 환경 변수 추가
- 현재는 환경 변수 없어도 작동

### 3. 커스텀 도메인 연결
- [ ] Cloudflare Pages 프로젝트 설정
- [ ] Custom domains 섹션
- [ ] `toolbox.woory.day` 추가
- [ ] DNS 레코드 자동 생성 확인

### 4. 배포 확인
- [ ] GitHub에 push 후 자동 배포 트리거 확인
- [ ] 빌드 로그 확인
- [ ] 배포 완료 후 URL 접속: `https://toolbox.woory.day`

---

## 🧪 브라우저 테스트

### 기본 기능 테스트
- [ ] 홈 페이지(`/`) 접속 - 도구 목록 표시 확인
- [ ] HTML→Markdown 변환 페이지(`/html-to-md`) 접속
- [ ] HTML 붙여넣기 테스트
- [ ] 변환 결과 확인
- [ ] 복사/다운로드 버튼 작동 확인

### 모바일 테스트
- [ ] 모바일 브라우저에서 접속
- [ ] 반응형 레이아웃 확인
- [ ] 터치 인터랙션 확인
- [ ] HTML 붙여넣기 후 출력 패널 스크롤 확인

### 다양한 브라우저 테스트
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari (iOS)

---

## 📝 참고

**코드 수정이 필요한 항목들**은 `common/docs/2026-02-04_cross-project-defect-audit.md`의 MT-3~MT-8을 참조하세요. 이들은 Claude가 수정 가능한 항목입니다.

**현재 상태**:
- ✅ 빌드 성공
- ✅ Cloudflare Pages 어댑터 적용
- ✅ 배포 준비 완료
