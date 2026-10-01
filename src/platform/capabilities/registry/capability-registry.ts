/**
 * @fileOverview Canonical Capability Registry (Phase 0 / Phase 1)
 *
 * The single lookup every execution surface (MCP handler, Cloud Tasks agent-step worker,
 * in-app agents) uses to resolve a capability id to its contract + handler.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Phase 1 domain adapters call `registerCapability` at module load. Until then the registry is
 *   empty, and the agent-step worker fails any queued step as CAPABILITY_NOT_REGISTERED
 *   (it never pretends to have executed it).
 * - Definitions are validated on registration (PR-2): SemVer version, non-empty D6 permission
 *   references (or an explicit `public` reason), a known risk level, and L3/L4 must require human
 *   approval. An invalid definition throws instead of becoming executable.
 * - Ids are unique. Re-registering the same definition object is a no-op (module re-evaluation
 *   under Next.js HMR); registering a *different* definition under an existing id throws, so two
 *   domains can never silently shadow each other's capability.
 * - The Map lives on globalThis so HMR does not drop registrations mid-session.
 */

import type { AnyCapabilityDefinition } from '../contracts/capability-definition';
import { parsePermissionRef } from '../contracts/permission-refs';
import { RISK_LEVELS, isHighRiskLevel } from '../contracts/risk-levels';

/** SemVer 2.0 (major.minor.patch with optional pre-release / build). */
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export class InvalidCapabilityError extends Error {
  constructor(id: string, readonly problems: string[]) {
    super(`Capability '${id}' is invalid: ${problems.join('; ')}`);
    this.name = 'InvalidCapabilityError';
  }
}

/**
 * Structural checks a definition must pass before it can be executed (agents_mcp PR-2).
 * Returns the problems found (empty when valid).
 */
export function validateCapabilityDefinition(definition: AnyCapabilityDefinition): string[] {
  const problems: string[] = [];
  if (!definition.id?.trim()) problems.push('id is empty');
  if (!SEMVER.test(definition.version ?? '')) problems.push(`version '${definition.version}' is not SemVer`);

  if (definition.permissions.length === 0) {
    if (!definition.public?.reason?.trim()) {
      problems.push('permissions is empty; declare `public: { reason }` for a capability with no permission');
    }
  } else if (definition.public) {
    problems.push('a public capability must not also require permissions');
  }
  for (const permission of definition.permissions) {
    if (!parsePermissionRef(permission)) {
      problems.push(`permission '${permission}' is not a valid app:/rbac: reference`);
    }
  }

  if (!(RISK_LEVELS as readonly string[]).includes(definition.risk.level)) {
    problems.push(`risk level '${definition.risk.level}' is unknown`);
  } else if (isHighRiskLevel(definition.risk.level) && !definition.risk.requiresHumanApproval) {
    problems.push(`${definition.risk.level} capabilities must set risk.requiresHumanApproval`);
  }
  return problems;
}

const globalRef = globalThis as { __smartsappCapabilityRegistry?: Map<string, AnyCapabilityDefinition> };
if (!globalRef.__smartsappCapabilityRegistry) {
  globalRef.__smartsappCapabilityRegistry = new Map<string, AnyCapabilityDefinition>();
}
const registry = globalRef.__smartsappCapabilityRegistry;

export class DuplicateCapabilityError extends Error {
  constructor(id: string) {
    super(`Capability '${id}' is already registered with a different definition.`);
    this.name = 'DuplicateCapabilityError';
  }
}

export function registerCapability(definition: AnyCapabilityDefinition): void {
  const problems = validateCapabilityDefinition(definition);
  if (problems.length > 0) throw new InvalidCapabilityError(definition.id, problems);
  const existing = registry.get(definition.id);
  if (existing && existing !== definition) {
    throw new DuplicateCapabilityError(definition.id);
  }
  registry.set(definition.id, definition);
}

export function getCapability(id: string): AnyCapabilityDefinition | undefined {
  return registry.get(id);
}

export function listCapabilities(): AnyCapabilityDefinition[] {
  return Array.from(registry.values());
}

/** Test-only: clears every registration. Never call from application code. */
export function resetCapabilityRegistryForTests(): void {
  registry.clear();
}
