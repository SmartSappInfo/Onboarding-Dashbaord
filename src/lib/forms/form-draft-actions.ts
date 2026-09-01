'use server';

/**
 * SmartSapp Forms 2.0 Form Draft & "Resume Later" Server Actions
 * 
 * Provides secure server-side draft persistence and magic link generation
 * for respondents completing long multi-page forms.
 */

import { adminDb } from '../firebase-admin';
import { COLLECTIONS } from '../collection-constants';
import type { Form } from '../types';
import crypto from 'crypto';

export interface FormDraftRecord {
  id: string;
  formId: string;
  versionId?: string;
  email?: string;
  data: Record<string, unknown>;
  currentPageId: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Saves or updates a server-side draft with a 30-day expiration token.
 */
export async function saveFormDraftAction(input: {
  formId: string;
  versionId?: string;
  email?: string;
  data: Record<string, unknown>;
  currentPageId: string;
  draftToken?: string;
}): Promise<{ success: boolean; draftToken?: string; error?: string }> {
  try {
    const draftsCol = adminDb.collection('form_drafts');
    const token = input.draftToken || crypto.randomBytes(24).toString('hex');
    const timestamp = new Date().toISOString();
    
    // 30 days expiration TTL
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const draftData: FormDraftRecord = {
      id: token,
      formId: input.formId,
      versionId: input.versionId,
      email: input.email,
      data: input.data,
      currentPageId: input.currentPageId,
      expiresAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await draftsCol.doc(token).set(draftData, { merge: true });

    return { success: true, draftToken: token };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('>>> [FORMS:SAVE_DRAFT] Error:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Loads an existing draft by secure token.
 */
export async function loadFormDraftAction(
  draftToken: string
): Promise<{ success: boolean; draft?: FormDraftRecord; error?: string }> {
  try {
    if (!draftToken) return { success: false, error: 'Draft token is required.' };

    const draftDoc = await adminDb.collection('form_drafts').doc(draftToken).get();
    if (!draftDoc.exists) {
      return { success: false, error: 'Draft not found or expired.' };
    }

    const draft = draftDoc.data() as FormDraftRecord;
    
    // Check if expired
    if (new Date(draft.expiresAt).getTime() < Date.now()) {
      return { success: false, error: 'This draft has expired.' };
    }

    return { success: true, draft };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('>>> [FORMS:LOAD_DRAFT] Error:', msg);
    return { success: false, error: msg };
  }
}
