'use client';

import * as React from 'react';
import { collection, query, orderBy, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Task, UserProfile, TaskPriority, TaskCategory, TaskStatus, Tag } from '@/lib/types';
import { useEntityResolver } from '@/context/EntityCacheContext';
import { format, isToday, isPast, differenceInCalendarDays, addDays, startOfWeek, endOfWeek, endOfMonth, addMonths, addWeeks, startOfDay, endOfDay } from 'date-fns';
import { safeParseDate } from '@/lib/utils/date-utils';
import { Separator } from '@/components/ui/separator';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { 
    CheckCircle2, 
    Clock, 
    ShieldAlert, 
    Calendar, 
    Search, 
    X, 
    CheckSquare, 
    ListChecks, 
    Zap, 
    Layers, 
    User as UserIcon, 
    EyeOff, 
    ChevronDown, 
    ChevronLeft, 
    ChevronRight, 
    Target, 
    LayoutList, 
    Filter, 
    ArrowLeft, 
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { 
    updateTaskAction, 
    deleteTaskAction, 
    bulkUpdateTasksAction, 
    bulkDeleteTasksAction 
} from '@/lib/task-server-actions';
import { usePermissions } from '@/hooks/use-permissions';
import { useWorkspaceVisibility } from '@/hooks/use-workspace-visibility';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
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
} from '@/components/ui/dropdown-menu';
import TaskEditor from './components/TaskEditor';
import TaskBoard from './components/TaskBoard';
import TaskCalendar from './components/TaskCalendar';
import { TaskScopeSwitcher, type TaskScope } from './components/TaskScopeSwitcher';
import { TaskFilterChips, type FilterChipItem } from './components/TaskFilterChips';
import { motion, AnimatePresence } from 'framer-motion';
import { TaskListRow } from './components/TaskListRow';
import { TaskEmptyState } from './components/primitives/TaskEmptyState';
import { TaskErrorState } from './components/primitives/TaskErrorState';
import { TaskSkeleton } from './components/primitives/TaskSkeleton';
import { ConfirmDialog } from './components/primitives/ConfirmDialog';
import { 
    BulkActionReviewDialog, 
    type BulkActionType, 
    type BulkTaskFailure, 
    type BulkActionSnapshot 
} from './components/BulkActionReviewDialog';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenant } from '@/context/TenantContext';
import { PageContainerFluid } from '@/components/ui/page-container';
import { getErrorMessage } from '@/lib/errors/report-error';
import { useCapability } from '@/platform/capabilities/ui/use-capability';
import { CapabilityErrorNotice } from '@/components/capabilities/CapabilityErrorNotice';
import { VersionConflictDialog } from '@/components/capabilities/VersionConflictDialog';
import type { ClientCapabilityError } from '@/platform/capabilities/ui/types';
import type { TaskCreateInput, TaskCreateOutput } from '@/platform/domains/tasks_productivity/contracts/task-create.contract';
import type { TaskCompleteInput, TaskCompleteOutput } from '@/platform/domains/tasks_productivity/contracts/task-complete.contract';
import type { TaskUpdateInput, TaskUpdateOutput } from '@/platform/domains/tasks_productivity/contracts/task-update.contract';

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
    const { restrictTasksToAssigned, isWorkspaceAdmin } = useWorkspaceVisibility();

    const { can } = usePermissions();
    const canCreate = can('operations', 'tasks', 'create');
    const canDelete = can('operations', 'tasks', 'delete');
    const canEdit = can('operations', 'tasks', 'edit');
    
    // View State
    const [activeTab, setActiveTab] = React.useState('list');
    const [statusFilter, setStatusFilter] = React.useState<string>('all');
    const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [smartFilter, _setSmartFilter] = React.useState<'none' | 'today' | 'overdue'>('none');
    const [isSimpleView, setIsSimpleView] = React.useState(true);
    const [taskScope, setTaskScope] = React.useState<'my' | 'team' | 'all'>('all');
    const [selectedTagId, setSelectedTagId] = React.useState<string>('all');
    const [isMobileFilterOpen, setIsMobileFilterOpen] = React.useState(false);

    // Capability Governance & Error/Conflict Surfaces (Phase 1 / PR-9 / PR-11)
    const [capabilityError, setCapabilityError] = React.useState<ClientCapabilityError | null>(null);
    const [versionConflict, setVersionConflict] = React.useState<{
        expectedVersion?: string | number;
        actualVersion?: string | number;
    } | null>(null);

    const taskCreateCap = useCapability<TaskCreateInput, TaskCreateOutput>('task.create', {
        workspaceId: activeWorkspaceId,
    });
    const taskCompleteCap = useCapability<TaskCompleteInput, TaskCompleteOutput>('task.complete', {
        workspaceId: activeWorkspaceId,
    });
    const taskUpdateCap = useCapability<TaskUpdateInput, TaskUpdateOutput>('task.update', {
        workspaceId: activeWorkspaceId,
    });

    // Date Interval Filter States - Defaults to 'day' (Today) per business rules
    const [dateFilterType, setDateFilterType] = React.useState<'all' | 'range' | 'month' | 'week' | 'day'>('day');
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
        const map = new Map<string, string>();
        const now = new Date();
        for (let i = -12; i <= 12; i++) {
            const d = addMonths(now, i);
            map.set(format(d, 'yyyy-MM'), format(d, 'MMMM yyyy'));
        }
        // Ensure the currently-selected month is always an available option,
        // so arrow navigation beyond the default range still renders a label.
        if (selectedMonth && !map.has(selectedMonth)) {
            const d = new Date(`${selectedMonth}-01T00:00:00`);
            map.set(selectedMonth, format(d, 'MMMM yyyy'));
        }
        return [...map.entries()]
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .map(([value, label]) => ({ value, label }));
    }, [selectedMonth]);

    // Generate Week Options dynamically (8 weeks in past to 24 weeks in future)
    const weekOptions = React.useMemo(() => {
        const map = new Map<string, string>();
        const now = new Date();
        const startOfCurrentWeek = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
        for (let i = -8; i <= 24; i++) {
            const d = addWeeks(startOfCurrentWeek, i);
            const wEnd = endOfWeek(d, { weekStartsOn: 1 });
            map.set(format(d, 'yyyy-MM-dd'), `Week of ${format(d, 'MMM d, yyyy')} - ${format(wEnd, 'MMM d, yyyy')}`);
        }
        // Ensure the currently-selected week is always an available option,
        // so arrow navigation beyond the default range still renders a label.
        if (selectedWeek && !map.has(selectedWeek)) {
            const d = startOfDay(new Date(selectedWeek));
            const wEnd = endOfWeek(d, { weekStartsOn: 1 });
            map.set(selectedWeek, `Week of ${format(d, 'MMM d, yyyy')} - ${format(wEnd, 'MMM d, yyyy')}`);
        }
        return [...map.entries()]
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .map(([value, label]) => ({ value, label }));
    }, [selectedWeek]);

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

    // Period navigation (prev/next arrows beside the date selector)
    const navigateMonth = (direction: 1 | -1) => {
        const base = selectedMonth ? new Date(`${selectedMonth}-01T00:00:00`) : new Date();
        setSelectedMonth(format(addMonths(base, direction), 'yyyy-MM'));
    };

    const navigateWeek = (direction: 1 | -1) => {
        const base = selectedWeek
            ? startOfDay(new Date(selectedWeek))
            : startOfWeek(new Date(), { weekStartsOn: 1 });
        setSelectedWeek(format(addWeeks(base, direction), 'yyyy-MM-dd'));
    };

    const navigateDay = (direction: 1 | -1) => {
        let base = new Date();
        if (selectedDayType === 'yesterday') base = addDays(new Date(), -1);
        else if (selectedDayType === 'tomorrow') base = addDays(new Date(), 1);
        else if (selectedDayType === 'custom' && selectedCustomDay) base = selectedCustomDay;
        setSelectedDayType('custom');
        setSelectedCustomDay(addDays(base, direction));
    };

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
    const [pendingTaskIds, setPendingTaskIds] = React.useState<Set<string>>(new Set());
    const [bulkReviewState, setBulkReviewState] = React.useState<{
        isOpen: boolean;
        actionType: BulkActionType;
        targetValue?: string;
        targetLabel?: string;
        failedTasks?: BulkTaskFailure[];
    }>({
        isOpen: false,
        actionType: 'status',
    });

    const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
        overdue: true,
        current: true,
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

    const tagsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'tags'),
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);

    const { entitiesById, resolveIds } = useEntityResolver();

    const { data: allTasks, isLoading: isLoadingTasks, error: tasksError } = useCollection<Task>(tasksQuery);
    const { data: users } = useCollection<UserProfile>(usersQuery);
    const { data: workspaceTags } = useCollection<Tag>(tagsQuery);

    const selectedTasksSnapshot = React.useMemo(() => {
        return (allTasks || [])
            .filter(t => selectedIds.includes(t.id))
            .map(t => ({ id: t.id, title: t.title }));
    }, [allTasks, selectedIds]);

    // Resolve only the entities referenced by the loaded tasks (logo lookup),
    // instead of streaming the full workspace_entities set.
    React.useEffect(() => {
        const ids = [...new Set((allTasks || []).map(t => t.entityId).filter(Boolean) as string[])];
        if (ids.length) resolveIds(ids);
    }, [allTasks, resolveIds]);

    const entityLogoMap = React.useMemo(() => {
        const map = new Map<string, string | undefined>();
        entitiesById.forEach((e, id) => map.set(id, e.logoUrl));
        return map;
    }, [entitiesById]);

    const userMap = React.useMemo(() => {
        if (!users) return new Map<string, UserProfile>();
        return new Map(users.map(u => [u.id, u]));
    }, [users]);

    const workspaceUsers = React.useMemo(() => {
        if (!users || !activeWorkspaceId) return [];
        return users.filter(u => u.workspaceIds?.includes(activeWorkspaceId));
    }, [users, activeWorkspaceId]);

    const isLoading = isLoadingTasks || isLoadingFilter;

    // Shared matchers reused by the list, the stat cards, and the period grouping
    // so that scoping logic stays in one place.
    const matchesAssignee = React.useCallback((task: Task) => {
        // Enforce fail-closed restriction for standard users
        if (restrictTasksToAssigned && !isWorkspaceAdmin && currentUser?.uid) {
            const isAssigned = Array.isArray(task.assignedTo)
                ? task.assignedTo.includes(currentUser.uid)
                : task.assignedTo === currentUser.uid;
            const isCreator = task.createdBy === currentUser.uid;
            return isAssigned || isCreator;
        }

        // Standard filtering for admins or workspaces with "All Tasks" enabled
        if (!assignedUserId) return true;
        if (assignedUserId === 'unassigned') {
            return !task.assignedTo || (Array.isArray(task.assignedTo) && task.assignedTo.length === 0);
        }
        if (Array.isArray(task.assignedTo)) return task.assignedTo.includes(assignedUserId);
        return task.assignedTo === assignedUserId;
    }, [assignedUserId, restrictTasksToAssigned, isWorkspaceAdmin, currentUser?.uid]);

    const matchesDateFilter = React.useCallback((task: Task) => {
        if (dateFilterType === 'all') return true;
        const taskDate = safeParseDate(task.dueDate);
        if (!taskDate) return false;

        if (dateFilterType === 'range') {
            if (dateRange.start && startOfDay(taskDate) < startOfDay(dateRange.start)) return false;
            if (dateRange.end && endOfDay(taskDate) > endOfDay(dateRange.end)) return false;
            return true;
        }
        if (dateFilterType === 'month' && selectedMonth) {
            const [year, month] = selectedMonth.split('-').map(Number);
            return taskDate.getFullYear() === year && (taskDate.getMonth() + 1) === month;
        }
        if (dateFilterType === 'week' && selectedWeek) {
            const weekStart = startOfDay(new Date(selectedWeek));
            const weekEnd = endOfDay(addDays(weekStart, 6));
            return taskDate >= weekStart && taskDate <= weekEnd;
        }
        if (dateFilterType === 'day') {
            let targetDate = new Date();
            if (selectedDayType === 'yesterday') targetDate = addDays(new Date(), -1);
            else if (selectedDayType === 'tomorrow') targetDate = addDays(new Date(), 1);
            else if (selectedDayType === 'custom' && selectedCustomDay) targetDate = selectedCustomDay;
            return differenceInCalendarDays(taskDate, targetDate) === 0;
        }
        return true;
    }, [dateFilterType, dateRange, selectedMonth, selectedWeek, selectedDayType, selectedCustomDay]);

    const filteredTasks = React.useMemo(() => {
        if (!allTasks) return [];
        return allTasks.filter(task => {
            let matchesScope = true;
            if (taskScope === 'my') {
                const uid = currentUser?.uid;
                matchesScope = uid 
                    ? (Array.isArray(task.assignedTo) ? task.assignedTo.includes(uid) : task.assignedTo === uid) 
                    : true;
            } else if (taskScope === 'team') {
                matchesScope = Array.isArray(task.assignedTo) ? task.assignedTo.length > 0 : Boolean(task.assignedTo);
            }

            const matchesTag = selectedTagId === 'all'
                ? true
                : Boolean(task.tagIds && task.tagIds.includes(selectedTagId));

            const matchesStatus = statusFilter === 'all' ? true : task.status === statusFilter;
            const matchesPriority = priorityFilter === 'all' ? true : task.priority === priorityFilter;

            const matchesSearch = searchTerm ?
                task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.entityName?.toLowerCase().includes(searchTerm.toLowerCase())
                : true;

            let matchesSmart = true;
            const parsedDue = safeParseDate(task.dueDate);
            if (smartFilter === 'today') {
                matchesSmart = Boolean(parsedDue && isToday(parsedDue) && task.status !== 'done');
            } else if (smartFilter === 'overdue') {
                matchesSmart = Boolean(parsedDue && isPast(parsedDue) && !isToday(parsedDue) && task.status !== 'done');
            }

            return matchesScope && matchesTag && matchesStatus && matchesPriority && matchesAssignee(task) && matchesSearch && matchesSmart && matchesDateFilter(task);
        });
    }, [allTasks, taskScope, selectedTagId, statusFilter, priorityFilter, searchTerm, smartFilter, currentUser?.uid, matchesAssignee, matchesDateFilter]);

    const calendarFilteredTasks = React.useMemo(() => {
        if (!allTasks) return [];
        return allTasks.filter(task => {
            let matchesScope = true;
            if (taskScope === 'my') {
                const uid = currentUser?.uid;
                matchesScope = uid 
                    ? (Array.isArray(task.assignedTo) ? task.assignedTo.includes(uid) : task.assignedTo === uid) 
                    : true;
            } else if (taskScope === 'team') {
                matchesScope = Array.isArray(task.assignedTo) ? task.assignedTo.length > 0 : Boolean(task.assignedTo);
            }

            const matchesTag = selectedTagId === 'all'
                ? true
                : Boolean(task.tagIds && task.tagIds.includes(selectedTagId));

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
            const parsedDue = safeParseDate(task.dueDate);
            if (smartFilter === 'today') {
                matchesSmart = Boolean(parsedDue && isToday(parsedDue) && task.status !== 'done');
            } else if (smartFilter === 'overdue') {
                matchesSmart = Boolean(parsedDue && isPast(parsedDue) && !isToday(parsedDue) && task.status !== 'done');
            }

            return matchesScope && matchesTag && matchesStatus && matchesPriority && matchesAssigned && matchesSearch && matchesSmart;
        });
    }, [allTasks, taskScope, selectedTagId, statusFilter, priorityFilter, assignedUserId, searchTerm, smartFilter, currentUser?.uid]);

    // The first ("current period") accordion adapts to the active date filter.
    // All Time / Custom Range fall back to a monthly grouping.
    const periodGrouping = React.useMemo<'day' | 'week' | 'month'>(() => {
        if (dateFilterType === 'day') return 'day';
        if (dateFilterType === 'week') return 'week';
        return 'month';
    }, [dateFilterType]);

    const currentPeriodLabel = periodGrouping === 'day'
        ? 'Today'
        : periodGrouping === 'week'
            ? 'This Week'
            : 'This Month';

    // Whether the selected period (after any arrow navigation) is the real-world
    // current period. When false, the current-period accordion is hidden.
    const isViewingCurrentPeriod = React.useMemo(() => {
        if (dateFilterType === 'day') {
            let target = new Date();
            if (selectedDayType === 'yesterday') target = addDays(new Date(), -1);
            else if (selectedDayType === 'tomorrow') target = addDays(new Date(), 1);
            else if (selectedDayType === 'custom' && selectedCustomDay) target = selectedCustomDay;
            return isToday(target);
        }
        if (dateFilterType === 'week') {
            if (!selectedWeek) return true;
            return selectedWeek === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        }
        if (dateFilterType === 'month') {
            if (!selectedMonth) return true;
            return selectedMonth === format(new Date(), 'yyyy-MM');
        }
        return true; // all / range have no period navigation
    }, [dateFilterType, selectedDayType, selectedCustomDay, selectedWeek, selectedMonth]);

    const groupedListTasks = React.useMemo(() => {
        const overdue: Task[] = [];
        const current: Task[] = [];
        const upcoming: Task[] = [];
        const completed: Task[] = [];

        const now = new Date();
        const periodEnd = periodGrouping === 'day'
            ? endOfDay(now)
            : periodGrouping === 'week'
                ? endOfWeek(now, { weekStartsOn: 1 })
                : endOfMonth(now);

        filteredTasks.forEach(task => {
            if (task.status === 'done') {
                completed.push(task);
                return;
            }

            const dueDateObj = safeParseDate(task.dueDate);
            if (!dueDateObj) {
                upcoming.push(task);
            } else if (differenceInCalendarDays(dueDateObj, now) < 0) {
                // Past due (before today) is always Overdue, regardless of period.
                overdue.push(task);
            } else if (dueDateObj <= periodEnd) {
                // Due today through the end of the current period.
                current.push(task);
            } else {
                upcoming.push(task);
            }
        });

        return { overdue, current, upcoming, completed };
    }, [filteredTasks, periodGrouping]);

    // Stat cards reflect the currently-selected date range, assignee scope, and tags,
    // independent of status/search/smart filters.
    const statsScopedTasks = React.useMemo(() => {
        if (!allTasks) return [];
        return allTasks.filter(task => {
            let matchesScope = true;
            if (taskScope === 'my') {
                const uid = currentUser?.uid;
                matchesScope = uid 
                    ? (Array.isArray(task.assignedTo) ? task.assignedTo.includes(uid) : task.assignedTo === uid) 
                    : true;
            } else if (taskScope === 'team') {
                matchesScope = Array.isArray(task.assignedTo) ? task.assignedTo.length > 0 : Boolean(task.assignedTo);
            }

            const matchesTag = selectedTagId === 'all'
                ? true
                : Boolean(task.tagIds && task.tagIds.includes(selectedTagId));

            return matchesScope && matchesTag && matchesAssignee(task) && matchesDateFilter(task);
        });
    }, [allTasks, taskScope, selectedTagId, currentUser?.uid, matchesAssignee, matchesDateFilter]);

    const stats = React.useMemo(() => {
        const scoped = statsScopedTasks;
        const active = scoped.filter(t => t.status !== 'done').length;
        const resolved = scoped.filter(t => t.status === 'done').length;
        const overdue = scoped.filter(t => {
            const date = safeParseDate(t.dueDate);
            return date ? isPast(date) && !isToday(date) && t.status !== 'done' : false;
        }).length;
        const efficiency = scoped.length > 0 ? Math.round((resolved / scoped.length) * 100) : 100;
        return { active, resolved, overdue, efficiency };
    }, [statsScopedTasks]);

    const canViewAllTasks = isWorkspaceAdmin || !restrictTasksToAssigned;

    const handleScopeChange = (newScope: TaskScope) => {
        if (newScope === 'all' && !canViewAllTasks) {
            toast({
                variant: 'destructive',
                title: 'Access Restricted',
                description: 'You do not have permission to view all workspace tasks.',
                actionConfig: {
                    path: '/admin/settings/permissions',
                    label: 'View Permissions',
                },
            });
            return;
        }
        setTaskScope(newScope);
    };

    const scopeCounts = React.useMemo(() => {
        if (!allTasks) return { my: 0, team: 0, all: 0 };
        const uid = currentUser?.uid;
        const myCount = allTasks.filter(t => {
            if (!uid) return false;
            return Array.isArray(t.assignedTo) ? t.assignedTo.includes(uid) : t.assignedTo === uid;
        }).length;
        const teamCount = allTasks.filter(t => {
            return Array.isArray(t.assignedTo) ? t.assignedTo.length > 0 : Boolean(t.assignedTo);
        }).length;
        return {
            my: myCount,
            team: teamCount,
            all: allTasks.length,
        };
    }, [allTasks, currentUser?.uid]);

    const activeFilterCount = React.useMemo(() => {
        let count = 0;
        if (taskScope !== 'all') count++;
        if (statusFilter !== 'all') count++;
        if (priorityFilter !== 'all') count++;
        if (selectedTagId !== 'all') count++;
        if (dateFilterType !== 'day') count++;
        if (searchTerm.trim()) count++;
        return count;
    }, [taskScope, statusFilter, priorityFilter, selectedTagId, dateFilterType, searchTerm]);

    const filterChips: FilterChipItem[] = React.useMemo(() => {
        const chips: FilterChipItem[] = [];
        if (taskScope !== 'all') {
            chips.push({
                key: 'scope',
                label: `Scope: ${taskScope === 'my' ? 'My Tasks' : 'Team Tasks'}`,
                value: taskScope,
            });
        }
        if (statusFilter !== 'all') {
            chips.push({
                key: 'status',
                label: `Status: ${STATUS_LABELS[statusFilter as TaskStatus] || statusFilter}`,
                value: statusFilter,
            });
        }
        if (priorityFilter !== 'all') {
            chips.push({
                key: 'priority',
                label: `Priority: ${priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1)}`,
                value: priorityFilter,
            });
        }
        if (selectedTagId !== 'all') {
            const tag = workspaceTags?.find(t => t.id === selectedTagId);
            chips.push({
                key: 'tag',
                label: `Tag: ${tag ? tag.name : selectedTagId}`,
                value: selectedTagId,
            });
        }
        if (dateFilterType !== 'day') {
            let dateLabel = `Date: ${dateFilterType}`;
            if (dateFilterType === 'all') dateLabel = 'Date: All Time';
            else if (dateFilterType === 'month') dateLabel = `Month: ${selectedMonth}`;
            else if (dateFilterType === 'week') dateLabel = `Week: ${selectedWeek}`;
            else if (dateFilterType === 'range') dateLabel = 'Date: Custom Range';
            chips.push({
                key: 'date',
                label: dateLabel,
                value: dateFilterType,
            });
        }
        if (searchTerm.trim()) {
            chips.push({
                key: 'search',
                label: `Search: "${searchTerm.trim()}"`,
                value: searchTerm.trim(),
            });
        }
        return chips;
    }, [taskScope, statusFilter, priorityFilter, selectedTagId, dateFilterType, selectedMonth, selectedWeek, searchTerm, workspaceTags]);

    const handleRemoveChip = (chip: FilterChipItem) => {
        if (chip.key === 'scope') handleScopeChange('all');
        else if (chip.key === 'status') setStatusFilter('all');
        else if (chip.key === 'priority') setPriorityFilter('all');
        else if (chip.key === 'tag') setSelectedTagId('all');
        else if (chip.key === 'date') setDateFilterType('all');
        else if (chip.key === 'search') setSearchTerm('');
    };

    const handleClearFilters = () => {
        setStatusFilter('all');
        setPriorityFilter('all');
        setSelectedTagId('all');
        setSearchTerm('');
        setDateFilterType('all');
        setTaskScope('all');
    };

    const handleCreateNewTask = () => {
        if (!canCreate) {
            toast({
                variant: 'destructive',
                title: 'Permission Denied',
                description: 'You do not have permission to create tasks in this workspace.',
                actionConfig: {
                    path: '/admin/settings/permissions',
                    label: 'View Permissions',
                },
            });
            return;
        }
        setEditingTask(null);
        setEditorOpen(true);
    };

    const handleQuickComplete = async (task: Task) => {
        if (!currentUser) return;
        setPendingTaskIds(prev => new Set(prev).add(task.id));
        const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
        try {
            const res = await updateTaskAction(task.id, { ...task, status: newStatus });
            if (res.success) {
                toast({ title: newStatus === 'done' ? 'Task Completed' : 'Task Reopened' });
            } else {
                toast({ 
                    variant: 'destructive', 
                    title: 'Update Failed', 
                    description: res.error || 'Failed to update task status.',
                    actionConfig: { path: '/admin/settings/permissions', label: 'Check Permissions' }
                });
            }
        } catch (e: unknown) {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(e) || 'Failed to update task' });
        } finally {
            setPendingTaskIds(prev => {
                const next = new Set(prev);
                next.delete(task.id);
                return next;
            });
        }
    };

    const _handleUpdateAssignee = async (task: Task, userId: string) => {
        if (!currentUser) return;
        setPendingTaskIds(prev => new Set(prev).add(task.id));
        try {
            const currentAssignees = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
            const nextAssignees = currentAssignees.includes(userId)
                ? currentAssignees.filter(id => id !== userId)
                : [...currentAssignees, userId];

            const res = await updateTaskAction(task.id, { ...task, assignedTo: nextAssignees });
            if (res.success) {
                toast({ title: 'Assignees updated successfully' });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: res.error });
            }
        } catch (e: unknown) {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(e) || 'Failed to update assignee' });
        } finally {
            setPendingTaskIds(prev => {
                const next = new Set(prev);
                next.delete(task.id);
                return next;
            });
        }
    };

    const handleUpdateStatus = async (task: Task, newStatus: TaskStatus) => {
        if (!currentUser) return;
        setPendingTaskIds(prev => new Set(prev).add(task.id));
        try {
            const res = await updateTaskAction(task.id, { ...task, status: newStatus });
            if (res.success) {
                toast({ title: `Status updated to ${STATUS_LABELS[newStatus]}` });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: res.error });
            }
        } catch (e: unknown) {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(e) || 'Failed to update status' });
        } finally {
            setPendingTaskIds(prev => {
                const next = new Set(prev);
                next.delete(task.id);
                return next;
            });
        }
    };

    const handlePostponeTask = async (task: Task, days: number) => {
        if (!currentUser) return;
        setPendingTaskIds(prev => new Set(prev).add(task.id));
        try {
            const currentDueDate = safeParseDate(task.dueDate) || new Date();
            const newDueDate = addDays(currentDueDate, days).toISOString();
            const res = await updateTaskAction(task.id, { ...task, dueDate: newDueDate });
            if (res.success) {
                toast({ title: `Task postponed by ${days} day${days > 1 ? 's' : ''}` });
            } else {
                toast({ variant: 'destructive', title: 'Update Failed', description: res.error });
            }
        } catch (e: unknown) {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(e) || 'Failed to postpone task' });
        } finally {
            setPendingTaskIds(prev => {
                const next = new Set(prev);
                next.delete(task.id);
                return next;
            });
        }
    };

    const handleCalendarTaskUpdate = async (taskId: string, updatedFields: Partial<Task>) => {
        if (!currentUser) return false;
        try {
            const task = allTasks?.find(t => t.id === taskId);
            if (!task) return false;
            const res = await updateTaskAction(taskId, { ...task, ...updatedFields });
            if (res.success) {
                toast({ title: 'Task rescheduled successfully' });
                return true;
            } else {
                toast({ variant: 'destructive', title: 'Reschedule Failed', description: res.error });
                return false;
            }
        } catch (e: unknown) {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(e) || 'Failed to reschedule task' });
            return false;
        }
    };

    const handleSaveTask = async (payload: { title: string; description?: string; priority?: TaskPriority; dueDate?: string; entityId?: string; category?: string; [key: string]: unknown }) => {
        if (!currentUser) return;
        if (!canCreate && !editingTask) {
            toast({
                variant: 'destructive',
                title: 'Permission Denied',
                description: 'You do not have permission to create tasks in this workspace.',
                actionConfig: {
                    path: '/admin/settings/permissions',
                    label: 'View Permissions',
                },
            });
            return;
        }
        if (!canEdit && editingTask) {
            toast({
                variant: 'destructive',
                title: 'Permission Denied',
                description: 'You do not have permission to edit tasks in this workspace.',
                actionConfig: {
                    path: '/admin/settings/permissions',
                    label: 'View Permissions',
                },
            });
            return;
        }
        setIsSaving(true);
        setCapabilityError(null);
        try {
            if (editingTask) {
                const outcome = await taskUpdateCap.execute({
                    workspaceId: activeWorkspaceId,
                    taskId: editingTask.id,
                    title: payload.title,
                    description: payload.description,
                    priority: payload.priority,
                    dueDate: payload.dueDate,
                });

                if (outcome.success) {
                    toast({ title: 'Task Architecture Synchronized' });
                    setEditorOpen(false);
                    setEditingTask(null);
                } else {
                    if (outcome.error.code === 'VERSION_CONFLICT' || outcome.error.conflict) {
                        setVersionConflict(outcome.error.conflict || { expectedVersion: 'current', actualVersion: 'latest' });
                    }
                    setCapabilityError(outcome.error);
                    toast({ variant: 'destructive', title: 'Operation Failed', description: outcome.error.message });
                }
            } else {
                const outcome = await taskCreateCap.execute({
                    workspaceId: activeWorkspaceId,
                    title: payload.title,
                    description: payload.description,
                    priority: payload.priority,
                    dueDate: payload.dueDate,
                    entityId: payload.entityId,
                    category: payload.category || 'follow_up',
                });

                if (outcome.success) {
                    toast({ title: 'Task Initialized' });
                    setEditorOpen(false);
                    setEditingTask(null);
                } else {
                    setCapabilityError(outcome.error);
                    toast({ variant: 'destructive', title: 'Operation Failed', description: outcome.error.message });
                }
            }
        } catch (e: unknown) {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(e) || "Failed to save task." });
        } finally {
            setIsSaving(false);
        }
    };

    const _handleQuickCategorySelect = (category: TaskCategory) => {
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
            updatedAt: new Date().toISOString(),
            reminderSent: false,
            reminders: [],
            source: 'manual'
        });
        setEditorOpen(true);
    };

    const handleConfirmComplete = async () => {
        if (!currentUser || !taskToComplete) return;
        
        const isDone = taskToComplete.status === 'done';
        setCapabilityError(null);
        setPendingTaskIds(prev => new Set(prev).add(taskToComplete.id));
        
        try {
            if (!isDone) {
                const outcome = await taskCompleteCap.execute({
                    workspaceId: activeWorkspaceId,
                    taskId: taskToComplete.id,
                });
                if (outcome.success) {
                    toast({ title: 'Protocol Resolved' });
                } else {
                    if (outcome.error.code === 'VERSION_CONFLICT' || outcome.error.conflict) {
                        setVersionConflict(outcome.error.conflict || { expectedVersion: 'current', actualVersion: 'latest' });
                    }
                    setCapabilityError(outcome.error);
                    toast({ variant: 'destructive', title: 'Update Failed', description: outcome.error.message });
                }
            } else {
                const res = await updateTaskAction(taskToComplete.id, { ...taskToComplete, status: 'todo' });
                if (res.success) {
                    toast({ title: 'Task Reopened' });
                } else {
                    toast({ variant: 'destructive', title: 'Update Failed', description: res.error });
                }
            }
        } catch (e: unknown) {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(e) });
        } finally {
            setPendingTaskIds(prev => {
                const next = new Set(prev);
                next.delete(taskToComplete.id);
                return next;
            });
            setTaskToComplete(null);
        }
    };

    const handleDelete = async (task: Task) => {
        if (!currentUser) return;
        if (!canDelete) {
            toast({
                variant: 'destructive',
                title: 'Permission Denied',
                description: 'You do not have permission to delete tasks in this workspace.',
                actionConfig: {
                    path: '/admin/settings/permissions',
                    label: 'View Permissions',
                },
            });
            return;
        }
        setPendingTaskIds(prev => new Set(prev).add(task.id));
        try {
            const res = await deleteTaskAction(task.id);
            if (res.success) {
                toast({ title: 'Record Purged', description: `Task "${task.title}" deleted.` });
            } else {
                toast({ 
                    variant: 'destructive', 
                    title: 'Delete Failed', 
                    description: res.error,
                    actionConfig: {
                        path: '/admin/settings/permissions',
                        label: 'Check Permissions',
                    },
                });
            }
        } catch (e: unknown) {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(e) });
        } finally {
            setPendingTaskIds(prev => {
                const next = new Set(prev);
                next.delete(task.id);
                return next;
            });
            setTaskToDelete(null);
        }
    };

    const handleBulkComplete = () => {
        if (!currentUser || selectedIds.length === 0) return;
        setBulkReviewState({
            isOpen: true,
            actionType: 'status',
            targetValue: 'done',
            targetLabel: 'Resolved',
            failedTasks: undefined,
        });
    };

    const handleBulkDelete = () => {
        if (!currentUser || selectedIds.length === 0) return;
        setBulkReviewState({
            isOpen: true,
            actionType: 'delete',
            failedTasks: undefined,
        });
    };

    const handleBulkAssign = (userId: string) => {
        if (!currentUser || selectedIds.length === 0) return;
        const userObj = workspaceUsers?.find(u => u.id === userId);
        setBulkReviewState({
            isOpen: true,
            actionType: 'assign',
            targetValue: userId,
            targetLabel: userObj?.name || 'Assignee',
            failedTasks: undefined,
        });
    };

    const handleBulkChangeStatus = (status: TaskStatus) => {
        if (!currentUser || selectedIds.length === 0) return;
        setBulkReviewState({
            isOpen: true,
            actionType: 'status',
            targetValue: status,
            targetLabel: STATUS_LABELS[status],
            failedTasks: undefined,
        });
    };

    const handleBulkConfirm = async (snapshot: BulkActionSnapshot) => {
        if (!currentUser || snapshot.taskIds.length === 0) return;
        setIsBulkProcessing(true);
        setBulkReviewState(prev => ({ ...prev, failedTasks: undefined }));

        try {
            if (snapshot.actionType === 'delete') {
                const res = await bulkDeleteTasksAction(snapshot.taskIds, activeWorkspaceId);
                if (res.success) {
                    toast({ title: 'Bulk Delete Success', description: `${snapshot.taskIds.length} tasks permanently deleted.` });
                    setSelectedIds([]);
                    setIsSelectionMode(false);
                    setBulkReviewState(prev => ({ ...prev, isOpen: false }));
                } else {
                    const failed: BulkTaskFailure[] = snapshot.taskIds.map(id => {
                        const t = (allTasks || []).find(task => task.id === id);
                        return {
                            id,
                            title: t?.title || `Task ${id.slice(0, 8)}...`,
                            error: res.error || 'Failed to delete task.',
                        };
                    });
                    setBulkReviewState(prev => ({ ...prev, failedTasks: failed }));
                    toast({
                        variant: 'destructive',
                        title: 'Bulk Action Failed',
                        description: res.error || 'Failed to delete tasks.',
                        actionConfig: {
                            path: '/admin/settings/permissions',
                            label: 'Check Permissions',
                        },
                    });
                }
            } else if (snapshot.actionType === 'status') {
                const targetStatus = (snapshot.targetValue || 'done') as TaskStatus;
                const res = await bulkUpdateTasksAction(snapshot.taskIds, { status: targetStatus }, activeWorkspaceId);
                if (res.success) {
                    toast({ title: 'Bulk Status Update Success', description: `${snapshot.taskIds.length} tasks updated to ${STATUS_LABELS[targetStatus]}.` });
                    setSelectedIds([]);
                    setIsSelectionMode(false);
                    setBulkReviewState(prev => ({ ...prev, isOpen: false }));
                } else {
                    const failed: BulkTaskFailure[] = snapshot.taskIds.map(id => {
                        const t = (allTasks || []).find(task => task.id === id);
                        return {
                            id,
                            title: t?.title || `Task ${id.slice(0, 8)}...`,
                            error: res.error || 'Failed to update task status.',
                        };
                    });
                    setBulkReviewState(prev => ({ ...prev, failedTasks: failed }));
                    toast({
                        variant: 'destructive',
                        title: 'Bulk Action Failed',
                        description: res.error || 'Failed to update task status.',
                        actionConfig: {
                            path: '/admin/settings/permissions',
                            label: 'Check Permissions',
                        },
                    });
                }
            } else if (snapshot.actionType === 'assign') {
                const userId = snapshot.targetValue || '';
                const userObj = workspaceUsers?.find(u => u.id === userId);
                const res = await bulkUpdateTasksAction(snapshot.taskIds, { assignedTo: userId ? [userId] : [] }, activeWorkspaceId);
                if (res.success) {
                    toast({ title: 'Bulk Assignment Success', description: `${snapshot.taskIds.length} tasks assigned to ${userObj?.name || 'user'}.` });
                    setSelectedIds([]);
                    setIsSelectionMode(false);
                    setBulkReviewState(prev => ({ ...prev, isOpen: false }));
                } else {
                    const failed: BulkTaskFailure[] = snapshot.taskIds.map(id => {
                        const t = (allTasks || []).find(task => task.id === id);
                        return {
                            id,
                            title: t?.title || `Task ${id.slice(0, 8)}...`,
                            error: res.error || 'Failed to assign tasks.',
                        };
                    });
                    setBulkReviewState(prev => ({ ...prev, failedTasks: failed }));
                    toast({
                        variant: 'destructive',
                        title: 'Bulk Assignment Failed',
                        description: res.error || 'Failed to assign tasks.',
                        actionConfig: {
                            path: '/admin/settings/permissions',
                            label: 'Check Permissions',
                        },
                    });
                }
            }
        } catch (e: unknown) {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(e) });
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleRetryFailedBulkTasks = async (failedIds: string[]) => {
        await handleBulkConfirm({
            actionType: bulkReviewState.actionType,
            taskIds: failedIds,
            targetValue: bulkReviewState.targetValue,
            targetLabel: bulkReviewState.targetLabel,
        });
    };

    const handleBulkPostpone = async (days: number) => {
        if (!currentUser || selectedIds.length === 0 || !allTasks) return;
        setIsBulkProcessing(true);
        try {
            const promises = selectedIds.map(id => {
                const task = allTasks.find(t => t.id === id);
                if (!task || !task.dueDate) return Promise.resolve({ success: true });
                const currentDueDate = safeParseDate(task.dueDate) || new Date();
                const newDueDate = new Date(currentDueDate.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
                return updateTaskAction(id, { ...task, dueDate: newDueDate });
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
        } catch (e: unknown) {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(e) });
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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-6">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/admin"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                            aria-label="Back to Dashboard"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-3xl font-bold text-foreground tracking-tight">
                                Operations Hub
                            </h1>
                            <CardInfoTooltip text="Action items, global workflows, and execution protocols across all operations." />
                        </div>
                    </div>
                    {/* Header Tabs conforming to standard segmented pill */}
                    <TabsList className="inline-flex items-center gap-1 bg-muted/30 dark:bg-muted/40 p-1 rounded-xl border border-border/60 shadow-inner h-auto shrink-0">
                        <TabsTrigger 
                            value="list" 
                            className="h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground hover:bg-transparent"
                        >
                            <LayoutList className="h-3.5 w-3.5" /> List ({filteredTasks.length})
                        </TabsTrigger>
                        <TabsTrigger 
                            value="board" 
                            className="h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground hover:bg-transparent"
                        >
                            <Layers className="h-3.5 w-3.5" /> Board
                        </TabsTrigger>
                        <TabsTrigger 
                            value="calendar" 
                            className="h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground hover:bg-transparent"
                        >
                            <Calendar className="h-3.5 w-3.5" /> Calendar
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Capability Error Notice Surface (Rule 51 & PRD §53) */}
                {capabilityError && (
                    <CapabilityErrorNotice
                        error={capabilityError}
                        onDismiss={() => setCapabilityError(null)}
                    />
                )}
                {activeTab === 'list' && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-2xs">
                        <StatCard 
                            label="Active Actions" 
                            value={isLoading ? '...' : stats.active} 
                            icon={Zap} 
                            color="text-blue-500" 
                            bg="bg-blue-500/10" 
                            info="Tasks currently pending execution or in progress."
                        />
                        <StatCard 
                            label="Resolved Protocols" 
                            value={isLoading ? '...' : stats.resolved} 
                            icon={CheckCircle2} 
                            color="text-emerald-500" 
                            bg="bg-emerald-500/10" 
                            info="Successfully completed and verified tasks."
                        />
                        <StatCard 
                            label="Overdue Alerts" 
                            value={isLoading ? '...' : stats.overdue} 
                            icon={ShieldAlert} 
                            color="text-rose-500" 
                            bg="bg-rose-500/10" 
                            info="Tasks past their due date requiring urgent attention."
                        />
                        <StatCard 
                            label="Closure Velocity" 
                            value={isLoading ? '...' : `${stats.efficiency}%`} 
                            icon={Target} 
                            color="text-violet-500" 
                            bg="bg-violet-500/10" 
                            info="Rate of task completion against total recorded actions."
                        />
                    </div>
                )}


                {/* Toolbar */}
                <div className="flex flex-col gap-4 bg-card border border-border/80 shadow-sm p-4 sm:p-5 rounded-2xl">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-xl font-bold text-foreground tracking-tight">Tasks</h2>
                            <TaskScopeSwitcher
                                currentScope={taskScope}
                                onScopeChange={handleScopeChange}
                                canViewAllTasks={canViewAllTasks}
                                counts={scopeCounts}
                            />
                        </div>

                        {/* Mobile Search and Filter Button */}
                        <div className="flex md:hidden items-center gap-2 w-full">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
                                <Input 
                                    placeholder="Search tasks..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="h-11 min-h-[44px] rounded-xl bg-background border border-border text-foreground font-semibold pl-10 text-xs w-full"
                                />
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setIsMobileFilterOpen(true)}
                                className="h-11 min-h-[44px] px-3.5 rounded-xl border-border bg-background gap-2 text-xs font-semibold shrink-0 active:scale-[0.97]"
                            >
                                <Filter className="h-4 w-4" />
                                <span>Filters</span>
                                {activeFilterCount > 0 && (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] rounded-full">
                                        {activeFilterCount}
                                    </Badge>
                                )}
                            </Button>
                            {canCreate && (
                                <Button 
                                    onClick={handleCreateNewTask} 
                                    className="rounded-xl font-bold h-11 min-h-[44px] px-4 shadow-md bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.97] text-xs shrink-0"
                                >
                                    + Add
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Desktop Toolbar Row (hidden on small screens) */}
                    <div className="hidden md:flex flex-wrap items-center gap-3 pt-1 border-t border-border/40">
                        {activeTab === 'list' && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setIsSelectionMode(!isSelectionMode)} 
                                className={cn(
                                    "rounded-xl font-semibold text-xs gap-2 h-11 min-h-[44px] px-4 transition-all border border-border/80 bg-white dark:bg-card text-foreground hover:bg-muted/60 active:scale-[0.97] shadow-xs", 
                                    isSelectionMode && "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                                )}
                            >
                                {isSelectionMode ? <CheckSquare className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />} Selection
                            </Button>
                        )}
 
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-11 min-h-[44px] w-[140px] rounded-xl bg-background border-border text-foreground font-semibold text-xs focus:ring-0 focus:ring-offset-0">
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
                            <SelectTrigger className="h-11 min-h-[44px] w-[140px] rounded-xl bg-background border-border text-foreground font-semibold text-xs focus:ring-0 focus:ring-offset-0">
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

                        {/* Tag Filter Dropdown */}
                        <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                            <SelectTrigger className="h-11 min-h-[44px] w-[140px] rounded-xl bg-background border-border text-foreground font-semibold text-xs focus:ring-0 focus:ring-offset-0">
                                <SelectValue placeholder="All Tags" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border bg-card text-foreground">
                                <SelectItem value="all">All Tags</SelectItem>
                                {workspaceTags?.map((tag) => (
                                    <SelectItem key={tag.id} value={tag.id}>
                                        <div className="flex items-center gap-1.5">
                                            {tag.color && (
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                            )}
                                            <span className="truncate">{tag.name}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
 
                        {/* Date Filter Select */}
                        <Select value={dateFilterType} onValueChange={(val: 'all' | 'range' | 'month' | 'week' | 'day') => setDateFilterType(val)}>
                            <SelectTrigger className="h-11 min-h-[44px] w-[140px] rounded-xl bg-background border-border text-foreground font-semibold text-xs focus:ring-0 focus:ring-offset-0">
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
                                    className="h-11 min-h-[44px] rounded-xl bg-background border border-border text-foreground font-semibold text-xs w-[180px]"
                                />
                                <span className="text-muted-foreground text-xs font-semibold">to</span>
                                <DateTimePicker 
                                    value={dateRange.end || undefined} 
                                    onChange={(d) => setDateRange(prev => ({ ...prev, end: d || null }))} 
                                    className="h-11 min-h-[44px] rounded-xl bg-background border border-border text-foreground font-semibold text-xs w-[180px]"
                                />
                            </div>
                        )}

                        {/* Month Selector */}
                        {mounted && dateFilterType === 'month' && (
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => navigateMonth(-1)}
                                    aria-label="Previous month"
                                    className="h-11 w-11 min-h-[44px] min-w-[44px] active:scale-[0.97] rounded-xl bg-background border-border text-foreground hover:bg-muted/50 shrink-0"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                    <SelectTrigger className="h-11 min-h-[44px] w-[160px] rounded-xl bg-background border-border text-foreground font-semibold text-xs focus:ring-0 focus:ring-offset-0">
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
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => navigateMonth(1)}
                                    aria-label="Next month"
                                    className="h-11 w-11 min-h-[44px] min-w-[44px] active:scale-[0.97] rounded-xl bg-background border-border text-foreground hover:bg-muted/50 shrink-0"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {/* Week Selector */}
                        {mounted && dateFilterType === 'week' && (
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => navigateWeek(-1)}
                                    aria-label="Previous week"
                                    className="h-11 w-11 min-h-[44px] min-w-[44px] active:scale-[0.97] rounded-xl bg-background border-border text-foreground hover:bg-muted/50 shrink-0"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                                    <SelectTrigger className="h-11 min-h-[44px] w-[240px] rounded-xl bg-background border-border text-foreground font-semibold text-xs focus:ring-0 focus:ring-offset-0">
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
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => navigateWeek(1)}
                                    aria-label="Next week"
                                    className="h-11 w-11 min-h-[44px] min-w-[44px] active:scale-[0.97] rounded-xl bg-background border-border text-foreground hover:bg-muted/50 shrink-0"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {/* Day Selector */}
                        {mounted && dateFilterType === 'day' && (
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => navigateDay(-1)}
                                    aria-label="Previous day"
                                    className="h-11 w-11 min-h-[44px] min-w-[44px] active:scale-[0.97] rounded-xl bg-background border-border text-foreground hover:bg-muted/50 shrink-0"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Select value={selectedDayType} onValueChange={(val: 'today' | 'yesterday' | 'tomorrow' | 'custom') => setSelectedDayType(val)}>
                                    <SelectTrigger className="h-11 min-h-[44px] w-[150px] rounded-xl bg-background border-border text-foreground font-semibold text-xs focus:ring-0 focus:ring-offset-0">
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
                                        className="h-11 min-h-[44px] rounded-xl bg-background border border-border text-foreground font-semibold text-xs w-[180px]"
                                    />
                                )}
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => navigateDay(1)}
                                    aria-label="Next day"
                                    className="h-11 w-11 min-h-[44px] min-w-[44px] active:scale-[0.97] rounded-xl bg-background border-border text-foreground hover:bg-muted/50 shrink-0"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        <div className="relative w-full sm:w-[240px] group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
                            <Input 
                                placeholder="Search tasks..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="h-11 min-h-[44px] rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/45 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary font-semibold pl-10 text-xs"
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
                                    "h-11 min-h-[44px] rounded-xl px-4 gap-2 font-bold text-xs transition-all border-none ring-1 shrink-0 active:scale-[0.97]",
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
                                onClick={handleCreateNewTask} 
                                className="rounded-xl font-bold h-11 min-h-[44px] px-6 shadow-md bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.97] text-xs"
                            >
                                + Add Task
                            </Button>
                        )}
                    </div>

                    {filterChips.length > 0 && (
                        <TaskFilterChips
                            chips={filterChips}
                            totalMatching={filteredTasks.length}
                            onRemoveChip={handleRemoveChip}
                            onClearAll={handleClearFilters}
                            className="mt-1"
                        />
                    )}
                </div>

                {/* Mobile Filter Sheet */}
                <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
                    <SheetContent side="bottom" className="sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-6">
                        <SheetHeader className="pb-4 border-b border-border/60 text-left">
                            <SheetTitle className="text-base font-bold text-foreground">Filter Tasks</SheetTitle>
                            <SheetDescription className="sr-only">Filter tasks by scope, status, priority, tags, and date</SheetDescription>
                        </SheetHeader>
                        <div className="py-4 space-y-4">
                            {/* Scope */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Scope</label>
                                <TaskScopeSwitcher
                                    currentScope={taskScope}
                                    onScopeChange={handleScopeChange}
                                    canViewAllTasks={canViewAllTasks}
                                    counts={scopeCounts}
                                    className="w-full justify-between"
                                />
                            </div>

                            {/* Status */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Status</label>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="h-11 min-h-[44px] w-full rounded-xl bg-background border-border text-foreground font-semibold text-xs">
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
                            </div>

                            {/* Priority */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Priority</label>
                                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                                    <SelectTrigger className="h-11 min-h-[44px] w-full rounded-xl bg-background border-border text-foreground font-semibold text-xs">
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
                            </div>

                            {/* Tags */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Tag</label>
                                <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                                    <SelectTrigger className="h-11 min-h-[44px] w-full rounded-xl bg-background border-border text-foreground font-semibold text-xs">
                                        <SelectValue placeholder="All Tags" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border bg-card text-foreground">
                                        <SelectItem value="all">All Tags</SelectItem>
                                        {workspaceTags?.map((tag) => (
                                            <SelectItem key={tag.id} value={tag.id}>
                                                <div className="flex items-center gap-1.5">
                                                    {tag.color && (
                                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                                    )}
                                                    <span className="truncate">{tag.name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Date Filter */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Date Horizon</label>
                                <Select value={dateFilterType} onValueChange={(val: 'all' | 'range' | 'month' | 'week' | 'day') => setDateFilterType(val)}>
                                    <SelectTrigger className="h-11 min-h-[44px] w-full rounded-xl bg-background border-border text-foreground font-semibold text-xs">
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
                            </div>

                            {/* Reset Filters button */}
                            <div className="pt-2 flex items-center justify-between gap-3">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                        setTaskScope('all');
                                        setStatusFilter('all');
                                        setPriorityFilter('all');
                                        setSelectedTagId('all');
                                        setDateFilterType('day');
                                        setSearchTerm('');
                                    }}
                                    className="min-h-[44px] text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-[0.97]"
                                >
                                    Reset Filters
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => setIsMobileFilterOpen(false)}
                                    className="min-h-[44px] px-6 rounded-xl font-bold text-xs bg-primary text-primary-foreground active:scale-[0.97]"
                                >
                                    Done
                                </Button>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
 
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
                                            onClick={handleBulkComplete} 
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
                                            onClick={handleBulkDelete} 
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
                        {tasksError ? (
                            <TaskErrorState 
                                message={tasksError.message || "An error occurred while loading tasks."}
                                onRetry={() => window.location.reload()} 
                            />
                        ) : !isLoading && filteredTasks.length === 0 ? (
                            <TaskEmptyState 
                                isFiltered={activeFilterCount > 0} 
                                onClearFilters={handleClearFilters} 
                                onCreateTask={handleCreateNewTask} 
                            />
                        ) : (
                            /* Grouped Lists by Accordions */
                            (() => {
                                const categoriesConfig = [
                                    { id: 'current', label: currentPeriodLabel, tasks: groupedListTasks.current, count: groupedListTasks.current.length },
                                    { id: 'overdue', label: 'Overdue Tasks', tasks: groupedListTasks.overdue, count: groupedListTasks.overdue.length },
                                    { id: 'upcoming', label: 'Upcoming Tasks', tasks: groupedListTasks.upcoming, count: groupedListTasks.upcoming.length },
                                    { id: 'completed', label: 'Completed Archive', tasks: groupedListTasks.completed, count: groupedListTasks.completed.length },
                                ];

                                const isPeriodFilter = dateFilterType === 'day' || dateFilterType === 'week' || dateFilterType === 'month';

                                return categoriesConfig.map(category => {
                                    const isExpanded = expandedSections[category.id];
                                    if (category.id === 'current' && !isViewingCurrentPeriod) return null;
                                    if ((category.id === 'overdue' || category.id === 'upcoming') && category.count === 0 && isPeriodFilter) return null;
                                    if (category.id === 'completed' && category.count === 0 && !isPeriodFilter) return null;

                                    return (
                                        <div key={category.id} className="rounded-2xl border border-border/80 shadow-sm bg-card overflow-hidden">
                                            {/* Accordion Trigger */}
                                            <button
                                                type="button"
                                                onClick={() => toggleSection(category.id)}
                                                className="w-full flex items-center justify-between py-3.5 px-5 bg-muted/20 hover:bg-muted/30 border-b border-border/80 transition-all text-left cursor-pointer"
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
                                                <div className="divide-y divide-border/60">
                                                    {isLoading ? (
                                                        <div className="p-4">
                                                            <TaskSkeleton variant="list" count={3} />
                                                        </div>
                                                    ) : category.tasks.length > 0 ? (
                                                        category.tasks.map((task) => (
                                                            <TaskListRow
                                                                key={task.id}
                                                                task={task}
                                                                isSimpleView={isSimpleView}
                                                                isSelected={selectedIds.includes(task.id)}
                                                                isSelectionMode={isSelectionMode}
                                                                isPending={pendingTaskIds.has(task.id)}
                                                                userMap={userMap}
                                                                onSelect={toggleSelect}
                                                                onToggleComplete={handleQuickComplete}
                                                                onStatusChange={(_taskId, newStatus) => handleUpdateStatus(task, newStatus)}
                                                                onEdit={(t) => { setEditingTask(t); setEditorOpen(true); }}
                                                                onDelete={(t) => setTaskToDelete(t)}
                                                                onPostpone={(t, days) => handlePostponeTask(t, days)}
                                                                onClick={(t) => { setEditingTask(t); setEditorOpen(true); }}
                                                            />
                                                        ))
                                                    ) : (
                                                        <div className="p-8 text-center bg-transparent flex flex-col items-center gap-2">
                                                            <EyeOff className="h-6 w-6 text-muted-foreground opacity-30" />
                                                            <p className="text-[11px] font-semibold text-muted-foreground opacity-50">No tasks in this category</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                });
                            })()
                        )}
                    </TabsContent>

                    <TabsContent value="board" className="m-0 h-[calc(100vh-350px)]">
                        <TaskBoard 
                            tasks={filteredTasks} 
                            entityLogoMap={entityLogoMap} 
                            onTaskClick={(t) => { setEditingTask(t); setEditorOpen(true); }} 
                            userMap={userMap}
                            pendingTaskIds={pendingTaskIds}
                        />
                    </TabsContent>

                    <TabsContent value="calendar" className="m-0">
                        <TaskCalendar 
                            tasks={calendarFilteredTasks} 
                            onTaskClick={(t) => { setEditingTask(t); setEditorOpen(true); }} 
                            userMap={userMap}
                            onTaskUpdate={handleCalendarTaskUpdate}
                            onDateClick={(date) => {
                                if (!canCreate) {
                                    toast({
                                        variant: 'destructive',
                                        title: 'Permission Denied',
                                        description: 'You do not have permission to create tasks in this workspace.',
                                        actionConfig: {
                                            path: '/admin/settings/permissions',
                                            label: 'View Permissions',
                                        },
                                    });
                                    return;
                                }
                                setEditingTask({
                                    id: '',
                                    workspaceId: activeWorkspaceId,
                                    title: '',
                                    description: '',
                                    priority: 'medium',
                                    category: 'general',
                                    status: 'todo',
                                    assignedTo: currentUser?.uid ? [currentUser.uid] : [],
                                    startDate: date.toISOString(),
                                    dueDate: new Date(date.getTime() + 60 * 60 * 1000).toISOString(),
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                    reminders: [],
                                    reminderSent: false,
                                    source: 'manual'
                                });
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

            {/* Standardized Single Task Resolve Modal */}
            <ConfirmDialog
                isOpen={Boolean(taskToComplete)}
                onClose={() => setTaskToComplete(null)}
                onConfirm={handleConfirmComplete}
                title={taskToComplete?.status === 'done' ? 'Reopen Task?' : 'Resolve Task?'}
                description={`Confirming execution of "${taskToComplete?.title}". This will move the record to the ${taskToComplete?.status === 'done' ? 'backlog' : 'archive'}.`}
                confirmText={taskToComplete?.status === 'done' ? 'Reopen Task' : 'Resolve Task'}
                tooltipText="Toggles task completion status and archives or restores the record."
            />

            {/* Standardized Single Task Delete Modal */}
            <ConfirmDialog
                isOpen={Boolean(taskToDelete)}
                onClose={() => setTaskToDelete(null)}
                onConfirm={() => {
                    if (taskToDelete) handleDelete(taskToDelete);
                }}
                title="Delete Task?"
                description={`Confirming permanent deletion of "${taskToDelete?.title}". This action cannot be undone.`}
                confirmText="Delete Task"
                variant="destructive"
                tooltipText="Permanently removes this task from the workspace."
            />
            {/* Standardized Two-Phase Bulk Action Review Dialog */}
            <BulkActionReviewDialog
                isOpen={bulkReviewState.isOpen}
                onClose={() => setBulkReviewState(prev => ({ ...prev, isOpen: false, failedTasks: undefined }))}
                actionType={bulkReviewState.actionType}
                selectedTaskIds={selectedIds}
                selectedTasks={selectedTasksSnapshot}
                targetValue={bulkReviewState.targetValue}
                targetLabel={bulkReviewState.targetLabel}
                isExecuting={isBulkProcessing}
                failedTasks={bulkReviewState.failedTasks}
                onConfirm={handleBulkConfirm}
                onRetryFailed={handleRetryFailedBulkTasks}
            />

            {/* TOCTOU Version Conflict Dialog (Rule 18, Rule 51 & Theme §8) */}
            <VersionConflictDialog
                open={!!versionConflict}
                onOpenChange={(open) => !open && setVersionConflict(null)}
                expectedVersion={versionConflict?.expectedVersion}
                actualVersion={versionConflict?.actualVersion}
                onReload={() => {
                    setVersionConflict(null);
                    setCapabilityError(null);
                }}
                resourceName="task"
            />
            </Tabs>
        </PageContainerFluid>
    );
}

function StatCard({ label, value, icon: Icon, color, bg, info }: { label: string, value: string | number, sub?: string, icon: React.ComponentType<{ className?: string }>, color: string, bg: string, info?: string }) {
    return (
        <div className="p-3 sm:p-3.5 rounded-xl border border-border/50 shadow-2xs bg-muted/20 hover:bg-muted/30 transition-all flex items-center gap-3 group">
            <div className={cn("p-2 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", bg, color)}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground truncate">{label}</p>
                    {info && <CardInfoTooltip text={info} />}
                </div>
                <p className="text-xl sm:text-2xl font-bold text-foreground tracking-tight tabular-nums leading-none mt-0.5">{value}</p>
            </div>
        </div>
    );
}