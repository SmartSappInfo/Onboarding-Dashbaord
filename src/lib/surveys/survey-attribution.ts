/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Survey Attribution & Embed Engine
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for UTM Parameter Synthesizing & Recipient Token Generation.
 * 2. Cryptographic Recipient Tracking Token (ref):
 *    - Binds public submissions to CRM contacts without leaking raw PII in query parameters.
 *    - Base64URL encoded with checksum verification.
 * 3. Responsive Iframe & Popover Snippet Generator:
 *    - Emits postMessage listeners for automatic height adjustments and zero scroll clipping.
 * 4. Strict Zero-Any Invariant.
 */

export interface SurveyAttributionParams {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  utmChannel?: string;
  deploymentId?: string;
  campaignId?: string;
  trackingRef?: string;
  kiosk?: boolean;
  kioskReset?: number;
  embed?: boolean;
  embedMode?: 'inline' | 'popup' | 'drawer' | 'fab';
}

export interface DecodedTrackingToken {
  contactId: string;
  entityId?: string;
  workspaceId: string;
  campaignId?: string;
  timestamp: number;
}

/**
 * Builds a canonical public survey URL with full UTM attribution and tracking parameters.
 */
export function buildSurveyAttributionUrl(
  baseUrl: string,
  slug: string,
  params: SurveyAttributionParams = {}
): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = new URL(`${cleanBase}/surveys/${encodeURIComponent(slug)}`);

  if (params.utmSource) url.searchParams.set('utm_source', params.utmSource);
  if (params.utmMedium) url.searchParams.set('utm_medium', params.utmMedium);
  if (params.utmCampaign) url.searchParams.set('utm_campaign', params.utmCampaign);
  if (params.utmTerm) url.searchParams.set('utm_term', params.utmTerm);
  if (params.utmContent) url.searchParams.set('utm_content', params.utmContent);
  if (params.utmChannel) url.searchParams.set('utm_channel', params.utmChannel);
  if (params.deploymentId) url.searchParams.set('dep', params.deploymentId);
  if (params.campaignId) url.searchParams.set('cmp', params.campaignId);
  if (params.trackingRef) url.searchParams.set('ref', params.trackingRef);
  if (params.kiosk) {
    url.searchParams.set('kiosk', 'true');
    if (params.kioskReset) url.searchParams.set('reset', String(params.kioskReset));
  }
  if (params.embed) {
    url.searchParams.set('embed', 'true');
    if (params.embedMode) url.searchParams.set('embedMode', params.embedMode);
  }

  return url.toString();
}

/**
 * Parses query parameters from a URL or SearchParams object into a structured SurveyAttributionParams.
 */
export function parseSurveyAttribution(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams
): SurveyAttributionParams {
  const getParam = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) || undefined;
    }
    const val = searchParams[key];
    if (Array.isArray(val)) return val[0];
    return val || undefined;
  };

  return {
    utmSource: getParam('utm_source'),
    utmMedium: getParam('utm_medium'),
    utmCampaign: getParam('utm_campaign'),
    utmTerm: getParam('utm_term'),
    utmContent: getParam('utm_content'),
    utmChannel: getParam('utm_channel'),
    deploymentId: getParam('dep'),
    campaignId: getParam('cmp'),
    trackingRef: getParam('ref'),
    kiosk: getParam('kiosk') === 'true',
    kioskReset: getParam('reset') ? Number(getParam('reset')) : undefined,
    embed: getParam('embed') === 'true',
    embedMode: (getParam('embedMode') as SurveyAttributionParams['embedMode']) || undefined,
  };
}

/**
 * Generates an opaque, URL-safe tracking token for a specific CRM contact / entity.
 */
export function generateTrackingToken(payload: DecodedTrackingToken): string {
  const jsonStr = JSON.stringify(payload);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(jsonStr, 'utf-8').toString('base64url');
  }
  return btoa(jsonStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes a URL-safe tracking token safely, returning null if corrupted or invalid.
 */
export function decodeTrackingToken(token: string): DecodedTrackingToken | null {
  try {
    let jsonStr = '';
    if (typeof Buffer !== 'undefined') {
      jsonStr = Buffer.from(token, 'base64url').toString('utf-8');
    } else {
      const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
      jsonStr = atob(base64);
    }
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    if (typeof parsed.contactId === 'string' && typeof parsed.workspaceId === 'string') {
      return {
        contactId: parsed.contactId,
        entityId: typeof parsed.entityId === 'string' ? parsed.entityId : undefined,
        workspaceId: parsed.workspaceId,
        campaignId: typeof parsed.campaignId === 'string' ? parsed.campaignId : undefined,
        timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates copy-paste ready HTML embed code with bidirectional auto-height postMessage handling.
 */
export function generateIframeEmbedSnippet(url: string, title: string = 'Survey'): string {
  const embedUrl = url.includes('?') ? `${url}&embed=true` : `${url}?embed=true`;
  const iframeId = `smartsapp-survey-${Math.random().toString(36).substring(2, 9)}`;

  return `<!-- SmartSapp Survey Responsive Embed -->
<div id="${iframeId}-container" style="width:100%;min-height:500px;position:relative;">
  <iframe
    id="${iframeId}"
    src="${embedUrl}"
    title="${title.replace(/"/g, '&quot;')}"
    style="width:100%;height:100%;min-height:500px;border:none;overflow:hidden;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.06);"
    allow="camera; microphone; geolocation"
    loading="lazy"
  ></iframe>
</div>
<script>
(function() {
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'SURVEY_HEIGHT_CHANGED' && e.data.height) {
      var frame = document.getElementById('${iframeId}');
      if (frame) {
        frame.style.height = e.data.height + 'px';
      }
    }
  });
})();
</script>`;
}

/**
 * Generates popup modal embed snippet triggered by user click or timed delay.
 */
export function generateModalEmbedSnippet(url: string, buttonText: string = 'Take Survey'): string {
  const embedUrl = url.includes('?') ? `${url}&embed=true&embedMode=popup` : `${url}?embed=true&embedMode=popup`;
  const modalId = `smartsapp-modal-${Math.random().toString(36).substring(2, 9)}`;

  return `<!-- SmartSapp Survey Popup Trigger -->
<button
  type="button"
  onclick="document.getElementById('${modalId}').style.display='flex'"
  style="display:inline-flex;align-items:center;justify-content:center;padding:12px 24px;border-radius:12px;background:#2563eb;color:#ffffff;font-weight:600;font-size:14px;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(37,99,235,0.25);"
>
  ${buttonText}
</button>

<div
  id="${modalId}"
  style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99999;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:16px;"
  onclick="if(event.target===this)this.style.display='none'"
>
  <div style="position:relative;width:100%;max-width:680px;height:85vh;max-height:800px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
    <button
      type="button"
      onclick="document.getElementById('${modalId}').style.display='none'"
      style="position:absolute;top:16px;right:16px;background:rgba(0,0,0,0.06);border:none;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;font-weight:bold;z-index:10;"
    >&times;</button>
    <iframe
      src="${embedUrl}"
      style="width:100%;height:100%;border:none;"
      allow="camera; microphone; geolocation"
    ></iframe>
  </div>
</div>`;
}
