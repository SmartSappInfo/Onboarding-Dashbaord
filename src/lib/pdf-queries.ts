'use server';

import { adminDb } from './firebase-admin';
import type { PDFForm, Submission } from './types';

/**
 * @fileOverview Query helpers for PDF forms with entityId/entityId fallback support.
 * Implements Requirement 16.4: Support querying by either entityId or entityId.
 */

/**
 * Query PDFs by contact identifier with fallback pattern.
 * Requirement 16.4, 22.1: Support querying by either entityId or entityId
 */
export async function getPdfsByContact(params: {
  entityId?: string | null;
  entityId?: string | null;
  workspaceId?: string;
  status?: 'draft' | 'published' | 'archived';
}): Promise<PDFForm[]> {
  const { entityId, workspaceId, status } = params;

  // Prefer entityId when both are provided (Requirement 22.1)
  const identifier = entityId || entityId;
  const fieldName = entityId ? 'entityId' : 'entityId';

  if (!identifier) {
    throw new Error('Either entityId or entityId must be provided');
  }

  let query = adminDb.collection('pdfs').where(fieldName, '==', identifier);

  // Add optional filters
  if (workspaceId) {
    query = query.where('workspaceIds', 'array-contains', workspaceId);
  }

  if (status) {
    query = query.where('status', '==', status);
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PDFForm));
}

/**
 * Query PDF submissions by contact identifier with fallback pattern.
 * Requirement 16.4, 22.1: Support querying by either entityId or entityId
 */
export async function getSubmissionsByContact(params: {
  pdfId: string;
  entityId?: string | null;
  entityId?: string | null;
  status?: 'submitted' | 'partial';
}): Promise<Submission[]> {
  const { pdfId, entityId, status } = params;

  // Prefer entityId when both are provided (Requirement 22.1)
  const identifier = entityId || entityId;
  const fieldName = entityId ? 'entityId' : 'entityId';

  if (!identifier) {
    throw new Error('Either entityId or entityId must be provided');
  }

  let query = adminDb
    .collection('pdfs')
    .doc(pdfId)
    .collection('submissions')
    .where(fieldName, '==', identifier);

  if (status) {
    query = query.where('status', '==', status);
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
}

/**
 * Get all PDFs for a workspace with optional contact filter.
 * Requirement 16.4: Support querying by either entityId or entityId
 */
export async function getPdfsForWorkspace(params: {
  workspaceId: string;
  entityId?: string | null;
  entityId?: string | null;
  status?: 'draft' | 'published' | 'archived';
  limit?: number;
}): Promise<PDFForm[]> {
  const { workspaceId, entityId, status, limit = 100 } = params;

  let query = adminDb
    .collection('pdfs')
    .where('workspaceIds', 'array-contains', workspaceId);

  // Add contact filter if provided (prefer entityId)
  if (entityId) {
    query = query.where('entityId', '==', entityId);
  } else if (entityId) {
    query = query.where('entityId', '==', entityId);
  }

  if (status) {
    query = query.where('status', '==', status);
  }

  query = query.orderBy('createdAt', 'desc').limit(limit);

  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PDFForm));
}

/**
 * Get a single PDF by ID.
 */
export async function getPdfById(pdfId: string): Promise<PDFForm | null> {
  const doc = await adminDb.collection('pdfs').doc(pdfId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as PDFForm;
}

/**
 * Get a single submission by ID.
 */
export async function getSubmissionById(
  pdfId: string,
  submissionId: string
): Promise<Submission | null> {
  const doc = await adminDb
    .collection('pdfs')
    .doc(pdfId)
    .collection('submissions')
    .doc(submissionId)
    .get();

  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Submission;
}
