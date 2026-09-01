import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getProjectLongitudinalAnalyticsAction,
  createSurveyWaveAction,
  concludeSurveyWaveAction,
} from '../survey-longitudinal-actions';
import type { SurveyProject, Survey, SurveyWave } from '@/lib/types';

const mockProject: SurveyProject = {
  id: 'proj_long_1',
  name: 'Annual Customer Sentiment Study 2026',
  workspaceId: 'ws1',
  workspaceIds: ['ws1'],
  organizationId: 'org1',
  ownerId: 'usr_1',
  status: 'active',
  projectType: 'research',
  surveyIds: ['s_wave_1', 's_wave_2'],
  tags: ['annual', 'csat'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockWave1: SurveyWave = {
  id: 'w1',
  projectId: 'proj_long_1',
  waveNumber: 1,
  title: 'Wave 1 (Baseline)',
  surveyId: 's_wave_1',
  status: 'concluded',
  respondentGoal: 100,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockWave2: SurveyWave = {
  id: 'w2',
  projectId: 'proj_long_1',
  waveNumber: 2,
  title: 'Wave 2 (Mid-Year)',
  surveyId: 's_wave_2',
  status: 'active',
  respondentGoal: 100,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

const mockSurvey1: Survey = {
  id: 's_wave_1',
  title: 'Q1 Baseline Survey',
  workspaceIds: ['ws1'],
  elements: [
    {
      id: 'q_csat',
      type: 'rating',
      title: 'Overall Service Quality',
    },
  ],
} as unknown as Survey;

const mockSurvey2: Survey = {
  id: 's_wave_2',
  title: 'Q2 Follow-up Survey',
  workspaceIds: ['ws1'],
  elements: [
    {
      id: 'q_csat',
      type: 'rating',
      title: 'Overall Service Quality',
    },
  ],
} as unknown as Survey;

const surveyResponsesMap: Record<string, Array<{ id: string; contactEmail: string; score: number; answers: Array<{ questionId: string; value: number }> }>> = {
  s_wave_1: [
    { id: 'r1', contactEmail: 'alice@acme.edu', score: 70, answers: [{ questionId: 'q_csat', value: 70 }] },
  ],
  s_wave_2: [
    { id: 'r2', contactEmail: 'alice@acme.edu', score: 85, answers: [{ questionId: 'q_csat', value: 85 }] },
  ],
};

const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);

const makeWaveCollection = () => ({
  doc: vi.fn((wId?: string) => ({
    id: wId || 'wave_auto_created_1',
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => (wId === 'w1' ? mockWave1 : mockWave2),
    }),
    set: mockSet,
    update: mockUpdate,
  })),
  get: vi.fn().mockResolvedValue({ size: 2, empty: false }),
  orderBy: vi.fn(() => ({
    get: vi.fn().mockResolvedValue({
      empty: false,
      forEach: (cb: (doc: { id: string; data: () => unknown }) => void) => {
        cb({ id: 'w1', data: () => mockWave1 });
        cb({ id: 'w2', data: () => mockWave2 });
      },
    }),
  })),
});

const makeProjectDoc = (projId?: string) => {
  const waveCol = makeWaveCollection();
  return {
    id: projId || 'proj_long_1',
    get: vi.fn().mockResolvedValue({
      exists: true,
      id: projId || 'proj_long_1',
      data: () => mockProject,
      ref: {
        collection: (sub: string) => (sub === 'waves' ? waveCol : {}),
      },
    }),
    set: mockSet,
    update: mockUpdate,
    collection: (sub: string) => (sub === 'waves' ? waveCol : {}),
    ref: {
      collection: (sub: string) => (sub === 'waves' ? waveCol : {}),
    },
  };
};

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (colName: string) => {
      if (colName === 'survey_projects') {
        return {
          doc: (projId?: string) => makeProjectDoc(projId),
        };
      }

      if (colName === 'surveys') {
        return {
          doc: (sId?: string) => ({
            id: sId,
            get: vi.fn().mockResolvedValue({
              exists: true,
              id: sId,
              data: () => (sId === 's_wave_1' ? mockSurvey1 : mockSurvey2),
            }),
            collection: (subCol: string) => ({
              get: vi.fn().mockResolvedValue({
                forEach: (cb: (doc: { id: string; data: () => unknown }) => void) => {
                  const items = surveyResponsesMap[sId || ''] || [];
                  items.forEach((item) => cb({ id: item.id, data: () => item }));
                },
              }),
            }),
          }),
        };
      }

      return {};
    },
  },
}));

describe('Longitudinal Multi-Wave Research Engine (Phase 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates multi-wave metrics, calculates cohort retention, and computes question deltas', async () => {
    const res = await getProjectLongitudinalAnalyticsAction('proj_long_1', 'ws1');

    expect(res.success).toBe(true);
    expect(res.metrics?.totalWaves).toBe(2);
    expect(res.metrics?.totalResponses).toBe(2);
    expect(res.metrics?.longitudinalRetentionRate).toBe(100); // Alice participated in both waves
    expect(res.questionDeltas.length).toBe(1);
    expect(res.questionDeltas[0].questionId).toBe('q_csat');
    expect(res.questionDeltas[0].baselineScore).toBe(70);
    expect(res.questionDeltas[0].currentWaveScore).toBe(85);
    expect(res.questionDeltas[0].absoluteDelta).toBe(15);
  });

  it('creates a new wave under a longitudinal research project', async () => {
    const res = await createSurveyWaveAction(
      'proj_long_1',
      {
        title: 'Wave 3 (Q4 End-of-Year)',
        surveyId: 's_wave_3',
        respondentGoal: 150,
      },
      'ws1'
    );

    expect(res.success).toBe(true);
    expect(res.waveId).toBeDefined();
  });

  it('concludes a survey wave and finalizes status', async () => {
    const res = await concludeSurveyWaveAction('proj_long_1', 'w2', 'ws1');
    expect(res.success).toBe(true);
  });
});
