import type { CloudTasksClient } from '@google-cloud/tasks';
import { adminDb } from './firebase-admin';

// Configurations
const PROJECT = process.env.GCP_PROJECT || '';
const LOCATION = process.env.GCP_LOCATION || 'us-central1';
const SECRET = process.env.CLOUD_TASKS_SECRET || 'local-secret';
const BASE_URL = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'production' ? 'https://go.smartsapp.com' : 'http://127.0.0.1:3000');
const QUEUE_PREFIX = process.env.GCP_QUEUE_PREFIX ? `${process.env.GCP_QUEUE_PREFIX}-` : '';

async function resolveRequestBaseUrl(): Promise<string> {
  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host');
    if (host) {
      const proto = headersList.get('x-forwarded-proto') || 'https';
      const cleanProto = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : proto;
      const cleanHost = host.replace('localhost', '127.0.0.1');
      return `${cleanProto}://${cleanHost}`;
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

// Instantiate Cloud Tasks Client safely and dynamically to prevent bundler errors
let clientInstance: CloudTasksClient | null = null;
let isInitialized = false;
const isEmulator = !PROJECT || !process.env.GOOGLE_APPLICATION_CREDENTIALS;

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

export type QueueChannel = 'email' | 'sms' | 'whatsapp';

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
  if (channel === 'email' || channel === 'sms' || channel === 'whatsapp') {
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
 * Schedules a delayed resume task in Google Cloud Tasks (or falls back to local timeout emulator).
 */
export async function scheduleDelayTask({
  runId,
  nodeId,
  automationId,
  executeAt,
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
        sourceNodeId: sourceNodeId || null,
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

  const task = {
    name: formattedTaskName,
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `${resolvedBaseUrl}/api/automations/resume`,
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

  const [response] = await executeWithRetry(() => client.createTask({ parent, task }));
  console.info(`[GCP-TASKS] Scheduled task ${response.name} for ${executeAt}`);

  // Create audit log job document in Firestore
  if (!skipDbUpdate) {
    await adminDb.collection('automation_jobs').doc(taskKey).set({
      id: taskKey,
      runId,
      automationId,
      targetNodeId: nodeId,
      sourceNodeId: sourceNodeId || null,
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
  const queue = getQueueName();
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

  const task = {
    name: formattedTaskName,
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `${resolvedBaseUrl}/api/automations/bulk-trigger`,
      headers: {
        'Content-Type': 'application/json',
        'x-cloud-tasks-secret': SECRET,
      },
      body: Buffer.from(JSON.stringify(taskPayload)).toString('base64'),
    },
  };

  const [response] = await executeWithRetry(() => client.createTask({ parent, task }));
  console.info(`[GCP-TASKS] Scheduled bulk trigger task ${response.name}`);

  return response.name || taskKey;
}
