import { adminDb } from '../firebase-admin';
import type { Automation } from '../types';
import { logAutomationEvent } from '../automation-log';
import type { ExecutionContext } from './execution-types';
import { traverseNodes } from './nodes/traverse';
import {
  notifyAutomationStarted,
  notifyAutomationCompleted,
} from './automation-lifecycle-notify';

export async function executeAutomation(
  automation: Automation,
  triggerPayload: Record<string, unknown>,
  chainDepth = 0
): Promise<void> {
  const timestamp = new Date().toISOString();

  // Resolve organizationId once here so action steps don't each make a separate Firestore read
  const wsSnap = await adminDb.collection('workspaces').doc(triggerPayload.workspaceId as string).get();
  const organizationId: string = (wsSnap.data()?.organizationId as string) || '';

  const runRef = await adminDb.collection('automation_runs').add({
    automationId: automation.id,
    automationName: automation.name,
    triggerData: triggerPayload,
    status: 'running',
    startedAt: timestamp,
    entityId: triggerPayload.entityId as string | undefined,
    entityType: triggerPayload.entityType as string | undefined,
    workspaceId: triggerPayload.workspaceId as string | undefined,
  });

  // Fire aggregated started notification (fire-and-forget)
  notifyAutomationStarted({
    automationId: automation.id,
    automationName: automation.name ?? automation.id,
    workspaceId: triggerPayload.workspaceId as string ?? '',
  }).catch(() => { /* non-fatal */ });

  const context: ExecutionContext = {
    entityId: triggerPayload.entityId as string | undefined,
    entityType: triggerPayload.entityType as ExecutionContext['entityType'],
    workspaceId: triggerPayload.workspaceId as string,
    organizationId,
    payload: triggerPayload,
    automationId: automation.id,
    runId: runRef.id,
    chainDepth: (triggerPayload._chainDepth as number | undefined) ?? chainDepth,
  };

  // Trigger the AUTOMATION_ENTERED protocol event asynchronously
  try {
    const { triggerAutomationProtocols } = await import('../automation-processor');
    triggerAutomationProtocols('AUTOMATION_ENTERED', {
      automationId: automation.id,
      automationName: automation.name,
      entityId: context.entityId,
      entityType: context.entityType,
      workspaceId: context.workspaceId,
      startedAt: timestamp,
    }).catch((e) => console.error('Failed to trigger AUTOMATION_ENTERED protocols:', e));
  } catch (err) {
    console.error('Failed to import triggerAutomationProtocols:', err);
  }

  try {
    const triggerNode = automation.nodes.find((n) => n.type === 'triggerNode');
    if (!triggerNode) throw new Error('Entry point not found in blueprint.');

    await traverseNodes(triggerNode.id, automation, context);

    const activeJobs = await adminDb
      .collection('automation_jobs')
      .where('runId', '==', runRef.id)
      .where('status', '==', 'pending')
      .get();

    if (activeJobs.empty) {
      await runRef.update({
        status: 'completed',
        finishedAt: new Date().toISOString(),
      });
      // Fire aggregated completed notification (fire-and-forget)
      notifyAutomationCompleted({
        automationId: automation.id,
        automationName: automation.name ?? automation.id,
        workspaceId: triggerPayload.workspaceId as string ?? '',
      }).catch(() => { /* non-fatal */ });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logAutomationEvent('error', 'run_execution_failed', {
      automationId: automation.id,
      automationName: automation.name,
      runId: runRef.id,
      workspaceId: triggerPayload.workspaceId as string,
      entityId: triggerPayload.entityId as string | undefined,
    });
    await runRef.update({
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error: message,
    });
  }
}
