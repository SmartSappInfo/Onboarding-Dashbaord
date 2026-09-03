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

vi.mock('@/lib/contact-adapter', () => ({
  resolveMultipleContacts: vi.fn().mockImplementation(async (ids: string[]) => {
    const res: Record<string, unknown> = {};
    ids.forEach((id) => {
      if (id === 'ent_linked_1') {
        res[id] = {
          id: 'ent_linked_1',
          name: 'Lincoln Community School',
          primaryContactName: 'Dr. Kwame Appiah',
          primaryContactPhone: '+233244112233',
          primaryContactEmail: 'kappiah@lincoln.edu.gh',
          entityContacts: [
            { id: 'c1', name: 'Dr. Kwame Appiah', isPrimary: true, typeLabel: 'Superintendent' },
          ],
        };
      }
    });
    return res;
  }),
}));

describe('Survey Analytics Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes analytics overview with response quality and channel breakdown', async () => {
    // 1st get: surveyDoc
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ id: 's1', workspaceId: 'ws1', title: 'Parent Survey', elements: [] }),
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
            answers: [{ questionId: 'q1', value: 'val1' }],
          }),
        },
        {
          id: 'r2',
          data: () => ({
            channel: 'email',
            startedAt: new Date(now - 80000).toISOString(),
            submittedAt: new Date(now).toISOString(),
            answers: [{ questionId: 'q1', value: 'val2' }],
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

  it('blocks unauthorized access when survey does not belong to the workspace', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ id: 's1', workspaceId: 'other_workspace', title: 'Private Survey', elements: [] }),
    });

    const res = await getSurveyAnalyticsOverviewAction('s1', 'ws1');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Unauthorized');
  });

  it('exports survey responses to CSV with OWASP formula protection', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's1',
        workspaceId: 'ws1',
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
            answers: [{ questionId: 'q1', value: "=cmd|' /C calc'!A0" }], // Malicious formula injection
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

  it('exports responses to structured JSON format with date filtering', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's1',
        workspaceId: 'ws1',
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
            answers: [{ questionId: 'q1', value: 'Awesome' }],
          }),
        },
      ],
    });

    const res = await exportSurveyDataAction({
      surveyId: 's1',
      workspaceId: 'ws1',
      format: 'json',
      startDate: '2026-09-01T00:00:00Z',
      endDate: '2026-09-01T23:59:59Z',
    });

    expect(res.success).toBe(true);
    expect(res.mimeType).toBe('application/json');
    const parsed = JSON.parse(res.content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].channel).toBe('kiosk');
    expect(parsed[0].entityDetails).toBeDefined();
    expect(parsed[0].entityDetails.contactStatus).toBe('Non-Linked');
  });

  it('exports linked CRM contacts with Entity Name, Contact Person, Phone, Email, and Role to CSV', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's1',
        workspaceId: 'ws1',
        slug: 'school-survey',
        elements: [
          { id: 'q_feedback', type: 'text', title: 'Overall Rating', isRequired: true },
        ],
      }),
    });

    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'r_linked_1',
          data: () => ({
            channel: 'web',
            submittedAt: '2026-09-01T10:00:00Z',
            entityId: 'ent_linked_1',
            answers: [{ questionId: 'q_feedback', value: 'Excellent' }],
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
    expect(res.content).toContain('Entity Name');
    expect(res.content).toContain('Contact Person Name');
    expect(res.content).toContain('Contact Phone');
    expect(res.content).toContain('Contact Email');
    expect(res.content).toContain('Role');
    expect(res.content).toContain('Contact Status');
    expect(res.content).toContain('Entity ID');

    // Verify resolved CRM entity details in row
    expect(res.content).toContain('Lincoln Community School');
    expect(res.content).toContain('Dr. Kwame Appiah');
    expect(res.content).toContain('+233244112233');
    expect(res.content).toContain('kappiah@lincoln.edu.gh');
    expect(res.content).toContain('Superintendent');
    expect(res.content).toContain('Linked');
    expect(res.content).toContain('ent_linked_1');
    expect(res.content).toContain('Excellent');
  });

  it('exports non-linked survey responses with extracted contact info to CSV and JSON', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's1',
        workspaceId: 'ws1',
        slug: 'public-inquiry',
        elements: [
          { id: 'q_name', type: 'text', title: 'Your Full Name', isRequired: true },
          { id: 'q_phone', type: 'phone', title: 'Phone Number', isRequired: true },
          { id: 'q_email', type: 'email', title: 'Email Address', isRequired: true },
          { id: 'q_role', type: 'text', title: 'Your Role / Designation', isRequired: false },
          { id: 'q_school', type: 'text', title: 'School / Institution Name', isRequired: false },
        ],
      }),
    });

    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'r_public_1',
          data: () => ({
            channel: 'direct',
            submittedAt: '2026-09-01T11:00:00Z',
            answers: [
              { questionId: 'q_name', value: 'Ama Serwaa' },
              { questionId: 'q_phone', value: '+233201122334' },
              { questionId: 'q_email', value: 'ama.serwaa@presby.edu.gh' },
              { questionId: 'q_role', value: 'Vice Principal' },
              { questionId: 'q_school', value: 'Presbyterian High School' },
            ],
          }),
        },
      ],
    });

    // 1. CSV export
    const csvRes = await exportSurveyDataAction({
      surveyId: 's1',
      workspaceId: 'ws1',
      format: 'csv',
    });

    expect(csvRes.success).toBe(true);
    expect(csvRes.content).toContain('Presbyterian High School');
    expect(csvRes.content).toContain('Ama Serwaa');
    expect(csvRes.content).toContain('+233201122334');
    expect(csvRes.content).toContain('ama.serwaa@presby.edu.gh');
    expect(csvRes.content).toContain('Vice Principal');
    expect(csvRes.content).toContain('Non-Linked');

    // 2. JSON export
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's1',
        workspaceId: 'ws1',
        slug: 'public-inquiry',
        elements: [
          { id: 'q_name', type: 'text', title: 'Your Full Name', isRequired: true },
          { id: 'q_phone', type: 'phone', title: 'Phone Number', isRequired: true },
          { id: 'q_email', type: 'email', title: 'Email Address', isRequired: true },
          { id: 'q_role', type: 'text', title: 'Your Role / Designation', isRequired: false },
          { id: 'q_school', type: 'text', title: 'School / Institution Name', isRequired: false },
        ],
      }),
    });

    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'r_public_1',
          data: () => ({
            channel: 'direct',
            submittedAt: '2026-09-01T11:00:00Z',
            answers: [
              { questionId: 'q_name', value: 'Ama Serwaa' },
              { questionId: 'q_phone', value: '+233201122334' },
              { questionId: 'q_email', value: 'ama.serwaa@presby.edu.gh' },
              { questionId: 'q_role', value: 'Vice Principal' },
              { questionId: 'q_school', value: 'Presbyterian High School' },
            ],
          }),
        },
      ],
    });

    const jsonRes = await exportSurveyDataAction({
      surveyId: 's1',
      workspaceId: 'ws1',
      format: 'json',
    });

    expect(jsonRes.success).toBe(true);
    const parsed = JSON.parse(jsonRes.content);
    expect(parsed[0].entityDetails).toEqual({
      isLinked: false,
      contactStatus: 'Non-Linked',
      entityId: null,
      entityName: 'Presbyterian High School',
      contactPersonName: 'Ama Serwaa',
      phone: '+233201122334',
      email: 'ama.serwaa@presby.edu.gh',
      role: 'Vice Principal',
      locationString: '',
      zoneName: '',
    });
  });

  it('omits contact details from CSV headers and rows when includeContactDetails is false', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's1',
        workspaceId: 'ws1',
        slug: 'anonymous-survey',
        elements: [
          { id: 'q1', type: 'text', title: 'Opinion' },
        ],
      }),
    });

    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'r_anon_1',
          data: () => ({
            channel: 'web',
            submittedAt: '2026-09-01T12:00:00Z',
            entityId: 'ent_linked_1',
            answers: [{ questionId: 'q1', value: 'Great service' }],
          }),
        },
      ],
    });

    const res = await exportSurveyDataAction({
      surveyId: 's1',
      workspaceId: 'ws1',
      format: 'csv',
      includeContactDetails: false,
    });

    expect(res.success).toBe(true);
    // Entity columns must NOT be present in CSV headers or data
    expect(res.content).not.toContain('Contact Status');
    expect(res.content).not.toContain('Entity ID');
    expect(res.content).not.toContain('Entity Name');
    expect(res.content).not.toContain('Lincoln Community School');
    expect(res.content).toContain('Response ID');
    expect(res.content).toContain('Great service');
  });

  it('safely handles malformed dates without throwing RangeError', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's1',
        workspaceId: 'ws1',
        slug: 'date-test',
        elements: [{ id: 'q1', type: 'text', title: 'Test' }],
      }),
    });

    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'r_bad_date',
          data: () => ({
            channel: 'web',
            submittedAt: 'not-a-valid-date-string-12345',
            answers: [{ questionId: 'q1', value: 'Valid' }],
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
    expect(res.content).toContain('r_bad_date');
    expect(res.content).toContain('Valid');
  });

  it('rejects cross-tenant export when workspaceId does not match survey authorization', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's1',
        workspaceIds: ['ws_legit'],
        slug: 'confidential-survey',
        elements: [],
      }),
    });

    const res = await exportSurveyDataAction({
      surveyId: 's1',
      workspaceId: 'ws_attacker',
      format: 'csv',
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('Unauthorized: Survey does not belong to this workspace');
  });
});
