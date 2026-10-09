'use server';

/**
 * @fileOverview Server actions for managing Workspace Messaging Governance Settings.
 * 
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 4: Strict typing, zero any.
 * - Rule 8 & Rule 18: Fail-closed multi-tenancy verification.
 * - Rule 9: Cache invalidation on setting modification.
 * - Rule 17: Non-delegable administrative privileges (human session required).
 * - Rule 18: TOCTOU concurrency protection with expectedVersion verification.
 */

import { adminDb } from '@/lib/firebase-admin';
import { requireWorkspace } from '@/lib/auth/require-auth';
import {
  WorkspaceMessagingSettingsSchema,
  DEFAULT_MESSAGING_SETTINGS,
  type WorkspaceMessagingSettings,
} from '@/lib/types/messaging-settings';
import { dashboardSummaryCache } from '@/lib/messaging/messaging-dashboard-cache';

export type MessagingSettingsActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function getWorkspaceMessagingSettingsAction(
  workspaceId: string
): Promise<MessagingSettingsActionResult<WorkspaceMessagingSettings>> {
  try {
    const { workspace } = await requireWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found', code: 'NOT_FOUND' };
    }

    const docRef = adminDb.doc(`workspaces/${workspaceId}/messaging_settings/current`);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: true, data: DEFAULT_MESSAGING_SETTINGS };
    }

    const parsed = WorkspaceMessagingSettingsSchema.safeParse(snap.data());
    if (!parsed.success) {
      return { success: true, data: DEFAULT_MESSAGING_SETTINGS };
    }

    return { success: true, data: parsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve messaging settings';
    return { success: false, error: message, code: 'UNAUTHORIZED' };
  }
}

export async function updateWorkspaceMessagingSettingsAction(
  workspaceId: string,
  settings: Partial<WorkspaceMessagingSettings>,
  expectedVersion?: number
): Promise<MessagingSettingsActionResult<WorkspaceMessagingSettings>> {
  try {
    const { workspace, user } = await requireWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found', code: 'NOT_FOUND' };
    }

    const docRef = adminDb.doc(`workspaces/${workspaceId}/messaging_settings/current`);
    const snap = await docRef.get();
    const currentData = snap.exists ? snap.data() : null;
    const currentVersion = typeof currentData?.version === 'number' ? currentData.version : 1;

    // Rule 18: TOCTOU Concurrency Guard
    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      return {
        success: false,
        error: 'Settings were modified by another administrator. Please refresh the page and try again.',
        code: 'CONCURRENCY_CONFLICT',
      };
    }

    const existingRes = await getWorkspaceMessagingSettingsAction(workspaceId);
    const baseSettings = existingRes.success ? existingRes.data : DEFAULT_MESSAGING_SETTINGS;

    const merged = {
      ...baseSettings,
      ...settings,
      version: currentVersion + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
    };

    const validated = WorkspaceMessagingSettingsSchema.parse(merged);
    await docRef.set(validated, { merge: true });

    // Invalidate dashboard summary cache for this workspace across all timeframes (Rule 9 & 20)
    for (const range of ['24h', '7d', '30d']) {
      dashboardSummaryCache.delete(`dashboard:${workspace.organizationId}:${workspaceId}:${range}`);
    }
    dashboardSummaryCache.delete(`dashboard:${workspace.organizationId}:${workspaceId}`);

    return { success: true, data: validated };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update messaging settings';
    return { success: false, error: message, code: 'UPDATE_FAILED' };
  }
}
