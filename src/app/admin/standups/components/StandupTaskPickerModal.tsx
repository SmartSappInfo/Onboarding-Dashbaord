'use client';

/**
 * @fileOverview StandupTaskPickerModal component.
 * Allows members to search and select existing workspace tasks to link to their standup.
 * Adheres strictly to Section 8 Modal Architecture:
 * - Demarcated header and footer
 * - Single-circle CardInfoTooltip with z-[10050]
 * - sr-only DialogDescription
 * - min-h-[44px] touch targets on all interactive controls
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import type { Task } from '@/lib/types';
import { TaskPriorityBadge } from '@/app/admin/tasks/components/primitives/TaskPriorityBadge';
import { TaskStatusBadge } from '@/app/admin/tasks/components/primitives/TaskStatusBadge';
import { Search, Check, ListChecks } from 'lucide-react';

export interface StandupTaskPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  title?: string;
  tooltipText?: string;
}

export function StandupTaskPickerModal({
  open,
  onOpenChange,
  tasks,
  onSelectTask,
  title = 'Link Workspace Task',
  tooltipText = 'Select an active task to link directly to your daily standup item.',
}: StandupTaskPickerModalProps) {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredTasks = React.useMemo(() => {
    if (!searchTerm.trim()) return tasks.slice(0, 30);
    const term = searchTerm.toLowerCase();
    return tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          t.category?.toLowerCase().includes(term)
      )
      .slice(0, 30);
  }, [tasks, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader demarcated>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-bold">{title}</DialogTitle>
            <CardInfoTooltip text={tooltipText} />
          </div>
          <DialogDescription className="sr-only">
            Select workspace tasks to link to your standup update.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 border-b border-border/60 bg-muted/10 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks by title or category..."
              className="pl-10 h-11 min-h-[44px] rounded-xl text-sm bg-background border-border/80"
              aria-label="Search tasks"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[240px]">
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <ListChecks className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm font-semibold">No matching tasks found</p>
              <p className="text-xs mt-1">Try adjusting your search keywords</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/70 hover:border-border bg-card/60 hover:bg-accent/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate text-foreground">
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <TaskStatusBadge status={task.status} />
                    <TaskPriorityBadge priority={task.priority} />
                    {task.dueDate && (
                      <span className="text-[11px] text-muted-foreground">
                        Due {task.dueDate}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onSelectTask(task);
                    onOpenChange(false);
                  }}
                  className="rounded-xl h-11 min-h-[44px] px-3.5 text-xs font-bold active:scale-[0.97] shrink-0"
                >
                  <Check className="h-4 w-4 mr-1 text-emerald-600" />
                  Select
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter demarcated>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl h-11 min-h-[44px] px-5 text-xs font-bold active:scale-[0.97]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
