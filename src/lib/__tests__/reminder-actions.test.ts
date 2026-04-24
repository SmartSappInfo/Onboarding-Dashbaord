import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock firebase-admin BEFORE importing the module under test.
// ---------------------------------------------------------------------------

vi.mock('../firebase-admin', () => {
  const update = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn();
  const commit = vi.fn().mockResolvedValue(undefined);
  const batch = vi.fn(() => ({ set, commit, update }));

  const docGet = vi.fn();
  const docRef = { update };
  const doc = vi.fn(() => ({ get: docGet, ...docRef }));

  const get = vi.fn();
  const where = vi.fn();
  where.mockReturnValue({ where, get });

  const collection = vi.fn(() => ({ where, doc }));

  return {
    adminDb: { batch, collection },
    __mocks: { update, set, commit, batch, docGet, doc, get, where, collection },
  };
});

// Mock messaging-engine so processScheduledMessages doesn't actually send
vi.mock('../messaging-engine', () => ({
  sendMessage: vi.fn(),
}));

// Mock template-resolver so scheduleRemindersForMeeting doesn't hit Firestore
vi.mock('../template-resolver', () => ({
  resolveAndRender: vi.fn(),
  resolveTemplateForOrg: vi.fn(),
}));

import {
  cancelRemindersForMeeting,
  processScheduledMessages,
} from '../reminder-actions';
import { computeScheduledAt } from '../template-variable-utils';
import * as firebaseAdmin from '../firebase-admin';
import * as messagingEngine from '../messaging-engine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mocks = () => (firebaseAdmin as any).__mocks as {
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
  batch: ReturnType<typeof vi.fn>;
  docGet: ReturnType<typeof vi.fn>;
  doc: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  collection: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// computeScheduledAt — core scheduling invariant
// ---------------------------------------------------------------------------

describe('computeScheduledAt', () => {
  const BASE_TIME = '2025-06-20T10:00:00.000Z'; // 10:00 AM UTC

  it('schedules 15 minutes before the event', () => {
    const result = computeScheduledAt(BASE_TIME, 15);
    expect(result).toBe('2025-06-20T09:45:00.000Z');
  });

  it('schedules 1 hour (60 min) before the event', () => {
    const result = computeScheduledAt(BASE_TIME, 60);
    expect(result).toBe('2025-06-20T09:00:00.000Z');
  });

  it('schedules 2 hours (120 min) before the event', () => {
    const result = computeScheduledAt(BASE_TIME, 120);
    expect(result).toBe('2025-06-20T08:00:00.000Z');
  });

  it('schedules 1 day (1440 min) before the event', () => {
    const result = computeScheduledAt(BASE_TIME, 1440);
    expect(result).toBe('2025-06-19T10:00:00.000Z');
  });

  it('schedules at event time when offset is 0 (time_up)', () => {
    const result = computeScheduledAt(BASE_TIME, 0);
    expect(result).toBe(BASE_TIME);
  });

  it('returns a valid ISO string', () => {
    const result = computeScheduledAt(BASE_TIME, 30);
    expect(() => new Date(result)).not.toThrow();
    expect(new Date(result).toISOString()).toBe(result);
  });

  it('handles midnight boundary correctly', () => {
    // 00:30 AM minus 60 min = previous day 23:30
    const midnight = '2025-06-20T00:30:00.000Z';
    const result = computeScheduledAt(midnight, 60);
    expect(result).toBe('2025-06-19T23:30:00.000Z');
  });

  it('is deterministic — same inputs always produce same output', () => {
    const r1 = computeScheduledAt(BASE_TIME, 60);
    const r2 = computeScheduledAt(BASE_TIME, 60);
    expect(r1).toBe(r2);
  });
});

// ---------------------------------------------------------------------------
// cancelRemindersForMeeting
// ---------------------------------------------------------------------------

describe('cancelRemindersForMeeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks().where.mockReturnValue({ where: mocks().where, get: mocks().get });
    mocks().commit.mockResolvedValue(undefined);
  });

  it('queries pending reminders for the meeting and cancels them', async () => {
    const fakeDoc = { ref: { update: vi.fn().mockResolvedValue(undefined) } };
    mocks().get.mockResolvedValue({ empty: false, docs: [fakeDoc] });

    await cancelRemindersForMeeting('meeting-123');

    expect(mocks().where).toHaveBeenCalledWith('sourceEventId', '==', 'meeting-123');
    expect(mocks().where).toHaveBeenCalledWith('sourceEventType', '==', 'meeting');
    expect(mocks().where).toHaveBeenCalledWith('status', '==', 'pending');
    expect(mocks().commit).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no pending reminders exist', async () => {
    mocks().get.mockResolvedValue({ empty: true, docs: [] });

    await cancelRemindersForMeeting('meeting-no-reminders');

    expect(mocks().commit).not.toHaveBeenCalled();
  });

  it('cancels multiple reminders in a single batch', async () => {
    const fakeDocs = [
      { ref: { update: vi.fn() } },
      { ref: { update: vi.fn() } },
      { ref: { update: vi.fn() } },
    ];
    mocks().get.mockResolvedValue({ empty: false, docs: fakeDocs });

    await cancelRemindersForMeeting('meeting-multi');

    // batch.update called once per doc
    expect(mocks().update).toHaveBeenCalledTimes(3);
    expect(mocks().commit).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// processScheduledMessages
// ---------------------------------------------------------------------------

describe('processScheduledMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks().where.mockReturnValue({ where: mocks().where, get: mocks().get });
  });

  it('returns { sent: 0, failed: 0 } when no pending messages', async () => {
    mocks().get.mockResolvedValue({ docs: [] });

    const result = await processScheduledMessages();

    expect(result).toEqual({ sent: 0, failed: 0 });
  });

  it('queries by status=pending and scheduledAt <= now', async () => {
    mocks().get.mockResolvedValue({ docs: [] });

    await processScheduledMessages();

    expect(mocks().where).toHaveBeenCalledWith('status', '==', 'pending');
    expect(mocks().where).toHaveBeenCalledWith('scheduledAt', '<=', expect.any(String));
  });

  it('marks message as sent when sendMessage succeeds', async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const fakeDoc = {
      id: 'msg-1',
      ref: { update: updateFn },
      data: () => ({
        templateId: 'tpl-1',
        channel: 'email',
        recipientContact: 'test@example.com',
        variables: {},
        retryCount: 0,
      }),
    };
    mocks().get.mockResolvedValue({ docs: [fakeDoc] });
    vi.mocked(messagingEngine.sendMessage).mockResolvedValue({ success: true, logId: 'log-1' });

    const result = await processScheduledMessages();

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', sentAt: expect.any(String) }),
    );
  });

  it('increments retryCount and reschedules when sendMessage fails (below max retries)', async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const fakeDoc = {
      id: 'msg-2',
      ref: { update: updateFn },
      data: () => ({
        templateId: 'tpl-1',
        channel: 'sms',
        recipientContact: '+1234567890',
        variables: {},
        retryCount: 0,
      }),
    };
    mocks().get.mockResolvedValue({ docs: [fakeDoc] });
    vi.mocked(messagingEngine.sendMessage).mockResolvedValue({ success: false, error: 'Gateway timeout' });

    const result = await processScheduledMessages();

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0); // not yet failed — just rescheduled
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ retryCount: 1, scheduledAt: expect.any(String) }),
    );
  });

  it('marks message as failed after MAX_RETRIES (3) attempts', async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const fakeDoc = {
      id: 'msg-3',
      ref: { update: updateFn },
      data: () => ({
        templateId: 'tpl-1',
        channel: 'email',
        recipientContact: 'fail@example.com',
        variables: {},
        retryCount: 2, // already tried twice
      }),
    };
    mocks().get.mockResolvedValue({ docs: [fakeDoc] });
    vi.mocked(messagingEngine.sendMessage).mockResolvedValue({ success: false, error: 'Permanent failure' });

    const result = await processScheduledMessages();

    expect(result.failed).toBe(1);
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', retryCount: 3 }),
    );
  });

  it('processes multiple messages and aggregates counts', async () => {
    const makeDoc = (id: string, retryCount = 0) => ({
      id,
      ref: { update: vi.fn().mockResolvedValue(undefined) },
      data: () => ({
        templateId: 'tpl-1',
        channel: 'email',
        recipientContact: `user${id}@example.com`,
        variables: {},
        retryCount,
      }),
    });

    const docs = [makeDoc('a'), makeDoc('b'), makeDoc('c', 2)];
    mocks().get.mockResolvedValue({ docs });

    vi.mocked(messagingEngine.sendMessage)
      .mockResolvedValueOnce({ success: true })   // a → sent
      .mockResolvedValueOnce({ success: true })   // b → sent
      .mockResolvedValueOnce({ success: false, error: 'err' }); // c → failed (retryCount=3)

    const result = await processScheduledMessages();

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(1);
  });
});
