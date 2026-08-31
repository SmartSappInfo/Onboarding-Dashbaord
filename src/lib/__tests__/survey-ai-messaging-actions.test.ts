import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateSurveyMessagingTemplatesAction,
  quickSaveSurveyTemplateAction,
} from '../survey-ai-messaging-actions';

const { mockAdd, mockUpdate, mockDoc, mockCollection } = vi.hoisted(() => {
  let docIdCounter = 1;
  const add = vi.fn(async (_data: Record<string, unknown>) => ({
    id: `template_doc_${docIdCounter++}`,
    path: `message_templates/template_doc_${docIdCounter}`,
  }));
  const update = vi.fn().mockResolvedValue(true);
  const doc = vi.fn((id: string) => ({
    id,
    path: `message_templates/${id}`,
    update,
  }));
  const collection = vi.fn(() => ({
    add,
    doc,
  }));
  return {
    mockAdd: add,
    mockUpdate: update,
    mockDoc: doc,
    mockCollection: collection,
  };
});

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: mockCollection,
    doc: mockDoc,
  },
}));

vi.mock('@/lib/services/fields-variables-service', () => ({
  getVariablesAction: vi.fn().mockResolvedValue([
    { key: 'contact_name', label: 'Contact Name' },
    { key: 'school_name', label: 'School Name' },
    { key: 'survey_score', label: 'Survey Score' },
    { key: 'outcome_label', label: 'Outcome Label' },
    { key: 'result_url', label: 'Result URL' },
  ]),
}));

vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn().mockResolvedValue({ granted: true }),
}));

vi.mock('@/ai/flows/generate-survey-messaging-flow', () => ({
  generateSurveyMessagingFlow: vi.fn().mockResolvedValue({
    email: {
      name: 'Admissions Outcome - Email',
      subject: 'Your Assessment Result: {{survey_score}}%',
      body: 'Hi {{contact_name}}, you scored {{survey_score}}%.',
      blocks: [
        { id: 'b_1', type: 'heading', title: 'Admissions Decision', variant: 'h1' },
        { id: 'b_2', type: 'text', content: 'You have been admitted with {{survey_score}}%.' },
      ],
      explanation: 'Clear outcome presentation.',
    },
    sms: {
      name: 'Admissions Outcome - SMS',
      body: 'Hi {{contact_name}}, your result is {{survey_score}}%. Details: {{result_url}}',
      explanation: 'Under 160 chars.',
    },
    whatsapp: {
      name: 'admissions_outcome_wa',
      body: 'Hi {{1}}, your score is {{2}}%. View: {{3}}',
      bodyParams: ['John', '95', 'https://link.com'],
      whatsappCategory: 'UTILITY',
    },
  }),
}));

describe('Survey AI Messaging Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSurveyMessagingTemplatesAction', () => {
    it('rejects calls without workspaceId or organizationId', async () => {
      const res = await generateSurveyMessagingTemplatesAction({
        workspaceId: '',
        organizationId: '',
        surveyTitle: 'Test Survey',
        target: 'respondent_outcome',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Workspace and Organization contexts are required.');
    });

    it('generates multi-channel templates and saves them to Firestore message_templates', async () => {
      const res = await generateSurveyMessagingTemplatesAction({
        workspaceId: 'ws_alpha',
        organizationId: 'org_main',
        surveyId: 'survey_123',
        surveyTitle: 'Annual Readiness Assessment',
        target: 'respondent_outcome',
        channels: ['email', 'sms', 'whatsapp'],
        scoringEnabled: true,
        maxScore: 100,
        outcomeRule: {
          ruleId: 'rule_admitted',
          label: 'Admitted',
          minScore: 80,
          maxScore: 100,
        },
        autoSave: true,
      });

      expect(res.success).toBe(true);
      expect(res.output?.email?.subject).toContain('{{survey_score}}');
      expect(res.savedTemplateIds?.emailTemplateId).toBeDefined();
      expect(res.savedTemplateIds?.smsTemplateId).toBeDefined();
      expect(res.savedTemplateIds?.whatsappTemplateId).toBeDefined();

      // Verify Firestore additions
      expect(mockAdd).toHaveBeenCalledTimes(3);
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'surveys',
          channel: 'email',
          recipientType: 'respondent',
          scope: 'organization',
          workspaceIds: ['ws_alpha'],
          organizationId: 'org_main',
        })
      );
    });
  });

  describe('quickSaveSurveyTemplateAction', () => {
    it('creates a new message template doc when templateId is omitted', async () => {
      const res = await quickSaveSurveyTemplateAction({
        workspaceId: 'ws_beta',
        organizationId: 'org_main',
        templateData: {
          name: 'Manual Survey Alert',
          subject: 'New Submission from {{school_name}}',
          body: 'Check lead in CRM: {{contact_name}}',
          channel: 'email',
        },
      });

      expect(res.success).toBe(true);
      expect(res.templateId).toBeDefined();
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Manual Survey Alert',
          category: 'surveys',
          workspaceIds: ['ws_beta'],
        })
      );
    });

    it('updates an existing message template when templateId is provided', async () => {
      const res = await quickSaveSurveyTemplateAction({
        workspaceId: 'ws_beta',
        organizationId: 'org_main',
        templateId: 'existing_tmpl_99',
        templateData: {
          name: 'Updated Survey Alert',
          subject: 'Updated Subject: {{school_name}}',
        },
      });

      expect(res.success).toBe(true);
      expect(res.templateId).toBe('existing_tmpl_99');
      expect(mockDoc).toHaveBeenCalledWith('existing_tmpl_99');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Survey Alert',
          category: 'surveys',
        })
      );
    });
  });
});
