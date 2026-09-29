'use client';

/**
 * {{Org_name}} Experience Platform — Focused Course Learning Player & AI Tutor
 *
 * Dedicated LMS learning player with 3-column collapsible workspace:
 * - Left: Collapsible course syllabus module tree (desktop rail + mobile sheet) with real-time drip release locks.
 * - Center: Dual-mode content canvas (Phase 2 Block Studio blocks vs structured markdown), video canvas,
 *   polite <LessonDripLockCard>, quiz runner with server-side answer protection, and toolkit downloads.
 * - Right: Non-modal, docked AI Learning Tutor panel (desktop aside + mobile bottom sheet).
 * - Mobile: Fixed bottom navigation bar with instant Syllabus, Lesson, AI Tutor, and Complete triggers.
 *
 * Architecture Notes:
 * - Conforms to next-best-practices, vercel-react-best-practices, emilkowal-animations.
 * - Drip Release Schedules: Evaluates ReleaseScheduleService.evaluateLessonRelease for immediate,
 *   specific date, days after enrollment, days after join, and sequential prerequisites.
 * - Dual-mode rendering: Dynamically chooses between BlockRenderer (PageBlock[]) and clean typography prose.
 * - Strict typing: Zero any / any[].
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import {
  completeLessonAction,
  submitAssessmentAction,
  getSanitizedAssessmentAction,
} from '@/app/actions/learning-actions';
import { ReleaseScheduleService } from '@/lib/services/release-schedule-service';
import { LessonDripLockCard } from './components/LessonDripLockCard';
import { BlockRenderer } from '@/components/page-builder/BlockRenderer';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import { DEFAULT_THEME } from '@/lib/page-builder/resolve-theme';
import '@/lib/page-builder/blocks';
import {
  AiTutorChatContent,
  LessonAiTutorDrawer,
} from './components/LessonAiTutorDrawer';
import { PortalThemeProvider } from '../../../components/PortalThemeProvider';
import { PortalThemeToggle } from '../../../components/PortalThemeToggle';
import { PortalSearchModal } from '../../../components/PortalSearchModal';
import { PortalAccessGate } from '@/components/portal/PortalAccessGate';
import type { Portal } from '@/lib/types/portal';
import type {
  Course,
  CourseModule,
  CourseLesson,
  CourseEnrollment,
  LearningProgress,
  CourseAssessment,
  AssessmentResult,
} from '@/lib/types/learning';
import type { PortalMembership, MembershipPlan } from '@/lib/types/membership';
import type { CourseCohort, CohortMember } from '@/lib/types/events';
import {
  PlayCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  BookOpen,
  HelpCircle,
  Layers,
  Menu,
  Download,
  Loader2,
  Check,
  PanelLeft,
  PanelLeftClose,
  Search,
  Lock,
  FileText,
  Radio,
  MessagesSquare,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors/report-error';

interface PortalCoursePlayerClientProps {
  slug: string;
  courseSlug: string;
  lessonSlug: string;
}

export default function PortalCoursePlayerClient({
  slug,
  courseSlug,
  lessonSlug,
}: PortalCoursePlayerClientProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  // Layout Collapsible States
  const [isSyllabusCollapsed, setIsSyllabusCollapsed] = React.useState(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = React.useState(true);
  const [isMobileSyllabusOpen, setIsMobileSyllabusOpen] = React.useState(false);
  const [isMobileAiTutorOpen, setIsMobileAiTutorOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('notes');
  const [isSearchModalOpen, setIsSearchModalOpen] = React.useState(false);

  // Quiz State
  const [quizAnswers, setQuizAnswers] = React.useState<Record<string, string[]>>({});
  const [quizResult, setQuizResult] = React.useState<AssessmentResult | null>(null);
  const [isEvaluatingQuiz, setIsEvaluatingQuiz] = React.useState(false);

  // 1. Query Portal
  const portalQuery = useMemoFirebase(
    () =>
      firestore && slug
        ? query(collection(firestore, 'portals'), where('slug', '==', slug), limit(1))
        : null,
    [firestore, slug]
  );
  const { data: portals } = useCollection<Portal>(portalQuery);
  const portal = portals?.[0] ?? null;
  // Feature gate for ambient AI tutor
  const isAiTutorEnabled = portal?.features?.enableAiTutor ?? true;

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

  // 4. Query All Lessons in Course
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
  const { data: lessons, isLoading: isLoadingLessons } = useCollection<CourseLesson>(lessonsQuery);

  // Current Lesson
  const currentLesson = React.useMemo(() => {
    return (lessons || []).find(l => l.slug === lessonSlug) || (lessons || [])[0] || null;
  }, [lessons, lessonSlug]);

  // 5. Fetch Sanitized Assessment for Current Lesson via Server Action
  // Security: Never query course_assessments directly on the client SDK to prevent answer key leakage
  const [currentAssessment, setCurrentAssessment] = React.useState<CourseAssessment | null>(null);

  React.useEffect(() => {
    let isCancelled = false;
    if (!currentLesson?.id) {
      setCurrentAssessment(null);
      return;
    }
    getSanitizedAssessmentAction(currentLesson.id)
      .then(res => {
        if (!isCancelled && res.success) {
          setCurrentAssessment(res.data || null);
        }
      })
      .catch(() => {
        if (!isCancelled) setCurrentAssessment(null);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentLesson?.id]);

  // 6. Query User Enrollment
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

  // 7. Query User Learning Progress for All Lessons
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

  // 8. Query User Active Membership (for joinedAt timestamp in drip calculations)
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

  // 9. Query Membership Plans to resolve plan display names for paywalls
  const plansQuery = useMemoFirebase(
    () =>
      firestore && portal?.id
        ? query(collection(firestore, 'membership_plans'), where('portalId', '==', portal.id))
        : null,
    [firestore, portal?.id]
  );
  const { data: membershipPlans } = useCollection<MembershipPlan>(plansQuery);

  // 10. Query Cohort Membership for this user in this course
  const cohortMemberQuery = useMemoFirebase(
    () =>
      firestore && course?.id && user?.uid
        ? query(
            collection(firestore, 'cohort_members'),
            where('courseId', '==', course.id),
            where('userId', '==', user.uid),
            where('status', '==', 'active'),
            limit(1)
          )
        : null,
    [firestore, course?.id, user?.uid]
  );
  const { data: cohortMembers } = useCollection<CohortMember>(cohortMemberQuery);
  const userCohortMember = cohortMembers?.[0] ?? null;

  // 11. Query Cohort Details if member is assigned
  const cohortQuery = useMemoFirebase(
    () =>
      firestore && userCohortMember?.cohortId
        ? query(
            collection(firestore, 'course_cohorts'),
            where('id', '==', userCohortMember.cohortId),
            limit(1)
          )
        : null,
    [firestore, userCohortMember?.cohortId]
  );
  const { data: userCohorts } = useCollection<CourseCohort>(cohortQuery);
  const userCohort = userCohorts?.[0] ?? null;

  // Course Tier Entitlement Calculation:
  const requiredPlanIds = React.useMemo(() => course?.requiredPlanIds || [], [course?.requiredPlanIds]);
  const hasPlanRequirement = requiredPlanIds.length > 0;

  const isPlanEntitled = React.useMemo(() => {
    if (!hasPlanRequirement) return true;
    if (!membership || membership.status !== 'active') return false;
    return Boolean(membership.planId && requiredPlanIds.includes(membership.planId));
  }, [hasPlanRequirement, membership, requiredPlanIds]);

  const requiredPlanName = React.useMemo(() => {
    if (!hasPlanRequirement || !membershipPlans) return undefined;
    return membershipPlans.filter(p => requiredPlanIds.includes(p.id)).map(p => p.name).join(' or ') || 'Exclusive Tier';
  }, [hasPlanRequirement, membershipPlans, requiredPlanIds]);

  // ── Drip Release Evaluation for Current Lesson ─────────────────────────
  const currentModule = React.useMemo(() => {
    if (!modules || !currentLesson) return null;
    return modules.find(m => m.id === currentLesson.moduleId) || null;
  }, [modules, currentLesson]);

  const currentLessonRelease = React.useMemo(() => {
    if (!currentLesson) return { isLocked: false };
    return ReleaseScheduleService.evaluateLessonRelease({
      lesson: currentLesson,
      module: currentModule,
      enrollment,
      memberJoinedAt: membership?.joinedAt || membership?.createdAt,
      completedLessonIds,
      cohortStartDate: userCohort?.startDate,
    });
  }, [currentLesson, currentModule, enrollment, membership, completedLessonIds, userCohort?.startDate]);

  const prerequisiteLesson = React.useMemo(() => {
    if (!currentLessonRelease.prerequisiteLessonId || !lessons) return null;
    return lessons.find(l => l.id === currentLessonRelease.prerequisiteLessonId) || null;
  }, [currentLessonRelease.prerequisiteLessonId, lessons]);

  const isCurrentLessonLocked = currentLessonRelease.isLocked && !currentLesson?.isPreview;

  // Current Lesson Index & Prev/Next Navigation
  const currentLessonIdx = React.useMemo(() => {
    if (!lessons || !currentLesson) return -1;
    return lessons.findIndex(l => l.id === currentLesson.id);
  }, [lessons, currentLesson]);

  const prevLesson = currentLessonIdx > 0 ? (lessons || [])[currentLessonIdx - 1] : null;
  const nextLesson =
    currentLessonIdx >= 0 && lessons && currentLessonIdx < lessons.length - 1
      ? lessons[currentLessonIdx + 1]
      : null;

  const isCurrentCompleted = currentLesson ? completedLessonIds.includes(currentLesson.id) : false;

  // Flat list of lessons ordered by module sequence (used for icon rail navigation)
  const orderedLessons = React.useMemo(() => {
    if (!modules || modules.length === 0) return lessons || [];
    const moduleLessonIds = new Set<string>();
    const ordered: CourseLesson[] = [];
    modules.forEach(mod => {
      (lessons || [])
        .filter(l => l.moduleId === mod.id)
        .forEach(l => {
          ordered.push(l);
          moduleLessonIds.add(l.id);
        });
    });
    (lessons || []).forEach(l => {
      if (!moduleLessonIds.has(l.id)) {
        ordered.push(l);
      }
    });
    return ordered;
  }, [modules, lessons]);

  // Block Render Context for Block Studio Canvas Lessons
  const renderCtx: BlockRenderContext = React.useMemo(
    () => ({
      mode: 'view',
      theme: {
        ...DEFAULT_THEME,
        colors: {
          ...DEFAULT_THEME.colors,
          primary: portal?.theme?.colors?.primary || DEFAULT_THEME.colors.primary,
        },
        typography: {
          headingFont: 'Figtree, sans-serif',
          bodyFont: 'Figtree, sans-serif',
          baseSize: '16px',
        },
      },
      interpolate: (text: string) => text,
      resources: {
        forms: [],
        surveys: [],
        agreements: [],
        meetings: [],
        qrCodes: [],
      },
    }),
    [portal?.theme?.colors?.primary]
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleMarkComplete = async () => {
    if (!course || !currentLesson || !portal || !user) {
      if (!user) {
        toast({
          title: 'Sign In Required',
          description: 'Please sign in to save your progress.',
          duration: 10000,
          actionConfig: {
            label: 'Sign In',
            path: `/portal/${slug}/join`,
          },
        });
      }
      return;
    }

    if (isCurrentLessonLocked) {
      toast({
        title: 'Lesson Locked',
        description: 'You cannot mark a locked lesson as complete.',
      });
      return;
    }

    try {
      // The learner is derived server-side from this verified ID token.
      await completeLessonAction(await user.getIdToken(), course.id, currentLesson.id, portal.id, slug);
      toast({ title: 'Lesson Completed! 🎉', description: 'Progress updated.' });

      if (nextLesson) {
        router.push(`/portal/${slug}/learn/${courseSlug}/${nextLesson.slug}`);
      }
    } catch (err: unknown) {
      toast({ title: 'Progress Save Failed', description: getErrorMessage(err) });
    }
  };

  const handleSelectOption = (questionId: string, optionId: string, isMulti: boolean) => {
    const current = quizAnswers[questionId] || [];
    if (isMulti) {
      const next = current.includes(optionId)
        ? current.filter(id => id !== optionId)
        : [...current, optionId];
      setQuizAnswers({ ...quizAnswers, [questionId]: next });
    } else {
      setQuizAnswers({ ...quizAnswers, [questionId]: [optionId] });
    }
  };

  const handleSubmitQuiz = async () => {
    if (!currentAssessment || !course || !currentLesson || !portal || !user) return;

    setIsEvaluatingQuiz(true);
    try {
      const answersPayload = Object.entries(quizAnswers).map(([qId, optIds]) => ({
        questionId: qId,
        selectedOptionIds: optIds,
      }));

      const res = await submitAssessmentAction(
        await user.getIdToken(),
        {
          assessmentId: currentAssessment.id,
          courseId: course.id,
          lessonId: currentLesson.id,
          portalId: portal.id,
          answers: answersPayload,
        },
        slug
      );

      if (res.success && res.data) {
        setQuizResult(res.data);
        if (res.data.passed) {
          toast({ title: 'Quiz Passed! 🎯', description: `Scored ${res.data.score}%. Lesson marked complete.` });
        } else {
          toast({ title: 'Quiz Not Passed', description: `Scored ${res.data.score}%. Retake to pass.` });
        }
      }
    } catch (err: unknown) {
      toast({ title: 'Evaluation Failed', description: getErrorMessage(err) });
    } finally {
      setIsEvaluatingQuiz(false);
    }
  };

  if (isLoadingCourse || isLoadingLessons) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between p-6">
        <Skeleton className="h-12 w-full rounded-2xl mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
          <Skeleton className="lg:col-span-1 h-full rounded-3xl" />
          <Skeleton className="lg:col-span-3 h-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!course || !currentLesson || !portal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Lesson Not Found</h2>
          <Button asChild className="rounded-xl font-bold text-xs min-h-[44px]">
            <Link href={`/portal/${slug}/learn/${courseSlug}`}>Return to Course Overview</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Security Barrier 1: Check Course Membership Tier Entitlement
  if (!isPlanEntitled && !currentLesson.isPreview) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <PortalAccessGate
          slug={slug}
          portalName={portal.name}
          reason="plan_upgrade_required"
          requiredPlanName={requiredPlanName}
          itemType="course masterclass"
          redirectUrl={`/portal/${slug}/pricing`}
        />
      </div>
    );
  }

  // Security Barrier 2: Check Course Enrollment
  if (!enrollment && !currentLesson.isPreview) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 rounded-3xl border-2 border-border bg-card shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Course Enrollment Required</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            You must enroll in this masterclass to access the curriculum lessons and track your learning progress.
          </p>
          <Button asChild className="w-full rounded-xl font-bold text-xs min-h-[44px] active:scale-[0.97]">
            <Link href={`/portal/${slug}/learn/${courseSlug}`}>
              Go to Course Overview & Enroll <ArrowRight className="w-4 h-4 ml-1.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const progressPct = enrollment?.progressPercentage || 0;

  // Shared Syllabus List Renderer (used in desktop sidebar and mobile sheet)
  const renderSyllabusContent = (options?: { onSelectLesson?: () => void; showCollapseButton?: boolean }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-primary" /> Course Syllabus
          </span>
          <span className="text-[11px] font-bold text-foreground">
            {completedLessonIds.length}/{lessons?.length || 0} Lessons
          </span>
        </div>
        {options?.showCollapseButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSyllabusCollapsed(true)}
            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.95] transition-all"
            title="Collapse to compact icon navigation"
            aria-label="Collapse Syllabus Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        )}
      </div>

      {userCohort && (
        <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 space-y-1">
          <div className="flex items-center justify-between gap-1">
            <Badge className="bg-primary text-white text-[9px] font-bold uppercase tracking-wider py-0 px-1.5">
              {userCohort.name}
            </Badge>
            {userCohort.linkedSpaceId && (
              <Link
                href={`/portal/${slug}/community/${userCohort.linkedSpaceId}`}
                className="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5"
              >
                <MessagesSquare className="w-3 h-3" /> Space 💬
              </Link>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Cohort pacing • Starts {new Date(userCohort.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {(modules || []).map((mod, modIdx) => {
          const moduleLessons = (lessons || []).filter(l => l.moduleId === mod.id);
          const completedModuleLessons = moduleLessons.filter(l => completedLessonIds.includes(l.id));
          const cleanModuleTitle = mod.title.replace(/^((module|section)\s*\d+[\s:.-]*)+/i, '').trim() || mod.title;

          const moduleRelease = ReleaseScheduleService.evaluateModuleRelease({
            module: mod,
            enrollment,
            memberJoinedAt: membership?.joinedAt || membership?.createdAt,
            completedLessonIds,
            cohortStartDate: userCohort?.startDate,
          });

          return (
            <div key={mod.id} className="space-y-2">
              {/* Module Header: Row 1 = Module Number, Row 2 = Clean Module Title with distinct contrast */}
              <div className="px-2 pt-2 pb-1 space-y-0.5 border-b border-border/40">
                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-widest text-primary">
                  <div className="flex items-center gap-1.5">
                    <span>Module {modIdx + 1}</span>
                    {moduleRelease.isLocked && (
                      <Badge variant="outline" className="text-[9px] font-bold bg-muted/60 text-muted-foreground border-border gap-1 py-0 px-1">
                        <Lock className="w-2.5 h-2.5" /> Locked
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground lowercase">
                    {completedModuleLessons.length}/{moduleLessons.length} done
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-foreground leading-snug tracking-tight">
                  {cleanModuleTitle}
                </h3>
              </div>

              <div className="space-y-1">
                {moduleLessons.map((les, lesIdx) => {
                  const isCurrent = les.id === currentLesson.id;
                  const isDone = completedLessonIds.includes(les.id);

                  const lesRelease = ReleaseScheduleService.evaluateLessonRelease({
                    lesson: les,
                    module: mod,
                    enrollment,
                    memberJoinedAt: membership?.joinedAt || membership?.createdAt,
                    completedLessonIds,
                    cohortStartDate: userCohort?.startDate,
                  });

                  const isLesLocked = lesRelease.isLocked && !les.isPreview;

                  const contentIcon =
                    les.contentType === 'live_session' ? (
                      <Radio className={cn('w-4 h-4 shrink-0', isCurrent ? 'text-white' : 'text-rose-500 animate-pulse')} />
                    ) : les.contentType === 'quiz' ? (
                      <HelpCircle className={cn('w-4 h-4 shrink-0', isCurrent ? 'text-white' : 'text-purple-500')} />
                    ) : les.contentType === 'article' || (les.blocks && les.blocks.length > 0) ? (
                      <FileText className={cn('w-4 h-4 shrink-0', isCurrent ? 'text-white' : 'text-blue-500')} />
                    ) : (
                      <PlayCircle className={cn('w-4 h-4 shrink-0', isCurrent ? 'text-white' : 'text-muted-foreground')} />
                    );

                  const rowContent = (
                    <div
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-xl text-xs transition-all active:scale-[0.98] min-h-[40px]',
                        isCurrent
                          ? 'bg-primary text-white font-bold shadow-xs'
                          : isDone
                          ? 'text-foreground hover:bg-muted/60'
                          : isLesLocked
                          ? 'text-muted-foreground/60 bg-muted/20 opacity-70'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        {isDone ? (
                          <CheckCircle2
                            className={cn('w-4 h-4 shrink-0', isCurrent ? 'text-white' : 'text-emerald-500')}
                          />
                        ) : isLesLocked ? (
                          <Lock className="w-4 h-4 shrink-0 text-muted-foreground" />
                        ) : (
                          contentIcon
                        )}
                        <span className="truncate" title={les.title}>
                          {lesIdx + 1}. {les.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {les.isPreview && (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[8px] font-bold px-1 py-0">
                            Preview
                          </Badge>
                        )}
                        {isLesLocked && (
                          <Badge variant="outline" className="text-[8px] font-bold border-border bg-muted/50 text-muted-foreground px-1 py-0">
                            {lesRelease.daysRemaining !== undefined ? `${lesRelease.daysRemaining}d` : 'Locked'}
                          </Badge>
                        )}
                        <span className={cn('text-[10px] font-medium font-mono', isCurrent ? 'text-white/90' : 'text-muted-foreground')}>
                          {les.videoDurationSeconds ? `${Math.round(les.videoDurationSeconds / 60)}m` : '10m'}
                        </span>
                      </div>
                    </div>
                  );

                  if (isLesLocked) {
                    return (
                      <div key={les.id} title={lesRelease.lockReason || 'Lesson is locked'}>
                        {rowContent}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={les.id}
                      href={`/portal/${slug}/learn/${courseSlug}/${les.slug}`}
                      onClick={() => options?.onSelectLesson?.()}
                    >
                      {rowContent}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <PortalThemeProvider
      portalId={portal.id}
      portalSlug={slug}
      theme={portal.theme}
      className="min-h-screen bg-background flex flex-col justify-between text-foreground"
    >
      {/* ── Top Bar ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Syllabus Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileSyllabusOpen(true)}
            className="lg:hidden p-2 rounded-xl border border-border hover:bg-muted text-foreground shrink-0 active:scale-[0.96] min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Toggle Syllabus Navigation"
          >
            <Menu className="w-4 h-4" />
          </button>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-xl text-xs font-bold gap-1.5 hidden sm:flex shrink-0 min-h-[44px] active:scale-[0.97]"
          >
            <Link href={`/portal/${slug}/learn/${courseSlug}`}>
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Overview
            </Link>
          </Button>

          {/* Mobile Back Button */}
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="sm:hidden h-9 w-9 min-h-[44px] min-w-[44px] rounded-xl shrink-0 text-muted-foreground hover:text-foreground active:scale-[0.97] flex items-center justify-center"
            aria-label="Back to Overview"
          >
            <Link href={`/portal/${slug}/learn/${courseSlug}`}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>

          <div className="hidden sm:block h-4 w-px bg-border/80 shrink-0" />

          <div className="min-w-0 truncate">
            <h2
              className="font-bold text-xs sm:text-sm text-foreground truncate"
              title={course.title}
            >
              {course.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-3 w-36 lg:w-44">
            <Progress value={progressPct} className="h-2 rounded-full flex-1" />
            <span className="text-[11px] font-bold text-muted-foreground shrink-0">{progressPct}%</span>
          </div>

          {/* Quick Search Button */}
          <button
            type="button"
            onClick={() => setIsSearchModalOpen(true)}
            className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-[0.97]"
            title="Search portal (⌘K)"
            aria-label="Search portal"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Theme Mode Toggle */}
          <PortalThemeToggle variant="icon" />

          {/* Desktop AI Tutor Toggle Button */}
          {isAiTutorEnabled && (
            <Button
              size="sm"
              onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
              className={cn(
                'hidden lg:flex rounded-xl font-bold text-xs gap-1.5 shadow-2xs transition-all active:scale-[0.98] min-h-[40px]',
                isAiPanelOpen
                  ? 'bg-primary text-white hover:bg-primary/90'
                  : 'bg-primary/10 text-primary hover:bg-primary/20 border-0'
              )}
              title={isAiPanelOpen ? 'Collapse AI Tutor Panel' : 'Expand AI Tutor Panel'}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAiPanelOpen ? 'Hide AI Tutor' : 'Open AI Tutor'}
            </Button>
          )}

          {/* Mobile AI Tutor Trigger */}
          {isAiTutorEnabled && (
            <Button
              size="sm"
              onClick={() => setIsMobileAiTutorOpen(true)}
              className="lg:hidden rounded-xl font-bold text-xs bg-primary/10 text-primary hover:bg-primary/20 border-0 gap-1.5 shadow-2xs min-h-[40px]"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI Tutor
            </Button>
          )}
        </div>
      </header>

      {/* ── 3-Column Learning Grid (Desktop) ───────────────────────────── */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* ── Left Column: Course Syllabus (Desktop) ────────────────── */}
        <aside
          className={cn(
            'hidden lg:flex flex-col border-r border-border bg-card/60 shrink-0 transition-all duration-300 ease-in-out h-[calc(100vh-57px)] sticky top-[57px] overflow-hidden',
            isSyllabusCollapsed ? 'w-16 items-center py-3 px-2' : 'w-80 p-4'
          )}
        >
          {isSyllabusCollapsed ? (
            /* Collapsed Icon Rail Navigation */
            <div className="flex flex-col items-center justify-between h-full w-full">
              {/* Rail Header with Expand Button */}
              <div className="flex flex-col items-center w-full">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSyllabusCollapsed(false)}
                  className="h-10 w-10 rounded-xl border border-border hover:bg-primary/10 hover:text-primary text-muted-foreground shrink-0 active:scale-[0.95] transition-all"
                  title="Expand Syllabus (Full View)"
                  aria-label="Expand Syllabus Sidebar"
                >
                  <PanelLeft className="w-4 h-4" />
                </Button>
                <div className="w-8 h-px bg-border my-2.5 shrink-0" />
              </div>

              {/* Scrollable Lesson Icon Rail */}
              <div className="flex-1 w-full overflow-y-auto overflow-x-hidden space-y-2 py-1 flex flex-col items-center">
                {orderedLessons.map((les, idx) => {
                  const isCurrent = les.id === currentLesson.id;
                  const isDone = completedLessonIds.includes(les.id);
                  const lessonNumber = idx + 1;
                  const durationText = les.videoDurationSeconds
                    ? `${Math.round(les.videoDurationSeconds / 60)}m`
                    : '10m';

                  const lesMod = modules?.find(m => m.id === les.moduleId);
                  const lesRelease = ReleaseScheduleService.evaluateLessonRelease({
                    lesson: les,
                    module: lesMod,
                    enrollment,
                    memberJoinedAt: membership?.joinedAt || membership?.createdAt,
                    completedLessonIds,
                    cohortStartDate: userCohort?.startDate,
                  });
                  const isLesLocked = lesRelease.isLocked && !les.isPreview;

                  const tile = (
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all active:scale-[0.95]',
                        isCurrent
                          ? 'bg-primary text-white shadow-xs ring-2 ring-primary/20 font-black'
                          : isDone
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                          : isLesLocked
                          ? 'bg-muted/30 text-muted-foreground/50 border border-border/30'
                          : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted border border-border/50'
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 className={cn('w-4 h-4', isCurrent ? 'text-white' : 'text-emerald-500')} />
                      ) : isLesLocked ? (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground/60" />
                      ) : isCurrent ? (
                        <PlayCircle className="w-4 h-4 text-white" />
                      ) : (
                        <span className="text-[11px] font-bold">{lessonNumber}</span>
                      )}
                    </div>
                  );

                  if (isLesLocked) {
                    return (
                      <div
                        key={les.id}
                        className="relative flex items-center justify-center w-full cursor-not-allowed opacity-60"
                        title={`Lesson ${lessonNumber}: ${les.title} (Locked: ${lesRelease.lockReason || 'Schedule gated'})`}
                      >
                        {tile}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={les.id}
                      href={`/portal/${slug}/learn/${courseSlug}/${les.slug}`}
                      className="group relative flex items-center justify-center w-full"
                      title={`Lesson ${lessonNumber}: ${les.title} (${durationText})${isDone ? ' • Completed' : ''}`}
                    >
                      {/* Active Indicator Bar on Left Edge */}
                      {isCurrent && (
                        <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                      )}
                      {tile}
                    </Link>
                  );
                })}
              </div>

              {/* Rail Footer with Back to Course Overview Button */}
              <div className="flex flex-col items-center w-full pt-1">
                <div className="w-8 h-px bg-border my-2.5 shrink-0" />
                <Link
                  href={`/portal/${slug}/learn/${courseSlug}`}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-[0.95] shrink-0"
                  title="Back to Course Overview"
                  aria-label="Back to Course Overview"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            /* Expanded Full Syllabus View */
            <div className="flex-1 overflow-y-auto w-full">
              {renderSyllabusContent({ showCollapseButton: true })}
            </div>
          )}
        </aside>

        {/* ── Center Column: Content Player Canvas ──────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-8 space-y-6 max-w-5xl mx-auto w-full transition-all duration-300 pb-28 lg:pb-12">
          {/* Drip Release Lock Card (if current lesson is locked and not a preview) */}
          {isCurrentLessonLocked ? (
            <LessonDripLockCard
              portalSlug={slug}
              courseSlug={courseSlug}
              courseTitle={course.title}
              lessonTitle={currentLesson.title}
              releaseResult={currentLessonRelease}
              prerequisiteLesson={prerequisiteLesson}
              parentModule={currentModule}
            />
          ) : (
            <>
              {/* Video Player Canvas */}
              {currentLesson.contentType === 'video' && currentLesson.videoUrl && (
                <div className="relative aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl border-2 border-border">
                  {currentLesson.videoUrl.includes('youtube.com') || currentLesson.videoUrl.includes('youtu.be') ? (
                    <iframe
                      src={
                        currentLesson.videoUrl.includes('watch?v=')
                          ? currentLesson.videoUrl.replace('watch?v=', 'embed/')
                          : currentLesson.videoUrl
                      }
                      title={currentLesson.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={currentLesson.videoUrl}
                      controls
                      className="w-full h-full object-contain"
                      poster={currentLesson.thumbnailUrl || course.thumbnailUrl}
                    />
                  )}
                </div>
              )}

              {/* Lesson Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0.5 capitalize">
                      {currentLesson.contentType}
                    </Badge>
                    {currentLesson.isPreview && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
                        Free Preview
                      </Badge>
                    )}
                    {isCurrentCompleted && (
                      <Badge className="bg-emerald-500 text-white border-0 text-[10px] font-bold gap-1">
                        <Check className="w-3 h-3" /> Completed
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-foreground">{currentLesson.title}</h1>
                </div>

                <Button
                  onClick={handleMarkComplete}
                  disabled={isCurrentLessonLocked}
                  className={cn(
                    'rounded-xl font-bold text-xs gap-1.5 shadow-xs transition-transform active:scale-[0.97] min-h-[44px]',
                    isCurrentCompleted
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-primary text-white hover:bg-primary/90'
                  )}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isCurrentCompleted ? 'Completed ✓ (Next)' : 'Mark as Complete & Next'}
                </Button>
              </div>

              {/* Tabs: Notes & Blocks, Quiz, Toolkits */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full h-11 p-1 bg-muted/60 rounded-2xl grid grid-cols-3">
                  <TabsTrigger value="notes" className="rounded-xl text-xs font-bold gap-1.5 min-h-[36px]">
                    <BookOpen className="w-3.5 h-3.5" /> Notes & Takeaways
                  </TabsTrigger>
                  <TabsTrigger value="quiz" className="rounded-xl text-xs font-bold gap-1.5 min-h-[36px]">
                    <HelpCircle className="w-3.5 h-3.5" /> Knowledge Quiz
                  </TabsTrigger>
                  <TabsTrigger value="downloads" className="rounded-xl text-xs font-bold gap-1.5 min-h-[36px]">
                    <Download className="w-3.5 h-3.5" /> Toolkits ({currentLesson.attachments?.length || 0})
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Notes & Takeaways (Dual-mode Block Studio / Markdown) */}
                <TabsContent value="notes" className="space-y-4 pt-4">
                  <Card className="rounded-3xl border-2 border-border p-6 sm:p-8 space-y-6 bg-card leading-relaxed">
                    {currentLesson.summary && (
                      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 text-xs font-medium text-foreground">
                        <strong className="text-primary font-bold block mb-1">Lesson Objective:</strong>
                        {currentLesson.summary}
                      </div>
                    )}

                    {/* Dual-Mode Body: Render Block Studio Canvas if blocks exist; fallback to formatted text */}
                    {currentLesson.blocks && currentLesson.blocks.length > 0 ? (
                      <div className="space-y-4">
                        {currentLesson.blocks.map(block => (
                          <BlockRenderer key={block.id} block={block} ctx={renderCtx} />
                        ))}
                      </div>
                    ) : currentLesson.content ? (
                      <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                        {currentLesson.content}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic text-xs">
                        No additional reading notes provided for this lesson. Use the video and quiz tabs.
                      </p>
                    )}
                  </Card>
                </TabsContent>

                {/* Tab 2: Interactive Quiz */}
                <TabsContent value="quiz" className="space-y-4 pt-4">
                  {!currentAssessment ? (
                    <Card className="rounded-3xl border-2 border-border p-8 text-center space-y-2 bg-card">
                      <HelpCircle className="w-10 h-10 mx-auto text-muted-foreground" />
                      <h4 className="font-bold text-sm">No Scored Quiz for this Lesson</h4>
                      <p className="text-xs text-muted-foreground">Click &quot;Mark as Complete&quot; to advance to the next topic.</p>
                    </Card>
                  ) : (
                    <Card className="rounded-3xl border-2 border-border p-6 sm:p-8 space-y-6 bg-card">
                      <div className="border-b border-border pb-3">
                        <h3 className="font-bold text-base text-foreground">{currentAssessment.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          Passing requirement: <strong>{currentAssessment.passingScore}%</strong>
                        </p>
                      </div>

                      {quizResult && (
                        <div
                          className={cn(
                            'p-4 rounded-2xl border text-xs font-bold flex items-center justify-between',
                            quizResult.passed
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
                          )}
                        >
                          <span>
                            {quizResult.passed ? '🎉 Passed!' : '❌ Not Passed.'} Your Score: {quizResult.score}% (
                            {quizResult.correctAnswersCount}/{quizResult.totalQuestionsCount} correct)
                          </span>
                        </div>
                      )}

                      <div className="space-y-6">
                        {currentAssessment.questions.map((q, qIdx) => (
                          <div key={q.id || qIdx} className="space-y-3 p-4 rounded-2xl border border-border bg-muted/20">
                            <p className="font-bold text-xs text-foreground">
                              {qIdx + 1}. {q.questionText}
                            </p>

                            <div className="space-y-2">
                              {q.options.map(opt => {
                                const isSelected = (quizAnswers[q.id] || []).includes(opt.id);

                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => handleSelectOption(q.id, opt.id, q.type === 'multiple_answer')}
                                    className={cn(
                                      'w-full text-left p-3.5 rounded-xl border text-xs flex items-center gap-3 transition-colors min-h-[44px]',
                                      isSelected
                                        ? 'bg-primary text-white border-primary font-bold shadow-xs'
                                        : 'bg-card border-border text-foreground hover:bg-muted/60'
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        'w-5 h-5 rounded-lg flex items-center justify-center border text-[10px] font-bold shrink-0',
                                        isSelected ? 'bg-white text-primary border-white' : 'border-border'
                                      )}
                                    >
                                      {isSelected ? <Check className="w-3 h-3" /> : ''}
                                    </span>
                                    <span>{opt.text}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={handleSubmitQuiz}
                        disabled={isEvaluatingQuiz}
                        className="w-full h-11 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-2 shadow-xs min-h-[44px]"
                      >
                        {isEvaluatingQuiz ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Quiz Answers'}
                      </Button>
                    </Card>
                  )}
                </TabsContent>

                {/* Tab 3: Downloads */}
                <TabsContent value="downloads" className="space-y-4 pt-4">
                  {(!currentLesson.attachments || currentLesson.attachments.length === 0) ? (
                    <Card className="rounded-3xl border-2 border-border p-8 text-center space-y-2 bg-card">
                      <Download className="w-10 h-10 mx-auto text-muted-foreground" />
                      <h4 className="font-bold text-sm">No Downloadable Files</h4>
                      <p className="text-xs text-muted-foreground">This lesson does not contain companion spreadsheets or PDFs.</p>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {currentLesson.attachments.map(att => (
                        <Card key={att.id} className="p-4 rounded-2xl border-2 border-border flex items-center justify-between bg-card min-h-[64px]">
                          <div className="space-y-0.5">
                            <h5 className="font-bold text-xs text-foreground">{att.name}</h5>
                            <p className="text-[10px] text-muted-foreground uppercase">{att.mimeType || 'Document'}</p>
                          </div>
                          <Button asChild size="sm" className="rounded-xl font-bold text-xs bg-primary text-white gap-1.5 active:scale-[0.97] min-h-[36px]">
                            <a href={att.url} download target="_blank" rel="noreferrer">
                              <Download className="w-3.5 h-3.5" /> Download
                            </a>
                          </Button>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Bottom Pagination Controls */}
              <div className="pt-6 border-t border-border flex items-center justify-between gap-4">
                {prevLesson ? (
                  <Button asChild variant="outline" size="sm" className="rounded-xl text-xs font-bold gap-1.5 min-h-[44px] active:scale-[0.97]">
                    <Link href={`/portal/${slug}/learn/${courseSlug}/${prevLesson.slug}`}>
                      <ArrowLeft className="w-3.5 h-3.5" /> Previous Lesson
                    </Link>
                  </Button>
                ) : (
                  <div />
                )}

                {nextLesson && (
                  <Button asChild size="sm" className="rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 gap-1.5 min-h-[44px] active:scale-[0.97]">
                    <Link href={`/portal/${slug}/learn/${courseSlug}/${nextLesson.slug}`}>
                      Next Lesson <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </>
          )}
        </main>

        {/* ── Right Column: Docked Non-Modal AI Tutor Panel (Desktop) ── */}
        {isAiTutorEnabled && (
          <aside
            className={cn(
              'hidden lg:flex flex-col border-l border-border bg-card shrink-0 transition-all duration-300 ease-in-out h-[calc(100vh-57px)] sticky top-[57px] overflow-hidden',
              isAiPanelOpen ? 'w-80 xl:w-96 opacity-100' : 'w-14 items-center py-3 bg-card/60'
            )}
          >
            {isAiPanelOpen ? (
              <AiTutorChatContent
                portalSlug={slug}
                courseSlug={courseSlug}
                lessonSlug={lessonSlug}
                portalId={portal?.id || ''}
                courseId={course.id}
                lessonId={currentLesson.id}
                lessonTitle={currentLesson.title}
                organizationId={portal?.organizationId || ''}
                userId={user?.uid || 'guest'}
                onClose={() => setIsAiPanelOpen(false)}
                isDocked
              />
            ) : (
              <div className="flex flex-col items-center justify-between h-full py-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsAiPanelOpen(true)}
                  className="h-10 w-10 rounded-xl border border-border hover:bg-primary/10 hover:text-primary text-muted-foreground active:scale-[0.95] transition-all"
                  title="Open AI Tutor Panel"
                  aria-label="Open AI Tutor Panel"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                </Button>
                <button
                  type="button"
                  onClick={() => setIsAiPanelOpen(true)}
                  className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors py-4 select-none cursor-pointer"
                  style={{ writingMode: 'vertical-rl' }}
                  title="Open AI Tutor Panel"
                >
                  AI Tutor
                </button>
                <div className="w-4" />
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ── Mobile Bottom Navigation Bar ───────────────────────────────── */}
      <nav
        aria-label="Lesson player quick actions"
        className={cn(
          'lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border grid items-center justify-around h-16 px-2 shadow-xl',
          isAiTutorEnabled ? 'grid-cols-4' : 'grid-cols-3'
        )}
      >
        {/* Button 1: Syllabus */}
        <button
          type="button"
          onClick={() => setIsMobileSyllabusOpen(true)}
          className="flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[64px] rounded-xl px-2 py-1 text-muted-foreground hover:text-foreground active:scale-[0.95] transition-transform"
        >
          <Layers className="w-5 h-5 text-primary" />
          <span className="text-[10px] font-bold">
            Syllabus ({completedLessonIds.length}/{lessons?.length || 0})
          </span>
        </button>

        {/* Button 2: Lesson Notes */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('notes');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[64px] rounded-xl px-2 py-1 transition-transform active:scale-[0.95]',
            activeTab === 'notes' ? 'text-primary font-bold' : 'text-muted-foreground'
          )}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px]">Lesson</span>
        </button>

        {/* Button 3: AI Tutor (Only rendered if feature toggle enabled) */}
        {isAiTutorEnabled && (
          <button
            type="button"
            onClick={() => setIsMobileAiTutorOpen(true)}
            className="flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[64px] rounded-xl px-2 py-1 text-primary active:scale-[0.95] transition-transform relative"
          >
            <div className="relative">
              <Sparkles className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span className="text-[10px] font-bold">AI Tutor</span>
          </button>
        )}

        {/* Button 4: Complete / Next */}
        <button
          type="button"
          onClick={handleMarkComplete}
          disabled={isCurrentLessonLocked}
          className={cn(
            'flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[64px] rounded-xl px-2 py-1 transition-transform active:scale-[0.95]',
            isCurrentLessonLocked
              ? 'opacity-40 cursor-not-allowed text-muted-foreground'
              : isCurrentCompleted
              ? 'text-emerald-600 font-bold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {isCurrentLessonLocked ? (
            <Lock className="w-5 h-5 text-muted-foreground" />
          ) : (
            <CheckCircle2 className="w-5 h-5" />
          )}
          <span className="text-[10px]">
            {isCurrentLessonLocked ? 'Locked' : isCurrentCompleted ? 'Next →' : 'Complete'}
          </span>
        </button>
      </nav>

      {/* ── Mobile Syllabus Drawer (Left Slide-In Sheet) ───────────────── */}
      <Sheet open={isMobileSyllabusOpen} onOpenChange={setIsMobileSyllabusOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm p-4 overflow-y-auto flex flex-col">
          <SheetHeader className="pb-3 border-b border-border text-left">
            <SheetTitle className="text-sm font-black flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Course Syllabus
            </SheetTitle>
          </SheetHeader>
          <div className="pt-3 flex-1 overflow-y-auto">
            {renderSyllabusContent({ onSelectLesson: () => setIsMobileSyllabusOpen(false) })}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Mobile AI Tutor Drawer (Bottom Sheet) ──────────────────────── */}
      {isAiTutorEnabled && (
        <LessonAiTutorDrawer
          isOpen={isMobileAiTutorOpen}
          onClose={() => setIsMobileAiTutorOpen(false)}
          portalSlug={slug}
          courseSlug={courseSlug}
          lessonSlug={lessonSlug}
          portalId={portal?.id || ''}
          courseId={course.id}
          lessonId={currentLesson.id}
          lessonTitle={currentLesson.title}
          organizationId={portal?.organizationId || ''}
          userId={user?.uid || 'guest'}
        />
      )}

      {/* Global Quick Search Modal */}
      <PortalSearchModal
        open={isSearchModalOpen}
        onOpenChange={setIsSearchModalOpen}
        portalId={portal.id}
        portalSlug={slug}
      />
    </PortalThemeProvider>
  );
}
