/**
 * SmartSapp Forms 2.0: Pure Utility Functions
 * 
 * Pure functions for calculations, sanitization, URL generation, embed codes,
 * and statistical significance. Zero side-effects, zero Firebase imports,
 * fully client & server compatible.
 */

import type { AutoResponderRule } from './form-notification-types';
import type { EmbedConfig, UtmParameters } from './form-distribution-types';
import type { StatisticalSignificanceResult } from './form-optimization-types';

/**
 * Standard Normal Distribution Error Function approximation for P-value calculation.
 */
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Calculates two-tailed Z-score statistical significance between Control and Challenger variants.
 */
export function calculateStatisticalSignificance(
  control: { visitors: number; submissions: number },
  challenger: { visitors: number; submissions: number }
): StatisticalSignificanceResult {
  const v1 = control.visitors || 0;
  const s1 = control.submissions || 0;
  const v2 = challenger.visitors || 0;
  const s2 = challenger.submissions || 0;

  const hasSufficientSampleSize = v1 >= 50 && v2 >= 50 && s1 >= 10 && s2 >= 10;

  if (v1 === 0 || v2 === 0) {
    return {
      zScore: 0,
      pValue: 1,
      confidence: 0,
      liftPercentage: 0,
      isSignificant: false,
      hasSufficientSampleSize: false,
      recommendedAction: 'continue_testing',
    };
  }

  const p1 = s1 / v1;
  const p2 = s2 / v2;

  const liftPercentage = p1 > 0 ? Math.round(((p2 - p1) / p1) * 100 * 10) / 10 : 0;

  // Pooled proportion
  const p = (s1 + s2) / (v1 + v2);
  const se = Math.sqrt(p * (1 - p) * (1 / v1 + 1 / v2));

  if (se === 0) {
    return {
      zScore: 0,
      pValue: 1,
      confidence: 0,
      liftPercentage,
      isSignificant: false,
      hasSufficientSampleSize,
      recommendedAction: 'continue_testing',
    };
  }

  const zScore = (p2 - p1) / se;
  // Two-tailed p-value: 2 * (1 - Phi(|z|))
  const cdf = 0.5 * (1 + erf(Math.abs(zScore) / Math.SQRT2));
  const pValue = Math.max(0.0001, Math.min(1, 2 * (1 - cdf)));
  const confidence = Math.round((1 - pValue) * 100 * 10) / 10;

  const isSignificant = hasSufficientSampleSize && confidence >= 95;

  let recommendedAction: 'continue_testing' | 'declare_winner' | 'inconclusive' = 'continue_testing';
  if (isSignificant && liftPercentage > 0) {
    recommendedAction = 'declare_winner';
  } else if (hasSufficientSampleSize && !isSignificant) {
    recommendedAction = 'inconclusive';
  }

  return {
    zScore: Math.round(zScore * 100) / 100,
    pValue: Math.round(pValue * 1000) / 1000,
    confidence,
    liftPercentage,
    isSignificant,
    hasSufficientSampleSize,
    recommendedAction,
  };
}

/**
 * Evaluates whether an auto-responder rule condition matches submission answers or scores.
 */
export function evaluateAutoResponderCondition(
  rule: AutoResponderRule,
  answers: Record<string, string | number | boolean>,
  totalScore?: number
): boolean {
  if (!rule.enabled) return false;

  if (rule.triggerType === 'immediate') {
    return true;
  }

  if (rule.triggerType === 'score_threshold') {
    if (typeof rule.minScore !== 'number') return true;
    return (totalScore || 0) >= rule.minScore;
  }

  if (rule.triggerType === 'conditional' && rule.condition) {
    const { fieldId, operator, value } = rule.condition;
    if (!fieldId) return false;

    const answerVal = answers[fieldId];
    if (answerVal === undefined || answerVal === null) return false;

    const answerStr = String(answerVal).toLowerCase();
    const targetStr = String(value).toLowerCase();

    switch (operator) {
      case 'equals':
        return answerStr === targetStr;
      case 'not_equals':
        return answerStr !== targetStr;
      case 'contains':
        return answerStr.includes(targetStr);
      case 'greater_than':
        return Number(answerVal) > Number(value);
      case 'less_than':
        return Number(answerVal) < Number(value);
      default:
        return false;
    }
  }

  return false;
}

/**
 * Calculates percentage safely without NaN or Infinity.
 */
export function safePercentage(numerator: number, denominator: number): number {
  if (!denominator || isNaN(denominator) || denominator <= 0) return 0;
  if (isNaN(numerator) || numerator <= 0) return 0;
  const res = (numerator / denominator) * 100;
  return Math.round(res * 10) / 10;
}

/**
 * Formats duration seconds into readable time string (e.g. "1m 45s").
 */
export function formatDurationSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

/**
 * Builds full public URL with UTM query parameters attached.
 */
export function buildDistributionUrl(
  baseUrl: string,
  slug: string,
  utms?: UtmParameters
): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/p/f/${encodeURIComponent(slug)}`;
  
  if (!utms) return url;

  const params = new URLSearchParams();
  if (utms.source?.trim()) params.set('utm_source', utms.source.trim());
  if (utms.medium?.trim()) params.set('utm_medium', utms.medium.trim());
  if (utms.campaign?.trim()) params.set('utm_campaign', utms.campaign.trim());
  if (utms.term?.trim()) params.set('utm_term', utms.term.trim());
  if (utms.content?.trim()) params.set('utm_content', utms.content.trim());

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

/**
 * Generates ready-to-use HTML/JavaScript embed code snippets.
 */
export function generateEmbedSnippet(
  formSlug: string,
  config: EmbedConfig,
  appUrl?: string
): string {
  const host = (appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://app.smartsapp.com').replace(/\/+$/, '');
  const embedUrl = `${host}/p/f/${formSlug}?embed=true`;

  if (config.embedType === 'inline') {
    const heightAttr = config.height || '650px';
    const widthAttr = config.width || '100%';

    return `<!-- SmartSapp Forms 2.0 Responsive Embed -->
<iframe
  id="smartsapp-form-${formSlug}"
  src="${embedUrl}"
  width="${widthAttr}"
  height="${heightAttr}"
  frameborder="0"
  scrolling="no"
  style="border: 0; max-width: 100%; width: ${widthAttr}; min-height: 400px; overflow: hidden; border-radius: 16px;"
  title="Form"
></iframe>
<script>
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'smartSappFormResize' && e.data.formId === '${formSlug}') {
      var el = document.getElementById('smartsapp-form-${formSlug}');
      if (el && e.data.height) { el.style.height = e.data.height + 'px'; }
    }
  });
</script>`;
  }

  if (config.embedType === 'popup') {
    const btnText = config.triggerText || 'Open Form';
    const btnColor = config.triggerColor || '#4f46e5';

    return `<!-- SmartSapp Forms 2.0 Popup Widget -->
<button
  id="smartsapp-popup-btn-${formSlug}"
  style="background-color: ${btnColor}; color: #ffffff; padding: 12px 24px; border-radius: 12px; font-weight: 600; border: none; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"
  onclick="document.getElementById('smartsapp-popup-modal-${formSlug}').style.display='flex';"
>
  ${btnText}
</button>

<div
  id="smartsapp-popup-modal-${formSlug}"
  style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 99999; align-items: center; justify-content: center; padding: 16px;"
  onclick="if(event.target===this){this.style.display='none';}"
>
  <div style="position: relative; width: 100%; max-width: 640px; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
    <button
      style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.08); border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 18px; cursor: pointer; z-index: 10;"
      onclick="document.getElementById('smartsapp-popup-modal-${formSlug}').style.display='none';"
    >×</button>
    <iframe
      src="${embedUrl}"
      width="100%"
      height="650px"
      frameborder="0"
      style="border: 0; width: 100%; height: 650px;"
      title="Form Popup"
    ></iframe>
  </div>
</div>`;
  }

  // Slideover Widget
  return `<!-- SmartSapp Forms 2.0 Slide-over Drawer Widget -->
<button
  id="smartsapp-drawer-btn-${formSlug}"
  style="position: fixed; bottom: 24px; right: 24px; background: #4f46e5; color: #fff; padding: 14px 20px; border-radius: 9999px; font-weight: bold; border: none; cursor: pointer; box-shadow: 0 10px 25px rgba(79,70,229,0.3); z-index: 9999;"
  onclick="document.getElementById('smartsapp-drawer-${formSlug}').style.transform='translateX(0)';"
>
  ${config.triggerText || 'Contact Us'}
</button>

<div
  id="smartsapp-drawer-${formSlug}"
  style="position: fixed; top: 0; right: 0; bottom: 0; width: 100%; max-width: 480px; background: #fff; box-shadow: -10px 0 30px rgba(0,0,0,0.15); z-index: 10000; transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);"
>
  <div style="padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: flex-end;">
    <button style="border: none; background: #f3f4f6; width: 32px; height: 32px; border-radius: 50%; cursor: pointer;" onclick="document.getElementById('smartsapp-drawer-${formSlug}').style.transform='translateX(100%)';">✕</button>
  </div>
  <iframe src="${embedUrl}" width="100%" height="calc(100% - 60px)" frameborder="0" style="border: 0;"></iframe>
</div>`;
}

/**
 * Sanitizes a CSV cell to prevent CSV Formula Injection attacks (=, +, -, @, \t, \r).
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const isFormula = /^[=+\-@\t\r]/.test(str) || /^[=+\-@\t\r]/.test(str.trim());
  const safeStr = isFormula ? `'${str}` : str;
  return `"${safeStr.replace(/"/g, '""')}"`;
}
