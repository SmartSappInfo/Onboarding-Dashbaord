/**
 * @fileOverview Non-Delegable Privileges Firewall (Phase 13 Milestone 1)
 *
 * Implements:
 * - Rule 4 (Zero any/any[])
 * - Rule 16 (Least Privilege, Wildcard Ban & Scope Attenuation)
 * - Rule 17 (Non-Delegable Privileges Firewall)
 * - Rule 68 #1 (The Model is Never the Security Boundary)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  NON_DELEGABLE_CAPABILITY_PATTERNS,
  AgentDelegationError,
} from './delegation-types';
import { isNonDelegableAction } from '../../capabilities/contracts/risk-levels';

/**
 * Checks whether a capability or scope string matches any non-delegable wildcard/prefix pattern.
 */
function matchesPattern(target: string, pattern: string): boolean {
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return target === prefix || target.startsWith(`${prefix}.`);
  }
  if (pattern.endsWith(':*')) {
    const prefix = pattern.slice(0, -2);
    return target === prefix || target.startsWith(`${prefix}:`);
  }
  return target === pattern;
}

/**
 * Pure deterministic check whether a capability ID can be delegated to an agent (Rule 17).
 *
 * Returns false if:
 * 1. The capability matches any pattern in `NON_DELEGABLE_CAPABILITY_PATTERNS`.
 * 2. The capability matches canonical non-delegable actions from `risk-levels.ts`.
 * 3. The capability is a wildcard `*`.
 */
export function isCapabilityDelegable(capabilityId: string): boolean {
  const normalized = capabilityId.trim();

  // 1. Wildcard is never delegable (Rule 16)
  if (normalized === '*' || normalized.endsWith('.*') || normalized.endsWith(':*')) {
    return false;
  }

  // 2. Check pattern matching
  for (const pattern of NON_DELEGABLE_CAPABILITY_PATTERNS) {
    if (matchesPattern(normalized, pattern)) {
      return false;
    }
  }

  // 3. Check exact canonical non-delegable actions
  if (isNonDelegableAction(normalized)) {
    return false;
  }

  return true;
}

/**
 * Throws AgentDelegationError if capability is non-delegable (Rule 17).
 */
export function assertCapabilityDelegable(capabilityId: string): void {
  if (!isCapabilityDelegable(capabilityId)) {
    throw new AgentDelegationError(
      'NON_DELEGABLE_ACTION_FORBIDDEN',
      `Capability '${capabilityId}' is non-delegable and cannot be inherited or exercised by automated/delegated agents (Rule 17).`,
      403
    );
  }
}

/**
 * Partitions an array of capability IDs into allowed and stripped arrays.
 */
export function stripNonDelegableCapabilities(
  capabilities: readonly string[]
): { allowed: string[]; stripped: string[] } {
  const allowed: string[] = [];
  const stripped: string[] = [];

  for (const cap of capabilities) {
    if (isCapabilityDelegable(cap)) {
      allowed.push(cap);
    } else {
      stripped.push(cap);
    }
  }

  return { allowed, stripped };
}

/**
 * Pure deterministic check whether an RBAC permission scope can be delegated (Rule 16 & 17).
 */
export function isScopeDelegable(scope: string): boolean {
  const normalized = scope.trim();

  // 1. Wildcards are strictly prohibited for automated agents (Rule 16)
  if (normalized === '*' || normalized.endsWith(':*') || normalized.endsWith('.*')) {
    return false;
  }

  // 2. Check non-delegable patterns
  for (const pattern of NON_DELEGABLE_CAPABILITY_PATTERNS) {
    if (matchesPattern(normalized, pattern)) {
      return false;
    }
  }

  // 3. Check canonical action list
  if (isNonDelegableAction(normalized)) {
    return false;
  }

  return true;
}

/**
 * Partitions an array of permission scopes into allowed and stripped arrays.
 */
export function stripNonDelegableScopes(
  scopes: readonly string[]
): { allowed: string[]; stripped: string[] } {
  const allowed: string[] = [];
  const stripped: string[] = [];

  for (const scope of scopes) {
    if (isScopeDelegable(scope)) {
      allowed.push(scope);
    } else {
      stripped.push(scope);
    }
  }

  return { allowed, stripped };
}
