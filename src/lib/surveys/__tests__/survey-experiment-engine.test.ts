import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveSurveyExperimentConfigAction,
  getSurveyExperimentResultsAction,
  promoteWinningVariantAction,
} from '../survey-experiment-actions';
import type { Survey, SurveyExperimentConfig } from '@/lib/types';

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);

const docMock = (id?: string) => ({
  id: id || 'doc_exp_1',
  get: mockGet,
  set: mockSet,
  update: mockUpdate,
  collection: vi.fn(() => ({
    get: mockGet,
  })),
});

const mockCollection = vi.fn(() => ({
  doc: vi.fn((id?: string) => docMock(id)),
  get: mockGet,
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (name: string) => mockCollection(),
  },
}));

describe('Survey A/B Testing & Experiment Engine (Phase 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockExperimentConfig: SurveyExperimentConfig = {
    enabled: true,
    trafficAllocation: 100,
    status: 'running',
    variants: [
      {
        id: 'var_control',
        label: 'Control (Variant A)',
        weight: 50,
        isControl: true,
        metrics: { impressions: 100, starts: 90, completions: 50, completionRate: 50 },
      },
      {
        id: 'var_b',
        label: 'Variant B (Conversational)',
        weight: 50,
        isControl: false,
        titleOverride: 'Quick 2-Minute Feedback',
        introProseOverride: 'Help us improve with 3 quick questions.',
        metrics: { impressions: 100, starts: 95, completions: 80, completionRate: 80 },
      },
    ],
  };

  const mockSurvey: Survey = {
    id: 's_exp_1',
    title: 'Customer Survey',
    description: 'Standard description',
    workspaceIds: ['ws1'],
    experimentConfig: mockExperimentConfig,
  } as unknown as Survey;

  it('saves experiment configuration to the survey document', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => mockSurvey,
    });

    const res = await saveSurveyExperimentConfigAction('s_exp_1', mockExperimentConfig, 'ws1');
    expect(res.success).toBe(true);
  });

  it('evaluates telemetry and detects statistically winning variant', async () => {
    mockGet
      // 1. Survey Doc
      .mockResolvedValueOnce({
        exists: true,
        data: () => mockSurvey,
      })
      // 2. Responses subcollection
      .mockResolvedValueOnce({
        forEach: (cb: (doc: { id: string; data: () => unknown }) => void) => {
          // 50 responses for control
          for (let i = 0; i < 50; i++) {
            cb({ id: `rc_${i}`, data: () => ({ variantId: 'var_control', score: 70 }) });
          }
          // 80 responses for variant B
          for (let i = 0; i < 80; i++) {
            cb({ id: `rb_${i}`, data: () => ({ variantId: 'var_b', score: 85 }) });
          }
        },
      });

    const res = await getSurveyExperimentResultsAction('s_exp_1', 'ws1');
    expect(res.success).toBe(true);
    expect(res.totalCompletions).toBe(130);
    expect(res.evaluatedVariants.length).toBe(2);
    expect(res.winningVariantId).toBe('var_b');
  });

  it('promotes winning variant into main survey configuration', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => mockSurvey,
    });

    const res = await promoteWinningVariantAction('s_exp_1', 'var_b', 'ws1');
    expect(res.success).toBe(true);
  });
});
