'use client';

/**
 * {{Org_name}} Experience Platform — Course Overview Landing Client
 *
 * Dedicated course syllabus and overview page featuring instructor bio,
 * module accordion previews, learning objectives, and 1-click enrollment CTA.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { enrollInCourseAction } from '@/app/actions/learning-actions';
import type { Portal } from '@/lib/types/portal';
import type { Course, CourseModule, CourseLesson, CourseEnrollment } from '@/lib/types/learning';
import {
  GraduationCap,
  ArrowLeft,
  ArrowRight,
  PlayCircle,
  BookOpen,
  HelpCircle,
  Layers,
  Clock,
  Award,
  Check,
  CheckCircle2,
  Sparkles,
  User,
  ShieldCheck,
  Lock,
  Loader2,
} from 'lucide-react';
import { PortalAuthModal } from '../../components/PortalAuthModal';

interface PortalCourseOverviewClientProps {
  slug: string;
  courseSlug: string;
}

export default function PortalCourseOverviewClient({
  slug,
  courseSlug,
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
  const portal = portals?.[0] ?? null;

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

  // 5. Query Enrollment
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

  const firstLesson = (lessons || [])[0] ?? null;
  const targetLessonSlug = enrollment?.currentLessonId
    ? (lessons || []).find(l => l.id === enrollment.currentLessonId)?.slug || firstLesson?.slug
    : firstLesson?.slug;

  const handleEnroll = async () => {
    if (!portal || !course) return;

    if (!user) {
      setIsAuthModalOpen(true);
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
    } catch (err: any) {
      toast({ title: 'Enrollment Error', description: err?.message });
    } finally {
      setIsEnrolling(false);
    }
  };

  if (isLoadingPortal || isLoadingCourse) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-12 space-y-6">
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
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Course Not Found</h2>
          <Link href={`/portal/${slug}/learn`}>
            <Button className="rounded-xl font-bold text-xs">Return to Catalog</Button>
          </Link>
        </div>
      </div>
    );
  }

  const theme = portal.theme;
  const brandTitle = portal.branding?.brandName || portal.name;
  const isEnrolled = Boolean(enrollment);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/portal/${slug}/learn`}>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <Link href={`/portal/${slug}`} className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight">{brandTitle}</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/portal/${slug}/dashboard`}>
            <Button variant="outline" size="sm" className="h-9 rounded-xl font-bold text-xs gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-primary" /> My Learning Hub
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Main Body ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-6 md:p-10 space-y-10">
        {/* Course Hero Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center bg-card p-6 sm:p-10 rounded-3xl border-2 border-border shadow-sm">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-bold uppercase tracking-wider">
                {course.category || 'Academy Masterclass'}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-bold uppercase capitalize">
                {course.level.replace('_', ' ')}
              </Badge>
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

            {/* CTA Button */}
            <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {isEnrolled && targetLessonSlug ? (
                <Link href={`/portal/${slug}/learn/${courseSlug}/${targetLessonSlug}`}>
                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-11 px-8 rounded-xl font-bold text-xs text-white shadow-md gap-2"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    Resume Course ({enrollment?.progressPercentage || 0}%) <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <Button
                  size="lg"
                  onClick={handleEnroll}
                  disabled={isEnrolling}
                  className="w-full sm:w-auto h-11 px-8 rounded-xl font-bold text-xs text-white shadow-md gap-2"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  {isEnrolling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Start This Course <ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground justify-center sm:justify-start">
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
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted/60 border border-border shadow-xs">
              {course.thumbnailUrl ? (
                <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
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

        {/* Detailed Syllabus Accordion */}
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
              const moduleLessons = (lessons || []).filter(l => l.moduleId === mod.id);

              return (
                <AccordionItem
                  key={mod.id}
                  value={mod.id}
                  className="rounded-2xl border-2 border-border bg-card overflow-hidden shadow-2xs"
                >
                  <AccordionTrigger className="px-5 py-4 hover:no-underline font-bold text-sm">
                    <div className="flex items-center gap-3 text-left">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase px-2 py-0.5">
                        Module {modIdx + 1}
                      </Badge>
                      <span className="text-foreground">{mod.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-4 space-y-2 border-t border-border pt-3">
                    {moduleLessons.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No lessons in this module yet.</p>
                    ) : (
                      moduleLessons.map((lesson, lesIdx) => (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/40 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <PlayCircle className="w-4 h-4 text-primary shrink-0" />
                            <span className="font-medium text-foreground">
                              {lesIdx + 1}. {lesson.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {lesson.isPreview && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-bold">
                                Free Preview
                              </Badge>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              {lesson.videoDurationSeconds
                                ? `${Math.round(lesson.videoDurationSeconds / 60)}m`
                                : '10m'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card px-6 py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} {brandTitle}. Powered by Experience Platform.</p>
      </footer>

      {/* ── Auth Modal for unauthenticated enrollment ─────────────────── */}
      <PortalAuthModal
        portal={portal}
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        onAuthenticated={() => handleEnroll()}
      />
    </div>
  );
}
