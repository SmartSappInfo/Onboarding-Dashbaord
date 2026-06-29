import { cache } from 'react';
import { adminDb } from '@/lib/firebase-admin';
import { getOrgBranding } from '@/lib/org-branding';
import { EmbeddedForm } from '@/components/page-builder/embeds/EmbeddedForm';
import Image from 'next/image';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

const getFormById = cache(async function getFormById(id: string) {
  try {
    const snap = await adminDb.collection('forms').doc(id).get();
    if (snap.exists) {
      const data = snap.data() || {};
      return { 
        id: snap.id, 
        title: (data.title || '') as string,
        internalName: (data.internalName || '') as string,
        organizationId: (data.organizationId || '') as string,
        workspaceId: (data.workspaceId || '') as string 
      };
    }
    // Also try querying by slug/internalName as a fallback
    const querySnap = await adminDb.collection('forms')
      .where('slug', '==', id.toLowerCase())
      .limit(1)
      .get();
    if (!querySnap.empty) {
      const doc = querySnap.docs[0];
      const data = doc.data() || {};
      return { 
        id: doc.id, 
        title: (data.title || '') as string,
        internalName: (data.internalName || '') as string,
        organizationId: (data.organizationId || '') as string,
        workspaceId: (data.workspaceId || '') as string 
      };
    }
    return null;
  } catch {
    return null;
  }
});

export default async function StandaloneFormPage({ params }: PageProps) {
  const { id } = await params;
  const form = await getFormById(id);

  if (!form || !form.organizationId || !form.workspaceId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-100 shadow-xl text-center space-y-4">
          <h2 className="text-2xl font-bold text-slate-800 font-headline">Form Not Found</h2>
          <p className="text-slate-500 font-medium">The form you are looking for does not exist or has been disabled.</p>
        </div>
      </div>
    );
  }

  const org = await getOrgBranding(form.organizationId);

  // Setup theme styling variables from organization branding if available
  const style = {
    '--primary-color': org?.brandPrimaryColor || '#3b82f6',
    '--logo-url': org?.logoUrl ? `url(${org.logoUrl})` : 'none',
  } as React.CSSProperties;

  return (
    <div style={style} className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-body">
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
