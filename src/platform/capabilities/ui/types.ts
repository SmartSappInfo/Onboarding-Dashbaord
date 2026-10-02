/**
 * @fileOverview Capability UI Framework Types (Phase 1 / PR-9)
 *
 * Implements Rule 4 (Strict Typing), Rule 23 (State Change Invariant),
 * Rule 51 (User-Facing Error Notice Contract), and PRD §53.
 *
 * Defines the contract between client components, hooks, server actions, and error dialogs.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { CapabilityErrorCode, StateChanged } from '../errors/capability-error';

export interface ClientCapabilityInvocation<TInput = unknown> {
  capabilityId: string;
  version?: string;
  input: TInput;
  idempotencyKey?: string;
  expectedVersion?: string | number;
  dryRun?: boolean;
  approvalId?: string;
  workspaceId?: string;
}

export interface ClientActionConfig {
  /** Relative route path starting with '/' (Open redirect protection) */
  path: string;
  label: string;
}

export interface ClientCapabilitySuccess<TOutput> {
  success: true;
  data: TOutput;
  executionId: string;
  durationMs: number;
  stateChanged: 'no' | 'yes';
  resourceVersion?: string | number;
}

export interface ClientCapabilityError {
  code: CapabilityErrorCode;
  message: string;
  stateChanged: StateChanged;
  retryable: boolean;
  httpStatus: number;
  details?: Record<string, unknown>;
  actionConfig?: ClientActionConfig;
  conflict?: {
    expectedVersion?: string | number;
    actualVersion?: string | number;
  };
  approval?: {
    approvalId?: string;
    requiredLevel?: string;
  };
}

export interface ClientCapabilityFailure {
  success: false;
  error: ClientCapabilityError;
  executionId?: string;
  durationMs?: number;
}

export type ClientCapabilityOutcome<TOutput = unknown> =
  | ClientCapabilitySuccess<TOutput>
  | ClientCapabilityFailure;

export type UseCapabilityStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'error'
  | 'permission-denied'
  | 'disabled'
  | 'conflict'
  | 'approval-required';

export interface UseCapabilityReturn<TInput, TOutput> {
  execute: (
    input: TInput,
    options?: Partial<Omit<ClientCapabilityInvocation<TInput>, 'input' | 'capabilityId'>>
  ) => Promise<ClientCapabilityOutcome<TOutput>>;
  status: UseCapabilityStatus;
  isRunning: boolean;
  isSuccess: boolean;
  isError: boolean;
  data: TOutput | null;
  error: ClientCapabilityError | null;
  stateChanged: StateChanged;
  reset: () => void;
  conflict: { expectedVersion?: string | number; actualVersion?: string | number } | null;
  approval: { approvalId?: string; requiredLevel?: string } | null;
}
