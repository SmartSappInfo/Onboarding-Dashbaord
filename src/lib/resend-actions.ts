
'use server';

import { adminDb } from './firebase-admin';
import { getEmail, getVerifiedDomains, cancelEmail } from './resend-service';
import { requireOrganization } from './auth/require-auth';

/**
 * Resolves Resend credentials for a given organization if custom routing is enabled.
 */
async function resolveResendCredentials(organizationId?: string): Promise<{ apiKey?: string; domain?: string }> {
  if (!organizationId) return {};
  try {
    const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
    if (orgSnap.exists) {
      const org = orgSnap.data();
      if (org?.emailKeyMode === 'custom' && org?.resendApiKey) {
        return {
          apiKey: org.resendApiKey as string,
          domain: org.resendDomain as string
        };
      }
    }
  } catch (error) {
    console.error(">>> [RESEND-ACTIONS] Failed to resolve custom Resend credentials:", (error as Error).message);
  }
  return {};
}

/**
 * Server Action to fetch live delivery status of an email.
 */
export async function fetchEmailStatusAction(id: string, organizationId?: string) {
  // SECURITY (audit F2): the provider key resolver falls back to the PLATFORM
  // credential when no org is given, so an unauthenticated caller could spend
  // platform credit or read another tenant's provider data. Scope to the caller.
  ({ organizationId } = await requireOrganization(organizationId));

  try {
    const { apiKey } = await resolveResendCredentials(organizationId);
    const data = await getEmail(id, apiKey);
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Server Action to list verified sending domains.
 */
export async function fetchVerifiedDomainsAction(organizationId?: string) {
  // SECURITY (audit F2): the provider key resolver falls back to the PLATFORM
  // credential when no org is given, so an unauthenticated caller could spend
  // platform credit or read another tenant's provider data. Scope to the caller.
  ({ organizationId } = await requireOrganization(organizationId));

  try {
    const { apiKey } = await resolveResendCredentials(organizationId);
    const data = await getVerifiedDomains(apiKey);
    return { success: true, domains: data.data || [] };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Server Action to cancel a pending scheduled email.
 */
export async function cancelScheduledEmailAction(id: string, organizationId?: string) {
  // SECURITY (audit F2): the provider key resolver falls back to the PLATFORM
  // credential when no org is given, so an unauthenticated caller could spend
  // platform credit or read another tenant's provider data. Scope to the caller.
  ({ organizationId } = await requireOrganization(organizationId));

  try {
    const { apiKey } = await resolveResendCredentials(organizationId);
    await cancelEmail(id, apiKey);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}
