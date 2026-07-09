import type { TagConditionNode } from './types';

/**
 * Evaluates a TagConditionNode against a contact's current tag IDs.
 *
 * Logic modes:
 * - has_tag:      contact has at least one of the specified tags
 * - has_all_tags: contact has ALL of the specified tags
 * - has_any_tag:  contact has at least one of the specified tags (alias for has_tag)
 * - not_has_tag:  contact has NONE of the specified tags
 *
 * Requirements: FR4.2.1, FR4.2.2
 */
export function evaluateTagCondition(
  contactTags: string[],
  node: TagConditionNode
): boolean {
  const { logic, tagIds } = node.data;

  // If no tags are configured, the condition is trivially true
  if (!tagIds || tagIds.length === 0) return true;

  const contactTagSet = new Set(contactTags);

  switch (logic) {
    case 'has_tag':
    case 'has_any_tag':
      return tagIds.some(id => contactTagSet.has(id));

    case 'has_all_tags':
      return tagIds.every(id => contactTagSet.has(id));

    case 'not_has_tag':
      return !tagIds.some(id => contactTagSet.has(id));

    default:
      return false;
  }
}

/**
 * Evaluates a switch-style TagConditionNode against a contact's current tag IDs.
 * Returns an array of matching branch handles. If none match, returns ['none'].
 */
export function evaluateTagSplitSwitch(
  contactTags: string[],
  node: TagConditionNode
): string[] {
  const { conditions, evaluationMode } = node.data;

  // 1. Fallback to legacy binary True/False logic if no conditions are defined
  if (!conditions) {
    const isTrue = evaluateTagCondition(contactTags, node);
    return isTrue ? ['true'] : ['false'];
  }

  // 2. Evaluate new multi-branch conditions
  const contactTagSet = new Set(contactTags);
  const matchedHandles: string[] = [];

  for (const cond of conditions) {
    if (cond.tagId && contactTagSet.has(cond.tagId)) {
      matchedHandles.push(cond.id);
      if (!evaluationMode || evaluationMode === 'first_match') {
        break; // First-Match Wins
      }
    }
  }

  // 3. Fallback to 'none' handle if no conditions matched
  if (matchedHandles.length === 0) {
    return ['none'];
  }

  return matchedHandles;
}

