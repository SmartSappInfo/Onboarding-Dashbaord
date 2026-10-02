/**
 * @fileOverview Portal Principal Resolver (PR-6 / Workstream 1.3)
 *
 * Implements Rule 16 (Least Privilege), Rule 47 (Explicit Workspace Scope),
 * and Master Roadmap Phase 1 Domain 17 (Experience Platform & Portals).
 *
 * Bridges Firebase client auth ID tokens and portal membership records into
 * canonical `AgentPrincipal` definitions for learners and portal staff.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  requirePortalMember,
  ForbiddenError,
  type PortalMemberContext,
} from '@/lib/auth/require-portal-access';
import { PortalService } from '@/lib/services/portal-service';
import type { Portal } from '@/lib/types/portal';
import type { AgentPrincipal } from '../contracts/capability-definition';

export interface ResolvePortalPrincipalOptions {
  memberContext?: PortalMemberContext;
  portal?: Portal;
}

/**
 * Resolves an authenticated portal member or staff user into an interactive `AgentPrincipal`.
 *
 * @param idToken The Firebase auth client ID token.
 * @param portalId The portal identifier.
 * @param options Optional pre-resolved context for request-level memoization.
 * @returns Fully populated, verified `AgentPrincipal`.
 */
export async function resolvePrincipalFromPortalToken(
  idToken: string,
  portalId: string,
  options?: ResolvePortalPrincipalOptions
): Promise<AgentPrincipal> {
  const memberCtx = options?.memberContext ?? (await requirePortalMember(idToken, portalId));
  const portal = options?.portal ?? (await PortalService.getPortalById(portalId));

  if (!portal) {
    throw new ForbiddenError(`Portal '${portalId}' does not exist.`);
  }

  const workspaceId = portal.workspaceIds?.[0] || portal.id;
  const scopesSet = new Set<string>();

  // Baseline portal visibility
  scopesSet.add('app:portal_view');
  scopesSet.add('portal:member:view');

  if (memberCtx.isPortalStaff) {
    // Staff privileges inside the portal context
    scopesSet.add('app:portal_manage');
    scopesSet.add('portal:staff:manage');
    scopesSet.add('portal:courses:manage');
    scopesSet.add('portal:community:manage');
    scopesSet.add('portal:members:manage');
  } else {
    // Standard learner/member permissions
    scopesSet.add('portal:member:participate');

    if (portal.features?.enableCourses) {
      scopesSet.add('portal:courses:view');
    }
    if (portal.features?.enableCommunity) {
      scopesSet.add('portal:community:view');
      scopesSet.add('portal:community:post');
    }
    if (memberCtx.membership?.status === 'active') {
      scopesSet.add('portal:membership:active');
    }
  }

  const effectiveRole = memberCtx.isPortalStaff
    ? 'portal_staff'
    : memberCtx.membership?.role || 'portal_member';

  return {
    actorType: 'user',
    userId: memberCtx.uid,
    organizationId: portal.organizationId,
    workspaceId,
    grantedScopes: Array.from(scopesSet),
    effectiveRole,
  };
}
