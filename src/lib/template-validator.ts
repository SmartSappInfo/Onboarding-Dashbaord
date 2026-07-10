import type { MessageTemplate, VariableDefinition } from './types';
import { STATIC_VARIABLES } from './template-variable-registry-data';

export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  variable: string;
}

/**
 * Validator utility to detect typos and context mismatches in template variables.
 */
export function validateTemplateVariables(
  template: Partial<MessageTemplate>,
  validVariables: VariableDefinition[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Email Channel footer / unsubscribe compliance validation
  if (template.channel === 'email') {
    const hasFooterBlock = template.blocks?.some(b => b.type === 'footer');

    if (template.styleId !== 'none') {
      // Style wrapper is added: MUST NOT have custom footer block inside email body to avoid double footer
      if (hasFooterBlock) {
        errors.push({
          type: 'error',
          variable: 'footer',
          message: 'A style wrapper is selected, but your template also contains a Copyright Info Footer block. Remove this block to avoid duplicate footers in sent emails.',
        });
      }
    } else {
      // No style wrapper is added: MUST have physical address + copyright info, and MUST have unsubscribe link
      const bodyText = template.body?.toLowerCase() || '';
      const blocksJson = JSON.stringify(template.blocks || '').toLowerCase();
      const hasFooterKeywords = 
        bodyText.includes('copyright') || bodyText.includes('all rights reserved') ||
        blocksJson.includes('copyright') || blocksJson.includes('all rights reserved');

      if (!hasFooterBlock && !hasFooterKeywords) {
        errors.push({
          type: 'error',
          variable: 'footer',
          message: 'No style wrapper is selected. You must add a "Copyright Info Footer" block or include physical address and copyright details in the email body.',
        });
      }

      // Check for unsubscribe variable token
      const content = `${template.subject || ''} ${template.previewText || ''} ${template.body || ''} ${JSON.stringify(template.blocks || [])}`;
      const hasUnsubscribe = content.includes('{{unsubscribe_link}}') || content.includes('{{unsubscribe_url}}');
      if (!hasUnsubscribe) {
        errors.push({
          type: 'error',
          variable: 'unsubscribe_link',
          message: 'No style wrapper is selected. You must include the "{{unsubscribe_link}}" or "{{unsubscribe_url}}" variable to allow recipients to opt out.',
        });
      }
    }
  }

  // Extract all {{variable}} occurrences from subject, previewText, body, and blocks
  const content = `${template.subject || ''} ${template.previewText || ''} ${template.body || ''} ${JSON.stringify(template.blocks || [])}`;
  const matches = content.match(/\{\{([^{}]+?)\}\}/g);
  if (!matches) return errors;

  const detected = [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))];

  const validKeys = new Set(validVariables.map(v => v.key));

  for (const varName of detected) {
    // 1. Check if directly valid in current context
    if (validKeys.has(varName)) continue;

    // 2. Check dynamic rules (like custom registration fields or dynamic contact roles)
    const isDynamicContactRole = 
      varName.startsWith('contact_name_') || 
      varName.startsWith('contact_email_') || 
      varName.startsWith('contact_phone_') || 
      varName.startsWith('contact_role_') || 
      varName.startsWith('contact_isSignatory_') || 
      varName.startsWith('contact_isPrimary_');

    const isDynamicSubmissionField = 
      varName.startsWith('registration_') || 
      varName.startsWith('form_fields.') || 
      varName.startsWith('survey_fields.');

    const isSystemVariable = varName === 'encrypted_recipient_token';

    if (isDynamicContactRole || isDynamicSubmissionField || isSystemVariable) {
      continue;
    }

    // 3. Check if it exists elsewhere on the platform (context mismatch warning)
    const existsElsewhere = STATIC_VARIABLES.find(sv => sv.name === varName);
    if (existsElsewhere) {
      if (existsElsewhere.context === 'common') {
        continue;
      }
      errors.push({
        type: 'warning',
        variable: varName,
        message: `Variable "{{${varName}}}" belongs to the "${existsElsewhere.context}" context and might not resolve in this "${template.category || 'general'}" template.`,
      });
    } else {
      // 4. Flat out typo / unknown variable (error)
      errors.push({
        type: 'error',
        variable: varName,
        message: `Variable "{{${varName}}}" is invalid or does not exist. Check for typos.`,
      });
    }
  }

  return errors;
}
