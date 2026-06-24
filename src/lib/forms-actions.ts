'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Form, FormSubmission, AppField } from './types';
import { revalidatePath } from 'next/cache';
import { canUser } from './workspace-permissions';
import { COLLECTIONS } from './collection-constants';
import { submissionsToCSV, normaliseSubmissionData } from './forms-utils';
import { z } from 'zod';

/**
 * @fileOverview Server-side actions for the Form Builder.
 * Handles CRUD operations for workspace-scoped forms, slug validation,
 * and submission processing.
 */

const REVALIDATION_PATH = '/admin/forms';

/**
 * Creates a new form in the forms collection.
 */
export async function createFormAction(data: Omit<Form, 'id' | 'createdAt' | 'updatedAt' | 'submissionCount'>, userId: string) {
  try {
    // 0. Permission Check
    const permission = await canUser(userId, 'studios', 'forms', 'create', data.workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason };
    }

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
export async function updateFormAction(id: string, data: Partial<Form>, userId: string, expectedVersion?: number) {
  try {
    const ref = adminDb.collection('forms').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: false, error: 'Form not found.' };
    }

    const existing = snap.data() as Form;

    // 0. Permission Check
    const permission = await canUser(userId, 'studios', 'forms', 'edit', existing.workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason };
    }

    // Version Conflict Check
    if (expectedVersion !== undefined) {
      const currentVersion = existing.version || 0;
      if (currentVersion !== expectedVersion) {
        return { success: false, conflict: true, error: 'Another user edited this form. Please refresh.' };
      }
    }

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

    const nextVersion = (existing.version || 0) + 1;
    const updateData = {
      ...data,
      version: nextVersion,
      updatedAt: new Date().toISOString(),
    };

    // Ensure we don't accidentally update read-only properties
    delete (updateData as any).id;

    await ref.update(updateData);

    revalidatePath(REVALIDATION_PATH);
    revalidatePath(`/admin/forms/${id}/edit`);
    return { success: true, version: nextVersion };
  } catch (error: any) {
    console.error('>>> [FORMS] Update Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a form and all its submissions.
 * Uses chunked batches to stay under Firestore's 500-doc batch limit.
 */
export async function deleteFormAction(id: string, userId: string) {
  try {
    const ref = adminDb.collection(COLLECTIONS.FORMS).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: false, error: 'Form not found.' };
    }

    const existing = snap.data() as Form;

    // 0. Permission Check
    const permission = await canUser(userId, 'studios', 'forms', 'delete', existing.workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason };
    }

    // Delete all related submissions in chunks of 400 (safely under 500 Firestore limit)
    let totalDeleted = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    while (true) {
      let q = adminDb
        .collection(COLLECTIONS.FORM_SUBMISSIONS)
        .where('formId', '==', id)
        .limit(400);
      if (lastDoc) q = q.startAfter(lastDoc);

      const subsSnap = await q.get();
      if (subsSnap.empty) break;

      const batch = adminDb.batch();
      subsSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      totalDeleted += subsSnap.size;
      lastDoc = subsSnap.docs[subsSnap.docs.length - 1];
      if (subsSnap.size < 400) break;
    }

    await ref.delete();
    revalidatePath(REVALIDATION_PATH);
    return { success: true, deletedSubmissions: totalDeleted };
  } catch (error: any) {
    console.error('>>> [FORMS] Delete Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Clones a form within the same workspace.
 */
export async function cloneFormAction(formId: string, userId: string) {
  try {
    const sourceRef = adminDb.collection('forms').doc(formId);
    const snap = await sourceRef.get();
    if (!snap.exists) return { success: false, error: 'Source form not found.' };

    const source = snap.data() as Form;

    // 0. Permission Check
    const permission = await canUser(userId, 'studios', 'forms', 'create', source.workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason };
    }
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
export async function toggleFormStatusAction(id: string, newStatus: 'published' | 'draft' | 'archived', userId: string) {
  try {
    const ref = adminDb.collection('forms').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: "Form not found." };
    const existing = snap.data() as Form;

    const permission = await canUser(userId, 'studios', 'forms', 'edit', existing.workspaceId);
    if (!permission.granted) return { success: false, error: permission.reason };

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

    // 2. Resolve entityId (Bound Forms)
    let resolvedEntityId = input.entityId || null;

    if (form.formType === 'bound' && !resolvedEntityId) {
      const email = input.data.email || input.data.primaryEmail;
      const phone = input.data.phone || input.data.primaryPhone;
      const displayName = input.data.name || input.data.displayName || input.data.schoolName || 'Form Contact';

      const entityHandling = form.actions?.entityHandling || 'create_or_update';

      // Try to match existing entity by email or phone within the workspace
      if ((email || phone) && (entityHandling === 'update_matching' || entityHandling === 'create_or_update')) {
        const matchSnap = await adminDb.collection('workspace_entities')
          .where('workspaceId', '==', form.workspaceId)
          .get();
        
        const matchedDoc = matchSnap.docs.find(doc => {
          const d = doc.data();
          return (email && d.primaryEmail === email) || (phone && d.primaryPhone === phone);
        });

        if (matchedDoc) {
          resolvedEntityId = matchedDoc.data().entityId;
        }
      }

      // Separate native vs custom data based on form fields definitions
      const fieldsSnap = await adminDb.collection(COLLECTIONS.APP_FIELDS)
        .where('workspaceId', '==', form.workspaceId)
        .get();
      
      const fieldsMap = new Map(fieldsSnap.docs.map(doc => [doc.data().variableName, doc.data()]));

      const entityUpdates: Record<string, any> = {};
      const customData: Record<string, any> = {};

      Object.entries(input.data).forEach(([varName, val]) => {
        const definition = fieldsMap.get(varName);
        if (definition) {
          if (definition.isNative) {
            entityUpdates[varName] = val;
          } else {
            customData[varName] = val;
          }
        }
      });

      if (resolvedEntityId && entityHandling !== 'create_new') {
        const { updateEntityAction } = await import('./entity-actions');
        
        const updatePayload: any = {
          ...entityUpdates,
          customData
        };

        if (input.data.firstName || input.data.lastName) {
          updatePayload.personData = {
            firstName: input.data.firstName || '',
            lastName: input.data.lastName || ''
          };
        }
        if (input.data.familyName) {
          updatePayload.familyData = {
            familyName: input.data.familyName
          };
        }

        await updateEntityAction(
          resolvedEntityId,
          updatePayload,
          `system-form-${form.id}`,
          form.workspaceId,
          form.organizationId
        );
      } else if (entityHandling !== 'update_matching') {
        // Create new entity
        const { createEntityAction } = await import('./entity-actions');
        const contacts = [];
        if (email || phone) {
          contacts.push({
            name: displayName,
            email,
            phone,
            typeKey: 'other',
            isPrimary: true,
            isSignatory: true,
          });
        }

        const entityPayload: any = {
          name: displayName,
          contacts,
          personData: {
            firstName: input.data.firstName || displayName.split(' ')[0] || '',
            lastName: input.data.lastName || displayName.split(' ').slice(1).join(' ') || '',
          },
        };

        if (Object.keys(customData).length > 0) {
          entityPayload.customData = customData;
        }

        const entityType = form.contactScope || 'person';
        const createRes = await createEntityAction(
          entityPayload,
          `system-form-${form.id}`,
          form.workspaceId,
          entityType,
          form.organizationId,
          true // forceCreate to avoid duplicate error loop
        );

        if (createRes.success && createRes.id) {
          resolvedEntityId = createRes.id;
        }
      }
    } else if (form.formType === 'bound' && resolvedEntityId) {
      // If entityId is passed, update it
      const fieldsSnap = await adminDb.collection(COLLECTIONS.APP_FIELDS)
        .where('workspaceId', '==', form.workspaceId)
        .get();
      
      const fieldsMap = new Map(fieldsSnap.docs.map(doc => [doc.data().variableName, doc.data()]));

      const entityUpdates: Record<string, any> = {};
      const customData: Record<string, any> = {};

      Object.entries(input.data).forEach(([varName, val]) => {
        const definition = fieldsMap.get(varName);
        if (definition) {
          if (definition.isNative) {
            entityUpdates[varName] = val;
          } else {
            customData[varName] = val;
          }
        }
      });

      const { updateEntityAction } = await import('./entity-actions');
      
      const updatePayload: any = {
        ...entityUpdates,
        customData
      };

      if (input.data.firstName || input.data.lastName) {
        updatePayload.personData = {
          firstName: input.data.firstName || '',
          lastName: input.data.lastName || ''
        };
      }
      if (input.data.familyName) {
        updatePayload.familyData = {
          familyName: input.data.familyName
        };
      }

      await updateEntityAction(
        resolvedEntityId,
        updatePayload,
        `system-form-${form.id}`,
        form.workspaceId,
        form.organizationId
      );
    }

    // 2b. Persist Submission
    const subRef = adminDb.collection('form_submissions').doc();
    const submission: FormSubmission = {
      id: subRef.id,
      formId: input.formId,
      workspaceId: form.workspaceId,
      organizationId: form.organizationId,
      data: input.data,
      entityId: resolvedEntityId || undefined,
      sourcePageId: input.sourcePageId || undefined,
      submittedAt: timestamp,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    };
    await subRef.set(submission);

    // 3. Increment Submission Count (atomic — immune to race conditions)
    await formRef.update({
      submissionCount: FieldValue.increment(1),
      updatedAt: timestamp,
    });

    // 5. Execute FormActions: Tagging & Webhooks
    if (form.actions) {
      // 5a. Tagging
      if (form.actions.tags?.length && resolvedEntityId) {
        const { applyTagsAction } = await import('./tag-actions');
        await applyTagsAction(
          resolvedEntityId,
          'workspace_entity',
          form.actions.tags,
          'system-form-engine',
          'Form Submission Engine'
        );
      }

      // 5b. Webhooks — dispatched in parallel; allSettled prevents one failure blocking others
      if (form.actions.webhooks?.length) {
        const { dispatchWebhook } = await import('./webhook-engine');
        await Promise.allSettled(
          form.actions.webhooks.map(hook =>
            dispatchWebhook({
              webhookIdOrUrl: hook,
              payload: {
                trigger: 'FORM_SUBMITTED',
                formId: form.id,
                formTitle: form.title,
                submissionId: subRef.id,
                data: input.data,
                submittedAt: timestamp,
              },
              workspaceId: form.workspaceId,
              organizationId: form.organizationId,
              entityId: resolvedEntityId || undefined,
              trigger: 'FORM_SUBMITTED' as any,
              source: 'form_engine',
              description: `Webhook dispatched for form "${form.title}"`,
            })
          )
        );
      }
    }

    // 6. Trigger Automations & Notifications
    const automationVars = {
      ...input.data,
      form_id: input.formId,
      form_title: form.title,
      workspaceId: form.workspaceId,
      organizationId: form.organizationId,
      entityId: resolvedEntityId || undefined,
      submission_id: subRef.id
    };

    // 6a. Notifications
    if (form.actions?.notifications) {
      const { triggerInternalNotification, triggerExternalNotification } = await import('./notification-engine');
      const { sendMessage } = await import('./messaging-engine');
      
      const { internalAlerts, respondentAlerts } = form.actions.notifications;

      // Internal Notifications. 'all' fires each channel that has a template
      // set (the engine guards each by its template id), which is equivalent to
      // the previous email/sms derivation and additionally covers WhatsApp.
      if (internalAlerts?.enabled) {
        await triggerInternalNotification({
          specificUserIds: internalAlerts.userIds || [],
          variables: automationVars,
          emailTemplateId: internalAlerts.emailTemplateId,
          smsTemplateId: internalAlerts.smsTemplateId,
          whatsappTemplateId: internalAlerts.whatsappTemplateId,
          channel: 'all',
        });
      }

      // External Respondent Confirmation
      if (respondentAlerts?.enabled) {
        const respondentEmail = respondentAlerts.respondentEmailField ? input.data[respondentAlerts.respondentEmailField] : undefined;
        const respondentPhone = respondentAlerts.respondentPhoneField ? input.data[respondentAlerts.respondentPhoneField] : undefined;

        if (respondentAlerts.emailTemplateId && respondentEmail) {
          await sendMessage({
            templateId: respondentAlerts.emailTemplateId,
            senderProfileId: 'default',
            organizationId: form.organizationId,
            recipient: respondentEmail,
            variables: automationVars,
            entityId: resolvedEntityId || undefined,
            workspaceId: form.workspaceId
          });
        }

        if (respondentAlerts.smsTemplateId && respondentPhone) {
          await sendMessage({
            templateId: respondentAlerts.smsTemplateId,
            senderProfileId: 'default',
            organizationId: form.organizationId,
            recipient: respondentPhone,
            variables: automationVars,
            entityId: resolvedEntityId || undefined,
            workspaceId: form.workspaceId
          });
        }

        if (respondentAlerts.whatsappTemplateId && respondentPhone) {
          await sendMessage({
            templateId: respondentAlerts.whatsappTemplateId,
            senderProfileId: 'default',
            organizationId: form.organizationId,
            recipient: respondentPhone,
            variables: automationVars,
            entityId: resolvedEntityId || undefined,
            workspaceId: form.workspaceId
          });
        }
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
      entityId: resolvedEntityId || null,
      type: 'form_submitted',
      source: 'public_form',
      description: `Form "${form.title}" submitted by ${resolvedEntityId || 'anonymous'}`,
      metadata: {
        formId: input.formId,
        submissionId: subRef.id,
        sourcePageId: input.sourcePageId
      },
    });

    // Indirect Conversion Tracking (Requirement 11, PRD Section 10)
    if (input.sourcePageId) {
      await logActivity({
        workspaceId: form.workspaceId,
        organizationId: form.organizationId,
        entityId: resolvedEntityId || null,
        type: 'page_conversion' as any,
        source: 'campaign_page',
        description: `Conversion recorded for campaign page from form "${form.title}"`,
        metadata: {
          pageId: input.sourcePageId,
          formId: input.formId,
          submissionId: subRef.id
        },
      });
    }

    return { success: true, submissionId: subRef.id };
  } catch (error: any) {
    console.error('>>> [FORMS:SUBMIT] Failed:', error.message);
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Read Actions (used by Submissions Page RSC)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches a single form by ID. Used by RSC pages to avoid duplicate fetches.
 */
export async function getFormByIdAction(formId: string): Promise<Form | null> {
  const snap = await adminDb.collection(COLLECTIONS.FORMS).doc(formId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Form;
}

/**
 * Paginated query for form submissions.
 * Uses cursor-based pagination (submittedAt timestamp of last doc).
 */
export async function getFormSubmissionsAction(
  formId: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<{ submissions: FormSubmission[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 50;

  let q = adminDb
    .collection(COLLECTIONS.FORM_SUBMISSIONS)
    .where('formId', '==', formId)
    .orderBy('submittedAt', 'desc')
    .limit(limit + 1); // fetch one extra to know if there's a next page

  if (opts.cursor) {
    q = q.startAfter(opts.cursor);
  }

  const snap = await q.get();
  const docs = snap.docs.slice(0, limit);
  const hasMore = snap.docs.length > limit;

  const submissions = docs.map(d => ({ id: d.id, ...d.data() } as FormSubmission));
  const nextCursor = hasMore ? submissions[submissions.length - 1]?.submittedAt ?? null : null;

  return { submissions, nextCursor };
}

/**
 * Generates a CSV export of all submissions for a form.
 * Fetches field metadata to build human-readable headers.
 * Returns the CSV as a plain string — the client triggers the download.
 */
export async function exportSubmissionsAsCsvAction(
  formId: string
): Promise<{ success: true; csv: string; filename: string } | { success: false; error: string }> {
  try {
    const [formSnap, subsSnap, fieldsSnap] = await Promise.all([
      adminDb.collection(COLLECTIONS.FORMS).doc(formId).get(),
      adminDb
        .collection(COLLECTIONS.FORM_SUBMISSIONS)
        .where('formId', '==', formId)
        .orderBy('submittedAt', 'desc')
        .get(),
      adminDb.collection(COLLECTIONS.APP_FIELDS).get(), // Fields fetched broadly; filtered client-side
    ]);

    if (!formSnap.exists) return { success: false, error: 'Form not found.' };

    const form = { id: formSnap.id, ...formSnap.data() } as Form;
    const submissions = subsSnap.docs.map(d => ({ id: d.id, ...d.data() } as FormSubmission));
    const allFields = fieldsSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppField));

    // Only include fields that belong to this form's workspace
    const workspaceFields = allFields.filter(f => f.workspaceId === form.workspaceId);

    const csv = submissionsToCSV(submissions, workspaceFields);
    const date = new Date().toISOString().split('T')[0];
    const filename = `${form.internalName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_submissions_${date}.csv`;

    return { success: true, csv, filename };
  } catch (error: any) {
    console.error('>>> [FORMS] Export Failed:', error.message);
    return { success: false, error: error.message };
  }
}
