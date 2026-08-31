import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SurveyMessagingContextInputSchema,
  GeneratedEmailTemplateSchema,
  GeneratedSmsTemplateSchema,
  GeneratedWhatsappTemplateSchema,
  GenerateSurveyMessagingOutputSchema,
  type SurveyMessagingContextInput,
  type GenerateSurveyMessagingOutput,
} from '../schemas/survey-messaging-schemas';
import { generateSurveyMessagingFlow } from '../flows/generate-survey-messaging-flow';

vi.mock('@/ai/genkit', () => ({
  ai: {
    defineFlow: (_meta: unknown, fn: unknown) => fn,
  },
  getModel: vi.fn().mockResolvedValue({
    modelString: 'anthropic/claude-3-5-sonnet',
    customAi: {
      generate: vi.fn().mockResolvedValue({
        output: {
          email: {
            name: 'Assessment Passed - Confirmation',
            subject: 'Congratulations! Your Assessment Results ({{survey_score}}%)',
            body: 'Hi {{contact_name}}, you passed the assessment with a score of {{survey_score}}%.',
            blocks: [
              { id: 'blk_1', type: 'heading', title: 'Great Job!', variant: 'h1' },
              { id: 'blk_2', type: 'text', content: 'You have qualified with {{survey_score}}%.' },
              { id: 'blk_3', type: 'button', title: 'View Full Report', link: '{{result_url}}' },
            ],
            explanation: 'Celebratory layout with score highlight.',
          },
          sms: {
            name: 'Assessment Passed SMS',
            body: 'Hi {{contact_name}}, congrats on scoring {{survey_score}}%! View results: {{result_url}}',
            explanation: 'Concise SMS copy under 160 chars.',
          },
          whatsapp: {
            name: 'assessment_passed_v1',
            body: 'Hi {{1}}, congratulations! You scored {{2}}% on your assessment. View report: {{3}}',
            bodyParams: ['John Doe', '92', 'https://app.smartsapp.com/result/123'],
            whatsappCategory: 'UTILITY',
            header: 'Assessment Results',
            footer: 'SmartSapp Admissions',
            explanation: 'Meta-compliant utility template.',
          },
          overallSummary: 'Generated 3 channel templates for qualified respondents.',
        } satisfies GenerateSurveyMessagingOutput,
      }),
    },
  }),
}));

describe('AI Survey Messaging Schemas & Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Schema Validation', () => {
    it('validates SurveyMessagingContextInputSchema for respondent outcome', () => {
      const input: SurveyMessagingContextInput = {
        surveyTitle: 'School Readiness Assessment 2026',
        surveyDescription: 'Evaluates curriculum and infrastructure readiness',
        target: 'respondent_outcome',
        channels: ['email', 'sms', 'whatsapp'],
        scoringEnabled: true,
        maxScore: 100,
        outcomeRule: {
          ruleId: 'rule_admitted',
          label: 'Admitted / Fully Qualified',
          minScore: 80,
          maxScore: 100,
          pageTitle: 'Congratulations!',
          pageContentSummary: 'You met all key criteria for immediate enrollment.',
        },
        keyQuestions: [
          { id: 'q_1', title: 'Total Student Enrollment', type: 'multiple-choice' },
          { id: 'q_2', title: 'Curriculum Standards Met', type: 'yes-no' },
        ],
        availableVariables: ['contact_name', 'school_name', 'survey_score', 'outcome_label', 'result_url'],
      };

      const parsed = SurveyMessagingContextInputSchema.parse(input);
      expect(parsed.surveyTitle).toBe('School Readiness Assessment 2026');
      expect(parsed.target).toBe('respondent_outcome');
      expect(parsed.outcomeRule?.minScore).toBe(80);
    });

    it('validates SurveyMessagingContextInputSchema for internal team alerts', () => {
      const input: SurveyMessagingContextInput = {
        surveyTitle: 'Enterprise Lead Capture',
        target: 'internal_team_alert',
        channels: ['email', 'sms'],
        scoringEnabled: true,
        availableVariables: ['school_name', 'contact_name', 'contact_email', 'contact_phone', 'survey_score'],
      };

      const parsed = SurveyMessagingContextInputSchema.parse(input);
      expect(parsed.target).toBe('internal_team_alert');
      expect(parsed.channels).toHaveLength(2);
    });

    it('validates GeneratedEmailTemplateSchema with structured blocks', () => {
      const email = {
        name: 'Outcome - Qualified Confirmation',
        subject: 'Your Assessment Results - {{survey_score}}%',
        body: 'Plain text fallback',
        blocks: [
          { id: 'b_1', type: 'heading' as const, title: 'Welcome', variant: 'h2' as const },
          { id: 'b_2', type: 'text' as const, content: 'Thank you {{contact_name}}.' },
        ],
      };

      const parsed = GeneratedEmailTemplateSchema.parse(email);
      expect(parsed.blocks).toHaveLength(2);
      expect(parsed.blocks[0].type).toBe('heading');
    });

    it('validates GeneratedWhatsappTemplateSchema with positional placeholders and bodyParams', () => {
      const whatsapp = {
        name: 'outcome_alert_v1',
        body: 'Hello {{1}}, your score is {{2}}%.',
        bodyParams: ['Ama', '88'],
        whatsappCategory: 'UTILITY' as const,
        header: 'Survey Results',
      };

      const parsed = GeneratedWhatsappTemplateSchema.parse(whatsapp);
      expect(parsed.bodyParams).toEqual(['Ama', '88']);
      expect(parsed.whatsappCategory).toBe('UTILITY');
    });
  });

  describe('generateSurveyMessagingFlow Execution', () => {
    it('executes flow and returns multi-channel templates', async () => {
      const input: SurveyMessagingContextInput = {
        surveyTitle: 'Math Placement Exam',
        target: 'respondent_outcome',
        channels: ['email', 'sms', 'whatsapp'],
        scoringEnabled: true,
        maxScore: 100,
        outcomeRule: {
          label: 'Advanced Placement',
          minScore: 90,
          maxScore: 100,
        },
      };

      const result = await generateSurveyMessagingFlow(input);
      expect(result.email?.subject).toContain('Congratulations');
      expect(result.sms?.body).toContain('{{survey_score}}');
      expect(result.whatsapp?.bodyParams).toHaveLength(3);
    });
  });
});
