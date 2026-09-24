'use client';

/**
 * {{Org_name}} Experience Platform — Course Overview Landing Client
 *
 * Dedicated course syllabus and overview page featuring instructor bio,
 * module accordion previews with drip release status badges, learning objectives,
 * plan entitlement paywall gating, and dynamic 1-click "Resume Learning" CTA.
 *
 * Architectural Notes:
 * - Entitlement Gating: Enforces course.requiredPlanIds against user's active membership plan.
 * - Drip Release Engine: Evaluates ReleaseScheduleService.evaluateLessonRelease & evaluateModuleRelease
 *   to show real-time lock status (countdown days, prerequisite requirement, or specific date unlock).
 * - High-accessibility: All touch targets >= 44px, keyboard navigable, full dark/light theme support.
 */

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { enrollInCourseAction } from '@/app/actions/learning-actions';
import { ReleaseScheduleService } from '@/lib/services/release-schedule-service';
import { PortalPageShell } from '../../components/PortalPageShell';
import type { Portal } from '@/lib/types/portal';
import type { Course, CourseModule, CourseLesson, CourseEnrollment, LearningProgress } from '@/lib/types/learning';
import type { PortalMembership, MembershipPlan } from '@/lib/types/membership';
import {
  ArrowRight,
  PlayCircle,
  BookOpen,
  Layers,
  Clock,
  Award,
  Loader2,
  Lock,
  CheckCircle2,
  Sparkles,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { PortalAuthModal } from '../../components/PortalAuthModal';
import { getErrorMessage } from '@/lib/errors/report-error';

interface PortalCourseOverviewClientProps {
  slug: string;
  courseSlug: string;
  initialPortal?: Portal | null;
}

export default function PortalCourseOverviewClient({
  slug,
  courseSlug,
  initialPortal,
}: PortalCourseOverviewClientProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [isEnrolling, setIsEnrolling] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

  // 1. Query Portal
  const portalQuery = useMemoFirebase(
    () =>
      firestore && slug
        ? query(collection(firestore, 'portals'), where('slug', '==', slug), limit(1))
        : null,
    [firestore, slug]
  );
  const { data: portals, isLoading: isLoadingPortal } = useCollection<Portal>(portalQuery);
  const portal = portals?.[0] ?? initialPortal ?? null;

  // 2. Query Course
  const courseQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && courseSlug
        ? query(
            collection(firestore, 'courses'),
            where('portalId', '==', portal.id),
            where('slug', '==', courseSlug),
            limit(1)
          )
        : null,
    [firestore, portal?.id, courseSlug]
  );
  const { data: courses, isLoading: isLoadingCourse } = useCollection<Course>(courseQuery);
  const course = courses?.[0] ?? null;

  // 3. Query Modules
  const modulesQuery = useMemoFirebase(
    () =>
      firestore && course?.id
        ? query(
            collection(firestore, 'course_modules'),
            where('courseId', '==', course.id),
            orderBy('order', 'asc')
          )
        : null,
    [firestore, course?.id]
  );
  const { data: modules } = useCollection<CourseModule>(modulesQuery);

  // 4. Query Lessons
  const lessonsQuery = useMemoFirebase(
    () =>
      firestore && course?.id
        ? query(
            collection(firestore, 'course_lessons'),
            where('courseId', '==', course.id),
            orderBy('order', 'asc')
          )
        : null,
    [firestore, course?.id]
  );
  const { data: lessons } = useCollection<CourseLesson>(lessonsQuery);

  // 5. Query Active Membership (for entitlement & drip release dates)
  const membershipQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && user?.uid
        ? query(
            collection(firestore, 'portal_memberships'),
            where('portalId', '==', portal.id),
            where('userId', '==', user.uid),
            limit(1)
          )
        : null,
    [firestore, portal?.id, user?.uid]
  );
  const { data: memberships } = useCollection<PortalMembership>(membershipQuery);
  const membership = memberships?.[0] ?? null;

  // 6. Query Membership Plans (to display tier names for gated courses)
  const plansQuery = useMemoFirebase(
    () =>
      firestore && portal?.id
        ? query(collection(firestore, 'membership_plans'), where('portalId', '==', portal.id))
        : null,
    [firestore, portal?.id]
  );
  const { data: membershipPlans } = useCollection<MembershipPlan>(plansQuery);

  // 7. Query Enrollment
  const enrollmentQuery = useMemoFirebase(
    () =>
      firestore && course?.id && user?.uid
        ? query(
            collection(firestore, 'course_enrollments'),
            where('courseId', '==', course.id),
            where('userId', '==', user.uid),
            limit(1)
          )
        : null,
    [firestore, course?.id, user?.uid]
  );
  const { data: enrollments } = useCollection<CourseEnrollment>(enrollmentQuery);
  const enrollment = enrollments?.[0] ?? null;

  // 8. Query Granular Learning Progress (to track completed lesson IDs)
  const progressQuery = useMemoFirebase(
    () =>
      firestore && course?.id && user?.uid
        ? query(
            collection(firestore, 'learning_progress'),
            where('courseId', '==', course.id),
            where('userId', '==', user.uid)
          )
        : null,
    [firestore, course?.id, user?.uid]
  );
  const { data: progressList } = useCollection<LearningProgress>(progressQuery);

  const completedLessonIds = React.useMemo(() => {
    return (progressList || []).filter(p => p.isCompleted).map(p => p.lessonId);
  }, [progressList]);

  // ── Plan Entitlement Gating Check ──────────────────────────────────────
  const requiredPlanIds = React.useMemo(() => course?.requiredPlanIds || [], [course?.requiredPlanIds]);
  const hasPlanRequirement = requiredPlanIds.length > 0;
  const isEnrolled = Boolean(enrollment);

  const isPlanEntitled = React.useMemo(() => {
    // If already enrolled, user was granted access
    if (isEnrolled) return true;
    if (!hasPlanRequirement) return true;
    if (!membership || membership.status !== 'active') return false;
    return Boolean(membership.planId && requiredPlanIds.includes(membership.planId));
  }, [isEnrolled, hasPlanRequirement, membership, requiredPlanIds]);

  const requiredPlanNames = React.useMemo(() => {
    if (!hasPlanRequirement || !membershipPlans) return [];
    return membershipPlans
      .filter(p => requiredPlanIds.includes(p.id))
      .map(p => p.name);
  }, [hasPlanRequirement, membershipPlans, requiredPlanIds]);

  // Determine current active lesson for dynamic resume CTA
  const sortedLessons = React.useMemo(() => {
    return [...(lessons || [])].sort((a, b) => a.order - b.order);
  }, [lessons]);

  const firstLesson = sortedLessons[0] ?? null;

  const currentLesson = React.useMemo(() => {
    if (!enrollment?.currentLessonId) return firstLesson;
    return sortedLessons.find(l => l.id === enrollment.currentLessonId) || firstLesson;
  }, [enrollment?.currentLessonId, sortedLessons, firstLesson]);

  const currentLessonIndex = React.useMemo(() => {
    if (!currentLesson) return 0;
    return sortedLessons.findIndex(l => l.id === currentLesson.id);
  }, [sortedLessons, currentLesson]);

  const completedCount = completedLessonIds.length;
  const totalCount = sortedLessons.length || 0;

  const handleEnroll = async () => {
    if (!portal || !course) return;

    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!isPlanEntitled) {
      toast({
        title: 'Membership Tier Required',
        description: `This course requires an active ${requiredPlanNames.join(' or ')} membership plan.`,
        actionConfig: {
          path: `/portal/${slug}/pricing`,
          label: 'View Plans',
        },
      });
      return;
    }

    setIsEnrolling(true);
    try {
      const res = await enrollInCourseAction(course.id, user.uid, portal.id, slug);
      if (!res.success) throw new Error(res.error);

      toast({ title: 'Enrolled Successfully! 🎉', description: 'Your learning progress is now active.' });
      if (firstLesson) {
        router.push(`/portal/${slug}/learn/${courseSlug}/${firstLesson.slug}`);
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      toast({ title: 'Enrollment Error', description: getErrorMessage(err) });
    } finally {
      setIsEnrolling(false);
    }
  };

  if ((isLoadingPortal && !initialPortal) || isLoadingCourse) {
    return (
      <div className="min-h-screen bg-[var(--portal-bg,#ffffff)] text-[var(--portal-text,#0f172a)] p-6 md:p-12 space-y-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-8 w-40 rounded-xl" />
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!portal || !course) {
    return (
      <div className="min-h-screen bg-[var(--portal-bg,#ffffff)] flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Course Not Found</h2>
          <Button asChild className="rounded-xl font-bold text-xs min-h-[44px] active:scale-[0.97]">
            <Link href={`/portal/${slug}/learn`}>
              Return to Catalog
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const theme = portal.theme;

  return (
    <PortalPageShell portal={portal} slug={slug}>
      <div className="max-w-5xl mx-auto w-full p-6 md:p-10 space-y-10">
        {/* Course Hero Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center bg-card p-6 sm:p-10 rounded-3xl border-2 border-border shadow-xs">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-bold uppercase tracking-wider">
                {course.category || 'Academy Masterclass'}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] font-bold uppercase capitalize border border-[var(--portal-border)] bg-[var(--portal-surface)] text-[var(--portal-text)] shadow-none"
              >
                {course.level.replace('_', ' ')}
              </Badge>

              {hasPlanRequirement && (
                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  {requiredPlanNames.length > 0 ? requiredPlanNames.join(' / ') : 'Tier Gated'}
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground leading-tight">
              {course.title}
            </h1>

            {course.summary && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{course.summary}</p>
            )}

            {/* Instructor Meta */}
            <div className="flex items-center gap-3 pt-2">
              <Avatar className="w-10 h-10 border border-border">
                {course.instructorAvatarUrl && <AvatarImage src={course.instructorAvatarUrl} />}
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {(course.instructorName || 'A').charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-0.5">
                <p className="font-bold text-xs text-foreground">{course.instructorName || 'Academy Instructor'}</p>
                <p className="text-[11px] text-muted-foreground">{course.instructorTitle || 'Curriculum Director'}</p>
              </div>
            </div>

            {/* Plan Entitlement Gate Notice (if not enrolled and not entitled) */}
            {hasPlanRequirement && !isPlanEntitled && (
              <div className="p-4 rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 backdrop-blur-xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Exclusive to {requiredPlanNames.join(' or ')} Members</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Upgrade your membership plan to unlock this complete course along with all downloadable materials and verified completion certificates.
                </p>
                <div className="pt-1">
                  <Button
                    asChild
                    size="sm"
                    className="h-9 px-4 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white min-h-[36px] active:scale-[0.97]"
                  >
                    <Link href={`/portal/${slug}/pricing`}>
                      Explore Membership Plans <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {/* CTA & Progress Strip */}
            <div className="pt-3 space-y-3">
              {isEnrolled && currentLesson && enrollment ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      Current Progress: {enrollment.progressPercentage || 0}%
                    </span>
                    <span>
                      {completedCount} of {totalCount} lessons completed
                    </span>
                  </div>
                  <Progress value={enrollment.progressPercentage || 0} className="h-2 rounded-full" />
                  <div className="pt-1">
                    <Button
                      asChild
                      size="lg"
                      className="w-full sm:w-auto h-12 px-8 rounded-xl font-bold text-xs text-white shadow-md gap-2 active:scale-[0.97] hover:brightness-105 hover:shadow-lg transition-all min-h-[44px]"
                      style={{ backgroundColor: theme.colors.primary }}
                    >
                      <Link href={`/portal/${slug}/learn/${courseSlug}/${currentLesson.slug}`}>
                        Resume Learning: Lesson {currentLessonIndex + 1} — {currentLesson.title}
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : !isPlanEntitled ? (
                <Button
                  asChild
                  size="lg"
                  className="w-full sm:w-auto h-12 px-8 rounded-xl font-bold text-xs text-white shadow-md gap-2 active:scale-[0.97] hover:brightness-105 transition-all min-h-[44px] bg-amber-600 hover:bg-amber-700"
                >
                  <Link href={`/portal/${slug}/pricing`}>
                    <Lock className="w-4 h-4 mr-1.5" /> Unlock with {requiredPlanNames.join(' / ')}
                  </Link>
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={handleEnroll}
                  disabled={isEnrolling}
                  className="w-full sm:w-auto h-12 px-8 rounded-xl font-bold text-xs text-white shadow-md gap-2 active:scale-[0.97] hover:brightness-105 hover:shadow-lg transition-all min-h-[44px]"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  {isEnrolling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Start This Course <ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground justify-center sm:justify-start pt-1">
                <span className="flex items-center gap-1 font-semibold">
                  <Layers className="w-3.5 h-3.5 text-primary" /> {lessons?.length || 0} Lessons
                </span>
                <span className="flex items-center gap-1 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-primary" /> {course.estimatedDurationMinutes || 60}m Total
                </span>
              </div>
            </div>
          </div>

          {/* Thumbnail / Certificate Card */}
          <div className="space-y-4">
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted/60 border border-border shadow-2xs">
              {course.thumbnailUrl ? (
                <Image
                  src={course.thumbnailUrl}
                  alt={course.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1.5 p-4 text-center">
                  <BookOpen className="w-10 h-10 text-primary/60" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{course.title}</span>
                </div>
              )}
            </div>

            {course.certificateEnabled && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center gap-2.5">
                <Award className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="text-[11px] text-amber-900 dark:text-amber-200 font-semibold">
                  Includes Verified Completion Certificate
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Syllabus Accordion with Drip Release Badges */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-lg text-foreground">Course Syllabus & Curriculum</h3>
              <p className="text-xs text-muted-foreground">
                {modules?.length || 0} Modules • {lessons?.length || 0} Lessons
              </p>
            </div>
          </div>

          <Accordion type="multiple" defaultValue={(modules || []).map(m => m.id)} className="space-y-3">
            {(modules || []).map((mod, modIdx) => {
              const moduleLessons = sortedLessons.filter(l => l.moduleId === mod.id);
              const moduleRelease = ReleaseScheduleService.evaluateModuleRelease({
                module: mod,
                enrollment,
                memberJoinedAt: membership?.joinedAt || membership?.createdAt,
                completedLessonIds,
              });

              return (
                <AccordionItem
                  key={mod.id}
                  value={mod.id}
                  className="rounded-2xl border-2 border-border bg-card overflow-hidden shadow-2xs"
                >
                  <AccordionTrigger className="px-5 py-4 hover:no-underline font-bold text-sm min-h-[44px]">
                    <div className="flex items-center gap-3 text-left">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase px-2 py-0.5">
                        Module {modIdx + 1}
                      </Badge>
                      <span className="text-foreground">
                        {mod.title.replace(/^((module|section)\s*\d+[\s:.-]*)+/i, '').trim() || mod.title}
                      </span>
                      {moduleRelease.isLocked && (
                        <Badge variant="outline" className="text-[9px] font-bold bg-muted/60 text-muted-foreground border-border gap-1 ml-1">
                          <Lock className="w-2.5 h-2.5" />
                          {moduleRelease.daysRemaining !== undefined
                            ? `Drips in ${moduleRelease.daysRemaining}d`
                            : 'Module Locked'}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-4 space-y-2 border-t border-border pt-3">
                    {moduleLessons.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No lessons in this module yet.</p>
                    ) : (
                      moduleLessons.map((lesson, lesIdx) => {
                        const isCompleted = completedLessonIds.includes(lesson.id);
                        const lessonRelease = ReleaseScheduleService.evaluateLessonRelease({
                          lesson,
                          module: mod,
                          enrollment,
                          memberJoinedAt: membership?.joinedAt || membership?.createdAt,
                          completedLessonIds,
                        });

                        // Clickable if enrolled and unlocked, or if it's a free preview
                        const isClickable = (isEnrolled && !lessonRelease.isLocked) || lesson.isPreview;

                        const contentIcon =
                          lesson.contentType === 'quiz' ? (
                            <HelpCircle className="w-4 h-4 text-purple-500 shrink-0" />
                          ) : lesson.contentType === 'article' || (lesson.blocks && lesson.blocks.length > 0) ? (
                            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                          ) : (
                            <PlayCircle className="w-4 h-4 text-primary shrink-0" />
                          );

                        const rowContent = (
                          <div
                            className={`flex items-center justify-between p-3 rounded-xl transition-colors text-xs min-h-[44px] ${
                              isClickable
                                ? 'hover:bg-muted/60 cursor-pointer active:scale-[0.99]'
                                : 'opacity-70 bg-muted/20 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              ) : !lessonRelease.isLocked || lesson.isPreview ? (
                                contentIcon
                              ) : (
                                <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                              )}
                              <span className={`font-medium ${isCompleted ? 'text-muted-foreground line-through decoration-muted-foreground/50' : 'text-foreground'}`}>
                                {lesIdx + 1}. {lesson.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {lesson.isPreview && (
                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-bold">
                                  Free Preview
                                </Badge>
                              )}

                              {lessonRelease.isLocked && !lesson.isPreview && (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[9px] font-semibold">
                                  {lessonRelease.daysRemaining !== undefined
                                    ? `Unlocks in ${lessonRelease.daysRemaining}d`
                                    : lesson.releaseRule?.type === 'sequential_prerequisite'
                                    ? 'Requires Prerequisite'
                                    : moduleRelease.isLocked
                                    ? 'Module Locked'
                                    : 'Scheduled'}
                                </Badge>
                              )}

                              <span className="text-[11px] text-muted-foreground font-mono">
                                {lesson.videoDurationSeconds
                                  ? `${Math.round(lesson.videoDurationSeconds / 60)}m`
                                  : '10m'}
                              </span>

                              {isClickable && (
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-1" />
                              )}
                            </div>
                          </div>
                        );

                        if (isClickable) {
                          return (
                            <Link
                              key={lesson.id}
                              href={`/portal/${slug}/learn/${courseSlug}/${lesson.slug}`}
                              className="block focus:outline-hidden focus:ring-2 focus:ring-primary/20 rounded-xl"
                            >
                              {rowContent}
                            </Link>
                          );
                        }

                        return (
                          <div key={lesson.id}>
                            {rowContent}
                          </div>
                        );
                      })
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>

        {/* ── Auth Modal for unauthenticated enrollment ─────────────────── */}
        <PortalAuthModal
          portal={portal}
          open={isAuthModalOpen}
          onOpenChange={setIsAuthModalOpen}
          onAuthenticated={() => handleEnroll()}
        />
      </div>
    </PortalPageShell>
  );
}
