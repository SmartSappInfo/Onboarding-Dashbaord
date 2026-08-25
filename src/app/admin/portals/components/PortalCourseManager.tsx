'use client';

/**
 * {{Org_name}} Experience Platform — Portal Course Manager
 *
 * Visual LMS Course studio tab for administrators to create courses,
 * configure curriculum hierarchies, manage instructors, and track enrollments.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  createCourseAction,
  updateCourseAction,
  deleteCourseAction,
} from '@/app/actions/learning-actions';
import type { Course, CourseLevel, CourseStatus } from '@/lib/types/learning';
import { CurriculumBuilderDrawer } from './CurriculumBuilderDrawer';
import {
  GraduationCap,
  Plus,
  Search,
  MoreVertical,
  Layers,
  Clock,
  User,
  Award,
  ExternalLink,
  Edit,
  Trash2,
  CheckCircle2,
  Sparkles,
  Loader2,
  BookOpen,
} from 'lucide-react';

interface PortalCourseManagerProps {
  portalId: string;
  portalSlug: string;
  organizationId: string;
  workspaceIds?: string[];
}

export function PortalCourseManager({
  portalId,
  portalSlug,
  organizationId,
  workspaceIds = ['onboarding'],
}: PortalCourseManagerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [levelFilter, setLevelFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  // Modal / Drawer States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingCourse, setEditingCourse] = React.useState<Course | null>(null);
  const [curriculumCourse, setCurriculumCourse] = React.useState<Course | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [instructorName, setInstructorName] = React.useState('');
  const [instructorTitle, setInstructorTitle] = React.useState('');
  const [thumbnailUrl, setThumbnailUrl] = React.useState('');
  const [category, setCategory] = React.useState('Leadership & Management');
  const [level, setLevel] = React.useState<CourseLevel>('all_levels');
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = React.useState(60);
  const [certificateEnabled, setCertificateEnabled] = React.useState(true);

  // Query Courses
  const coursesQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'courses'),
            where('portalId', '==', portalId),
            orderBy('order', 'asc')
          )
        : null,
    [firestore, portalId]
  );
  const { data: courses, isLoading } = useCollection<Course>(coursesQuery);

  const filteredCourses = React.useMemo(() => {
    return (courses || []).filter(c => {
      const matchSearch =
        !searchQuery ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.instructorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchLevel = levelFilter === 'all' || c.level === levelFilter;
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchSearch && matchLevel && matchStatus;
    });
  }, [courses, searchQuery, levelFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingCourse(null);
    setTitle('');
    setSlug('');
    setDescription('');
    setInstructorName('');
    setInstructorTitle('');
    setThumbnailUrl('');
    setCategory('Leadership & Management');
    setLevel('all_levels');
    setEstimatedDurationMinutes(60);
    setCertificateEnabled(true);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (course: Course) => {
    setEditingCourse(course);
    setTitle(course.title);
    setSlug(course.slug);
    setDescription(course.description || '');
    setInstructorName(course.instructorName || '');
    setInstructorTitle(course.instructorTitle || '');
    setThumbnailUrl(course.thumbnailUrl || '');
    setCategory(course.category || 'General');
    setLevel(course.level);
    setEstimatedDurationMinutes(course.estimatedDurationMinutes || 60);
    setCertificateEnabled(course.certificateEnabled);
    setIsCreateOpen(true);
  };

  const handleSubmitCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: 'Title Required', description: 'Please enter a course title.' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCourse) {
        const res = await updateCourseAction(
          editingCourse.id,
          {
            title: title.trim(),
            slug: slug.trim() || undefined,
            description: description.trim(),
            instructorName: instructorName.trim(),
            instructorTitle: instructorTitle.trim(),
            thumbnailUrl: thumbnailUrl.trim(),
            category: category.trim(),
            level,
            estimatedDurationMinutes: Number(estimatedDurationMinutes) || 60,
            certificateEnabled,
          },
          portalId,
          portalSlug
        );
        if (!res.success) throw new Error(res.error);
        toast({ title: 'Course Updated! 🎓', description: `Saved changes to "${res.data?.title}".` });
      } else {
        const res = await createCourseAction({
          organizationId,
          portalId,
          workspaceIds,
          title: title.trim(),
          slug: slug.trim() || undefined,
          description: description.trim(),
          instructorName: instructorName.trim() || 'Academy Lead',
          instructorTitle: instructorTitle.trim(),
          thumbnailUrl: thumbnailUrl.trim(),
          category: category.trim(),
          level,
          estimatedDurationMinutes: Number(estimatedDurationMinutes) || 60,
          certificateEnabled,
          status: 'published',
          order: (courses?.length || 0) + 1,
        });
        if (!res.success) throw new Error(res.error);
        toast({ title: 'Course Created! 🎓', description: `"${res.data?.title}" is ready for curriculum.` });
      }
      setIsCreateOpen(false);
    } catch (err: any) {
      toast({ title: 'Action Failed', description: err?.message || 'Could not save course.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to permanently delete this course, all its modules, and lessons?')) return;
    try {
      const res = await deleteCourseAction(courseId, portalId);
      if (!res.success) throw new Error(res.error);
      toast({ title: 'Course Deleted', description: 'Course and curriculum removed.' });
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err?.message });
    }
  };

  const handleToggleStatus = async (course: Course) => {
    const nextStatus: CourseStatus = course.status === 'published' ? 'draft' : 'published';
    try {
      await updateCourseAction(course.id, { status: nextStatus }, portalId, portalSlug);
      toast({
        title: nextStatus === 'published' ? 'Course Published 🚀' : 'Course Set to Draft',
        description: `Status changed to ${nextStatus}.`,
      });
    } catch (err: any) {
      toast({ title: 'Status Update Failed', description: err?.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Action Toolbar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-4 rounded-3xl border-2 border-border shadow-xs">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search courses, instructors, topics..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-2xl text-xs"
            />
          </div>

          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="h-10 text-xs rounded-2xl w-36">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 text-xs rounded-2xl w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="h-10 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Create Course
        </Button>
      </div>

      {/* ── Courses Grid ──────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
          <p>Loading course catalog...</p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
          <GraduationCap className="w-12 h-12 mx-auto text-primary/60" />
          <h4 className="font-bold text-base text-foreground">No Courses Found</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? 'No courses match your filter criteria.'
              : 'Launch your academy by creating your first structured course.'}
          </p>
          <Button onClick={handleOpenCreate} className="rounded-2xl font-bold text-xs bg-primary text-white">
            <Plus className="w-4 h-4 mr-1" /> Create First Course
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map(c => (
            <Card
              key={c.id}
              className="rounded-3xl border-2 border-border p-5 space-y-4 hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between bg-card"
            >
              <div className="space-y-3">
                {/* Thumbnail / Header */}
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted/60 border border-border">
                  {c.thumbnailUrl ? (
                    <img src={c.thumbnailUrl} alt={c.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1.5 p-4 text-center">
                      <BookOpen className="w-8 h-8 text-primary/60" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{c.category || 'Curriculum'}</span>
                    </div>
                  )}

                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <Badge
                      className={`text-[9px] uppercase font-black px-2 py-0.5 border-0 ${
                        c.status === 'published'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {c.status}
                    </Badge>
                  </div>
                </div>

                {/* Course Metadata */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                    {c.category || 'Masterclass'} • {c.level.replace('_', ' ')}
                  </span>
                  <h3 className="font-extrabold text-sm text-foreground line-clamp-1">{c.title}</h3>
                  {c.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{c.summary}</p>
                  )}
                </div>

                {/* Instructor & Lesson Counters */}
                <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-semibold text-[11px] truncate max-w-[130px]">
                    <User className="w-3.5 h-3.5 text-primary shrink-0" /> {c.instructorName || 'Academy Lead'}
                  </span>
                  <span className="flex items-center gap-1 font-bold text-foreground text-[11px]">
                    <Layers className="w-3.5 h-3.5 text-primary shrink-0" /> {c.totalLessonCount || 0} Lessons
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setCurriculumCourse(c)}
                  className="flex-1 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-xs"
                >
                  <Layers className="w-3.5 h-3.5" /> Curriculum Studio
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl shrink-0">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl p-1.5 space-y-1">
                    <DropdownMenuItem
                      onClick={() => handleOpenEdit(c)}
                      className="text-xs font-semibold rounded-xl gap-2 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleToggleStatus(c)}
                      className="text-xs font-semibold rounded-xl gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {c.status === 'published' ? 'Unpublish (Draft)' : 'Publish Course'}
                    </DropdownMenuItem>
                    <Link href={`/portal/${portalSlug}/learn/${c.slug}`} target="_blank">
                      <DropdownMenuItem className="text-xs font-semibold rounded-xl gap-2 cursor-pointer">
                        <ExternalLink className="w-3.5 h-3.5" /> View Public Page
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuItem
                      onClick={() => handleDeleteCourse(c.id)}
                      className="text-xs font-semibold rounded-xl gap-2 text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Course
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create / Edit Course Modal ────────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 sm:p-8 space-y-4">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <GraduationCap className="w-4 h-4" /> Course Configurator
            </div>
            <DialogTitle className="text-xl font-bold">
              {editingCourse ? 'Edit Course Settings' : 'Create New Course'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Define the course title, syllabus overview, instructor bio, and difficulty level.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitCourse} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Course Title</Label>
              <Input
                placeholder="e.g. Invoicing & Fee Recovery Masterclass"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Category</Label>
                <Input
                  placeholder="e.g. Finance & Operations"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Difficulty Level</Label>
                <Select value={level} onValueChange={(val: CourseLevel) => setLevel(val)}>
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all_levels">All Levels</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Instructor Name</Label>
                <Input
                  placeholder="e.g. Dr. Kwame Mensah"
                  value={instructorName}
                  onChange={e => setInstructorName(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Instructor Title</Label>
                <Input
                  placeholder="e.g. Head of Bursary Automation"
                  value={instructorTitle}
                  onChange={e => setInstructorTitle(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Thumbnail Cover Image URL</Label>
              <Input
                placeholder="https://..."
                value={thumbnailUrl}
                onChange={e => setThumbnailUrl(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Course Summary & Syllabus Overview</Label>
              <Textarea
                placeholder="Write a clear overview of what students will achieve upon completing this course..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="text-xs rounded-xl resize-none"
              />
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground">Issue Completion Certificate</span>
                <p className="text-[11px] text-muted-foreground">Automatically award Open Badges 3.0 verified credential</p>
              </div>
              <Switch checked={certificateEnabled} onCheckedChange={setCertificateEnabled} />
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingCourse ? (
                  'Save Changes'
                ) : (
                  'Create Course & Build Curriculum'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Curriculum Builder Drawer ─────────────────────────────────── */}
      <CurriculumBuilderDrawer
        open={Boolean(curriculumCourse)}
        onOpenChange={open => !open && setCurriculumCourse(null)}
        course={curriculumCourse}
        portalSlug={portalSlug}
      />
    </div>
  );
}
