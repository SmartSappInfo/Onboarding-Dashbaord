// @vitest-environment node
/**
 * @fileOverview Unit tests for /api/tasks/agent-step route (PR-2)
 *
 * Verifies that the HTTP endpoint fails-closed on unauthorized handshake
 * or invalid OIDC token before any payload parsing or execution occurs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import * as cloudTasksAuth from '@/lib/security/cloud-tasks-auth';
import * as cloudTasksOidc from '@/lib/security/cloud-tasks-oidc';
import * as agentStepExecutor from '@/platform/tasks/agent-step-executor';

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {} as unknown,
}));

vi.mock('@/platform/capabilities/policy/approval-verifier', () => ({
  createFirestoreApprovalVerifier: vi.fn(),
}));

vi.mock('@/platform/capabilities/registry/capability-registry', () => ({
  getCapability: vi.fn(),
}));

vi.mock('@/platform/capabilities/registry/register-capabilities', () => ({
  ensureCapabilitiesRegistered: vi.fn(),
}));

vi.mock('@/platform/tasks/firestore-agent-step-store', () => ({
  createFirestoreAgentStepStore: vi.fn(),
}));

describe('/api/tasks/agent-step route authentication & dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests with 401 when Cloud Tasks handshake secret is invalid', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockReturnValue(false);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({ authorized: true });

    const req = new NextRequest('http://localhost:3000/api/tasks/agent-step', {
      method: 'POST',
      body: JSON.stringify({ runId: 'run-1', stepNumber: 0, idempotencyKey: 'idem-1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toMatchObject({ error: 'Unauthorized handshake signature' });
  });

  it('rejects requests with 401 when Cloud Tasks OIDC token verification fails', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockReturnValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({
      authorized: false,
      reason: 'Invalid token signature',
    });

    const req = new NextRequest('http://localhost:3000/api/tasks/agent-step', {
      method: 'POST',
      body: JSON.stringify({ runId: 'run-1', stepNumber: 0, idempotencyKey: 'idem-1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toMatchObject({ error: 'Invalid token signature' });
  });

  it('returns 400 INVALID_JSON when body cannot be parsed as JSON', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockReturnValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({ authorized: true });

    const req = new NextRequest('http://localhost:3000/api/tasks/agent-step', {
      method: 'POST',
      body: 'not valid json {{{',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toMatchObject({ status: 'rejected', code: 'INVALID_JSON' });
  });

  it('delegates to processAgentStep and returns outcome when authenticated', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockReturnValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({ authorized: true });
    vi.spyOn(agentStepExecutor, 'processAgentStep').mockResolvedValue({
      httpStatus: 200,
      body: { status: 'completed', runId: 'run-1', stepNumber: 0 },
    });

    const req = new NextRequest('http://localhost:3000/api/tasks/agent-step', {
      method: 'POST',
      body: JSON.stringify({ runId: 'run-1', stepNumber: 0, idempotencyKey: 'idem-1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ status: 'completed', runId: 'run-1', stepNumber: 0 });
  });
});
