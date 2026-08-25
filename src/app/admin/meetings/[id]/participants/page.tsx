import * as React from 'react';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import type { Meeting } from '@/lib/types';
import ParticipantsClient from './ParticipantsClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function MeetingParticipantsPage({ params }: PageProps) {
  const { id } = await params;
  if (!id) notFound();

  let meetingTitle = 'Meeting';
  try {
    const meetingSnap = await adminDb.collection('meetings').doc(id).get();
    if (meetingSnap.exists) {
      const data = meetingSnap.data() as Meeting;
      meetingTitle = data.title || data.entityName || 'Meeting';
    }
  } catch (err) {
    console.error('[MeetingParticipantsPage] Error fetching meeting:', err);
  }

  return <ParticipantsClient meetingId={id} meetingTitle={meetingTitle} />;
}
