import { describe, it, expect, vi } from 'vitest';
import { seedMeetingsV2 } from '@/app/seeds/seed-meetings-v2';

vi.mock('@/lib/firebase-admin', () => {
  const setFn = vi.fn();
  const commitFn = vi.fn().mockResolvedValue(true);
  const docFn = vi.fn().mockReturnValue({ id: 'mock_doc' });
  const collectionFn = vi.fn().mockReturnValue({ doc: docFn });
  const batchFn = vi.fn().mockReturnValue({
    set: setFn,
    commit: commitFn,
  });

  return {
    adminDb: {
      batch: batchFn,
      collection: collectionFn,
    },
  };
});

describe('Meetings 2.0 Seed Engine', () => {
  it('generates a full demonstration environment with deterministic IDs and metrics', async () => {
    const res = await seedMeetingsV2('ws_test_seed', 'org_test', 'user_test');

    expect(res.workspaceId).toBe('ws_test_seed');
    expect(res.eventTypesSeeded).toBe(4);
    expect(res.bookingsSeeded).toBe(4);
    expect(res.resourcesSeeded).toBe(2);
    expect(res.intelligenceSeeded).toBe(1);
    expect(res.pollsSeeded).toBe(1);
    expect(res.queuesSeeded).toBe(1);
  });
});
