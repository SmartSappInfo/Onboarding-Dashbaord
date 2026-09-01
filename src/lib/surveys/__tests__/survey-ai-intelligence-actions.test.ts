import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  auditSurveyQualityAction,
  applySurveyAiOptimizationAction,
  generateSurveyThematicInsightsAction,
} from '../survey-ai-intelligence-actions';

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockAdd = vi.fn().mockResolvedValue({ id: 'sum_1' });
const mockOrderBy = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockReturnThis();

const mockCollection = vi.fn((name: string) => ({
  doc: vi.fn((id?: string) => ({
    get: mockGet,
    set: mockSet,
    update: mockUpdate,
    collection: (subName: string) => ({
      doc: vi.fn((subId?: string) => ({
        get: mockGet,
        set: mockSet,
      })),
      orderBy: mockOrderBy,
      limit: mockLimit,
      get: mockGet,
      add: mockAdd,
    }),
  })),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (name: string) => mockCollection(name),
  },
}));

vi.mock('@/ai/flows/survey-ai-reviewer-flow', () => ({
  auditSurveyQualityFlow: vi.fn().mockResolvedValue({
    overallScore: 88,
    grade: 'A',
    clarityScore: 90,
    neutralityScore: 85,
    fatigueRiskScore: 92,
    flowCoherenceScore: 86,
    estimatedCompletionMinutes: 4,
    executiveSummary: 'Well-structured survey with minimal bias.',
    strengths: ['Clear question wording', 'Balanced rating scales'],
    suggestions: [
      {
        questionId: 'q1',
        currentTitle: 'Do you not love our services?',
        issueType: 'leading_bias',
        issueDescription: 'Negative leading question phrasing.',
        improvedTitle: 'How satisfied are you with our services?',
        improvedOptions: ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied'],
      },
    ],
  }),
}));

vi.mock('@/ai/flows/survey-sentiment-theme-flow', () => ({
  generateSurveySentimentThemesFlow: vi.fn().mockResolvedValue({
    overallSentiment: {
      positivePercentage: 65,
      neutralPercentage: 20,
      negativePercentage: 15,
      mixedPercentage: 0,
      netSentimentScore: 50,
    },
    themes: [
      {
        themeId: 'theme_teachers',
        title: 'Teacher Dedication & Care',
        description: 'Parents strongly appreciate faculty communication.',
        sentimentPolarity: 'mostly_positive',
        prevalencePercentage: 45,
        sentimentScore: 0.85,
        keywords: ['helpful', 'responsive', 'caring'],
        supportingCitations: [
          {
            responseId: 'r1',
            quote: 'Teachers are wonderfully supportive and quick to respond.',
            sentiment: 'positive',
          },
        ],
      },
    ],
    topPositiveHighlights: ['Exceptional faculty responsiveness'],
    topUrgentPainPoints: ['Bus route delays on rainy days'],
    executiveNarrative: 'Overall parent sentiment is overwhelmingly positive.',
  }),
}));

vi.mock('@/ai/flows/survey-anomaly-detection-flow', () => ({
  detectSurveyAnomaliesFlow: vi.fn().mockResolvedValue({
    anomaliesDetectedCount: 1,
    healthStatus: 'minor_anomalies',
    anomalies: [
      {
        anomalyId: 'anom_1',
        type: 'facility_rating_collapse',
        severity: 'medium',
        title: 'Cafeteria Satisfaction Dip',
        description: 'Ratings for cafeteria food dropped significantly in Grade 11.',
        affectedQuestionIds: ['q_food'],
        recommendedAction: 'Inspect cafeteria menu changes made last month.',
      },
    ],
    dataIntegrityAssessment: 'Data is statistically sound with high completion reliability.',
  }),
}));

describe('Survey AI Intelligence Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs auditSurveyQualityAction and returns structured quality score & suggestions', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's1',
        workspaceIds: ['ws1'],
        title: 'Annual Parent Survey',
        elements: [{ id: 'q1', type: 'text', title: 'Do you not love our services?' }],
      }),
    });

    const res = await auditSurveyQualityAction('s1', 'ws1');
    expect(res.success).toBe(true);
    expect(res.data?.overallScore).toBe(88);
    expect(res.data?.grade).toBe('A');
    expect(res.data?.suggestions.length).toBe(1);
    expect(res.data?.suggestions[0].issueType).toBe('leading_bias');
  });

  it('blocks unauthorized survey audit when workspace does not match', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's1',
        workspaceIds: ['other_ws'],
        title: 'Private Survey',
        elements: [],
      }),
    });

    const res = await auditSurveyQualityAction('s1', 'ws1');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Unauthorized');
  });

  it('applies question optimization in place to survey blueprint', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's1',
        workspaceIds: ['ws1'],
        title: 'Annual Parent Survey',
        elements: [
          { id: 'q1', type: 'multiple-choice', title: 'Old Leading Title', options: ['A', 'B'] },
        ],
      }),
    });

    const res = await applySurveyAiOptimizationAction(
      's1',
      'ws1',
      'q1',
      'New Balanced Title',
      'Helper text',
      ['Option 1', 'Option 2', 'Option 3']
    );

    expect(res.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updatePayload = mockUpdate.mock.calls[0][0];
    expect(updatePayload.elements[0].title).toBe('New Balanced Title');
    expect(updatePayload.elements[0].description).toBe('Helper text');
    expect(updatePayload.elements[0].options).toEqual(['Option 1', 'Option 2', 'Option 3']);
  });

  it('generates thematic sentiment clusters and caches in Firestore subcollection', async () => {
    // 1st get: surveyDoc
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's1',
        workspaceIds: ['ws1'],
        title: 'Parent Feedback',
        elements: [{ id: 'q_feedback', type: 'textarea', title: 'Open Feedback' }],
      }),
    });

    // 2nd get: responses
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'r1',
          data: () => ({
            submittedAt: '2026-09-01T10:00:00Z',
            channel: 'web',
            answers: [{ questionId: 'q_feedback', value: 'Teachers are wonderfully supportive and quick to respond.' }],
          }),
        },
      ],
    });

    const res = await generateSurveyThematicInsightsAction('s1', 'ws1');
    expect(res.success).toBe(true);
    expect(res.sentimentThemes?.overallSentiment.netSentimentScore).toBe(50);
    expect(res.sentimentThemes?.themes.length).toBe(1);
    expect(res.anomalies?.anomaliesDetectedCount).toBe(1);
    expect(mockSet).toHaveBeenCalledTimes(1);
  });
});
