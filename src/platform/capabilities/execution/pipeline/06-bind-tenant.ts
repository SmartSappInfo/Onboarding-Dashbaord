/**
 * @fileOverview Pipeline Step 6: Bind Tenant (Phase 1 / PR-4)
 *
 * Implements Rule 8 (Security Standards & Leak Prevention), Rule 50 (Tenant Isolation),
 * Tools §1 (Agents must not choose arbitrary tenant), and PRD §73.
 *
 * Enforces that invocation arguments do not target another organization or workspace.
 * Fails safely with `TENANT_SCOPE` (`stateChanged: 'no'`).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AgentPrincipal } from '../../contracts/capability-definition';
import { CapabilityError } from '../../errors/capability-error';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function step06BindTenant(
  validatedInput: unknown,
  principal: AgentPrincipal
): void {
  if (!isPlainRecord(validatedInput)) {
    return;
  }

  const orgId = validatedInput.organizationId;
  if (typeof orgId === 'string' && orgId !== principal.organizationId) {
    throw new CapabilityError({
      code: 'TENANT_SCOPE_VIOLATION',
      message: `Access denied: the request targets organization '${orgId}', which does not match caller organization '${principal.organizationId}'.`,
      stateChanged: 'no',
      httpStatus: 400,
      retryable: false,
    });
  }

  const wsId = validatedInput.workspaceId;
  if (typeof wsId === 'string' && wsId !== principal.workspaceId) {
    throw new CapabilityError({
      code: 'TENANT_SCOPE_VIOLATION',
      message: `Access denied: the request targets workspace '${wsId}', which does not match caller workspace '${principal.workspaceId}'.`,
      stateChanged: 'no',
      httpStatus: 400,
      retryable: false,
    });
  }
}
