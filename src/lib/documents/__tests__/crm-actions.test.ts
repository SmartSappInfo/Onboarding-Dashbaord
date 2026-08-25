import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getContactDocumentInsightsAction,
  linkContactDocumentSessionAction,
  awardContactScoreAction,
} from '../crm-actions';

// Mock Firebase Admin
const mockSessionUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        id: docId,
        update: mockSessionUpdate,
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            id: docId,
            documentId: 'doc_123',
            title: 'Prospectus',
          }),
        }),
      }),
      where: () => ({
        where: () => ({
          get: vi.fn().mockResolvedValue({
            docs: [],
          }),
        }),
      }),
    }),
  },
}));

describe('CRM Server Actions (Phase 9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches contact document insights', async () => {
    const res = await getContactDocumentInsightsAction('ws_test', 'contact_456');
    expect(res.success).toBe(true);
    expect(res.insights).toBeDefined();
    expect(res.insights?.contactId).toBe('contact_456');
  });

  it('links an active session to a contact', async () => {
    const res = await linkContactDocumentSessionAction({
      workspaceId: 'ws_test',
      sessionId: 'sess_1',
      contactId: 'contact_456',
    });

    expect(res.success).toBe(true);
    expect(mockSessionUpdate).toHaveBeenCalledWith({ contactId: 'contact_456' });
  });

  it('awards lead score to a contact', async () => {
    const res = await awardContactScoreAction({
      workspaceId: 'ws_test',
      contactId: 'contact_456',
      scoreDelta: 5,
      reason: '25% read',
      documentId: 'doc_123',
      documentTitle: 'Prospectus',
    });

    expect(res.success).toBe(true);
  });
});
