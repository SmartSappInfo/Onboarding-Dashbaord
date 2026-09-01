import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateCondition,
  evaluateDecisionRule,
  executeSingleDecisionAction,
  executeSurveyDecisioningPipelineAction,
  getSurveyDecisionConfigAction,
  saveSurveyDecisionConfigAction,
  type SurveyDecisionContext,
} from '../survey-decision-engine';
import type { Survey, SurveyDecisionRule, SurveyDecisionCondition } from '@/lib/types';

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockAdd = vi.fn().mockResolvedValue({ id: 'task_auto_1' });

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

vi.mock('@/app/actions/deal-actions', () => ({
  createDeal: vi.fn().mockResolvedValue({
    id: 'deal_auto_123',
  }),
}));

describe('Survey Decisioning & Automation Engine (Phase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBaseSurvey: Survey = {
    id: 's_test_decision_1',
    title: 'Customer Satisfaction Wave 2',
    workspaceIds: ['ws1'],
    elements: [
      { id: 'q_nps', type: 'nps', title: 'Net Promoter Score' },
      { id: 'q_feedback', type: 'textarea', title: 'General Feedback' },
      { id: 'q_tier', type: 'select', title: 'Account Tier' },
    ],
  } as unknown as Survey;

  const mockContext: SurveyDecisionContext = {
    survey: mockBaseSurvey,
    responseId: 'res_100',
    score: 4,
    sentimentPolarity: 'negative',
    answers: [
      { questionId: 'q_nps', value: '4' },
      { questionId: 'q_feedback', value: 'The platform is difficult to navigate.' },
      { questionId: 'q_tier', value: 'Enterprise' },
    ],
    workspaceId: 'ws1',
    organizationId: 'org1',
    contactId: 'c_123',
    contactName: 'Sarah Connor',
    contactEmail: 'sarah@example.com',
    contactTags: ['customer', 'tier_1'],
    entityId: 'ent_555',
    entityName: 'Cyberdyne Systems',
  };

  it('evaluates score and NPS category conditions correctly', () => {
    const scoreCond: SurveyDecisionCondition = {
      id: 'c1',
      type: 'score',
      operator: 'less_than',
      value: 50,
    };
    expect(evaluateCondition(scoreCond, mockContext)).toBe(true);

    const npsCond: SurveyDecisionCondition = {
      id: 'c2',
      type: 'nps_category',
      operator: 'equals',
      value: 'detractor',
    };
    expect(evaluateCondition(npsCond, mockContext)).toBe(true);

    const promoterCond: SurveyDecisionCondition = {
      id: 'c3',
      type: 'nps_category',
      operator: 'equals',
      value: 'promoter',
    };
    expect(evaluateCondition(promoterCond, mockContext)).toBe(false);
  });

  it('evaluates question answer and contact tag conditions', () => {
    const answerCond: SurveyDecisionCondition = {
      id: 'c4',
      type: 'question_answer',
      field: 'q_tier',
      operator: 'equals',
      value: 'Enterprise',
    };
    expect(evaluateCondition(answerCond, mockContext)).toBe(true);

    const tagCond: SurveyDecisionCondition = {
      id: 'c5',
      type: 'contact_tag',
      operator: 'has_any_tag',
      value: ['tier_1', 'vip'],
    };
    expect(evaluateCondition(tagCond, mockContext)).toBe(true);
  });

  it('evaluates compound AND / OR decision rules', () => {
    const andRule: SurveyDecisionRule = {
      id: 'r_detractor_enterprise',
      name: 'Enterprise Detractor Alert',
      enabled: true,
      conditionLogic: 'AND',
      conditions: [
        { id: 'c1', type: 'nps_category', operator: 'equals', value: 'detractor' },
        { id: 'c2', type: 'question_answer', field: 'q_tier', operator: 'equals', value: 'Enterprise' },
      ],
      actions: [],
    };
    expect(evaluateDecisionRule(andRule, mockContext)).toBe(true);

    const failingAndRule: SurveyDecisionRule = {
      ...andRule,
      conditions: [
        { id: 'c1', type: 'nps_category', operator: 'equals', value: 'detractor' },
        { id: 'c2', type: 'question_answer', field: 'q_tier', operator: 'equals', value: 'SMB' },
      ],
    };
    expect(evaluateDecisionRule(failingAndRule, mockContext)).toBe(false);

    const passingOrRule: SurveyDecisionRule = {
      ...failingAndRule,
      conditionLogic: 'OR',
    };
    expect(evaluateDecisionRule(passingOrRule, mockContext)).toBe(true);
  });

  it('executes actions: tags, lead score adjustment, tasks with token interpolation, and AI prescriptions', async () => {
    // 1. Tag Application
    const tagRes = await executeSingleDecisionAction(
      {
        id: 'a1',
        type: 'apply_tags',
        tagIds: ['tag_detractor_alert'],
      },
      mockContext
    );
    expect(tagRes.success).toBe(true);

    // 2. Lead score adjustment
    const scoreRes = await executeSingleDecisionAction(
      {
        id: 'a2',
        type: 'adjust_lead_score',
        scoreDelta: -20,
      },
      mockContext
    );
    expect(scoreRes.success).toBe(true);

    // 3. Task Creation with token interpolation
    const taskRes = await executeSingleDecisionAction(
      {
        id: 'a3',
        type: 'create_task',
        taskConfig: {
          titleTemplate: 'Urgent Recovery: {{contact.name}} ({{entity.name}})',
          descriptionTemplate: 'Low score {{survey.score}} on {{survey.title}}',
          priority: 'urgent',
          dueInHours: 12,
        },
      },
      mockContext
    );
    expect(taskRes.success).toBe(true);
    expect(mockAdd).toHaveBeenCalled();

    // 4. AI Prescription Note
    const aiRes = await executeSingleDecisionAction(
      {
        id: 'a4',
        type: 'trigger_ai_prescription',
        aiPrescriptionConfig: { generateActionPlan: true, notifyOwner: true },
      },
      mockContext
    );
    expect(aiRes.success).toBe(true);
  });

  it('executes top-level decisioning pipeline and returns execution logs', async () => {
    const surveyWithConfig: Survey = {
      ...mockBaseSurvey,
      decisionConfig: {
        enabled: true,
        rules: [
          {
            id: 'rule_1',
            name: 'Detractor Recovery Pipeline',
            enabled: true,
            conditionLogic: 'AND',
            conditions: [{ id: 'c1', type: 'nps_category', operator: 'equals', value: 'detractor' }],
            actions: [
              { id: 'a1', type: 'apply_tags', tagIds: ['detractor'] },
              {
                id: 'a2',
                type: 'create_task',
                taskConfig: {
                  titleTemplate: 'Recover {{contact.name}}',
                  dueInHours: 24,
                },
              },
            ],
          },
        ],
      },
    } as unknown as Survey;

    const pipelineRes = await executeSurveyDecisioningPipelineAction({
      ...mockContext,
      survey: surveyWithConfig,
    });

    expect(pipelineRes.success).toBe(true);
    expect(pipelineRes.executedRulesCount).toBe(1);
    expect(pipelineRes.executionLogs.length).toBe(1);
    expect(pipelineRes.executionLogs[0].ruleId).toBe('rule_1');
  });

  it('saves and loads survey decision config with tenant authorization', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's_test_decision_1',
        workspaceIds: ['ws1'],
        decisionConfig: { enabled: true, rules: [] },
      }),
    });

    const getRes = await getSurveyDecisionConfigAction('s_test_decision_1', 'ws1');
    expect(getRes.success).toBe(true);
    expect(getRes.config?.enabled).toBe(true);

    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 's_test_decision_1',
        workspaceIds: ['ws1'],
      }),
    });

    const saveRes = await saveSurveyDecisionConfigAction('s_test_decision_1', 'ws1', {
      enabled: true,
      rules: [],
    });
    expect(saveRes.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
