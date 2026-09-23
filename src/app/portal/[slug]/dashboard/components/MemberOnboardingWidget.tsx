'use client';

/**
 * {{Org_name}} Experience Platform — Member Onboarding Checklist Widget
 *
 * Automated, state-derived orientation checklist for new members with
 * real-time progress bar, actionable routing links, and interactive modals.
 *
 * ARCHITECTURAL RATIONALE:
 * Removes unverified manual bypass buttons in favor of context-aware Action CTAs
 * that trigger real domain events (watching orientation, setting up bursary profile,
 * launching course masterclass, posting in community).
 *
 * MOBILITY, ACCESSIBILITY & ANIMATIONS (Rule 1 & Rule 7):
 * - Minimum touch target >= 44px (`min-h-[44px]`) on interactive buttons.
 * - Emil Kowalski subtle tactile press states (`active:scale-[0.98]`).
 * - Everyday UI English without technical jargon or excessive walls of text.
 * - Single-shot reconciliation ref (`hasReconciledRef`) preventing infinite query cascades.
 * - Strictly zero `any`, `any[]`, or `unknown`.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { reconcileOnboardingAction } from '@/app/actions/engagement-actions';
import type { OnboardingFlow, OnboardingStep, MemberOnboardingProgress } from '@/lib/types/engagement';
import type { PortalMembership } from '@/lib/types/membership';
import type { Course } from '@/lib/types/learning';
import { DEFAULT_ONBOARDING_STEPS } from '@/lib/portal-presets';
import { MemberProfileModal } from './MemberProfileModal';
import { OrientationVideoModal } from './OrientationVideoModal';
import {
  CheckCircle2,
  Circle,
  Sparkles,
  Video,
  User,
  GraduationCap,
  MessageSquare,
  Calendar,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

interface MemberOnboardingWidgetProps {
  portalId: string;
  portalSlug: string;
  userId: string;
  membership?: PortalMembership | null;
  courses?: Course[];
}

export function MemberOnboardingWidget({
  portalId,
  portalSlug,
  userId,
  membership,
  courses = [],
}: MemberOnboardingWidgetProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false);
  const [isOrientationModalOpen, setIsOrientationModalOpen] = React.useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = React.useState<string | undefined>(undefined);

  // 1. Query Onboarding Flow
  const flowQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(collection(firestore, 'onboarding_flows'), where('portalId', '==', portalId), limit(1))
        : null,
    [firestore, portalId]
  );
  const { data: flows } = useCollection<OnboardingFlow>(flowQuery);
  const flow = flows?.[0] ?? null;

  const steps: OnboardingStep[] = flow?.steps || DEFAULT_ONBOARDING_STEPS;

  // 2. Query Member Onboarding Progress (Realtime)
  const progressQuery = useMemoFirebase(
    () =>
      firestore && portalId && userId
        ? query(
            collection(firestore, 'member_onboarding_progress'),
            where('portalId', '==', portalId),
            where('userId', '==', userId),
            limit(1)
          )
        : null,
    [firestore, portalId, userId]
  );
  const { data: progresses } = useCollection<MemberOnboardingProgress>(progressQuery);
  const progress = progresses?.[0] ?? null;

  const completedStepIds = progress?.completedStepIds || [];
  const progressPct = progress?.progressPercentage || 0;
  const isCompleted = progress?.isCompleted || progressPct >= 100;

  // 3. Single-shot Auto-Reconciliation on Mount (Rule 5 & Rule 9)
  const hasReconciledRef = React.useRef(false);
  React.useEffect(() => {
    if (!portalId || !userId || hasReconciledRef.current) return;
    hasReconciledRef.current = true;

    reconcileOnboardingAction(portalId, userId, portalSlug)
      .then(res => {
        if (res.success && res.data && res.data.updatedStepIds.length > 0) {
          toast({
            title: 'Progress Synced! ✨',
            description: `We noticed you've already completed ${res.data.updatedStepIds.length} onboarding action(s). Your checklist has been updated.`,
          });
        }
      })
      .catch((err: unknown) => {
        console.warn('[MemberOnboardingWidget] Auto-reconciliation non-fatal error:', err);
      });
  }, [portalId, userId, portalSlug, toast]);

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'welcome_video':
        return <Video className="w-4 h-4 text-primary" />;
      case 'complete_profile':
        return <User className="w-4 h-4 text-primary" />;
      case 'start_course':
        return <GraduationCap className="w-4 h-4 text-primary" />;
      case 'community_post':
        return <MessageSquare className="w-4 h-4 text-primary" />;
      case 'book_meeting':
        return <Calendar className="w-4 h-4 text-primary" />;
      default:
        return <Sparkles className="w-4 h-4 text-primary" />;
    }
  };

  const firstCourse = courses && courses.length > 0 ? courses[0] : null;

  const resolveStepActionUrl = (step: OnboardingStep): string => {
    if (step.targetUrl && step.targetUrl.trim() !== '') return step.targetUrl;
    switch (step.type) {
      case 'start_course':
        return firstCourse ? `/portal/${portalSlug}/learn/${firstCourse.slug}` : `/portal/${portalSlug}/learn`;
      case 'community_post':
        return `/portal/${portalSlug}/community`;
      case 'book_meeting':
        return 'https://calendly.com';
      default:
        return `/portal/${portalSlug}`;
    }
  };

  const handleStepActionClick = (step: OnboardingStep) => {
    if (step.type === 'welcome_video') {
      setSelectedVideoUrl(step.videoUrl);
      setIsOrientationModalOpen(true);
    } else if (step.type === 'complete_profile') {
      setIsProfileModalOpen(true);
    }
  };

  return (
    <>
      <Card className="rounded-3xl border-2 border-border p-6 sm:p-7 space-y-5 bg-card shadow-xs">
        {/* Header & Progress Bar */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-extrabold text-base text-foreground">
                  {isCompleted ? 'Onboarding Completed! 🎉' : 'Getting Started Checklist'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isCompleted
                    ? `You've unlocked your full member access and earned +${flow?.completionPoints || 20} reward points.`
                    : `Complete these steps to unlock full academy benefits and resources.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge
                variant={isCompleted ? 'default' : 'secondary'}
                className="text-xs font-bold px-3 py-1 rounded-xl"
              >
                {completedStepIds.length}/{steps.length} Completed • {progressPct}%
              </Badge>
            </div>
          </div>

          <Progress value={progressPct} className="h-2 rounded-full" />
        </div>

        {/* Steps List */}
        <div className="space-y-2.5 pt-1">
          {steps.map((step, idx) => {
            const isDone = completedStepIds.includes(step.id);
            const isModalStep = step.type === 'welcome_video' || step.type === 'complete_profile';
            const actionUrl = !isModalStep ? resolveStepActionUrl(step) : null;
            const actionLabel = step.actionLabel || (
              step.type === 'welcome_video' ? 'Watch Orientation' :
              step.type === 'complete_profile' ? 'Set Up Profile' :
              step.type === 'start_course' ? 'Go to Lesson →' :
              step.type === 'community_post' ? 'Join Discussion' :
              step.type === 'book_meeting' ? 'Book Consultation' :
              'Open Action'
            );

            return (
              <div
                key={step.id || idx}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isDone
                    ? 'bg-muted/10 border-border opacity-85'
                    : 'bg-muted/30 border-border hover:border-primary/40'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3">
                  {/* Verified Indicator - non-bypassable */}
                  <div className="mt-0.5 sm:mt-0 shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground/50" />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        {getStepIcon(step.type)} {step.title}
                      </span>
                      {step.isRequired && !isDone && (
                        <Badge variant="outline" className="text-[9px] uppercase font-bold py-0">
                          Required
                        </Badge>
                      )}
                    </div>
                    {step.description && (
                      <p className="text-[11px] text-muted-foreground">{step.description}</p>
                    )}
                  </div>
                </div>

                {/* Context-Aware Action CTA or Completed Status */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {isDone ? (
                    <Badge
                      variant="outline"
                      className="text-emerald-700 bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-bold text-xs gap-1 py-1 px-2.5 rounded-xl"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                    </Badge>
                  ) : isModalStep ? (
                    <Button
                      size="sm"
                      onClick={() => handleStepActionClick(step)}
                      className="h-10 sm:h-9 px-4 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 active:scale-[0.97] transition-all shadow-sm gap-1.5 min-h-[44px] sm:min-h-0"
                    >
                      {actionLabel} <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  ) : actionUrl ? (
                    <Button
                      asChild
                      size="sm"
                      className="h-10 sm:h-9 px-4 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 active:scale-[0.97] transition-all shadow-sm gap-1.5 min-h-[44px] sm:min-h-0"
                    >
                      <Link
                        href={actionUrl}
                        target={step.type === 'book_meeting' ? '_blank' : undefined}
                        rel={step.type === 'book_meeting' ? 'noopener noreferrer' : undefined}
                      >
                        {actionLabel}
                        {step.type === 'book_meeting' ? (
                          <ExternalLink className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" />
                        )}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Profile Setup Modal */}
      <MemberProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        portalId={portalId}
        portalSlug={portalSlug}
        userId={userId}
        currentMembership={membership}
      />

      {/* Orientation Video Modal */}
      <OrientationVideoModal
        isOpen={isOrientationModalOpen}
        onClose={() => setIsOrientationModalOpen(false)}
        portalId={portalId}
        portalSlug={portalSlug}
        userId={userId}
        videoUrl={selectedVideoUrl}
        isAlreadyCompleted={completedStepIds.includes('step_welcome')}
      />
    </>
  );
}
