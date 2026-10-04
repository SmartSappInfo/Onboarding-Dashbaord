/**
 * @fileOverview Scheduled Delay Resumption Worker (Phase 7 Milestone 3)
 *
 * Implements timed delay calculation, scheduled execution parameters, and
 * Cloud Tasks bridge for the `schedule` wait condition.
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): Strictly typed throughout via Zod v4.
 * 2. DETERMINISTIC TIMING: Calculates target timestamps from delay seconds or ISO datetime.
 * 3. ANTI-PREMATURE GUARD: Rejects premature execution if target timestamp is significantly in future.
 * 4. ANTI-IDOR & MULTI-TENANCY (Rule 8 & 47): Immutably binds organizationId and workspaceId.
 */

import { z } from 'zod/v4';
import type { WorkflowResumptionService } from './workflow-resumption-service';
import type { StepResumptionResult } from './workflow-resumption-types';
import { WorkflowResumptionError } from './workflow-resumption-types';

export const ScheduleResumePayloadSchema = z.object({
  workflowId: z.string().min(1),
  stepId: z.string().min(1),
  token: z.string().min(1),
  tenant: z.object({
    organizationId: z.string().min(1),
    workspaceId: z.string().min(1),
  }),
  targetTimestamp: z.string().datetime(),
  correlationId: z.string().optional(),
});

export type ScheduleResumePayload = z.infer<typeof ScheduleResumePayloadSchema>;

export interface CalculateScheduleResumeOptions {
  delaySeconds?: number;
  untilIso?: string;
}

export interface CalculateScheduleResumeResult {
  targetDate: Date;
  delaySeconds: number;
  targetTimestamp: string;
}

/**
 * Calculates deterministic target timestamp and delay seconds for scheduled delay resumptions.
 */
export function calculateScheduleResumeTime(
  options: CalculateScheduleResumeOptions
): CalculateScheduleResumeResult {
  let targetDate: Date;

  if (options.delaySeconds !== undefined && options.delaySeconds >= 0) {
    targetDate = new Date(Date.now() + options.delaySeconds * 1000);
  } else if (options.untilIso) {
    const parsed = new Date(options.untilIso);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid untilIso timestamp: ${options.untilIso}`);
    }
    targetDate = parsed;
  } else {
    targetDate = new Date();
  }

  const delaySeconds = Math.max(0, Math.floor((targetDate.getTime() - Date.now()) / 1000));
  return {
    targetDate,
    delaySeconds,
    targetTimestamp: targetDate.toISOString(),
  };
}

/**
 * Executes a scheduled resumption for a waiting workflow step.
 */
export async function executeScheduledResumption(
  payload: ScheduleResumePayload,
  resumptionService: WorkflowResumptionService
): Promise<StepResumptionResult> {
  // Reject premature execution if target timestamp is > 5 seconds in future
  const targetTime = new Date(payload.targetTimestamp).getTime();
  const now = Date.now();
  if (targetTime - now > 5000) {
    throw new WorkflowResumptionError(
      'WAIT_CONDITION_MISMATCH',
      `Premature schedule resumption: target is ${payload.targetTimestamp}, current time is ${new Date(now).toISOString()}`
    );
  }

  return resumptionService.resumeStep({
    workflowId: payload.workflowId,
    stepId: payload.stepId,
    token: payload.token,
    tenant: payload.tenant,
    source: 'schedule',
    signalData: {
      scheduledTarget: payload.targetTimestamp,
      executedAt: new Date(now).toISOString(),
    },
    verifiedBy: 'schedule_resumption_worker',
  });
}
