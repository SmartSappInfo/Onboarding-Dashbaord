import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scheduleDelayTask, cancelDelayTask, rescheduleDelayTask } from '../gcp-tasks-client';
import { adminDb } from '../firebase-admin';

// Mock Firestore admin db
vi.mock('../firebase-admin', () => {
  const setMock = vi.fn().mockResolvedValue(undefined);
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const docMock = vi.fn().mockReturnValue({
    set: setMock,
    update: updateMock,
  });
  const collectionMock = vi.fn().mockReturnValue({
    doc: docMock,
  });

  return {
    adminDb: {
      collection: collectionMock,
    },
  };
});

describe('GCP Tasks Client & Emulator (P5-4, Strategy C)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should run in emulator mode and trigger local HTTP endpoint upon timeout expiration', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    global.fetch = fetchMock;

    const executeAt = new Date(Date.now() + 5000).toISOString(); // 5 seconds delay
    const taskKey = await scheduleDelayTask({
      runId: 'run-123',
      nodeId: 'delay-node',
      automationId: 'auto-456',
      executeAt,
      workspaceId: 'onboarding',
      payload: { contactEmail: 'test@example.com' },
    });

    expect(taskKey).toBe('task_run-123_delay-node');

    // Verify Firestore job audit write
    expect(adminDb.collection).toHaveBeenCalledWith('automation_jobs');
    const mockCollection = adminDb.collection('automation_jobs');
    expect(mockCollection.doc).toHaveBeenCalledWith(taskKey);

    // Advance timer by 5 seconds
    await vi.advanceTimersByTimeAsync(5000);

    // Verify that the local fetch was triggered to resume execution
    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/automations/resume');
    expect(init?.method).toBe('POST');
    
    const body = JSON.parse(init?.body as string);
    expect(body.runId).toBe('run-123');
    expect(body.nodeId).toBe('delay-node');
    expect(body.automationId).toBe('auto-456');
    expect(body.payload.contactEmail).toBe('test@example.com');
  });

  it('should support task cancellation before timeout fires', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const executeAt = new Date(Date.now() + 10000).toISOString();
    await scheduleDelayTask({
      runId: 'run-999',
      nodeId: 'delay-node-x',
      automationId: 'auto-888',
      executeAt,
      workspaceId: 'onboarding',
    });

    // Cancel the task
    await cancelDelayTask('run-999', 'delay-node-x');

    // Advance timer by 10 seconds
    await vi.advanceTimersByTimeAsync(10000);

    // Verify fetch was NOT triggered
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should load service, delay executor, and jump engine modules successfully with zero dynamic import resolution errors', async () => {
    const service = await import('../automations/service');
    const delay = await import('../automations/nodes/delay');
    const jump = await import('../automations/jump-engine');

    expect(service.saveAutomation).toBeDefined();
    expect(delay.handleDelayNode).toBeDefined();
    expect(jump.evaluateContactJumps).toBeDefined();
  });

  it('should correctly map the "bulk" channel to the bulk-trigger-queue to avoid blocking delivery traffic', async () => {
    // Tests parseQueueChannel internal resolution through scheduleBulkTriggerTask or direct parse.
    const { parseQueueChannel } = await import('../gcp-tasks-client');
    expect(parseQueueChannel('bulk')).toBe('bulk');
    expect(parseQueueChannel('invalid-channel')).toBeUndefined();
  });
});
