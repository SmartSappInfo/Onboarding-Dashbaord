'use server';

import { adminDb } from './firebase-admin';
import type { AutomationRule, AutomationTrigger, TagTriggerConfig } from './types';

/**
 * Tag trigger payload passed when a tag is added or removed from a contact.
 */
export interface TagTriggerPayload {
  contactId: string;
  contactType: 'school' | 'prospect';
  tagId: string;
  tagName: string;
  workspaceId: string;
  appliedBy: string; // userId
}

/**
 * Fires TAG_ADDED or TAG_REMOVED automations for a given tag change.
 *
 * Queries all active AutomationRules with the matching trigger, then filters
 * by TagTriggerConfig (tagIds list and optional contactType / appliedBy).
 * Matching rules are executed via the server-side automation runner.
 *
 * Updated for workspace awareness (Requirement 10.3)
 * Uses workspaceId from workspace_entities record where tag was applied
 *
 * Requirements: FR4.1.1, FR4.1.2, FR4.1.3, Requirement 10.3
 */
export async function fireTagTrigger(
  trigger: 'TAG_ADDED' | 'TAG_REMOVED',
  payload: TagTriggerPayload
): Promise<void> {
  try {
    // Query active automation rules for this trigger
    const rulesSnap = await adminDb
      .collection('automations')
      .where('trigger', '==', trigger)
      .where('isActive', '==', true)
      .get();

    if (rulesSnap.empty) return;

    for (const ruleDoc of rulesSnap.docs) {
      const rule = { id: ruleDoc.id, ...ruleDoc.data() } as AutomationRule;

      // Workspace check: rule must cover the contact's workspace (Requirement 10.2)
      if (rule.workspaceIds && rule.workspaceIds.length > 0) {
        if (!rule.workspaceIds.includes(payload.workspaceId)) continue;
      }

      // TagTriggerConfig filtering (FR4.1.2, FR4.1.3)
      const config = rule.triggerConfig as TagTriggerConfig | undefined;
      if (config) {
        // Filter by specific tag IDs (empty array = any tag)
        if (config.tagIds && config.tagIds.length > 0) {
          if (!config.tagIds.includes(payload.tagId)) continue;
        }

        // Filter by contact type
        if (config.contactType && config.contactType !== payload.contactType) continue;

        // Filter by how the tag was applied
        // 'manual' means applied by a real user (userId doesn't start with 'system')
        // 'automatic' means applied by automation/system
        if (config.appliedBy) {
          const isAutomatic = payload.appliedBy.startsWith('system') || payload.appliedBy === 'automation';
          if (config.appliedBy === 'manual' && isAutomatic) continue;
          if (config.appliedBy === 'automatic' && !isAutomatic) continue;
        }
      }

      // Execute the matched automation rule
      await executeTagAutomationRule(rule, payload);
    }
  } catch (error) {
    console.error(`[TAG_TRIGGER] Failed to fire ${trigger}:`, error);
    // Non-blocking: tag trigger failures should not break the tag operation
  }
}

/**
 * Executes the actions of a matched automation rule for a tag trigger event.
 * Updated for workspace awareness (Requirement 10.4)
 */
async function executeTagAutomationRule(
  rule: AutomationRule,
  payload: TagTriggerPayload
): Promise<void> {
  console.log(`[TAG_TRIGGER] Executing rule "${rule.name}" for contact ${payload.contactId}`);

  for (const action of rule.actions) {
    try {
      switch (action.type) {
        case 'CREATE_TASK': {
          if (!action.taskTitle) break;
          const { addDays } = await import('date-fns');
          const dueDate = addDays(new Date(), action.taskDueOffsetDays ?? 1).toISOString();

          const taskRef = adminDb.collection('tasks').doc();
          await taskRef.set({
            id: taskRef.id,
            workspaceId: payload.workspaceId, // Requirement 10.4
            title: action.taskTitle,
            description: action.taskDescription || `Triggered by ${rule.trigger} on tag ${payload.tagName}`,
            priority: action.taskPriority || 'medium',
            status: 'todo',
            category: action.taskCategory || 'general',
            entityId: payload.contactType === 'school' ? payload.contactId : null,
            entityName: null,
            assignedTo: '',
            dueDate,
            source: 'automation',
            automationId: rule.id,
            reminders: [],
            reminderSent: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          break;
        }

        case 'SEND_MESSAGE': {
          // Message sending requires recipient resolution; log for now
          // Full implementation handled by messaging engine integration
          console.log(`[TAG_TRIGGER] SEND_MESSAGE action for rule "${rule.name}" - requires messaging engine`);
          break;
        }

        case 'UPDATE_FIELD': {
          // Field update on the contact document
          const collection = payload.contactType === 'school' ? 'schools' : 'prospects';
          const contactRef = adminDb.collection(collection).doc(payload.contactId);
          if (action.fixedRecipient) {
            // fixedRecipient repurposed as field=value string for UPDATE_FIELD
            // e.g. "lifecycleStatus=Active"
            const [field, value] = action.fixedRecipient.split('=');
            if (field && value !== undefined) {
              await contactRef.update({ [field]: value, updatedAt: new Date().toISOString() });
            }
          }
          break;
        }

        default:
          break;
      }
    } catch (actionError) {
      console.error(`[TAG_TRIGGER] Action "${action.type}" failed for rule "${rule.name}":`, actionError);
    }
  }
}
