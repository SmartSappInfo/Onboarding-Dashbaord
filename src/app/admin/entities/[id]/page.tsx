'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser as useFirebaseUser } from '@/firebase';
import { doc, collection, query, where, orderBy, updateDoc } from 'firebase/firestore';
import type { School, FocalPerson, Task, Tag, TagAuditLog, ResolvedContact } from '@/lib/types';
import { TagSelector } from '@/components/tags/TagSelector';
import { TagBadges } from '@/components/tags/TagBadges';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { resolveContact } from '@/lib/contact-adapter';
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
    Target
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
import { getPrimaryWorkspaceId, isProspect as checkIsProspect } from '@/lib/workspace-helpers';
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
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTerminology } from '@/hooks/use-terminology';

const ActivityTimeline = dynamic(() => import('../../components/ActivityTimeline'), {
    loading: () => <div className="p-8 space-y-4"><Skeleton className="h-4 w-32"/><Skeleton className="h-20 w-full"/><Skeleton className="h-20 w-full"/></div>,
});

const LogActivityModal = dynamic(() => import('../components/LogActivityModal'), { ssr: false });

const getStatusBadgeVariant = (status: any) => {
    switch (status) {
        case 'Active': return 'default';
        case 'Inactive': return 'secondary';
        case 'Archived': return 'outline';
        default: return 'secondary';
    }
}

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '?';

export default function SchoolDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const entityId = params.id as string;
    const firestore = useFirestore();
    const { user: currentUser } = useFirebaseUser();
    const { activeWorkspaceId } = useWorkspace();
    const { 
        singular, 
        plural, 
        addNew, 
        importBulk, 
        noFound, 
        deleteConfirm, 
        deleteLabel, 
        updateStatus, 
        termName, 
        termStatus,
        viewConsole,
        editProfile
    } = useTerminology();
    
    const [isLogModalOpen, setIsLogModalOpen] = React.useState(false);
    const [isLogoDialogOpen, setIsLogoDialogOpen] = React.useState(false);
    const [isUpdatingLogo, setIsUpdatingLogo] = React.useState(false);
    
    const [statusModalOpen, setStatusModalOpen] = React.useState(false);
    const [transferModalOpen, setTransferModalOpen] = React.useState(false);
    const [convertModalOpen, setConvertModalOpen] = React.useState(false);

    const schoolDocRef = useMemoFirebase(() => {
        if (!firestore || !entityId) return null;
        return doc(firestore, 'schools', entityId);
    }, [firestore, entityId]);

    const { data: school, isLoading } = useDoc<School>(schoolDocRef);

    // Resolve contact data using Contact Adapter (Requirement 11.1)
    const [resolvedContact, setResolvedContact] = React.useState<ResolvedContact | null>(null);
    const [isResolvingContact, setIsResolvingContact] = React.useState(false);

    React.useEffect(() => {
        async function loadContactData() {
            if (!entityId || !activeWorkspaceId) return;
            
            setIsResolvingContact(true);
            try {
                // Try to resolve by entityId first, fallback to entityId
                const contact = await resolveContact(
                    { entityId },
                    activeWorkspaceId
                );
                setResolvedContact(contact);
            } catch (error) {
                console.error('[PROFILE] Failed to resolve contact:', error);
                setResolvedContact(null);
            } finally {
                setIsResolvingContact(false);
            }
        }

        if (school) {
            loadContactData();
        }
    }, [school, entityId, activeWorkspaceId]);

    // Tasks Subscription for this school
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

    // Tags subscription
    const tagsQuery = useMemoFirebase(() => {
        if (!firestore || !school?.workspaceIds?.[0]) return null;
        return query(
            collection(firestore, 'tags'),
            where('workspaceId', '==', school.workspaceIds[0]),
            orderBy('name', 'asc')
        );
    }, [firestore, school?.workspaceIds]);
    const { data: allTags } = useCollection<Tag>(tagsQuery);

    // Tag audit log for this school
    const tagAuditQuery = useMemoFirebase(() => {
        if (!firestore || !entityId) return null;
        return query(
            collection(firestore, 'tag_audit_logs'),
            where('contactId', '==', entityId),
            orderBy('timestamp', 'desc')
        );
    }, [firestore, entityId]);
    const { data: tagAuditLogs } = useCollection<TagAuditLog>(tagAuditQuery);

    // Navigation Entity Resolution
    useSetBreadcrumb(resolvedContact?.name || school?.name);

    if (isLoading || isResolvingContact) return <div className="p-8 space-y-8"><Skeleton className="h-48 w-full rounded-[2.5rem]"/><Skeleton className="h-96 w-full rounded-[2.5rem]"/></div>;
    if (!school || !resolvedContact) return <div className="flex flex-col items-center justify-center py-20 text-center space-y-4"><h2 className="text-xl font-bold">{singular} Not Found</h2><Button variant="outline" onClick={() => router.push('/admin/entities')}>Back to List</Button></div>;

    const handleTaskComplete = (taskId: string) => {
        if (firestore) {
            completeTaskNonBlocking(firestore, taskId);
            toast({ title: 'Task Completed' });
        }
    };

    const handleLogoUpdate = async (newLogoUrl: string) => {
        if (!firestore || !school || isUpdatingLogo) return;
        setIsUpdatingLogo(true);
        try {
            await updateDoc(doc(firestore, 'schools', school.id), {
                logoUrl: newLogoUrl,
                updatedAt: new Date().toISOString()
            });
            
            toast({ title: 'Branding Synchronized', description: 'Institutional logo updated across the platform.' });
            setIsLogoDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
        } finally {
            setIsUpdatingLogo(false);
        }
    };

    const DetailItem = ({ icon: Icon, label, value, href, children }: { icon: any, label: string, value?: any, href?: string, children?: any }) => (
        <div className="flex items-start gap-4">
            <div className="p-2 bg-muted rounded-lg shrink-0 mt-0.5 border border-border/50"><Icon className="h-4 w-4 text-muted-foreground" /></div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1.5">{label}</p>
                {href ? <a href={href} className="text-base font-bold text-foreground hover:text-primary truncate block underline-offset-4 hover:underline">{String(value)}</a> : value && <p className="text-base font-bold text-foreground leading-tight">{String(value)}</p>}
                {children}
            </div>
        </div>
    );

    const isProspect = checkIsProspect(school);

    return (
        <div className={cn("h-full overflow-y-auto bg-background pb-32", school.schoolStatus === 'Churned' && "grayscale opacity-80")}>
            <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        {isProspect && (
                            <Button 
                                variant="default" 
                                size="sm" 
                                className="rounded-xl font-black h-10 px-6 bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition-all active:scale-95 gap-2"
                                onClick={() => setConvertModalOpen(true)}
                            >
                                <Zap className="h-4 w-4 fill-white" />
                                Convert to Onboarding
                            </Button>
                        )}
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-xl font-bold h-10 border-primary/20 text-primary bg-background"
                            onClick={() => setStatusModalOpen(true)}
                        >
                            <ShieldCheck className="mr-2 h-4 w-4" /> 
                            {updateStatus}
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-xl font-bold h-10 border-blue-200 text-blue-600 bg-background"
                            onClick={() => setTransferModalOpen(true)}
                        >
                            <ArrowRightLeft className="mr-2 h-4 w-4" /> 
                            Transfer Pipeline
                        </Button>
                    </div>
                    <div className="flex justify-end gap-2 text-left">
                        <Button variant="outline" size="sm" className="rounded-xl font-bold h-10 px-4 bg-background" onClick={() => setIsLogModalOpen(true)}>
                            <MessageSquarePlus className="mr-2 h-4 w-4 text-primary" /> 
                            Log Interaction
                        </Button>
                        <Button className="rounded-xl font-black shadow-lg h-10 px-6" onClick={() => router.push(`/admin/entities/${school.id}/edit`)}>
                            <PenSquare className="mr-2 h-4 w-4" /> 
                            Edit Profile
                        </Button>
                    </div>
                </div>

                <Card className="border-none shadow-2xl overflow-hidden glass-card rounded-[2.5rem] bg-card">
                    <div className="h-48 bg-slate-900 relative group">
                        {school.heroImageUrl && <Image src={school.heroImageUrl} alt="banner" fill className="object-cover opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700" />}
                        <div className="absolute bottom-6 right-8 flex gap-3">
                             <Badge 
                                variant={getStatusBadgeVariant(school.status)} 
                                className="h-10 px-6 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-2xl border-none ring-4 ring-white/10 backdrop-blur-md"
                             >
                                {school.status}
                             </Badge>
                             <Badge 
                                className={cn(
                                    "h-10 px-6 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-2xl border-none text-white ring-4 ring-white/10 backdrop-blur-md",
                                    school.schoolStatus === 'Active' ? "bg-emerald-500" : 
                                    school.schoolStatus === 'Onboarding' ? "bg-blue-500" : "bg-slate-500"
                                )}
                             >
                                {school.schoolStatus}
                             </Badge>
                             <Badge className="h-10 px-6 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-2xl border-none text-white ring-4 ring-white/10 backdrop-blur-md" style={{ backgroundColor: school.stage?.color || '#3B5FFF' }}>{school.stage?.name || 'Welcome'}</Badge>
                        </div>
                    </div>
                    <CardContent className="px-8 pb-10 -mt-16 relative z-10 flex flex-col md:flex-row items-end md:items-center gap-8">
                        <div 
                            className="relative h-44 w-44 rounded-[3rem] bg-card p-3 shadow-2xl ring-8 ring-border/20 overflow-hidden border border-border/50 shrink-0 group cursor-pointer"
                            onClick={() => setIsLogoDialogOpen(true)}
                        >
                            {school.logoUrl ? (
                                <Image src={school.logoUrl} alt={school.name} fill className="object-contain p-6 transition-transform duration-500 group-hover:scale-110" />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center bg-primary/5 text-primary text-5xl font-black">{school.initials || school.name.substring(0, 2)}</div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white">
                                <Camera className="h-8 w-8" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Change Logo</span>
                            </div>
                        </div>
                        <div className="flex-1 space-y-4 pt-4 text-left">
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className={cn(
                                    "font-black border-2",
                                    isProspect ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-primary border-primary/20 bg-primary/5"
                                )}>
                                    {isProspect ? 'PROSPECT' : school.initials}
                                </Badge>
                                <Separator orientation="vertical" className="h-4" />
                                <span className="text-muted-foreground font-bold flex items-center gap-1.5 text-sm uppercase tracking-widest"><MapPin className="h-3.5 w-3.5" /> {school.zone?.name}</span>
                                {resolvedContact.migrationStatus === 'migrated' && (
                                    <>
                                        <Separator orientation="vertical" className="h-4" />
                                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-blue-200 text-blue-600 bg-blue-50">
                                            Entity System
                                        </Badge>
                                    </>
                                )}
                            </div>
                            <h2 className="text-3xl font-black tracking-tight uppercase">{resolvedContact.name}</h2>
                            {/* Tag Selector - Display workspace tags from resolved contact */}
                            <div className="flex flex-wrap items-center gap-2">
                                <TagSelector
                                    contactId={school.id}
                                    contactType="school"
                                    currentTagIds={resolvedContact.tags || []}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="overview" className="space-y-8">
                    <TabsList className="bg-card/40 border shadow-sm p-1 h-12 rounded-2xl w-fit backdrop-blur-sm">
                        <TabsTrigger value="overview" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8">Insights</TabsTrigger>
                        <TabsTrigger value="tasks" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 gap-2">
                            Tasks
                            {tasks && tasks.length > 0 && (
                                <Badge className="h-4 w-4 p-0 flex items-center justify-center rounded-full bg-primary text-[8px] border-none">{tasks.length}</Badge>
                            )}
                        </TabsTrigger>
                        {!isProspect && (
                            <TabsTrigger value="billing" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8 gap-2">
                                <Receipt className="h-4 w-4" /> Billing & Finance
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="timeline" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8">Activity Feed</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="m-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
                            <Card className="lg:col-span-2 border-none shadow-sm rounded-[2rem] bg-card overflow-hidden">
                                <CardHeader className="border-b bg-card/20 pb-5 px-8 pt-8">
                                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Contact className="h-4 w-4" /> Focal Directory</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-border/50">
                                        {resolvedContact.contacts && resolvedContact.contacts.length > 0 ? (
                                            resolvedContact.contacts.map((person, idx) => (
                                                <div key={idx} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group hover:bg-muted/5 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-12 w-12 rounded-2xl bg-card/50 flex items-center justify-center font-black text-primary border border-border/50 shadow-sm group-hover:bg-primary group-hover:text-white transition-colors">{getInitials(person.name)}</div>
                                                        <div>
                                                            <p className="font-black text-base">{person.name}</p>
                                                            <Badge variant="outline" className="mt-1 text-[8px] font-black uppercase tracking-tighter h-5">{person.type}</Badge>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 w-full sm:w-auto">
                                                        <Button variant="outline" size="sm" asChild className="h-9 rounded-xl flex-1 sm:flex-none border-border/50"><a href={`mailto:${person.email}`}><Mail className="h-3.5 w-3.5 mr-2" /> Email</a></Button>
                                                        <Button variant="outline" size="sm" asChild className="h-9 rounded-xl flex-1 sm:flex-none border-border/50"><a href={`tel:${person.phone}`}><Phone className="h-3.5 w-3.5 mr-2" /> Call</a></Button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-12 text-center text-muted-foreground font-medium italic">No directory initialized.</div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-sm rounded-[2rem] bg-card overflow-hidden">
                                <CardHeader className="border-b bg-card/20 pb-5 px-8 pt-8">
                                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Account Metrics</CardTitle>
                                </CardHeader>
                                <CardContent className="p-8 space-y-8">
                                    <div className="flex items-center justify-between p-5 rounded-[1.5rem] bg-primary/10 border border-primary/20 shadow-inner">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase text-primary/60 tracking-widest">Network Impact</p>
                                            <p className="text-3xl font-black tabular-nums tracking-tighter text-primary">{school.nominalRoll?.toLocaleString() || '0'}</p>
                                        </div>
                                        <div className="p-3 bg-card rounded-2xl shadow-sm border border-primary/20"><Users className="h-6 w-6 text-primary" /></div>
                                    </div>
                                    <div className="space-y-6">
                                        <DetailItem icon={UserCheck} label="Primary Handler" value={resolvedContact.assignedTo?.name || 'Unassigned'} />
                                        <DetailItem icon={Target} label="Source Workspace" value={toTitleCase(getPrimaryWorkspaceId(school))} />
                                        <DetailItem icon={Workflow} label="Pipeline Stage" value={resolvedContact.stageName || 'Not Set'} />
                                        <Separator />
                                        <div className="space-y-3">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Functional Interests</p>
                                            <div className="flex flex-wrap gap-2">
                                                {school.modules && school.modules.length > 0 ? school.modules?.map(m => (
                                                    <Badge key={m.id} style={{backgroundColor: m.color}} className="text-white border-none font-bold text-[9px] uppercase">{m.abbreviation}</Badge>
                                                )) : <span className="text-[10px] font-medium text-muted-foreground italic">None specified</span>}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="tasks" className="m-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
                        <div className="flex justify-between items-center mb-2 px-2">
                            <h3 className="text-xl font-black uppercase tracking-tight">Active Tasks</h3>
                            <Button size="sm" variant="outline" className="rounded-xl font-bold h-9 border-primary/20 hover:bg-primary/5 text-primary gap-2" asChild>
                                <Link href={`/admin/tasks?entityId=${school.id}&assignedTo=${school.assignedTo?.userId || 'all'}&track=${getPrimaryWorkspaceId(school)}`}>
                                    <Plus className="h-4 w-4" /> Create Task
                                </Link>
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {isLoadingTasks ? (
                                Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
                            ) : tasks && tasks.length > 0 ? (
                                tasks.map(task => (
                                    <Card key={task.id} className="border-border/50 rounded-2xl bg-card shadow-sm hover:shadow-md transition-all">
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <button onClick={() => handleTaskComplete(task.id)} className="shrink-0 text-muted-foreground hover:text-emerald-500"><Circle className="h-6 w-6" /></button>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-black uppercase tracking-tight truncate leading-tight">{task.title}</p>
                                                <div className="flex items-center gap-3 mt-1 text-[9px] font-bold uppercase tracking-tighter">
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
                                <div className="col-span-full py-16 text-center border-2 border-dashed rounded-[2rem] bg-background/20 opacity-30 flex flex-col items-center gap-2">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">No pending actions for this {singular.toLowerCase()}</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {!isProspect && (
                        <TabsContent value="billing" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
                            <EntityBillingTab school={school} />
                        </TabsContent>
                    )}

                    <TabsContent value="timeline" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
                        <div className="bg-card rounded-[2rem] p-6 sm:p-10 shadow-sm ring-1 ring-border min-h-[400px]">
                            <div className="mb-10 flex items-center gap-3">
                                <div className="flex flex-col">
                                    <Badge variant="outline" className="w-fit bg-background font-black text-[10px] uppercase tracking-widest px-3 py-1 border-primary/20 text-primary mb-1">Live Feed</Badge>
                                    <h3 className="text-2xl font-black tracking-tight">Audit Trail</h3>
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
                            </div>
                            <ActivityTimeline entityId={school.id} limit={20} />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            <Dialog open={isLogoDialogOpen} onOpenChange={setIsLogoDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden p-0 border shadow-2xl bg-card">
                    <DialogHeader className="p-8 bg-card/20 border-b shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl">
                                <Camera className="h-6 w-6" />
                            </div>
                            <div className="text-left">
                                <DialogTitle className="text-xl font-black uppercase tracking-tight">Update Logo</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select or upload a new identity.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="p-8">
                        <MediaSelect 
                            value={school.logoUrl} 
                            onValueChange={handleLogoUpdate} 
                            className="rounded-2xl" 
                        />
                        {isUpdatingLogo && (
                            <div className="mt-4 flex items-center justify-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest animate-pulse">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Synchronizing Branding...
                            </div>
                        )}
                    </div>
                    <DialogFooter className="p-4 bg-card/50 border-t flex justify-end">
                        <Button variant="ghost" onClick={() => setIsLogoDialogOpen(false)} className="rounded-xl font-bold">Discard</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <LogActivityModal school={school} open={isLogModalOpen} onOpenChange={setIsLogModalOpen} />
            <ChangeStatusModal school={school} open={statusModalOpen} onOpenChange={setStatusModalOpen} />
            <TransferPipelineModal school={school} open={transferModalOpen} onOpenChange={setTransferModalOpen} />
            {school && <ConvertLeadModal school={school} open={convertModalOpen} onOpenChange={setConvertModalOpen} />}
        </div>
    );
}
