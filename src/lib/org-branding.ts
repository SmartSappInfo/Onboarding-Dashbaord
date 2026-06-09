import { cache } from 'react';
import { adminDb } from './firebase-admin';
import type { OrgBranding } from './types';

const BRANDING_DEFAULTS: OrgBranding = {
  logoUrl: '',
  brandPrimaryColor: '#3b82f6',
  brandSecondaryColor: '#8B5CF6',
  brandFontFamily: 'Inter',
  name: '',
};

export const getOrgBranding = cache(async (organizationId: string | undefined | null): Promise<OrgBranding> => {
  if (!organizationId) return BRANDING_DEFAULTS;
  try {
    const snap = await adminDb.collection('organizations').doc(organizationId).get();
    if (!snap.exists) return BRANDING_DEFAULTS;
    const org = snap.data() as Record<string, any>;
    return {
      logoUrl: org.logoUrl || '',
      brandPrimaryColor: org.brandPrimaryColor || BRANDING_DEFAULTS.brandPrimaryColor,
      brandSecondaryColor: org.brandSecondaryColor || BRANDING_DEFAULTS.brandSecondaryColor,
      brandFontFamily: org.brandFontFamily || BRANDING_DEFAULTS.brandFontFamily,
      name: org.name || '',
    };
  } catch (error) {
    console.warn(`Failed to fetch org branding for ${organizationId}:`, error);
    return BRANDING_DEFAULTS;
  }
});
