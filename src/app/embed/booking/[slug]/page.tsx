import * as React from 'react';
import { notFound } from 'next/navigation';
import { getPublicBookingPageDataAction } from '@/app/actions/booking-actions';
import { EmbedBookingClient } from './EmbedBookingClient';

export const dynamic = 'force-dynamic';

interface EmbedBookingPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ email?: string; name?: string; phone?: string; primaryColor?: string }>;
}

export default async function EmbedBookingPage({ params, searchParams }: EmbedBookingPageProps) {
  const { slug } = await params;
  const prefill = await searchParams;

  const res = await getPublicBookingPageDataAction(slug);

  if (!res.success || !res.data) {
    notFound();
  }

  return (
    <EmbedBookingClient
      initialData={res.data}
      prefill={{
        email: prefill.email || '',
        name: prefill.name || '',
        phone: prefill.phone || '',
      }}
    />
  );
}
