'use client';

import * as React from 'react';
import { collection, query, orderBy, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Task, UserProfile, School, TaskPriority, TaskCategory, TaskStatus, WorkspaceEntity } from '@/lib/types';
import { useSortedEntities } from '@/context/EntityCacheContext';
import { format, isToday, isPast, differenceInCalendarDays, addDays, startOfWeek, endOfWeek, addMonths, addWeeks, startOfDay, endOfDay } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { 
    CheckCircle2, 
    Circle, 
    Clock, 
    AlertTriangle, 
    ShieldAlert, 
    Building2, 
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
    TrendingUp,
    LayoutList
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
    bulkCompleteTasks,
    getTaskInterlinkUrl
} from '@/lib/task-actions';
import { 
    createTaskAction, 
    updateTaskAction, 
    deleteTaskAction, 
    bulkUpdateTasksAction, 
    bulkDeleteTasksAction 
} from '@/lib/task-server-actions';
import { usePermissions } from '@/hooks/use-permissions';
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
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuCheckboxItem,
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
import { getProgressValue } from './components/task-utils';
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
import { EntityAvatar } from '../components/EntityAvatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useTenant } from '@/context/TenantContext';
import { PageContainerFluid } from '@/components/ui/page-container';

const PRIORITY_CONFIG: Record<TaskPriority, { label: string, color: string, icon: any }> = {
    urgent: { label: 'Urgent', color: 'text-rose-600 bg-rose-500/10 border-rose-200/20', icon: ShieldAlert },
    high: { label: 'High', color: 'text-orange-600 bg-orange-500/10 border-orange-200/20', icon: AlertTriangle },
    medium: { label: 'Medium', color: 'text-blue-600 bg-blue-500/10 border-blue-200/20', icon: Clock },
    low: { label: 'Low', color: 'text-slate-500 bg-muted/100/10 border-slate-200/20', icon: Circle }
};

const CATEGORY_MAP: Record<TaskCategory, { label: string, icon: any, color: string }> = {
    call: { label: 'Phone Call', icon: Phone, color: 'text-orange-500 bg-orange-500/10' },
    visit: { label: 'Site Visit', icon: MapPin, color: 'text-blue-500 bg-blue-500/10' },
    document: { label: 'Documentation', icon: FileText, color: 'text-emerald-500 bg-emerald-500/10' },
    training: { label: 'Training', icon: GraduationCap, color: 'text-purple-500 bg-purple-500/10' },
    follow_up: { label: 'Follow Up', icon: Clock, color: 'text-indigo-500 bg-indigo-500/10' },
    general: { label: 'General Task', icon: CheckCircle2, color: 'text-slate-500 bg-muted/100/10' }
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
    const { activeWorkspaceId, activeOrganizationId } = useTenant();

    const { can } = usePermissions();
    const canCreate = can('operations', 'tasks', 'create');
    const canDelete = can('operations', 'tasks', 'delete');
    const canEdit = can('operations', 'tasks', 'edit');
    
    // View State
    const [activeTab, setActiveTab] = React.useState('list');
    const [statusFilter, setStatusFilter] = React.useState<string>('all');
    const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [smartFilter, setSmartFilter] = React.useState<'none' | 'today' | 'overdue'>('none');
    const [isSimpleView, setIsSimpleView] = React.useState(true);

    // Date Interval Filter States
    const [dateFilterType, setDateFilterType] = React.useState<'all' | 'range' | 'month' | 'week' | 'day'>('all');
    const [dateRange, setDateRange] = React.useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });
    const [selectedMonth, setSelectedMonth] = React.useState<string>('');
    const [selectedWeek, setSelectedWeek] = React.useState<string>('');
    const [selectedDayType, setSelectedDayType] = React.useState<'today' | 'yesterday' | 'tomorrow' | 'custom'>('today');
    const [selectedCustomDay, setSelectedCustomDay] = React.useState<Date | null>(null);

    // Hydration Safe mounted state
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('task_simple_view');
            if (saved !== null) {
                setIsSimpleView(saved === 'true');
            }
        }
    }, []);

    // Generate Month Options dynamically (12 months in past to 12 months in future)
    const monthOptions = React.useMemo(() => {
        const options = [];
        const now = new Date();
        for (let i = -12; i <= 12; i++) {
            const d = addMonths(now, i);
            options.push({
                value: format(d, 'yyyy-MM'),
                label: format(d, 'MMMM yyyy'),
            });
        }
        return options;
    }, []);

    // Generate Week Options dynamically (8 weeks in past to 24 weeks in future)
    const weekOptions = React.useMemo(() => {
        const options = [];
        const now = new Date();
        const startOfCurrentWeek = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
        for (let i = -8; i <= 24; i++) {
            const d = addWeeks(startOfCurrentWeek, i);
            const wEnd = endOfWeek(d, { weekStartsOn: 1 });
            options.push({
                value: format(d, 'yyyy-MM-dd'),
                label: `Week of ${format(d, 'MMM d, yyyy')} - ${format(wEnd, 'MMM d, yyyy')}`,
            });
        }
        return options;
    }, []);

    // Clear and set defaults on filter type change
    React.useEffect(() => {
        if (dateFilterType === 'all') {
            setDateRange({ start: null, end: null });
            setSelectedMonth('');
            setSelectedWeek('');
            setSelectedDayType('today');
            setSelectedCustomDay(null);
        } else if (dateFilterType === 'range') {
            setDateRange({ start: new Date(), end: addDays(new Date(), 7) });
            setSelectedMonth('');
            setSelectedWeek('');
            setSelectedDayType('today');
            setSelectedCustomDay(null);
        } else if (dateFilterType === 'month') {
            setDateRange({ start: null, end: null });
            setSelectedMonth(format(new Date(), 'yyyy-MM'));
            setSelectedWeek('');
            setSelectedDayType('today');
            setSelectedCustomDay(null);
        } else if (dateFilterType === 'week') {
            setDateRange({ start: null, end: null });
            setSelectedMonth('');
            setSelectedWeek(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
            setSelectedDayType('today');
            setSelectedCustomDay(null);
        } else if (dateFilterType === 'day') {
            setDateRange({ start: null, end: null });
            setSelectedMonth('');
            setSelectedWeek('');
            setSelectedDayType('today');
            setSelectedCustomDay(new Date());
        }
    }, [dateFilterType]);

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
    const [taskToDelete, setTaskToDelete] = React.useState<Task | null>(null);
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = React.useState(false);
    const [isBulkResolveOpen, setIsBulkResolveOpen] = React.useState(false);

    const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
        overdue: true,
        today: true,
        upcoming: true,
        completed: false
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const tasksQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'tasks'), 
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('dueDate', 'asc'), 
            limit(200)
        );
    }, [firestore, activeWorkspaceId]);

    // ORG-AWARE USER QUERY
    const usersQuery = useMemoFirebase(() => {
        if (!firestore || !activeOrganizationId) return null;
        return query(
            collection(firestore, 'users'), 
            where('organizationId', '==', activeOrganizationId),
            where('isAuthorized', '==', true),
            orderBy('name', 'asc')
        );
    }, [firestore, activeOrganizationId]);

    const { sortedEntities: entities } = useSortedEntities();

    const { data: allTasks, isLoading: isLoadingTasks } = useCollection<Task>(tasksQuery);
    const { data: users } = useCollection<UserProfile>(usersQuery);
    // Removed duplicate entities subscription

    const entityLogoMap = React.useMemo(() => {
        if (!entities) return new Map<string, string | undefined>();
        return new Map(entities.map(e => [e.entityId, e.logoUrl]));
    }, [entities]);

    const userMap = React.useMemo(() => {
        if (!users) return new Map<string, UserProfile>();
        return new Map(users.map(u => [u.id, u]));
    }, [users]);

    const workspaceUsers = React.useMemo(() => {
        if (!users || !activeWorkspaceId) return [];
        return users.filter(u => u.workspaceIds?.includes(activeWorkspaceId));
    }, [users, activeWorkspaceId]);

    const isLoading = isLoadingTasks || isLoadingFilter;

    const filteredTasks = React.useMemo(() => {
        if (!allTasks) return [];
        return allTasks.filter(task => {
            const matchesStatus = statusFilter === 'all' ? true : task.status === statusFilter;
            const matchesPriority = priorityFilter === 'all' ? true : task.priority === priorityFilter;
            
            let matchesAssigned = true;
            if (assignedUserId) {
                if (assignedUserId === 'unassigned') {
                    matchesAssigned = !task.assignedTo || (Array.isArray(task.assignedTo) && task.assignedTo.length === 0);
                } else {
                    if (Array.isArray(task.assignedTo)) {
                        matchesAssigned = task.assignedTo.includes(assignedUserId);
                    } else {
                        matchesAssigned = task.assignedTo === assignedUserId;
                    }
                }
            }

            const matchesSearch = searchTerm ? 
                task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                task.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) 
                : true;

            let matchesSmart = true;
            if (smartFilter === 'today') {
                matchesSmart = isToday(new Date(task.dueDate)) && task.status !== 'done';
            } else if (smartFilter === 'overdue') {
                const date = new Date(task.dueDate);
                matchesSmart = isPast(date) && !isToday(date) && task.status !== 'done';
            }

            let matchesDate = true;
            if (dateFilterType === 'range') {
                const taskDate = new Date(task.dueDate);
                if (dateRange.start) {
                    const startVal = startOfDay(dateRange.start);
                    const taskVal = startOfDay(taskDate);
                    matchesDate = taskVal >= startVal;
                }
                if (matchesDate && dateRange.end) {
                    const endVal = endOfDay(dateRange.end);
                    const taskVal = endOfDay(taskDate);
                    matchesDate = taskVal <= endVal;
                }
            } else if (dateFilterType === 'month' && selectedMonth) {
                const taskDate = new Date(task.dueDate);
                const [year, month] = selectedMonth.split('-').map(Number);
                matchesDate = taskDate.getFullYear() === year && (taskDate.getMonth() + 1) === month;
            } else if (dateFilterType === 'week' && selectedWeek) {
                const taskDate = new Date(task.dueDate);
                const weekStart = startOfDay(new Date(selectedWeek));
                const weekEnd = endOfDay(addDays(weekStart, 6));
                matchesDate = taskDate >= weekStart && taskDate <= weekEnd;
            } else if (dateFilterType === 'day') {
                const taskDate = new Date(task.dueDate);
                let targetDate = new Date();
                if (selectedDayType === 'yesterday') {
                    targetDate = addDays(new Date(), -1);
                } else if (selectedDayType === 'tomorrow') {
                    targetDate = addDays(new Date(), 1);
                } else if (selectedDayType === 'custom' && selectedCustomDay) {
                    targetDate = selectedCustomDay;
                }
                matchesDate = differenceInCalendarDays(taskDate, targetDate) === 0;
            }

            return matchesStatus && matchesPriority && matchesAssigned && matchesSearch && matchesSmart && matchesDate;
        });
    }, [allTasks, statusFilter, priorityFilter, assignedUserId, searchTerm, smartFilter, dateFilterType, dateRange, selectedMonth, selectedWeek, selectedDayType, selectedCustomDay]);

    const calendarFilteredTasks = React.useMemo(() => {
        if (!allTasks) return [];
        return allTasks.filter(task => {
            const matchesStatus = statusFilter === 'all' ? true : task.status === statusFilter;
            const matchesPriority = priorityFilter === 'all' ? true : task.priority === priorityFilter;
            
            let matchesAssigned = true;
            if (assignedUserId) {
                if (assignedUserId === 'unassigned') {
                    matchesAssigned = !task.assignedTo || (Array.isArray(task.assignedTo) && task.assignedTo.length === 0);
                } else {
                    if (Array.isArray(task.assignedTo)) {
                        matchesAssigned = task.assignedTo.includes(assignedUserId);
                    } else {
                        matchesAssigned = task.assignedTo === assignedUserId;
                    }
                }
            }

            const matchesSearch = searchTerm ? 
                task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                task.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) 
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

    const groupedListTasks = React.useMemo(() => {
        const overdue: Task[] = [];
        const today: Task[] = [];
        const upcoming: Task[] = [];
        const completed: Task[] = [];

        filteredTasks.forEach(task => {
            if (task.status === 'done') {
                completed.push(task);
                return;
            }

            const dueDateObj = new Date(task.dueDate);
            if (isToday(dueDateObj)) {
                today.push(task);
            } else if (isPast(dueDateObj)) {
                overdue.push(task);
            } else {
                upcoming.push(task);
            }
        });

        return { overdue, today, upcoming, completed };
    }, [filteredTasks]);

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

    const handleUpdateAssignee = async (task: Task, userId: string) => {
        if (!currentUser) return;
        try {
            const currentAssignees = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
            const nextAssignees = currentAssignees.includes(userId)
                ? currentAssignees.filter(id => id !== userId)
                : [...currentAssignees, userId];

            const res = await updateTaskAction(task.id, { ...task, assignedTo: nextAssignees }, currentUser.uid);
            if (res.success) {
                toast({ title: 'Assignees updated successfully' });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: res.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to update assignee' });
        }
    };

    const handleUpdateStatus = async (task: Task, newStatus: TaskStatus) => {
        if (!currentUser) return;
        try {
            const res = await updateTaskAction(task.id, { ...task, status: newStatus }, currentUser.uid);
            if (res.success) {
                toast({ title: `Status updated to ${STATUS_LABELS[newStatus]}` });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: res.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to update status' });
        }
    };

    const handlePostponeTask = async (task: Task, days: number) => {
        if (!currentUser) return;
        try {
            const currentDueDate = task.dueDate ? new Date(task.dueDate) : new Date();
            const newDueDate = addDays(currentDueDate, days).toISOString();
            const res = await updateTaskAction(task.id, { ...task, dueDate: newDueDate }, currentUser.uid);
            if (res.success) {
                toast({ title: `Task postponed by ${days} day${days > 1 ? 's' : ''}` });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: res.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to postpone task' });
        }
    };

    const handleCalendarTaskUpdate = async (taskId: string, updatedFields: Partial<Task>) => {
        if (!currentUser) return false;
        try {
            const task = allTasks?.find(t => t.id === taskId);
            if (!task) return false;
            const res = await updateTaskAction(taskId, { ...task, ...updatedFields }, currentUser.uid);
            if (res.success) {
                toast({ title: 'Task rescheduled successfully' });
                return true;
            } else {
                toast({ variant: 'destructive', title: 'Reschedule Failed', description: res.error });
                return false;
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to reschedule task' });
            return false;
        }
    };

    const handleSaveTask = async (payload: any) => {
        if (!currentUser) return;
        setIsSaving(true);
        try {
            const finalPayload = { ...payload, workspaceId: activeWorkspaceId };
            const res = editingTask 
                ? await updateTaskAction(editingTask.id, finalPayload, currentUser.uid)
                : await createTaskAction(finalPayload, currentUser.uid);

            if (res.success) {
                toast({ title: editingTask ? 'Task Architecture Synchronized' : 'Task Initialized' });
                setEditorOpen(false);
                setEditingTask(null);
            } else {
                toast({ variant: 'destructive', title: 'Operation Failed', description: res.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message || "Failed to save task." });
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

    const handleConfirmComplete = async () => {
        if (!currentUser || !taskToComplete) return;
        
        const isDone = taskToComplete.status === 'done';
        const newStatus = isDone ? 'todo' : 'done';
        
        try {
            const res = await updateTaskAction(taskToComplete.id, { ...taskToComplete, status: newStatus }, currentUser.uid);
            if (res.success) {
                toast({ title: isDone ? 'Task Reopened' : 'Protocol Resolved' });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: res.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
        setTaskToComplete(null);
    };

    const handleDelete = async (task: Task) => {
        if (!currentUser) return;
        try {
            const res = await deleteTaskAction(task.id, currentUser.uid);
            if (res.success) {
                toast({ title: 'Record Purged', description: `Task "${task.title}" deleted.` });
            } else {
                toast({ variant: 'destructive', title: 'Delete Failed', description: res.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
        setTaskToDelete(null);
    };

    const handleBulkComplete = async () => {
        if (!currentUser || selectedIds.length === 0) return;
        setIsBulkProcessing(true);
        try {
            const res = await bulkUpdateTasksAction(selectedIds, { status: 'done' } as any, currentUser.uid, activeWorkspaceId);
            if (res.success) {
                toast({ title: 'Bulk Completion Success', description: `${selectedIds.length} tasks resolved.` });
                setSelectedIds([]);
                setIsSelectionMode(false);
            } else {
                toast({ variant: 'destructive', title: 'Bulk Action Failed', description: res.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsBulkProcessing(false);
            setIsBulkResolveOpen(false);
        }
    };

    const handleBulkDelete = async () => {
        if (!currentUser || selectedIds.length === 0) return;
        setIsBulkProcessing(true);
        try {
            const res = await bulkDeleteTasksAction(selectedIds, currentUser.uid, activeWorkspaceId);
            if (res.success) {
                toast({ title: 'Bulk Delete Success', description: `${selectedIds.length} tasks permanently deleted.` });
                setSelectedIds([]);
                setIsSelectionMode(false);
            } else {
                toast({ variant: 'destructive', title: 'Bulk Action Failed', description: res.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsBulkProcessing(false);
            setIsBulkDeleteOpen(false);
        }
    };

    const handleBulkAssign = async (userId: string) => {
        if (!currentUser || selectedIds.length === 0 || !allTasks) return;
        setIsBulkProcessing(true);
        try {
            const userObj = workspaceUsers?.find(u => u.id === userId);
            const promises = selectedIds.map(id => {
                const task = allTasks.find(t => t.id === id);
                if (!task) return Promise.resolve({ success: true });
                return updateTaskAction(id, { ...task, assignedTo: [userId] }, currentUser.uid);
            });
            const results = await Promise.all(promises);
            const failures = results.filter(r => !r.success);
            if (failures.length === 0) {
                toast({ title: 'Bulk Assignment Success', description: `${selectedIds.length} tasks assigned to ${userObj?.name || 'user'}.` });
                setSelectedIds([]);
                setIsSelectionMode(false);
            } else {
                toast({ variant: 'destructive', title: 'Bulk Assignment Failed', description: `${failures.length} tasks failed to assign.` });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleBulkChangeStatus = async (status: TaskStatus) => {
        if (!currentUser || selectedIds.length === 0 || !allTasks) return;
        setIsBulkProcessing(true);
        try {
            const promises = selectedIds.map(id => {
                const task = allTasks.find(t => t.id === id);
                if (!task) return Promise.resolve({ success: true });
                return updateTaskAction(id, { ...task, status }, currentUser.uid);
            });
            const results = await Promise.all(promises);
            const failures = results.filter(r => !r.success);
            if (failures.length === 0) {
                toast({ title: 'Bulk Status Update Success', description: `${selectedIds.length} tasks updated to ${STATUS_LABELS[status]}.` });
                setSelectedIds([]);
                setIsSelectionMode(false);
            } else {
                toast({ variant: 'destructive', title: 'Bulk Status Update Failed', description: `${failures.length} tasks failed to update.` });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleBulkPostpone = async (days: number) => {
        if (!currentUser || selectedIds.length === 0 || !allTasks) return;
        setIsBulkProcessing(true);
        try {
            const promises = selectedIds.map(id => {
                const task = allTasks.find(t => t.id === id);
                if (!task || !task.dueDate) return Promise.resolve({ success: true });
                const currentDueDate = new Date(task.dueDate);
                const newDueDate = new Date(currentDueDate.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
                return updateTaskAction(id, { ...task, dueDate: newDueDate }, currentUser.uid);
            });
            const results = await Promise.all(promises);
            const failures = results.filter(r => !r.success);
            if (failures.length === 0) {
                toast({ title: 'Bulk Postpone Success', description: `${selectedIds.length} tasks postponed by ${days} days.` });
                setSelectedIds([]);
                setIsSelectionMode(false);
            } else {
                toast({ variant: 'destructive', title: 'Bulk Postpone Failed', description: `${failures.length} tasks failed to update.` });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    return (
        <PageContainerFluid>
            <Tabs 
                value={activeTab} 
                onValueChange={(val) => {
                    setActiveTab(val);
                    if (val !== 'list') {
                        setIsSelectionMode(false);
                        setSelectedIds([]);
                    }
                }} 
                className="space-y-8 pb-32 w-full"
            >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
                    <div className="flex flex-col items-start">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-foreground tracking-tight">
                                Operations Hub
                            </h1>
                            <Badge variant="outline" className="text-[10px] font-bold uppercase h-5 px-2 rounded-md bg-blue-500/10 text-blue-500 dark:text-blue-400 border-none">
                                Tasks
                            </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm mt-1">
                            Action items, global workflows, and execution protocols
                        </p>
                    </div>
                    {/* Header Tabs matching Reference Image */}
                    <TabsList className="bg-transparent border border-border shadow-sm p-1 h-12 rounded-xl ring-1 ring-border shrink-0">
                        <TabsTrigger value="list" className="rounded-lg font-semibold text-[10px] px-8 gap-2">
                            <LayoutList className="h-4 w-4" /> List View ({filteredTasks.length})
                        </TabsTrigger>
                        <TabsTrigger value="board" className="rounded-lg font-semibold text-[10px] px-8 gap-2">
                            <Layers className="h-4 w-4" /> Kanban Board
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="rounded-lg font-semibold text-[10px] px-8 gap-2">
                            <Calendar className="h-4 w-4" /> Calendar View
                        </TabsTrigger>
                    </TabsList>
                </div>
                {activeTab === 'list' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard 
                            label="Active Actions" 
                            value={isLoading ? '...' : stats.active} 
                            icon={Zap} 
                            color="text-blue-500" 
                            bg="bg-blue-500/10" 
                        />
                        <StatCard 
                            label="Resolved Protocols" 
                            value={isLoading ? '...' : stats.resolved} 
                            icon={CheckCircle2} 
                            color="text-emerald-500" 
                            bg="bg-emerald-500/10" 
                        />
                        <StatCard 
                            label="Overdue Alerts" 
                            value={isLoading ? '...' : stats.overdue} 
                            icon={ShieldAlert} 
                            color="text-rose-500" 
                            bg="bg-rose-500/10" 
                        />
                        <StatCard 
                            label="Closure Velocity" 
                            value={isLoading ? '...' : `${stats.efficiency}%`} 
                            icon={Target} 
                            color="text-violet-500" 
                            bg="bg-violet-500/10" 
                        />
                    </div>
                )}


                {/* Toolbar */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-card border-none ring-1 ring-border shadow-sm p-5 rounded-2xl">
                    <h2 className="text-xl font-bold text-foreground tracking-tight">Tasks</h2>
                    <div className="flex flex-wrap items-center gap-3">
                        {activeTab === 'list' && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setIsSelectionMode(!isSelectionMode)} 
                                className={cn(
                                    "rounded-xl font-semibold text-xs gap-2 h-10 px-4 transition-all border-border bg-background text-foreground hover:bg-muted/30", 
                                    isSelectionMode && "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                                )}
                            >
                                {isSelectionMode ? <CheckSquare className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />} Selection
                            </Button>
                        )}
 
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-10 w-[140px] rounded-xl bg-background border-border text-foreground font-semibold text-xs focus:ring-0 focus:ring-offset-0">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border bg-card text-foreground">
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="waiting">Waiting</SelectItem>
                                <SelectItem value="review">Review</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                        </Select>
 
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="h-10 w-[140px] rounded-xl bg-background border-border text-foreground font-semibold text-xs focus:ring-0 focus:ring-offset-0">
                                <SelectValue placeholder="All Priorities" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border bg-card text-foreground">
                                <SelectItem value="all">All Priorities</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                        </Select>
 
                        {/* Date Filter Select */}
                        <Select value={dateFilterType} onValueChange={(val: any) => setDateFilterType(val)}>
                            <SelectTrigger className="h-10 w-[140px] rounded-xl bg-background border-border text-foreground font-semibold text-xs focus:ring-0 focus:ring-offset-0">
                                <SelectValue placeholder="All Time" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border bg-card text-foreground">
                                <SelectItem value="all">All Time</SelectItem>
                                <SelectItem value="range">Custom Range</SelectItem>
                                <SelectItem value="month">By Month</SelectItem>
                                <SelectItem value="week">By Week</SelectItem>
                                <SelectItem value="day">By Day</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Date Range Inputs */}
                        {mounted && dateFilterType === 'range' && (
                            <div className="flex items-center gap-2">
                                <DateTimePicker 
                                    value={dateRange.start || undefined} 
                                    onChange={(d) => setDateRange(prev => ({ ...prev, start: d || null }))} 
                                    className="h-10 rounded-xl bg-background border border-border text-foreground font-semibold text-xs w-[180px]"
                                />
                                <span className="text-muted-foreground text-xs font-semibold">to</span>
                                <DateTimePicker 
                                    value={dateRange.end || undefined} 
                                    onChange={(d) => setDateRange(prev => ({ ...prev, end: d || null }))} 
                                    className="h-10 rounded-xl bg-background border border-border text-foreground font-semibold text-xs w-[180px]"
                                />
                            </div>
                        )}

                        {/* Month Selector */}
                        {mounted && dateFilterType === 'month' && (
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="h-10 w-[160px] rounded-xl bg-background border-border text-foreground font-semibold text-xs focus:ring-0 focus:ring-offset-0">
                                    <SelectValue placeholder="Select Month" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border bg-card text-foreground">
                                    {monthOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        {/* Week Selector */}
                        {mounted && dateFilterType === 'week' && (
                            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                                <SelectTrigger className="h-10 w-[240px] rounded-xl bg-background border-border text-foreground font-semibold text-xs focus:ring-0 focus:ring-offset-0">
                                    <SelectValue placeholder="Select Week" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border bg-card text-foreground">
                                    {weekOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        {/* Day Selector */}
                        {mounted && dateFilterType === 'day' && (
                            <div className="flex items-center gap-2">
                                <Select value={selectedDayType} onValueChange={(val: any) => setSelectedDayType(val)}>
                                    <SelectTrigger className="h-10 w-[150px] rounded-xl bg-background border-border text-foreground font-semibold text-xs focus:ring-0 focus:ring-offset-0">
                                        <SelectValue placeholder="Select Day" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border bg-card text-foreground">
                                        <SelectItem value="today">Today</SelectItem>
                                        <SelectItem value="yesterday">Yesterday</SelectItem>
                                        <SelectItem value="tomorrow">Tomorrow</SelectItem>
                                        <SelectItem value="custom">Specific Date...</SelectItem>
                                    </SelectContent>
                                </Select>

                                {selectedDayType === 'custom' && (
                                    <DateTimePicker 
                                        value={selectedCustomDay || undefined} 
                                        onChange={(d) => setSelectedCustomDay(d || null)} 
                                        className="h-10 rounded-xl bg-background border border-border text-foreground font-semibold text-xs w-[180px]"
                                    />
                                )}
                            </div>
                        )}

                        <div className="relative w-full sm:w-[240px] group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
                            <Input 
                                placeholder="Search tasks..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="h-10 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/45 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary font-semibold pl-10 text-xs"
                            />
                        </div>

                        {activeTab === 'list' && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsSimpleView(prev => {
                                        const next = !prev;
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('task_simple_view', String(next));
                                        }
                                        return next;
                                    });
                                }}
                                className={cn(
                                    "h-10 rounded-xl px-4 gap-2 font-bold text-xs transition-all border-none ring-1 shrink-0",
                                    isSimpleView 
                                        ? "bg-blue-500/10 text-blue-600 ring-blue-500/30 hover:bg-blue-500/15" 
                                        : "bg-background text-foreground ring-border hover:bg-muted/50"
                                )}
                            >
                                <LayoutList className={cn("h-4 w-4 transition-transform", isSimpleView && "text-blue-500")} />
                                <span>{isSimpleView ? "Simple View" : "Detailed View"}</span>
                            </Button>
                        )}
 
                        {canCreate && (
                            <Button 
                                onClick={() => setEditorOpen(true)} 
                                className="rounded-xl font-bold h-10 px-6 shadow-md bg-blue-600 text-white hover:bg-blue-700 active:scale-95 text-xs"
                            >
                                + Add Task
                            </Button>
                        )}
                    </div>
                </div>
 
                <AnimatePresence>
                    {isSelectionMode && selectedIds.length > 0 && (
                        <motion.div 
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 50, opacity: 0 }}
                            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
                        >
                            <div className="p-3 bg-card border border-border rounded-2xl shadow-2xl flex items-center gap-6 min-w-[400px]">
                                <div className="flex items-center gap-2 pl-2 border-r border-border pr-6">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-[10px] font-bold text-primary">{selectedIds.length}</span>
                                    </div>
                                    <span className="text-xs font-bold text-foreground">Items selected</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {canEdit && (
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            onClick={() => setIsBulkResolveOpen(true)} 
                                            className="h-8 rounded-lg text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/20 text-xs font-bold"
                                        >
                                            Resolve Selected
                                        </Button>
                                    )}

                                    {canEdit && (
                                        <DropdownMenu modal={false}>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs font-bold gap-1 text-primary hover:bg-primary/5 border-primary/20">
                                                    Bulk Actions <ChevronDown size={14} />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 border border-border bg-card text-foreground shadow-2xl">
                                                <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground px-3 py-1.5 uppercase tracking-wider">Bulk Update</DropdownMenuLabel>
                                                <DropdownMenuSeparator className="bg-border" />
                                                
                                                {/* Bulk Assign Submenu */}
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger className="rounded-xl p-2.5 gap-3 cursor-pointer">
                                                        <UserIcon className="h-4 w-4 text-primary" /> <span className="font-bold text-xs">Assign To...</span>
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuSubContent className="bg-card border border-border rounded-xl p-1 w-48 shadow-2xl text-foreground">
                                                        {workspaceUsers && workspaceUsers.length > 0 ? (
                                                            workspaceUsers.map(u => (
                                                                <DropdownMenuItem 
                                                                    key={u.id} 
                                                                    onClick={() => handleBulkAssign(u.id)}
                                                                    className="rounded-lg p-2 flex items-center gap-2 cursor-pointer focus:bg-muted"
                                                                >
                                                                    <Avatar className="h-5 w-5 shrink-0 ml-1.5">
                                                                        <AvatarImage src={u.photoURL || undefined} />
                                                                        <AvatarFallback className="text-[8px] bg-muted/40">{getInitials(u.name)}</AvatarFallback>
                                                                    </Avatar>
                                                                    <span className="text-xs font-semibold truncate">{u.name}</span>
                                                                </DropdownMenuItem>
                                                            ))
                                                        ) : (
                                                            <div className="p-2 text-center text-xs text-muted-foreground">No users found</div>
                                                        )}
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuSub>

                                                {/* Bulk Status Submenu */}
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger className="rounded-xl p-2.5 gap-3 cursor-pointer">
                                                        <Layers className="h-4 w-4 text-primary" /> <span className="font-bold text-xs">Change Status...</span>
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuSubContent className="bg-card border border-border rounded-xl p-1 w-48 shadow-2xl text-foreground">
                                                        {(['todo', 'in_progress', 'waiting', 'review', 'done'] as const).map(status => (
                                                            <DropdownMenuItem
                                                                key={status}
                                                                onClick={() => handleBulkChangeStatus(status)}
                                                                className="rounded-lg p-2 flex items-center gap-2 cursor-pointer focus:bg-muted"
                                                            >
                                                                <span className={cn(
                                                                    "text-xs font-semibold truncate",
                                                                    status === 'todo' && "text-foreground",
                                                                    status === 'in_progress' && "text-blue-500",
                                                                    status === 'waiting' && "text-orange-500",
                                                                    status === 'review' && "text-purple-500",
                                                                    status === 'done' && "text-emerald-500"
                                                                )}>
                                                                    {STATUS_LABELS[status]}
                                                                </span>
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuSub>

                                                {/* Bulk Postpone Submenu */}
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger className="rounded-xl p-2.5 gap-3 cursor-pointer">
                                                        <Clock className="h-4 w-4 text-primary" /> <span className="font-bold text-xs">Postpone...</span>
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuSubContent className="bg-card border border-border rounded-xl p-1 w-48 shadow-2xl text-foreground">
                                                        <DropdownMenuItem onClick={() => handleBulkPostpone(1)} className="rounded-lg p-2.5 cursor-pointer">
                                                            Postpone 1 Day
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleBulkPostpone(3)} className="rounded-lg p-2.5 cursor-pointer">
                                                            Postpone 3 Days
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleBulkPostpone(7)} className="rounded-lg p-2.5 cursor-pointer">
                                                            Postpone 1 Week
                                                        </DropdownMenuItem>
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuSub>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}

                                    {canDelete && (
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            onClick={() => setIsBulkDeleteOpen(true)} 
                                            className="h-8 rounded-lg text-rose-600 hover:bg-rose-500/10 border-rose-500/20 text-xs font-bold"
                                        >
                                            Delete Selected
                                        </Button>
                                    )}
                                    <Separator orientation="vertical" className="h-8 bg-border" />
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        onClick={() => setSelectedIds([])} 
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    >
                                        <X size={16} />
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="space-y-12">
                    <TabsContent value="list" className="m-0 space-y-6">
                        {/* Grouped Lists by Accordions */}
                        {(() => {
                            const categoriesConfig = [
                                { id: 'today', label: "Today's Tasks", tasks: groupedListTasks.today, count: groupedListTasks.today.length },
                                { id: 'overdue', label: 'Overdue Tasks', tasks: groupedListTasks.overdue, count: groupedListTasks.overdue.length },
                                { id: 'upcoming', label: 'Upcoming Tasks', tasks: groupedListTasks.upcoming, count: groupedListTasks.upcoming.length },
                                { id: 'completed', label: 'Completed Archive', tasks: groupedListTasks.completed, count: groupedListTasks.completed.length },
                            ];

                            return categoriesConfig.map(category => {
                                const isExpanded = expandedSections[category.id];
                                if (category.id === 'completed' && category.count === 0) return null;

                                return (
                                    <div key={category.id} className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
                                        {/* Accordion Trigger */}
                                        <button
                                            type="button"
                                            onClick={() => toggleSection(category.id)}
                                            className="w-full flex items-center justify-between py-3.5 px-5 bg-card hover:bg-muted/30 border-b border-border transition-all text-left cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <ChevronDown 
                                                    className={cn(
                                                        "h-5 w-5 text-muted-foreground transition-transform duration-200", 
                                                        isExpanded ? "transform rotate-0" : "transform -rotate-90"
                                                    )} 
                                                />
                                                <h3 className="text-base font-bold text-foreground tracking-tight">{category.label}</h3>
                                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                                    {category.count}
                                                </span>
                                            </div>
                                        </button>

                                        {/* Accordion Content */}
                                        {isExpanded && (
                                            <div className="divide-y divide-border">
                                                {isLoading ? (
                                                    <div className="p-6 space-y-4">
                                                        <Skeleton className="h-10 w-full rounded-xl" />
                                                        <Skeleton className="h-10 w-full rounded-xl" />
                                                    </div>
                                                ) : category.tasks.length > 0 ? (
                                                    category.tasks.map((task) => {
                                                        const P = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                                                        const daysLeft = differenceInCalendarDays(new Date(task.dueDate), new Date());
                                                        const isOverdue = daysLeft < 0 && task.status !== 'done';
                                                        const progress = getProgressValue(task.status);

                                                        return (
                                                            <div 
                                                                key={task.id} 
                                                                className={cn(
                                                                    isSimpleView 
                                                                        ? "flex items-center gap-3 px-6 py-2 sm:py-2.5 bg-transparent hover:bg-muted/30 transition-all"
                                                                        : "flex items-center gap-4 px-6 py-4 bg-transparent hover:bg-muted/30 transition-all",
                                                                    task.status === 'done' && "opacity-65"
                                                                )}
                                                            >
                                                                {isSelectionMode ? (
                                                                    <Checkbox 
                                                                        checked={selectedIds.includes(task.id)} 
                                                                        onCheckedChange={() => toggleSelect(task.id)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="h-5 w-5 rounded-lg border-border data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 shrink-0"
                                                                    />
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            if (!currentUser) return;
                                                                            const newStatus = task.status === 'done' ? 'todo' : 'done';
                                                                            await updateTaskAction(task.id, { ...task, status: newStatus }, currentUser.uid);
                                                                            toast({ title: newStatus === 'done' ? 'Task Completed' : 'Task Reopened' });
                                                                        }}
                                                                        className="h-5 w-5 rounded-full border border-border hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center transition-all shrink-0 group/check cursor-pointer"
                                                                    >
                                                                        {task.status === 'done' ? (
                                                                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                                                                        ) : (
                                                                            <div className="h-2.5 w-2.5 rounded-full bg-transparent group-hover/check:bg-emerald-500/40 transition-all shrink-0" />
                                                                        )}
                                                                    </button>
                                                                )}

                                                                {isSimpleView ? (
                                                                    <>
                                                                        <div className="flex-1 min-w-0">
                                                                            <h4 className={cn("text-sm font-bold text-foreground leading-tight truncate", task.status === 'done' && "line-through")}>
                                                                                {task.title}
                                                                            </h4>
                                                                        </div>

                                                                        <div className="flex items-center min-w-[70px] sm:min-w-[90px] shrink-0">
                                                                            <span className={cn("font-bold uppercase text-[9px] px-1.5 py-0.5 rounded-sm border-none shadow-xs shrink-0", P.color)}>
                                                                                {P.label}
                                                                            </span>
                                                                        </div>

                                                                        {/* Entity Display Name - Swapped and brought into Simple View */}
                                                                        {task.entityName ? (
                                                                            <div className="hidden md:flex items-center gap-1.5 min-w-[120px] max-w-[160px] shrink-0">
                                                                                <EntityAvatar 
                                                                                    src={task.entityId ? entityLogoMap.get(task.entityId) : undefined} 
                                                                                    name={task.entityName} 
                                                                                    className="h-3.5 w-3.5 rounded-sm shadow-none ring-0 p-0 shrink-0"
                                                                                    fallbackClassName="text-[6px]"
                                                                                />
                                                                                <span className="text-[10px] font-semibold text-muted-foreground/60 truncate">
                                                                                    {task.entityName}
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="hidden md:flex min-w-[120px] shrink-0" />
                                                                        )}

                                                                        <div className="flex items-center gap-1.5 min-w-[95px] sm:min-w-[110px] shrink-0">
                                                                            <Clock className={cn("h-3 w-3", isOverdue ? "text-rose-600" : "text-muted-foreground/40")} />
                                                                            <span className={cn("text-[10px] font-semibold tracking-tighter", isOverdue ? "text-rose-600 animate-pulse" : "text-muted-foreground/60")}>
                                                                                {task.status === 'done' 
                                                                                    ? 'Resolved' 
                                                                                    : isOverdue 
                                                                                        ? 'Overdue' 
                                                                                        : daysLeft === 0 
                                                                                            ? 'Today' 
                                                                                            : daysLeft === 1 
                                                                                                ? 'Tomorrow' 
                                                                                                : daysLeft < 0 
                                                                                                    ? `${Math.abs(daysLeft)}d overdue` 
                                                                                                    : `${daysLeft}d left`
                                                                                }
                                                                            </span>
                                                                        </div>

                                                                        <div className="hidden sm:flex items-center gap-2.5 min-w-[100px] sm:min-w-[120px] shrink-0">
                                                                            <Progress value={progress} className="h-1 flex-1" />
                                                                            <span className="text-[9px] font-semibold tabular-nums w-6 text-right opacity-45">{progress}%</span>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex flex-col gap-1 text-left">
                                                                                <h4 className={cn("text-base font-bold text-foreground leading-tight truncate", task.status === 'done' && "line-through")}>
                                                                                    {task.title}
                                                                                </h4>
                                                                                <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-2 flex-wrap text-left">
                                                                                    <span>{toTitleCase(task.category)}</span>
                                                                                    <span className="text-muted-foreground/30 font-normal">·</span>
                                                                                    <span className={cn("font-bold uppercase text-[9px] px-1.5 py-0.5 rounded-sm border-none shadow-xs shrink-0", P.color)}>
                                                                                        {P.label}
                                                                                    </span>
                                                                                    <span className="text-muted-foreground/30 font-normal">·</span>
                                                                                    <span className="font-semibold text-muted-foreground/70 shrink-0">
                                                                                        {format(new Date(task.dueDate), 'MMM d, yyyy h:mm a')}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Entity Display Name - Swapped to come before Clock/Due Status */}
                                                                        {task.entityName ? (
                                                                            <div className="hidden lg:flex items-center gap-1.5 min-w-[140px] max-w-[180px] shrink-0">
                                                                                <EntityAvatar 
                                                                                    src={task.entityId ? entityLogoMap.get(task.entityId) : undefined} 
                                                                                    name={task.entityName} 
                                                                                    className="h-3.5 w-3.5 rounded-sm shadow-none ring-0 p-0 shrink-0"
                                                                                    fallbackClassName="text-[6px]"
                                                                                />
                                                                                <span className="text-[10px] font-semibold text-muted-foreground/60 truncate">
                                                                                    {task.entityName}
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="hidden lg:flex min-w-[140px] shrink-0" />
                                                                        )}

                                                                        <div className="hidden md:flex items-center gap-2 min-w-[120px] shrink-0">
                                                                            <Clock className={cn("h-3.5 w-3.5", isOverdue ? "text-rose-600" : "text-muted-foreground/40")} />
                                                                            <span className={cn("text-[10px] font-semibold tracking-tighter", isOverdue ? "text-rose-600 animate-pulse" : "text-muted-foreground/60")}>
                                                                                {task.status === 'done' 
                                                                                    ? 'Resolved' 
                                                                                    : isOverdue 
                                                                                        ? 'Overdue' 
                                                                                        : daysLeft === 0 
                                                                                            ? 'Due Today' 
                                                                                            : daysLeft === 1 
                                                                                                ? 'Due Tomorrow' 
                                                                                                : daysLeft < 0 
                                                                                                    ? `${Math.abs(daysLeft)} Days Overdue` 
                                                                                                    : `${daysLeft} Days Left`
                                                                                }
                                                                            </span>
                                                                        </div>

                                                                        <div className="hidden xl:flex items-center gap-4 min-w-[180px] shrink-0">
                                                                            <div className="flex-1 space-y-1">
                                                                                <Progress value={progress} className="h-1.5" />
                                                                            </div>
                                                                            <span className="text-[10px] font-semibold tabular-nums w-8 text-right opacity-40">{progress}%</span>
                                                                        </div>
                                                                    </>
                                                                )}

                                                                <div className="flex items-center justify-end shrink-0 pl-2 gap-3">
                                                                    {!isSimpleView && (
                                                                        <div className="hidden lg:flex items-center gap-2 mr-1 text-muted-foreground">
                                                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/30">
                                                                                <Paperclip className="h-3 w-3" />
                                                                                <span className="text-[10px] font-semibold tabular-nums">{task.attachments?.length || 0}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/30">
                                                                                <MessageSquare className="h-3 w-3" />
                                                                                <span className="text-[10px] font-semibold tabular-nums">{task.notes?.length || 0}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {(() => {
                                                                        const ids = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
                                                                        if (ids.length === 0) return null;
                                                                        return (
                                                                            <div className="flex items-center -space-x-2 shrink-0 mr-1.5">
                                                                                {ids.map((id) => {
                                                                                    const u = userMap.get(id);
                                                                                    if (!u) return null;
                                                                                    return (
                                                                                        <TooltipProvider key={id}>
                                                                                            <Tooltip>
                                                                                                <TooltipTrigger asChild>
                                                                                                    <Avatar className={cn(
                                                                                                        isSimpleView 
                                                                                                            ? "h-5 w-5 border border-background shadow-xs shrink-0 select-none hover:translate-y-[-1px] transition-transform"
                                                                                                            : "h-6 w-6 border-2 border-background shadow-xs shrink-0 select-none hover:translate-y-[-2px] transition-transform"
                                                                                                    )}>
                                                                                                        <AvatarImage src={u.photoURL || undefined} />
                                                                                                        <AvatarFallback className={cn(
                                                                                                            isSimpleView ? "text-[7px]" : "text-[8px]",
                                                                                                            "bg-muted/40 font-bold"
                                                                                                        )}>{getInitials(u.name)}</AvatarFallback>
                                                                                                    </Avatar>
                                                                                                </TooltipTrigger>
                                                                                                <TooltipContent className="bg-card border border-border p-2 rounded-xl text-xs font-bold text-foreground">
                                                                                                    {u.name}
                                                                                                </TooltipContent>
                                                                                            </Tooltip>
                                                                                        </TooltipProvider>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        );
                                                                    })()}

                                                                    <DropdownMenu modal={false}>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-40 group-hover:opacity-100 transition-opacity">
                                                                                <MoreVertical className="h-4 w-4" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 border border-border bg-card text-foreground shadow-2xl">
                                                                            <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground px-3 py-2">Task Actions</DropdownMenuLabel>
                                                                            {canEdit && (
                                                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingTask(task); setEditorOpen(true); }} className="rounded-xl p-2.5 gap-3 cursor-pointer">
                                                                                    <Pencil className="h-4 w-4 text-primary" /> <span className="font-bold text-sm">Update Task</span>
                                                                                </DropdownMenuItem>
                                                                            )}
                                                                            {canEdit && (
                                                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setTaskToComplete(task); }} className="rounded-xl p-2.5 gap-3 cursor-pointer">
                                                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> <span className="font-bold text-sm">{task.status === 'done' ? 'Reopen Task' : 'Mark as Resolved'}</span>
                                                                                </DropdownMenuItem>
                                                                            )}
                                                                            <DropdownMenuSeparator className="bg-border" />
                                                                            
                                                                            {canEdit && (
                                                                                <>
                                                                                    <DropdownMenuSub>
                                                                                        <DropdownMenuSubTrigger className="rounded-xl p-2.5 gap-3 cursor-pointer focus:bg-muted">
                                                                                            <UserIcon className="h-4 w-4 text-primary" />
                                                                                            <span className="font-bold text-sm">Change Assignee</span>
                                                                                        </DropdownMenuSubTrigger>
                                                                                        <DropdownMenuSubContent className="bg-card border border-border rounded-xl p-1 w-48 shadow-2xl text-foreground">
                                                                                            {workspaceUsers && workspaceUsers.length > 0 ? (
                                                                                                workspaceUsers.map(u => {
                                                                                                    const isChecked = Array.isArray(task.assignedTo) ? task.assignedTo.includes(u.id) : task.assignedTo === u.id;
                                                                                                    return (
                                                                                                        <DropdownMenuCheckboxItem 
                                                                                                            key={u.id} 
                                                                                                            checked={isChecked}
                                                                                                            onCheckedChange={() => {}}
                                                                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUpdateAssignee(task, u.id); }}
                                                                                                            className={cn(
                                                                                                                "rounded-lg p-2 flex items-center gap-2 cursor-pointer focus:bg-muted",
                                                                                                                isChecked && "bg-primary/5 text-primary"
                                                                                                            )}
                                                                                                        >
                                                                                                            <Avatar className="h-5 w-5 shrink-0 ml-1.5">
                                                                                                                <AvatarImage src={u.photoURL || undefined} />
                                                                                                                <AvatarFallback className="text-[8px] bg-muted/40">{getInitials(u.name)}</AvatarFallback>
                                                                                                            </Avatar>
                                                                                                            <span className="text-xs font-semibold truncate">{u.name}</span>
                                                                                                        </DropdownMenuCheckboxItem>
                                                                                                    );
                                                                                                })
                                                                                            ) : (
                                                                                                <div className="p-2 text-center text-xs text-muted-foreground">No users found</div>
                                                                                            )}
                                                                                        </DropdownMenuSubContent>
                                                                                    </DropdownMenuSub>

                                                                                    <DropdownMenuSub>
                                                                                        <DropdownMenuSubTrigger className="rounded-xl p-2.5 gap-3 cursor-pointer focus:bg-muted">
                                                                                            <Layers className="h-4 w-4 text-primary" />
                                                                                            <span className="font-bold text-sm">Change Status</span>
                                                                                        </DropdownMenuSubTrigger>
                                                                                        <DropdownMenuSubContent className="bg-card border border-border rounded-xl p-1 w-48 shadow-2xl text-foreground">
                                                                                            {(['todo', 'in_progress', 'waiting', 'review', 'done'] as const).map(status => (
                                                                                                <DropdownMenuCheckboxItem
                                                                                                    key={status}
                                                                                                    checked={task.status === status}
                                                                                                    onCheckedChange={() => {}}
                                                                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUpdateStatus(task, status); }}
                                                                                                    className={cn(
                                                                                                        "rounded-lg p-2 flex items-center gap-2 cursor-pointer focus:bg-muted",
                                                                                                        task.status === status && "bg-primary/5 text-primary"
                                                                                                    )}
                                                                                                >
                                                                                                    <span className={cn(
                                                                                                        "text-xs font-semibold truncate",
                                                                                                        status === 'todo' && "text-foreground",
                                                                                                        status === 'in_progress' && "text-blue-500",
                                                                                                        status === 'waiting' && "text-orange-500",
                                                                                                        status === 'review' && "text-purple-500",
                                                                                                        status === 'done' && "text-emerald-500"
                                                                                                    )}>
                                                                                                        {STATUS_LABELS[status]}
                                                                                                    </span>
                                                                                                </DropdownMenuCheckboxItem>
                                                                                            ))}
                                                                                        </DropdownMenuSubContent>
                                                                                    </DropdownMenuSub>

                                                                                    <DropdownMenuSub>
                                                                                        <DropdownMenuSubTrigger className="rounded-xl p-2.5 gap-3 cursor-pointer focus:bg-muted">
                                                                                            <Clock className="h-4 w-4 text-primary" />
                                                                                            <span className="font-bold text-sm">Postpone Task</span>
                                                                                        </DropdownMenuSubTrigger>
                                                                                        <DropdownMenuSubContent className="bg-card border border-border rounded-xl p-1 w-48 shadow-2xl text-foreground">
                                                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePostponeTask(task, 1); }} className="rounded-lg p-2 cursor-pointer focus:bg-muted">
                                                                                                <span className="text-xs font-semibold">Postpone 1 Day</span>
                                                                                            </DropdownMenuItem>
                                                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePostponeTask(task, 3); }} className="rounded-lg p-2 cursor-pointer focus:bg-muted">
                                                                                                <span className="text-xs font-semibold">Postpone 3 Days</span>
                                                                                            </DropdownMenuItem>
                                                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePostponeTask(task, 7); }} className="rounded-lg p-2 cursor-pointer focus:bg-muted">
                                                                                                <span className="text-xs font-semibold">Postpone 1 Week</span>
                                                                                            </DropdownMenuItem>
                                                                                        </DropdownMenuSubContent>
                                                                                    </DropdownMenuSub>
                                                                                    <DropdownMenuSeparator className="bg-border" />
                                                                                </>
                                                                            )}

                                                                            {canDelete && (
                                                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="text-destructive rounded-xl p-2.5 gap-3 focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                                                                                    <Trash2 className="h-4 w-4" /> <span className="font-bold text-sm">Delete Task</span>
                                                                                </DropdownMenuItem>
                                                                            )}
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="p-12 text-center bg-transparent flex flex-col items-center gap-2">
                                                        <EyeOff className="h-8 w-8 text-muted-foreground opacity-30" />
                                                        <p className="text-[10px] font-bold text-muted-foreground opacity-40">No tasks in this category</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </TabsContent>

                    <TabsContent value="board" className="m-0 h-[calc(100vh-350px)]">
                        <TaskBoard 
                            tasks={filteredTasks} 
                            entityLogoMap={entityLogoMap}
                            onTaskClick={(t) => { setEditingTask(t); setEditorOpen(true); }} 
                            userMap={userMap}
                        />
                    </TabsContent>

                    <TabsContent value="calendar" className="m-0">
                        <TaskCalendar 
                            tasks={calendarFilteredTasks} 
                            onTaskClick={(t) => { setEditingTask(t); setEditorOpen(true); }} 
                            userMap={userMap}
                            onTaskUpdate={handleCalendarTaskUpdate}
                            onDateClick={(date) => {
                                setEditingTask({
                                    title: '',
                                    description: '',
                                    priority: 'medium',
                                    category: 'general',
                                    status: 'todo',
                                    assignedTo: currentUser?.uid ? [currentUser.uid] : [],
                                    startDate: date.toISOString(),
                                    dueDate: new Date(date.getTime() + 60 * 60 * 1000).toISOString()
                                } as any);
                                setEditorOpen(true);
                            }}
                        />
                    </TabsContent>
                </div>


            <TaskEditor
                open={editorOpen}
                onOpenChange={setEditorOpen}
                task={editingTask}
                onSave={handleSaveTask}
                isSaving={isSaving}
            />

            <AlertDialog open={!!taskToComplete} onOpenChange={(o) => !o && setTaskToComplete(null)}>
 <AlertDialogContent className="rounded-2xl p-0 border border-border shadow-lg overflow-hidden">
 <div className="p-10 text-center space-y-6">
 <div className="mx-auto bg-primary/10 w-20 h-20 rounded-2xl flex items-center justify-center">
 <CheckCircle2 className="h-10 w-10 text-primary" />
                        </div>
 <div className="space-y-2">
 <AlertDialogTitle className="text-2xl font-semibold tracking-tight">Resolve Task?</AlertDialogTitle>
 <AlertDialogDescription className="text-sm font-medium text-muted-foreground px-4">
 Confirming execution of <span className="font-bold text-foreground">"{taskToComplete?.title}"</span>. This will move the record to the archive.
                            </AlertDialogDescription>
                        </div>
                    </div>
 <div className="bg-muted/30 p-6 border-t border-border flex flex-col sm:flex-row gap-3">
 <AlertDialogCancel className="rounded-xl font-bold h-12 flex-1 border-none shadow-sm">Discard</AlertDialogCancel>
 <AlertDialogAction onClick={handleConfirmComplete} className="rounded-xl font-semibold h-12 flex-1 text-xs">
                            Commit Result
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
            </Tabs>
        </PageContainerFluid>
    );
}

function StatCard({ label, value, icon: Icon, color, bg }: { label: string, value: string | number, sub?: string, icon: any, color: string, bg: string }) {
    return (
        <div className="p-5 rounded-2xl border-none ring-1 ring-border shadow-sm bg-card hover:ring-primary/20 hover:shadow-md transition-all duration-200 flex items-center gap-3 group">
            <div className={cn("p-2.5 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", bg, color)}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold text-foreground tracking-tight tabular-nums">{value}</p>
            </div>
        </div>
    );
}