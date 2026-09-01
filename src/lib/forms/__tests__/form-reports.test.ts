import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWorkspaceFormsExecutiveReportAction,
  generateFormCustomReportAction,
  saveScheduledReportConfigAction,
  getScheduledReportConfigAction,
  sendTestReportEmailAction,
} from '../form-reports-actions';

// Mock Firebase Admin
const mockFormsQueryGet = vi.fn();
const mockMetricsQueryGet = vi.fn();
const mockDealsQueryGet = vi.fn();
const mockFormDocGet = vi.fn();
const mockScheduledSet = vi.fn();
const mockScheduledQueryGet = vi.fn();
const mockActivityAdd = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((colName: string) => {
      if (colName === 'forms') {
        return {
          where: vi.fn(() => ({
            get: mockFormsQueryGet,
          })),
          doc: vi.fn(() => ({
            get: mockFormDocGet,
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({
                get: vi.fn().mockResolvedValue({ exists: false }),
                set: vi.fn().mockResolvedValue({}),
              })),
            })),
          })),
        };
      }
      if (colName === 'form_metrics_daily') {
        return {
          where: vi.fn(() => ({
            where: vi.fn(() => ({
              get: mockMetricsQueryGet,
            })),
          })),
        };
      }
      if (colName === 'deals') {
        return {
          where: vi.fn(() => ({
            get: mockDealsQueryGet,
          })),
        };
      }
      if (colName === 'scheduled_reports') {
        return {
          doc: vi.fn(() => ({
            set: mockScheduledSet,
          })),
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: mockScheduledQueryGet,
            })),
          })),
        };
      }
      if (colName === 'activities') {
        return {
          add: mockActivityAdd,
        };
      }
      return {
        doc: vi.fn(() => ({ get: vi.fn() })),
      };
    }),
  },
}));

// Mock Topic Clusters
vi.mock('../form-intelligence-actions', () => ({
  getOrGenerateFormTopicClustersAction: vi.fn(async () => ({
    success: true,
    clusters: {
      id: 'topic_clusters',
      formId: 'form_test',
      workspaceId: 'ws_test',
      totalSubmissionsAnalyzed: 20,
      sentimentDistribution: {
        positiveCount: 15,
        positivePercentage: 75,
        neutralCount: 3,
        neutralPercentage: 15,
        negativeCount: 2,
        negativePercentage: 10,
        averageSentimentScore: 0.72,
      },
      topThemes: [
        {
          id: 't1',
          topic: 'Tuition & Payment Gateway',
          mentionCount: 12,
          percentageShare: 60,
          sentiment: 'positive',
          sampleQuotes: ['Easy checkout process.'],
          painPointSummary: 'Occasional receipt email delays.',
        },
      ],
      executiveSummary: 'Positive reception with strong payment adoption.',
      keyPainPoints: ['Receipt delivery'],
      actionableRecommendations: ['Optimize receipt automation.'],
      analyzedAt: new Date().toISOString(),
      model: 'gemini-2.5-flash',
    },
  })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('SmartSapp Forms 2.0: Reports & Advanced Analytics Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWorkspaceFormsExecutiveReportAction', () => {
    it('should aggregate metrics across multiple forms and calculate completion rate with zero-division safety', async () => {
      mockFormsQueryGet.mockResolvedValueOnce({
        docs: [
          {
            id: 'form_1',
            data: () => ({
              id: 'form_1',
              title: 'Admissions 2026',
              slug: 'admissions-2026',
              submissionCount: 45,
              purpose: 'application',
            }),
          },
          {
            id: 'form_2',
            data: () => ({
              id: 'form_2',
              title: 'Contact Sales',
              slug: 'contact-sales',
              submissionCount: 25,
              purpose: 'lead_capture',
            }),
          },
        ],
      });

      mockMetricsQueryGet.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              formId: 'form_1',
              visitors: 100,
              submissions: 45,
            }),
          },
          {
            data: () => ({
              formId: 'form_2',
              visitors: 50,
              submissions: 25,
            }),
          },
        ],
      });

      mockDealsQueryGet.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              amount: 5000,
              stage: 'won',
            }),
          },
          {
            data: () => ({
              amount: 15000,
              stage: 'proposal',
            }),
          },
        ],
      });

      const res = await getWorkspaceFormsExecutiveReportAction({
        workspaceId: 'ws_demo',
        dateRange: '30d',
      });

      expect(res.success).toBe(true);
      expect(res.data?.totalForms).toBe(2);
      expect(res.data?.totalSubmissions).toBe(70);
      expect(res.data?.totalViews).toBe(150);
      expect(res.data?.averageCompletionRate).toBe(46.7);
      expect(res.data?.totalPipelineRevenue).toBe(20000);
      expect(res.data?.totalClosedWonRevenue).toBe(5000);
      expect(res.data?.totalDealsWon).toBe(1);
      expect(res.data?.topPerformingForms.length).toBe(2);
    });

    it('should handle empty workspace with zero forms gracefully', async () => {
      mockFormsQueryGet.mockResolvedValueOnce({
        docs: [],
      });

      const res = await getWorkspaceFormsExecutiveReportAction({
        workspaceId: 'ws_empty',
      });

      expect(res.success).toBe(true);
      expect(res.data?.totalForms).toBe(0);
      expect(res.data?.totalSubmissions).toBe(0);
      expect(res.data?.averageCompletionRate).toBe(0);
    });
  });

  describe('generateFormCustomReportAction', () => {
    it('should synthesize structured report payload with KPIs, revenue attribution, and topic clusters', async () => {
      mockFormDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'form_100',
          workspaceId: 'ws_1',
          title: 'Summit Registration',
          slug: 'summit-2026',
          purpose: 'event_registration',
          submissionCount: 80,
          fields: [
            { id: 'f_name', labelOverride: 'Full Name' },
            { id: 'f_email', labelOverride: 'Email Address' },
          ],
        }),
      });

      const res = await generateFormCustomReportAction({
        formId: 'form_100',
        preset: 'executive_summary',
      });

      expect(res.success).toBe(true);
      expect(res.report?.formTitle).toBe('Summit Registration');
      expect(res.report?.kpiSummary.totalSubmissions).toBe(80);
      expect(res.report?.revenueAttribution.totalPipelineValue).toBeGreaterThan(0);
      expect(res.report?.topicClusters?.topThemes.length).toBe(1);
      expect(res.report?.strategicRecommendations.length).toBeGreaterThan(0);
    });

    it('should return error if form document does not exist', async () => {
      mockFormDocGet.mockResolvedValueOnce({
        exists: false,
      });

      const res = await generateFormCustomReportAction({
        formId: 'form_missing',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Form not found.');
    });
  });

  describe('saveScheduledReportConfigAction & getScheduledReportConfigAction', () => {
    it('should save scheduled report configuration in Firestore', async () => {
      const config = {
        id: 'sched_form_100',
        workspaceId: 'ws_1',
        formId: 'form_100',
        formTitle: 'Summit Registration',
        enabled: true,
        frequency: 'weekly' as const,
        timeOfDay: '08:00',
        dayOfWeek: 1,
        recipients: [{ email: 'exec@company.com' }],
        preset: 'executive_summary' as const,
        createdAt: new Date().toISOString(),
      };

      const res = await saveScheduledReportConfigAction({ config });

      expect(res.success).toBe(true);
      expect(mockScheduledSet).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          frequency: 'weekly',
        }),
        { merge: true }
      );
    });

    it('should retrieve scheduled report config for a form', async () => {
      mockScheduledQueryGet.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            data: () => ({
              id: 'sched_form_100',
              formId: 'form_100',
              enabled: true,
              frequency: 'weekly',
              recipients: [{ email: 'exec@company.com' }],
            }),
          },
        ],
      });

      const res = await getScheduledReportConfigAction({ formId: 'form_100' });

      expect(res.success).toBe(true);
      expect(res.config?.enabled).toBe(true);
      expect(res.config?.recipients[0].email).toBe('exec@company.com');
    });
  });

  describe('sendTestReportEmailAction', () => {
    it('should compile report and log simulated email activity record', async () => {
      mockFormDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'form_100',
          workspaceId: 'ws_1',
          title: 'Summit Registration',
          submissionCount: 50,
        }),
      });

      const res = await sendTestReportEmailAction({
        formId: 'form_100',
        targetEmail: 'director@company.com',
        preset: 'executive_summary',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('director@company.com');
      expect(mockActivityAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'form_report_emailed',
          targetEmail: 'director@company.com',
        })
      );
    });

    it('should return error if target email is missing', async () => {
      const res = await sendTestReportEmailAction({
        formId: 'form_100',
        targetEmail: '',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Target email is required.');
    });
  });
});
