/**
 * @fileOverview Session authorization for DocSigning admin server actions (PR-0 review, 2026-09-29).
 *
 * WHY: the Enterprise Governance and branding actions shipped with no identity check at all — the
 * caller chose `workspaceId` (and even the legal-hold actor). Server actions are public endpoints, so
 * every one of them now derives identity from the session and checks the SAME RBAC coordinates the
 * admin UI already uses to show these screens:
 *   - Agreements Hub (legal hold, retention, webhooks, assurance, evidence): finance / agreements
 *   - Signer-facing branding (Doc Signing drawer):                            studios / pdfs
 *
 * NOT 'use server' on purpose: this is a helper, never an endpoint.
 * CAUTION: `workspaceId` is caller-supplied until `requireWorkspace` verifies membership — never use
 * it for anything before this function returns.
 */

import { ForbiddenError, requireWorkspace } from '@/lib/auth/require-auth';
import { canUser } from '@/lib/workspace-permissions';
import type { AppPermissionAction } from '@/lib/types';

export type DocSigningArea = 'agreements' | 'signing_branding';

const AREA_COORDINATES: Record<DocSigningArea, { section: 'finance' | 'studios'; feature: string }> = {
  agreements: { section: 'finance', feature: 'agreements' },
  signing_branding: { section: 'studios', feature: 'pdfs' },
};

/** Verified session uid of a workspace member who holds `action` on the area; throws otherwise. */
export async function requireDocSigningPermission(
  workspaceId: string,
  area: DocSigningArea,
  action: AppPermissionAction
): Promise<{ uid: string }> {
  const { uid } = await requireWorkspace(workspaceId);
  const { section, feature } = AREA_COORDINATES[area];
  const permission = await canUser(uid, section, feature, action, workspaceId);
  if (!permission.granted) {
    throw new ForbiddenError(permission.reason ?? "You don't have permission to do this.");
  }
  return { uid };
}
