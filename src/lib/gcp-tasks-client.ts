import { CloudTasksClient } from '@google-cloud/tasks';
import { adminDb } from './firebase-admin';

// Configurations
const PROJECT = process.env.GCP_PROJECT || '';
const LOCATION = process.env.GCP_LOCATION || 'us-central1';
const SECRET = process.env.CLOUD_TASKS_SECRET || 'local-secret';
const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const QUEUE_PREFIX = process.env.GCP_QUEUE_PREFIX ? `${process.env.GCP_QUEUE_PREFIX}-` : '';

// Global cache for local mock timers in emulator mode (Next.js HMR-resilient)
const globalRef = globalThis as unknown as { localTimers?: Map<string, NodeJS.Timeout> };
if (!globalRef.localTimers) {
  globalRef.localTimers = new Map<string, NodeJS.Timeout>();
}
const localTimers = globalRef.localTimers;

// Instantiate Cloud Tasks Client safely
let client: CloudTasksClient | null = null;
const isEmulator = !PROJECT || !process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!isEmulator) {
  try {
    client = new CloudTasksClient();
  } catch (err) {
    console.warn('[GCP-TASKS] Failed to initialize Google Cloud Tasks client. Falling back to EMULATOR mode.', err);
  }
} else {
  console.info('[GCP-TASKS] Running in EMULATOR mode (Local development). Tasks will execute using local timers.');
}

export type QueueChannel = 'email' | 'sms' | 'whatsapp';

export interface ScheduleTaskOptions {
  runId: string;
  nodeId: string;
  automationId: string;
  executeAt: string;
  channel?: QueueChannel;
  payload?: Record<string, unknown>;
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
  channel,
  payload = {},
}: ScheduleTaskOptions): Promise<string> {
  const taskKey = getTaskKey(runId, nodeId);
  const queue = getQueueName(channel);

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
        const response = await fetch(`${BASE_URL}/api/automations/resume`, {
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
    await adminDb.collection('automation_jobs').doc(taskKey).set({
      id: taskKey,
      runId,
      automationId,
      targetNodeId: nodeId,
      payload,
      status: 'pending',
      executeAt,
      queue,
      type: 'gcp_task_mock',
      createdAt: new Date().toISOString(),
    });

    return taskKey;
  }

  // Production GCP Cloud Tasks Mode
  const parent = client.queuePath(PROJECT, LOCATION, queue);
  const formattedTaskName = client.taskPath(PROJECT, LOCATION, queue, taskKey);
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
      url: `${BASE_URL}/api/automations/resume`,
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
    await cancelDelayTask(runId, nodeId, channel);
  } catch (err) {
    // Non-fatal if the task did not exist
  }

  const [response] = await client.createTask({ parent, task });
  console.info(`[GCP-TASKS] Scheduled task ${response.name} for ${executeAt}`);

  // Create audit log job document in Firestore
  await adminDb.collection('automation_jobs').doc(taskKey).set({
    id: taskKey,
    runId,
    automationId,
    targetNodeId: nodeId,
    payload,
    status: 'pending',
    executeAt,
    queue,
    type: 'gcp_task',
    gcpTaskName: response.name,
    createdAt: new Date().toISOString(),
  });

  return response.name || taskKey;
}

/**
 * Cancels a scheduled task in Google Cloud Tasks (or deletes the local mock timer).
 */
export async function cancelDelayTask(
  runId: string,
  nodeId: string,
  channel?: QueueChannel
): Promise<void> {
  const taskKey = getTaskKey(runId, nodeId);
  const queue = getQueueName(channel);

  const existingTimer = localTimers.get(taskKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
    localTimers.delete(taskKey);
    console.info(`[GCP-TASKS-EMULATOR] Cancelled local task: ${taskKey}`);
  }

  if (isEmulator || !client) {
    // Update audit state
    await adminDb.collection('automation_jobs').doc(taskKey).update({
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    }).catch(() => {});
    return;
  }

  const taskPath = client.taskPath(PROJECT, LOCATION, queue, taskKey);
  try {
    await client.deleteTask({ name: taskPath });
    console.info(`[GCP-TASKS] Deleted remote task: ${taskPath}`);
  } catch (err: any) {
    // code 5 corresponds to NOT_FOUND
    if (err.code !== 5) {
      throw err;
    }
  }

  // Update audit state
  await adminDb.collection('automation_jobs').doc(taskKey).update({
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
  }).catch(() => {});
}

/**
 * Reschedules a scheduled task by canceling and recreating it.
 */
export async function rescheduleDelayTask(options: ScheduleTaskOptions): Promise<string> {
  // Safe cancel, then schedule new
  await cancelDelayTask(options.runId, options.nodeId, options.channel).catch(() => {});
  return scheduleDelayTask(options);
}
