'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { doc, updateDoc, collection, query, orderBy, where } from 'firebase/firestore';
import type { Deal, UserProfile, OnboardingStage, Pipeline, Task, EntityContact, DealFocalContact } from '@/lib/types';
import { getEntityContactsAction } from '@/app/actions/entity-contact-actions';
import { getForecastUrgency } from '../../pipeline/utils/deal-urgency';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ArrowLeft,
    Banknote,
    Calendar,
    Building2,
    UserCircle2,
    Settings2,
    Activity,
    Plus,
    Trash2,
    CheckCircle2,
    Circle,
    Clock,
    Check,
    Search,
    Link as LinkIcon,
    User,
    MessageSquare
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { useTerminology } from '@/hooks/use-terminology';
import { mergeById } from './deal-select-utils';
import { useConfirm } from '@/components/ui/confirm-dialog';
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
import { useEntitySearch } from '@/hooks/use-entity-search';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import dynamic from 'next/dynamic';
import EntityNotesTab from '../../entities/components/EntityNotesTab';
import { PageContainer } from '@/components/ui/page-container';

const ActivityTimeline = dynamic(() => import('../../components/ActivityTimeline'), { ssr: false });

export default function DealDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const dealId = params.id as string;
    const firestore = useFirestore();


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

    // Focal contacts (persons from the deal's own entity)
    const [entityContacts, setEntityContacts] = React.useState<EntityContact[]>([]);
    const [selectedFocalContactIds, setSelectedFocalContactIds] = React.useState<string[]>([]);

    // Custom fields state
    const [customKey, setCustomKey] = React.useState('');
    const [customValue, setCustomValue] = React.useState('');

    // Fetch users for assignments — scoped to the deal's workspace (multi-tenant isolation)
    const usersQuery = useMemoFirebase(() =>
        firestore && deal?.workspaceId
            ? query(collection(firestore, 'users'), where('workspaceIds', 'array-contains', deal.workspaceId))
            : null,
    [firestore, deal?.workspaceId]);
    const { data: users } = useCollection<UserProfile>(usersQuery);

    // Fetch pipelines for the deal's workspace (shared pipelines use workspaceIds array)
    const pipelinesQuery = useMemoFirebase(() =>
        firestore && deal?.workspaceId
            ? query(collection(firestore, 'pipelines'), where('workspaceIds', 'array-contains', deal.workspaceId))
            : null,
    [firestore, deal?.workspaceId]);
    const { data: pipelines } = useCollection<Pipeline>(pipelinesQuery);

    // Fetch stages for the currently-selected pipeline (populates the Stage select)
    const stagesQuery = useMemoFirebase(() =>
        firestore && pipelineId
            ? query(collection(firestore, 'onboardingStages'), where('pipelineId', '==', pipelineId), orderBy('order', 'asc'))
            : null,
    [firestore, pipelineId]);
    const { data: stages } = useCollection<OnboardingStage>(stagesQuery);

    // Directly fetch the deal's CURRENT pipeline/stage by id so the value is
    // always selectable even if it falls outside the workspace list query
    // (e.g. a pipeline un-shared from the workspace, or legacy field drift).
    const currentPipelineRef = useMemoFirebase(() =>
        firestore && deal?.pipelineId ? doc(firestore, 'pipelines', deal.pipelineId) : null,
    [firestore, deal?.pipelineId]);
    const { data: currentPipeline } = useDoc<Pipeline>(currentPipelineRef);

    const currentStageRef = useMemoFirebase(() =>
        firestore && deal?.stageId ? doc(firestore, 'onboardingStages', deal.stageId) : null,
    [firestore, deal?.stageId]);
    const { data: currentStage } = useDoc<OnboardingStage>(currentStageRef);

    // De-duplicated option lists that always include the current value.
    const pipelineOptions = React.useMemo(
        () => mergeById(pipelines, currentPipeline),
        [pipelines, currentPipeline]
    );
    const stageOptions = React.useMemo(
        () => mergeById(stages, currentStage).filter(s => s.pipelineId === pipelineId),
        [stages, currentStage, pipelineId]
    );

    const { user: currentUser } = useUser();
    const { singular } = useTerminology();
    const confirm = useConfirm();

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

    // Server-side entity search for the "add contact" picker — only while the
    // dialog is open. Replaces streaming the full workspace entity set.
    const {
        results: contactSearchResults,
        isLoading: isSearchingContacts,
        hasMore: hasMoreContacts,
        loadMore: loadMoreContacts,
    } = useEntitySearch({ search: contactSearchTerm, enabled: isAddContactOpen, pageSize: 25 });

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
        if (!currentUser) return;
        if (!(await confirm({ title: 'Delete task?', description: 'This task will be permanently deleted.', confirmText: 'Delete', variant: 'destructive' }))) return;
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
        if (!deal) return;
        if (!(await confirm({ title: 'Remove contact?', description: 'This contact will be unlinked from this deal.', confirmText: 'Remove', variant: 'destructive' }))) return;
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

    // Right-panel task list: incomplete tasks first (by soonest due date), completed last.
    const upcomingTasks = React.useMemo(() => {
        if (!dealTasks) return [];
        return [...dealTasks].sort((a, b) => {
            const aDone = a.status === 'done' ? 1 : 0;
            const bDone = b.status === 'done' ? 1 : 0;
            if (aDone !== bDone) return aDone - bDone;
            const at = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const bt = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            return at - bt;
        });
    }, [dealTasks]);

    // Exclude entities already linked to the deal (and the deal's own entity)
    // from the server-search results.
    const filteredEntities = React.useMemo(() => {
        const associatedIds = new Set(deal?.contacts?.map(c => c.entityId) || []);
        if (deal?.entityId) associatedIds.add(deal.entityId);
        return contactSearchResults.filter(e => !associatedIds.has(e.entityId));
    }, [contactSearchResults, deal?.contacts, deal?.entityId]);

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
            setSelectedFocalContactIds((deal.focalContacts ?? []).map(fc => fc.id));
        }
    }, [deal]);

    // Load the entity's contacts so focal persons can be (de)selected.
    React.useEffect(() => {
        if (!deal?.entityId) return;
        let cancelled = false;
        getEntityContactsAction(deal.entityId).then(contacts => {
            if (!cancelled) setEntityContacts(contacts);
        });
        return () => { cancelled = true; };
    }, [deal?.entityId]);

    const toggleFocalContact = (id: string) => {
        setSelectedFocalContactIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

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
            const focalContacts: DealFocalContact[] = selectedFocalContactIds
                .map<DealFocalContact | null>(id => {
                    const c = entityContacts.find(ec => ec.id === id);
                    if (!c) return null;
                    return { id: c.id, name: c.name, email: c.email, phone: c.phone, role: c.typeLabel };
                })
                .filter((c): c is DealFocalContact => c !== null);

            const detailsRes = await updateDealDetailsAction(deal.id, {
                name,
                value: parseFloat(value) || 0,
                description: description || null,
                expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate).toISOString() : null,
                assignedTo,
                focalContacts
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
                                    <Building2 className="h-4 w-4" /> View Linked {singular}
                                </Link>
                                <Separator orientation="vertical" className="h-4 hidden sm:block" />
                                <span className="flex items-center gap-1.5"><UserCircle2 className="h-4 w-4" /> {deal.assignedTo?.name || 'Unassigned'}</span>
                            </div>

                            {/* Key Info — merged from the right-panel card */}
                            <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground/80 flex-wrap pt-1">
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-primary/50" />
                                    <span className="uppercase tracking-wider text-[10px] text-muted-foreground/60">Close:</span>
                                    {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : 'TBD'}
                                    {deal.expectedCloseDate && (() => {
                                        const u = getForecastUrgency(deal.expectedCloseDate);
                                        return <span className={cn("font-bold", u.colorClass)}>({u.label})</span>;
                                    })()}
                                </span>
                                <Separator orientation="vertical" className="h-4 hidden sm:block" />
                                <span className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 text-primary/50" />
                                    <span className="uppercase tracking-wider text-[10px] text-muted-foreground/60">Created:</span>
                                    {new Date(deal.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <div className="space-y-6">
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
                                                            {pipelineOptions.map(p => (
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
                                                            {stageOptions.map(s => (
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
                                                    {expectedCloseDate && (() => {
                                                        const u = getForecastUrgency(new Date(expectedCloseDate).toISOString());
                                                        return <p className={cn("text-[10px] font-bold ml-1", u.colorClass)}>{u.label}</p>;
                                                    })()}
                                                </div>
                                            </div>

                                            {entityContacts.length > 0 && (
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold text-muted-foreground ml-1 uppercase flex items-center gap-1.5"><User className="h-3 w-3" /> Focal Contacts</Label>
                                                    <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto p-1.5 rounded-xl bg-muted/20 border border-primary/10">
                                                        {entityContacts.map(c => {
                                                            const selected = selectedFocalContactIds.includes(c.id);
                                                            return (
                                                                <button
                                                                    key={c.id}
                                                                    type="button"
                                                                    onClick={() => toggleFocalContact(c.id)}
                                                                    className={cn(
                                                                        "flex items-center gap-2 p-2 rounded-lg text-left transition-colors",
                                                                        selected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/60"
                                                                    )}
                                                                >
                                                                    <span className={cn(
                                                                        "flex h-4 w-4 items-center justify-center rounded-md border shrink-0 transition-colors",
                                                                        selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
                                                                    )}>
                                                                        {selected && <Check className="h-3 w-3" />}
                                                                    </span>
                                                                    <UserCircle2 className="h-4 w-4 text-primary/40 shrink-0" />
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-bold truncate leading-tight">{c.name || 'Unnamed'}</p>
                                                                        <p className="text-[9px] font-semibold text-muted-foreground truncate">{[c.typeLabel, c.email].filter(Boolean).join(' • ') || 'No details'}</p>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

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

                                {/* Deal Notes — scoped to this deal; also surface in the entity notes panel */}
                                <Card className="border-border/50 rounded-2xl bg-card shadow-sm">
                                    <CardHeader className="border-b bg-card/20 pb-4">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /> Notes</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4">
                                        <EntityNotesTab entityId={deal.entityId} dealId={deal.id} dealName={deal.name} compact />
                                    </CardContent>
                                </Card>
                        </div>
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                        {/* Upcoming Tasks */}
                        <Card className="border-none shadow-sm rounded-2xl bg-card overflow-hidden">
                            <CardHeader className="border-b bg-card/20 pb-4 px-6 pt-5 flex flex-row items-center justify-between">
                                <CardTitle className="text-[11px] font-semibold text-primary flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Upcoming Tasks</CardTitle>
                                <Button size="sm" onClick={() => setIsCreateTaskOpen(true)} className="rounded-lg font-bold text-[9px] h-7 px-3 shadow-sm">
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                            </CardHeader>
                            <CardContent className="p-4 space-y-2">
                                {isTasksLoading ? (
                                    <div className="space-y-2"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div>
                                ) : upcomingTasks.length > 0 ? (
                                    upcomingTasks.map(t => {
                                        const isDone = t.status === 'done';
                                        const due = getForecastUrgency(t.dueDate);
                                        return (
                                            <div key={t.id} className={cn("group flex items-start gap-2.5 p-3 rounded-xl border bg-muted/10 transition-all hover:bg-muted/20 hover:border-primary/20", isDone && "opacity-50")}>
                                                <button onClick={() => handleToggleTaskStatus(t)} className="mt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0">
                                                    {isDone ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4" />}
                                                </button>
                                                <div className="min-w-0 flex-1 space-y-0.5">
                                                    <p className={cn("text-[11px] font-bold leading-snug", isDone && "line-through text-muted-foreground")}>{t.title}</p>
                                                    <div className="flex items-center gap-1.5 text-[9px] font-semibold text-muted-foreground/70">
                                                        <Clock className="h-3 w-3" />
                                                        <span className={cn(!isDone && due.colorClass)}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No date'}</span>
                                                        {t.assignedToName && <><span className="h-1 w-1 rounded-full bg-muted-foreground/40" /><span className="truncate">{t.assignedToName}</span></>}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDeleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 transition-opacity shrink-0">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center p-6 bg-muted/10 rounded-xl border border-dashed flex flex-col items-center gap-2">
                                        <CheckCircle2 className="h-7 w-7 text-muted-foreground/20" />
                                        <p className="text-[11px] font-semibold text-muted-foreground">No upcoming tasks.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Activity Feed */}
                        <Card className="border-none shadow-sm rounded-2xl bg-card overflow-hidden">
                            <CardHeader className="border-b bg-card/20 pb-4 px-6 pt-5">
                                <CardTitle className="text-[11px] font-semibold text-primary flex items-center gap-2"><Activity className="h-4 w-4" /> Activity Feed</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <ActivityTimeline entityId={deal.entityId} limit={20} />
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
                                    <p className="p-4 text-center text-[10px] text-muted-foreground font-semibold">
                                        {isSearchingContacts ? 'Searching…' : 'No eligible contacts found'}
                                    </p>
                                )}
                                {hasMoreContacts && (
                                    <button
                                        type="button"
                                        onClick={loadMoreContacts}
                                        disabled={isSearchingContacts}
                                        className="w-full p-2.5 text-center text-[10px] font-bold text-primary hover:bg-primary/5 disabled:opacity-50"
                                    >
                                        {isSearchingContacts ? 'Loading…' : 'Load more'}
                                    </button>
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
