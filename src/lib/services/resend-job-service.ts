import { adminDb } from '../firebase-admin';
import { CloudTasksClient } from '@google-cloud/tasks';
import { ResendJob, ResendJobStatus, ResendConfiguration, ResendTrigger } from '../types/tracking';

const cloudTasksClient = new CloudTasksClient();
const QUEUE = process.env.GOOGLE_CLOUD_TASKS_QUEUE || '';
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
const LOCATION = 'us-central1';

export class ResendJobService {
  async scheduleResendJob(params: {
    automationId: string;
    runId: string;
    nodeId: string;
    workspaceId: string;
    originalTrackingId: string;
    recipientIdentifier: string;
    resendConfig: ResendConfiguration;
    title: string;
    previewText: string;
    messageContent: string;
  }): Promise<ResendJob> {
    const docRef = adminDb.collection('resend_jobs').doc();
    const delayMs = params.resendConfig.resendDelay * 60 * 60 * 1000;
    const scheduledTime = new Date(Date.now() + delayMs);

    const job: ResendJob = {
      id: docRef.id,
      automationId: params.automationId,
      runId: params.runId,
      nodeId: params.nodeId,
      workspaceId: params.workspaceId,
      originalMessageTrackingId: params.originalTrackingId,
      recipientIdentifier: params.recipientIdentifier,
      resendNumber: params.resendConfig.resendCount + 1,
      maxResends: params.resendConfig.maxResends,
      triggerCondition: params.resendConfig.triggerCondition,
      title: params.title,
      previewText: params.previewText,
      messageContent: params.messageContent,
      scheduledFor: scheduledTime.toISOString(),
      checkAfter: scheduledTime.toISOString(),
      status: ResendJobStatus.Pending,
      statusReason: null,
      checkedAt: null,
      sentAt: null,
      newMessageTrackingId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(job);

    // Enqueue the Cloud Task execution trigger
    await this.enqueueCloudTask(job);

    return job;
  }

  private async enqueueCloudTask(job: ResendJob): Promise<void> {
    if (!QUEUE || !PROJECT) {
      console.warn('[CLOUD_TASKS] Cloud Tasks config missing. Skipping enqueue.');
      return;
    }

    const parent = cloudTasksClient.queuePath(PROJECT, LOCATION, QUEUE);
    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/resend`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}`,
        },
        body: Buffer.from(JSON.stringify({ jobId: job.id })).toString('base64'),
      },
      scheduleTime: {
        seconds: Math.floor(new Date(job.scheduledFor).getTime() / 1000),
      },
    };

    try {
      await cloudTasksClient.createTask({ parent, task });
    } catch (err) {
      console.error('[CLOUD_TASKS] Failed to create task:', err);
    }
  }
}

export const resendJobService = new ResendJobService();
