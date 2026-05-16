'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import type { MessageTemplate, TemplateCategory, TemplateTarget, ContentMode, VariableContext } from './types';

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

export interface TemplateFilters {
  category?: TemplateCategory;
  channel?: 'email' | 'sms';
  target?: TemplateTarget;
  status?: MessageTemplate['status'];
  /** @deprecated Use status filter instead. Kept for backward compatibility. */
  isActive?: boolean;
  templateType?: string;
  /** If true, exclude archived templates from results */
  excludeArchived?: boolean;
}

export interface CreateTemplateInput {
  name: string;
  category: TemplateCategory;
  templateType: string;
  channel: 'email' | 'sms';
  subject?: string;
  body: string;
  variableContext: VariableContext;
  declaredVariables?: string[];
  reminderConfig?: MessageTemplate['reminderConfig'];
  createdBy: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

async function assertNoScheduledMessagesReference(templateId: string): Promise<void> {
  const snap = await adminDb
    .collection('scheduled_messages')
    .where('templateId', '==', templateId)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (!snap.empty) {
    throw new Error(
      `Cannot delete template "${templateId}": it is referenced by pending scheduled messages.`,
    );
  }
}

async function writeAuditLog(params: {
  action: string;
  templateId: string;
  templateName: string;
  userId: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const ref = adminDb.collection('template_audit_logs').doc();
  await ref.set({
    id: ref.id,
    action: params.action,
    templateId: params.templateId,
    templateName: params.templateName,
    userId: params.userId,
    organizationId: params.organizationId ?? null,
    metadata: params.metadata ?? null,
    timestamp: nowIso(),
  });
}

// ---------------------------------------------------------------------------
// Global template management (super admin)
// ---------------------------------------------------------------------------

/**
 * Creates a new global template. Only super admins should call this.
 * Sets scope: 'global', status: 'draft', version: 1.
 */
export async function createGlobalTemplate(
  data: CreateTemplateInput,
): Promise<MessageTemplate> {
  const ref = adminDb.collection('message_templates').doc();
  const now = nowIso();

  const template: MessageTemplate = {
    id: ref.id,
    scope: 'global',
    category: data.category,
    channel: data.channel,
    target: 'external_client',
    name: data.name,
    contentMode: data.channel === 'sms' ? 'plain_text' : 'rich_builder',
    templateType: data.templateType,
    subject: data.subject,
    body: data.body,
    variableContext: data.variableContext,
    declaredVariables: data.declaredVariables ?? [],
    reminderConfig: data.reminderConfig,
    status: 'draft',
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy,
  };

  await ref.set(template);
  revalidatePath('/backoffice/messaging/templates');
  return template;
}

/**
 * Updates a global template. Increments version on each update.
 * Only super admins should call this.
 */
export async function updateGlobalTemplate(
  id: string,
  data: Partial<Omit<MessageTemplate, 'id' | 'scope' | 'version' | 'createdAt' | 'createdBy'>>,
  updatedBy: string,
): Promise<void> {
  const ref = adminDb.collection('message_templates').doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`Template "${id}" not found.`);
  }

  const existing = snap.data() as MessageTemplate;
  if (existing.scope !== 'global') {
    throw new Error(`Template "${id}" is not a global template.`);
  }

  await ref.update({
    ...data,
    version: FieldValue.increment(1),
    updatedAt: nowIso(),
    updatedBy,
  });

  revalidatePath('/backoffice/messaging/templates');
}

/**
 * Deletes a global template.
 * Fails if any pending scheduled messages reference this template.
 */
export async function deleteGlobalTemplate(id: string): Promise<void> {
  await assertNoScheduledMessagesReference(id);

  const ref = adminDb.collection('message_templates').doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`Template "${id}" not found.`);
  }

  const existing = snap.data() as MessageTemplate;
  if (existing.scope !== 'global') {
    throw new Error(`Template "${id}" is not a global template.`);
  }

  await ref.delete();
  revalidatePath('/backoffice/messaging/templates');
}

/**
 * Lists global templates with optional filters.
 */
export async function listGlobalTemplates(
  filters?: TemplateFilters,
): Promise<MessageTemplate[]> {
  let q = adminDb
    .collection('message_templates')
    .where('scope', '==', 'global') as FirebaseFirestore.Query;

  if (filters?.category) q = q.where('category', '==', filters.category);
  if (filters?.channel) q = q.where('channel', '==', filters.channel);
  if (filters?.target) q = q.where('target', '==', filters.target);
  if (filters?.status) q = q.where('status', '==', filters.status);
  if (filters?.isActive !== undefined) q = q.where('isActive', '==', filters.isActive);
  if (filters?.templateType) q = q.where('templateType', '==', filters.templateType);

  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MessageTemplate));
}

/**
 * Gets adoption statistics for a blueprint across all organizations.
 */
export async function getBlueprintAdoptionStats(templateType: string): Promise<{ activeOverrides: number }> {
  const overridesQuery = adminDb
    .collection('message_templates')
    .where('scope', '==', 'organization')
    .where('templateType', '==', templateType);
  
  const snap = await overridesQuery.count().get();
  return { activeOverrides: snap.data().count };
}

// ---------------------------------------------------------------------------
// Org template management
// ---------------------------------------------------------------------------

/**
 * Creates an org-level override of a global template.
 * Copies the global template content and sets scope: 'organization'.
 */
export async function createOrgOverride(
  globalTemplateId: string,
  orgId: string,
  overrideData: Partial<Omit<MessageTemplate, 'id' | 'scope' | 'organizationId' | 'globalTemplateId' | 'version' | 'createdAt'>>,
  createdBy: string,
): Promise<MessageTemplate> {
  // Fetch the global template to copy from
  const globalSnap = await adminDb
    .collection('message_templates')
    .doc(globalTemplateId)
    .get();

  if (!globalSnap.exists) {
    throw new Error(`Global template "${globalTemplateId}" not found.`);
  }

  const global = globalSnap.data() as MessageTemplate;
  if (global.scope !== 'global') {
    throw new Error(`Template "${globalTemplateId}" is not a global template.`);
  }

  const ref = adminDb.collection('message_templates').doc();
  const now = nowIso();

  const override: MessageTemplate = {
    // Copy global content as base
    ...global,
    // Apply caller overrides
    ...overrideData,
    // Force org-scope fields
    id: ref.id,
    scope: 'organization',
    organizationId: orgId,
    globalTemplateId,
    status: 'draft',
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };

  await ref.set(override);
  revalidatePath(`/admin/settings/messaging/templates`);
  return override;
}

/**
 * Updates an org-level template. Validates org ownership.
 */
export async function updateOrgTemplate(
  id: string,
  orgId: string,
  data: Partial<Omit<MessageTemplate, 'id' | 'scope' | 'organizationId' | 'version' | 'createdAt' | 'createdBy'>>,
  updatedBy: string,
): Promise<void> {
  const ref = adminDb.collection('message_templates').doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`Template "${id}" not found.`);
  }

  const existing = snap.data() as MessageTemplate;

  if (existing.scope !== 'organization') {
    throw new Error(`Template "${id}" is not an org-scoped template.`);
  }

  if (existing.organizationId !== orgId) {
    throw new Error(`Template "${id}" does not belong to organization "${orgId}".`);
  }

  await ref.update({
    ...data,
    version: FieldValue.increment(1),
    updatedAt: nowIso(),
    updatedBy,
  });

  revalidatePath(`/admin/settings/messaging/templates`);
}

/**
 * Deletes the org override, reverting to the global template.
 */
export async function revertToGlobal(orgTemplateId: string): Promise<void> {
  const ref = adminDb.collection('message_templates').doc(orgTemplateId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`Template "${orgTemplateId}" not found.`);
  }

  const existing = snap.data() as MessageTemplate;
  if (existing.scope !== 'organization') {
    throw new Error(`Template "${orgTemplateId}" is not an org override.`);
  }

  await ref.delete();
  revalidatePath(`/admin/settings/messaging/templates`);
}

/**
 * Returns a merged list of templates for an org:
 * - Org overrides for templates that have been customized
 * - Global templates that have NOT been overridden by this org
 */
export async function listTemplates(
  orgId: string,
  filters?: TemplateFilters,
): Promise<MessageTemplate[]> {
  // Fetch org overrides
  let orgQuery = adminDb
    .collection('message_templates')
    .where('scope', '==', 'organization')
    .where('organizationId', '==', orgId) as FirebaseFirestore.Query;

  if (filters?.category) orgQuery = orgQuery.where('category', '==', filters.category);
  if (filters?.channel) orgQuery = orgQuery.where('channel', '==', filters.channel);
  if (filters?.target) orgQuery = orgQuery.where('target', '==', filters.target);
  if (filters?.status) orgQuery = orgQuery.where('status', '==', filters.status);
  if (filters?.isActive !== undefined) orgQuery = orgQuery.where('isActive', '==', filters.isActive);

  const orgSnap = await orgQuery.get();
  const orgTemplates = orgSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MessageTemplate));

  // Collect the global template IDs that have been overridden
  const overriddenGlobalIds = new Set(
    orgTemplates
      .map((t) => t.globalTemplateId)
      .filter((id): id is string => Boolean(id)),
  );

  // Fetch global templates
  let globalQuery = adminDb
    .collection('message_templates')
    .where('scope', '==', 'global') as FirebaseFirestore.Query;

  if (filters?.category) globalQuery = globalQuery.where('category', '==', filters.category);
  if (filters?.channel) globalQuery = globalQuery.where('channel', '==', filters.channel);
  if (filters?.target) globalQuery = globalQuery.where('target', '==', filters.target);
  if (filters?.status) globalQuery = globalQuery.where('status', '==', filters.status);
  if (filters?.isActive !== undefined) globalQuery = globalQuery.where('isActive', '==', filters.isActive);

  const globalSnap = await globalQuery.get();
  const globalTemplates = globalSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as MessageTemplate))
    .filter((t) => !overriddenGlobalIds.has(t.id));

  return [...orgTemplates, ...globalTemplates];
}

// ---------------------------------------------------------------------------
// Status transitions (simplified: draft → active → archived)
// ---------------------------------------------------------------------------

/**
 * Activates a template (draft/archived → active).
 * Makes the template available in all consumer selectors.
 */
export async function activateTemplate(id: string, activatedBy: string): Promise<void> {
  const ref = adminDb.collection('message_templates').doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`Template "${id}" not found.`);
  }

  const existing = snap.data() as MessageTemplate;

  await ref.update({
    status: 'active',
    isActive: true, // backward compat
    updatedAt: nowIso(),
    updatedBy: activatedBy,
  });

  await writeAuditLog({
    action: 'activated',
    templateId: id,
    templateName: existing.name,
    userId: activatedBy,
    organizationId: existing.organizationId,
    metadata: { previousStatus: existing.status },
  });

  revalidatePath('/backoffice/messaging/templates');
  revalidatePath('/admin/settings/messaging/templates');
}

/**
 * Archives a template. Archived templates are excluded from all consumer
 * template selectors (Composer, Survey, Meeting, Automation) but remain
 * visible in the Templates management page for easy unarchiving.
 */
export async function archiveTemplate(id: string, archivedBy: string): Promise<void> {
  const ref = adminDb.collection('message_templates').doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`Template "${id}" not found.`);
  }

  const existing = snap.data() as MessageTemplate;

  await ref.update({
    status: 'archived',
    isActive: false, // backward compat
    updatedAt: nowIso(),
    updatedBy: archivedBy,
  });

  await writeAuditLog({
    action: 'archived',
    templateId: id,
    templateName: existing.name,
    userId: archivedBy,
    organizationId: existing.organizationId,
    metadata: { previousStatus: existing.status },
  });

  revalidatePath('/backoffice/messaging/templates');
  revalidatePath('/admin/settings/messaging/templates');
}

/**
 * Unarchives a template back to active status.
 * Single-click action, no confirmation needed.
 */
export async function unarchiveTemplate(id: string, unarchivedBy: string): Promise<void> {
  return activateTemplate(id, unarchivedBy);
}

/**
 * Fetches a single template by ID (for client-side use)
 */
export async function getTemplateById(id: string): Promise<MessageTemplate | null> {
  const snap = await adminDb.collection('message_templates').doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as MessageTemplate;
}

export interface SendTestMessageInput {
  channel: 'email' | 'sms';
  recipient: string;
  body: string;
  subject?: string;
}

/**
 * Sends a pre-rendered template body to a test recipient.
 * Bypasses the full messaging engine to avoid needing a real template ID.
 */
export async function sendTestMessage(input: SendTestMessageInput): Promise<void> {
  if (input.channel === 'email') {
    const { sendEmail } = await import('./resend-service');
    await sendEmail({
      to: input.recipient,
      subject: input.subject ?? '(Test) Template Preview',
      html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${input.body}</pre>`,
    });
  } else {
    const { sendSms } = await import('./mnotify-service');
    // Fetch default sender profile for SMS
    const profilesSnap = await adminDb
      .collection('sender_profiles')
      .where('channel', '==', 'sms')
      .where('isActive', '==', true)
      .limit(1)
      .get();
    const sender = profilesSnap.empty ? 'SmartSapp' : (profilesSnap.docs[0].data().senderId ?? 'SmartSapp');
    await sendSms({ recipient: input.recipient, message: input.body, sender });
  }
}
