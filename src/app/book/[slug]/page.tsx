import * as React from 'react';
import { notFound } from 'next/navigation';
import { getBookingPageBySlugAction, getAvailableSlotsAction } from '@/app/actions/scheduler-actions';
import BookingSlotsClient from './BookingSlotsClient';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}

export default async function PublicBookingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { date } = await searchParams;

  // Retrieve published booking page by slug
  const pageRes = await getBookingPageBySlugAction(slug);
  if (!pageRes.success || !pageRes.data) {
    notFound();
  }

  const bookingPage = pageRes.data;
  const targetDateStr = date || new Date().toISOString().split('T')[0];

  // Fetch slots
  const slotsRes = await getAvailableSlotsAction(bookingPage.availabilityId, targetDateStr);
  const slots = slotsRes.success && slotsRes.data ? slotsRes.data : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black text-slate-100 flex flex-col justify-center items-center p-6 md:p-12 relative overflow-hidden">
      {/* Dynamic ambient gradient meshes */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <BookingSlotsClient 
        bookingPage={bookingPage} 
        initialDate={targetDateStr} 
        initialSlots={slots} 
      />
    </div>
  );
}
