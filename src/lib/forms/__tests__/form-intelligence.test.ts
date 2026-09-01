import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifySubmissionAction,
  batchClassifySubmissionsAction,
  getOrGenerateFormTopicClustersAction,
  executeRecommendedAction,
} from '../form-intelligence-actions';

// Mock Firebase Admin
const mockFormGet = vi.fn();
const mockSubGet = vi.fn();
const mockSubUpdate = vi.fn();
const mockClustersGet = vi.fn();
const mockClustersSet = vi.fn();
const mockSubsQueryGet = vi.fn();
const mockTaskSet = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((colName: string) => {
      if (colName === 'forms') {
        return {
          doc: vi.fn((formId: string) => ({
            get: mockFormGet,
            collection: vi.fn((subCol: string) => {
              if (subCol === 'intelligence') {
                return {
                  doc: vi.fn(() => ({
                    get: mockClustersGet,
                    set: mockClustersSet,
                  })),
                };
              }
              return {};
            }),
          })),
        };
      }
      if (colName === 'form_submissions') {
        return {
          doc: vi.fn((subId: string) => ({
            get: mockSubGet,
            update: mockSubUpdate,
          })),
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                get: mockSubsQueryGet,
              })),
            })),
          })),
        };
      }
      if (colName === 'tasks') {
        return {
          doc: vi.fn(() => ({
            id: 'task_auto_123',
            set: mockTaskSet,
          })),
        };
      }
      return {
        doc: vi.fn(() => ({ get: vi.fn() })),
      };
    }),
  },
}));

// Mock AI Flows
vi.mock('@/ai/flows/form-intelligence-flow', () => ({
  classifyFormSubmissionFlow: vi.fn(async (input) => ({
    sentiment: 'positive',
    sentimentScore: 0.85,
    intent: 'High Purchase Intent',
    urgency: 'high',
    leadQualityScore: 92,
    topics: ['Fee Collection', 'Boarding'],
    entities: [{ type: 'organization', value: 'St. Jude Academy', confidence: 0.95 }],
    summary: 'The respondent operates a private school and is actively evaluating billing software.',
    keyQuotes: ['We need automated fee collection by September.'],
    recommendedActions: [
      {
        id: 'act_1',
        actionType: 'update_submission_status',
        title: 'Mark as Qualified Lead',
        description: 'Lead score is 92/100 with high urgency.',
        suggestedStatus: 'qualified',
        priority: 'high',
      },
      {
        id: 'act_2',
        actionType: 'apply_crm_tag',
        title: 'Apply VIP Tag',
        description: 'Tag as high-value lead.',
        suggestedTag: 'vip-lead',
        priority: 'medium',
      },
    ],
    confidence: 0.94,
    needsHumanReview: false,
  })),
  clusterFormTopicsFlow: vi.fn(async (input) => ({
    totalSubmissionsAnalyzed: 10,
    sentimentDistribution: {
      positiveCount: 7,
      positivePercentage: 70,
      neutralCount: 2,
      neutralPercentage: 20,
      negativeCount: 1,
      negativePercentage: 10,
      averageSentimentScore: 0.65,
    },
    topThemes: [
      {
        id: 'theme_1',
        topic: 'Fee Collection & Automated Invoicing',
        mentionCount: 6,
        percentageShare: 60,
        sentiment: 'positive',
        sampleQuotes: ['Need integrated tuition collection.'],
        painPointSummary: 'Current manual invoicing creates 15 hours of manual work.',
      },
    ],
    executiveSummary: 'Strong market interest in automated billing with 70% positive sentiment.',
    keyPainPoints: ['Manual fee tracking', 'Late payments'],
    actionableRecommendations: ['Highlight payment gateway features in onboarding.'],
  })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('SmartSapp Forms 2.0: AI Response Intelligence & Sentiment Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('classifySubmissionAction', () => {
    it('should use fast-path heuristic for sparse submissions (<10 chars) without calling AI', async () => {
      mockFormGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'form_123',
          title: 'Brief Survey',
          purpose: 'survey',
          fields: [{ id: 'f1', labelOverride: 'Age' }],
        }),
      });

      mockSubGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'sub_sparse',
          formId: 'form_123',
          data: { f1: '25' }, // 2 chars
        }),
      });

      const res = await classifySubmissionAction({
        formId: 'form_123',
        submissionId: 'sub_sparse',
      });

      expect(res.success).toBe(true);
      expect(res.classification?.model).toBe('heuristic-fast-path');
      expect(res.classification?.sentiment).toBe('neutral');
      expect(mockSubUpdate).toHaveBeenCalled();
    });

    it('should invoke AI classification flow for rich submissions and persist classification', async () => {
      mockFormGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'form_123',
          title: 'Admissions Intake',
          purpose: 'application',
          organizationId: 'org_test',
          fields: [
            { id: 'f_name', labelOverride: 'School Name' },
            { id: 'f_notes', labelOverride: 'Requirements' },
          ],
        }),
      });

      mockSubGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'sub_rich',
          formId: 'form_123',
          data: {
            f_name: 'St. Jude Academy',
            f_notes: 'We need automated fee collection by September for 650 students.',
          },
        }),
      });

      const res = await classifySubmissionAction({
        formId: 'form_123',
        submissionId: 'sub_rich',
      });

      expect(res.success).toBe(true);
      expect(res.classification?.sentiment).toBe('positive');
      expect(res.classification?.leadQualityScore).toBe(92);
      expect(res.classification?.intent).toBe('High Purchase Intent');
      expect(mockSubUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          aiClassification: expect.objectContaining({
            sentiment: 'positive',
            leadQualityScore: 92,
          }),
        })
      );
    });

    it('should return error if form or submission document is missing', async () => {
      mockFormGet.mockResolvedValueOnce({ exists: false });
      mockSubGet.mockResolvedValueOnce({ exists: true, data: () => ({}) });

      const res = await classifySubmissionAction({
        formId: 'form_missing',
        submissionId: 'sub_1',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Form or submission document not found.');
    });
  });

  describe('batchClassifySubmissionsAction', () => {
    it('should process submissions in chunked batches and return aggregated progress', async () => {
      mockFormGet.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'form_123',
          title: 'Batch Form',
          fields: [{ id: 'f1', labelOverride: 'Input' }],
        }),
      });

      mockSubGet.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'sub_1',
          formId: 'form_123',
          data: { f1: 'A rich and detailed response for batch testing.' },
        }),
      });

      const res = await batchClassifySubmissionsAction({
        formId: 'form_123',
        submissionIds: ['sub_1', 'sub_2'],
      });

      expect(res.success).toBe(true);
      expect(res.totalProcessed).toBe(2);
      expect(res.successCount).toBe(2);
      expect(res.failedCount).toBe(0);
    });
  });

  describe('getOrGenerateFormTopicClustersAction', () => {
    it('should return fresh cached clusters without invoking clustering flow', async () => {
      const cachedDate = new Date().toISOString();
      mockClustersGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'topic_clusters',
          formId: 'form_123',
          workspaceId: 'ws_1',
          totalSubmissionsAnalyzed: 25,
          sentimentDistribution: {
            positiveCount: 18,
            positivePercentage: 72,
            neutralCount: 5,
            neutralPercentage: 20,
            negativeCount: 2,
            negativePercentage: 8,
            averageSentimentScore: 0.7,
          },
          topThemes: [],
          executiveSummary: 'Cached insights summary.',
          keyPainPoints: [],
          actionableRecommendations: [],
          analyzedAt: cachedDate,
          model: 'gemini-2.5-flash',
        }),
      });

      const res = await getOrGenerateFormTopicClustersAction({
        formId: 'form_123',
        forceRefresh: false,
      });

      expect(res.success).toBe(true);
      expect(res.clusters?.executiveSummary).toBe('Cached insights summary.');
    });

    it('should invoke clustering flow and save to Firestore when forceRefresh is true', async () => {
      mockFormGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'form_123',
          title: 'Admissions Form',
          workspaceId: 'ws_1',
        }),
      });

      mockSubsQueryGet.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'sub_1',
            data: () => ({
              submittedAt: new Date().toISOString(),
              data: { comment: 'Need integrated fee collection' },
            }),
          },
        ],
      });

      const res = await getOrGenerateFormTopicClustersAction({
        formId: 'form_123',
        forceRefresh: true,
      });

      expect(res.success).toBe(true);
      expect(res.clusters?.totalSubmissionsAnalyzed).toBe(10);
      expect(mockClustersSet).toHaveBeenCalled();
    });
  });

  describe('executeRecommendedAction', () => {
    it('should apply tag to submission for apply_crm_tag action', async () => {
      mockSubGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'sub_1',
          appliedTags: ['existing-tag'],
        }),
      });

      const res = await executeRecommendedAction({
        formId: 'form_123',
        submissionId: 'sub_1',
        action: {
          id: 'act_1',
          actionType: 'apply_crm_tag',
          title: 'Apply VIP Tag',
          description: 'Tag lead as VIP',
          suggestedTag: 'vip-lead',
          priority: 'high',
        },
        userId: 'usr_admin',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Tag "vip-lead" applied');
      expect(mockSubUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          appliedTags: ['existing-tag', 'vip-lead'],
        })
      );
    });

    it('should update submission status for update_submission_status action', async () => {
      mockSubGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'sub_1',
          status: 'new',
        }),
      });

      const res = await executeRecommendedAction({
        formId: 'form_123',
        submissionId: 'sub_1',
        action: {
          id: 'act_2',
          actionType: 'update_submission_status',
          title: 'Mark Qualified',
          description: 'Move to qualified leads',
          suggestedStatus: 'qualified',
          priority: 'high',
        },
        userId: 'usr_admin',
      });

      expect(res.success).toBe(true);
      expect(mockSubUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'qualified',
        })
      );
    });

    it('should create CRM task for create_crm_task action', async () => {
      mockSubGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'sub_1',
          workspaceId: 'ws_1',
          organizationId: 'org_1',
          entityId: 'ent_999',
        }),
      });

      const res = await executeRecommendedAction({
        formId: 'form_123',
        submissionId: 'sub_1',
        action: {
          id: 'act_3',
          actionType: 'create_crm_task',
          title: 'Follow-up Call Required',
          description: 'Call the admissions officer within 24 hours.',
          priority: 'high',
        },
        userId: 'usr_admin',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('created in CRM');
      expect(mockTaskSet).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Follow-up Call Required',
          entityId: 'ent_999',
        })
      );
    });
  });
});
