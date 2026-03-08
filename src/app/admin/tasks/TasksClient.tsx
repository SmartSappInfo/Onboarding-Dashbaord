'use client';

import * as React from 'react';
import { collection, query, orderBy, where, limit, doc, getDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Task, UserProfile, School, TaskPriority, TaskStatus, TaskCategory } from '@/lib/types';
import { format, isToday, isPast, isTomorrow } from 'date-fns';
import { 
    CheckCircle2, 
    Circle, 
    Clock, 
    AlertTriangle, 
    ShieldAlert, 
    User as UserIcon, 
    Building, 
    Phone, 
    MapPin, 
    FileText, 
    GraduationCap,
    MoreVertical,
    Trash2,
    Calendar,
    Plus,
    Loader2,
    Search,
    Pencil,
    Send,
    Mail,
    Smartphone
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    completeTaskNonBlocking, 
    deleteTaskNonBlocking, 
    updateTaskNonBlocking,
    createTaskNonBlocking 
} from '@/lib/task-actions';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import TaskEditor from './components/TaskEditor';
import { logActivity } from '@/lib/activity-logger';

const PRIORITY_CONFIG: Record<TaskPriority, { label: string, color: string, icon: any }> = {
    critical: { label: 'Critical', color: 'text-rose-600 bg-rose-50 border-rose-200', icon: ShieldAlert },
    high: { label: 'High', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: AlertTriangle },
    medium: { label: 'Medium', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock },
    low: { label: 'Low', color: 'text-slate-500 bg-slate-50 border-slate-200', icon: Circle }
};

const CATEGORY_ICONS: Record<TaskCategory, any> = {
    call: Phone,
    visit: MapPin,
    document: FileText,
    training: GraduationCap,
    general: CheckCircle2
};

export default function TasksClient() {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const { toast } = useToast();
    
    const [statusFilter, setStatusFilter] = React.useState<string>('pending');
    const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
    const [assignedFilter, setAssignedFilter] = React.useState<string>(currentUser?.uid || 'all');
    const [searchTerm, setSearchTerm] = React.useState('');

    // Editor State
    const [editorOpen, setEditorOpen] = React.useState(false);
    const [editingTask, setEditingTask] = React.useState<Task | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    const tasksQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'tasks'), orderBy('dueDate', 'asc'), limit(100));
    }, [firestore]);

    const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);

    const { data: allTasks, isLoading } = useCollection<Task>(tasksQuery);
    const { data: users } = useCollection<UserProfile>(usersQuery);

    const filteredTasks = React.useMemo(() => {
        if (!allTasks) return [];
        return allTasks.filter(task => {
            const matchesStatus = statusFilter === 'all' ? true : task.status === statusFilter;
            const matchesPriority = priorityFilter === 'all' ? true : task.priority === priorityFilter;
            const matchesAssigned = assignedFilter === 'all' ? true : task.assignedTo === assignedFilter;
            const matchesSearch = searchTerm ? 
                task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                task.schoolName?.toLowerCase().includes(searchTerm.toLowerCase()) 
                : true;
            return matchesStatus && matchesPriority && matchesAssigned && matchesSearch;
        });
    }, [allTasks, statusFilter, priorityFilter, assignedFilter, searchTerm]);

    const handleSaveTask = async (values: any) => {
        if (!firestore || !currentUser) return;
        setIsSaving(true);

        const assignedUser = users?.find(u => u.id === values.assignedTo);
        const taskData = {
            ...values,
            schoolId: values.schoolId === 'none' ? null : values.schoolId,
            schoolName: values.schoolId !== 'none' ? users?.find(u => u.id === values.schoolId)?.name : null,
            assignedToName: assignedUser?.name || 'Unknown',
            dueDate: values.dueDate.toISOString(),
            source: editingTask ? editingTask.source : 'manual'
        };

        try {
            if (editingTask) {
                updateTaskNonBlocking(firestore, editingTask.id, taskData);
                toast({ title: 'Task Updated' });
            } else {
                await createTaskNonBlocking(firestore, {
                    ...taskData,
                    status: 'pending',
                    reminderSent: false,
                    source: 'manual'
                });
                toast({ title: 'Task Created' });
                
                logActivity({
                    schoolId: values.schoolId === 'none' ? '' : values.schoolId,
                    userId: currentUser.uid,
                    type: 'school_updated', // Using as general type
                    source: 'user_action',
                    description: `created a new task: "${values.title}"`,
                });
            }
            setEditorOpen(false);
            setEditingTask(null);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Operation Failed' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleComplete = (task: Task) => {
        if (!firestore) return;
        if (task.status === 'completed') {
            updateTaskNonBlocking(firestore, task.id, { status: 'pending', completedAt: undefined });
            toast({ title: 'Task reopened' });
        } else {
            completeTaskNonBlocking(firestore, task.id);
            toast({ title: 'Task marked as complete' });
        }
    };

    const handleDelete = (id: string) => {
        if (!firestore || !confirm('Permanently delete this task?')) return;
        deleteTaskNonBlocking(firestore, id);
        toast({ title: 'Task removed' });
    };

    const getDueLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isToday(date)) return <span className="text-orange-600 font-bold">Today</span>;
        if (isTomorrow(date)) return <span>Tomorrow</span>;
        if (isPast(date)) return <span className="text-rose-600 font-bold">Overdue</span>;
        return format(date, 'MMM d');
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
            <div className="max-w-6xl mx-auto space-y-8">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="text-left">
                        <h1 className="text-3xl font-black tracking-tight text-foreground uppercase flex items-center gap-3">
                            <CheckCircle2 className="h-8 w-8 text-primary" />
                            Operational Tasks
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">Manage your CRM interventions and automated follow-ups.</p>
                    </div>
                    <Button onClick={() => setEditorOpen(true)} className="rounded-xl font-black uppercase tracking-widest shadow-lg h-12 px-8">
                        <Plus className="mr-2 h-5 w-5" /> New Task
                    </Button>
                </div>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-white">
                    <CardContent className="p-4 flex flex-wrap items-center gap-4">
                        <div className="flex-grow min-w-[240px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                            <Input 
                                placeholder="Search tasks or schools..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[160px] h-11 rounded-xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="w-[160px] h-11 rounded-xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest">
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">All Priority</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                            <SelectTrigger className="w-[200px] h-11 rounded-xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest">
                                <SelectValue placeholder="Assignee" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">Everyone's Tasks</SelectItem>
                                {users?.map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                        ))
                    ) : filteredTasks.length > 0 ? (
                        filteredTasks.map((task) => {
                            const P = PRIORITY_CONFIG[task.priority];
                            const CatIcon = CATEGORY_ICONS[task.category];
                            const isDone = task.status === 'completed';

                            return (
                                <Card 
                                    key={task.id} 
                                    className={cn(
                                        "group overflow-hidden border-border/50 hover:shadow-xl transition-all duration-300 rounded-2xl bg-card",
                                        isDone && "opacity-60 grayscale-[0.5]"
                                    )}
                                >
                                    <div className="p-5 flex items-start gap-5">
                                        <div className="pt-1">
                                            <Checkbox 
                                                checked={isDone} 
                                                onCheckedChange={() => handleToggleComplete(task)}
                                                className="h-6 w-6 rounded-lg border-2"
                                            />
                                        </div>
                                        
                                        <div className="flex-grow min-w-0 space-y-1">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <h3 className={cn(
                                                    "text-lg font-black tracking-tight uppercase leading-none",
                                                    isDone && "line-through text-muted-foreground"
                                                )}>
                                                    {task.title}
                                                </h3>
                                                <Badge variant="outline" className={cn("text-[8px] font-black uppercase h-5", P.color)}>
                                                    <P.icon className="h-2.5 w-2.5 mr-1" /> {P.label}
                                                </Badge>
                                                {task.source === 'automation' && (
                                                    <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[8px] h-5 uppercase font-black">Auto-Triggered</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground font-medium line-clamp-1">{task.description}</p>
                                            
                                            <div className="flex items-center gap-6 pt-2">
                                                {task.schoolName && (
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                                                        <Building className="h-3 w-3" /> {task.schoolName}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                                                    <CatIcon className="h-3 w-3" /> {task.category}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">
                                                    <Calendar className="h-3 w-3" /> Due {getDueLabel(task.dueDate)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-4 shrink-0">
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <DropdownMenu modal={false}>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreVertical className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48 rounded-xl border-none shadow-2xl">
                                                        <DropdownMenuItem onClick={() => { setEditingTask(task); setEditorOpen(true); }} className="gap-2">
                                                            <Pencil className="h-4 w-4" /> Edit Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => toast({ title: 'Reminder Sent' })} className="gap-2">
                                                            <Send className="h-4 w-4" /> Dispatch Reminder
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleDelete(task.id)} className="text-destructive gap-2">
                                                            <Trash2 className="h-4 w-4" /> Delete Task
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{task.assignedToName?.split(' ')[0]}</span>
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={`https://i.pravatar.cc/150?u=${task.assignedTo}`} />
                                                    <AvatarFallback><UserIcon className="h-3 w-3" /></AvatarFallback>
                                                </Avatar>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })
                    ) : (
                        <div className="py-32 text-center border-4 border-dashed rounded-[4rem] bg-muted/10 flex flex-col items-center justify-center gap-4 opacity-30">
                            <CheckCircle2 className="h-16 w-16 text-muted-foreground" />
                            <p className="font-black uppercase tracking-widest text-sm">No tasks identified in this context</p>
                        </div>
                    )}
                </div>
            </div>

            <TaskEditor 
                open={editorOpen} 
                onOpenChange={setEditorOpen} 
                task={editingTask}
                onSave={handleSaveTask}
                isSaving={isSaving}
            />
        </div>
    );
}
