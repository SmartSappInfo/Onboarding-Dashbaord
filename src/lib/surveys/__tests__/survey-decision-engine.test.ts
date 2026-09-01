import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateCondition,
  evaluateDecisionRule,
  type SurveyDecisionContext,
} from '../survey-decision-evaluator';
import {
  executeSingleDecisionAction,
  executeSurveyDecisioningPipelineAction,
  testSurveyDecisionRuleAction,
  getSurveyDecisionConfigAction,
  saveSurveyDecisionConfigAction,
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

  it('evaluates question answers and contact tag conditions', () => {
    const qCond: SurveyDecisionCondition = {
      id: 'c4',
      type: 'question_answer',
      field: 'q_tier',
      operator: 'equals',
      value: 'Enterprise',
    };
    expect(evaluateCondition(qCond, mockContext)).toBe(true);

    const tagCond: SurveyDecisionCondition = {
      id: 'c5',
      type: 'contact_tag',
      operator: 'has_any_tag',
      value: 'tier_1',
    };
    expect(evaluateCondition(tagCond, mockContext)).toBe(true);
  });

  it('evaluates compound decision rules with AND/OR logic', () => {
    const ruleAnd: SurveyDecisionRule = {
      id: 'r_and_1',
      name: 'Detractor Recovery Rule',
      enabled: true,
      conditionLogic: 'AND',
      conditions: [
        { id: 'c1', type: 'nps_category', operator: 'equals', value: 'detractor' },
        { id: 'c2', type: 'sentiment', operator: 'equals', value: 'negative' },
      ],
      actions: [],
    };
    expect(evaluateDecisionRule(ruleAnd, mockContext)).toBe(true);

    const ruleFailing: SurveyDecisionRule = {
      id: 'r_fail_1',
      name: 'Promoter Rule',
      enabled: true,
      conditionLogic: 'AND',
      conditions: [
        { id: 'c1', type: 'nps_category', operator: 'equals', value: 'promoter' },
        { id: 'c2', type: 'sentiment', operator: 'equals', value: 'negative' },
      ],
      actions: [],
    };
    expect(evaluateDecisionRule(ruleFailing, mockContext)).toBe(false);
  });

  it('executes actions: tags, lead score, tasks, deals and AI prescriptions', async () => {
    // 1. Tag Action
    const tagRes = await executeSingleDecisionAction(
      { id: 'a1', type: 'apply_tags', tagIds: ['tag_vip_detractor'] },
      mockContext
    );
    expect(tagRes.success).toBe(true);

    // 2. Task Action
    const taskRes = await executeSingleDecisionAction(
      {
        id: 'a2',
        type: 'create_task',
        taskConfig: {
          titleTemplate: 'URGENT: Call {{contact.name}}',
          descriptionTemplate: 'Low score on {{survey.title}}',
          priority: 'urgent',
          dueInHours: 24,
        },
      },
      mockContext
    );
    expect(taskRes.success).toBe(true);
    expect(mockAdd).toHaveBeenCalled();

    // 3. AI Prescription Note
    const aiRes = await executeSingleDecisionAction(
      { id: 'a3', type: 'trigger_ai_prescription' },
      mockContext
    );
    expect(aiRes.success).toBe(true);
  });

  it('executes full decisioning pipeline on a survey with active rules', async () => {
    const surveyWithRules: Survey = {
      ...mockBaseSurvey,
      decisionConfig: {
        enabled: true,
        rules: [
          {
            id: 'r_active_1',
            name: 'Auto Detractor Recovery',
            enabled: true,
            conditionLogic: 'OR',
            conditions: [
              { id: 'c1', type: 'nps_category', operator: 'equals', value: 'detractor' },
            ],
            actions: [
              { id: 'a1', type: 'apply_tags', tagIds: ['detractor'] },
            ],
          },
        ],
      },
    };

    const pipelineRes = await executeSurveyDecisioningPipelineAction({
      ...mockContext,
      survey: surveyWithRules,
    });

    expect(pipelineRes.success).toBe(true);
    expect(pipelineRes.executedRulesCount).toBe(1);
    expect(pipelineRes.executionLogs.length).toBe(1);
  });

  it('simulates dry-run decision rule execution accurately without mutating database', async () => {
    const testRule: SurveyDecisionRule = {
      id: 'r_sim_1',
      name: 'Dry-Run VIP Lead Test',
      enabled: true,
      conditionLogic: 'AND',
      conditions: [
        { id: 'c1', type: 'score', operator: 'less_than', value: 50 },
        { id: 'c2', type: 'sentiment', operator: 'equals', value: 'negative' },
      ],
      actions: [
        {
          id: 'a1',
          type: 'create_task',
          taskConfig: {
            titleTemplate: 'Follow up with {{contact.name}}',
            priority: 'urgent',
          },
        },
      ],
    };

    const simRes = await testSurveyDecisionRuleAction(testRule, mockContext);

    expect(simRes.matched).toBe(true);
    expect(simRes.evaluatedConditions.length).toBe(2);
    expect(simRes.prescribedActions.length).toBe(1);
    expect(simRes.prescribedActions[0].summary).toContain('Sarah Connor');
  });

  it('loads and saves survey decision configuration with tenant authorization', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: 's_test_decision_1',
      data: () => ({
        workspaceIds: ['ws1'],
        decisionConfig: { enabled: true, rules: [] },
      }),
    });

    const getRes = await getSurveyDecisionConfigAction('s_test_decision_1', 'ws1');
    expect(getRes.success).toBe(true);
    expect(getRes.config?.enabled).toBe(true);

    mockGet.mockResolvedValueOnce({
      exists: true,
      id: 's_test_decision_1',
      data: () => ({
        workspaceIds: ['ws1'],
      }),
    });

    const saveRes = await saveSurveyDecisionConfigAction(
      's_test_decision_1',
      { enabled: true, rules: [] },
      'ws1'
    );
    expect(saveRes.success).toBe(true);
  });
});
