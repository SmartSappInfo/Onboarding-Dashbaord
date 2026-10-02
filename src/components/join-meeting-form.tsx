'use client';

/**
 * JoinMeetingForm Component
 * 
 * Public meeting join interaction card.
 * Supports two distinct modes based on meeting configuration:
 * 1. Direct 1-Click Join (Default, collectAttendeeDetails === false):
 *    Attendees enter immediately with zero friction once the countdown has ended.
 *    Logs an anonymous attendee telemetry record in Firestore without blocking room launch.
 * 2. Information Gate (collectAttendeeDetails === true):
 *    Prompts attendees for Full Name and Children details before opening the room URL.
 * 
 * Complies with docs/agents_mcp/agents_mcp_rules.md:
 * - URL safety validation (anti-open-redirect)
 * - Click debouncing & popup blocker prevention
 * - Mobile min-h-[44px] touch targets & active:scale-[0.97]
 * - Card and outline backgrounds aligned with theme
 */

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { addDoc, collection } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useState, useEffect } from 'react';
import { Loader2, Plus, X, Baby, UserCircle, Clock, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';

const formSchema = z.object({
  name: z.string().min(3, { message: 'Please enter your full name.' }),
  childrenNames: z.array(z.object({
    value: z.string().min(2, { message: 'Child name required.' })
  })).default([{ value: '' }]),
});

interface JoinMeetingFormProps {
  meetingId: string;
  entityId: string;
  meetingLink: string;
  meetingTime: string;
  collectAttendeeDetails?: boolean;
  heroCtaLabel?: string;
}

function isValidMeetingUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

export default function JoinMeetingForm({ 
  meetingId, 
  entityId, 
  meetingLink, 
  meetingTime,
  collectAttendeeDetails = false,
  heroCtaLabel,
}: JoinMeetingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMeetingTime, setIsMeetingTime] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
        name: '', 
        childrenNames: [{ value: '' }] 
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "childrenNames"
  });

  useEffect(() => {
    setIsClient(true);
    const checkMeetingTime = () => {
      const now = new Date();
      if (!meetingTime) {
        setIsMeetingTime(true);
        return;
      }
      const mt = new Date(meetingTime);
      if (isNaN(mt.getTime())) {
        setIsMeetingTime(true);
        return;
      }
      // Logic: Allow access 5 minutes before or any time after start
      setIsMeetingTime(now.getTime() >= mt.getTime() - 5 * 60 * 1000);
    };
    checkMeetingTime();
    const interval = setInterval(checkMeetingTime, 1000);
    return () => clearInterval(interval);
  }, [meetingTime]);

  const handleDirectJoin = () => {
    if (isSubmitting) return;

    const trimmedUrl = (meetingLink || '').trim();
    if (!isValidMeetingUrl(trimmedUrl)) {
      toast({
        variant: 'destructive',
        title: 'Meeting link unavailable',
        description: 'The host has not configured a valid meeting link yet.',
      });
      return;
    }

    setIsSubmitting(true);

    // Non-blocking telemetry attendance log to Firestore
    if (firestore && meetingId) {
      try {
        const attendeesCollection = collection(firestore, `meetings/${meetingId}/attendees`);
        addDoc(attendeesCollection, {
          meetingId,
          entityId: entityId || '',
          parentName: 'Guest Attendee',
          isGuest: true,
          childrenNames: [],
          joinedAt: new Date().toISOString(),
        }).catch((err) => {
          console.warn('[JoinMeetingForm] Non-fatal: failed to log guest attendee:', err);
        });
      } catch (err) {
        console.warn('[JoinMeetingForm] Non-fatal: error logging guest attendee:', err);
      }
    }

    // Direct synchronous window.open preserves browser user gesture
    window.open(trimmedUrl, '_blank', 'noopener,noreferrer');

    // Debounce reset after 2.5s
    setTimeout(() => {
      setIsSubmitting(false);
    }, 2500);
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (isSubmitting) return;

    const trimmedUrl = (meetingLink || '').trim();
    if (!isValidMeetingUrl(trimmedUrl)) {
      toast({
        variant: 'destructive',
        title: 'Meeting link unavailable',
        description: 'The host has not configured a valid meeting link yet.',
      });
      return;
    }

    // Synchronously open the meeting room to preserve browser user gesture across all mobile browsers
    window.open(trimmedUrl, '_blank', 'noopener,noreferrer');

    // Asynchronously record attendance details in Firestore without delaying room access
    if (firestore && meetingId) {
      try {
        const attendeesCollection = collection(firestore, `meetings/${meetingId}/attendees`);
        const children = data.childrenNames.map(c => c.value).filter(v => !!v);

        addDoc(attendeesCollection, {
          meetingId,
          entityId: entityId || '',
          parentName: data.name,
          childrenNames: children,
          joinedAt: new Date().toISOString(),
        }).catch((error) => {
          console.warn("[JoinMeetingForm] Non-fatal: failed to log attendance:", error);
        });
      } catch (error) {
        console.warn("[JoinMeetingForm] Non-fatal: error logging attendance:", error);
      }
    }

    setTimeout(() => {
      setIsSubmitting(false);
      form.reset();
    }, 1500);
  };

  if (!isClient) return null;

  return (
    <div className="w-full max-w-md mx-auto md:mx-0">
        <AnimatePresence mode="wait">
            {!isMeetingTime ? (
                /* ── Waiting State: Countdown Pending ── */
                <motion.div 
                    key="waiting"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-8 sm:p-10 bg-card/95 backdrop-blur-xl rounded-[2.5rem] border border-border/80 text-center space-y-6 shadow-2xl"
                >
                    <div className="mx-auto bg-primary/10 dark:bg-primary/20 w-16 h-16 rounded-full flex items-center justify-center mb-2 border border-primary/20">
                        <Clock className="h-8 w-8 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-3">
                        <p className="text-2xl font-black text-foreground leading-tight">😃 You&apos;re In Too Early!</p>
                        <p className="text-base font-medium text-muted-foreground leading-relaxed px-4">
                            You&apos;ll be able to join from here, when the countdown is over
                        </p>
                    </div>
                </motion.div>
            ) : !collectAttendeeDetails ? (
                /* ── Mode 1 (Default): Direct 1-Click Join ── */
                <motion.div 
                    key="direct-join"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-8 sm:p-10 bg-card/95 backdrop-blur-xl rounded-[2.5rem] border border-border/80 shadow-2xl text-center space-y-6 text-card-foreground"
                >
                    <div className="mx-auto bg-emerald-500/10 dark:bg-emerald-500/20 w-16 h-16 rounded-full flex items-center justify-center mb-2 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                        <Zap className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-2xl font-black text-foreground tracking-tight leading-tight">
                            The Meeting Has Started!
                        </p>
                        <p className="text-sm font-medium text-muted-foreground leading-relaxed px-2">
                            Click below to enter the live session room directly.
                        </p>
                    </div>
                    <Button 
                        onClick={handleDirectJoin}
                        size="lg" 
                        disabled={isSubmitting}
                        className="w-full min-h-[56px] h-14 rounded-[1.5rem] font-black text-base sm:text-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/25 transition-all active:scale-[0.97] uppercase tracking-wider gap-3" 
                    >
                        {isSubmitting ? (
                            <Loader2 className="animate-spin h-6 w-6" />
                        ) : (
                            <>
                                <Zap className="h-6 w-6" />
                                {heroCtaLabel || 'Enter Meeting Room'}
                            </>
                        )}
                    </Button>
                </motion.div>
            ) : (
                /* ── Mode 2: Information Gate (Name & Child Details Required) ── */
                <motion.form 
                    key="form"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onSubmit={form.handleSubmit(onSubmit)} 
                    className="p-8 sm:p-10 bg-card/95 backdrop-blur-xl rounded-[2.5rem] border border-border/80 shadow-2xl space-y-6 text-card-foreground"
                >
                    <div className="space-y-6">
                        {/* Parent Name */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1 flex items-center gap-2">
                                <UserCircle className="h-3 w-3 text-primary" /> Your Full Name
                            </Label>
                            <Input 
                                {...form.register('name')} 
                                placeholder="e.g. Ama Serwaa"
                                className="min-h-[44px] h-12 text-base bg-background text-foreground border border-input rounded-xl px-4 shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
                                disabled={isSubmitting}
                            />
                            {form.formState.errors.name && (
                                <p className="text-rose-500 dark:text-rose-400 text-[10px] font-black uppercase tracking-tighter px-1 mt-1">
                                    {form.formState.errors.name.message}
                                </p>
                            )}
                        </div>

                        {/* Children Names */}
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1 flex items-center gap-2">
                                <Baby className="h-3 w-3 text-primary" /> Children at this school
                            </Label>
                            
                            <div className="space-y-2">
                                {fields.map((field, index) => (
                                    <motion.div 
                                        key={field.id}
                                        initial={{ x: -10, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        className="flex gap-2"
                                    >
                                        <Input 
                                            {...form.register(`childrenNames.${index}.value` as const)}
                                            placeholder={`Child ${index + 1} Name`}
                                            className="min-h-[44px] h-11 bg-background text-foreground border border-input rounded-xl px-4 shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
                                            disabled={isSubmitting}
                                        />
                                        {index === fields.length - 1 ? (
                                            <Button 
                                                type="button" 
                                                variant="secondary"
                                                size="icon"
                                                className="min-h-[44px] min-w-[44px] h-11 w-11 rounded-xl shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
                                                onClick={() => append({ value: '' })}
                                            >
                                                <Plus className="h-5 w-5" />
                                            </Button>
                                        ) : (
                                            <Button 
                                                type="button" 
                                                variant="ghost"
                                                size="icon"
                                                className="min-h-[44px] min-w-[44px] h-11 w-11 rounded-xl shrink-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 active:scale-[0.97]"
                                                onClick={() => remove(index)}
                                            >
                                                <X className="h-5 w-5" />
                                            </Button>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <Button 
                        type="submit" 
                        size="lg" 
                        className="w-full min-h-[56px] h-14 rounded-[1.5rem] font-black text-base sm:text-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/25 transition-all active:scale-[0.97] uppercase tracking-widest gap-3" 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <Loader2 className="animate-spin h-6 w-6" />
                        ) : (
                            <>
                                <Zap className="h-6 w-6" />
                                {heroCtaLabel || 'Enter Meeting Room'}
                            </>
                        )}
                    </Button>
                </motion.form>
            )}
        </AnimatePresence>
    </div>
  );
}
