import { describe, it, expect } from 'vitest';
import { detectContentSource } from '../contentSourceDetector.js';
import { convertHtmlToMarkdown, setSourceRule, setOutputRule } from '../../converter/converter.js';
import { applyOutputRule } from '../../converter/outputProcessor.js';

describe('Naver Cafe HTML Parsing', () => {
    const mockHtml = `
		<div class="se-viewer">
			<h3 class="title_text">네이버 카페 게시글 제목</h3>
			<div class="WriterInfo">
				<div class="nick_box"><div class="nickname">홍길동</div></div>
				<div class="article_info">
					<span class="date">2023.05.20. 14:30</span>
					<span class="count">조회 1,234</span>
				</div>
			</div>
			
			<div class="se-main-container">
				<div class="se-component se-text">
					<div class="se-text-paragraph"><span>일반 텍스트 1번째 단락</span></div>
					<div class="se-text-paragraph"></div> <!-- 빈 단락 -->
					<div class="se-text-paragraph"><span>일반 텍스트 2번째 단락 </span><strong>굵은 글씨</strong></div>
				</div>
				<div class="se-component se-image">
					<img class="se-image-resource" src="https://example.com/image1.jpg">
				</div>
				<div class="se-component se-text">
					<div class="se-quote">
						<div class="se-text-paragraph"><span>인용구입니다.</span></div>
					</div>
				</div>
				<div class="se-component se-text">
					<h2><div class="se-text-paragraph"><span>헤딩 텍스트입니다.</span></div></h2>
				</div>
				<div class="se-component se-oglink">
					<a href="https://naver.com">
						<div class="se-oglink-title">네이버 메인</div>
					</a>
				</div>
			</div>
			
			<div class="ArticleTagList">
				<a class="tag_link">#정보</a>
				<a class="tag_link">#네이버</a>
			</div>
			
			<ul class="comment_list">
				<li class="CommentItem">
					<span class="comment_nickname">김댓글</span>
					<span class="text_comment">좋은 정보 감사합니다!</span>
					<span class="comment_info_date">2023.05.20. 15:00</span>
				</li>
				<li class="CommentItem CommentItem--reply">
					<span class="comment_nickname">홍길동</span>
					<span class="text_comment">감사합니다</span>
					<span class="comment_info_date">2023.05.20. 15:10</span>
				</li>
			</ul>
		</div>
	`;

    it('should detect Naver Cafe content source', () => {
        const result = detectContentSource(mockHtml);
        expect(result.source).toBe('naver_cafe');
        expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should convert Naver Cafe HTML to markdown correctly', () => {
        setSourceRule('naver_cafe');
        setOutputRule('naver_cafe');

        let markdown = convertHtmlToMarkdown(mockHtml);
        markdown = applyOutputRule(markdown, 'naver_cafe');

        // 메타데이터 검증
        expect(markdown).toContain('# 네이버 카페 게시글 제목');
        expect(markdown).toContain('**작성자:** 홍길동');
        expect(markdown).toContain('**작성일:** 2023.05.20. 14:30');
        expect(markdown).toContain('**조회수:** 1,234');
        expect(markdown).toContain('#정보 #네이버');

        // 본문 검증
        expect(markdown).toContain('일반 텍스트 1번째 단락');
        expect(markdown).toContain('일반 텍스트 2번째 단락 **굵은 글씨**');
        expect(markdown).toContain('![image](https://example.com/image1.jpg)');
        expect(markdown).toContain('> 인용구입니다.');
        expect(markdown).toContain('## 헤딩 텍스트입니다.');
        expect(markdown).toContain('[네이버 메인](https://naver.com)');

        // 댓글 검증
        expect(markdown).toContain('### 💬 댓글');
        expect(markdown).toContain('> **김댓글**:');
        expect(markdown).toContain('> 좋은 정보 감사합니다!');
        expect(markdown).toContain('> *2023.05.20. 15:00*');

        // 대댓글 검증
        expect(markdown).toContain('> > **홍길동**:');
        expect(markdown).toContain('> > 감사합니다');
        expect(markdown).toContain('> > *2023.05.20. 15:10*');
    });
});
