'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { BookingPage } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Calendar as CalendarIcon, 
  Video, 
  CheckCircle, 
  Loader2, 
  ArrowLeft,
  CalendarCheck
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { createBookingAction } from '@/app/actions/scheduler-actions';

interface ConfirmBookingClientProps {
  bookingPage: BookingPage;
  timeStr: string;
}

export default function ConfirmBookingClient({ bookingPage, timeStr }: ConfirmBookingClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [visitorName, setVisitorName] = React.useState('');
  const [visitorEmail, setVisitorEmail] = React.useState('');
  const [visitorPhone, setVisitorPhone] = React.useState('');
  const [answers, setAnswers] = React.useState<Record<string, string | string[]>>({});
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [successBookingId, setSuccessBookingId] = React.useState<string | null>(null);

  const parsedTime = React.useMemo(() => parseISO(timeStr), [timeStr]);

  const handleQuestionChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
    setAnswers(prev => {
      const current = (prev[questionId] as string[]) || [];
      const updated = checked 
        ? [...current, option]
        : current.filter(o => o !== option);
      return {
        ...prev,
        [questionId]: updated,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim() || !visitorEmail.trim()) {
      toast({ 
        variant: 'destructive', 
        title: 'Required Fields', 
        description: 'Please input your name and email.' 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createBookingAction({
        bookingPageId: bookingPage.id,
        scheduledTime: timeStr,
        visitorName: visitorName.trim(),
        visitorEmail: visitorEmail.trim(),
        visitorPhone: visitorPhone.trim() || undefined,
        answers,
      });

      if (res.success && res.data) {
        setSuccessBookingId(res.data);
        toast({ 
          title: 'Booking Confirmed', 
          description: 'Your appointment has been successfully scheduled.' 
        });
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'Booking Failed', 
          description: res.error || 'Failed to complete appointment booking.' 
        });
      }
    } catch (err: unknown) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: err instanceof Error ? err.message : 'An unexpected error occurred.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {!successBookingId ? (
        <motion.div
          key="booking-form"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-xl z-10"
        >
          <Card className="border-none bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl p-8 text-left space-y-6">
            
            {/* Header: Back Navigation & Date Summary */}
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="h-8 text-slate-400 hover:text-white px-2 rounded-lg -ml-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Slots
              </Button>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/5 pb-4">
                <div className="flex items-center gap-1.5 text-slate-200">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold">{format(parsedTime, 'EEEE, MMMM d')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-200">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold tabular-nums">
                    {format(parsedTime, 'p')} ({bookingPage.durationMinutes} min)
                  </span>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Standard Guest Info */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Your Name *</Label>
                <Input
                  required
                  value={visitorName}
                  onChange={e => setVisitorName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="h-11 rounded-xl bg-white/[0.03] border-white/10 hover:border-white/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none text-sm px-4 text-slate-100"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Your Email Address *</Label>
                <Input
                  required
                  type="email"
                  value={visitorEmail}
                  onChange={e => setVisitorEmail(e.target.value)}
                  placeholder="e.g. john@example.com"
                  className="h-11 rounded-xl bg-white/[0.03] border-white/10 hover:border-white/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none text-sm px-4 text-slate-100"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Your Phone Number (Optional)</Label>
                <Input
                  value={visitorPhone}
                  onChange={e => setVisitorPhone(e.target.value)}
                  placeholder="e.g. +233240000000"
                  className="h-11 rounded-xl bg-white/[0.03] border-white/10 hover:border-white/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none text-sm px-4 text-slate-100"
                />
              </div>

              {/* Custom Questions Grid */}
              {bookingPage.questions && bookingPage.questions.map(q => (
                <div key={q.id} className="space-y-2 pt-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                    {q.label} {q.required ? '*' : ''}
                  </Label>
                  
                  {q.type === 'text' && (
                    <Input
                      required={q.required}
                      value={(answers[q.id] as string) || ''}
                      onChange={e => handleQuestionChange(q.id, e.target.value)}
                      placeholder="Type your response..."
                      className="h-11 rounded-xl bg-white/[0.03] border-white/10 hover:border-white/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none text-sm px-4 text-slate-100"
                    />
                  )}

                  {q.type === 'textarea' && (
                    <Textarea
                      required={q.required}
                      rows={3}
                      value={(answers[q.id] as string) || ''}
                      onChange={e => handleQuestionChange(q.id, e.target.value)}
                      placeholder="Type details..."
                      className="rounded-xl bg-white/[0.03] border-white/10 hover:border-white/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none text-sm p-4 text-slate-100"
                    />
                  )}

                  {q.type === 'dropdown' && (
                    <select
                      required={q.required}
                      value={(answers[q.id] as string) || ''}
                      onChange={e => handleQuestionChange(q.id, e.target.value)}
                      className="h-11 w-full rounded-xl bg-slate-900 border border-white/10 hover:border-white/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none text-sm px-4 text-slate-100"
                    >
                      <option value="" disabled>Select an option</option>
                      {q.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {q.type === 'checkbox' && q.options && (
                    <div className="space-y-2 pl-1 pt-1">
                      {q.options.map(opt => (
                        <div key={opt} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`${q.id}_${opt}`}
                            checked={((answers[q.id] as string[]) || []).includes(opt)}
                            onChange={e => handleCheckboxChange(q.id, opt, e.target.checked)}
                            className="h-4 w-4 rounded border-white/10 text-primary bg-transparent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus:ring-offset-0"
                          />
                          <label htmlFor={`${q.id}_${opt}`} className="text-xs font-semibold text-slate-300">
                            {opt}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'radio' && q.options && (
                    <div className="space-y-2 pl-1 pt-1">
                      {q.options.map(opt => (
                        <div key={opt} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`radio_${q.id}`}
                            id={`${q.id}_${opt}`}
                            checked={(answers[q.id] as string) === opt}
                            onChange={() => handleQuestionChange(q.id, opt)}
                            className="h-4 w-4 border-white/10 text-primary bg-transparent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus:ring-offset-0"
                          />
                          <label htmlFor={`${q.id}_${opt}`} className="text-xs font-semibold text-slate-300">
                            {opt}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Submit footer */}
              <div className="pt-6 border-t border-white/5 flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl font-bold h-12 px-8 bg-primary hover:bg-primary-hover text-white text-xs active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Confirming Booking...
                    </>
                  ) : (
                    <>
                      <CalendarCheck className="h-4 w-4" /> Confirm Appointment
                    </>
                  )}
                </Button>
              </div>

            </form>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          key="booking-success"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="w-full max-w-md z-10"
        >
          <Card className="border-none bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl p-8 text-center space-y-6">
            
            <div className="flex justify-center">
              <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-full animate-bounce">
                <CheckCircle className="h-12 w-12" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Appointment Scheduled!</h2>
              <p className="text-xs font-semibold text-slate-400">
                Your booking with the host has been successfully confirmed. An email invite with connection details has been dispatched.
              </p>
            </div>

            <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4 text-left">
              <h3 className="text-xs font-bold text-white border-b border-white/5 pb-2">Meeting details</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-slate-300 text-xs">
                  <CalendarIcon className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="font-bold">{format(parsedTime, 'EEEE, MMMM d, yyyy')}</span>
                </div>
                
                <div className="flex items-center gap-2.5 text-slate-300 text-xs">
                  <Clock className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="font-bold tabular-nums">{format(parsedTime, 'p')}</span>
                </div>

                <div className="flex items-center gap-2.5 text-slate-300 text-xs">
                  <Video className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="font-bold capitalize">{bookingPage.meetingProvider.replace('_', ' ').toLowerCase()} link generated</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={() => router.push(`/book/${bookingPage.slug}`)}
                className="w-full rounded-xl font-bold h-11 bg-white/10 hover:bg-white/15 text-slate-200 text-xs active:scale-[0.97]"
              >
                Back to Calendar
              </Button>
            </div>

          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
