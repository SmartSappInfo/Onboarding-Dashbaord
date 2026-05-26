'use server';

import type { Automation } from './types';
import { canUser } from './workspace-permissions';
import type { AppPermissionAction } from './types';
import { AutomationPermissionError } from './automations/errors';

type AutomationPermissionAction = 'create' | 'edit' | 'delete';

function toCanUserAction(action: AutomationPermissionAction): AppPermissionAction {
  if (action === 'create') return 'create';
  if (action === 'delete') return 'delete';
  return 'edit';
}

/**
 * Ensures the user may manage automations for at least one workspace on the blueprint.
 */
export async function assertAutomationManagePermission(
  userId: string,
  workspaceIds: string[] | undefined,
  action: AutomationPermissionAction
): Promise<void> {
  const permissionAction = toCanUserAction(action);
  const ids = workspaceIds?.filter(Boolean) ?? [];

  if (ids.length === 0) {
    const global = await canUser(userId, 'operations', 'automations', permissionAction);
    if (!global.granted) {
      throw new AutomationPermissionError(
        global.reason || 'You do not have permission to manage automations.'
      );
    }
    return;
  }

  for (const workspaceId of ids) {
    const result = await canUser(userId, 'operations', 'automations', permissionAction, workspaceId);
    if (result.granted) return;
  }

  throw new AutomationPermissionError(
    'You do not have permission to manage automations in these workspaces.'
  );
}

export async function loadAutomationForAuth(automationId: string): Promise<Automation | null> {
  const { getAutomationById } = await import('./automations/repository');
  return getAutomationById(automationId);
}
