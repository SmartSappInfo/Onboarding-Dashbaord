'use client';

import { Suspense, useState } from 'react';
import type { Meeting } from '@/lib/types';
import JoinMeetingForm from '@/components/join-meeting-form';
import MeetingRegistrationForm from '@/components/meeting-registration-form';
import MeetingRegisteredState from '@/components/meeting-registered-state';
import { useRegistrationToken } from '@/hooks/use-registration-token';
import { submitRsvpResponseAction } from '@/app/actions/meeting-registrants-actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';

function RsvpOptionsPanel({ 
  meeting, 
  registrant, 
  onSuccess 
}: { 
  meeting: Meeting; 
  registrant: any; 
  onSuccess: (choice: 'going' | 'not_going' | 'later') => void 
}) {
  const [choice, setChoice] = useState<'going' | 'not_going' | 'later'>('going');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    setStatus('submitting');
    try {
      const res = await submitRsvpResponseAction(meeting.id, registrant.token, choice);
      if (res.success) {
        setStatus('success');
        onSuccess(choice);
      } else {
        setErrorMsg(res.error || 'Failed to submit RSVP.');
        setStatus('error');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.');
      setStatus('error');
    }
  };

  const firstName = registrant.name?.split(' ')[0] || 'Guest';

  if (status === 'success') {
    return (
      <div className="w-full max-w-md mx-auto md:mx-0 p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center space-y-6 shadow-2xl">
        <div className="mx-auto bg-emerald-500/20 w-16 h-16 rounded-full flex items-center justify-center border border-emerald-500/30 text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase tracking-tight text-white font-sans">RSVP Submitted</h2>
          <p className="text-xs text-foreground/75 leading-relaxed font-sans">
            {choice === 'going' 
              ? "Fantastic! We've secured your spot and loaded the waiting room details." 
              : choice === 'not_going'
                ? "We've recorded that you cannot attend. Thank you for letting us know!"
                : "No problem! We've saved your choice and will remind you later."}
          </p>
        </div>
        {choice === 'going' && (
          <Button onClick={() => window.location.reload()} className="w-full rounded-xl font-bold h-12 text-sm bg-primary text-white">
            Enter Lobby
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto md:mx-0 p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-left space-y-6 shadow-2xl">
      <div className="space-y-1">
        <h2 className="text-xl font-black uppercase tracking-tight text-white font-sans">
          Hello, {firstName}!
        </h2>
        <p className="text-xs text-foreground/60 font-sans">
          You are invited to the upcoming session.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-foreground/70 font-sans">
            Choose RSVP Option
          </label>
          <Select 
            value={choice} 
            onValueChange={(val: any) => setChoice(val)}
          >
            <SelectTrigger className="h-12 rounded-xl font-bold bg-white/5 border-white/10 text-white focus:ring-0 focus:outline-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl bg-slate-900 border-white/10 text-white">
              <SelectItem value="going" className="font-bold cursor-pointer hover:bg-white/10 rounded-lg text-xs">I'll Attend (Going)</SelectItem>
              <SelectItem value="not_going" className="font-bold cursor-pointer hover:bg-white/10 rounded-lg text-xs">I Can't Attend (Decline)</SelectItem>
              <SelectItem value="later" className="font-bold cursor-pointer hover:bg-white/10 rounded-lg text-xs">Remind me Later</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-foreground/70 leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/5 font-sans">
          ℹ️ <span className="font-semibold text-white">One-click Registration:</span> We will automatically register you and secure your spot using your invitation details. No forms to fill!
        </p>

        {errorMsg && (
          <p className="text-xs font-semibold text-rose-400 font-sans">{errorMsg}</p>
        )}

        <Button 
          onClick={handleSubmit} 
          disabled={status === 'submitting'}
          className="w-full h-12 rounded-xl font-bold text-xs uppercase tracking-widest gap-2 bg-primary hover:bg-primary/90 text-white mt-2 font-sans"
        >
          {status === 'submitting' ? 'Submitting...' : 'Submit RSVP'}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MeetingJoinSectionInner({ meeting, entityId }: { meeting: Meeting; entityId?: string }) {
  const { registrant, registrationRequired, isLoading, setToken, clearToken } = useRegistrationToken(meeting);
  const resolvedEntityId = entityId || '';

  if (isLoading) {
    return (
      <div className="w-full max-w-md mx-auto md:mx-0 p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center shadow-2xl flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (registrationRequired) {
    if (registrant) {
      // If invited but has NOT RSVP'd going yet, show the RSVP select dropdown card
      if ((registrant.source === 'invite' || registrant.status === 'pending') && registrant.status !== 'approved' && registrant.status !== 'attended') {
        return (
          <RsvpOptionsPanel
            meeting={meeting}
            registrant={registrant}
            onSuccess={(choice) => {
              if (choice === 'going') {
                setToken(registrant.token);
              }
            }}
          />
        );
      }
      return <MeetingRegisteredState meeting={meeting} registrant={registrant} onClearToken={clearToken} />;
    }
    return <MeetingRegistrationForm meeting={meeting} entityId={resolvedEntityId} onRegistered={setToken} />;
  }

  // Fallback to original join form
  return (
    <JoinMeetingForm
      meetingId={meeting.id}
      entityId={resolvedEntityId}
      meetingLink={meeting.meetingLink || ''}
      meetingTime={meeting.meetingTime || ''}
    />
  );
}

export default function MeetingJoinSection({ meeting, entityId }: { meeting: Meeting; entityId?: string }) {
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
