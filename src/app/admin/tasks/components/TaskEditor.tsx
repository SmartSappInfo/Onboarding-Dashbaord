'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
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
    Plus
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';
import type { Task, UserProfile, School, TaskPriority, TaskCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

const taskSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters.'),
    description: z.string().min(5, 'Description is required.'),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    category: z.enum(['call', 'visit', 'document', 'training', 'general']),
    assignedTo: z.string().min(1, 'Please assign an owner.'),
    schoolId: z.string().optional(),
    dueDate: z.date({ required_error: 'Due date is required.' }),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task?: Task | null;
    onSave: (data: TaskFormValues) => Promise<void>;
    isSaving: boolean;
}

export default function TaskEditor({ open, onOpenChange, task, onSave, isSaving }: TaskEditorProps) {
    const firestore = useFirestore();
    
    const usersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), orderBy('name')) : null, [firestore]);
    const schoolsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'schools'), orderBy('name')) : null, [firestore]);
    
    const { data: users } = useCollection<UserProfile>(usersQuery);
    const { data: schools } = useCollection<School>(schoolsQuery);

    const form = useForm<TaskFormValues>({
        resolver: zodResolver(taskSchema),
        defaultValues: {
            title: '',
            description: '',
            priority: 'medium',
            category: 'general',
            assignedTo: '',
            schoolId: '',
            dueDate: new Date(),
        }
    });

    const { register, handleSubmit, control, reset } = form;

    React.useEffect(() => {
        if (open) {
            if (task) {
                reset({
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    category: task.category,
                    assignedTo: task.assignedTo,
                    schoolId: task.schoolId || '',
                    dueDate: new Date(task.dueDate),
                });
            } else {
                reset({
                    title: '',
                    description: '',
                    priority: 'medium',
                    category: 'general',
                    assignedTo: '',
                    schoolId: '',
                    dueDate: new Date(),
                });
            }
        }
    }, [open, task, reset]);

    const onSubmit = async (data: TaskFormValues) => {
        await onSave(data);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
                    <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                {task ? <Zap className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                                    {task ? 'Update Task' : 'Create Task'}
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Schedule tasks and get reminders when they're due.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="p-8 space-y-8">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Task Objective</Label>
                                    <Input 
                                        {...register('title')} 
                                        placeholder="e.g. Schedule Campus Drone Inspection" 
                                        className="h-12 rounded-xl bg-muted/20 border-none font-bold text-lg px-6 shadow-inner"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Operational Instructions</Label>
                                    <Textarea 
                                        {...register('description')} 
                                        placeholder="Describe the steps required to complete this task..." 
                                        className="min-h-[120px] rounded-2xl bg-muted/20 border-none p-6 font-medium leading-relaxed shadow-inner"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">1. Priority Level</Label>
                                        <Controller
                                            name="priority"
                                            control={control}
                                            render={({ field }) => (
                                                <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1.5 rounded-2xl border">
                                                    {(['low', 'medium', 'high', 'critical'] as const).map(p => (
                                                        <button
                                                            key={p}
                                                            type="button"
                                                            onClick={() => field.onChange(p)}
                                                            className={cn(
                                                                "h-10 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all",
                                                                field.value === p 
                                                                    ? p === 'critical' ? "bg-rose-600 text-white shadow-lg" : 
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
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">2. Action Category</Label>
                                        <Controller
                                            name="category"
                                            control={control}
                                            render={({ field }) => (
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="general">General Task</SelectItem>
                                                        <SelectItem value="call">Phone Follow-up</SelectItem>
                                                        <SelectItem value="visit">Physical Visit</SelectItem>
                                                        <SelectItem value="document">Legal / Document</SelectItem>
                                                        <SelectItem value="training">Staff Training</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                </div>

                                <Separator className="bg-border/50" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                            <User className="h-3 w-3" /> Task Owner
                                        </Label>
                                        <Controller
                                            name="assignedTo"
                                            control={control}
                                            render={({ field }) => (
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold">
                                                        <SelectValue placeholder="Assign to..." />
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
                                            <Building className="h-3 w-3" /> Target School
                                        </Label>
                                        <Controller
                                            name="schoolId"
                                            control={control}
                                            render={({ field }) => (
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold">
                                                        <SelectValue placeholder="Independent" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="none">Independent (No School)</SelectItem>
                                                        {schools?.map(s => (
                                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 pb-8">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                        <Clock className="h-3 w-3" /> Dead-line Target
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
                        </ScrollArea>
                    </div>

                    <DialogFooter className="bg-muted/30 p-6 border-t shrink-0 flex justify-between items-center sm:justify-between">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="font-bold rounded-xl h-12 px-8">Cancel</Button>
                        <Button 
                            type="submit" 
                            disabled={isSaving}
                            className="rounded-2xl font-black h-14 px-12 shadow-2xl bg-primary text-white hover:bg-primary/90 transition-all active:scale-95 uppercase tracking-widest text-sm gap-2"
                        >
                            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                            {task ? 'Commit Modification' : 'Activate Action'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
