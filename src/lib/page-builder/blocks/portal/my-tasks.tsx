import React from 'react';
import { z } from 'zod';
import { CheckSquare, Square, ArrowRight, CheckCircle2 } from 'lucide-react';
import { registerBlock } from '../../registry';
import { Button } from '@/components/ui/button';

const taskItemSchema = z.object({
  id: z.string(),
  title: z.string().default('Task Title'),
  category: z.string().default('Onboarding'),
  completed: z.boolean().default(false),
  dueText: z.string().default('Today'),
  actionUrl: z.string().default('#'),
});

const schema = z.object({
  heading: z.string().default('My Learning & Onboarding Checklist'),
  subtitle: z.string().default('Track your active milestones, onboarding tasks, and homework submissions.'),
  tasks: z.array(taskItemSchema).default([]),
}).catchall(z.unknown());

type MyTasksProps = z.infer<typeof schema>;

registerBlock({
  type: 'portal_my_tasks',
  label: 'Portal: My Tasks Checklist',
  category: 'portal',
  icon: CheckSquare,
  fields: [
    { kind: 'text', key: 'heading', label: 'Section Heading' },
    { kind: 'textarea', key: 'subtitle', label: 'Subtitle' },
    {
      kind: 'list',
      key: 'tasks',
      label: 'Tasks',
      itemFields: [
        { kind: 'text', key: 'title', label: 'Task Title' },
        { kind: 'text', key: 'category', label: 'Category' },
        { kind: 'boolean', key: 'completed', label: 'Completed' },
        { kind: 'text', key: 'dueText', label: 'Due Text' },
        { kind: 'text', key: 'actionUrl', label: 'Action URL' },
      ],
    },
  ],
  defaults: schema.parse({
    heading: 'My Learning & Onboarding Checklist',
    subtitle: 'Track your active milestones, onboarding tasks, and homework submissions.',
    tasks: [
      { id: '1', title: 'Complete School Profile Setup', category: 'Onboarding', completed: true, dueText: 'Completed', actionUrl: '#' },
      { id: '2', title: 'Watch Module 2 MoMo Gateway Integration Video', category: 'Curriculum', completed: false, dueText: 'Due Today', actionUrl: '#' },
      { id: '3', title: 'Submit Term 1 Debt Recovery Spreadsheet', category: 'Assignment', completed: false, dueText: 'Due Friday', actionUrl: '#' },
    ],
  }),
  schema,
  render: (props: MyTasksProps, _block, ctx) => {
    const isDark = ctx.themeMode === 'dark';
    const completedCount = props.tasks.filter(t => t.completed).length;
    const progressPercent = props.tasks.length ? Math.round((completedCount / props.tasks.length) * 100) : 0;

    return (
      <div
        className={`p-6 rounded-3xl border-2 transition-all space-y-4 max-w-lg mx-auto ${
          isDark ? 'border-white/10 bg-card/60' : 'border-black/10 bg-card shadow-xs'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-base text-foreground">{props.heading}</h4>
            <span className="text-xs font-bold text-primary tabular-nums">{progressPercent}%</span>
          </div>
          {props.subtitle && <p className="text-xs text-muted-foreground">{props.subtitle}</p>}
        </div>

        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="space-y-2 pt-2">
          {props.tasks.map(task => (
            <div
              key={task.id}
              className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                task.completed ? 'bg-muted/30 border-border/40 opacity-80' : 'bg-card border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                {task.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
                <div>
                  <p className={`text-xs font-bold leading-tight ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.title}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {task.category} • {task.dueText}
                  </span>
                </div>
              </div>

              {!task.completed && (
                <a href={task.actionUrl}>
                  <Button variant="ghost" size="sm" className="h-8 px-2.5 rounded-lg text-xs font-bold text-primary">
                    Start <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  },
});
