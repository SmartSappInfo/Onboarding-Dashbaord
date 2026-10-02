'use client';

/**
 * @fileOverview Capability Execution React Hook (Phase 1 / PR-9)
 *
 * Implements Rule 18 (TOCTOU), Rule 19 (Deterministic Idempotency),
 * Rule 23 (State Change Invariant), Rule 51 (User Error Notice Contract), and PRD §53.
 *
 * Manages invocation state transitions, safe retry disciplines, and conflict resolution.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { useState, useCallback, useRef } from 'react';
import type { StateChanged } from '../errors/capability-error';
import { invokeCapabilityAction } from './invoke-capability-action';
import type {
  ClientCapabilityError,
  ClientCapabilityInvocation,
  ClientCapabilityOutcome,
  UseCapabilityReturn,
  UseCapabilityStatus,
} from './types';

export interface UseCapabilityOptions<TOutput> {
  version?: string;
  workspaceId?: string;
  onSuccess?: (data: TOutput) => void;
  onError?: (error: ClientCapabilityError) => void;
  onConflict?: (conflict: { expectedVersion?: string | number; actualVersion?: string | number }) => void;
  onApprovalRequired?: (approval: { approvalId?: string; requiredLevel?: string }) => void;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `idem_${crypto.randomUUID()}`;
  }
  return `idem_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function useCapability<TInput = unknown, TOutput = unknown>(
  capabilityId: string,
  options?: UseCapabilityOptions<TOutput>
): UseCapabilityReturn<TInput, TOutput> {
  const [status, setStatus] = useState<UseCapabilityStatus>('idle');
  const [data, setData] = useState<TOutput | null>(null);
  const [error, setError] = useState<ClientCapabilityError | null>(null);
  const [stateChanged, setStateChanged] = useState<StateChanged>('no');
  const [conflict, setConflict] = useState<{
    expectedVersion?: string | number;
    actualVersion?: string | number;
  } | null>(null);
  const [approval, setApproval] = useState<{
    approvalId?: string;
    requiredLevel?: string;
  } | null>(null);

  const idempotencyKeyRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setData(null);
    setError(null);
    setStateChanged('no');
    setConflict(null);
    setApproval(null);
    idempotencyKeyRef.current = null;
  }, []);

  const execute = useCallback(
    async (
      input: TInput,
      invocationOverrides?: Partial<Omit<ClientCapabilityInvocation<TInput>, 'input' | 'capabilityId'>>
    ): Promise<ClientCapabilityOutcome<TOutput>> => {
      // Manage Idempotency Key:
      // If no key exists or if previous attempt changed state (or was unknown), allocate fresh key.
      // If previous attempt cleanly failed with stateChanged === 'no', reuse key for deterministic retry.
      if (!idempotencyKeyRef.current || stateChanged !== 'no') {
        idempotencyKeyRef.current = invocationOverrides?.idempotencyKey ?? generateIdempotencyKey();
      }

      setStatus('running');
      setError(null);
      setConflict(null);
      setApproval(null);

      const targetWorkspaceId = invocationOverrides?.workspaceId ?? options?.workspaceId;

      const outcome = await invokeCapabilityAction<TInput, TOutput>({
        capabilityId,
        version: invocationOverrides?.version ?? options?.version,
        input,
        idempotencyKey: idempotencyKeyRef.current,
        expectedVersion: invocationOverrides?.expectedVersion,
        dryRun: invocationOverrides?.dryRun,
        approvalId: invocationOverrides?.approvalId,
        workspaceId: targetWorkspaceId,
      });

      if (outcome.success) {
        setData(outcome.data);
        setStatus('success');
        setStateChanged(outcome.stateChanged);
        idempotencyKeyRef.current = null; // Success consumes intent
        options?.onSuccess?.(outcome.data);
        return outcome;
      }

      // Handle failure outcome
      const err = outcome.error;
      setError(err);
      setStateChanged(err.stateChanged);

      switch (err.code) {
        case 'UNAUTHENTICATED':
        case 'FORBIDDEN':
        case 'AUTHORIZATION_DENIED':
        case 'TENANT_SCOPE_VIOLATION':
          setStatus('permission-denied');
          break;
        case 'DISABLED':
          setStatus('disabled');
          break;
        case 'VERSION_CONFLICT':
          setStatus('conflict');
          if (err.conflict) {
            setConflict(err.conflict);
            options?.onConflict?.(err.conflict);
          }
          break;
        case 'APPROVAL_REQUIRED':
          setStatus('approval-required');
          if (err.approval) {
            setApproval(err.approval);
            options?.onApprovalRequired?.(err.approval);
          }
          break;
        default:
          setStatus('error');
          break;
      }

      options?.onError?.(err);
      return outcome;
    },
    [capabilityId, options, stateChanged]
  );

  return {
    execute,
    status,
    isRunning: status === 'running',
    isSuccess: status === 'success',
    isError: status === 'error' || status === 'permission-denied' || status === 'disabled',
    data,
    error,
    stateChanged,
    reset,
    conflict,
    approval,
  };
}
