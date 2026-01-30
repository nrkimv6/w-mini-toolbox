/**
 * 자동 감지 시스템 테스트
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { analyzeClipboardTypes, getPossibleInputMethods } from '../clipboardTypeAnalyzer';
import { matchHtmlPatterns, getBestHtmlMatch } from '../htmlPatternMatcher';  
import { matchTextPatterns, getBestTextMatch } from '../textPatternMatcher';
import { detectInputSource, quickDetect } from '../autoDetectionEngine';
import { getOptimalRuleAuto, getOptimalRuleManual } from '../autoConversionMatrix';

// 모의 DataTransfer 클래스
class MockDataTransfer implements DataTransfer {
  private data: Map<string, string> = new Map();
  public types: string[] = [];
  public dropEffect: 'none' | 'copy' | 'link' | 'move' = 'none';
  public effectAllowed: 'none' | 'copy' | 'copyLink' | 'copyMove' | 'link' | 'linkMove' | 'move' | 'all' | 'uninitialized' = 'uninitialized';
  public files: FileList = [] as any; // FileList 생성자 문제 해결
  public items: DataTransferItemList = {} as DataTransferItemList;

  setData(format: string, data: string): void {
    this.data.set(format, data);
    if (!this.types.includes(format)) {
      this.types.push(format);
    }
  }

  getData(format: string): string {
    return this.data.get(format) || '';
  }

  clearData(format?: string): void {
    if (format) {
      this.data.delete(format);
      this.types = this.types.filter(t => t !== format);
    } else {
      this.data.clear();
      this.types = [];
    }
  }
}

describe('ClipboardTypeAnalyzer', () => {
  test('Notion 4개 타입 정확 감지', () => {
    const clipboard = new MockDataTransfer();
    clipboard.setData('text/plain', 'test');
    clipboard.setData('text/html', '<div>test</div>');
    clipboard.setData('text/_notion-blocks-v3-production', '{}');
    clipboard.setData('text/_notion-page-source-production', '{}');

    const analysis = analyzeClipboardTypes(clipboard);

    expect(analysis.typeCount).toBe(4);
    expect(analysis.hasNotionTypes).toBe(true);
    expect(analysis.hasHtml).toBe(true);
    expect(analysis.hasText).toBe(true);
  });

  test('Gemini 2개 타입 정확 감지', () => {
    const clipboard = new MockDataTransfer();
    clipboard.setData('text/plain', 'Gemini response');
    clipboard.setData('text/html', '<chat-app>content</chat-app>');

    const analysis = analyzeClipboardTypes(clipboard);
    const possibleMethods = getPossibleInputMethods(analysis);

    expect(analysis.typeCount).toBe(2);
    expect(analysis.hasNotionTypes).toBe(false);
    expect(possibleMethods).toContain('gemini-drag');
  });

  test('1개 타입 정확 분류', () => {
    const clipboardHtml = new MockDataTransfer();
    clipboardHtml.setData('text/html', '<div class="notion-table-cell">test</div>');

    const clipboardText = new MockDataTransfer();
    clipboardText.setData('text/plain', 'plain text');

    const htmlAnalysis = analyzeClipboardTypes(clipboardHtml);
    const textAnalysis = analyzeClipboardTypes(clipboardText);

    expect(htmlAnalysis.typeCount).toBe(1);
    expect(htmlAnalysis.hasHtml).toBe(true);
    expect(htmlAnalysis.hasText).toBe(false);

    expect(textAnalysis.typeCount).toBe(1);
    expect(textAnalysis.hasHtml).toBe(false);
    expect(textAnalysis.hasText).toBe(true);
  });
});

describe('HTMLPatternMatcher', () => {
  test('Gemini HTML 패턴 정확 매칭', () => {
    const geminiHtml = `
      <chat-app ng-version="0.0.0">
        <bard-logo></bard-logo>
        <div class="mat-mdc-button">content</div>
      </chat-app>
    `;

    const results = matchHtmlPatterns(geminiHtml);
    const bestMatch = getBestHtmlMatch(geminiHtml);

    expect(results.length).toBeGreaterThan(0);
    expect(bestMatch?.source).toBe('gemini');
    expect(bestMatch?.confidence).toBeGreaterThan(0.8);
  });

  test('Notion HTML 패턴 정확 매칭', () => {
    const notionHtml = `
      <html class="notion-html">
        <div id="notion-app" data-notion-version="23.13.0">
          <div data-content-editable-leaf="true">content</div>
        </div>
      </html>
    `;

    const results = matchHtmlPatterns(notionHtml);
    const bestMatch = getBestHtmlMatch(notionHtml);

    expect(results.length).toBeGreaterThan(0);
    expect(bestMatch?.source).toBe('notion');
    expect(bestMatch?.confidence).toBeGreaterThan(0.8);
  });

  test('일반 HTML은 매칭되지 않음', () => {
    const genericHtml = '<div><p>Regular HTML content</p></div>';

    const results = matchHtmlPatterns(genericHtml);
    expect(results.length).toBe(0);
  });
});

describe('TextPatternMatcher', () => {
  test('Notion AWS S3 경로 패턴 매칭', () => {
    const notionText = `
      This is content with image:
      https://s3-us-west-2.amazonaws.com/secure.notion-static.com/abc123/image.png
      More content here.
    `;

    const results = matchTextPatterns(notionText);
    const bestMatch = getBestTextMatch(notionText);

    expect(bestMatch?.source).toBe('notion');
    expect(bestMatch?.confidence).toBeGreaterThan(0.6);
  });

  test('Gemini 특정 문자열 패턴 매칭', () => {
    const geminiText = `Gemini

    This is a response from Gemini AI assistant.
    
    **Here's what I found:**
    
    1. First point
    2. Second point
    `;

    const results = matchTextPatterns(geminiText);
    const bestMatch = getBestTextMatch(geminiText);

    expect(bestMatch?.source).toBe('gemini');
    expect(bestMatch?.confidence).toBeGreaterThan(0.5);
  });

  test('Gemini 대화 컨텍스트 매칭', () => {
    const contextText = `
      Title: Gemini와의 대화
      
      User: Hello
      AI: Hello! How can I help you?
    `;

    const bestMatch = getBestTextMatch(contextText);
    expect(bestMatch?.source).toBe('gemini');
  });

  test('일반 텍스트는 매칭되지 않음', () => {
    const genericText = 'This is just regular text without any special patterns.';

    const results = matchTextPatterns(genericText);
    expect(results.length).toBe(0);
  });
});

describe('AutoDetectionEngine 통합 테스트', () => {
  test('Notion 드래그앤드롭 전체 플로우', () => {
    const clipboard = new MockDataTransfer();
    clipboard.setData('text/plain', 'test content');
    clipboard.setData('text/html', '<html class="notion-html"><div id="notion-app">content</div></html>');
    clipboard.setData('text/_notion-blocks-v3-production', '{"blocks":[]}');
    clipboard.setData('text/_notion-page-source-production', '{"page":{}}');

    const result = detectInputSource(clipboard);

    expect(result.inputMethod).toBe('drag_drop');
    expect(result.contentSource).toBe('notion');
    expect(result.rawDetection).toBe('notion-drag');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  test('Gemini 드래그앤드롭 전체 플로우', () => {
    const clipboard = new MockDataTransfer();
    clipboard.setData('text/plain', 'Gemini response content');
    clipboard.setData('text/html', '<chat-app><bard-logo></bard-logo><div class="ng-trigger">AI response</div></chat-app>');

    const result = detectInputSource(clipboard);

    expect(result.inputMethod).toBe('drag_drop');
    expect(result.contentSource).toBe('gemini');
    expect(result.rawDetection).toBe('gemini-drag');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test('개발자도구 HTML 복사 감지', () => {
    const clipboard = new MockDataTransfer();
    clipboard.setData('text/html', '<div class="notion-table-cell-text" data-content-editable-leaf="true">cell content</div>');

    const result = detectInputSource(clipboard);

    expect(result.inputMethod).toBe('developer_copy');
    expect(result.contentSource).toBe('notion');
    expect(result.rawDetection).toBe('notion-devtools');
  });

  test('텍스트만 복사 감지', () => {
    const clipboard = new MockDataTransfer();
    clipboard.setData('text/plain', 'Content with image: https://s3-us-west-2.amazonaws.com/secure.notion-static.com/123/test.png');

    const result = detectInputSource(clipboard);

    expect(result.inputMethod).toBe('clipboard_paste');
    expect(result.contentSource).toBe('notion');
    expect(result.rawDetection).toBe('notion-text');
  });

  test('빠른 감지 기능', () => {
    const clipboard = new MockDataTransfer();
    clipboard.setData('text/plain', 'test');
    clipboard.setData('text/html', 'test');
    clipboard.setData('text/_notion-blocks-v3-production', '{}');
    clipboard.setData('text/_notion-page-source-production', '{}');

    const result = quickDetect(clipboard);

    expect(result.source).toBe('notion');
    expect(result.method).toBe('drag');
    expect(result.confidence).toBeGreaterThan(0.9);
  });
});

describe('AutoConversionMatrix 통합', () => {
  test('자동 감지를 통한 변환 규칙 결정', () => {
    const clipboard = new MockDataTransfer();
    clipboard.setData('text/plain', 'test');
    clipboard.setData('text/_notion-blocks-v3-production', '{}');
    clipboard.setData('text/_notion-page-source-production', '{}');
    clipboard.setData('text/html', '<div class="notion-html">test</div>');

    const result = getOptimalRuleAuto(clipboard);

    expect(result.rule).toBe('notion_blocks'); // drag_drop + notion = notion_blocks
    expect(result.isAutoDetected).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.description).toContain('Notion 드래그');
  });

  test('수동 선택 방식 (기존 호환성)', () => {
    const result = getOptimalRuleManual('drag_drop', 'gemini');

    expect(result.rule).toBe('gemini_rich');
    expect(result.isAutoDetected).toBe(false);
    expect(result.confidence).toBe(1.0);
    expect(result.description).toContain('Gemini 드래그');
  });

  test('잘못된 입력 처리', () => {
    const clipboard = new MockDataTransfer();
    clipboard.setData('text/plain', 'unknown content');

    const result = getOptimalRuleAuto(clipboard);

    // 감지에 실패하면 generic으로 fallback
    expect(result.rule).toBe('generic_formatted');
    expect(result.confidence).toBeLessThan(0.5);
  });
});

// 성능 테스트
describe('성능 테스트', () => {
  test('감지 속도가 10ms 이하', () => {
    const clipboard = new MockDataTransfer();
    clipboard.setData('text/plain', 'test content');
    clipboard.setData('text/html', '<chat-app><div class="mat-button">test</div></chat-app>');

    const startTime = performance.now();
    const result = detectInputSource(clipboard);
    const endTime = performance.now();

    const duration = endTime - startTime;
    expect(duration).toBeLessThan(10); // 10ms 이하
    expect(result).toBeDefined();
  });

  test('큰 HTML 문서 처리 성능', () => {
    const clipboard = new MockDataTransfer();
    const largeHtml = '<chat-app>' + 'x'.repeat(10000) + '<bard-logo></bard-logo>' + '</chat-app>';
    clipboard.setData('text/html', largeHtml);

    const startTime = performance.now();
    const result = getBestHtmlMatch(largeHtml);
    const endTime = performance.now();

    const duration = endTime - startTime;
    expect(duration).toBeLessThan(50); // 50ms 이하
    expect(result?.source).toBe('gemini');
  });
});