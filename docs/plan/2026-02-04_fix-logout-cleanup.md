# mini-toolbox: SIGNED_OUT 핸들러 추가 계획

- **날짜**: 2026-02-04
- **원본 계획**: `common/docs/archive/2026-02-04_fix-logout-and-sw-bugs-all-projects.md`
- **가이드**: `common/docs/guide/logout-cleanup-guide.md`
- **진행률**: 0/5

---

## 현재 상태

- `auth.svelte.ts`에 **SIGNED_OUT 이벤트 분기가 없음**
- html-to-md.svelte.ts에 사용자 설정이 localStorage에 저장되지만 cleanup 메서드 없음

---

## 작업 항목

### A. html-to-md 스토어에 cleanup 추가

**파일**: `src/lib/stores/html-to-md.svelte.ts`

- [ ] `cleanup()` 메서드를 신규 생성
- [ ] cleanup 안에서 사용자 옵션(`autoClearAfterCopy`, `autoClearAfterDownload`, `autoSaveInput` 등)을 기본값으로 리셋
- [ ] cleanup 안에서 관련 localStorage 키를 삭제
- [ ] store의 export에 cleanup 추가

### B. auth.svelte.ts에 SIGNED_OUT 핸들러 추가

**파일**: `src/lib/stores/auth.svelte.ts`

- [ ] `onAuthStateChange` 콜백에서 이벤트 타입 파라미터를 받도록 수정
- [ ] `event === 'SIGNED_OUT'` 분기를 추가
- [ ] SIGNED_OUT 분기 안에서 html-to-md 스토어의 `cleanup()` 호출

### C. 검증

- [ ] `npm run build` 실행하여 빌드 에러 없는지 확인
