import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  safePercentage, 
  formatDurationSeconds, 
  recordFormTelemetryEventAction, 
  getFormAnalyticsAction, 
  exportAnalyticsDataAsCsvAction 
} from '../form-analytics-actions';

// Mock firebase-admin
vi.mock('@/lib/firebase-admin', () => {
  const setMock = vi.fn().mockResolvedValue({});
  const docMock = vi.fn().mockReturnValue({
    set: setMock,
    get: vi.fn(),
  });

  const queryMock = {
    where: vi.fn().mockReturnThis(),
    get: vi.fn(),
  };

  const collectionMock = vi.fn((colName: string) => {
    if (colName === 'form_metrics_daily') {
      return {
        doc: docMock,
        where: vi.fn().mockReturnValue(queryMock),
      };
    }
    if (colName === 'app_fields') {
      return {
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: [
              {
                id: 'def_name',
                data: () => ({ variableName: 'fullName', label: 'Full Name', type: 'text' }),
              },
              {
                id: 'def_gpa',
                data: () => ({ variableName: 'gpa', label: 'Current GPA', type: 'number' }),
              },
            ],
          }),
        }),
      };
    }
    if (colName === 'forms') {
      return {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              id: 'form_123',
              workspaceId: 'ws_abc',
              title: 'Admissions Intake',
              slug: 'admissions-intake',
              pages: [
                { id: 'page_1', title: 'Personal Info', components: [] },
                { id: 'page_2', title: 'Academic History', components: [] },
              ],
              fields: [
                {
                  id: 'f_name',
                  appFieldId: 'def_name',
                  labelOverride: 'Full Name',
                },
                {
                  id: 'f_gpa',
                  appFieldId: 'def_gpa',
                  labelOverride: 'Current GPA',
                },
              ],
              submissionCount: 50,
            }),
          }),
        }),
      };
    }
    return { doc: docMock };
  });

  return {
    adminDb: {
      collection: collectionMock,
    },
  };
});

describe('SmartSapp Forms 2.0: Event & Conversion Funnel Analytics Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Math & Duration Formatting Helpers', () => {
    it('safePercentage guards against zero or negative denominators', () => {
      expect(safePercentage(10, 0)).toBe(0);
      expect(safePercentage(10, -5)).toBe(0);
      expect(safePercentage(0, 100)).toBe(0);
      expect(safePercentage(NaN as any, 100)).toBe(0);
    });

    it('safePercentage calculates correctly rounded values', () => {
      expect(safePercentage(1, 3)).toBe(33.3);
      expect(safePercentage(50, 100)).toBe(50);
      expect(safePercentage(75, 200)).toBe(37.5);
    });

    it('formatDurationSeconds formats seconds into clean human-readable strings', () => {
      expect(formatDurationSeconds(0)).toBe('0s');
      expect(formatDurationSeconds(-10)).toBe('0s');
      expect(formatDurationSeconds(45)).toBe('45s');
      expect(formatDurationSeconds(125)).toBe('2m 5s');
      expect(formatDurationSeconds(3600)).toBe('60m 0s');
    });
  });

  describe('recordFormTelemetryEventAction', () => {
    it('returns error when formId or eventType is missing', async () => {
      const res = await recordFormTelemetryEventAction({
        formId: '',
        workspaceId: 'ws_1',
        eventType: 'page_view',
        sessionId: 's_1',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('successfully ingests page_view event with device and UTM tags', async () => {
      const res = await recordFormTelemetryEventAction({
        formId: 'form_123',
        workspaceId: 'ws_1',
        eventType: 'page_view',
        sessionId: 's_1',
        deviceType: 'mobile',
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'fall_admissions',
        referrer: 'https://google.com/search',
      });

      expect(res.success).toBe(true);
    });

    it('successfully ingests form_started and step transition events', async () => {
      const startRes = await recordFormTelemetryEventAction({
        formId: 'form_123',
        workspaceId: 'ws_1',
        eventType: 'form_started',
        sessionId: 's_1',
      });
      expect(startRes.success).toBe(true);

      const stepRes = await recordFormTelemetryEventAction({
        formId: 'form_123',
        workspaceId: 'ws_1',
        eventType: 'page_step',
        sessionId: 's_1',
        pageId: 'page_2',
        pageIndex: 1,
      });
      expect(stepRes.success).toBe(true);
    });
  });

  describe('getFormAnalyticsAction & exportAnalyticsDataAsCsvAction', () => {
    it('calculates comprehensive form analytics summary', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');
      const queryMock = (adminDb.collection('form_metrics_daily') as any).where().where();
      queryMock.get.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              date: '2026-09-01',
              visitors: 100,
              starts: 80,
              submissions: 40,
              totalDwellSeconds: 4800,
              dropOffs: 40,
              pageViews: { page_1: 80, page_2: 60 },
              fieldDwellSeconds: { f_name: 400, f_gpa: 2000 },
              fieldDropOffs: { f_name: 5, f_gpa: 30 },
              deviceBreakdown: { desktop: 60, mobile: 35, tablet: 5 },
              utmBreakdown: {
                sources: { google: 60, direct: 40 },
                mediums: { cpc: 60 },
                campaigns: { fall_2026: 60 },
                referrers: { 'google.com': 60 },
              },
            }),
          },
        ],
      });

      const summary = await getFormAnalyticsAction('form_123', '30d');
      expect(summary).not.toBeNull();
      if (!summary) return;

      expect(summary.totalVisitors).toBe(100);
      expect(summary.totalStarts).toBe(80);
      expect(summary.totalSubmissions).toBe(40);
      expect(summary.overallConversionRate).toBe(40);
      expect(summary.completionRate).toBe(50);
      expect(summary.dropOffRate).toBe(50);
      expect(summary.avgCompletionTimeSeconds).toBe(120);

      // Funnel verification
      expect(summary.funnelStages.length).toBeGreaterThanOrEqual(3);
      expect(summary.funnelStages[0].name).toBe('Unique Visitors');
      expect(summary.funnelStages[summary.funnelStages.length - 1].name).toBe('Completed & Submitted');

      // Question friction heatmap verification
      expect(summary.questionFriction.length).toBe(2);
      const highFrictionField = summary.questionFriction.find(q => q.fieldId === 'f_gpa');
      expect(highFrictionField?.status).toBe('high_friction');
      expect(highFrictionField?.recommendation).toBeDefined();

      // Device breakdown verification
      expect(summary.deviceBreakdown.desktopPercent).toBe(60);
      expect(summary.deviceBreakdown.mobilePercent).toBe(35);
    });

    it('exports analytics summary data to CSV format', async () => {
      const { adminDb } = await import('@/lib/firebase-admin');
      const queryMock = (adminDb.collection('form_metrics_daily') as any).where().where();
      queryMock.get.mockResolvedValueOnce({
        docs: [],
      });

      const res = await exportAnalyticsDataAsCsvAction('form_123', '30d');
      expect(res.success).toBe(true);
      expect(res.csvContent).toContain('Date,Visitors,Starts,Submissions,Conversion Rate (%)');
      expect(res.csvContent).toContain('Question,Field Variable,Completions,Drop-Offs');
    });
  });
});
