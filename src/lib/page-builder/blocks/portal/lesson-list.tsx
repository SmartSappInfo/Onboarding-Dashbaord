import React from 'react';
import { z } from 'zod';
import { BookOpen, CheckCircle2, Lock, PlayCircle, Clock } from 'lucide-react';
import { registerBlock } from '../../registry';
import { Badge } from '@/components/ui/badge';

const lessonItemSchema = z.object({
  id: z.string(),
  number: z.number().default(1),
  title: z.string().default('Lesson Title'),
  duration: z.string().default('15 min'),
  status: z.enum(['completed', 'current', 'locked']).default('locked'),
  type: z.enum(['video', 'article', 'quiz', 'assignment']).default('video'),
  href: z.string().default('#'),
});

const schema = z.object({
  moduleTitle: z.string().default('Module 1: Foundations & Architecture'),
  moduleDescription: z.string().default('Core fundamentals and workflow setup.'),
  lessons: z.array(lessonItemSchema).default([]),
}).catchall(z.unknown());

type LessonListProps = z.infer<typeof schema>;

registerBlock({
  type: 'portal_lesson_list',
  label: 'Portal: Lesson Syllabus',
  category: 'portal',
  icon: BookOpen,
  fields: [
    { kind: 'text', key: 'moduleTitle', label: 'Module Title' },
    { kind: 'textarea', key: 'moduleDescription', label: 'Module Description' },
    {
      kind: 'list',
      key: 'lessons',
      label: 'Lessons',
      itemFields: [
        { kind: 'number', key: 'number', label: 'Lesson Number' },
        { kind: 'text', key: 'title', label: 'Lesson Title' },
        { kind: 'text', key: 'duration', label: 'Duration' },
        {
          kind: 'select',
          key: 'status',
          label: 'Status',
          options: [
            { value: 'completed', label: 'Completed' },
            { value: 'current', label: 'In Progress / Current' },
            { value: 'locked', label: 'Locked' },
          ],
        },
        {
          kind: 'select',
          key: 'type',
          label: 'Content Type',
          options: [
            { value: 'video', label: 'Video Lesson' },
            { value: 'article', label: 'Reading Material' },
            { value: 'quiz', label: 'Knowledge Check / Quiz' },
            { value: 'assignment', label: 'Practical Assignment' },
          ],
        },
        { kind: 'text', key: 'href', label: 'Lesson Link' },
      ],
    },
  ],
  defaults: schema.parse({
    moduleTitle: 'Module 1: Payment Automation Architecture',
    moduleDescription: 'Learn how to configure automated tuition invoices and instant parent SMS reminders.',
    lessons: [
      { id: '1', number: 1, title: 'Introduction to Automated Invoicing', duration: '12 min', status: 'completed', type: 'video', href: '#' },
      { id: '2', number: 2, title: 'Configuring Mobile Money Gateways', duration: '18 min', status: 'current', type: 'video', href: '#' },
      { id: '3', number: 3, title: 'Automated WhatsApp & SMS Schedules', duration: '15 min', status: 'locked', type: 'article', href: '#' },
      { id: '4', number: 4, title: 'Module 1 Knowledge Assessment', duration: '10 min', status: 'locked', type: 'quiz', href: '#' },
    ],
  }),
  schema,
  render: (props: LessonListProps, _block, ctx) => {
    const isDark = ctx.themeMode === 'dark';

    return (
      <section className="py-6 space-y-4 w-full">
        <div className="space-y-1 border-b border-border pb-3">
          <h3 className="text-lg font-bold tracking-tight text-foreground">{props.moduleTitle}</h3>
          {props.moduleDescription && (
            <p className="text-xs text-muted-foreground">{props.moduleDescription}</p>
          )}
        </div>

        <div className="space-y-2.5">
          {props.lessons.map(lesson => {
            const isCompleted = lesson.status === 'completed';
            const isCurrent = lesson.status === 'current';
            const isLocked = lesson.status === 'locked';

            return (
              <a
                key={lesson.id}
                href={isLocked ? undefined : lesson.href}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  isCurrent
                    ? 'border-primary bg-primary/10 shadow-xs'
                    : isCompleted
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border/60 bg-card/40 opacity-70 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-primary text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : lesson.number}
                  </div>

                  <div>
                    <h5 className="font-bold text-xs text-foreground flex items-center gap-2">
                      {lesson.title}
                      <Badge variant="secondary" className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md">
                        {lesson.type}
                      </Badge>
                    </h5>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> {lesson.duration}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {isLocked ? (
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  ) : isCurrent ? (
                    <PlayCircle className="w-5 h-5 text-primary" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
              </a>
            );
          })}
        </div>
      </section>
    );
  },
});
