import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAutomationTrigger } from '../automation-trigger-map';
import { emitMeetingRegistrantActivity } from '../meeting-automation-events';

const mockLogActivity = vi.fn().mockResolvedValue(undefined);

vi.mock('../activity-logger', () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

describe('Meeting registrant → activity → trigger (P5-3)', () => {
  beforeEach(() => {
    mockLogActivity.mockClear();
  });

  it('maps registrant activity types to automation triggers', () => {
    expect(resolveAutomationTrigger('meeting_registrant_added')).toBe('MEETING_REGISTRANT_ADDED');
    expect(resolveAutomationTrigger('meeting_registrant_attended')).toBe('MEETING_REGISTRANT_ATTENDED');
    expect(resolveAutomationTrigger('meeting_registrant_no_show')).toBe('MEETING_REGISTRANT_NO_SHOW');
  });

  it('emitMeetingRegistrantActivity logs with meeting metadata', async () => {
    await emitMeetingRegistrantActivity({
      type: 'meeting_registrant_added',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      meetingId: 'meet-1',
      registrantId: 'reg-1',
      entityId: 'ent-1',
      meetingTypeId: 'parent',
    });

    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'meeting_registrant_added',
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        entityId: 'ent-1',
        metadata: expect.objectContaining({
          meetingId: 'meet-1',
          meetingTypeId: 'parent',
        }),
      })
    );
  });
});
