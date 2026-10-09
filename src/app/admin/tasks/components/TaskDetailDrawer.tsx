'use client';

/**
 * @fileOverview TaskDetailDrawer Component
 *
 * Slide-over task detail inspection and rapid execution panel conforming to
 * Roadmap §43 and UI Spec §559-576:
 * - Direct checklist execution and live status toggle without leaving Kanban/List view.
 * - Embeds TaskChecklist, TaskRemindersEditor, TaskRelationshipBadge, and TaskAssignee.
 * - Seamless handoff to full TaskEditor for deep metadata or template edits.
 * - Full responsive design: slides in smoothly from right on desktop, converts to
 *   bottom sheet / full width drawer on mobile (<768px).
 * - Satisfies min-h-[44px] touch target rule across all interactive triggers and buttons.
 */

import * as React from 'react';
import { 
    X, 
    Edit3, 
    CheckCircle2, 
    RotateCcw, 
    Calendar, 
    Users, 
    Tag as TagIcon, 
    FileText, 
    StickyNote,
    Plus,
    Loader2,
    Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { suggestTaskChecklistAction } from '@/app/actions/task-copilot-actions';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { TaskStatusBadge } from './primitives/TaskStatusBadge';
import { TaskPriorityBadge } from './primitives/TaskPriorityBadge';
import { TaskDueDate } from './primitives/TaskDueDate';
import { TaskAssignee } from './primitives/TaskAssignee';
import { TaskRelationshipBadge } from './primitives/TaskRelationshipBadge';
import { TaskChecklist } from './TaskChecklist';
import { TaskRemindersEditor } from './TaskRemindersEditor';
import type { Task, TaskStatus, TaskChecklistItem, TaskReminder, UserProfile, TaskNote } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatTaskDate } from '@/lib/utils/date-utils';

export interface TaskDetailDrawerProps {
    task: Task | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdateTask?: (taskId: string, updates: Partial<Task>) => Promise<void> | void;
    onEditFull?: (task: Task) => void;
    userMap?: Map<string, UserProfile>;
    currentUserId?: string;
    currentUserName?: string;
    isUpdating?: boolean;
    className?: string;
}

export function TaskDetailDrawer({
    task,
    isOpen,
    onClose,
    onUpdateTask,
    onEditFull,
    userMap,
    currentUserId,
    currentUserName = 'Current User',
    isUpdating = false,
    className,
}: TaskDetailDrawerProps) {
    const [quickNote, setQuickNote] = React.useState('');
    const { toast } = useToast();
    const [isSuggestingSteps, setIsSuggestingSteps] = React.useState(false);

    const assignees = React.useMemo(() => {
        if (!userMap || !task?.assignedTo) return [];
        const ids = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
        return ids.map(id => userMap.get(id)).filter(Boolean) as UserProfile[];
    }, [task?.assignedTo, userMap]);

    if (!task) return null;

    const isDone = task.status === 'done';

    const handleToggleComplete = async () => {
        if (!onUpdateTask) return;
        const newStatus: TaskStatus = isDone ? 'todo' : 'done';
        await onUpdateTask(task.id, { status: newStatus });
    };

    const handleStatusChange = async (newStatus: TaskStatus) => {
        if (!onUpdateTask) return;
        await onUpdateTask(task.id, { status: newStatus });
    };

    const handleSuggestSteps = async () => {
        if (!task || isSuggestingSteps) return;
        try {
            setIsSuggestingSteps(true);
            const res = await suggestTaskChecklistAction(task.workspaceId, task.id, task.title);
            if (res.success && res.checklist && res.checklist.items.length > 0) {
                const currentItems = task.checklist || [];
                const newItems: TaskChecklistItem[] = res.checklist.items.map((title, idx) => ({
                    id: `chk_${Date.now()}_${idx}`,
                    title,
                    completed: false,
                }));
                await handleChecklistChange([...currentItems, ...newItems]);
                toast({
                    title: 'Checklist Steps Generated',
                    description: `Added ${newItems.length} action steps to task checklist.`,
                });
            } else {
                toast({
                    title: 'No steps generated',
                    description: res.error || 'Could not generate steps for this task.',
                    variant: 'destructive',
                });
            }
        } catch (err: unknown) {
            console.error('[TASK_DETAIL_DRAWER] Error suggesting steps:', err);
        } finally {
            setIsSuggestingSteps(false);
        }
    };

    const handleChecklistChange = async (newItems: TaskChecklistItem[]) => {
        if (!onUpdateTask) return;
        await onUpdateTask(task.id, { checklist: newItems });
    };

    const handleRemindersChange = async (newReminders: TaskReminder[]) => {
        if (!onUpdateTask) return;
        await onUpdateTask(task.id, { reminders: newReminders });
    };

    const handleRetryReminder = async (reminderId: string) => {
        if (!onUpdateTask || !task) return;
        const currentReminders = task.reminders || [];
        const updated = currentReminders.map(r => {
            if (r.id === reminderId) {
                return {
                    ...r,
                    status: 'scheduled' as const,
                    error: null,
                };
            }
            return r;
        });
        await onUpdateTask(task.id, { reminders: updated });
        toast({
            title: 'Reminder Retried',
            description: 'The reminder delivery has been queued for retry.',
        });
    };

    const handleAddNote = async () => {
        if (!quickNote.trim() || !onUpdateTask) return;
        const note: TaskNote = {
            id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            content: quickNote.trim(),
            createdAt: new Date().toISOString(),
            authorName: currentUserName,
        };
        const updatedNotes = [...(task.notes || []), note];
        await onUpdateTask(task.id, { notes: updatedNotes });
        setQuickNote('');
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent 
                side="right" 
                className={cn(
                    "w-full sm:max-w-xl p-0 flex flex-col bg-card border-l border-border/80 shadow-2xl z-[10000]",
                    className
                )}
            >
                {/* Demarcated Header */}
                <SheetHeader className="p-4 sm:p-6 border-b border-border/80 bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <TaskPriorityBadge priority={task.priority} />
                            <TaskStatusBadge
                                status={task.status}
                                interactive={!!onUpdateTask}
                                onStatusChange={handleStatusChange}
                            />
                        </div>

                        <div className="flex items-center gap-1.5">
                            {onEditFull && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onEditFull(task)}
                                    className="min-h-[44px] h-10 px-3.5 rounded-xl text-xs font-semibold gap-1.5 border-border/80 hover:bg-muted/40 active:scale-[0.97]"
                                >
                                    <Edit3 className="h-3.5 w-3.5" />
                                    <span>Edit task</span>
                                </Button>
                            )}

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Close drawer"
                                onClick={onClose}
                                className="min-h-[44px] min-w-[44px] h-10 w-10 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground active:scale-[0.95]"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <SheetTitle className="text-left text-base sm:text-lg font-bold text-foreground leading-snug break-words">
                        {task.title}
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                        Task detail execution drawer for {task.title}
                    </SheetDescription>
                </SheetHeader>

                {/* Main Scrollable Body */}
                <ScrollArea className="flex-1 px-4 sm:px-6 py-5">
                    <div className="space-y-6 text-left">
                        {/* Primary Context Row: Assignee, Due Date, Relationship */}
                        <div className="p-3.5 rounded-xl border border-border/60 bg-muted/15 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        Assignee
                                    </span>
                                    <TaskAssignee assignees={assignees} />
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Due Date
                                    </span>
                                    <TaskDueDate dueDate={task.dueDate} isDone={isDone} />
                                </div>
                            </div>

                            {(task.entityName || task.dealId || task.relatedEntityType) && (
                                <div className="pt-2 border-t border-border/40">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                                        Linked Record
                                    </span>
                                    <TaskRelationshipBadge
                                        entityId={task.entityId}
                                        entityName={task.entityName}
                                        entityType={task.entityType}
                                        relatedEntityType={task.relatedEntityType}
                                        relatedParentId={task.relatedParentId}
                                        relatedEntityId={task.relatedEntityId}
                                        dealId={task.dealId}
                                    />
                                </div>
                            )}

                            {task.tagIds && task.tagIds.length > 0 && (
                                <div className="pt-2 border-t border-border/40">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                                        Tags
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {task.tagIds.map((tag) => (
                                            <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0.5 rounded-md gap-1">
                                                <TagIcon className="h-2.5 w-2.5 opacity-60" />
                                                <span>{tag}</span>
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        {task.description && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>Details</span>
                                </div>
                                <div className="p-3.5 rounded-xl border border-border/60 bg-card/60 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                    {task.description}
                                </div>
                            </div>
                        )}

                        <Separator className="border-border/60" />

                        {/* Interactive Checklist Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-foreground">Action Checklist</span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={isSuggestingSteps}
                                    onClick={handleSuggestSteps}
                                    className="rounded-xl h-11 min-h-[44px] px-3.5 text-xs font-bold active:scale-[0.97] text-primary hover:text-primary"
                                >
                                    {isSuggestingSteps ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                                            Suggest steps with AI
                                        </>
                                    )}
                                </Button>
                            </div>
                            <TaskChecklist
                                items={task.checklist || []}
                                onChange={handleChecklistChange}
                                currentUserId={currentUserId}
                            />
                        </div>

                        <Separator className="border-border/60" />

                        {/* Reminders Section */}
                        <TaskRemindersEditor
                            reminders={task.reminders || []}
                            onChange={handleRemindersChange}
                            taskDueDate={task.dueDate}
                            onRetryReminder={handleRetryReminder}
                        />

                        <Separator className="border-border/60" />

                        {/* Activity & Notes */}
                        <div className="space-y-3.5">
                            <div className="flex items-center gap-2">
                                <StickyNote className="h-4 w-4 text-muted-foreground" />
                                <h4 className="text-xs font-semibold text-foreground">Notes & Discussion</h4>
                            </div>

                            {/* Add Quick Note */}
                            <div className="flex gap-2">
                                <Textarea
                                    value={quickNote}
                                    onChange={(e) => setQuickNote(e.target.value)}
                                    placeholder="Add a quick note or progress update..."
                                    className="min-h-[70px] rounded-xl bg-background border border-border/80 text-foreground placeholder:text-muted-foreground/50 text-xs"
                                />
                                <Button
                                    type="button"
                                    onClick={handleAddNote}
                                    disabled={!quickNote.trim()}
                                    className="h-auto w-12 rounded-xl shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs active:scale-[0.97]"
                                >
                                    <Plus className="h-5 w-5" />
                                </Button>
                            </div>

                            {/* Existing Notes */}
                            {task.notes && task.notes.length > 0 && (
                                <div className="space-y-2">
                                    {task.notes.map((note) => (
                                        <div key={note.id} className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1">
                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                <span className="font-semibold text-foreground/80">{note.authorName || 'Staff'}</span>
                                                <span>{formatTaskDate(note.createdAt, 'MMM d, yyyy · h:mm a')}</span>
                                            </div>
                                            <p className="text-xs text-foreground whitespace-pre-wrap">{note.content}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                {/* Demarcated Sticky Footer with Primary Action */}
                <div className="p-4 border-t border-border/80 bg-muted/15 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-muted-foreground">
                        Created {formatTaskDate(task.createdAt, 'MMM d, yyyy')}
                    </span>

                    <Button
                        type="button"
                        onClick={handleToggleComplete}
                        disabled={isUpdating}
                        className={cn(
                            "rounded-xl font-semibold h-11 min-h-[44px] px-6 text-xs gap-2 active:scale-[0.97] shadow-sm",
                            isDone 
                                ? "bg-muted text-foreground hover:bg-muted/80 border border-border/80" 
                                : "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                        )}
                    >
                        {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isDone ? (
                            <>
                                <RotateCcw className="h-4 w-4" />
                                <span>Reopen task</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Mark complete</span>
                            </>
                        )}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}

export default TaskDetailDrawer;
