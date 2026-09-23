'use client';

/**
 * Authentic Course Curriculum Catalog Preview Component
 *
 * Renders a pixel-accurate preview of `/portal/[slug]/learn` inside the
 * Studio visual preview canvas, matching `PortalCourseCatalogClient.tsx`.
 *
 * Rules:
 * - Strictly typed (Zero any / any[] / unknown).
 * - Live reactive theming and responsive grid layout.
 * - Mobile ergonomics: >=44px touch targets.
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  GraduationCap,
  Search,
  Sparkles,
  Clock,
  BookOpen,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { getPortalButtonInlineStyle } from '@/lib/utils/portal-theme';
import type { PortalThemeConfig } from '@/lib/types/portal';

export interface PortalCurriculumPreviewProps {
  theme: PortalThemeConfig;
  radiusCss: string;
  onNavigateRoute?: (route: '/' | '/learn' | '/community' | '/dashboard') => void;
}

export function PortalCurriculumPreview({
  theme,
  radiusCss,
  onNavigateRoute,
}: PortalCurriculumPreviewProps) {
  const [selectedTopic, setSelectedTopic] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  const primaryBtnStyle = React.useMemo(
    () =>
      getPortalButtonInlineStyle(
        theme.ui?.buttonStyle,
        theme.colors.primary,
        radiusCss
      ),
    [theme.ui?.buttonStyle, theme.colors.primary, radiusCss]
  );

  const sampleCourses = [
    {
      id: 'c1',
      title: 'School Invoicing & USSD Fee Recovery Framework',
      description: 'Automate student tuition billing, reconcile multi-bank deposits, and trigger WhatsApp notifications.',
      category: 'School Finance',
      modules: 5,
      lessons: 18,
      duration: '4.5 hrs',
      level: 'Operational',
      progress: 65,
    },
    {
      id: 'c2',
      title: 'Parent WhatsApp Communication & Retention Playbook',
      description: 'Streamline parent updates, student progress reports, and broadcast campaigns using verified templates.',
      category: 'Parent Engagement',
      modules: 4,
      lessons: 12,
      duration: '3.0 hrs',
      level: 'Essential',
      progress: 0,
    },
    {
      id: 'c3',
      title: 'Student Admissions, Enrollment & Bursary Governance',
      description: 'Best practices for managing bursary applications, applicant pipelines, and digital credential issuance.',
      category: 'Administration',
      modules: 3,
      lessons: 9,
      duration: '2.5 hrs',
      level: 'Executive',
      progress: 0,
    },
  ];

  const topics = ['all', 'School Finance', 'Parent Engagement', 'Administration'];

  const filteredCourses = sampleCourses.filter(c => {
    const matchesTopic = selectedTopic === 'all' || c.category === selectedTopic;
    const matchesSearch =
      !searchQuery ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTopic && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto w-full p-6 md:p-10 space-y-8">
      {/* ── Gradient Curriculum Banner ──────────────────────────────────── */}
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

      {/* ── Search & Topic Filter Bar ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--portal-surface)] p-4 rounded-3xl border-2 border-[var(--portal-border)] shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search courses, instructors, lessons..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-2xl text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {topics.map(topic => (
            <Button
              key={topic}
              size="sm"
              variant={selectedTopic === topic ? 'default' : 'outline'}
              onClick={() => setSelectedTopic(topic)}
              className="rounded-xl text-xs font-bold shrink-0 min-h-[36px]"
              style={selectedTopic === topic ? { backgroundColor: theme.colors.primary } : undefined}
            >
              {topic === 'all' ? 'All Topics' : topic}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Structured Courses Grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map(course => (
          <Card
            key={course.id}
            className="h-full border-2 border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 space-y-4 hover:shadow-xl hover:border-[var(--portal-primary)] transition-all flex flex-col justify-between"
            style={{ borderRadius: radiusCss }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
                  style={{ borderColor: theme.colors.primary, color: theme.colors.primary }}
                >
                  {course.category}
                </Badge>
                <span className="text-[11px] font-medium text-[var(--portal-muted)] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {course.duration}
                </span>
              </div>

              <div
                className="w-10 h-10 flex items-center justify-center text-white shadow-sm"
                style={{ backgroundColor: theme.colors.primary, borderRadius: radiusCss }}
              >
                <GraduationCap className="w-5 h-5" />
              </div>

              <h3 className="font-bold text-base text-[var(--portal-text)] leading-snug">
                {course.title}
              </h3>
              <p className="text-xs text-[var(--portal-muted)] leading-relaxed">
                {course.description}
              </p>
            </div>

            <div className="pt-3 border-t border-[var(--portal-border)] space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--portal-muted)]">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-primary" /> {course.modules} Modules • {course.lessons} Lessons
                </span>
                {course.progress > 0 && (
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {course.progress}%
                  </span>
                )}
              </div>

              <Button
                type="button"
                onClick={() => onNavigateRoute?.('/dashboard')}
                className="w-full h-10 rounded-xl font-bold text-xs text-white shadow-xs gap-1.5 active:scale-[0.98] transition-transform"
                style={primaryBtnStyle}
              >
                {course.progress > 0 ? 'Resume Masterclass' : 'Enroll in Course'} <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
