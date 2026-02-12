# 미니 도구모음 (Mini Toolbox) 프로젝트

> 작성일: 2026-01-30
> 대상 프로젝트: 신규 (mini-toolbox)
> 상태: 기본 기능 완료 (P0, P1 완료 / P2 배포 남음)

---

## 개요

1-2페이지짜리 소규모 유틸리티 도구들을 하나의 SvelteKit 앱으로 통합하여 관리합니다.

**배경:**
- `_sample` 프로젝트로 새 앱을 만드는 것도 귀찮은 경우가 많음
- 작은 도구마다 별도 프로젝트를 만들면 `package.json`, 설정 파일, CI/CD 등 중복 발생
- `wtools-old`에 이미 유용한 도구들이 있지만 현재 아키텍처와 맞지 않음

**목표:**
- 간단한 도구들을 라우트 기반으로 빠르게 추가 가능한 구조
- `tool-view`에서 개별 도구로 직접 접근 가능
- 공통 UI 컴포넌트 재사용

---

## 구현 항목

| 우선순위 | 항목 | 설명 | 상태 |
|:-------:|------|------|:------:|
| P0 | 프로젝트 생성 | `_sample/sveltekit-supabase` 기반 mini-toolbox 생성 | ✅ |
| P0 | 홈페이지 구성 | 404 처리 (홈페이지 제거) | ✅ |
| P1 | html-to-md 이식 | `wtools-old`에서 HTML→Markdown 변환기 이식 | ✅ |
| P2 | tool-view 연동 | FEATURED_TOOLS에 html-to-md 추가 | ✅ |
| P2 | 배포 | Cloudflare Pages, 도메인 연결 | ⏸️ |

---

## 완료된 작업

- [x] 프로젝트 생성 및 설정
- [x] html-to-md 변환 로직 이식
- [x] Svelte 5 runes로 마이그레이션
- [x] 간소화된 UI 구현
- [x] 빌드 성공 확인
- [x] tool-view 연동

---

*상태: P0-P1 완료 / P2 배포 대기*
