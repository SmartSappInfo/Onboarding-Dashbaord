'use client';

/**
 * {{Org_name}} Experience Platform — Member Onboarding Checklist Widget
 *
 * Interactive step-by-step orientation checklist for new members with
 * real-time progress bar, actionable routing links, and celebratory reward banner.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { advanceOnboardingStepAction } from '@/app/actions/engagement-actions';
import type { OnboardingFlow, OnboardingStep, MemberOnboardingProgress } from '@/lib/types/engagement';
import { DEFAULT_ONBOARDING_STEPS } from '@/lib/portal-presets';
import {
  CheckCircle2,
  Circle,
  Sparkles,
  ArrowRight,
  Video,
  User,
  GraduationCap,
  MessageSquare,
  Calendar,
  ExternalLink,
  Award,
  Loader2,
} from 'lucide-react';

interface MemberOnboardingWidgetProps {
  portalId: string;
  portalSlug: string;
  userId: string;
}

export function MemberOnboardingWidget({
  portalId,
  portalSlug,
  userId,
}: MemberOnboardingWidgetProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [advancingStepId, setAdvancingStepId] = React.useState<string | null>(null);

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

  // 2. Query Member Onboarding Progress
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

  const handleAdvanceStep = async (stepId: string) => {
    setAdvancingStepId(stepId);
    try {
      const res = await advanceOnboardingStepAction({
        portalId,
        userId,
        stepId,
      }, portalSlug);

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Step Completed! 🎯', description: 'Onboarding progress updated.' });
    } catch (err: any) {
      toast({ title: 'Action Failed', description: err?.message });
    } finally {
      setAdvancingStepId(null);
    }
  };

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

  const getStepActionUrl = (step: OnboardingStep) => {
    if (step.targetUrl) return step.targetUrl;
    switch (step.type) {
      case 'start_course':
        return `/portal/${portalSlug}/learn`;
      case 'community_post':
        return `/portal/${portalSlug}/community`;
      case 'book_meeting':
        return `/book`;
      default:
        return undefined;
    }
  };

  return (
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
                  ? `You've unlocked +${flow?.completionPoints || 20} bonus community points.`
                  : `Complete these essential steps to get the most out of your academy membership.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge
              variant={isCompleted ? 'default' : 'secondary'}
              className="text-xs font-bold px-3 py-1 rounded-xl"
            >
              {completedStepIds.length}/{steps.length} Steps • {progressPct}%
            </Badge>
          </div>
        </div>

        <Progress value={progressPct} className="h-2 rounded-full" />
      </div>

      {/* Steps List */}
      <div className="space-y-2.5 pt-1">
        {steps.map((step, idx) => {
          const isDone = completedStepIds.includes(step.id);
          const actionUrl = getStepActionUrl(step);
          const isAdvancing = advancingStepId === step.id;

          return (
            <div
              key={step.id || idx}
              className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isDone
                  ? 'bg-muted/10 border-border opacity-80'
                  : 'bg-muted/30 border-border hover:border-primary/40'
              }`}
            >
              <div className="flex items-start sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => !isDone && handleAdvanceStep(step.id)}
                  disabled={isDone || isAdvancing}
                  className="mt-0.5 sm:mt-0 shrink-0"
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                  )}
                </button>

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

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {actionUrl && (
                  <Link href={actionUrl}>
                    <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs font-bold gap-1 text-primary">
                      Open <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                )}

                {!isDone ? (
                  <Button
                    size="sm"
                    disabled={isAdvancing}
                    onClick={() => handleAdvanceStep(step.id)}
                    className="h-8 px-3 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 shadow-2xs"
                  >
                    {isAdvancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Mark Done'}
                  </Button>
                ) : (
                  <span className="text-[11px] font-bold text-emerald-600 px-2">Completed ✓</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
