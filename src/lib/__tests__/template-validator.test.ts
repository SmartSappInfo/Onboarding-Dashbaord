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

  describe('Email footer and unsubscribe compliance validation', () => {
    it('should pass if style wrapper is selected and there is no footer block in the body', () => {
      const template = {
        channel: 'email' as const,
        styleId: 'some_style_id',
        subject: 'Valid Subject',
        body: 'Simple body message without footer blocks.',
        blocks: [],
      };

      const errors = validateTemplateVariables(template, mockValidVariables);
      expect(errors).toEqual([]);
    });

    it('should fail if style wrapper is selected but a duplicate footer block is present', () => {
      const template = {
        channel: 'email' as const,
        styleId: 'some_style_id',
        subject: 'Subject Line',
        blocks: [
          { id: '1', type: 'footer' } as any
        ],
      };

      const errors = validateTemplateVariables(template, mockValidVariables);
      const footerErrors = errors.filter(e => e.variable === 'footer');
      expect(footerErrors).toHaveLength(1);
      expect(footerErrors[0].type).toBe('error');
      expect(footerErrors[0].message).toContain('Remove this block to avoid duplicate footers');
    });

    it('should fail if no style wrapper is selected and both footer and unsubscribe are missing', () => {
      const template = {
        channel: 'email' as const,
        styleId: 'none',
        subject: 'Subject Line',
        body: 'Just a plain body',
        blocks: [],
      };

      const errors = validateTemplateVariables(template, mockValidVariables);
      const footerErrors = errors.filter(e => e.variable === 'footer');
      const unsubscribeErrors = errors.filter(e => e.variable === 'unsubscribe_link');

      expect(footerErrors).toHaveLength(1);
      expect(footerErrors[0].message).toContain('You must add a "Copyright Info Footer" block');

      expect(unsubscribeErrors).toHaveLength(1);
      expect(unsubscribeErrors[0].message).toContain('You must include the "{{unsubscribe_link}}"');
    });

    it('should pass if no style wrapper is selected but footer block and unsubscribe link are provided', () => {
      const template = {
        channel: 'email' as const,
        styleId: 'none',
        subject: 'Subject Line',
        body: 'Unsubscribe link here: {{unsubscribe_link}}',
        blocks: [
          { id: '1', type: 'footer' } as any
        ],
      };

      const errors = validateTemplateVariables(template, mockValidVariables);
      expect(errors).toEqual([]);
    });

    it('should pass if no style wrapper is selected but text body contains copyright keywords and unsubscribe link is provided', () => {
      const template = {
        channel: 'email' as const,
        styleId: 'none',
        subject: 'Subject Line',
        body: 'All rights reserved. Unsubscribe here: {{unsubscribe_url}}',
        blocks: [],
      };

      const errors = validateTemplateVariables(template, mockValidVariables);
      expect(errors).toEqual([]);
    });
  });
});
