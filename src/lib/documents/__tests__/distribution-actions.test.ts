import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDocumentDistributionAction,
  listDocumentDistributionsAction,
  revokeDocumentDistributionAction,
  resolveDistributionTokenAction,
} from '../distribution-actions';

// Mock Firebase Admin
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
let mockDistributionRecord: Record<string, unknown> | null = null;

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: (docId?: string) => ({
        id: docId || 'dist_doc_123',
        set: mockSet,
        update: mockUpdate,
        get: vi.fn().mockImplementation(async () => ({
          exists: !!mockDistributionRecord,
          data: () => mockDistributionRecord,
        })),
      }),
      where: () => ({
        where: () => ({
          get: vi.fn().mockResolvedValue({
            docs: [
              {
                data: () => ({
                  id: 'dist_1',
                  workspaceId: 'ws_test',
                  documentId: 'doc_123',
                  type: 'campaign',
                  status: 'active',
                  createdAt: '2026-01-01T00:00:00Z',
                }),
              },
            ],
          }),
        }),
      }),
    }),
  },
}));

describe('Distribution Server Actions (Phase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDistributionRecord = {
      id: 'dist_doc_123',
      workspaceId: 'ws_test',
      documentId: 'doc_123',
      versionId: 'ver_1',
      type: 'campaign',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
    };
  });

  it('creates document distribution with signed token and QR code', async () => {
    const res = await createDocumentDistributionAction({
      workspaceId: 'ws_test',
      documentId: 'doc_123',
      versionId: 'ver_1',
      type: 'campaign',
      slug: 'prospectus-2026',
      campaignId: 'spring-2026',
    });

    expect(res.success).toBe(true);
    expect(res.token).toBeDefined();
    expect(res.distributionUrl).toContain('/d/prospectus-2026?t=');
    expect(res.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(mockSet).toHaveBeenCalled();
  });

  it('lists document distributions for workspace and document', async () => {
    const res = await listDocumentDistributionsAction('ws_test', 'doc_123');
    expect(res.success).toBe(true);
    expect(res.distributions?.length).toBe(1);
    expect(res.distributions?.[0].type).toBe('campaign');
  });

  it('revokes an active distribution', async () => {
    const res = await revokeDocumentDistributionAction('ws_test', 'dist_doc_123');
    expect(res.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'revoked' }));
  });

  it('resolves and validates a valid distribution token', async () => {
    const created = await createDocumentDistributionAction({
      workspaceId: 'ws_test',
      documentId: 'doc_123',
      versionId: 'ver_1',
      type: 'campaign',
      slug: 'prospectus-2026',
    });

    if (created.token) {
      const resolved = await resolveDistributionTokenAction(created.token);
      expect(resolved.valid).toBe(true);
      expect(resolved.distribution?.status).toBe('active');
    }
  });
});
