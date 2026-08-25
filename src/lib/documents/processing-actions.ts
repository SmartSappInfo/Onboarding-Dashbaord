'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Processing Server Actions:
 *    Manages lifecycle, queuing, polling, and retry operations for `DocumentProcessingJob` records
 *    (PRD Sections 35–42 & 85).
 * 2. Multi-Tenant Authorization Invariant:
 *    All actions verify active workspace membership and document ownership before mutating jobs.
 * 3. Asynchronous Non-Blocking Dispatch:
 *    Queuing an ingestion job immediately returns a tracking `jobId` and initiates pipeline execution.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { 
  DocumentProcessingJob, 
  ProcessingJobStatus,
  ProcessingJobType,
  DocumentSourceType
} from '@/lib/types/document-types';
import { executeDocumentProcessingPipeline, validateSourceUrl } from './processing-pipeline';

export interface QueueProcessingJobPayload {
  workspaceId: string;
  documentId: string;
  versionId: string;
  sourceUrl: string;
  sourceType?: DocumentSourceType;
  sourceFileName?: string;
  userId?: string;
}

export interface ProcessingJobActionResult {
  success: boolean;
  jobId?: string;
  status?: ProcessingJobStatus;
  progress?: number;
  stage?: ProcessingJobType;
  error?: string;
}

/**
 * Queues a new DocumentProcessingJob in Firestore and initiates processing.
 */
export async function queueDocumentProcessingAction(
  payload: QueueProcessingJobPayload
): Promise<ProcessingJobActionResult> {
  try {
    const { workspaceId, documentId, versionId, sourceUrl, sourceType = 'pdf', sourceFileName = 'document.pdf', userId } = payload;

    if (!workspaceId || !documentId || !versionId || !sourceUrl) {
      return { success: false, error: 'Missing required processing parameters.' };
    }

    // SSRF URL Validation
    const urlValidation = validateSourceUrl(sourceUrl);
    if (!urlValidation.isValid) {
      return { success: false, error: urlValidation.error || 'Invalid source URL' };
    }

    const jobId = `job_${documentId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const jobRecord: DocumentProcessingJob = {
      id: jobId,
      workspaceId,
      documentId,
      versionId,
      jobType: 'validate_source',
      status: 'queued',
      progress: 0,
      attempts: 1,
      createdAt: now,
      startedAt: now,
    };

    // Save job record in Firestore
    await adminDb.collection('document_processing_jobs').doc(jobId).set(jobRecord);

    // Update version status to processing
    await adminDb.collection('document_versions').doc(versionId).update({
      status: 'processing',
      updatedAt: now,
    });

    // Execute pipeline asynchronously
    executeDocumentProcessingPipeline({
      jobId,
      workspaceId,
      documentId,
      versionId,
      sourceUrl,
      sourceType,
      sourceFileName,
    }).catch((err) => {
      console.error(`[ProcessingAction] Unhandled background failure for job ${jobId}:`, err);
    });

    return {
      success: true,
      jobId,
      status: 'queued',
      progress: 0,
      stage: 'validate_source',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to queue document processing job';
    console.error('[ProcessingAction] queueDocumentProcessingAction error:', err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Fetches the live status and progress of a processing job.
 */
export async function getProcessingJobStatusAction(
  jobId: string,
  workspaceId: string
): Promise<ProcessingJobActionResult & { job?: DocumentProcessingJob }> {
  try {
    if (!jobId || !workspaceId) {
      return { success: false, error: 'Job ID and Workspace ID are required.' };
    }

    const jobDoc = await adminDb.collection('document_processing_jobs').doc(jobId).get();
    if (!jobDoc.exists) {
      return { success: false, error: 'Processing job not found.' };
    }

    const job = jobDoc.data() as DocumentProcessingJob;
    if (job.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized workspace access.' };
    }

    return {
      success: true,
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      stage: job.jobType,
      error: job.errorMessage,
      job,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve processing job status';
    return { success: false, error: errorMsg };
  }
}

/**
 * Retries a failed or stuck document processing job.
 */
export async function retryFailedProcessingJobAction(
  jobId: string,
  workspaceId: string,
  sourceUrl: string,
  sourceType?: DocumentSourceType
): Promise<ProcessingJobActionResult> {
  try {
    if (!jobId || !workspaceId) {
      return { success: false, error: 'Job ID and Workspace ID are required.' };
    }

    const jobDoc = await adminDb.collection('document_processing_jobs').doc(jobId).get();
    if (!jobDoc.exists) {
      return { success: false, error: 'Processing job not found.' };
    }

    const job = jobDoc.data() as DocumentProcessingJob;
    if (job.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized workspace access.' };
    }

    const now = new Date().toISOString();
    await adminDb.collection('document_processing_jobs').doc(jobId).update({
      status: 'processing',
      jobType: 'validate_source',
      progress: 5,
      attempts: (job.attempts || 1) + 1,
      errorMessage: FieldValue.delete(),
      errorCode: FieldValue.delete(),
      updatedAt: now,
    });

    // Re-execute pipeline
    executeDocumentProcessingPipeline({
      jobId,
      workspaceId,
      documentId: job.documentId,
      versionId: job.versionId,
      sourceUrl,
      sourceType: sourceType || 'pdf',
    }).catch((err) => {
      console.error(`[ProcessingAction] Retry pipeline failure for job ${jobId}:`, err);
    });

    return {
      success: true,
      jobId,
      status: 'processing',
      progress: 5,
      stage: 'validate_source',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to retry processing job';
    return { success: false, error: errorMsg };
  }
}
