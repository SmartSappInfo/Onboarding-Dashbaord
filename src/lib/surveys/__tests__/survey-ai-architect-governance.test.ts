import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSystemAiArchitectGovernanceAction,
  saveSystemAiArchitectGovernanceAction,
  DEFAULT_AI_ARCHITECT_GOVERNANCE_CONFIG,
} from '../survey-ai-architect-governance-actions';

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);

const docMock = (id?: string) => ({
  id: id || 'doc_gov_1',
  get: mockGet,
  set: mockSet,
});

const mockCollection = vi.fn(() => ({
  doc: vi.fn((id?: string) => docMock(id)),
  get: mockGet,
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (_name: string) => mockCollection(),
  },
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    uid: 'admin_usr_123',
    profile: { email: 'admin@smartsapp.com' },
    isSystemAdmin: true,
  }),
  requireSystemAdmin: vi.fn().mockResolvedValue({
    uid: 'admin_usr_123',
    profile: { email: 'admin@smartsapp.com' },
    isSystemAdmin: true,
  }),
}));

describe('survey-ai-architect-governance-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSystemAiArchitectGovernanceAction', () => {
    it('returns default config when document does not exist', async () => {
      mockGet.mockResolvedValueOnce({
        exists: false,
      });

      const res = await getSystemAiArchitectGovernanceAction();
      expect(res.success).toBe(true);
      expect(res.config).toEqual(DEFAULT_AI_ARCHITECT_GOVERNANCE_CONFIG);
      expect(res.config.maxFileUploadSizeMb).toBe(10);
      expect(res.config.maxPdfPagesLimit).toBe(20);
    });

    it('returns merged stored config when document exists in Firestore', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          maxFileUploadSizeMb: 25,
          maxPdfPagesLimit: 50,
          defaultModelTier: 'flagship',
        }),
      });

      const res = await getSystemAiArchitectGovernanceAction();
      expect(res.success).toBe(true);
      expect(res.config.maxFileUploadSizeMb).toBe(25);
      expect(res.config.maxPdfPagesLimit).toBe(50);
      expect(res.config.defaultModelTier).toBe('flagship');
      expect(res.config.maxSourceCharacterLimit).toBe(25000); // from defaults
    });
  });

  describe('saveSystemAiArchitectGovernanceAction', () => {
    it('persists partial updates with timestamp and updatedBy user email', async () => {
      const res = await saveSystemAiArchitectGovernanceAction({
        maxFileUploadSizeMb: 15,
        defaultModelTier: 'flagship',
      });

      expect(res.success).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          maxFileUploadSizeMb: 15,
          defaultModelTier: 'flagship',
          updatedBy: 'admin@smartsapp.com',
        }),
        { merge: true }
      );
    });

    it('rejects out-of-bounds file size or page limit configurations', async () => {
      const res = await saveSystemAiArchitectGovernanceAction({
        maxFileUploadSizeMb: 999, // Max allowed is 50
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid governance parameters');
      expect(mockSet).not.toHaveBeenCalled();
    });
  });
});
