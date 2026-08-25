import { cache } from 'react';
import { adminDb } from '@/lib/firebase-admin';
import { getOrgBranding } from '@/lib/org-branding';
import { EmbeddedForm } from '@/components/page-builder/embeds/EmbeddedForm';
import FlipbookReaderClient from '@/app/f/[slug]/FlipbookReaderClient';
import Image from 'next/image';
import { Metadata } from 'next';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Single Source of Truth for Modern `/d/[slug]` Document Reader:
 *    Enterprise public entry point for viewing published documents, digital brochures,
 *    catalogs, and interactive flipbooks at clean URLs (`/d/[slug]`).
 * 2. Next.js 16 App Router Standards:
 *    Asynchronously awaits route params (`await params`) with zero-downtime cache resolution.
 * 3. Strict Typing:
 *    Zero `any` or `any[]` types are permitted.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Document Viewer | SmartSapp',
  description: 'View interactive publication, brochure, or digital experience.',
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface FormResource {
  type: 'form';
  form: {
    id: string;
    title: string;
    internalName: string;
    organizationId: string;
    workspaceId: string;
  };
}

interface DocumentResource {
  type: 'document';
}

type PublicResource = FormResource | DocumentResource;

const resolvePublicResource = cache(async function resolvePublicResource(
  slug: string
): Promise<PublicResource | null> {
  try {
    // 1. Check documents collection by ID or slug
    const docDoc = await adminDb.collection('documents').doc(slug).get();
    if (docDoc.exists) {
      return { type: 'document' };
    }
    const docQuery = await adminDb.collection('documents')
      .where('slug', '==', slug)
      .limit(1)
      .get();
    if (!docQuery.empty) {
      return { type: 'document' };
    }

    // 2. Check legacy flipbooks collection
    const fbDoc = await adminDb.collection('flipbooks').doc(slug).get();
    if (fbDoc.exists) {
      return { type: 'document' };
    }
    const fbQuery = await adminDb.collection('flipbooks')
      .where('slug', '==', slug)
      .limit(1)
      .get();
    if (!fbQuery.empty) {
      return { type: 'document' };
    }

    // 3. Check forms collection
    const formDoc = await adminDb.collection('forms').doc(slug).get();
    if (formDoc.exists) {
      const data = formDoc.data() || {};
      return {
        type: 'form',
        form: {
          id: formDoc.id,
          title: (data.title || '') as string,
          internalName: (data.internalName || '') as string,
          organizationId: (data.organizationId || '') as string,
          workspaceId: (data.workspaceId || '') as string,
        },
      };
    }
    const formQuery = await adminDb.collection('forms')
      .where('slug', '==', slug.toLowerCase())
      .limit(1)
      .get();
    if (!formQuery.empty) {
      const doc = formQuery.docs[0];
      const data = doc.data() || {};
      return {
        type: 'form',
        form: {
          id: doc.id,
          title: (data.title || '') as string,
          internalName: (data.internalName || '') as string,
          organizationId: (data.organizationId || '') as string,
          workspaceId: (data.workspaceId || '') as string,
        },
      };
    }

    return null;
  } catch {
    return null;
  }
});

export default async function DocumentReaderPage({ params }: PageProps) {
  const { slug } = await params;
  const resource = await resolvePublicResource(slug);

  if (resource?.type === 'form') {
    const { form } = resource;
    if (!form.organizationId || !form.workspaceId) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-100 shadow-xl text-center space-y-4">
            <h2 className="text-2xl font-bold text-slate-800 font-headline">Form Not Found</h2>
            <p className="text-slate-500 font-medium">
              The form you are looking for does not exist or has been disabled.
            </p>
          </div>
        </div>
      );
    }

    const org = await getOrgBranding(form.organizationId);
    const style = {
      '--primary-color': org?.brandPrimaryColor || '#3b82f6',
      '--logo-url': org?.logoUrl ? `url(${org.logoUrl})` : 'none',
    } as React.CSSProperties;

    return (
      <div
        style={style}
        className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-body"
      >
        <div className="w-full max-w-xl space-y-6">
          {org?.logoUrl && (
            <div className="flex justify-center mb-6">
              <Image
                src={org.logoUrl}
                alt={org.name || 'Logo'}
                width={180}
                height={50}
                className="h-10 w-auto object-contain select-none"
                priority
              />
            </div>
          )}
          <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl backdrop-blur-md">
            <EmbeddedForm
              formId={form.id}
              pageId=""
              organizationId={form.organizationId}
              workspaceId={form.workspaceId}
            />
          </div>
          {org?.name && (
            <p className="text-center text-xs text-slate-400 dark:text-zinc-600 font-medium uppercase tracking-wider">
              Powered by {org.name}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Render Reader Client
  return <FlipbookReaderClient slug={slug} />;
}
