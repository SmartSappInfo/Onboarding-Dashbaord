/**
 * @fileOverview Pipeline Step 3: Check Flags & Kill Switches (Phase 1 / PR-4 & PR-8)
 *
 * Implements Rule 3 (Backoffice Governance), Rule 60 (Dead-Man Controls), Rule 64 (Feature Flags), and PRD §73.
 *
 * Checks platform, tenant, workspace, and capability level flags:
 * - Emergency pause / global autonomous execution disable.
 * - Workspace / organization feature enablement.
 * - Specific capability kill switches.
 * Rejects disabled operations with `DISABLED` (`stateChanged: 'no'`).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AgentPrincipal, AnyCapabilityDefinition } from '../../contracts/capability-definition';
import type { InvocationSurface } from '../invocation';
import { CapabilityError } from '../../errors/capability-error';

export interface FlagCheckContext {
  capability: AnyCapabilityDefinition;
  principal: AgentPrincipal;
  surface?: InvocationSurface;
}

export interface FlagChecker {
  /**
   * Evaluates whether a capability is permitted to execute for the given principal and surface.
   * Returns `{ enabled: boolean; reason?: string }`.
   */
  checkFlag(
    context: FlagCheckContext
  ): Promise<{ enabled: boolean; reason?: string }> | { enabled: boolean; reason?: string };
}

export async function step03CheckFlags(
  capability: AnyCapabilityDefinition,
  principal: AgentPrincipal,
  flagChecker?: FlagChecker,
  surface?: InvocationSurface
): Promise<void> {
  if (!flagChecker) {
    return; // Default open when no flag service is registered
  }

  const result = await flagChecker.checkFlag({ capability, principal, surface });
  if (!result.enabled) {
    throw CapabilityError.disabled(
      result.reason ?? `Capability '${capability.id}' is disabled by operational flag or kill switch.`
    );
  }
}
