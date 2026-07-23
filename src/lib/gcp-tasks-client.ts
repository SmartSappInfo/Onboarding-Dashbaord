import type { CloudTasksClient } from '@google-cloud/tasks';
import { adminDb } from './firebase-admin';

// Configurations
const PROJECT = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '';
const LOCATION = process.env.GCP_LOCATION || 'us-central1';
const SECRET = process.env.CLOUD_TASKS_SECRET || 'cc6442af1b849d2250ab115c340ac11b7635b0a27c47d98741659fb98c7f1aaf';
const BASE_URL = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'production' ? 'https://go.smartsapp.com' : 'http://127.0.0.1:3000');
const QUEUE_PREFIX = process.env.GCP_QUEUE_PREFIX ? `${process.env.GCP_QUEUE_PREFIX}-` : '';

async function resolvePublicBaseUrl(): Promise<string> {
  const envUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  return 'https://go.smartsapp.com';
}

async function resolveRequestBaseUrl(): Promise<string> {
  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host');
    if (host) {
      const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
      const proto = isLocal ? 'http' : (headersList.get('x-forwarded-proto') || 'https');
      return `${proto}://${host}`;
    }
  } catch {
    // Fallback when called outside Next.js request context (e.g. background scripts)
  }
  return BASE_URL;
}

// Global cache for local mock timers in emulator mode (Next.js HMR-resilient)
const globalRef = globalThis as unknown as { localTimers?: Map<string, NodeJS.Timeout> };
if (!globalRef.localTimers) {
  globalRef.localTimers = new Map<string, NodeJS.Timeout>();
}
const localTimers = globalRef.localTimers;

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 200
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      const code = err.code ?? 0;
      const status = err.status ?? 0;
      // Transient codes: 8 (RESOURCE_EXHAUSTED), 14 (UNAVAILABLE). Statuses: 429, 503
      const isTransient = code === 8 || code === 14 || status === 429 || status === 503;
      if (!isTransient || attempt >= maxRetries) {
        throw err;
      }
      const delay = initialDelayMs * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
      console.warn(`[GCP-TASKS] Transient error (code: ${code || status}), retrying attempt ${attempt} in ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function isQueueNotFoundError(err: unknown): boolean {
  if (!err) return false;
  const errorObj = err as { code?: number; status?: number; message?: string; details?: string };
  const message = String(errorObj.message || errorObj.details || '');
  const code = errorObj.code ?? errorObj.status ?? 0;
  return (
    code === 5 ||
    message.includes('NOT_FOUND') ||
    message.includes('Queue does not exist') ||
    message.includes('5 NOT_FOUND')
  );
}

async function dispatchLocalHttpWorker(endpoint: string, payload: Record<string, unknown>, taskKey: string) {
  try {
    const resolvedBaseUrl = await resolveRequestBaseUrl();
    console.warn(`[GCP-TASKS-FALLBACK] Cloud Tasks queue not available. Executing fallback HTTP dispatch for task "${taskKey}" to endpoint "${endpoint}"`);
    setTimeout(async () => {
      try {
        const response = await fetch(`${resolvedBaseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cloud-tasks-secret': SECRET,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const text = await response.text();
          console.error(`[GCP-TASKS-FALLBACK] Worker ${endpoint} returned error: ${response.status} - ${text}`);
        } else {
          console.info(`[GCP-TASKS-FALLBACK] Worker ${endpoint} executed task ${taskKey} successfully.`);
        }
      } catch (fetchErr) {
        try {
          const altHost = resolvedBaseUrl.includes('127.0.0.1')
            ? resolvedBaseUrl.replace('127.0.0.1', 'localhost')
            : resolvedBaseUrl.includes('localhost')
            ? resolvedBaseUrl.replace('localhost', '127.0.0.1')
            : null;
          if (altHost) {
            const altRes = await fetch(`${altHost}${endpoint}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-cloud-tasks-secret': SECRET,
              },
              body: JSON.stringify(payload),
            });
            if (altRes.ok) {
              console.info(`[GCP-TASKS-FALLBACK] Worker ${endpoint} executed task ${taskKey} successfully via fallback ${altHost}.`);
              return;
            }
          }
        } catch {}
        console.error(`[GCP-TASKS-FALLBACK] Network error executing worker ${endpoint} for task ${taskKey}:`, fetchErr);
      }
    }, 10);
  } catch (err) {
    console.error(`[GCP-TASKS-FALLBACK] Error initiating local HTTP worker for task ${taskKey}:`, err);
  }
}

// Instantiate Cloud Tasks Client safely and dynamically to prevent bundler errors
let clientInstance: CloudTasksClient | null = null;
let isInitialized = false;

const isEmulator = 
  process.env.USE_GCP_TASKS_EMULATOR === 'true' || 
  !PROJECT || 
  (process.env.NODE_ENV !== 'production' && !process.env.GOOGLE_APPLICATION_CREDENTIALS);

async function getCloudTasksClient(): Promise<CloudTasksClient | null> {
  if (isInitialized) {
    return clientInstance;
  }

  if (!isEmulator) {
    try {
      const { CloudTasksClient: Constructor } = await import('@google-cloud/tasks');
      clientInstance = new Constructor();
    } catch (err) {
      console.warn('[GCP-TASKS] Failed to initialize Google Cloud Tasks client. Falling back to EMULATOR mode.', err);
    }
  } else {
    console.info('[GCP-TASKS] Running in EMULATOR mode (Local development). Tasks will execute using local timers.');
  }

  isInitialized = true;
  return clientInstance;
}

export type QueueChannel = 'email' | 'sms' | 'whatsapp' | 'bulk';

export interface ScheduleTaskOptions {
  runId: string;
  nodeId: string;
  automationId: string;
  executeAt: string;
  workspaceId: string;
  channel?: QueueChannel;
  payload?: Record<string, unknown>;
  skipDbUpdate?: boolean;
  gcpTaskName?: string;
  sourceNodeId?: string;
}

/**
 * Strictly maps untyped inputs to valid QueueChannel options.
 */
export function parseQueueChannel(channel: unknown): QueueChannel | undefined {
  if (channel === 'email' || channel === 'sms' || channel === 'whatsapp' || channel === 'bulk') {
    return channel;
  }
  return undefined;
}

/**
 * Resolves the queue name based on the delivery channel and environment prefix.
 */
function getQueueName(channel?: QueueChannel): string {
  const suffix = channel === 'email' ? 'email-delivery-queue' :
                 channel === 'sms' ? 'sms-delivery-queue' :
                 channel === 'whatsapp' ? 'whatsapp-delivery-queue' :
                 channel === 'bulk' ? 'bulk-trigger-queue-v2' :
                 'default-delivery-queue';
  return `${QUEUE_PREFIX}${suffix}`;
}

/**
 * Generates a sanitized task identifier matching GCP Regex requirements ^[a-zA-Z0-9_-]+$
 */
function getTaskKey(runId: string, nodeId: string): string {
  return `task_${runId}_${nodeId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/**
 * Coerces any executeAt representation into an ISO string.
 *
 * `automation_jobs.executeAt` MUST be an ISO string: the heartbeat sweeps due work
 * with `.where('executeAt', '<=', new Date().toISOString())`, and Firestore orders
 * values by type before value — a string bound never matches a Timestamp field, so
 * a job stored with a Timestamp becomes permanently invisible to the heartbeat and
 * the contact is parked forever. Call sites that pass an existing job's `executeAt`
 * straight through (resume/migration paths) are typed as `string` but receive
 * untyped Firestore data, so normalize here where every job doc is written.
 */
function toExecuteAtIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  throw new Error(`Cannot schedule task: unsupported executeAt value ${JSON.stringify(value)}`);
}

/**
 * Schedules a delayed resume task in Google Cloud Tasks (or falls back to local timeout emulator).
 */
export async function scheduleDelayTask({
  runId,
  nodeId,
  automationId,
  executeAt: rawExecuteAt,
  workspaceId,
  channel,
  payload = {},
  skipDbUpdate = false,
  gcpTaskName,
  sourceNodeId,
}: ScheduleTaskOptions): Promise<string> {
  if (!workspaceId) {
    throw new Error(`Cannot schedule delay task for run ${runId}: workspaceId is required.`);
  }
  const executeAt = toExecuteAtIso(rawExecuteAt);
  const taskKey = getTaskKey(runId, nodeId);
  const queue = getQueueName(channel);
  const client = await getCloudTasksClient();
  const resolvedBaseUrl = await resolveRequestBaseUrl();

  if (isEmulator || !client) {
    // Emulator mode: Schedule using Node setTimeout
    console.info(`[GCP-TASKS-EMULATOR] Scheduling task ${taskKey} on queue "${queue}" for ${executeAt}`);
    
    // Cancel existing timer if any
    const existingTimer = localTimers.get(taskKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const delayMs = new Date(executeAt).getTime() - Date.now();
    const timer = setTimeout(async () => {
      localTimers.delete(taskKey);
      console.info(`[GCP-TASKS-EMULATOR] Triggering execution for task ${taskKey}`);
      try {
        const response = await fetch(`${resolvedBaseUrl}/api/automations/resume`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cloud-tasks-secret': SECRET,
          },
          body: JSON.stringify({ runId, nodeId, automationId, payload }),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`[GCP-TASKS-EMULATOR] Worker returned error: ${response.status} - ${text}`);
        } else {
          console.info(`[GCP-TASKS-EMULATOR] Worker executed task ${taskKey} successfully.`);
        }
      } catch (err) {
        console.error(`[GCP-TASKS-EMULATOR] Network error executing task ${taskKey}:`, err);
      }
    }, Math.max(0, delayMs));

    localTimers.set(taskKey, timer);

    // Save job audit reference in Firestore
    if (!skipDbUpdate) {
      await adminDb.collection('automation_jobs').doc(taskKey).set({
        id: taskKey,
        runId,
        automationId,
        targetNodeId: nodeId,
        // Defaults to nodeId: for every scheduleDelayTask caller the node being
        // scheduled IS the node the contact is parked at. Without this, resume /
        // migration paths write null and the designer's per-node "N Contacts"
        // badge — which groups by sourceNodeId — silently omits those contacts.
        sourceNodeId: sourceNodeId || nodeId,
        payload,
        workspaceId,
        status: 'pending',
        executeAt,
        queue,
        type: 'gcp_task_mock',
        createdAt: new Date().toISOString(),
      });
    }

    return taskKey;
  }

  // Production GCP Cloud Tasks Mode
  const parent = client.queuePath(PROJECT, LOCATION, queue);
  const uniqueTaskKey = `${taskKey}_${Date.now()}`;
  const formattedTaskName = client.taskPath(PROJECT, LOCATION, queue, uniqueTaskKey);
  const scheduleTimeSeconds = Math.floor(new Date(executeAt).getTime() / 1000);

  const taskPayload = {
    runId,
    nodeId,
    automationId,
    payload,
  };

  const publicBaseUrl = await resolvePublicBaseUrl();

  const task = {
    name: formattedTaskName,
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `${publicBaseUrl}/api/automations/resume`,
      headers: {
        'Content-Type': 'application/json',
        'x-cloud-tasks-secret': SECRET,
      },
      body: Buffer.from(JSON.stringify(taskPayload)).toString('base64'),
    },
    scheduleTime: {
      seconds: scheduleTimeSeconds,
    },
  };

  try {
    // Delete existing task if present to enforce reschedule idempotence
    await cancelDelayTask(runId, nodeId, channel, skipDbUpdate, gcpTaskName);
  } catch {
    // Non-fatal if the task did not exist
  }

  try {
    const [response] = await executeWithRetry(() => client.createTask({ parent, task }));
    console.info(`[GCP-TASKS] Scheduled task ${response.name} for ${executeAt}`);

    // Create audit log job document in Firestore
    if (!skipDbUpdate) {
      await adminDb.collection('automation_jobs').doc(taskKey).set({
        id: taskKey,
        runId,
        automationId,
        targetNodeId: nodeId,
        sourceNodeId: sourceNodeId || nodeId,
        payload,
        workspaceId,
        status: 'pending',
        executeAt,
        queue,
        type: 'gcp_task',
        createdAt: new Date().toISOString(),
        gcpTaskName: response.name, // Store actual GCP task name for robust cancellation
      });
    }

    return response.name || taskKey;
  } catch (err) {
    if (isQueueNotFoundError(err)) {
      void dispatchLocalHttpWorker('/api/automations/resume', taskPayload, taskKey);
      if (!skipDbUpdate) {
        await adminDb.collection('automation_jobs').doc(taskKey).set({
          id: taskKey,
          runId,
          automationId,
          targetNodeId: nodeId,
          sourceNodeId: sourceNodeId || nodeId,
          payload,
          workspaceId,
          status: 'pending',
          executeAt,
          queue,
          type: 'gcp_task_fallback',
          createdAt: new Date().toISOString(),
          gcpTaskName: taskKey,
        });
      }
      return taskKey;
    }
    throw err;
  }
}

/**
 * Cancels a scheduled task in Google Cloud Tasks (or deletes the local mock timer).
 */
export async function cancelDelayTask(
  runId: string,
  nodeId: string,
  channel?: QueueChannel,
  skipDbUpdate = false,
  gcpTaskName?: string
): Promise<void> {
  const taskKey = getTaskKey(runId, nodeId);
  const queue = getQueueName(channel);
  const client = await getCloudTasksClient();

  const existingTimer = localTimers.get(taskKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
    localTimers.delete(taskKey);
    console.info(`[GCP-TASKS-EMULATOR] Cancelled local task: ${taskKey}`);
  }

  if (isEmulator || !client) {
    // Update audit state
    if (!skipDbUpdate) {
      await adminDb.collection('automation_jobs').doc(taskKey).update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
      }).catch(() => {});
    }
    return;
  }

  let taskPath: string;
  if (gcpTaskName) {
    taskPath = gcpTaskName;
  } else {
    // Attempt lookup from DB
    let resolvedTaskName: string | undefined;
    try {
      const snap = await adminDb.collection('automation_jobs').doc(taskKey).get();
      if (snap.exists) {
        resolvedTaskName = snap.data()?.gcpTaskName as string | undefined;
      }
    } catch {}
    taskPath = resolvedTaskName || client.taskPath(PROJECT, LOCATION, queue, taskKey);
  }

  try {
    await executeWithRetry(() => client.deleteTask({ name: taskPath }));
    console.info(`[GCP-TASKS] Deleted remote task: ${taskPath}`);
  } catch (err: any) {
    // code 5 corresponds to NOT_FOUND
    if (err.code !== 5) {
      throw err;
    }
  }

  // Update audit state
  if (!skipDbUpdate) {
    await adminDb.collection('automation_jobs').doc(taskKey).update({
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    }).catch(() => {});
  }
}

/**
 * Reschedules a scheduled task by canceling and recreating it.
 */
export async function rescheduleDelayTask(options: ScheduleTaskOptions): Promise<string> {
  // Safe cancel, then schedule new
  await cancelDelayTask(options.runId, options.nodeId, options.channel, options.skipDbUpdate, options.gcpTaskName).catch(() => {});
  return scheduleDelayTask(options);
}

export interface BulkTriggerTaskOptions {
  automationId: string;
  workspaceId: string;
  organizationId: string;
  trigger: string;
  targets: Array<{
    entityId: string;
    entityType: string;
    payload: Record<string, unknown>;
  }>;
}

/**
 * Schedules a bulk automation trigger task (used for fanning out 10,000+ contact triggers).
 */
export async function scheduleBulkTriggerTask({
  automationId,
  workspaceId,
  organizationId,
  trigger,
  targets,
}: BulkTriggerTaskOptions): Promise<string> {
  const uuid = Math.random().toString(36).substring(2, 15);
  const taskKey = `bulk_trigger_${automationId}_${uuid}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  const queue = getQueueName('bulk');
  const client = await getCloudTasksClient();
  const resolvedBaseUrl = await resolveRequestBaseUrl();

  if (isEmulator || !client) {
    console.info(`[GCP-TASKS-EMULATOR] Scheduling bulk trigger task ${taskKey} on queue "${queue}"`);
    
    // Trigger immediately in a macro-task to let request thread finish
    setTimeout(async () => {
      try {
        const response = await fetch(`${resolvedBaseUrl}/api/automations/bulk-trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cloud-tasks-secret': SECRET,
          },
          body: JSON.stringify({ automationId, workspaceId, organizationId, trigger, targets }),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`[GCP-TASKS-EMULATOR] Bulk worker returned error: ${response.status} - ${text}`);
        } else {
          console.info(`[GCP-TASKS-EMULATOR] Bulk worker executed task ${taskKey} successfully.`);
        }
      } catch (err) {
        console.error(`[GCP-TASKS-EMULATOR] Network error executing bulk task ${taskKey}:`, err);
      }
    }, 10);

    return taskKey;
  }

  // Production GCP Cloud Tasks Mode
  const parent = client.queuePath(PROJECT, LOCATION, queue);
  const formattedTaskName = client.taskPath(PROJECT, LOCATION, queue, taskKey);

  const taskPayload = {
    automationId,
    workspaceId,
    organizationId,
    trigger,
    targets,
  };

  const publicBaseUrl = await resolvePublicBaseUrl();

  const task = {
    name: formattedTaskName,
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `${publicBaseUrl}/api/automations/bulk-trigger`,
      headers: {
        'Content-Type': 'application/json',
        'x-cloud-tasks-secret': SECRET,
      },
      body: Buffer.from(JSON.stringify(taskPayload)).toString('base64'),
    },
  };

  try {
    const [response] = await executeWithRetry(() => client.createTask({ parent, task }));
    console.info(`[GCP-TASKS] Scheduled bulk trigger task ${response.name}`);
    return response.name || taskKey;
  } catch (err) {
    if (isQueueNotFoundError(err)) {
      void dispatchLocalHttpWorker('/api/automations/bulk-trigger', taskPayload, taskKey);
      return taskKey;
    }
    throw err;
  }
}

export interface BulkRetryTaskOptions {
  automationId: string;
  workspaceId: string;
  userId: string;
  runIds?: string[];
  retryAll?: boolean;
}

/**
 * Schedules a bulk retry task for failed automation runs.
 */
export async function scheduleBulkRetryTask({
  automationId,
  workspaceId,
  userId,
  runIds,
  retryAll,
}: BulkRetryTaskOptions): Promise<string> {
  const uuid = Math.random().toString(36).substring(2, 15);
  const taskKey = `bulk_retry_${automationId}_${uuid}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  const queue = getQueueName('bulk');
  const client = await getCloudTasksClient();
  const resolvedBaseUrl = await resolveRequestBaseUrl();

  if (isEmulator || !client) {
    console.info(`[GCP-TASKS-EMULATOR] Scheduling bulk retry task ${taskKey} on queue "${queue}"`);
    
    setTimeout(async () => {
      try {
        const response = await fetch(`${resolvedBaseUrl}/api/automations/runs/bulk-retry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cloud-tasks-secret': SECRET,
          },
          body: JSON.stringify({ automationId, workspaceId, userId, runIds, retryAll }),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`[GCP-TASKS-EMULATOR] Bulk retry worker returned error: ${response.status} - ${text}`);
        } else {
          console.info(`[GCP-TASKS-EMULATOR] Bulk retry worker executed task ${taskKey} successfully.`);
        }
      } catch (err) {
        console.error(`[GCP-TASKS-EMULATOR] Network error executing bulk retry task ${taskKey}:`, err);
      }
    }, 10);

    return taskKey;
  }

  // Production GCP Cloud Tasks Mode
  const parent = client.queuePath(PROJECT, LOCATION, queue);
  const formattedTaskName = client.taskPath(PROJECT, LOCATION, queue, taskKey);

  const taskPayload = {
    automationId,
    workspaceId,
    userId,
    runIds,
    retryAll,
  };

  const publicBaseUrl = await resolvePublicBaseUrl();

  const task = {
    name: formattedTaskName,
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `${publicBaseUrl}/api/automations/runs/bulk-retry`,
      headers: {
        'Content-Type': 'application/json',
        'x-cloud-tasks-secret': SECRET,
      },
      body: Buffer.from(JSON.stringify(taskPayload)).toString('base64'),
    },
  };

  const requestObj = {
    parent,
    task,
  };

  try {
    const [response] = await client.createTask(requestObj);
    return response.name || taskKey;
  } catch (error) {
    if (isQueueNotFoundError(error)) {
      void dispatchLocalHttpWorker('/api/automations/runs/bulk-retry', taskPayload, taskKey);
      return taskKey;
    }
    console.error(`[GCP-TASKS] Failed to schedule bulk retry task ${taskKey}:`, error);
    throw error;
  }
}

export interface BulkResendMessagesTaskOptions {
  automationId: string;
  workspaceId: string;
  userId: string;
  logIds?: string[];
  resendAll?: boolean;
}

export async function scheduleBulkResendMessagesTask({
  automationId,
  workspaceId,
  userId,
  logIds,
  resendAll,
}: BulkResendMessagesTaskOptions): Promise<string> {
  const uuid = Math.random().toString(36).substring(2, 15);
  const taskKey = `bulk_resend_msgs_${automationId}_${uuid}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  const queue = getQueueName('bulk');
  const client = await getCloudTasksClient();
  const resolvedBaseUrl = await resolveRequestBaseUrl();

  if (isEmulator || !client) {
    console.info(`[GCP-TASKS-EMULATOR] Scheduling bulk resend messages task ${taskKey} on queue "${queue}"`);
    
    setTimeout(async () => {
      try {
        const response = await fetch(`${resolvedBaseUrl}/api/automations/messages/bulk-resend`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cloud-tasks-secret': SECRET,
          },
          body: JSON.stringify({ automationId, workspaceId, userId, logIds, resendAll }),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`[GCP-TASKS-EMULATOR] Bulk resend worker returned error: ${response.status} - ${text}`);
        } else {
          console.info(`[GCP-TASKS-EMULATOR] Bulk resend worker executed task ${taskKey} successfully.`);
        }
      } catch (err) {
        console.error(`[GCP-TASKS-EMULATOR] Network error executing bulk resend task ${taskKey}:`, err);
      }
    }, 10);

    return taskKey;
  }

  // Production GCP Cloud Tasks Mode
  const parent = client.queuePath(PROJECT, LOCATION, queue);
  const formattedTaskName = client.taskPath(PROJECT, LOCATION, queue, taskKey);

  const taskPayload = {
    automationId,
    workspaceId,
    userId,
    logIds,
    resendAll,
  };

  const publicBaseUrl = await resolvePublicBaseUrl();

  const task = {
    name: formattedTaskName,
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `${publicBaseUrl}/api/automations/messages/bulk-resend`,
      headers: {
        'Content-Type': 'application/json',
        'x-cloud-tasks-secret': SECRET,
      },
      body: Buffer.from(JSON.stringify(taskPayload)).toString('base64'),
    },
  };

  const requestObj = { parent, task };

  try {
    const [response] = await client.createTask(requestObj);
    return response.name || taskKey;
  } catch (error) {
    if (isQueueNotFoundError(error)) {
      void dispatchLocalHttpWorker('/api/automations/messages/bulk-resend', taskPayload, taskKey);
      return taskKey;
    }
    console.error(`[GCP-TASKS] Failed to schedule bulk resend messages task ${taskKey}:`, error);
    throw error;
  }
}

export interface BulkForceAdvanceTaskOptions {
  automationId: string;
  workspaceId: string;
  userId: string;
  runIds?: string[];
  advanceAllWaiting?: boolean;
}

/**
 * Schedules a bulk force advance task for automation runs.
 */
export async function scheduleBulkForceAdvanceTask({
  automationId,
  workspaceId,
  userId,
  runIds,
  advanceAllWaiting,
}: BulkForceAdvanceTaskOptions): Promise<string> {
  const uuid = Math.random().toString(36).substring(2, 15);
  const taskKey = `bulk_force_advance_${automationId}_${uuid}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  const queue = getQueueName('bulk');
  const client = await getCloudTasksClient();
  const resolvedBaseUrl = await resolveRequestBaseUrl();

  if (isEmulator || !client) {
    console.info(`[GCP-TASKS-EMULATOR] Scheduling bulk force advance task ${taskKey} on queue "${queue}"`);
    
    setTimeout(async () => {
      try {
        const response = await fetch(`${resolvedBaseUrl}/api/automations/runs/bulk-force-advance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cloud-tasks-secret': SECRET,
          },
          body: JSON.stringify({ automationId, workspaceId, userId, runIds, advanceAllWaiting }),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`[GCP-TASKS-EMULATOR] Bulk force advance worker returned error: ${response.status} - ${text}`);
        } else {
          console.info(`[GCP-TASKS-EMULATOR] Bulk force advance worker executed task ${taskKey} successfully.`);
        }
      } catch (err) {
        console.error(`[GCP-TASKS-EMULATOR] Network error executing bulk force advance task ${taskKey}:`, err);
      }
    }, 10);

    return taskKey;
  }

  // Production GCP Cloud Tasks Mode
  const parent = client.queuePath(PROJECT, LOCATION, queue);
  const formattedTaskName = client.taskPath(PROJECT, LOCATION, queue, taskKey);

  const taskPayload = {
    automationId,
    workspaceId,
    userId,
    runIds,
    advanceAllWaiting,
  };

  const publicBaseUrl = await resolvePublicBaseUrl();

  const task = {
    name: formattedTaskName,
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `${publicBaseUrl}/api/automations/runs/bulk-force-advance`,
      headers: {
        'Content-Type': 'application/json',
        'x-cloud-tasks-secret': SECRET,
      },
      body: Buffer.from(JSON.stringify(taskPayload)).toString('base64'),
    },
  };

  const requestObj = { parent, task };

  try {
    const [response] = await client.createTask(requestObj);
    return response.name || taskKey;
  } catch (error) {
    if (isQueueNotFoundError(error)) {
      void dispatchLocalHttpWorker('/api/automations/runs/bulk-force-advance', taskPayload, taskKey);
      return taskKey;
    }
    console.error(`[GCP-TASKS] Failed to schedule bulk force advance task ${taskKey}:`, error);
    throw error;
  }
}
