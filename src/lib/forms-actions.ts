'use server';

import { adminDb } from './firebase-admin';
import type { Form, FormSubmission } from './types';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Server-side actions for the Form Builder.
 * Handles CRUD operations for workspace-scoped forms, slug validation,
 * and submission processing.
 */

const REVALIDATION_PATH = '/admin/forms';

/**
 * Creates a new form in the forms collection.
 */
export async function createFormAction(data: Omit<Form, 'id' | 'createdAt' | 'updatedAt' | 'submissionCount'>) {
  try {
    // Validate unique slug within workspace
    const existing = await adminDb
      .collection('forms')
      .where('workspaceId', '==', data.workspaceId)
      .where('slug', '==', data.slug)
      .limit(1)
      .get();

    if (!existing.empty) {
      return { success: false, error: `A form with slug "${data.slug}" already exists in this workspace.` };
    }

    const now = new Date().toISOString();
    const ref = adminDb.collection('forms').doc();
    await ref.set({
      ...data,
      submissionCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath(REVALIDATION_PATH);
    return { success: true, id: ref.id };
  } catch (error: any) {
    console.error('>>> [FORMS] Create Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Updates an existing form.
 */
export async function updateFormAction(id: string, data: Partial<Form>) {
  try {
    const ref = adminDb.collection('forms').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: false, error: 'Form not found.' };
    }

    const existing = snap.data() as Form;

    // If slug changed, validate uniqueness
    if (data.slug && data.slug !== existing.slug) {
      const dup = await adminDb
        .collection('forms')
        .where('workspaceId', '==', existing.workspaceId)
        .where('slug', '==', data.slug)
        .limit(1)
        .get();
      if (!dup.empty) {
        return { success: false, error: `Slug "${data.slug}" is already in use.` };
      }
    }

    await ref.update({
      ...data,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(REVALIDATION_PATH);
    revalidatePath(`/admin/forms/${id}/edit`);
    return { success: true };
  } catch (error: any) {
    console.error('>>> [FORMS] Update Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a form and optionally its submissions.
 */
export async function deleteFormAction(id: string) {
  try {
    const ref = adminDb.collection('forms').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: false, error: 'Form not found.' };
    }

    // Delete all related submissions
    const subsSnap = await adminDb
      .collection('form_submissions')
      .where('formId', '==', id)
      .get();

    const batch = adminDb.batch();
    subsSnap.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(ref);
    await batch.commit();

    revalidatePath(REVALIDATION_PATH);
    return { success: true, deletedSubmissions: subsSnap.size };
  } catch (error: any) {
    console.error('>>> [FORMS] Delete Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Clones a form within the same workspace.
 */
export async function cloneFormAction(formId: string) {
  try {
    const sourceRef = adminDb.collection('forms').doc(formId);
    const snap = await sourceRef.get();
    if (!snap.exists) return { success: false, error: 'Source form not found.' };

    const source = snap.data() as Form;
    const now = new Date().toISOString();
    const newSlug = `${source.slug}-copy-${Date.now().toString(36)}`;

    const newRef = adminDb.collection('forms').doc();
    await newRef.set({
      ...source,
      internalName: `${source.internalName} (Copy)`,
      title: `${source.title} (Copy)`,
      slug: newSlug,
      status: 'draft',
      submissionCount: 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
    });

    revalidatePath(REVALIDATION_PATH);
    return { success: true, id: newRef.id };
  } catch (error: any) {
    console.error('>>> [FORMS] Clone Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Toggles a form between published and draft status.
 */
export async function toggleFormStatusAction(id: string, newStatus: 'published' | 'draft' | 'archived') {
  try {
    const ref = adminDb.collection('forms').doc(id);
    const updates: Record<string, any> = {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    if (newStatus === 'published') {
      updates.publishedAt = new Date().toISOString();
    }

    await ref.update(updates);
    revalidatePath(REVALIDATION_PATH);
    return { success: true };
  } catch (error: any) {
    console.error('>>> [FORMS] Status Toggle Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Processes a form submission from the public renderer or campaign pages.
 * Handles persistence, entity binding, tagging, and global automation triggers.
 */
export async function processFormSubmissionAction(input: {
  formId: string;
  data: Record<string, any>; // { variableName: value }
  entityId?: string; // Optional existing entity context
  sourcePageId?: string; // If embedded in a campaign page
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const timestamp = new Date().toISOString();
    
    // 1. Fetch Form Definition
    const formRef = adminDb.collection('forms').doc(input.formId);
    const formSnap = await formRef.get();
    if (!formSnap.exists) throw new Error('Form not found');
    const form = { id: formSnap.id, ...formSnap.data() } as Form;

    // 2. Persist Submission
    const subRef = adminDb.collection('form_submissions').doc();
    const submission: FormSubmission = {
      id: subRef.id,
      formId: input.formId,
      workspaceId: form.workspaceId,
      organizationId: form.organizationId,
      data: input.data,
      entityId: input.entityId || null,
      sourcePageId: input.sourcePageId || null,
      submittedAt: timestamp,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    };
    await subRef.set(submission);

    // 3. Increment Submission Count
    await formRef.update({
      submissionCount: (form.submissionCount || 0) + 1,
      updatedAt: timestamp
    });

    // 4. Handle Entity Data Mapping (For High-Fidelity "Bound" Forms)
    // If bound, we map native fields to the actual entity record
    if (form.formType === 'bound' && input.entityId) {
      const entityUpdates: Record<string, any> = {};
      
      // Fetch the app fields for this workspace to identify native mappings
      const fieldsSnap = await adminDb.collection('app_fields')
        .where('workspaceId', '==', form.workspaceId)
        .where('variableName', 'in', Object.keys(input.data))
        .get();

      fieldsSnap.docs.forEach(doc => {
        const field = doc.data();
        if (field.isNative) {
          // Determine where this native field maps to (e.g., direct property vs nested)
          // For now, we update the primary record fields.
          entityUpdates[field.variableName] = input.data[field.variableName];
        }
      });

      if (Object.keys(entityUpdates).length > 0) {
        const entityCollection = form.contactScope === 'institution' ? 'schools' : 'entities';
        await adminDb.collection(entityCollection).doc(input.entityId).update({
          ...entityUpdates,
          updatedAt: timestamp
        });
      }
    }

    // 5. Execute FormActions: Tagging & Webhooks
    if (form.actions) {
      // 5a. Tagging
      if (form.actions.tags?.length && input.entityId) {
        const { applyTagsAction } = await import('./tag-actions');
        await applyTagsAction(
          input.entityId,
          form.contactScope === 'institution' ? 'school' : 'entity',
          form.actions.tags,
          'system-form-engine',
          'Form Submission Engine'
        );
      }

      // 5b. Webhooks
      if (form.actions.webhooks?.length) {
        const { dispatchWebhook } = await import('./webhook-engine');
        for (const hook of form.actions.webhooks) {
          await dispatchWebhook({
            webhookIdOrUrl: hook,
            payload: {
              trigger: 'FORM_SUBMITTED',
              formId: form.id,
              formTitle: form.title,
              submissionId: subRef.id,
              data: input.data,
              submittedAt: timestamp
            },
            workspaceId: form.workspaceId,
            organizationId: form.organizationId,
            entityId: input.entityId,
            formTitle: form.title
          });
        }
      }
    }

    // 6. Trigger Automations & Notifications
    const automationVars = {
      ...input.data,
      form_id: input.formId,
      form_title: form.title,
      workspaceId: form.workspaceId,
      organizationId: form.organizationId,
      entityId: input.entityId,
      submission_id: subRef.id
    };

    // 6a. Notifications
    if (form.actions?.notifications) {
      const { triggerInternalNotification, triggerExternalNotification } = await import('./notification-engine');
      
      // Internal Notifications
      if (form.actions.notifications.internalUserIds?.length) {
        await triggerInternalNotification({
          specificUserIds: form.actions.notifications.internalUserIds,
          variables: automationVars,
          channel: 'email'
        });
      }

      // External Respondent Confirmation
      if (form.actions.notifications.sendConfirmationEmail && input.entityId) {
        await triggerExternalNotification({
          entityId: input.entityId,
          contactTypes: ['primary_contact', 'focal_person'],
          variables: automationVars,
          channel: 'email'
        });
      }
    }

    // 6b. Automation Triggers
    const { triggerAutomationProtocols } = await import('./automation-processor');
    await triggerAutomationProtocols('FORM_SUBMITTED', automationVars);

    // 7. Activity Logging
    const { logActivity } = await import('./activity-logger');
    
    // Core Form Submission Log
    await logActivity({
      workspaceId: form.workspaceId,
      organizationId: form.organizationId,
      entityId: input.entityId || null,
      type: 'form_submitted',
      source: 'public_form',
      description: `Form "${form.title}" submitted by ${input.entityId || 'anonymous'}`,
      metadata: {
        formId: input.formId,
        submissionId: subRef.id,
        sourcePageId: input.sourcePageId
      },
      timestamp
    });

    // Indirect Conversion Tracking (Requirement 11, PRD Section 10)
    if (input.sourcePageId) {
      await logActivity({
        workspaceId: form.workspaceId,
        organizationId: form.organizationId,
        entityId: input.entityId || null,
        type: 'page_conversion' as any,
        source: 'campaign_page',
        description: `Conversion recorded for campaign page from form "${form.title}"`,
        metadata: {
          pageId: input.sourcePageId,
          formId: input.formId,
          submissionId: subRef.id
        },
        timestamp
      });
    }

    return { success: true, submissionId: subRef.id };
  } catch (error: any) {
    console.error('>>> [FORMS:SUBMIT] Failed:', error.message);
    return { success: false, error: error.message };
  }
}
