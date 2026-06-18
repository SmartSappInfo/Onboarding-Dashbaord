'use server';

import { CallCentreService } from './services/call-centre-service';
import { canUser } from './workspace-permissions';
import type { CallScript, CallCampaign } from './types';
import { revalidatePath } from 'next/cache';
import { generateCallScript, refineCallScript } from './campaign-ai';

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
}) {
  const { queueItemId, outcome, notes, duration, agentName, workspaceId, userId } = params;
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
    });
    revalidatePath('/admin/messaging/call-centre');
    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
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

export async function addContactsToCallCampaignAction(campaignId: string, entityIds: string[], workspaceId: string, userId: string) {
  const perm = await verifyPermission(userId, 'edit', workspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    const result = await CallCentreService.addContactsToCampaign(campaignId, entityIds, workspaceId);
    revalidatePath('/admin/messaging/call-centre');
    revalidatePath(`/admin/messaging/call-centre/analytics/${campaignId}`);
    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
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
