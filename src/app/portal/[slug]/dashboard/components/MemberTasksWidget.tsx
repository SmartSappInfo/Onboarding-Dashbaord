'use client';

/**
 * {{Org_name}} Experience Platform — Member Daily Action Tasks Widget
 *
 * Dedicated task list enabling members to execute practical bursary drills,
 * track deadlines, and claim gamification points.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { completeTaskAction } from '@/app/actions/engagement-actions';
import type { MemberTask, TaskSubmission } from '@/lib/types/engagement';
import {
  ListOrdered,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Award,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface MemberTasksWidgetProps {
  portalId: string;
  portalSlug: string;
  userId: string;
  organizationId: string;
}

export function MemberTasksWidget({
  portalId,
  portalSlug,
  userId,
  organizationId,
}: MemberTasksWidgetProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [completingTaskId, setCompletingTaskId] = React.useState<string | null>(null);

  // 1. Query Tasks
  const tasksQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'member_tasks'),
            where('portalId', '==', portalId),
            where('isArchived', '==', false),
            orderBy('order', 'asc')
          )
        : null,
    [firestore, portalId]
  );
  const { data: tasks, isLoading: isLoadingTasks } = useCollection<MemberTask>(tasksQuery);

  // 2. Query User Submissions
  const submissionsQuery = useMemoFirebase(
    () =>
      firestore && portalId && userId
        ? query(
            collection(firestore, 'task_submissions'),
            where('portalId', '==', portalId),
            where('userId', '==', userId)
          )
        : null,
    [firestore, portalId, userId]
  );
  const { data: submissions } = useCollection<TaskSubmission>(submissionsQuery);

  const completedTaskIdMap = React.useMemo(() => {
    const map = new Map<string, TaskSubmission>();
    (submissions || []).forEach(s => {
      if (s.status === 'completed') map.set(s.taskId, s);
    });
    return map;
  }, [submissions]);

  const handleCompleteTask = async (taskId: string) => {
    setCompletingTaskId(taskId);
    try {
      const res = await completeTaskAction(
        {
          organizationId,
          portalId,
          taskId,
          userId,
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Task Completed! 🏆', description: 'Points claimed to your profile.' });
    } catch (err: any) {
      toast({ title: 'Action Failed', description: err?.message });
    } finally {
      setCompletingTaskId(null);
    }
  };

  if (isLoadingTasks) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="p-12 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
        <ListOrdered className="w-10 h-10 mx-auto text-primary/60" />
        <h4 className="font-bold text-sm text-foreground">No Active Action Tasks</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          You are all caught up! New drills and bursary tasks will appear here as your cohort advances.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-primary" />
            Action Tasks & Implementation Drills
          </h3>
          <p className="text-xs text-muted-foreground">
            Complete practical drills to apply academy learnings to your school.
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-bold px-2.5 py-1">
          {completedTaskIdMap.size}/{tasks.length} Completed
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tasks.map(task => {
          const isDone = completedTaskIdMap.has(task.id);
          const isCompleting = completingTaskId === task.id;

          return (
            <Card
              key={task.id}
              className={`rounded-3xl border-2 p-5 space-y-4 transition-all flex flex-col justify-between ${
                isDone
                  ? 'bg-muted/10 border-border opacity-85'
                  : 'bg-card border-border hover:border-primary/40 shadow-xs'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="secondary"
                    className={`text-[9px] font-bold uppercase capitalize ${
                      task.priority === 'urgent'
                        ? 'bg-rose-500/10 text-rose-600'
                        : task.priority === 'high'
                        ? 'bg-amber-500/10 text-amber-600'
                        : ''
                    }`}
                  >
                    {task.priority} Priority
                  </Badge>

                  <span className="font-extrabold text-xs text-primary flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> +{task.pointsReward} pts
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-foreground">{task.title}</h4>
                  {task.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {task.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                {task.dueDate ? (
                  <span className="flex items-center gap-1 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-primary" /> Due {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="text-[11px]">Self-Paced Drill</span>
                )}

                <div className="flex items-center gap-2">
                  {task.actionUrl && (
                    <Link href={task.actionUrl}>
                      <Button variant="ghost" size="sm" className="h-8 rounded-xl text-xs font-bold gap-1 text-primary">
                        Open Tool <ExternalLink className="w-3 h-3" />
                      </Button>
                    </Link>
                  )}

                  {!isDone ? (
                    <Button
                      size="sm"
                      disabled={isCompleting}
                      onClick={() => handleCompleteTask(task.id)}
                      className="h-8 px-3 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 shadow-2xs"
                    >
                      {isCompleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Complete Task'
                      )}
                    </Button>
                  ) : (
                    <Badge className="bg-emerald-500 text-white font-bold text-[10px] gap-1 py-1">
                      <CheckCircle2 className="w-3 h-3" /> Done
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
