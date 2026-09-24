'use client';

/**
 * {{Org_name}} Experience Platform — Lesson Drip Lock Card
 *
 * Dedicated polite access gate presented when a lesson or parent module
 * is locked due to cohort drip release schedules or sequential prerequisites.
 *
 * Conforms to:
 * - Emil Kowalski subtle animations and micro-interactions
 * - Accessibility: touch targets >= 44px, semantic headings
 * - Zero any / any[] typing
 */

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CourseLesson, CourseModule } from '@/lib/types/learning';
import type { ReleaseEvaluationResult } from '@/lib/services/release-schedule-service';
import {
  Lock,
  Calendar,
  Clock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface LessonDripLockCardProps {
  portalSlug: string;
  courseSlug: string;
  courseTitle: string;
  lessonTitle: string;
  releaseResult: ReleaseEvaluationResult;
  prerequisiteLesson?: CourseLesson | null;
  parentModule?: CourseModule | null;
}

export function LessonDripLockCard({
  portalSlug,
  courseSlug,
  courseTitle,
  lessonTitle,
  releaseResult,
  prerequisiteLesson,
  parentModule,
}: LessonDripLockCardProps) {
  const isPrerequisiteLock = Boolean(
    prerequisiteLesson || releaseResult.prerequisiteLessonId
  );

  const formattedDate = releaseResult.unlockDate
    ? new Date(releaseResult.unlockDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="w-full max-w-xl mx-auto my-8 p-6 sm:p-10 rounded-3xl border-2 border-border/80 bg-card/95 backdrop-blur-md shadow-lg text-center space-y-6 transition-all animate-in fade-in zoom-in-95 duration-300">
      {/* Icon Badge */}
      <div className="relative inline-flex items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs">
          <Lock className="w-8 h-8" />
        </div>
        {releaseResult.daysRemaining !== undefined && (
          <span className="absolute -bottom-2 px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-black text-[10px] uppercase tracking-wider shadow-xs">
            {releaseResult.daysRemaining}d Left
          </span>
        )}
      </div>

      {/* Header Info */}
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] font-bold uppercase tracking-wider bg-muted/60 text-muted-foreground border-border"
          >
            {parentModule?.title || courseTitle}
          </Badge>
          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold">
            Locked Lesson
          </Badge>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
          {lessonTitle}
        </h2>

        {/* Dynamic Descriptive Text */}
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          {isPrerequisiteLock ? (
            <>
              This lesson requires sequential completion. To unlock this topic, you must first complete{' '}
              <strong className="text-foreground">
                {prerequisiteLesson?.title || 'the prerequisite lesson'}
              </strong>
              .
            </>
          ) : releaseResult.daysRemaining !== undefined ? (
            <>
              This lesson is part of a paced cohort schedule. It will automatically unlock in{' '}
              <strong className="text-foreground">{releaseResult.daysRemaining} days</strong>. Check back soon!
            </>
          ) : formattedDate ? (
            <>
              This lesson is scheduled to unlock on{' '}
              <strong className="text-foreground">{formattedDate}</strong>.
            </>
          ) : (
            <>
              {releaseResult.lockReason ||
                'This lesson is currently locked according to your course syllabus schedule.'}
            </>
          )}
        </p>
      </div>

      {/* Action CTAs */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        {isPrerequisiteLock && prerequisiteLesson && (
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-2 shadow-sm min-h-[44px] active:scale-[0.97] transition-all"
          >
            <Link
              href={`/portal/${portalSlug}/learn/${courseSlug}/${prerequisiteLesson.slug}`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Complete Prerequisite:{' '}
              {prerequisiteLesson.title.slice(0, 24)}...
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        )}

        <Button
          asChild
          variant="outline"
          size="lg"
          className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold text-xs border-2 border-border hover:bg-muted text-foreground gap-2 min-h-[44px] active:scale-[0.97] transition-all"
        >
          <Link href={`/portal/${portalSlug}/learn/${courseSlug}`}>
            <ArrowLeft className="w-4 h-4" /> Return to Syllabus
          </Link>
        </Button>
      </div>

      {/* Helpful Hint */}
      <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span>Need guidance? You can ask the AI Tutor questions about previous lessons at any time.</span>
      </div>
    </div>
  );
}
