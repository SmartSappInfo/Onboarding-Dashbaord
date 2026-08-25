/**
 * {{Org_name}} Experience Platform — Entitlements & Access Grants Engine
 *
 * Centralized authorization backbone evaluating whether a Member has valid
 * permission to access a protected Resource (Course, Lesson, Content Item, Space, Vault).
 *
 * Architecture Notes:
 * - Strictly typed (Zero any / any[]).
 * - Multi-tier evaluation: Admin Bypass -> Direct Grants -> Membership Plan Unlocks -> Public Fallback.
 * - Dynamic time-bound expiration checks.
 */

import { adminDb } from '../firebase-admin';
import { PortalMembershipService } from './portal-membership-service';
import { MembershipPlanService } from './membership-plan-service';
import type {
  AccessGrant,
  GrantAccessInput,
  EntitlementCheckResult,
  ResourceType,
  PortalMembership,
} from '../types/membership';

const GRANTS_COLLECTION = 'access_grants';

export class EntitlementService {
  /**
   * Validates whether an AccessGrant is still within its time bounds.
   */
  static isGrantValid(grant: AccessGrant): boolean {
    if (!grant.expiresAt) return true;
    return new Date(grant.expiresAt) > new Date();
  }

  /**
   * Central Authorization Resolver: Evaluates access to any portal resource.
   */
  static async evaluateEntitlement(
    portalId: string,
    userId: string | null | undefined,
    resourceType: ResourceType,
    resourceId: string,
    isOrgAdmin: boolean = false
  ): Promise<EntitlementCheckResult> {
    // 1. Organization Super Admin / Studios Admin Bypass
    if (isOrgAdmin) {
      return {
        hasAccess: true,
        reason: 'admin_bypass',
      };
    }

    // 2. Unauthenticated Visitor
    if (!userId) {
      return {
        hasAccess: false,
        reason: 'no_entitlement',
      };
    }

    // 3. Fetch Portal Membership
    const membership = await PortalMembershipService.getMembership(portalId, userId);

    if (!membership) {
      return {
        hasAccess: false,
        reason: 'no_entitlement',
      };
    }

    if (membership.status !== 'active') {
      return {
        hasAccess: false,
        reason: 'membership_inactive',
        membership,
      };
    }

    // 4. Portal Owner / Admin Role Bypass
    if (membership.role === 'owner' || membership.role === 'admin' || membership.role === 'instructor') {
      return {
        hasAccess: true,
        reason: 'admin_bypass',
        membership,
      };
    }

    // 5. Direct Access Grant Evaluation
    const grantSnap = await adminDb
      .collection(GRANTS_COLLECTION)
      .where('portalId', '==', portalId)
      .where('userId', '==', userId)
      .where('resourceType', '==', resourceType)
      .where('resourceId', '==', resourceId)
      .limit(1)
      .get();

    if (!grantSnap.empty) {
      const grant = grantSnap.docs[0].data() as AccessGrant;
      if (this.isGrantValid(grant)) {
        return {
          hasAccess: true,
          reason: 'direct_grant',
          membership,
          grant,
        };
      } else {
        return {
          hasAccess: false,
          reason: 'grant_expired',
          membership,
          grant,
        };
      }
    }

    // 6. Membership Plan Tier Unlocks Evaluation
    if (membership.planId) {
      const plan = await MembershipPlanService.getPlanById(membership.planId);
      if (plan && plan.status === 'active') {
        const isCourseUnlocked =
          resourceType === 'course' && (plan.unlockedCourseIds || []).includes(resourceId);
        const isResourceUnlocked =
          (plan.unlockedResourceIds || []).includes(resourceId) ||
          (plan.unlockedSpaceIds || []).includes(resourceId);

        if (isCourseUnlocked || isResourceUnlocked) {
          return {
            hasAccess: true,
            reason: 'plan_entitlement',
            membership,
            matchedPlan: plan,
          };
        }
      }
    }

    // 7. No Entitlement found
    return {
      hasAccess: false,
      reason: 'no_entitlement',
      membership,
    };
  }

  /**
   * Creates an explicit AccessGrant for a member.
   */
  static async grantAccess(
    input: GrantAccessInput,
    actorId: string = 'system'
  ): Promise<AccessGrant> {
    if (!input.organizationId || !input.portalId || !input.userId || !input.resourceId) {
      throw new Error('organizationId, portalId, userId, and resourceId are required.');
    }

    const docRef = adminDb.collection(GRANTS_COLLECTION).doc();
    const now = new Date().toISOString();

    const grant: AccessGrant = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      membershipId: input.membershipId,
      userId: input.userId,
      grantType: input.grantType || 'manual_admin_grant',
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      grantedAt: now,
      expiresAt: input.expiresAt,
      grantedBy: actorId,
      notes: input.notes,
      createdAt: now,
    };

    await docRef.set(grant);
    return grant;
  }

  /**
   * Revokes an explicit AccessGrant by ID.
   */
  static async revokeAccess(grantId: string, actorId: string = 'system'): Promise<boolean> {
    const docRef = adminDb.collection(GRANTS_COLLECTION).doc(grantId);
    await docRef.delete();
    return true;
  }

  /**
   * Lists all active grants for a specific user within a portal.
   */
  static async listUserGrants(portalId: string, userId: string): Promise<AccessGrant[]> {
    const snap = await adminDb
      .collection(GRANTS_COLLECTION)
      .where('portalId', '==', portalId)
      .where('userId', '==', userId)
      .get();

    const grants = snap.docs.map(d => d.data() as AccessGrant);
    return grants.filter(g => this.isGrantValid(g));
  }
}
