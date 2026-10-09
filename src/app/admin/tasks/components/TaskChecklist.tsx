'use client';

/**
 * @fileOverview TaskChecklist Component
 *
 * Interactive checklist management conforming to Roadmap §42 and UI Spec §577-588:
 * - Direct item toggle with instant optimistic callback.
 * - Tracks completion timestamp and user attribution (`completedAt`, `completedBy`).
 * - Progress header ("X of Y complete") paired with subtle visual progress bar.
 * - Inline item creation (Enter key or button) without opening modal.
 * - Mobile-first ergonomics: `min-h-[44px]` touch targets across checkboxes, inputs, and buttons.
 * - Scalability & resource governance (Rule 23): caps checklist items at max 50 items.
 */

import * as React from 'react';
import { Plus, X, CheckSquare, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { TaskChecklistItem } from '@/lib/types';

export interface TaskChecklistProps {
    items: TaskChecklistItem[];
    onChange: (items: TaskChecklistItem[]) => void;
    currentUserId?: string;
    disabled?: boolean;
    className?: string;
}

const MAX_CHECKLIST_ITEMS = 50;

export function TaskChecklist({
    items = [],
    onChange,
    currentUserId,
    disabled = false,
    className,
}: TaskChecklistProps) {
    const [newItemTitle, setNewItemTitle] = React.useState('');

    const completedCount = React.useMemo(() => {
        return items.filter(item => item.completed).length;
    }, [items]);

    const totalCount = items.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const handleToggle = (id: string, checked: boolean) => {
        if (disabled) return;
        const now = new Date().toISOString();
        const updated = items.map(item => {
            if (item.id === id) {
                return {
                    ...item,
                    completed: checked,
                    completedAt: checked ? now : null,
                    completedBy: checked ? (currentUserId || 'current-user') : null,
                };
            }
            return item;
        });
        onChange(updated);
    };

    const handleAddItem = () => {
        const title = newItemTitle.trim();
        if (!title || disabled || items.length >= MAX_CHECKLIST_ITEMS) return;

        const newItem: TaskChecklistItem = {
            id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            title,
            completed: false,
        };

        onChange([...items, newItem]);
        setNewItemTitle('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddItem();
        }
    };

    const handleDeleteItem = (id: string) => {
        if (disabled) return;
        const updated = items.filter(item => item.id !== id);
        onChange(updated);
    };

    return (
        <div className={cn("space-y-3.5 text-left select-none", className)}>
            {/* Header with live progress */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-muted-foreground shrink-0" />
                    <h4 className="text-xs font-semibold text-foreground">Checklist</h4>
                </div>
                {totalCount > 0 && (
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                        {completedCount} of {totalCount} complete
                    </span>
                )}
            </div>

            {totalCount > 0 && (
                <Progress 
                    value={progressPercent} 
                    className="h-1.5 bg-muted/60" 
                    aria-label={`Checklist progress: ${progressPercent}%`}
                />
            )}

            {/* Checklist Items */}
            {items.length > 0 ? (
                <div className="space-y-1.5">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className={cn(
                                "group/item flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-border/60 bg-card/60 hover:bg-muted/30 transition-colors min-h-[44px]",
                                item.completed && "bg-muted/20 opacity-80"
                            )}
                        >
                            <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none">
                                <Checkbox
                                    checked={item.completed}
                                    disabled={disabled}
                                    onCheckedChange={(checked) => handleToggle(item.id, !!checked)}
                                    className="h-4 w-4 rounded-md border-border/80 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground shrink-0"
                                />
                                <span className={cn(
                                    "text-xs font-medium text-foreground truncate leading-normal",
                                    item.completed && "line-through text-muted-foreground"
                                )}>
                                    {item.title}
                                </span>
                            </label>

                            <button
                                type="button"
                                aria-label="Remove item"
                                disabled={disabled}
                                onClick={() => handleDeleteItem(item.id)}
                                className="min-h-[44px] min-w-[44px] sm:min-h-[24px] sm:min-w-[24px] sm:h-6 sm:w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted active:scale-[0.95] transition-all cursor-pointer shrink-0"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="py-2 px-3 rounded-xl border border-dashed border-border/70 text-xs text-muted-foreground/80 flex items-center gap-2">
                    <CheckSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span>No checklist items yet. Add subtasks or verification steps below.</span>
                </div>
            )}

            {/* Inline Item Creator */}
            {!disabled && items.length < MAX_CHECKLIST_ITEMS && (
                <div className="flex items-center gap-2 pt-1">
                    <Input
                        type="text"
                        value={newItemTitle}
                        onChange={(e) => setNewItemTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Add checklist item..."
                        className="flex-1 rounded-xl bg-background border border-border/80 text-foreground placeholder:text-muted-foreground/50 text-xs h-11 min-h-[44px] px-3.5 focus-visible:ring-1 focus-visible:ring-primary"
                    />
                    <Button
                        type="button"
                        onClick={handleAddItem}
                        disabled={!newItemTitle.trim()}
                        className="rounded-xl font-semibold h-11 min-h-[44px] px-4 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] text-xs gap-1.5 shadow-2xs shrink-0 cursor-pointer"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Add item</span>
                    </Button>
                </div>
            )}
        </div>
    );
}

export default TaskChecklist;
