import React from 'react';
import { z } from 'zod';
import { GraduationCap, Clock, BookOpen, ArrowRight, CheckCircle2 } from 'lucide-react';
import { registerBlock } from '../../registry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const courseItemSchema = z.object({
  id: z.string(),
  title: z.string().default('Course Title'),
  description: z.string().default('Course summary and learning outcomes.'),
  duration: z.string().default('4 Weeks'),
  lessonsCount: z.number().default(12),
  progressPercent: z.number().default(0),
  badge: z.string().default('Beginner'),
  thumbnailUrl: z.string().default(''),
  href: z.string().default('#'),
});

const schema = z.object({
  heading: z.string().default('Featured Curriculum & Courses'),
  subtitle: z.string().default('Explore interactive structured learning tracks.'),
  columns: z.enum(['2', '3', '4']).default('3'),
  courses: z.array(courseItemSchema).default([]),
}).catchall(z.unknown());

type CourseListProps = z.infer<typeof schema>;

registerBlock({
  type: 'portal_course_list',
  label: 'Portal: Course Catalog',
  category: 'portal',
  icon: GraduationCap,
  fields: [
    { kind: 'text', key: 'heading', label: 'Section Heading' },
    { kind: 'textarea', key: 'subtitle', label: 'Subtitle' },
    {
      kind: 'select',
      key: 'columns',
      label: 'Grid Columns',
      options: [
        { value: '2', label: '2 Columns' },
        { value: '3', label: '3 Columns' },
        { value: '4', label: '4 Columns' },
      ],
    },
    {
      kind: 'list',
      key: 'courses',
      label: 'Course Items',
      itemFields: [
        { kind: 'text', key: 'title', label: 'Course Title' },
        { kind: 'textarea', key: 'description', label: 'Description' },
        { kind: 'text', key: 'duration', label: 'Duration' },
        { kind: 'number', key: 'lessonsCount', label: 'Lessons Count' },
        { kind: 'number', key: 'progressPercent', label: 'Progress (%)' },
        { kind: 'text', key: 'badge', label: 'Badge' },
        { kind: 'image', key: 'thumbnailUrl', label: 'Thumbnail URL' },
        { kind: 'text', key: 'href', label: 'Course Link' },
      ],
    },
  ],
  defaults: schema.parse({
    heading: 'Featured Curriculum & Courses',
    subtitle: 'Explore interactive structured learning tracks designed for high performance.',
    columns: '3',
    courses: [
      {
        id: '1',
        title: 'Fee Collection Masterclass',
        description: 'Automate parent invoicing, reduce delinquency, and eliminate confrontations.',
        duration: '3 Weeks',
        lessonsCount: 8,
        progressPercent: 45,
        badge: 'Core Track',
        thumbnailUrl: '',
        href: '#',
      },
      {
        id: '2',
        title: 'School Enrollment Growth Blueprint',
        description: 'Proven multi-channel marketing campaigns to double student enrollments.',
        duration: '4 Weeks',
        lessonsCount: 14,
        progressPercent: 0,
        badge: 'Advanced',
        thumbnailUrl: '',
        href: '#',
      },
      {
        id: '3',
        title: 'Compliance & Digital Records Administration',
        description: 'Standardize student profiles, teacher portfolios, and regulatory audits.',
        duration: '2 Weeks',
        lessonsCount: 6,
        progressPercent: 100,
        badge: 'Certified',
        thumbnailUrl: '',
        href: '#',
      },
    ],
  }),
  schema,
  render: (props: CourseListProps, _block, ctx) => {
    const isDark = ctx.themeMode === 'dark';
    const gridCols =
      props.columns === '2'
        ? 'grid-cols-1 sm:grid-cols-2'
        : props.columns === '4'
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

    return (
      <section className="py-8 space-y-6 w-full">
        {(props.heading || props.subtitle) && (
          <div className="space-y-1">
            {props.heading && (
              <h3 className="text-xl font-bold tracking-tight text-foreground">{props.heading}</h3>
            )}
            {props.subtitle && (
              <p className="text-xs text-muted-foreground">{props.subtitle}</p>
            )}
          </div>
        )}

        <div className={`grid ${gridCols} gap-6`}>
          {props.courses.map(course => (
            <div
              key={course.id}
              className={`rounded-3xl border-2 transition-all p-5 flex flex-col justify-between space-y-4 hover:shadow-lg ${
                isDark ? 'border-white/10 bg-card/60' : 'border-black/10 bg-card shadow-xs'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-bold uppercase rounded-full px-2.5">
                    {course.badge}
                  </Badge>
                  {course.progressPercent === 100 ? (
                    <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                    </span>
                  ) : course.progressPercent > 0 ? (
                    <span className="text-[10px] text-primary font-bold">
                      {course.progressPercent}% in progress
                    </span>
                  ) : null}
                </div>

                <div>
                  <h4 className="font-bold text-base text-foreground leading-snug">{course.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {course.description}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-border/60">
                {course.progressPercent > 0 && course.progressPercent < 100 && (
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${course.progressPercent}%` }}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {course.duration}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> {course.lessonsCount} Lessons
                  </span>
                </div>

                <a href={course.href} className="block w-full">
                  <Button
                    size="sm"
                    className="w-full rounded-xl font-bold text-xs gap-1.5 bg-primary text-white hover:bg-primary/90 min-h-[40px]"
                  >
                    {course.progressPercent > 0 ? 'Continue Lesson' : 'Start Course'}{' '}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  },
});
