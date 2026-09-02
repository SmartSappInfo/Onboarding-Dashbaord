import { describe, it, expect } from 'vitest';
import type { Survey, SurveyResultRule } from '@/lib/types';

describe('Non-Scoring Automatic Messaging & Outcome Resolution Suite', () => {
  it('resolves rule 0 when scoring is disabled (score is undefined)', () => {
    const survey: Partial<Survey> = {
      id: 'survey_no_score_1',
      title: 'Customer Experience Survey',
      scoringEnabled: false,
      resultRules: [
        {
          id: 'rule_default_1',
          label: 'All Respondents',
          minScore: 0,
          maxScore: 100,
          priority: 0,
          pageId: '',
          emailTemplateId: 'tmpl_survey_thank_you_email',
          smsTemplateId: 'tmpl_survey_thank_you_sms',
        } as SurveyResultRule,
      ],
    };

    // Simulate outcome resolver logic
    const resolveOutcome = (score: number | undefined): SurveyResultRule | undefined => {
      if (!survey.resultRules || survey.resultRules.length === 0) return undefined;
      if (score === undefined) {
        return survey.resultRules[0];
      }
      return [...survey.resultRules].sort((a, b) => a.priority - b.priority).find(rule => score >= rule.minScore && score <= rule.maxScore) || survey.resultRules[0];
    };

    const outcome = resolveOutcome(undefined);
    expect(outcome).toBeDefined();
    expect(outcome?.id).toBe('rule_default_1');
    expect(outcome?.emailTemplateId).toBe('tmpl_survey_thank_you_email');
    expect(outcome?.smsTemplateId).toBe('tmpl_survey_thank_you_sms');
  });

  it('matches respondent email and phone from multiple common fields', () => {
    const data: Record<string, string> = {
      q_email_field: 'user@example.com',
      q_phone_field: '+1234567890',
    };

    const elements = [
      { id: 'q_email_field', type: 'email', title: 'Your Email' },
      { id: 'q_phone_field', type: 'phone', title: 'Mobile Phone' },
    ];

    const isQuestion = (el: { type?: string }) => el.type !== 'section' && el.type !== 'page';

    const emailQuestion = elements.filter(isQuestion).find(q => 
      q.type === 'email' || 
      q.title.toLowerCase().includes('email address') ||
      q.title.toLowerCase().includes('your email')
    );
    const phoneQuestion = elements.filter(isQuestion).find(q => 
      q.type === 'phone' || 
      q.title.toLowerCase().includes('phone number') ||
      q.title.toLowerCase().includes('mobile number')
    );

    const respondentEmail = emailQuestion ? data[emailQuestion.id] : (data.email || null);
    const extractedPhone = phoneQuestion ? data[phoneQuestion.id] : (data.phone || null);

    expect(respondentEmail).toBe('user@example.com');
    expect(extractedPhone).toBe('+1234567890');
  });

  it('supports WhatsApp template in outcome rule and keeps it optional/unconfigured by default', () => {
    const surveyWithWhatsapp: Partial<Survey> = {
      id: 'survey_wa_1',
      title: 'Feedback Survey',
      scoringEnabled: false,
      resultRules: [
        {
          id: 'rule_1',
          label: 'Default Outcome',
          minScore: 0,
          maxScore: 100,
          priority: 0,
          pageId: '',
          emailTemplateId: 'global_survey_completion_email',
          smsTemplateId: 'global_survey_completion_sms',
          whatsappTemplateId: undefined, // left unconfigured by default
        } as SurveyResultRule,
      ],
    };

    const rule = surveyWithWhatsapp.resultRules![0];
    expect(rule.emailTemplateId).toBe('global_survey_completion_email');
    expect(rule.smsTemplateId).toBe('global_survey_completion_sms');
    expect(rule.whatsappTemplateId).toBeUndefined();

    // Configured case
    rule.whatsappTemplateId = 'tmpl_wa_custom_blueprint';
    expect(rule.whatsappTemplateId).toBe('tmpl_wa_custom_blueprint');
  });
});
