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
  isCompliance?: boolean;
  complianceTitle?: string;
  fixAction?: ValidationFixAction;
}

/**
 * Standard registry of deprecated variable tokens across the system,
 * mapping each deprecated token to its canonical snake_case replacement.
 */
export const DEPRECATED_VARIABLES_MAP: Record<string, { replacement: string; reason: string }> = {
  recipient_name: { replacement: 'contact_name', reason: 'Deprecated: Use canonical contact_name instead' },
  recipient_email: { replacement: 'contact_email', reason: 'Deprecated: Use canonical contact_email instead' },
  recipient_phone: { replacement: 'contact_phone', reason: 'Deprecated: Use canonical contact_phone instead' },
  recipient_role: { replacement: 'contact_role', reason: 'Deprecated: Use canonical contact_role instead' },
  recipient_first_name: { replacement: 'first_name', reason: 'Deprecated: Use canonical first_name instead' },
  CURRENT_CONTACT_NAME: { replacement: 'contact_name', reason: 'Deprecated: Use lowercase canonical contact_name' },
  CURRENT_CONTACT_EMAIL: { replacement: 'contact_email', reason: 'Deprecated: Use lowercase canonical contact_email' },
  CURRENT_CONTACT_PHONE: { replacement: 'contact_phone', reason: 'Deprecated: Use lowercase canonical contact_phone' },
  FIRST_NAME: { replacement: 'first_name', reason: 'Deprecated: Use lowercase canonical first_name' },
  org_name: { replacement: 'organization_name', reason: 'Deprecated: Use canonical organization_name' },
  billingAddress: { replacement: 'billing_address', reason: 'Deprecated: Use canonical snake_case billing_address' },
  subscriptionPackageId: { replacement: 'subscription_package_id', reason: 'Deprecated: Use canonical snake_case subscription_package_id' },
  discountPercentage: { replacement: 'discount_percentage', reason: 'Deprecated: Use canonical snake_case discount_percentage' },
  subscriptionRate: { replacement: 'subscription_rate', reason: 'Deprecated: Use canonical snake_case subscription_rate' },
  arrearsBalance: { replacement: 'arrears_balance', reason: 'Deprecated: Use canonical snake_case arrears_balance' },
  creditBalance: { replacement: 'credit_balance', reason: 'Deprecated: Use canonical snake_case credit_balance' },
  currentNeeds: { replacement: 'current_needs', reason: 'Deprecated: Use canonical snake_case current_needs' },
  currentChallenges: { replacement: 'current_challenges', reason: 'Deprecated: Use canonical snake_case current_challenges' },
  digitalAddress: { replacement: 'digital_address', reason: 'Deprecated: Use canonical snake_case digital_address' },
  googleMapLocation: { replacement: 'google_map_location', reason: 'Deprecated: Use canonical snake_case google_map_location' },
  googleBusinessProfile: { replacement: 'google_business_profile', reason: 'Deprecated: Use canonical snake_case google_business_profile' },
  contract_link: { replacement: 'agreement_url', reason: 'Deprecated: Use canonical agreement_url' },
  contract_name: { replacement: 'agreement_name', reason: 'Deprecated: Use canonical agreement_name' },
  contract_status: { replacement: 'agreement_status', reason: 'Deprecated: Use canonical agreement_status' },
  date: { replacement: 'meeting_date', reason: 'Deprecated alias: Use meeting_date' },
  time: { replacement: 'meeting_time', reason: 'Deprecated alias: Use meeting_time' },
  link: { replacement: 'meeting_link', reason: 'Deprecated alias: Use meeting_link or action_link' },
};

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
    const footerBlocks = template.blocks?.filter(b => b.type === 'footer') || [];
    const hasFooterBlock = footerBlocks.length > 0;

    // Duplicate footer validation: templates must not contain multiple footer blocks
    if (footerBlocks.length > 1) {
      errors.push({
        type: 'error',
        variable: 'footer',
        isCompliance: true,
        complianceTitle: 'Duplicate Footer Blocks',
        message: 'Your template contains multiple footer blocks. Remove duplicate footer blocks to avoid multiple footers in sent emails.',
        fixAction: {
          label: 'Remove Duplicate Footer',
          description: 'Removes duplicate footer blocks so only one footer remains.',
          actionType: 'remove_footer_block',
          targetVariable: 'footer',
        },
      });
    }

    if (template.styleId === 'none') {
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
          isCompliance: true,
          complianceTitle: 'Missing Copyright Footer',
          message: 'No style wrapper is selected. You must add a "Copyright Info Footer" block or include physical address and copyright details in the email body.',
          fixAction: {
            label: 'Add Footer Block',
            description: 'Inserts a branded Copyright Info Footer block.',
            actionType: 'add_footer_block',
            targetVariable: 'footer',
          },
        });
      }

      // Check for unsubscribe variable token or self-contained footer styles (organization, split, centered)
      const hasSelfContainedFooter = template.blocks?.some(
        b => b.type === 'footer' && (b.footerStyle === 'organization' || b.footerStyle === 'split' || b.footerStyle === 'centered')
      );
      const content = `${template.subject || ''} ${template.previewText || ''} ${template.body || ''} ${JSON.stringify(template.blocks || [])}`;
      const hasUnsubscribe = hasSelfContainedFooter || /\{\{\s*unsubscribe_link(?:\s*\|[^{}]*)?\s*\}\}/.test(content);
      if (!hasUnsubscribe) {
        errors.push({
          type: 'error',
          variable: 'unsubscribe_link',
          isCompliance: true,
          complianceTitle: 'Missing Unsubscribe Link',
          message: 'No style wrapper is selected. You must include the "{{unsubscribe_link}}" variable or a footer block to allow recipients to opt out.',
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
      varName.startsWith('survey_fields.') ||
      varName.startsWith('q_') ||
      varName.startsWith('question_') ||
      varName.startsWith('custom_');

    const isSystemVariable = varName === 'encrypted_recipient_token';

    if (isDynamicContactRole || isDynamicSubmissionField || isSystemVariable) {
      continue;
    }

    // 2b. WhatsApp positional numeric tokens (e.g. {{1}}, {{2}})
    if (template.channel === 'whatsapp' && /^\d+$/.test(varName)) {
      continue;
    }

    // 2c. Check if variable is deprecated (FER Protocol - flag with 1-click replacement)
    const deprecatedInfo = DEPRECATED_VARIABLES_MAP[varName];
    if (deprecatedInfo) {
      errors.push({
        type: 'warning',
        variable: rawVarName,
        message: `Variable "{{${rawVarName}}}" is deprecated. ${deprecatedInfo.reason}.`,
        fixAction: {
          label: `Replace with {{${deprecatedInfo.replacement}}}`,
          description: deprecatedInfo.reason,
          actionType: 'replace_variable',
          targetVariable: rawVarName,
          suggestedVariable: deprecatedInfo.replacement,
        },
      });
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
        meetings: ['meeting', 'meetings', 'common'],
        surveys: ['survey', 'surveys', 'form', 'forms', 'common'],
        forms: ['form', 'forms', 'survey', 'surveys', 'common'],
        agreements: ['agreement', 'agreements', 'finance', 'common'],
        finance: ['agreement', 'agreements', 'finance', 'common'],
        tasks: ['task', 'tasks', 'reminder', 'reminders', 'common'],
        automations: ['automation', 'automations', 'common'],
        reminders: ['reminder', 'reminders', 'meeting', 'meetings', 'task', 'tasks', 'common'],
        qr_codes: ['qr_code', 'qr_codes', 'common'],
        users: ['users', 'user', 'common'],
        campaigns: ['campaign', 'campaigns', 'marketing', 'common'],
        marketing: ['campaign', 'campaigns', 'marketing', 'common'],
        general: ['meeting', 'meetings', 'survey', 'surveys', 'form', 'forms', 'agreement', 'agreements', 'finance', 'task', 'tasks', 'automation', 'automations', 'reminder', 'reminders', 'qr_code', 'qr_codes', 'users', 'user', 'campaign', 'campaigns', 'common'],
        onboarding: ['meeting', 'meetings', 'survey', 'surveys', 'form', 'forms', 'agreement', 'agreements', 'finance', 'task', 'tasks', 'automation', 'automations', 'reminder', 'reminders', 'qr_code', 'qr_codes', 'users', 'user', 'campaign', 'campaigns', 'common'],
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
