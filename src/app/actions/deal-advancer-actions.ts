'use server';

/**
 * @fileoverview Server Actions for CRM Deal Stage Advancement & Sales Effort Events.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Advances deals only when status is 'open' and matching rules are configured.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { DealAdvancementRule, DealAdvancementResult } from '@/lib/meetings/types/deal-advancer';
import { evaluateDealAdvancement } from '@/lib/meetings/deal-advancer-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Evaluates and advances a CRM deal based on a meeting lifecycle outcome trigger.
 */
export async function evaluateAndAdvanceDealOnMeetingAction(payload: {
  dealId: string;
  meetingId: string;
  trigger: 'meeting_completed' | 'proposal_requested' | 'high_intent_detected' | 'no_show';
  rules: DealAdvancementRule[];
}): Promise<{ success: boolean; result?: DealAdvancementResult; error?: string }> {
  try {
    const { dealId, meetingId, trigger, rules } = payload;
    const dealRef = adminDb.collection('deals').doc(dealId);
    const dealSnap = await dealRef.get();

    if (!dealSnap.exists) {
      return { success: false, error: 'Deal not found.' };
    }

    const dealData = dealSnap.data() as {
      stageId: string;
      status: string;
      tags?: string[];
      title?: string;
    };

    const evaluation = evaluateDealAdvancement(
      { id: dealId, stageId: dealData.stageId, status: dealData.status, tags: dealData.tags },
      rules,
      trigger
    );

    if (!evaluation) {
      return { success: true }; // No transition required or deal is closed
    }

    const now = new Date().toISOString();
    const batch = adminDb.batch();

    // 1. Update deal stage and tags
    batch.update(dealRef, {
      stageId: evaluation.newStageId,
      tags: evaluation.appliedTags,
      updatedAt: now,
    });

    // 2. Log sales effort activity note
    if (evaluation.salesEffortLogged) {
      const activityRef = adminDb.collection('deal_activities').doc();
      batch.set(activityRef, {
        id: activityRef.id,
        dealId,
        meetingId,
        type: 'stage_change',
        title: `Auto-advanced from meeting outcome: ${trigger}`,
        previousStageId: evaluation.previousStageId,
        newStageId: evaluation.newStageId,
        timestamp: now,
      });
    }

    await batch.commit();

    return { success: true, result: evaluation };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
