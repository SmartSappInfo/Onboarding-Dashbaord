import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PublicBookingClient from './PublicBookingClient';
import { getPublicBookingPageDataAction } from '@/app/actions/booking-actions';

export const dynamic = 'force-dynamic';

interface PublicBookingPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ email?: string; name?: string; phone?: string }>;
}

export async function generateMetadata({ params }: PublicBookingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const res = await getPublicBookingPageDataAction(slug);

  if (!res.success || !res.data) {
    return {
      title: 'Book a Session | SmartSapp',
      description: 'Schedule a meeting or consultation.',
    };
  }

  const { eventType, hostProfile, workspaceName } = res.data;
  const hostName = hostProfile?.name || workspaceName || 'SmartSapp Host';

  return {
    title: `${eventType.name} with ${hostName} | SmartSapp`,
    description: eventType.description || `Schedule a ${eventType.durationMinutes}-minute session.`,
    openGraph: {
      title: `${eventType.name} with ${hostName}`,
      description: eventType.description || `Book a ${eventType.durationMinutes}-minute session.`,
    },
  };
}

export default async function PublicBookingPage({ params, searchParams }: PublicBookingPageProps) {
  const { slug } = await params;
  const prefill = await searchParams;

  const res = await getPublicBookingPageDataAction(slug);

  if (!res.success || !res.data) {
    notFound();
  }

  return (
    <PublicBookingClient
      initialData={res.data}
      prefill={{
        email: prefill.email || '',
        name: prefill.name || '',
        phone: prefill.phone || '',
      }}
    />
  );
}
