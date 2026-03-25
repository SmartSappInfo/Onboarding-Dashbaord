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
