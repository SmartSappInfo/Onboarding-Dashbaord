import { describe, it, expect } from 'vitest';
import { validateTemplateVariables } from '../template-validator';
import type { VariableDefinition } from '../types';

describe('validateTemplateVariables', () => {
  const mockValidVariables: VariableDefinition[] = [
    {
      id: 'meeting_title',
      key: 'meeting_title',
      name: 'meeting_title',
      label: 'Meeting Title',
      category: 'meetings',
      dataType: 'string',
    } as any,
    {
      id: 'survey_title',
      key: 'survey_title',
      name: 'survey_title',
      label: 'Survey Title',
      category: 'surveys',
      dataType: 'string',
    } as any,
    {
      id: 'app_name',
      key: 'app_name',
      name: 'app_name',
      label: 'Application Name',
      category: 'common',
      dataType: 'string',
    } as any,
  ];

  it('should identify valid variables correctly', () => {
    const template = {
      category: 'meetings' as const,
      subject: 'Welcome to {{meeting_title}} on {{app_name}}',
      body: 'Please complete the survey at {{survey_title}}', // Note: category mismatch warning
    };

    const errors = validateTemplateVariables(
      template,
      mockValidVariables.filter(v => v.category === 'meetings' || v.category === 'common')
    );
    
    // meeting_title and app_name are in the context or common, so no errors or warnings for them
    // survey_title belongs to "surveys" category, not "meetings" or "common", so it should trigger a context warning
    const warnings = errors.filter(e => e.type === 'warning');
    const typos = errors.filter(e => e.type === 'error');

    expect(typos).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].variable).toBe('survey_title');
    expect(warnings[0].message).toContain('context');
  });

  it('should identify typo errors correctly', () => {
    const template = {
      category: 'meetings' as const,
      subject: 'Reminder: {{meeting_titel}} is starting',
    };

    const errors = validateTemplateVariables(template, mockValidVariables);
    const typos = errors.filter(e => e.type === 'error');

    expect(typos).toHaveLength(1);
    expect(typos[0].variable).toBe('meeting_titel');
    expect(typos[0].message).toContain('invalid or does not exist');
  });

  it('should bypass dynamic contact role variables', () => {
    const template = {
      category: 'general' as const,
      subject: 'Message for {{contact_name_participant}}',
      body: 'Signatory email is {{contact_email_signatory}}, phone is {{contact_phone_primary}}',
    };

    const errors = validateTemplateVariables(template, []);
    
    // Dynamic contact roles starting with contact_name_ etc. should be skipped
    expect(errors).toHaveLength(0);
  });

  it('should bypass dynamic registration, form, and survey submission fields', () => {
    const template = {
      category: 'general' as const,
      subject: 'Form field value is {{form_fields.first_name}}',
      body: 'Registration field {{registration_school_type}} and survey response {{survey_fields.rating}}',
    };

    const errors = validateTemplateVariables(template, []);

    expect(errors).toHaveLength(0);
  });

  it('should return empty errors list for template with no tags', () => {
    const template = {
      category: 'general' as const,
      subject: 'Static Subject Line',
      body: 'Static body message without curly braces.',
    };

    const errors = validateTemplateVariables(template, mockValidVariables);
    expect(errors).toEqual([]);
  });
});
