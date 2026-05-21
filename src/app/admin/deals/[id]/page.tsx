'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, collection, query, orderBy } from 'firebase/firestore';
import type { Deal, UserProfile, OnboardingStage, Pipeline } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Banknote, Calendar, Building2, UserCircle2, Settings2, ShieldCheck, Activity, Target } from 'lucide-react';
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
import { updateDealDetailsAction, updateDealStageAction, updateDealStatusAction } from '@/app/actions/deal-actions';
import dynamic from 'next/dynamic';

const ActivityTimeline = dynamic(() => import('../../components/ActivityTimeline'), { ssr: false });

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
        <div className="h-full overflow-y-auto w-full">
            <div className="space-y-6 w-full max-w-6xl mx-auto pb-20 p-4 md:p-8">
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
        </div>
    );
}
