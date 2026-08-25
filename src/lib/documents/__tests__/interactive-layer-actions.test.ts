import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  sanitizeLayerUrl, 
  executeLayerActionServerAction 
} from '../interactive-layer-actions';

// Mock recordDocumentEventAction
vi.mock('@/lib/document-actions', () => ({
  recordDocumentEventAction: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock Firebase Admin
const mockUpdate = vi.fn().mockResolvedValue(undefined);
let mockContactExists = true;

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({
        get: vi.fn().mockImplementation(async () => ({
          exists: mockContactExists,
          data: () => ({
            workspaceId: 'ws_test',
            leadScore: 10,
            tags: ['prospect'],
          }),
        })),
        update: mockUpdate,
      }),
    }),
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: (n: number) => ({ _increment: n }),
    arrayUnion: (tag: string) => ({ _arrayUnion: tag }),
  },
}));

describe('Interactive Layer Actions (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContactExists = true;
  });

  describe('sanitizeLayerUrl', () => {
    it('allows valid https, http, tel, mailto, and wa.me URLs', () => {
      expect(sanitizeLayerUrl('https://example.com/apply')).toBe('https://example.com/apply');
      expect(sanitizeLayerUrl('http://example.com')).toBe('http://example.com');
      expect(sanitizeLayerUrl('tel:+1234567890')).toBe('tel:+1234567890');
      expect(sanitizeLayerUrl('mailto:info@example.com')).toBe('mailto:info@example.com');
      expect(sanitizeLayerUrl('https://wa.me/1234567890')).toBe('https://wa.me/1234567890');
    });

    it('blocks dangerous javascript: and data: URLs', () => {
      expect(sanitizeLayerUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeLayerUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBeNull();
      expect(sanitizeLayerUrl('vbscript:msgbox(1)')).toBeNull();
    });

    it('prefixes bare domains with https://', () => {
      expect(sanitizeLayerUrl('school.edu')).toBe('https://school.edu');
    });
  });

  describe('executeLayerActionServerAction', () => {
    it('executes layer action, increments lead score, and applies contact tag', async () => {
      const res = await executeLayerActionServerAction({
        workspaceId: 'ws_test',
        documentId: 'doc_123',
        layerId: 'layer_1',
        layerType: 'link',
        layerTitle: 'Schedule Campus Tour',
        pageNumber: 3,
        action: {
          type: 'url',
          targetUrl: 'https://school.edu/tour',
        },
        sessionId: 'sess_123',
        contactId: 'contact_456',
        leadScoreDelta: 15,
        applyTag: 'tour-interested',
      });

      expect(res.success).toBe(true);
      expect(res.sanitizedUrl).toBe('https://school.edu/tour');
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
