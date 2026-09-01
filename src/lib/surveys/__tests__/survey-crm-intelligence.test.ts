import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWorkspaceActiveSurveysAction,
  getEntitySurveyHistoryAction,
  sendSurveyToContactAction,
  executeCrmInboundSurveyTriggerAction,
} from '../survey-crm-trigger-actions';
import type { Survey, SurveyResponse } from '@/lib/types';

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockAdd = vi.fn().mockResolvedValue({ id: 'act_123' });

const queryMock = {
  get: mockGet,
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
};

const docMock = (id?: string) => ({
  id: id || 'doc_auto_1',
  get: mockGet,
  set: mockSet,
  update: mockUpdate,
  collection: vi.fn((subName: string) => ({
    doc: vi.fn((subId?: string) => ({
      id: subId || 'sub_auto_1',
      get: mockGet,
      set: mockSet,
      update: mockUpdate,
    })),
    add: mockAdd,
    where: vi.fn().mockReturnValue(queryMock),
    limit: vi.fn().mockReturnValue(queryMock),
    get: mockGet,
  })),
});

const mockCollection = vi.fn((name: string) => ({
  doc: vi.fn((id?: string) => docMock(id)),
  add: mockAdd,
  where: vi.fn().mockReturnValue(queryMock),
  limit: vi.fn().mockReturnValue(queryMock),
  get: mockGet,
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (name: string) => mockCollection(name),
  },
}));

vi.mock('@/lib/messaging-engine', () => ({
  sendMessage: vi.fn().mockResolvedValue({ logId: 'msg_123', success: true }),
}));

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue({ id: 'act_logged' }),
}));

vi.mock('@/lib/crypto', () => ({
  encryptToken: vi.fn((payload: string) => `enc_${payload}`),
  decryptToken: vi.fn((token: string) => token.replace('enc_', '')),
}));

describe('CRM Intelligence & Two-Way Sync (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSurvey: Survey = {
    id: 's_crm_1',
    title: 'Customer Onboarding Feedback',
    slug: 'customer-onboarding-feedback',
    workspaceIds: ['ws1'],
    status: 'published',
    scoringEnabled: true,
    maxScore: 100,
  } as unknown as Survey;

  it('fetches active published surveys for the workspace', async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 's_crm_1',
          data: () => mockSurvey,
        },
      ],
      forEach: (cb: (doc: { id: string; data: () => unknown }) => void) => {
        cb({
          id: 's_crm_1',
          data: () => mockSurvey,
        });
      },
    });

    const res = await getWorkspaceActiveSurveysAction('ws1');
    expect(res.success).toBe(true);
    expect(res.surveys.length).toBe(1);
    expect(res.surveys[0].title).toBe('Customer Onboarding Feedback');
  });

  it('dispatches personalized survey invitation with encrypted ref tracking token', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => mockSurvey,
    });

    const res = await sendSurveyToContactAction({
      surveyId: 's_crm_1',
      workspaceId: 'ws1',
      organizationId: 'org1',
      entityId: 'ent_777',
      entityName: 'Acme School',
      contactId: 'c_999',
      recipientName: 'Alice Green',
      recipientEmail: 'alice@acme.edu',
      recipientPhone: '+233200000000',
      channel: 'whatsapp',
      customNote: 'Please take 2 minutes to share your feedback',
    });

    expect(res.success).toBe(true);
    expect(res.surveyUrl).toContain('ref=enc_c_999%3Aent_777');
    expect(res.messageId).toBe('msg_123');
  });

  it('retrieves entity survey response history with aggregated metrics', async () => {
    const mockResponse: SurveyResponse = {
      id: 'res_1',
      surveyId: 's_crm_1',
      entityId: 'ent_777',
      score: 90,
      sentimentPolarity: 'positive',
      submittedAt: '2026-09-01T10:00:00.000Z',
      channel: 'whatsapp',
      respondentName: 'Alice Green',
      answers: [{ questionId: 'q1', value: 'Excellent support' }],
    } as unknown as SurveyResponse;

    mockGet
      // 1. surveys in workspace
      .mockResolvedValueOnce({
        docs: [
          {
            id: 's_crm_1',
            data: () => mockSurvey,
            ref: {
              collection: () => ({
                where: () => ({
                  get: vi.fn().mockResolvedValue({
                    docs: [{ id: 'res_1', data: () => mockResponse }],
                    forEach: (cb: (doc: { id: string; data: () => unknown }) => void) => {
                      cb({ id: 'res_1', data: () => mockResponse });
                    },
                  }),
                }),
              }),
            },
          },
        ],
      });

    const historyRes = await getEntitySurveyHistoryAction('ent_777', 'ws1');
    expect(historyRes.success).toBe(true);
    expect(historyRes.data.totalCount).toBe(1);
    expect(historyRes.data.averageScore).toBe(90);
    expect(historyRes.data.latestSentiment).toBe('positive');
  });

  it('executes inbound CRM lifecycle event triggers and auto-dispatches surveys', async () => {
    const surveyWithInboundTrigger: Survey = {
      ...mockSurvey,
      crmConfig: {
        enabled: true,
        autoUpsertContact: true,
        autoUpsertEntity: true,
        fieldMappings: [],
        taskRules: [],
        dealRules: [],
        timelineLoggingEnabled: true,
        inboundTriggers: {
          enabled: true,
          rules: [
            {
              id: 'trig_1',
              enabled: true,
              event: 'deal_won',
              channel: 'email',
              delayDays: 0,
              customMessage: 'Congratulations on your deal! Please review us.',
            },
          ],
        },
      },
    } as unknown as Survey;

    mockGet
      // 1. fetch surveys
      .mockResolvedValueOnce({
        docs: [
          {
            id: 's_crm_1',
            data: () => surveyWithInboundTrigger,
          },
        ],
      })
      // 2. fetch survey doc inside sendSurveyToContactAction
      .mockResolvedValueOnce({
        exists: true,
        data: () => surveyWithInboundTrigger,
      });

    const inboundRes = await executeCrmInboundSurveyTriggerAction({
      event: 'deal_won',
      workspaceId: 'ws1',
      entityId: 'ent_777',
      recipientName: 'Alice Green',
      recipientEmail: 'alice@acme.edu',
    });

    expect(inboundRes.success).toBe(true);
    expect(inboundRes.triggeredCount).toBe(1);
  });
});
