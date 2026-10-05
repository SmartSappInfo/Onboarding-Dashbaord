// @vitest-environment node
/**
 * @fileOverview Meeting ownership (Phase 11 M1 · T0.2, finding G12).
 * Both ownership shapes are honoured; missing and foreign meetings are indistinguishable.
 */
import { describe, it, expect } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';
import {
  assertMeetingInWorkspace,
  meetingBelongsToWorkspace,
  MeetingNotFoundError,
} from '../meeting-access';

function seed() {
  const db = new FakeFirestore();
  db.write('meetings/shared', { workspaceIds: ['ws-a', 'ws-b'], organizationId: 'org-1', updatedAt: '2026-10-01T00:00:00.000Z', title: 'Demo' });
  db.write('meetings/scalar', { workspaceId: 'ws-a' });
  db.write('meetings/malformed', { workspaceIds: 'ws-a' });
  return db;
}

describe('meetingBelongsToWorkspace', () => {
  it('accepts either shape and rejects everything else', () => {
    expect(meetingBelongsToWorkspace({ workspaceIds: ['ws-a'] }, 'ws-a')).toBe(true);
    expect(meetingBelongsToWorkspace({ workspaceId: 'ws-a' }, 'ws-a')).toBe(true);
    expect(meetingBelongsToWorkspace({ workspaceIds: ['ws-b'] }, 'ws-a')).toBe(false);
    expect(meetingBelongsToWorkspace({}, 'ws-a')).toBe(false);
    expect(meetingBelongsToWorkspace({ workspaceId: '' }, '')).toBe(false);
  });
});

describe('assertMeetingInWorkspace', () => {
  it('returns the scope for a meeting shared with the workspace', async () => {
    const scope = await assertMeetingInWorkspace('shared', 'ws-b', seed().asFirestore());
    expect(scope).toEqual({
      meetingId: 'shared', workspaceId: 'ws-b', organizationId: 'org-1',
      resourceVersion: '2026-10-01T00:00:00.000Z', title: 'Demo',
    });
  });

  it('accepts the scalar workspaceId shape', async () => {
    await expect(assertMeetingInWorkspace('scalar', 'ws-a', seed().asFirestore())).resolves.toMatchObject({ meetingId: 'scalar' });
  });

  it('gives the same NOT_FOUND for missing, foreign, malformed and path-like ids', async () => {
    const db = seed().asFirestore();
    for (const [id, ws] of [['missing', 'ws-a'], ['scalar', 'ws-z'], ['malformed', 'ws-a'], ['shared/x', 'ws-a'], ['', 'ws-a'], ['shared', '']]) {
      await expect(assertMeetingInWorkspace(id, ws, db)).rejects.toBeInstanceOf(MeetingNotFoundError);
    }
  });
});
