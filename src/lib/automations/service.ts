import { revalidatePath } from 'next/cache';
import type { Automation } from '../types';
import { serializeBlueprint } from '../automation-blueprint';
import { validateAutomationBlueprint } from '../automation-validation';
import { assertAutomationManagePermission } from '../automation-permissions';
import { logAutomationEvent } from '../automation-log';
import {
  AutomationNotFoundError,
  AutomationValidationError,
  assertAutomationUserId,
  toAutomationClientError,
} from './errors';
import {
  deleteAutomation,
  getAutomationById,
  persistAutomationDocument,
  setAutomationActive,
} from './repository';
import { adminDb } from '../firebase-admin';

export interface AutomationActionResult {
  success: boolean;
  id?: string;
  message?: string;
  error?: string;
}

function revalidateAutomationsHub(): void {
  try {
    revalidatePath('/admin/automations');
  } catch (e) {
    console.warn('revalidatePath ignored (expected outside Next.js request context):', e);
  }
}

/**
 * Service layer: normalize, authorize, validate, persist automation blueprints.
 */
export async function saveAutomation(
  id: string | null,
  data: Partial<Automation>,
  userId: string
): Promise<AutomationActionResult> {
  try {
    assertAutomationUserId(userId);

    const normalized = serializeBlueprint(data);

    if (normalized.nodes?.length && !normalized.triggers?.length) {
      throw new AutomationValidationError(
        'Automation blueprint must have at least one trigger configured.'
      );
    }

    const workspaceIds = normalized.workspaceIds || data.workspaceIds;

    const existing = id ? await getAutomationById(id) : null;

    if (id) {
      if (!existing) throw new AutomationNotFoundError();
      await assertAutomationManagePermission(
        userId,
        existing.workspaceIds || workspaceIds,
        'edit'
      );
    } else {
      await assertAutomationManagePermission(userId, workspaceIds, 'create');
    }

    await validateAutomationBlueprint(normalized);

    const timestamp = new Date().toISOString();
    const payload = {
      ...normalized,
      updatedAt: timestamp,
      createdBy: userId,
      ...(id ? {} : { createdAt: timestamp }),
    };

    const savedId = await persistAutomationDocument(
      id,
      payload as Record<string, unknown>,
      workspaceIds || ['onboarding']
    );

    if (id && existing) {
      // Compare delay node configs to trigger rescheduling
      const oldDelayNodes = existing.nodes?.filter((n: any) => n.type === 'delayNode') || [];
      const newDelayNodes = normalized.nodes?.filter((n: any) => n.type === 'delayNode') || [];

      const newNodesMap = new Map<string, any>(newDelayNodes.map((n: any) => [n.id, n]));
      const oldNodesMap = new Map<string, any>(oldDelayNodes.map((n: any) => [n.id, n]));

      const { reschedulePendingJobs, purgePendingJobsForNode } = await import('./reschedule');

      // Reschedule changed nodes
      for (const newNode of newDelayNodes) {
        const oldNode = oldNodesMap.get(newNode.id);
        if (oldNode) {
          const newConfig = newNode.data?.config || {};
          const oldConfig = oldNode.data?.config || {};
          const newHasChanged =
            newConfig.value !== oldConfig.value || newConfig.unit !== oldConfig.unit;

          if (newHasChanged) {
            await reschedulePendingJobs(id, newNode.id, newConfig, oldConfig);
          }
        }
      }

      // Clean up deleted delay nodes
      for (const oldNode of oldDelayNodes) {
        if (!newNodesMap.has(oldNode.id)) {
          await purgePendingJobsForNode(id, oldNode.id);
        }
      }
    }

    revalidateAutomationsHub();
    return { success: true, id: savedId };
  } catch (error) {
    logAutomationEvent('error', 'save_automation_failed', {
      automationId: id || undefined,
      error,
    });
    return { success: false, error: toAutomationClientError(error) };
  }
}

export async function removeAutomation(
  id: string,
  userId: string
): Promise<AutomationActionResult> {
  try {
    assertAutomationUserId(userId);

    const existing = await getAutomationById(id);
    if (!existing) throw new AutomationNotFoundError();
    await assertAutomationManagePermission(userId, existing.workspaceIds, 'delete');

    // Clean up all pending scheduled jobs for the deleted automation
    const { purgeAllPendingJobsForAutomation } = await import('./reschedule');
    await purgeAllPendingJobsForAutomation(id);

    await deleteAutomation(id);
    revalidateAutomationsHub();
    return { success: true };
  } catch (error) {
    logAutomationEvent('error', 'delete_automation_failed', { automationId: id, error });
    return { success: false, error: toAutomationClientError(error) };
  }
}

export async function setAutomationStatus(
  id: string,
  active: boolean,
  userId: string
): Promise<AutomationActionResult> {
  try {
    assertAutomationUserId(userId);

    const existing = await getAutomationById(id);
    if (!existing) throw new AutomationNotFoundError();
    await assertAutomationManagePermission(userId, existing.workspaceIds, 'edit');

    await setAutomationActive(id, active);
    revalidateAutomationsHub();
    return { success: true };
  } catch (error) {
    logAutomationEvent('error', 'toggle_automation_failed', { automationId: id, error });
    return { success: false, error: toAutomationClientError(error) };
  }
}

export async function seedDefaultDealAutomation(
  workspaceId: string,
  organizationId: string,
  userId: string
): Promise<AutomationActionResult> {
  try {
    assertAutomationUserId(userId);
    await assertAutomationManagePermission(userId, [workspaceId], 'create');

    const existingSnap = await adminDb
      .collection('automations')
      .where('workspaceIds', 'array-contains', workspaceId)
      .where('triggerTypes', 'array-contains', 'ENTITY_CREATED')
      .get();

    const exists = existingSnap.docs.some((doc) => {
      const docData = doc.data();
      return docData.nodes?.some(
        (n: { data?: { actionType?: string } }) => n.data?.actionType === 'CREATE_DEAL'
      );
    });

    if (exists) {
      return { success: true, message: 'Default Deal Automation already exists.' };
    }

    const timestamp = new Date().toISOString();
    const newAutomation = {
      name: 'Auto-Create Initial Deal',
      description:
        'Automatically creates a deal in the default pipeline when a new entity is created.',
      triggers: [
        { id: 'trigger_0', type: 'ENTITY_CREATED', config: {} },
      ],
      triggerTypes: ['ENTITY_CREATED'],
      workspaceIds: [workspaceId],
      organizationId,
      isActive: true,
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      nodes: [
        {
          id: 'node_trigger',
          type: 'triggerNode',
          position: { x: 250, y: 100 },
          data: { label: 'Entity Created', icon: 'Zap', trigger: 'ENTITY_CREATED' },
        },
        {
          id: 'node_action_deal',
          type: 'actionNode',
          position: { x: 250, y: 300 },
          data: {
            label: 'Create Initial Deal',
            actionType: 'CREATE_DEAL',
            config: { assignmentStrategy: 'direct' },
          },
        },
      ],
      edges: [
        {
          id: 'edge_trigger_to_deal',
          source: 'node_trigger',
          target: 'node_action_deal',
          sourceHandle: 'true',
          targetHandle: null,
        },
      ],
    };

    const docRef = await adminDb.collection('automations').add(newAutomation);
    revalidateAutomationsHub();
    return { success: true, id: docRef.id };
  } catch (error) {
    logAutomationEvent('error', 'seed_automation_failed', { workspaceId, error });
    return { success: false, error: toAutomationClientError(error) };
  }
}
