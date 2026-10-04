// @vitest-environment node
/**
 * @fileOverview Route Handler Security & Integration Tests for Workflow Step Route (Phase 7 Milestone 2)
 *
 * Verifies Rules 4, 33, 34, 51, and 60.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/tasks/workflow-step/route';
import * as cloudTasksAuth from '@/lib/security/cloud-tasks-auth';
import * as cloudTasksOidc from '@/lib/security/cloud-tasks-oidc';
import * as deadMan from '@/platform/policy/governance-dead-man';
import * as stepRunnerModule from '@/platform/workflows/execution/workflow-step-runner';

describe('Workflow Step Route Handler: Security & Auth Gate (Rules 33, 34, 51, 60)', () => {
  const validPayload = {
    workflowId: 'wf_route_1',
    stepId: 'step_route_1',
    organizationId: 'org_route_1',
    workspaceId: 'ws_route_1',
    idempotencyKey: 'idem_route_1',
    attempt: 0,
    correlationId: 'corr_route_1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    deadMan.setGovernanceDeadManStateForTests(false);
  });

  afterEach(() => {
    deadMan.setGovernanceDeadManStateForTests(false);
  });

  it('rejects requests missing valid Cloud Tasks handshake signature with 401 Unauthorized (Rule 34)', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/tasks/workflow-step', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toContain('Unauthorized handshake signature');
  });

  it('rejects requests failing Cloud Tasks OIDC verification with 401 Unauthorized (Rule 33)', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({
      authorized: false,
      reason: 'Expired or invalid OIDC token',
    });

    const req = new NextRequest('http://localhost:3000/api/tasks/workflow-step', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toContain('Expired or invalid OIDC token');
  });

  it('rejects requests with malformed JSON body with 400 Bad Request', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({
      authorized: true,
      email: 'cloud-tasks@smartsapp.iam.gserviceaccount.com',
    });

    const req = new NextRequest('http://localhost:3000/api/tasks/workflow-step', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ malformed: json',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('Malformed JSON payload');
  });

  it('rejects requests with invalid payload schema with 400 Bad Request', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({
      authorized: true,
      email: 'cloud-tasks@smartsapp.iam.gserviceaccount.com',
    });

    const req = new NextRequest('http://localhost:3000/api/tasks/workflow-step', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invalidField: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('Invalid workflow task payload');
  });

  it('returns HTTP 503 when dead-man switch is engaged (allowing automatic Cloud Tasks backoff retry, Rule 60)', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({
      authorized: true,
      email: 'cloud-tasks@smartsapp.iam.gserviceaccount.com',
    });

    deadMan.setGovernanceDeadManStateForTests(true);

    const req = new NextRequest('http://localhost:3000/api/tasks/workflow-step', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.error).toContain('Execution paused by emergency dead-man switch');
    expect(body.retryable).toBe(true);
  });

  it('executes workflow step successfully and returns 200 with result', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({
      authorized: true,
      email: 'cloud-tasks@smartsapp.iam.gserviceaccount.com',
    });

    const mockRunner = {
      executeWorkflowStep: vi.fn().mockResolvedValue({
        stepId: 'step_route_1',
        status: 'COMPLETED',
        output: { result: 'ok' },
        durationMs: 42,
        nextStepsScheduled: ['step_route_2'],
        retryScheduled: false,
      }),
    };
    vi.spyOn(stepRunnerModule, 'getWorkflowStepRunner').mockReturnValue(
      mockRunner as unknown as stepRunnerModule.WorkflowStepRunner
    );

    const req = new NextRequest('http://localhost:3000/api/tasks/workflow-step', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('COMPLETED');
    expect(body.nextStepsScheduled).toContain('step_route_2');
    expect(mockRunner.executeWorkflowStep).toHaveBeenCalledWith(validPayload);
  });
});
