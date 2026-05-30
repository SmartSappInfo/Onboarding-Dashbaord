import { adminDb } from '../../firebase-admin';
import { resolveContact } from '../../contact-adapter';
import type { ExecutionContext } from '../execution-types';

export async function handleUpdateEntity(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  if (!context.entityId) throw new Error('Cannot update entity: Context missing entityId.');

  const contact = await resolveContact(context.entityId, context.workspaceId);
  if (!contact?.entityId) throw new Error('Cannot update entity: Contact not found.');

  const timestamp = new Date().toISOString();
  const identityFields = ['name', 'slug', 'displayName', 'lifecycleStatus'];
  const identityUpdates: Record<string, unknown> = { updatedAt: timestamp };
  const workspaceUpdates: Record<string, unknown> = { updatedAt: timestamp };
  const customDataUpdates: Record<string, unknown> = {};

  const updates = (config.updates || config) as Record<string, unknown>;
  if (config.pipelineId) workspaceUpdates.pipelineId = config.pipelineId;
  if (config.stageId) workspaceUpdates.stageId = config.stageId;
  if (config.assignedTo) workspaceUpdates.assignedTo = config.assignedTo;
  if (config.lifecycleStatus) identityUpdates.lifecycleStatus = config.lifecycleStatus;

  if (updates && typeof updates === 'object') {
    for (const [key, value] of Object.entries(updates)) {
      if (identityFields.includes(key)) {
        identityUpdates[key] = value;
      } else if (['pipelineId', 'stageId', 'assignedTo', 'workspaceTags'].includes(key)) {
        workspaceUpdates[key] = value;
      } else if (key !== 'updates' && key !== 'pipelineId' && key !== 'stageId' && key !== 'assignedTo' && key !== 'lifecycleStatus') {
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
  await adminDb.collection('notes').add({
    entityId: context.entityId,
    workspaceId: context.workspaceId,
    content: config.content,
    authorId: (config.authorId as string) || 'system',
    source: 'automation',
    automationId: context.automationId,
    createdAt: new Date().toISOString(),
  });
}
