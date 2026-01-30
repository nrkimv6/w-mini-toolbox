import { detectInputMethod, type InputMethodResult } from './inputMethodDetector.js';
import { detectContentSource, type ContentSourceResult } from './contentSourceDetector.js';
import { getOptimalRule as getOptimalSourceType } from './conversionRuleMatrix.js';

export interface EnhancedDetectionResult {
  inputMethod: InputMethodResult;
  contentSource: ContentSourceResult;
  recommendedRule: string;
  ruleConfidence: number;
  overallConfidence: number;
  metadata: {
    processingTime: number;
  };
}

export function performEnhancedDetection(
  clipboardData: Record<string, string>, 
  htmlContent: string
): EnhancedDetectionResult {
  const startTime = performance.now();
  
  console.log('[Enhanced Detection] 분석 시작:', {
    clipboardDataKeys: Object.keys(clipboardData),
    htmlContentLength: htmlContent?.length || 0,
    htmlPreview: htmlContent?.substring(0, 100) || 'N/A'
  });
  
  // 텍스트 콘텐츠도 함께 로깅
  const textContent = clipboardData['text/plain'] || '';
  console.log('[Enhanced Detection] 텍스트 콘텐츠:', {
    textLength: textContent.length,
    textPreview: textContent.substring(0, 200)
  });
  
  // Tier 1: Input Method Detection
  const inputMethod = detectInputMethod(clipboardData);
  console.log('[Enhanced Detection] 입력 방법 감지 결과:', inputMethod);
  
  // Tier 2: Content Source Detection - 텍스트 콘텐츠도 함께 전달
  const contentSource = detectContentSource(htmlContent, textContent);
  console.log('[Enhanced Detection] 콘텐츠 소스 감지 결과:', contentSource);
  
  // Tier 3: Conversion Rule Matrix
  const dectedSourceType = getOptimalSourceType(inputMethod.method, contentSource.source);
  console.log('[Enhanced Detection] 감지된 입력 타입:', dectedSourceType);
  
  // 규칙 신뢰도 계산 (입력 방법과 콘텐츠 소스 신뢰도의 조합)
  const ruleConfidence = (inputMethod.confidence + contentSource.confidence) / 2;
  
  // 전체 신뢰도 계산
  const overallConfidence = Math.min(ruleConfidence * 0.9, 1.0); // 약간의 보정
  
  const endTime = performance.now();
  
  const result = {
    inputMethod,
    contentSource,
    recommendedRule: dectedSourceType,
    ruleConfidence,
    overallConfidence,
    metadata: {
      processingTime: endTime - startTime
    }
  };
  
  console.log('[Enhanced Detection] 최종 결과:', result);
  
  return result;
}

export function getDetectionSummary(result: EnhancedDetectionResult): string {
  const { inputMethod, contentSource, recommendedRule, overallConfidence } = result;
  
  // 입력 방법 이름 매핑
  const methodName = inputMethod.method === 'drag_drop' ? '드래그' : 
                     inputMethod.method === 'developer_copy' ? '개발자도구' :
                     inputMethod.method === 'desktop_app_drag' ? '데스크톱앱' : 
                     inputMethod.method === 'clipboard_paste' ? '복사' : '일반';
  
  // 소스 이름 매핑 (아이콘 포함)
  const sourceName = contentSource.source === 'gemini' ? '🤖 Gemini' :
                     contentSource.source === 'notion' ? '📝 Notion' :
                     contentSource.source === 'claude' ? '🤖 Claude' :
                     contentSource.source === 'chatgpt' ? '💬 ChatGPT' :
                     contentSource.source === 'recipe_site' ? '🍳 레시피' :
                     contentSource.source === 'blog' ? '📰 블로그' :
                     contentSource.source === 'documentation' ? '📚 문서' : '🌐 일반';
  
  const confidence = Math.round(overallConfidence * 100);
  console.log('confidence', confidence, sourceName, methodName);
  
  // 신뢰도에 따라 다른 표시 형식 사용
  if (confidence >= 80) {
    return `${sourceName} (${methodName})`;
  } else if (confidence >= 60) {
    return `${sourceName} (${methodName}, ${confidence}%)`;
  } else {
    return `추정: ${sourceName} (${confidence}%)`;
  }
}