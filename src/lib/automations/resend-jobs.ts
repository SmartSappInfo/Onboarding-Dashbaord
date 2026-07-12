import { adminDb } from '../firebase-admin';
import type {
  Automation,
  AutomationJob,
  EntityType,
  MessageLog,
  MessageResendConfig,
  MessageResendVariant,
} from '../types';
import type { ExecutionContext } from './execution-types';
import { logAutomationEvent } from '../automation-log';

/**
 * @fileOverview Resend-on-no-engagement ("waiting card") for message steps.
 *
 * When a SEND_MESSAGE node has resend enabled, the contact is held at that node
 * instead of advancing. A scheduled engagement check (`__resend_check__` job) runs
 * after `resendDelayHours`; if the contact has not engaged (per `triggerCondition`)
 * it sends the next resend variant and reschedules, up to `maxResends`. The moment
 * the contact engages — detected at the next check, or pushed in real time by the
 * Resend webhook via {@link handleEngagementForNode} — they advance to the node's
 * children. This reuses the existing `automation_jobs` + heartbeat machinery; no
 * external scheduler is introduced.
 */

const AUTOMATION_JOBS = 'automation_jobs';
const AUTOMATION_RUNS = 'automation_runs';
const MESSAGE_LOGS = 'message_logs';
const AUTOMATIONS = 'automations';

/** Sentinel `targetNodeId` marking a job as an engagement check (not a node resume). */
export const RESEND_CHECK_SENTINEL = '__resend_check__';

/** Run states in which a pending resend check is a no-op. */
const TERMINAL_RUN_STATES = new Set(['failed', 'completed', 'terminated', 'paused']);

/** Resend bookkeeping carried on a `__resend_check__` job's payload. */
interface ResendJobMeta {
  nodeId: string;
  /** Resend attempt this check will send if the contact is still not engaged. */
  attempt: number;
  config: MessageResendConfig;
  entityId?: string;
  entityType?: EntityType;
  workspaceId: string;
  organizationId?: string;
}

function addHours(base: Date, hours: number): Date {
  const d = new Date(base);
  d.setMinutes(d.getMinutes() + Math.round(hours * 60));
  return d;
}

function readResendMeta(job: AutomationJob): ResendJobMeta | null {
  const meta = (job.payload as Record<string, unknown>)?.__resend as ResendJobMeta | undefined;
  if (!meta || !meta.nodeId || !meta.config) return null;
  return meta;
}

function contextFromMeta(job: AutomationJob, meta: ResendJobMeta): ExecutionContext {
  return {
    entityId: meta.entityId,
    entityType: meta.entityType,
    workspaceId: meta.workspaceId,
    organizationId: meta.organizationId,
    payload: job.payload as Record<string, unknown>,
    automationId: job.automationId,
    runId: job.runId,
  };
}

function pickVariant(
  variants: MessageResendVariant[] | undefined,
  attempt: number
): MessageResendVariant | undefined {
  if (!variants || variants.length === 0) return undefined;
  // attempt is 1-based; reuse the last variant when fewer variants than attempts.
  return variants[Math.min(attempt - 1, variants.length - 1)];
}

/**
 * Schedules the next engagement check after a (first or resend) send. Returns the
 * ISO time the check is due, for surfacing in the step timeline.
 */
export async function scheduleResendCheck(params: {
  context: ExecutionContext;
  nodeId: string;
  config: MessageResendConfig;
  attempt: number;
}): Promise<string> {
  const { context, nodeId, config, attempt } = params;
  const now = new Date();
  const executeAt = addHours(now, config.resendDelayHours).toISOString();

  let workspaceId = context.workspaceId;
  if (!workspaceId) {
    const autoSnap = await adminDb.collection('automations').doc(context.automationId).get();
    workspaceId = autoSnap.data()?.workspaceIds?.[0];
  }
  if (!workspaceId) {
    workspaceId = 'onboarding';
  }

  const meta: ResendJobMeta = {
    nodeId,
    attempt,
    config,
    entityId: context.entityId,
    entityType: context.entityType,
    workspaceId,
    organizationId: context.organizationId,
  };

  await adminDb.collection(AUTOMATION_JOBS).add({
    automationId: context.automationId,
    runId: context.runId,
    targetNodeId: RESEND_CHECK_SENTINEL,
    payload: { ...context.payload, __resend: meta },
    workspaceId,
    executeAt,
    status: 'pending',
    createdAt: now.toISOString(),
  });

  return executeAt;
}

/** True when at least one message at this run+node satisfies the trigger condition. */
async function isNodeEngaged(
  runId: string,
  nodeId: string,
  condition: MessageResendConfig['triggerCondition']
): Promise<boolean> {
  // Query by runId only (single-field index) and filter the node in memory — a run
  // has few logs, so this avoids a composite index.
  const snap = await adminDb.collection(MESSAGE_LOGS).where('runId', '==', runId).get();
  for (const doc of snap.docs) {
    const log = doc.data() as MessageLog;
    if (log.nodeId !== nodeId) continue;
    if (condition === 'no_click') {
      if (log.clickedAt) return true;
    } else if (log.openedAt || log.clickedAt) {
      return true;
    }
  }
  return false;
}

/** Cancels pending `__resend_check__` jobs for a run+node (except an optional current job). */
async function cancelPendingResendChecks(
  runId: string,
  nodeId: string,
  exceptJobId?: string
): Promise<void> {
  const snap = await adminDb.collection(AUTOMATION_JOBS).where('runId', '==', runId).get();
  const batch = adminDb.batch();
  let count = 0;
  for (const doc of snap.docs) {
    if (doc.id === exceptJobId) continue;
    const data = doc.data();
    if (data.status !== 'pending' || data.targetNodeId !== RESEND_CHECK_SENTINEL) continue;
    const meta = (data.payload as Record<string, unknown>)?.__resend as ResendJobMeta | undefined;
    if (meta?.nodeId !== nodeId) continue;
    batch.update(doc.ref, { status: 'cancelled', finishedAt: new Date().toISOString() });
    count++;
  }
  if (count > 0) await batch.commit();
}

/** Releases the contact from the waiting card by resuming traversal at the node's children. */
async function advanceFromNode(
  automationId: string,
  runId: string,
  nodeId: string,
  payload: Record<string, unknown>,
  currentJobId?: string
): Promise<void> {
  await cancelPendingResendChecks(runId, nodeId, currentJobId);
  const now = new Date().toISOString();
  let workspaceId = payload.workspaceId as string | undefined;
  if (!workspaceId) {
    const autoSnap = await adminDb.collection('automations').doc(automationId).get();
    workspaceId = autoSnap.data()?.workspaceIds?.[0];
  }
  if (!workspaceId) {
    workspaceId = 'onboarding';
  }

  await adminDb.collection(AUTOMATION_JOBS).add({
    automationId,
    runId,
    targetNodeId: nodeId,
    payload,
    workspaceId,
    executeAt: now,
    status: 'pending',
    createdAt: now,
  });
}

/** Sends the resend for the given attempt, reusing the node's normal send logic. */
async function sendResend(job: AutomationJob, meta: ResendJobMeta): Promise<void> {
  const autoSnap = await adminDb.collection(AUTOMATIONS).doc(job.automationId).get();
  if (!autoSnap.exists) throw new Error(`Automation ${job.automationId} not found for resend`);
  const automation = { id: autoSnap.id, ...autoSnap.data() } as Automation;
  const node = automation.nodes.find((n) => n.id === meta.nodeId);
  if (!node) throw new Error(`Resend node ${meta.nodeId} not found in automation`);

  const variant = pickVariant(meta.config.variants, meta.attempt);
  const context = contextFromMeta(job, meta);
  const config = (node.data?.config ?? {}) as Record<string, unknown>;

  // Resolve template variables in the resend variant's title (subject) and previewText
  let resolvedSubject = variant?.title;
  let resolvedPreviewText = variant?.previewText;

  if (resolvedSubject || resolvedPreviewText) {
    const { FieldsVariablesService } = await import('../services/fields-variables-service-impl');
    const varContext = {
      workspaceId: meta.workspaceId,
      entityId: meta.entityId || undefined,
      recipientContact: (job.payload?.recipient || job.payload?.email || job.payload?.phone) as string | undefined,
      extraVars: job.payload as Record<string, unknown>,
      meetingId: (job.payload.meetingId || job.payload.meeting_id || job.payload.id) as string | undefined,
      formId: (job.payload.formId || job.payload.form_id || job.payload.pdfId) as string | undefined,
      surveyId: (job.payload.surveyId || job.payload.survey_id) as string | undefined,
      agreementId: (job.payload.agreementId || job.payload.agreement_id || job.payload.contractId) as string | undefined,
      responseId: (job.payload.responseId || job.payload.response_id) as string | undefined,
      submissionId: (job.payload.submissionId || job.payload.submission_id) as string | undefined,
      userId: (job.payload.userId || job.payload.user_id) as string | undefined,
    };

    if (resolvedSubject && resolvedSubject.includes('{{')) {
      resolvedSubject = await FieldsVariablesService.resolveTemplateVariables(resolvedSubject, varContext);
    }
    if (resolvedPreviewText && resolvedPreviewText.includes('{{')) {
      resolvedPreviewText = await FieldsVariablesService.resolveTemplateVariables(resolvedPreviewText, varContext);
    }
  }

  // Resolve target resend channel (failover)
  const baseChannel = (config.channel as 'email' | 'sms' | 'whatsapp') || 'email';
  const targetChannel = meta.config.resendChannel && meta.config.resendChannel !== 'same'
    ? meta.config.resendChannel
    : baseChannel;

  const sendConfig = {
    ...config,
    channel: targetChannel,
  };

  const { handleSendMessage } = await import('./actions/message-actions');
  await handleSendMessage(sendConfig, context, node.id, {
    subject: resolvedSubject,
    previewText: resolvedPreviewText,
    isResend: true,
    resendNumber: meta.attempt,
  });
}

/**
 * Heartbeat handler for a `__resend_check__` job. Returns true once the check has
 * been fully handled (the heartbeat then finalizes the job as completed).
 */
export async function processResendCheck(job: AutomationJob): Promise<boolean> {
  const meta = readResendMeta(job);
  if (!meta) {
    console.warn(`[RESEND] check job ${job.id} missing resend metadata; skipping.`);
    return true;
  }

  const runSnap = await adminDb.collection(AUTOMATION_RUNS).doc(job.runId).get();
  if (!runSnap.exists) return true;
  const runStatus = (runSnap.data()?.status as string | undefined) ?? 'running';
  if (TERMINAL_RUN_STATES.has(runStatus)) return true;

  // Engaged → release the contact to the next step.
  if (await isNodeEngaged(job.runId, meta.nodeId, meta.config.triggerCondition)) {
    await advanceFromNode(job.automationId, job.runId, meta.nodeId, job.payload, job.id);
    return true;
  }

  // Still attempts remaining → send the next resend and reschedule.
  if (meta.attempt <= meta.config.maxResends) {
    try {
      await sendResend(job, meta);
    } catch (e) {
      logAutomationEvent('error', 'resend_send_failed', {
        runId: job.runId,
        nodeId: meta.nodeId,
        attempt: meta.attempt,
        error: e instanceof Error ? e.message : String(e),
      });
      // Non-fatal: fall through to reschedule so the cycle isn't left stuck.
    }
    await scheduleResendCheck({
      context: contextFromMeta(job, meta),
      nodeId: meta.nodeId,
      config: meta.config,
      attempt: meta.attempt + 1,
    });
    return true;
  }

  // Exhausted all resends → advance.
  await advanceFromNode(job.automationId, job.runId, meta.nodeId, job.payload, job.id);
  return true;
}

/**
 * Real-time engagement hook called by the Resend webhook. Advances the contact
 * immediately when an open/click satisfies the node's trigger condition, instead
 * of waiting for the next scheduled check. No-op when the node isn't waiting.
 */
export async function handleEngagementForNode(
  runId: string,
  nodeId: string,
  engagement: 'opened' | 'clicked'
): Promise<void> {
  const snap = await adminDb.collection(AUTOMATION_JOBS).where('runId', '==', runId).get();

  const pending = snap.docs.find((doc) => {
    const data = doc.data();
    if (data.status !== 'pending' || data.targetNodeId !== RESEND_CHECK_SENTINEL) return false;
    const meta = (data.payload as Record<string, unknown>)?.__resend as ResendJobMeta | undefined;
    return meta?.nodeId === nodeId;
  });
  if (!pending) return; // Not waiting at this node — nothing to do.

  const meta = (pending.data().payload as Record<string, unknown>).__resend as ResendJobMeta;
  const satisfies =
    engagement === 'clicked' ||
    (engagement === 'opened' && meta.config.triggerCondition === 'no_open');
  if (!satisfies) return; // Opened but the node is waiting for a click — keep waiting.

  // Atomically consume the pending check so only one path advances the contact.
  const claimed = await adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(pending.ref);
    if (!fresh.exists || fresh.data()?.status !== 'pending') return false;
    tx.update(pending.ref, { status: 'cancelled', finishedAt: new Date().toISOString() });
    return true;
  });
  if (!claimed) return;

  await advanceFromNode(
    pending.data().automationId as string,
    runId,
    nodeId,
    (pending.data().payload as Record<string, unknown>) ?? {},
    pending.id
  );
}
