import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeSurveyDataRetentionAction,
  getSystemResearchGovernanceAction,
  saveSystemResearchGovernanceAction,
} from '../survey-retention-actions';
import type { SurveyRetentionPolicy, SystemResearchGovernanceConfig } from '@/lib/types';

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockResolvedValue(undefined);

const docMock = (id?: string) => ({
  id: id || 'doc_ret_1',
  get: mockGet,
  set: mockSet,
  update: mockUpdate,
  delete: mockDelete,
  ref: {
    collection: vi.fn(() => ({
      get: mockGet,
    })),
  },
});

const mockCollection = vi.fn(() => ({
  doc: vi.fn((id?: string) => docMock(id)),
  where: vi.fn().mockReturnThis(),
  get: mockGet,
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (name: string) => mockCollection(),
  },
}));

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue({ id: 'act_ret' }),
}));

describe('Survey Data Retention & Research Governance (Phase 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPolicy: SurveyRetentionPolicy = {
    enabled: true,
    anonymizePiiAfterDays: 90,
    hardDeleteAfterDays: 365,
    autoArchiveEnabled: true,
  };

  it('anonymizes PII for responses older than configured retention threshold', async () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 3600 * 1000).toISOString(); // 100 days old

    const mockRespDoc = {
      id: 'res_old',
      data: () => ({
        respondentName: 'John Doe',
        respondentEmail: 'john@example.com',
        submittedAt: oldDate,
      }),
      ref: {
        update: mockUpdate,
        delete: mockDelete,
      },
    };

    mockGet
      // 1. Surveys in workspace
      .mockResolvedValueOnce({
        size: 1,
        docs: [
          {
            id: 's1',
            ref: {
              collection: () => ({
                get: vi.fn().mockResolvedValue({
                  docs: [mockRespDoc],
                }),
              }),
            },
          },
        ],
      });

    const res = await executeSurveyDataRetentionAction('ws1', mockPolicy);

    expect(res.success).toBe(true);
    expect(res.anonymizedCount).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        respondentName: '[ANONYMIZED]',
        respondentEmail: '[ANONYMIZED]',
      })
    );
  });

  it('retrieves and saves platform research governance baseline', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        minSampleSizeForSignificance: 50,
        defaultAnonymizePiiDays: 90,
      }),
    });

    const getRes = await getSystemResearchGovernanceAction();
    expect(getRes.success).toBe(true);
    expect(getRes.config.minSampleSizeForSignificance).toBe(50);

    const saveRes = await saveSystemResearchGovernanceAction({
      minSampleSizeForSignificance: 60,
      defaultAnonymizePiiDays: 120,
      allowHardDelete: false,
      requireAuditLogging: true,
      maxActiveExperimentsPerWorkspace: 15,
    });
    expect(saveRes.success).toBe(true);
  });
});
