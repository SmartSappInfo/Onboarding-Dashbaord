import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockDb, mockFieldValue } = await vi.hoisted(async () => {
  const mockDoc = {
    set: vi.fn(async () => {}),
    get: vi.fn(async () => ({ exists: true, data: () => ({ workspaceId: 'ws-test' }) })),
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn(async () => {}),
        get: vi.fn(async () => ({ exists: false })),
      })),
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: vi.fn(async () => ({ docs: [] })),
        })),
      })),
    })),
  };

  const mockCollection = {
    doc: vi.fn(() => mockDoc),
    where: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: vi.fn(async () => ({ empty: false, docs: [{ id: 'doc-id', data: () => ({ workspaceId: 'ws-test' }) }] })),
      })),
      get: vi.fn(async () => ({ empty: true, docs: [] })),
    })),
  };

  const db = {
    collection: vi.fn(() => mockCollection),
    batch: vi.fn(() => ({
      set: vi.fn(),
      commit: vi.fn(async () => {}),
    })),
    runTransaction: vi.fn(async (cb) => {
      return cb({
        get: vi.fn(async () => ({ exists: false })),
        set: vi.fn(),
        update: vi.fn(),
      });
    }),
  };

  return {
    mockDb: db,
    mockFieldValue: {
      increment: vi.fn((val) => ({ _methodName: 'FieldValue.increment', value: val })),
    }
  };
});

vi.mock('../firebase-admin', () => ({
  get adminDb() {
    return mockDb;
  },
  get FieldValue() {
    return mockFieldValue;
  }
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { recordMediaPageEventAction } from '../media-analytics-actions';

describe('Media Share Page Analytics - Event Recording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a view event and initializes session analytics', async () => {
    const params = {
      shareId: 'test-share-123',
      workspaceId: 'ws-test',
      assetId: 'asset-test',
      type: 'view' as const,
      sessionId: 'session-abc',
      contactId: 'contact-john',
    };

    const result = await recordMediaPageEventAction(params);
    expect(result.success).toBe(true);
    expect(mockDb.batch).toHaveBeenCalled();
  });

  it('records cta clicks and download clicks on shared media pages', async () => {
    const params = {
      shareId: 'test-share-456',
      workspaceId: 'ws-test',
      assetId: 'asset-test',
      type: 'cta_click' as const,
      sessionId: 'session-xyz',
      contactId: 'contact-jane',
    };

    const result = await recordMediaPageEventAction(params);
    expect(result.success).toBe(true);
  });
});
