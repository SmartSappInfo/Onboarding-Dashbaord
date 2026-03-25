'use server';

import type { TagActionNode } from './types';
import { applyTagsAction, removeTagsAction } from './tag-actions';

/**
 * Executes a TagActionNode during automation flow execution.
 * Calls applyTagsAction or removeTagsAction based on the node's action type.
 *
 * Requirements: FR4.3.1, FR4.3.2
 */
export async function executeTagAction(
  node: TagActionNode,
  contactId: string,
  contactType: 'school' | 'prospect',
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { action, tagIds } = node.data;

  if (!tagIds || tagIds.length === 0) {
    return { success: true }; // Nothing to do
  }

  if (action === 'add_tags') {
    const result = await applyTagsAction(contactId, contactType, tagIds, userId);
    return result;
  }

  if (action === 'remove_tags') {
    const result = await removeTagsAction(contactId, contactType, tagIds, userId);
    return result;
  }

  return { success: false, error: `Unknown tag action: ${action}` };
}
