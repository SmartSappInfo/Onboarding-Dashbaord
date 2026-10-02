'use server';

/**
 * @fileOverview Generic Server Action for Capability Invocations (Phase 1 / PR-9)
 *
 * Implements Rule 16 (Least Privilege), Rule 23 (State Change Invariant),
 * Rule 51 (User-Facing Error Contracts), Rule 68 (Surface Separation), and PRD §53.
 *
 * Routes client UI invocations directly through the 16-step canonical execution gateway
 * with authenticated session resolution and safe serialization.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { randomUUID } from 'node:crypto';
import { requireWorkspace } from '@/lib/auth/require-auth';
import { executeCapability } from '../execution/execute-capability';
import { defaultFlagChecker } from '../flags/flag-service';
import { evaluatePrincipalAuthority } from '../policy/principal-evaluator';
import { resolvePrincipalFromSession } from '../policy/session-principal-resolver';
import { getCapability } from '../registry/capability-registry';
import type {
  ClientActionConfig,
  ClientCapabilityInvocation,
  ClientCapabilityOutcome,
} from './types';

/**
 * Validates and sanitizes actionConfig to enforce internal relative paths only.
 * Prevents Open Redirect and XSS vulnerabilities.
 */
function sanitizeActionConfig(raw: unknown): ClientActionConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as Record<string, unknown>;

  if (
    typeof candidate.path === 'string' &&
    typeof candidate.label === 'string' &&
    candidate.path.startsWith('/') &&
    !candidate.path.startsWith('//') &&
    !candidate.path.includes(':')
  ) {
    return {
      path: candidate.path,
      label: candidate.label,
    };
  }
  return undefined;
}

/**
 * Canonical Next.js Server Action to invoke any registered capability from the UI surface.
 */
export async function invokeCapabilityAction<TInput = unknown, TOutput = unknown>(
  invocation: ClientCapabilityInvocation<TInput>
): Promise<ClientCapabilityOutcome<TOutput>> {
  try {
    // 1. Determine target workspace ID
    let workspaceId = invocation.workspaceId;
    if (!workspaceId && invocation.input && typeof invocation.input === 'object') {
      const inputObj = invocation.input as Record<string, unknown>;
      if (typeof inputObj.workspaceId === 'string' && inputObj.workspaceId.trim() !== '') {
        workspaceId = inputObj.workspaceId;
      }
    }

    if (!workspaceId) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Target workspaceId is required to invoke capabilities.',
          stateChanged: 'no',
          retryable: false,
          httpStatus: 400,
        },
      };
    }

    // 2. Resolve authenticated interactive session principal using verified identity guard
    const authContext = await requireWorkspace(workspaceId);
    const principal = await resolvePrincipalFromSession(workspaceId, { authContext });

    // 3. Execute through the Canonical Gateway
    const outcome = await executeCapability<TOutput>({
      capabilityId: invocation.capabilityId,
      version: invocation.version,
      surface: 'ui',
      input: invocation.input,
      correlationId: `ui_${randomUUID()}`,
      idempotencyKey: invocation.idempotencyKey,
      expectedVersion: invocation.expectedVersion,
      dryRun: invocation.dryRun,
      approvalId: invocation.approvalId,
      principal,
    });

    if (outcome.success) {
      return {
        success: true,
        data: outcome.data,
        executionId: outcome.executionId,
        durationMs: outcome.durationMs,
        stateChanged: outcome.stateChanged,
        resourceVersion: outcome.resourceVersion,
      };
    }

    // 4. Handle refusal or error outcome
    const details = outcome.error.details;
    const sanitizedAction = details ? sanitizeActionConfig(details.actionConfig) : undefined;

    let conflictMeta: { expectedVersion?: string | number; actualVersion?: string | number } | undefined;
    if (outcome.error.code === 'VERSION_CONFLICT' && details) {
      conflictMeta = {
        expectedVersion:
          typeof details.expectedVersion === 'string' || typeof details.expectedVersion === 'number'
            ? details.expectedVersion
            : invocation.expectedVersion,
        actualVersion:
          typeof details.actualVersion === 'string' || typeof details.actualVersion === 'number'
            ? details.actualVersion
            : undefined,
      };
    }

    let approvalMeta: { approvalId?: string; requiredLevel?: string } | undefined;
    if (outcome.error.code === 'APPROVAL_REQUIRED' && details) {
      approvalMeta = {
        approvalId: typeof details.approvalId === 'string' ? details.approvalId : undefined,
        requiredLevel: typeof details.requiredLevel === 'string' ? details.requiredLevel : undefined,
      };
    }

    return {
      success: false,
      error: {
        code: outcome.error.code,
        message: outcome.error.message,
        stateChanged: outcome.error.stateChanged,
        retryable: outcome.error.retryable,
        httpStatus: outcome.error.httpStatus,
        details: outcome.error.details,
        actionConfig: sanitizedAction,
        conflict: conflictMeta,
        approval: approvalMeta,
      },
      executionId: outcome.executionId,
      durationMs: outcome.durationMs,
    };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'UnauthorizedError') {
      return {
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: err instanceof Error ? err.message : 'Not signed in.',
          stateChanged: 'no',
          retryable: false,
          httpStatus: 401,
        },
      };
    }
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ForbiddenError') {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: err instanceof Error ? err.message : 'Not permitted in workspace.',
          stateChanged: 'no',
          retryable: false,
          httpStatus: 403,
        },
      };
    }
    const message = err instanceof Error ? err.message : 'An unexpected error occurred during execution.';
    return {
      success: false,
      error: {
        code: 'INTERNAL',
        message,
        stateChanged: 'unknown',
        retryable: false,
        httpStatus: 500,
      },
    };
  }
}

export interface CapabilityAvailability {
  available: boolean;
  enabled: boolean;
  authorized: boolean;
  reason?: string;
  tier?: string;
  riskLevel?: string;
  requiresHumanApproval?: boolean;
}

/**
 * Pre-flight capability availability query action.
 */
export async function checkCapabilityAvailabilityAction(
  capabilityId: string,
  workspaceId: string
): Promise<CapabilityAvailability> {
  try {
    const capability = getCapability(capabilityId);
    if (!capability) {
      return {
        available: false,
        enabled: false,
        authorized: false,
        reason: `Capability '${capabilityId}' is not registered.`,
      };
    }

    const authContext = await requireWorkspace(workspaceId);
    const principal = await resolvePrincipalFromSession(workspaceId, { authContext });

    // Check Flags
    const flagResult = await defaultFlagChecker.checkFlag({
      capability,
      principal,
      surface: 'ui',
    });

    if (!flagResult.enabled) {
      return {
        available: false,
        enabled: false,
        authorized: true,
        reason: flagResult.reason ?? 'Disabled by operational flag or kill switch.',
        tier: flagResult.tier,
        riskLevel: capability.risk.level,
        requiresHumanApproval: capability.risk.requiresHumanApproval,
      };
    }

    // Check Permissions / Authority
    const authority = evaluatePrincipalAuthority(
      principal,
      capability,
      { organizationId: principal.organizationId, workspaceId },
      { nowMs: Date.now() }
    );

    const baseViolations = authority.violationCodes.filter((code) => code !== 'APPROVAL_REQUIRED');
    const isAuthorized = baseViolations.length === 0;

    return {
      available: isAuthorized,
      enabled: true,
      authorized: isAuthorized,
      reason: isAuthorized ? undefined : authority.reason ?? 'Caller lacks required permissions.',
      riskLevel: capability.risk.level,
      requiresHumanApproval: capability.risk.requiresHumanApproval,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Availability check failed.';
    return {
      available: false,
      enabled: false,
      authorized: false,
      reason: message,
    };
  }
}
