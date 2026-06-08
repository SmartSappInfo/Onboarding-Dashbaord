import { adminDb } from '../firebase-admin';

/**
 * Fetches the current workspaceTags for an entity directly from Firestore,
 * intentionally bypassing the contact-adapter in-memory cache. This ensures
 * conditionNode tag evaluation always sees the entity's live tag state, not
 * a snapshot from earlier in the automation run.
 *
 * Requirements: FR-COND-01 (live-state tag evaluation)
 */
export async function fetchLiveEntityTags(
  entityId: string,
  workspaceId: string
): Promise<string[]> {
  const snap = await adminDb
    .collection('workspace_entities')
    .where('entityId', '==', entityId)
    .where('workspaceId', '==', workspaceId)
    .limit(1)
    .get();

  if (snap.empty) return [];
  return (snap.docs[0].data().workspaceTags as string[]) || [];
}

/**
 * Returns true if the conditionNode's configuration references any tag field.
 * Used as a fast synchronous guard before triggering an async Firestore fetch —
 * avoids unnecessary reads for nodes that never check tags.
 *
 * Handles both legacy single-field config and modern group-based config.
 */
export function nodeChecksTags(
  node: { data?: { config?: Record<string, unknown> } }
): boolean {
  const config = node.data?.config;
  if (!config) return false;

  // Legacy single-field config (e.g. { field: 'tags', operator: 'any_of' })
  if (config.field === 'tags' || config.field === 'tag') return true;

  // Group-based config (modern condition builder)
  const groups = config.groups as
    | Array<{ conditions?: Array<{ field?: string }> }>
    | undefined;
  if (!Array.isArray(groups)) return false;

  return groups.some((g) =>
    (g.conditions || []).some((c) => c.field === 'tags' || c.field === 'tag')
  );
}
