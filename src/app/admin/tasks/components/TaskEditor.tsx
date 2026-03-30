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
    Layout,
    StickyNote,
    Paperclip,
    Trash2,
    PlusCircle
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, orderBy, query, where, limit } from 'firebase/firestore';
import type { Task, UserProfile, School, TaskPriority, TaskCategory, Survey, PDFForm, SurveyResponse, Submission, TaskReminder, TaskNote, TaskAttachment } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { MediaSelect } from '../../schools/components/media-select';
import { useTenant } from '@/context/TenantContext';

const taskSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters.'),
    description: z.string().min(5, 'Description is required.'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    category: z.enum(['call', 'visit', 'document', 'training', 'follow_up', 'general']),
    status: z.enum(['todo', 'in_progress', 'waiting', 'review', 'done']),
    assignedTo: z.string().min(1, 'Please assign an owner.'),
    schoolId: z.string().optional(),
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
    const { user: currentUser } = useUser();
    const { activeWorkspaceId, activeOrganizationId } = useTenant();
    
    const usersQuery = useMemoFirebase(() => 
        firestore && activeOrganizationId ? query(
            collection(firestore, 'users'), 
            where('organizationId', '==', activeOrganizationId),
            where('isAuthorized', '==', true), 
            orderBy('name')
        ) : null, 
    [firestore, activeOrganizationId]);
    
    const schoolsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'schools'), where('workspaceIds', 'array-contains', activeWorkspaceId), orderBy('name', 'asc'));
    }, [firestore, activeWorkspaceId]);

    const surveysQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'surveys'), where('workspaceIds', 'array-contains', activeWorkspaceId), where('status', '==', 'published'));
    }, [firestore, activeWorkspaceId]);

    const pdfsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'pdfs'), where('workspaceIds', 'array-contains', activeWorkspaceId), where('status', '==', 'published'));
    }, [firestore, activeWorkspaceId]);
    
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
            entityId: '',
            entityType: undefined,
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
                    entityId: task.entityId || '',
                    entityType: task.entityType || undefined,
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
                reset({
                    title: '', description: '', priority: 'medium', category: 'general', status: 'todo', assignedTo: '', schoolId: '', entityId: '', entityType: undefined, dueDate: new Date(), reminders: [], notes: [], attachments: [], relatedEntityType: null, relatedParentId: null, relatedEntityId: null,
                });
            }
        }
    }, [open, task, reset]);

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
            workspaceId: activeWorkspaceId, 
            startDate: data.startDate?.toISOString(),
            dueDate: data.dueDate.toISOString(),
            reminders: data.reminders.map(r => ({ ...r, reminderTime: r.reminderTime.toISOString() }))
        };
        await onSave(payload);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
                    <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20"><Layout className="h-6 w-6" /></div>
                            <div className="text-left">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Task Studio</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Define objectives and bind records for {activeWorkspaceId}.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden bg-background">
                        <ScrollArea className="h-full">
                            <div className="p-8 space-y-10">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Task Title</Label>
                                        <Input {...register('title')} placeholder="e.g. Conduct campus security audit" className="h-14 rounded-2xl bg-muted/20 border-none font-black text-2xl px-6 shadow-inner" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Execution Brief</Label>
                                        <Textarea {...register('description')} placeholder="Provide detailed context..." className="min-h-[100px] rounded-2xl bg-muted/20 border-none p-6 font-medium leading-relaxed shadow-inner" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">1. Priority Protocol</Label>
                                        <Controller name="priority" control={control} render={({ field }) => (
                                            <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1.5 rounded-2xl border shadow-inner">
                                                {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
                                                    <button key={p} type="button" onClick={() => field.onChange(p)} className={cn("h-10 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all", field.value === p ? (p === 'urgent' ? "bg-rose-600 text-white shadow-lg" : p === 'high' ? "bg-orange-500 text-white shadow-lg" : "bg-white shadow-lg text-primary") : "text-muted-foreground opacity-60 hover:opacity-100")}>{p}</button>
                                                ))}
                                            </div>
                                        )} />
                                    </div>
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">2. Workflow Status</Label>
                                        <Controller name="status" control={control} render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}><SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl border-none shadow-2xl"><SelectItem value="todo" className="font-bold">To Do (Backlog)</SelectItem><SelectItem value="in_progress" className="font-bold text-blue-600">In Progress</SelectItem><SelectItem value="waiting" className="font-bold text-orange-600">Waiting</SelectItem><SelectItem value="review" className="font-bold text-purple-600">Review</SelectItem><SelectItem value="done" className="font-bold text-emerald-600">Done (Resolved)</SelectItem></SelectContent></Select>
                                        )} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2 text-left">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2"><User className="h-3 w-3" /> Owner</Label>
                                        <Controller name="assignedTo" control={control} render={({ field }) => (<Select value={field.value} onValueChange={field.onChange}><SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold"><SelectValue placeholder="Assign..." /></SelectTrigger><SelectContent className="rounded-xl">{users?.map(u => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}</SelectContent></Select>)} />
                                    </div>
                                    <div className="space-y-2 text-left">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2"><Building className="h-3 w-3" /> Binding Hub</Label>
                                        <Controller name="schoolId" control={control} render={({ field }) => (<Select value={field.value || 'none'} onValueChange={field.onChange}><SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold"><SelectValue placeholder="Global" /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="none">Global / Generic</SelectItem>{schools?.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent></Select>)} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2 text-left"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-2"><Calendar className="h-3 w-3" /> Implementation Start</Label><Controller name="startDate" control={control} render={({ field }) => (<DateTimePicker value={field.value} onChange={field.onChange} />)} /></div>
                                    <div className="space-y-2 text-left"><Label className="text-[10px] font-black uppercase text-primary ml-1 flex items-center gap-2"><Target className="h-3 w-3" /> Dead-line</Label><Controller name="dueDate" control={control} render={({ field }) => (<DateTimePicker value={field.value} onChange={field.onChange} />)} /></div>
                                </div>

                                <Separator className="opacity-50" />

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 text-left">
                                    <div className="space-y-8">
                                        <div className="flex items-center justify-between px-1"><div className="flex items-center gap-2"><StickyNote className="h-4 w-4 text-primary" /><h4 className="text-xs font-black uppercase tracking-widest">Protocol Ledger</h4></div><Badge variant="secondary">{notes.length}</Badge></div>
                                        <div className="space-y-4">
                                            <div className="flex gap-2"><Textarea value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)} placeholder="Context note..." className="min-h-[80px] rounded-xl bg-muted/20 border-none shadow-inner text-xs" /><Button type="button" onClick={handleAddNote} disabled={!newNoteContent.trim()} size="icon" className="h-auto w-12 rounded-xl shrink-0 bg-primary text-white shadow-lg"><Plus className="h-5 w-5" /></Button></div>
                                            <div className="space-y-3">{notes.map((note, idx) => (<div key={note.id} className="p-4 rounded-xl bg-muted/10 border relative group/note"><div className="flex items-center justify-between mb-1.5"><p className="text-[9px] font-black uppercase text-primary/60">{note.authorName} · {format(new Date(note.createdAt), 'MMM d')}</p><button type="button" onClick={() => removeNote(idx)} className="opacity-0 group-hover/note:opacity-100 transition-opacity text-destructive"><X size={12} /></button></div><p className="text-xs font-medium">{note.content}</p></div>))}</div>
                                        </div>
                                    </div>
                                    <div className="space-y-8">
                                        <div className="flex items-center justify-between px-1"><div className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-primary" /><h4 className="text-xs font-black uppercase tracking-widest">Asset Binding</h4></div><Badge variant="secondary">{attachments.length}</Badge></div>
                                        <div className="space-y-4"><div className="p-1.5 rounded-2xl bg-muted/20 border-2 border-dashed border-border flex items-center justify-center"><MediaSelect onValueChange={handleAddAttachment} className="border-none shadow-none bg-transparent" /></div><div className="space-y-2">{attachments.map((att, idx) => (<div key={att.id} className="flex items-center justify-between p-3 rounded-xl bg-white border shadow-sm group"><div className="flex items-center gap-3 min-w-0"><FileText className="h-4 w-4 text-primary shrink-0" /><a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold uppercase truncate hover:underline">{att.name}</a></div><Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" onClick={() => removeAttachment(idx)}><X className="h-3.5 w-3.5" /></Button></div>))}</div></div>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>

                    <DialogFooter className="bg-muted/30 p-8 border-t shrink-0 flex justify-between">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="font-bold rounded-xl h-12 px-10">Discard</Button>
                        <Button type="submit" disabled={isSaving} className="rounded-2xl font-black h-14 px-16 shadow-2xl bg-primary text-white uppercase tracking-widest text-sm gap-2 active:scale-95 transition-all">{isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}Commit Blueprint</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
