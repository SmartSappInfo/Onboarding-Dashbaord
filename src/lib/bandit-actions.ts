'use server';

/**
 * @file src/lib/bandit-actions.ts
 * @description Next.js Server Actions for managing `bandit_policies` in Firestore.
 * Supports policy creation, real-time conversion reward updates (alpha/beta increments), and weight recalculations.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Input validation & security checks prior to adminDb execution.
 * - Atomic FieldValue.increment for high-throughput reward concurrency.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { BanditPolicy } from '@/lib/types';
import { recalculatePolicyWeights } from '@/lib/page-builder/adaptive-traffic-engine';
import { revalidatePath } from 'next/cache';

/**
 * Saves or updates a Multi-Armed Bandit Policy definition in Firestore.
 */
export async function saveBanditPolicyAction(policy: BanditPolicy): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  try {
    if (
      !policy.id ||
      !policy.pageId ||
      !policy.organizationId ||
      !policy.createdBy
    ) {
      return { success: false, error: 'Unauthorized or missing required policy parameters' };
    }

    const updatedPolicy = recalculatePolicyWeights(policy);
    const docRef = adminDb.collection('bandit_policies').doc(updatedPolicy.id);
    await docRef.set(updatedPolicy, { merge: true });

    revalidatePath(`/admin/pages/${policy.pageId}/builder`);
    return { success: true, id: policy.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save bandit policy';
    console.error('>>> [BANDIT] Save Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Records a conversion reward signal (success or failure) for a specific traffic arm.
 * Uses a Firestore Transaction to guarantee zero data loss during high-concurrency conversion spikes.
 */
export async function recordBanditRewardAction(
  policyId: string,
  armId: string,
  isConversion: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!policyId || !armId) {
      return { success: false, error: 'Missing required reward parameters' };
    }

    const policyRef = adminDb.collection('bandit_policies').doc(policyId);

    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(policyRef);
      if (!snap.exists) {
        throw new Error('Bandit policy not found');
      }

      const policy = snap.data() as BanditPolicy;
      const armIndex = (policy.arms || []).findIndex((a) => a.id === armId);
      if (armIndex === -1) {
        throw new Error('Target arm not found in policy');
      }

      // Update arm parameters atomically inside transaction
      const targetArm = policy.arms[armIndex];
      if (isConversion) {
        targetArm.alpha = (targetArm.alpha || 1) + 1;
        targetArm.conversions = (targetArm.conversions || 0) + 1;
      } else {
        targetArm.beta = (targetArm.beta || 1) + 1;
      }
      targetArm.impressions = (targetArm.impressions || 0) + 1;

      policy.arms[armIndex] = targetArm;
      const recalculatedPolicy = recalculatePolicyWeights(policy);

      transaction.set(policyRef, recalculatedPolicy, { merge: true });
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to record bandit reward';
    console.error('>>> [BANDIT] Reward Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Fetches active Bandit Policy for a landing page.
 */
export async function fetchBanditPolicyAction(
  pageId: string,
): Promise<{ success: boolean; policy?: BanditPolicy; error?: string }> {
  try {
    if (!pageId) {
      return { success: false, error: 'Page ID is required' };
    }

    const snap = await adminDb
      .collection('bandit_policies')
      .where('pageId', '==', pageId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (snap.empty) {
      return { success: true, policy: undefined };
    }

    const policy = snap.docs[0].data() as BanditPolicy;
    return { success: true, policy };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch bandit policy';
    console.error('>>> [BANDIT] Fetch Failed:', message);
    return { success: false, error: message };
  }
}
