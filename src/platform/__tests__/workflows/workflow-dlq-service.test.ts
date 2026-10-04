/**
 * @fileOverview Unit Tests for Workflow Dead-Letter Queue (DLQ) Service (Phase 7 Milestone 4)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkflowDlqService,
  sanitizeErrorMessage,
  createMemoryWorkflowDlqStore,
} from '../../workflows/resilience/workflow-dlq-service';
import { createEventBus } from '@/platform/events/event-bus';
import { WorkflowResilienceError } from '../../workflows/resilience/workflow-resilience-types';
import type { TenantBoundary } from '../../workflows/workflow-types';

describe('Workflow Dead-Letter Queue (DLQ) Service (Phase 7 Milestone 4)', () => {
  describe('1. Error Sanitizer (Rule 48 & 32)', () => {
    it('redacts sensitive API keys, JWTs, DB connection URIs, and private keys', () => {
      const rawError =
        'Failed to connect to postgresql://admin:secret123@db.prod.internal:5432/crm with key sk-proj-1234567890abcdef1234567890 and Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcO7_9';

      const sanitized = sanitizeErrorMessage(rawError);
      expect(sanitized).not.toContain('postgresql://');
      expect(sanitized).not.toContain('sk-proj-');
      expect(sanitized).not.toContain('eyJhbGciOiJ');
      expect(sanitized).toContain('[REDACTED_SECRET:db_uri]');
      expect(sanitized).toContain('[REDACTED_SECRET:api_key]');
      expect(sanitized).toContain('Bearer [REDACTED_SECRET:jwt]');
    });

    it('redacts Google API keys and credit cards', () => {
      const rawError =
        'Google GenAI call failed with key AIzaSyD-1234567890abcdefghijklmnopqrstuv for card 4111 2222 3333 4444';
      const sanitized = sanitizeErrorMessage(rawError);
      expect(sanitized).not.toContain('AIzaSyD');
      expect(sanitized).not.toContain('4111 2222 3333 4444');
      expect(sanitized).toContain('[REDACTED_SECRET:api_key]');
      expect(sanitized).toContain('[REDACTED_SECRET:credit_card]');
    });
  });

  describe('2. DLQ Service Operations (Rules 8, 25, 40, 47)', () => {
    let service: WorkflowDlqService;
    let store: ReturnType<typeof createMemoryWorkflowDlqStore>;
    let eventBus: ReturnType<typeof createEventBus>;

    const tenant: TenantBoundary = {
      organizationId: 'org_dlq_test',
      workspaceId: 'ws_dlq_test',
    };

    beforeEach(() => {
      store = createMemoryWorkflowDlqStore();
      eventBus = createEventBus();
      service = new WorkflowDlqService({ store, eventBus });
    });

    it('successfully routes failed step to DLQ and publishes domain event', async () => {
      const eventsPublished: string[] = [];
      eventBus.subscribe('workflow.dlq_routed', async (evt) => {
        eventsPublished.push(evt.type);
      });

      const entry = await service.routeToDlq({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        workflowId: 'wf_order_1',
        stepId: 'step_charge',
        stepIndex: 1,
        capabilityId: 'finance.charge_card',
        attempt: 5,
        maxAttempts: 5,
        rawError: {
          code: 'STRIPE_ERROR',
          message: 'Charge failed with secret sk-1234567890abcdef12345678',
        },
        stepInput: { amount: 1000 },
        correlationId: 'corr_test_1',
      });

      expect(entry.id).toMatch(/^dlq_/);
      expect(entry.status).toBe('quarantined');
      expect(entry.sanitizedError.message).toContain('[REDACTED_SECRET:api_key]');
      expect(entry.sanitizedError.message).not.toContain('sk-1234567890');
      expect(eventsPublished).toContain('workflow.dlq_routed');
    });

    it('enforces Anti-IDOR tenant perimeter on listing and single entry retrieval (Rule 8 & 47)', async () => {
      const entry = await service.routeToDlq({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        workflowId: 'wf_order_2',
        stepId: 'step_email',
        stepIndex: 2,
        capabilityId: 'messaging.send_email',
        attempt: 5,
        maxAttempts: 5,
        rawError: new Error('Rate limit exceeded'),
        stepInput: { to: 'user@example.com' },
      });

      // Same tenant: succeeds
      const fetched = await service.getDlqEntry(entry.id, tenant);
      expect(fetched?.id).toBe(entry.id);

      // Other tenant: throws IDOR_VIOLATION
      const foreignTenant: TenantBoundary = {
        organizationId: 'org_attacker_tenant',
        workspaceId: 'ws_attacker_tenant',
      };
      await expect(service.getDlqEntry(entry.id, foreignTenant)).rejects.toThrow(
        WorkflowResilienceError
      );
    });

    it('remediates DLQ entry with action retry, updating status to replayed and emitting domain event', async () => {
      const eventsPublished: string[] = [];
      eventBus.subscribe('workflow.dlq_remediated', async (evt) => {
        eventsPublished.push(evt.type);
      });

      const entry = await service.routeToDlq({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        workflowId: 'wf_order_3',
        stepId: 'step_notification',
        stepIndex: 3,
        capabilityId: 'messaging.notify',
        attempt: 3,
        maxAttempts: 3,
        rawError: new Error('Downstream webhook timeout'),
        stepInput: { message: 'Hello' },
      });

      const remediated = await service.remediateDlqEntry({
        dlqId: entry.id,
        tenant,
        remediatedBy: 'user_operator_1',
        action: 'retry',
        notes: 'Downstream webhook service restored',
      });

      expect(remediated.status).toBe('replayed');
      expect(remediated.remediation?.action).toBe('retry');
      expect(remediated.remediation?.remediatedBy).toBe('user_operator_1');
      expect(eventsPublished).toContain('workflow.dlq_remediated');

      // Attempting to remediate an already remediated entry throws DLQ_ALREADY_REMEDIATED
      await expect(
        service.remediateDlqEntry({
          dlqId: entry.id,
          tenant,
          remediatedBy: 'user_operator_1',
          action: 'skip',
        })
      ).rejects.toThrow(WorkflowResilienceError);
    });

    it('supports skip and discard remediation actions', async () => {
      const entrySkip = await service.routeToDlq({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        workflowId: 'wf_order_4',
        stepId: 'step_optional',
        stepIndex: 4,
        capabilityId: 'crm.sync_optional',
        attempt: 3,
        maxAttempts: 3,
        rawError: new Error('Optional sync failed'),
        stepInput: {},
      });

      const remediatedSkip = await service.remediateDlqEntry({
        dlqId: entrySkip.id,
        tenant,
        remediatedBy: 'user_operator_2',
        action: 'skip',
      });
      expect(remediatedSkip.status).toBe('skipped');

      const entryDiscard = await service.routeToDlq({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        workflowId: 'wf_order_5',
        stepId: 'step_legacy',
        stepIndex: 5,
        capabilityId: 'legacy.sync',
        attempt: 3,
        maxAttempts: 3,
        rawError: new Error('Legacy system deprecated'),
        stepInput: {},
      });

      const remediatedDiscard = await service.remediateDlqEntry({
        dlqId: entryDiscard.id,
        tenant,
        remediatedBy: 'user_operator_2',
        action: 'discard',
      });
      expect(remediatedDiscard.status).toBe('discarded');
    });
  });
});
