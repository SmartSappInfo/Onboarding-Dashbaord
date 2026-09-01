'use server';

/**
 * Forms 2.0 Version-Safe Server Actions
 * 
 * Handles saving draft versions, publishing immutable versions,
 * retrieving forms with version snapshots, and managing lifecycle states.
 */

import { adminDb } from './firebase-admin';
import { COLLECTIONS } from './collection-constants';
import type { Form } from './types';
import type { FormVersion, FormPage, FormComponent } from './forms/form-types';
import { revalidatePath } from 'next/cache';
import { canUser } from './workspace-permissions';

const REVALIDATION_PATH = '/admin/forms';

/**
 * Retrieves a form by ID along with its active draft or published version.
 */
export async function getFormWithVersionAction(id: string): Promise<{
  form: Form | null;
  version: FormVersion | null;
  error?: string;
}> {
  try {
    const formDoc = await adminDb.collection(COLLECTIONS.FORMS).doc(id).get();
    if (!formDoc.exists) {
      return { form: null, version: null, error: 'Form not found.' };
    }

    const form = { id: formDoc.id, ...formDoc.data() } as Form;

    // Check for version subcollection or currentVersion field
    let version: FormVersion | null = null;

    if (form.currentVersionId) {
      const verDoc = await adminDb
        .collection(COLLECTIONS.FORMS)
        .doc(id)
        .collection('versions')
        .doc(form.currentVersionId)
        .get();
      if (verDoc.exists) {
        version = { id: verDoc.id, ...verDoc.data() } as FormVersion;
      }
    }

    return { form, version };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('>>> [FORMS:GET_VERSION] Failed:', msg);
    return { form: null, version: null, error: msg };
  }
}

/**
 * Saves a draft version for a form.
 */
export async function saveFormDraftVersionAction(
  formId: string,
  userId: string,
  pages: FormPage[],
  metadata?: Partial<Form>
): Promise<{ success: boolean; versionId?: string; error?: string }> {
  try {
    const formRef = adminDb.collection(COLLECTIONS.FORMS).doc(formId);
    const formDoc = await formRef.get();
    if (!formDoc.exists) return { success: false, error: 'Form not found.' };

    const form = formDoc.data() as Form;

    // Permission check
    const permission = await canUser(userId, 'studios', 'forms', 'edit', form.workspaceId);
    if (!permission.granted) return { success: false, error: permission.reason };

    const now = new Date().toISOString();
    const versionsCol = formRef.collection('versions');

    let targetVersionId = form.currentVersionId;
    let versionNumber = 1;

    if (targetVersionId) {
      const verDoc = await versionsCol.doc(targetVersionId).get();
      if (verDoc.exists) {
        const verData = verDoc.data() as FormVersion;
        if (verData.status === 'published') {
          // Create a new draft version if current is published
          versionNumber = (verData.versionNumber || 1) + 1;
          targetVersionId = undefined;
        } else {
          versionNumber = verData.versionNumber || 1;
        }
      }
    }

    const versionRef = targetVersionId ? versionsCol.doc(targetVersionId) : versionsCol.doc();
    const versionPayload: FormVersion = {
      id: versionRef.id,
      formId,
      versionNumber,
      status: 'draft',
      schemaVersion: '2.0',
      pages,
      createdBy: userId,
      createdAt: now,
    };

    await versionRef.set(versionPayload, { merge: true });

    // Update parent form document
    await formRef.update({
      currentVersionId: versionRef.id,
      updatedAt: now,
      ...(metadata || {}),
    });

    revalidatePath(`/admin/forms/${formId}/edit`);
    return { success: true, versionId: versionRef.id };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('>>> [FORMS:SAVE_DRAFT] Failed:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Publishes an immutable version of the form and sets status to 'published'.
 */
export async function publishFormVersionAction(
  formId: string,
  userId: string,
  pages: FormPage[],
  metadata?: Partial<Form>
): Promise<{ success: boolean; versionId?: string; error?: string }> {
  try {
    const formRef = adminDb.collection(COLLECTIONS.FORMS).doc(formId);
    const formDoc = await formRef.get();
    if (!formDoc.exists) return { success: false, error: 'Form not found.' };

    const form = formDoc.data() as Form;

    // Permission check
    const permission = await canUser(userId, 'studios', 'forms', 'edit', form.workspaceId);
    if (!permission.granted) return { success: false, error: permission.reason };

    const now = new Date().toISOString();
    const versionsCol = formRef.collection('versions');

    // Generate new published version
    const versionRef = versionsCol.doc();
    const lastPublishedNumber = form.publishedVersionNumber || 0;
    const versionNumber = lastPublishedNumber + 1;

    const publishedVersion: FormVersion = {
      id: versionRef.id,
      formId,
      versionNumber,
      status: 'published',
      schemaVersion: '2.0',
      pages,
      createdBy: userId,
      createdAt: now,
      publishedBy: userId,
      publishedAt: now,
    };

    await versionRef.set(publishedVersion);

    // Update parent form document
    await formRef.update({
      currentVersionId: versionRef.id,
      publishedVersionId: versionRef.id,
      publishedVersionNumber: versionNumber,
      status: 'published',
      publishedAt: now,
      updatedAt: now,
      ...(metadata || {}),
    });

    revalidatePath(REVALIDATION_PATH);
    revalidatePath(`/admin/forms/${formId}`);
    revalidatePath(`/admin/forms/${formId}/edit`);
    revalidatePath(`/p/f/${form.slug}`);

    return { success: true, versionId: versionRef.id };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('>>> [FORMS:PUBLISH_VERSION] Failed:', msg);
    return { success: false, error: msg };
  }
}
