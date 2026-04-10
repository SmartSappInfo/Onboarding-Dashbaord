'use client';

import { Suspense } from 'react';
import type { Meeting } from '@/lib/types';
import JoinMeetingForm from '@/components/join-meeting-form';
import MeetingRegistrationForm from '@/components/meeting-registration-form';
import MeetingRegisteredState from '@/components/meeting-registered-state';
import { useRegistrationToken } from '@/hooks/use-registration-token';
import { Loader2 } from 'lucide-react';

function MeetingJoinSectionInner({ meeting, entityId }: { meeting: Meeting; entityId: string }) {
  const { registrant, registrationRequired, isLoading, setToken, clearToken } = useRegistrationToken(meeting);

  if (isLoading) {
    return (
      <div className="w-full max-w-md mx-auto md:mx-0 p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center shadow-2xl flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (registrationRequired) {
    if (registrant) {
       return <MeetingRegisteredState meeting={meeting} registrant={registrant} onClearToken={clearToken} />;
    }
    return <MeetingRegistrationForm meeting={meeting} entityId={entityId} onRegistered={setToken} />;
  }

  // Fallback to original join form
  return (
    <JoinMeetingForm
      meetingId={meeting.id}
      entityId={entityId}
      meetingLink={meeting.meetingLink || ''}
      meetingTime={meeting.meetingTime || ''}
    />
  );
}

export default function MeetingJoinSection({ meeting, entityId }: { meeting: Meeting; entityId: string }) {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md mx-auto md:mx-0 p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center shadow-2xl flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <MeetingJoinSectionInner meeting={meeting} entityId={entityId} />
    </Suspense>
  );
}
