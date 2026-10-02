// @vitest-environment node
/**
 * @fileOverview Route Handler Security & Integration Tests for Event Dispatcher Route (Milestone 1)
 *
 * Validates Rule 13 (No Anonymous Fallback), Rule 34 (SSRF & Boundary Controls),
 * and Rule 51 (Server Action & Route Handler Security Gate).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../../app/api/tasks/event-dispatcher/route';
import * as cloudTasksAuth from '@/lib/security/cloud-tasks-auth';
import * as cloudTasksOidc from '@/lib/security/cloud-tasks-oidc';
import * as worker from '@/platform/tasks/event-dispatcher-worker';

describe('Event Dispatcher Route Handler: Security & Auth Gate (Rules 13, 51)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests missing valid Cloud Tasks handshake signature with 401 Unauthorized (Rule 34)', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockReturnValue(false);

    const req = new NextRequest('http://localhost:3000/api/tasks/event-dispatcher', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ batchSize: 20 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toContain('Unauthorized handshake signature');
  });

  it('rejects requests failing Cloud Tasks OIDC verification with 401 Unauthorized (Rule 13)', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockReturnValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({
      authorized: false,
      reason: 'Expired OIDC token',
    });

    const req = new NextRequest('http://localhost:3000/api/tasks/event-dispatcher', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cloudtasks-queuename': 'event-dispatcher-queue',
      },
      body: JSON.stringify({ batchSize: 20 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe('Expired OIDC token');
  });

  it('authenticates valid Cloud Tasks requests and returns EventDispatchResult (Rule 51)', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockReturnValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({
      authorized: true,
      email: 'cloud-tasks@smartsapp.iam.gserviceaccount.com',
    });

    const mockResult = {
      success: true,
      processedCount: 5,
      dispatchedCount: 5,
      deadLetterCount: 0,
      skippedCount: 0,
      durationMs: 42,
      errors: [],
    };
    vi.spyOn(worker, 'processEventDispatch').mockResolvedValue(mockResult);

    const req = new NextRequest('http://localhost:3000/api/tasks/event-dispatcher', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cloudtasks-queuename': 'event-dispatcher-queue',
        authorization: 'Bearer valid_mock_token',
      },
      body: JSON.stringify({ batchSize: 25, leaseDurationMs: 30000 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.dispatchedCount).toBe(5);
    expect(worker.processEventDispatch).toHaveBeenCalledWith({
      batchSize: 25,
      leaseDurationMs: 30000,
    });
  });

  it('rejects malformed dispatch options with 400 Bad Request (Rule 4)', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockReturnValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({
      authorized: true,
    });

    const req = new NextRequest('http://localhost:3000/api/tasks/event-dispatcher', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cloudtasks-queuename': 'event-dispatcher-queue',
      },
      body: JSON.stringify({ batchSize: 9999 }), // Exceeds max 100
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Invalid dispatch options');
  });
});
