'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser as useFirebaseUser } from '@/firebase';
import { doc, collection, query, where, orderBy, updateDoc, getDoc } from 'firebase/firestore';
import type { WorkspaceEntity, Entity, Task, Tag, TagAuditLog, OnlinePresence } from '@/lib/types';
import { UNASSIGNED_ZONE } from '@/lib/zone-constants';
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
    Video,
    RefreshCw,
    Zap,
    Sparkles,
    Target,
    Info,
    Share2,
    Network,
    Building2,
    X,
    ExternalLink,
    Pencil,
    Save,
    Hash,
    PhoneCall,
    Download,
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
import { serializeEntityToImportRow } from '@/lib/import-export/export-service';
import EntityBillingTab from '../components/EntityBillingTab';
import EntityDealsTab from '../components/EntityDealsTab';
import EntityMeetingsTab from '../components/EntityMeetingsTab';
import EntityLeadIntelTab from '../components/EntityLeadIntelTab';
import { MediaSelect } from '../components/media-select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import ConvertLeadModal from '../components/ConvertLeadModal';
import ManageWorkspacesModal from '../components/ManageWorkspacesModal';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { useTerminology } from '@/hooks/use-terminology';
import { useWorkspaceVisibility } from '@/hooks/use-workspace-visibility';
import { resolveEntityContacts } from '@/lib/entity-contact-helpers';
import { getIndustryErrorMessage, getIndustrySuccessMessage } from '@/lib/industry-monitoring';
import { useIndustry } from '@/context/IndustryContext';
import EntityNotesTab from '../components/EntityNotesTab';
import LinkedQuickNotesPanel from '@/app/admin/quick-notes/components/LinkedQuickNotesPanel';
import EntityNotesWidget from '../components/EntityNotesWidget';
import EntityContactDirectory from '../components/EntityContactDirectory';
import EntityCustomFieldGroups from './components/EntityCustomFieldGroups';
import EntityAutomationsTab from '../components/EntityAutomationsTab';
import { PageContainerFluid } from '@/components/ui/page-container';

const ActivityTimeline = dynamic(() => import('../../components/ActivityTimeline'), {
 loading: () => <div className="p-8 space-y-4"><Skeleton className="h-4 w-32"/><Skeleton className="h-20 w-full"/><Skeleton className="h-20 w-full"/></div>,
});

const LogActivityModal = dynamic(() => import('../components/LogActivityModal'), { ssr: false });

const AddToCampaignDialog = dynamic(
  () => import('../components/AddToCampaignDialog').then(m => m.AddToCampaignDialog),
  { ssr: false, loading: () => <Skeleton className="h-10 w-full rounded-xl" /> }
);

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
    const { canViewEntity } = useWorkspaceVisibility();

    // Workspace name lookup map (from tenant context — already loaded)
    const workspaceNameMap = React.useMemo(
        () => new Map(accessibleWorkspaces.map(w => [w.id, w.name])),
        [accessibleWorkspaces]
    );
    const { singular } = useTerminology();
    
    const [isLogModalOpen, setIsLogModalOpen] = React.useState(false);
    const [isLogoDialogOpen, setIsLogoDialogOpen] = React.useState(false);
    const [isUpdatingLogo, setIsUpdatingLogo] = React.useState(false);
    const [isManageWorkspacesOpen, setIsManageWorkspacesOpen] = React.useState(false);
    const [isCampaignDialogOpen, setIsCampaignDialogOpen] = React.useState(false);

    const [convertModalOpen, setConvertModalOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('overview');

    // Inline Online Presence editing
    const [isEditingPresence, setIsEditingPresence] = React.useState(false);
    const [presenceForm, setPresenceForm] = React.useState<OnlinePresence>({});
    const [isSavingPresence, setIsSavingPresence] = React.useState(false);

    // 1. Subscribe to Global Entity (Identity)
    const entityDocRef = useMemoFirebase(() => {
        if (!firestore || !entityId) return null;
        return doc(firestore, 'entities', entityId);
    }, [firestore, entityId]);
    const { data: entityData, isLoading: isLoadingEntity } = useDoc<Entity>(entityDocRef);

    React.useEffect(() => {
        if (entityData?.onlinePresence) {
            setPresenceForm(entityData.onlinePresence);
        } else if (entityData) {
            // Migrate legacy website field
            setPresenceForm({ website: (entityData as any).website || '' });
        }
    }, [entityData]);

    const handleSavePresence = async () => {
        if (!firestore || !entityId || isSavingPresence) return;
        setIsSavingPresence(true);
        try {
            // Clean empty strings
            const cleaned: Record<string, string> = {};
            for (const [k, v] of Object.entries(presenceForm)) {
                if (v && typeof v === 'string' && v.trim()) cleaned[k] = v.trim();
            }
            await updateDoc(doc(firestore, 'entities', entityId), {
                onlinePresence: cleaned,
                updatedAt: new Date().toISOString(),
            });
            toast({ title: 'Online Presence Updated' });
            setIsEditingPresence(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
        } finally {
            setIsSavingPresence(false);
        }
    };

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
 if (!entityData || !weData || !canViewEntity(weData)) {
    const errorMessage = !entityData || !weData 
        ? getIndustryErrorMessage('entity_not_found', industry)
        : 'You do not have permission to view this entity.';
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

    const handleExportNTT = () => {
        if (!entityData) return;
        
        try {
            const rowData = serializeEntityToImportRow(entityData, weData || undefined);
            
            const jsonString = JSON.stringify(rowData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const formattedName = (displayName || 'entity').replace(/\s+/g, '_');
            link.setAttribute('download', `${formattedName}_export_${new Date().toISOString().slice(0, 10)}.ntt`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            toast({ title: 'Export Complete', description: `${displayName} has been exported to .ntt format.` });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            toast({ variant: 'destructive', title: 'Export Failed', description: message });
        }
    };

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
    const displayLocation = hierachyString || locationZone || UNASSIGNED_ZONE.name;

    const personData = entityData.personData;
    const displayName = entityData.name || weData.displayName;

    return (
        <PageContainerFluid className={cn(weData.status === 'archived' && "grayscale opacity-80")}>
            <div className="space-y-6 w-full">

            <div className="relative overflow-visible rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl shadow-lg">
                <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    
                    {/* Identity & Logo */}
                    <div className="flex items-center gap-6">
                        <div 
                            className="relative h-20 w-20 md:h-24 md:w-24 rounded-2xl bg-card p-1 shadow-sm ring-1 ring-border/50 overflow-hidden shrink-0 group cursor-pointer"
                            onClick={() => setIsLogoDialogOpen(true)}
                        >
                            {isInstitution && logoUrl ? (
                                <Image src={logoUrl} alt={displayName} fill sizes="(min-width: 768px) 6rem, 5rem" className="object-contain p-2" />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center bg-primary/5 text-primary text-2xl font-semibold">{getInitials(displayName)}</div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><Camera className="h-6 w-6" /></div>
                        </div>

                        <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-3xl font-bold tracking-tight">{displayName}</h2>
                                <Badge variant={getStatusBadgeVariant(weData.status)} className="h-6 px-3 text-[10px] font-semibold uppercase">
                                    {weData.status}
                                </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground font-medium">
                                <span>
                                  {countryFlag ? <span className="mr-1.5">{countryFlag}</span> : <MapPin className="h-3.5 w-3.5 inline mr-1" />}
                                  {displayLocation}
                                </span>
                            </div>
                            <div className="pt-2 flex flex-wrap items-center gap-2">
                                <TagSelector contactId={workspaceEntityId} contactType="workspace_entity" currentTagIds={weData.workspaceTags || []} />
                            </div>
                            {/* Summary Metrics Row */}
                            <div className="pt-3 flex flex-wrap items-center gap-3">
                                {capacity > 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 border border-primary/15 rounded-xl">
                                        <Users className="h-3.5 w-3.5 text-primary" />
                                        <span className="text-xs font-bold text-primary tabular-nums">{capacity.toLocaleString()}</span>
                                        <span className="text-[10px] font-semibold text-primary/60">Capacity</span>
                                    </div>
                                )}
                                {weData.leadScore !== undefined && (
                                    <div className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 border rounded-xl",
                                        weData.leadScore >= 80 
                                            ? "bg-rose-500/5 border-rose-500/20 text-rose-500" 
                                            : weData.leadScore >= 15 
                                                ? "bg-amber-500/5 border-amber-500/20 text-amber-500" 
                                                : "bg-slate-500/5 border-slate-500/20 text-slate-500"
                                    )}>
                                        <span className="text-sm">
                                            {weData.leadScore >= 80 ? '🔥' : weData.leadScore >= 15 ? '⚡' : '❄️'}
                                        </span>
                                        <span className="text-xs font-black tabular-nums">{weData.leadScore}</span>
                                        <span className="text-[10px] font-bold uppercase opacity-75">Lead Score</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Top Actions */}
                    <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                        <Button variant="outline" className="flex-1 md:flex-none rounded-xl font-bold h-11 bg-card/50 backdrop-blur-sm shadow-sm" onClick={() => setIsLogModalOpen(true)}>
                            <MessageSquarePlus className="mr-2 h-4 w-4 text-primary" /> Log
                        </Button>
                        <Button variant="outline" className="flex-1 md:flex-none rounded-xl font-bold h-11 bg-card/50 backdrop-blur-sm shadow-sm gap-2" onClick={() => setIsCampaignDialogOpen(true)}>
                            <PhoneCall className="h-4 w-4 text-indigo-500" /> Call Campaign
                        </Button>
                        <Button variant="outline" className="flex-1 md:flex-none rounded-xl font-bold h-11 bg-card/50 backdrop-blur-sm shadow-sm gap-2" onClick={handleExportNTT}>
                            <Download className="h-4 w-4 text-primary" /> Export (.ntt)
                        </Button>
                        <Button className="flex-1 md:flex-none rounded-xl font-bold shadow-md h-11" onClick={() => router.push(`/admin/entities/${entityId}/edit`)}>
                            <PenSquare className="mr-2 h-4 w-4" /> Edit Profile
                        </Button>
                    </div>
                </div>
            </div>

 <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
 <div className="lg:col-span-3">
 <Card className="rounded-2xl border-border bg-card overflow-visible">
 <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
 <TabsList className="w-full justify-start bg-muted/30 rounded-none border-b border-border p-0 h-12 overflow-x-auto hide-scrollbar flex-nowrap">
 <TabsTrigger value="overview" className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider shrink-0">Insights</TabsTrigger>
 <TabsTrigger value="deals" className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider shrink-0">Deals</TabsTrigger>
 <TabsTrigger value="meetings" className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider gap-2 shrink-0">
  <Video className="h-3 w-3" /> Meetings
 </TabsTrigger>
 <TabsTrigger value="tasks" className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider gap-2 shrink-0">
                            Tasks
                            {tasks && tasks.length > 0 && (
                                <Badge className="h-4 w-4 p-0 flex items-center justify-center rounded-full bg-primary text-[8px] border-none">{tasks.length}</Badge>
                            )}
                        </TabsTrigger>
 <TabsTrigger value="billing" className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider gap-2 shrink-0">
 <Receipt className="h-3 w-3" /> Billing
                        </TabsTrigger>
 <TabsTrigger value="presence" className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider gap-2 shrink-0">
                            <Share2 className="h-3 w-3" /> Online Presence
                        </TabsTrigger>
                        <TabsTrigger value="notes" className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider gap-2 shrink-0">
                            <MessageSquarePlus className="h-3 w-3" /> Notes
                        </TabsTrigger>
                        <TabsTrigger value="automations" className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider gap-2 shrink-0">
                            <Zap className="h-3 w-3" /> Automations
                        </TabsTrigger>
                        <TabsTrigger value="lead-intel" className="text-muted-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent h-12 px-5 text-xs font-bold uppercase tracking-wider gap-2 shrink-0">
                            <Sparkles className="h-3 w-3" /> Lead Intel
                        </TabsTrigger>
                    </TabsList>

  <TabsContent value="overview" className="m-0 p-6 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
                                <EntityContactDirectory 
                                    entityId={entityId} 
                                    entityData={entityData} 
                                    organizationId={entityData.organizationId} 
                                    workspaceId={activeWorkspaceId} 
                                />
                                {entityData && activeWorkspaceId && (
                                    <>
                                        <Separator className="bg-border/40" />
                                        <EntityCustomFieldGroups
                                            entityId={entityId}
                                            entityData={entityData}
                                            organizationId={entityData.organizationId}
                                            workspaceId={activeWorkspaceId}
                                        />
                                    </>
                                )}
                    </TabsContent>

 <TabsContent value="deals" className="m-0 p-6 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
     <EntityDealsTab entityId={entityId} />
 </TabsContent>

 <TabsContent value="meetings" className="m-0 p-6 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
     <EntityMeetingsTab entityId={entityId} />
 </TabsContent>

 <TabsContent value="tasks" className="m-0 p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
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

 <TabsContent value="billing" className="m-0 p-6 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
                        <EntityBillingTab entity={entityData} workspaceEntity={weData} />
                    </TabsContent>

                    {/* Online Presence Tab */}
                    <TabsContent value="presence" className="m-0 p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
                        <Card className="border-none shadow-sm rounded-2xl bg-card overflow-hidden">
                            <CardHeader className="border-b bg-card/20 pb-5 px-8 pt-8 flex flex-row items-center justify-between">
                                <CardTitle className="text-[10px] font-semibold text-primary flex items-center gap-2"><Share2 className="h-4 w-4" /> Digital Presence & Social Media</CardTitle>
                                <Button
                                    variant={isEditingPresence ? 'default' : 'outline'}
                                    size="sm"
                                    className="rounded-xl font-bold h-8 px-4 text-xs"
                                    onClick={() => {
                                        if (isEditingPresence) {
                                            handleSavePresence();
                                        } else {
                                            setIsEditingPresence(true);
                                        }
                                    }}
                                    disabled={isSavingPresence}
                                >
                                    {isSavingPresence ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : isEditingPresence ? <Save className="h-3 w-3 mr-1.5" /> : <Pencil className="h-3 w-3 mr-1.5" />}
                                    {isEditingPresence ? 'Save' : 'Edit'}
                                </Button>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {([
                                        { key: 'website', label: 'Website', icon: Globe, placeholder: 'https://example.com' },
                                        { key: 'digitalAddress', label: 'Digital Address', icon: MapPin, placeholder: 'GA-XXX-XXXX' },
                                        { key: 'googleMapLocation', label: 'Google Map', icon: MapPin, placeholder: 'https://maps.google.com/...' },
                                        { key: 'googleBusinessProfile', label: 'Google Business', icon: Building2, placeholder: 'https://business.google.com/...' },
                                        { key: 'facebook', label: 'Facebook', icon: Globe, placeholder: 'https://facebook.com/...' },
                                        { key: 'whatsapp', label: 'WhatsApp', icon: Phone, placeholder: '+233...' },
                                        { key: 'linkedin', label: 'LinkedIn', icon: Network, placeholder: 'https://linkedin.com/in/...' },
                                        { key: 'pinterest', label: 'Pinterest', icon: Share2, placeholder: 'https://pinterest.com/...' },
                                        { key: 'instagram', label: 'Instagram', icon: Camera, placeholder: '@username' },
                                        { key: 'tiktok', label: 'TikTok', icon: Zap, placeholder: '@username' },
                                        { key: 'youtube', label: 'YouTube', icon: Globe, placeholder: 'https://youtube.com/...' },
                                        { key: 'x', label: 'X (Twitter)', icon: Hash, placeholder: '@username' },
                                    ] as const).map(({ key, label, icon: FieldIcon, placeholder }) => {
                                        const value = presenceForm[key as keyof OnlinePresence] || '';
                                        return (
                                            <div key={key} className={cn("flex items-start gap-3 p-4 rounded-xl border border-border/50 transition-all", isEditingPresence ? 'bg-muted/20' : 'bg-card hover:bg-muted/10')}>
                                                <div className="p-2 bg-muted rounded-lg shrink-0 mt-0.5 border border-border/50">
                                                    <FieldIcon className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-semibold text-muted-foreground leading-none mb-1.5">{label}</p>
                                                    {isEditingPresence ? (
                                                        <input
                                                            type="text"
                                                            value={value}
                                                            onChange={e => setPresenceForm(prev => ({ ...prev, [key]: e.target.value }))}
                                                            placeholder={placeholder}
                                                            className="w-full text-sm font-medium bg-transparent border-b border-primary/20 focus:border-primary outline-none py-1 transition-colors placeholder:text-muted-foreground/40"
                                                        />
                                                    ) : value ? (
                                                        <a
                                                            href={value.startsWith('http') || value.startsWith('+') ? value : `https://${value}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-sm font-bold text-foreground hover:text-primary flex items-center gap-1.5 truncate underline-offset-4 hover:underline"
                                                        >
                                                            {value}
                                                            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                        </a>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground/50 italic">Not set</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {isEditingPresence && (
                                    <div className="flex items-center justify-end gap-3 pt-6 mt-4 border-t border-border/50">
                                        <Button variant="ghost" size="sm" className="rounded-xl font-bold" onClick={() => { setIsEditingPresence(false); setPresenceForm(entityData?.onlinePresence || {}); }}>Cancel</Button>
                                        <Button size="sm" className="rounded-xl font-bold" onClick={handleSavePresence} disabled={isSavingPresence}>
                                            {isSavingPresence ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Save className="h-3 w-3 mr-1.5" />}
                                            Save Changes
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="notes" className="m-0 p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
                        <EntityNotesTab entityId={entityId} />
                        <LinkedQuickNotesPanel workspaceId={activeWorkspaceId} by="entity" recordId={entityId} />
                    </TabsContent>
                    <TabsContent value="automations" className="m-0 p-6 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
                        <EntityAutomationsTab entityId={entityId} />
                    </TabsContent>
                    <TabsContent value="lead-intel" className="m-0 p-6 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
                        <EntityLeadIntelTab entityId={entityId} />
                    </TabsContent>
                </Tabs>
              </Card>
             </div>
             <div className="lg:col-span-1 space-y-6">
                 {/* Quick Notes Widget */}
                 <EntityNotesWidget entityId={entityId} onViewAll={() => setActiveTab('notes')} />

                 {/* Workspaces Panel */}
                 <Card className="border-none shadow-sm rounded-2xl bg-card overflow-hidden">
                     <CardHeader className="border-b bg-card/20 pb-4 px-6 pt-5 text-left flex flex-row items-center justify-between">
                         <CardTitle className="text-[10px] font-semibold text-primary flex items-center gap-2"><Network className="h-4 w-4" /> Workspaces</CardTitle>
                         <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold text-primary" onClick={() => setIsManageWorkspacesOpen(true)}>
                             <Plus className="h-3 w-3 mr-1" /> Manage
                         </Button>
                     </CardHeader>
                     <CardContent className="p-4 space-y-3 text-left max-h-[320px] overflow-y-auto">
                         {(allMemberships || []).length === 0 ? (
                             <div className="py-8 text-center opacity-40 flex flex-col items-center gap-2">
                                 <Network className="h-6 w-6 text-muted-foreground" />
                                 <p className="text-[10px] font-semibold text-muted-foreground">No workspaces</p>
                             </div>
                         ) : (
                             (allMemberships || []).map(m => (
                                 <div key={m.id} className={cn("rounded-xl border p-3 flex items-center gap-3 bg-card/50 transition-all hover:bg-muted/20", m.status === 'archived' && 'opacity-40 grayscale')}>
                                     <div className={cn("p-1.5 rounded-lg shrink-0", m.status === 'active' ? "bg-sky-500/10 text-sky-500" : "bg-muted text-muted-foreground")}>
                                         <Building2 className="h-3.5 w-3.5" />
                                     </div>
                                     <div className="min-w-0 flex-1">
                                         <p className="font-bold text-xs truncate">{workspaceNameMap.get(m.workspaceId) ?? m.workspaceId}</p>
                                         <div className="flex items-center gap-2 mt-0.5">
                                             <Badge variant={m.status === 'active' ? 'default' : 'outline'} className="text-[7px] h-3.5 uppercase font-bold">{m.status}</Badge>
                                         </div>
                                     </div>
                                 </div>
                             ))
                         )}
                     </CardContent>
                 </Card>

                 {/* Activity Log */}
                 <Card className="border-none shadow-sm rounded-2xl bg-card overflow-hidden">
                     <CardHeader className="border-b bg-card/20 pb-4 px-6 pt-5 text-left">
                         <CardTitle className="text-[10px] font-semibold text-primary flex items-center gap-2"><Activity className="h-4 w-4" /> Activity Log</CardTitle>
                     </CardHeader>
                     <CardContent className="p-4 text-left">
                         <ActivityTimeline entityId={entityId} limit={8} />
                         <Button variant="link" size="sm" className="w-full mt-2 text-[10px] font-bold text-muted-foreground hover:text-primary" onClick={() => setIsLogModalOpen(true)}>
                             View Full Activity Log →
                         </Button>
                     </CardContent>
                 </Card>
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

            {entityData && (
                <ManageWorkspacesModal
                    entityId={entityId}
                    entityType={entityData.entityType}
                    entityName={displayName}
                    open={isManageWorkspacesOpen}
                    onOpenChange={setIsManageWorkspacesOpen}
                />
            )}

            {isCampaignDialogOpen && entityData && (
              <AddToCampaignDialog
                open={isCampaignDialogOpen}
                onOpenChange={setIsCampaignDialogOpen}
                entityIds={[entityId]}
                workspaceId={activeWorkspaceId}
                entityContacts={resolveEntityContacts(entityData)}
                entityName={entityData.name}
              />
            )}
        </PageContainerFluid>
    );
}
