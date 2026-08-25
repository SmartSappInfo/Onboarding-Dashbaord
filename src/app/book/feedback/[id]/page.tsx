import * as React from 'react';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { PublicFeedbackClient } from './PublicFeedbackClient';

export const dynamic = 'force-dynamic';

interface PublicFeedbackPageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicFeedbackPage(props: PublicFeedbackPageProps) {
  const params = await props.params;
  const meetingDoc = await adminDb.collection('meetings').doc(params.id).get();

  if (!meetingDoc.exists) {
    notFound();
  }

  const mData = meetingDoc.data();

  return (
    <PublicFeedbackClient
      meetingId={params.id}
      meetingTitle={mData?.title || 'Your Session'}
      hostName={mData?.hostName || 'SmartSapp Host'}
    />
  );
}
