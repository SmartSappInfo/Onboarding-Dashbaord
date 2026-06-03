// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock firebase-admin BEFORE importing the module under test.
// ---------------------------------------------------------------------------

vi.mock('../firebase-admin', () => {
  const update = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn();
  const deleteMock = vi.fn();
  const commit = vi.fn().mockResolvedValue(undefined);
  const batch = vi.fn(() => ({ set, commit, update, delete: deleteMock }));

  const docGet = vi.fn();
  const docRef = { update };
  const doc = vi.fn(() => ({ get: docGet, ...docRef }));

  const get = vi.fn();
  const where = vi.fn();
  where.mockReturnValue({ where, get });

  const collection = vi.fn(() => ({ where, doc }));

  return {
    adminDb: { batch, collection },
    __mocks: { update, set, delete: deleteMock, commit, batch, docGet, doc, get, where, collection },
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
  rescheduleRemindersForMeeting,
  scheduleMeetingInvitations,
} from '../reminder-actions';
import { computeScheduledAt } from '../template-variable-utils';
import * as firebaseAdmin from '../firebase-admin';
import * as messagingEngine from '../messaging-engine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mocks = () => (firebaseAdmin as any).__mocks as {
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
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
      { ref: { delete: vi.fn() } },
      { ref: { delete: vi.fn() } },
      { ref: { delete: vi.fn() } },
    ];
    mocks().get.mockResolvedValue({ empty: false, docs: fakeDocs });

    await cancelRemindersForMeeting('meeting-multi');

    // batch.delete called once per doc
    expect(mocks().delete).toHaveBeenCalledTimes(3);
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

describe('rescheduleRemindersForMeeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks().where.mockReturnValue({ where: mocks().where, get: mocks().get });
    mocks().commit.mockResolvedValue(undefined);
  });

  it('cancels old reminders and schedules new alerts', async () => {
    const fakeDoc = { ref: { delete: vi.fn().mockResolvedValue(undefined) } };
    mocks().get.mockResolvedValue({ empty: false, docs: [fakeDoc] });

    const meeting = {
      id: 'meeting-123',
      meetingTime: new Date(Date.now() + 3600 * 1000 * 24).toISOString(), // 1 day in the future
      enabledReminders: ['meeting_reminder_1day'],
      messagingConfig: {
        invitationsEnabled: false,
        reminders: []
      }
    };

    await rescheduleRemindersForMeeting(meeting as any, 'org-123');

    // Should cancel old reminders first
    expect(mocks().where).toHaveBeenCalledWith('sourceEventId', '==', 'meeting-123');
    expect(mocks().where).toHaveBeenCalledWith('status', '==', 'pending');
    expect(mocks().commit).toHaveBeenCalled();
  });
});

describe('scheduleMeetingInvitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks().where.mockReturnValue({ where: mocks().where, get: mocks().get });
    mocks().commit.mockResolvedValue(undefined);
    mocks().docGet.mockResolvedValue({ exists: false });
  });

  it('skips initial slot if sent, but schedules other reminder slots even if sent', async () => {
    const registrantDoc = {
      data: () => ({
        token: 'token-123',
        name: 'Guest User',
        email: 'guest@example.com',
        status: 'pending',
        sentInvitations: {
          'initial_email': '2026-06-01T10:00:00Z',
          '1_day_before_email': '2026-06-02T10:00:00Z',
        }
      })
    };

    mocks().get
      .mockResolvedValueOnce({ empty: false, docs: [registrantDoc] }) // first get for pending registrants
      .mockResolvedValueOnce({ empty: true, docs: [] }); // second get for existing pending scheduled messages

    const meeting = {
      id: 'meeting-123',
      meetingTime: new Date(Date.now() + 3600 * 1000 * 48).toISOString(), // 2 days in the future
      messagingConfig: {
        invitationsEnabled: true,
        invitationSeries: [
          {
            id: 'initial',
            enabled: true,
            channels: ['email'],
            emailTemplateId: 'tpl-initial',
            smsTemplateId: 'tpl-initial-sms',
            offsetMinutes: 0,
            anchor: 'after_registration'
          },
          {
            id: '1_day_before',
            enabled: true,
            channels: ['email'],
            emailTemplateId: 'tpl-1day',
            smsTemplateId: 'tpl-1day-sms',
            offsetMinutes: 1440,
            anchor: 'before_event'
          }
        ]
      }
    };

    await scheduleMeetingInvitations(meeting as any, 'org-123');

    // We expect one message to be set in batch: 1_day_before (since initial was sent and slot.id is 'initial')
    // Wait, let's verify that batch.set was called only for the non-initial slot
    expect(mocks().set).toHaveBeenCalledTimes(1);
    const setCall = mocks().set.mock.calls[0];
    expect(setCall[1]).toEqual(expect.objectContaining({
      reminderType: 'meeting_invitation_1_day_before',
      templateId: 'tpl-1day'
    }));
  });
});

