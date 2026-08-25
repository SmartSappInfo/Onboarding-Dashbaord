/**
 * {{Org_name}} Experience Platform — Membership Plans & Tiers Service
 *
 * Manages Free, Monthly, Annual, and Lifetime pricing tiers, feature lists,
 * and associated unlocked resource entitlements.
 *
 * Architecture Notes:
 * - Strictly typed (Zero any / any[]).
 * - Multi-tenant isolation by organizationId and portalId.
 */

import { adminDb } from '../firebase-admin';
import type {
  MembershipPlan,
  CreatePlanInput,
  UpdatePlanInput,
} from '../types/membership';

const PLANS_COLLECTION = 'membership_plans';

export class MembershipPlanService {
  /**
   * Generates a clean URL slug for the plan.
   */
  static sanitizeSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Creates a new membership plan tier.
   */
  static async createPlan(
    input: CreatePlanInput,
    actorId: string = 'system'
  ): Promise<MembershipPlan> {
    if (!input.organizationId || !input.portalId || !input.name) {
      throw new Error('organizationId, portalId, and name are required.');
    }

    const docRef = adminDb.collection(PLANS_COLLECTION).doc();
    const now = new Date().toISOString();
    const slug = input.slug || this.sanitizeSlug(input.name);

    const plan: MembershipPlan = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      workspaceIds: input.workspaceIds || ['default'],
      name: input.name,
      slug,
      description: input.description,
      price: input.price ?? 0,
      currency: input.currency || 'USD',
      interval: input.interval || 'monthly',
      trialDays: input.trialDays,
      features: input.features || [],
      badgeText: input.badgeText,
      isPopular: input.isPopular || false,
      order: input.order ?? 0,
      status: 'active',
      unlockedResourceIds: input.unlockedResourceIds || [],
      unlockedCourseIds: input.unlockedCourseIds || [],
      unlockedSpaceIds: input.unlockedSpaceIds || [],
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(plan);
    return plan;
  }

  /**
   * Fetches a plan by document ID.
   */
  static async getPlanById(planId: string): Promise<MembershipPlan | null> {
    const doc = await adminDb.collection(PLANS_COLLECTION).doc(planId).get();
    if (!doc.exists) return null;
    return doc.data() as MembershipPlan;
  }

  /**
   * Updates an existing membership plan.
   */
  static async updatePlan(
    planId: string,
    input: UpdatePlanInput,
    actorId: string = 'system'
  ): Promise<MembershipPlan> {
    const docRef = adminDb.collection(PLANS_COLLECTION).doc(planId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`Membership plan "${planId}" not found.`);
    }

    const current = doc.data() as MembershipPlan;
    const now = new Date().toISOString();

    const updated: MembershipPlan = {
      ...current,
      ...input,
      updatedAt: now,
    };

    await docRef.set(updated);
    return updated;
  }

  /**
   * Archives a plan so it is hidden from checkout while preserving existing memberships.
   */
  static async archivePlan(planId: string, actorId: string = 'system'): Promise<MembershipPlan> {
    return this.updatePlan(planId, { status: 'archived' }, actorId);
  }

  /**
   * Lists active plans for a portal ordered by tier level.
   */
  static async listPortalPlans(
    portalId: string,
    includeArchived: boolean = false
  ): Promise<MembershipPlan[]> {
    let q = adminDb.collection(PLANS_COLLECTION).where('portalId', '==', portalId);

    if (!includeArchived) {
      q = q.where('status', '==', 'active');
    }

    const snap = await q.get();
    const plans = snap.docs.map(d => d.data() as MembershipPlan);
    return plans.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.price - b.price);
  }
}
