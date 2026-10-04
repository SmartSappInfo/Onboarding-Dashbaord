/**
 * @fileOverview Interactive Human Input Bridge (Phase 7 Milestone 3)
 *
 * Implements validation, prompt injection scanning (Rule 30), and execution bridge
 * for the `human_input` wait condition.
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): Strictly typed throughout via Zod v4.
 * 2. PROMPT INJECTION ISOLATION (Rule 13 & 30): Scans inputData for adversarial directives.
 * 3. ANTI-IDOR & MULTI-TENANCY (Rule 8 & 47): Validates tenant boundaries.
 * 4. PROVENANCE TRACKING (Rule 40): Captures submittedBy, notes, and timestamp.
 */

import { z } from 'zod/v4';
import type { WorkflowResumptionService } from './workflow-resumption-service';
import type { StepResumptionResult } from './workflow-resumption-types';
import { WorkflowResumptionError } from './workflow-resumption-types';
import { evaluateMemoryContentRisk } from '@/platform/memory/governance/anti-poisoning';

export const SubmitHumanInputSchema = z.object({
  workflowId: z.string().min(1),
  stepId: z.string().min(1),
  token: z.string().min(1),
  tenant: z.object({
    organizationId: z.string().min(1),
    workspaceId: z.string().min(1),
  }),
  submittedBy: z.string().min(1),
  inputData: z.record(z.string(), z.unknown()),
  notes: z.string().optional(),
});

export type SubmitHumanInput = z.infer<typeof SubmitHumanInputSchema>;

/**
 * Validates and submits human input data to resume a waiting workflow step.
 */
export async function submitHumanInput(
  input: SubmitHumanInput,
  resumptionService: WorkflowResumptionService
): Promise<StepResumptionResult> {
  const parseResult = SubmitHumanInputSchema.safeParse(input);
  if (!parseResult.success) {
    throw new WorkflowResumptionError(
      'WAIT_CONDITION_MISMATCH',
      `Invalid human input submission: ${JSON.stringify(parseResult.error.format())}`
    );
  }

  const valid = parseResult.data;

  // 1. Anti-Poisoning & Prompt Injection Check (Rule 13 & 30)
  const serialized = JSON.stringify(valid.inputData);
  const risk = evaluateMemoryContentRisk(serialized);
  if (!risk.isSafe) {
    throw new WorkflowResumptionError(
      'PROMPT_INJECTION_DETECTED',
      `Adversarial prompt injection pattern detected in human input: ${risk.detectedPatterns.join(', ')}`
    );
  }

  // 2. Delegate to Resumption Service
  return resumptionService.resumeStep({
    workflowId: valid.workflowId,
    stepId: valid.stepId,
    token: valid.token,
    tenant: valid.tenant,
    source: 'human_input',
    signalData: {
      ...valid.inputData,
      _humanSubmittedBy: valid.submittedBy,
      _humanNotes: valid.notes,
      _submittedAt: new Date().toISOString(),
    },
    verifiedBy: valid.submittedBy,
  });
}
