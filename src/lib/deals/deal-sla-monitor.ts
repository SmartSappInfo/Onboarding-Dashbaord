/**
 * @fileoverview Deals Platform 2.0 SLA Breach & Stagnation Detection Engine
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 122 & Sections 17, 105, 110):
 * - Evaluates active pipeline deals against configured stage SLA targets (`slaDays`).
 * - Detects SLA breaches and stagnation states deterministically using the pure calculation engine.
 * - Emits `deal.sla.breached` and `deal.stalled` domain events to trigger automated escalation
 *   workflows, notifications, and AI interventions.
 * - Enforces throttled alerting (24-hour cooldown per deal) to eliminate notification storms.
 * - Safely batches Firestore updates in chunks <= 350 operations (Rule 8).
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 8, Rule 5):
 * - Zero 'any' / zero 'any[]'.
 * - Safe against division by zero and undefined stages.
 * - Idempotent evaluation with timestamp guards.
 *
 * TESTABILITY POINTER:
 * Unit tests in `src/lib/deals/__tests__/deal-event-bus.test.ts` and `src/app/actions/__tests__/deal-actions.phase5.test.ts`.
 */

'use server';

import { adminDb } from '../firebase-admin';
import { calculateDaysInStage, calculateDealHealth } from './deal-health-engine';
import { emitDealDomainEvent } from './deal-event-bus';
import type { Deal, OnboardingStage } from '../types';

export interface SlaEvaluationResult {
  success: boolean;
  totalEvaluated: number;
  breachedCount: number;
  stalledCount: number;
  alertedCount: number;
  error?: string;
}

const BATCH_SIZE = 350; // Strict margin under 500-op Firestore ceiling (Rule 8)
const ALERT_COOLDOWN_HOURS = 24;

/**
 * Scans open deals within a workspace and triggers SLA breach and stagnation events.
 */
export async function evaluateWorkspaceDealSlasAction(
  workspaceId: string,
  options?: { forceAlert?: boolean; now?: string }
): Promise<SlaEvaluationResult> {
  try {
    const fixedNow = options?.now ? new Date(options.now) : new Date();
    const nowIso = fixedNow.toISOString();

    // 1. Fetch active open deals for this workspace
    const dealsSnap = await adminDb
      .collection('deals')
      .where('workspaceId', '==', workspaceId)
      .where('status', '==', 'open')
      .get();

    if (dealsSnap.empty) {
      return {
        success: true,
        totalEvaluated: 0,
        breachedCount: 0,
        stalledCount: 0,
        alertedCount: 0,
      };
    }

    // 2. Fetch stages for lookup
    const stagesSnap = await adminDb
      .collection('onboardingStages')
      .where('workspaceId', '==', workspaceId)
      .get();

    const stagesMap = new Map<string, OnboardingStage>();
    stagesSnap.docs.forEach(doc => {
      stagesMap.set(doc.id, { id: doc.id, ...doc.data() } as OnboardingStage);
    });

    let totalEvaluated = 0;
    let breachedCount = 0;
    let stalledCount = 0;
    let alertedCount = 0;

    let batch = adminDb.batch();
    let opsInBatch = 0;

    for (const doc of dealsSnap.docs) {
      const deal = { id: doc.id, ...doc.data() } as Deal;
      if (deal.isArchived) continue;

      totalEvaluated++;
      const stage = deal.stageId ? stagesMap.get(deal.stageId) : undefined;
      const daysInStage = calculateDaysInStage(deal.stageEnteredAt || deal.createdAt, undefined, fixedNow);
      const health = calculateDealHealth(deal, stage, undefined, fixedNow);

      const isSlaBreached = Boolean(stage?.slaDays && daysInStage > stage.slaDays);
      const isStalled = health.status === 'stalled';

      if (isSlaBreached) breachedCount++;
      if (isStalled) stalledCount++;

      // Check alert cooldown
      let shouldAlertSla = false;
      if (isSlaBreached) {
        if (!deal.lastSlaAlertAt || options?.forceAlert) {
          shouldAlertSla = true;
        } else {
          const lastAlertDate = new Date(deal.lastSlaAlertAt);
          const hoursSinceLastAlert = (fixedNow.getTime() - lastAlertDate.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastAlert >= ALERT_COOLDOWN_HOURS) {
            shouldAlertSla = true;
          }
        }
      }

      // Check state change
      const hasStateChanged =
        deal.isSlaBreached !== isSlaBreached ||
        (shouldAlertSla && deal.lastSlaAlertAt !== nowIso);

      if (shouldAlertSla) {
        alertedCount++;
        emitDealDomainEvent('deal.sla.breached', {
          dealId: deal.id,
          dealName: deal.name,
          workspaceId: deal.workspaceId,
          organizationId: deal.organizationId,
          entityId: deal.entityId,
          pipelineId: deal.pipelineId,
          stageId: deal.stageId,
          status: deal.status,
          value: deal.value,
          assignedTo: deal.assignedTo,
          metadata: {
            daysInStage,
            slaDays: stage?.slaDays,
            breachDays: stage?.slaDays ? daysInStage - stage.slaDays : 0,
            healthStatus: health.status,
          },
        });
      }

      if (isStalled && !deal.metadata?.isStalledAlerted) {
        emitDealDomainEvent('deal.stalled', {
          dealId: deal.id,
          dealName: deal.name,
          workspaceId: deal.workspaceId,
          organizationId: deal.organizationId,
          entityId: deal.entityId,
          pipelineId: deal.pipelineId,
          stageId: deal.stageId,
          status: deal.status,
          value: deal.value,
          assignedTo: deal.assignedTo,
          metadata: {
            daysInStage,
            healthStatus: health.status,
          },
        });
      }

      if (hasStateChanged) {
        batch.update(doc.ref, {
          isSlaBreached,
          slaBreachedAt: isSlaBreached ? deal.slaBreachedAt || nowIso : null,
          lastSlaAlertAt: shouldAlertSla ? nowIso : deal.lastSlaAlertAt || null,
          updatedAt: nowIso,
        });

        opsInBatch++;
        if (opsInBatch >= BATCH_SIZE) {
          await batch.commit();
          batch = adminDb.batch();
          opsInBatch = 0;
        }
      }
    }

    if (opsInBatch > 0) {
      await batch.commit();
    }

    return {
      success: true,
      totalEvaluated,
      breachedCount,
      stalledCount,
      alertedCount,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'SLA evaluation failed';
    console.error('[DealSlaMonitor] Error evaluating deal SLAs:', err);
    return {
      success: false,
      totalEvaluated: 0,
      breachedCount: 0,
      stalledCount: 0,
      alertedCount: 0,
      error: message,
    };
  }
}
