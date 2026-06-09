# GCS Screenshot Export 정책

> 대상 프로젝트: w-mini-toolbox  
> 작성일: 2026-06-09  
> 관련 계획서: [todo-12](./2026-06-08_public_gcp_free_tier_roadmap_todo-12.md)

---

## 1. 기본 원칙: opt-in, local-only 기본값

- GCS export는 **opt-in** 기능이다. 기본 동작은 **local-only**다.
- 사용자가 명시적으로 "클라우드에 저장" 버튼/옵션을 선택할 때만 GCS 업로드가 발생한다.
- 환경 변수 `ENABLE_GCS_EXPORT` 기본값은 **`false`**다.
  - `false`(기본): GCS 업로드 UI/로직 비활성화, 생성 객체 0개, 과금 0.
  - `true`(명시 opt-in): GCS export UI 및 서버 서명 endpoint 활성화.
- `ENABLE_GCS_EXPORT=false` 상태에서는 클라이언트 코드 및 UI 모두 GCS 관련 경로를 노출하지 않는다.

---

## 2. Export 진입점 후보

`src/routes/screenshot/+page.svelte` 분석 결과:

### 현재 존재하는 다운로드 진입점

| 함수/핸들러 | 트리거 | 설명 |
|---|---|---|
| `handleDownloadAll()` | `<DownloadButton>` onDownload 이벤트 | 모든 이미지를 html2canvas로 렌더링 → ZIP 다운로드 + `historyPanel.addToHistory()` 호출 |
| `handleDownloadSingle(id)` | `<PreviewArea>` onDownloadSingle 이벤트 | 단일 이미지 렌더링 → PNG 다운로드 + `historyPanel.addToHistory()` 호출 |

### GCS export 진입점 후보

두 함수 모두 `canvas.toBlob()` 또는 `canvas.toDataURL()`로 PNG 데이터를 생성하는 시점에 GCS upload 분기를 삽입할 수 있다.

| 후보 위치 | 방식 | 비고 |
|---|---|---|
| `handleDownloadAll()` — ZIP 생성 직전 | 배치 export: 각 blob을 서버 서명 endpoint로 전송 | ZIP 내 파일과 동일 세트가 GCS에 업로드됨 |
| `handleDownloadSingle(id)` — download 직전 | 단건 export: dataUrl을 서버 endpoint로 전송 | 개별 이미지 export 흐름 |
| `<HistoryPanel>` 내 명시적 "export" 버튼 | history에 저장된 항목 중 선택적으로 export | 가장 사용자 친화적 opt-in 흐름 (권장) |

**권장 진입점**: `<HistoryPanel>` 내에 "클라우드 저장" 버튼을 추가하는 방식.  
이유: history에 이미 저장된 thumbnail 단위로 사용자가 선택적으로 export할 수 있어 opt-in 원칙에 가장 잘 부합한다.

---

## 3. local imageHistory vs cloud export 대상 차이

`src/lib/tools/screenshot/stores/imageHistory.ts` 분석 결과:

### local imageHistory 특성

| 항목 | 값/설명 |
|---|---|
| 저장소 | `localStorage` (browser 전용, `STORAGE_KEY = 'screenshot-image-history'`) |
| 최대 항목 수 | `MAX_HISTORY = 10` |
| 저장 데이터 | thumbnail (200px 이하, JPEG 0.7 품질) + 메타데이터 (`id`, `fileName`, `originalWidth`, `originalHeight`, `createdAt`) |
| 원본 이미지 | **저장하지 않음** — thumbnail만 저장 |
| 수명 | 브라우저 localStorage 유지 기간 (세션 초과 지속, 사용자 수동 삭제 전까지) |
| 서버 전송 | 없음 — 완전 client-side |

### cloud export 대상이 달라야 하는 이유

| 항목 | local imageHistory | cloud export 대상 |
|---|---|---|
| 데이터 | 200px thumbnail (lossy JPEG) | 원본 해상도 PNG (`canvas.toDataURL('image/png')` 또는 `canvas.toBlob`) |
| 저장 시점 | 다운로드 직후 자동 저장 | 사용자 명시 선택 후 저장 |
| 보존 기간 | 브라우저에 따라 다름 | 정책에 따른 retention 기간 (아래 §4 참조) |
| 공개 여부 | client-local, 외부 비공개 | signed URL (시간 제한) 발급, bucket은 공개 금지 |
| 삭제 주체 | 사용자 (브라우저 내) | 서버 retention 정책 또는 사용자 요청 |

**핵심**: local history는 preview/재사용 목적의 저해상도 thumbnail이고, cloud export는 원본 해상도 PNG를 대상으로 한다. 두 경로는 독립적으로 관리되어야 한다.

---

## 4. Signed URL, Retention, Bucket 공개 금지 기준

### Signed URL 발급

- **client-only 구조에서는 GCS export 불가**: GCS service account 키를 클라이언트에 노출하면 안 되므로, signed URL 생성은 반드시 **server-side proxy endpoint**를 통해야 한다.
- 서명 endpoint 예시: `POST /api/gcs/sign-upload` — 서버가 서비스 계정으로 signed URL을 발급하고 클라이언트는 해당 URL로 PUT 업로드.
- `ENABLE_GCS_EXPORT=false`이면 이 endpoint 자체를 등록하지 않는다 (route 비활성화).

### Retention 정책

| 사용 사례 | 권장 retention | 비고 |
|---|---|---|
| 임시 공유 (링크 전달) | 7일 | signed URL 만료와 일치 |
| 개인 보관 | 30일 | 사용자 계정 연동 시 |
| 기본값 (로그인 없음) | 1일 ~ 7일 | 무인증 export는 짧게 유지 |

- GCS Object Lifecycle rule로 `age` 조건을 설정해 자동 삭제.
- retention 초과 객체는 서버에서도 참조 제거.

### Bucket 공개 금지 기준

- bucket `allUsers` / `allAuthenticatedUsers` IAM 바인딩 금지.
- 모든 접근은 signed URL(V4, 최대 7일 만료) 또는 서비스 계정 impersonation으로만 허용.
- `uniform bucket-level access` 활성화 — object-level ACL 금지.
- Public Access Prevention: `enforced` 설정 권장.

---

## 5. 과금 경계 및 경고

### GCP Free Tier 범위 (Cloud Storage)

| 항목 | 무료 한도 |
|---|---|
| 스토리지 (US 멀티리전) | 월 5 GB |
| 다운로드 (인터넷) | 월 1 GB |
| 클래스 A 작업 (PUT, POST) | 월 5,000건 |
| 클래스 B 작업 (GET) | 월 50,000건 |

### 과금 발생 조건 (경고)

> **⚠️ 아래 조건 중 하나라도 해당하면 즉시 과금이 발생한다.**

1. **non-US 리전**: `asia-northeast3`(서울) 등 US 외 리전 bucket 사용 시 스토리지·전송 모두 무료 한도 적용 안 됨.
2. **5 GB 초과**: US 멀티리전이라도 월 5 GB 초과 시 스토리지 과금.
3. **다운로드 1 GB 초과**: signed URL을 통한 외부 다운로드 합산 1 GB 초과 시 egress 과금.
4. **`ENABLE_GCS_EXPORT=true` 설정 시**: 개발 환경에서도 실제 GCS 버킷을 사용하면 과금 발생 가능. 개발 시 에뮬레이터(`fake-gcs-server`) 사용 권장.

### 안전 운영 기준

- bucket 리전: `us-central1` 또는 `us-east1` (US 단일 리전, 무료 한도 포함).
- 객체 크기: PNG mockup 1장 약 0.5~2 MB 기준, 월 2,500~10,000장 업로드 시 5 GB 도달 가능.
- 모니터링: Cloud Monitoring으로 스토리지 사용량 알람 설정 (임계값: 4 GB).

---

## 6. 구현 의존성 요약

| 의존성 | 상태 | 비고 |
|---|---|---|
| `ENABLE_GCS_EXPORT` 환경 변수 | 미구현 (기본 `false`) | SvelteKit `$env/static/public` 또는 서버 env |
| server-side signed URL endpoint | 미구현 | SvelteKit server route (`+server.ts`) 필요 |
| GCS bucket 및 service account | 미생성 | opt-in 활성화 시 프로비저닝 |
| GCS Object Lifecycle rule | 미설정 | bucket 생성 시 동시 설정 |
| HistoryPanel "클라우드 저장" 버튼 | 미구현 | `ENABLE_GCS_EXPORT=true`일 때만 렌더링 |

현재 client-only 구조에서는 서명 backend 없이 GCS export를 활성화할 수 없다.  
`ENABLE_GCS_EXPORT=false` 기본값 유지가 곧 **과금 0 보장**이다.
