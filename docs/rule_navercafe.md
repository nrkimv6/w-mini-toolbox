# 네이버카페

파싱방법:

### 📝 핵심 메타 데이터 추출

| 추출 항목 | CSS 선택자 (Selector) | 마크다운 매핑 추천 |
| --- | --- | --- |
| **글 제목** | `h3.title_text` | `# {text}` (또는 YAML Frontmatter `title:`) |
| **작성자** | `.WriterInfo .nick_box .nickname` | `**작성자:** {text}` (또는 YAML `author:`) |
| **작성일** | `.WriterInfo .article_info .date` | `**작성일:** {text}` (또는 YAML `date:`) |
| **조회수** | `.WriterInfo .article_info .count` | `**조회수:** {text}` |
| **태그** | `.ArticleTagList .tag_link` | `{text}` (옵시디언 네이티브 태그 활용) |

---

### 📖 본문 콘텐츠 추출

본문은 스마트에디터(SmartEditor) 구조로 되어 있어 텍스트와 이미지를 분리해서 파싱하는 것이 좋습니다.

| 추출 항목 | CSS 선택자 (Selector) | 마크다운 매핑 추천 |
| --- | --- | --- |
| **본문 컨테이너** | `.se-main-container` | 내부 요소를 순회하며 파싱하기 위한 최상위 부모 |
| **본문 텍스트** | `.se-text-paragraph span` | 일반 텍스트 (줄바꿈 반영) |
| **본문 이미지** | `img.se-image-resource` | `![image]({src 속성 추출})` |
| **외부 링크(OG태그)** | `.se-oglink-info` | `[{.se-oglink-title의 텍스트}]({href 속성 추출})` |

---

### 💬 댓글 영역 추출 (선택 사항)

컬럼의 반응도 함께 아카이빙하고 싶으시다면 아래 규칙을 활용하세요.

| 추출 항목 | CSS 선택자 (Selector) | 마크다운 매핑 추천 |
| --- | --- | --- |
| **댓글 컨테이너** | `.comment_list .CommentItem` | 각 댓글 블록을 순회하기 위한 부모 |
| **댓글 작성자** | `.comment_nickname` | `> **{text}**:` (인용구 스타일 추천) |
| **댓글 내용** | `.text_comment` | `> {text}` |
| **댓글 작성일** | `.comment_info_date` | `> *{text}*` |

---

**💡 파싱 팁:** 본문 내용을 파싱할 때 `.se-main-container` 안의 자식 요소들을 순차적으로 탐색(Tree Traversal)하면서, 해당 태그가 텍스트(`p` 또는 `span`)인지 이미지(`img`)인지 식별하여 마크다운으로 조합해야 글의 원래 순서가 훼손되지 않습니다.
