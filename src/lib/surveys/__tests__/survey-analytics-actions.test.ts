import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSurveyAnalyticsOverviewAction,
  exportSurveyDataAction,
} from '../survey-analytics-actions';

const mockGet = vi.fn();
const mockOrderBy = vi.fn().mockReturnThis();

const mockCollection = vi.fn((name: string) => ({
  doc: vi.fn((id?: string) => ({
    get: mockGet,
    collection: (subName: string) => ({
      orderBy: mockOrderBy,
      get: mockGet,
    }),
  })),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (name: string) => mockCollection(name),
  },
}));

describe('Survey Analytics Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes analytics overview with response quality and channel breakdown', async () => {
    // 1st get: surveyDoc
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ id: 's1', title: 'Parent Survey', elements: [] }),
    });

    // 2nd get: responses subcollection
    const now = Date.now();
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'r1',
          data: () => ({
            channel: 'whatsapp',
            startedAt: new Date(now - 120000).toISOString(),
            submittedAt: new Date(now).toISOString(),
            answers: { q1: 'val1', q2: 'val2' },
          }),
        },
        {
          id: 'r2',
          data: () => ({
            channel: 'email',
            startedAt: new Date(now - 80000).toISOString(),
            submittedAt: new Date(now).toISOString(),
            answers: { q1: 'val1', q2: 'val3' },
          }),
        },
      ],
    });

    const res = await getSurveyAnalyticsOverviewAction('s1', 'ws1');
    expect(res.success).toBe(true);
    expect(res.totalResponses).toBe(2);
    expect(res.channelDistribution.length).toBe(2);
    expect(res.qualityMetrics.totalResponses).toBe(2);
  });

  it('exports survey responses to CSV with OWASP formula protection', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's1',
        slug: 'school-eval',
        elements: [
          { id: 'q1', type: 'text', title: 'Feedback', isRequired: true },
        ],
      }),
    });

    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'r1',
          data: () => ({
            channel: 'web',
            submittedAt: '2026-09-01T09:00:00Z',
            answers: { q1: '=cmd|\' /C calc\'!A0' }, // Malicious formula injection
          }),
        },
      ],
    });

    const res = await exportSurveyDataAction({
      surveyId: 's1',
      workspaceId: 'ws1',
      format: 'csv',
    });

    expect(res.success).toBe(true);
    expect(res.mimeType).toBe('text/csv');
    expect(res.content).toContain('Response ID');
    // Formula must be neutralized with leading single quote: '=cmd...
    expect(res.content).toContain("'=cmd");
  });

  it('exports responses to structured JSON format', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's1',
        slug: 'school-eval',
        elements: [],
      }),
    });

    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'r1',
          data: () => ({
            channel: 'kiosk',
            submittedAt: '2026-09-01T09:00:00Z',
            answers: { q1: 'Awesome' },
          }),
        },
      ],
    });

    const res = await exportSurveyDataAction({
      surveyId: 's1',
      workspaceId: 'ws1',
      format: 'json',
    });

    expect(res.success).toBe(true);
    expect(res.mimeType).toBe('application/json');
    const parsed = JSON.parse(res.content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].channel).toBe('kiosk');
  });
});
