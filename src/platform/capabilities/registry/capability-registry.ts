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
