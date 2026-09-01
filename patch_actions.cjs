const fs = require('fs');
const file = 'src/lib/call-centre-actions.ts';
let content = fs.readFileSync(file, 'utf-8');

const newAction = `
export async function enqueueAndLockSingleCallAction(
  campaignId: string,
  entityId: string,
  workspaceId: string,
  userId: string,
  contactContext?: { contactId?: string; contactName?: string; phone?: string; email?: string }
): Promise<{ success: boolean; queueItem?: CallQueueItem; error?: string }> {
  const { resolveWorkspaceGuid } = await import('./automations/workspace-resolver');
  const { workspaceId: effectiveWorkspaceId } = await resolveWorkspaceGuid(workspaceId);
  const perm = await verifyPermission(userId, 'edit', effectiveWorkspaceId);
  if (!perm.granted) return { success: false, error: perm.reason };

  try {
    const result = await CallCentreService.enqueueAndLockSingleCall(
      campaignId,
      entityId,
      effectiveWorkspaceId,
      userId,
      contactContext
    );
    return result as any;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errMsg };
  }
}
`;

if (!content.includes('enqueueAndLockSingleCallAction(')) {
  content = content + '\n' + newAction;
  fs.writeFileSync(file, content);
}
