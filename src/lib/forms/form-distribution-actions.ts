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

/**
 * Assembles a fully encoded, sanitized public distribution URL.
 */
export function buildDistributionUrl(
  baseUrl: string,
  slug: string,
  utms?: UtmParameters
): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/p/f/${encodeURIComponent(slug)}`;
  
  if (!utms) return url;

  const params = new URLSearchParams();
  if (utms.source?.trim()) params.set('utm_source', utms.source.trim());
  if (utms.medium?.trim()) params.set('utm_medium', utms.medium.trim());
  if (utms.campaign?.trim()) params.set('utm_campaign', utms.campaign.trim());
  if (utms.term?.trim()) params.set('utm_term', utms.term.trim());
  if (utms.content?.trim()) params.set('utm_content', utms.content.trim());

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

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

/**
 * Generates ready-to-use HTML/JavaScript embed code snippets.
 */
export function generateEmbedSnippet(
  formSlug: string,
  config: EmbedConfig,
  appUrl?: string
): string {
  const host = (appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://app.smartsapp.com').replace(/\/+$/, '');
  const embedUrl = `${host}/p/f/${formSlug}?embed=true`;

  if (config.embedType === 'inline') {
    const heightAttr = config.height || '650px';
    const widthAttr = config.width || '100%';

    return `<!-- SmartSapp Forms 2.0 Responsive Embed -->
<iframe
  id="smartsapp-form-${formSlug}"
  src="${embedUrl}"
  width="${widthAttr}"
  height="${heightAttr}"
  frameborder="0"
  scrolling="no"
  style="border: 0; max-width: 100%; width: ${widthAttr}; min-height: 400px; overflow: hidden; border-radius: 16px;"
  title="Form"
></iframe>
<script>
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'smartSappFormResize' && e.data.formId === '${formSlug}') {
      var el = document.getElementById('smartsapp-form-${formSlug}');
      if (el && e.data.height) { el.style.height = e.data.height + 'px'; }
    }
  });
</script>`;
  }

  if (config.embedType === 'popup') {
    const btnText = config.triggerText || 'Open Form';
    const btnColor = config.triggerColor || '#4f46e5';

    return `<!-- SmartSapp Forms 2.0 Popup Widget -->
<button
  id="smartsapp-popup-btn-${formSlug}"
  style="background-color: ${btnColor}; color: #ffffff; padding: 12px 24px; border-radius: 12px; font-weight: 600; border: none; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"
  onclick="document.getElementById('smartsapp-popup-modal-${formSlug}').style.display='flex';"
>
  ${btnText}
</button>

<div
  id="smartsapp-popup-modal-${formSlug}"
  style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 99999; align-items: center; justify-content: center; padding: 16px;"
  onclick="if(event.target===this){this.style.display='none';}"
>
  <div style="position: relative; width: 100%; max-width: 640px; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
    <button
      style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.08); border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 18px; cursor: pointer; z-index: 10;"
      onclick="document.getElementById('smartsapp-popup-modal-${formSlug}').style.display='none';"
    >×</button>
    <iframe
      src="${embedUrl}"
      width="100%"
      height="650px"
      frameborder="0"
      style="border: 0; width: 100%; height: 650px;"
      title="Form Popup"
    ></iframe>
  </div>
</div>`;
  }

  // Slideover Widget
  return `<!-- SmartSapp Forms 2.0 Slide-over Drawer Widget -->
<button
  id="smartsapp-drawer-btn-${formSlug}"
  style="position: fixed; bottom: 24px; right: 24px; background: #4f46e5; color: #fff; padding: 14px 20px; border-radius: 9999px; font-weight: bold; border: none; cursor: pointer; box-shadow: 0 10px 25px rgba(79,70,229,0.3); z-index: 9999;"
  onclick="document.getElementById('smartsapp-drawer-${formSlug}').style.transform='translateX(0)';"
>
  ${config.triggerText || 'Contact Us'}
</button>

<div
  id="smartsapp-drawer-${formSlug}"
  style="position: fixed; top: 0; right: 0; bottom: 0; width: 100%; max-width: 480px; background: #fff; box-shadow: -10px 0 30px rgba(0,0,0,0.15); z-index: 10000; transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);"
>
  <div style="padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: flex-end;">
    <button style="border: none; background: #f3f4f6; width: 32px; height: 32px; border-radius: 50%; cursor: pointer;" onclick="document.getElementById('smartsapp-drawer-${formSlug}').style.transform='translateX(100%)';">✕</button>
  </div>
  <iframe src="${embedUrl}" width="100%" height="calc(100% - 60px)" frameborder="0" style="border: 0;"></iframe>
</div>`;
}
