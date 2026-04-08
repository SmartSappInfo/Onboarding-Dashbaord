'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { Meeting, MeetingRegistrant } from '@/lib/types';
import CountdownTimer from '@/components/countdown-timer';
import { isAfter } from 'date-fns';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Rocket, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MeetingRegisteredStateProps {
  meeting: Meeting;
  registrant: MeetingRegistrant;
  onClearToken: () => void;
}

/**
 * Displayed when a valid token is detected on the meeting page.
 * Shows the registrant's name, countdown, and auto-redirects to the meeting
 * when the time arrives — marking them as attended.
 */
export default function MeetingRegisteredState({
  meeting,
  registrant,
  onClearToken,
}: MeetingRegisteredStateProps) {
  const firestore = useFirestore();
  const [state, setState] = useState<'waiting' | 'launching' | 'redirected' | 'ended'>('waiting');
  const [launchCountdown, setLaunchCountdown] = useState(3);

  const markAttendedAndRedirect = useCallback(async () => {
    if (!firestore || state === 'redirected') return;
    setState('launching');

    try {
      // Update registrant status to attended
      const registrantRef = doc(firestore, `meetings/${meeting.id}/registrants`, registrant.id);
      await updateDoc(registrantRef, {
        status: 'attended',
        attendedAt: new Date().toISOString(),
      });

      // Dual-write to attendees subcollection for backward compatibility with Results page
      const attendeesRef = collection(firestore, `meetings/${meeting.id}/attendees`);
      await addDoc(attendeesRef, {
        meetingId: meeting.id,
        schoolId: meeting.schoolId || '',
        parentName: registrant.name,
        childrenNames: [],
        joinedAt: new Date().toISOString(),
        registrantId: registrant.id,
        registrantToken: registrant.token,
      });
    } catch (error) {
      console.error('Failed to mark attendance:', error);
    }

    // Countdown before redirect
    let count = 3;
    setLaunchCountdown(count);
    const interval = setInterval(() => {
      count--;
      setLaunchCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        setState('redirected');
        if (meeting.meetingLink) {
          window.open(meeting.meetingLink, '_blank');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [firestore, meeting, registrant, state]);

  // Check if meeting time has arrived
  useEffect(() => {
    if (registrant.status === 'attended') {
      setState('ended');
      return;
    }

    const checkTime = () => {
      const meetingTime = new Date(meeting.meetingTime);
      const now = new Date();
      // Allow entry 5 minutes before meeting time
      const entryTime = new Date(meetingTime.getTime() - 5 * 60 * 1000);
      const endTime = new Date(meetingTime.getTime() + 2 * 60 * 60 * 1000);

      if (meeting.recordingUrl) {
        setState('ended');
      } else if (isAfter(now, endTime)) {
        setState('ended');
      } else if (isAfter(now, entryTime) && state === 'waiting') {
        markAttendedAndRedirect();
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [meeting.meetingTime, meeting.recordingUrl, registrant.status, state, markAttendedAndRedirect]);

  const firstName = registrant.name.split(' ')[0];

  if (state === 'launching') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md mx-auto md:mx-0 p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center space-y-6 shadow-2xl"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="mx-auto bg-primary/20 w-20 h-20 rounded-full flex items-center justify-center"
        >
          <Rocket className="h-10 w-10 text-primary" />
        </motion.div>
        <div className="space-y-2">
          <p className="text-2xl font-black text-white leading-tight uppercase tracking-tight">
            Launching Meeting Room...
          </p>
          <p className="text-6xl font-black text-primary tabular-nums">{launchCountdown}</p>
        </div>
      </motion.div>
    );
  }

  if (state === 'redirected') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md mx-auto md:mx-0 p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center space-y-6 shadow-2xl"
      >
        <div className="mx-auto bg-emerald-500/20 w-16 h-16 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        </div>
        <div className="space-y-2">
          <p className="text-xl font-black text-white uppercase tracking-tight">You're In!</p>
          <p className="text-sm text-white/60 font-medium">
            Meeting room has been opened in a new tab.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.open(meeting.meetingLink, '_blank')}
          className="rounded-xl font-bold text-white border-white/20 hover:bg-white/10"
        >
          Reopen Meeting Room
        </Button>
      </motion.div>
    );
  }

  if (state === 'ended') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md mx-auto md:mx-0 p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center space-y-4 shadow-2xl"
      >
        <div className="mx-auto bg-emerald-500/20 w-16 h-16 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        </div>
        <div className="space-y-2">
          <p className="text-xl font-black text-white uppercase tracking-tight">Session Complete</p>
          <p className="text-sm text-white/60 font-medium">
            Thank you for attending, {firstName}!
          </p>
        </div>
        {meeting.recordingUrl && (
          <Button
            variant="outline"
            onClick={() => {
              const el = document.getElementById('recording');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="rounded-xl font-bold text-white border-white/20 hover:bg-white/10"
          >
            Watch Recording
          </Button>
        )}
      </motion.div>
    );
  }

  // Default: waiting state
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto md:mx-0 space-y-6"
    >
      <div className="p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 text-center space-y-6 shadow-2xl">
        <div className="mx-auto bg-primary/20 w-16 h-16 rounded-full flex items-center justify-center">
          <User className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-3">
          <p className="text-2xl font-black text-white leading-tight">
            Welcome back, {firstName}! 👋
          </p>
          <p className="text-base font-medium text-white/70 leading-relaxed px-4">
            You're registered for this session. The meeting room will open automatically when it's time.
          </p>
        </div>

        <div className="pt-2">
          <CountdownTimer targetDate={meeting.meetingTime || new Date().toISOString()} />
        </div>

        <div className={cn(
          "flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest",
          registrant.status === 'waitlisted' ? "text-amber-400" : "text-emerald-400"
        )}>
          {registrant.status === 'waitlisted' ? (
            <>
              <Clock className="h-3 w-3" />
              On Waitlist — We'll notify you
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Registration Confirmed
            </>
          )}
        </div>
      </div>

      <button
        onClick={onClearToken}
        className="text-white/30 text-[10px] font-bold uppercase tracking-widest hover:text-white/60 transition-colors mx-auto block"
      >
        Not {firstName}? Register as someone else →
      </button>
    </motion.div>
  );
}
