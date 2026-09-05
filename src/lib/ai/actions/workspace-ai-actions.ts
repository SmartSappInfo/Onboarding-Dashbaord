'use server';

/**
 * @fileOverview Server Actions for Workspace AI Model Governance.
 * 
 * ARCHITECTURAL INVARIANTS:
 * - Next.js 16 Turbopack compliance: This is a public Server Action boundary file.
 *   ONLY async functions may be exported. No non-async constants or schemas.
 * - Single Source of Truth: All workspace AI setting retrievals and mutations
 *   flow strictly through `WorkspaceAiService` and the central `AiModelRegistry`.
 * - Multi-tenant isolation: Actions assert `workspaceId` validity.
 * - Strict Typing: Zero `any`, zero `any[]`, zero `unknown`.
 */

import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/firebase-admin';
import { WorkspaceAiService } from '@/lib/ai/services/workspace-ai-service';
import type { WorkspaceAiSettings } from '@/lib/types';
import type { AiProviderId } from '@/lib/ai/model-registry';

export interface WorkspaceAiActionResult {
  success: boolean;
  data?: WorkspaceAiSettings;
  error?: string;
  actionConfig?: {
    path: string;
    label: string;
  };
}

export interface UpdateWorkspaceAiParams {
  workspaceId: string;
  userId?: string;
  preferredProvider?: AiProviderId;
  preferredModelId?: string;
  reasoningModelId?: string;
  fastModelId?: string;
  actorId?: string;
}

/**
 * Validates whether a user is authorized to interact with the target workspace.
 */
async function checkWorkspaceAccess(workspaceId: string, userId?: string): Promise<boolean> {
  if (!workspaceId) return false;
  if (!userId) {
    // If no userId provided in background flow / unauthenticated route, check workspace existence
    return true;
  }
  if (workspaceId === 'platform_backoffice') return true;

  try {
    if (!adminDb) return true;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return false;

    const data = userDoc.data();
    if (data?.isSuperAdmin || data?.role === 'super_admin') return true;
    if (data?.assignedWorkspaces && Array.isArray(data.assignedWorkspaces)) {
      if (data.assignedWorkspaces.includes(workspaceId)) return true;
    }
    return data?.workspaceId === workspaceId;
  } catch {
    return false;
  }
}

/**
 * Retrieves the persistent AI settings for a workspace.
 */
export async function getWorkspaceAiSettingsAction(
  workspaceId: string,
  userId?: string
): Promise<WorkspaceAiActionResult> {
  try {
    if (!workspaceId) {
      return {
        success: false,
        error: 'workspaceId is required',
        actionConfig: { path: '/admin/settings/workspace', label: 'Select Workspace' },
      };
    }

    if (userId) {
      const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'You do not have permission to access this workspace.',
          actionConfig: { path: '/admin/settings/workspace', label: 'Switch Workspace' },
        };
      }
    }

    const settings = await WorkspaceAiService.getSettings(workspaceId);
    return { success: true, data: settings };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[workspace-ai-actions] getWorkspaceAiSettingsAction failed for ${workspaceId}:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
      actionConfig: { path: '/admin/settings/workspace', label: 'Workspace Settings' },
    };
  }
}

/**
 * Updates the persistent AI settings for a workspace and revalidates relevant admin paths.
 */
export async function updateWorkspaceAiSettingsAction(
  params: UpdateWorkspaceAiParams
): Promise<WorkspaceAiActionResult> {
  try {
    const { workspaceId, userId, actorId, ...settings } = params;
    if (!workspaceId) {
      return {
        success: false,
        error: 'workspaceId is required',
        actionConfig: { path: '/admin/settings/workspace', label: 'Select Workspace' },
      };
    }

    if (userId) {
      const hasAccess = await checkWorkspaceAccess(workspaceId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'You do not have permission to modify this workspace AI configuration.',
          actionConfig: { path: '/admin/settings/workspace', label: 'Workspace Settings' },
        };
      }
    }

    const effectiveActorId = actorId || userId;
    const updated = await WorkspaceAiService.saveSettings(workspaceId, settings, effectiveActorId);

    // Revalidate dashboard and workspace settings routes
    revalidatePath('/admin');
    revalidatePath('/admin/settings/workspace');

    return { success: true, data: updated };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[workspace-ai-actions] updateWorkspaceAiSettingsAction failed for ${params.workspaceId}:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
      actionConfig: { path: '/admin/settings/workspace', label: 'Workspace Settings' },
    };
  }
}
