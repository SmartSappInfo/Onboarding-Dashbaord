'use client';

/**
 * {{Org_name}} Experience Platform — Curriculum Builder Drawer
 *
 * Full-featured visual curriculum editor for courses: multi-module hierarchy,
 * lesson organizer, video embed linking, drip schedule locks, and quiz creation.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import {
  createModuleAction,
  updateModuleAction,
  deleteModuleAction,
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
} from '@/app/actions/learning-actions';
import type {
  Course,
  CourseModule,
  CourseLesson,
  LessonContentType,
  ReleaseScheduleType,
  CompletionRuleType,
} from '@/lib/types/learning';
import { AssessmentBuilderModal } from './AssessmentBuilderModal';
import {
  GraduationCap,
  Layers,
  Plus,
  Trash2,
  Video,
  FileText,
  HelpCircle,
  Clock,
  Lock,
  Sparkles,
  ChevronRight,
  ChevronDown,
  PlayCircle,
  Sliders,
  CheckCircle2,
  Loader2,
  FileCode,
} from 'lucide-react';

interface CurriculumBuilderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null;
  portalSlug?: string;
  onCurriculumChanged?: () => void;
}

export function CurriculumBuilderDrawer({
  open,
  onOpenChange,
  course,
  portalSlug,
  onCurriculumChanged,
}: CurriculumBuilderDrawerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [modules, setModules] = React.useState<CourseModule[]>([]);
  const [lessons, setLessons] = React.useState<CourseLesson[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isMutating, setIsMutating] = React.useState(false);

  // Active Lesson for Quiz Builder
  const [activeQuizLesson, setActiveQuizLesson] = React.useState<CourseLesson | null>(null);

  // Fetch modules & lessons
  const fetchCurriculum = React.useCallback(async () => {
    if (!firestore || !course?.id) return;
    setIsLoading(true);
    try {
      const [modulesSnap, lessonsSnap] = await Promise.all([
        getDocs(
          query(
            collection(firestore, 'course_modules'),
            where('courseId', '==', course.id),
            orderBy('order', 'asc')
          )
        ),
        getDocs(
          query(
            collection(firestore, 'course_lessons'),
            where('courseId', '==', course.id),
            orderBy('order', 'asc')
          )
        ),
      ]);

      setModules(modulesSnap.docs.map(d => d.data() as CourseModule));
      setLessons(lessonsSnap.docs.map(d => d.data() as CourseLesson));
    } catch (err: any) {
      console.error('Error fetching curriculum:', err);
    } finally {
      setIsLoading(false);
    }
  }, [firestore, course?.id]);

  React.useEffect(() => {
    if (open && course?.id) {
      fetchCurriculum();
    }
  }, [open, course?.id, fetchCurriculum]);

  // ── Module Handlers ────────────────────────────────────────────────────────

  const handleAddModule = async () => {
    if (!course) return;
    setIsMutating(true);
    try {
      const order = modules.length + 1;
      const res = await createModuleAction(
        {
          organizationId: course.organizationId,
          portalId: course.portalId,
          courseId: course.id,
          title: `Module ${order}: New Section`,
          order,
        },
        portalSlug
      );

      if (res.success && res.data) {
        setModules([...modules, res.data]);
        toast({ title: 'Module Added', description: `Created "${res.data.title}".` });
        onCurriculumChanged?.();
      }
    } catch (err: any) {
      toast({ title: 'Failed to Add Module', description: err?.message });
    } finally {
      setIsMutating(false);
    }
  };

  const handleUpdateModule = async (moduleId: string, updates: Partial<CourseModule>) => {
    if (!course) return;
    try {
      await updateModuleAction(moduleId, updates, course.portalId, portalSlug);
      setModules(modules.map(m => (m.id === moduleId ? { ...m, ...updates } : m)));
    } catch (err: any) {
      toast({ title: 'Update Failed', description: err?.message });
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!course) return;
    if (!confirm('Are you sure you want to delete this module and all its lessons?')) return;
    setIsMutating(true);
    try {
      await deleteModuleAction(moduleId, course.portalId, portalSlug);
      setModules(modules.filter(m => m.id !== moduleId));
      setLessons(lessons.filter(l => l.moduleId !== moduleId));
      toast({ title: 'Module Deleted', description: 'Module and lessons removed.' });
      onCurriculumChanged?.();
    } catch (err: any) {
      toast({ title: 'Failed to Delete Module', description: err?.message });
    } finally {
      setIsMutating(false);
    }
  };

  // ── Lesson Handlers ────────────────────────────────────────────────────────

  const handleAddLesson = async (moduleId: string) => {
    if (!course) return;
    setIsMutating(true);
    try {
      const moduleLessons = lessons.filter(l => l.moduleId === moduleId);
      const order = moduleLessons.length + 1;

      const res = await createLessonAction(
        {
          organizationId: course.organizationId,
          portalId: course.portalId,
          courseId: course.id,
          moduleId,
          title: `Lesson ${order}: New Topic`,
          contentType: 'video',
          order,
        },
        portalSlug
      );

      if (res.success && res.data) {
        setLessons([...lessons, res.data]);
        toast({ title: 'Lesson Added', description: `Created "${res.data.title}".` });
        onCurriculumChanged?.();
      }
    } catch (err: any) {
      toast({ title: 'Failed to Add Lesson', description: err?.message });
    } finally {
      setIsMutating(false);
    }
  };

  const handleUpdateLesson = async (lessonId: string, updates: Partial<CourseLesson>) => {
    if (!course) return;
    try {
      await updateLessonAction(lessonId, updates, course.portalId, portalSlug);
      setLessons(lessons.map(l => (l.id === lessonId ? { ...l, ...updates } : l)));
    } catch (err: any) {
      toast({ title: 'Update Failed', description: err?.message });
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!course) return;
    if (!confirm('Are you sure you want to delete this lesson?')) return;
    setIsMutating(true);
    try {
      await deleteLessonAction(lessonId, course.portalId, portalSlug);
      setLessons(lessons.filter(l => l.id !== lessonId));
      toast({ title: 'Lesson Deleted', description: 'Lesson removed.' });
      onCurriculumChanged?.();
    } catch (err: any) {
      toast({ title: 'Failed to Delete Lesson', description: err?.message });
    } finally {
      setIsMutating(false);
    }
  };

  if (!course) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto p-6 sm:p-8 space-y-6">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <GraduationCap className="w-4 h-4" /> Curriculum Studio
          </div>
          <SheetTitle className="text-xl font-extrabold">{course.title}</SheetTitle>
          <SheetDescription className="text-xs">
            Organize modules, multimedia lessons, video player URLs, and interactive quizzes.
          </SheetDescription>
        </SheetHeader>

        {/* Action Header */}
        <div className="flex items-center justify-between bg-muted/40 p-4 rounded-2xl border border-border">
          <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
            <span>Modules: <strong className="text-foreground">{modules.length}</strong></span>
            <span>•</span>
            <span>Total Lessons: <strong className="text-foreground">{lessons.length}</strong></span>
          </div>

          <Button
            size="sm"
            onClick={handleAddModule}
            disabled={isMutating}
            className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Module
          </Button>
        </div>

        {/* Curriculum Hierarchy List */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p>Loading course modules and lessons...</p>
          </div>
        ) : modules.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
            <Layers className="w-10 h-10 mx-auto text-primary/60" />
            <h4 className="font-bold text-sm text-foreground">No Modules Yet</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Start building this course by clicking "Add Module" above.
            </p>
            <Button
              size="sm"
              onClick={handleAddModule}
              className="rounded-xl font-bold text-xs bg-primary text-white"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add First Module
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {modules.map((mod, modIdx) => {
              const moduleLessons = lessons.filter(l => l.moduleId === mod.id);

              return (
                <Card key={mod.id} className="rounded-3xl border-2 border-border p-5 space-y-4 bg-card shadow-sm">
                  {/* Module Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0 text-[10px] font-bold uppercase">
                          Module {modIdx + 1}
                        </Badge>
                        <Input
                          value={mod.title}
                          onChange={e => handleUpdateModule(mod.id, { title: e.target.value })}
                          className="font-bold text-sm h-8 rounded-xl border-transparent hover:border-border focus:border-primary px-2"
                        />
                      </div>
                      <Input
                        value={mod.description || ''}
                        onChange={e => handleUpdateModule(mod.id, { description: e.target.value })}
                        placeholder="Optional module description..."
                        className="text-xs h-7 text-muted-foreground border-transparent hover:border-border px-2"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteModule(mod.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-rose-500 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Module Drip Settings */}
                  <div className="flex items-center gap-3 text-xs bg-muted/20 p-2.5 rounded-xl border border-border">
                    <Lock className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-semibold text-muted-foreground text-[11px]">Drip Schedule:</span>
                    <Select
                      value={mod.releaseRule?.type || 'immediate'}
                      onValueChange={(val: ReleaseScheduleType) =>
                        handleUpdateModule(mod.id, {
                          releaseRule: { ...mod.releaseRule, type: val },
                        })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs rounded-lg w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="immediate">Available Immediately</SelectItem>
                        <SelectItem value="days_after_enrollment">Days After Enrollment</SelectItem>
                        <SelectItem value="days_after_join">Days After Joining</SelectItem>
                        <SelectItem value="specific_date">Specific Calendar Date</SelectItem>
                      </SelectContent>
                    </Select>

                    {(mod.releaseRule?.type === 'days_after_enrollment' ||
                      mod.releaseRule?.type === 'days_after_join') && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="1"
                          value={mod.releaseRule.daysDelay || 7}
                          onChange={e =>
                            handleUpdateModule(mod.id, {
                              releaseRule: {
                                ...mod.releaseRule,
                                type: mod.releaseRule?.type || 'days_after_enrollment',
                                daysDelay: Number(e.target.value) || 1,
                              },
                            })
                          }
                          className="w-16 h-7 text-xs rounded-lg text-center"
                        />
                        <span className="text-[11px] text-muted-foreground">days</span>
                      </div>
                    )}
                  </div>

                  {/* Lessons List in Module */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        Lessons ({moduleLessons.length})
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddLesson(mod.id)}
                        className="text-xs font-bold text-primary hover:bg-primary/10 h-7 rounded-xl gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Lesson
                      </Button>
                    </div>

                    {moduleLessons.map((lesson, lesIdx) => (
                      <div
                        key={lesson.id}
                        className="p-3.5 rounded-2xl border border-border bg-background space-y-3 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-[11px] font-bold text-muted-foreground">
                              {lesIdx + 1}.
                            </span>
                            <Input
                              value={lesson.title}
                              onChange={e => handleUpdateLesson(lesson.id, { title: e.target.value })}
                              className="font-bold text-xs h-8 rounded-xl flex-1"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <Select
                              value={lesson.contentType}
                              onValueChange={(val: LessonContentType) =>
                                handleUpdateLesson(lesson.id, { contentType: val })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs rounded-xl w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="video">🎥 Video</SelectItem>
                                <SelectItem value="article">📄 Article</SelectItem>
                                <SelectItem value="quiz">🎯 Quiz</SelectItem>
                                <SelectItem value="assignment">📝 Assignment</SelectItem>
                              </SelectContent>
                            </Select>

                            {lesson.contentType === 'quiz' && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setActiveQuizLesson(lesson)}
                                className="h-8 rounded-xl text-xs font-bold gap-1 text-primary hover:bg-primary/10"
                              >
                                <HelpCircle className="w-3.5 h-3.5" /> Edit Quiz
                              </Button>
                            )}

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-rose-500 rounded-xl"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Video URL / Content Config */}
                        {lesson.contentType === 'video' && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="sm:col-span-2">
                              <Input
                                value={lesson.videoUrl || ''}
                                onChange={e => handleUpdateLesson(lesson.id, { videoUrl: e.target.value })}
                                placeholder="Video URL (YouTube, Vimeo, MP4)..."
                                className="text-xs h-8 rounded-xl"
                              />
                            </div>
                            <div>
                              <Input
                                type="number"
                                value={lesson.videoDurationSeconds ? Math.round(lesson.videoDurationSeconds / 60) : ''}
                                onChange={e =>
                                  handleUpdateLesson(lesson.id, {
                                    videoDurationSeconds: (Number(e.target.value) || 0) * 60,
                                  })
                                }
                                placeholder="Duration (mins)"
                                className="text-xs h-8 rounded-xl"
                              />
                            </div>
                          </div>
                        )}

                        {/* Summary / Notes */}
                        <Textarea
                          value={lesson.summary || ''}
                          onChange={e => handleUpdateLesson(lesson.id, { summary: e.target.value })}
                          placeholder="Lesson summary and key takeaway notes..."
                          rows={2}
                          className="text-xs rounded-xl resize-none"
                        />

                        {/* Free Preview Toggle */}
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <span className="text-[11px] text-muted-foreground">
                            Public Free Preview (Unenrolled visitors can watch)
                          </span>
                          <Switch
                            checked={lesson.isPreview ?? false}
                            onCheckedChange={checked => handleUpdateLesson(lesson.id, { isPreview: checked })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Active Quiz Builder Modal */}
        {activeQuizLesson && (
          <AssessmentBuilderModal
            open={Boolean(activeQuizLesson)}
            onOpenChange={open => !open && setActiveQuizLesson(null)}
            courseId={course.id}
            lessonId={activeQuizLesson.id}
            portalId={course.portalId}
            onSaved={() => {
              toast({ title: 'Quiz Linked!', description: 'Assessment linked to lesson.' });
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
