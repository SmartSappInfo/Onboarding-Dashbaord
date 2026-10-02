/**
 * @fileOverview Live principal re-check for queued agent steps (agents_mcp PR-2, Round 4 item).
 *
 * A step can wait in the queue for minutes or hours. The run stores a SNAPSHOT of its principal,
 * so the worker must confirm, at execution time, that the user behind it still exists, is still
 * approved, and still has access to the run's workspace. Until the 1.3 principal resolvers land
 * this uses the same membership rule as the rest of the app (`checkWorkspaceAccess`: system admin,
 * or same organization plus a role that grants the workspace).
 */
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import type { AgentPrincipal } from '../capabilities/contracts/capability-definition';
import { checkWorkspaceAccess } from '@/lib/workspace-permissions';

export type LivePrincipalResult = { ok: true } | { ok: false; reason: string };

export interface LivePrincipalCheck {
  check(principal: AgentPrincipal, target: { organizationId: string; workspaceId: string }): Promise<LivePrincipalResult>;
}

/** Only the fields the check relies on; anything else on the user document is ignored. */
const LiveUserSchema = z.object({
  isAuthorized: z.boolean().nullish().catch(undefined),
  permissions: z.array(z.string()).nullish().catch(undefined),
  organizationId: z.string().nullish().catch(undefined),
});

export function createLivePrincipalCheck(
  db: Firestore,
  workspaceAccess: typeof checkWorkspaceAccess = checkWorkspaceAccess
): LivePrincipalCheck {
  return {
    async check(principal, target) {
      if (!principal.userId) return { ok: false, reason: 'Principal has no user.' };
      const snap = await db.collection('users').doc(principal.userId).get();
      if (!snap.exists) return { ok: false, reason: 'The user behind this run no longer exists.' };
      const user = LiveUserSchema.safeParse(snap.data());
      if (!user.success) return { ok: false, reason: 'The user record is unreadable.' };
      const isSystemAdmin = user.data.permissions?.includes('system_admin') ?? false;
      if (!isSystemAdmin) {
        if (user.data.isAuthorized !== true) return { ok: false, reason: 'The user is no longer approved.' };
        if (user.data.organizationId !== target.organizationId) {
          return { ok: false, reason: 'The user no longer belongs to the run\'s organization.' };
        }
      }
      const access = await workspaceAccess(principal.userId, target.workspaceId);
      return access.granted ? { ok: true } : { ok: false, reason: access.reason ?? 'The user lost access to the workspace.' };
    },
  };
}
