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
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
    Loader2, 
    Save, 
    CheckCircle2, 
    Clock, 
    AlertTriangle, 
    ShieldAlert, 
    User, 
    Building, 
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
    Layout
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, orderBy, query, where, limit } from 'firebase/firestore';
import type { Task, UserProfile, School, TaskPriority, TaskCategory, Survey, PDFForm, SurveyResponse, Submission, TaskReminder } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

const taskSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters.'),
    description: z.string().min(5, 'Description is required.'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    category: z.enum(['call', 'visit', 'document', 'training', 'general']),
    status: z.enum(['todo', 'in_progress', 'waiting', 'review', 'done']),
    assignedTo: z.string().min(1, 'Please assign an owner.'),
    schoolId: z.string().optional(),
    startDate: z.date().optional(),
    dueDate: z.date({ required_error: 'Due date is required.' }),
    // Reminders
    reminders: z.array(z.object({
        reminderTime: z.date(),
        channels: z.array(z.enum(['notification', 'email', 'sms'])).min(1, 'Select at least one channel.'),
        sent: z.boolean().default(false),
    })).max(3, 'Maximum 3 reminders allowed.'),
    // Record Interlinking
    relatedEntityType: z.enum(['SurveyResponse', 'Submission', 'Meeting', 'School']).optional().nullable(),
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

export default function TaskEditor({ open, onOpenChange, task, onSave, isSaving }: TaskEditorProps) {
    const firestore = useFirestore();
    
    const usersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('isAuthorized', '==', true), orderBy('name')) : null, [firestore]);
    const schoolsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'schools'), orderBy('name', 'asc')) : null, [firestore]);
    const surveysQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'surveys'), where('status', '==', 'published')) : null, [firestore]);
    const pdfsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'pdfs'), where('status', '==', 'published')) : null, [firestore]);
    
    const { data: users } = useCollection<UserProfile>(usersQuery);
    const { data: schools } = useCollection<School>(schoolsQuery);
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
            assignedTo: '',
            schoolId: '',
            dueDate: new Date(),
            reminders: [],
            relatedEntityType: null,
            relatedParentId: null,
            relatedEntityId: null,
        }
    });

    const { register, handleSubmit, control, reset, setValue } = form;
    
    const { fields: reminders, append, remove } = useFieldArray({
        control,
        name: 'reminders'
    });

    const watchedEntityType = useWatch({ control, name: 'relatedEntityType' });
    const watchedParentId = useWatch({ control, name: 'relatedParentId' });

    const responsesQuery = useMemoFirebase(() => {
        if (!firestore || watchedEntityType !== 'SurveyResponse' || !watchedParentId) return null;
        return query(collection(firestore, `surveys/${watchedParentId}/responses`), orderBy('submittedAt', 'desc'), limit(50));
    }, [firestore, watchedEntityType, watchedParentId]);

    const submissionsQuery = useMemoFirebase(() => {
        if (!firestore || watchedEntityType !== 'Submission' || !watchedParentId) return null;
        return query(collection(firestore, `pdfs/${watchedParentId}/submissions`), orderBy('submittedAt', 'desc'), limit(50));
    }, [firestore, watchedEntityType, watchedParentId]);

    const { data: responses } = useCollection<SurveyResponse>(responsesQuery);
    const { data: submissions } = useCollection<Submission>(submissionsQuery);

    React.useEffect(() => {
        if (open) {
            if (task) {
                reset({
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    category: task.category,
                    status: task.status,
                    assignedTo: task.assignedTo,
                    schoolId: task.schoolId || '',
                    startDate: task.startDate ? new Date(task.startDate) : undefined,
                    dueDate: new Date(task.dueDate),
                    reminders: (task.reminders || []).map(r => ({
                        ...r,
                        reminderTime: new Date(r.reminderTime)
                    })),
                    relatedEntityType: task.relatedEntityType || null,
                    relatedParentId: task.relatedParentId || null,
                    relatedEntityId: task.relatedEntityId || null,
                });
            } else {
                reset({
                    title: '',
                    description: '',
                    priority: 'medium',
                    category: 'general',
                    status: 'todo',
                    assignedTo: '',
                    schoolId: '',
                    dueDate: new Date(),
                    reminders: [],
                    relatedEntityType: null,
                    relatedParentId: null,
                    relatedEntityId: null,
                });
            }
        }
    }, [open, task, reset]);

    const onSubmit = async (data: TaskFormValues) => {
        const payload = {
            ...data,
            startDate: data.startDate?.toISOString(),
            dueDate: data.dueDate.toISOString(),
            reminders: data.reminders.map(r => ({
                ...r,
                reminderTime: r.reminderTime.toISOString()
            }))
        };
        await onSave(payload);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
                    <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                <Layout className="h-6 w-6" />
                            </div>
                            <div className="text-left">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                                    Task Studio
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Define objectives, schedule milestones, and set logic-based reminders.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden bg-background">
                        <ScrollArea className="h-full">
                            <div className="p-8 space-y-10">
                                {/* Core Details */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mission Title</Label>
                                        <Input 
                                            {...register('title')} 
                                            placeholder="e.g. Conduct campus security audit" 
                                            className="h-14 rounded-2xl bg-muted/20 border-none font-black text-2xl px-6 shadow-inner"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Execution Brief</Label>
                                        <Textarea 
                                            {...register('description')} 
                                            placeholder="Provide detailed context for the assigned manager..." 
                                            className="min-h-[120px] rounded-2xl bg-muted/20 border-none p-6 font-medium leading-relaxed shadow-inner"
                                        />
                                    </div>
                                </div>

                                {/* Flow Control */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">1. Priority Protocol</Label>
                                        <Controller
                                            name="priority"
                                            control={control}
                                            render={({ field }) => (
                                                <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1.5 rounded-2xl border">
                                                    {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
                                                        <button
                                                            key={p}
                                                            type="button"
                                                            onClick={() => field.onChange(p)}
                                                            className={cn(
                                                                "h-10 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all",
                                                                field.value === p 
                                                                    ? p === 'urgent' ? "bg-rose-600 text-white shadow-lg" : 
                                                                      p === 'high' ? "bg-orange-500 text-white shadow-lg" :
                                                                      "bg-white shadow-lg text-primary"
                                                                    : "text-muted-foreground opacity-60 hover:opacity-100"
                                                            )}
                                                        >
                                                            {p}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">2. Workflow Status</Label>
                                        <Controller
                                            name="status"
                                            control={control}
                                            render={({ field }) => (
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="todo">To Do</SelectItem>
                                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                                        <SelectItem value="waiting">Waiting on External</SelectItem>
                                                        <SelectItem value="review">Under Review</SelectItem>
                                                        <SelectItem value="done">Completed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                </div>

                                <Separator className="bg-border/50" />

                                {/* Assignment & Timing */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                            <User className="h-3 w-3" /> Account Manager
                                        </Label>
                                        <Controller
                                            name="assignedTo"
                                            control={control}
                                            render={({ field }) => (
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold">
                                                        <SelectValue placeholder="Assign logic owner..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        {users?.map(u => (
                                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                            <Building className="h-3 w-3" /> Campus Context
                                        </Label>
                                        <Controller
                                            name="schoolId"
                                            control={control}
                                            render={({ field }) => (
                                                <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold">
                                                        <SelectValue placeholder="No school binding" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="none">Global / Generic</SelectItem>
                                                        {schools?.map(s => (
                                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                            <Calendar className="h-3 w-3" /> Implementation Start
                                        </Label>
                                        <Controller
                                            name="startDate"
                                            control={control}
                                            render={({ field }) => (
                                                <DateTimePicker value={field.value} onChange={field.onChange} />
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1 flex items-center gap-2">
                                            <Target className="h-3 w-3" /> Dead-line Target
                                        </Label>
                                        <Controller
                                            name="dueDate"
                                            control={control}
                                            render={({ field }) => (
                                                <DateTimePicker value={field.value} onChange={field.onChange} />
                                            )}
                                        />
                                    </div>
                                </div>

                                <Separator className="bg-border/50" />

                                {/* Reminders Engine */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2">
                                            <Bell className="h-4 w-4 text-primary" />
                                            <h4 className="text-xs font-black uppercase tracking-widest text-foreground">Proactive Reminders</h4>
                                        </div>
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => append({ reminderTime: new Date(), channels: ['notification'], sent: false })}
                                            disabled={reminders.length >= 3}
                                            className="h-8 rounded-xl font-bold border-dashed border-2 text-[10px] uppercase tracking-widest"
                                        >
                                            <Plus className="h-3 w-3 mr-1.5" /> Set Event
                                        </Button>
                                    </div>

                                    {reminders.length > 0 ? (
                                        <div className="space-y-4">
                                            {reminders.map((field, index) => (
                                                <Card key={field.id} className="rounded-2xl border-primary/10 bg-primary/[0.02] shadow-none overflow-hidden group">
                                                    <div className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-6">
                                                        <div className="flex-1 min-w-[200px]">
                                                            <Controller
                                                                name={`reminders.${index}.reminderTime`}
                                                                control={control}
                                                                render={({ field: rField }) => (
                                                                    <DateTimePicker value={rField.value} onChange={rField.onChange} />
                                                                )}
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2 bg-white rounded-xl border p-1 shadow-sm shrink-0">
                                                            <Controller
                                                                name={`reminders.${index}.channels`}
                                                                control={control}
                                                                render={({ field: cField }) => (
                                                                    <div className="flex gap-1">
                                                                        {(['notification', 'email', 'sms'] as const).map(chan => {
                                                                            const active = cField.value?.includes(chan);
                                                                            return (
                                                                                <TooltipProvider key={chan}>
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    const next = active 
                                                                                                        ? cField.value.filter(v => v !== chan)
                                                                                                        : [...(cField.value || []), chan];
                                                                                                    if (next.length > 0) cField.onChange(next);
                                                                                                }}
                                                                                                className={cn(
                                                                                                    "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                                                                                                    active ? "bg-primary text-white shadow-md" : "text-muted-foreground opacity-40 hover:opacity-100"
                                                                                                )}
                                                                                            >
                                                                                                {chan === 'notification' ? <Bell size={14} /> : chan === 'email' ? <Mail size={14} /> : <Smartphone size={14} />}
                                                                                            </button>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent className="capitalize text-[10px] font-black">{chan}</TooltipContent>
                                                                                    </Tooltip>
                                                                                </TooltipProvider>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            />
                                                        </div>
                                                        <Button 
                                                            type="button" 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-9 w-9 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" 
                                                            onClick={() => remove(index)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-10 text-center border-2 border-dashed rounded-[2rem] bg-muted/10 opacity-30">
                                            <p className="text-[10px] font-black uppercase tracking-widest">No reminders queued</p>
                                        </div>
                                    )}
                                </div>

                                <Separator className="bg-border/50" />

                                {/* Interlinking Hub */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2">
                                        <LinkIcon className="h-4 w-4 text-primary" />
                                        <h4 className="text-xs font-black uppercase tracking-widest text-foreground">Record Interlinking</h4>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Entity Reference</Label>
                                            <Controller
                                                name="relatedEntityType"
                                                control={control}
                                                render={({ field }) => (
                                                    <Select 
                                                        value={field.value || 'none'} 
                                                        onValueChange={(val) => {
                                                            field.onChange(val === 'none' ? null : val);
                                                            setValue('relatedParentId', null);
                                                            setValue('relatedEntityId', null);
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold">
                                                            <SelectValue placeholder="No Link" />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            <SelectItem value="none">Independent</SelectItem>
                                                            <SelectItem value="SurveyResponse">Survey Result</SelectItem>
                                                            <SelectItem value="Submission">Doc Signing Record</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </div>

                                        {watchedEntityType && (
                                            <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">
                                                    {watchedEntityType === 'SurveyResponse' ? 'Blueprint Source' : 'Form Template'}
                                                </Label>
                                                <Controller
                                                    name="relatedParentId"
                                                    control={control}
                                                    render={({ field }) => (
                                                        <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                                            <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold">
                                                                <SelectValue placeholder="Select context..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                {watchedEntityType === 'SurveyResponse' 
                                                                    ? surveys?.map(s => <SelectItem key={s.id} value={s.id}>{s.internalName || s.title}</SelectItem>)
                                                                    : pdfs?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)
                                                                }
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                            </div>
                                        )}

                                        {watchedParentId && (
                                            <div className="md:col-span-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <Label className="text-[10px] font-black uppercase text-primary ml-1">Identify Target Record</Label>
                                                <Controller
                                                    name="relatedEntityId"
                                                    control={control}
                                                    render={({ field }) => (
                                                        <Select value={field.value || 'none'} onValueChange={field.onChange}>
                                                            <SelectTrigger className="h-12 rounded-xl bg-primary/5 border-primary/20 text-primary font-black">
                                                                <SelectValue placeholder="Choose specific entry..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                {watchedEntityType === 'SurveyResponse' 
                                                                    ? responses?.map(r => (
                                                                        <SelectItem key={r.id} value={r.id}>
                                                                            {format(new Date(r.submittedAt), 'MMM d, HH:mm')} · Score: {r.score}
                                                                        </SelectItem>
                                                                    ))
                                                                    : submissions?.map(s => (
                                                                        <SelectItem key={s.id} value={s.id}>
                                                                            {format(new Date(s.submittedAt), 'MMM d, HH:mm')} · ID: {s.id.substring(0,8)}
                                                                        </SelectItem>
                                                                    ))
                                                                }
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="h-20" />
                            </div>
                        </ScrollArea>
                    </div>

                    <DialogFooter className="bg-muted/30 p-8 border-t shrink-0 flex justify-between items-center sm:justify-between gap-4">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="font-bold rounded-xl h-12 px-10">Discard</Button>
                        <Button 
                            type="submit" 
                            disabled={isSaving}
                            className="rounded-2xl font-black h-14 px-16 shadow-2xl bg-primary text-white hover:bg-primary/90 transition-all active:scale-95 uppercase tracking-widest text-sm gap-2"
                        >
                            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                            Synchronize Mission
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
