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
  PortalMembership,
  EntitlementCheckResult,
  ResourceType,
} from '../types/membership';
import type { ContentItem } from '../types/content';
import type { PageBlock } from '../types';

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
  static async revokeAccess(grantId: string, _actorId: string = 'system'): Promise<boolean> {
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

  /**
   * Evaluates visitor/member access specifically for a ContentItem.
   *
   * Hierarchy:
   * 1. Org/System Admin Bypass -> 'admin_bypass'
   * 2. Public Item -> 'public_access'
   * 3. Unauthenticated on Members-Only / Protected -> 'auth_required'
   * 4. Member Status Verification -> 'membership_required' | 'membership_inactive'
   * 5. Role Restrictions -> 'role_restricted'
   * 6. Tier / Plan Entitlements -> 'plan_upgrade_required' | 'plan_entitlement'
   * 7. Active Member Access -> 'member_access'
   */
  static async evaluateContentItemAccess(
    item: ContentItem,
    userId: string | null | undefined,
    portalId: string,
    isOrgAdmin: boolean = false,
    /**
     * Optional preloaded viewer context for evaluating MANY items (catalog, search): pass the member's
     * membership (or null) and their valid grants to avoid one membership + grant read per item.
     */
    viewerContext?: { membership: PortalMembership | null; grants: AccessGrant[] }
  ): Promise<EntitlementCheckResult> {
    // 1. Admin bypass
    if (isOrgAdmin) {
      return { hasAccess: true, reason: 'admin_bypass' };
    }

    // 2. Public items are accessible by all visitors
    if (item.visibility === 'public') {
      return { hasAccess: true, reason: 'public_access' };
    }

    // 3. Unauthenticated visitor cannot access protected items
    if (!userId) {
      return { hasAccess: false, reason: 'auth_required' };
    }

    // 4. Verify membership
    const membership = viewerContext
      ? viewerContext.membership
      : await PortalMembershipService.getMembership(portalId, userId);
    if (!membership) {
      return { hasAccess: false, reason: 'membership_required' };
    }

    if (membership.status !== 'active') {
      return { hasAccess: false, reason: 'membership_inactive', membership };
    }

    // Portal admin / instructor bypass
    if (membership.role === 'owner' || membership.role === 'admin' || membership.role === 'instructor') {
      return { hasAccess: true, reason: 'admin_bypass', membership };
    }

    // 5. Role restrictions
    if (item.accessRoles && item.accessRoles.length > 0) {
      if (!item.accessRoles.includes(membership.role)) {
        return { hasAccess: false, reason: 'role_restricted', membership };
      }
    }

    // 6. Direct Access Grant check for this content item
    if (viewerContext) {
      const grant = viewerContext.grants.find(g => g.resourceType === 'content_item' && g.resourceId === item.id);
      if (grant) return { hasAccess: true, reason: 'direct_grant', membership, grant };
    } else {
      const grantSnap = await adminDb
        .collection(GRANTS_COLLECTION)
        .where('portalId', '==', portalId)
        .where('userId', '==', userId)
        .where('resourceType', '==', 'content_item')
        .where('resourceId', '==', item.id)
        .limit(1)
        .get();

      if (!grantSnap.empty) {
        const grant = grantSnap.docs[0].data() as AccessGrant;
        if (this.isGrantValid(grant)) {
          return { hasAccess: true, reason: 'direct_grant', membership, grant };
        }
      }
    }

    // 7. Plan Tier restrictions
    if (item.requiredPlanIds && item.requiredPlanIds.length > 0) {
      if (!membership.planId || !item.requiredPlanIds.includes(membership.planId)) {
        return {
          hasAccess: false,
          reason: 'plan_upgrade_required',
          membership,
          requiredPlanIds: item.requiredPlanIds,
        };
      }
      return { hasAccess: true, reason: 'plan_entitlement', membership };
    }

    // 8. General Member Access
    return { hasAccess: true, reason: 'member_access', membership };
  }

  /**
   * Sanitizes a ContentItem before returning to a visitor.
   * If visitor does not have full access, content blocks are truncated to the configured teaser
   * and sensitive media download links are stripped, preventing data leaks.
   */
  static sanitizeContentItemForVisitor(
    item: ContentItem,
    accessResult: EntitlementCheckResult
  ): ContentItem {
    if (accessResult.hasAccess) {
      return item;
    }

    // Determine how many blocks to preserve based on teaserMode
    const mode = item.teaserMode || 'first_block';
    let truncatedBlocks: PageBlock[] = [];

    if (mode === 'none' || mode === 'summary') {
      truncatedBlocks = [];
    } else if (mode === 'two_blocks') {
      truncatedBlocks = item.blocks ? item.blocks.slice(0, 2) : [];
    } else {
      // 'first_block' is default
      truncatedBlocks = item.blocks ? item.blocks.slice(0, 1) : [];
    }

    // Body text follows the same teaser rule as the reader: first paragraph, nothing for 'none'.
    // (Round 4 item 4: `content` used to be returned in full for gated items.)
    const teaserContent =
      mode === 'none' || !item.content ? undefined : item.content.split('\n\n')[0] || item.content.slice(0, 250);

    // Only the thumbnail survives: video/audio streams and file links are the paid asset.
    const teaserMedia = item.media?.thumbnailUrl ? { thumbnailUrl: item.media.thumbnailUrl } : undefined;

    return {
      ...item,
      blocks: truncatedBlocks,
      content: teaserContent,
      media: teaserMedia,
      pageDocumentId: undefined,
      isGated: true,
      accessDeniedReason: accessResult.reason,
    };
  }
}
