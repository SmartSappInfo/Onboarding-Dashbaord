'use server';

/**
 * SmartSapp Forms 2.0: Distribution Hub & Public Embed Server Actions
 * 
 * Provides custom slug updating, trackable UTM campaign link creation,
 * distribution asset management, and responsive embed snippet generation.
 */

import { adminDb } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/lib/collection-constants';
import type { Form } from '@/lib/types';
import type {
  FormDistributionLink,
  CreateDistributionLinkPayload,
  EmbedConfig,
  UtmParameters,
} from './form-distribution-types';
import { buildDistributionUrl, generateEmbedSnippet } from './form-utils';

/**
 * Validates and updates a form's custom public URL slug.
 */
export async function updateFormSlugAction(
  formId: string,
  newSlug: string
): Promise<{ success: boolean; slug?: string; error?: string }> {
  try {
    if (!formId || !newSlug) {
      return { success: false, error: 'Form ID and slug are required' };
    }

    const sanitizedSlug = newSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sanitizedSlug)) {
      return { success: false, error: 'Slug must contain only lowercase letters, numbers, and single hyphens' };
    }

    // Uniqueness validation
    const conflictSnap = await adminDb.collection(COLLECTIONS.FORMS)
      .where('slug', '==', sanitizedSlug)
      .get();

    const isConflict = conflictSnap.docs.some(doc => doc.id !== formId);
    if (isConflict) {
      return { success: false, error: 'This URL slug is already taken by another form' };
    }

    await adminDb.collection(COLLECTIONS.FORMS).doc(formId).update({
      slug: sanitizedSlug,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, slug: sanitizedSlug };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Creates a saved, trackable distribution link document in `form_distributions`.
 */
export async function createDistributionLinkAction(
  payload: CreateDistributionLinkPayload
): Promise<{ success: boolean; link?: FormDistributionLink; error?: string }> {
  try {
    const { formId, workspaceId, name, channel, utmSource, utmMedium, utmCampaign, utmTerm, utmContent } = payload;
    if (!formId || !name?.trim()) {
      return { success: false, error: 'Form ID and link name are required' };
    }

    const formDoc = await adminDb.collection(COLLECTIONS.FORMS).doc(formId).get();
    if (!formDoc.exists) {
      return { success: false, error: 'Form not found' };
    }

    const formData = formDoc.data() as Form;
    const slug = formData.slug || formId;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.smartsapp.com';

    const generatedUrl = buildDistributionUrl(appUrl, slug, {
      source: utmSource,
      medium: utmMedium,
      campaign: utmCampaign,
      term: utmTerm,
      content: utmContent,
    });

    const now = new Date().toISOString();
    const docRef = await adminDb.collection('form_distributions').add({
      formId,
      workspaceId,
      name: name.trim(),
      channel,
      utmSource: utmSource?.trim() || null,
      utmMedium: utmMedium?.trim() || null,
      utmCampaign: utmCampaign?.trim() || null,
      utmTerm: utmTerm?.trim() || null,
      utmContent: utmContent?.trim() || null,
      generatedUrl,
      viewsCount: 0,
      submissionsCount: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      link: {
        id: docRef.id,
        formId,
        workspaceId,
        name: name.trim(),
        channel,
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
        generatedUrl,
        viewsCount: 0,
        submissionsCount: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Fetches all saved distribution links for a form.
 */
export async function getFormDistributionsAction(
  formId: string
): Promise<{ success: boolean; links: FormDistributionLink[]; error?: string }> {
  try {
    if (!formId) return { success: true, links: [] };

    const snap = await adminDb.collection('form_distributions')
      .where('formId', '==', formId)
      .get();

    const links: FormDistributionLink[] = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as FormDistributionLink));

    return { success: true, links };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, links: [], error: msg };
  }
}

/**
 * Deletes a distribution link document.
 */
export async function deleteDistributionLinkAction(
  distributionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!distributionId) return { success: false, error: 'distributionId is required' };
    await adminDb.collection('form_distributions').doc(distributionId).delete();
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}


