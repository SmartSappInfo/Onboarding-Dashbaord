'use server';

/**
 * SmartSapp Forms 2.0: Progressive Profiling & Multi-Attribute CRM Identity Resolution
 * 
 * Implements the 4-tier identity matching hierarchy:
 * 1. Verified entityId token (signed campaign link or session parameter)
 * 2. Case-insensitive primaryEmail indexed lookup
 * 3. Normalized primaryPhone indexed lookup
 * 4. Custom identifier (taxId, registrationNumber) lookup
 * 
 * Handles atomic entity creation/updates, dynamic tag merging,
 * progressive profiling pre-fill, and CRM activity timeline logging.
 */

import { adminDb } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/lib/collection-constants';
import type { Form, EntityType, AppField } from '@/lib/types';
import { logActivity } from '@/lib/activity-logger';
import { applyTagsAction } from '@/lib/tag-actions';
import { createEntityAction, updateEntityAction } from '@/lib/entity-actions';

export interface IdentityResolutionResult {
  matched: boolean;
  entityId: string | null;
  matchKey?: 'entityId' | 'email' | 'phone' | 'taxId' | 'created_new';
  updatedFields: string[];
  appliedTags: string[];
  error?: string;
}

export interface KnownRespondentProfile {
  found: boolean;
  entityId?: string;
  name?: string;
  knownValues: Record<string, unknown>;
  alreadyCapturedFieldKeys: string[];
}

/**
 * Normalizes email strings for safe case-insensitive lookup
 */
export function normalizeEmail(email: unknown): string | null {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.includes('@') ? trimmed : null;
}

/**
 * Normalizes phone numbers (removes spaces, dashes, parentheses)
 */
export function normalizePhone(phone: unknown): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return cleaned.length >= 7 ? cleaned : null;
}

/**
 * Resolves or creates a CRM entity based on the 4-tier hierarchy
 */
export async function resolveAndEnrichCrmEntity({
  workspaceId,
  organizationId,
  form,
  formData,
  explicitEntityId,
  appliedTags = [],
  metadata = {},
}: {
  workspaceId: string;
  organizationId: string;
  form: Form;
  formData: Record<string, unknown>;
  explicitEntityId?: string;
  appliedTags?: string[];
  metadata?: Record<string, unknown>;
}): Promise<IdentityResolutionResult> {
  try {
    let resolvedEntityId: string | null = null;
    let matchKey: 'entityId' | 'email' | 'phone' | 'taxId' | 'created_new' | undefined = undefined;

    const email = normalizeEmail(formData.email || formData.primaryEmail);
    const phone = normalizePhone(formData.phone || formData.primaryPhone);
    const taxId = typeof formData.taxId === 'string' ? formData.taxId.trim() : undefined;
    const displayName = String(formData.name || formData.displayName || formData.schoolName || 'Form Contact').trim();

    // ── Tier 1: Explicit Entity ID Match ──
    if (explicitEntityId) {
      const explicitDoc = await adminDb.collection('workspace_entities').doc(explicitEntityId).get();
      if (explicitDoc.exists && (!explicitDoc.data()?.workspaceId || explicitDoc.data()?.workspaceId === workspaceId)) {
        resolvedEntityId = explicitDoc.id;
        matchKey = 'entityId';
      }
    }

    // ── Tier 2 & Tier 3: Parallel Indexed Lookup by Email or Phone ──
    if (!resolvedEntityId && (email || phone)) {
      const [emailSnap, phoneSnap] = await Promise.all([
        email
          ? adminDb
              .collection('workspace_entities')
              .where('workspaceId', '==', workspaceId)
              .where('primaryEmail', '==', email)
              .limit(1)
              .get()
          : null,
        phone
          ? adminDb
              .collection('workspace_entities')
              .where('workspaceId', '==', workspaceId)
              .where('primaryPhone', '==', phone)
              .limit(1)
              .get()
          : null,
      ]);

      if (emailSnap && !emailSnap.empty) {
        resolvedEntityId = emailSnap.docs[0].data().entityId || emailSnap.docs[0].id;
        matchKey = 'email';
      } else if (phoneSnap && !phoneSnap.empty) {
        resolvedEntityId = phoneSnap.docs[0].data().entityId || phoneSnap.docs[0].id;
        matchKey = 'phone';
      }
    }

    // ── Tier 4: Custom Identifier (taxId / registrationNumber) ──
    if (!resolvedEntityId && taxId) {
      const taxSnap = await adminDb
        .collection('workspace_entities')
        .where('workspaceId', '==', workspaceId)
        .where('taxId', '==', taxId)
        .limit(1)
        .get();

      if (!taxSnap.empty) {
        resolvedEntityId = taxSnap.docs[0].data().entityId || taxSnap.docs[0].id;
        matchKey = 'taxId';
      }
    }

    // ── Separate Native vs Custom fields using App Fields registry ──
    const fieldsSnap = await adminDb
      .collection(COLLECTIONS.APP_FIELDS)
      .where('workspaceId', '==', workspaceId)
      .get();

    const fieldsMap = new Map<string, AppField>(
      fieldsSnap.docs.map(doc => [doc.data().variableName as string, doc.data() as AppField])
    );

    const entityUpdates: Record<string, unknown> = {};
    const customData: Record<string, unknown> = {};
    const updatedFieldKeys: string[] = [];

    Object.entries(formData).forEach(([varName, val]) => {
      if (val === undefined || val === null || val === '') return;
      const definition = fieldsMap.get(varName);
      if (definition) {
        if (definition.isNative) {
          entityUpdates[varName] = val;
        } else {
          customData[varName] = val;
        }
        updatedFieldKeys.push(varName);
      } else {
        customData[varName] = val;
        updatedFieldKeys.push(varName);
      }
    });

    const entityHandling = form.actions?.entityHandling || 'create_or_update';

    // ── Update Existing Entity ──
    if (resolvedEntityId && entityHandling !== 'create_new') {
      const updatePayload: Record<string, unknown> = {
        ...entityUpdates,
        customData,
      };

      if (formData.firstName || formData.lastName) {
        updatePayload.personData = {
          firstName: String(formData.firstName || ''),
          lastName: String(formData.lastName || ''),
        };
      }
      if (formData.familyName) {
        updatePayload.familyData = {
          familyName: String(formData.familyName),
        };
      }

      await updateEntityAction(
        resolvedEntityId,
        updatePayload as Parameters<typeof updateEntityAction>[1],
        `system-form-${form.id}`,
        workspaceId,
        organizationId
      );
    } else if (entityHandling !== 'update_matching') {
      // ── Create New Entity Lead ──
      const contacts: Array<{
        name: string;
        email?: string;
        phone?: string;
        typeKey: string;
        isPrimary: boolean;
        isSignatory: boolean;
      }> = [];

      if (email || phone) {
        contacts.push({
          name: displayName,
          email: email || undefined,
          phone: phone || undefined,
          typeKey: 'other',
          isPrimary: true,
          isSignatory: true,
        });
      }

      const entityPayload: Record<string, unknown> = {
        name: displayName,
        contacts,
        personData: {
          firstName: String(formData.firstName || displayName.split(' ')[0] || ''),
          lastName: String(formData.lastName || displayName.split(' ').slice(1).join(' ') || ''),
        },
      };

      if (Object.keys(customData).length > 0) {
        entityPayload.customData = customData;
      }

      const targetEntityType: EntityType = (form.contactScope as EntityType) || 'person';

      const createRes = await createEntityAction(
        entityPayload as Parameters<typeof createEntityAction>[0],
        `system-form-${form.id}`,
        workspaceId,
        targetEntityType,
        organizationId,
        true // forceCreate to avoid duplicate blocking
      );

      if (createRes.success && createRes.id) {
        resolvedEntityId = createRes.id;
        matchKey = 'created_new';
      }
    }

    // ── Merge & Apply Dynamic Tags ──
    const allTagsToApply = Array.from(
      new Set([...(form.actions?.tags || []), ...appliedTags])
    ).filter(Boolean);

    if (resolvedEntityId && allTagsToApply.length > 0) {
      await applyTagsAction(
        resolvedEntityId,
        'workspace_entity',
        allTagsToApply,
        `system-form-${form.id}`,
        'Form Submission Engine'
      );
    }

    // ── Automated Deal / Opportunity Creation (Phase 4) ──
    let createdDealId: string | undefined = undefined;
    if (resolvedEntityId && form.actions?.dealCreation?.enabled && form.actions.dealCreation.pipelineId) {
      try {
        const dealRule = form.actions.dealCreation;
        const titleTemplate = dealRule.titleTemplate || '{{name}} - Form Inquiry';
        const dealName = titleTemplate
          .replace(/\{\{name\}\}/gi, displayName)
          .replace(/\{\{email\}\}/gi, email || '')
          .replace(/\{\{phone\}\}/gi, phone || '');

        const { createDeal } = await import('@/app/actions/deal-actions');
        const dealRes = await createDeal({
          name: dealName,
          entityId: resolvedEntityId,
          workspaceId,
          organizationId: organizationId || form.organizationId || '',
          pipelineId: dealRule.pipelineId || '',
          stageId: dealRule.stageId,
        });
        if (dealRes?.id) {
          createdDealId = dealRes.id;
        }
      } catch (dealErr) {
        console.error('[FORMS:CRM] Deal creation error:', dealErr);
      }
    }

    // ── Automated Follow-Up Task Assignment (Phase 4) ──
    let createdTaskId: string | undefined = undefined;
    if (resolvedEntityId && form.actions?.taskAssignment?.enabled) {
      try {
        const taskRule = form.actions.taskAssignment;
        const titleTemplate = taskRule.titleTemplate || 'Follow up with {{name}}';
        const taskTitle = titleTemplate
          .replace(/\{\{name\}\}/gi, displayName)
          .replace(/\{\{email\}\}/gi, email || '')
          .replace(/\{\{phone\}\}/gi, phone || '');

        const dueInHours = taskRule.dueInHours || 24;
        const dueDate = new Date(Date.now() + dueInHours * 3600 * 1000).toISOString();

        const { createTaskAction } = await import('@/lib/task-server-actions');
        const taskPayload: Parameters<typeof createTaskAction>[0] = {
          title: taskTitle,
          description: `Auto-generated follow-up task from form submission "${form.title}".`,
          entityId: resolvedEntityId,
          workspaceId,
          organizationId: organizationId || form.organizationId || '',
          priority: taskRule.priority || 'medium',
          status: 'todo',
          category: 'follow_up',
          assignedTo: taskRule.assignedUserId || 'unassigned',
          reminders: [],
          reminderSent: false,
          dueDate,
        };

        const taskRes = await createTaskAction(taskPayload, `system-form-${form.id}`);

        if (taskRes?.success && (taskRes as any).id) {
          createdTaskId = (taskRes as any).id;
        }
      } catch (taskErr) {
        console.error('[FORMS:CRM] Task creation error:', taskErr);
      }
    }

    // ── Atomically Log Activity in Timeline ──
    if (resolvedEntityId) {
      await logActivity({
        type: 'form_submitted',
        description: `Form "${form.title || 'Form'}" submitted with ${updatedFieldKeys.length} fields captured.`,
        source: `system-form-${form.id}`,
        workspaceId,
        organizationId,
        entityId: resolvedEntityId,
        dealId: createdDealId,
        entityType: (form.contactScope as EntityType) || 'person',
        metadata: {
          formId: form.id,
          formTitle: form.title,
          matchKey,
          dealId: createdDealId,
          taskId: createdTaskId,
          totalScore: metadata.totalScore,
          scoreBreakdown: metadata.scoreBreakdown,
          utmSource: metadata.utmSource,
          utmMedium: metadata.utmMedium,
          utmCampaign: metadata.utmCampaign,
          updatedFields: updatedFieldKeys,
          appliedTags: allTagsToApply,
        },
      });
    }

    return {
      matched: Boolean(resolvedEntityId),
      entityId: resolvedEntityId,
      matchKey,
      updatedFields: updatedFieldKeys,
      appliedTags: allTagsToApply,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error in resolveAndEnrichCrmEntity:', msg);
    return {
      matched: false,
      entityId: null,
      updatedFields: [],
      appliedTags: [],
      error: msg,
    };
  }
}

/**
 * Fetches known contact attributes for Progressive Profiling auto-fill
 */
export async function getKnownRespondentProfile(
  workspaceId: string,
  entityId: string
): Promise<KnownRespondentProfile> {
  try {
    const doc = await adminDb.collection('workspace_entities').doc(entityId).get();
    if (!doc.exists || doc.data()?.workspaceId !== workspaceId) {
      return { found: false, knownValues: {}, alreadyCapturedFieldKeys: [] };
    }

    const data = doc.data() || {};
    const knownValues: Record<string, unknown> = {
      ...(data.customData || {}),
      name: data.name,
      displayName: data.displayName || data.name,
      email: data.primaryEmail,
      primaryEmail: data.primaryEmail,
      phone: data.primaryPhone,
      primaryPhone: data.primaryPhone,
      firstName: data.personData?.firstName,
      lastName: data.personData?.lastName,
      familyName: data.familyData?.familyName,
    };

    const alreadyCapturedFieldKeys = Object.keys(knownValues).filter(
      k => knownValues[k] !== undefined && knownValues[k] !== null && knownValues[k] !== ''
    );

    return {
      found: true,
      entityId: doc.id,
      name: data.name || data.displayName,
      knownValues,
      alreadyCapturedFieldKeys,
    };
  } catch (error: unknown) {
    console.error('Failed to get known respondent profile:', error);
    return { found: false, knownValues: {}, alreadyCapturedFieldKeys: [] };
  }
}
