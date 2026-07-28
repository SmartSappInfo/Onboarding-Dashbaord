import type { FormSuccessBehavior, RedirectMode, FormEntityCaptureSettings, FormSubmissionActions } from './types';

/**
 * Normalizes Form Lead & Entity Capture settings for bound or global forms.
 * Guarantees zero-downtime backward compatibility for legacy forms storing actions.entityHandling.
 *
 * @param formType - 'bound' | 'global'
 * @param actions - Partial FormSubmissionActions object from Firestore
 * @returns Fully populated Required<FormEntityCaptureSettings>
 */
export function normalizeFormEntityCapture(
  formType: 'bound' | 'global',
  actions?: Partial<FormSubmissionActions> | null
): Required<FormEntityCaptureSettings> {
  const customCapture = actions?.entityCapture;
  const legacyStrategy = actions?.entityHandling || 'create_or_update';

  const defaultEnabled = formType === 'bound' ? true : false;
  const enabled = customCapture?.enabled !== undefined ? customCapture.enabled : defaultEnabled;

  return {
    enabled,
    entityScope: customCapture?.entityScope || 'workspace_default',
    handlingStrategy: customCapture?.handlingStrategy || legacyStrategy,
    leadSource: (customCapture?.leadSource ?? '').trim(),
    autoAssign: customCapture?.autoAssign === true,
  };
}

/**
 * Supported tracking query parameter keys tracked across SmartSapp pages and form embeds.
 */
export const TRACKING_PARAM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'trackingCode',
  'tracking_id',
  'gclid',
  'fbclid',
] as const;

export type TrackingParamKey = typeof TRACKING_PARAM_KEYS[number];

/**
 * Normalizes legacy or partial `FormSuccessBehavior` objects into a strictly-typed, fully populated structure.
 * Guaranteed zero-downtime backward compatibility for legacy forms storing `{ type, value }`.
 *
 * @param raw - Raw or partial FormSuccessBehavior from database
 * @returns Fully populated Required<FormSuccessBehavior>
 *
 * Caution: Ensure default fallback strings match standard UX guidelines.
 * Testability pointer: Pass undefined, legacy `{ type: 'message', value: 'Hi' }`, and full objects.
 */
export function normalizeSuccessBehavior(
  raw?: Partial<FormSuccessBehavior> | null
): Required<FormSuccessBehavior> {
  const legacyType = raw?.type || 'message';
  const legacyValue = raw?.value || '';

  // Resolve redirect mode with fallbacks
  let redirectMode: RedirectMode = raw?.redirectMode || (legacyType === 'redirect' ? 'immediate' : 'none');
  
  // Resolve redirect URL with fallback to legacy value if legacy type was redirect
  const redirectUrl = (raw?.redirectUrl ?? (legacyType === 'redirect' ? legacyValue : '')).trim();
  
  // Resolve thank you message with fallback to legacy value if legacy type was message
  const thankYouMessage = (raw?.thankYouMessage ?? (legacyType === 'message' ? legacyValue : '')).trim() ||
    'Thanks for sharing your contact details. A team member will reach out to you shortly.';

  return {
    type: legacyType,
    value: legacyValue,
    thankYouTitle: (raw?.thankYouTitle ?? '').trim() || 'Thank You!',
    thankYouMessage,
    presentation: raw?.presentation === 'page' ? 'page' : 'modal',
    redirectMode,
    redirectUrl,
    redirectDelaySeconds: typeof raw?.redirectDelaySeconds === 'number' && raw.redirectDelaySeconds > 0
      ? raw.redirectDelaySeconds
      : 5,
    redirectButtonText: (raw?.redirectButtonText ?? '').trim() || 'Continue',
    preserveTrackingParams: raw?.preserveTrackingParams !== false,
    enableConfetti: raw?.enableConfetti !== false,
  };
}

/**
 * Sanitizes target redirect URLs to prevent Open Redirects, XSS vector attacks, and scheme injection.
 * Restricts protocols to `http:`, `https:`, or relative paths starting with `/`.
 *
 * @param rawUrl - Raw user-configured or input redirect target URL
 * @returns Safe URL string or empty string if malicious/invalid
 *
 * Security Note: Blocks javascript:, data:, vbscript: protocols.
 */
export function sanitizeRedirectUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // Allow relative paths beginning with a single '/' (prevent // protocol relative open redirects)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  // Attempt URL parsing for absolute URLs
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch (_e) {
    // If URL parsing fails and it's not a relative path, reject it for safety
    return '';
  }

  return '';
}

/**
 * Extracts tracking codes (UTM parameters, ref, trackingCode, ad click IDs) from current browser context.
 * Inspects URL search parameters, document.referrer, and sessionStorage.
 *
 * @param customSearch - Optional URL search string (e.g. "?utm_source=google") for server-side or test environments
 * @returns Record of key-value tracking parameters
 */
export function extractTrackingParams(customSearch?: string): Record<string, string> {
  const result: Record<string, string> = {};

  let searchString = customSearch;
  if (typeof searchString !== 'string' && typeof window !== 'undefined') {
    searchString = window.location.search;
  }

  if (searchString) {
    try {
      const urlParams = new URLSearchParams(searchString);
      TRACKING_PARAM_KEYS.forEach((key) => {
        const val = urlParams.get(key);
        if (val) {
          result[key] = val.trim();
        }
      });
    } catch (e) {
      console.error('[extractTrackingParams] Failed to parse search string:', e);
    }
  }

  // Fallback: Check document.referrer search params if available
  if (typeof window !== 'undefined' && document.referrer) {
    try {
      const refUrl = new URL(document.referrer);
      TRACKING_PARAM_KEYS.forEach((key) => {
        if (!result[key]) {
          const val = refUrl.searchParams.get(key);
          if (val) {
            result[key] = val.trim();
          }
        }
      });
    } catch (_e) {
      // Ignore invalid referrer URLs
    }
  }

  // Fallback: Inspect stored sessionStorage UTMs if pageId stored them
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const storageKey = sessionStorage.key(i);
        if (storageKey && storageKey.startsWith('utm_')) {
          const rawItem = sessionStorage.getItem(storageKey);
          if (rawItem) {
            const parsed = JSON.parse(rawItem) as Record<string, string>;
            if (parsed && typeof parsed === 'object') {
              if (parsed.source && !result.utm_source) result.utm_source = parsed.source;
              if (parsed.medium && !result.utm_medium) result.utm_medium = parsed.medium;
              if (parsed.campaign && !result.utm_campaign) result.utm_campaign = parsed.campaign;
              if (parsed.term && !result.utm_term) result.utm_term = parsed.term;
              if (parsed.content && !result.utm_content) result.utm_content = parsed.content;
            }
          }
        }
      }
    } catch (_e) {
      // Ignore sessionStorage read errors
    }
  }

  return result;
}

/**
 * Appends captured tracking parameters to a target redirect URL without overwriting explicit parameters already present.
 *
 * @param targetUrl - Target redirect URL (relative path or absolute URL)
 * @param trackingParams - Dictionary of tracking key-values
 * @returns Augmented URL string
 */
export function appendTrackingParams(
  targetUrl: string,
  trackingParams: Record<string, string>
): string {
  const safeUrl = sanitizeRedirectUrl(targetUrl);
  if (!safeUrl) return targetUrl;
  if (!trackingParams || Object.keys(trackingParams).length === 0) return safeUrl;

  try {
    const isRelative = safeUrl.startsWith('/');
    const dummyBase = 'https://smartsapp.local';
    const parsed = new URL(safeUrl, isRelative ? dummyBase : undefined);

    Object.entries(trackingParams).forEach(([key, val]) => {
      if (val && !parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, val);
      }
    });

    if (isRelative) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch (e) {
    console.error('[appendTrackingParams] Error appending tracking params:', e);
    return safeUrl;
  }
}
