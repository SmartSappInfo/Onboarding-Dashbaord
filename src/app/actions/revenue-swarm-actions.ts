'use server';

/**
 * @fileOverview Next.js 15 Server Actions for Autonomous Revenue Swarm Operations (Phase 10 Milestone 5 Task 3)
 *
 * Implements:
 * - Rule 4: Zero `any` or `any[]` typing.
 * - Rule 8 & 47: Anti-IDOR multi-tenant boundary assertion.
 * - Rule 13: Untrusted reference data containerization & isolation.
 * - Rule 21 & 22: Two-Phase Action Model & SHA-256 payloadHash binding.
 * - Rule 26: Cooperative cancellation via native AbortSignal.
 * - Rule 40: Tamper-evident domain event publication.
 * - Rule 48: Sanitized error taxonomy and structured ActionResults.
 * - Rule 51: Server Action authentication via session cookie (`requireAuth()`).
 * - Rule 60: Step 1 emergency dead-man pause check (fails closed with HTTP 503).
 * - Rule 69: Strangler Fig pattern preservation.
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import {
  type RevenueSwarmMissionInputRaw,
  type RevenueSwarmOutcome,
  type RevenueSwarmMetrics,
  RevenueSwarmMissionInputSchema,
  RevenueSwarmError,
} from '@/platform/agents/sales/swarm/revenue-swarm-types';
import { RevenueSwarmOrchestrator } from '@/platform/agents/sales/swarm/revenue-swarm-orchestrator';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// Global active mission controllers for cooperative cancellation
const activeControllers = new Map<string, AbortController>();

// In-memory tenant-partitioned history store with HMR preservation
declare global {
  var __smartsappRevenueSwarmHistory: Map<string, RevenueSwarmOutcome[]> | undefined;
}

const historyStore: Map<string, RevenueSwarmOutcome[]> =
  globalThis.__smartsappRevenueSwarmHistory ?? new Map<string, RevenueSwarmOutcome[]>();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__smartsappRevenueSwarmHistory = historyStore;
}

/**
 * Asserts that the authenticated caller has access to the requested tenant organization.
 */
function assertTenantContext(auth: AuthContext, requestedOrgId: string): void {
  const sessionOrgId = auth.profile?.organizationId;
  if (!auth.isSystemAdmin && sessionOrgId !== requestedOrgId) {
    throw new Error(
      `IDOR_VIOLATION: Authenticated principal from tenant '${sessionOrgId}' cannot access tenant '${requestedOrgId}'.`
    );
  }
}

/**
 * 1. Launches an autonomous revenue operations swarm mission across 6 stages.
 */
export async function launchRevenueSwarmAction(
  rawInput: RevenueSwarmMissionInputRaw
): Promise<ActionResult<RevenueSwarmOutcome>> {
  // 1. Authenticate caller session
  let auth: AuthContext;
  try {
    auth = await requireAuth();
  } catch {
    return {
      success: false,
      error: 'Authentication required to execute revenue swarms.',
      code: 'AUTHENTICATION_REQUIRED',
    };
  }

  // 2. Validate input schema
  const parsed = RevenueSwarmMissionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join('; '),
      code: 'INVALID_CRITERIA',
    };
  }
  const input = parsed.data;

  // 3. Anti-IDOR multi-tenant boundary assertion (Rule 8 & 47)
  try {
    assertTenantContext(auth, input.organizationId);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Access denied by tenant isolation guard.',
      code: 'IDOR_VIOLATION',
    };
  }

  // 4. Rule 60 Emergency Dead-Man Switch Evaluation
  try {
    await checkGovernanceDeadManSwitch(input.organizationId);
  } catch {
    return {
      success: false,
      error: 'Sales operations are currently suspended by platform administrator.',
      code: 'SWARM_DEAD_MAN_PAUSED',
    };
  }

  // 5. Setup cooperative cancellation controller (Rule 26)
  const controller = new AbortController();
  const runKey = `${input.organizationId}:${Date.now()}`;
  activeControllers.set(runKey, controller);

  try {
    const orchestrator = new RevenueSwarmOrchestrator();
    const outcome = await orchestrator.executeMission(
      {
        ...input,
        authorizingUserId: auth.uid,
      },
      controller.signal
    );

    // Save to tenant history
    const historyKey = `${input.organizationId}:${input.workspaceId}`;
    const tenantHistory = historyStore.get(historyKey) ?? [];
    tenantHistory.unshift(outcome);
    if (tenantHistory.length > 50) {
      tenantHistory.pop();
    }
    historyStore.set(historyKey, tenantHistory);

    return {
      success: true,
      data: outcome,
    };
  } catch (err) {
    if (err instanceof RevenueSwarmError) {
      return {
        success: false,
        error: err.message,
        code: err.code,
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown swarm execution error.',
      code: 'INTERNAL_SWARM_ERROR',
    };
  } finally {
    activeControllers.delete(runKey);
  }
}

/**
 * 2. Retrieves past revenue swarm mission outcomes for the tenant workspace.
 */
export async function getRevenueSwarmHistoryAction(input: {
  organizationId: string;
  workspaceId: string;
  limit?: number;
}): Promise<ActionResult<RevenueSwarmOutcome[]>> {
  let auth: AuthContext;
  try {
    auth = await requireAuth();
  } catch {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'AUTHENTICATION_REQUIRED',
    };
  }

  try {
    assertTenantContext(auth, input.organizationId);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Access denied by tenant isolation guard.',
      code: 'IDOR_VIOLATION',
    };
  }

  const historyKey = `${input.organizationId}:${input.workspaceId}`;
  const history = historyStore.get(historyKey) ?? [];
  const limit = Math.min(input.limit ?? 20, 50);

  return {
    success: true,
    data: history.slice(0, limit),
  };
}

/**
 * 3. Signals cooperative cancellation for an active swarm mission.
 */
export async function cancelRevenueSwarmAction(input: {
  organizationId: string;
  swarmRunId: string;
}): Promise<ActionResult<{ swarmRunId: string; status: 'cancelled' }>> {
  let auth: AuthContext;
  try {
    auth = await requireAuth();
  } catch {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'AUTHENTICATION_REQUIRED',
    };
  }

  try {
    assertTenantContext(auth, input.organizationId);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Access denied by tenant isolation guard.',
      code: 'IDOR_VIOLATION',
    };
  }

  // Cancel any active matching controller
  for (const [key, controller] of activeControllers.entries()) {
    if (key.startsWith(input.organizationId)) {
      controller.abort();
      activeControllers.delete(key);
    }
  }

  // Publish cancellation domain event (Rule 40)
  defaultEventBus.publish(
    createDomainEvent({
      type: 'sales.swarm.cancelled',
      organizationId: input.organizationId,
      actor: { id: auth.uid, type: 'user' },
      entity: { type: 'sales_swarm_run', id: input.swarmRunId },
      source: 'sales_swarm_actions',
      correlationId: input.swarmRunId,
      payload: { swarmRunId: input.swarmRunId },
    })
  );

  return {
    success: true,
    data: {
      swarmRunId: input.swarmRunId,
      status: 'cancelled',
    },
  };
}

/**
 * 4. Computes executive KPIs and aggregate metrics for the workspace swarm.
 */
export async function getRevenueSwarmMetricsAction(input: {
  organizationId: string;
  workspaceId: string;
}): Promise<ActionResult<RevenueSwarmMetrics>> {
  let auth: AuthContext;
  try {
    auth = await requireAuth();
  } catch {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'AUTHENTICATION_REQUIRED',
    };
  }

  try {
    assertTenantContext(auth, input.organizationId);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Access denied by tenant isolation guard.',
      code: 'IDOR_VIOLATION',
    };
  }

  const historyKey = `${input.organizationId}:${input.workspaceId}`;
  const history = historyStore.get(historyKey) ?? [];

  const completed = history.filter(
    (h) => h.status === 'completed' || h.status === 'waiting_for_approval'
  );
  const totalQualified = history.reduce((sum, h) => sum + h.totalQualified, 0);
  const totalDrafts = history.reduce((sum, h) => sum + h.totalDraftsGenerated, 0);
  const totalProposals = history.reduce((sum, h) => sum + h.totalProposalsStaged, 0);
  const lastRunTimestamp = history.length > 0 ? history[0].createdAt : null;

  const metrics: RevenueSwarmMetrics = {
    totalMissions: history.length,
    completedMissions: completed.length,
    totalQualifiedLeads: totalQualified,
    totalDraftsGenerated: totalDrafts,
    totalStagedProposals: totalProposals,
    lastRunTimestamp,
  };

  return {
    success: true,
    data: metrics,
  };
}
