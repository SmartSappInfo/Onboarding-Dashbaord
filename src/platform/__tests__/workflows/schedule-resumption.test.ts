/**
 * @fileOverview Unit & Integration Tests for Scheduled Delay Resumption (Phase 7 Milestone 3)
 *
 * Verifies calculation of delay timestamps, execution of scheduled resumptions,
 * Cloud Tasks auth verification (Rule 33 & 51), dead-man 503 retry semantics (Rule 60),
 * and anti-tampering token verification.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  calculateScheduleResumeTime,
  executeScheduledResumption,
  type ScheduleResumePayload,
} from '../../workflows/resumption/schedule-resumption-worker';
import { POST } from '@/app/api/tasks/workflows/schedule-resume/route';
import { createMemoryWorkflowStore } from '../../workflows/workflow-store';
import { createMemoryWorkflowLeaseManager } from '../../workflows/execution/workflow-lease-manager';
import { createMemoryWorkflowDispatcher } from '../../workflows/dispatcher/workflow-dispatcher';
import { createEventBus } from '../../events/event-bus';
import { createWorkflowResumptionService } from '../../workflows/resumption/workflow-resumption-service';
import type { TenantBoundary, CreateWorkflowInstanceInput, CreateWorkflowStepInput } from '../../workflows/workflow-types';
import * as cloudTasksAuth from '@/lib/security/cloud-tasks-auth';
import * as cloudTasksOidc from '@/lib/security/cloud-tasks-oidc';
import * as deadMan from '@/platform/policy/governance-dead-man';

describe('Scheduled Delay Resumption Worker & Route (Phase 7 Milestone 3)', () => {
  const tenant: TenantBoundary = {
    organizationId: 'org_sched_test',
    workspaceId: 'ws_sched_test',
  };

  let store: ReturnType<typeof createMemoryWorkflowStore>;
  let leaseManager: ReturnType<typeof createMemoryWorkflowLeaseManager>;
  let dispatcher: ReturnType<typeof createMemoryWorkflowDispatcher>;
  let eventBus: ReturnType<typeof createEventBus>;
  let resumptionService: ReturnType<typeof createWorkflowResumptionService>;

  beforeEach(() => {
    store = createMemoryWorkflowStore();
    leaseManager = createMemoryWorkflowLeaseManager();
    dispatcher = createMemoryWorkflowDispatcher({ store });
    eventBus = createEventBus();

    resumptionService = createWorkflowResumptionService({
      store,
      leaseManager,
      dispatcher,
      eventBus,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setupWaitingStep(delaySeconds: number) {
    const instanceInput: CreateWorkflowInstanceInput = {
      id: 'wf_sched_01',
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      definitionId: 'def_drip_campaign',
      title: 'Scheduled Drip Campaign',
      initiator: { actorType: 'system', actorId: 'system_scheduler' },
      principal: {
        actorType: 'agent',
        userId: 'user_marketing',
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        agentId: 'agent_campaign',
        grantedScopes: ['messaging:send'],
        effectiveRole: 'editor',
      },
    };
    const instance = await store.createInstance(instanceInput);

    const stepInput: CreateWorkflowStepInput = {
      id: 'step_send_email_2',
      workflowId: instance.id,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      stepIndex: 1,
      capabilityId: 'messaging.email.send',
      name: 'Send Follow-up Email',
      input: { templateId: 'tpl_followup' },
      waitCondition: {
        type: 'schedule',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        details: {
          delaySeconds,
        },
      },
    };
    const step = await store.createStep(stepInput);

    const suspendResult = await resumptionService.evaluateAndSuspendStep(
      instance.id,
      step.id,
      tenant
    );

    return { instance, step, token: suspendResult.token! };
  }

  describe('1. calculateScheduleResumeTime', () => {
    it('calculates target timestamp correctly from delaySeconds', () => {
      const now = Date.now();
      const result = calculateScheduleResumeTime({ delaySeconds: 300 });

      expect(result.delaySeconds).toBe(300);
      const targetTime = new Date(result.targetTimestamp).getTime();
      expect(targetTime).toBeGreaterThanOrEqual(now + 299000);
      expect(targetTime).toBeLessThanOrEqual(now + 301000);
    });

    it('calculates delaySeconds correctly from untilIso', () => {
      const futureDate = new Date(Date.now() + 60000);
      const result = calculateScheduleResumeTime({ untilIso: futureDate.toISOString() });

      expect(result.delaySeconds).toBeGreaterThanOrEqual(58);
      expect(result.delaySeconds).toBeLessThanOrEqual(60);
      expect(result.targetTimestamp).toBe(futureDate.toISOString());
    });

    it('throws on invalid untilIso timestamp', () => {
      expect(() => {
        calculateScheduleResumeTime({ untilIso: 'invalid-date-string' });
      }).toThrow('Invalid untilIso timestamp');
    });
  });

  describe('2. executeScheduledResumption', () => {
    it('successfully resumes workflow step when target timestamp has arrived', async () => {
      const { instance, step, token } = await setupWaitingStep(10);

      const payload: ScheduleResumePayload = {
        workflowId: instance.id,
        stepId: step.id,
        token,
        tenant,
        targetTimestamp: new Date(Date.now() - 1000).toISOString(), // Target has arrived
        correlationId: 'corr_sched_01',
      };

      const result = await executeScheduledResumption(payload, resumptionService);

      expect(result.status).toBe('RESUMED');
      expect(result.workflowId).toBe(instance.id);
      expect(result.stepId).toBe(step.id);

      // Verify store updated
      const updatedInstance = await store.getInstance(instance.id, tenant);
      expect(updatedInstance?.status).toBe('RESUMED');
    });

    it('rejects premature execution if targetTimestamp is too far in future (> 5s)', async () => {
      const { instance, step, token } = await setupWaitingStep(300);

      const payload: ScheduleResumePayload = {
        workflowId: instance.id,
        stepId: step.id,
        token,
        tenant,
        targetTimestamp: new Date(Date.now() + 60000).toISOString(), // 60s in future
      };

      await expect(
        executeScheduledResumption(payload, resumptionService)
      ).rejects.toThrow('Premature schedule resumption');
    });
  });

  describe('3. POST /api/tasks/workflows/schedule-resume Route Handler', () => {
    it('returns HTTP 401 if Cloud Tasks handshake is unauthorized (Rule 34 / 51)', async () => {
      vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(false);

      const req = new NextRequest('http://localhost:3000/api/tasks/workflows/schedule-resume', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Unauthorized handshake signature/i);
    });

    it('returns HTTP 401 if Cloud Tasks OIDC token is invalid (Rule 33)', async () => {
      vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(true);
      vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({
        authorized: false,
        reason: 'OIDC token expired',
      });

      const req = new NextRequest('http://localhost:3000/api/tasks/workflows/schedule-resume', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('OIDC token expired');
    });

    it('returns HTTP 503 when dead-man switch is active for automatic retry backoff (Rule 60)', async () => {
      vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(true);
      vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({ authorized: true });
      vi.spyOn(deadMan, 'checkGovernanceDeadManSwitch').mockRejectedValue(
        new Error('Governance dead-man switch tripped')
      );

      const payload: ScheduleResumePayload = {
        workflowId: 'wf_test',
        stepId: 'step_test',
        token: 'token_test',
        tenant,
        targetTimestamp: new Date().toISOString(),
      };

      const req = new NextRequest('http://localhost:3000/api/tasks/workflows/schedule-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.code).toBe('DEAD_MAN_PAUSED');
    });

    it('returns HTTP 400 for malformed payload', async () => {
      vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(true);
      vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({ authorized: true });
      vi.spyOn(deadMan, 'checkGovernanceDeadManSwitch').mockResolvedValue(undefined);

      const req = new NextRequest('http://localhost:3000/api/tasks/workflows/schedule-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'payload' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Invalid schedule resume payload/i);
    });
  });
});
