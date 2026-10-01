import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSystemAiArchitectGovernanceAction,
  saveSystemAiArchitectGovernanceAction,
} from '../survey-ai-architect-governance-actions';
import { DEFAULT_AI_ARCHITECT_GOVERNANCE_CONFIG } from '../survey-ai-architect-governance-types';

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
      expect(res.config.maxImageUploadSizeMb).toBe(5);
      expect(res.config.maxPdfPagesLimit).toBe(20);
      expect(res.config.maxSpreadsheetRows).toBe(500);
      expect(res.config.maxPresentationSlides).toBe(30);
      expect(res.config.imageVisionMode).toBe('multimodal');
      expect(res.config.enforceStrictScoredOutcomesOnly).toBe(true);
      expect(res.config.requireCanvasConfirmation).toBe(true);
      expect(res.config.allowedFileTypes).toContain('docx');
      expect(res.config.allowedFileTypes).toContain('image');
    });

    it('returns merged stored config when document exists in Firestore', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          maxFileUploadSizeMb: 25,
          maxImageUploadSizeMb: 10,
          maxPdfPagesLimit: 50,
          maxSpreadsheetRows: 1000,
          defaultModelTier: 'flagship',
          imageVisionMode: 'multimodal',
        }),
      });

      const res = await getSystemAiArchitectGovernanceAction();
      expect(res.success).toBe(true);
      expect(res.config.maxFileUploadSizeMb).toBe(25);
      expect(res.config.maxImageUploadSizeMb).toBe(10);
      expect(res.config.maxPdfPagesLimit).toBe(50);
      expect(res.config.maxSpreadsheetRows).toBe(1000);
      expect(res.config.defaultModelTier).toBe('flagship');
      expect(res.config.maxSourceCharacterLimit).toBe(25000); // from defaults
    });
  });

  describe('saveSystemAiArchitectGovernanceAction', () => {
    it('persists partial updates with timestamp and updatedBy user email', async () => {
      const res = await saveSystemAiArchitectGovernanceAction({
        maxFileUploadSizeMb: 15,
        maxImageUploadSizeMb: 8,
        maxSpreadsheetRows: 800,
        defaultModelTier: 'flagship',
        imageVisionMode: 'multimodal',
      });

      expect(res.success).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          maxFileUploadSizeMb: 15,
          maxImageUploadSizeMb: 8,
          maxSpreadsheetRows: 800,
          defaultModelTier: 'flagship',
          imageVisionMode: 'multimodal',
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
      expect(res.error).toBeDefined();
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('rejects out-of-bounds spreadsheet row limits', async () => {
      const res = await saveSystemAiArchitectGovernanceAction({
        maxSpreadsheetRows: 99999, // Max allowed is 5000
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      expect(mockSet).not.toHaveBeenCalled();
    });
  });
});
