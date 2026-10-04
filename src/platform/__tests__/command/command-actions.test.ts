/**
 * @fileOverview Test Suite for Secure Command Server Actions (Phase 8 Milestone 1)
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 8 & 47: Anti-IDOR enforcement tests.
 * - Rule 19: Idempotency parameter tracking.
 * - Rule 21: Two-Phase model on high-risk actions.
 * - Rule 40: Domain event emission verification.
 * - Rule 51: Server Action authentication verification.
 * - Rule 60: Emergency dead-man pause check.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as requireAuthModule from '@/lib/auth/require-auth';
import * as deadManModule from '@/platform/policy/governance-dead-man';
import {
  classifyCommandIntentAction,
  getCommandSuggestionsAction,
  executeCommandAction,
} from '@/app/actions/command-actions';
import { defaultEventBus } from '@/platform/events/event-bus';
import { COMMAND_ERROR_CODES } from '@/platform/ui/command/command-types';

describe('Command Server Actions', () => {
  const tenant = {
    organizationId: 'org_acme',
    workspaceId: 'ws_sales',
  };

  const mockUser = {
    uid: 'user_123',
    profile: {
      organizationId: tenant.organizationId,
    } as unknown as requireAuthModule.AuthContext['profile'],
    isSystemAdmin: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(requireAuthModule, 'requireAuth').mockResolvedValue(mockUser);
    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockResolvedValue(undefined);
  });

  describe('classifyCommandIntentAction', () => {
    it('fails if caller is unauthenticated', async () => {
      vi.spyOn(requireAuthModule, 'requireAuth').mockRejectedValue(new Error('Not signed in.'));

      const result = await classifyCommandIntentAction({
        prompt: 'find all deals',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Not signed in');
    });

    it('enforces Anti-IDOR boundary when requested tenant does not match session', async () => {
      const result = await classifyCommandIntentAction({
        prompt: 'find all deals',
        organizationId: 'org_other_tenant',
        workspaceId: tenant.workspaceId,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(COMMAND_ERROR_CODES.IDOR_VIOLATION);
    });

    it('classifies intent successfully for authenticated caller within valid tenant', async () => {
      const result = await classifyCommandIntentAction({
        prompt: 'find all deals closing this month',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
      });

      expect(result.success).toBe(true);
      expect(result.data?.intent).toBe('SEARCH');
      expect(result.data?.confidence).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('getCommandSuggestionsAction', () => {
    it('enforces Anti-IDOR on suggestions request', async () => {
      const result = await getCommandSuggestionsAction({
        organizationId: 'org_spoofed',
        workspaceId: tenant.workspaceId,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(COMMAND_ERROR_CODES.IDOR_VIOLATION);
    });

    it('returns suggestions for authenticated tenant', async () => {
      const result = await getCommandSuggestionsAction({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
      });

      expect(result.success).toBe(true);
      expect(result.data && result.data.length > 0).toBe(true);
    });
  });

  describe('executeCommandAction', () => {
    it('enforces Anti-IDOR validation', async () => {
      const result = await executeCommandAction({
        prompt: 'search recent notes',
        intent: 'SEARCH',
        idempotencyKey: 'idemp_1',
        organizationId: 'org_attacker',
        workspaceId: tenant.workspaceId,
        parameters: {},
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(COMMAND_ERROR_CODES.IDOR_VIOLATION);
    });

    it('fails closed when emergency dead-man pause switch is active for mutating actions (Rule 60)', async () => {
      vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockRejectedValue(
        new deadManModule.AgentGovernanceEmergencyPausedError('Dead-man tripped')
      );

      const result = await executeCommandAction({
        prompt: 'create follow-up note',
        intent: 'EXECUTE',
        idempotencyKey: 'idemp_2',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        parameters: {},
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(COMMAND_ERROR_CODES.DEAD_MAN_PAUSED);
    });

    it('executes SEARCH command and emits domain event (Rule 40)', async () => {
      const eventSpy = vi.spyOn(defaultEventBus, 'publish');

      const result = await executeCommandAction({
        prompt: 'find enterprise contracts',
        intent: 'SEARCH',
        idempotencyKey: 'idemp_3',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        parameters: {},
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('completed');
      expect(result.data?.intent).toBe('SEARCH');
      expect(result.data?.redirectUrl).toContain('/admin/brain');
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'command.executed',
          organizationId: tenant.organizationId,
        })
      );
    });

    it('executes ANALYZE command and returns report summary', async () => {
      const result = await executeCommandAction({
        prompt: 'analyze customer feedback sentiment',
        intent: 'ANALYZE',
        idempotencyKey: 'idemp_4',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        parameters: {},
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('completed');
      expect(result.data?.intent).toBe('ANALYZE');
      expect(result.data?.redirectUrl).toContain('/admin/intelligence');
    });

    it('requires two-phase human approval for destructive EXECUTE command when not confirmed (Rule 21)', async () => {
      const result = await executeCommandAction({
        prompt: 'delete all test leads from CRM',
        intent: 'EXECUTE',
        idempotencyKey: 'idemp_5',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        parameters: {},
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('waiting_for_approval');
      expect(result.data?.summary).toContain('requires human sign-off');
    });

    it('completes destructive EXECUTE command when confirmed', async () => {
      const result = await executeCommandAction({
        prompt: 'delete all test leads from CRM',
        intent: 'EXECUTE',
        idempotencyKey: 'idemp_6',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        parameters: { confirmed: true },
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('completed');
    });

    it('dispatches DELEGATE command by instantiating an autonomous agent run', async () => {
      const result = await executeCommandAction({
        prompt: 'assign to researcher agent to investigate competitor pricing',
        intent: 'DELEGATE',
        idempotencyKey: 'idemp_7',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        parameters: {},
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('started');
      expect(result.data?.runId).toBeDefined();
      expect(result.data?.redirectUrl).toContain('/admin/agents');
    });

    it('dispatches AUTOMATE command by creating durable workflow instance', async () => {
      const result = await executeCommandAction({
        prompt: 'automate daily sync workflow on every new lead',
        intent: 'AUTOMATE',
        idempotencyKey: 'idemp_8',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        parameters: {},
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('started');
      expect(result.data?.workflowId).toBeDefined();
      expect(result.data?.redirectUrl).toContain('/admin/workflows');
    });
  });
});
