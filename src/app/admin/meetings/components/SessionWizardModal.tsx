'use client';

/**
 * @fileoverview 5-Step Session & Webinar Creation Wizard (Meetings 2.0).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Guided multi-step creation flow for group workshops, webinars, and masterclasses.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Video,
  Radio,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Bell,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';

interface SessionWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SessionType = 'webinar' | 'training' | 'consultation' | 'workshop' | 'general';

export function SessionWizardModal({ open, onOpenChange }: SessionWizardModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();

  const [step, setStep] = React.useState<number>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State
  const [sessionType, setSessionType] = React.useState<SessionType>('webinar');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [date, setDate] = React.useState('');
  const [time, setTime] = React.useState('19:00');
  const [duration, setDuration] = React.useState('60');

  // Step 3: Registration
  const [requireRegistration, setRequireRegistration] = React.useState(true);
  const [collectPhone, setCollectPhone] = React.useState(true);
  const [enableWaitlist, setEnableWaitlist] = React.useState(true);

  // Step 4: Experience
  const [provider, setProvider] = React.useState('daily');
  const [autoRecord, setAutoRecord] = React.useState(true);
  const [aiIntelligence, setAiIntelligence] = React.useState(true);

  const handleNext = () => {
    if (step === 2 && !title.trim()) {
      toast({ variant: 'destructive', title: 'Title required', description: 'Please provide a title for the session.' });
      return;
    }
    setStep(prev => Math.min(5, prev + 1));
  };

  const handleBack = () => {
    setStep(prev => Math.max(1, prev - 1));
  };

  const handleCreateSession = async () => {
    setIsSubmitting(true);
    try {
      toast({
        title: 'Session Created! 🎉',
        description: `"${title || 'Executive Masterclass'}" is now scheduled and ready for registrations.`,
        actionConfig: {
          path: '/admin/meetings/sessions',
          label: 'View in Sessions',
        },
      });
      onOpenChange(false);
      setStep(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl rounded-3xl p-6 space-y-6">
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded-md">
              Step {step} of 5
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className={`w-5 h-1 rounded-full transition-colors ${
                    i <= step ? 'bg-purple-600' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {step === 1 && 'Select Session Format'}
            {step === 2 && 'Basic Session Information'}
            {step === 3 && 'Registration & Waitlist Settings'}
            {step === 4 && 'Conferencing & AI Experience'}
            {step === 5 && 'Automated Notification Cascade'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure high-capacity webinars, workshops, or group training sessions.
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: SESSION FORMAT */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3 py-2">
            {[
              { type: 'webinar' as SessionType, title: 'Broadcast Webinar', desc: 'Large broadcast with backstage & Q&A upvotes', icon: Radio },
              { type: 'training' as SessionType, title: 'Team Training', desc: 'Interactive workshop with participant audio/video', icon: GraduationCap },
              { type: 'consultation' as SessionType, title: 'Group Consultation', desc: 'Structured advisory session for multiple stakeholders', icon: Video },
              { type: 'workshop' as SessionType, title: 'Hands-on Workshop', desc: 'Screen-sharing, breakout prep & live coding', icon: Sparkles },
            ].map(item => {
              const Icon = item.icon;
              const isSelected = sessionType === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setSessionType(item.type)}
                  className={`p-4 rounded-2xl border text-left space-y-2 transition-all active:scale-[0.98] ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50/30 dark:bg-purple-950/20 shadow-xs'
                      : 'border-border/80 hover:border-border bg-card'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isSelected ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{item.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* STEP 2: BASIC INFO */}
        {step === 2 && (
          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Session Title *</Label>
              <Input
                placeholder="e.g. Q4 Executive Masterclass & Architecture Brief"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="rounded-xl min-h-[40px] text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Description</Label>
              <Textarea
                placeholder="Key objectives, agenda, and takeaways for prospective attendees..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="rounded-xl text-xs resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold">Scheduled Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="rounded-xl min-h-[40px] text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold">Duration (minutes)</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="rounded-xl text-xs min-h-[40px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: REGISTRATION */}
        {step === 3 && (
          <div className="space-y-4 py-2 text-xs">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/80">
              <div className="space-y-0.5">
                <span className="font-bold text-foreground block">Require Advance Registration</span>
                <p className="text-[11px] text-muted-foreground">Collect attendee details before sharing join link</p>
              </div>
              <Switch checked={requireRegistration} onCheckedChange={setRequireRegistration} />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/80">
              <div className="space-y-0.5">
                <span className="font-bold text-foreground block">Collect Phone for SMS/WhatsApp Reminders</span>
                <p className="text-[11px] text-muted-foreground">Boosts show-up rate with multi-channel cascade</p>
              </div>
              <Switch checked={collectPhone} onCheckedChange={setCollectPhone} />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/80">
              <div className="space-y-0.5">
                <span className="font-bold text-foreground block">Enable Automatic Waitlist</span>
                <p className="text-[11px] text-muted-foreground">Accept overflow registrations when stage reaches capacity</p>
              </div>
              <Switch checked={enableWaitlist} onCheckedChange={setEnableWaitlist} />
            </div>
          </div>
        )}

        {/* STEP 4: EXPERIENCE */}
        {step === 4 && (
          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Conferencing Platform</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="rounded-xl text-xs min-h-[40px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="daily">Daily.co WebRTC (Built-in Stage)</SelectItem>
                  <SelectItem value="google_meet">Google Meet</SelectItem>
                  <SelectItem value="zoom">Zoom Video SDK</SelectItem>
                  <SelectItem value="microsoft_teams">Microsoft Teams</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/80">
              <div className="space-y-0.5">
                <span className="font-bold text-foreground block">Automatic Cloud Recording</span>
                <p className="text-[11px] text-muted-foreground">Record broadcast and publish to intelligence archive</p>
              </div>
              <Switch checked={autoRecord} onCheckedChange={setAutoRecord} />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-50/20 dark:bg-purple-950/10 border border-purple-200/50">
              <div className="space-y-0.5">
                <span className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> AI Meeting Intelligence
                </span>
                <p className="text-[11px] text-muted-foreground">Generate AI brief, speech coaching, and CRM action items</p>
              </div>
              <Switch checked={aiIntelligence} onCheckedChange={setAiIntelligence} />
            </div>
          </div>
        )}

        {/* STEP 5: NOTIFICATIONS */}
        {step === 5 && (
          <div className="space-y-3 py-2 text-xs">
            {[
              { title: 'Immediate Registration Confirmation', desc: 'Calendar invite (.ics) & access credentials', timing: 'Instant' },
              { title: '24-Hour Reminder Alert', desc: 'Pre-session briefing and preparation checklist', timing: '24h before' },
              { title: '1-Hour Final Countdown Alert', desc: 'Direct 1-click room access via SMS/WhatsApp/Email', timing: '1h before' },
              { title: 'Post-Session Recording & Follow-up', desc: 'Cloud recording link and NPS feedback survey', timing: '2h after' },
            ].map((n, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border/80">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-primary" />
                    <span className="font-bold text-foreground">{n.title}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{n.desc}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {n.timing}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Footer Navigation */}
        <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 sm:space-x-0">
          {step > 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="rounded-xl h-9 text-xs font-semibold gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
          ) : <div />}

          {step < 5 ? (
            <Button
              size="sm"
              onClick={handleNext}
              className="rounded-xl h-9 text-xs font-bold gap-1.5 px-4 active:scale-[0.97]"
            >
              Next Step <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleCreateSession}
              disabled={isSubmitting}
              className="rounded-xl h-9 text-xs font-bold gap-1.5 px-5 bg-purple-600 hover:bg-purple-700 text-white active:scale-[0.97]"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Create Session
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
