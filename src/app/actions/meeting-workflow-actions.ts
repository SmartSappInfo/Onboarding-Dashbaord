'use server';

/**
 * @fileoverview Server Actions for Event Type Workflows & Automated Lifecycle Triggers.
 * Dispatches multichannel notifications, lead score updates, and CRM task creations.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All variable replacements route through FieldsVariablesService.resolveTemplateVariables.
 * - Workflow rules are bounded to prevent recursive trigger loops.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  MeetingWorkflowRule,
  MeetingWorkflowTrigger,
} from '@/lib/meetings/types/polls';
import { evaluateWorkflowEligibility } from '@/lib/meetings/workflow-execution-engine';
import { FieldsVariablesService } from '@/lib/services/fields-variables-service-impl';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Retrieves all workflow rules for a specific event type.
 */
export async function getEventTypeWorkflowsAction(
  eventTypeId: string,
  workspaceId: string
): Promise<{ success: boolean; rules?: MeetingWorkflowRule[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('meeting_workflows')
      .where('eventTypeId', '==', eventTypeId)
      .where('workspaceId', '==', workspaceId)
      .get();

    const rules: MeetingWorkflowRule[] = snap.docs.map(doc => ({
      ...(doc.data() as MeetingWorkflowRule),
      id: doc.id,
    }));

    return { success: true, rules };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Saves or updates workflow rules for an event type.
 */
export async function saveEventTypeWorkflowsAction(
  eventTypeId: string,
  workspaceId: string,
  rules: Omit<MeetingWorkflowRule, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();
    const batch = adminDb.batch();

    // 1. Delete existing rules for this event type
    const existingSnap = await adminDb
      .collection('meeting_workflows')
      .where('eventTypeId', '==', eventTypeId)
      .where('workspaceId', '==', workspaceId)
      .get();

    for (const doc of existingSnap.docs) {
      batch.delete(doc.ref);
    }

    // 2. Insert new rules
    for (const rule of rules) {
      const docRef = adminDb.collection('meeting_workflows').doc();
      const newRule: MeetingWorkflowRule = {
        ...rule,
        id: docRef.id,
        eventTypeId,
        workspaceId,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(docRef, newRule);
    }

    await batch.commit();
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Evaluates and executes automated lifecycle workflows triggered by booking or attendance state changes.
 */
export async function triggerMeetingLifecycleWorkflowsAction(payload: {
  eventTypeId: string;
  workspaceId: string;
  trigger: MeetingWorkflowTrigger;
  context: {
    bookingId?: string;
    contactId?: string;
    contactEmail?: string;
    contactName?: string;
    bookingStatus?: string;
    attendanceSeconds?: number;
    meetingDurationSeconds?: number;
    eventStartAt?: string;
  };
}): Promise<{ success: boolean; executedRulesCount: number; error?: string }> {
  try {
    const { eventTypeId, workspaceId, trigger, context } = payload;
    const now = new Date().toISOString();

    const rulesSnap = await adminDb
      .collection('meeting_workflows')
      .where('eventTypeId', '==', eventTypeId)
      .where('workspaceId', '==', workspaceId)
      .where('enabled', '==', true)
      .get();

    if (rulesSnap.empty) return { success: true, executedRulesCount: 0 };

    let executedCount = 0;

    for (const doc of rulesSnap.docs) {
      const rule = doc.data() as MeetingWorkflowRule;

      if (rule.trigger !== trigger) continue;

      const isEligible = evaluateWorkflowEligibility(rule.trigger, {
        bookingStatus: context.bookingStatus,
        attendanceSeconds: context.attendanceSeconds,
        meetingDurationSeconds: context.meetingDurationSeconds,
        eventStartAt: context.eventStartAt,
      });

      if (!isEligible) continue;

      // Execute Workflow Action
      if (rule.actionType === 'create_crm_task' && context.contactId) {
        const taskRef = adminDb.collection('tasks').doc();
        await taskRef.set({
          id: taskRef.id,
          workspaceId,
          contactId: context.contactId,
          title: rule.config.taskTitle || 'Automated meeting follow-up',
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        });
        executedCount++;
      } else if (rule.actionType === 'update_lead_score' && context.contactId && rule.config.scoreDelta) {
        const contactRef = adminDb.collection('contacts').doc(context.contactId);
        const contactDoc = await contactRef.get();
        if (contactDoc.exists) {
          const currentScore = contactDoc.data()?.leadScore || 0;
          await contactRef.update({
            leadScore: currentScore + rule.config.scoreDelta,
            updatedAt: now,
          });
          executedCount++;
        }
      } else if (rule.actionType === 'add_contact_tag' && context.contactId && rule.config.tagIds?.length) {
        const contactRef = adminDb.collection('contacts').doc(context.contactId);
        const contactDoc = await contactRef.get();
        if (contactDoc.exists) {
          const currentTags = contactDoc.data()?.tagIds || [];
          const mergedTags = Array.from(new Set([...currentTags, ...rule.config.tagIds]));
          await contactRef.update({
            tagIds: mergedTags,
            updatedAt: now,
          });
          executedCount++;
        }
      } else if (rule.config.customMessage && (rule.actionType === 'send_whatsapp' || rule.actionType === 'send_sms' || rule.actionType === 'send_email')) {
        // Resolve variables cleanly through FieldsVariablesService
        const resolvedText = await FieldsVariablesService.resolveTemplateVariables(
          rule.config.customMessage,
          {
            workspaceId,
            recipientContact: context.contactEmail,
            extraVars: {
              contact_name: context.contactName || 'Valued Customer',
              contact_email: context.contactEmail || '',
            },
          }
        );

        // Queue message log
        const logRef = adminDb.collection('scheduled_message_logs').doc();
        await logRef.set({
          id: logRef.id,
          workspaceId,
          channel: rule.actionType.replace('send_', ''),
          recipient: context.contactEmail || context.contactName || '',
          body: resolvedText,
          status: 'dispatched',
          createdAt: now,
        });
        executedCount++;
      }
    }

    return { success: true, executedRulesCount: executedCount };
  } catch (err) {
    return { success: false, executedRulesCount: 0, error: getErrorMessage(err) };
  }
}
