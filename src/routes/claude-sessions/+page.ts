// 이 페이지는 브라우저 File API(`FileReader`/`File.text()`, 드래그앤드롭)에만
// 의존하고 서버가 내려줄 데이터가 없다. 빈 셸을 프리렌더링해 얻는 이득보다
// `document`/`FileReader` 접근이 애초에 서버 렌더 시점에 존재하지 않는다는
// 사실이 더 크다 — 기존 `/transcript` 라우트(같은 이유로 `ssr = false`)와
// 동일한 근거다.
export const ssr = false;
