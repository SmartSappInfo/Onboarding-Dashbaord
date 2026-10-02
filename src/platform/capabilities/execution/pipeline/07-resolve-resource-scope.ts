/**
 * @fileOverview Pipeline Step 7: Resolve Resource Scope (Phase 1 / PR-4)
 *
 * Implements Rule 8 (Security & Leak Prevention), Rule 49 (Resource Isolation),
 * PRD §73, and Tools §4.
 *
 * Calls capability's `resolveResourceScope(input, ctx)` if provided to load the target
 * record(s) and prove they belong to the caller's workspace/organization.
 *
 * NON-NEGOTIABLE INVARIANT (PRD §73):
 * If a target resource is missing or belongs to a different tenant, this step MUST return
 * `NOT_FOUND` (`404`), NEVER `FORBIDDEN` (`403`), to prevent cross-tenant enumeration leaks.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
  CapabilityExecutionContext,
} from '../../contracts/capability-definition';
import { CapabilityError } from '../../errors/capability-error';

export interface ResolvedResourceScope {
  resourceId?: string;
  resourceVersion?: string | number;
}

export async function step07ResolveResourceScope(
  validatedInput: unknown,
  context: CapabilityExecutionContext,
  capability: AnyCapabilityDefinition,
  principal: AgentPrincipal
): Promise<ResolvedResourceScope | undefined> {
  if (!capability.resolveResourceScope) {
    return undefined;
  }

  let scopeResult;
  try {
    scopeResult = await capability.resolveResourceScope(validatedInput, context);
  } catch {
    // If the resolver throws because the record does not exist or access is invalid,
    // fail closed as NOT_FOUND to avoid disclosing record existence.
    throw CapabilityError.notFound('The requested resource was not found.');
  }

  // If resolver returned null/undefined, record does not exist
  if (!scopeResult) {
    throw CapabilityError.notFound('The requested resource was not found.');
  }

  // Tenant / workspace ownership verification
  if (scopeResult.organizationId && scopeResult.organizationId !== principal.organizationId) {
    // Deliberately masked as NOT_FOUND to prevent cross-tenant existence enumeration
    throw CapabilityError.notFound('The requested resource was not found.');
  }

  if (scopeResult.workspaceId && scopeResult.workspaceId !== principal.workspaceId) {
    // Deliberately masked as NOT_FOUND to prevent cross-workspace existence enumeration
    throw CapabilityError.notFound('The requested resource was not found.');
  }

  return {
    resourceId: scopeResult.resourceId,
    resourceVersion: scopeResult.resourceVersion,
  };
}
