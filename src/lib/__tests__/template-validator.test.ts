import { describe, it, expect } from 'vitest';
import { validateTemplateVariables } from '../template-validator';
import type { MessageBlock, VariableDefinition } from '../types';

const createMockVariable = (overrides: Partial<VariableDefinition> & { key: string; category: string }): VariableDefinition => ({
  id: overrides.key,
  label: overrides.key,
  source: overrides.category,
  entity: 'test',
  path: overrides.key,
  type: 'string',
  ...overrides,
});

const createMockBlock = (overrides: Partial<MessageBlock> & { type: MessageBlock['type'] }): MessageBlock => ({
  id: `block_${Math.random()}`,
  ...overrides,
});

describe('validateTemplateVariables', () => {
  const mockValidVariables: VariableDefinition[] = [
    createMockVariable({
      id: 'meeting_title',
      key: 'meeting_title',
      label: 'Meeting Title',
      category: 'meetings',
    }),
    createMockVariable({
      id: 'survey_title',
      key: 'survey_title',
      label: 'Survey Title',
      category: 'surveys',
    }),
    createMockVariable({
      id: 'app_name',
      key: 'app_name',
      label: 'Application Name',
      category: 'common',
    }),
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
          createMockBlock({ id: '1', type: 'footer' })
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
          createMockBlock({ id: '1', type: 'footer' })
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
        body: 'All rights reserved. Unsubscribe here: {{unsubscribe_link}}',
        blocks: [],
      };

      const errors = validateTemplateVariables(template, mockValidVariables);
      expect(errors).toEqual([]);
    });

    it('should pass if unsubscribe link includes whitespace and filter pipe', () => {
      const template = {
        channel: 'email' as const,
        styleId: 'none',
        subject: 'Subject Line',
        body: 'All rights reserved. Opt out: {{ unsubscribe_link | default: "" }}',
        blocks: [],
      };

      const errors = validateTemplateVariables(template, mockValidVariables);
      expect(errors).toEqual([]);
    });
  });

  describe('context compatibility mapping', () => {
    it('should allow respondent_name (form context) and completion_date (survey context) in surveys template category', () => {
      const template = {
        category: 'surveys' as const,
        subject: 'Survey Alert',
        body: 'Hello {{respondent_name}}, you completed {{completion_date}} and scored {{score}} with message: {{result_message}}',
        blocks: [],
      };

      // Set up variables registry variables mock
      const vars: VariableDefinition[] = [
        createMockVariable({ key: 'respondent_name', category: 'forms' }),
        createMockVariable({ key: 'completion_date', category: 'surveys' }),
        createMockVariable({ key: 'score', category: 'surveys' }),
        createMockVariable({ key: 'result_message', category: 'surveys' }),
      ];

      const errors = validateTemplateVariables(template, vars);
      expect(errors.filter(e => e.type === 'warning')).toHaveLength(0);
    });
  });

  describe('validation fix actions', () => {
    it('should generate replace_variable fixAction with closest fuzzy match for typo', () => {
      const template = {
        category: 'meetings' as const,
        subject: 'Reminder: {{meeting_titel}} is starting',
      };

      const errors = validateTemplateVariables(template, mockValidVariables);
      const typoError = errors.find(e => e.variable === 'meeting_titel');

      expect(typoError).toBeDefined();
      expect(typoError?.fixAction).toEqual({
        actionType: 'replace_variable',
        targetVariable: 'meeting_titel',
        suggestedVariable: 'meeting_title',
        label: 'Change to {{meeting_title}}',
      });
    });

    it('should generate add_footer_block fixAction when email template lacks footer', () => {
      const template = {
        channel: 'email' as const,
        styleId: 'none',
        subject: 'Welcome',
        body: 'Hello world',
        blocks: [],
      };

      const errors = validateTemplateVariables(template, mockValidVariables);
      const footerError = errors.find(e => e.variable === 'footer');

      expect(footerError).toBeDefined();
      expect(footerError?.fixAction).toEqual({
        actionType: 'add_footer_block',
        targetVariable: 'footer',
        label: 'Add Footer Block',
        description: 'Inserts a branded Copyright Info Footer block.',
      });
    });

    it('should generate add_unsubscribe_link fixAction when email template lacks unsubscribe link', () => {
      const template = {
        channel: 'email' as const,
        styleId: 'none',
        subject: 'Welcome',
        body: 'All rights reserved.',
        blocks: [],
      };

      const errors = validateTemplateVariables(template, mockValidVariables);
      const unsubError = errors.find(e => e.variable === 'unsubscribe_link');

      expect(unsubError).toBeDefined();
      expect(unsubError?.fixAction).toEqual({
        actionType: 'add_unsubscribe_link',
        targetVariable: 'unsubscribe_link',
        label: 'Add Unsubscribe Link',
        description: 'Appends opt-out link token into the footer or body.',
      });
    });
  });
});
