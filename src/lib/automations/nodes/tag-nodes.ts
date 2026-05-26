import { adminDb } from '../../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { resolveContact } from '../../contact-adapter';
import { evaluateTagCondition } from '../../tag-condition';
import type { TagConditionNode } from '../../types';
import type { ExecutionContext } from '../execution-types';

export async function evaluateTagConditionNode(
  node: TagConditionNode,
  context: ExecutionContext
): Promise<boolean> {
  if (!context.entityId) return false;
  const contact = await resolveContact(context.entityId, context.workspaceId);
  if (!contact) return false;
  return evaluateTagCondition(contact.tags || [], node);
}

export async function processTagActionNode(
  node: { data?: { action?: string; tagIds?: string[] } },
  context: ExecutionContext
): Promise<void> {
  const { action, tagIds } = node.data || {};
  if (!action || !tagIds?.length) return;

  if (!context.entityId) throw new Error('Tag action failed: missing entityId.');
  const contact = await resolveContact(context.entityId, context.workspaceId);
  if (!contact) throw new Error('Tag action failed: Contact not found.');
  if (!contact.workspaceEntityId) {
    throw new Error('Tag action failed: Workspace entity not found.');
  }

  const timestamp = new Date().toISOString();
  const weRef = adminDb.collection('workspace_entities').doc(contact.workspaceEntityId);

  if (action === 'add_tags') {
    await weRef.update({
      workspaceTags: FieldValue.arrayUnion(...tagIds),
      updatedAt: timestamp,
    });
  } else if (action === 'remove_tags') {
    await weRef.update({
      workspaceTags: FieldValue.arrayRemove(...tagIds),
      updatedAt: timestamp,
    });
  }
}
