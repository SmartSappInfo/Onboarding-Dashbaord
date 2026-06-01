'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Video,
} from 'lucide-react';
import LightRays from '@/components/LightRays';
import AnimatedHeroShapes from '@/components/animated-hero-shapes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { submitRsvpResponseAction } from '@/app/actions/meeting-registrants-actions';

interface RsvpResponseClientProps {
  meetingId: string;
  meetingTitle: string;
  meetingTime: string;
  meetingLink: string;
  typeSlug: string;
  entitySlug: string;
  token: string;
  initialResponse: 'going' | 'not_going' | 'later' | null;
  dbResponse?: 'going' | 'not_going' | 'later' | null;
}

export default function RsvpResponseClient({
  meetingId,
  meetingTitle,
  meetingTime,
  meetingLink,
  typeSlug,
  entitySlug,
  token,
  initialResponse,
  dbResponse,
}: RsvpResponseClientProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [response, setResponse] = React.useState<'going' | 'not_going' | 'later' | null>(
    initialResponse || dbResponse || null,
  );
  const [errorMsg, setErrorMsg] = React.useState('');
  const autoSubmittedRef = React.useRef(false);

  const handleRsvp = React.useCallback(
    async (choice: 'going' | 'not_going' | 'later') => {
      setStatus('submitting');
      try {
        const res = await submitRsvpResponseAction(meetingId, token, choice);
        if (res.success) {
          setResponse(choice);
          setStatus('success');
        } else {
          setErrorMsg(res.error || 'Failed to update RSVP.');
          setStatus('error');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'An error occurred.');
        setStatus('error');
      }
    },
    [meetingId, token],
  );

  // Automatically submit if there is an initial response parameter and we have not submitted yet
  React.useEffect(() => {
    if (initialResponse && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleRsvp(initialResponse);
    }
  }, [initialResponse, handleRsvp]);

  const formattedDate = React.useMemo(() => {
    try {
      return new Date(meetingTime).toLocaleString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return meetingTime;
    }
  }, [meetingTime]);

  return (
    <section className="relative w-full bg-background text-foreground min-h-screen flex items-center overflow-hidden pt-16 md:pt-24 pb-16">
      <LightRays
        raysOrigin="top-center"
        raysColor="#3B5FFF"
        raysSpeed={1.2}
        lightSpread={0.6}
        rayLength={3}
        followMouse={true}
        mouseInfluence={0.4}
        noiseAmount={0}
        distortion={0}
        pulsating
        fadeDistance={1}
        saturation={1.1}
        className="!absolute inset-0"
      />
      <AnimatedHeroShapes />

      <div className="relative z-10 container max-w-lg mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center space-y-6"
        >
          {/* Header Badge */}
          <div className="flex justify-center">
            <Badge
              variant="secondary"
              className="text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20"
            >
              Meeting Invitation RSVP
            </Badge>
          </div>

          <Card className="border-none shadow-2xl bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 overflow-hidden">
            <CardContent className="p-5 sm:p-8 md:p-10 space-y-8">
              {/* Dynamic Status Icons */}
              <div className="flex justify-center">
                {status === 'submitting' && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    className="h-16 w-16 text-primary flex items-center justify-center"
                  >
                    <Loader2 className="h-12 w-12" />
                  </motion.div>
                )}

                {status !== 'submitting' && response === 'going' && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="h-16 w-16 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30 text-emerald-400"
                  >
                    <CheckCircle2 className="h-10 w-10" />
                  </motion.div>
                )}

                {status !== 'submitting' && response === 'not_going' && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="h-16 w-16 bg-rose-500/20 rounded-full flex items-center justify-center border border-rose-500/30 text-rose-400"
                  >
                    <XCircle className="h-10 w-10" />
                  </motion.div>
                )}

                {status !== 'submitting' && response === 'later' && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="h-16 w-16 bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-500/30 text-amber-400"
                  >
                    <Clock className="h-10 w-10" />
                  </motion.div>
                )}

                {status !== 'submitting' && !response && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="h-16 w-16 bg-primary/20 rounded-full flex items-center justify-center border border-primary/30 text-primary"
                  >
                    <Calendar className="h-10 w-10" />
                  </motion.div>
                )}
              </div>

              {/* Text content based on RSVP selection */}
              <div className="space-y-3">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground leading-tight">
                  {response === 'going' && "You're Confirmed! 🎉"}
                  {response === 'not_going' && 'RSVP Declined'}
                  {response === 'later' && 'RSVP Saved — Decide Later'}
                  {!response && "We'd Love to Have You!"}
                </h1>
                <p className="text-sm font-medium text-foreground/75 leading-relaxed max-w-sm mx-auto">
                  {response === 'going' &&
                    'Fantastic! Your spot is secured. We look forward to seeing you at the session.'}
                  {response === 'not_going' &&
                    "We are sorry you can't make it. You can watch the recording afterwards if available."}
                  {response === 'later' &&
                    "No problem! We've saved your interest. You can return to this page anytime to update your choice."}
                  {!response && `Please select your availability for: ${meetingTitle}`}
                </p>
              </div>

              {/* Session Information Panel */}
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-left space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary">
                  Session Details
                </h3>
                <div>
                  <p className="text-sm font-bold text-foreground truncate">{meetingTitle}</p>
                  <p className="text-xs font-semibold text-foreground/60 mt-1 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                    {formattedDate}
                  </p>
                </div>
              </div>

              {/* Action Buttons / Choice buttons */}
              {status === 'idle' || status === 'error' ? (
                <div className="space-y-3 pt-4">
                  {!response ? (
                    /* Stack on mobile, 3-col from sm: up */
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Button
                        onClick={() => handleRsvp('going')}
                        className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white h-12 text-sm"
                      >
                        I'll Attend
                      </Button>
                      <Button
                        onClick={() => handleRsvp('not_going')}
                        className="rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white h-12 text-sm"
                      >
                        I Can't Attend
                      </Button>
                      <Button
                        onClick={() => handleRsvp('later')}
                        className="rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-white h-12 text-sm"
                      >
                        Remind me Later
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {response === 'going' && (
                        <Button
                          onClick={() =>
                            router.push(
                              `/meetings/${typeSlug}/${entitySlug}/join?token=${token}`,
                            )
                          }
                          className="w-full rounded-xl font-bold h-12 text-sm gap-2"
                        >
                          Go to Waiting Room
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => {
                          setResponse(null);
                          setStatus('idle');
                        }}
                        className="w-full rounded-xl font-bold h-11 border-white/10 hover:bg-white/5 text-xs text-foreground/60"
                      >
                        Change RSVP Choice
                      </Button>
                    </div>
                  )}

                  {status === 'error' && (
                    <p className="text-xs font-semibold text-rose-400 mt-2">{errorMsg}</p>
                  )}
                </div>
              ) : (
                status === 'success' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3 pt-4"
                  >
                    {response === 'going' && (
                      <Button
                        onClick={() =>
                          router.push(
                            `/meetings/${typeSlug}/${entitySlug}/join?token=${token}`,
                          )
                        }
                        className="w-full rounded-xl font-bold h-12 text-sm gap-2"
                      >
                        Enter Waiting Room
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => {
                        setResponse(null);
                        setStatus('idle');
                      }}
                      className="w-full rounded-xl font-bold h-11 border-white/10 hover:bg-white/5 text-xs text-foreground/60"
                    >
                      Change Availability Choice
                    </Button>
                  </motion.div>
                )
              )}
            </CardContent>
          </Card>

          {/* Footer Branding info */}
          <div className="flex items-center justify-center gap-2 text-foreground/40 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4" />
            Verified secure RSVP portal
          </div>
        </motion.div>
      </div>
    </section>
  );
}
