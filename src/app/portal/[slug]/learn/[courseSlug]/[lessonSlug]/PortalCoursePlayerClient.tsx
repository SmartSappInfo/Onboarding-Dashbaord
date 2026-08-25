'use client';

/**
 * {{Org_name}} Experience Platform — Focused Course Learning Player & AI Tutor
 *
 * Dedicated LMS learning player with collapsible module navigation, video embed player,
 * interactive quiz runner, assignment submissions, drip locks, and ambient AI Tutor.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import {
  completeLessonAction,
  recordVideoProgressAction,
  submitAssessmentAction,
} from '@/app/actions/learning-actions';
import { LessonAiTutorDrawer } from './components/LessonAiTutorDrawer';
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
import {
  PlayCircle,
  CheckCircle2,
  Lock,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  BookOpen,
  HelpCircle,
  Layers,
  Menu,
  X,
  FileText,
  Download,
  Send,
  Loader2,
  Check,
} from 'lucide-react';
import { LearningProgressService } from '@/lib/services/learning-progress-service';

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

  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isAiTutorOpen, setIsAiTutorOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('notes');

  // Quiz State
  const [quizAnswers, setQuizAnswers] = React.useState<Record<string, string[]>>({});
  const [quizResult, setQuizResult] = React.useState<AssessmentResult | null>(null);
  const [isEvaluatingQuiz, setIsEvaluatingQuiz] = React.useState(false);

  // AI Tutor State
  const [aiPrompt, setAiPrompt] = React.useState('');
  const [aiMessages, setAiMessages] = React.useState<{ role: 'user' | 'assistant'; text: string }[]>([
    {
      role: 'assistant',
      text: 'Hello! I am your AI Learning Assistant for this lesson. Ask me anything about the content, request a quick summary, or ask for a practice quiz!',
    },
  ]);
  const [isAiThinking, setIsAiThinking] = React.useState(false);

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

  // 5. Query Assessment for Current Lesson
  const assessmentQuery = useMemoFirebase(
    () =>
      firestore && currentLesson?.id
        ? query(
            collection(firestore, 'course_assessments'),
            where('lessonId', '==', currentLesson.id),
            limit(1)
          )
        : null,
    [firestore, currentLesson?.id]
  );
  const { data: assessments } = useCollection<CourseAssessment>(assessmentQuery);
  const currentAssessment = assessments?.[0] ?? null;

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

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleMarkComplete = async () => {
    if (!course || !currentLesson || !portal || !user) {
      if (!user) toast({ title: 'Sign In Required', description: 'Please sign in to save your progress.' });
      return;
    }

    try {
      await completeLessonAction(course.id, currentLesson.id, user.uid, portal.id, slug);
      toast({ title: 'Lesson Completed! 🎉', description: 'Progress updated.' });

      if (nextLesson) {
        router.push(`/portal/${slug}/learn/${courseSlug}/${nextLesson.slug}`);
      }
    } catch (err: any) {
      toast({ title: 'Progress Save Failed', description: err?.message });
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
        {
          assessmentId: currentAssessment.id,
          courseId: course.id,
          lessonId: currentLesson.id,
          portalId: portal.id,
          userId: user.uid,
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
    } catch (err: any) {
      toast({ title: 'Evaluation Failed', description: err?.message });
    } finally {
      setIsEvaluatingQuiz(false);
    }
  };

  const handleAskAi = async (customPrompt?: string) => {
    const queryText = customPrompt || aiPrompt;
    if (!queryText.trim()) return;

    const newMsgs = [...aiMessages, { role: 'user' as const, text: queryText.trim() }];
    setAiMessages(newMsgs);
    setAiPrompt('');
    setIsAiThinking(true);

    setTimeout(() => {
      let reply = `In this lesson on "${currentLesson?.title}", the key insight is to automate structured follow-ups. Let me know if you would like me to draft an example template!`;
      if (queryText.toLowerCase().includes('quiz')) {
        reply = `Here is a practice question:\nWhat is the most effective channel for fee payment notifications?\nA) Postal Mail\nB) WhatsApp Direct with Payment Link (Correct)\nC) Radio Broadcast`;
      }
      setAiMessages([...newMsgs, { role: 'assistant' as const, text: reply }]);
      setIsAiThinking(false);
    }, 900);
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

  if (!course || !currentLesson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Lesson Not Found</h2>
          <Link href={`/portal/${slug}/learn/${courseSlug}`}>
            <Button className="rounded-xl font-bold text-xs">Return to Course Overview</Button>
          </Link>
        </div>
      </div>
    );
  }

  const theme = portal?.theme || { colors: { primary: '#3A86FF' } };
  const brandTitle = portal?.branding?.brandName || portal?.name || 'Academy';
  const progressPct = enrollment?.progressPercentage || 0;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between text-foreground">
      {/* ── Top Bar ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 rounded-xl border border-border hover:bg-muted text-foreground"
            aria-label="Toggle Syllabus Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href={`/portal/${slug}/learn/${courseSlug}`}>
            <Button variant="ghost" size="sm" className="rounded-xl text-xs font-bold gap-1.5 hidden sm:flex">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Overview
            </Button>
          </Link>

          <div className="space-y-0.5 max-w-[200px] sm:max-w-md truncate">
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider truncate">{course.title}</p>
            <h2 className="font-extrabold text-xs sm:text-sm text-foreground truncate">{currentLesson.title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 w-44">
            <Progress value={progressPct} className="h-2 rounded-full flex-1" />
            <span className="text-[11px] font-bold text-muted-foreground shrink-0">{progressPct}%</span>
          </div>

          <Button
            size="sm"
            onClick={() => setIsAiTutorOpen(true)}
            className="rounded-xl font-bold text-xs bg-primary/10 text-primary hover:bg-primary/20 border-0 gap-1.5 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" /> Ask AI Tutor
          </Button>
        </div>
      </header>

      {/* ── Learning Grid ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* ── Left Syllabus Sidebar (Desktop) ─────────────────────────── */}
        <aside className="hidden lg:block w-80 border-r border-border bg-card/60 overflow-y-auto p-4 space-y-4 shrink-0">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="font-extrabold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" /> Course Syllabus
            </span>
            <span className="text-[11px] font-bold text-foreground">
              {completedLessonIds.length}/{lessons?.length || 0}
            </span>
          </div>

          <div className="space-y-4">
            {(modules || []).map((mod, modIdx) => {
              const moduleLessons = (lessons || []).filter(l => l.moduleId === mod.id);

              return (
                <div key={mod.id} className="space-y-1.5">
                  <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                    <span className="uppercase tracking-wider">Module {modIdx + 1}: {mod.title}</span>
                  </div>

                  <div className="space-y-1">
                    {moduleLessons.map((les, lesIdx) => {
                      const isCurrent = les.id === currentLesson.id;
                      const isDone = completedLessonIds.includes(les.id);

                      return (
                        <Link
                          key={les.id}
                          href={`/portal/${slug}/learn/${courseSlug}/${les.slug}`}
                          className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-all ${
                            isCurrent
                              ? 'bg-primary text-white font-bold shadow-xs'
                              : isDone
                              ? 'text-foreground hover:bg-muted/60'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            {isDone ? (
                              <CheckCircle2
                                className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-white' : 'text-emerald-500'}`}
                              />
                            ) : (
                              <PlayCircle
                                className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-white' : 'text-muted-foreground'}`}
                              />
                            )}
                            <span className="truncate">
                              {lesIdx + 1}. {les.title}
                            </span>
                          </div>

                          <span className={`text-[10px] shrink-0 ${isCurrent ? 'text-white/80' : 'text-muted-foreground'}`}>
                            {les.videoDurationSeconds ? `${Math.round(les.videoDurationSeconds / 60)}m` : '10m'}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── Center Content Player Canvas ────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 max-w-5xl mx-auto w-full">
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
              className={`rounded-xl font-bold text-xs gap-1.5 shadow-sm transition-transform active:scale-[0.97] ${
                isCurrentCompleted
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-primary text-white hover:bg-primary/90'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {isCurrentCompleted ? 'Completed ✓ (Next)' : 'Mark as Complete & Next'}
            </Button>
          </div>

          {/* Tabs: Notes, Quiz, Toolkits */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full h-11 p-1 bg-muted/60 rounded-2xl grid grid-cols-3">
              <TabsTrigger value="notes" className="rounded-xl text-xs font-bold gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Notes & Takeaways
              </TabsTrigger>
              <TabsTrigger value="quiz" className="rounded-xl text-xs font-bold gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" /> Knowledge Quiz
              </TabsTrigger>
              <TabsTrigger value="downloads" className="rounded-xl text-xs font-bold gap-1.5">
                <Download className="w-3.5 h-3.5" /> Toolkits ({currentLesson.attachments?.length || 0})
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Notes */}
            <TabsContent value="notes" className="space-y-4 pt-4">
              <Card className="rounded-3xl border-2 border-border p-6 sm:p-8 space-y-4 bg-card leading-relaxed">
                {currentLesson.summary && (
                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 text-xs font-medium text-foreground">
                    <strong className="text-primary font-bold block mb-1">Lesson Objective:</strong>
                    {currentLesson.summary}
                  </div>
                )}

                <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm text-foreground/90 space-y-3">
                  {currentLesson.content ? (
                    <div className="whitespace-pre-line">{currentLesson.content}</div>
                  ) : (
                    <p className="text-muted-foreground italic">
                      No additional reading notes provided for this lesson. Use the video and quiz tabs.
                    </p>
                  )}
                </div>
              </Card>
            </TabsContent>

            {/* Tab 2: Interactive Quiz */}
            <TabsContent value="quiz" className="space-y-4 pt-4">
              {!currentAssessment ? (
                <Card className="rounded-3xl border-2 border-border p-8 text-center space-y-2 bg-card">
                  <HelpCircle className="w-10 h-10 mx-auto text-muted-foreground" />
                  <h4 className="font-bold text-sm">No Scored Quiz for this Lesson</h4>
                  <p className="text-xs text-muted-foreground">Click "Mark as Complete" to advance to the next topic.</p>
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
                      className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                        quizResult.passed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
                      }`}
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
                                className={`w-full text-left p-3 rounded-xl border text-xs flex items-center gap-3 transition-colors ${
                                  isSelected
                                    ? 'bg-primary text-white border-primary font-bold shadow-xs'
                                    : 'bg-card border-border text-foreground hover:bg-muted/60'
                                }`}
                              >
                                <span
                                  className={`w-5 h-5 rounded-lg flex items-center justify-center border text-[10px] font-bold ${
                                    isSelected ? 'bg-white text-primary border-white' : 'border-border'
                                  }`}
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
                    className="w-full h-11 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-2 shadow-sm"
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
                    <Card key={att.id} className="p-4 rounded-2xl border-2 border-border flex items-center justify-between bg-card">
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-xs text-foreground">{att.name}</h5>
                        <p className="text-[10px] text-muted-foreground uppercase">{att.mimeType || 'Document'}</p>
                      </div>
                      <a href={att.url} download target="_blank" rel="noreferrer">
                        <Button size="sm" className="rounded-xl font-bold text-xs bg-primary text-white gap-1.5">
                          <Download className="w-3.5 h-3.5" /> Download
                        </Button>
                      </a>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Bottom Pagination Controls */}
          <div className="pt-6 border-t border-border flex items-center justify-between gap-4">
            {prevLesson ? (
              <Link href={`/portal/${slug}/learn/${courseSlug}/${prevLesson.slug}`}>
                <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Previous Lesson
                </Button>
              </Link>
            ) : (
              <div />
            )}

            {nextLesson && (
              <Link href={`/portal/${slug}/learn/${courseSlug}/${nextLesson.slug}`}>
                <Button size="sm" className="rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 gap-1.5">
                  Next Lesson <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </main>
      </div>

      {/* ── Ambient AI Tutor Slide-Over Drawer ─────────────────────────── */}
      {/* ── AI Learning Tutor Drawer ─────────────────────────────────── */}
      <LessonAiTutorDrawer
        isOpen={isAiTutorOpen}
        onClose={() => setIsAiTutorOpen(false)}
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
    </div>
  );
}
