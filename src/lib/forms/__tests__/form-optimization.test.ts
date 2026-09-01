import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeFormHealthScoreAction,
  scanFormAnomaliesAction,
  getFormExperimentsAction,
  createFormExperimentAction,
  updateExperimentStatusAction,
  promoteWinningVariantAction,
} from '../form-optimization-actions';
import { calculateStatisticalSignificance } from '../form-utils';

// Mock Firebase Admin
const mockFormDocGet = vi.fn();
const mockFormDocSet = vi.fn();
const mockHealthDocGet = vi.fn();
const mockHealthDocSet = vi.fn();
const mockExpDocGet = vi.fn();
const mockExpDocSet = vi.fn();
const mockExpCollectionGet = vi.fn();
const mockActivityAdd = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((colName: string) => {
      if (colName === 'forms') {
        return {
          doc: vi.fn(() => ({
            get: mockFormDocGet,
            set: mockFormDocSet,
            collection: vi.fn((subCol: string) => {
              if (subCol === 'optimization') {
                return {
                  doc: vi.fn(() => ({
                    get: mockHealthDocGet,
                    set: mockHealthDocSet,
                  })),
                };
              }
              if (subCol === 'experiments') {
                return {
                  get: mockExpCollectionGet,
                  doc: vi.fn(() => ({
                    get: mockExpDocGet,
                    set: mockExpDocSet,
                  })),
                };
              }
              return { doc: vi.fn() };
            }),
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('SmartSapp Forms 2.0: Optimization Engine Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'form_123',
        workspaceId: 'ws_1',
        title: 'Admissions Inquiry',
        submissionCount: 120,
        status: 'published',
        fields: [
          { id: 'f1', labelOverride: 'Student Name', appFieldId: 'first_name' },
          { id: 'f2', labelOverride: 'Parent Email', appFieldId: 'email' },
          { id: 'f3', labelOverride: 'Grade Level', appFieldId: 'grade' },
        ],
      }),
    });
    mockFormDocSet.mockResolvedValue({});
    mockHealthDocGet.mockResolvedValue({ exists: false });
    mockHealthDocSet.mockResolvedValue({});
    mockExpDocGet.mockResolvedValue({ exists: false });
    mockExpDocSet.mockResolvedValue({});
    mockExpCollectionGet.mockResolvedValue({ docs: [] });
    mockActivityAdd.mockResolvedValue({ id: 'act_1' });
  });

  describe('calculateStatisticalSignificance', () => {
    it('should calculate Z-score, P-value, conversion lift, and confidence accurately for high-traffic variants', () => {
      const control = { visitors: 500, submissions: 100 }; // 20%
      const challenger = { visitors: 500, submissions: 150 }; // 30%

      const res = calculateStatisticalSignificance(control, challenger);

      expect(res.liftPercentage).toBe(50); // +50% relative lift
      expect(res.confidence).toBeGreaterThan(99);
      expect(res.pValue).toBeLessThan(0.01);
      expect(res.isSignificant).toBe(true);
      expect(res.recommendedAction).toBe('declare_winner');
    });

    it('should indicate continue_testing when sample size is insufficient', () => {
      const control = { visitors: 10, submissions: 2 };
      const challenger = { visitors: 10, submissions: 4 };

      const res = calculateStatisticalSignificance(control, challenger);

      expect(res.hasSufficientSampleSize).toBe(false);
      expect(res.isSignificant).toBe(false);
      expect(res.recommendedAction).toBe('continue_testing');
    });

    it('should handle zero visitors gracefully without throwing errors', () => {
      const control = { visitors: 0, submissions: 0 };
      const challenger = { visitors: 0, submissions: 0 };

      const res = calculateStatisticalSignificance(control, challenger);

      expect(res.zScore).toBe(0);
      expect(res.confidence).toBe(0);
      expect(res.isSignificant).toBe(false);
    });
  });

  describe('computeFormHealthScoreAction', () => {
    it('should compute 7-dimensional score (0-100) and cache snapshot in Firestore', async () => {
      const res = await computeFormHealthScoreAction({
        formId: 'form_123',
        forceRefresh: true,
      });

      expect(res.success).toBe(true);
      expect(res.healthScore?.overallScore).toBeGreaterThan(80);
      expect(res.healthScore?.grade).toBe('excellent');
      expect(res.healthScore?.categories.conversion).toBe(88);
      expect(res.healthScore?.categories.crm).toBe(95);
      expect(res.healthScore?.diagnostics.length).toBeGreaterThan(0);
      expect(mockHealthDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          grade: 'excellent',
        }),
        { merge: true }
      );
    });

    it('should return cached snapshot when fresh (<24h) and forceRefresh is false', async () => {
      const cachedScore = {
        overallScore: 92,
        grade: 'excellent' as const,
        categories: { conversion: 90, ux: 90, accessibility: 95, logic: 90, crm: 95, analytics: 90, security: 95 },
        diagnostics: [],
        calculatedAt: new Date().toISOString(),
      };

      mockHealthDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => cachedScore,
      });

      const res = await computeFormHealthScoreAction({
        formId: 'form_123',
        forceRefresh: false,
      });

      expect(res.success).toBe(true);
      expect(res.healthScore?.overallScore).toBe(92);
      expect(mockFormDocGet).not.toHaveBeenCalled();
    });

    it('should return error if form does not exist', async () => {
      mockFormDocGet.mockResolvedValueOnce({ exists: false });

      const res = await computeFormHealthScoreAction({
        formId: 'form_missing',
        forceRefresh: true,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Form not found.');
    });
  });

  describe('scanFormAnomaliesAction', () => {
    it('should detect starvation anomaly when a published form has zero submissions', async () => {
      mockFormDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'form_123',
          workspaceId: 'ws_1',
          status: 'published',
          submissionCount: 0,
        }),
      });

      const res = await scanFormAnomaliesAction({ formId: 'form_123' });

      expect(res.success).toBe(true);
      expect(res.anomalies.length).toBe(1);
      expect(res.anomalies[0].type).toBe('starvation');
      expect(res.anomalies[0].severity).toBe('warning');
    });
  });

  describe('createFormExperimentAction, updateExperimentStatusAction, and promoteWinningVariantAction', () => {
    it('should create an A/B testing experiment with 50/50 traffic weight', async () => {
      const res = await createFormExperimentAction({
        formId: 'form_123',
        name: 'Headline Test',
        hypothesis: 'Benefit headline lifts conversions.',
        challengerVariant: {
          headlineOverride: 'Experience Our Campus Tour',
          ctaLabelOverride: 'Book Free Tour',
        },
      });

      expect(res.success).toBe(true);
      expect(res.experiment?.status).toBe('running');
      expect(res.experiment?.variants.length).toBe(2);
      expect(res.experiment?.variants[0].trafficWeight).toBe(50);
      expect(res.experiment?.variants[1].trafficWeight).toBe(50);
    });

    it('should update experiment status to paused or concluded', async () => {
      const res = await updateExperimentStatusAction({
        formId: 'form_123',
        experimentId: 'exp_1',
        status: 'paused',
      });

      expect(res.success).toBe(true);
      expect(mockExpDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paused',
        }),
        { merge: true }
      );
    });

    it('should promote winning variant, merge overrides to Form, and log audit activity', async () => {
      mockFormDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'form_123',
          title: 'Original Title',
          theme: { preset: 'minimal' },
        }),
      });

      mockExpDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'exp_1',
          variants: [
            { id: 'variant_a_control', name: 'Variant A', isControl: true },
            {
              id: 'variant_b_challenger',
              name: 'Variant B',
              isControl: false,
              headlineOverride: 'Winning High-Converting Headline',
              themePresetOverride: 'professional',
            },
          ],
        }),
      });

      const res = await promoteWinningVariantAction({
        formId: 'form_123',
        experimentId: 'exp_1',
        winningVariantId: 'variant_b_challenger',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Variant B');

      // Verify form definition updated with winner overrides
      expect(mockFormDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Winning High-Converting Headline',
          theme: { preset: 'professional' },
        }),
        { merge: true }
      );

      // Verify audit activity logged
      expect(mockActivityAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'form_ab_experiment_promoted',
          winningVariantId: 'variant_b_challenger',
        })
      );
    });
  });
});
