import type { CanvasElement, ThumbnailDesign } from './thumbnail-types';

export interface CTRRecommendation {
  id: string;
  type: 'contrast' | 'safe-zone' | 'readability' | 'composition';
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface CTRAnalysisResult {
  score: number; // 0 - 100
  recommendations: CTRRecommendation[];
}

/**
 * Extracts a hex color from a string. If the string is a gradient,
 * it parses the first hex match. Defaults to a neutral color on failure.
 */
export function extractColorStop(colorStr: string): string {
  if (!colorStr) return '#888888';
  
  const hexRegex = /#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/g;
  const matches = colorStr.match(hexRegex);
  if (matches && matches.length > 0) {
    return matches[0];
  }
  
  // If named color or standard text, default to fallback hex
  if (colorStr.toLowerCase() === 'white') return '#ffffff';
  if (colorStr.toLowerCase() === 'black') return '#000000';
  if (colorStr.toLowerCase() === 'yellow') return '#facc15';
  
  return '#888888';
}

/**
 * Calculates the YIQ luminance value of a hex color.
 */
export function getYIQLuminance(hexColor: string): number {
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * Evaluates the CTR score and list of design recommendations for a thumbnail composition.
 */
export function analyzeThumbnailCTR(design: ThumbnailDesign): CTRAnalysisResult {
  const recommendations: CTRRecommendation[] = [];
  
  // Base configuration score
  let score = 90;
  
  const textElements = design.elements.filter(el => el.type === 'text');
  const imageElements = design.elements.filter(el => el.type === 'image');
  const arrowElements = design.elements.filter(el => el.type === 'arrow');

  // Rule 1: Safe Zone Collision Check (YouTube timestamp overlay at bottom-right corner)
  let safeZoneViolationCount = 0;
  design.elements.forEach(el => {
    if (el.isHidden) return;
    const overlapsX = el.x + el.width > 80;
    const overlapsY = el.y + el.height > 75;
    if (overlapsX && overlapsY) {
      safeZoneViolationCount++;
    }
  });

  if (safeZoneViolationCount > 0) {
    score -= 20;
    recommendations.push({
      id: 'violation-safe-zone',
      type: 'safe-zone',
      severity: 'high',
      message: 'Timestamp Overlap: Shift text/subject left of the bottom-right corner (x > 80%, y > 75%).',
    });
  }

  // Rule 2: Title & Background YIQ Contrast Check
  if (textElements.length > 0) {
    const bgHex = extractColorStop(design.backgroundColor);
    const bgLuminance = getYIQLuminance(bgHex);
    
    let lowContrastCount = 0;
    textElements.forEach(txt => {
      if (txt.isHidden) return;
      const textHex = extractColorStop(txt.fill || '#ffffff');
      const textLuminance = getYIQLuminance(textHex);
      
      const luminanceDifference = Math.abs(textLuminance - bgLuminance);
      // High readability corresponds to difference > 125 YIQ
      if (luminanceDifference < 125 && (!txt.textStrokeWidth || txt.textStrokeWidth < 3)) {
        lowContrastCount++;
      }
    });

    if (lowContrastCount > 0) {
      score -= 15;
      recommendations.push({
        id: 'violation-low-contrast',
        type: 'contrast',
        severity: 'high',
        message: 'Low Readability: Add a black outline stroke or choose a higher contrast color against background.',
      });
    }
  } else {
    score -= 10;
    recommendations.push({
      id: 'warning-no-text',
      type: 'readability',
      severity: 'medium',
      message: 'No Headline Text: Include a punchy, 2-4 word title hook to establish curiosity.',
    });
  }

  // Rule 3: Mobile readability (font size threshold check)
  let tinyTextCount = 0;
  textElements.forEach(txt => {
    if (txt.isHidden) return;
    if (txt.fontSize && txt.fontSize < 24) {
      tinyTextCount++;
    }
  });

  if (tinyTextCount > 0) {
    score -= 10;
    recommendations.push({
      id: 'violation-tiny-text',
      type: 'readability',
      severity: 'medium',
      message: 'Mobile Font Size: Size headline text above 24px so it scales clearly on mobile screens.',
    });
  }

  // Rule 4: Focal Subject & Composition
  if (imageElements.length === 0) {
    score -= 10;
    recommendations.push({
      id: 'warning-no-subject',
      type: 'composition',
      severity: 'medium',
      message: 'No Focal Face/Object: Add a subject image to make the design feel human and alive.',
    });
  } else {
    // Check if image outlines pop
    const unoutlinedImages = imageElements.filter(img => !img.imageOutlineWidth || img.imageOutlineWidth === 0);
    if (unoutlinedImages.length > 0) {
      score -= 5;
      recommendations.push({
        id: 'suggestion-outline-glow',
        type: 'composition',
        severity: 'low',
        message: 'Outline Accent: Add a bright outline stroke/glow to your subject image layer to pop out.',
      });
    }
  }

  // Rule 5: Directional Guides (Arrow focal points)
  if (arrowElements.length === 0 && imageElements.length > 0) {
    recommendations.push({
      id: 'suggestion-arrow-directive',
      type: 'composition',
      severity: 'low',
      message: 'Directional Guide: Add an arrow pointing to the subject focus element.',
    });
  }

  // Bound score strictly between 10 and 100
  const finalScore = Math.max(10, Math.min(100, score));

  return {
    score: finalScore,
    recommendations,
  };
}
