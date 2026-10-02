/**
 * @fileOverview Domain: tasks_productivity (Phase 1 / PR-11 - Wave B-1)
 *
 * Implements Rule 4 (Strict Typing), Rule 12 (Server-Side Risk), Rule 18 (TOCTOU),
 * Rule 40 (Domain Events), Rule 47 (Explicit Workspace Scope), and Rule 69 (Master Layering Axiom).
 *
 * Exports and registers canonical Task capabilities into the platform registry.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { registerCapability } from '../../capabilities/registry/capability-registry';
import type { AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';

import { taskSearchCapability } from './contracts/task-search.contract';
import { taskGetCapability } from './contracts/task-get.contract';
import { taskCreateCapability } from './contracts/task-create.contract';
import { taskUpdateCapability } from './contracts/task-update.contract';
import { taskCompleteCapability } from './contracts/task-complete.contract';

export * from './contracts/task-search.contract';
export * from './contracts/task-get.contract';
export * from './contracts/task-create.contract';
export * from './contracts/task-update.contract';
export * from './contracts/task-complete.contract';

export const TASKS_PRODUCTIVITY_CAPABILITIES: AnyCapabilityDefinition[] = [
  taskSearchCapability as AnyCapabilityDefinition,
  taskGetCapability as AnyCapabilityDefinition,
  taskCreateCapability as AnyCapabilityDefinition,
  taskUpdateCapability as AnyCapabilityDefinition,
  taskCompleteCapability as AnyCapabilityDefinition,
];

/**
 * Registers all Wave B-1 Task capabilities into the platform registry with allowOverride: true.
 */
export function registerTasksProductivityCapabilities(): void {
  for (const capability of TASKS_PRODUCTIVITY_CAPABILITIES) {
    registerCapability(capability, { allowOverride: true });
  }
}

// Auto-register upon domain module import
registerTasksProductivityCapabilities();
