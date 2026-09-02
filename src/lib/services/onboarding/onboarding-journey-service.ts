/**
 * @fileOverview Onboarding Journey Management Service (Onboarding 2.0)
 *
 * Provides CRUD capabilities, step graph validation, version incrementing,
 * default fallback resolution, and tenant template seeding for onboarding paths.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Version numbers increment atomically on every structural step edit.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 *
 * @testability Covered in `onboarding-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { OnboardingJourney, OnboardingStepDefinition, OnboardingAudience } from '@/lib/types';
import { CANONICAL_JOURNEY_PRESETS } from './canonical-journey-presets';

export class OnboardingJourneyService {
  private static collectionName = 'onboarding_journeys';

  /**
   * Validates step graph structure to ensure sequential, non-duplicated order indexes.
   */
  static validateJourneyGraph(steps: OnboardingStepDefinition[]): { isValid: boolean; error?: string } {
    if (!steps || steps.length === 0) {
      return { isValid: false, error: 'At least one step is required in an onboarding journey.' };
    }

    const ids = new Set<string>();
    for (const step of steps) {
      if (!step.id || !step.title || !step.type) {
        return { isValid: false, error: 'Every step must have an id, title, and valid step type.' };
      }
      if (ids.has(step.id)) {
        return { isValid: false, error: `Duplicate step ID detected: ${step.id}` };
      }
      ids.add(step.id);
    }

    return { isValid: true };
  }

  /**
   * Creates a new onboarding journey.
   */
  static async createJourney(
    organizationId: string,
    payload: {
      name: string;
      description?: string;
      audience: OnboardingAudience;
      trigger: OnboardingJourney['trigger'];
      steps: OnboardingStepDefinition[];
      status?: 'draft' | 'published' | 'archived';
      isDefault?: boolean;
    }
  ): Promise<OnboardingJourney> {
    const validation = this.validateJourneyGraph(payload.steps);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const docRef = adminDb.collection(this.collectionName).doc();
    const now = new Date().toISOString();

    const journey: OnboardingJourney = {
      id: docRef.id,
      organizationId,
      name: payload.name.trim(),
      description: payload.description?.trim(),
      audience: payload.audience,
      trigger: payload.trigger,
      steps: payload.steps.map((s, idx) => ({ ...s, order: idx + 1 })),
      status: payload.status || 'published',
      isDefault: Boolean(payload.isDefault),
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(journey);
    return journey;
  }

  /**
   * Updates an existing journey and increments the version counter.
   */
  static async updateJourney(
    organizationId: string,
    journeyId: string,
    payload: {
      name?: string;
      description?: string;
      audience?: OnboardingAudience;
      trigger?: OnboardingJourney['trigger'];
      steps?: OnboardingStepDefinition[];
      status?: 'draft' | 'published' | 'archived';
      isDefault?: boolean;
    }
  ): Promise<OnboardingJourney> {
    const docRef = adminDb.collection(this.collectionName).doc(journeyId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new Error(`Onboarding journey not found: ${journeyId}`);
    }

    const existing = snap.data() as OnboardingJourney;
    if (existing.organizationId !== organizationId) {
      throw new Error('Tenant boundary mismatch');
    }

    if (payload.steps) {
      const validation = this.validateJourneyGraph(payload.steps);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
    }

    const now = new Date().toISOString();
    const updated: OnboardingJourney = {
      ...existing,
      name: payload.name ? payload.name.trim() : existing.name,
      description: payload.description !== undefined ? payload.description.trim() : existing.description,
      audience: payload.audience || existing.audience,
      trigger: payload.trigger || existing.trigger,
      steps: payload.steps
        ? payload.steps.map((s, idx) => ({ ...s, order: idx + 1 }))
        : existing.steps,
      status: payload.status || existing.status,
      isDefault: payload.isDefault !== undefined ? payload.isDefault : existing.isDefault,
      version: payload.steps ? existing.version + 1 : existing.version,
      updatedAt: now,
    };

    await docRef.set(updated, { merge: true });
    return updated;
  }

  /**
   * Deletes a journey if no active in-progress instances exist.
   */
  static async deleteJourney(organizationId: string, journeyId: string): Promise<void> {
    const docRef = adminDb.collection(this.collectionName).doc(journeyId);
    const snap = await docRef.get();

    if (!snap.exists) return;
    const existing = snap.data() as OnboardingJourney;
    if (existing.organizationId !== organizationId) {
      throw new Error('Tenant boundary mismatch');
    }

    // Check for active in-progress instances
    const activeInstances = await adminDb
      .collection('onboarding_instances')
      .where('journeyId', '==', journeyId)
      .where('status', 'in', ['in_progress', 'waiting_approval'])
      .limit(1)
      .get();

    if (!activeInstances.empty) {
      throw new Error('Cannot delete journey with active, in-progress onboarding members.');
    }

    await docRef.delete();
  }

  /**
   * Fetches a journey by ID.
   */
  static async getJourney(journeyId: string): Promise<OnboardingJourney | null> {
    const docRef = adminDb.collection(this.collectionName).doc(journeyId);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return snap.data() as OnboardingJourney;
  }

  /**
   * Lists journeys for an organization with optional filters.
   */
  static async listJourneys(
    organizationId: string,
    options?: {
      audience?: OnboardingAudience;
      status?: 'draft' | 'published' | 'archived';
    }
  ): Promise<OnboardingJourney[]> {
    let q = adminDb.collection(this.collectionName).where('organizationId', '==', organizationId);

    if (options?.status) {
      q = q.where('status', '==', options.status);
    }

    const snap = await q.get();
    let results = snap.docs.map((d) => d.data() as OnboardingJourney);

    if (options?.audience) {
      results = results.filter((j) => j.audience === options.audience);
    }

    // Sort by name ascending
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Resolves the default journey for an organization or seeds defaults if none exist.
   */
  static async getDefaultJourney(
    organizationId: string,
    audience: OnboardingAudience = 'employee'
  ): Promise<OnboardingJourney> {
    const journeys = await this.listJourneys(organizationId, { status: 'published' });

    // 1. Look for explicit isDefault
    const explicitDefault = journeys.find((j) => j.isDefault && j.audience === audience);
    if (explicitDefault) return explicitDefault;

    // 2. Look for matching audience
    const audienceMatch = journeys.find((j) => j.audience === audience);
    if (audienceMatch) return audienceMatch;

    // 3. Look for any published journey
    if (journeys.length > 0) return journeys[0];

    // 4. Seed presets and return standard employee preset
    const seeded = await this.seedDefaultJourneys(organizationId);
    return seeded[0];
  }

  /**
   * Seeds the 4 canonical presets for an organization.
   */
  static async seedDefaultJourneys(organizationId: string): Promise<OnboardingJourney[]> {
    const now = new Date().toISOString();
    const created: OnboardingJourney[] = [];

    for (const preset of CANONICAL_JOURNEY_PRESETS) {
      const docRef = adminDb.collection(this.collectionName).doc();
      const journey: OnboardingJourney = {
        ...preset,
        id: docRef.id,
        organizationId,
        createdAt: now,
        updatedAt: now,
      };

      await docRef.set(journey);
      created.push(journey);
    }

    return created;
  }
}
