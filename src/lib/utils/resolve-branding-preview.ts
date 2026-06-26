/**
 * @fileoverview Shared client-side utility for resolving org branding tokens in HTML previews.
 *
 * This is a pure string transform — no Firestore reads, no server actions.
 * Used by the styles/page.tsx and styles/[id]/page.tsx preview iframes.
 *
 * The {{org_footer}} token is rendered as a visual placeholder so style authors
 * can see where the footer will appear without needing the full engine.
 */

import type { OrgBrandingData } from '../types';

export interface StylePreviewOverrides {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  backgroundColor?: string;
  textColor?: string;
  cardBackgroundColor?: string;
  borderRadius?: string;
}

/**
 * Resolves all org branding {{tokens}} in a style wrapper HTML string.
 * Safe for client-side use — no I/O.
 *
 * @param html       The style wrapper HTML with {{variable}} tokens.
 * @param data       Partial org data (from Firestore snapshot or local state).
 * @param overrides  Visual overrides from the style editor (e.g. custom colors).
 * @returns          Resolved HTML with all tokens substituted.
 */
export function resolveBrandingPreview(
  html: string,
  data?: Partial<OrgBrandingData>,
  overrides?: StylePreviewOverrides,
): string {
  if (!html) return '';

  const currentYear = new Date().getFullYear().toString();

  const orgName = data?.name ?? 'Your Organization';
  const logo = data?.logoUrl ?? '';
  const emailAddr = data?.email ?? 'contact@yourdomain.com';
  const phoneNum = data?.phone ?? '+1 (555) 000-0000';
  const addressStr = data?.address ?? '123 Main St, City, Country';
  const webUrl = data?.website ?? 'https://yourdomain.com';
  const unsubCopy =
    data?.unsubscribeCopy ??
    'You are receiving this email because you subscribed to our services. Click here to unsubscribe.';

  const primaryCol = overrides?.primaryColor ?? data?.brandPrimaryColor ?? '#3B5FFF';
  const secondaryCol = overrides?.secondaryColor ?? data?.brandSecondaryColor ?? '#8B5CF6';
  const fontFam = overrides?.fontFamily ?? data?.brandFontFamily ?? 'Figtree';
  const bgCol = overrides?.backgroundColor ?? '#f8fafc';
  const textCol = overrides?.textColor ?? '#1e293b';
  const cardBgCol = overrides?.cardBackgroundColor ?? '#ffffff';
  const borderRad = overrides?.borderRadius ?? '16px';

  // Footer placeholder — shows where {{org_footer}} will render at send time
  const orgFooterPlaceholder = `
<div style="margin: 0; padding: 24px 40px; background: #F8FAFC; border-top: 1px solid #E2E8F0; font-family: ${fontFam}, sans-serif; font-size: 11px; color: #94A3B8; text-align: center;">
  <div style="display: inline-flex; align-items: center; gap: 6px; background: #EFF6FF; border: 1px dashed #93C5FD; border-radius: 8px; padding: 8px 14px; color: #3B82F6; font-size: 10px; font-weight: 600; letter-spacing: 0.5px;">
    <span>✦</span> Org Footer — configured in Settings → Branding
  </div>
</div>`;

  let processed = html
    .replaceAll('{{org_name}}', orgName)
    .replaceAll('{{org_logo_url}}', logo)
    .replaceAll('{{org_email}}', emailAddr)
    .replaceAll('{{org_phone}}', phoneNum)
    .replaceAll('{{org_address}}', addressStr)
    .replaceAll('{{org_website}}', webUrl)
    .replaceAll('{{unsubscribe_copy}}', unsubCopy)
    .replaceAll('{{unsubscribe_link}}', '#preview')
    .replaceAll('{{org_footer}}', orgFooterPlaceholder)
    .replaceAll('{{brand_primary_color}}', primaryCol)
    .replaceAll('{{brand_secondary_color}}', secondaryCol)
    .replaceAll('{{brand_font_family}}', fontFam)
    .replaceAll('{{brand_background_color}}', bgCol)
    .replaceAll('{{brand_text_color}}', textCol)
    .replaceAll('{{brand_card_background_color}}', cardBgCol)
    .replaceAll('{{brand_border_radius}}', borderRad)
    .replaceAll('{{current_year}}', currentYear);

  // Also replace hardcoded hex defaults so live colour edits reflect in preview
  processed = processed
    .replaceAll('#f8fafc', bgCol)
    .replaceAll('#ffffff', cardBgCol)
    .replaceAll('16px', borderRad)
    .replaceAll('sans-serif', fontFam)
    .replaceAll('#3B5FFF', primaryCol)
    .replaceAll('#8B5CF6', secondaryCol)
    .replaceAll('#1e293b', textCol);

  return processed;
}
