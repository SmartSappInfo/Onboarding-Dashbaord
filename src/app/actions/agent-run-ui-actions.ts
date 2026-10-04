'use server';

/**
 * @fileOverview Secure Next.js 15 Server Actions for Agent Run Mission Control (Phase 8 Milestone 2)
 *
 * Implements server-side authentication, Anti-IDOR tenant enforcement, emergency dead-man
 * pause verification, cooperative cancellation, and run/step querying.
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]` typing policy with Zod v4 schemas.
 * - Rule 8 & 47: Anti-IDOR validation; immutably binds to caller's authenticated session.
 * - Rule 10: Complete inline architectural documentation.
 * - Rule 26: Cooperative cancellation via `CancellationEngine`.
 * - Rule 40: Domain event emission to `defaultEventBus`.
 * - Rule 51: Server Action authentication via `requireAuth()`.
 * - Rule 60: Emergency dead-man switch evaluation (`checkGovernanceDeadManSwitch`).
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { getAgentRunStore } from '@/platform/runtime/agent-run-store';
import { getCancellationEngine } from '@/platform/runtime/governance/cancellation-engine';
import { isCancellableState } from '@/platform/runtime/agent-state-machine';
import {
  AGENT_RUN_STATUSES,
  AGENT_PERSONA_IDS,
  type AgentRunStatus,
  type AgentRun,
  type AgentStep,
} from '@/platform/runtime/agent-run-types';
import { z } from 'zod/v4';

export interface AgentRunActionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// INPUT SCHEMAS (Rule 4 & Rule 10)
// ============================================================================

const ListAgentRunsActionInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().optional(),
  status: z.enum(AGENT_RUN_STATUSES).optional(),
  agentPersonaId: z.enum(AGENT_PERSONA_IDS).optional(),
  search: z.string().optional(),
  timeWindow: z.enum(['1h', '24h', '7d', '30d', 'all']).default('all').optional(),
  limit: z.number().int().min(1).max(100).default(20).optional(),
  cursor: z.string().optional(),
});

export type ListAgentRunsActionInput = z.infer<typeof ListAgentRunsActionInputSchema>;

const GetAgentRunDetailsActionInputSchema = z.object({
  organizationId: z.string().min(1),
  runId: z.string().min(1),
});

export type GetAgentRunDetailsActionInput = z.infer<typeof GetAgentRunDetailsActionInputSchema>;

const CancelAgentRunActionInputSchema = z.object({
  organizationId: z.string().min(1),
  runId: z.string().min(1),
  reason: z.string().min(1).max(500).optional(),
});

export type CancelAgentRunActionInput = z.infer<typeof CancelAgentRunActionInputSchema>;

const GetAgentRunMetricsActionInputSchema = z.object({
  organizationId: z.string().min(1),
});

export type GetAgentRunMetricsActionInput = z.infer<typeof GetAgentRunMetricsActionInputSchema>;

export interface AgentRunMetrics {
  totalRuns: number;
  activeRuns: number;
  waitingApprovals: number;
  completedRuns: number;
  failedRuns: number;
  totalTokensUsed: number;
}

// ============================================================================
// HELPER: Anti-IDOR Enforcement (Rule 8 & 47)
// ============================================================================

function assertTenantContext(
  auth: AuthContext,
  requestedOrgId: string
): void {
  const sessionOrgId = auth.profile?.organizationId;
  if (!auth.isSystemAdmin && sessionOrgId !== requestedOrgId) {
    throw new Error(
      `IDOR_VIOLATION: Authenticated principal from tenant '${sessionOrgId}' cannot access tenant '${requestedOrgId}'.`
    );
  }
}

// ============================================================================
// 1. LIST AGENT RUNS
// ============================================================================

export async function listAgentRunsAction(
  rawInput: ListAgentRunsActionInput
): Promise<AgentRunActionResult<{ runs: AgentRun[]; total: number }>> {
  try {
    const auth = await requireAuth();
    const validatedInput = ListAgentRunsActionInputSchema.parse(rawInput);
    assertTenantContext(auth, validatedInput.organizationId);

    const runStore = getAgentRunStore();
    const result = await runStore.listRuns(validatedInput.organizationId, {
      status: validatedInput.status,
      agentPersonaId: validatedInput.agentPersonaId,
      limit: validatedInput.limit,
    });

    let filteredRuns = result.runs;

    // Apply client-side search query if provided (Rule 9)
    if (validatedInput.search) {
      const q = validatedInput.search.toLowerCase();
      filteredRuns = filteredRuns.filter(
        (r) =>
          r.runId.toLowerCase().includes(q) ||
          r.goal.prompt.toLowerCase().includes(q) ||
          r.agentPersonaId.toLowerCase().includes(q)
      );
    }

    return {
      success: true,
      data: {
        runs: filteredRuns,
        total: result.total,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list agent runs.';
    const isIdor = message.includes('IDOR_VIOLATION');
    const isAuth = message.includes('signed in') || message.includes('authenticated');

    return {
      success: false,
      error: {
        code: isIdor ? 'IDOR_VIOLATION' : isAuth ? 'AUTH_REQUIRED' : 'RUN_QUERY_FAILED',
        message,
      },
    };
  }
}

// ============================================================================
// 2. GET AGENT RUN DETAILS
// ============================================================================

export async function getAgentRunDetailsAction(
  rawInput: GetAgentRunDetailsActionInput
): Promise<AgentRunActionResult<{ run: AgentRun | null; steps: AgentStep[] }>> {
  try {
    const auth = await requireAuth();
    const validatedInput = GetAgentRunDetailsActionInputSchema.parse(rawInput);
    assertTenantContext(auth, validatedInput.organizationId);

    const runStore = getAgentRunStore();
    const run = await runStore.getRun(validatedInput.organizationId, validatedInput.runId);
    const steps = run
      ? await runStore.listSteps(validatedInput.organizationId, validatedInput.runId)
      : [];

    return {
      success: true,
      data: {
        run,
        steps,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve agent run details.';
    const isIdor = message.includes('IDOR_VIOLATION');
    const isAuth = message.includes('signed in') || message.includes('authenticated');

    return {
      success: false,
      error: {
        code: isIdor ? 'IDOR_VIOLATION' : isAuth ? 'AUTH_REQUIRED' : 'RUN_NOT_FOUND',
        message,
      },
    };
  }
}

// ============================================================================
// 3. CANCEL AGENT RUN (Rule 26 & Rule 60)
// ============================================================================

export async function cancelAgentRunAction(
  rawInput: CancelAgentRunActionInput
): Promise<AgentRunActionResult<{ run: AgentRun }>> {
  try {
    const auth = await requireAuth();
    const validatedInput = CancelAgentRunActionInputSchema.parse(rawInput);
    assertTenantContext(auth, validatedInput.organizationId);

    // Rule 60: Emergency Dead-Man Switch Evaluation
    await checkGovernanceDeadManSwitch(validatedInput.organizationId);

    const runStore = getAgentRunStore();
    const existingRun = await runStore.getRun(validatedInput.organizationId, validatedInput.runId);

    if (!existingRun) {
      return {
        success: false,
        error: {
          code: 'RUN_NOT_FOUND',
          message: `Agent run '${validatedInput.runId}' not found.`,
        },
      };
    }

    // Rule 26: Cooperative Cancellation State Verification
    if (!isCancellableState(existingRun.status)) {
      return {
        success: false,
        error: {
          code: 'RUN_NOT_CANCELLABLE',
          message: `Run '${validatedInput.runId}' is in terminal status '${existingRun.status}' and cannot be cancelled.`,
        },
      };
    }

    // Invoke CancellationEngine
    const cancellationEngine = getCancellationEngine();
    await cancellationEngine.cancelRun({
      organizationId: validatedInput.organizationId,
      runId: validatedInput.runId,
      reason: {
        requestedBy: auth.uid,
        reason: validatedInput.reason || 'Cancelled by operator via Run Mission Control',
        timestamp: new Date().toISOString(),
        immediate: false,
        triggerSagaCompensation: true,
      },
    });

    const updatedRun = await runStore.getRun(validatedInput.organizationId, validatedInput.runId);
    if (!updatedRun) {
      throw new Error(`Agent run '${validatedInput.runId}' not found after cancellation.`);
    }

    return {
      success: true,
      data: {
        run: updatedRun,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel agent run.';
    const isIdor = message.includes('IDOR_VIOLATION');
    const isAuth = message.includes('signed in') || message.includes('authenticated');
    const isDeadMan = message.includes('Dead-Man') || message.includes('DEAD_MAN');

    return {
      success: false,
      error: {
        code: isIdor
          ? 'IDOR_VIOLATION'
          : isAuth
          ? 'AUTH_REQUIRED'
          : isDeadMan
          ? 'DEAD_MAN_PAUSED'
          : 'CANCEL_FAILED',
        message,
      },
    };
  }
}

// ============================================================================
// 4. GET AGENT RUN METRICS
// ============================================================================

export async function getAgentRunMetricsAction(
  rawInput: GetAgentRunMetricsActionInput
): Promise<AgentRunActionResult<AgentRunMetrics>> {
  try {
    const auth = await requireAuth();
    const validatedInput = GetAgentRunMetricsActionInputSchema.parse(rawInput);
    assertTenantContext(auth, validatedInput.organizationId);

    const runStore = getAgentRunStore();
    const { runs, total } = await runStore.listRuns(validatedInput.organizationId, {
      limit: 100,
    });

    const activeStatuses: AgentRunStatus[] = [
      'created',
      'queued',
      'planning',
      'context_building',
      'executing',
      'verifying',
      'retrying',
    ];

    let activeRuns = 0;
    let waitingApprovals = 0;
    let completedRuns = 0;
    let failedRuns = 0;
    let totalTokensUsed = 0;

    for (const run of runs) {
      if (activeStatuses.includes(run.status)) {
        activeRuns++;
      } else if (run.status === 'waiting_for_approval') {
        waitingApprovals++;
      } else if (run.status === 'completed') {
        completedRuns++;
      } else if (run.status === 'failed') {
        failedRuns++;
      }

      totalTokensUsed += run.budgetUsage?.tokensUsed || 0;
    }

    return {
      success: true,
      data: {
        totalRuns: total,
        activeRuns,
        waitingApprovals,
        completedRuns,
        failedRuns,
        totalTokensUsed,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to calculate run metrics.';
    const isIdor = message.includes('IDOR_VIOLATION');
    const isAuth = message.includes('signed in') || message.includes('authenticated');

    return {
      success: false,
      error: {
        code: isIdor ? 'IDOR_VIOLATION' : isAuth ? 'AUTH_REQUIRED' : 'METRICS_FAILED',
        message,
      },
    };
  }
}
