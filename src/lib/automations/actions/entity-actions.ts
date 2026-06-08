import { adminDb } from '../../firebase-admin';
import { resolveContact } from '../../contact-adapter';
import { logActivity } from '../../activity-logger';
import type { ExecutionContext } from '../execution-types';

/**
 * Resolves the workspace's organizationId.
 * Fast path: reads from ExecutionContext (populated once at run start in executor.ts).
 * Fallback: Firestore read (used when context is rebuilt in resume.ts without orgId).
 */
async function resolveOrgId(context: ExecutionContext): Promise<string> {
  if (context.organizationId) return context.organizationId;
  const snap = await adminDb.collection('workspaces').doc(context.workspaceId).get();
  return (snap.data()?.organizationId as string) || '';
}

export async function handleUpdateEntity(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  if (!context.entityId) throw new Error('Cannot update entity: Context missing entityId.');

  const contact = await resolveContact(context.entityId, context.workspaceId);
  if (!contact?.entityId) throw new Error('Cannot update entity: Contact not found.');

  const timestamp = new Date().toISOString();
  const identityFields = ['name', 'slug', 'displayName'];
  const identityUpdates: Record<string, unknown> = { updatedAt: timestamp };
  const workspaceUpdates: Record<string, unknown> = { updatedAt: timestamp };
  const customDataUpdates: Record<string, unknown> = {};

  const updates = (config.updates || config) as Record<string, unknown>;
  if (config.pipelineId) workspaceUpdates.pipelineId = config.pipelineId;
  if (config.stageId) workspaceUpdates.stageId = config.stageId;
  if (config.assignedTo) workspaceUpdates.assignedTo = config.assignedTo;


  if (updates && typeof updates === 'object') {
    for (const [key, value] of Object.entries(updates)) {
      if (identityFields.includes(key)) {
        identityUpdates[key] = value;
      } else if (['pipelineId', 'stageId', 'assignedTo', 'workspaceTags'].includes(key)) {
        workspaceUpdates[key] = value;
      } else if (
        key !== 'updates' &&
        key !== 'pipelineId' &&
        key !== 'stageId' &&
        key !== 'assignedTo'
      ) {
        customDataUpdates[key] = value;
      }
    }
  }

  if (Object.keys(identityUpdates).length > 1 || Object.keys(customDataUpdates).length > 0) {
    const payload: Record<string, any> = { ...identityUpdates };
    if (Object.keys(customDataUpdates).length > 0) {
      for (const [k, v] of Object.entries(customDataUpdates)) {
        payload[`customData.${k}`] = v;
      }
    }
    await adminDb.collection('entities').doc(contact.entityId).update(payload);
  }

  if (contact.workspaceEntityId && Object.keys(workspaceUpdates).length > 1) {
    await adminDb
      .collection('workspace_entities')
      .doc(contact.workspaceEntityId)
      .update(workspaceUpdates);
  }

  // Log to activity feed — exclude the auto-added updatedAt so we only surface real field changes
  const changedFields = Object.keys({
    ...identityUpdates,
    ...workspaceUpdates,
    ...customDataUpdates,
  }).filter((k) => k !== 'updatedAt');

  if (changedFields.length > 0) {
    const organizationId = await resolveOrgId(context);
    await logActivity({
      type: 'entity_updated',
      description: `Automation updated: ${changedFields.join(', ')}`,
      source: 'automation',
      organizationId,
      workspaceId: context.workspaceId,
      entityId: contact.entityId!,
      userId: `automation:${context.automationId}`,
      displayName: 'System Core',
      metadata: {
        // CRITICAL: prevents activity-logger from re-firing an automation trigger loop
        isAutomation: true,
        updatedFields: changedFields,
        automationId: context.automationId,
      },
    });
  }
}

export async function handleAssignEntity(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  if (!context.entityId) throw new Error('Cannot assign entity: Context missing entityId.');
  const contact = await resolveContact(context.entityId, context.workspaceId);
  if (!contact?.workspaceEntityId) {
    throw new Error('Cannot assign entity: Workspace entity not found.');
  }

  const assignedToPayload = context.payload.assignedTo as { userId?: string } | undefined;
  const assignedTo =
    config.assignedTo === 'auto'
      ? assignedToPayload?.userId || (context.payload.actorId as string) || ''
      : (config.assignedTo as string);

  await adminDb.collection('workspace_entities').doc(contact.workspaceEntityId).update({
    assignedTo,
    updatedAt: new Date().toISOString(),
  });
}

export async function handleAddNote(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  if (!context.entityId || !config.content) {
    throw new Error('Add note action requires entityId and content.');
  }

  await adminDb.collection('entity_notes').add({
    entityId: context.entityId,
    workspaceId: context.workspaceId,
    content: config.content,
    createdBy: (config.authorId as string) || 'system',
    createdByName: 'System Core',
    noteType: 'general',
    isPinned: false,
    source: 'automation',
    automationId: context.automationId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Log to activity feed so the note is visible in the contact timeline
  const organizationId = await resolveOrgId(context);
  await logActivity({
    type: 'note_added',
    description: 'Automation added a note',
    source: 'automation',
    organizationId,
    workspaceId: context.workspaceId,
    entityId: context.entityId!,
    userId: `automation:${context.automationId}`,
    displayName: 'System Core',
    metadata: {
      // CRITICAL: prevents activity-logger from re-firing an automation trigger loop
      isAutomation: true,
      noteType: 'general',
      contentPreview: String(config.content).slice(0, 120),
      automationId: context.automationId,
    },
  });
}
