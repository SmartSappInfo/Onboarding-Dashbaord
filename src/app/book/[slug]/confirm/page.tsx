import * as React from 'react';
import { notFound } from 'next/navigation';
import { getBookingPageBySlugAction } from '@/app/actions/scheduler-actions';
import ConfirmBookingClient from './ConfirmBookingClient';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ time?: string }>;
}

export default async function ConfirmBookingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { time } = await searchParams;

  if (!time) {
    notFound();
  }

  const pageRes = await getBookingPageBySlugAction(slug);
  if (!pageRes.success || !pageRes.data) {
    notFound();
  }

  const bookingPage = pageRes.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black text-slate-100 flex flex-col justify-center items-center p-6 md:p-12 relative overflow-hidden">
      {/* Ambient background textures */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <ConfirmBookingClient 
        bookingPage={bookingPage} 
        timeStr={time} 
      />
    </div>
  );
}
