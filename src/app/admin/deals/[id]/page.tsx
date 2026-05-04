'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { Deal } from '@/lib/types';
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
import { useToast } from '@/hooks/use-toast';
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

    const [customKey, setCustomKey] = React.useState('');
    const [customValue, setCustomValue] = React.useState('');

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
            <div className="space-y-6 w-full max-w-6xl mx-auto pb-20">
                <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
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
                            <div className="flex items-center gap-4 text-sm font-semibold text-muted-foreground">
                                <span className="flex items-center gap-1.5"><Banknote className="h-4 w-4 text-primary" /> ${(deal.value || 0).toLocaleString()}</span>
                                <Separator orientation="vertical" className="h-4" />
                                <Link href={`/admin/entities/${deal.entityId}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                                    <Building2 className="h-4 w-4" /> View Linked Entity
                                </Link>
                                <Separator orientation="vertical" className="h-4" />
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
                                    {/* We pass the entityId to ActivityTimeline because activities are logged against the entity. 
                                        Since Deals are part of the entity, their logs will appear here. 
                                        In the future, we could add a `dealId` filter to ActivityTimeline. */}
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
