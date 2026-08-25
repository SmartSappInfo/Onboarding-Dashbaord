/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Document Processing Job Queue & Lifecycle Engine:
 *    Manages asynchronous job states (`queued`, `processing`, `completed`, `failed`)
 *    for multi-page document conversions, OCR, search indexing, and asset generation (PRD Sections 35–39).
 * 2. High-Load Resilience:
 *    Supports retry limits, checkpoint progress reporting (0–100%), and atomic status transitions.
 * 3. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { 
  DocumentProcessingJob, 
  ProcessingJobType 
} from '@/lib/types/document-types';

export interface CreateJobPayload {
  workspaceId: string;
  documentId: string;
  versionId: string;
  jobType: ProcessingJobType;
  maxAttempts?: number;
}

/**
 * Creates and queues a new DocumentProcessingJob.
 */
export async function createDocumentProcessingJob(payload: CreateJobPayload): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    const jobId = adminDb.collection('document_processing_jobs').doc().id;
    const now = new Date().toISOString();

    const job: DocumentProcessingJob = {
      id: jobId,
      workspaceId: payload.workspaceId,
      documentId: payload.documentId,
      versionId: payload.versionId,
      jobType: payload.jobType,
      status: 'queued',
      progress: 0,
      attempts: 0,
      maxAttempts: payload.maxAttempts || 3,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection('document_processing_jobs').doc(jobId).set(job);
    return { success: true, jobId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create processing job';
    return { success: false, error: msg };
  }
}

/**
 * Updates the progress and stage of an active DocumentProcessingJob.
 */
export async function updateJobProgress(jobId: string, progress: number, stage?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();
    const docRef = adminDb.collection('document_processing_jobs').doc(jobId);

    await docRef.update({
      progress: Math.min(100, Math.max(0, progress)),
      status: progress >= 100 ? 'completed' : 'processing',
      stage: stage || '',
      updatedAt: now,
      ...(progress >= 100 ? { completedAt: now } : {}),
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update job progress';
    return { success: false, error: msg };
  }
}

/**
 * Records a failure on a DocumentProcessingJob with an error code and message.
 */
export async function failProcessingJob(jobId: string, errorCode: string, errorMessage: string): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();
    const docRef = adminDb.collection('document_processing_jobs').doc(jobId);

    await docRef.update({
      status: 'failed',
      errorCode,
      errorMessage,
      updatedAt: now,
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to mark job as failed';
    return { success: false, error: msg };
  }
}
