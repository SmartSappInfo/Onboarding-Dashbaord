'use server';

import { adminDb } from '../firebase-admin';
import type { Automation, AutomationTriggerDef } from '../types';

interface TagAutomationMatch {
  automationId: string;
  automationName: string;
  tagId: string;
  enrollOnce: boolean;
}

/**
 * Checks if any of the given tag IDs are configured as triggers on active automations
 * within the given workspace. Returns matching automation metadata.
 *
 * Performance: Single Firestore query with in-memory filtering.
 * Security: Server-only via 'use server'. No client-side data exposure.
 */
export async function checkTagAutomations(
  tagIds: string[],
  workspaceId: string
): Promise<TagAutomationMatch[]> {
  if (tagIds.length === 0 || !workspaceId) return [];

  const snap = await adminDb
    .collection('automations')
    .where('triggerTypes', 'array-contains', 'TAG_ADDED')
    .where('isActive', '==', true)
    .get();

  if (snap.empty) return [];

  const matches: TagAutomationMatch[] = [];
  const tagIdSet = new Set(tagIds);

  for (const doc of snap.docs) {
    const automation = { id: doc.id, ...doc.data() } as Automation;

    // Workspace isolation check
    if (
      automation.workspaceIds?.length &&
      !automation.workspaceIds.includes(workspaceId)
    ) {
      continue;
    }

    for (const triggerDef of (automation.triggers || []) as AutomationTriggerDef[]) {
      if (triggerDef.type !== 'TAG_ADDED') continue;

      const configTagIds = (triggerDef.config?.tagIds as string[]) || [];
      const enrollOnce = !!(triggerDef.config?.enrollOnce);

      if (configTagIds.length === 0) {
        // Wildcard: matches ALL tags
        for (const tagId of tagIds) {
          matches.push({
            automationId: automation.id,
            automationName: automation.name,
            tagId,
            enrollOnce,
          });
        }
      } else {
        for (const configTagId of configTagIds) {
          if (tagIdSet.has(configTagId)) {
            matches.push({
              automationId: automation.id,
              automationName: automation.name,
              tagId: configTagId,
              enrollOnce,
            });
          }
        }
      }
    }
  }

  return matches;
}
