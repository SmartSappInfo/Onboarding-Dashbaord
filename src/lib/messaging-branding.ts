import { adminDb } from './firebase-admin';

export async function resolveOrgBrandingVars(orgId: string | undefined | null): Promise<Record<string, string>> {
  const vars: Record<string, string> = {
    current_year: new Date().getFullYear().toString(),
  };
  if (!orgId) return vars;
  try {
    const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
    if (orgSnap.exists) {
      const org = orgSnap.data() as Record<string, any>;
      const primary = org.brandPrimaryColor || '#3b82f6';
      const secondary = org.brandSecondaryColor || '#8B5CF6';
      const font = org.brandFontFamily || 'Inter';

      vars.org_name = org.name || '';
      vars.org_logo_url = org.logoUrl || '';
      vars.org_email = org.email || '';
      vars.org_phone = org.phone || '';
      vars.org_address = org.address || '';
      vars.org_website = org.website || '';
      
      // Support unsubscribe copy with fallback
      vars.unsubscribe_copy = org.unsubscribeCopy || 'You are receiving this email because you subscribed to our services. Click here to unsubscribe.';
      
      // Support both key naming conventions to resolve inconsistencies between bulk and single messaging engines
      vars.org_primary_color = primary;
      vars.brand_primary_color = primary;
      
      vars.org_secondary_color = secondary;
      vars.brand_secondary_color = secondary;
      
      vars.org_font_family = font;
      vars.brand_font_family = font;

      // Other global settings
      vars.meeting_timezone = org.settings?.defaultTimezone || 'UTC';
    }
  } catch (e) {
    console.warn('>>> Org branding lookup failed or skipped:', (e as Error).message);
  }
  return vars;
}
