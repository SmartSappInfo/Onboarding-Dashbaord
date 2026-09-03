/**
 * @fileOverview Onboarding Instance State Machine Service (Onboarding 2.0)
 *
 * Manages active member onboarding lifecycles, step progress submission,
 * completion gate validation, projection synchronization, and chunked bulk assignments.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - On final completion, automatically calls `IdentityProjectionService.syncUserProjection()`.
 * - Chunked bulk assignments strictly enforce <= 250 operations per batch.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `onboarding-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  OnboardingInstance,
  OnboardingStepInstance,
  OnboardingInstanceStatus,
  Person,
} from '@/lib/types';
import { OnboardingJourneyService } from './onboarding-journey-service';
import { AdaptiveConditionEvaluator, MemberEvaluationContext } from './adaptive-condition-evaluator';
import { PersonService } from '@/lib/services/identity/person-service';
import { IdentityProjectionService } from '@/lib/services/identity/identity-projection-service';
import { IdentityMigrationService } from '@/lib/services/identity/identity-migration-service';

export class OnboardingInstanceService {
  private static collectionName = 'onboarding_instances';

  /**
   * Initializes an active onboarding instance for a member.
   */
  static async startInstance(
    organizationId: string,
    personId: string,
    journeyId?: string,
    context?: MemberEvaluationContext
  ): Promise<OnboardingInstance> {
    // 1. Fetch Person Details (gracefully hydrate from legacy users doc if not yet migrated)
    let person = await PersonService.getPerson(personId);
    if (!person) {
      person = await IdentityMigrationService.getOrMigratePerson(personId, organizationId);
    }
    if (!person) {
      throw new Error(`Person not found: ${personId}`);
    }

    // 2. Resolve Journey
    let journey = journeyId ? await OnboardingJourneyService.getJourney(journeyId) : null;
    if (!journey) {
      journey = await OnboardingJourneyService.getDefaultJourney(organizationId);
    }

    // 3. Build Evaluation Context
    const evalContext: MemberEvaluationContext = {
      department: person.departmentId,
      roles: context?.roles || [],
      workspaceId: context?.workspaceId,
      memberType: context?.memberType || 'staff',
      email: person.email,
    };

    // 4. Filter Applicable Steps via Adaptive Evaluator
    const applicableSteps = journey.steps.filter((s) =>
      AdaptiveConditionEvaluator.isStepApplicable(s.conditions, evalContext)
    );

    if (applicableSteps.length === 0) {
      throw new Error('No applicable steps in journey for this member profile.');
    }

    // 5. Initialize Step Instances
    const stepInstances: OnboardingStepInstance[] = applicableSteps.map((s, idx) => ({
      id: `step-inst-${idx + 1}-${Date.now()}`,
      stepId: s.id,
      stepTitle: s.title,
      type: s.type,
      status: idx === 0 ? 'in_progress' : 'pending',
    }));

    const docRef = adminDb.collection(this.collectionName).doc();
    const now = new Date().toISOString();

    const instance: OnboardingInstance = {
      id: docRef.id,
      journeyId: journey.id,
      journeyName: journey.name,
      journeyVersion: journey.version,
      personId: person.id,
      personName: person.displayName,
      personEmail: person.email,
      organizationId,
      status: 'in_progress',
      currentStepIndex: 0,
      totalSteps: stepInstances.length,
      completionPercent: 0,
      stepInstances,
      startedAt: now,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(instance);
    return instance;
  }

  /**
   * Submits responses for a step, marks it complete, advances step index, and checks completion.
   */
  static async submitStepProgress(
    organizationId: string,
    instanceId: string,
    stepId: string,
    responseData?: Record<string, string | number | boolean | string[]>
  ): Promise<OnboardingInstance> {
    const docRef = adminDb.collection(this.collectionName).doc(instanceId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new Error(`Onboarding instance not found: ${instanceId}`);
    }

    const instance = snap.data() as OnboardingInstance;
    if (instance.organizationId !== organizationId) {
      throw new Error('Tenant boundary mismatch');
    }

    const now = new Date().toISOString();
    let stepFound = false;

    const updatedSteps = instance.stepInstances.map((s, idx) => {
      if (s.stepId === stepId || s.id === stepId) {
        stepFound = true;
        return {
          ...s,
          status: 'completed' as const,
          responseData: responseData || s.responseData,
          completedAt: now,
        };
      }
      return s;
    });

    if (!stepFound) {
      throw new Error(`Step ID not found in instance: ${stepId}`);
    }

    // Recalculate completion metrics
    const completedCount = updatedSteps.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
    const completionPercent = Math.round((completedCount / instance.totalSteps) * 100);
    const isFinished = completedCount === instance.totalSteps;

    // Advance currentStepIndex to next pending step
    let nextStepIdx = instance.currentStepIndex;
    for (let i = 0; i < updatedSteps.length; i++) {
      if (updatedSteps[i].status === 'pending') {
        updatedSteps[i].status = 'in_progress';
        nextStepIdx = i;
        break;
      }
    }

    const newStatus: OnboardingInstanceStatus = isFinished ? 'completed' : 'in_progress';

    const updatedInstance: OnboardingInstance = {
      ...instance,
      status: newStatus,
      currentStepIndex: nextStepIdx,
      completionPercent,
      stepInstances: updatedSteps,
      completedAt: isFinished ? now : instance.completedAt,
      lastActivityAt: now,
      updatedAt: now,
    };

    await docRef.set(updatedInstance, { merge: true });

    // If journey completed, activate member and sync projection
    if (isFinished) {
      await this.handleJourneyCompletion(organizationId, instance.personId);
    }

    return updatedInstance;
  }

  /**
   * Activates member upon onboarding journey completion.
   */
  private static async handleJourneyCompletion(organizationId: string, personId: string): Promise<void> {
    try {
      // 1. Mark Organization Membership as active
      const memSnap = await adminDb
        .collection('organization_memberships')
        .where('organizationId', '==', organizationId)
        .where('personId', '==', personId)
        .limit(1)
        .get();

      if (!memSnap.empty) {
        await memSnap.docs[0].ref.update({
          status: 'active',
          updatedAt: new Date().toISOString(),
        });
      }

      // 2. Synchronize user projection
      await IdentityProjectionService.syncUserProjection(organizationId, personId);

      // 3. Mark onboardingCompleted: true on users/{personId} so guards grant dashboard entry
      const now = new Date().toISOString();
      await adminDb.collection('users').doc(personId).set(
        {
          onboardingCompleted: true,
          onboardingStatus: 'completed',
          profileCompleted: true,
          updatedAt: now,
        },
        { merge: true }
      );
    } catch (err: unknown) {
      console.warn('[OnboardingInstanceService] Failed to finalize completion:', err);
    }
  }

  /**
   * Fetches an onboarding instance by ID.
   */
  static async getInstance(instanceId: string): Promise<OnboardingInstance | null> {
    const docRef = adminDb.collection(this.collectionName).doc(instanceId);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return snap.data() as OnboardingInstance;
  }

  /**
   * Fetches active instance for a specific person.
   */
  static async getInstanceByPerson(
    organizationId: string,
    personId: string
  ): Promise<OnboardingInstance | null> {
    const snap = await adminDb
      .collection(this.collectionName)
      .where('organizationId', '==', organizationId)
      .where('personId', '==', personId)
      .where('status', 'in', ['in_progress', 'waiting_approval'])
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as OnboardingInstance;
  }

  /**
   * Lists onboarding instances for an organization.
   */
  static async listInstances(
    organizationId: string,
    options?: {
      status?: OnboardingInstanceStatus;
      journeyId?: string;
    }
  ): Promise<OnboardingInstance[]> {
    let q = adminDb.collection(this.collectionName).where('organizationId', '==', organizationId);

    if (options?.status) {
      q = q.where('status', '==', options.status);
    }
    if (options?.journeyId) {
      q = q.where('journeyId', '==', options.journeyId);
    }

    const snap = await q.get();
    const results = snap.docs.map((d) => d.data() as OnboardingInstance);

    // Sort by last activity descending
    return results.sort((a, b) => (b.lastActivityAt || '').localeCompare(a.lastActivityAt || ''));
  }

  /**
   * Mass assign an onboarding journey to multiple members in safe chunks of <= 250 write operations.
   */
  static async bulkAssignJourney(
    organizationId: string,
    personIds: string[],
    journeyId: string
  ): Promise<{ assignedCount: number; errors: Array<{ personId: string; error: string }> }> {
    const CHUNK_SIZE = 250;
    let assignedCount = 0;
    const errors: Array<{ personId: string; error: string }> = [];

    for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
      const chunk = personIds.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();

      for (const personId of chunk) {
        try {
          const person = await PersonService.getPerson(personId);
          if (!person) {
            errors.push({ personId, error: 'Person not found' });
            continue;
          }

          const journey = await OnboardingJourneyService.getJourney(journeyId);
          if (!journey) {
            errors.push({ personId, error: 'Journey not found' });
            continue;
          }

          const docRef = adminDb.collection(this.collectionName).doc();
          const now = new Date().toISOString();

          const stepInstances: OnboardingStepInstance[] = journey.steps.map((s, idx) => ({
            id: `step-inst-${idx + 1}-${Date.now()}`,
            stepId: s.id,
            stepTitle: s.title,
            type: s.type,
            status: idx === 0 ? 'in_progress' : 'pending',
          }));

          const instance: OnboardingInstance = {
            id: docRef.id,
            journeyId: journey.id,
            journeyName: journey.name,
            journeyVersion: journey.version,
            personId: person.id,
            personName: person.displayName,
            personEmail: person.email,
            organizationId,
            status: 'in_progress',
            currentStepIndex: 0,
            totalSteps: stepInstances.length,
            completionPercent: 0,
            stepInstances,
            startedAt: now,
            lastActivityAt: now,
            createdAt: now,
            updatedAt: now,
          };

          batch.set(docRef, instance);
          assignedCount++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Assignment error';
          errors.push({ personId, error: msg });
        }
      }

      await batch.commit();
    }

    return { assignedCount, errors };
  }

  /**
   * Administrative step override / skip.
   */
  static async adminOverrideStep(
    organizationId: string,
    instanceId: string,
    stepId: string,
    adminUid: string
  ): Promise<OnboardingInstance> {
    const docRef = adminDb.collection(this.collectionName).doc(instanceId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new Error(`Onboarding instance not found: ${instanceId}`);
    }

    const instance = snap.data() as OnboardingInstance;
    if (instance.organizationId !== organizationId) {
      throw new Error('Tenant boundary mismatch');
    }

    const now = new Date().toISOString();
    const updatedSteps = instance.stepInstances.map((s) => {
      if (s.stepId === stepId || s.id === stepId) {
        return {
          ...s,
          status: 'skipped' as const,
          completedAt: now,
          completedBy: adminUid,
        };
      }
      return s;
    });

    const completedCount = updatedSteps.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
    const completionPercent = Math.round((completedCount / instance.totalSteps) * 100);
    const isFinished = completedCount === instance.totalSteps;

    const updatedInstance: OnboardingInstance = {
      ...instance,
      status: isFinished ? 'completed' : instance.status,
      completionPercent,
      stepInstances: updatedSteps,
      completedAt: isFinished ? now : instance.completedAt,
      lastActivityAt: now,
      updatedAt: now,
    };

    await docRef.set(updatedInstance, { merge: true });

    if (isFinished) {
      await this.handleJourneyCompletion(organizationId, instance.personId);
    }

    return updatedInstance;
  }
}
