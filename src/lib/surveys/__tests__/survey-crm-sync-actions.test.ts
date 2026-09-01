import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeSurveyCrmSyncAction,
  getSurveyCrmFieldDefinitionsAction,
  saveSurveyCrmConfigAction,
} from '../survey-crm-sync-actions';
import type { Survey, SurveyCrmConfig } from '@/lib/types';

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);

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
    where: vi.fn().mockReturnValue(queryMock),
    limit: vi.fn().mockReturnValue(queryMock),
    get: mockGet,
  })),
});

const mockCollection = vi.fn((name: string) => ({
  doc: vi.fn((id?: string) => docMock(id)),
  where: vi.fn().mockReturnValue(queryMock),
  limit: vi.fn().mockReturnValue(queryMock),
  get: mockGet,
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (name: string) => mockCollection(name),
  },
}));

vi.mock('@/app/actions/deal-actions', () => ({
  createDeal: vi.fn().mockResolvedValue({
    success: true,
    deal: { id: 'deal_123' },
  }),
}));

vi.mock('@/lib/survey-actions', () => ({
  triggerAutomationProtocols: vi.fn().mockResolvedValue(undefined),
}));

describe('Survey CRM Sync Actions (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSurvey = {
    id: 's_test_1',
    title: 'Parent Experience Survey',
    workspaceIds: ['ws1'],
    elements: [
      { id: 'q_name', type: 'text', title: 'Your Full Name' },
      { id: 'q_nps', type: 'nps', title: 'Net Promoter Score' },
      { id: 'q_grade', type: 'select', title: 'Target Grade' },
    ],
    crmConfig: {
      enabled: true,
      autoUpsertContact: true,
      autoUpsertEntity: true,
      fieldMappings: [
        {
          id: 'm1',
          questionId: 'q_name',
          targetType: 'contact',
          targetField: 'name',
          writeMode: 'fill_if_empty',
          transform: 'trim',
        },
        {
          id: 'm2',
          questionId: 'q_nps',
          targetType: 'contact',
          targetField: 'customData.npsScore',
          writeMode: 'always_overwrite',
          transform: 'number',
        },
        {
          id: 'm3',
          questionId: 'q_grade',
          targetType: 'entity',
          targetField: 'customFields.targetGrade',
          writeMode: 'always_overwrite',
        },
      ],
      taskRules: [
        {
          id: 't1',
          triggerOn: 'nps_detractor',
          thresholdValue: 6,
          taskTitleTemplate: 'Follow up with {{contact.name}} regarding low NPS score',
          taskDescriptionTemplate: 'Low score on {{survey.title}}',
          priority: 'urgent',
          dueInHours: 24,
          assignTo: 'survey_owner',
        },
      ],
      dealRules: [],
      leadScoreAdjustment: {
        enabled: true,
        pointsPerSurveyCompleted: 5,
        pointsForPromoter: 10,
        pointsForDetractor: -15,
      },
      timelineLoggingEnabled: true,
    },
  };

  it('matches contact by email, updates mapped fields, and creates follow-up task on low score', async () => {
    // 1. Email lookup finds existing contact
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'contact_456',
          data: () => ({
            name: 'Jane Doe',
            email: 'jane@example.com',
            leadScore: 20,
          }),
        },
      ],
    });

    // 2. Entity lookup for custom field update
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 'ent_789',
      }),
    });

    const res = await executeSurveyCrmSyncAction({
      survey: mockSurvey as unknown as Survey,
      responseId: 'res_001',
      responseData: {
        answers: [
          { questionId: 'q_name', value: 'Jane Doe Updated' },
          { questionId: 'q_nps', value: '4' },
          { questionId: 'q_grade', value: 'Grade 10' },
        ],
        score: 4,
        respondentName: 'Jane Doe',
        respondentEmail: 'jane@example.com',
      },
      workspaceId: 'ws1',
      organizationId: 'org1',
      entityId: 'ent_789',
      entityName: 'Jane Family',
    });

    expect(res.success).toBe(true);
    expect(res.contactId).toBe('contact_456');
    expect(res.tasksCreatedCount).toBe(1);
    expect(res.activityLogged).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('auto-creates new contact if no match is found and autoUpsertContact is true', async () => {
    // 1. Email lookup: not found
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

    const res = await executeSurveyCrmSyncAction({
      survey: mockSurvey as unknown as Survey,
      responseId: 'res_002',
      responseData: {
        answers: [{ questionId: 'q_name', value: 'Alex Smith' }],
        score: 90,
        respondentName: 'Alex Smith',
        respondentEmail: 'alex@example.com',
      },
      workspaceId: 'ws1',
      organizationId: 'org1',
    });

    expect(res.success).toBe(true);
    expect(mockSet).toHaveBeenCalled();
  });

  it('returns available CRM field definitions including entity custom fields', async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'field_budget',
          data: () => ({
            name: 'budgetTier',
            label: 'Budget Tier',
            type: 'string',
          }),
        },
      ],
    });

    const res = await getSurveyCrmFieldDefinitionsAction('ws1');
    expect(res.success).toBe(true);
    expect(res.fields).toBeDefined();
    const customField = res.fields?.find((f) => f.key === 'customFields.budgetTier');
    expect(customField).toBeDefined();
    expect(customField?.group).toBe('Entity Custom Fields');
  });

  it('saves survey CRM config with workspace authorization protection', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's_test_1',
        workspaceIds: ['ws1'],
      }),
    });

    const newConfig: SurveyCrmConfig = {
      enabled: true,
      autoUpsertContact: true,
      autoUpsertEntity: false,
      fieldMappings: [],
      taskRules: [],
      dealRules: [],
      timelineLoggingEnabled: true,
    };

    const res = await saveSurveyCrmConfigAction('s_test_1', 'ws1', newConfig);
    expect(res.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
