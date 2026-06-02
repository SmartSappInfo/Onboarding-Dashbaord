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
import { motion } from 'framer-motion';

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

  const handleRsvp = async (selectedChoice: 'going' | 'not_going' | 'later') => {
    setChoice(selectedChoice);
    setStatus('submitting');
    try {
      const res = await submitRsvpResponseAction(meeting.id, registrant.token, selectedChoice);
      if (res.success) {
        setStatus('success');
        onSuccess(selectedChoice);
      } else {
        setErrorMsg(res.error || 'Failed to submit RSVP.');
        setStatus('error');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.');
      setStatus('error');
    }
  };

  const contactName = registrant.name || 'Friend';

  if (status === 'success') {
    return (
      <div className="w-full md:max-w-md mx-auto md:mx-0 p-6 sm:p-10 bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-slate-200/50 dark:border-white/10 text-center space-y-6 shadow-2xl">
        <div className="mx-auto bg-emerald-500/20 w-16 h-16 rounded-full flex items-center justify-center border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white font-sans">RSVP Submitted</h2>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
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
    <div className="w-full md:max-w-md mx-auto md:mx-0 p-4 sm:p-6 md:p-8 bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-[2rem] md:rounded-[2.5rem] border border-slate-200/50 dark:border-white/10 text-left space-y-4 md:space-y-6 shadow-2xl">
      <div className="space-y-2">
        <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white font-sans">
          Hi {contactName} 👋
        </h2>
        <p className="text-[15px] md:text-base text-slate-800 dark:text-slate-200 leading-relaxed font-medium font-sans">
          We're excited to have you in this session. Are you joining us?
        </p>
      </div>

      <div className="space-y-4 pt-2">
        {status === 'submitting' ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Submitting your response...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <motion.div
              animate={{
                scale: [1, 1.03, 1],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                repeatDelay: 3.8,
                ease: "easeInOut"
              }}
              className="w-full"
            >
              <Button
                onClick={() => handleRsvp('going')}
                variant="default"
                className="w-full rounded-xl font-bold h-12 text-sm shadow-md bg-primary hover:bg-primary/90 text-white"
              >
                Yes, I'll Join
              </Button>
            </motion.div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => handleRsvp('later')}
                variant="secondary"
                className="rounded-xl font-bold h-11 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white border border-slate-200/30 dark:border-white/5"
              >
                Later
              </Button>
              <Button
                onClick={() => handleRsvp('not_going')}
                variant="secondary"
                className="rounded-xl font-bold h-11 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white border border-slate-200/30 dark:border-white/5"
              >
                Can't Make It
              </Button>
            </div>
          </div>
        )}

        <p className="text-[11px] md:text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-blue-500/5 dark:bg-white/5 p-3 md:p-4 rounded-xl md:rounded-2xl border border-blue-500/10 dark:border-white/10 font-sans">
          ℹ️ <span className="font-semibold text-slate-900 dark:text-white">One-click Registration:</span> Your spot will automatically be secure with one click. No forms to fill!
        </p>

        {errorMsg && (
          <p className="text-[11px] md:text-xs font-semibold text-rose-600 dark:text-rose-400 font-sans">{errorMsg}</p>
        )}
      </div>
    </div>
  );
}

function MeetingJoinSectionInner({ 
  meeting, 
  entityId, 
  tokenResult 
}: { 
  meeting: Meeting; 
  entityId?: string; 
  tokenResult?: any; 
}) {
  const localTokenResult = useRegistrationToken(meeting);
  const resolvedTokenResult = tokenResult || localTokenResult;
  const { registrant, registrationRequired, isLoading, setToken, clearToken } = resolvedTokenResult;
  const resolvedEntityId = entityId || '';

  if (isLoading) {
    return (
      <div className="w-full md:max-w-md mx-auto md:mx-0 p-6 sm:p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center shadow-2xl flex items-center justify-center">
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

export default function MeetingJoinSection({ 
  meeting, 
  entityId, 
  tokenResult 
}: { 
  meeting: Meeting; 
  entityId?: string; 
  tokenResult?: any; 
}) {
  return (
    <Suspense fallback={
      <div className="w-full md:max-w-md mx-auto md:mx-0 p-6 sm:p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center shadow-2xl flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <MeetingJoinSectionInner meeting={meeting} entityId={entityId} tokenResult={tokenResult} />
    </Suspense>
  );
}
