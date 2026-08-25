import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import type { Booking, EventType } from '@/lib/meetings/types';
import BookingConfirmedClient from './BookingConfirmedClient';

export const dynamic = 'force-dynamic';

interface BookingConfirmedPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ bookingId?: string; token?: string }>;
}

export const metadata: Metadata = {
  title: 'Booking Confirmed | SmartSapp',
  description: 'Your meeting reservation is confirmed.',
};

export default async function BookingConfirmedPage({
  params,
  searchParams,
}: BookingConfirmedPageProps) {
  const { slug } = await params;
  const { bookingId, token } = await searchParams;

  if (!bookingId) {
    notFound();
  }

  const bookingSnap = await adminDb.collection('bookings').doc(bookingId).get();
  if (!bookingSnap.exists) {
    notFound();
  }

  const booking = { id: bookingSnap.id, ...bookingSnap.data() } as Booking;

  const eventSnap = await adminDb.collection('event_types').doc(booking.eventTypeId).get();
  const eventType = eventSnap.exists
    ? ({ id: eventSnap.id, ...eventSnap.data() } as EventType)
    : null;

  return (
    <BookingConfirmedClient
      booking={booking}
      eventType={eventType}
      manageToken={token || ''}
      slug={slug}
    />
  );
}
