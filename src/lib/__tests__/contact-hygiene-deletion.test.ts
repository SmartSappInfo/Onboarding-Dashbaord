import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cleanContactEmailAction,
  deleteContactAction,
  verifySingleContactAction,
} from '../automation-actions';
import { adminDb } from '../firebase-admin';

// Mock Firebase Transaction and get/update/delete operations
const mockGet = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue(true);
const mockDelete = vi.fn().mockResolvedValue(true);

const mockTransaction = {
  get: mockGet,
  update: mockUpdate,
  delete: mockDelete,
};

vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((col) => ({
        doc: vi.fn((id) => ({
          get: mockGet,
          update: mockUpdate,
          delete: mockDelete,
        })),
        where: vi.fn(() => ({
          get: mockGet,
        })),
        get: mockGet,
      })),
      runTransaction: vi.fn(async (cb) => cb(mockTransaction)),
    },
  };
});

// Mock suppression services
vi.mock('../suppression-service', () => ({
  removeSuppression: vi.fn().mockResolvedValue(true),
}));

// Mock verifier engines
vi.mock('../email-verifier', () => {
  return {
    EmailVerificationEngine: vi.fn().mockImplementation(() => ({
      verify: vi.fn().mockResolvedValue({
        valid: true,
        score: 100,
        status: 'verified',
        checks: {},
      }),
    })),
  };
});

describe('Contact Hygiene & Deletion Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanContactEmailAction', () => {
    it('should update entityContacts email address, reset status, and clear suppressions', async () => {
      mockGet.mockResolvedValueOnce({
        docs: [
          {
            id: 'entity_123',
            ref: { update: mockUpdate },
            data: () => ({
              entityContacts: [
                {
                  email: 'bounced@example.com',
                  isPrimary: true,
                  emailStatus: 'bounced',
                },
              ],
            }),
          },
        ],
      });

      // Mock workspace_entities fetch
      mockGet.mockResolvedValueOnce({
        docs: [
          {
            ref: { update: mockUpdate },
            data: () => ({
              entityContacts: [
                {
                  email: 'bounced@example.com',
                  isPrimary: true,
                  emailStatus: 'bounced',
                },
              ],
            }),
          },
        ],
      });

      const result = await cleanContactEmailAction(
        'bounced@example.com',
        'correct',
        'fixed@example.com'
      );

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('deleteContactAction', () => {
    it('should delete the entire entity and workspace_entity if it is the sole contact', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          entityContacts: [
            {
              email: 'only@example.com',
              isPrimary: true,
            },
          ],
        }),
      });

      // Mock workspace_entities query
      mockGet.mockResolvedValueOnce({
        docs: [
          {
            ref: { delete: mockDelete },
          },
        ],
      });

      const result = await deleteContactAction('entity_123', 'only@example.com');
      expect(result.success).toBe(true);
      expect(result.deletedEntity).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should delete only the contact and reassign primary/signatory roles to remaining contact if multiple exist', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          entityContacts: [
            {
              email: 'primary-deleted@example.com',
              isPrimary: true,
              isSignatory: true,
            },
            {
              email: 'remaining@example.com',
              isPrimary: false,
              isSignatory: false,
            },
          ],
        }),
      });

      // Mock workspace_entities query
      mockGet.mockResolvedValueOnce({
        docs: [
          {
            ref: { update: mockUpdate },
          },
        ],
      });

      const result = await deleteContactAction('entity_123', 'primary-deleted@example.com');
      expect(result.success).toBe(true);
      expect(result.deletedEntity).toBe(false);

      // Verify that mockUpdate was called with remaining contact promoted to primary and signatory
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          entityContacts: [
            {
              email: 'remaining@example.com',
              isPrimary: true,
              isSignatory: true,
            },
          ],
        })
      );
    });
  });
});
