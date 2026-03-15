'use client';

import * as React from 'react';
import { collection, query, orderBy, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Task, UserProfile, School, TaskPriority, TaskCategory, TaskStatus } from '@/lib/types';
import { format, isToday, isPast, differenceInDays } from 'date-fns';
import { 
    CheckCircle2, 
    Circle, 
    Clock, 
    AlertTriangle, 
    ShieldAlert, 
    Building, 
    Phone, 
    MapPin, 
    FileText, 
    GraduationCap,
    MoreHorizontal,
    MoreVertical,
    Trash2,
    Calendar,
    Plus,
    Loader2,
    Search,
    Pencil,
    ArrowRight,
    X,
    CheckSquare,
    ListChecks,
    Zap,
    Layers,
    Bell,
    User as UserIcon,
    ShieldCheck,
    Square,
    MessageSquare,
    Paperclip,
    Filter,
    ArrowUpDown,
    EyeOff,
    ChevronDown,
    Target,
    TrendingUp
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    completeTaskNonBlocking, 
    deleteTaskNonBlocking, 
    updateTaskNonBlocking,
    createTaskNonBlocking,
    bulkDeleteTasks,
    bulkCompleteTasks,
    getTaskInterlinkUrl
} from '@/lib/task-actions';
import { cn, toTitleCase } from '@/lib/utils';
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import TaskEditor from './components/TaskEditor';
import TaskBoard from './components/TaskBoard';
import TaskCalendar from './components/TaskCalendar';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

const PRIORITY_CONFIG: Record<TaskPriority, { label: string, color: string, icon: any }> = {
    urgent: { label: 'Urgent', color: 'text-rose-600 bg-rose-50 border-rose-200', icon: ShieldAlert },
    high: { label: 'High', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: AlertTriangle },
    medium: { label: 'Medium', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock },
    low: { label: 'Low', color: 'text-slate-500 bg-slate-50 border-slate-200', icon: Circle }
};

const CATEGORY_MAP: Record<TaskCategory, { label: string, icon: any, color: string }> = {
    call: { label: 'Phone Call', icon: Phone, color: 'text-orange-500 bg-orange-50' },
    visit: { label: 'Campus Visit', icon: MapPin, color: 'text-blue-500 bg-blue-50' },
    document: { label: 'Documentation', icon: FileText, color: 'text-emerald-500 bg-emerald-50' },
    training: { label: 'Staff Training', icon: GraduationCap, color: 'text-purple-500 bg-purple-50' },
    general: { label: 'General Task', icon: CheckCircle2, color: 'text-slate-500 bg-slate-50' }
};

const STATUS_LABELS: Record<TaskStatus, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    waiting: 'Waiting',
    review: 'Review',
    done: 'Done'
};

const getInitials = (name?: string | null) =>
  name ? name.split(' ').map((n) => n[0]).join('').toUpperCase() : '?';

export default function TasksClient() {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const { toast } = useToast();
    const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
    const { activeWorkspaceId } = useWorkspace();
    
    // View State
    const [activeTab, setActiveTab] = React.useState('list');
    const [statusFilter, setStatusFilter] = React.useState<string>('all');
    const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [smartFilter, setSmartFilter] = React.useState<'none' | 'today' | 'overdue'>('none');

    // Selection State
    const [isSelectionMode, setIsSelectionMode] = React.useState(false);
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [isBulkProcessing, setIsBulkProcessing] = React.useState(false);

    // Editor State
    const [editorOpen, setEditorOpen] = React.useState(false);
    const [editingTask, setEditingTask] = React.useState<Task | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    // Confirmation State
    const [taskToComplete, setTaskToComplete] = React.useState<Task | null>(null);

    const tasksQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'tasks'), 
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('dueDate', 'asc'), 
            limit(200)
        );
    }, [firestore, activeWorkspaceId]);

    const usersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('isAuthorized', '==', true)) : null, [firestore]);
    const schoolsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'schools'), where('workspaceId', '==', activeWorkspaceId), orderBy('name', 'asc')) : null, [firestore, activeWorkspaceId]);

    const { data: allTasks, isLoading: isLoadingTasks } = useCollection<Task>(tasksQuery);
    const { data: users } = useCollection<UserProfile>(usersQuery);
    const { data: schools } = useCollection<School>(schoolsQuery);

    const isLoading = isLoadingTasks || isLoadingFilter;

    const filteredTasks = React.useMemo(() => {
        if (!allTasks) return [];
        return allTasks.filter(task => {
            const matchesStatus = statusFilter === 'all' ? true : task.status === statusFilter;
            const matchesPriority = priorityFilter === 'all' ? true : task.priority === priorityFilter;
            
            let matchesAssigned = true;
            if (assignedUserId) {
                if (assignedUserId === 'unassigned') matchesAssigned = !task.assignedTo;
                else matchesAssigned = task.assignedTo === assignedUserId;
            }

            const matchesSearch = searchTerm ? 
                task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                task.schoolName?.toLowerCase().includes(searchTerm.toLowerCase()) 
                : true;

            let matchesSmart = true;
            if (smartFilter === 'today') {
                matchesSmart = isToday(new Date(task.dueDate)) && task.status !== 'done';
            } else if (smartFilter === 'overdue') {
                const date = new Date(task.dueDate);
                matchesSmart = isPast(date) && !isToday(date) && task.status !== 'done';
            }

            return matchesStatus && matchesPriority && matchesAssigned && matchesSearch && matchesSmart;
        });
    }, [allTasks, statusFilter, priorityFilter, assignedUserId, searchTerm, smartFilter]);

    const stats = React.useMemo(() => {
        if (!allTasks) return { active: 0, resolved: 0, overdue: 0, efficiency: 0 };
        const active = allTasks.filter(t => t.status !== 'done').length;
        const resolved = allTasks.filter(t => t.status === 'done').length;
        const overdue = allTasks.filter(t => {
            const date = new Date(t.dueDate);
            return isPast(date) && !isToday(date) && t.status !== 'done';
        }).length;
        const efficiency = allTasks.length > 0 ? Math.round((resolved / allTasks.length) * 100) : 100;
        return { active, resolved, overdue, efficiency };
    }, [allTasks]);

    const handleSaveTask = async (payload: any) => {
        if (!firestore || !currentUser) return;
        setIsSaving(true);
        try {
            const finalPayload = { ...payload, workspaceId: activeWorkspaceId };
            if (editingTask) {
                updateTaskNonBlocking(firestore, editingTask.id, finalPayload);
                toast({ title: 'Task Architecture Synchronized' });
            } else {
                await createTaskNonBlocking(firestore, finalPayload);
                toast({ title: 'Task Initialized' });
            }
            setEditorOpen(false);
            setEditingTask(null);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Operation Failed' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleQuickCategorySelect = (category: TaskCategory) => {
        setEditingTask({
            id: '',
            title: `Process ${category} protocol`,
            description: '',
            priority: 'medium',
            status: 'todo',
            category: category,
            workspaceId: activeWorkspaceId,
            assignedTo: currentUser?.uid || '',
            dueDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            reminderSent: false,
            reminders: [],
            source: 'manual'
        } as any);
        setEditorOpen(true);
    };

    const handleConfirmComplete = () => {
        if (!firestore || !taskToComplete) return;
        if (taskToComplete.status === 'done') {
            updateTaskNonBlocking(firestore, taskToComplete.id, { status: 'todo', completedAt: undefined });
            toast({ title: 'Task Reopened' });
        } else {
            completeTaskNonBlocking(firestore, taskToComplete.id);
            toast({ title: 'Protocol Resolved' });
        }
        setTaskToComplete(null);
    };

    const handleDelete = (id: string) => {
        if (!firestore || !confirm('Permanently remove this protocol?')) return;
        deleteTaskNonBlocking(firestore, id);
        toast({ title: 'Record Purged' });
    };

    const handleBulkComplete = async () => {
        if (!firestore || selectedIds.length === 0) return;
        setIsBulkProcessing(true);
        try {
            await bulkCompleteTasks(firestore, selectedIds);
            toast({ title: 'Bulk Completion Success', description: `${selectedIds.length} tasks resolved.` });
            setSelectedIds([]);
            setIsSelectionMode(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Bulk Update Failed' });
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleBulkDelete = async () => {
        if (!firestore || selectedIds.length === 0 || !confirm(`Purge ${selectedIds.length} protocols?`)) return;
        setIsBulkProcessing(true);
        try {
            await bulkDeleteTasks(firestore, selectedIds);
            toast({ title: 'Bulk Purge Success' });
            setSelectedIds([]);
            setIsSelectionMode(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Bulk Deletion Failed' });
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const getProgressValue = (status: TaskStatus) => {
        switch(status) {
            case 'todo': return 0;
            case 'in_progress': return 45;
            case 'waiting': return 65;
            case 'review': return 85;
            case 'done': return 100;
            default: return 0;
        }
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-50 text-left">
            <div className="max-w-7xl mx-auto space-y-12 pb-32">
                
                {/* Executive KPI Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard 
                        label="Active Actions" 
                        value={isLoading ? '...' : stats.active} 
                        sub={`${toTitleCase(activeWorkspaceId)} workspace focus`} 
                        icon={Zap} 
                        color={activeWorkspaceId === 'prospect' ? "text-emerald-600" : "text-primary"} 
                        bg={activeWorkspaceId === 'prospect' ? "bg-emerald-50" : "bg-primary/10"} 
                    />
                    <StatCard 
                        label="Resolved Protocols" 
                        value={isLoading ? '...' : stats.resolved} 
                        sub="Success archive" 
                        icon={CheckCircle2} 
                        color="text-emerald-600" 
                        bg="bg-emerald-50" 
                    />
                    <StatCard 
                        label="Overdue Alerts" 
                        value={isLoading ? '...' : stats.overdue} 
                        sub="SLA breach detection" 
                        icon={ShieldAlert} 
                        color="text-rose-600" 
                        bg="bg-rose-50" 
                    />
                    <StatCard 
                        label="Closure Velocity" 
                        value={isLoading ? '...' : `${stats.efficiency}%`} 
                        sub="Efficiency benchmark" 
                        icon={Target} 
                        color="text-blue-600" 
                        bg="bg-blue-50" 
                    />
                </div>

                {/* Recommended Categories Grid */}
                <section className="space-y-6">
                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground ml-1">Recommended Categories</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {(Object.entries(CATEGORY_MAP) as [TaskCategory, any][]).map(([key, config]) => (
                            <button 
                                key={key}
                                onClick={() => handleQuickCategorySelect(key)}
                                className="group flex items-center gap-4 p-5 rounded-2xl bg-white border border-border hover:border-primary/30 transition-all shadow-sm hover:shadow-xl hover:-translate-y-1"
                            >
                                <div className={cn("p-3 rounded-xl transition-transform group-hover:scale-110 shadow-sm", config.color)}>
                                    <config.icon className="h-5 w-5" />
                                </div>
                                <span className="font-bold text-sm uppercase tracking-tight text-foreground/80">{config.label}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Toolbar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-4 rounded-[2rem] border shadow-sm ring-1 ring-black/5">
                    <div className="flex flex-wrap items-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => setIsSelectionMode(!isSelectionMode)} className={cn("rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 h-10 px-4 transition-all", isSelectionMode ? "bg-primary text-white border-primary" : "border-primary/20 text-primary")}>
                            {isSelectionMode ? <CheckSquare className="h-3.5 w-3.5" /> : <ListChecks className="h-3.5 w-3.5" />} Selection
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 h-10 px-4">
                            <Filter className="h-3.5 w-3.5" /> Filter <ChevronDown className="h-3 w-3 opacity-40" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-4 flex-1 justify-end">
                        <div className="relative w-full max-w-sm group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                            <Input 
                                placeholder="Search tasks..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"
                            />
                        </div>
                        <Button onClick={() => setEditorOpen(true)} className="rounded-xl font-black uppercase tracking-widest h-11 px-8 shadow-xl active:scale-95 text-[10px]">
                            + New Task
                        </Button>
                    </div>
                </div>

                <AnimatePresence>
                    {isSelectionMode && selectedIds.length > 0 && (
                        <motion.div 
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 50, opacity: 0 }}
                            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]"
                        >
                            <Card className="bg-slate-900 text-white rounded-2xl border-none shadow-2xl p-2 flex items-center gap-4 ring-1 ring-white/10">
                                <span className="px-4 text-[10px] font-black uppercase tracking-widest border-r border-white/10">{selectedIds.length} Selected</span>
                                <div className="flex gap-1.5 p-1 bg-white/5 rounded-xl">
                                    <Button size="sm" variant="ghost" onClick={handleBulkComplete} className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 font-bold uppercase text-[9px] h-9 px-4">Resolve Bulk</Button>
                                    <Button size="sm" variant="ghost" onClick={handleBulkDelete} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-bold uppercase text-[9px] h-9 px-4">Purge Selected</Button>
                                    <Separator orientation="vertical" className="h-9 bg-white/10" />
                                    <Button size="icon" variant="ghost" onClick={() => setSelectedIds([])} className="h-9 w-9 text-white/40 hover:text-white"><X size={16} /></Button>
                                </div>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-12">
                    <TabsContent value="list" className="m-0 space-y-12">
                        {/* Grouped Lists by Status */}
                        {(['todo', 'in_progress', 'done'] as TaskStatus[]).map(status => {
                            const groupTasks = filteredTasks.filter(t => 
                                status === 'in_progress' ? (t.status !== 'todo' && t.status !== 'done') : t.status === status
                            );
                            
                            if (groupTasks.length === 0 && status === 'done') return null;

                            return (
                                <section key={status} className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                                            {status === 'todo' ? 'Backlog (To Do)' : status === 'done' ? 'Resolved Archive' : 'Active Tasks'}
                                        </h2>
                                        <button className="text-muted-foreground opacity-40 hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></button>
                                    </div>

                                    <div className="space-y-3">
                                        {isLoading ? (
                                            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
                                        ) : groupTasks.length > 0 ? groupTasks.map((task) => {
                                            const P = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                                            const daysLeft = differenceInDays(new Date(task.dueDate), new Date());
                                            const isOverdue = daysLeft < 0 && task.status !== 'done';
                                            const progress = getProgressValue(task.status);

                                            return (
                                                <div 
                                                    key={task.id} 
                                                    className={cn(
                                                        "group flex items-center gap-4 p-4 sm:p-5 bg-white rounded-[1.5rem] border border-border/50 hover:border-primary/30 transition-all hover:shadow-xl hover:-translate-y-0.5",
                                                        task.status === 'done' && "opacity-60"
                                                    )}
                                                >
                                                    {isSelectionMode && (
                                                        <Checkbox 
                                                            checked={selectedIds.includes(task.id)} 
                                                            onCheckedChange={() => toggleSelect(task.id)}
                                                            className="h-5 w-5 rounded-lg border-2"
                                                        />
                                                    )}
                                                    
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-col gap-0.5">
                                                            <h4 className={cn("text-base font-bold text-foreground leading-tight truncate", task.status === 'done' && "line-through")}>
                                                                {task.title}
                                                            </h4>
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                                {task.category} {task.schoolName && <>· <Building className="h-2.5 w-2.5" /> {task.schoolName}</>}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="hidden lg:flex items-center gap-6 px-8">
                                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/30 text-muted-foreground">
                                                            <Paperclip className="h-3 w-3" />
                                                            <span className="text-[10px] font-black tabular-nums">{task.attachments?.length || 0}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/30 text-muted-foreground">
                                                            <MessageSquare className="h-3 w-3" />
                                                            <span className="text-[10px] font-black tabular-nums">{task.notes?.length || 0}</span>
                                                        </div>
                                                    </div>

                                                    <div className="hidden sm:flex items-center gap-3 shrink-0">
                                                        <Badge variant="outline" className="h-6 rounded-lg font-black uppercase text-[8px] bg-slate-100 border-none px-2.5">
                                                            {STATUS_LABELS[task.status] || task.status}
                                                        </Badge>
                                                        <Badge variant="outline" className={cn("h-6 rounded-lg font-black uppercase text-[8px] border-none px-2.5", P.color)}>
                                                            {P.label}
                                                        </Badge>
                                                    </div>

                                                    <div className="hidden md:flex items-center gap-2 min-w-[120px] shrink-0">
                                                        <Clock className={cn("h-3.5 w-3.5", isOverdue ? "text-rose-600" : "text-muted-foreground/40")} />
                                                        <span className={cn("text-[10px] font-black uppercase tracking-tighter", isOverdue ? "text-rose-600 animate-pulse" : "text-muted-foreground/60")}>
                                                            {isOverdue ? 'Overdue' : daysLeft === 0 ? 'Due Today' : `${daysLeft} Days Left`}
                                                        </span>
                                                    </div>

                                                    <div className="hidden xl:flex items-center gap-4 min-w-[180px] shrink-0">
                                                        <div className="flex-1 space-y-1">
                                                            <Progress value={progress} className="h-1.5" />
                                                        </div>
                                                        <span className="text-[10px] font-black tabular-nums w-8 text-right opacity-40">{progress}%</span>
                                                    </div>

                                                    <div className="flex items-center justify-end shrink-0 pl-2">
                                                        <DropdownMenu modal={false}>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-40 group-hover:opacity-100 transition-opacity">
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-2xl">
                                                                <DropdownMenuLabel className="text-[10px] font-black uppercase text-muted-foreground px-3 py-2">Operational Logic</DropdownMenuLabel>
                                                                <DropdownMenuItem onClick={() => { setEditingTask(task); setEditorOpen(true); }} className="rounded-xl p-2.5 gap-3">
                                                                    <Pencil className="h-4 w-4 text-primary" /> <span className="font-bold text-sm uppercase">Modify Blueprint</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => setTaskToComplete(task)} className="rounded-xl p-2.5 gap-3">
                                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> <span className="font-bold text-sm uppercase">{task.status === 'done' ? 'Reopen Protocol' : 'Mark Resolved'}</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => handleDelete(task.id)} className="text-destructive rounded-xl p-2.5 gap-3 focus:bg-destructive/10">
                                                                    <Trash2 className="h-4 w-4" /> <span className="font-bold text-sm uppercase">Purge Protocol</span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="py-12 text-center border-2 border-dashed rounded-[2rem] bg-muted/10 opacity-30 flex flex-col items-center gap-2">
                                                <EyeOff className="h-8 w-8 text-muted-foreground" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">No matching tasks in this phase</p>
                                            </div>
                                        )}

                                        {status !== 'done' && (
                                            <button 
                                                onClick={() => {
                                                    setEditingTask({ status } as any);
                                                    setEditorOpen(true);
                                                }}
                                                className="w-full py-4 border-2 border-dashed border-border rounded-[1.5rem] flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white hover:border-primary/20 hover:text-primary transition-all group"
                                            >
                                                <Plus className="h-4 w-4 transition-transform group-hover:scale-125" /> Add New Task
                                            </button>
                                        )}
                                    </div>
                                </section>
                            );
                        })}
                    </TabsContent>

                    <TabsContent value="board" className="m-0 h-[calc(100vh-350px)]">
                        <TaskBoard tasks={filteredTasks} onTaskClick={(t) => { setEditingTask(t); setEditorOpen(true); }} />
                    </TabsContent>

                    <TabsContent value="calendar" className="m-0">
                        <TaskCalendar tasks={filteredTasks} onTaskClick={(t) => { setEditingTask(t); setEditorOpen(true); }} />
                    </TabsContent>
                </Tabs>
            </div>

            <TaskEditor 
                open={editorOpen} 
                onOpenChange={setEditorOpen} 
                task={editingTask}
                onSave={handleSaveTask}
                isSaving={isSaving}
            />

            <AlertDialog open={!!taskToComplete} onOpenChange={(o) => !o && setTaskToComplete(null)}>
                <AlertDialogContent className="rounded-[3rem] p-0 border-none shadow-2xl overflow-hidden">
                    <div className="p-10 text-center space-y-6">
                        <div className="mx-auto bg-primary/10 w-20 h-20 rounded-[1.5rem] flex items-center justify-center">
                            <CheckCircle2 className="h-10 w-10 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight">Resolve Task?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm font-medium text-muted-foreground px-4">
                                Confirming execution of <span className="font-bold text-foreground">"{taskToComplete?.title}"</span>. This will move the record to the archive.
                            </AlertDialogDescription>
                        </div>
                    </div>
                    <div className="bg-muted/30 p-6 border-t flex flex-col sm:flex-row gap-3">
                        <AlertDialogCancel className="rounded-xl font-bold h-12 flex-1 border-none shadow-sm">Discard</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmComplete} className="rounded-xl font-black h-12 flex-1 uppercase tracking-widest text-xs">
                            Commit Result
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function StatCard({ label, value, sub, icon: Icon, color, bg }: { label: string, value: string | number, sub: string, icon: any, color: string, bg: string }) {
    return (
        <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden group hover:ring-primary/20 transition-all text-left">
            <CardContent className="p-6 flex items-center gap-5">
                <div className={cn("p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-110 shadow-inner", bg, color)}>
                    <Icon className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1.5">{label}</p>
                    <p className="text-3xl font-black tabular-nums tracking-tighter truncate">{value}</p>
                    <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter mt-1 truncate">{sub}</p>
                </div>
            </CardContent>
        </Card>
    );
}