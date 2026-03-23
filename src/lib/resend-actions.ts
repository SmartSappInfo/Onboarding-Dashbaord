
'use server';

import { getEmail, getVerifiedDomains, cancelEmail } from './resend-service';

/**
 * Server Action to fetch live delivery status of an email.
 */
export async function fetchEmailStatusAction(id: string) {
  try {
    const data = await getEmail(id);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Server Action to list verified sending domains.
 */
export async function fetchVerifiedDomainsAction() {
  try {
    const data = await getVerifiedDomains();
    return { success: true, domains: data.data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Server Action to cancel a pending scheduled email.
 */
export async function cancelScheduledEmailAction(id: string) {
  try {
    await cancelEmail(id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
