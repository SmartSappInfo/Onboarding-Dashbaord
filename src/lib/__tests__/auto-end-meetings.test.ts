// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin
vi.mock('../firebase-admin', () => {
  const get = vi.fn();
  const where = vi.fn();
  where.mockReturnValue({ get });
  const collection = vi.fn(() => ({ where }));

  return {
    adminDb: { collection },
    __mocks: { get, where, collection },
  };
});

// Mock meeting-post-event-action
vi.mock('../../app/actions/meeting-post-event-action', () => {
  const endMeetingAction = vi.fn().mockResolvedValue({ success: true });
  return {
    endMeetingAction,
    __mocks: { endMeetingAction },
  };
});

import { autoEndCompletedMeetings } from '../reminder-actions';
import * as firebaseAdmin from '../firebase-admin';
import * as meetingPostEventAction from '../../app/actions/meeting-post-event-action';

const dbMocks = () => (firebaseAdmin as any).__mocks;
const actionMocks = () => (meetingPostEventAction as any).__mocks;

describe('autoEndCompletedMeetings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks().where.mockReturnValue({ get: dbMocks().get });
    actionMocks().endMeetingAction.mockResolvedValue({ success: true });
  });

  it('correctly auto-ends meetings that are past durationMinutes + 1 Hour', async () => {
    const now = new Date();
    
    // Meeting 1: Started 2.5 hours ago, duration 60 mins. Cutoff = 1.5 hours ago. (Should auto-end)
    const m1Time = new Date(now.getTime() - 2.5 * 60 * 60 * 1000).toISOString();
    
    // Meeting 2: Started 30 mins ago, duration 60 mins. Cutoff = 30 mins in the future. (Should NOT auto-end)
    const m2Time = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    
    // Meeting 3: Started 1.5 hours ago, duration 15 mins. Cutoff = 15 mins ago. (Should auto-end)
    const m3Time = new Date(now.getTime() - 1.5 * 60 * 60 * 1000).toISOString();

    const mockDocs = [
      {
        id: 'meet-1',
        data: () => ({
          meetingTime: m1Time,
          durationMinutes: 60,
          organizationId: 'org-abc',
          status: 'active',
        }),
      },
      {
        id: 'meet-2',
        data: () => ({
          meetingTime: m2Time,
          durationMinutes: 60,
          organizationId: 'org-abc',
          status: 'scheduled',
        }),
      },
      {
        id: 'meet-3',
        data: () => ({
          meetingTime: m3Time,
          durationMinutes: 15,
          organizationId: 'org-xyz',
          status: 'active',
        }),
      },
    ];

    dbMocks().get.mockResolvedValue({
      empty: false,
      docs: mockDocs,
    });

    const result = await autoEndCompletedMeetings();

    expect(result.endedCount).toBe(2);
    expect(result.errors.length).toBe(0);

    // endMeetingAction should have been called on meet-1 and meet-3 but not meet-2
    expect(actionMocks().endMeetingAction).toHaveBeenCalledTimes(2);
    expect(actionMocks().endMeetingAction).toHaveBeenCalledWith('meet-1', 'org-abc');
    expect(actionMocks().endMeetingAction).toHaveBeenCalledWith('meet-3', 'org-xyz');
  });

  it('handles empty query snapshots gracefully', async () => {
    dbMocks().get.mockResolvedValue({
      empty: true,
      docs: [],
    });

    const result = await autoEndCompletedMeetings();
    expect(result.endedCount).toBe(0);
    expect(actionMocks().endMeetingAction).not.toHaveBeenCalled();
  });
});
