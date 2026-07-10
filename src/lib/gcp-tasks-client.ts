import { CloudTasksClient } from '@google-cloud/tasks';
import { adminDb } from './firebase-admin';

// Configurations
const PROJECT = process.env.GCP_PROJECT || '';
const LOCATION = process.env.GCP_LOCATION || 'us-central1';
const SECRET = process.env.CLOUD_TASKS_SECRET || 'local-secret';
const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

// Global cache for local mock timers in emulator mode
const localTimers = new Map<string, NodeJS.Timeout>();

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

export interface ScheduleTaskOptions {
  runId: string;
  nodeId: string;
  automationId: string;
  executeAt: string;
  channel?: 'email' | 'sms' | 'whatsapp';
  payload?: Record<string, unknown>;
}

/**
 * Resolves the queue name based on the delivery channel to apply rate-limiting/traffic shaping.
 */
function getQueueName(channel?: 'email' | 'sms' | 'whatsapp'): string {
  if (channel === 'email') return 'email-delivery-queue';
  if (channel === 'sms') return 'sms-delivery-queue';
  if (channel === 'whatsapp') return 'whatsapp-delivery-queue';
  return 'default-delivery-queue';
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
  const taskKey = `task_${runId}_${nodeId}`;
  const queue = getQueueName(channel);

  if (isEmulator || !client) {
    // Emulator mode: Schedule using Node setTimeout
    console.info(`[GCP-TASKS-EMULATOR] Scheduling task ${taskKey} on queue "${queue}" for ${executeAt}`);
    
    // Cancel existing timer if any
    if (localTimers.has(taskKey)) {
      clearTimeout(localTimers.get(taskKey));
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
  channel?: 'email' | 'sms' | 'whatsapp'
): Promise<void> {
  const taskKey = `task_${runId}_${nodeId}`;
  const queue = getQueueName(channel);

  if (isEmulator || !client) {
    if (localTimers.has(taskKey)) {
      clearTimeout(localTimers.get(taskKey));
      localTimers.delete(taskKey);
      console.info(`[GCP-TASKS-EMULATOR] Cancelled local task: ${taskKey}`);
    }
    
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
