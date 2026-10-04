/**
 * @fileOverview Test Suite for Canonical Command Contracts & Taxonomy (Phase 8 Milestone 1)
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 10: Inline test architectural documentation.
 * - Rule 19: Deterministic idempotency key verification.
 */

import { describe, it, expect } from 'vitest';
import {
  COMMAND_INTENTS,
  CommandIntentSchema,
  CommandClassificationInputSchema,
  SuggestedActionBlueprintSchema,
  CommandClassificationResultSchema,
  CommandSuggestionSchema,
  ExecuteCommandInputSchema,
  CommandExecutionResultSchema,
  COMMAND_ERROR_CODES,
  CommandError,
  mapCommandErrorToHttpStatus,
  computeCommandIdempotencyKey,
} from '@/platform/ui/command/command-types';

describe('Command Contracts & Taxonomy', () => {
  describe('Intent Schemas & Taxonomy', () => {
    it('validates all 5 canonical intent types', () => {
      expect(COMMAND_INTENTS).toEqual(['SEARCH', 'ANALYZE', 'EXECUTE', 'DELEGATE', 'AUTOMATE']);

      for (const intent of COMMAND_INTENTS) {
        expect(CommandIntentSchema.parse(intent)).toBe(intent);
      }

      expect(() => CommandIntentSchema.parse('INVALID_INTENT')).toThrow();
    });

    it('validates CommandClassificationInputSchema with tenant isolation', () => {
      const valid = {
        prompt: 'Find deals closing this month',
        organizationId: 'org_123',
        workspaceId: 'ws_456',
        contextEntityId: 'deal_789',
        contextEntityType: 'deal',
      };

      const parsed = CommandClassificationInputSchema.parse(valid);
      expect(parsed.organizationId).toBe('org_123');
      expect(parsed.prompt).toBe('Find deals closing this month');

      // Fails on missing tenant
      expect(() =>
        CommandClassificationInputSchema.parse({
          prompt: 'Find deals',
          organizationId: '',
          workspaceId: 'ws_456',
        })
      ).toThrow();
    });

    it('validates SuggestedActionBlueprintSchema and risk levels', () => {
      const validAction = {
        id: 'act_1',
        title: 'Search Deals',
        description: 'Searches all deals',
        intent: 'SEARCH' as const,
        estimatedRiskLevel: 'L0_READ' as const,
        requiresApproval: false,
      };

      const parsed = SuggestedActionBlueprintSchema.parse(validAction);
      expect(parsed.intent).toBe('SEARCH');
      expect(parsed.estimatedRiskLevel).toBe('L0_READ');
      expect(parsed.requiresApproval).toBe(false);
    });

    it('validates CommandClassificationResultSchema with full attributes', () => {
      const result = {
        intent: 'ANALYZE' as const,
        confidence: 0.95,
        targetDomain: 'analytics',
        targetEntities: [
          {
            id: 'deal_123',
            type: 'deal',
            title: 'DEAL #deal_123',
            href: '/admin/crm/deal/deal_123',
          },
        ],
        suggestedAction: {
          id: 'act_analyze_1',
          title: 'Analyze Deal',
          description: 'Runs churn analysis',
          intent: 'ANALYZE' as const,
          estimatedRiskLevel: 'L0_READ' as const,
          requiresApproval: false,
        },
        suggestedPlan: ['Retrieve evidence', 'Synthesize report'],
        sanitizedPrompt: 'Analyze deal deal_123',
        latencyMs: 14.5,
      };

      const parsed = CommandClassificationResultSchema.parse(result);
      expect(parsed.intent).toBe('ANALYZE');
      expect(parsed.targetEntities).toHaveLength(1);
      expect(parsed.suggestedPlan).toHaveLength(2);
      expect(parsed.latencyMs).toBe(14.5);
    });

    it('validates ExecuteCommandInputSchema and CommandExecutionResultSchema', () => {
      const input = {
        prompt: 'Create follow-up task',
        intent: 'EXECUTE' as const,
        idempotencyKey: 'idemp_key_123',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        parameters: { priority: 'high' },
      };

      const parsedInput = ExecuteCommandInputSchema.parse(input);
      expect(parsedInput.idempotencyKey).toBe('idemp_key_123');

      const outcome = {
        executionId: 'exec_123',
        status: 'completed' as const,
        intent: 'EXECUTE' as const,
        summary: 'Created follow-up task',
        data: { taskId: 'task_999' },
        redirectUrl: '/admin/tasks',
        executedAt: new Date().toISOString(),
      };

      const parsedOutcome = CommandExecutionResultSchema.parse(outcome);
      expect(parsedOutcome.status).toBe('completed');
      expect(parsedOutcome.executionId).toBe('exec_123');
    });

    it('validates CommandSuggestionSchema', () => {
      const suggestion = {
        id: 'sug_1',
        label: 'Find Deals',
        prompt: 'Find deals closing this month',
        intent: 'SEARCH' as const,
        icon: 'Search',
        badge: 'CRM',
      };

      const parsed = CommandSuggestionSchema.parse(suggestion);
      expect(parsed.label).toBe('Find Deals');
      expect(parsed.badge).toBe('CRM');
    });
  });

  describe('Error Taxonomy & Helpers', () => {
    it('creates CommandError with correct code and status', () => {
      const err = new CommandError(COMMAND_ERROR_CODES.INVALID_INTENT, 'Invalid intent provided', 400);
      expect(err.name).toBe('CommandError');
      expect(err.code).toBe(COMMAND_ERROR_CODES.INVALID_INTENT);
      expect(err.status).toBe(400);

      expect(mapCommandErrorToHttpStatus(err)).toBe(400);
      expect(mapCommandErrorToHttpStatus(new Error('Generic'))).toBe(500);
    });

    it('computes deterministic idempotency keys across identical inputs within same minute', () => {
      const key1 = computeCommandIdempotencyKey('find deals', 'org_1', 'user_1', 1);
      const key2 = computeCommandIdempotencyKey('find deals', 'org_1', 'user_1', 1);
      const key3 = computeCommandIdempotencyKey('create task', 'org_1', 'user_1', 1);

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1.startsWith('cmd_idemp_')).toBe(true);
    });
  });
});
