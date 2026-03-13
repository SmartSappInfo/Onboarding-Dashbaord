'use client';

import * as React from 'react';
import { collection, query, orderBy, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Task, UserProfile, School, TaskPriority, TaskCategory, TaskStatus } from '@/lib/types';
import { format, isToday, isPast, isTomorrow } from 'date-fns';
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
    ExternalLink,
    X,
    CheckSquare,
    ListChecks,
    ArrowRight,
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
    bulkCompleteTasks
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
    
    const [statusFilter, setStatusFilter] = React.useState<string>('pending');
    const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
    const [searchTerm, setSearchTerm] = React.useState('');

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
        return query(collection(firestore, 'tasks'), orderBy('dueDate', 'asc'), limit(100));
    }, [firestore]);

    const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const schoolsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'schools'), orderBy('name', 'asc')) : null, [firestore]);

    const { data: allTasks, isLoading: isLoadingTasks } = useCollection<Task>(tasksQuery);
    const { data: users } = useCollection<UserProfile>(usersQuery);
    const { data: schools } = useCollection<School>(schoolsQuery);

    const filteredTasks = React.useMemo(() => {
        if (!allTasks) return [];
        return allTasks.filter(task => {
            const matchesStatus = statusFilter === 'all' ? true : task.status === statusFilter;
            const matchesPriority = priorityFilter === 'all' ? true : task.priority === priorityFilter;
            
            // GLOBAL FILTER LOGIC
            let matchesAssigned = true;
            if (assignedUserId) {
                if (assignedUserId === 'unassigned') {
                    matchesAssigned = !task.assignedTo;
                } else {
                    matchesAssigned = task.assignedTo === assignedUserId;
                }
            }

            const matchesSearch = searchTerm ? 
                task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                task.schoolName?.toLowerCase().includes(searchTerm.toLowerCase()) 
                : true;
            return matchesStatus && matchesPriority && matchesAssigned && matchesSearch;
        });
    }, [allTasks, statusFilter, priorityFilter, assignedUserId, searchTerm]);

    const handleSaveTask = async (values: any) => {
        if (!firestore || !currentUser) return;
        setIsSaving(true);

        const assignedUser = users?.find(u => u.id === values.assignedTo);
        const school = schools?.find(s => s.id === values.schoolId);
        
        const taskData = {
            ...values,
            schoolId: values.schoolId === 'none' ? null : values.schoolId,
            schoolName: values.schoolId !== 'none' ? school?.name : null,
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
                    type: 'school_updated',
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

    const handleConfirmComplete = () => {
        if (!firestore || !taskToComplete) return;
        
        if (taskToComplete.status === 'completed') {
            updateTaskNonBlocking(firestore, taskToComplete.id, { status: 'pending', completedAt: undefined });
            toast({ title: 'Task Reopened' });
        } else {
            completeTaskNonBlocking(firestore, taskToComplete.id);
            toast({ title: 'Task Resolved' });
        }
        setTaskToComplete(null);
    };

    const handleDelete = (id: string) => {
        if (!firestore || !confirm('Are you sure you want to delete this task?')) return;
        deleteTaskNonBlocking(firestore, id);
        toast({ title: 'Task Deleted' });
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
        if (!firestore || selectedIds.length === 0 || !confirm(`Delete ${selectedIds.length} tasks?`)) return;
        setIsBulkProcessing(true);
        try {
            await bulkDeleteTasks(firestore, selectedIds);
            toast({ title: 'Bulk Deletion Success', description: 'Records purged.' });
            setSelectedIds([]);
            setIsSelectionMode(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Bulk Deletion Failed' });
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleSelectAll = () => {
        if (selectedIds.length === filteredTasks.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredTasks.map(t => t.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const getDueLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isToday(date)) return <span className="text-orange-600 font-bold">Today</span>;
        if (isTomorrow(date)) return <span>Tomorrow</span>;
        if (isPast(date)) return <span className="text-rose-600 font-bold">Overdue</span>;
        return format(date, 'MMM d');
    };

    const getInterlinkUrl = (task: Task) => {
        if (!task.relatedEntityType || !task.relatedEntityId) return null;
        if (task.relatedEntityType === 'SurveyResponse' && task.relatedParentId) {
            return `/admin/surveys/${task.relatedParentId}/results/${task.relatedEntityId}`;
        }
        if (task.relatedEntityType === 'Submission' && task.relatedParentId) {
            return `/admin/pdfs/${task.relatedParentId}/submissions/${task.relatedEntityId}`;
        }
        return null;
    };

    const isLoading = isLoadingTasks || isLoadingFilter;

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-6xl mx-auto space-y-8 pb-32">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="text-left">
                        <h1 className="text-3xl font-black tracking-tight text-foreground uppercase flex items-center gap-3">
                            <CheckCircle2 className="h-8 w-8 text-primary" />
                            Operational Tasks
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">Manage CRM interventions and multi-scale follow-ups.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isSelectionMode && (
                            <Button variant="ghost" onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="font-bold text-muted-foreground gap-2">
                                <X className="h-4 w-4" /> Cancel Selection
                            </Button>
                        )}
                        <Button onClick={() => setEditorOpen(true)} className="rounded-xl font-black uppercase tracking-widest shadow-lg h-12 px-8 transition-all active:scale-95">
                            <Plus className="mr-2 h-5 w-5" /> New Task
                        </Button>
                    </div>
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
                        
                        <div className="flex items-center gap-2 px-4 h-11 rounded-xl bg-primary/5 border border-primary/10">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-primary/60">Filtered For:</Label>
                            <Badge variant="outline" className="h-6 font-black uppercase text-[9px] border-primary/20 bg-white text-primary">
                                {assignedUserId === 'unassigned' ? 'Unassigned' : users?.find(u => u.id === assignedUserId)?.name || 'Everyone'}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    {isSelectionMode && !isLoading && filteredTasks.length > 0 && (
                        <div className="flex items-center gap-2 px-2 pb-2 animate-in fade-in slide-in-from-left-2">
                            <Checkbox 
                                id="select-all"
                                checked={selectedIds.length === filteredTasks.length && filteredTasks.length > 0} 
                                onCheckedChange={handleSelectAll} 
                                className="h-5 w-5 rounded-md"
                            />
                            <Label htmlFor="select-all" className="text-[10px] font-black uppercase tracking-widest text-primary ml-2">Select All Visible Records</Label>
                        </div>
                    )}

                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                        ))
                    ) : filteredTasks.length > 0 ? (
                        filteredTasks.map((task) => {
                            const P = PRIORITY_CONFIG[task.priority];
                            const CatIcon = CATEGORY_ICONS[task.category];
                            const isDone = task.status === 'completed';
                            const interlinkUrl = getInterlinkUrl(task);
                            const isSelected = selectedIds.includes(task.id);

                            return (
                                <div key={task.id} className="flex items-center gap-4">
                                    <AnimatePresence mode="popLayout">
                                        {isSelectionMode && (
                                            <motion.div 
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="shrink-0"
                                            >
                                                <Checkbox 
                                                    checked={isSelected} 
                                                    onCheckedChange={() => toggleSelect(task.id)}
                                                    className="h-6 w-6 rounded-lg border-2 shadow-sm"
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <Card 
                                        className={cn(
                                            "flex-1 group overflow-hidden border-border/50 hover:shadow-xl transition-all duration-300 rounded-2xl bg-card",
                                            isDone && "opacity-60 grayscale-[0.5]",
                                            isSelected && "border-primary/40 bg-primary/[0.02] shadow-md ring-1 ring-primary/10"
                                        )}
                                    >
                                        <div className="p-5 flex items-start gap-5">
                                            <div className="flex flex-col items-center gap-4 pt-1">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button 
                                                                onClick={() => setTaskToComplete(task)} 
                                                                className={cn("shrink-0 transition-all active:scale-90", isDone ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500")}
                                                            >
                                                                {isDone ? <CheckCircle2 className="h-6 w-6" /> : <Square className="h-6 w-6 opacity-40 group-hover:opacity-100" />}
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="right">
                                                            {isDone ? 'Reopen Task' : 'Mark as Complete'}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
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
                                                    {interlinkUrl && (
                                                        <Badge variant="outline" className="text-[8px] font-black uppercase h-5 border-blue-200 bg-blue-50 text-blue-600 gap-1">
                                                            <ExternalLink className="h-2 w-2" /> Record Linked
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground font-medium line-clamp-1">{task.description}</p>
                                                
                                                <div className="flex items-center gap-6 pt-3">
                                                    {task.schoolName && (
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                                                            <Building className="h-3 w-3" /> {task.schoolName}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                                                        <CatIcon className="h-3 w-3" /> {task.category}
                                                    </div>
                                                    <div className={cn(
                                                        "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border shadow-xs transition-all",
                                                        isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) ? "bg-rose-50 border-rose-100 text-rose-600" : "bg-primary/5 border-primary/10 text-primary"
                                                    )}>
                                                        <Calendar className="h-3 w-3" /> Due {getDueLabel(task.dueDate)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end gap-4 shrink-0 self-stretch justify-between">
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {interlinkUrl && (
                                                        <Button variant="outline" size="sm" asChild className="h-8 rounded-lg font-black text-[9px] uppercase tracking-tighter gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50">
                                                            <Link href={interlinkUrl}>
                                                                Open Record <ArrowRight className="h-3 w-3" />
                                                            </Link>
                                                        </Button>
                                                    )}
                                                    <DropdownMenu modal={false}>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreVertical className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-56 rounded-xl border-none shadow-2xl">
                                                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">Operational Context</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => { setEditingTask(task); setEditorOpen(true); }} className="gap-3 rounded-lg p-2.5">
                                                                <Pencil className="h-4 w-4 text-primary" /> Edit Details
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => { setIsSelectionMode(true); toggleSelect(task.id); }} className="gap-3 rounded-lg p-2.5">
                                                                <CheckSquare className="h-4 w-4 text-primary" /> Select Multiple
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => toast({ title: 'Reminder Sent' })} className="gap-3 rounded-lg p-2.5">
                                                                <Send className="h-4 w-4 text-primary" /> Dispatch Reminder
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleDelete(task.id)} className="text-destructive gap-3 rounded-lg p-2.5 focus:bg-destructive/10 focus:text-destructive">
                                                                <Trash2 className="h-4 w-4" /> Delete Task
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                                <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-xl border border-border/50">
                                                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter px-1">{task.assignedToName?.split(' ')[0]}</span>
                                                    <Avatar className="h-6 w-6 border-2 border-white shadow-sm">
                                                        <AvatarImage src={`https://i.pravatar.cc/150?u=${task.assignedTo}`} />
                                                        <AvatarFallback className="text-[8px] font-black">{getInitials(task.assignedToName)}</AvatarFallback>
                                                    </Avatar>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            );
                        })
                    ) : (
                        <div className="py-32 text-center border-4 border-dashed rounded-[4rem] bg-muted/10 flex flex-col items-center justify-center gap-4 opacity-30">
                            <CheckCircle2 className="h-16 w-16 text-muted-foreground" />
                            <p className="font-black uppercase tracking-widest text-sm">No active protocols identified</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bulk Actions Bar */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div 
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4"
                    >
                        <Card className="bg-slate-900 text-white border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] rounded-[2rem] overflow-hidden">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4 pl-4">
                                    <div className="flex items-center justify-center h-10 w-10 bg-primary/20 rounded-xl">
                                        <ListChecks className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black uppercase tracking-tight">{selectedIds.length} Tasks Selected</span>
                                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Bulk CRM Interventions</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        onClick={handleBulkComplete} 
                                        disabled={isBulkProcessing}
                                        className="rounded-xl font-black uppercase text-[10px] tracking-widest h-11 px-6 bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        {isBulkProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                        Mark Done
                                    </Button>
                                    <Button 
                                        onClick={handleBulkDelete} 
                                        disabled={isBulkProcessing}
                                        className="rounded-xl font-black uppercase text-[10px] tracking-widest h-11 px-6 bg-rose-600/20 text-rose-500 hover:bg-rose-600 hover:text-white border border-rose-600/30"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => { setSelectedIds([]); setIsSelectionMode(false); }}
                                        className="h-11 w-11 rounded-xl text-white/40 hover:text-white hover:bg-white/10"
                                    >
                                        <X className="h-5 w-5" />
                                    </Button>
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

            {/* Completion Safety Gate */}
            <AlertDialog open={!!taskToComplete} onOpenChange={(o) => !o && setTaskToComplete(null)}>
                <AlertDialogContent className="rounded-[2rem]">
                    <AlertDialogHeader>
                        <div className="mx-auto bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                            <CheckCircle2 className="h-6 w-6 text-primary" />
                        </div>
                        <AlertDialogTitle className="text-center font-black uppercase tracking-tight">Resolve Intervention?</AlertDialogTitle>
                        <AlertDialogDescription className="text-center">
                            Confirm resolution of <span className="font-bold text-foreground">"{taskToComplete?.title}"</span>. 
                            This action will update the school's audit trail.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:justify-center gap-3 mt-4">
                        <AlertDialogCancel className="rounded-xl font-bold px-8">Review</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmComplete} className="rounded-xl font-black px-10 shadow-xl shadow-primary/20">
                            Confirm Resolution
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
