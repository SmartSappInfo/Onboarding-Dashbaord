import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateEntityPredictiveHealthAction,
  getWorkspacePredictiveOverviewAction,
  executePredictiveNextBestAction,
  getSystemPredictiveWeightsAction,
  saveSystemPredictiveWeightsAction,
} from '../survey-predictive-actions';

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);

const docMock = (id?: string) => ({
  id: id || 'doc_pred_1',
  get: mockGet,
  set: mockSet,
  update: mockUpdate,
  ref: {
    collection: vi.fn(() => ({
      get: mockGet,
    })),
  },
  collection: vi.fn(() => ({
    get: mockGet,
  })),
});

const mockCollection = vi.fn(() => ({
  doc: vi.fn((id?: string) => docMock(id)),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: mockGet,
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (name: string) => mockCollection(),
  },
}));

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue({ id: 'act_pred_1' }),
}));

describe('Predictive Survey Intelligence Engine (Phase 9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates health score, detects elevated churn risk on detractor survey feedback, and prescribes executive check-in', async () => {
    // 1. Entity Doc
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: 'ent_at_risk_1',
      data: () => ({
        name: 'St. Jude Academy',
        email: 'admin@stjude.edu',
        workspaceId: 'ws1',
      }),
    });

    // 2. Surveys in workspace
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 's_feedback_1',
          ref: {
            collection: () => ({
              get: vi.fn().mockResolvedValue({
                forEach: (cb: (doc: { id: string; data: () => unknown }) => void) => {
                  cb({
                    id: 'r_detractor_1',
                    data: () => ({
                      contactEmail: 'admin@stjude.edu',
                      score: 35, // Detractor
                      sentiment: 'negative',
                      submittedAt: '2026-08-01T00:00:00.000Z',
                    }),
                  });
                },
              }),
            }),
          },
        },
      ],
    });

    // 3. Deals
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            id: 'deal_1',
            status: 'lost',
            stage: 'lost',
          }),
        },
      ],
    });

    const res = await calculateEntityPredictiveHealthAction('ent_at_risk_1', 'ws1');

    expect(res.success).toBe(true);
    expect(res.health).toBeDefined();
    expect(res.health?.entityName).toBe('St. Jude Academy');
    expect(res.health?.churnRiskPercent).toBeGreaterThanOrEqual(50);
    expect(res.health?.nextBestAction.type).toBe('schedule_call');
    expect(res.health?.riskFactors.length).toBeGreaterThan(0);
  });

  it('calculates high conversion propensity and promoter index on positive survey feedback and won deals', async () => {
    // 1. Entity Doc
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: 'ent_promoter_1',
      data: () => ({
        name: 'Oxford Hall School',
        email: 'principal@oxford.edu',
        workspaceId: 'ws1',
      }),
    });

    // 2. Surveys in workspace
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 's_feedback_1',
          ref: {
            collection: () => ({
              get: vi.fn().mockResolvedValue({
                forEach: (cb: (doc: { id: string; data: () => unknown }) => void) => {
                  cb({
                    id: 'r_promoter_1',
                    data: () => ({
                      contactEmail: 'principal@oxford.edu',
                      score: 95, // Promoter
                      sentiment: 'positive',
                      submittedAt: '2026-08-15T00:00:00.000Z',
                    }),
                  });
                },
              }),
            }),
          },
        },
      ],
    });

    // 3. Deals
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            id: 'deal_won_1',
            status: 'won',
            stage: 'won',
          }),
        },
      ],
    });

    const res = await calculateEntityPredictiveHealthAction('ent_promoter_1', 'ws1');

    expect(res.success).toBe(true);
    expect(res.health).toBeDefined();
    expect(res.health?.healthScore).toBeGreaterThanOrEqual(80);
    expect(res.health?.promoterIndex).toBeGreaterThanOrEqual(80);
    expect(res.health?.nextBestAction.type).toBe('request_case_study');
    expect(res.health?.positiveDrivers.length).toBeGreaterThan(0);
  });

  it('executes a prescribed next best action by creating a CRM task', async () => {
    const res = await executePredictiveNextBestAction(
      'ent_1',
      'schedule_call',
      'Urgent retention follow-up',
      'ws1'
    );

    expect(res.success).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'ent_1',
        workspaceId: 'ws1',
        status: 'pending',
        priority: 'high',
      })
    );
  });

  it('retrieves and saves global predictive model weights configuration', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        surveyWeight: 45,
        crmWeight: 35,
        churnAlertThreshold: 75,
      }),
    });

    const getRes = await getSystemPredictiveWeightsAction();
    expect(getRes.success).toBe(true);
    expect(getRes.config.surveyWeight).toBe(45);

    const saveRes = await saveSystemPredictiveWeightsAction({
      surveyWeight: 50,
      crmWeight: 30,
      messagingWeight: 10,
      meetingsWeight: 10,
      churnAlertThreshold: 80,
      conversionHighThreshold: 85,
      autoCreateDetractorTasks: true,
    });
    expect(saveRes.success).toBe(true);
  });
});
