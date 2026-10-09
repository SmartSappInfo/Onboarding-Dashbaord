'use client';

/**
 * @fileOverview TaskRemindersEditor Component
 *
 * Interactive reminder configuration and delivery state manager conforming to
 * Roadmap §37-39 and UI Spec §599-612:
 * - Plain English schedule offsets (15m, 1h, 1d, 1w, custom).
 * - Multi-channel selection: Notification, Email, SMS.
 * - Delivery status tracking: Scheduled, Sent, Failed (with inline Retry), and Cancelled.
 * - Compact in-place creator avoiding heavy modals.
 * - Mobile-first touch targets (min-h-[44px]) and Emil Kowalski tactile clicks.
 * - Scalability bound: caps reminders at max 10 per task (Rule 23).
 */

import * as React from 'react';
import { 
    Bell, 
    Mail, 
    MessageSquare, 
    Clock, 
    CheckCircle2, 
    AlertTriangle, 
    XCircle, 
    Plus, 
    X, 
    RefreshCw 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { TaskReminder } from '@/lib/types';
import { formatTaskDate } from '@/lib/utils/date-utils';

export interface TaskRemindersEditorProps {
    reminders: TaskReminder[];
    onChange: (reminders: TaskReminder[]) => void;
    taskDueDate?: string;
    disabled?: boolean;
    onRetryReminder?: (reminderId: string) => void;
    className?: string;
}

type ReminderOffsetPreset = '15m' | '1h' | '1d' | '1w' | 'custom';
type ReminderChannel = 'notification' | 'email' | 'sms';

const MAX_REMINDERS = 10;

export function TaskRemindersEditor({
    reminders = [],
    onChange,
    taskDueDate,
    disabled = false,
    onRetryReminder,
    className,
}: TaskRemindersEditorProps) {
    const [isAdding, setIsAdding] = React.useState(false);
    const [selectedPreset, setSelectedPreset] = React.useState<ReminderOffsetPreset>('1d');
    const [selectedChannels, setSelectedChannels] = React.useState<ReminderChannel[]>(['notification']);
    const [customDateTime, setCustomDateTime] = React.useState('');

    const toggleChannel = (channel: ReminderChannel) => {
        setSelectedChannels(prev => 
            prev.includes(channel)
                ? prev.filter(c => c !== channel)
                : [...prev, channel]
        );
    };

    const calculateReminderTime = (preset: ReminderOffsetPreset, dueDateStr?: string): string => {
        if (preset === 'custom' && customDateTime) {
            return new Date(customDateTime).toISOString();
        }

        const baseDate = dueDateStr ? new Date(dueDateStr) : new Date(Date.now() + 24 * 60 * 60 * 1000);
        const baseMs = isNaN(baseDate.getTime()) ? Date.now() : baseDate.getTime();

        switch (preset) {
            case '15m':
                return new Date(baseMs - 15 * 60 * 1000).toISOString();
            case '1h':
                return new Date(baseMs - 60 * 60 * 1000).toISOString();
            case '1d':
                return new Date(baseMs - 24 * 60 * 60 * 1000).toISOString();
            case '1w':
                return new Date(baseMs - 7 * 24 * 60 * 60 * 1000).toISOString();
            default:
                return new Date(baseMs).toISOString();
        }
    };

    const handleSaveNewReminder = () => {
        if (selectedChannels.length === 0 || disabled || reminders.length >= MAX_REMINDERS) return;

        const reminderTime = calculateReminderTime(selectedPreset, taskDueDate);
        const newReminder: TaskReminder = {
            id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            reminderTime,
            channels: selectedChannels,
            sent: false,
            status: 'scheduled',
        };

        onChange([...reminders, newReminder]);
        setIsAdding(false);
        setSelectedPreset('1d');
        setSelectedChannels(['notification']);
        setCustomDateTime('');
    };

    const handleDeleteReminder = (id?: string, index?: number) => {
        if (disabled) return;
        const updated = reminders.filter((r, idx) => (id ? r.id !== id : idx !== index));
        onChange(updated);
    };

    const formatOffsetDisplay = (reminder: TaskReminder): string => {
        try {
            return formatTaskDate(reminder.reminderTime, 'MMM d, yyyy · h:mm a');
        } catch {
            return 'Scheduled time';
        }
    };

    return (
        <div className={cn("space-y-3.5 text-left select-none", className)}>
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
                    <h4 className="text-xs font-semibold text-foreground">Reminders</h4>
                </div>
                {reminders.length > 0 && (
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                        {reminders.length} scheduled
                    </span>
                )}
            </div>

            {/* List of Scheduled / Sent / Failed Reminders */}
            {reminders.length > 0 ? (
                <div className="space-y-2">
                    {reminders.map((rem, idx) => {
                        const status = rem.status || (rem.sent ? 'sent' : 'scheduled');
                        const isFailed = status === 'failed';
                        const isSent = status === 'sent';

                        return (
                            <div
                                key={rem.id || `rem-${idx}`}
                                className={cn(
                                    "flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-border/60 bg-card/60 gap-2 sm:gap-3 transition-colors",
                                    isFailed && "border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10"
                                )}
                            >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                                        {rem.channels.includes('notification') && <Bell className="h-3.5 w-3.5" aria-label="In-app notification" />}
                                        {rem.channels.includes('email') && <Mail className="h-3.5 w-3.5" aria-label="Email" />}
                                        {rem.channels.includes('sms') && <MessageSquare className="h-3.5 w-3.5" aria-label="SMS" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-foreground truncate">
                                            {formatOffsetDisplay(rem)}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground capitalize">
                                            {rem.channels.join(', ')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                    {/* Status Badge */}
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border select-none",
                                            isSent && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
                                            status === 'scheduled' && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
                                            isFailed && "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
                                            status === 'cancelled' && "bg-muted/40 text-muted-foreground border-border/60"
                                        )}
                                    >
                                        {isSent && <CheckCircle2 className="h-2.5 w-2.5" />}
                                        {status === 'scheduled' && <Clock className="h-2.5 w-2.5" />}
                                        {isFailed && <AlertTriangle className="h-2.5 w-2.5" />}
                                        {status === 'cancelled' && <XCircle className="h-2.5 w-2.5" />}
                                        <span className="capitalize">{status}</span>
                                    </Badge>

                                    {/* Retry Button for Failed Reminders */}
                                    {isFailed && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            aria-label="Retry reminder delivery"
                                            onClick={() => rem.id && onRetryReminder?.(rem.id)}
                                            className="min-h-[44px] sm:min-h-[28px] h-7 px-2.5 rounded-lg text-[10px] font-semibold gap-1 text-rose-700 border-rose-200 hover:bg-rose-100 active:scale-[0.97]"
                                        >
                                            <RefreshCw className="h-2.5 w-2.5" />
                                            <span>Retry</span>
                                        </Button>
                                    )}

                                    {/* Delete Reminder Button */}
                                    <button
                                        type="button"
                                        aria-label="Remove reminder"
                                        disabled={disabled}
                                        onClick={() => handleDeleteReminder(rem.id, idx)}
                                        className="min-h-[44px] min-w-[44px] sm:min-h-[24px] sm:min-w-[24px] sm:h-6 sm:w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted active:scale-[0.95] transition-all cursor-pointer shrink-0"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="py-2.5 px-3 rounded-xl border border-dashed border-border/70 text-xs text-muted-foreground/80 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span>No reminders scheduled yet. Add in-app or email alerts below.</span>
                </div>
            )}

            {/* In-place Creator Form */}
            {isAdding ? (
                <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* When selection */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-foreground/90">When</label>
                            <Select
                                value={selectedPreset}
                                onValueChange={(val: ReminderOffsetPreset) => setSelectedPreset(val)}
                            >
                                <SelectTrigger className="h-11 min-h-[44px] rounded-xl bg-background border-border/80 text-xs">
                                    <SelectValue placeholder="Select offset" />
                                </SelectTrigger>
                                <SelectContent className="z-[10050]">
                                    <SelectItem value="15m">15 minutes before</SelectItem>
                                    <SelectItem value="1h">1 hour before</SelectItem>
                                    <SelectItem value="1d">1 day before</SelectItem>
                                    <SelectItem value="1w">1 week before</SelectItem>
                                    <SelectItem value="custom">Custom time...</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Channels selection */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-foreground/90">Channels</label>
                            <div className="flex items-center gap-3 pt-2">
                                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                                    <Checkbox
                                        checked={selectedChannels.includes('notification')}
                                        onCheckedChange={() => toggleChannel('notification')}
                                        className="h-4 w-4 rounded"
                                    />
                                    <span>In-app</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                                    <Checkbox
                                        checked={selectedChannels.includes('email')}
                                        onCheckedChange={() => toggleChannel('email')}
                                        aria-label="Email"
                                        className="h-4 w-4 rounded"
                                    />
                                    <span>Email</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                                    <Checkbox
                                        checked={selectedChannels.includes('sms')}
                                        onCheckedChange={() => toggleChannel('sms')}
                                        className="h-4 w-4 rounded"
                                    />
                                    <span>SMS</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {selectedPreset === 'custom' && (
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-foreground/90">Custom Date & Time</label>
                            <Input
                                type="datetime-local"
                                value={customDateTime}
                                onChange={(e) => setCustomDateTime(e.target.value)}
                                className="h-11 min-h-[44px] rounded-xl bg-background border-border/80 text-xs"
                            />
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsAdding(false)}
                            className="rounded-xl text-xs font-semibold h-11 min-h-[44px] px-4 active:scale-[0.97]"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveNewReminder}
                            disabled={selectedChannels.length === 0}
                            className="rounded-xl text-xs font-semibold h-11 min-h-[44px] px-5 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] shadow-2xs"
                        >
                            Save reminder
                        </Button>
                    </div>
                </div>
            ) : (
                !disabled && reminders.length < MAX_REMINDERS && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAdding(true)}
                        className="rounded-xl text-xs font-semibold h-11 min-h-[44px] px-4 border-border/80 hover:bg-muted/40 active:scale-[0.97] gap-1.5 w-full sm:w-auto"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add reminder</span>
                    </Button>
                )
            )}
        </div>
    );
}

export default TaskRemindersEditor;
