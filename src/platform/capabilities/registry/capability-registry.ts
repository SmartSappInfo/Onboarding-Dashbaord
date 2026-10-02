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
 * - Ids are unique. Re-registering the same definition object is a no-op (module re-evaluation
 *   under Next.js HMR); registering a *different* definition under an existing id throws, so two
 *   domains can never silently shadow each other's capability.
 * - The Map lives on globalThis so HMR does not drop registrations mid-session.
 */

import type { AnyCapabilityDefinition } from '../contracts/capability-definition';
import { isHighRiskLevel } from '../contracts/risk-levels';

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

export class InvalidCapabilityError extends Error {
  constructor(id: string, reason: string) {
    super(`Capability '${id}' is invalid: ${reason}`);
    this.name = 'InvalidCapabilityError';
  }
}

const SEMVER_REGEX = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export interface RegisterCapabilityOptions {
  /**
   * If true, allows replacing an existing capability definition with the same id.
   * Crucial for Decision D1 / PR-5 to allow canonical domain implementations (e.g. Wave B)
   * to upgrade legacy compatibility adapters in-place without throwing DuplicateCapabilityError.
   */
  allowOverride?: boolean;
}

export interface CapabilityRegistryStore {
  register(definition: AnyCapabilityDefinition, options?: RegisterCapabilityOptions): void;
  get(id: string): AnyCapabilityDefinition | undefined;
  has(id: string): boolean;
  list(): AnyCapabilityDefinition[];
  unregister(id: string): boolean;
  clear(): void;
}

function validateCapabilityDefinition(definition: AnyCapabilityDefinition): void {
  if (!definition.id || typeof definition.id !== 'string' || definition.id.trim() === '') {
    throw new InvalidCapabilityError(String(definition.id), 'id must be a non-empty string');
  }

  if (!definition.version || !SEMVER_REGEX.test(definition.version)) {
    throw new InvalidCapabilityError(
      definition.id,
      `version '${definition.version}' must follow SemVer (e.g. 1.0.0)`
    );
  }

  if (!Array.isArray(definition.permissions) || definition.permissions.length === 0) {
    throw new InvalidCapabilityError(
      definition.id,
      'permissions must be a non-empty array of permission coordinates'
    );
  }

  for (const perm of definition.permissions) {
    if (typeof perm !== 'string' || perm.trim() === '') {
      throw new InvalidCapabilityError(
        definition.id,
        'permissions array contains empty or non-string element'
      );
    }
  }

  if (isHighRiskLevel(definition.risk.level) && !definition.risk.requiresHumanApproval) {
    throw new InvalidCapabilityError(
      definition.id,
      `High-risk capability (${definition.risk.level}) must require human approval (requiresHumanApproval must be true)`
    );
  }
}

/**
 * Creates a registry store backed by the specified Map.
 */
export function createCapabilityRegistryStore(
  map: Map<string, AnyCapabilityDefinition> = new Map<string, AnyCapabilityDefinition>()
): CapabilityRegistryStore {
  return {
    register(definition: AnyCapabilityDefinition, options?: RegisterCapabilityOptions): void {
      validateCapabilityDefinition(definition);

      const existing = map.get(definition.id);
      if (existing && existing !== definition) {
        if (options?.allowOverride) {
          map.set(definition.id, definition);
          return;
        }
        throw new DuplicateCapabilityError(definition.id);
      }
      map.set(definition.id, definition);
    },

    get(id: string): AnyCapabilityDefinition | undefined {
      return map.get(id);
    },

    has(id: string): boolean {
      return map.has(id);
    },

    list(): AnyCapabilityDefinition[] {
      return Array.from(map.values());
    },

    unregister(id: string): boolean {
      return map.delete(id);
    },

    clear(): void {
      map.clear();
    },
  };
}

/**
 * The canonical singleton store living on globalThis to prevent loss during Next.js HMR.
 */
export const canonicalCapabilityRegistryStore = createCapabilityRegistryStore(registry);

export function registerCapability(
  definition: AnyCapabilityDefinition,
  options?: RegisterCapabilityOptions
): void {
  canonicalCapabilityRegistryStore.register(definition, options);
}

export function getCapability(id: string): AnyCapabilityDefinition | undefined {
  return canonicalCapabilityRegistryStore.get(id);
}

export function hasCapability(id: string): boolean {
  return canonicalCapabilityRegistryStore.has(id);
}

export function listCapabilities(): AnyCapabilityDefinition[] {
  return canonicalCapabilityRegistryStore.list();
}

/**
 * Test-only: unregisters a specific capability id.
 */
export function unregisterCapabilityForTests(id: string): boolean {
  return canonicalCapabilityRegistryStore.unregister(id);
}

/** Test-only: clears every registration. Never call from application code. */
export function resetCapabilityRegistryForTests(): void {
  canonicalCapabilityRegistryStore.clear();
}

