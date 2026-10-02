/**
 * @fileOverview Domain: identity_access (Phase 1 / PR-10 - Wave A)
 *
 * Implements Rule 4 (Strict Typing), Rule 12 (Server-Side Risk), Rule 16 (Caller Identity),
 * Rule 17 (Non-Delegable Privileges), Rule 47 (Explicit Workspace Scope & Anti-IDOR),
 * and Rule 69 (Master Layering Axiom).
 *
 * Exports and registers the canonical Wave A capabilities into the platform registry.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { registerCapability } from '../../capabilities/registry/capability-registry';
import type { AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';

import { getCurrentActorCapability } from './contracts/get-current-actor.contract';
import { listAccessibleWorkspacesCapability } from './contracts/list-accessible-workspaces.contract';
import { getWorkspaceCapability } from './contracts/get-workspace.contract';
import { checkPermissionCapability } from './contracts/check-permission.contract';
import { listEffectivePermissionsCapability } from './contracts/list-effective-permissions.contract';

export * from './contracts/get-current-actor.contract';
export * from './contracts/list-accessible-workspaces.contract';
export * from './contracts/get-workspace.contract';
export * from './contracts/check-permission.contract';
export * from './contracts/list-effective-permissions.contract';

export const IDENTITY_ACCESS_CAPABILITIES: AnyCapabilityDefinition[] = [
  getCurrentActorCapability as AnyCapabilityDefinition,
  listAccessibleWorkspacesCapability as AnyCapabilityDefinition,
  getWorkspaceCapability as AnyCapabilityDefinition,
  checkPermissionCapability as AnyCapabilityDefinition,
  listEffectivePermissionsCapability as AnyCapabilityDefinition,
];

/**
 * Registers all Wave A identity and access capabilities into the platform registry.
 */
export function registerIdentityAccessCapabilities(): void {
  for (const capability of IDENTITY_ACCESS_CAPABILITIES) {
    registerCapability(capability, { allowOverride: true });
  }
}

// Auto-register upon domain module import
registerIdentityAccessCapabilities();
