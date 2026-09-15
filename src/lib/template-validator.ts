import type { MessageTemplate, VariableDefinition } from './types';
import { STATIC_VARIABLES } from './template-variable-registry-data';

export interface ValidationFixAction {
  label: string;
  description?: string;
  actionType: 
    | 'add_footer_block' 
    | 'remove_footer_block' 
    | 'add_unsubscribe_link' 
    | 'replace_variable' 
    | 'remove_variable';
  targetVariable?: string;
  suggestedVariable?: string;
}

export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  variable: string;
  fixAction?: ValidationFixAction;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function findClosestMatch(target: string, candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  let bestMatch: string | null = null;
  let minDistance = Infinity;

  for (const candidate of candidates) {
    const dist = levenshteinDistance(target.toLowerCase(), candidate.toLowerCase());
    const maxAllowed = Math.max(2, Math.floor(candidate.length * 0.4));
    if (dist <= maxAllowed && dist < minDistance) {
      minDistance = dist;
      bestMatch = candidate;
    }
  }

  return bestMatch;
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
          fixAction: {
            label: 'Remove Footer Block',
            description: 'Removes duplicate footer block so the style wrapper handles footer styling.',
            actionType: 'remove_footer_block',
            targetVariable: 'footer',
          },
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
          fixAction: {
            label: 'Add Footer Block',
            description: 'Inserts a branded Copyright Info Footer block.',
            actionType: 'add_footer_block',
            targetVariable: 'footer',
          },
        });
      }

      // Check for unsubscribe variable token
      const content = `${template.subject || ''} ${template.previewText || ''} ${template.body || ''} ${JSON.stringify(template.blocks || [])}`;
      const hasUnsubscribe = /\{\{\s*unsubscribe_link(?:\s*\|[^{}]*)?\s*\}\}/.test(content);
      if (!hasUnsubscribe) {
        errors.push({
          type: 'error',
          variable: 'unsubscribe_link',
          message: 'No style wrapper is selected. You must include the "{{unsubscribe_link}}" variable to allow recipients to opt out.',
          fixAction: {
            label: 'Add Unsubscribe Link',
            description: 'Appends opt-out link token into the footer or body.',
            actionType: 'add_unsubscribe_link',
            targetVariable: 'unsubscribe_link',
          },
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
  const candidateList = Array.from(validKeys);

  for (const rawVarName of detected) {
    const varName = rawVarName.split('|')[0].trim();

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

      // Context compatibility mapping (plural category -> allowed singular contexts)
      const contextMap: Record<string, string[]> = {
        meetings: ['meeting', 'meetings'],
        surveys: ['survey', 'surveys', 'form', 'forms'], // surveys can access form context vars too
        forms: ['form', 'forms'],
        agreements: ['agreement', 'agreements'],
        general: []
      };

      const allowedContexts = contextMap[template.category || 'general'] || [];
      if (allowedContexts.includes(existsElsewhere.context)) {
        continue;
      }

      errors.push({
        type: 'warning',
        variable: rawVarName,
        message: `Variable "{{${rawVarName}}}" belongs to the "${existsElsewhere.context}" context and might not resolve in this "${template.category || 'general'}" template.`,
        fixAction: {
          label: `Remove {{${rawVarName}}}`,
          actionType: 'remove_variable',
          targetVariable: rawVarName,
        },
      });
    } else {
      // 4. Flat out typo / unknown variable (error)
      const closest = findClosestMatch(varName, candidateList);
      if (closest) {
        errors.push({
          type: 'error',
          variable: rawVarName,
          message: `Variable "{{${rawVarName}}}" is invalid or does not exist. Did you mean "{{${closest}}}"?`,
          fixAction: {
            label: `Change to {{${closest}}}`,
            actionType: 'replace_variable',
            targetVariable: rawVarName,
            suggestedVariable: closest,
          },
        });
      } else {
        errors.push({
          type: 'error',
          variable: rawVarName,
          message: `Variable "{{${rawVarName}}}" is invalid or does not exist. Check for typos.`,
          fixAction: {
            label: `Remove {{${rawVarName}}}`,
            actionType: 'remove_variable',
            targetVariable: rawVarName,
          },
        });
      }
    }
  }

  return errors;
}
