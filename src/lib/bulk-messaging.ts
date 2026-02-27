'use server';

import { adminDb } from './firebase-admin';
import { sendMessage } from './messaging-engine';
import type { MessageJob, MessageTask, MessageTemplate } from './types';

const CHUNK_SIZE = 50; // Number of tasks to process in one server action call

interface BulkJobInput {
  templateId: string;
  senderProfileId: string;
  recipients: { recipient: string; variables: Record<string, any> }[];
  userId: string;
}

/**
 * Creates a new bulk message job and fans out the individual tasks.
 */
export async function createBulkMessageJob(input: BulkJobInput): Promise<{ jobId: string }> {
  const { templateId, senderProfileId, recipients, userId } = input;

  try {
    // 1. Fetch Template to confirm channel
    const templateSnap = await adminDb.collection('message_templates').doc(templateId).get();
    if (!templateSnap.exists) throw new Error("Template not found");
    const template = templateSnap.data() as MessageTemplate;

    // 2. Initialize Job record
    const jobData: Omit<MessageJob, 'id'> = {
      templateId,
      senderProfileId,
      channel: template.channel,
      createdBy: userId,
      status: 'queued',
      totalRecipients: recipients.length,
      processed: 0,
      success: 0,
      failed: 0,
      createdAt: new Date().toISOString()
    };

    const jobRef = await adminDb.collection('message_jobs').add(jobData);

    // 3. Task Fan-out (Batched for Firestore limits)
    // Firestore allows max 500 writes per batch. We use 450 to be safe.
    const taskChunks = [];
    for (let i = 0; i < recipients.length; i += 450) {
      taskChunks.push(recipients.slice(i, i + 450));
    }

    for (const chunk of taskChunks) {
      const batch = adminDb.batch();
      for (const item of chunk) {
        const taskRef = jobRef.collection('tasks').doc();
        const taskData: Omit<MessageTask, 'id'> = {
          recipient: item.recipient,
          variables: item.variables,
          status: 'pending'
        };
        batch.set(taskRef, taskData);
      }
      await batch.commit();
    }

    return { jobId: jobRef.id };

  } catch (error: any) {
    console.error(">>> [BULK] JOB CREATION FAILED:", error.message);
    throw error;
  }
}

/**
 * Processes a single chunk of tasks for a given job.
 * Designed to be called iteratively until the job is complete.
 */
export async function processBulkJobChunk(jobId: string) {
  try {
    const jobRef = adminDb.collection('message_jobs').doc(jobId);
    const jobSnap = await jobRef.get();
    
    if (!jobSnap.exists) throw new Error("Job not found");
    const job = jobSnap.data() as MessageJob;

    if (job.status === 'completed' || job.status === 'failed') {
        return { status: job.status, progress: 100 };
    }

    // 1. Mark as processing if queued
    if (job.status === 'queued') {
        await jobRef.update({ status: 'processing' });
    }

    // 2. Fetch pending tasks
    const tasksSnap = await jobRef.collection('tasks')
        .where('status', '==', 'pending')
        .limit(CHUNK_SIZE)
        .get();

    if (tasksSnap.empty) {
        await jobRef.update({ status: 'completed' });
        return { status: 'completed', progress: 100 };
    }

    // 3. Process Chunk
    let successIncrement = 0;
    let failedIncrement = 0;

    for (const taskDoc of tasksSnap.docs) {
        const task = taskDoc.data() as MessageTask;
        
        const result = await sendMessage({
            templateId: job.templateId,
            senderProfileId: job.senderProfileId,
            recipient: task.recipient,
            variables: task.variables
        });

        if (result.success) {
            successIncrement++;
            await taskDoc.ref.update({ status: 'sent', sentAt: new Date().toISOString() });
        } else {
            failedIncrement++;
            await taskDoc.ref.update({ status: 'failed', error: result.error });
        }
    }

    // 4. Update Job Stats
    const newProcessed = job.processed + tasksSnap.size;
    const newSuccess = job.success + successIncrement;
    const newFailed = job.failed + failedIncrement;
    
    const isFinished = newProcessed >= job.totalRecipients;

    await jobRef.update({
        processed: newProcessed,
        success: newSuccess,
        failed: newFailed,
        status: isFinished ? 'completed' : 'processing'
    });

    const progress = Math.round((newProcessed / job.totalRecipients) * 100);
    return { 
        status: isFinished ? 'completed' : 'processing', 
        progress,
        processed: newProcessed,
        total: job.totalRecipients
    };

  } catch (error: any) {
    console.error(">>> [BULK] CHUNK PROCESSING FAILED:", error.message);
    throw error;
  }
}
