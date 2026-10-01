import { describe, it, expect } from 'vitest';
import {
  cleanRawHtmlTags,
  replaceEntityWithTerminology,
  sanitizeCopyText,
  sanitizeSurveyMessagingOutput,
} from '../survey-messaging-sanitizer';
import type { GenerateSurveyMessagingOutput } from '@/ai/schemas/survey-messaging-schemas';

describe('survey-messaging-sanitizer', () => {
  describe('cleanRawHtmlTags', () => {
    it('converts line breaks (<br>, <br/>, <br />) to newlines', () => {
      const input = 'Line 1<br>Line 2<br/>Line 3<br />Line 4';
      expect(cleanRawHtmlTags(input)).toBe('Line 1\nLine 2\nLine 3\nLine 4');
    });

    it('converts strong and b tags to markdown bold (**...**)', () => {
      const input = '<strong>Respondent:</strong> {{contact_name}}<br><b>Email:</b> {{contact_email}}';
      expect(cleanRawHtmlTags(input)).toBe('**Respondent:** {{contact_name}}\n**Email:** {{contact_email}}');
    });

    it('converts em and i tags to markdown italic (*...*)', () => {
      const input = '<em>Notice:</em> <i>Please review</i>';
      expect(cleanRawHtmlTags(input)).toBe('*Notice:* *Please review*');
    });

    it('strips all other raw HTML tags and decodes entities', () => {
      const input = '<div><p>Hello &amp; welcome <span>team</span>!</p></div>';
      expect(cleanRawHtmlTags(input)).toBe('Hello & welcome team!');
    });

    it('handles empty or null input gracefully', () => {
      expect(cleanRawHtmlTags('')).toBe('');
      expect(cleanRawHtmlTags(null)).toBe('');
      expect(cleanRawHtmlTags(undefined)).toBe('');
    });
  });

  describe('replaceEntityWithTerminology', () => {
    it('replaces "Entity:" with "{terminology}:" in visible text outside variables', () => {
      const input = '**Entity:** {{entity_name}}\nReview this entity in console.';
      const res = replaceEntityWithTerminology(input, { singular: 'Campus', plural: 'Campuses' });
      expect(res).toBe('**Campus:** {{entity_name}}\nReview this campus in console.');
    });

    it('replaces plural "Entities" with plural terminology', () => {
      const input = 'All registered Entities in the workspace.';
      const res = replaceEntityWithTerminology(input, { singular: 'School', plural: 'Schools' });
      expect(res).toBe('All registered Schools in the workspace.');
    });

    it('strictly preserves {{entity_name}}, {{entity_link}}, {{entity_console_link}} tokens intact', () => {
      const input = 'School: {{entity_name}} | Link: {{entity_link}} | Console: {{entity_console_link}}';
      const res = replaceEntityWithTerminology(input, { singular: 'School', plural: 'Schools' });
      expect(res).toBe('School: {{entity_name}} | Link: {{entity_link}} | Console: {{entity_console_link}}');
    });

    it('does not replace "Entity" if the terminology itself is "Entity"', () => {
      const input = '**Entity:** {{entity_name}}';
      const res = replaceEntityWithTerminology(input, { singular: 'Entity', plural: 'Entities' });
      expect(res).toBe('**Entity:** {{entity_name}}');
    });
  });

  describe('sanitizeCopyText', () => {
    it('simulates the exact user screenshot case', () => {
      const input = '<strong>Entity:</strong> {{entity_name}}<br><strong>Survey:</strong> {{survey_name}}<br><strong>Submitted At:</strong> {{submitted_at}}';
      const res = sanitizeCopyText(input, { singular: 'School', plural: 'Schools' });
      expect(res).toBe('**School:** {{entity_name}}\n**Survey:** {{survey_name}}\n**Submitted At:** {{submitted_at}}');
    });

    it('migrates deprecated tokens like school_name to entity_name', () => {
      const input = 'Welcome to {{school_name}}!';
      const res = sanitizeCopyText(input, { singular: 'Campus', plural: 'Campuses' });
      expect(res).toBe('Welcome to {{entity_name}}!');
    });
  });

  describe('sanitizeSurveyMessagingOutput', () => {
    it('deeply sanitizes blocks, email, sms, and whatsapp', () => {
      const raw: GenerateSurveyMessagingOutput = {
        email: {
          name: 'Alert for <strong>Entity</strong>',
          subject: 'New submission for <b>Entity</b>: {{entity_name}}',
          body: '<strong>Entity:</strong> {{entity_name}}<br>Score: 92%',
          blocks: [
            {
              id: 'blk_1',
              type: 'text',
              content: '<strong>Entity:</strong> {{entity_name}}<br><strong>Respondent:</strong> {{contact_name}}',
            },
            {
              id: 'blk_2',
              type: 'heading',
              title: 'Summary for <b>Entity</b>',
            },
          ],
        },
        sms: {
          name: 'SMS Alert',
          body: 'Alert: <b>Entity</b> {{entity_name}} received a new response.<br>Score: 92%',
        },
        whatsapp: {
          name: 'survey_alert_wa',
          whatsappCategory: 'UTILITY',
          header: '<b>Entity</b> Alert',
          body: 'Hello {{1}}, new survey for {{2}}.',
          footer: 'SmartSapp Alerts',
          bodyParams: ['John', 'Acme'],
        },
      };

      const sanitized = sanitizeSurveyMessagingOutput(raw, { singular: 'Campus', plural: 'Campuses' });

      expect(sanitized.email?.name).toBe('Alert for **Campus**');
      expect(sanitized.email?.subject).toBe('New submission for **Campus**: {{entity_name}}');
      expect(sanitized.email?.body).toBe('**Campus:** {{entity_name}}\nScore: 92%');
      expect(sanitized.email?.blocks?.[0].content).toBe('**Campus:** {{entity_name}}\n**Respondent:** {{contact_name}}');
      expect(sanitized.email?.blocks?.[1].title).toBe('Summary for **Campus**');
      expect(sanitized.sms?.body).toBe('Alert: **Campus** {{entity_name}} received a new response.\nScore: 92%');
      expect(sanitized.whatsapp?.header).toBe('**Campus** Alert');
    });
  });
});
