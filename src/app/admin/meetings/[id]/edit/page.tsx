'use client';

/**
 * @fileoverview Edit Session / Webinar Studio Page.
 * Delegates form state, wizard validation, and persistence to the SSOT <MeetingSessionForm>.
 *
 * ARCHITECTURAL DESIGN:
 * - Directives: Zero 'any' or 'any[]'. Strict typing.
 * - Single Source of Truth: MeetingSessionForm manages all 5 wizard steps and responsive preview.
 * - Hydrates document by id and sets breadcrumb context.
 */

import * as React from 'react';
import { useParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import type { Meeting } from '@/lib/types';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { MeetingSessionForm } from '../../components/session-form/MeetingSessionForm';

export default function EditMeetingPage() {
  const params = useParams();
  const meetingId = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;
  const firestore = useFirestore();

  const meetingDocRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return doc(firestore, 'meetings', meetingId);
  }, [firestore, meetingId]);

  const { data: meeting, isLoading: isLoadingMeeting } = useDoc<Meeting>(meetingDocRef);

  useSetBreadcrumb(meeting?.entityName || meeting?.title, `/admin/meetings/${meetingId}`);

  return (
    <MeetingSessionForm 
      mode="edit" 
      meetingId={meetingId} 
      initialData={meeting} 
      isLoadingInitialData={isLoadingMeeting} 
    />
  );
}
