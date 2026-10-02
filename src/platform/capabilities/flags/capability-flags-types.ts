/**
 * @fileOverview Capability Feature Flags & Kill Switches Types (Phase 1 / PR-8)
 *
 * Implements Rule 4 (Strict Typing), Rule 60 (Dead-Man Controls),
 * Rule 62 (No Code Deployments for Flags), Rule 64 (Precedence Hierarchy), and PRD §73.
 *
 * Precedence Order:
 * 1. Emergency Kill-Switch (capability-specific)
 * 2. Global Autonomous Execution Switch (Rule 60)
 * 3. Workspace Override (Rule 64)
 * 4. Organization Override (Rule 64)
 * 5. Progressive Canary Rollout Percentage
 * 6. Default State / Capability Policies
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { InvocationSurface } from '../execution/invocation';

export type SurfaceType = InvocationSurface;

export interface FlagOverride {
  enabled?: boolean;
  agentEnabled?: boolean;
  mcpEnabled?: boolean;
  humanEnabled?: boolean;
}

export interface CapabilityFlagRecord {
  capabilityId: string;
  killSwitch?: boolean;
  defaultState?: boolean;
  agentEnabled?: boolean;
  mcpEnabled?: boolean;
  humanEnabled?: boolean;
  orgOverrides?: Record<string, FlagOverride>;
  workspaceOverrides?: Record<string, FlagOverride>;
  rolloutPercentage?: number; // 0 - 100
  updatedAt?: string;
  updatedBy?: string;
}

export interface GlobalAutonomousControl {
  autonomousExecutionEnabled: boolean;
  killSwitch?: boolean;
  reason?: string;
}

export type FlagEvaluationTier =
  | 'kill_switch'
  | 'global_autonomous'
  | 'workspace_override'
  | 'org_override'
  | 'rollout'
  | 'default';

export interface FlagEvaluationResult {
  enabled: boolean;
  reason?: string;
  tier: FlagEvaluationTier;
}
