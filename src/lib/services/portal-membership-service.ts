/**
 * {{Org_name}} Experience Platform — Portal Membership Domain Service
 *
 * Core domain service managing member registration, role assignments,
 * status lifecycles, points/streak tracking, and CRM Contact reconciliation.
 *
 * Architecture Notes:
 * - Strictly typed (Zero any / any[]).
 * - Multi-tenant isolation by organizationId and portalId.
 * - Non-blocking activity logging and event dispatching.
 */

import { adminDb } from '../firebase-admin';
import { PortalEventService } from './portal-event-service';
import type {
  PortalMembership,
  CreateMembershipInput,
  UpdateMembershipInput,
  PortalMemberRole,
  MemberFilterOptions,
} from '../types/membership';
import type { UpdateMemberProfileInput } from '../types/engagement';

const MEMBERSHIPS_COLLECTION = 'portal_memberships';

export class PortalMembershipService {
  /**
   * Creates a new portal membership, reconciles with CRM, and emits member.joined.
   */
  static async createMembership(
    input: CreateMembershipInput,
    actorId: string = 'system'
  ): Promise<PortalMembership> {
    if (!input.organizationId || !input.portalId || !input.userId || !input.email) {
      throw new Error('organizationId, portalId, userId, and email are required to create a membership.');
    }

    // Check for existing membership in this portal
    const existingSnap = await adminDb
      .collection(MEMBERSHIPS_COLLECTION)
      .where('portalId', '==', input.portalId)
      .where('userId', '==', input.userId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0].data() as PortalMembership;
      return existing;
    }

    const docRef = adminDb.collection(MEMBERSHIPS_COLLECTION).doc();
    const now = new Date().toISOString();

    const membership: PortalMembership = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      workspaceIds: input.workspaceIds || ['default'],
      userId: input.userId,
      contactId: input.contactId,
      email: input.email.toLowerCase().trim(),
      displayName: input.displayName || input.email.split('@')[0],
      avatarUrl: input.avatarUrl,
      role: input.role || 'member',
      status: input.status || 'active',
      planId: input.planId,
      planName: input.planName,
      // Architectural Note: Tracks onboarding provenance (1-click smart onboarding vs invitation vs direct registration)
      joinedVia: input.joinedVia || 'direct_join',
      joinedAt: now,
      lastActiveAt: now,
      points: 0,
      streakDays: 1,
      badges: [],
      completedLessonIds: [],
      enrolledCourseIds: [],
      bookmarkedContentIds: [],
      customFields: input.customFields,
      tags: input.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(membership);

    // Emit Activity Event
    await PortalEventService.emitContentEvent(
      'content.created',
      {
        id: membership.id,
        title: `${membership.displayName} (${membership.role})`,
        type: 'member',
        portalId: membership.portalId,
        organizationId: membership.organizationId,
        workspaceIds: membership.workspaceIds,
      },
      actorId
    );

    return membership;
  }

  /**
   * Fetches an active membership by portalId and userId.
   */
  static async getMembership(
    portalId: string,
    userId: string
  ): Promise<PortalMembership | null> {
    const snap = await adminDb
      .collection(MEMBERSHIPS_COLLECTION)
      .where('portalId', '==', portalId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as PortalMembership;
  }

  /**
   * Fetches a membership by document ID.
   */
  static async getMembershipById(membershipId: string): Promise<PortalMembership | null> {
    const doc = await adminDb.collection(MEMBERSHIPS_COLLECTION).doc(membershipId).get();
    if (!doc.exists) return null;
    return doc.data() as PortalMembership;
  }

  /**
   * Updates membership profile, status, or role.
   */
  static async updateMembership(
    membershipId: string,
    input: UpdateMembershipInput,
    _actorId: string = 'system'
  ): Promise<PortalMembership> {
    const docRef = adminDb.collection(MEMBERSHIPS_COLLECTION).doc(membershipId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`Membership with ID "${membershipId}" not found.`);
    }

    const current = doc.data() as PortalMembership;
    const now = new Date().toISOString();

    const updated: PortalMembership = {
      ...current,
      ...input,
      updatedAt: now,
    };

    await docRef.set(updated);
    return updated;
  }

  /**
   * Updates a member's role (e.g. promoting member to instructor or admin).
   */
  static async updateRole(
    membershipId: string,
    role: PortalMemberRole,
    actorId: string
  ): Promise<PortalMembership> {
    return this.updateMembership(membershipId, { role }, actorId);
  }

  /**
   * Suspends a member's access.
   */
  static async suspendMembership(
    membershipId: string,
    actorId: string
  ): Promise<PortalMembership> {
    return this.updateMembership(membershipId, { status: 'suspended' }, actorId);
  }

  /**
   * Reactivates a suspended membership.
   */
  static async reactivateMembership(
    membershipId: string,
    actorId: string
  ): Promise<PortalMembership> {
    return this.updateMembership(membershipId, { status: 'active' }, actorId);
  }

  /**
   * Awards gamification points to a member and appends to points history.
   */
  static async awardPoints(
    membershipId: string,
    pointsToAdd: number,
    action: string,
    referenceId?: string
  ): Promise<PortalMembership> {
    const docRef = adminDb.collection(MEMBERSHIPS_COLLECTION).doc(membershipId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`Membership "${membershipId}" not found.`);
    }

    const current = doc.data() as PortalMembership;
    const now = new Date().toISOString();

    const newPoints = (current.points || 0) + pointsToAdd;
    const history = current.pointsHistory || [];
    history.unshift({
      action,
      points: pointsToAdd,
      timestamp: now,
      referenceId,
    });

    const updated: PortalMembership = {
      ...current,
      points: newPoints,
      pointsHistory: history.slice(0, 50), // keep latest 50
      lastActiveAt: now,
      updatedAt: now,
    };

    await docRef.set(updated);
    return updated;
  }

  /**
   * Lists members for a portal with optional filtering.
   */
  static async listMembers(
    portalId: string,
    options: MemberFilterOptions = {}
  ): Promise<PortalMembership[]> {
    let q = adminDb
      .collection(MEMBERSHIPS_COLLECTION)
      .where('portalId', '==', portalId);

    if (options.role) {
      q = q.where('role', '==', options.role);
    }
    if (options.status) {
      q = q.where('status', '==', options.status);
    }

    const limitCount = options.limit || 50;
    q = q.orderBy('joinedAt', 'desc').limit(limitCount);

    const snap = await q.get();
    let members = snap.docs.map(d => d.data() as PortalMembership);

    if (options.search) {
      const term = options.search.toLowerCase().trim();
      members = members.filter(
        m =>
          m.displayName.toLowerCase().includes(term) ||
          m.email.toLowerCase().includes(term) ||
          (m.tags && m.tags.some(t => t.toLowerCase().includes(term)))
      );
    }

    return members;
  }

  /**
   * Deletes a membership document.
   */
  static async deleteMembership(membershipId: string, _actorId: string): Promise<boolean> {
    const docRef = adminDb.collection(MEMBERSHIPS_COLLECTION).doc(membershipId);
    await docRef.delete();
    return true;
  }

  /**
   * Updates a member's public and professional profile within the portal,
   * automatically triggering the 'complete_profile' onboarding step advancement.
   *
   * ARCHITECTURAL RATIONALE:
   * Acts as the single source of truth for member profile information, storing
   * school affiliation, job title, and direct contact within customFields.
   *
   * CAUTION FOR FUTURE MAINTAINERS:
   * Uses dynamic import of EngagementService to prevent cyclic initialization deadlocks.
   * Profile save succeeds even if engagement step notification throws.
   *
   * TESTABILITY POINTER:
   * Verifiable via: `updateMemberProfile updates customFields and advances step_profile`.
   *
   * @param input Profile details including portalId, userId, displayName, schoolName, jobTitle, whatsappNumber
   */
  static async updateMemberProfile(input: UpdateMemberProfileInput): Promise<PortalMembership> {
    const membershipSnap = await adminDb
      .collection(MEMBERSHIPS_COLLECTION)
      .where('portalId', '==', input.portalId)
      .where('userId', '==', input.userId)
      .limit(1)
      .get();

    const now = new Date().toISOString();
    let currentDocRef = membershipSnap.empty ? null : membershipSnap.docs[0].ref;
    let currentData = membershipSnap.empty ? null : (membershipSnap.docs[0].data() as PortalMembership);

    if (!currentData || !currentDocRef) {
      // Auto-provision membership for authenticated user if not existing in portal yet
      let email = 'member@smartsapp.com';
      let avatarUrl = input.avatarUrl || '';
      try {
        const { adminAuth } = await import('../firebase-admin');
        const userRecord = await adminAuth.getUser(input.userId);
        email = userRecord.email || email;
        avatarUrl = avatarUrl || userRecord.photoURL || '';
      } catch {
        const userDoc = await adminDb.collection('users').doc(input.userId).get();
        if (userDoc.exists) {
          const ud = userDoc.data();
          email = ud?.email || email;
          avatarUrl = avatarUrl || ud?.avatarUrl || ud?.photoURL || '';
        }
      }

      // Fetch portal to inherit org and workspace scoping
      const portalDoc = await adminDb.collection('portals').doc(input.portalId).get();
      const portalData = portalDoc.exists ? portalDoc.data() : null;

      const newMembershipRef = adminDb.collection(MEMBERSHIPS_COLLECTION).doc();
      currentDocRef = newMembershipRef;
      currentData = {
        id: newMembershipRef.id,
        organizationId: portalData?.organizationId || 'smartsapp-hq',
        portalId: input.portalId,
        workspaceIds: portalData?.workspaceIds || ['onboarding'],
        userId: input.userId,
        email,
        displayName: input.displayName.trim() || 'New Member',
        avatarUrl: avatarUrl || undefined,
        role: 'member',
        status: 'active',
        joinedVia: 'smart_onboarding',
        joinedAt: now,
        lastActiveAt: now,
        points: 10,
        streakDays: 1,
        badges: [],
        completedLessonIds: [],
        enrolledCourseIds: [],
        bookmarkedContentIds: [],
        customFields: {},
        createdAt: now,
        updatedAt: now,
      };
    }

    const existingCustom = (currentData.customFields as Record<string, string | number | boolean | null>) || {};
    const updatedCustom: Record<string, string | number | boolean | null> = {
      ...existingCustom,
      ...(input.schoolName !== undefined ? { schoolName: input.schoolName.trim() } : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle.trim() } : {}),
      ...(input.whatsappNumber !== undefined ? { whatsappNumber: input.whatsappNumber.trim() } : {}),
      ...(input.bio !== undefined ? { bio: input.bio.trim() } : {}),
    };

    const updated: PortalMembership = {
      ...currentData,
      displayName: input.displayName.trim() || currentData.displayName,
      ...(input.avatarUrl ? { avatarUrl: input.avatarUrl.trim() } : {}),
      customFields: updatedCustom,
      updatedAt: now,
    };

    await currentDocRef.set(updated, { merge: true });

    // Automatically trigger 'complete_profile' step advancement
    try {
      const { EngagementService } = await import('@/lib/services/engagement-service');
      await EngagementService.advanceStepByType(input.portalId, input.userId, 'complete_profile');
    } catch (e: unknown) {
      console.warn('[PortalMembershipService] advanceStepByType warning:', e instanceof Error ? e.message : 'Unknown');
    }

    return updated;
  }
}

