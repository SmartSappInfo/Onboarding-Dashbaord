import { resolveContact } from '../../contact-adapter';
import { evaluateTagSplitSwitch } from '../../tag-condition';
import type { TagConditionNode } from '../../types';
import type { ExecutionContext } from '../execution-types';

export async function evaluateTagConditionNode(
  node: TagConditionNode,
  context: ExecutionContext
): Promise<string[]> {
  if (!context.entityId) {
    return node.data.conditions ? ['none'] : ['false'];
  }
  const contact = await resolveContact(context.entityId, context.workspaceId);
  if (!contact) {
    return node.data.conditions ? ['none'] : ['false'];
  }
  return evaluateTagSplitSwitch(contact.tags || [], node);
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

  // Route through applyTagsAction / removeTagsAction so that:
  //   1. logActivity is called → TAG_ADDED / TAG_REMOVED automation trigger fires
  //   2. logTagAudit is written for the audit trail
  //   3. Tag usage counts are updated
  //   4. Chained automations (automation triggers another automation via tag) work correctly
  //
  // Previously this wrote directly to Firestore via FieldValue.arrayUnion which
  // bypassed the entire event pipeline — no triggers ever fired from automation nodes.
  const { applyTagsAction, removeTagsAction } = await import('../../tag-actions');
  const userId = `automation:${context.automationId}`;

  if (action === 'add_tags') {
    const result = await applyTagsAction(
      contact.workspaceEntityId,
      'workspace_entity',
      tagIds,
      userId,
      'Automation Engine'
    );
    if (!result.success) {
      throw new Error(`Tag action (add) failed: ${result.error}`);
    }
  } else if (action === 'remove_tags') {
    const result = await removeTagsAction(
      contact.workspaceEntityId,
      'workspace_entity',
      tagIds,
      userId,
      'Automation Engine'
    );
    if (!result.success) {
      throw new Error(`Tag action (remove) failed: ${result.error}`);
    }
  }
}
