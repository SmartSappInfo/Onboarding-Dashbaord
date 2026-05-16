'use server';

import { adminDb } from './firebase-admin';
import type { MessageTemplate, TemplateCategory, VariableContext } from './types';
import { renderTemplate } from './template-utils';
import { MESSAGING_TRIGGERS } from './messaging-triggers';

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
): Promise<MessageTemplate> {
  // 1. Check for an active org-level override
  const orgSnap = await adminDb
    .collection('message_templates')
    .where('scope', '==', 'organization')
    .where('organizationId', '==', orgId)
    .where('category', '==', category)
    .where('templateType', '==', type)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!orgSnap.empty) {
    const doc = orgSnap.docs[0];
    return { id: doc.id, ...doc.data() } as MessageTemplate;
  }

  // 2. Fall back to the global template
  const globalSnap = await adminDb
    .collection('message_templates')
    .where('scope', '==', 'global')
    .where('category', '==', category)
    .where('templateType', '==', type)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!globalSnap.empty) {
    const doc = globalSnap.docs[0];
    return { id: doc.id, ...doc.data() } as MessageTemplate;
  }

  throw new Error(`No template found for ${category}/${type}`);
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
): Promise<MessageTemplate> {
  const trigger = MESSAGING_TRIGGERS.find(t => t.id === triggerKey);
  if (!trigger) {
    throw new Error(`Unknown trigger: ${triggerKey}`);
  }
  return resolveTemplateForOrg(trigger.category, triggerKey, orgId);
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
  const vars: Record<string, any> = {};

  // Common computed values
  const now = new Date();
  vars['current_date'] = now.toLocaleDateString();
  vars['current_time'] = now.toLocaleTimeString();
  vars['current_year'] = String(now.getFullYear());

  // Meeting context
  if ((context === 'meeting' || context === 'common') && resolutionCtx.meetingId) {
    const snap = await adminDb.collection('meetings').doc(resolutionCtx.meetingId).get();
    if (snap.exists) {
      const meeting = snap.data()!;
      vars['meeting_title'] = meeting.heroTitle ?? meeting.type?.name ?? '';
      vars['meeting_link'] = meeting.meetingLink ?? '';
      vars['meeting_time'] = meeting.meetingTime ?? '';
      vars['meeting_date'] = meeting.meetingTime
        ? new Date(meeting.meetingTime).toLocaleDateString()
        : '';
      vars['meeting_type'] = meeting.type?.name ?? '';
      vars['organizer_name'] = meeting.assignedTo?.name ?? '';

      // ── New variables (Phase 8 enrichment) ──────────────────────
      vars['recording_link'] = meeting.recordingUrl ?? '';
      vars['resource_link'] = meeting.resourceUrl ?? '';
      vars['feedback_form_link'] = meeting.feedbackFormUrl ?? '';

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onboarding.smartsapp.com';
      vars['dashboard_link'] = `${baseUrl}/admin/meetings/${resolutionCtx.meetingId}`;

      // Calendar link (computed)
      if (meeting.meetingTime) {
        const { generateCalendarLinkFromMeeting } = await import('./calendar-utils');
        vars['calendar_link'] = generateCalendarLinkFromMeeting(meeting);
      }

      // Timezone from org settings + registrant stats (parallel fetch per async-parallel)
      const orgId = meeting.organizationId ?? '';
      const [orgSnap, regSnap] = await Promise.all([
        orgId ? adminDb.collection('organizations').doc(orgId).get() : Promise.resolve(null),
        adminDb.collection('meetings').doc(resolutionCtx.meetingId).collection('registrants')
          .where('status', 'in', ['registered', 'approved', 'attended'])
          .get(),
      ]);

      if (orgSnap?.exists) {
        const orgData = orgSnap.data()!;
        vars['meeting_timezone'] = orgData.settings?.defaultTimezone ?? 'UTC';
      } else {
        vars['meeting_timezone'] = 'UTC';
      }

      // Registrant/attendee counts
      const allRegs = regSnap?.docs ?? [];
      vars['registrant_count'] = String(allRegs.length);
      const attendedCount = allRegs.filter(d => d.data().status === 'attended').length;
      vars['attendee_count'] = String(attendedCount);
      vars['no_show_count'] = String(allRegs.length - attendedCount);
    }
  }

  // Form context
  if ((context === 'form' || context === 'common') && resolutionCtx.formId) {
    const snap = await adminDb.collection('pdfs').doc(resolutionCtx.formId).get();
    if (snap.exists) {
      const form = snap.data()!;
      vars['form_name'] = form.name ?? form.title ?? '';
      vars['form_link'] = form.publicUrl ?? '';
      vars['submission_deadline'] = form.deadline ?? '';
      vars['deadline'] = form.deadline ?? '';
    }

    // Task 13.3: Fetch dynamic form field variables from template_variables collection
    try {
      const dynamicVarsSnap = await adminDb
        .collection('template_variables')
        .where('sourceFormId', '==', resolutionCtx.formId)
        .where('isDynamic', '==', true)
        .where('context', '==', 'form')
        .get();
      
      // Register available dynamic variables (without values yet)
      dynamicVarsSnap.docs.forEach((doc) => {
        const variable = doc.data();
        // Initialize with empty string - will be populated from submission if available
        if (!vars[variable.name]) {
          vars[variable.name] = '';
        }
      });
    } catch (error) {
      console.error('Failed to fetch dynamic form variables:', error);
    }

    // Dynamic form field values from a submission
    if (resolutionCtx.submissionId) {
      const subSnap = await adminDb
        .collection('pdfs')
        .doc(resolutionCtx.formId)
        .collection('submissions')
        .doc(resolutionCtx.submissionId)
        .get();
      if (subSnap.exists) {
        const submission = subSnap.data()!;
        vars['respondent_name'] = submission.respondentName ?? '';
        vars['submission_date'] = submission.submittedAt
          ? new Date(submission.submittedAt).toLocaleDateString()
          : '';
        // Merge dynamic field values under form_fields.*
        if (submission.fields && typeof submission.fields === 'object') {
          for (const [fieldId, value] of Object.entries(submission.fields)) {
            vars[`form_fields.${fieldId}`] = value ?? '';
          }
        }
      }
    }
  }

  // Survey context
  if ((context === 'survey' || context === 'common') && resolutionCtx.surveyId) {
    const snap = await adminDb.collection('surveys').doc(resolutionCtx.surveyId).get();
    if (snap.exists) {
      const survey = snap.data()!;
      vars['survey_title'] = survey.title ?? '';
      vars['survey_link'] = survey.publicUrl ?? '';
    }

    // Task 13.3: Fetch dynamic survey question variables from template_variables collection
    try {
      const dynamicVarsSnap = await adminDb
        .collection('template_variables')
        .where('sourceFormId', '==', resolutionCtx.surveyId)
        .where('isDynamic', '==', true)
        .where('context', '==', 'survey')
        .get();
      
      // Register available dynamic variables (without values yet)
      dynamicVarsSnap.docs.forEach((doc) => {
        const variable = doc.data();
        // Initialize with empty string - will be populated from response if available
        if (!vars[variable.name]) {
          vars[variable.name] = '';
        }
      });
    } catch (error) {
      console.error('Failed to fetch dynamic survey variables:', error);
    }

    // Dynamic survey response values
    if (resolutionCtx.responseId) {
      const respSnap = await adminDb
        .collection('surveys')
        .doc(resolutionCtx.surveyId)
        .collection('responses')
        .doc(resolutionCtx.responseId)
        .get();
      if (respSnap.exists) {
        const response = respSnap.data()!;
        vars['score'] = response.score ?? '';
        vars['result_message'] = response.resultMessage ?? '';
        vars['completion_date'] = response.submittedAt
          ? new Date(response.submittedAt).toLocaleDateString()
          : '';
        vars['completion_status'] = response.status ?? 'Completed';
        if (response.answers && typeof response.answers === 'object') {
          for (const [questionId, value] of Object.entries(response.answers)) {
            vars[`survey_fields.${questionId}`] = value ?? '';
          }
        }
      }
    }
  }

  // Agreement context
  if ((context === 'agreement' || context === 'common') && resolutionCtx.agreementId) {
    const snap = await adminDb.collection('contracts').doc(resolutionCtx.agreementId).get();
    if (snap.exists) {
      const contract = snap.data()!;
      vars['contract_name'] = contract.name ?? contract.title ?? '';
      vars['contract_link'] = contract.signingUrl ?? contract.publicUrl ?? '';
      vars['signatory_name'] = contract.signatoryName ?? '';
      vars['deadline'] = contract.deadline ?? '';
      vars['contract_status'] = contract.status ?? '';
      vars['signing_date'] = contract.signedAt
        ? new Date(contract.signedAt).toLocaleDateString()
        : '';
    }
  }

  // Entity context (and common entity fields)
  if (resolutionCtx.entityId) {
    const snap = await adminDb.collection('entities').doc(resolutionCtx.entityId).get();
    if (snap.exists) {
      const entity = snap.data()!;
      vars['entity_name'] = entity.name ?? '';
      // Primary contact
      const primary = (entity.entityContacts ?? []).find((c: any) => c.isPrimary);
      if (primary) {
        vars['contact_name'] = primary.name ?? '';
        vars['contact_email'] = primary.email ?? '';
        vars['contact_phone'] = primary.phone ?? '';
      }
    }
  }

  // Workspace / org context
  if (resolutionCtx.workspaceId) {
    const snap = await adminDb.collection('workspaces').doc(resolutionCtx.workspaceId).get();
    if (snap.exists) {
      const ws = snap.data()!;
      vars['workspace_name'] = ws.name ?? '';
      // Fetch org name if available
      if (ws.organizationId) {
        const orgSnap = await adminDb.collection('organizations').doc(ws.organizationId).get();
        if (orgSnap.exists) {
          vars['organization_name'] = orgSnap.data()!.name ?? '';
        }
      }
    }
  }

  // Extra vars override everything
  if (resolutionCtx.extraVars) {
    Object.assign(vars, resolutionCtx.extraVars);
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
): Promise<{ subject?: string; body: string }> {
  const template = await resolveTemplateForOrg(category, type, orgId);
  const vars = await buildVariableMap(template.variableContext, resolutionCtx);

  return {
    subject: template.subject ? renderTemplate(template.subject, vars) : undefined,
    body: renderTemplate(template.body, vars),
  };
}
