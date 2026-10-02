/**
 * @fileOverview Pure Evaluation Logic for Capability Flags (Phase 1 / PR-8)
 *
 * Implements Rule 60 (Dead-Man Controls), Rule 62 (Zero Deployments),
 * Rule 64 (Precedence Hierarchy), and PRD §73.
 *
 * Evaluates operational flags, overrides, and progressive rollouts strictly according to
 * the 6-tier precedence hierarchy:
 * 1. Emergency Kill-Switch (capability-specific)
 * 2. Global Autonomous Execution Switch (Rule 60)
 * 3. Workspace Override (Rule 64)
 * 4. Organization Override (Rule 64)
 * 5. Progressive Canary Rollout Percentage
 * 6. Default State / Capability Policies
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { sha256Hex } from '../contracts/canonical-json';
import {
  type AgentPrincipal,
  type AnyCapabilityDefinition,
  isAutomatedPrincipal,
} from '../contracts/capability-definition';
import type {
  CapabilityFlagRecord,
  FlagEvaluationResult,
  FlagOverride,
  GlobalAutonomousControl,
  SurfaceType,
} from './capability-flags-types';

export interface EvaluateFlagParams {
  flagRecord?: CapabilityFlagRecord | null;
  principal: AgentPrincipal;
  capability: AnyCapabilityDefinition;
  surface?: SurfaceType;
  globalAutonomousControl?: GlobalAutonomousControl | null;
}

/**
 * Computes a deterministic 0-99 bucket for progressive canary rollouts.
 */
export function computeRolloutBucket(seed: string): number {
  const hash = sha256Hex(seed);
  const intVal = parseInt(hash.slice(0, 8), 16);
  return intVal % 100;
}

function resolveSurfaceValue(
  override: FlagOverride,
  isMcp: boolean,
  isAutomated: boolean
): boolean | undefined {
  if (isMcp && override.mcpEnabled !== undefined) {
    return override.mcpEnabled;
  }
  if (isAutomated && override.agentEnabled !== undefined) {
    return override.agentEnabled;
  }
  if (!isAutomated && override.humanEnabled !== undefined) {
    return override.humanEnabled;
  }
  return override.enabled;
}

/**
 * Evaluates whether a capability is enabled according to the 6-tier hierarchy.
 */
export function evaluateCapabilityFlag(params: EvaluateFlagParams): FlagEvaluationResult {
  const {
    flagRecord,
    principal,
    capability,
    surface,
    globalAutonomousControl,
  } = params;

  // 1. Tier 1: Emergency Kill-Switch (capability-specific)
  if (flagRecord?.killSwitch) {
    return {
      enabled: false,
      reason: `Capability '${capability.id}' is disabled by emergency kill switch.`,
      tier: 'kill_switch',
    };
  }

  const isAutomated = isAutomatedPrincipal(principal) || (surface !== undefined && surface !== 'ui');
  const isMcp = surface === 'mcp';

  // 2. Tier 2: Global Autonomous Execution Switch (Rule 60)
  if (isAutomated && globalAutonomousControl) {
    if (!globalAutonomousControl.autonomousExecutionEnabled || globalAutonomousControl.killSwitch) {
      return {
        enabled: false,
        reason:
          globalAutonomousControl.reason ??
          'Global autonomous execution is suspended by emergency dead-man switch.',
        tier: 'global_autonomous',
      };
    }
  }

  // 3. Tier 3: Workspace Override (Rule 64)
  if (principal.workspaceId && flagRecord?.workspaceOverrides) {
    const wsOverride = flagRecord.workspaceOverrides[principal.workspaceId];
    if (wsOverride) {
      const resolved = resolveSurfaceValue(wsOverride, isMcp, isAutomated);
      if (resolved !== undefined) {
        return {
          enabled: resolved,
          reason: resolved
            ? undefined
            : `Capability '${capability.id}' is disabled by workspace override.`,
          tier: 'workspace_override',
        };
      }
    }
  }

  // 4. Tier 4: Organization Override (Rule 64)
  if (principal.organizationId && flagRecord?.orgOverrides) {
    const orgOverride = flagRecord.orgOverrides[principal.organizationId];
    if (orgOverride) {
      const resolved = resolveSurfaceValue(orgOverride, isMcp, isAutomated);
      if (resolved !== undefined) {
        return {
          enabled: resolved,
          reason: resolved
            ? undefined
            : `Capability '${capability.id}' is disabled by organization override.`,
          tier: 'org_override',
        };
      }
    }
  }

  // 5. Tier 5: Progressive Canary Rollout Percentage
  if (flagRecord?.rolloutPercentage !== undefined) {
    const percentage = flagRecord.rolloutPercentage;
    if (percentage <= 0) {
      return {
        enabled: false,
        reason: `Capability '${capability.id}' is not enabled in rollout percentage (0%).`,
        tier: 'rollout',
      };
    }

    if (percentage < 100) {
      const seed = `${principal.workspaceId || principal.organizationId || principal.userId}:${capability.id}`;
      const bucket = computeRolloutBucket(seed);
      if (bucket >= percentage) {
        return {
          enabled: false,
          reason: `Capability '${capability.id}' is disabled for current workspace in rollout percentage (${percentage}%).`,
          tier: 'rollout',
        };
      }
    }
  }

  // 6. Tier 6: Default State / Capability Policies
  if (isMcp && flagRecord?.mcpEnabled !== undefined) {
    return {
      enabled: flagRecord.mcpEnabled,
      reason: flagRecord.mcpEnabled
        ? undefined
        : `Capability '${capability.id}' is disabled for MCP callers.`,
      tier: 'default',
    };
  }

  if (isAutomated && flagRecord?.agentEnabled !== undefined) {
    return {
      enabled: flagRecord.agentEnabled,
      reason: flagRecord.agentEnabled
        ? undefined
        : `Capability '${capability.id}' is disabled for automated agents.`,
      tier: 'default',
    };
  }

  if (!isAutomated && flagRecord?.humanEnabled !== undefined) {
    return {
      enabled: flagRecord.humanEnabled,
      reason: flagRecord.humanEnabled
        ? undefined
        : `Capability '${capability.id}' is disabled for human users.`,
      tier: 'default',
    };
  }

  if (flagRecord?.defaultState !== undefined) {
    return {
      enabled: flagRecord.defaultState,
      reason: flagRecord.defaultState
        ? undefined
        : `Capability '${capability.id}' is disabled by default.`,
      tier: 'default',
    };
  }

  const capabilityDefault = capability.policies?.defaultEnabled ?? true;
  return {
    enabled: capabilityDefault,
    reason: capabilityDefault
      ? undefined
      : `Capability '${capability.id}' is disabled by capability definition policy.`,
    tier: 'default',
  };
}
