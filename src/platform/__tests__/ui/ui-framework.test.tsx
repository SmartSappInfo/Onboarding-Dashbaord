/**
 * @fileOverview Capability UI Framework & Error/Conflict Surfaces Tests (Phase 1 / PR-9)
 *
 * Implements Rule 4 (Strict Typing), Rule 18 (TOCTOU Concurrency Guard),
 * Rule 19 (Deterministic Idempotency Discipline), Rule 23 (State Change Invariant),
 * Rule 51 (User Error Notice Contract), and PRD §53.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { z } from 'zod/v4';
import type { AgentPrincipal, CapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import { registerCapability, resetCapabilityRegistryForTests } from '../../capabilities/registry/capability-registry';
import { defaultFlagChecker } from '../../capabilities/flags/flag-service';
import {
  invokeCapabilityAction,
  checkCapabilityAvailabilityAction,
} from '../../capabilities/ui/invoke-capability-action';
import { useCapability } from '../../capabilities/ui/use-capability';
import { CapabilityErrorNotice } from '@/components/capabilities/CapabilityErrorNotice';
import { VersionConflictDialog } from '@/components/capabilities/VersionConflictDialog';
import { ApprovalRequiredNotice } from '@/components/capabilities/ApprovalRequiredNotice';
import type { ClientCapabilityError } from '../../capabilities/ui/types';

// Mock session principal resolver
const mockSessionPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_ui_123',
  organizationId: 'org_ui_test',
  workspaceId: 'ws_ui_test',
  grantedScopes: ['*'],
  effectiveRole: 'admin',
};

vi.mock('@/lib/auth/require-auth', () => ({
  requireWorkspace: vi.fn(async () => ({
    uid: 'user_ui_123',
    profile: {
      id: 'user_ui_123',
      organizationId: 'org_ui_test',
      role: 'admin',
      permissions: ['*'],
    },
    isSystemAdmin: true,
  })),
}));

vi.mock('@/platform/capabilities/policy/session-principal-resolver', () => ({
  resolvePrincipalFromSession: vi.fn(async () => mockSessionPrincipal),
}));

const sampleCapability: CapabilityDefinition<{ title: string; count?: number }, { id: string; title: string }> = {
  id: 'ui.test.item_create',
  version: '1.0.0',
  name: 'Create UI Item',
  domain: 'tasks_productivity',
  operation: 'create',
  description: 'Test capability for UI invocation',
  inputSchema: z.object({
    title: z.string().min(1),
    count: z.number().optional(),
    workspaceId: z.string().optional(),
  }),
  outputSchema: z.object({
    id: z.string(),
    title: z.string(),
  }),
  permissions: ['tasks.write'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L2_STATE_MUTATION',
    destructive: false,
    idempotent: false,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 5000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    defaultEnabled: true,
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
  },
  handler: async (input) => ({
    success: true,
    data: {
      id: 'item_999',
      title: input.title,
    },
    executionId: 'exec_ui_1',
    emittedEvents: [],
    durationMs: 12,
  }),
};

describe('PR-9: Capability UI Invocation Framework & Error Surfaces', () => {
  beforeEach(() => {
    resetCapabilityRegistryForTests();
    registerCapability(sampleCapability);
    defaultFlagChecker.invalidateCache();
  });

  describe('invokeCapabilityAction server action', () => {
    it('rejects invocation when target workspaceId is missing', async () => {
      const outcome = await invokeCapabilityAction({
        capabilityId: 'ui.test.item_create',
        input: { title: 'No workspace' },
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('INVALID_INPUT');
        expect(outcome.error.message).toContain('workspaceId is required');
        expect(outcome.error.stateChanged).toBe('no');
        expect(outcome.error.httpStatus).toBe(400);
      }
    });

    it('successfully invokes capability and returns formatted outcome', async () => {
      const outcome = await invokeCapabilityAction({
        capabilityId: 'ui.test.item_create',
        workspaceId: 'ws_ui_test',
        input: { title: 'Test Task' },
      });

      expect(outcome.success).toBe(true);
      if (outcome.success) {
        expect(outcome.data).toEqual({ id: 'item_999', title: 'Test Task' });
        expect(outcome.stateChanged).toBe('yes');
        expect(outcome.executionId).toBeDefined();
        expect(typeof outcome.durationMs).toBe('number');
      }
    });

    it('sanitizes actionConfig to enforce relative routes only (Open Redirect Protection)', async () => {
      // Register a failing capability that returns actionConfig in error
      const failingCapability: CapabilityDefinition<{ testType: string }, { ok: boolean }> = {
        id: 'ui.test.failing',
        version: '1.0.0',
        name: 'Failing Capability',
        domain: 'platform_integrations',
        operation: 'execute',
        description: 'Capability that fails with dangerous actionConfig',
        inputSchema: z.object({ testType: z.string(), workspaceId: z.string().optional() }),
        outputSchema: z.object({ ok: z.boolean() }),
        permissions: ['rbac:operations.tasks.create'],
        workspaceScoped: true,
        tenantScoped: true,
        risk: {
          level: 'L0_READ',
          destructive: false,
          idempotent: true,
          openWorld: false,
          requiresHumanApproval: false,
          nonDelegable: false,
        },
        execution: {
          synchronous: true,
          maxDurationMs: 5000,
          supportsDryRun: true,
          supportsCancellation: false,
          supportsCompensation: false,
          maxPayloadSizeBytes: 1024 * 1024,
        },
        policies: {
          defaultEnabled: true,
          requiresIdempotencyKey: false,
          requiresExpectedVersion: false,
          auditRequired: false,
        },
        handler: async (input) => {
          if (input.testType === 'safe') {
            return {
              success: false,
              error: {
                code: 'PRECONDITION_FAILED',
                message: 'Configuration missing',
                stateChanged: 'no',
                retryable: false,
                details: {
                  actionConfig: { path: '/admin/settings', label: 'Configure Settings' },
                },
              },
              executionId: 'exec_fail_safe',
            };
          }
          return {
            success: false,
            error: {
              code: 'PRECONDITION_FAILED',
              message: 'Dangerous redirect attempt',
              stateChanged: 'no',
              retryable: false,
              details: {
                actionConfig: { path: 'https://evil.com/phish', label: 'External Link' },
              },
            },
            executionId: 'exec_fail_unsafe',
          };
        },
      };

      registerCapability(failingCapability);

      // 1. Safe relative path is preserved
      const safeOutcome = await invokeCapabilityAction({
        capabilityId: 'ui.test.failing',
        workspaceId: 'ws_ui_test',
        input: { testType: 'safe' },
      });

      expect(safeOutcome.success).toBe(false);
      if (!safeOutcome.success) {
        expect(safeOutcome.error.actionConfig).toEqual({
          path: '/admin/settings',
          label: 'Configure Settings',
        });
      }

      // 2. Unsafe external protocol is stripped
      const unsafeOutcome = await invokeCapabilityAction({
        capabilityId: 'ui.test.failing',
        workspaceId: 'ws_ui_test',
        input: { testType: 'unsafe' },
      });

      expect(unsafeOutcome.success).toBe(false);
      if (!unsafeOutcome.success) {
        expect(unsafeOutcome.error.actionConfig).toBeUndefined();
      }
    });
  });

  describe('checkCapabilityAvailabilityAction pre-flight check', () => {
    it('returns available: false for unregistered capability', async () => {
      const result = await checkCapabilityAvailabilityAction('unknown.capability', 'ws_ui_test');
      expect(result.available).toBe(false);
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('not registered');
    });

    it('returns available: true when registered and allowed', async () => {
      const result = await checkCapabilityAvailabilityAction('ui.test.item_create', 'ws_ui_test');
      expect(result.available).toBe(true);
      expect(result.enabled).toBe(true);
      expect(result.authorized).toBe(true);
      expect(result.riskLevel).toBe('L2_STATE_MUTATION');
    });
  });

  describe('useCapability React hook', () => {
    it('initializes in idle state and executes successfully', async () => {
      const { result } = renderHook(() =>
        useCapability<{ title: string }, { id: string; title: string }>('ui.test.item_create', {
          workspaceId: 'ws_ui_test',
        })
      );

      expect(result.current.status).toBe('idle');
      expect(result.current.isRunning).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();

      let outcome: import('../../capabilities/ui/types').ClientCapabilityOutcome<{ id: string; title: string }> | undefined;
      await act(async () => {
        outcome = await result.current.execute({ title: 'New Task' });
      });

      expect(outcome?.success).toBe(true);
      expect(result.current.status).toBe('success');
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual({ id: 'item_999', title: 'New Task' });
      expect(result.current.error).toBeNull();

      // Test reset
      act(() => {
        result.current.reset();
      });
      expect(result.current.status).toBe('idle');
      expect(result.current.data).toBeNull();
    });

    it('preserves idempotency key across retry when stateChanged is "no"', async () => {
      let callCount = 0;
      const keysUsed: (string | undefined)[] = [];

      const retryCapability: CapabilityDefinition<{ failOnce: boolean }, { done: boolean }> = {
        id: 'ui.test.retry',
        version: '1.0.0',
        name: 'Retry Test',
        domain: 'platform_integrations',
        operation: 'execute',
        description: 'Test retry idempotency discipline',
        inputSchema: z.object({ failOnce: z.boolean(), workspaceId: z.string().optional() }),
        outputSchema: z.object({ done: z.boolean() }),
        permissions: ['rbac:operations.tasks.create'],
        workspaceScoped: true,
        tenantScoped: true,
        risk: {
          level: 'L0_READ',
          destructive: false,
          idempotent: true,
          openWorld: false,
          requiresHumanApproval: false,
          nonDelegable: false,
        },
        execution: {
          synchronous: true,
          maxDurationMs: 5000,
          supportsDryRun: true,
          supportsCancellation: false,
          supportsCompensation: false,
          maxPayloadSizeBytes: 1024 * 1024,
        },
        policies: {
          defaultEnabled: true,
          requiresIdempotencyKey: false,
          requiresExpectedVersion: false,
          auditRequired: false,
        },
        handler: async (input, ctx) => {
          keysUsed.push(ctx.idempotencyKey);
          callCount++;
          if (callCount === 1) {
            return {
              success: false,
              error: {
                code: 'TEMPORARY_UNAVAILABLE',
                message: 'Transient issue',
                stateChanged: 'no',
                retryable: true,
              },
              executionId: 'exec_fail_1',
            };
          }
          return {
            success: true,
            data: { done: true },
            executionId: 'exec_succ_2',
            emittedEvents: [],
            durationMs: 5,
          };
        },
      };

      registerCapability(retryCapability);

      const { result } = renderHook(() =>
        useCapability<{ failOnce: boolean }, { done: boolean }>('ui.test.retry', {
          workspaceId: 'ws_ui_test',
        })
      );

      // Attempt 1: Fails with stateChanged: 'no'
      await act(async () => {
        await result.current.execute({ failOnce: true });
      });

      expect(result.current.status).toBe('error');
      expect(result.current.stateChanged).toBe('no');

      // Attempt 2: Retry
      await act(async () => {
        await result.current.execute({ failOnce: true });
      });

      expect(result.current.status).toBe('success');
      expect(keysUsed.length).toBe(2);
      // Under stateChanged: 'no', the generated idempotency key was preserved!
      expect(keysUsed[0]).toBeDefined();
      expect(keysUsed[0]).toBe(keysUsed[1]);
    });
  });

  describe('Capability UI Notice & Dialog Components', () => {
    it('CapabilityErrorNotice renders state changed badge and triggers onRetry', async () => {
      const onRetryMock = vi.fn();
      const onDismissMock = vi.fn();

      const testError: ClientCapabilityError = {
        code: 'VALIDATION',
        message: 'Name field cannot be empty.',
        stateChanged: 'no',
        retryable: true,
        httpStatus: 400,
        actionConfig: {
          path: '/admin/settings',
          label: 'Fix in Settings',
        },
      };

      render(
        <CapabilityErrorNotice
          error={testError}
          onRetry={onRetryMock}
          onDismiss={onDismissMock}
        />
      );

      // Error message & code
      expect(screen.getByText('Name field cannot be empty.')).toBeInTheDocument();
      expect(screen.getByText('[VALIDATION]')).toBeInTheDocument();

      // State Changed Invariant Badge
      expect(screen.getByText('No changes made')).toBeInTheDocument();

      // Actionable button
      expect(screen.getByText('Fix in Settings')).toBeInTheDocument();

      // Retry button click
      const retryBtn = screen.getByText('Retry');
      await act(async () => {
        fireEvent.click(retryBtn);
      });
      expect(onRetryMock).toHaveBeenCalledTimes(1);

      // Dismiss button click
      const dismissBtn = screen.getByLabelText('Dismiss error notice');
      await act(async () => {
        fireEvent.click(dismissBtn);
      });
      expect(onDismissMock).toHaveBeenCalledTimes(1);
    });

    it('VersionConflictDialog adheres to theme.md Section 8 and triggers onReload', async () => {
      const onReloadMock = vi.fn();
      const onOpenChangeMock = vi.fn();

      render(
        <VersionConflictDialog
          open={true}
          onOpenChange={onOpenChangeMock}
          expectedVersion="v1.2"
          actualVersion="v1.3"
          onReload={onReloadMock}
        />
      );

      expect(screen.getByText('Conflict Detected')).toBeInTheDocument();
      expect(screen.getByText('v1.2')).toBeInTheDocument();
      expect(screen.getByText('v1.3')).toBeInTheDocument();

      const reloadBtn = screen.getByText('Reload Latest');
      await act(async () => {
        fireEvent.click(reloadBtn);
      });
      expect(onReloadMock).toHaveBeenCalledTimes(1);
    });

    it('ApprovalRequiredNotice renders tracking ID and review instructions', () => {
      const onOpenChangeMock = vi.fn();

      render(
        <ApprovalRequiredNotice
          open={true}
          onOpenChange={onOpenChangeMock}
          approvalId="appr_test_777"
          requiredLevel="L3_CRITICAL_WRITE"
          capabilityName="Deleting user account"
        />
      );

      expect(screen.getByText('Approval Required')).toBeInTheDocument();
      expect(screen.getByText('appr_test_777')).toBeInTheDocument();
      expect(screen.getByText('L3_CRITICAL_WRITE')).toBeInTheDocument();
      expect(screen.getByText('View Approvals')).toBeInTheDocument();
    });
  });
});
