'use client';

/**
 * {{Org_name}} Experience Platform — Portal Onboarding Progressive Banner
 *
 * Sticky, responsive dashboard banner tracking member orientation progress,
 * highlighting next pending actions, and launching the interactive onboarding wizard.
 *
 * Conforms to:
 * - next-best-practices, vercel-react-best-practices
 * - emilkowal-animations (tactile feedback, active:scale-[0.97])
 * - Minimum 44px mobile touch targets
 * - Strict typing (0 any, 0 any[], 0 unhandled unknown)
 */

import * as React from 'react';
import { collection, query, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { reconcileOnboardingAction } from '@/app/actions/engagement-actions';
import type {
  OnboardingFlow,
  OnboardingStep,
  MemberOnboardingProgress,
} from '@/lib/types/engagement';
import type { PortalMembership } from '@/lib/types/membership';
import { DEFAULT_ONBOARDING_STEPS } from '@/lib/portal-presets';
import { PortalOnboardingModal } from './PortalOnboardingModal';
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  X,
  Award,
} from 'lucide-react';

interface PortalOnboardingBannerProps {
  portalId: string;
  portalSlug: string;
  userId: string;
  membership?: PortalMembership | null;
  className?: string;
}

export function PortalOnboardingBanner({
  portalId,
  portalSlug,
  userId,
  membership,
  className = '',
}: PortalOnboardingBannerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isDismissed, setIsDismissed] = React.useState(false);

  // Load collapsed / dismissed preference from storage
  React.useEffect(() => {
    if (typeof window !== 'undefined' && portalId) {
      const storedCollapsed = localStorage.getItem(`onboarding_collapsed_${portalId}`);
      if (storedCollapsed === 'true') {
        setIsCollapsed(true);
      }
    }
  }, [portalId]);

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
  const isEnabled = flow?.isEnabled ?? true;
  const completionPoints = flow?.completionPoints || 20;

  // 2. Query Realtime Member Onboarding Progress
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
  const isFullyCompleted = progress?.isCompleted || (steps.length > 0 && completedStepIds.length >= steps.length);

  // 3. Single-shot Auto-reconcile on mount
  const hasReconciledRef = React.useRef(false);
  React.useEffect(() => {
    if (!portalId || !userId || hasReconciledRef.current) return;
    hasReconciledRef.current = true;

    reconcileOnboardingAction(portalId, userId, portalSlug)
      .then(res => {
        if (res.success && res.data && res.data.updatedStepIds.length > 0) {
          toast({
            title: 'Progress Synced! ✨',
            description: `We noticed you've completed ${res.data.updatedStepIds.length} onboarding step(s).`,
          });
        }
      })
      .catch(() => {
        // Non-fatal
      });
  }, [portalId, userId, portalSlug, toast]);

  // If onboarding disabled or user dismissed full completion, don't show
  if (!isEnabled || isDismissed) {
    return null;
  }

  // If already 100% complete, hide unless user opens from widget
  if (isFullyCompleted) {
    return null;
  }

  // Find next incomplete step
  const nextStep = steps.find(s => !completedStepIds.includes(s.id)) || steps[0];

  const handleToggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`onboarding_collapsed_${portalId}`, String(nextState));
    }
  };

  // ── Collapsed Slim Pill ─────────────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <>
        <div className={`w-full max-w-7xl mx-auto px-4 sm:px-6 pt-3 ${className}`}>
          <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border/80 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="p-1.5 rounded-xl bg-primary/10 text-primary">
                <Sparkles className="w-4 h-4 text-amber-500" />
              </span>
              <span className="text-xs font-bold text-foreground">
                Onboarding: {completedStepIds.length}/{steps.length} Steps ({progressPct}%)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className="h-8 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 min-h-[44px] sm:min-h-0 active:scale-[0.97]"
              >
                Resume <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleCollapse}
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                title="Expand Banner"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <PortalOnboardingModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          portalId={portalId}
          portalSlug={portalSlug}
          userId={userId}
          steps={steps}
          progress={progress}
          membership={membership}
          completionPoints={completionPoints}
        />
      </>
    );
  }

  // ── Expanded Full Banner ────────────────────────────────────────────────────
  return (
    <>
      <div className={`w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 ${className}`}>
        <div className="relative overflow-hidden rounded-3xl border-2 border-primary/20 bg-linear-to-r from-primary/5 via-card to-amber-500/5 p-5 sm:p-6 shadow-sm space-y-4">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-sm sm:text-base text-foreground">
                    Get Started: Member Onboarding Checklist
                  </h3>
                  <Badge variant="secondary" className="font-bold text-[10px] bg-primary/10 text-primary border-0">
                    +{completionPoints} Points on 100%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Complete these orientation steps to unlock full benefits and academy certifications.
                </p>
              </div>
            </div>

            {/* Minimize / Dismiss controls */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleCollapse}
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                title="Minimize Banner"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDismissed(true)}
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                title="Dismiss Banner for this Session"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground">
                {completedStepIds.length} of {steps.length} Milestones Achieved
              </span>
              <span className="font-black text-primary">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2 rounded-full" />
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-border/60">
            {nextStep ? (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="font-bold text-foreground">Next Up:</span>
                <span className="font-medium text-foreground/90 truncate max-w-xs">
                  {nextStep.title}
                </span>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                All milestones in progress.
              </div>
            )}

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                onClick={() => setIsModalOpen(true)}
                className="h-9 px-4 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 min-h-[44px] sm:min-h-0 active:scale-[0.97] shadow-sm gap-1.5"
              >
                Launch Onboarding Wizard <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <PortalOnboardingModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        portalId={portalId}
        portalSlug={portalSlug}
        userId={userId}
        steps={steps}
        progress={progress}
        membership={membership}
        completionPoints={completionPoints}
      />
    </>
  );
}
