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
import { resolveOrgFooter } from '../services/org-footer-service';

export interface StylePreviewOverrides {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  backgroundColor?: string;
  textColor?: string;
  cardBackgroundColor?: string;
  borderRadius?: string;
  logoUrl?: string;
  footerHtml?: string;
  footerEnabled?: boolean;
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
  const logo = overrides?.logoUrl ?? data?.logoUrl ?? '';
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

  // Footer overrides resolution - renders actual style/org footer instead of static placeholder
  const footerEnabled = overrides?.footerEnabled ?? data?.footerEnabled ?? true;
  const footerHtmlVal = overrides?.footerHtml ?? data?.footerHtml;

  const orgFooterPlaceholder = resolveOrgFooter(
    footerHtmlVal,
    footerEnabled !== false,
    {
      unsubscribe_copy: unsubCopy,
      unsubscribe_link: '#preview',
      org_name: orgName,
      org_address: addressStr,
      org_email: emailAddr,
      org_phone: phoneNum,
      org_website: webUrl,
      current_year: currentYear,
      brand_primary_color: primaryCol,
    }
  );

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
