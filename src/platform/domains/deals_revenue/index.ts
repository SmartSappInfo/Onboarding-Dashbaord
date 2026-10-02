/**
 * @fileOverview Domain: deals_revenue (Phase 1 / PR-12 - Wave B-2)
 *
 * Implements Rule 4 (Strict Typing), Rule 12 (Server-Side Risk), Rule 18 (TOCTOU),
 * Rule 40 (Domain Events), Rule 47 (Explicit Workspace Scope), and Rule 69 (Master Layering Axiom).
 *
 * Exports and registers canonical Deal and Pipeline capabilities into the platform registry.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { registerCapability } from '../../capabilities/registry/capability-registry';
import type { AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';

import {
  dealSearchCapability,
  dealGetCapability,
  dealCreateCapability,
  dealUpdateCapability,
  dealAdvanceStageCapability,
  dealAssignOwnerCapability,
} from './contracts/deal-capabilities.contract';

import {
  pipelineListCapability,
  pipelineGetCapability,
} from './contracts/pipeline-capabilities.contract';

export * from './contracts/deal-capabilities.contract';
export * from './contracts/pipeline-capabilities.contract';

export const DEALS_REVENUE_CAPABILITIES: AnyCapabilityDefinition[] = [
  dealSearchCapability as AnyCapabilityDefinition,
  dealGetCapability as AnyCapabilityDefinition,
  dealCreateCapability as AnyCapabilityDefinition,
  dealUpdateCapability as AnyCapabilityDefinition,
  dealAdvanceStageCapability as AnyCapabilityDefinition,
  dealAssignOwnerCapability as AnyCapabilityDefinition,
  pipelineListCapability as AnyCapabilityDefinition,
  pipelineGetCapability as AnyCapabilityDefinition,
];

/**
 * Registers all Wave B-2 Deal and Pipeline capabilities into the platform registry with allowOverride: true.
 */
export function registerDealsRevenueCapabilities(): void {
  for (const capability of DEALS_REVENUE_CAPABILITIES) {
    registerCapability(capability, { allowOverride: true });
  }
}

// Auto-register upon domain module import
registerDealsRevenueCapabilities();
