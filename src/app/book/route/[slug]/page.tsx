import * as React from 'react';
import { notFound } from 'next/navigation';
import { getRoutingFormBySlugAction } from '@/app/actions/routing-form-actions';
import PublicRoutingClient from './PublicRoutingClient';

interface PublicRoutingPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: PublicRoutingPageProps) {
  const params = await props.params;
  const res = await getRoutingFormBySlugAction(params.slug);
  if (!res.success || !res.form) {
    return { title: 'Routing Form | SmartSapp' };
  }
  return {
    title: `${res.form.name} | SmartSapp`,
    description: res.form.description || res.form.headline || 'Find the right session for you.',
  };
}

export default async function PublicRoutingPage(props: PublicRoutingPageProps) {
  const params = await props.params;
  const res = await getRoutingFormBySlugAction(params.slug);

  if (!res.success || !res.form) {
    notFound();
  }

  return <PublicRoutingClient form={res.form} />;
}
