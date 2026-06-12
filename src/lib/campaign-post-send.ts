'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { resolveContact } from './contact-adapter';
import type { MessageCampaign, PostSendTagRule, MessageTask } from './types';

// ── Shared tag utility (R3 fix: extracted from automation-processor.ts) ──────

/**
 * Applies tags to an entity following the canonical dual-write pattern.
 * Writes to both workspace_entities.workspaceTags AND legacy schools/prospects.tags.
 * 
 * This is the single source of truth for tag application — used by:
 * - Post-send tagging engine (campaign-post-send.ts)
 * - Automation processor (automation-processor.ts → processTagActionNode)
 * 
 * @param entityId - The workspace-entity ID or legacy entity ID
 * @param workspaceId - The workspace context
 * @param tagIds - Array of tag IDs to apply
 * @param action - 'add_tags' or 'remove_tags'
 */
export async function applyTagsToEntity(
  entityId: string,
  workspaceId: string,
  tagIds: string[],
  action: 'add_tags' | 'remove_tags' = 'add_tags'
): Promise<void> {
  if (!tagIds.length) return;

  const contact = await resolveContact(entityId, workspaceId);
  if (!contact) {
    console.warn(`[TAG] Cannot resolve entity ${entityId} for tagging`);
    return;
  }

  const batch = adminDb.batch();
  const timestamp = new Date().toISOString();
  const fieldOp = action === 'add_tags' ? FieldValue.arrayUnion(...tagIds) : FieldValue.arrayRemove(...tagIds);

  // Workspace entity (operational — Phase 4+ primary)
  if (contact.workspaceEntityId) {
    const weRef = adminDb.collection('workspace_entities').doc(contact.workspaceEntityId);
    batch.update(weRef, { workspaceTags: fieldOp, updatedAt: timestamp });
  }

  // Legacy collection (dual-write for backward compat)
  const legacyCollection = contact.entityType === 'institution' ? 'schools' : 'prospects';
  const legacyRef = adminDb.collection(legacyCollection).doc(contact.id);
  try {
    batch.update(legacyRef, { tags: fieldOp, updatedAt: timestamp });
  } catch {
    // Legacy doc may not exist — safe to ignore
  }

  await batch.commit();
}

// ── Post-Send Tagging Engine ──────────────────────────────────────────────────

/**
 * Applies post-send tag rules after a campaign job completes.
 * 
 * Flow:
 * 1. Load campaign + job + task subcollection
 * 2. For each PostSendTagRule, resolve the matching cohort of entities
 * 3. Apply tags in batched chunks (max 450 per batch for Firestore limits)
 * 
 * Called from: bulk-messaging.ts completion hook (R1 fix)
 */
export async function applyCampaignPostSendTags(campaignId: string): Promise<{
  success: boolean;
  appliedCount?: number;
  error?: string;
}> {
  try {
    const campaignSnap = await adminDb.collection('message_campaigns').doc(campaignId).get();
    if (!campaignSnap.exists) return { success: false, error: 'Campaign not found' };

    const campaign = campaignSnap.data() as MessageCampaign;
    const rules = campaign.postSendTagRules;

    if (!rules || rules.length === 0) {
      return { success: true, appliedCount: 0 };
    }

    if (!campaign.jobId) {
      return { success: false, error: 'No linked job found' };
    }

    // Load all tasks for cohort resolution
    const tasksSnap = await adminDb
      .collection('message_jobs').doc(campaign.jobId)
      .collection('tasks')
      .limit(5000)
      .get();

    if (tasksSnap.empty) {
      return { success: true, appliedCount: 0 };
    }

    // Build cohort maps
    const allTasks = tasksSnap.docs.map(d => ({ ...d.data() as MessageTask, id: d.id }));
    const cohorts: Record<PostSendTagRule['appliesTo'], MessageTask[]> = {
      all_targeted: allTasks,
      delivered: allTasks.filter(t => t.status === 'sent'),
      failed: allTasks.filter(t => t.status === 'failed'),
      not_delivered: allTasks.filter(t => t.status !== 'sent'),
    };

    let totalApplied = 0;

    for (const rule of rules) {
      // Skip delayed rules (handled by scheduled jobs — future Phase 7)
      if (rule.delayMinutes && rule.delayMinutes > 0) {
        console.log(`[POST-SEND] Skipping delayed rule for tag ${rule.tagName} (${rule.delayMinutes}min delay)`);
        continue;
      }

      const cohort = cohorts[rule.appliesTo] || [];
      if (cohort.length === 0) continue;

      // Get entity IDs from tasks (R2 fix ensures entityId is on tasks)
      const entityIds = cohort
        .map(t => t.entityId)
        .filter((id): id is string => !!id);

      // Deduplicate
      const uniqueEntityIds = [...new Set(entityIds)];

      const actionType = rule.actionType || 'add_tag';

      if (actionType === 'add_tag') {
        const tagId = rule.tagId;
        if (!tagId) continue;
        // Apply in chunks (Firestore batch limit = 500 operations)
        const CHUNK_SIZE = 50; // Conservative: each entity may need 2 writes (dual-write)
        for (let i = 0; i < uniqueEntityIds.length; i += CHUNK_SIZE) {
          const chunk = uniqueEntityIds.slice(i, i + CHUNK_SIZE);
          await Promise.all(
            chunk.map(eid => applyTagsToEntity(eid, campaign.workspaceId, [tagId]))
          );
        }
        console.log(`[POST-SEND] Applied tag "${rule.tagName}" to ${uniqueEntityIds.length} entities (cohort: ${rule.appliesTo})`);
      } else if (actionType === 'create_deal') {
        const { handleCreateDeal } = await import('./automations/actions/deal-automation-actions');
        const config = {
          pipelineId: rule.dealPipelineId,
          stageId: rule.dealStageId,
          name: rule.dealTitleTemplate || '{{entityName}} Deal',
          value: 0
        };
        for (const eid of uniqueEntityIds) {
          try {
            const context = {
              entityId: eid,
              workspaceId: campaign.workspaceId,
              payload: {
                organizationId: campaign.organizationId || '',
              }
            };
            await handleCreateDeal(config, context as any);
          } catch (dealErr: any) {
            console.error(`[POST-SEND] Failed to create deal for ${eid}:`, dealErr.message);
          }
        }
        console.log(`[POST-SEND] Created deals for ${uniqueEntityIds.length} entities (cohort: ${rule.appliesTo})`);
      } else if (actionType === 'create_task') {
        const { handleCreateTask } = await import('./automations/actions/task-actions');
        const config = {
          title: rule.taskTitleTemplate || 'Automated Task',
          description: `Campaign post-send task for "${campaign.internalName}"`,
          dueOffsetDays: rule.taskDueDateOffsetDays || 3,
          priority: 'medium',
          category: 'follow_up',
          assignedTo: 'auto'
        };
        for (const eid of uniqueEntityIds) {
          try {
            const contact = await resolveContact(eid, campaign.workspaceId);
            const context = {
              entityId: eid,
              entityType: contact?.entityType || 'person',
              workspaceId: campaign.workspaceId,
              payload: {
                organizationId: campaign.organizationId || '',
                assignedTo: { userId: contact?.assignedTo || '' }
              }
            };
            await handleCreateTask(config, context as any);
          } catch (taskErr: any) {
            console.error(`[POST-SEND] Failed to create task for ${eid}:`, taskErr.message);
          }
        }
        console.log(`[POST-SEND] Created tasks for ${uniqueEntityIds.length} entities (cohort: ${rule.appliesTo})`);
      }

      totalApplied += uniqueEntityIds.length;
    }

    return { success: true, appliedCount: totalApplied };

  } catch (error: any) {
    console.error('[POST-SEND] Failed:', error.message);
    return { success: false, error: error.message };
  }
}
