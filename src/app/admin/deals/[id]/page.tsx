'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { doc, updateDoc, collection, query, orderBy, where } from 'firebase/firestore';
import type { Deal, UserProfile, OnboardingStage, Pipeline, Task, WorkspaceEntity } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    ArrowLeft, 
    Banknote, 
    Calendar, 
    Building2, 
    UserCircle2, 
    Settings2, 
    ShieldCheck, 
    Activity, 
    Target,
    Plus,
    Trash2,
    CheckCircle2,
    Circle,
    Clock,
    AlertTriangle,
    ShieldAlert,
    Check,
    X,
    Search,
    Link as LinkIcon,
    User,
    Phone,
    MapPin,
    FileText,
    GraduationCap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { cn, toTitleCase } from '@/lib/utils';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
    updateDealDetailsAction, 
    updateDealStageAction, 
    updateDealStatusAction,
    addDealContactAction,
    removeDealContactAction
} from '@/app/actions/deal-actions';
import { createTaskAction, updateTaskAction, deleteTaskAction } from '@/lib/task-server-actions';
import { useTenant } from '@/context/TenantContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import dynamic from 'next/dynamic';
import { PageContainer } from '@/components/ui/page-container';

const ActivityTimeline = dynamic(() => import('../../components/ActivityTimeline'), { ssr: false });

const PRIORITY_CONFIG: Record<string, { label: string, color: string, icon: any }> = {
    urgent: { label: 'Urgent', color: 'text-rose-600 bg-rose-500/10 border-rose-200/20', icon: ShieldAlert },
    high: { label: 'High', color: 'text-orange-600 bg-orange-500/10 border-orange-200/20', icon: AlertTriangle },
    medium: { label: 'Medium', color: 'text-blue-600 bg-blue-500/10 border-blue-200/20', icon: Clock },
    low: { label: 'Low', color: 'text-slate-500 bg-muted border-slate-200/20', icon: Circle }
};

const CATEGORY_MAP: Record<string, { label: string, icon: any, color: string }> = {
    call: { label: 'Phone Call', icon: Phone, color: 'text-orange-500 bg-orange-500/10' },
    visit: { label: 'Site Visit', icon: MapPin, color: 'text-blue-500 bg-blue-500/10' },
    document: { label: 'Documentation', icon: FileText, color: 'text-emerald-500 bg-emerald-500/10' },
    training: { label: 'Training', icon: GraduationCap, color: 'text-purple-500 bg-purple-500/10' },
    follow_up: { label: 'Follow Up', icon: Clock, color: 'text-indigo-500 bg-indigo-500/10' },
    general: { label: 'General Task', icon: CheckCircle2, color: 'text-slate-500 bg-muted/10' }
};

export default function DealDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const dealId = params.id as string;
    const firestore = useFirestore();

    const [activeTab, setActiveTab] = React.useState('overview');

    const dealDocRef = useMemoFirebase(() => {
        if (!firestore || !dealId) return null;
        return doc(firestore, 'deals', dealId);
    }, [firestore, dealId]);
    const { data: deal, isLoading } = useDoc<Deal>(dealDocRef);

    useSetBreadcrumb(deal?.name);

    // Form inputs state
    const [name, setName] = React.useState('');
    const [value, setValue] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [pipelineId, setPipelineId] = React.useState('');
    const [stageId, setStageId] = React.useState('');
    const [status, setStatus] = React.useState<'open' | 'won' | 'lost'>('open');
    const [assignedToUserId, setAssignedToUserId] = React.useState('');
    const [expectedCloseDate, setExpectedCloseDate] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);

    // Custom fields state
    const [customKey, setCustomKey] = React.useState('');
    const [customValue, setCustomValue] = React.useState('');

    // Fetch users for assignments
    const usersQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'users'), orderBy('name', 'asc')) : null, 
    [firestore]);
    const { data: users } = useCollection<UserProfile>(usersQuery);

    // Fetch pipelines
    const pipelinesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'pipelines'), orderBy('name', 'asc')) : null, 
    [firestore]);
    const { data: pipelines } = useCollection<Pipeline>(pipelinesQuery);

    // Fetch stages
    const stagesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'onboardingStages'), orderBy('order', 'asc')) : null, 
    [firestore]);
    const { data: stages } = useCollection<OnboardingStage>(stagesQuery);

    const { user: currentUser } = useUser();
    const { activeWorkspaceId } = useTenant();

    // Task list filter states
    const [taskSearchTerm, setTaskSearchTerm] = React.useState('');
    const [taskStatusFilter, setTaskStatusFilter] = React.useState<string>('all');
    const [taskPriorityFilter, setTaskPriorityFilter] = React.useState<string>('all');

    // Task Creation State
    const [isCreateTaskOpen, setIsCreateTaskOpen] = React.useState(false);
    const [taskTitle, setTaskTitle] = React.useState('');
    const [taskDesc, setTaskDesc] = React.useState('');
    const [taskPriority, setTaskPriority] = React.useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
    const [taskCategory, setTaskCategory] = React.useState<'call' | 'visit' | 'document' | 'training' | 'follow_up' | 'general'>('general');
    const [taskAssignee, setTaskAssignee] = React.useState('');
    const [taskDueDate, setTaskDueDate] = React.useState('');
    const [isTaskCreating, setIsTaskCreating] = React.useState(false);

    // Contact Association State
    const [isAddContactOpen, setIsAddContactOpen] = React.useState(false);
    const [contactSearchTerm, setContactSearchTerm] = React.useState('');
    const [selectedContactId, setSelectedContactId] = React.useState('');
    const [contactRole, setContactRole] = React.useState('Decision Maker');
    const [isContactAssociating, setIsContactAssociating] = React.useState(false);

    // Fetch workspace entities for secondary contacts
    const entitiesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'workspace_entities'),
            where('workspaceId', '==', activeWorkspaceId)
        );
    }, [firestore, activeWorkspaceId]);
    const { data: workspaceEntities } = useCollection<WorkspaceEntity>(entitiesQuery);

    // Fetch Tasks for this Deal
    const dealTasksQuery = useMemoFirebase(() => {
        if (!firestore || !dealId || !deal?.workspaceId) return null;
        return query(
            collection(firestore, 'tasks'),
            where('workspaceId', '==', deal.workspaceId),
            where('relatedEntityType', '==', 'Deal'),
            where('relatedEntityId', '==', dealId)
        );
    }, [firestore, dealId, deal?.workspaceId]);
    const { data: dealTasks, isLoading: isTasksLoading } = useCollection<Task>(dealTasksQuery);

    // Task logic handlers
    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !deal || !taskTitle || !taskDueDate) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Title and Due Date are required.' });
            return;
        }

        setIsTaskCreating(true);
        try {
            const taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
                title: taskTitle,
                description: taskDesc,
                priority: taskPriority,
                status: 'todo',
                category: taskCategory,
                dueDate: new Date(taskDueDate).toISOString(),
                assignedTo: taskAssignee || currentUser.uid,
                assignedToName: users?.find(u => u.id === (taskAssignee || currentUser.uid))?.name || 'Unknown User',
                workspaceId: deal.workspaceId,
                organizationId: deal.organizationId,
                relatedEntityType: 'Deal' as const,
                relatedEntityId: deal.id,
                entityId: deal.entityId,
                reminderSent: false,
                reminders: []
            };

            const res = await createTaskAction(taskData, currentUser.uid);
            if (res.success) {
                toast({ title: 'Task Initialized', description: 'New operational task has been registered.' });
                setTaskTitle('');
                setTaskDesc('');
                setTaskPriority('medium');
                setTaskCategory('general');
                setTaskAssignee('');
                setTaskDueDate('');
                setIsCreateTaskOpen(false);
            } else {
                throw new Error(res.error);
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Task Creation Failed', description: err.message });
        } finally {
            setIsTaskCreating(false);
        }
    };

    const handleToggleTaskStatus = async (task: Task) => {
        if (!currentUser || !deal) return;
        const newStatus = task.status === 'done' ? 'todo' : 'done';
        try {
            const res = await updateTaskAction(task.id, { 
                ...task, 
                status: newStatus,
                workspaceId: deal.workspaceId 
            }, currentUser.uid);
            if (res.success) {
                toast({ title: newStatus === 'done' ? 'Task completed' : 'Task reopened' });
            } else {
                throw new Error(res.error);
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!currentUser || !confirm('Are you sure you want to delete this task?')) return;
        try {
            const res = await deleteTaskAction(taskId, currentUser.uid);
            if (res.success) {
                toast({ title: 'Task deleted successfully' });
            } else {
                throw new Error(res.error);
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: err.message });
        }
    };

    // Contact logic handlers
    const handleAddContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deal || !selectedContactId || !contactRole) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select a contact and role.' });
            return;
        }

        setIsContactAssociating(true);
        try {
            const res = await addDealContactAction(deal.id, selectedContactId, contactRole);
            if (res.success) {
                toast({ title: 'Contact Associated', description: 'Secondary contact linked to deal.' });
                setSelectedContactId('');
                setContactRole('Decision Maker');
                setContactSearchTerm('');
                setIsAddContactOpen(false);
            } else {
                throw new Error(res.error);
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Association Failed', description: err.message });
        } finally {
            setIsContactAssociating(false);
        }
    };

    const handleRemoveContact = async (contactEntityId: string) => {
        if (!deal || !confirm('Are you sure you want to remove this contact from this deal?')) return;
        try {
            const res = await removeDealContactAction(deal.id, contactEntityId);
            if (res.success) {
                toast({ title: 'Contact Removed' });
            } else {
                throw new Error(res.error);
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Removal Failed', description: err.message });
        }
    };

    const filteredTasks = React.useMemo(() => {
        if (!dealTasks) return [];
        return dealTasks.filter(t => {
            const matchesSearch = taskSearchTerm ? 
                t.title.toLowerCase().includes(taskSearchTerm.toLowerCase()) || 
                t.description?.toLowerCase().includes(taskSearchTerm.toLowerCase())
                : true;
            const matchesStatus = taskStatusFilter === 'all' ? true : t.status === taskStatusFilter;
            const matchesPriority = taskPriorityFilter === 'all' ? true : t.priority === taskPriorityFilter;
            return matchesSearch && matchesStatus && matchesPriority;
        }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [dealTasks, taskSearchTerm, taskStatusFilter, taskPriorityFilter]);

    const filteredEntities = React.useMemo(() => {
        if (!workspaceEntities) return [];
        const associatedIds = deal?.contacts?.map(c => c.entityId) || [];
        associatedIds.push(deal?.entityId || '');

        return workspaceEntities.filter(e => {
            if (associatedIds.includes(e.entityId)) return false;
            const search = contactSearchTerm.toLowerCase();
            return (
                e.displayName?.toLowerCase().includes(search) ||
                e.entityName?.toLowerCase().includes(search) ||
                e.primaryEmail?.toLowerCase().includes(search)
            );
        });
    }, [workspaceEntities, contactSearchTerm, deal?.contacts, deal?.entityId]);

    React.useEffect(() => {
        if (deal) {
            setName(deal.name || '');
            setValue(deal.value?.toString() || '0');
            setDescription(deal.description || '');
            setPipelineId(deal.pipelineId || '');
            setStageId(deal.stageId || '');
            setStatus(deal.status || 'open');
            setAssignedToUserId(deal.assignedTo?.userId || 'unassigned');
            setExpectedCloseDate(deal.expectedCloseDate ? deal.expectedCloseDate.split('T')[0] : '');
        }
    }, [deal]);

    const handleUpdateDeal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deal || !name || !pipelineId) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Name and Pipeline are required.' });
            return;
        }

        setIsSaving(true);
        try {
            // Find assignee details
            let assignedTo: any = null;
            if (assignedToUserId && assignedToUserId !== 'unassigned') {
                const userObj = users?.find(u => u.id === assignedToUserId);
                if (userObj) {
                    assignedTo = {
                        userId: userObj.id,
                        name: userObj.name,
                        email: userObj.email
                    };
                }
            }

            // 1. Update Core Details via updateDealDetailsAction
            const detailsRes = await updateDealDetailsAction(deal.id, {
                name,
                value: parseFloat(value) || 0,
                description: description || null,
                expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate).toISOString() : null,
                assignedTo
            });

            if (detailsRes.error) throw new Error(detailsRes.error);

            // 2. Update Stage if changed
            if (stageId && stageId !== deal.stageId) {
                const stageRes = await updateDealStageAction(deal.id, stageId);
                if (stageRes.error) throw new Error(stageRes.error);
            }

            // 3. Update Status if changed
            if (status !== deal.status) {
                const statusRes = await updateDealStatusAction(deal.id, status);
                if (statusRes.error) throw new Error(statusRes.error);
            }

            toast({ title: 'Deal Updated', description: 'Deal parameters successfully synchronized.' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddCustomField = async () => {
        if (!firestore || !deal || !customKey || !customValue) return;
        try {
            const updatedFields = { ...(deal.customFields || {}), [customKey]: customValue };
            await updateDoc(doc(firestore, 'deals', deal.id), { customFields: updatedFields, updatedAt: new Date().toISOString() });
            setCustomKey('');
            setCustomValue('');
            toast({ title: 'Custom Field Added' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    const handleRemoveCustomField = async (key: string) => {
        if (!firestore || !deal) return;
        try {
            const updatedFields = { ...(deal.customFields || {}) };
            delete updatedFields[key];
            await updateDoc(doc(firestore, 'deals', deal.id), { customFields: updatedFields, updatedAt: new Date().toISOString() });
            toast({ title: 'Custom Field Removed' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'won': return '#10b981';
            case 'lost': return '#ef4444';
            default: return '#3b82f6';
        }
    };

    if (isLoading) return <div className="p-8 space-y-8"><Skeleton className="h-48 w-full rounded-2xl"/><Skeleton className="h-96 w-full rounded-2xl"/></div>;
    if (!deal) return <div className="p-20 text-center"><h2 className="text-xl font-bold">Deal not found</h2></div>;

    const statusColor = getStatusColor(deal.status);

    return (
        <PageContainer>
            <div className="space-y-6 w-full pb-20">
                <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>

                <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl shadow-lg">
                    <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <h2 className="text-3xl font-bold tracking-tight">{deal.name}</h2>
                                <Badge className="h-6 px-3 text-[10px] font-semibold uppercase text-white shadow-sm" style={{ backgroundColor: statusColor }}>
                                    {deal.status}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm font-semibold text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1.5"><Banknote className="h-4 w-4 text-primary" /> ${(deal.value || 0).toLocaleString()}</span>
                                <Separator orientation="vertical" className="h-4 hidden sm:block" />
                                <Link href={`/admin/entities/${deal.entityId}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                                    <Building2 className="h-4 w-4" /> View Linked Entity
                                </Link>
                                <Separator orientation="vertical" className="h-4 hidden sm:block" />
                                <span className="flex items-center gap-1.5"><UserCircle2 className="h-4 w-4" /> {deal.assignedTo?.name || 'Unassigned'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                            <TabsList className="bg-card/40 border shadow-sm p-1 rounded-2xl">
                                <TabsTrigger value="overview" className="rounded-xl font-semibold text-[10px] px-8">Deal Details</TabsTrigger>
                                <TabsTrigger value="tasks" className="rounded-xl font-semibold text-[10px] px-8">Tasks</TabsTrigger>
                                <TabsTrigger value="associated-contacts" className="rounded-xl font-semibold text-[10px] px-8">Contacts</TabsTrigger>
                                <TabsTrigger value="activity" className="rounded-xl font-semibold text-[10px] px-8">Activity Feed</TabsTrigger>
                            </TabsList>

                            <TabsContent value="overview" className="m-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                {/* Deal Settings Form */}
                                <Card className="border-border/50 rounded-2xl bg-card shadow-sm">
                                    <CardHeader className="border-b bg-card/20 pb-4">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> Deal Configuration</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <form onSubmit={handleUpdateDeal} className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold text-muted-foreground ml-1 uppercase">Deal Title</Label>
                                                    <Input required value={name} onChange={e => setName(e.target.value)} className="rounded-xl h-11" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold text-muted-foreground ml-1 uppercase">Value ($)</Label>
                                                    <Input type="number" value={value} onChange={e => setValue(e.target.value)} className="rounded-xl h-11" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold text-muted-foreground ml-1 uppercase">Pipeline</Label>
                                                    <Select value={pipelineId} onValueChange={(val) => { setPipelineId(val); setStageId(''); }}>
                                                        <SelectTrigger className="rounded-xl h-11">
                                                            <SelectValue placeholder="Select pipeline..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            {pipelines?.map(p => (
                                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold text-muted-foreground ml-1 uppercase">Pipeline Stage</Label>
                                                    <Select value={stageId} onValueChange={setStageId} disabled={!pipelineId}>
                                                        <SelectTrigger className="rounded-xl h-11">
                                                            <SelectValue placeholder="Select stage..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            {stages?.filter(s => s.pipelineId === pipelineId).map(s => (
                                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold text-muted-foreground ml-1 uppercase">Deal Status</Label>
                                                    <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                                                        <SelectTrigger className="rounded-xl h-11">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            <SelectItem value="open">Open (Active)</SelectItem>
                                                            <SelectItem value="won">Closed Won</SelectItem>
                                                            <SelectItem value="lost">Closed Lost</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold text-muted-foreground ml-1 uppercase">Assigned User</Label>
                                                    <Select value={assignedToUserId} onValueChange={setAssignedToUserId}>
                                                        <SelectTrigger className="rounded-xl h-11">
                                                            <SelectValue placeholder="Unassigned" />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl max-h-[250px] overflow-y-auto">
                                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                                            {users?.map(u => (
                                                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold text-muted-foreground ml-1 uppercase">Expected Close Date</Label>
                                                    <Input type="date" value={expectedCloseDate} onChange={e => setExpectedCloseDate(e.target.value)} className="rounded-xl h-11" />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold text-muted-foreground ml-1 uppercase">Description</Label>
                                                <textarea 
                                                    value={description} 
                                                    onChange={e => setDescription(e.target.value)} 
                                                    placeholder="Operational notes, status updates, or context..." 
                                                    className="w-full min-h-[100px] rounded-xl p-3 text-sm font-semibold bg-muted/20 border border-primary/10 shadow-inner focus-visible:ring-1 focus-visible:ring-primary/30 outline-none resize-none"
                                                />
                                            </div>

                                            <div className="flex justify-end pt-2">
                                                <Button type="submit" disabled={isSaving} className="rounded-xl font-bold px-8 shadow-md">
                                                    {isSaving ? 'Syncing...' : 'Save Configuration'}
                                                </Button>
                                            </div>
                                        </form>
                                    </CardContent>
                                </Card>

                                <Card className="border-border/50 rounded-2xl bg-card shadow-sm">
                                    <CardHeader className="border-b bg-card/20 pb-4">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> Custom Fields</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        {Object.keys(deal.customFields || {}).length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {Object.entries(deal.customFields || {}).map(([key, value]) => (
                                                    <div key={key} className="p-4 rounded-xl border bg-muted/20 flex flex-col gap-1 relative group">
                                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">{key}</span>
                                                        <span className="font-bold text-sm">{value}</span>
                                                        <button onClick={() => handleRemoveCustomField(key)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 text-xs font-bold transition-opacity">Remove</button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center p-8 bg-muted/20 rounded-xl border-dashed border-2">
                                                <p className="text-xs font-semibold text-muted-foreground">No custom fields defined for this deal.</p>
                                            </div>
                                        )}

                                        <Separator />

                                        <div className="flex items-end gap-4">
                                            <div className="space-y-2 flex-1">
                                                <Label className="text-[10px] font-bold">Field Name</Label>
                                                <Input value={customKey} onChange={e => setCustomKey(e.target.value)} placeholder="e.g. Contract Type" className="rounded-xl" />
                                            </div>
                                            <div className="space-y-2 flex-1">
                                                <Label className="text-[10px] font-bold">Value</Label>
                                                <Input value={customValue} onChange={e => setCustomValue(e.target.value)} placeholder="e.g. Multi-year" className="rounded-xl" />
                                            </div>
                                            <Button onClick={handleAddCustomField} disabled={!customKey || !customValue} className="rounded-xl font-bold shadow-md">Add Field</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="tasks" className="m-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <Card className="border-border/50 rounded-2xl bg-card shadow-sm">
                                    <CardHeader className="border-b bg-card/20 pb-4 flex flex-row items-center justify-between">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-primary" /> Task Checklist
                                        </CardTitle>
                                        <Button size="sm" onClick={() => setIsCreateTaskOpen(true)} className="rounded-xl font-bold text-[10px] px-4 shadow-sm">
                                            <Plus className="h-3.5 w-3.5 mr-1" /> Add Task
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        {/* Filters toolbar */}
                                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/20 p-3 rounded-xl border">
                                            <div className="relative w-full sm:max-w-xs">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-40" />
                                                <Input 
                                                    placeholder="Search tasks..." 
                                                    value={taskSearchTerm}
                                                    onChange={e => setTaskSearchTerm(e.target.value)}
                                                    className="pl-9 h-9 rounded-lg bg-background font-medium text-xs"
                                                />
                                            </div>
                                            <div className="flex gap-3 w-full sm:w-auto animate-in">
                                                <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                                                    <SelectTrigger className="h-9 w-full sm:w-[120px] rounded-lg text-[10px] font-semibold">
                                                        <SelectValue placeholder="Status" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-lg">
                                                        <SelectItem value="all">All Status</SelectItem>
                                                        <SelectItem value="todo">To Do</SelectItem>
                                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                                        <SelectItem value="done">Done</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Select value={taskPriorityFilter} onValueChange={setTaskPriorityFilter}>
                                                    <SelectTrigger className="h-9 w-full sm:w-[120px] rounded-lg text-[10px] font-semibold">
                                                        <SelectValue placeholder="Priority" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-lg">
                                                        <SelectItem value="all">All Priority</SelectItem>
                                                        <SelectItem value="low">Low</SelectItem>
                                                        <SelectItem value="medium">Medium</SelectItem>
                                                        <SelectItem value="high">High</SelectItem>
                                                        <SelectItem value="urgent">Urgent</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {isTasksLoading ? (
                                            <div className="space-y-3">
                                                <Skeleton className="h-16 w-full rounded-xl" />
                                                <Skeleton className="h-16 w-full rounded-xl" />
                                            </div>
                                        ) : filteredTasks.length > 0 ? (
                                            <div className="space-y-3">
                                                {filteredTasks.map((t) => {
                                                    const P = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;
                                                    const C = CATEGORY_MAP[t.category] || CATEGORY_MAP.general;
                                                    const isDone = t.status === 'done';
                                                    const isOverdue = !isDone && t.dueDate && new Date(t.dueDate) < new Date();
                                                    
                                                    return (
                                                        <div 
                                                            key={t.id} 
                                                            className={cn(
                                                                "flex items-start justify-between p-4 rounded-xl border bg-muted/10 transition-all hover:bg-muted/20 hover:border-primary/20",
                                                                isDone && "opacity-60"
                                                            )}
                                                        >
                                                            <div className="flex items-start gap-3 min-w-0">
                                                                <button 
                                                                    onClick={() => handleToggleTaskStatus(t)}
                                                                    className="mt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
                                                                >
                                                                    {isDone ? (
                                                                        <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-50" />
                                                                    ) : (
                                                                        <Circle className="h-5 w-5" />
                                                                    )}
                                                                </button>
                                                                <div className="min-w-0 space-y-1">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <h4 className={cn("text-xs font-bold leading-snug text-foreground", isDone && "line-through text-muted-foreground")}>
                                                                            {t.title}
                                                                        </h4>
                                                                        <Badge variant="outline" className={cn("text-[8px] font-bold h-4 px-1.5 rounded-sm border-none uppercase shadow-xs shrink-0", P.color)}>
                                                                            <P.icon className="h-2.5 w-2.5 mr-1" /> {t.priority}
                                                                        </Badge>
                                                                        <Badge variant="outline" className={cn("text-[8px] font-bold h-4 px-1.5 rounded-sm border-none gap-1 shrink-0", C.color)}>
                                                                            <C.icon className="h-2.5 w-2.5" /> {C.label}
                                                                        </Badge>
                                                                    </div>
                                                                    {t.description && (
                                                                        <p className="text-[10px] text-muted-foreground font-semibold leading-relaxed line-clamp-2">
                                                                            {t.description}
                                                                        </p>
                                                                    )}
                                                                    <div className="flex items-center gap-3 text-[9px] font-semibold text-muted-foreground/60 flex-wrap">
                                                                        <span className="flex items-center gap-1">
                                                                            <User className="h-3.5 w-3.5" /> Assigned to: {t.assignedToName || 'Unassigned'}
                                                                        </span>
                                                                        <span className="h-1 w-1 bg-muted-foreground/45 rounded-full" />
                                                                        <span className={cn("flex items-center gap-1 font-bold", isOverdue && "text-rose-500 animate-pulse")}>
                                                                            <Clock className="h-3.5 w-3.5" /> Due: {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No date'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => handleDeleteTask(t.id)}
                                                                className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded-lg shrink-0 ml-4"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center p-8 bg-muted/10 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2">
                                                <CheckCircle2 className="h-8 w-8 text-muted-foreground/20" />
                                                <p className="text-xs font-semibold text-muted-foreground">No tasks linked to this deal.</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="associated-contacts" className="m-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <Card className="border-border/50 rounded-2xl bg-card shadow-sm">
                                    <CardHeader className="border-b bg-card/20 pb-4 flex flex-row items-center justify-between">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-primary" /> Associated Contacts
                                        </CardTitle>
                                        <Button size="sm" onClick={() => setIsAddContactOpen(true)} className="rounded-xl font-bold text-[10px] px-4 shadow-sm">
                                            <Plus className="h-3.5 w-3.5 mr-1" /> Add Contact
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        {deal.contacts && deal.contacts.length > 0 ? (
                                            <div className="space-y-4">
                                                {deal.contacts.map(c => (
                                                    <div 
                                                        key={c.entityId} 
                                                        className="flex items-center justify-between p-4 rounded-xl border bg-muted/10 hover:bg-muted/20 transition-all hover:border-primary/20"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                                <User className="h-4 w-4 text-primary" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <Link 
                                                                    href={`/admin/entities/${c.entityId}`} 
                                                                    className="text-xs font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                                                                >
                                                                    {c.name} <LinkIcon className="h-3 w-3 opacity-40" />
                                                                </Link>
                                                                <p className="text-[10px] text-muted-foreground font-semibold truncate">{c.email || 'No email'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <Badge variant="outline" className="text-[8px] font-bold h-5 px-2 bg-primary/10 text-primary border-none uppercase rounded-sm">
                                                                {c.role}
                                                            </Badge>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => handleRemoveContact(c.entityId)}
                                                                className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded-lg shrink-0"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center p-8 bg-muted/10 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2">
                                                <Building2 className="h-8 w-8 text-muted-foreground/20" />
                                                <p className="text-xs font-semibold text-muted-foreground">No secondary contacts linked to this deal.</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="activity" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="bg-card rounded-2xl p-6 sm:p-10 shadow-sm ring-1 ring-border min-h-[400px]">
                                    <div className="mb-8 flex items-center gap-3">
                                        <Activity className="h-6 w-6 text-primary" />
                                        <h3 className="text-xl font-bold tracking-tight">Deal Activity</h3>
                                    </div>
                                    <ActivityTimeline entityId={deal.entityId} limit={20} />
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                        <Card className="border-none shadow-sm rounded-2xl bg-card overflow-hidden">
                            <CardHeader className="border-b bg-card/20 pb-5 px-6 pt-6">
                                <CardTitle className="text-[10px] font-semibold text-primary flex items-center gap-2"><Target className="h-4 w-4" /> Key Info</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Expected Close Date</p>
                                    <p className="font-bold flex items-center gap-2"><Calendar className="h-4 w-4 text-primary/40" /> {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : 'TBD'}</p>
                                </div>
                                <Separator />
                                <div className="space-y-1">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Created</p>
                                    <p className="font-bold text-sm">{new Date(deal.createdAt).toLocaleDateString()}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Create Task Dialog */}
            <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl bg-card border">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold">Initialize Task Protocol</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="taskTitle" className="text-[10px] font-bold text-muted-foreground uppercase">Task Title *</Label>
                            <Input id="taskTitle" required value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="e.g. Sign onboarding agreement" className="rounded-xl h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="taskDueDate" className="text-[10px] font-bold text-muted-foreground uppercase">Due Date *</Label>
                            <Input id="taskDueDate" type="date" required value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} className="rounded-xl h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="taskDesc" className="text-[10px] font-bold text-muted-foreground uppercase">Description</Label>
                            <textarea id="taskDesc" value={taskDesc} onChange={e => setTaskDesc(e.target.value)} placeholder="Additional operational notes..." className="w-full min-h-[80px] rounded-xl p-3 text-sm font-semibold bg-muted/20 border border-primary/10 shadow-inner focus-visible:ring-1 focus-visible:ring-primary/30 outline-none resize-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="taskPriority" className="text-[10px] font-bold text-muted-foreground uppercase">Priority</Label>
                                <Select value={taskPriority} onValueChange={(val: any) => setTaskPriority(val)}>
                                    <SelectTrigger id="taskPriority" className="rounded-xl h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="taskCategory" className="text-[10px] font-bold text-muted-foreground uppercase">Category</Label>
                                <Select value={taskCategory} onValueChange={(val: any) => setTaskCategory(val)}>
                                    <SelectTrigger id="taskCategory" className="rounded-xl h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="general">General</SelectItem>
                                        <SelectItem value="call">Call</SelectItem>
                                        <SelectItem value="visit">Visit</SelectItem>
                                        <SelectItem value="document">Document</SelectItem>
                                        <SelectItem value="training">Training</SelectItem>
                                        <SelectItem value="follow_up">Follow Up</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="taskAssignee" className="text-[10px] font-bold text-muted-foreground uppercase">Assignee</Label>
                            <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                                <SelectTrigger id="taskAssignee" className="rounded-xl h-11">
                                    <SelectValue placeholder="Select assignee..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl max-h-[180px] overflow-y-auto">
                                    {users?.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter className="pt-4 gap-2 flex justify-end">
                            <Button type="button" variant="outline" onClick={() => setIsCreateTaskOpen(false)} className="rounded-xl">Cancel</Button>
                            <Button type="submit" disabled={isTaskCreating} className="rounded-xl font-bold">{isTaskCreating ? 'Creating...' : 'Create Task'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Link Contact Dialog */}
            <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl bg-card border">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold">Link Secondary Contact</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddContact} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Search contacts</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                                <Input placeholder="Type to filter contacts..." value={contactSearchTerm} onChange={e => setContactSearchTerm(e.target.value)} className="pl-9 h-11 rounded-xl bg-muted/20" />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Select Contact *</Label>
                            <div className="border border-border/50 rounded-xl overflow-hidden max-h-[160px] overflow-y-auto divide-y divide-border/30 bg-muted/5">
                                {filteredEntities.length > 0 ? (
                                    filteredEntities.map(e => (
                                        <div 
                                            key={e.entityId} 
                                            onClick={() => setSelectedContactId(e.entityId)}
                                            className={cn(
                                                "p-3 flex items-center justify-between cursor-pointer transition-colors text-xs font-semibold hover:bg-primary/5",
                                                selectedContactId === e.entityId && "bg-primary/10 hover:bg-primary/10"
                                            )}
                                        >
                                            <div className="min-w-0">
                                                <p className="font-bold truncate text-foreground">{e.displayName}</p>
                                                <p className="text-[10px] text-muted-foreground truncate font-normal">{e.primaryEmail || 'No email'}</p>
                                            </div>
                                            {selectedContactId === e.entityId && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                                        </div>
                                    ))
                                ) : (
                                    <p className="p-4 text-center text-[10px] text-muted-foreground font-semibold">No eligible contacts found</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contactRole" className="text-[10px] font-bold text-muted-foreground uppercase">Role *</Label>
                            <Select value={contactRole} onValueChange={setContactRole}>
                                <SelectTrigger id="contactRole" className="rounded-xl h-11">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="Decision Maker">Decision Maker</SelectItem>
                                    <SelectItem value="Billing">Billing</SelectItem>
                                    <SelectItem value="Evaluator">Evaluator</SelectItem>
                                    <SelectItem value="Parent">Parent</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter className="pt-4 gap-2 flex justify-end">
                            <Button type="button" variant="outline" onClick={() => setIsAddContactOpen(false)} className="rounded-xl">Cancel</Button>
                            <Button type="submit" disabled={isContactAssociating || !selectedContactId} className="rounded-xl font-bold">{isContactAssociating ? 'Linking...' : 'Link Contact'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </PageContainer>
    );
}
