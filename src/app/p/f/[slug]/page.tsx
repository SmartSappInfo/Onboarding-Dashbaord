import { Metadata, ResolvingMetadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { firestore } from '@/firebase/config';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import type { Form } from '@/lib/types';
import FormRenderer from './components/FormRenderer';
import MultiPageFormRenderer, { type ResolvedField } from './components/MultiPageFormRenderer';
import { normalizeFormToVersion } from '@/lib/forms/form-compatibility';
import type { AppField } from '@/lib/types';
import { getFieldsForWorkspace } from '@/lib/fields-actions';
import { resolveSeoMetadata, normalizeParentImages } from '@/lib/seo';
import { getOrgBranding } from '@/lib/org-branding';

/**
 * Public Form Wrapper Route
 * Handles server-side form resolution by slug, version normalization, and metadata generation.
 */

// React.cache dedupes the lookup between generateMetadata and the page body.
const getFormBySlug = cache(async function getFormBySlug(slug: string): Promise<Form | null> {
  try {
    const formsRef = collection(firestore, 'forms');
    const q = query(
      formsRef,
      where('slug', '==', slug),
      where('status', '==', 'published'), // Only show published forms
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return null;

    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Form;
  } catch (error) {
    console.error('Error fetching form by slug:', error);
    return null;
  }
});

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const form = await getFormBySlug(slug);

  if (!form) return { title: 'Form Not Found', robots: { index: false, follow: false } };

  // Org branding supplies the logo for the `entity_logo` OG-image mode.
  const org = await getOrgBranding(form.organizationId);

  return resolveSeoMetadata({
    seo: form.seo,
    fallback: {
      title: form.title,
      description: form.description || 'Form submission powered by SmartSapp',
    },
    org,
    parentImages: normalizeParentImages((await parent).openGraph?.images),
    path: `/p/f/${slug}`,
  });
}

export default async function PublicFormPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ embed?: string; entityId?: string; draft?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string }>;
}) {
  const { slug } = await params;
  const { embed, entityId, draft, utm_source, utm_medium, utm_campaign } = await searchParams;
  const form = await getFormBySlug(slug);

  if (!form) notFound();

  // Resolve Field Definitions
  const fieldsResult = await getFieldsForWorkspace(form.workspaceId);
  const registryMap = new Map((fieldsResult.fields || []).map(f => [f.id, f]));
  const appFieldsMap: Record<string, AppField> = {};
  (fieldsResult.fields || []).forEach(f => {
    appFieldsMap[f.id] = f;
  });

  const resolvedFields: ResolvedField[] = (form.fields || [])
    .map(instance => ({
      ...instance,
      fieldDefinition: registryMap.get(instance.appFieldId) as AppField,
    }))
    .filter(f => Boolean(f.fieldDefinition));

  const isEmbed = embed === 'true';
  const org = await getOrgBranding(form.organizationId);

  const trackingParams: Record<string, string> = {};
  if (utm_source) trackingParams.utmSource = utm_source;
  if (utm_medium) trackingParams.utmMedium = utm_medium;
  if (utm_campaign) trackingParams.utmCampaign = utm_campaign;

  // Synthesize or extract multi-page version
  const version = normalizeFormToVersion(form, appFieldsMap);
  const isMultiPage = version.pages && version.pages.length > 1;

  // Progressive Profiling: Resolve known contact profile if entityId is present
  const { getKnownRespondentProfile } = await import('@/lib/forms/identity-resolution');
  const knownProfile = entityId ? await getKnownRespondentProfile(form.workspaceId, entityId) : undefined;

  return (
    <div className="min-h-screen">
      {isMultiPage ? (
        <MultiPageFormRenderer
          form={form}
          pages={version.pages}
          resolvedFields={resolvedFields}
          isEmbed={isEmbed}
          entityId={entityId}
          orgBranding={org}
          trackingParams={trackingParams}
          initialDraftToken={draft}
          knownProfile={knownProfile?.found ? knownProfile : undefined}
        />
      ) : (
        <FormRenderer 
          form={form} 
          resolvedFields={resolvedFields}
          isEmbed={isEmbed} 
          entityId={entityId} 
          orgBranding={org}
          knownProfile={knownProfile?.found ? knownProfile : undefined}
        />
      )}
    </div>
  );
}
