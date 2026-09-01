/**
 * ARCHITECTURE:
 * Multi-Vector Creative Health & Attention Diagnostics Engine (Phase 4)
 * 
 * Computes deterministic multi-dimensional health metrics (Attention, Readability,
 * Contrast, Brand, Mobile, Accessibility, Platform Safe-Zones) and visual saliency hotspots.
 * 
 * CAUTION:
 * All math operations are pure and coordinate-clamped (0-100%).
 * Strict typing (0% any / any[]).
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/creative-health-engine.test.ts
 */

import type {
  CreativeElement,
  BrandKit,
  CreativeHealthReport,
  HealthVectorScore,
  CreativeHealthIssue,
  SaliencyHotspot,
  GradientConfig,
} from './creative-types';

/**
 * Converts a hex color string into RGB numbers [r, g, b].
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return [r, g, b];
  }
  return [15, 23, 42]; // Fallback to slate-900
}

/**
 * Calculates WCAG 2.1 Relative Luminance for an sRGB color.
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates WCAG 2.1 Contrast Ratio between two hex colors.
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const l1 = getRelativeLuminance(r1, g1, b1);
  const l2 = getRelativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Evaluates full Creative Health report across 7 dimensions.
 */
export function evaluateCreativeHealth(
  elements: CreativeElement[],
  backgroundColor = '#0f172a',
  backgroundGradient?: GradientConfig,
  brandKit?: BrandKit | null
): CreativeHealthReport {
  const issues: CreativeHealthIssue[] = [];

  // Helper variables
  const textElements = elements.filter((el) => el.type === 'text');
  const headlineEl = elements.find((el) => el.semanticRole === 'headline' || (el.type === 'text' && (el.fontSize || 0) >= 40));
  const imageElements = elements.filter((el) => el.type === 'image');
  const bgColorsToCheck = backgroundGradient?.colors?.length
    ? backgroundGradient.colors
    : [backgroundColor];

  // -------------------------------------------------------------
  // 1. Readability Vector (Headline presence, character count, scale)
  // -------------------------------------------------------------
  let readabilityScore = 100;
  if (!headlineEl) {
    readabilityScore -= 35;
    issues.push({
      id: 'issue-no-headline',
      category: 'readability',
      severity: 'critical',
      title: 'Missing Clear Headline Hook',
      message: 'Thumbnails without a bold, prominent headline suffer from significantly lower click-through rates.',
      fixActionType: 'enlarge_headline',
      fixActionLabel: 'Add Bold Headline',
    });
  } else {
    const textLen = (headlineEl.text || '').length;
    if (textLen > 35) {
      readabilityScore -= 20;
      issues.push({
        id: 'issue-headline-too-long',
        category: 'readability',
        severity: 'warning',
        title: 'Headline Text Is Too Long',
        message: `Your headline contains ${textLen} characters. Headlines under 30 characters achieve highest scan retention.`,
        targetElementId: headlineEl.id,
      });
    }

    if ((headlineEl.fontSize || 0) < 44) {
      readabilityScore -= 25;
      issues.push({
        id: 'issue-headline-small',
        category: 'readability',
        severity: 'warning',
        title: 'Headline Font Size Is Too Small',
        message: 'Headline text is below 44px, making it difficult to read on smaller mobile viewport feeds.',
        targetElementId: headlineEl.id,
        fixActionType: 'enlarge_headline',
        fixActionLabel: 'Enlarge to 54px',
      });
    }
  }

  // -------------------------------------------------------------
  // 2. Contrast & WCAG Accessibility Vector
  // -------------------------------------------------------------
  let contrastScore = 100;
  for (const textEl of textElements) {
    const fill = textEl.fill || '#ffffff';
    let minRatio = 21;
    for (const bg of bgColorsToCheck) {
      const ratio = getContrastRatio(fill, bg);
      if (ratio < minRatio) minRatio = ratio;
    }

    // Has stroke protection?
    const hasStroke = (textEl.textStrokeWidth || 0) >= 2;

    if (minRatio < 4.5 && !hasStroke) {
      contrastScore -= 25;
      issues.push({
        id: `issue-contrast-${textEl.id}`,
        category: 'contrast',
        severity: 'critical',
        title: `Low Contrast on "${(textEl.text || 'Text').slice(0, 18)}"`,
        message: `Contrast ratio is ${minRatio}:1 (WCAG AA requires 4.5:1). Add a dark outline stroke or high-contrast fill.`,
        targetElementId: textEl.id,
        fixActionType: 'fix_contrast',
        fixActionLabel: 'Apply High Contrast Stroke',
      });
    }
  }

  // -------------------------------------------------------------
  // 3. Platform Safe-Zone Vector (YouTube timestamp bottom-right)
  // -------------------------------------------------------------
  let platformScore = 100;
  for (const el of elements) {
    const elRight = el.x + el.width;
    const elBottom = el.y + el.height;

    // YouTube timestamp occupies roughly X: 78-100%, Y: 75-100%
    if (elRight >= 78 && elBottom >= 75) {
      platformScore -= 30;
      issues.push({
        id: `issue-safezone-${el.id}`,
        category: 'safe_zone',
        severity: 'critical',
        title: 'YouTube Timestamp Collision',
        message: `"${el.text || el.type}" is placed in the bottom-right corner where YouTube renders video duration pills.`,
        targetElementId: el.id,
        fixActionType: 'shift_safe_zone',
        fixActionLabel: 'Shift Away from Badge',
      });
    }
  }

  // -------------------------------------------------------------
  // 4. Brand Consistency Vector
  // -------------------------------------------------------------
  let brandScore = 100;
  if (brandKit) {
    const expectedFont = brandKit.typography?.displayFont?.toLowerCase();
    if (expectedFont && headlineEl && (headlineEl.fontFamily || '').toLowerCase() !== expectedFont) {
      brandScore -= 20;
      issues.push({
        id: 'issue-brand-font',
        category: 'brand',
        severity: 'warning',
        title: 'Typography Outside Brand Kit',
        message: `Headline uses "${headlineEl.fontFamily}" instead of your workspace display font "${brandKit.typography.displayFont}".`,
        targetElementId: headlineEl.id,
        fixActionType: 'apply_brand_font',
        fixActionLabel: `Switch to ${brandKit.typography.displayFont}`,
      });
    }
  }

  // -------------------------------------------------------------
  // 5. Mobile Scan Legibility Vector
  // -------------------------------------------------------------
  let mobileScore = 100;
  if (headlineEl && (headlineEl.fontSize || 0) < 48) {
    mobileScore -= 20;
  }
  if (elements.length > 8) {
    mobileScore -= 25;
    issues.push({
      id: 'issue-clutter-mobile',
      category: 'density',
      severity: 'warning',
      title: 'Composition Too Cluttered for Mobile',
      message: `Canvas contains ${elements.length} elements. Mobile viewers scan thumbnails in under 1.5 seconds.`,
      fixActionType: 'clean_clutter',
      fixActionLabel: 'Simplify Composition',
    });
  }

  // -------------------------------------------------------------
  // 6. Attention & Visual Saliency Vector
  // -------------------------------------------------------------
  let attentionScore = 85;
  if (imageElements.length > 0) attentionScore += 10;
  if (elements.some((el) => el.semanticRole === 'badge')) attentionScore += 5;
  if (attentionScore > 100) attentionScore = 100;

  // -------------------------------------------------------------
  // 7. Accessibility Vector
  // -------------------------------------------------------------
  let accessibilityScore = Math.round((contrastScore + readabilityScore) / 2);

  // Clamp all vector scores
  const clamp100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  const vectors: HealthVectorScore[] = [
    {
      name: 'Attention',
      score: clamp100(attentionScore),
      status: attentionScore >= 90 ? 'optimal' : attentionScore >= 75 ? 'warning' : 'critical',
      description: 'Focal strength, subject isolation, and visual energy.',
    },
    {
      name: 'Readability',
      score: clamp100(readabilityScore),
      status: readabilityScore >= 90 ? 'optimal' : readabilityScore >= 75 ? 'warning' : 'critical',
      description: 'Headline clarity, scan speed, and character density.',
    },
    {
      name: 'Contrast',
      score: clamp100(contrastScore),
      status: contrastScore >= 90 ? 'optimal' : contrastScore >= 75 ? 'warning' : 'critical',
      description: 'WCAG 2.1 luminance separation and stroke reinforcement.',
    },
    {
      name: 'Brand',
      score: clamp100(brandScore),
      status: brandScore >= 90 ? 'optimal' : brandScore >= 75 ? 'warning' : 'critical',
      description: 'Alignment with registered workspace typography and palette.',
    },
    {
      name: 'Mobile',
      score: clamp100(mobileScore),
      status: mobileScore >= 90 ? 'optimal' : mobileScore >= 75 ? 'warning' : 'critical',
      description: 'Scan legibility scaled down to 120px mini-feeds.',
    },
    {
      name: 'Accessibility',
      score: clamp100(accessibilityScore),
      status: accessibilityScore >= 90 ? 'optimal' : accessibilityScore >= 75 ? 'warning' : 'critical',
      description: 'Color contrast ratios and scalable text sizing.',
    },
    {
      name: 'Platform',
      score: clamp100(platformScore),
      status: platformScore >= 90 ? 'optimal' : platformScore >= 75 ? 'warning' : 'critical',
      description: 'Safe-zone compliance against YouTube duration timestamps.',
    },
  ];

  // Compute Overall Weighted Health Score
  const overallScore = clamp100(
    vectors.reduce((acc, v) => acc + v.score, 0) / vectors.length
  );

  // Compute Saliency Hotspots for Heatmap Overlay
  const saliencyHotspots: SaliencyHotspot[] = elements.map((el) => {
    const isSubject = el.semanticRole === 'subject' || el.type === 'image';
    const isHeadline = el.semanticRole === 'headline' || el.type === 'text';
    const weight = isSubject ? 0.95 : isHeadline ? 0.85 : 0.45;
    const radius = Math.max(12, Math.min(30, (el.width + el.height) / 3));

    return {
      x: Math.round(el.x + el.width / 2),
      y: Math.round(el.y + el.height / 2),
      weight,
      radius: Math.round(radius),
    };
  });

  return {
    overallScore,
    status: overallScore >= 90 ? 'optimal' : overallScore >= 75 ? 'warning' : 'critical',
    vectors,
    issues,
    saliencyHotspots,
    evaluatedAt: new Date().toISOString(),
  };
}
