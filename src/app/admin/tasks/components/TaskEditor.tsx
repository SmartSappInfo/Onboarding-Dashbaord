'use client';

/**
 * @fileOverview SmartSapp Task Editor & Modal System
 *
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Standardized Modal Architecture (theme.md Section 8 & .agents/AGENTS.md):
 *   * Demarcated header (<DialogHeader demarcated>) with <CardInfoTooltip> alongside title.
 *   * Zero raw description: descriptions rendered in <CardInfoTooltip text="..." /> with <DialogDescription className="sr-only">.
 *   * Surface geometry: border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl.
 *   * Demarcated footer: px-6 py-3.5 border-t border-border/80 bg-muted/15 with tactile buttons (active:scale-[0.97]).
 * - Tag Selection Single Source of Truth (.agents/AGENTS.md):
 *   * Uses <TagSelector> exclusively in client/draft mode (omits contactId/contactType, binds to currentTagIds & onTagsChange).
 * - Strict Zero-Any Invariant (Rule 4):
 *   * All callbacks, payloads, assignees, and entity states strictly typed.
 * - Concurrency & Performance (Rule 1, Rule 9, Rule 18):
 *   * Re-render thrash prevention using lastResetKeyRef.
 *   * Safe date parsing via safeParseDate / formatTaskDate.
 */

import * as React from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TaskChecklist } from './TaskChecklist';
import { TaskRemindersEditor } from './TaskRemindersEditor';
import type { TaskChecklistItem, TaskReminder } from '@/lib/types';
import { 
    Loader2, 
    Save, 
    User, 
    Building2, 
    Plus,
    FileText,
    Target,
    X,
    Calendar,
    Layout,
    StickyNote,
    Paperclip,
    Phone,
    MapPin,
    GraduationCap,
    ChevronLeft,
    CheckCircle2,
    Sparkles
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, getDoc, orderBy, query, where } from 'firebase/firestore';
import type { Task, UserProfile, EntityType } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { EntityCombobox } from '@/components/entities/EntityCombobox';
import { cn } from '@/lib/utils';
import { safeParseDate, formatTaskDate } from '@/lib/utils/date-utils';
import { generateTaskBaseSummary } from '@/lib/tasks/task-summary-utils';
import { Badge } from '@/components/ui/badge';
import { MediaSelect } from '../../entities/components/media-select';
import { useTerminology } from '@/hooks/use-terminology';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { TagSelector } from '@/components/tags/TagSelector';

const getInitials = (name?: string | null) =>
  name ? name.split(' ').map((n) => n[0]).join('').toUpperCase() : '?';

const taskSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters.'),
    description: z.string().optional().default(''),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    category: z.enum(['call', 'visit', 'document', 'training', 'follow_up', 'general']),
    status: z.enum(['todo', 'in_progress', 'waiting', 'review', 'done']),
    assignedTo: z.array(z.string()).min(1, 'Please assign at least one owner.'),
    entityId: z.string().optional(),
    entityType: z.enum(['institution', 'family', 'person']).optional(),
    startDate: z.date().optional(),
    dueDate: z.date({ required_error: 'Due date is required.' }),
    reminders: z.array(z.object({
        reminderTime: z.date(),
        channels: z.array(z.enum(['notification', 'email', 'sms'])).min(1, 'Select at least one channel.'),
        sent: z.boolean().default(false),
    })).max(3, 'Maximum 3 reminders allowed.'),
    notes: z.array(z.object({
        id: z.string(),
        content: z.string().min(1, 'Note content required.'),
        createdAt: z.string(),
        authorName: z.string().optional()
    })).default([]),
    attachments: z.array(z.object({
        id: z.string(),
        name: z.string(),
        url: z.string().url(),
        type: z.string(),
        createdAt: z.string()
    })).default([]),
    relatedEntityType: z.enum(['SurveyResponse', 'Submission', 'Meeting', 'School', 'Deal', 'Contract']).optional().nullable(),
    relatedParentId: z.string().optional().nullable(),
    relatedEntityId: z.string().optional().nullable(),
    tagIds: z.array(z.string()).default([]),
});

type TaskFormValues = z.infer<typeof taskSchema>;

export type TaskSavePayload = {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: 'call' | 'visit' | 'document' | 'training' | 'follow_up' | 'general';
    status: 'todo' | 'in_progress' | 'waiting' | 'review' | 'done';
    assignedTo: string[];
    entityId?: string;
    entityType?: EntityType;
    startDate?: string;
    dueDate: string;
    reminders: TaskReminder[];
    checklist?: TaskChecklistItem[];
    reminderSent: boolean;
    notes: Array<{
        id: string;
        content: string;
        createdAt: string;
        authorName?: string;
    }>;
    attachments: Array<{
        id: string;
        name: string;
        url: string;
        type: string;
        createdAt: string;
    }>;
    relatedEntityType?: 'SurveyResponse' | 'Submission' | 'Meeting' | 'School' | 'Deal' | 'Contract' | null;
    relatedParentId?: string | null;
    relatedEntityId?: string | null;
    tagIds?: string[];
    workspaceId: string;
};

interface TaskEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task?: Partial<Task> | null;
    onSave: (data: TaskSavePayload) => Promise<void>;
    isSaving: boolean;
    disableEntitySelect?: boolean;
    preFilledEntityName?: string;
}

const PRESET_TEMPLATES = [
    {
        id: 'call',
        title: 'Phone Call',
        description: 'Log details of an outbound or inbound phone conversation.',
        icon: Phone,
        category: 'call' as const,
        defaultTitle: 'Phone Call',
        defaultPriority: 'medium' as const,
        color: 'text-orange-500 bg-orange-500/10'
    },
    {
        id: 'visit',
        title: 'Site Visit',
        description: 'Record an in-person meeting or facility check-in.',
        icon: MapPin,
        category: 'visit' as const,
        defaultTitle: 'Site Visit',
        defaultPriority: 'high' as const,
        color: 'text-blue-500 bg-blue-500/10'
    },
    {
        id: 'document',
        title: 'Documentation',
        description: 'Prepare, inspect, or sign official onboarding files.',
        icon: FileText,
        category: 'document' as const,
        defaultTitle: 'Document Review',
        defaultPriority: 'medium' as const,
        color: 'text-emerald-500 bg-emerald-500/10'
    },
    {
        id: 'training',
        title: 'Training Session',
        description: 'Schedule or track onboarding instruction / tutorials.',
        icon: GraduationCap,
        category: 'training' as const,
        defaultTitle: 'Training Session',
        defaultPriority: 'medium' as const,
        color: 'text-purple-500 bg-purple-500/10'
    }
];

export default function TaskEditor({
    open,
    onOpenChange,
    task,
    onSave,
    isSaving,
    disableEntitySelect = false,
    preFilledEntityName
}: TaskEditorProps) {
    const { user: currentUser } = useUser();
    const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
    const firestore = useFirestore();
    const terminology = useTerminology();
    const entityName = terminology?.singular || 'Campus';
    const isCreating = !task?.id;
    const [selectedEntityName, setSelectedEntityName] = React.useState<string>(preFilledEntityName || '');
    const lastAutoSummaryRef = React.useRef<string>('');
    const isDescriptionManuallyEditedRef = React.useRef<boolean>(false);

    // 1: Template Selection, 2: Task Form Details
    const [activeStep, setActiveStep] = React.useState<number>(1);
    const [newNoteContent, setNewNoteContent] = React.useState('');
    const [checklist, setChecklist] = React.useState<TaskChecklistItem[]>([]);
    const [reminders, setReminders] = React.useState<TaskReminder[]>([]);

    // Fetch team members for assignment from canonical 'users' collection
    const userProfilesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        if (activeOrganizationId) {
            return query(
                collection(firestore, 'users'),
                where('organizationId', '==', activeOrganizationId),
                where('isAuthorized', '==', true),
                orderBy('name', 'asc')
            );
        }
        return query(
            collection(firestore, 'users'),
            where('isAuthorized', '==', true),
            orderBy('name', 'asc')
        );
    }, [firestore, activeOrganizationId]);

    const { data: userProfiles } = useCollection<UserProfile>(userProfilesQuery);

    const form = useForm<TaskFormValues>({
        resolver: zodResolver(taskSchema),
        defaultValues: {
            title: '',
            description: '',
            priority: 'medium',
            category: 'general',
            status: 'todo',
            assignedTo: [],
            entityId: '',
            entityType: undefined,
            startDate: new Date(),
            dueDate: new Date(),
            reminders: [],
            notes: [],
            attachments: [],
            relatedEntityType: null,
            relatedParentId: null,
            relatedEntityId: null,
            tagIds: [],
        }
    });

    const { register, control, handleSubmit, reset, setValue, getValues, watch } = form;

    const { fields: notes, append: appendNote, remove: removeNote } = useFieldArray({
        control,
        name: 'notes'
    });

    const { fields: attachments, append: appendAttachment, remove: removeAttachment } = useFieldArray({
        control,
        name: 'attachments'
    });

    // Re-render loop prevention: track initialization key
    const lastResetKeyRef = React.useRef<string | null>(null);

    // Synchronize selected entity display name when opened or preFilledEntityName/task changes
    React.useEffect(() => {
        if (!open) {
            setSelectedEntityName('');
            lastAutoSummaryRef.current = '';
            isDescriptionManuallyEditedRef.current = false;
            return;
        }

        if (preFilledEntityName) {
            setSelectedEntityName(preFilledEntityName);
        } else if (task && 'entityName' in task && typeof task.entityName === 'string' && task.entityName.trim()) {
            setSelectedEntityName(task.entityName.trim());
        } else if (task?.entityId && firestore) {
            let active = true;
            getDoc(doc(firestore, 'workspace_entities', task.entityId)).then((snap) => {
                if (active && snap.exists()) {
                    const data = snap.data() as { displayName?: string; name?: string };
                    const name = data.displayName || data.name || '';
                    if (name) setSelectedEntityName(name);
                }
            }).catch(() => {
                // Ignore background fetch error
            });
            return () => {
                active = false;
            };
        }
    }, [open, preFilledEntityName, task, firestore]);

    React.useEffect(() => {
        const normalizeAssignees = (val: unknown): string[] => {
            if (Array.isArray(val)) {
                return val.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
            }
            if (typeof val === 'string' && val.trim().length > 0) {
                return [val.trim()];
            }
            return [];
        };

        if (open) {
            const currentKey = task?.id ? `edit_${task.id}` : `new_${task?.category || 'default'}`;
            if (lastResetKeyRef.current !== currentKey) {
                lastResetKeyRef.current = currentKey;

                if (task) {
                    setChecklist(task.checklist || []);
                    setReminders(task.reminders || []);
                    if (task.id) {
                        isDescriptionManuallyEditedRef.current = true;
                        setActiveStep(2);
                        reset({
                            title: task.title || '',
                            description: task.description || '',
                            priority: task.priority || 'medium',
                            category: task.category || 'general',
                            status: task.status || 'todo',
                            assignedTo: normalizeAssignees(task.assignedTo),
                            entityId: task.entityId || '',
                            entityType: task.entityType || undefined,
                            startDate: safeParseDate(task.startDate) || undefined,
                            dueDate: safeParseDate(task.dueDate) || new Date(),
                            reminders: (task.reminders || []).map(r => ({
                                reminderTime: safeParseDate(r.reminderTime) || new Date(),
                                channels: r.channels,
                                sent: Boolean(r.sent)
                            })),
                            notes: task.notes || [],
                            attachments: task.attachments || [],
                            relatedEntityType: task.relatedEntityType || null,
                            relatedParentId: task.relatedParentId || null,
                            relatedEntityId: task.relatedEntityId || null,
                            tagIds: task.tagIds || [],
                        });
                    } else {
                        if (task.description) {
                            isDescriptionManuallyEditedRef.current = true;
                            lastAutoSummaryRef.current = task.description;
                        } else {
                            isDescriptionManuallyEditedRef.current = false;
                            lastAutoSummaryRef.current = '';
                        }
                        if (task.category) {
                            setActiveStep(2);
                            reset({
                                title: task.title || '',
                                description: task.description || '',
                                priority: task.priority || 'medium',
                                category: task.category,
                                status: task.status || 'todo',
                                assignedTo: normalizeAssignees(task.assignedTo || currentUser?.uid || ''),
                                entityId: task.entityId || '',
                                entityType: task.entityType || undefined,
                                startDate: safeParseDate(task.startDate) || new Date(),
                                dueDate: safeParseDate(task.dueDate) || new Date(),
                                reminders: [],
                                notes: [],
                                attachments: [],
                                relatedEntityType: null,
                                relatedParentId: null,
                                relatedEntityId: null,
                                tagIds: task.tagIds || [],
                            });
                        } else {
                            setActiveStep(1);
                            reset({
                                title: '', 
                                description: '', 
                                priority: 'medium', 
                                category: 'general', 
                                status: task.status || 'todo', 
                                assignedTo: currentUser?.uid ? [currentUser.uid] : [], 
                                entityId: task.entityId || '', 
                                entityType: task.entityType || undefined, 
                                startDate: safeParseDate(task.startDate) || new Date(), 
                                dueDate: safeParseDate(task.dueDate) || new Date(), 
                                reminders: [], 
                                notes: [], 
                                attachments: [], 
                                relatedEntityType: null, 
                                relatedParentId: null, 
                                relatedEntityId: null,
                                tagIds: task.tagIds || [],
                            });
                        }
                    }
                } else {
                    isDescriptionManuallyEditedRef.current = false;
                    lastAutoSummaryRef.current = '';
                    setChecklist([]);
                    setReminders([]);
                    setActiveStep(1);
                    reset({
                        title: '',
                        description: '',
                        priority: 'medium',
                        category: 'general',
                        status: 'todo',
                        assignedTo: currentUser?.uid ? [currentUser.uid] : [],
                        entityId: '',
                        entityType: undefined,
                        startDate: new Date(),
                        dueDate: new Date(),
                        reminders: [],
                        notes: [],
                        attachments: [],
                        relatedEntityType: null,
                        relatedParentId: null,
                        relatedEntityId: null,
                        tagIds: [],
                    });
                }
            }
        } else {
            lastResetKeyRef.current = null;
        }
    }, [open, task, reset, currentUser]);

    const watchedTitle = watch('title');
    const watchedStartDate = watch('startDate');
    const watchedDueDate = watch('dueDate');

    // Auto-prefill intelligent summary for task creation (time only, not date)
    React.useEffect(() => {
        // Only run when creating a task, dialog is open, and user has not typed custom description notes
        if (!isCreating || !open || isDescriptionManuallyEditedRef.current) {
            return;
        }

        const scheduledTime = watchedStartDate || watchedDueDate;
        const autoSummary = generateTaskBaseSummary({
            title: watchedTitle,
            entityName: selectedEntityName,
            time: scheduledTime,
        });

        if (!autoSummary) return;

        const currentDescription = getValues('description') || '';
        if (!currentDescription.trim() || currentDescription === lastAutoSummaryRef.current) {
            setValue('description', autoSummary, { shouldDirty: false, shouldValidate: false });
            lastAutoSummaryRef.current = autoSummary;
        }
    }, [isCreating, open, watchedTitle, watchedStartDate, watchedDueDate, selectedEntityName, setValue, getValues]);

    const handleAutoSummarize = () => {
        const scheduledTime = getValues('startDate') || getValues('dueDate');
        const summary = generateTaskBaseSummary({
            title: getValues('title'),
            entityName: selectedEntityName,
            time: scheduledTime,
        });
        if (summary) {
            setValue('description', summary, { shouldDirty: true, shouldValidate: true });
            lastAutoSummaryRef.current = summary;
            isDescriptionManuallyEditedRef.current = false;
        }
    };



    const handleSelectPreset = (preset: typeof PRESET_TEMPLATES[number]) => {
        setValue('category', preset.category);
        setValue('title', preset.defaultTitle);
        setValue('priority', preset.defaultPriority);
        setActiveStep(2);
    };

    const handleStartFromScratch = () => {
        setValue('category', 'general');
        setValue('title', '');
        setValue('priority', 'medium');
        setActiveStep(2);
    };

    const handleAddNote = () => {
        if (!newNoteContent.trim() || !currentUser) return;
        appendNote({
            id: `note_${Date.now()}`,
            content: newNoteContent.trim(),
            createdAt: new Date().toISOString(),
            authorName: currentUser.displayName || 'System'
        });
        setNewNoteContent('');
    };

    const handleAddAttachment = (url: string) => {
        if (!url) return;
        const fileName = url.split('/').pop()?.split('?')[0] || 'document';
        const decodedName = decodeURIComponent(fileName).substring(fileName.indexOf('-') + 1);
        appendAttachment({
            id: `att_${Date.now()}`,
            name: decodedName,
            url,
            type: 'document',
            createdAt: new Date().toISOString()
        });
    };

    const onSubmit = async (data: TaskFormValues) => {
        const payload: TaskSavePayload = {
            ...data,
            entityId: data.entityId === 'none' ? '' : data.entityId,
            entityType: data.entityType,
            workspaceId: activeWorkspaceId, 
            startDate: data.startDate?.toISOString(),
            dueDate: data.dueDate.toISOString(),
            reminders: reminders.length > 0
                ? reminders
                : data.reminders.map(r => ({ ...r, reminderTime: r.reminderTime.toISOString() })),
            checklist,
            tagIds: data.tagIds || [],
            reminderSent: false,
        };
        await onSave(payload);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                "sm:max-w-3xl flex flex-col p-0 overflow-hidden border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl transition-all duration-300 ease-in-out font-figtree",
                activeStep === 1 ? "h-fit max-h-[90vh]" : "h-[90vh]"
            )}>
                {activeStep === 1 ? (
                    <div className="flex flex-col h-full bg-card">
                        <DialogHeader demarcated>
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-600/10 text-blue-600 rounded-xl">
                                    <Layout className="h-5 w-5" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <DialogTitle className="text-lg font-bold text-foreground">Select a Task Template</DialogTitle>
                                    <CardInfoTooltip text="Choose a pre-configured template or start from scratch to initialize your task." />
                                </div>
                            </div>
                            <DialogDescription className="sr-only">Choose a pre-configured template or start from scratch.</DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-card">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {PRESET_TEMPLATES.map((preset) => {
                                    const Icon = preset.icon;
                                    return (
                                         <button
                                             key={preset.id}
                                             type="button"
                                             onClick={() => handleSelectPreset(preset)}
                                             className="group flex flex-row items-center gap-4 text-left p-4 rounded-xl border border-border bg-background hover:border-primary/40 transition-all shadow-xs hover:shadow-md active:scale-[0.98] w-full min-w-0"
                                         >
                                             <div className={cn("p-3 rounded-xl transition-transform group-hover:scale-105 shadow-inner shrink-0", preset.color)}>
                                                 <Icon className="h-5 w-5" />
                                             </div>
                                             <div className="flex flex-col min-w-0">
                                                 <span className="font-bold text-sm text-foreground tracking-tight mb-0.5">{preset.title}</span>
                                                 <span className="text-[11px] text-muted-foreground font-medium line-clamp-2 leading-snug">{preset.description}</span>
                                             </div>
                                         </button>
                                    );
                                })}
                            </div>
                        </div>

                        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className="rounded-xl font-semibold h-11 min-h-[44px] px-6 active:scale-[0.97]"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleStartFromScratch}
                                className="rounded-xl font-semibold h-11 min-h-[44px] px-8 bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.97]"
                            >
                                Start From Scratch
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full text-left bg-card">
                        <DialogHeader demarcated>
                            <div className="flex items-center gap-3">
                                {(!task || !task.id) && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setActiveStep(1)}
                                        className="h-9 w-9 p-0 rounded-xl border border-border bg-background text-muted-foreground hover:bg-muted/30 hover:text-foreground active:scale-[0.97]"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                )}
                                <div className="p-2.5 bg-blue-600/10 text-blue-600 rounded-xl">
                                    <Layout className="h-5 w-5" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <DialogTitle className="text-lg font-bold text-foreground">
                                        {task?.id ? 'Edit Task Details' : 'Configure Task Details'}
                                    </DialogTitle>
                                    <CardInfoTooltip text="Specify title, owners, schedule, context, and organizational tags." />
                                </div>
                            </div>
                            <DialogDescription className="sr-only">Fill in the fields below to customize your task.</DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-hidden bg-card text-left">
                            <ScrollArea className="h-full text-left">
                                <div className="p-6 sm:p-8 space-y-6 sm:space-y-8 text-left">
                                    {/* 1. Required Dominant Field: Title (PRD §31 & Roadmap §32) */}
                                    <div className="space-y-2 text-left">
                                        <Label className="text-xs font-semibold text-foreground/90 ml-1 text-left">Task Title</Label>
                                        <Input 
                                            {...register('title')} 
                                            placeholder="What needs to be done?" 
                                            className="h-12 min-h-[44px] rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/45 focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary font-bold px-4 text-left" 
                                        />
                                    </div>

                                    {/* 2. Work: Urgency & Status */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                        <div className="space-y-2 text-left">
                                            <Label className="text-xs font-semibold text-foreground/90 ml-1 text-left">Priority</Label>
                                            <Controller name="priority" control={control} render={({ field }) => (
                                                <div className="grid grid-cols-4 gap-1.5 bg-background p-1.5 rounded-xl border border-border text-left">
                                                    {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
                                                        <button
                                                            key={p}
                                                            type="button"
                                                            onClick={() => field.onChange(p)}
                                                            className={cn(
                                                                "h-10 min-h-[40px] rounded-lg font-bold text-[9px] capitalize transition-all text-center px-1 active:scale-[0.97]",
                                                                field.value === p
                                                                    ? (p === 'low' ? "bg-emerald-600 text-white shadow-xs"
                                                                       : p === 'medium' ? "bg-blue-600 text-white shadow-xs"
                                                                       : p === 'high' ? "bg-orange-500 text-white shadow-xs"
                                                                       : "bg-rose-600 text-white shadow-xs")
                                                                    : (p === 'low' ? "text-emerald-500/70 hover:text-emerald-500 hover:bg-emerald-500/10"
                                                                       : p === 'medium' ? "text-blue-500/70 hover:text-blue-500 hover:bg-blue-500/10"
                                                                       : p === 'high' ? "text-orange-500/70 hover:text-orange-500 hover:bg-orange-500/10"
                                                                       : "text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10")
                                                            )}
                                                        >
                                                            {p}
                                                        </button>
                                                    ))}
                                                </div>
                                            )} />
                                        </div>
                                        <div className="space-y-2 text-left">
                                            <Label className="text-xs font-semibold text-foreground/90 ml-1 text-left">Status</Label>
                                            <Controller name="status" control={control} render={({ field }) => (
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger className="h-11 min-h-[44px] rounded-xl bg-background border border-border text-foreground font-semibold focus:ring-2 focus:ring-primary focus:border-primary text-left">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border border-border bg-card text-foreground shadow-2xl text-left">
                                                        <SelectItem value="todo" className="font-semibold text-left">To Do</SelectItem>
                                                        <SelectItem value="in_progress" className="font-semibold text-blue-500 text-left">In Progress</SelectItem>
                                                        <SelectItem value="waiting" className="font-semibold text-orange-500 text-left">Waiting</SelectItem>
                                                        <SelectItem value="review" className="font-semibold text-purple-500 text-left">Under Review</SelectItem>
                                                        <SelectItem value="done" className="font-semibold text-emerald-500 text-left">Completed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )} />
                                        </div>
                                    </div>

                                    {/* 3. Assigned Owners & Context Link */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                        <div className="space-y-2 text-left">
                                            <Label className="text-xs font-semibold text-foreground/90 ml-1 flex items-center gap-2 text-left">
                                                <User className="h-3.5 w-3.5 text-muted-foreground" /> Assigned Owners
                                            </Label>
                                            <Controller name="assignedTo" control={control} render={({ field }) => {
                                                const selectedUsers = userProfiles?.filter(u => field.value?.includes(u.id)) || [];
                                                return (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <div className="min-h-[44px] p-2 bg-background border border-border rounded-xl cursor-pointer hover:border-primary/50 transition-all flex items-center gap-2 flex-wrap text-left">
                                                                {selectedUsers.length > 0 ? (
                                                                    selectedUsers.map(user => (
                                                                        <Badge key={user.id} variant="secondary" className="gap-1.5 py-1 px-2 rounded-lg bg-muted text-foreground">
                                                                            <Avatar className="h-4 w-4">
                                                                                <AvatarImage src={user.photoURL || undefined} />
                                                                                <AvatarFallback className="text-[8px]">{getInitials(user.name || user.displayName)}</AvatarFallback>
                                                                            </Avatar>
                                                                            <span className="text-xs font-medium">{user.name || user.displayName}</span>
                                                                            <X 
                                                                                className="h-3 w-3 hover:text-rose-500 cursor-pointer" 
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    field.onChange(field.value.filter(id => id !== user.id));
                                                                                }}
                                                                            />
                                                                        </Badge>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground font-medium pl-2">Assign team members...</span>
                                                                )}
                                                            </div>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-64 p-2 bg-card border-border rounded-xl shadow-xl">
                                                            <div className="space-y-1">
                                                                {userProfiles?.map(u => {
                                                                    const isSelected = field.value?.includes(u.id);
                                                                    const displayNameStr = u.name || u.displayName || u.email || 'Team Member';
                                                                    return (
                                                                        <div 
                                                                            key={u.id}
                                                                            onClick={() => {
                                                                                const next = isSelected 
                                                                                    ? field.value.filter(id => id !== u.id)
                                                                                    : [...(field.value || []), u.id];
                                                                                field.onChange(next);
                                                                            }}
                                                                            className={cn(
                                                                                "flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-xs font-semibold",
                                                                                isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                                                            )}
                                                                        >
                                                                            <Avatar className="h-6 w-6">
                                                                                <AvatarImage src={u.photoURL || undefined} />
                                                                                <AvatarFallback className="text-[10px]">{getInitials(displayNameStr)}</AvatarFallback>
                                                                            </Avatar>
                                                                            <span className="truncate flex-1">{displayNameStr}</span>
                                                                            {isSelected && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                );
                                            }} />
                                        </div>

                                        <div className="space-y-2 text-left">
                                            <Label className="text-xs font-semibold text-foreground/90 ml-1 flex items-center gap-2 text-left">
                                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Link to {entityName}
                                            </Label>
                                            <Controller 
                                                name="entityId" 
                                                control={control} 
                                                render={({ field }) => (
                                                    <EntityCombobox
                                                        value={field.value || ''}
                                                        onChange={(id, details) => {
                                                            field.onChange(id);
                                                            if (details?.entityType) {
                                                                setValue('entityType', details.entityType);
                                                            }
                                                            const entityLabel = details?.displayName || '';
                                                            if (entityLabel) {
                                                                setSelectedEntityName(entityLabel);
                                                            } else if (!id || id === 'none') {
                                                                setSelectedEntityName('');
                                                            }
                                                        }}
                                                        disabled={disableEntitySelect}
                                                        placeholder={preFilledEntityName ? preFilledEntityName : `Search or select ${entityName.toLowerCase()}...`}
                                                        className="h-11 min-h-[44px] rounded-xl bg-background border border-border text-foreground font-semibold"
                                                    />
                                                )} 
                                            />
                                        </div>
                                    </div>

                                    {/* 4. Schedule: Starts On & Due Date */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                        <div className="space-y-2 text-left">
                                            <Label className="text-xs font-semibold text-foreground/90 ml-1 flex items-center gap-2 text-left">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Starts On
                                            </Label>
                                            <Controller name="startDate" control={control} render={({ field }) => (
                                                <DateTimePicker 
                                                    value={field.value} 
                                                    onChange={(date) => {
                                                        field.onChange(date);
                                                        if (date) {
                                                            setValue('dueDate', new Date(date.getTime() + 60 * 60 * 1000));
                                                        }
                                                    }} 
                                                    variant="ghost" 
                                                    className="h-11 min-h-[44px] rounded-xl bg-background border border-border text-foreground font-semibold hover:bg-muted/10 px-4" 
                                                />
                                            )} />
                                        </div>
                                        <div className="space-y-2 text-left">
                                            <Label className="text-xs font-semibold text-foreground/90 ml-1 flex items-center gap-2 text-left">
                                                <Target className="h-3.5 w-3.5 text-muted-foreground" /> Due Date
                                            </Label>
                                            <Controller name="dueDate" control={control} render={({ field }) => (
                                                <DateTimePicker 
                                                    value={field.value} 
                                                    onChange={field.onChange} 
                                                    variant="ghost" 
                                                    className="h-11 min-h-[44px] rounded-xl bg-background border border-border text-foreground font-semibold hover:bg-muted/10 px-4" 
                                                />
                                            )} />
                                        </div>
                                    </div>

                                    {/* 5. Organization: Standardized TagSelector in Client/Draft Mode (Rule 69 Single Source of Truth) */}
                                    <div className="space-y-2 text-left">
                                        <Label className="text-xs font-semibold text-foreground/90 ml-1 text-left">Workspace Tags</Label>
                                        <Controller
                                            name="tagIds"
                                            control={control}
                                            render={({ field }) => (
                                                <TagSelector
                                                    currentTagIds={field.value || []}
                                                    onTagsChange={(newTagIds) => field.onChange(newTagIds)}
                                                />
                                            )}
                                        />
                                    </div>

                                    {/* 6. Details: Description & Background Context */}
                                    <div className="space-y-2 text-left">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold text-foreground/90 ml-1 text-left">Task Details</Label>
                                            {isCreating && (
                                                <button
                                                    type="button"
                                                    onClick={handleAutoSummarize}
                                                    className="text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors px-2 py-0.5 rounded-md hover:bg-primary/10 active:scale-[0.97]"
                                                    title="Summarize task name, target institution, and time"
                                                >
                                                    <Sparkles className="h-3 w-3" />
                                                    <span>Auto-summarize</span>
                                                </button>
                                            )}
                                        </div>
                                        <Textarea 
                                            {...register('description', {
                                                onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                                    if (e.target.value !== lastAutoSummaryRef.current) {
                                                        isDescriptionManuallyEditedRef.current = true;
                                                    }
                                                }
                                            })} 
                                            placeholder="Provide additional details or background context..." 
                                            className="min-h-[90px] rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/45 focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary p-4 font-medium leading-relaxed text-left text-xs" 
                                        />
                                    </div>

                                    <Separator className="border-border" />

                                    {/* 7. Checklist */}
                                    <div className="space-y-2 text-left">
                                        <TaskChecklist
                                            items={checklist}
                                            onChange={setChecklist}
                                            currentUserId={currentUser?.uid}
                                        />
                                    </div>

                                    <Separator className="border-border/60" />

                                    {/* 8. Reminders */}
                                    <div className="space-y-2 text-left">
                                        <TaskRemindersEditor
                                            reminders={reminders}
                                            onChange={setReminders}
                                            taskDueDate={form.watch('dueDate')?.toISOString()}
                                            onRetryReminder={(reminderId) => {
                                                setReminders(prev => prev.map(r => r.id === reminderId ? { ...r, status: 'scheduled', error: null } : r));
                                            }}
                                        />
                                    </div>

                                    <Separator className="border-border" />

                                    {/* 9. Notes & Attachments */}
                                    <div className="space-y-6 text-left">
                                        {/* Attached Files */}
                                        <div className="space-y-3 text-left">
                                            <div className="flex items-center justify-between px-1 text-left">
                                                <div className="flex items-center gap-2 text-left">
                                                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                                                    <h4 className="text-xs font-semibold text-foreground/90 text-left">Attached Files</h4>
                                                </div>
                                                <Badge variant="secondary" className="bg-background border border-border text-muted-foreground">{attachments.length}</Badge>
                                            </div>
                                            <div className="p-1.5 rounded-2xl bg-background border-2 border-dashed border-border flex items-center justify-center text-left">
                                                <MediaSelect onValueChange={handleAddAttachment} className="border-none shadow-none bg-transparent text-muted-foreground" />
                                            </div>
                                            <div className="space-y-2 text-left">
                                                {attachments.map((att, idx) => (
                                                    <div key={att.id} className="flex items-center justify-between p-3 rounded-xl bg-background border border-border shadow-xs group text-left">
                                                        <div className="flex items-center gap-3 min-w-0 text-left">
                                                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-muted-foreground truncate hover:underline text-left">{att.name}</a>
                                                        </div>
                                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg text-left" onClick={() => removeAttachment(idx)}>
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Notes & Comments */}
                                        <div className="space-y-3 text-left">
                                            <div className="flex items-center justify-between px-1 text-left">
                                                <div className="flex items-center gap-2 text-left">
                                                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                                                    <h4 className="text-xs font-semibold text-foreground/90 text-left">Notes & Comments</h4>
                                                </div>
                                                <Badge variant="secondary" className="bg-background border border-border text-muted-foreground">{notes.length}</Badge>
                                            </div>
                                            <div className="flex gap-2 text-left">
                                                <Textarea value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)} placeholder="Type a note..." className="min-h-[70px] rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/45 text-xs text-left" />
                                                <Button type="button" onClick={handleAddNote} disabled={!newNoteContent.trim()} size="icon" className="h-auto w-12 rounded-xl shrink-0 bg-blue-600 text-white hover:bg-blue-700 shadow-md text-left active:scale-[0.97]">
                                                    <Plus className="h-5 w-5" />
                                                </Button>
                                            </div>
                                            <div className="space-y-2 text-left">
                                                {notes.map((note, idx) => (
                                                    <div key={note.id} className="p-3 rounded-xl bg-background border border-border relative group/note text-left">
                                                        <div className="flex items-center justify-between mb-1 text-left">
                                                            <p className="text-[9px] font-semibold text-muted-foreground text-left">{note.authorName} · {formatTaskDate(note.createdAt, 'MMM d')}</p>
                                                            <button type="button" onClick={() => removeNote(idx)} className="opacity-0 group-hover/note:opacity-100 transition-opacity text-rose-500 text-left">
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                        <p className="text-xs font-medium text-foreground text-left">{note.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>

                        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => onOpenChange(false)} 
                                className="rounded-xl font-semibold h-11 min-h-[44px] px-6 active:scale-[0.97]"
                            >
                                Discard
                            </Button>
                            {task?.id && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={async () => {
                                        const currentStatus = form.getValues('status');
                                        const newStatus = currentStatus === 'done' ? 'todo' : 'done';
                                        setValue('status', newStatus);
                                        handleSubmit(onSubmit)();
                                    }}
                                    className="rounded-xl font-semibold h-11 min-h-[44px] px-5 border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/30 active:scale-[0.97]"
                                >
                                    {form.watch('status') === 'done' ? 'Reopen Task' : 'Mark Completed'}
                                </Button>
                            )}
                            <Button 
                                type="submit" 
                                disabled={isSaving} 
                                className="rounded-xl font-semibold h-11 min-h-[44px] px-8 bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.97] text-xs gap-2"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {task?.id ? 'Save Changes' : 'Create Task'}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
