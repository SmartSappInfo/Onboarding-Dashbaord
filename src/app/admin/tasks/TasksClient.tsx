
'use client';

import * as React from 'react';
import { collection, query, orderBy, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Task, UserProfile, School, TaskPriority, TaskCategory, TaskStatus } from '@/lib/types';
import { format, isToday, isPast, isTomorrow, isValid } from 'date-fns';
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
    MoreVertical,
    Trash2,
    Calendar,
    Plus,
    Loader2,
    Search,
    Pencil,
    Send,
    ArrowRight,
    X,
    CheckSquare,
    ListChecks,
    History,
    Zap,
    Layers,
    Bell,
    User as UserIcon,
    AlertCircle,
    Square
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
    bulkUpdateTasks
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import TaskEditor from './components/TaskEditor';
import TaskBoard from './components/TaskBoard';
import { logActivity } from '@/lib/activity-logger';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PRIORITY_CONFIG: Record<TaskPriority, { label: string, color: string, icon: any }> = {
    urgent: { label: 'Urgent', color: 'text-rose-600 bg-rose-50 border-rose-200', icon: ShieldAlert },
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

const STATUS_LABELS: Record<TaskStatus, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    waiting: 'Waiting',
    review: 'Review',
    done: 'Done'
};

const getInitials = (name?: string | null) =>
  name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?';

export default function TasksClient() {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const { toast } = useToast();
    const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
    
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
        if (!firestore) return null;
        return query(collection(firestore, 'tasks'), orderBy('dueDate', 'asc'), limit(200));
    }, [firestore]);

    const usersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('isAuthorized', '==', true)) : null, [firestore]);
    const schoolsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'schools'), orderBy('name', 'asc')) : null, [firestore]);

    const { data: allTasks, isLoading: isLoadingTasks } = useCollection<Task>(tasksQuery);
    const { data: users } = useCollection<UserProfile>(usersQuery);
    const { data: schools } = useCollection<School>(schoolsQuery);

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
                matchesSmart = isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && task.status !== 'done';
            }

            return matchesStatus && matchesPriority && matchesAssigned && matchesSearch && matchesSmart;
        });
    }, [allTasks, statusFilter, priorityFilter, assignedUserId, searchTerm, smartFilter]);

    // Derived Stats
    const metrics = React.useMemo(() => {
        if (!allTasks) return { today: 0, overdue: 0, mine: 0 };
        return {
            today: allTasks.filter(t => isToday(new Date(t.dueDate)) && t.status !== 'done').length,
            overdue: allTasks.filter(t => isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)) && t.status !== 'done').length,
            mine: allTasks.filter(t => t.assignedTo === currentUser?.uid && t.status !== 'done').length
        };
    }, [allTasks, currentUser]);

    const handleSaveTask = async (payload: any) => {
        if (!firestore || !currentUser) return;
        setIsSaving(true);

        try {
            if (editingTask) {
                updateTaskNonBlocking(firestore, editingTask.id, payload);
                toast({ title: 'Task Architecture Synchronized' });
            } else {
                await createTaskNonBlocking(firestore, payload);
                toast({ title: 'Mission Initialized' });
            }
            setEditorOpen(false);
            setEditingTask(null);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Operation Failed' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmComplete = () => {
        if (!firestore || !taskToComplete) return;
        
        if (taskToComplete.status === 'done') {
            updateTaskNonBlocking(firestore, taskToComplete.id, { status: 'todo', completedAt: undefined });
            toast({ title: 'Mission Reopened' });
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

    const handleSelectAll = () => {
        if (selectedIds.length === filteredTasks.length) setSelectedIds([]);
        else setSelectedIds(filteredTasks.map(t => t.id));
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const getDueLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isToday(date)) return <span className="text-orange-600 font-black uppercase tracking-tighter">Today</span>;
        if (isTomorrow(date)) return <span className="text-blue-600 font-bold">Tomorrow</span>;
        if (isPast(date)) return <span className="text-rose-600 font-black uppercase tracking-tighter animate-pulse">Overdue</span>;
        return format(date, 'MMM d');
    };

    const getInterlinkUrl = (task: Task) => {
        if (!task.relatedEntityType || !task.relatedEntityId) return null;
        if (task.relatedEntityType === 'SurveyResponse' && task.relatedParentId) return `/admin/surveys/${task.relatedParentId}/results/${task.relatedEntityId}`;
        if (task.relatedEntityType === 'Submission' && task.relatedParentId) return `/admin/pdfs/${task.relatedParentId}/submissions/${task.relatedEntityId}`;
        return null;
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-6xl mx-auto space-y-10 pb-32">
                
                {/* Executive Action Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase flex items-center gap-4">
                            <CheckCircle2 className="h-10 w-10 text-primary" />
                            Mission Command
                        </h1>
                        <p className="text-muted-foreground font-medium text-lg mt-1">Institutional task force and operational oversight hub.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsSelectionMode(!isSelectionMode)} 
                            className={cn(
                                "rounded-xl font-black uppercase text-[10px] tracking-widest h-12 px-6 transition-all border-primary/20 text-primary",
                                isSelectionMode && "bg-primary text-white border-primary shadow-xl"
                            )}
                        >
                            <ListChecks className="mr-2 h-4 w-4" />
                            {isSelectionMode ? 'Selection Active' : 'Batch Selection'}
                        </Button>
                        <Button onClick={() => setEditorOpen(true)} className="rounded-xl font-black uppercase tracking-[0.1em] shadow-xl h-12 px-10 transition-all active:scale-95 text-xs">
                            <Plus className="mr-2 h-5 w-5" /> Initialize Mission
                        </Button>
                    </div>
                </div>

                {/* Smart Filter Dashboard */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button 
                        onClick={() => setSmartFilter(smartFilter === 'overdue' ? 'none' : 'overdue')}
                        className={cn(
                            "flex items-center gap-5 p-6 rounded-[2rem] border-none ring-1 transition-all group overflow-hidden relative",
                            smartFilter === 'overdue' ? "ring-rose-500 bg-rose-50 shadow-xl" : "ring-border bg-white hover:ring-rose-500/30"
                        )}
                    >
                        <div className={cn("p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-110", smartFilter === 'overdue' ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-600")}>
                            <ShieldAlert className="h-7 w-7" />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1.5">Critical Delays</p>
                            <p className="text-3xl font-black tabular-nums tracking-tighter text-rose-600">{metrics.overdue}</p>
                            <p className="text-[9px] font-bold text-rose-800/40 uppercase tracking-tighter mt-1">Pending Resolution</p>
                        </div>
                        {smartFilter === 'overdue' && <div className="absolute top-4 right-4"><Badge className="bg-rose-600 border-none font-black text-[8px] uppercase h-5">Active Filter</Badge></div>}
                    </button>

                    <button 
                        onClick={() => setSmartFilter(smartFilter === 'today' ? 'none' : 'today')}
                        className={cn(
                            "flex items-center gap-5 p-6 rounded-[2rem] border-none ring-1 transition-all group overflow-hidden relative",
                            smartFilter === 'today' ? "ring-orange-500 bg-orange-50 shadow-xl" : "ring-border bg-white hover:ring-orange-500/30"
                        )}
                    >
                        <div className={cn("p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-110", smartFilter === 'today' ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-600")}>
                            <Zap className="h-7 w-7" />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1.5">Active Targets</p>
                            <p className="text-3xl font-black tabular-nums tracking-tighter text-orange-600">{metrics.today}</p>
                            <p className="text-[9px] font-bold text-orange-800/40 uppercase tracking-tighter mt-1">Due Cycle: Today</p>
                        </div>
                        {smartFilter === 'today' && <div className="absolute top-4 right-4"><Badge className="bg-orange-600 border-none font-black text-[8px] uppercase h-5">Active Filter</Badge></div>}
                    </button>

                    <Card className="rounded-[2rem] border-none ring-1 ring-border bg-white shadow-sm flex items-center p-6 gap-5">
                        <div className="p-4 bg-primary/10 rounded-2xl text-primary shrink-0">
                            <UserIcon className="h-7 w-7" />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1.5">Your Load</p>
                            <p className="text-3xl font-black tabular-nums tracking-tighter">{metrics.mine}</p>
                            <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter mt-1">Personal Directives</p>
                        </div>
                    </Card>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card p-4 rounded-[2.5rem] border shadow-sm ring-1 ring-black/5">
                        <TabsList className="bg-muted/50 p-1.5 h-12 rounded-2xl shrink-0 border shadow-inner">
                            <TabsTrigger value="list" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg">
                                <ListChecks className="h-4 w-4" /> Register
                            </TabsTrigger>
                            <TabsTrigger value="board" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg">
                                <Layers className="h-4 w-4" /> Board View
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex flex-wrap items-center gap-4 flex-1 justify-end">
                            <div className="relative w-full max-w-sm group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-20 group-focus-within:text-primary group-focus-within:opacity-100 transition-all" />
                                <Input 
                                    placeholder="Search mission title or campus..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-11 h-12 rounded-2xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[160px] h-12 rounded-2xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all">Global Status</SelectItem>
                                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <TabsContent value="list" className="m-0 space-y-4 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {isSelectionMode && !isLoading && filteredTasks.length > 0 && (
                            <div className="flex items-center gap-2 px-4 pb-2">
                                <Checkbox 
                                    id="select-all"
                                    checked={selectedIds.length === filteredTasks.length && filteredTasks.length > 0} 
                                    onCheckedChange={handleSelectAll} 
                                    className="h-5 w-5 rounded-md border-2"
                                />
                                <Label htmlFor="select-all" className="text-[10px] font-black uppercase tracking-widest text-primary ml-2 cursor-pointer">Mark All Visible Protocols</Label>
                            </div>
                        )}

                        <div className="space-y-4">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <Skeleton key={i} className="h-28 w-full rounded-[2rem] shadow-sm" />
                                ))
                            ) : filteredTasks.length > 0 ? (
                                filteredTasks.map((task) => {
                                    const P = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                                    const CatIcon = CATEGORY_ICONS[task.category] || CheckCircle2;
                                    const isDone = task.status === 'done';
                                    const interlinkUrl = getInterlinkUrl(task);
                                    const isSelected = selectedIds.includes(task.id);

                                    return (
                                        <div key={task.id} className="flex items-center gap-4 group">
                                            <AnimatePresence mode="popLayout">
                                                {isSelectionMode && (
                                                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="shrink-0">
                                                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(task.id)} className="h-6 w-6 rounded-lg border-2 shadow-sm" />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            <Card className={cn(
                                                "flex-1 overflow-hidden border-border/50 transition-all duration-500 rounded-[2.5rem] bg-card relative",
                                                isDone && "opacity-60 grayscale-[0.5] bg-muted/10",
                                                isSelected ? "border-primary shadow-xl ring-1 ring-primary/20 scale-[1.01]" : "hover:shadow-2xl hover:border-primary/20"
                                            )}>
                                                <div className="p-6 sm:p-8 flex items-start gap-6">
                                                    <div className="flex flex-col items-center gap-4 pt-1 shrink-0">
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button onClick={() => setTaskToComplete(task)} className={cn("shrink-0 transition-all active:scale-90 p-1 rounded-full", isDone ? "text-emerald-500" : "text-muted-foreground opacity-20 hover:opacity-100 hover:text-emerald-500")}>
                                                                        {isDone ? <CheckCircle2 className="h-8 w-8" /> : <Square className="h-8 w-8" />}
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="right">{isDone ? 'Reopen Protocol' : 'Execute Resolution'}</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                    
                                                    <div className="flex-grow min-w-0 space-y-2">
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            <h3 className={cn("text-xl font-black tracking-tight uppercase leading-none text-foreground", isDone && "line-through opacity-40")}>{task.title}</h3>
                                                            <Badge variant="outline" className={cn("text-[8px] font-black uppercase h-5 px-3 rounded-full border-none shadow-sm", P.color)}>
                                                                <P.icon className="h-2.5 w-2.5 mr-1.5" /> {P.label}
                                                            </Badge>
                                                            {task.reminders?.length > 0 && (
                                                                <Badge variant="outline" className="text-[8px] font-black uppercase h-5 border-primary/20 text-primary gap-1.5 bg-primary/5 rounded-full px-2.5">
                                                                    <Bell className="h-2.5 w-2.5" /> {task.reminders.length} Alarms
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground font-medium line-clamp-1 opacity-80">{task.description}</p>
                                                        
                                                        <div className="flex flex-wrap items-center gap-6 pt-4">
                                                            {task.schoolName && <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest"><Building className="h-3.5 w-3.5 text-primary/40" /> {task.schoolName}</div>}
                                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest"><CatIcon className="h-3.5 w-3.5" /> {task.category}</div>
                                                            <div className={cn("flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border shadow-inner transition-all", isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && !isDone ? "bg-rose-50 border-rose-100 text-rose-600" : "bg-muted/30 border-border text-foreground")}>
                                                                <Calendar className="h-3.5 w-3.5 opacity-40" /> Due {getDueLabel(task.dueDate)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-end gap-6 shrink-0 self-stretch justify-between">
                                                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {interlinkUrl && (
                                                                <Button variant="outline" size="sm" asChild className="h-9 rounded-xl font-black text-[9px] uppercase tracking-widest gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 shadow-sm">
                                                                    <Link href={interlinkUrl}>Open Record <ArrowRight className="h-3 w-3" /></Link>
                                                                </Button>
                                                            )}
                                                            <DropdownMenu modal={false}>
                                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted transition-colors"><MoreVertical className="h-4 w-4 text-muted-foreground" /></Button></DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-60 rounded-2xl border-none shadow-2xl p-2 animate-in zoom-in-95 duration-200">
                                                                    <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">Operational Context</DropdownMenuLabel>
                                                                    <DropdownMenuItem onClick={() => { setEditingTask(task); setEditorOpen(true); }} className="gap-3 rounded-xl p-3 font-bold text-sm"><Pencil className="h-4 w-4 text-primary" /> Modify Architecture</DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => { setIsSelectionMode(true); toggleSelect(task.id); }} className="gap-3 rounded-xl p-3 font-bold text-sm"><CheckSquare className="h-4 w-4 text-primary" /> Bulk Overlay Mode</DropdownMenuItem>
                                                                    <DropdownMenuSeparator className="my-2" />
                                                                    <DropdownMenuItem onClick={() => handleDelete(task.id)} className="text-destructive gap-3 rounded-xl p-3 font-bold text-sm focus:bg-destructive/10 focus:text-destructive"><Trash2 className="h-4 w-4" /> Purge Protocol</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="flex items-center gap-2.5 bg-muted/30 p-1.5 pr-3 rounded-2xl border border-border/50 shadow-inner">
                                                                        <Avatar className="h-7 w-7 border-2 border-white shadow-sm shrink-0">
                                                                            <AvatarImage src={`https://i.pravatar.cc/150?u=${task.assignedTo}`} />
                                                                            <AvatarFallback className="text-[8px] font-black">{getInitials(task.assignedToName)}</AvatarFallback>
                                                                        </Avatar>
                                                                        <span className="text-[10px] font-black uppercase text-foreground tracking-widest truncate max-w-[80px]">{task.assignedToName?.split(' ')[0]}</span>
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left">Owner: {task.assignedToName}</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                </div>
                                            </Card>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="py-40 text-center border-4 border-dashed rounded-[4rem] bg-muted/10 flex flex-col items-center justify-center gap-6 opacity-30">
                                    <div className="p-8 bg-background rounded-full shadow-inner ring-8 ring-muted/5">
                                        <CheckCircle2 className="h-20 w-20 text-muted-foreground" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-black uppercase tracking-[0.3em] text-sm">Registry Clear</p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest">No matching protocols identified in this segment.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="board" className="m-0 outline-none h-[calc(100vh-350px)]">
                        <TaskBoard 
                            tasks={filteredTasks} 
                            onTaskClick={(t) => { setEditingTask(t); setEditorOpen(true); }}
                        />
                    </TabsContent>
                </Tabs>
            </div>

            {/* BULK ACTION CONSOLE */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4">
                        <Card className="bg-slate-900 text-white border-none shadow-[0_40px_100px_-15px_rgba(0,0,0,0.6)] rounded-[2.5rem] overflow-hidden ring-1 ring-white/10 backdrop-blur-xl">
                            <CardContent className="p-4 flex items-center justify-between gap-8">
                                <div className="flex items-center gap-5 pl-6 border-r border-white/10 pr-8">
                                    <div className="flex items-center justify-center h-12 w-12 bg-primary/20 rounded-2xl text-primary animate-pulse shadow-lg">
                                        <ListChecks className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-lg font-black uppercase tracking-tight tabular-nums">{selectedIds.length} Selection{selectedIds.length > 1 ? 's' : ''}</span>
                                        <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Batch Intervention Phase</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button onClick={handleBulkComplete} disabled={isBulkProcessing} className="rounded-xl font-black uppercase text-[10px] tracking-widest h-12 px-8 bg-emerald-600 hover:bg-emerald-700 shadow-2xl transition-all active:scale-95 border-none">
                                        {isBulkProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Resolve Selected
                                    </Button>
                                    <Button onClick={handleBulkDelete} disabled={isBulkProcessing} className="rounded-xl font-black uppercase text-[10px] tracking-widest h-12 px-8 bg-white/5 hover:bg-rose-600 text-white border border-white/10 transition-all active:scale-95">
                                        <Trash2 className="h-4 w-4 mr-2 text-rose-500 group-hover:text-white" /> Purge Records
                                    </Button>
                                    <button onClick={() => { setSelectedIds([]); setIsSelectionMode(false); }} className="h-12 w-12 flex items-center justify-center rounded-xl text-white/30 hover:text-white hover:bg-white/10 transition-colors">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            <TaskEditor 
                open={editorOpen} 
                onOpenChange={setEditorOpen} 
                task={editingTask}
                onSave={handleSaveTask}
                isSaving={isSaving}
            />

            <AlertDialog open={!!taskToComplete} onOpenChange={(o) => !o && setTaskToComplete(null)}>
                <AlertDialogContent className="rounded-[3rem] p-0 border-none shadow-2xl overflow-hidden bg-background">
                    <div className="p-10 text-center space-y-8">
                        <div className="mx-auto bg-primary/10 w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-xl shadow-primary/5">
                            <CheckCircle2 className="h-12 w-12 text-primary animate-in zoom-in duration-500" />
                        </div>
                        <div className="space-y-3">
                            <AlertDialogTitle className="text-3xl font-black uppercase tracking-tight">Sync Protocol Outcome?</AlertDialogTitle>
                            <AlertDialogDescription className="text-base font-medium text-muted-foreground px-4">
                                Confirming execution of <span className="font-bold text-foreground">"{taskToComplete?.title}"</span>. This will move the record to the permanent institutional archive.
                            </AlertDialogDescription>
                        </div>
                    </div>
                    <div className="bg-muted/30 p-8 border-t flex flex-col sm:flex-row gap-4">
                        <AlertDialogCancel className="rounded-xl font-bold h-12 flex-1 border-none shadow-sm">Review Blueprint</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmComplete} className="rounded-xl font-black h-12 flex-1 shadow-xl shadow-primary/20 uppercase tracking-widest text-xs">
                            Commit Resolution
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
