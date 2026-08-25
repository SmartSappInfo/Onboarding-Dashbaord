import * as React from 'react';
import { notFound } from 'next/navigation';
import { getRoutingFormBySlugAction } from '@/app/actions/routing-form-actions';
import PublicRoutingClient from '@/app/book/route/[slug]/PublicRoutingClient';

export const dynamic = 'force-dynamic';

interface EmbedRoutingPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EmbedRoutingPage(props: EmbedRoutingPageProps) {
  const params = await props.params;
  const res = await getRoutingFormBySlugAction(params.slug);

  if (!res.success || !res.form) {
    notFound();
  }

  return (
    <div className="bg-transparent min-h-screen p-2 sm:p-4">
      <PublicRoutingClient form={res.form} />
    </div>
  );
}
