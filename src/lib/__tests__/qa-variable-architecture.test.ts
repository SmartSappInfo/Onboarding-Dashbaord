import { describe, it, expect } from 'vitest';
import { STATIC_VARIABLES } from '../template-variable-registry-data';
import { resolveStaticVariableGroup, PLATFORM_FIELD_GROUPS, INDUSTRY_FIELD_REGISTRY } from '../industry-field-registry';
import { validateTemplateVariables, DEPRECATED_VARIABLES_MAP } from '../template-validator';
import type { MessageTemplate, VariableDefinition } from '../types';

describe('QA Full Regression: Variable Architecture & Diagnostics', () => {
  describe('1. Real-World User Email Templates Validation', () => {
    // Construct standard variable registry available in a workspace
    const baseVariables: VariableDefinition[] = STATIC_VARIABLES.map(v => ({
      id: v.id,
      key: v.name,
      label: v.label,
      category: v.context === 'common' ? 'common' : v.context,
      source: 'static',
      entity: 'system',
      path: v.name,
      type: v.dataType,
    }));

    it('validates Meeting Reminder email with {{date}}, {{time}}, {{link}} with 0 typo errors', () => {
      const meetingTemplate: Partial<MessageTemplate> = {
        id: '0XpUf1i8j8sXe8lET5q3',
        name: 'Meeting Reminder (Email)',
        templateType: 'meeting_reminder_email',
        category: 'meetings',
        channel: 'email',
        scope: 'organization',
        subject: 'Reminder: Upcoming Session on {{date}} at {{time}}',
        body: 'Hello {{contact_name}},\n\nThis is a reminder for your meeting scheduled on {{date}} at {{time}}.\nJoin here: {{link}}\n\nBest,\n{{entity_name}}',
        styleId: 'styled-corporate',
      };

      const errors = validateTemplateVariables(meetingTemplate, baseVariables);

      // Verify no typo errors for date, time, link
      const typoErrors = errors.filter(e => e.type === 'error' && (e.variable === 'date' || e.variable === 'time' || e.variable === 'link'));
      expect(typoErrors).toHaveLength(0);
    });

    it('validates SmartSapp Service Agreement with {{agreement_url}} with 0 typo errors', () => {
      const agreementTemplate: Partial<MessageTemplate> = {
        id: '1mVndmzuvpRx42mb6WoP',
        name: '[Contract-New] SmartSapp Service Agreement',
        templateType: 'contract_new_smartsapp_service_agreement',
        category: 'agreements',
        channel: 'sms',
        scope: 'organization',
        subject: 'Your Service Agreement is Ready',
        body: 'Hi {{contact_name}}, please review and sign your service agreement here: {{agreement_url}}.',
      };

      const errors = validateTemplateVariables(agreementTemplate, baseVariables);

      const agreementErrors = errors.filter(e => e.variable === 'agreement_url');
      expect(agreementErrors).toHaveLength(0);
    });

    it('validates WhatsApp templates with numeric positional placeholders ({{1}}, {{2}})', () => {
      const waTemplate: Partial<MessageTemplate> = {
        id: 'wa_123',
        name: 'WhatsApp Status Notification',
        templateType: 'wa_status_update',
        category: 'general',
        channel: 'whatsapp',
        scope: 'organization',
        subject: 'WhatsApp notification',
        body: 'Hello {{1}}, your order {{2}} has been confirmed.',
      };

      const errors = validateTemplateVariables(waTemplate, baseVariables);
      const numericErrors = errors.filter(e => e.variable === '1' || e.variable === '2');
      expect(numericErrors).toHaveLength(0);
    });

    it('validates dynamic survey question tokens (q_*, question_*, custom_*) without typo errors', () => {
      const surveyTemplate: Partial<MessageTemplate> = {
        id: 'survey_followup_1',
        name: 'Survey Followup',
        templateType: 'survey_response_email',
        category: 'surveys',
        channel: 'email',
        scope: 'organization',
        subject: 'Survey feedback received',
        body: 'Thank you {{contact_name}}! You answered {{q_feedback_rating}} for rating and {{question_comments}} for comments. Reference: {{custom_ref_id}}',
        styleId: 'styled-corporate',
      };

      const errors = validateTemplateVariables(surveyTemplate, baseVariables);
      const questionErrors = errors.filter(e => 
        e.variable === 'q_feedback_rating' || 
        e.variable === 'question_comments' || 
        e.variable === 'custom_ref_id'
      );
      expect(questionErrors).toHaveLength(0);
    });

    it('flags structural compliance issues with dedicated isCompliance flag and titles', () => {
      const nonCompliantEmail: Partial<MessageTemplate> = {
        id: 'email_no_footer',
        name: 'Marketing Promo',
        templateType: 'promo_email',
        category: 'campaigns',
        channel: 'email',
        scope: 'organization',
        subject: 'Special Offer',
        body: 'Hi {{contact_name}}, check out our new offerings.', // Missing footer block when styleId is none
        styleId: 'none',
      };

      const errors = validateTemplateVariables(nonCompliantEmail, baseVariables);
      const complianceError = errors.find(e => e.isCompliance === true);
      expect(complianceError).toBeDefined();
      expect(complianceError?.complianceTitle).toBe('Missing Copyright Footer');
      expect(complianceError?.type).toBe('error');
    });
  });

  describe('2. Canonical Group Resolution for all STATIC_VARIABLES', () => {
    it('every variable in STATIC_VARIABLES maps to a valid group contract', () => {
      STATIC_VARIABLES.forEach(v => {
        const group = resolveStaticVariableGroup(v.name, v.context);
        expect(group.groupId).toBeTruthy();
        expect(group.groupName).toBeTruthy();
        expect(group.groupSlug).toBeTruthy();
        expect(typeof group.groupOrder).toBe('number');
        expect(group.groupIcon).toBeTruthy();
      });
    });

    it('handles unexpected, empty, or un-trimmed variable names gracefully', () => {
      const fallback = resolveStaticVariableGroup('', undefined);
      expect(fallback.groupId).toBe('entity_details');
      expect(fallback.groupName).toBe('General Identity');

      const upperMeeting = resolveStaticVariableGroup('MEETING_LINK', 'MEETINGS');
      expect(upperMeeting.groupId).toBe('meetings');
      expect(upperMeeting.groupName).toBe('Meetings & Webinars');
    });

    it('has globally unique IDs across all STATIC_VARIABLES', () => {
      const seenIds = new Set<string>();
      const duplicates: string[] = [];
      STATIC_VARIABLES.forEach(v => {
        if (seenIds.has(v.id)) {
          duplicates.push(v.id);
        }
        seenIds.add(v.id);
      });
      expect(duplicates).toEqual([]);
    });

    it('has unique variable names within each context in STATIC_VARIABLES', () => {
      const contextKeyMap = new Map<string, Set<string>>();
      const duplicates: string[] = [];
      STATIC_VARIABLES.forEach(v => {
        const keys = contextKeyMap.get(v.context) || new Set<string>();
        if (keys.has(v.name)) {
          duplicates.push(`${v.context}:${v.name}`);
        }
        keys.add(v.name);
        contextKeyMap.set(v.context, keys);
      });
      expect(duplicates).toEqual([]);
    });

    it('has unique variable names across all PLATFORM_FIELD_GROUPS', () => {
      const seenVars = new Set<string>();
      const duplicates: string[] = [];
      PLATFORM_FIELD_GROUPS.forEach(group => {
        group.fields.forEach(field => {
          if (seenVars.has(field.variableName)) {
            duplicates.push(`${group.slug}:${field.variableName}`);
          }
          seenVars.add(field.variableName);
        });
      });
      expect(duplicates).toEqual([]);
    });

    it('correctly routes lifecycle vs ownership variables in resolveStaticVariableGroup', () => {
      const stageGroup = resolveStaticVariableGroup('new_stage', 'entity');
      expect(stageGroup.groupId).toBe('entity_lifecycle');

      const statusGroup = resolveStaticVariableGroup('old_status', 'entity');
      expect(statusGroup.groupId).toBe('entity_lifecycle');

      const assignedGroup = resolveStaticVariableGroup('assigned_to', 'entity');
      expect(assignedGroup.groupId).toBe('account_ownership');

      const assignerGroup = resolveStaticVariableGroup('assigner_name', 'entity');
      expect(assignerGroup.groupId).toBe('account_ownership');
    });

    it('uses seat_capacity in SaaS vertical to prevent collision with billing capacity', () => {
      const saasGroup = INDUSTRY_FIELD_REGISTRY.SaaS.find(g => g.slug === 'saas_operations');
      const capacityField = saasGroup?.fields.find(f => f.variableName === 'seat_capacity');
      expect(capacityField).toBeDefined();

      const collidingField = saasGroup?.fields.find(f => f.variableName === 'capacity');
      expect(collidingField).toBeUndefined();
    });
  });

  describe('3. Reserved System Variable Collision Set', () => {
    const RESERVED_NAMES = new Set([
      ...STATIC_VARIABLES.map(v => v.name.toLowerCase()),
      ...Object.keys(DEPRECATED_VARIABLES_MAP).map(k => k.toLowerCase())
    ]);

    it('protects core system variables against custom field collisions', () => {
      const prohibitedKeys = [
        'meeting_link',
        'meeting_date',
        'agreement_url',
        'contract_link',
        'contact_name',
        'contact_email',
        'contact_phone',
        'entity_name',
        'survey_link',
        'date',
        'time',
        'link',
      ];

      prohibitedKeys.forEach(k => {
        expect(RESERVED_NAMES.has(k.toLowerCase().trim())).toBe(true);
      });
    });

    it('permits valid custom variable names', () => {
      const customKeys = [
        'custom_student_grade',
        'loan_application_id',
        'patient_medical_record',
        'deal_probability_rate',
      ];

      customKeys.forEach(k => {
        expect(RESERVED_NAMES.has(k.toLowerCase().trim())).toBe(false);
      });
    });
  });

  describe('4. Symmetrical Bidirectional Alias Interpolation Logic', () => {
    function resolveAliases(valuesMap: Map<string, unknown>): Map<string, unknown> {
      // Step 10 logic from FieldsVariablesService
      if (!valuesMap.has('date') && valuesMap.has('meeting_date')) {
        valuesMap.set('date', valuesMap.get('meeting_date') ?? '');
      } else if (!valuesMap.has('meeting_date') && valuesMap.has('date')) {
        valuesMap.set('meeting_date', valuesMap.get('date') ?? '');
      }

      if (!valuesMap.has('time') && valuesMap.has('meeting_time')) {
        valuesMap.set('time', valuesMap.get('meeting_time') ?? '');
      } else if (!valuesMap.has('meeting_time') && valuesMap.has('time')) {
        valuesMap.set('meeting_time', valuesMap.get('time') ?? '');
      }

      if (!valuesMap.has('link') && valuesMap.has('meeting_link')) {
        valuesMap.set('link', valuesMap.get('meeting_link') ?? '');
      } else if (!valuesMap.has('meeting_link') && valuesMap.has('link')) {
        valuesMap.set('meeting_link', valuesMap.get('link') ?? '');
      }

      if (!valuesMap.has('agreement_url') && valuesMap.has('contract_link')) {
        valuesMap.set('agreement_url', valuesMap.get('contract_link') ?? '');
      } else if (!valuesMap.has('contract_link') && valuesMap.has('agreement_url')) {
        valuesMap.set('contract_link', valuesMap.get('agreement_url') ?? '');
      }

      if (!valuesMap.has('agreement_name') && valuesMap.has('contract_name')) {
        valuesMap.set('agreement_name', valuesMap.get('contract_name') ?? '');
      } else if (!valuesMap.has('contract_name') && valuesMap.has('agreement_name')) {
        valuesMap.set('contract_name', valuesMap.get('agreement_name') ?? '');
      }

      if (!valuesMap.has('agreement_status') && valuesMap.has('contract_status')) {
        valuesMap.set('agreement_status', valuesMap.get('contract_status') ?? '');
      } else if (!valuesMap.has('contract_status') && valuesMap.has('agreement_status')) {
        valuesMap.set('contract_status', valuesMap.get('agreement_status') ?? '');
      }

      return valuesMap;
    }

    it('resolves date <-> meeting_date bidirectionally', () => {
      const map1 = new Map<string, unknown>([['meeting_date', '2026-10-15']]);
      resolveAliases(map1);
      expect(map1.get('date')).toBe('2026-10-15');

      const map2 = new Map<string, unknown>([['date', '2026-10-15']]);
      resolveAliases(map2);
      expect(map2.get('meeting_date')).toBe('2026-10-15');
    });

    it('resolves agreement_url <-> contract_link bidirectionally', () => {
      const map1 = new Map<string, unknown>([['contract_link', 'https://smartsapp.com/sign/123']]);
      resolveAliases(map1);
      expect(map1.get('agreement_url')).toBe('https://smartsapp.com/sign/123');

      const map2 = new Map<string, unknown>([['agreement_url', 'https://smartsapp.com/sign/123']]);
      resolveAliases(map2);
      expect(map2.get('contract_link')).toBe('https://smartsapp.com/sign/123');
    });

    it('preserves falsy non-null values with nullish coalescing', () => {
      const map = new Map<string, unknown>([['meeting_date', 0]]);
      resolveAliases(map);
      expect(map.get('date')).toBe(0);
    });
  });

  describe('5. Unified Variable Selector (<VariablesPanel>) & Runtime Resolution Alignment', () => {
    it('guarantees zero recipient_* variables in STATIC_VARIABLES', () => {
      const recipientVars = STATIC_VARIABLES.filter(v => v.name.startsWith('recipient_') || v.id.startsWith('recipient_'));
      expect(recipientVars).toHaveLength(0);
    });

    it('guarantees canonical first_name and contact_role exist in STATIC_VARIABLES', () => {
      const firstNameVar = STATIC_VARIABLES.find(v => v.name === 'first_name');
      expect(firstNameVar).toBeDefined();
      expect(firstNameVar?.context).toBe('common');

      const contactRoleVar = STATIC_VARIABLES.find(v => v.name === 'contact_role');
      expect(contactRoleVar).toBeDefined();
      expect(contactRoleVar?.context).toBe('common');
    });

    it('guarantees all survey static variables route to Surveys & Feedback group in resolveStaticVariableGroup', () => {
      const surveyVars = STATIC_VARIABLES.filter(v => v.context === 'survey');
      expect(surveyVars.length).toBeGreaterThan(0);

      surveyVars.forEach(sv => {
        const group = resolveStaticVariableGroup(sv.name, sv.context);
        expect(group.groupId).toBe('surveys');
        expect(group.groupName).toBe('Surveys & Feedback');
        expect(group.groupOrder).toBe(52);
      });
    });

    it('resolves first_name, user-defined fallbacks, and legacy recipient_* aliases in resolveTextWithMap', async () => {
      const { resolveTextWithMap } = await import('../utils/variable-replacer');

      const valuesMap = new Map<string, unknown>([
        ['contact_name', 'Sarah Connor'],
        ['first_name', 'Sarah'],
        ['entity_name', 'Cyberdyne Systems'],
      ]);

      // 1. Canonical first_name resolution
      expect(resolveTextWithMap('Hello {{first_name}}!', valuesMap, false)).toBe('Hello Sarah!');

      // 2. User-defined inline fallback
      expect(resolveTextWithMap('Hi {{unknown_var|Friend}}!', valuesMap, false)).toBe('Hi Friend!');

      // 3. User-defined inline fallback with whitespace
      expect(resolveTextWithMap('Hi {{ unknown_var | Valued Member }}!', valuesMap, false)).toBe('Hi Valued Member!');

      // 4. Legacy recipient_* fallback alias resolution
      expect(resolveTextWithMap('Recipient: {{recipient_name}} ({{recipient_first_name}})', valuesMap, false)).toBe('Recipient: Sarah Connor (Sarah)');
    });

    it('normalizes multi-query url strings in resolveTextWithMap', async () => {
      const { resolveTextWithMap } = await import('../utils/variable-replacer');

      const valuesMap = new Map<string, unknown>([
        ['link', 'https://smartsapp.com/booking?team=1'],
        ['ref_token', 'enc123'],
      ]);

      const rendered = resolveTextWithMap('{{link}}?ref={{ref_token}}', valuesMap, false);
      expect(rendered).toBe('https://smartsapp.com/booking?team=1&ref=enc123');
    });

    it('renderTemplate in template-utils delegates cleanly to resolveTextWithMap', async () => {
      const { renderTemplate } = await import('../template-utils');

      const rendered = renderTemplate('Hi {{first_name|there}}, welcome to {{entity_name}}!', {
        entity_name: 'SmartSapp',
      });
      expect(rendered).toBe('Hi there, welcome to SmartSapp!');
    });
  });
});
