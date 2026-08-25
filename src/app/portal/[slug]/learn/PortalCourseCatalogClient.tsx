'use client';

/**
 * {{Org_name}} Experience Platform — Portal Course Catalog Client
 *
 * Full-featured course directory interface with category filtering,
 * difficulty badges, progress tracking for enrolled students, and instant search.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  GraduationCap,
  Search,
  BookOpen,
  User,
  Layers,
  Clock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import type { Portal } from '@/lib/types/portal';
import type { Course, CourseEnrollment } from '@/lib/types/learning';

interface PortalCourseCatalogClientProps {
  slug: string;
}

export default function PortalCourseCatalogClient({ slug }: PortalCourseCatalogClientProps) {
  const firestore = useFirestore();
  const { user } = useUser();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [selectedLevel, setSelectedLevel] = React.useState<string>('all');

  // 1. Query Portal
  const portalQuery = useMemoFirebase(
    () =>
      firestore && slug
        ? query(collection(firestore, 'portals'), where('slug', '==', slug))
        : null,
    [firestore, slug]
  );
  const { data: portals, isLoading: isLoadingPortal } = useCollection<Portal>(portalQuery);
  const portal = portals?.[0] ?? null;

  // 2. Query Published Courses
  const coursesQuery = useMemoFirebase(
    () =>
      firestore && portal?.id
        ? query(
            collection(firestore, 'courses'),
            where('portalId', '==', portal.id),
            where('status', '==', 'published'),
            orderBy('order', 'asc')
          )
        : null,
    [firestore, portal?.id]
  );
  const { data: courses, isLoading: isLoadingCourses } = useCollection<Course>(coursesQuery);

  // 3. Query User Enrollments
  const enrollmentsQuery = useMemoFirebase(
    () =>
      firestore && portal?.id && user?.uid
        ? query(
            collection(firestore, 'course_enrollments'),
            where('portalId', '==', portal.id),
            where('userId', '==', user.uid)
          )
        : null,
    [firestore, portal?.id, user?.uid]
  );
  const { data: enrollments } = useCollection<CourseEnrollment>(enrollmentsQuery);

  const enrollmentMap = React.useMemo(() => {
    const map = new Map<string, CourseEnrollment>();
    (enrollments || []).forEach(e => map.set(e.courseId, e));
    return map;
  }, [enrollments]);

  // Categories list
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    (courses || []).forEach(c => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set);
  }, [courses]);

  const filteredCourses = React.useMemo(() => {
    return (courses || []).filter(c => {
      const matchSearch =
        !searchQuery ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.instructorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.summary?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'all' || c.category === selectedCategory;
      const matchLvl = selectedLevel === 'all' || c.level === selectedLevel;
      return matchSearch && matchCat && matchLvl;
    });
  }, [courses, searchQuery, selectedCategory, selectedLevel]);

  if (isLoadingPortal || isLoadingCourses) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-12 space-y-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-32 rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Portal Not Found</h2>
          <Link href="/">
            <Button className="rounded-xl font-bold text-xs">Return Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const theme = portal.theme;
  const brandTitle = portal.branding?.brandName || portal.name;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* ── Top Header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/portal/${slug}`}>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <Link href={`/portal/${slug}`} className="flex items-center gap-2">
            {portal.branding?.logoUrl ? (
              <img src={portal.branding.logoUrl} alt={brandTitle} className="h-7 w-auto object-contain" />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: theme.colors.primary }}
              >
                {brandTitle.charAt(0)}
              </div>
            )}
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

      {/* ── Main Catalog Body ─────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-6 md:p-10 space-y-8">
        {/* Catalog Banner */}
        <div
          className="p-8 rounded-3xl text-white relative overflow-hidden shadow-lg space-y-3"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary || theme.colors.primary} 100%)`,
          }}
        >
          <div className="flex items-center gap-2 text-white/80 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Comprehensive Academy Curriculum
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Explore Courses & Masterclasses</h1>
          <p className="text-xs sm:text-sm text-white/90 max-w-2xl leading-relaxed">
            Gain mastery in school finance, automated fee collection, parent communications, and enrollment marketing.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-4 rounded-3xl border-2 border-border shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search courses, instructors, lessons..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-2xl text-xs"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Button
              size="sm"
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
              className="rounded-xl text-xs font-bold shrink-0"
              style={selectedCategory === 'all' ? { backgroundColor: theme.colors.primary } : undefined}
            >
              All Topics
            </Button>
            {categories.map(cat => (
              <Button
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat)}
                className="rounded-xl text-xs font-bold shrink-0"
                style={selectedCategory === cat ? { backgroundColor: theme.colors.primary } : undefined}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Courses Grid */}
        {filteredCourses.length === 0 ? (
          <div className="p-16 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
            <GraduationCap className="w-12 h-12 mx-auto text-primary/60" />
            <h4 className="font-bold text-base text-foreground">No Courses Found</h4>
            <p className="text-xs text-muted-foreground">Try clearing your search query or selecting another category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map(course => {
              const enrollment = enrollmentMap.get(course.id);
              const isEnrolled = Boolean(enrollment);
              const progressPct = enrollment?.progressPercentage || 0;

              return (
                <Link
                  key={course.id}
                  href={`/portal/${slug}/learn/${course.slug}`}
                  className="group block"
                >
                  <Card className="rounded-3xl border-2 border-border p-5 space-y-4 hover:shadow-xl hover:border-primary/50 transition-all flex flex-col justify-between h-full bg-card">
                    <div className="space-y-3">
                      {/* Thumbnail */}
                      <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted/60 border border-border">
                        {course.thumbnailUrl ? (
                          <img
                            src={course.thumbnailUrl}
                            alt={course.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1.5 p-4 text-center">
                            <BookOpen className="w-8 h-8 text-primary/60" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                              {course.category || 'Masterclass'}
                            </span>
                          </div>
                        )}

                        {isEnrolled && (
                          <div className="absolute top-2.5 left-2.5">
                            <Badge className="bg-emerald-500 text-white font-bold text-[9px] uppercase px-2 py-0.5 border-0 shadow-sm">
                              Enrolled • {progressPct}%
                            </Badge>
                          </div>
                        )}

                        <div className="absolute top-2.5 right-2.5">
                          <Badge variant="secondary" className="text-[9px] font-bold uppercase px-2 py-0.5 shadow-sm capitalize">
                            {course.level.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>

                      {/* Course Info */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                          {course.category || 'Curriculum'}
                        </span>
                        <h3 className="font-extrabold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                          {course.title}
                        </h3>
                        {course.summary && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {course.summary}
                          </p>
                        )}
                      </div>

                      {/* Enrolled Progress Bar */}
                      {isEnrolled && (
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                            <span>Your Progress</span>
                            <span>{progressPct}%</span>
                          </div>
                          <Progress value={progressPct} className="h-1.5 rounded-full" />
                        </div>
                      )}
                    </div>

                    {/* Footer Metadata & CTA */}
                    <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-semibold text-[11px]">
                          <Layers className="w-3.5 h-3.5 text-primary" /> {course.totalLessonCount || 0} Lessons
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-primary" /> {course.estimatedDurationMinutes || 60}m
                        </span>
                      </div>

                      <span className="font-bold text-xs text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        {isEnrolled ? 'Resume' : 'View Course'} <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card px-6 py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} {brandTitle}. Powered by Experience Platform.</p>
      </footer>
    </div>
  );
}
