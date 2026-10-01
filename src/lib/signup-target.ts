/**
 * Where public school signups land (agents_mcp N1).
 *
 * The signup forms used to send `workspaceId` / `organizationId` / `userId` from the browser, and
 * the server trusted them (with a `system-signup` id that skipped every permission check). The
 * target is fixed server-side now; the organization comes from the workspace document.
 * Not a `'use server'` module: import it only from server code.
 */
import { workspaceOrganizationId } from '@/lib/crm/deal-core';

/** The workspace that receives new school signups. */
export const SIGNUP_WORKSPACE_ID = 'onboarding';
/** Used only if the signup workspace document has no organization (legacy). */
const SIGNUP_FALLBACK_ORGANIZATION_ID = 'smartsapp-hq';

/** Replaces the client-supplied tenant and identity fields with the server's values. */
export async function pinSignupTarget<T extends { workspaceId: string; organizationId: string; userId?: string }>(
  input: T,
  sessionUid: string
): Promise<T> {
  const organizationId = (await workspaceOrganizationId(SIGNUP_WORKSPACE_ID)) || SIGNUP_FALLBACK_ORGANIZATION_ID;
  return { ...input, workspaceId: SIGNUP_WORKSPACE_ID, organizationId, userId: sessionUid };
}
