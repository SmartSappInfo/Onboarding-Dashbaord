/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Client-Side Visitor & Session Tracking Module:
 *    Manages anonymous visitor persistence (`visitorId` in localStorage),
 *    viewer session lifecycle (`sessionId`), device capability fingerprinting,
 *    and contact distribution token resolution (PRD Sections 21–23).
 * 2. Mobile & Touch Screen Awareness:
 *    Detects device viewport dimensions, touch screen capabilities, and device orientation.
 * 3. Privacy & Storage Isolation:
 *    Safely falls back to ephemeral memory IDs if localStorage is blocked by browser tracking prevention.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

export interface ClientSessionContext {
  visitorId: string;
  sessionId: string;
  device: {
    type: 'mobile' | 'tablet' | 'desktop' | 'unknown';
    userAgent?: string;
    screenResolution?: string;
  };
  browser: string;
  os: string;
  distributionToken?: string;
  contactId?: string;
  campaignId?: string;
}

const VISITOR_ID_KEY = 'smartsapp_doc_visitor_id';

/**
 * Generates a standard RFC4122 v4 UUID.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieves the persistent visitor ID from localStorage or creates a new one.
 */
export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return 'server_render_visitor';
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing && existing.length > 8) {
      return existing;
    }
    const newId = `vis_${generateUUID().replace(/-/g, '').slice(0, 16)}`;
    window.localStorage.setItem(VISITOR_ID_KEY, newId);
    return newId;
  } catch {
    return `vis_${generateUUID().replace(/-/g, '').slice(0, 16)}`;
  }
}

/**
 * Detects device type from user agent and screen metrics.
 */
export function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';
  const ua = window.navigator.userAgent.toLowerCase();
  const width = window.innerWidth || window.screen.width || 1024;

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua) || (width >= 768 && width <= 1024)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua) || width < 768) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * Parses browser and OS names from user agent.
 */
export function detectBrowserAndOS(): { browser: string; os: string } {
  if (typeof window === 'undefined') return { browser: 'Unknown', os: 'Unknown' };
  const ua = window.navigator.userAgent;

  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';

  let os = 'Unknown';
  if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { browser, os };
}

/**
 * Builds a complete ClientSessionContext initialized for the current reader session.
 */
export function initializeClientSession(searchParams?: URLSearchParams): ClientSessionContext {
  const visitorId = getOrCreateVisitorId();
  const sessionId = `ses_${generateUUID().replace(/-/g, '').slice(0, 16)}`;
  const deviceType = detectDeviceType();
  const { browser, os } = detectBrowserAndOS();

  const screenResolution = typeof window !== 'undefined'
    ? `${window.screen.width}x${window.screen.height}`
    : undefined;

  const distributionToken = searchParams?.get('t') || undefined;
  const contactId = searchParams?.get('contactId') || searchParams?.get('cid') || undefined;
  const campaignId = searchParams?.get('campaignId') || searchParams?.get('utm_campaign') || undefined;

  return {
    visitorId,
    sessionId,
    device: {
      type: deviceType,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      screenResolution,
    },
    browser,
    os,
    distributionToken,
    contactId,
    campaignId,
  };
}
