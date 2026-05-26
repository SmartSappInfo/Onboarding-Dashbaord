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
  // Extract all {{variable}} occurrences from subject, previewText, body, and blocks
  const content = `${template.subject || ''} ${template.previewText || ''} ${template.body || ''} ${JSON.stringify(template.blocks || [])}`;
  const matches = content.match(/\{\{([^{}]+?)\}\}/g);
  if (!matches) return [];

  const detected = [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))];
  const errors: ValidationError[] = [];

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

    if (isDynamicContactRole || isDynamicSubmissionField) {
      continue;
    }

    // 3. Check if it exists elsewhere on the platform (context mismatch warning)
    const existsElsewhere = STATIC_VARIABLES.find(sv => sv.name === varName);
    if (existsElsewhere) {
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
