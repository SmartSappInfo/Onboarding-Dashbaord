'use server';

import { CallCentreService } from './services/call-centre-service';
import { canUser } from './workspace-permissions';
import type { CallScript, CallCampaign, CallOutcomeAutomation } from './types';
import { revalidatePath } from 'next/cache';
import { generateCallScript, refineCallScript } from './campaign-ai';
import { parseScriptExport, CFLOW_VERSION } from './call-script-portability';
import { isJsonGraph, parseGraph, sanitizeImportedAutomations } from './call-centre-graph';
import type { CallActionParams } from './types';

// Helper to check permissions
async function verifyPermission(userId: string, action: 'view' | 'create' | 'edit' | 'delete', workspaceId: string) {
  const check = await canUser(userId, 'studios', 'messaging', action, workspaceId);
  return check;
}

// ─── Call Scripts ──────────────────────────────────────────────────────────

export async function createCallScriptAction(
  data: Omit<CallScript, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  userId: string
) {
  const perm = await verifyPermission(userId, 'create', data.workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    const id = await CallCentreService.createScript({
      ...data,
      createdBy: userId,
    });
    revalidatePath('/admin/messaging/call-centre');
    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateCallScriptAction(
  id: string,
  data: Partial<CallScript> & { workspaceId: string },
  userId: string
) {
  const perm = await verifyPermission(userId, 'edit', data.workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    const { workspaceId: _, ...cleanData } = data;
    await CallCentreService.updateScript(id, cleanData);
    revalidatePath('/admin/messaging/call-centre');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteCallScriptAction(id: string, workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'delete', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    await CallCentreService.deleteScript(id);
    revalidatePath('/admin/messaging/call-centre');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getCallScriptAction(id: string, workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'view', workspaceId);
  if (!perm.granted) return null;

  try {
    return await CallCentreService.getScript(id);
  } catch {
    return null;
  }
}

/**
 * Recreate a call script from a portable `.cflow` file inside the CURRENT org/workspace.
 * Scripts are org-agnostic artifacts: any identity fields in the file are ignored, and the
 * new script is always bound to the authenticated caller's context. The raw file text is
 * re-validated server-side (the trust boundary) regardless of any client-side checks.
 */
export async function importCallScriptAction(
  rawFileText: string,
  ctx: { organizationId: string; workspaceId: string },
  userId: string
) {
  const perm = await verifyPermission(userId, 'create', ctx.workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  const parsed = parseScriptExport(rawFileText);
  if (!parsed.ok) return { success: false, error: parsed.error };

  try {
    const { name, description, content, variables } = parsed.script;
    // Security: imported scripts come from other orgs — strip org-scoped ids and
    // webhook URLs from outcome automations so they can't leak data / SSRF here.
    const safeContent = isJsonGraph(content)
      ? JSON.stringify(sanitizeImportedAutomations(parseGraph(content)))
      : content;
    const data: Omit<CallScript, 'id' | 'createdAt' | 'updatedAt'> = {
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId,
      name,
      content: safeContent,
      variables,
      createdBy: userId,
      source: 'imported',
      importMeta: {
        importedAt: new Date().toISOString(),
        originalName: name,
        formatVersion: CFLOW_VERSION,
      },
    };
    // Firestore rejects `undefined` — only set description when present.
    if (description) data.description = description;

    const id = await CallCentreService.createScript(data);
    revalidatePath('/admin/messaging/call-centre');
    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute a single script action node's side effect against a contact (live call triggering).
 * Permission-checked; entity/workspace come from the caller's authenticated context.
 */
export async function executeScriptActionAction(
  params: {
    actionType: string;
    actionConfig?: CallActionParams;
    entityId: string;
    workspaceId: string;
    organizationId: string;
    contactId?: string;
  },
  userId: string
) {
  const perm = await verifyPermission(userId, 'edit', params.workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    const result = await CallCentreService.executeScriptAction({ ...params, userId });
    if (!result.success) {
      return { success: false, error: result.error, unsupported: result.unsupported };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Action execution failed.' };
  }
}

export async function listCallScriptsAction(workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'view', workspaceId);
  if (!perm.granted) return [];

  try {
    return await CallCentreService.listScripts(workspaceId);
  } catch {
    return [];
  }
}

// ─── Call Campaigns ────────────────────────────────────────────────────────

export async function createCallCampaignAction(
  data: Omit<CallCampaign, 'id' | 'createdAt' | 'updatedAt' | 'progress' | 'createdBy'>,
  userId: string
) {
  const perm = await verifyPermission(userId, 'create', data.workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    const id = await CallCentreService.createCampaign({
      ...data,
      createdBy: userId,
    });
    revalidatePath('/admin/messaging/call-centre');
    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateCallCampaignAction(
  id: string,
  data: Partial<CallCampaign> & { workspaceId: string },
  userId: string
) {
  const perm = await verifyPermission(userId, 'edit', data.workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    const { workspaceId: _, ...cleanData } = data;
    await CallCentreService.updateCampaign(id, cleanData);
    revalidatePath('/admin/messaging/call-centre');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteCallCampaignAction(id: string, workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'delete', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    await CallCentreService.deleteCampaign(id);
    revalidatePath('/admin/messaging/call-centre');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}


export async function getCallCampaignAction(id: string, workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'view', workspaceId);
  if (!perm.granted) return null;

  try {
    return await CallCentreService.getCampaign(id);
  } catch {
    return null;
  }
}

export async function listCallCampaignsAction(workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'view', workspaceId);
  if (!perm.granted) return [];

  try {
    return await CallCentreService.listCampaigns(workspaceId);
  } catch {
    return [];
  }
}

export async function generateCampaignQueueAction(campaignId: string, workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'edit', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason, count: 0 };

  try {
    const result = await CallCentreService.generateCampaignQueue(campaignId);
    revalidatePath('/admin/messaging/call-centre');
    return result;
  } catch (error: any) {
    return { success: false, error: error.message, count: 0 };
  }
}

// ─── Queue Locking & Workspaces ───────────────────────────────────────────

export async function lockQueueItemAction(queueItemId: string, workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'edit', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    return await CallCentreService.lockQueueItem(queueItemId, userId);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function releaseQueueItemAction(queueItemId: string, workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'edit', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    await CallCentreService.releaseQueueItem(queueItemId, userId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function submitCallOutcomeAction(params: {
  queueItemId: string;
  outcome: string;
  notes: string;
  duration: number;
  agentName: string;
  workspaceId: string;
  userId: string;
  customAutomations?: CallOutcomeAutomation[];
}) {
  const { queueItemId, outcome, notes, duration, agentName, workspaceId, userId, customAutomations } = params;
  const perm = await verifyPermission(userId, 'edit', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    const result = await CallCentreService.submitOutcome({
      queueItemId,
      outcome,
      notes,
      duration,
      agentId: userId,
      agentName,
      customAutomations,
    });
    revalidatePath('/admin/messaging/call-centre');
    return result;
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Submit failed.' };
  }
}


export async function updateNotesDraftAction(
  queueItemId: string,
  notes: string,
  workspaceId: string,
  userId: string
) {
  const perm = await verifyPermission(userId, 'edit', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    await CallCentreService.updateNotesDraft(queueItemId, notes);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function skipQueueItemAction(queueItemId: string, workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'edit', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    await CallCentreService.skipQueueItem(queueItemId);
    revalidatePath('/admin/messaging/call-centre');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deferQueueItemAction(queueItemId: string, workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'edit', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    await CallCentreService.deferQueueItem(queueItemId);
    revalidatePath('/admin/messaging/call-centre');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function scheduleCallbackAction(
  queueItemId: string,
  callbackDate: string,
  workspaceId: string,
  userId: string
) {
  const perm = await verifyPermission(userId, 'edit', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    await CallCentreService.scheduleCallback(queueItemId, callbackDate);
    revalidatePath('/admin/messaging/call-centre');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── AI Call Script Generation Actions ──────────────────────────────────

export async function generateCallScriptAction(
  params: {
    campaignName: string;
    objective: string;
    targetAudience: string;
    tone: string;
    customGuidelines?: string;
    workspaceId: string;
  },
  userId: string
): Promise<{ success: boolean; script?: string; error?: string }> {
  const perm = await verifyPermission(userId, 'create', params.workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    return await generateCallScript({
      campaignName: params.campaignName,
      objective: params.objective,
      targetAudience: params.targetAudience,
      tone: params.tone,
      customGuidelines: params.customGuidelines,
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function refineCallScriptAction(
  params: {
    original: string;
    instruction: string;
    workspaceId: string;
  },
  userId: string
): Promise<{ success: boolean; refined?: string; error?: string }> {
  const perm = await verifyPermission(userId, 'edit', params.workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    return await refineCallScript({
      original: params.original,
      instruction: params.instruction,
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function cloneCallCampaignAction(campaignId: string, workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'create', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    const id = await CallCentreService.cloneCampaign(campaignId, userId);
    revalidatePath('/admin/messaging/call-centre');
    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function addContactsToCallCampaignAction(
  campaignId: string,
  entityIds: string[],
  workspaceId: string,
  userId: string,
  contactOverrides?: { entityId: string; contactId: string; contactName: string; phone: string; email: string }[],
  contactScope?: 'primary' | 'signatories' | 'all'
): Promise<{ success: boolean; count: number; error?: string }> {
  const perm = await verifyPermission(userId, 'edit', workspaceId);
  if (!perm.granted) return { success: false, count: 0, error: perm.reason };

  try {
    const result = await CallCentreService.addContactsToCampaign(
      campaignId,
      entityIds,
      workspaceId,
      userId,
      contactOverrides,
      contactScope
    );
    revalidatePath('/admin/messaging/call-centre');
    revalidatePath(`/admin/messaging/call-centre/analytics/${campaignId}`);
    return result;
  } catch (error: any) {
    return { success: false, count: 0, error: error.message };
  }
}

export async function archiveCallCampaignAction(campaignId: string, workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'edit', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    await CallCentreService.archiveCampaign(campaignId);
    revalidatePath('/admin/messaging/call-centre');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function endCallCampaignAction(campaignId: string, workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'edit', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    await CallCentreService.endCampaign(campaignId);
    revalidatePath('/admin/messaging/call-centre');
    revalidatePath(`/admin/messaging/call-centre/analytics/${campaignId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export interface ExecuteOutcomeAutomationsResult {
  type: string;
  success: boolean;
  error?: string;
}

export async function executeOutcomeAutomationsAction(
  params: {
    automations: CallOutcomeAutomation[];
    entityId: string;
    workspaceId: string;
    organizationId: string;
    contactId?: string;
  },
  userId: string
): Promise<{ success: boolean; results?: ExecuteOutcomeAutomationsResult[]; error?: string }> {
  const perm = await verifyPermission(userId, 'edit', params.workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    const promises = params.automations.map(async (auto) => {
      try {
        const result = await CallCentreService.executeScriptAction({
          actionType: auto.type,
          actionConfig: auto.params,
          entityId: params.entityId,
          userId,
          workspaceId: params.workspaceId,
          organizationId: params.organizationId,
          contactId: params.contactId,
        });
        return {
          type: auto.type,
          success: result.success,
          error: result.error,
        };
      } catch (err: unknown) {
        return {
          type: auto.type,
          success: false,
          error: err instanceof Error ? err.message : 'Execution failed.',
        };
      }
    });

    const results = await Promise.all(promises);
    return { success: true, results };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Outcome automations execution failed.',
    };
  }
}
