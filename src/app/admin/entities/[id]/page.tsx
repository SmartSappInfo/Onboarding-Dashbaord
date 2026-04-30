'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser as useFirebaseUser } from '@/firebase';
import { doc, collection, query, where, orderBy, updateDoc, getDoc } from 'firebase/firestore';
import type { WorkspaceEntity, Entity, FocalPerson, Task, Tag, TagAuditLog } from '@/lib/types';
import { TagSelector } from '@/components/tags/TagSelector';
import { TagBadges } from '@/components/tags/TagBadges';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    ArrowLeft, 
    Calendar, 
    Globe, 
    Mail, 
    MapPin, 
    Phone, 
    Users, 
    PenSquare, 
    Workflow, 
    User, 
    Send,
    ShieldCheck,
    MessageSquarePlus,
    Activity,
    UserCheck,
    Contact,
    CheckCircle2,
    Clock,
    Plus,
    Circle,
    Receipt,
    Camera,
    Loader2,
    ArrowRightLeft,
    RefreshCw,
    Zap,
    Target,
    Info,
    Share2,
    Network,
    Building2,
    X,
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { cn, toTitleCase } from '@/lib/utils';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { completeTaskNonBlocking } from '@/lib/task-actions';
import { useToast } from '@/hooks/use-toast';
import EntityBillingTab from '../components/EntityBillingTab';
import { MediaSelect } from '../components/media-select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import ChangeStatusModal from '../components/ChangeStatusModal';
import TransferPipelineModal from '../components/TransferPipelineModal';
import ConvertLeadModal from '../components/ConvertLeadModal';
import ManageWorkspacesModal from '../components/ManageWorkspacesModal';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { useTerminology } from '@/hooks/use-terminology';
import { resolveEntityContacts } from '@/lib/entity-contact-helpers';
import PipelineAutomationsTab from '../components/PipelineAutomationsTab';
import { getIndustryErrorMessage, getIndustrySuccessMessage } from '@/lib/industry-monitoring';
import { useIndustry } from '@/context/IndustryContext';
import EntityNotesTab from '../components/EntityNotesTab';
import EntityNotesWidget from '../components/EntityNotesWidget';

const ActivityTimeline = dynamic(() => import('../../components/ActivityTimeline'), {
 loading: () => <div className="p-8 space-y-4"><Skeleton className="h-4 w-32"/><Skeleton className="h-20 w-full"/><Skeleton className="h-20 w-full"/></div>,
});

const LogActivityModal = dynamic(() => import('../components/LogActivityModal'), { ssr: false });

const getStatusBadgeVariant = (status: any) => {
    switch (status) {
        case 'active':
        case 'Active': return 'default';
        case 'archived':
        case 'Archived': return 'outline';
        default: return 'secondary';
    }
}

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '?';

export default function EntityDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const entityId = params.id as string;
    const firestore = useFirestore();
    const { user: currentUser } = useFirebaseUser();
    const { activeWorkspaceId } = useWorkspace();
    const { accessibleWorkspaces } = useTenant();
    const { industry } = useIndustry();

    // Workspace name lookup map (from tenant context — already loaded)
    const workspaceNameMap = React.useMemo(
        () => new Map(accessibleWorkspaces.map(w => [w.id, w.name])),
        [accessibleWorkspaces]
    );
    const { 
        singular, 
        plural, 
        updateStatus, 
    } = useTerminology();
    
    const [isLogModalOpen, setIsLogModalOpen] = React.useState(false);
    const [isLogoDialogOpen, setIsLogoDialogOpen] = React.useState(false);
    const [isUpdatingLogo, setIsUpdatingLogo] = React.useState(false);
    const [isManageWorkspacesOpen, setIsManageWorkspacesOpen] = React.useState(false);
    
    const [statusModalOpen, setStatusModalOpen] = React.useState(false);
    const [transferModalOpen, setTransferModalOpen] = React.useState(false);
    const [convertModalOpen, setConvertModalOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('overview');

    // 1. Subscribe to Global Entity (Identity)
    const entityDocRef = useMemoFirebase(() => {
        if (!firestore || !entityId) return null;
        return doc(firestore, 'entities', entityId);
    }, [firestore, entityId]);
    const { data: entityData, isLoading: isLoadingEntity } = useDoc<Entity>(entityDocRef);

    // 2. Subscribe to Workspace Entity (Operational State)
    const workspaceEntityId = `${activeWorkspaceId}_${entityId}`;
    const weDocRef = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId || !entityId) return null;
        return doc(firestore, 'workspace_entities', workspaceEntityId);
    }, [firestore, activeWorkspaceId, entityId]);
    const { data: weData, isLoading: isLoadingWE } = useDoc<WorkspaceEntity>(weDocRef);

    // Tasks Subscription for this entity
    const tasksQuery = useMemoFirebase(() => {
        if (!firestore || !entityId || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'tasks'),
            where('workspaceId', '==', activeWorkspaceId),
            where('entityId', '==', entityId),
            where('status', '!=', 'done'),
            orderBy('status'),
            orderBy('dueDate', 'asc')
        );
    }, [firestore, entityId, activeWorkspaceId]);
    const { data: tasks, isLoading: isLoadingTasks } = useCollection<Task>(tasksQuery);

    // Tags subscription for this workspace
    const tagsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'tags'),
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);
    const { data: allTags } = useCollection<Tag>(tagsQuery);

    // Tag audit log for this entity
    const tagAuditQuery = useMemoFirebase(() => {
        if (!firestore || !entityId) return null;
        return query(
            collection(firestore, 'tag_audit_logs'),
            where('contactId', '==', entityId),
            orderBy('timestamp', 'desc')
        );
    }, [firestore, entityId]);
    const { data: tagAuditLogs } = useCollection<TagAuditLog>(tagAuditQuery);

    // Cross-workspace memberships for this entity (all workspaces)
    const allMembershipsQuery = useMemoFirebase(() => {
        if (!firestore || !entityId) return null;
        return query(
            collection(firestore, 'workspace_entities'),
            where('entityId', '==', entityId),
        );
    }, [firestore, entityId]);
    const { data: allMemberships } = useCollection<WorkspaceEntity>(allMembershipsQuery);
    const activeMembershipsCount = (allMemberships || []).filter(m => m.status === 'active').length;

    // Navigation Entity Resolution
    useSetBreadcrumb(entityData?.name || weData?.displayName);

 if (isLoadingEntity || isLoadingWE) return <div className="p-8 space-y-8"><Skeleton className="h-48 w-full rounded-2xl"/><Skeleton className="h-96 w-full rounded-2xl"/></div>;
 if (!entityData || !weData) {
    const errorMessage = getIndustryErrorMessage('entity_not_found', industry);
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <h2 className="text-xl font-bold">{errorMessage}</h2>
            <Button variant="outline" onClick={() => router.push('/admin/entities')}>Back to List</Button>
        </div>
    );
 }

    const handleTaskComplete = (taskId: string) => {
        if (firestore) {
            completeTaskNonBlocking(firestore, taskId);
            toast({ title: 'Task Completed' });
        }
    };

    const handleLogoUpdate = async (newLogoUrl: string) => {
        if (!firestore || !entityId || isUpdatingLogo) return;
        setIsUpdatingLogo(true);
        try {
            await updateDoc(doc(firestore, 'entities', entityId), {
                logoUrl: newLogoUrl,
                updatedAt: new Date().toISOString()
            });
            
            const successMessage = getIndustrySuccessMessage('update', industry, displayName);
            toast({ title: 'Branding Synchronized', description: successMessage });
            setIsLogoDialogOpen(false);
        } catch (e: any) {
            const errorMessage = getIndustryErrorMessage('entity_update_failed', industry, { entityName: displayName, details: e.message });
            toast({ variant: 'destructive', title: 'Update Failed', description: errorMessage });
        } finally {
            setIsUpdatingLogo(false);
        }
    };

    const DetailItem = ({ icon: Icon, label, value, href, children }: { icon: any, label: string, value?: any, href?: string, children?: any }) => (
 <div className="flex items-start gap-4">
 <div className="p-2 bg-muted rounded-lg shrink-0 mt-0.5 border border-border/50"><Icon className="h-4 w-4 text-muted-foreground" /></div>
 <div className="min-w-0 flex-1">
 <p className="text-[10px] font-semibold text-muted-foreground leading-none mb-1.5">{label}</p>
 {href ? <a href={href} className="text-base font-bold text-foreground hover:text-primary truncate block underline-offset-4 hover:underline">{String(value)}</a> : value && <p className="text-base font-bold text-foreground leading-tight">{String(value)}</p>}
                {children}
            </div>
        </div>
    );

    const isInstitution = entityData.entityType === 'institution';
    // New schema — read directly from root fields and industryData
    const capacity = (entityData.industryData as any)?.capacity ?? 0;
    const logoUrl = entityData.logoUrl;
    
    // Construct location string from hierarchy
    const locationParts = [
      entityData.location?.district?.name,
      entityData.location?.region?.name,
    ].filter(Boolean);
    const hierachyString = locationParts.length > 0 ? locationParts.join(', ') : null;
    const countryFlag = entityData.location?.country?.flag;
    const locationZone = entityData.location?.zone?.name;
    const displayLocation = hierachyString || locationZone || 'Unassigned';

    const website = (entityData as any).website;
    const personData = entityData.personData;
    const displayName = entityData.name || weData.displayName;

    return (
        <div className={cn("h-full overflow-y-auto", weData.status === 'archived' && "grayscale opacity-80")}>
            <div className="max-w-7xl mx-auto space-y-6">

            <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl shadow-lg">
                <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    
                    {/* Identity & Logo */}
                    <div className="flex items-center gap-6">
                        <div 
                            className="relative h-20 w-20 md:h-24 md:w-24 rounded-2xl bg-card p-1 shadow-sm ring-1 ring-border/50 overflow-hidden shrink-0 group cursor-pointer"
                            onClick={() => setIsLogoDialogOpen(true)}
                        >
                            {isInstitution && logoUrl ? (
                                <Image src={logoUrl} alt={displayName} fill className="object-contain p-2" />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center bg-primary/5 text-primary text-2xl font-semibold">{getInitials(displayName)}</div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><Camera className="h-6 w-6" /></div>
                        </div>

                        <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{displayName}</h2>
                                <button 
                                    onClick={() => setStatusModalOpen(true)}
                                    className="group relative transition-all"
                                >
                                    <Badge variant={getStatusBadgeVariant(weData.status)} className="h-6 px-3 text-[10px] font-semibold cursor-pointer group-hover:ring-2 ring-primary/20 transition-all uppercase">
                                        {weData.status} <RefreshCw className="h-3 w-3 inline ml-1.5 opacity-0 group-[&:hover]:opacity-100 transition-opacity" />
                                    </Badge>
                                </button>
                                {weData.lifecycleStatus && (
                                    <Badge 
                                        className={cn(
                                            "h-6 px-3 text-[10px] font-semibold uppercase border-none text-white",
                                            weData.lifecycleStatus === 'Active' ? "bg-emerald-500" : 
                                            weData.lifecycleStatus === 'Onboarding' ? "bg-blue-500" : "bg-muted/100"
                                        )}
                                    >
                                        {weData.lifecycleStatus}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground font-medium">
                                <span>
                                  {countryFlag ? <span className="mr-1.5">{countryFlag}</span> : <MapPin className="h-3.5 w-3.5 inline mr-1" />}
                                  {displayLocation}
                                </span>
                                <Separator orientation="vertical" className="h-4 mx-1" />
                                <span className="uppercase text-[10px] tracking-wider font-bold">{entityData.entityType}</span>
                            </div>
                            <div className="pt-2 flex flex-wrap items-center gap-2">
                                <TagSelector contactId={workspaceEntityId} contactType="workspace_entity" currentTagIds={weData.workspaceTags || []} />
                            </div>
                        </div>
                    </div>

                    {/* Top Actions */}
                    <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                        <Button variant="outline" className="flex-1 md:flex-none rounded-xl font-bold h-11 bg-card/50 backdrop-blur-sm shadow-sm" onClick={() => setIsLogModalOpen(true)}>
                            <MessageSquarePlus className="mr-2 h-4 w-4 text-primary" /> Log
                        </Button>
                        <Button className="flex-1 md:flex-none rounded-xl font-bold shadow-md h-11" onClick={() => router.push(`/admin/entities/${entityId}/edit`)}>
                            <PenSquare className="mr-2 h-4 w-4" /> Edit Profile
                        </Button>
                    </div>
                </div>
            </div>

 <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
 <div className="lg:col-span-3">
 <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
 <TabsList className="bg-card/40 border shadow-sm p-1 h-auto md:h-12 rounded-2xl w-full md:w-fit backdrop-blur-sm flex-wrap">
 <TabsTrigger value="overview" className="rounded-xl font-semibold text-[10px] px-8">Insights</TabsTrigger>
 <TabsTrigger value="notes" className="rounded-xl font-semibold text-[10px] px-8">Notes</TabsTrigger>
 <TabsTrigger value="tasks" className="rounded-xl font-semibold text-[10px] px-8 gap-2">
                            Tasks
                            {tasks && tasks.length > 0 && (
                                <Badge className="h-4 w-4 p-0 flex items-center justify-center rounded-full bg-primary text-[8px] border-none">{tasks.length}</Badge>
                            )}
                        </TabsTrigger>
 <TabsTrigger value="pipeline" className="rounded-xl font-semibold text-[10px] px-8 gap-2">
 <Workflow className="h-3 w-3" /> Pipeline & Automations
                        </TabsTrigger>
 <TabsTrigger value="billing" className="rounded-xl font-semibold text-[10px] px-8 gap-2">
 <Receipt className="h-3 w-3" /> Billing & Finance
                        </TabsTrigger>
                        <TabsTrigger value="workspaces" className="rounded-xl font-semibold text-[10px] px-8 gap-2">
                            <Network className="h-3 w-3" /> Workspaces
                            {activeMembershipsCount > 0 && (
                                <Badge className="h-4 w-4 p-0 flex items-center justify-center rounded-full bg-sky-500 text-[8px] border-none text-white">{activeMembershipsCount}</Badge>
                            )}
                        </TabsTrigger>
 <TabsTrigger value="timeline" className="rounded-xl font-semibold text-[10px] px-8">Activity Feed</TabsTrigger>
                    </TabsList>

 <TabsContent value="pipeline" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <PipelineAutomationsTab weData={weData} onTransferPipeline={() => setTransferModalOpen(true)} />
                </TabsContent>

 <TabsContent value="overview" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
 <Card className="border-none shadow-sm rounded-2xl bg-card overflow-hidden">
 <CardHeader className="border-b bg-card/20 pb-5 px-8 pt-8">
 <CardTitle className="text-[10px] font-semibold text-primary flex items-center gap-2"><Contact className="h-4 w-4" /> Contact Directory</CardTitle>
                                </CardHeader>
 <CardContent className="p-0">
 <div className="divide-y divide-border/50">
                                        {(() => {
                                            const contacts = resolveEntityContacts(entityData);
                                            
                                            return contacts.length > 0 ? (
                                                contacts.map((person, idx) => (
 <div key={idx} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group hover:bg-background transition-colors text-left">
 <div className="flex items-center gap-4 text-left">
 <div className="h-12 w-12 rounded-2xl bg-card/50 flex items-center justify-center font-semibold text-primary border border-border/50 shadow-sm group-hover:bg-primary group-hover:text-white transition-colors">{getInitials(person.name)}</div>
 <div className="text-left">
 <p className="font-semibold text-base ">{person.name}</p>
 <div className="flex items-center gap-2 mt-1">
                                                                <Badge variant="outline" className="text-[8px] font-semibold uppercase tracking-tighter h-5">{person.typeLabel || person.typeKey}</Badge>
                                                                {person.isPrimary && <Badge variant="secondary" className="text-[7px] font-semibold uppercase bg-blue-50 text-blue-700 border-blue-200 py-0.5 px-2">Primary</Badge>}
                                                                {person.isSignatory && <Badge className="text-[7px] font-semibold uppercase bg-amber-500 text-white border-none py-0.5 px-2">Signatory</Badge>}
                                                                <ShieldCheck className={cn("h-3.5 w-3.5", person.isSignatory ? "text-amber-500" : "text-muted-foreground/20")} />
                                                            </div>
                                                        </div>
                                                    </div>
 <div className="flex gap-2 w-full sm:w-auto">
 {person.email && <Button variant="outline" size="sm" asChild className="h-9 rounded-xl flex-1 sm:flex-none border-border/50"><a href={`mailto:${person.email}`}><Mail className="h-3.5 w-3.5 mr-2" /> Email</a></Button>}
 {person.phone && <Button variant="outline" size="sm" asChild className="h-9 rounded-xl flex-1 sm:flex-none border-border/50"><a href={`tel:${person.phone}`}><Phone className="h-3.5 w-3.5 mr-2" /> Call</a></Button>}
                                                    </div>
                                                 </div>
                                              ))
                                            ) : (
 <div className="p-12 text-center text-muted-foreground font-medium italic">No entity contacts initialized.</div>
                                            );
                                        })()}
                                    </div>
                                </CardContent>
                             </Card>
                    </TabsContent>

 <TabsContent value="notes" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
     <EntityNotesTab entityId={entityId} />
 </TabsContent>

 <TabsContent value="tasks" className="m-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
 <div className="flex justify-between items-center mb-2 px-2">
 <h3 className="text-xl font-semibold tracking-tight">Pending Actions</h3>
 <Button size="sm" variant="outline" className="rounded-xl font-bold h-9 border-primary/20 hover:bg-primary/5 text-primary gap-2" asChild>
                                <Link href={`/admin/tasks?entityId=${entityId}`}>
 <Plus className="h-4 w-4" /> Create Task
                                </Link>
                            </Button>
                        </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                            {isLoadingTasks ? (
 Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
                            ) : tasks && tasks.length > 0 ? (
                                tasks.map(task => (
 <Card key={task.id} className="border-border/50 rounded-2xl bg-card shadow-sm hover:shadow-md transition-all text-left">
 <CardContent className="p-4 flex items-center gap-4 text-left">
 <button onClick={() => handleTaskComplete(task.id)} className="shrink-0 text-muted-foreground hover:text-emerald-500"><Circle className="h-6 w-6" /></button>
 <div className="flex-1 min-w-0 text-left">
 <p className="text-sm font-semibold tracking-tight truncate leading-tight">{task.title}</p>
 <div className="flex items-center gap-3 mt-1 text-[9px] font-bold tracking-tighter">
 <span className={cn("flex items-center gap-1", isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) ? "text-rose-600" : "text-muted-foreground")}>
 <Clock className="h-2.5 w-2.5" /> Due {isToday(new Date(task.dueDate)) ? 'Today' : format(new Date(task.dueDate), 'MMM d')}
                                                    </span>
                                                    <Badge variant="outline" className="h-4 border-primary/20 text-primary text-[7px] uppercase">{task.category}</Badge>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            ) : (
 <div className="col-span-full py-16 text-center border-2 border-dashed rounded-2xl bg-background/20 opacity-30 flex flex-col items-center gap-2">
 <CheckCircle2 className="h-8 w-8 text-emerald-500" />
 <p className="text-[10px] font-semibold ">No pending actions for this {singular.toLowerCase()}</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

 <TabsContent value="billing" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
                        <EntityBillingTab entity={entityData} workspaceEntity={weData} />
                    </TabsContent>

                    {/* Workspaces Tab */}
                    <TabsContent value="workspaces" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold tracking-tight">Workspace Memberships</h3>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        {displayName} is active in <span className="font-bold text-foreground">{activeMembershipsCount}</span> workspace{activeMembershipsCount !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                <Button
                                    onClick={() => setIsManageWorkspacesOpen(true)}
                                    className="rounded-xl font-bold h-11 px-6 gap-2 shadow-md"
                                >
                                    <Share2 className="h-4 w-4" />
                                    Manage Workspaces
                                </Button>
                            </div>

                            {/* Membership cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {(allMemberships || []).length === 0 ? (
                                    <div className="col-span-full py-16 text-center border-2 border-dashed rounded-2xl bg-background/20 opacity-40 flex flex-col items-center gap-3">
                                        <Network className="h-8 w-8 text-muted-foreground" />
                                        <p className="text-sm font-semibold text-muted-foreground">Not linked to any workspace</p>
                                        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setIsManageWorkspacesOpen(true)}>
                                            <Plus className="h-4 w-4 mr-2" /> Add to a Workspace
                                        </Button>
                                    </div>
                                ) : (
                                    (allMemberships || []).map(m => (
                                        <div
                                            key={m.id}
                                            className={cn(
                                                'rounded-2xl border p-5 flex flex-col gap-3 bg-card shadow-sm transition-all hover:shadow-md',
                                                m.status === 'archived' && 'opacity-50 grayscale'
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={cn(
                                                        'p-2 rounded-xl shrink-0',
                                                        m.status === 'active' ? 'bg-sky-500/10 text-sky-500' : 'bg-muted text-muted-foreground'
                                                    )}>
                                                        <Building2 className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm truncate">{workspaceNameMap.get(m.workspaceId) ?? m.workspaceId}</p>
                                                        <Badge
                                                            variant={m.status === 'active' ? 'default' : 'outline'}
                                                            className="text-[8px] h-4 uppercase font-bold mt-0.5"
                                                        >
                                                            {m.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 text-[11px] text-muted-foreground">
                                                {m.currentStageName && (
                                                    <div className="flex items-center gap-2">
                                                        <Workflow className="h-3 w-3 shrink-0" />
                                                        <span className="font-medium">{m.currentStageName}</span>
                                                    </div>
                                                )}
                                                {m.assignedTo?.name && (
                                                    <div className="flex items-center gap-2">
                                                        <UserCheck className="h-3 w-3 shrink-0" />
                                                        <span className="font-medium">{m.assignedTo.name}</span>
                                                    </div>
                                                )}
                                                {m.addedAt && (
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-3 w-3 shrink-0" />
                                                        <span>Added {(() => { try { const d = (m.addedAt as any)?.toDate?.() ?? new Date(m.addedAt); return isNaN(d.getTime()) ? '—' : format(d, 'MMM d, yyyy'); } catch { return '—'; } })()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </TabsContent>

 <TabsContent value="timeline" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
 <div className="bg-card rounded-2xl p-6 sm:p-10 shadow-sm ring-1 ring-border min-h-[400px] text-left">
 <div className="mb-10 flex items-center gap-3 text-left">
 <div className="flex flex-col text-left">
                                    <Badge variant="outline" className="w-fit bg-background font-semibold text-[10px] uppercase  px-3 py-1 border-primary/20 text-primary mb-1">Audit Trail</Badge>
 <h3 className="text-2xl font-semibold tracking-tight ">Operational Logs</h3>
                                </div>
 <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
                            </div>
                            <ActivityTimeline entityId={entityId} limit={20} />
                        </div>
                    </TabsContent>
                </Tabs>
             </div>
             <div className="lg:col-span-1 space-y-6">
                 {/* 
                  * TODO: Dynamic Right Column 
                  * This column holds critical information and should be dynamic for each entity type and industry.
                  * As new features are added (especially for other entity types like 'person' or 'family'), 
                  * restructure this panel to show the most relevant metrics and widgets depending on the 
                  * current industry and workspace.
                  */}
                 <Card className="border-none shadow-sm rounded-2xl bg-card overflow-hidden">
                     <CardHeader className="border-b bg-card/20 pb-5 px-6 pt-6 text-left">
                         <CardTitle className="text-[10px] font-semibold text-primary flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Account Metrics</CardTitle>
                     </CardHeader>
                     <CardContent className="p-6 space-y-8 text-left">
                         <div className="flex items-center justify-between p-4 rounded-xl bg-primary/10 border border-primary/20 shadow-inner">
                             <div className="space-y-1 text-left">
                                 <p className="text-[10px] font-semibold text-primary/60 ">Nominal Strength</p>
                                 <p className="text-3xl font-semibold tabular-nums tracking-tighter text-primary">{capacity?.toLocaleString() || '0'}</p>
                             </div>
                             <div className="p-3 bg-card rounded-2xl shadow-sm border border-primary/20"><Users className="h-6 w-6 text-primary" /></div>
                         </div>
                         <div className="space-y-6 text-left">
                             <DetailItem icon={UserCheck} label="Account Manager" value={weData.assignedTo?.name || 'Unassigned'} />
                             <DetailItem icon={Workflow} label="Current Stage" value={weData.currentStageName || 'Not Set'} />
                             <DetailItem icon={Calendar} label="Added To Workspace" value={(() => { try { const d = (weData.addedAt as any)?.toDate?.() ?? new Date(weData.addedAt); return isNaN(d.getTime()) ? '—' : format(d, 'MMMM d, yyyy'); } catch { return '—'; } })()} />
                             <Separator />
                             <div className="space-y-3">
                                 <p className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">System Information</p>
                                 <DetailItem icon={Globe} label="Website" value={website || '—'} href={website ? (website.startsWith('http') ? website : `https://${website}`) : undefined} />
                             </div>
                         </div>
                     </CardContent>
                 </Card>

                 <EntityNotesWidget entityId={entityId} onViewAll={() => setActiveTab('notes')} />
             </div>
         </div>
            </div>

            <Dialog open={isLogoDialogOpen} onOpenChange={setIsLogoDialogOpen}>
 <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden p-0 border shadow-2xl bg-card">
 <DialogHeader className="p-8 bg-card/20 border-b shrink-0 text-left">
 <div className="flex items-center gap-4 text-left">
 <div className="p-3 bg-primary text-white rounded-2xl shadow-xl">
 <Camera className="h-6 w-6" />
                            </div>
 <div className="text-left">
 <DialogTitle className="text-xl font-semibold tracking-tight">Identity Branding</DialogTitle>
 <DialogDescription className="text-xs font-bold text-muted-foreground">Select or upload a new primary photo.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
 <div className="p-8 text-left">
                        <MediaSelect 
                            value={logoUrl} 
                            onValueChange={handleLogoUpdate} 
 className="rounded-2xl" 
                        />
                        {isUpdatingLogo && (
 <div className="mt-4 flex items-center justify-center gap-2 text-primary font-semibold text-[10px] animate-pulse">
 <Loader2 className="h-3 w-3 animate-spin" />
                                Synchronizing Branding...
                            </div>
                        )}
                    </div>
 <DialogFooter className="p-4 bg-card/50 border-t flex justify-end">
 <Button variant="ghost" onClick={() => setIsLogoDialogOpen(false)} className="rounded-xl font-bold h-11 px-8">Discard</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <LogActivityModal entity={weData} open={isLogModalOpen} onOpenChange={setIsLogModalOpen} />
            <ChangeStatusModal entity={weData} open={statusModalOpen} onOpenChange={setStatusModalOpen} />
            <TransferPipelineModal entity={weData} open={transferModalOpen} onOpenChange={setTransferModalOpen} />
            {entityData && (
                <ManageWorkspacesModal
                    entityId={entityId}
                    entityType={entityData.entityType}
                    entityName={displayName}
                    open={isManageWorkspacesOpen}
                    onOpenChange={setIsManageWorkspacesOpen}
                />
            )}
        </div>
    );
}
