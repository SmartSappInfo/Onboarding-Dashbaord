/**
 * @fileOverview Chaos Engineering & Synthetic Fault Contracts (Phase 15 Milestone 3)
 *
 * Implements Rules 1, 2, 4, 18, 24, 25, 26, 27, 45, 48, 60, 67, 68, 69, 1972.
 * Defines types for synthetic fault injection, chaos evaluation, and recovery coordination.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  ChaosFaultType,
  ChaosFaultRule,
  ChaosExecutionOutcome,
} from '@/platform/security/contracts/security-types';

export type {
  ChaosFaultType,
  ChaosFaultRule,
  ChaosExecutionOutcome,
};

export interface ChaosContext {
  organizationId: string;
  workspaceId?: string;
  capabilityId: string;
  personaId?: string;
  signal?: AbortSignal;
  expectedVersion?: number;
  currentVersion?: number;
  stepIndex?: number;
  totalSteps?: number;
  metadata?: Record<string, unknown>;
}

export interface ChaosSimulationReport {
  faultType: ChaosFaultType;
  outcome: ChaosExecutionOutcome;
  recovered: boolean;
  recoveryStrategy: string;
  quarantinedToDlq: boolean;
}
