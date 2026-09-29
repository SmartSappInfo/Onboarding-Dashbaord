'use client';

/**
 * {{Org_name}} Experience Platform — Interactive Portal Onboarding Wizard Modal
 *
 * Immersive step-by-step orientation journey for learners and members.
 * Supports embedded orientation video, inline profile setup, course navigation,
 * community jump, task assignments, and celebration confetti.
 *
 * Conforms to:
 * - next-best-practices, vercel-react-best-practices
 * - emilkowal-animations (tactile feedback, active:scale-[0.97])
 * - Minimum 44px mobile touch targets
 * - Strict typing (0 any, 0 any[], 0 unhandled unknown)
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  advanceOnboardingStepAction,
  recordOrientationWatchedAction,
} from '@/app/actions/engagement-actions';
import { updatePortalMemberProfileAction } from '@/app/actions/membership-actions';
import { useAuth } from '@/firebase';
import type {
  OnboardingStep,
  MemberOnboardingProgress,
} from '@/lib/types/engagement';
import type { PortalMembership } from '@/lib/types/membership';
import {
  CheckCircle2,
  Circle,
  Play,
  User,
  BookOpen,
  MessageSquare,
  CheckSquare,
  ExternalLink,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  PartyPopper,
} from 'lucide-react';

interface PortalOnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalId: string;
  portalSlug: string;
  userId: string;
  steps: OnboardingStep[];
  progress: MemberOnboardingProgress | null;
  membership?: PortalMembership | null;
  completionPoints?: number;
  onSuccess?: () => void;
}

export function PortalOnboardingModal({
  open,
  onOpenChange,
  portalId,
  portalSlug,
  userId: _userId,
  steps,
  progress,
  membership,
  completionPoints = 20,
  onSuccess,
}: PortalOnboardingModalProps) {
  const { toast } = useToast();
  const auth = useAuth();

  const completedStepIds = React.useMemo(() => progress?.completedStepIds || [], [progress?.completedStepIds]);
  const progressPct = progress?.progressPercentage || 0;
  const isFullyCompleted = progress?.isCompleted || (steps.length > 0 && completedStepIds.length >= steps.length);

  // Active step index
  const [currentStepIndex, setCurrentStepIndex] = React.useState<number>(0);
  const [isProcessingStep, setIsProcessingStep] = React.useState<boolean>(false);

  // Profile form state for 'complete_profile' step
  const [profileName, setProfileName] = React.useState('');
  const [profileBio, setProfileBio] = React.useState('');
  const [profileRole, setProfileRole] = React.useState('');
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);

  // Initialize profile form from membership
  React.useEffect(() => {
    if (membership) {
      setProfileName(membership.displayName || '');
      const bioVal = typeof membership.customFields?.bio === 'string' ? membership.customFields.bio : '';
      const roleVal = typeof membership.customFields?.jobTitle === 'string' ? membership.customFields.jobTitle : '';
      setProfileBio(bioVal);
      setProfileRole(roleVal);
    }
  }, [membership]);

  // Set default step to the first incomplete step
  React.useEffect(() => {
    if (open && steps.length > 0) {
      const firstIncomplete = steps.findIndex(s => !completedStepIds.includes(s.id));
      if (firstIncomplete >= 0) {
        setCurrentStepIndex(firstIncomplete);
      } else {
        setCurrentStepIndex(0);
      }
    }
  }, [open, steps, completedStepIds]);

  const activeStep = steps[currentStepIndex] || steps[0];
  const isCurrentStepDone = activeStep ? completedStepIds.includes(activeStep.id) : false;

  // Complete step action
  const handleMarkStepComplete = async (stepId: string) => {
    setIsProcessingStep(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Please sign in again to continue.');
      if (activeStep?.type === 'welcome_video') {
        const res = await recordOrientationWatchedAction(idToken, portalId, portalSlug);
        if (!res.success) throw new Error(res.error);
      } else {
        const res = await advanceOnboardingStepAction(
          idToken,
          {
            portalId,
            stepId,
          },
          portalSlug
        );
        if (!res.success) throw new Error(res.error);
      }

      toast({
        title: 'Step Completed! 🎯',
        description: `Marked "${activeStep.title}" as completed.`,
      });
      onSuccess?.();

      // Advance to next incomplete step
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      }
    } catch (err: unknown) {
      toast({
        title: 'Action Failed',
        description: err instanceof Error ? err.message : 'Failed to complete step.',
      });
    } finally {
      setIsProcessingStep(false);
    }
  };

  // Profile save & complete step
  const handleSaveProfileStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;

    setIsSavingProfile(true);
    try {
      // The server derives the member from this verified token; userId is no longer sent.
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Please sign in again to save your profile.');
      const res = await updatePortalMemberProfileAction(
        idToken,
        {
          portalId,
          displayName: profileName.trim(),
          bio: profileBio.trim() || undefined,
          jobTitle: profileRole.trim() || undefined,
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);

      // Advance step (idToken obtained above for the profile save)
      await advanceOnboardingStepAction(
        idToken,
        {
          portalId,
          stepId: activeStep.id,
        },
        portalSlug
      );

      toast({
        title: 'Profile Updated! 👤',
        description: 'Your member details have been saved and onboarding step verified.',
      });
      onSuccess?.();

      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      }
    } catch (err: unknown) {
      toast({
        title: 'Profile Save Failed',
        description: err instanceof Error ? err.message : 'Failed to save profile.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Helper for embed video url
  const getEmbedVideoUrl = (url?: string): string | null => {
    if (!url) return null;
    if (url.includes('youtube.com/watch?v=')) {
      return url.replace('watch?v=', 'embed/').split('&')[0];
    }
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes('loom.com/share/')) {
      return url.replace('share/', 'embed/');
    }
    if (url.includes('vimeo.com/')) {
      const id = url.split('vimeo.com/')[1]?.split('?')[0];
      return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl p-6 sm:p-8 space-y-5 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Member Onboarding Wizard
            </div>
            <Badge variant="secondary" className="font-bold text-xs">
              +{completionPoints} Points on 100%
            </Badge>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black">
            Welcome to Your Portal Journey
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Complete the milestones below to unlock your full access, community privileges, and course materials.
          </DialogDescription>
        </DialogHeader>

        {/* Overall Progress Bar */}
        <div className="space-y-1.5 bg-muted/30 p-3.5 rounded-2xl border border-border/80">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground">
              {completedStepIds.length} of {steps.length} Steps Completed
            </span>
            <span className="font-extrabold text-primary">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2 rounded-full" />
        </div>

        {/* Step Navigation Dots / Stepper */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {steps.map((s, idx) => {
            const isDone = completedStepIds.includes(s.id);
            const isCurrent = idx === currentStepIndex;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                className={`flex-1 min-w-[70px] sm:min-w-0 p-2 rounded-xl text-left border transition-all text-xs min-h-[44px] flex items-center gap-2 ${
                  isCurrent
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : isDone
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 font-semibold'
                    : 'border-border/60 bg-card text-muted-foreground'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                )}
                <span className="truncate text-[11px] hidden sm:inline">{s.title}</span>
                <span className="sm:hidden text-[11px] font-bold">Step {idx + 1}</span>
              </button>
            );
          })}
        </div>

        {/* ── Active Step View ──────────────────────────────────────────── */}
        {isFullyCompleted ? (
          <div className="py-8 text-center space-y-4 rounded-3xl border-2 border-emerald-500/20 bg-emerald-500/5 p-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <PartyPopper className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-foreground">You Are All Set! 🎉</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Congratulations! You have completed every onboarding milestone and unlocked +{completionPoints} XP for your profile.
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <Button
                onClick={() => onOpenChange(false)}
                className="rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 min-h-[44px] px-6 active:scale-[0.97]"
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        ) : activeStep ? (
          <div className="space-y-4 p-5 rounded-2xl border border-border bg-card shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  Step {currentStepIndex + 1} of {steps.length}
                </div>
                <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
                  {activeStep.title}
                </h3>
                {activeStep.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {activeStep.description}
                  </p>
                )}
              </div>

              {isCurrentStepDone ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold text-xs gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs font-bold">
                  Incomplete
                </Badge>
              )}
            </div>

            {/* Type-Specific Interactive Body */}
            {activeStep.type === 'welcome_video' && (
              <div className="space-y-3 pt-2">
                {activeStep.videoUrl ? (
                  <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black/90 shadow-md">
                    <iframe
                      src={getEmbedVideoUrl(activeStep.videoUrl) || ''}
                      title={activeStep.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="p-8 text-center rounded-2xl bg-muted/20 border border-border/80 text-xs text-muted-foreground">
                    Orientation video will be available shortly.
                  </div>
                )}

                {!isCurrentStepDone && (
                  <Button
                    onClick={() => handleMarkStepComplete(activeStep.id)}
                    disabled={isProcessingStep}
                    className="w-full rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 min-h-[44px] active:scale-[0.97] gap-2 shadow-sm"
                  >
                    {isProcessingStep ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    I&apos;ve Watched the Orientation
                  </Button>
                )}
              </div>
            )}

            {activeStep.type === 'complete_profile' && (
              <div className="space-y-3 pt-2">
                {isCurrentStepDone ? (
                  <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                    Your member profile has been configured and verified.
                  </div>
                ) : (
                  <form onSubmit={handleSaveProfileStep} className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Display Name</Label>
                      <Input
                        value={profileName}
                        onChange={e => setProfileName(e.target.value)}
                        placeholder="Your full name or handle"
                        className="h-10 text-xs rounded-xl min-h-[44px]"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Role / Job Title</Label>
                      <Input
                        value={profileRole}
                        onChange={e => setProfileRole(e.target.value)}
                        placeholder="e.g. Lead Bursar, Administrator, Student"
                        className="h-10 text-xs rounded-xl min-h-[44px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Short Bio</Label>
                      <Textarea
                        value={profileBio}
                        onChange={e => setProfileBio(e.target.value)}
                        placeholder="Tell fellow members what you're working on..."
                        rows={2}
                        className="text-xs rounded-xl resize-none"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isSavingProfile}
                      className="w-full rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 min-h-[44px] active:scale-[0.97] gap-2 shadow-sm"
                    >
                      {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
                      Save Profile & Verify Step
                    </Button>
                  </form>
                )}
              </div>
            )}

            {activeStep.type === 'start_course' && (
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-2">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-primary" /> Learning Center Access
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Begin your training courses and modules to master bursary collection, fee recovery, and institutional leadership.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    asChild
                    className="flex-1 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 min-h-[44px] active:scale-[0.97]"
                  >
                    <Link href={`/portal/${portalSlug}/learn`}>
                      Explore Courses <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </Button>

                  {!isCurrentStepDone && (
                    <Button
                      variant="outline"
                      onClick={() => handleMarkStepComplete(activeStep.id)}
                      disabled={isProcessingStep}
                      className="rounded-2xl font-bold text-xs min-h-[44px]"
                    >
                      Mark Started
                    </Button>
                  )}
                </div>
              </div>
            )}

            {activeStep.type === 'community_post' && (
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-2">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-primary" /> Community Lounge
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Introduce yourself to fellow members, ask questions, and share strategies with peers.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    asChild
                    className="flex-1 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 min-h-[44px] active:scale-[0.97]"
                  >
                    <Link href={`/portal/${portalSlug}/community`}>
                      Go to Community <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </Button>

                  {!isCurrentStepDone && (
                    <Button
                      variant="outline"
                      onClick={() => handleMarkStepComplete(activeStep.id)}
                      disabled={isProcessingStep}
                      className="rounded-2xl font-bold text-xs min-h-[44px]"
                    >
                      Mark Done
                    </Button>
                  )}
                </div>
              </div>
            )}

            {activeStep.type === 'action_task' && (
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-2">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-purple-500" /> Action Task Assignment
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Complete your assigned drill or file upload deliverable to unlock your point bounty.
                  </p>
                </div>

                <Button
                  asChild
                  className="w-full rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 min-h-[44px] active:scale-[0.97]"
                >
                  <Link href={`/portal/${portalSlug}/tasks`}>
                    Open Member Tasks Hub <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </Button>
              </div>
            )}

            {(activeStep.type === 'custom_url' || activeStep.type === 'book_meeting') && (
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  {activeStep.targetUrl && (
                    <Button
                      asChild
                      className="flex-1 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 min-h-[44px] active:scale-[0.97]"
                    >
                      <a
                        href={activeStep.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5"
                      >
                        {activeStep.actionLabel || 'Open Link'} <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  )}

                  {!isCurrentStepDone && (
                    <Button
                      variant="outline"
                      onClick={() => handleMarkStepComplete(activeStep.id)}
                      disabled={isProcessingStep}
                      className="rounded-2xl font-bold text-xs min-h-[44px]"
                    >
                      Mark Completed
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Step Navigation Controls (Prev / Next) */}
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                disabled={currentStepIndex === 0}
                onClick={() => setCurrentStepIndex(prev => prev - 1)}
                className="rounded-xl font-bold text-xs min-h-[44px] gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Previous
              </Button>

              <Button
                type="button"
                variant="ghost"
                disabled={currentStepIndex === steps.length - 1}
                onClick={() => setCurrentStepIndex(prev => prev + 1)}
                className="rounded-xl font-bold text-xs min-h-[44px] gap-1"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
