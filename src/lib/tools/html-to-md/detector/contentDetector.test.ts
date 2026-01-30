/**
 * Unit Tests for Content Detection Engine
 */

import { describe, it, expect } from 'vitest';
import {
	detectContentType,
	detectGemini,
	detectNotion,
	getRuleDisplayName,
	benchmarkDetection,
	type DetectionResult
} from './contentDetector.js';

describe('Content Detection Engine', () => {
	describe('Gemini Detection', () => {
		it('should detect Gemini with chat-app tag (high confidence)', () => {
			const html = '<chat-app class="main-container"><div>Some content</div></chat-app>';
			const result = detectGemini(html);
			
			expect(result.rule).toBe('gemini');
			expect(result.confidence).toBeGreaterThan(0.3);
			expect(result.patterns).toContain('chat-app-tag');
		});

		it('should detect Gemini with bard components (high confidence)', () => {
			const html = '<bard-logo>Gemini</bard-logo><bard-sidenav></bard-sidenav>';
			const result = detectGemini(html);
			
			expect(result.rule).toBe('gemini');
			expect(result.confidence).toBeGreaterThan(0.25);
			expect(result.patterns).toContain('bard-components');
		});

		it('should detect Gemini with test ID and text', () => {
			const html = '<div data-test-id="bard-text">Gemini can help you</div>';
			const result = detectGemini(html);
			
			expect(result.patterns).toContain('gemini-text-in-bard-test-id');
			expect(result.confidence).toBeGreaterThan(0.2);
		});

		it('should detect Gemini with sparkle resource', () => {
			const html = '<img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_1.svg">';
			const result = detectGemini(html);
			
			expect(result.patterns).toContain('gemini-sparkle-resource');
			expect(result.confidence).toBeGreaterThan(0.2);
		});

		it('should detect Angular attributes in high quantities', () => {
			const html = `
				<div _nghost-ng-c123456>
					<span _ngcontent-ng-c123456></span>
					<div _nghost-ng-c789012></div>
					<mat-button _ngcontent-ng-c123456></mat-button>
					<div ng-version="16.0.0"></div>
					<span _ngcontent-ng-c111111></span>
					<div _nghost-ng-c222222></div>
					<span _ngcontent-ng-c333333></span>
					<div _nghost-ng-c444444></div>
					<span _ngcontent-ng-c555555></span>
					<div _ngcontent-ng-c666666></div>
					<span _ngcontent-ng-c777777></span>
				</div>
			`;
			const result = detectGemini(html);
			
			expect(result.patterns).toContain('angular-attributes');
		});

		it('should not detect Gemini in plain HTML', () => {
			const html = '<div class="content"><p>Just some regular HTML content</p></div>';
			const result = detectGemini(html);
			
			expect(result.confidence).toBeLessThan(0.1);
			expect(result.patterns).toHaveLength(0);
		});
	});

	describe('Notion Detection', () => {
		it('should detect Notion with HTML class (high confidence)', () => {
			const html = '<html class="notion-html"><body class="notion-body">Content</body></html>';
			const result = detectNotion(html);
			
			expect(result.rule).toBe('notion');
			expect(result.confidence).toBeGreaterThan(0.3);
			expect(result.patterns).toContain('notion-html-class');
		});

		it('should detect Notion with version attribute', () => {
			const html = '<html data-notion-version="23.13.0.4937"><body>Content</body></html>';
			const result = detectNotion(html);
			
			expect(result.patterns).toContain('notion-version-attribute');
			expect(result.confidence).toBeGreaterThan(0.2);
		});

		it('should detect Notion app container', () => {
			const html = '<div id="notion-app"><div class="notion-app-inner">Content</div></div>';
			const result = detectNotion(html);
			
			expect(result.patterns).toContain('notion-app-container');
			expect(result.confidence).toBeGreaterThan(0.2);
		});

		it('should detect multiple notion- prefixed classes', () => {
			const html = `
				<div class="notion-table-row">
					<div class="notion-table-cell">
						<div class="notion-table-cell-text">Content</div>
					</div>
				</div>
				<div class="notion-cursor-listener">
					<div class="notion-block">
						<div class="notion-text">More content</div>
					</div>
				</div>
			`;
			const result = detectNotion(html);
			
			expect(result.patterns).toContain('notion-prefix-classes');
		});

		it('should detect content editable leaf blocks', () => {
			const html = '<div data-content-editable-leaf="true" role="textbox">Editable content</div>';
			const result = detectNotion(html);
			
			expect(result.patterns).toContain('content-editable-leaf');
		});

		it('should not detect Notion in plain HTML', () => {
			const html = '<div class="content"><p>Just some regular HTML content</p></div>';
			const result = detectNotion(html);
			
			expect(result.confidence).toBeLessThan(0.1);
			expect(result.patterns).toHaveLength(0);
		});
	});

	describe('Main Detection Function', () => {
		it('should return generic for empty input', () => {
			const result = detectContentType('');
			
			expect(result.rule).toBe('generic');
			expect(result.confidence).toBe(1.0);
			expect(result.reason).toContain('Empty or no content');
		});

		it('should prioritize Gemini over Notion', () => {
			const html = `
				<chat-app>
					<div class="notion-html">
						<div data-notion-version="1.0.0">Mixed content</div>
					</div>
				</chat-app>
			`;
			const result = detectContentType(html);
			
			expect(result.rule).toBe('gemini');
		});

		it('should detect Notion when no Gemini patterns', () => {
			const html = `
				<html class="notion-html" data-notion-version="23.13.0">
					<body class="notion-body">
						<div id="notion-app">
							<div class="notion-table-row">Content</div>
						</div>
					</body>
				</html>
			`;
			const result = detectContentType(html);
			
			expect(result.rule).toBe('notion');
		});

		it('should fallback to generic for unrecognized content', () => {
			const html = '<div class="some-blog"><article><h1>Blog Post</h1><p>Content</p></article></div>';
			const result = detectContentType(html);
			
			expect(result.rule).toBe('generic');
			expect(result.confidence).toBe(1.0);
			expect(result.reason).toContain('No specific patterns');
		});

		it('should respect confidence thresholds', () => {
			// Low confidence Gemini content (just angular attributes)
			const html = `
				<div _nghost-ng-c123>
					<span _ngcontent-ng-c456></span>
					<div _nghost-ng-c789></div>
				</div>
			`;
			const result = detectContentType(html);
			
			// Should fall back to generic due to low confidence
			expect(result.rule).toBe('generic');
		});
	});

	describe('Utility Functions', () => {
		it('should return correct display names', () => {
			// expect(getRuleDisplayName('auto')).toBe('🤖 자동 감지');
			expect(getRuleDisplayName('gemini')).toBe('🤖 Gemini');
			expect(getRuleDisplayName('notion')).toBe('📝 Notion');
			expect(getRuleDisplayName('generic')).toBe('🔧 범용 HTML');
		});

		it('should benchmark detection performance', () => {
			const html = '<chat-app><div>Test content</div></chat-app>';
			const benchmark = benchmarkDetection(html, 10);
			
			expect(benchmark.averageTime).toBeGreaterThan(0);
			expect(benchmark.result.rule).toBe('gemini');
		});
	});

	describe('Complex Real-world Cases', () => {
		it('should handle large HTML documents efficiently', () => {
			// Create a large HTML document
			let largeHtml = '<chat-app>';
			for (let i = 0; i < 1000; i++) {
				largeHtml += `<div _ngcontent-ng-c${i}><p>Content ${i}</p></div>`;
			}
			largeHtml += '</chat-app>';

			const start = performance.now();
			const result = detectContentType(largeHtml);
			const end = performance.now();

			expect(result.rule).toBe('gemini');
			expect(end - start).toBeLessThan(100); // Should complete within 100ms
		});

		it('should handle malformed HTML gracefully', () => {
			const malformedHtml = '<div><chat-app><p>Unclosed tags<div>More content</chat-app>';
			const result = detectContentType(malformedHtml);
			
			expect(result.rule).toBe('gemini'); // Should still detect despite malformation
			expect(result.confidence).toBeGreaterThan(0);
		});

		it('should detect combined patterns for higher confidence', () => {
			const complexGeminiHtml = `
				<chat-app class="side-nav-open">
					<bard-sidenav>
						<div _nghost-ng-c123456>
							<mat-button class="logo-pill-btn">
								<div data-test-id="bard-text">Gemini</div>
							</mat-button>
						</div>
					</bard-sidenav>
					<div _ngcontent-ng-c123456 class="main-content">
						<img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_1.svg">
						<div class="pill-ui-logo-container">
							<temp-chat-icon></temp-chat-icon>
						</div>
					</div>
				</chat-app>
			`;
			
			const result = detectContentType(complexGeminiHtml);
			
			expect(result.rule).toBe('gemini');
			expect(result.confidence).toBeGreaterThan(0.8); // Very high confidence
			expect(result.patterns.length).toBeGreaterThan(5); // Multiple patterns matched
		});
	});

	describe('Edge Cases', () => {
		it('should handle null and undefined input', () => {
			expect(detectContentType(null as any).rule).toBe('generic');
			expect(detectContentType(undefined as any).rule).toBe('generic');
		});

		it('should handle whitespace-only input', () => {
			const result = detectContentType('   \n\t   ');
			expect(result.rule).toBe('generic');
		});

		it('should handle very short HTML', () => {
			const result = detectContentType('<p>Hi</p>');
			expect(result.rule).toBe('generic');
		});

		it('should handle HTML with special characters', () => {
			const html = '<chat-app>Content with 特殊文字 and émojis 🚀</chat-app>';
			const result = detectContentType(html);
			expect(result.rule).toBe('gemini');
		});
	});
});