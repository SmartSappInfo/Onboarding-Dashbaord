// @vitest-environment node
/**
 * @fileOverview Route Handler Security & Integration Tests for Memory Indexer Route (Phase 4 Milestone 3)
 *
 * Verifies Rules 4, 13, 34, 51, and 60.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../../app/api/tasks/memory-indexer/route';
import * as cloudTasksAuth from '@/lib/security/cloud-tasks-auth';
import * as cloudTasksOidc from '@/lib/security/cloud-tasks-oidc';
import * as worker from '@/platform/memory/ingestion/memory-ingestion-worker';

describe('Memory Indexer Route Handler: Security & Auth Gate (Rules 13, 34, 51)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPayload = {
    jobId: 'job-route-1',
    organizationId: 'org-route-1',
    workspaceId: 'ws-route-1',
    idempotencyKey: 'idem-route-1',
    targets: [
      {
        sourceType: 'document',
        sourceId: 'doc-route-1',
        title: 'Route Test Document',
        content: '# Title\nValid content for indexing via route handler.',
        sensitivity: 'internal',
        importance: 0.5,
        confidence: 1.0,
        topics: ['test'],
        subjectRefs: {},
        customMetadata: {},
      },
    ],
    createdAt: new Date().toISOString(),
  };

  it('rejects requests missing valid Cloud Tasks handshake signature with 401 Unauthorized (Rule 34)', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/tasks/memory-indexer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toContain('Unauthorized handshake signature');
  });

  it('rejects requests failing Cloud Tasks OIDC verification with 401 Unauthorized (Rule 13)', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({
      authorized: false,
      reason: 'Expired or invalid OIDC token',
    });

    const req = new NextRequest('http://localhost:3000/api/tasks/memory-indexer', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cloudtasks-queuename': 'memory-indexer-queue',
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

    const req = new NextRequest('http://localhost:3000/api/tasks/memory-indexer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ malformed: json',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('Malformed JSON payload');
  });

  it('rejects requests with invalid schema payload with 400 Bad Request', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({
      authorized: true,
      email: 'cloud-tasks@smartsapp.iam.gserviceaccount.com',
    });

    const req = new NextRequest('http://localhost:3000/api/tasks/memory-indexer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId: 'job-incomplete' }), // Missing required fields
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('Invalid memory ingestion payload');
  });

  it('authenticates valid Cloud Tasks requests and dispatches to worker successfully (Rule 51)', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({
      authorized: true,
      email: 'cloud-tasks@smartsapp.iam.gserviceaccount.com',
    });

    const mockResult = {
      jobId: 'job-route-1',
      organizationId: 'org-route-1',
      workspaceId: 'ws-route-1',
      status: 'success' as const,
      indexedDocuments: 1,
      totalChunks: 2,
      duplicateChunksSkipped: 0,
      latencyMs: 45,
      errors: [],
    };
    vi.spyOn(worker, 'processMemoryIngestionJob').mockResolvedValue(mockResult);

    const req = new NextRequest('http://localhost:3000/api/tasks/memory-indexer', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cloudtasks-queuename': 'memory-indexer-queue',
      },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('success');
    expect(body.indexedDocuments).toBe(1);
    expect(body.totalChunks).toBe(2);
  });

  it('returns 503 when the operator emergency dead-man pause is active (Rule 60)', async () => {
    vi.spyOn(cloudTasksAuth, 'isAuthorizedCloudTaskRequest').mockResolvedValue(true);
    vi.spyOn(cloudTasksOidc, 'verifyCloudTasksOidcToken').mockResolvedValue({
      authorized: true,
      email: 'cloud-tasks@smartsapp.iam.gserviceaccount.com',
    });

    vi.spyOn(worker, 'processMemoryIngestionJob').mockRejectedValue(
      new Error('INGESTION_DEAD_MAN_PAUSED: Emergency stop active')
    );

    const req = new NextRequest('http://localhost:3000/api/tasks/memory-indexer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.error).toContain('INGESTION_DEAD_MAN_PAUSED');
  });
});
