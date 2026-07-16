import { cookies } from 'next/headers';
import { decryptToken } from '../crypto';

export interface OnboardingContext {
  contactId: string | null;
  entityId: string | null;
  workspaceId: string | null;
}

/**
 * Decrypts and resolves the onboarding contact context from the secure session cookie.
 */
export async function resolveOnboardingContext(): Promise<OnboardingContext> {
  const result: OnboardingContext = {
    contactId: null,
    entityId: null,
    workspaceId: null
  };

  try {
    const cookieStore = await cookies();
    const contextCookie = cookieStore.get('__onb_context')?.value;

    if (contextCookie) {
      const decrypted = decryptToken(contextCookie);
      if (decrypted) {
        const parsed = JSON.parse(decrypted);
        if (parsed.contactId) result.contactId = String(parsed.contactId);
        if (parsed.entityId) result.entityId = String(parsed.entityId);
        if (parsed.workspaceId) result.workspaceId = String(parsed.workspaceId);
      }
    }
  } catch (err) {
    console.warn('[ContextResolver] resolveOnboardingContext failed:', err);
  }

  return result;
}
