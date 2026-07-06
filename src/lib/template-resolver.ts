'use server';

import { adminDb } from './firebase-admin';
import type { MessageTemplate, TemplateCategory, VariableContext, MessageChannel, OrgBrandingData } from './types';
import { renderTemplate } from './template-utils';
import { getBaseUrl } from './utils/url-helpers';
import { MESSAGING_TRIGGERS } from './messaging-triggers';
import { FieldsVariablesService } from './services/fields-variables-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VariableResolutionContext {
  entityId?: string;
  meetingId?: string;
  formId?: string;
  surveyId?: string;
  agreementId?: string;
  responseId?: string;
  submissionId?: string;
  workspaceId?: string;
  userId?: string;
  /** Extra variables that override or supplement resolved values */
  extraVars?: Record<string, any>;
}

// Note: renderTemplate is available from './template-utils' (not re-exported here due to 'use server' constraints)

// ---------------------------------------------------------------------------
// resolveTemplateForOrg
// ---------------------------------------------------------------------------

/**
 * Resolves the correct template for an org + category + type combination.
 * Org-level overrides take priority over global templates.
 */
export async function resolveTemplateForOrg(
  category: TemplateCategory,
  type: string,
  orgId: string,
  channel?: MessageChannel,
): Promise<MessageTemplate> {
  // 1. Check for an active org-level override
  let orgQuery = adminDb
    .collection('message_templates')
    .where('scope', '==', 'organization')
    .where('organizationId', '==', orgId)
    .where('category', '==', category)
    .where('templateType', '==', type)
    .where('isActive', '==', true);

  if (channel) {
    orgQuery = orgQuery.where('channel', '==', channel);
  }

  const orgSnap = await orgQuery.limit(1).get();

  if (!orgSnap.empty) {
    const doc = orgSnap.docs[0];
    return { id: doc.id, ...doc.data() } as MessageTemplate;
  }

  // 2. Fall back to the global template
  let globalQuery = adminDb
    .collection('message_templates')
    .where('scope', '==', 'global')
    .where('category', '==', category)
    .where('templateType', '==', type)
    .where('isActive', '==', true);

  if (channel) {
    globalQuery = globalQuery.where('channel', '==', channel);
  }

  const globalSnap = await globalQuery.limit(1).get();

  if (!globalSnap.empty) {
    const doc = globalSnap.docs[0];
    return { id: doc.id, ...doc.data() } as MessageTemplate;
  }

  throw new Error(`No template found for ${category}/${type}${channel ? ` (${channel})` : ''}`);
}

// ---------------------------------------------------------------------------
// resolveActiveTemplate
// ---------------------------------------------------------------------------

/**
 * Resolves the correct template for a trigger key (templateType) and organization.
 * Looks up the category from the global registry.
 */
export async function resolveActiveTemplate(
  triggerKey: string,
  orgId: string,
  channel?: MessageChannel,
): Promise<MessageTemplate> {
  const trigger = MESSAGING_TRIGGERS.find(t => t.id === triggerKey);
  if (!trigger) {
    throw new Error(`Unknown trigger: ${triggerKey}`);
  }
  return resolveTemplateForOrg(trigger.category, triggerKey, orgId, channel);
}

// ---------------------------------------------------------------------------
// buildVariableMap
// ---------------------------------------------------------------------------

/**
 * Fetches and assembles variable values from Firestore based on the context
 * IDs provided. Returns a flat key→value map ready for `renderTemplate`.
 */
export async function buildVariableMap(
  context: VariableContext,
  resolutionCtx: VariableResolutionContext,
): Promise<Record<string, any>> {
  const unifiedMap = await FieldsVariablesService.getVariableValuesMap({
    workspaceId: resolutionCtx.workspaceId || 'onboarding',
    entityId: resolutionCtx.entityId,
    meetingId: resolutionCtx.meetingId,
    formId: resolutionCtx.formId,
    surveyId: resolutionCtx.surveyId,
    agreementId: resolutionCtx.agreementId,
    submissionId: resolutionCtx.submissionId,
    responseId: resolutionCtx.responseId,
    userId: resolutionCtx.userId,
    extraVars: resolutionCtx.extraVars
  });

  const vars: Record<string, string | number | boolean | undefined | null> = {};
  unifiedMap.forEach((v, k) => {
    vars[k] = v as string | number | boolean | null | undefined;
  });

  // Double-bind snake_case and camelCase variables for backwards compatibility
  const boundKeys = Object.keys(vars);
  for (const key of boundKeys) {
    const val = vars[key];
    if (key.includes('_')) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      if (vars[camelKey] === undefined) {
        vars[camelKey] = val;
      }
    } else {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (vars[snakeKey] === undefined) {
        vars[snakeKey] = val;
      }
    }
  }

  return vars;
}

// ---------------------------------------------------------------------------
// resolveAndRender
// ---------------------------------------------------------------------------

/**
 * Full pipeline: resolve the correct template for the org → build variable
 * map from context → render the template body (and subject if present).
 */
export async function resolveAndRender(
  category: TemplateCategory,
  type: string,
  orgId: string,
  resolutionCtx: VariableResolutionContext,
  channel?: MessageChannel,
): Promise<{ subject?: string; body: string }> {
  const template = await resolveTemplateForOrg(category, type, orgId, channel);
  const vars = await buildVariableMap(template.variableContext, resolutionCtx);

  return {
    subject: template.subject ? renderTemplate(template.subject, vars) : undefined,
    body: renderTemplate(template.body, vars),
  };
}
