'use client';

import * as React from 'react';
import { useForm, Controller, useWatch, useFieldArray } from 'react-hook-form';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
    Loader2, 
    Save, 
    CheckCircle2, 
    Clock, 
    AlertTriangle, 
    ShieldAlert, 
    User, 
    Building2, 
    Zap,
    Plus,
    Link as LinkIcon,
    ClipboardList,
    FileText,
    Target,
    Bell,
    Mail,
    Smartphone,
    X,
    Calendar,
    Layout,
    StickyNote,
    Paperclip,
    Trash2,
    PlusCircle,
    Phone,
    MapPin,
    GraduationCap,
    ChevronLeft,
    ChevronDown
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, orderBy, query, where, limit } from 'firebase/firestore';
import type { Task, UserProfile, WorkspaceEntity, TaskPriority, TaskCategory, Survey, PDFForm, SurveyResponse, Submission, TaskReminder, TaskNote, TaskAttachment } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { EntityCombobox } from '@/components/entities/EntityCombobox';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { MediaSelect } from '../../entities/components/media-select';
import { useTerminology } from '@/hooks/use-terminology';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const getInitials = (name?: string | null) =>
  name ? name.split(' ').map((n) => n[0]).join('').toUpperCase() : '?';

const taskSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters.'),
    description: z.string().min(5, 'Description is required.'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    category: z.enum(['call', 'visit', 'document', 'training', 'follow_up', 'general']),
    status: z.enum(['todo', 'in_progress', 'waiting', 'review', 'done']),
    assignedTo: z.array(z.string()).min(1, 'Please assign at least one owner.'),
    entityId: z.string().optional(),
    entityType: z.enum(['institution', 'family', 'person', 'School']).optional(),
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
    relatedEntityType: z.enum(['SurveyResponse', 'Submission', 'Meeting', 'School', 'Deal']).optional().nullable(),
    relatedParentId: z.string().optional().nullable(),
    relatedEntityId: z.string().optional().nullable(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task?: Task | null;
    onSave: (data: any) => Promise<void>;
    isSaving: boolean;
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
        defaultPriority: 'high' as const,
        color: 'text-purple-500 bg-purple-500/10'
    },
    {
        id: 'follow_up',
        title: 'Follow Up',
        description: 'Send follow-up messages or check progress feedback.',
        icon: Clock,
        category: 'follow_up' as const,
        defaultTitle: 'Follow Up',
        defaultPriority: 'medium' as const,
        color: 'text-indigo-500 bg-indigo-500/10'
    },
    {
        id: 'general',
        title: 'General Task',
        description: 'Standard checklist item with custom settings.',
        icon: CheckCircle2,
        category: 'general' as const,
        defaultTitle: 'New Task',
        defaultPriority: 'medium' as const,
        color: 'text-slate-500 bg-muted/10'
    }
];

export default function TaskEditor({ open, onOpenChange, task, onSave, isSaving }: TaskEditorProps) {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
    const { singular, plural } = useTerminology();

    const [activeStep, setActiveStep] = React.useState<1 | 2>(1);
    
    const usersQuery = useMemoFirebase(() => 
        open && firestore && activeOrganizationId ? query(
            collection(firestore, 'users'), 
            where('organizationId', '==', activeOrganizationId),
            where('isAuthorized', '==', true), 
            orderBy('name')
        ) : null, 
    [open, firestore, activeOrganizationId]);
    

    const surveysQuery = useMemoFirebase(() => {
        if (!open || !firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'surveys'), where('workspaceIds', 'array-contains', activeWorkspaceId), where('status', '==', 'published'));
    }, [open, firestore, activeWorkspaceId]);

    const pdfsQuery = useMemoFirebase(() => {
        if (!open || !firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'pdfs'), where('workspaceIds', 'array-contains', activeWorkspaceId), where('status', '==', 'published'));
    }, [open, firestore, activeWorkspaceId]);
    
    const { data: users } = useCollection<UserProfile>(usersQuery);
    const workspaceUsers = React.useMemo(() => {
        if (!users || !activeWorkspaceId) return [];
        return users.filter(u => u.workspaceIds?.includes(activeWorkspaceId));
    }, [users, activeWorkspaceId]);
    const { data: surveys } = useCollection<Survey>(surveysQuery);
    const { data: pdfs } = useCollection<PDFForm>(pdfsQuery);

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
        }
    });

    const { register, handleSubmit, control, reset, setValue } = form;
    
    const { fields: reminders, append: appendReminder, remove: removeReminder } = useFieldArray({ control, name: 'reminders' });
    const { fields: notes, append: appendNote, remove: removeNote } = useFieldArray({ control, name: 'notes' });
    const { fields: attachments, append: appendAttachment, remove: removeAttachment } = useFieldArray({ control, name: 'attachments' });

    const [newNoteContent, setNewNoteContent] = React.useState('');
    const watchedEntityType = useWatch({ control, name: 'relatedEntityType' });
    const watchedParentId = useWatch({ control, name: 'relatedParentId' });

    const responsesQuery = useMemoFirebase(() => {
        if (!open || !firestore || watchedEntityType !== 'SurveyResponse' || !watchedParentId) return null;
        return query(collection(firestore, `surveys/${watchedParentId}/responses`), orderBy('submittedAt', 'desc'), limit(50));
    }, [open, firestore, watchedEntityType, watchedParentId]);

    const submissionsQuery = useMemoFirebase(() => {
        if (!open || !firestore || watchedEntityType !== 'Submission' || !watchedParentId) return null;
        return query(collection(firestore, `pdfs/${watchedParentId}/submissions`), orderBy('submittedAt', 'desc'), limit(50));
    }, [open, firestore, watchedEntityType, watchedParentId]);

    const { data: responses } = useCollection<SurveyResponse>(responsesQuery);
    const { data: submissions } = useCollection<Submission>(submissionsQuery);

    React.useEffect(() => {
        const normalizeAssignees = (val: any): string[] => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            return [val];
        };

        if (open) {
            if (task) {
                if (task.id) {
                    setActiveStep(2);
                    reset({
                        title: task.title,
                        description: task.description,
                        priority: task.priority,
                        category: task.category,
                        status: task.status,
                        assignedTo: normalizeAssignees(task.assignedTo),
                        entityId: task.entityId || '',
                        entityType: (task.entityType as any) || undefined,
                        startDate: task.startDate ? new Date(task.startDate) : undefined,
                        dueDate: new Date(task.dueDate),
                        reminders: (task.reminders || []).map(r => ({ ...r, reminderTime: new Date(r.reminderTime) })),
                        notes: task.notes || [],
                        attachments: task.attachments || [],
                        relatedEntityType: task.relatedEntityType || null,
                        relatedParentId: task.relatedParentId || null,
                        relatedEntityId: task.relatedEntityId || null,
                    });
                } else {
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
                            entityType: (task.entityType as any) || undefined,
                            startDate: task.startDate ? new Date(task.startDate) : new Date(),
                            dueDate: task.dueDate ? new Date(task.dueDate) : new Date(),
                            reminders: [],
                            notes: [],
                            attachments: [],
                            relatedEntityType: null,
                            relatedParentId: null,
                            relatedEntityId: null,
                        });
                    } else {
                        setActiveStep(1);
                        reset({
                            title: '', description: '', priority: 'medium', category: 'general', status: task.status || 'todo', assignedTo: currentUser?.uid ? [currentUser.uid] : [], entityId: '', entityType: undefined, startDate: task.startDate ? new Date(task.startDate) : new Date(), dueDate: task.dueDate ? new Date(task.dueDate) : new Date(), reminders: [], notes: [], attachments: [], relatedEntityType: null, relatedParentId: null, relatedEntityId: null,
                        });
                    }
                }
            } else {
                setActiveStep(1);
                reset({
                    title: '', description: '', priority: 'medium', category: 'general', status: 'todo', assignedTo: currentUser?.uid ? [currentUser.uid] : [], entityId: '', entityType: undefined, startDate: new Date(), dueDate: new Date(), reminders: [], notes: [], attachments: [], relatedEntityType: null, relatedParentId: null, relatedEntityId: null,
                });
            }
        }
    }, [open, task, reset, currentUser]);

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
        appendNote({ id: `note_${Date.now()}`, content: newNoteContent.trim(), createdAt: new Date().toISOString(), authorName: currentUser.displayName || 'System' });
        setNewNoteContent('');
    };

    const handleAddAttachment = (url: string) => {
        if (!url) return;
        const fileName = url.split('/').pop()?.split('?')[0] || 'document';
        const decodedName = decodeURIComponent(fileName).substring(fileName.indexOf('-') + 1);
        appendAttachment({ id: `att_${Date.now()}`, name: decodedName, url, type: 'document', createdAt: new Date().toISOString() });
    };

    const onSubmit = async (data: TaskFormValues) => {
        const payload = {
            ...data,
            entityId: data.entityId === 'none' ? '' : data.entityId,
            workspaceId: activeWorkspaceId, 
            startDate: data.startDate?.toISOString(),
            dueDate: data.dueDate.toISOString(),
            reminders: data.reminders.map(r => ({ ...r, reminderTime: r.reminderTime.toISOString() }))
        };
        await onSave(payload);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                "sm:max-w-3xl flex flex-col p-0 overflow-hidden border border-border shadow-2xl text-left bg-card transition-all duration-300 ease-in-out",
                activeStep === 1 ? "h-fit max-h-[90vh]" : "h-[90vh]"
            )}>
                {activeStep === 1 ? (
                    <div className="flex flex-col h-full bg-card">
                        <DialogHeader className="p-8 bg-card border-b border-border shrink-0 text-left">
                            <div className="flex items-center gap-4 text-left">
                                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-primary/20">
                                    <Layout className="h-6 w-6" />
                                </div>
                                <div className="text-left">
                                    <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground text-left">Select a Task Template</DialogTitle>
                                    <DialogDescription className="text-xs font-bold text-muted-foreground text-left">
                                        Choose a pre-configured template or start from scratch.
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-8 bg-card">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {PRESET_TEMPLATES.map((preset) => {
                                    const Icon = preset.icon;
                                    return (
                                         <button
                                             key={preset.id}
                                             type="button"
                                             onClick={() => handleSelectPreset(preset)}
                                             className="group flex flex-row items-center gap-4 text-left p-4 rounded-xl border border-border bg-background hover:border-primary/40 transition-all shadow-sm hover:shadow-md active:scale-[0.98] w-full min-w-0"
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

                        <DialogFooter className="bg-card p-8 border-t border-border shrink-0 flex justify-between items-center text-left">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="font-bold text-muted-foreground hover:text-foreground rounded-xl h-12 px-10 text-left">Cancel</Button>
                            <Button type="button" onClick={handleStartFromScratch} className="rounded-xl font-bold h-14 px-16 shadow-2xl bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all text-sm text-left">
                                Start From Scratch
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full text-left bg-card">
                        <DialogHeader className="p-8 bg-card border-b border-border shrink-0 text-left">
                            <div className="flex items-center gap-4 text-left">
                                {(!task || !task.id) && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setActiveStep(1)}
                                        className="h-10 w-10 p-0 rounded-xl border border-border bg-background text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                )}
                                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-primary/20">
                                    <Layout className="h-6 w-6" />
                                </div>
                                <div className="text-left">
                                    <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground text-left">
                                        {task?.id ? 'Edit Task Details' : 'Configure Task Details'}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold text-muted-foreground text-left">
                                        Fill in the fields below to customize your task.
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-hidden bg-card text-left">
                            <ScrollArea className="h-full text-left">
                                <div className="p-8 space-y-8 text-left">
                                    {/* Task Title */}
                                    <div className="space-y-2 text-left">
                                        <Label className="text-xs font-semibold text-foreground/90 ml-1 text-left">Task Title</Label>
                                        <Input {...register('title')} placeholder="Describe what needs to be done..." className="h-14 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/45 focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary font-bold px-6 text-left" />
                                    </div>

                                    {/* Urgency & Status */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                        <div className="space-y-2 text-left">
                                            <Label className="text-xs font-semibold text-foreground/90 ml-1 text-left">How Urgent Is This?</Label>
                                            <Controller name="priority" control={control} render={({ field }) => (
                                                <div className="grid grid-cols-4 gap-1.5 bg-background p-1.5 rounded-xl border border-border text-left">
                                                    {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
                                                        <button
                                                            key={p}
                                                            type="button"
                                                            onClick={() => field.onChange(p)}
                                                            className={cn(
                                                                "h-10 rounded-lg font-bold text-[9px] capitalize transition-all text-center px-1",
                                                                field.value === p
                                                                    ? (p === 'low' ? "bg-emerald-600 text-white shadow-md"
                                                                       : p === 'medium' ? "bg-blue-600 text-white shadow-md"
                                                                       : p === 'high' ? "bg-orange-500 text-white shadow-md"
                                                                       : "bg-rose-600 text-white shadow-md")
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
                                                    <SelectTrigger className="h-12 rounded-xl bg-background border border-border text-foreground font-bold focus:ring-2 focus:ring-primary focus:border-primary text-left">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border border-border bg-card text-foreground shadow-2xl text-left">
                                                        <SelectItem value="todo" className="font-bold text-left">To Do</SelectItem>
                                                        <SelectItem value="in_progress" className="font-bold text-blue-500 text-left">In Progress</SelectItem>
                                                        <SelectItem value="waiting" className="font-bold text-orange-500 text-left">Waiting</SelectItem>
                                                        <SelectItem value="review" className="font-bold text-purple-500 text-left">Under Review</SelectItem>
                                                        <SelectItem value="done" className="font-bold text-emerald-500 text-left">Completed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )} />
                                        </div>
                                    </div>

                                    {/* Assigned Owners & Link to Campus */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                        <div className="space-y-2 text-left">
                                            <Label className="text-xs font-semibold text-foreground/90 ml-1 flex items-center gap-2 text-left"><User className="h-3.5 w-3.5 text-muted-foreground" /> Assigned Owners</Label>
                                            <Controller name="assignedTo" control={control} render={({ field }) => {
                                                const value = Array.isArray(field.value) ? field.value : (field.value ? [field.value] : []);
                                                const selectedUsers = workspaceUsers.filter(u => value.includes(u.id));
                                                return (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button 
                                                                type="button"
                                                                variant="outline"
                                                                className="w-full h-12 rounded-xl bg-background border border-border text-foreground font-bold hover:bg-muted/10 justify-between items-center px-4"
                                                            >
                                                                <span className="truncate">
                                                                    {selectedUsers.length > 0 
                                                                        ? selectedUsers.map(u => u.name).join(', ') 
                                                                        : 'Assign to teammates...'}
                                                                </span>
                                                                <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[300px] rounded-xl border border-border bg-card text-foreground p-2 shadow-2xl text-left">
                                                            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                                                {workspaceUsers && workspaceUsers.length > 0 ? (
                                                                    workspaceUsers.map(u => {
                                                                        const isChecked = value.includes(u.id);
                                                                        return (
                                                                            <div 
                                                                                key={u.id}
                                                                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 cursor-pointer select-none"
                                                                                onClick={() => {
                                                                                    const nextValue = isChecked
                                                                                        ? value.filter(id => id !== u.id)
                                                                                        : [...value, u.id];
                                                                                    field.onChange(nextValue);
                                                                                }}
                                                                            >
                                                                                <Checkbox 
                                                                                    checked={isChecked}
                                                                                    onCheckedChange={() => {}}
                                                                                    className="h-4.5 w-4.5 rounded-md border-border"
                                                                                />
                                                                                <div className="flex items-center gap-2">
                                                                                    <Avatar className="h-5 w-5">
                                                                                        <AvatarImage src={u.photoURL || undefined} />
                                                                                        <AvatarFallback className="text-[10px] bg-muted/40 font-bold">{getInitials(u.name)}</AvatarFallback>
                                                                                    </Avatar>
                                                                                    <span className="text-xs font-semibold">{u.name}</span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <div className="text-center py-4 text-xs text-muted-foreground">No teammates found</div>
                                                                )}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                );
                                            }} />
                                        </div>
                                        <div className="space-y-2 text-left">
                                            <Label className="text-xs font-semibold text-foreground/90 ml-1 flex items-center gap-2 text-left"><Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Link to {singular}</Label>
                                            <Controller name="entityId" control={control} render={({ field }) => (
                                                <EntityCombobox
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="General (Unlinked)"
                                                    noneLabel="General / Unlinked"
                                                />
                                            )} />
                                        </div>
                                    </div>

                                    {/* Starts On & Due Date */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                        <div className="space-y-2 text-left">
                                            <Label className="text-xs font-semibold text-foreground/90 ml-1 flex items-center gap-2 text-left"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Starts On</Label>
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
                                                    className="h-12 rounded-xl bg-background border border-border text-foreground font-bold hover:bg-muted/10 px-4" 
                                                />
                                            )} />
                                        </div>
                                        <div className="space-y-2 text-left">
                                            <Label className="text-xs font-semibold text-foreground/90 ml-1 flex items-center gap-2 text-left"><Target className="h-3.5 w-3.5 text-muted-foreground" /> Due Date</Label>
                                            <Controller name="dueDate" control={control} render={({ field }) => (
                                                <DateTimePicker value={field.value} onChange={field.onChange} variant="ghost" className="h-12 rounded-xl bg-background border border-border text-foreground font-bold hover:bg-muted/10 px-4" />
                                            )} />
                                        </div>
                                    </div>

                                    {/* Task Details & Notes (At the bottom) */}
                                    <div className="space-y-2 text-left">
                                        <Label className="text-xs font-semibold text-foreground/90 ml-1 text-left">Task Details & Notes</Label>
                                        <Textarea {...register('description')} placeholder="Provide any additional details or background context..." className="min-h-[100px] rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/45 focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary p-6 font-medium leading-relaxed text-left" />
                                    </div>

                                    <Separator className="border-border" />

                                    <div className="space-y-8 text-left">
                                        {/* Attached Files */}
                                        <div className="space-y-4 text-left">
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
                                                    <div key={att.id} className="flex items-center justify-between p-3 rounded-xl bg-background border border-border shadow-sm group text-left">
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
                                        <div className="space-y-4 text-left">
                                            <div className="flex items-center justify-between px-1 text-left">
                                                <div className="flex items-center gap-2 text-left">
                                                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                                                    <h4 className="text-xs font-semibold text-foreground/90 text-left">Notes & Comments</h4>
                                                </div>
                                                <Badge variant="secondary" className="bg-background border border-border text-muted-foreground">{notes.length}</Badge>
                                            </div>
                                            <div className="flex gap-2 text-left">
                                                <Textarea value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)} placeholder="Type a note..." className="min-h-[80px] rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/45 text-xs text-left" />
                                                <Button type="button" onClick={handleAddNote} disabled={!newNoteContent.trim()} size="icon" className="h-auto w-12 rounded-xl shrink-0 bg-blue-600 text-white hover:bg-blue-700 shadow-lg text-left">
                                                    <Plus className="h-5 w-5" />
                                                </Button>
                                            </div>
                                            <div className="space-y-3 text-left">
                                                {notes.map((note, idx) => (
                                                    <div key={note.id} className="p-4 rounded-xl bg-background border border-border relative group/note text-left">
                                                        <div className="flex items-center justify-between mb-1.5 text-left">
                                                            <p className="text-[9px] font-semibold text-muted-foreground text-left">{note.authorName} · {format(new Date(note.createdAt), 'MMM d')}</p>
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

                        <DialogFooter className="bg-card p-8 border-t border-border shrink-0 flex justify-between text-left">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="font-bold text-muted-foreground hover:text-foreground rounded-xl h-12 px-10 text-left">Discard</Button>
                            <div className="flex gap-3">
                                {task?.id && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={async () => {
                                            const currentStatus = form.getValues('status');
                                            const newStatus = currentStatus === 'done' ? 'todo' : 'done';
                                            setValue('status', newStatus);
                                            // Submit task state updates immediately
                                            handleSubmit(onSubmit)();
                                        }}
                                        className="font-bold rounded-xl h-12 px-6 border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                    >
                                        {form.watch('status') === 'done' ? 'Reopen Task' : 'Mark Completed'}
                                    </Button>
                                )}
                                <Button type="submit" disabled={isSaving} className="rounded-xl font-bold h-12 px-16 shadow-2xl bg-blue-600 text-white hover:bg-blue-700 active:scale-95 text-sm gap-2 transition-all text-left">
                                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                    {task?.id ? 'Save Changes' : 'Create Task'}
                                </Button>
                            </div>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

