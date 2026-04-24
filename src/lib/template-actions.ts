'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import type { MessageTemplate, TemplateCategory, VariableContext } from './types';

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

export interface TemplateFilters {
  category?: TemplateCategory;
  channel?: 'email' | 'sms';
  status?: MessageTemplate['status'];
  isActive?: boolean;
  templateType?: string;
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
    templateType: data.templateType,
    name: data.name,
    channel: data.channel,
    subject: data.subject,
    body: data.body,
    variableContext: data.variableContext,
    declaredVariables: data.declaredVariables ?? [],
    reminderConfig: data.reminderConfig,
    status: 'draft',
    isActive: false,
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
  if (filters?.status) q = q.where('status', '==', filters.status);
  if (filters?.isActive !== undefined) q = q.where('isActive', '==', filters.isActive);
  if (filters?.templateType) q = q.where('templateType', '==', filters.templateType);

  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MessageTemplate));
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
    isActive: false,
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
  if (filters?.status) globalQuery = globalQuery.where('status', '==', filters.status);
  if (filters?.isActive !== undefined) globalQuery = globalQuery.where('isActive', '==', filters.isActive);

  const globalSnap = await globalQuery.get();
  const globalTemplates = globalSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as MessageTemplate))
    .filter((t) => !overriddenGlobalIds.has(t.id));

  return [...orgTemplates, ...globalTemplates];
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

/**
 * Approves a template (draft → approved). Writes an audit log entry.
 */
export async function approveTemplate(id: string, approvedBy: string): Promise<void> {
  const ref = adminDb.collection('message_templates').doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`Template "${id}" not found.`);
  }

  const existing = snap.data() as MessageTemplate;
  const allowedStatuses: MessageTemplate['status'][] = ['draft', 'pending_approval', 'rejected'];
  if (!allowedStatuses.includes(existing.status)) {
    throw new Error(
      `Cannot approve template with status "${existing.status}". Expected one of: ${allowedStatuses.join(', ')}.`,
    );
  }

  await ref.update({
    status: 'approved',
    isActive: true,
    updatedAt: nowIso(),
    updatedBy: approvedBy,
  });

  await writeAuditLog({
    action: 'approved',
    templateId: id,
    templateName: existing.name,
    userId: approvedBy,
    organizationId: existing.organizationId,
    metadata: { previousStatus: existing.status },
  });

  revalidatePath('/backoffice/messaging/templates');
  revalidatePath('/admin/settings/messaging/templates');
}

/**
 * Rejects a template with a reason. Writes an audit log entry.
 */
export async function rejectTemplate(
  id: string,
  reason: string,
  rejectedBy: string,
): Promise<void> {
  const ref = adminDb.collection('message_templates').doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`Template "${id}" not found.`);
  }

  const existing = snap.data() as MessageTemplate;
  const allowedStatuses: MessageTemplate['status'][] = ['draft', 'pending_approval'];
  if (!allowedStatuses.includes(existing.status)) {
    throw new Error(
      `Cannot reject template with status "${existing.status}". Expected one of: ${allowedStatuses.join(', ')}.`,
    );
  }

  await ref.update({
    status: 'rejected',
    isActive: false,
    updatedAt: nowIso(),
    updatedBy: rejectedBy,
  });

  await writeAuditLog({
    action: 'rejected',
    templateId: id,
    templateName: existing.name,
    userId: rejectedBy,
    organizationId: existing.organizationId,
    metadata: { reason, previousStatus: existing.status },
  });

  revalidatePath('/backoffice/messaging/templates');
  revalidatePath('/admin/settings/messaging/templates');
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
