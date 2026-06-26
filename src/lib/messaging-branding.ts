import { adminDb } from './firebase-admin';
import type { OrgBrandingData } from './types';

/**
 * Resolves all org branding variables from Firestore in a single read.
 *
 * Returned map is used by the messaging engine and template resolver to
 * populate {{variable}} tokens in email bodies, subject lines, and style wrappers.
 *
 * Footer fields (footerHtml, footerEnabled) are piggybacked here at zero
 * additional I/O cost — no separate Firestore read is needed in the engine.
 */
export async function resolveOrgBrandingVars(
  orgId: string | undefined | null,
): Promise<Record<string, string>> {
  const vars: Record<string, string> = {
    current_year: new Date().getFullYear().toString(),
  };

  if (!orgId) return vars;

  try {
    const orgSnap = await adminDb.collection('organizations').doc(orgId).get();

    if (orgSnap.exists) {
      const org = orgSnap.data() as OrgBrandingData;

      const primary = org.brandPrimaryColor || '#3b82f6';
      const secondary = org.brandSecondaryColor || '#8B5CF6';
      const font = org.brandFontFamily || 'Inter';

      vars.org_name = org.name || '';
      vars.org_logo_url = org.logoUrl || '';
      vars.org_email = org.email || '';
      vars.org_phone = org.phone || '';
      vars.org_address = org.address || '';
      vars.org_website = org.website || '';

      // Unsubscribe compliance copy with safe fallback
      vars.unsubscribe_copy =
        org.unsubscribeCopy ||
        'You are receiving this email because you subscribed to our services. Click here to unsubscribe.';

      // Footer configuration — piggybacked at zero extra I/O cost
      vars.org_footer_html = org.footerHtml || '';
      vars.org_footer_enabled = String(org.footerEnabled !== false); // defaults true

      // Support both key naming conventions for cross-engine consistency
      vars.org_primary_color = primary;
      vars.brand_primary_color = primary;

      vars.org_secondary_color = secondary;
      vars.brand_secondary_color = secondary;

      vars.org_font_family = font;
      vars.brand_font_family = font;

      // Global settings
      vars.meeting_timezone = org.settings?.defaultTimezone || 'UTC';
    }
  } catch (e) {
    console.warn('>>> Org branding lookup failed or skipped:', (e as Error).message);
  }

  return vars;
}
