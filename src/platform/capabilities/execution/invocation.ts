/**
 * @fileOverview Capability Invocation Contract & Surface Builders (Phase 1 / PR-4)
 *
 * Implements Rule 16, Rule 18, Rule 19, Rule 20, Rule 22, Rule 39, Rule 68, Rule 69.
 *
 * Defines the canonical invocation envelope accepted by `executeCapability()`,
 * with surface builders for Server Actions, MCP Tools, Cloud Tasks workers, and Agents.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { randomUUID } from 'node:crypto';
import type { AgentPrincipal } from '../contracts/capability-definition';
import type { DomainEvent } from '../events/domain-event';
import type { CapabilityErrorCode, StateChanged } from '../errors/capability-error';

export type InvocationSurface = 'ui' | 'mcp' | 'agent' | 'automation' | 'task_worker' | 'api';

export interface CapabilityInvocation<TInput = unknown> {
  capabilityId: string;
  version?: string; // Pinned SemVer, or default to registered version
  surface: InvocationSurface;
  input: TInput;
  rawPayloadSize?: number; // Pre-calculated raw byte length before parsing (Rule 9)
  correlationId: string;
  causationId?: string;
  traceId?: string;
  spanId?: string;
  idempotencyKey?: string;
  expectedVersion?: string | number; // TOCTOU Optimistic Concurrency Guard (Rule 18)
  dryRun?: boolean; // Shadow Mode / Dry-Run (Rule 42)
  approvalId?: string; // Human Approval Binding (Rule 22)
  callDepth?: number; // Max execution depth guard
  principal?: AgentPrincipal; // Pre-resolved caller identity
}

export interface GatewayExecutionSuccess<TOutput> {
  success: true;
  data: TOutput;
  executionId: string;
  correlationId: string;
  durationMs: number;
  stateChanged: 'no' | 'yes';
  emittedEvents: DomainEvent[];
  resourceVersion?: string | number;
}

export interface GatewayExecutionFailure {
  success: false;
  error: {
    code: CapabilityErrorCode;
    message: string;
    stateChanged: StateChanged;
    retryable: boolean;
    httpStatus: number;
    details?: Record<string, unknown>;
  };
  executionId: string;
  correlationId: string;
  durationMs: number;
}

export type GatewayExecutionOutcome<TOutput> =
  | GatewayExecutionSuccess<TOutput>
  | GatewayExecutionFailure;

// ── Surface Invocation Builders ──

export interface CreateServerActionInvocationOptions<TInput> {
  capabilityId: string;
  version?: string;
  input: TInput;
  principal: AgentPrincipal;
  expectedVersion?: string | number;
  idempotencyKey?: string;
  correlationId?: string;
}

export function createServerActionInvocation<TInput>(
  options: CreateServerActionInvocationOptions<TInput>
): CapabilityInvocation<TInput> {
  return {
    capabilityId: options.capabilityId,
    version: options.version,
    surface: 'ui',
    input: options.input,
    principal: options.principal,
    expectedVersion: options.expectedVersion,
    idempotencyKey: options.idempotencyKey,
    correlationId: options.correlationId ?? randomUUID(),
  };
}

export interface CreateMcpInvocationOptions<TInput> {
  capabilityId: string;
  version?: string;
  input: TInput;
  principal?: AgentPrincipal;
  idempotencyKey?: string;
  correlationId?: string;
}

export function createMcpInvocation<TInput>(
  options: CreateMcpInvocationOptions<TInput>
): CapabilityInvocation<TInput> {
  return {
    capabilityId: options.capabilityId,
    version: options.version,
    surface: 'mcp',
    input: options.input,
    principal: options.principal,
    idempotencyKey: options.idempotencyKey,
    correlationId: options.correlationId ?? randomUUID(),
  };
}

export interface CreateTaskWorkerInvocationOptions<TInput> {
  capabilityId: string;
  version: string;
  input: TInput;
  principal: AgentPrincipal;
  idempotencyKey: string;
  correlationId: string;
  causationId?: string;
  approvalId?: string;
  expectedVersion?: string | number;
}

export function createTaskWorkerInvocation<TInput>(
  options: CreateTaskWorkerInvocationOptions<TInput>
): CapabilityInvocation<TInput> {
  return {
    capabilityId: options.capabilityId,
    version: options.version,
    surface: 'task_worker',
    input: options.input,
    principal: options.principal,
    idempotencyKey: options.idempotencyKey,
    correlationId: options.correlationId,
    causationId: options.causationId,
    approvalId: options.approvalId,
    expectedVersion: options.expectedVersion,
  };
}
