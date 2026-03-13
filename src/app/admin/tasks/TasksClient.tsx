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
    Square,
    History,
    Zap,
    Layout,
    Layers
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
    
    const [statusFilter, setStatusFilter] = React.useState<string>('all');
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
            return matchesStatus && matchesPriority && matchesAssigned && matchesSearch;
        });
    }, [allTasks, statusFilter, priorityFilter, assignedUserId, searchTerm]);

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
        if (isToday(date)) return <span className="text-orange-600 font-bold">Today</span>;
        if (isTomorrow(date)) return <span>Tomorrow</span>;
        if (isPast(date)) return <span className="text-rose-600 font-bold">Overdue</span>;
        return format(date, 'MMM d');
    };

    const getInterlinkUrl = (task: Task) => {
        if (!task.relatedEntityType || !task.relatedEntityId) return null;
        if (task.relatedEntityType === 'SurveyResponse' && task.relatedParentId) return `/admin/surveys/${task.relatedParentId}/results/${task.relatedEntityId}`;
        if (task.relatedEntityType === 'Submission' && task.relatedParentId) return `/admin/pdfs/${task.relatedParentId}/submissions/${task.relatedEntityId}`;
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
                            Command Hub
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
                            <Plus className="mr-2 h-5 w-5" /> New Mission
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue="list" className="space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card p-4 rounded-3xl border shadow-sm ring-1 ring-black/5">
                        <TabsList className="bg-muted/50 p-1 h-11 rounded-2xl shrink-0">
                            <TabsTrigger value="list" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-6 gap-2">
                                <ListChecks className="h-4 w-4" /> Register
                            </TabsTrigger>
                            <TabsTrigger value="board" disabled className="rounded-xl font-black uppercase text-[10px] tracking-widest px-6 gap-2 opacity-40">
                                <Layers className="h-4 w-4" /> Kanban
                            </TabsTrigger>
                            <TabsTrigger value="calendar" disabled className="rounded-xl font-black uppercase text-[10px] tracking-widest px-6 gap-2 opacity-40">
                                <Calendar className="h-4 w-4" /> Planning
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex flex-wrap items-center gap-4 flex-1 justify-end">
                            <div className="relative w-full max-w-sm group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-20 group-focus-within:text-primary group-focus-within:opacity-100 transition-all" />
                                <Input 
                                    placeholder="Filter mission registry..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-10 h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[140px] h-11 rounded-xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all">Global Status</SelectItem>
                                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <TabsContent value="list" className="m-0 space-y-4">
                        {isSelectionMode && !isLoading && filteredTasks.length > 0 && (
                            <div className="flex items-center gap-2 px-2 pb-2 animate-in fade-in slide-in-from-left-2">
                                <Checkbox 
                                    id="select-all"
                                    checked={selectedIds.length === filteredTasks.length && filteredTasks.length > 0} 
                                    onCheckedChange={handleSelectAll} 
                                    className="h-5 w-5 rounded-md"
                                />
                                <Label htmlFor="select-all" className="text-[10px] font-black uppercase tracking-widest text-primary ml-2">Select All Visible Protocols</Label>
                            </div>
                        )}

                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-24 w-full rounded-2xl shadow-sm" />
                            ))
                        ) : filteredTasks.length > 0 ? (
                            filteredTasks.map((task) => {
                                const P = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                                const CatIcon = CATEGORY_ICONS[task.category] || CheckCircle2;
                                const isDone = task.status === 'done';
                                const interlinkUrl = getInterlinkUrl(task);
                                const isSelected = selectedIds.includes(task.id);

                                return (
                                    <div key={task.id} className="flex items-center gap-4">
                                        <AnimatePresence mode="popLayout">
                                            {isSelectionMode && (
                                                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="shrink-0">
                                                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(task.id)} className="h-6 w-6 rounded-lg border-2 shadow-sm" />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <Card className={cn(
                                            "flex-1 group overflow-hidden border-border/50 hover:shadow-xl transition-all duration-300 rounded-2xl bg-card",
                                            isDone && "opacity-60 grayscale-[0.5]",
                                            isSelected && "border-primary/40 bg-primary/[0.02] shadow-md ring-1 ring-primary/10"
                                        )}>
                                            <div className="p-5 flex items-start gap-5">
                                                <div className="flex flex-col items-center gap-4 pt-1">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <button onClick={() => setTaskToComplete(task)} className={cn("shrink-0 transition-all active:scale-90", isDone ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500")}>
                                                                    {isDone ? <CheckCircle2 className="h-6 w-6" /> : <Square className="h-6 w-6 opacity-40 group-hover:opacity-100" />}
                                                                </button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="right">{isDone ? 'Reopen Protocol' : 'Mark as Resolved'}</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                                
                                                <div className="flex-grow min-w-0 space-y-1">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <h3 className={cn("text-lg font-black tracking-tight uppercase leading-none", isDone && "line-through text-muted-foreground")}>{task.title}</h3>
                                                        <Badge variant="outline" className={cn("text-[8px] font-black uppercase h-5 px-2", P.color)}>
                                                            <P.icon className="h-2.5 w-2.5 mr-1" /> {P.label}
                                                        </Badge>
                                                        {task.reminders?.length > 0 && (
                                                            <Badge variant="outline" className="text-[8px] font-black uppercase h-5 border-primary/20 text-primary gap-1.5 bg-primary/5">
                                                                <Bell className="h-2.5 w-2.5" /> {task.reminders.length} Alarms Active
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground font-medium line-clamp-1">{task.description}</p>
                                                    
                                                    <div className="flex items-center gap-6 pt-3">
                                                        {task.schoolName && <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tight"><Building className="h-3 w-3" /> {task.schoolName}</div>}
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tight"><CatIcon className="h-3 w-3" /> {task.category}</div>
                                                        <div className={cn("flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border shadow-xs transition-all", isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && !isDone ? "bg-rose-50 border-rose-100 text-rose-600" : "bg-primary/5 border-primary/10 text-primary")}>
                                                            <Calendar className="h-3 w-3" /> Due {getDueLabel(task.dueDate)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end gap-4 shrink-0 self-stretch justify-between">
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {interlinkUrl && (
                                                            <Button variant="outline" size="sm" asChild className="h-8 rounded-lg font-black text-[9px] uppercase tracking-tighter gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50">
                                                                <Link href={interlinkUrl}>Open Record <ArrowRight className="h-3 w-3" /></Link>
                                                            </Button>
                                                        )}
                                                        <DropdownMenu modal={false}>
                                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted transition-colors"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-56 rounded-xl border-none shadow-2xl p-2 animate-in zoom-in-95 duration-200">
                                                                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">Operational Context</DropdownMenuLabel>
                                                                <DropdownMenuItem onClick={() => { setEditingTask(task); setEditorOpen(true); }} className="gap-3 rounded-lg p-2.5"><Pencil className="h-4 w-4 text-primary" /> Modify Architecture</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => { setIsSelectionMode(true); toggleSelect(task.id); }} className="gap-3 rounded-lg p-2.5"><CheckSquare className="h-4 w-4 text-primary" /> Multi-Select Phase</DropdownMenuItem>
                                                                <DropdownMenuSeparator className="my-1" />
                                                                <DropdownMenuItem onClick={() => handleDelete(task.id)} className="text-destructive gap-3 rounded-lg p-2.5 focus:bg-destructive/10 focus:text-destructive"><Trash2 className="h-4 w-4" /> Purge Protocol</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border border-border/50">
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
                                <p className="font-black uppercase tracking-widest text-xs">Registry Clear</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Bulk Actions Bar */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4">
                        <Card className="bg-slate-900 text-white border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] rounded-[2rem] overflow-hidden ring-1 ring-white/10">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4 pl-4">
                                    <div className="flex items-center justify-center h-10 w-10 bg-primary/20 rounded-xl"><ListChecks className="h-5 w-5 text-primary" /></div>
                                    <div className="flex flex-col"><span className="text-sm font-black uppercase tracking-tight">{selectedIds.length} Protocols Selected</span><span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Bulk Registry Correction</span></div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button onClick={handleBulkComplete} disabled={isBulkProcessing} className="rounded-xl font-black uppercase text-[10px] tracking-widest h-11 px-6 bg-emerald-600 hover:bg-emerald-700 shadow-xl transition-all active:scale-95">{isBulkProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Resolve</Button>
                                    <Button onClick={handleBulkDelete} disabled={isBulkProcessing} className="rounded-xl font-black uppercase text-[10px] tracking-widest h-11 px-6 bg-rose-600/20 text-rose-500 hover:bg-rose-600 hover:text-white border border-rose-600/30 transition-all active:scale-95"><Trash2 className="h-4 w-4 mr-2" /> Purge</Button>
                                    <Button variant="ghost" size="icon" onClick={() => { setSelectedIds([]); setIsSelectionMode(false); }} className="h-11 w-11 rounded-xl text-white/40 hover:text-white hover:bg-white/10"><X className="h-5 w-5" /></Button>
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
                <AlertDialogContent className="rounded-[2.5rem]"><AlertDialogHeader><div className="mx-auto bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4"><CheckCircle2 className="h-6 w-6 text-primary" /></div><AlertDialogTitle className="text-center font-black uppercase tracking-tight">Resolve Protocol?</AlertDialogTitle><AlertDialogDescription className="text-center">Confirm execution of <span className="font-bold text-foreground">"{taskToComplete?.title}"</span>. This action will update the institutional audit trail.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="sm:justify-center gap-3 mt-4"><AlertDialogCancel className="rounded-xl font-bold px-8">Review</AlertDialogCancel><AlertDialogAction onClick={handleConfirmComplete} className="rounded-xl font-black px-10 shadow-xl shadow-primary/20">Execute Resolution</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
