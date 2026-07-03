import { Metadata, ResolvingMetadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { firestore } from '@/firebase/config';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import type { Form } from '@/lib/types';
import FormRenderer from './components/FormRenderer';
import { getFieldsForWorkspace } from '@/lib/fields-actions';
import { resolveSeoMetadata, normalizeParentImages } from '@/lib/seo';
import { getOrgBranding } from '@/lib/org-branding';

/**
 * Public Form Wrapper Route
 * Handles server-side form resolution by slug and metadata generation.
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
  searchParams: Promise<{ embed?: string; entityId?: string }>;
}) {
  const { slug } = await params;
  const { embed, entityId } = await searchParams;
  const form = await getFormBySlug(slug);

  if (!form) notFound();

  // Resolve Field Definitions
  const fieldsResult = await getFieldsForWorkspace(form.workspaceId);
  const registryMap = new Map((fieldsResult.fields || []).map(f => [f.id, f]));
  
  const resolvedFields = form.fields.map(instance => ({
    ...instance,
    fieldDefinition: registryMap.get(instance.appFieldId)
  })).filter(f => !!f.fieldDefinition);

  const isEmbed = embed === 'true';

  const org = await getOrgBranding(form.organizationId);

  return (
    <div className="min-h-screen">
      <FormRenderer 
        form={form} 
        resolvedFields={resolvedFields as any}
        isEmbed={isEmbed} 
        entityId={entityId} 
        orgBranding={org}
      />
    </div>
  );
}
