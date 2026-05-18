// @ts-nocheck
/**
 * Background Concurrency Tests — Phase 0 (RED)
 *
 * These tests verify the new `processJobChunkBackground` function that will
 * replace the client-side sequential polling model. The function must:
 *
 * 1. Process a chunk of pending tasks without blocking the caller.
 * 2. Skip tasks already marked as 'sent' (idempotency).
 * 3. Use atomic Firestore increments for progress counters.
 * 4. Schedule the next chunk via `after()` when more tasks remain.
 * 5. Mark the job as 'completed' when all tasks are processed.
 *
 * TDD: These tests must FAIL before implementation exists.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — we mock Firestore and the messaging engine so we can test the
// orchestration logic in isolation (no real database or provider calls).
// ---------------------------------------------------------------------------

// In-memory Firestore mock
const mockTaskDocs: any[] = [];
const mockJobData: Record<string, any> = {};
const mockUpdateCalls: any[] = [];
const mockIncrementCalls: any[] = [];

// Mock template and sender data
const mockTemplateData = {
  channel: 'email',
  subject: 'Test Subject',
  body: '<p>Hello</p>',
  contentMode: 'html_code',
  organizationId: '',
};
const mockSenderData = {
  identifier: 'test@example.com',
  name: 'Test Sender',
  channel: 'email',
};

const mockJobRef = {
  get: vi.fn(async () => ({
    exists: true,
    data: () => ({ ...mockJobData }),
  })),
  update: vi.fn(async (data: any) => {
    mockUpdateCalls.push(data);
    Object.assign(mockJobData, data);
  }),
  collection: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(() => ({
      get: vi.fn(async () => ({
        empty: mockTaskDocs.length === 0,
        size: mockTaskDocs.length,
        docs: [...mockTaskDocs],
      })),
    })),
  })),
};

vi.mock('../../lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((collectionName: string) => {
      if (collectionName === 'message_jobs') {
        return { doc: vi.fn(() => mockJobRef) };
      }
      if (collectionName === 'message_templates') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn(async () => ({
              exists: true,
              data: () => ({ ...mockTemplateData }),
            })),
          })),
        };
      }
      if (collectionName === 'sender_profiles') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn(async () => ({
              exists: true,
              data: () => ({ ...mockSenderData }),
            })),
          })),
        };
      }
      // Default fallback for other collections
      return {
        doc: vi.fn(() => ({
          get: vi.fn(async () => ({ exists: false, data: () => ({}) })),
          update: vi.fn(),
        })),
      };
    }),
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: vi.fn((n: number) => {
      mockIncrementCalls.push(n);
      return { _incrementValue: n };
    }),
  },
}));

// Mock next/server after() — captures the scheduled callback
let afterCallback: (() => void) | null = null;
vi.mock('next/server', () => ({
  after: vi.fn((cb: () => void) => {
    afterCallback = cb;
  }),
}));

// Mock messaging engine
vi.mock('../../lib/messaging-engine', () => ({
  sendMessage: vi.fn(async () => ({ success: true, logId: 'mock-log' })),
}));

// Mock resend service
vi.mock('../../lib/resend-service', () => ({
  sendBatchEmails: vi.fn(async () => ({
    data: [{ id: 'resend-id-1' }],
    error: null,
  })),
}));

// Mock messaging-utils
vi.mock('../../lib/messaging-utils', () => ({
  resolveVariables: vi.fn((template: string) => template),
  renderBlocksToHtml: vi.fn(() => '<p>rendered</p>'),
}));

// Mock suppression service
vi.mock('../../lib/suppression-service', () => ({
  isSuppressed: vi.fn(async () => false),
}));

// Import the function under test — this will fail until we implement it
import { processJobChunkBackground } from '../bulk-messaging';

describe('processJobChunkBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskDocs.length = 0;
    mockUpdateCalls.length = 0;
    mockIncrementCalls.length = 0;
    afterCallback = null;

    // Default job data
    Object.assign(mockJobData, {
      templateId: 'tpl-1',
      senderProfileId: 'sender-1',
      channel: 'email',
      status: 'processing',
      totalRecipients: 100,
      processed: 0,
      success: 0,
      failed: 0,
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
    });
  });

  // ── Test 1: The function exists and is callable ──────────────────────
  it('should be exported as a function', () => {
    expect(typeof processJobChunkBackground).toBe('function');
  });

  // ── Test 2: Skips already-sent tasks (idempotency) ───────────────────
  it('should skip tasks that are already sent', async () => {
    const sentTaskRef = { update: vi.fn() };
    mockTaskDocs.push({
      id: 'task-already-sent',
      ref: sentTaskRef,
      data: () => ({
        recipient: 'alice@test.com',
        variables: {},
        status: 'sent', // Already processed
        providerId: 'resend-old',
      }),
    });

    await processJobChunkBackground('job-1');

    // The task should NOT have been re-processed (no status update to 'sent')
    expect(sentTaskRef.update).not.toHaveBeenCalled();
  });

  // ── Test 3: Uses atomic increments, not read-modify-write ────────────
  it('should use FieldValue.increment() for progress counters', async () => {
    const taskRef = { update: vi.fn() };
    mockTaskDocs.push({
      id: 'task-1',
      ref: taskRef,
      data: () => ({
        recipient: 'bob@test.com',
        variables: {},
        status: 'pending',
      }),
    });

    await processJobChunkBackground('job-1');

    // Verify that the job update used increment values, not absolute numbers
    const jobUpdate = mockUpdateCalls.find(
      (u) => u.processed !== undefined || u.success !== undefined
    );
    expect(jobUpdate).toBeDefined();
    // The processed and success fields should be FieldValue.increment() results
    expect(jobUpdate.processed).toHaveProperty('_incrementValue');
    expect(jobUpdate.success).toHaveProperty('_incrementValue');
  });

  // ── Test 4: Schedules next chunk via after() when tasks remain ───────
  it('should call after() to schedule the next chunk when more tasks exist', async () => {
    // Simulate a job with more pending tasks than this chunk will process
    Object.assign(mockJobData, { totalRecipients: 200, processed: 0 });

    const taskRef = { update: vi.fn() };
    mockTaskDocs.push({
      id: 'task-1',
      ref: taskRef,
      data: () => ({
        recipient: 'charlie@test.com',
        variables: {},
        status: 'pending',
      }),
    });

    await processJobChunkBackground('job-1');

    // after() should have been called to schedule the next chunk
    const { after } = await import('next/server');
    expect(after).toHaveBeenCalled();
    expect(afterCallback).toBeTypeOf('function');
  });

  // ── Test 5: Marks job as completed when all tasks are done ───────────
  it('should mark job as completed when processed equals totalRecipients', async () => {
    Object.assign(mockJobData, { totalRecipients: 1, processed: 0 });

    const taskRef = { update: vi.fn() };
    mockTaskDocs.push({
      id: 'task-last',
      ref: taskRef,
      data: () => ({
        recipient: 'last@test.com',
        variables: {},
        status: 'pending',
      }),
    });

    await processJobChunkBackground('job-1');

    // The job should be marked completed
    const completionUpdate = mockUpdateCalls.find((u) => u.status === 'completed');
    expect(completionUpdate).toBeDefined();
  });

  // ── Test 6: Does NOT call after() when job is complete ───────────────
  it('should not schedule another chunk when the job is fully processed', async () => {
    Object.assign(mockJobData, { totalRecipients: 1, processed: 0 });

    const taskRef = { update: vi.fn() };
    mockTaskDocs.push({
      id: 'task-final',
      ref: taskRef,
      data: () => ({
        recipient: 'final@test.com',
        variables: {},
        status: 'pending',
      }),
    });

    await processJobChunkBackground('job-1');

    const { after } = await import('next/server');
    // after() should NOT be called for a completed job
    expect(after).not.toHaveBeenCalled();
  });

  // ── Test 7: Handles empty task queue gracefully ──────────────────────
  it('should complete the job when no pending tasks remain', async () => {
    // No tasks in the queue
    mockTaskDocs.length = 0;

    await processJobChunkBackground('job-1');

    const completionUpdate = mockUpdateCalls.find((u) => u.status === 'completed');
    expect(completionUpdate).toBeDefined();
  });
});
