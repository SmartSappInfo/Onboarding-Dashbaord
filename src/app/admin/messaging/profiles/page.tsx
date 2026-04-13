
'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, writeBatch, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { SenderProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
    Fingerprint, 
    Plus, 
    Trash2, 
    Pencil,
    Mail, 
    Smartphone, 
    Check, 
    X,
    Loader2,
    RefreshCw,
    Sparkles,
    ShieldCheck,
    Clock,
    Globe,
    MoreVertical,
    Star,
    Save,
    Send,
    Info,
    Layout,
    Share2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { checkSenderIdStatusAction, registerSenderIdAction } from '@/lib/mnotify-actions';
import { fetchVerifiedDomainsAction } from '@/lib/resend-actions';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/context/WorkspaceContext';
import { MultiSelect } from '@/components/ui/multi-select';

/**
 * @fileOverview Sender Profiles Hub.
 * Upgraded to support multi-workspace sharing and filtering.
 */
export default function SenderProfilesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();
    const [isAdding, setIsAdding] = React.useState(false);
    
    // Add Form State
    const [name, setName] = React.useState('');
    const [channel, setChannel] = React.useState<'sms' | 'email'>('sms');
    const [identifier, setIdentifier] = React.useState('');
    const [workspaceIds, setWorkspaceIds] = React.useState<string[]>([activeWorkspaceId]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Edit State
    const [editingProfile, setEditingProfile] = React.useState<SenderProfile | null>(null);
    const [editName, setEditName] = React.useState('');
    const [editIdentifier, setEditIdentifier] = React.useState('');
    const [editWorkspaceIds, setEditWorkspaceIds] = React.useState<string[]>([]);
    const [isUpdating, setIsUpdating] = React.useState(false);

    // Provider Sync State
    const [syncingId, setSyncingId] = React.useState<string | null>(null);
    const [registeringProfile, setRegisteringProfile] = React.useState<SenderProfile | null>(null);
    const [regPurpose, setRegPurpose] = React.useState('');
    const [isRegProcessing, setIsRegProcessing] = React.useState(false);

    const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

    // Fetch only profiles belonging to the current workspace hub
    const profilesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'sender_profiles'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, activeWorkspaceId]);

    const { data: profiles, isLoading } = useCollection<SenderProfile>(profilesQuery);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !name || !identifier || workspaceIds.length === 0) {
            if(workspaceIds.length === 0) toast({ variant: 'destructive', title: 'Constraint Alert', description: 'Select at least one workspace.' });
            return;
        }
        
        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'sender_profiles'), {
                name: name.trim(),
                channel,
                identifier: identifier.trim(),
                workspaceIds,
                isDefault: false, // Defaulting to false for safety
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            setName('');
            setIdentifier('');
            setWorkspaceIds([activeWorkspaceId]);
            setIsAdding(false);
            toast({ title: 'Profile Initialized', description: 'Authorized for ' + workspaceIds.length + ' hubs.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to create profile.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (profile: SenderProfile) => {
        setEditingProfile(profile);
        setEditName(profile.name);
        setEditIdentifier(profile.identifier);
        setEditWorkspaceIds(profile.workspaceIds || [activeWorkspaceId]);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !editingProfile || !editName || !editIdentifier || editWorkspaceIds.length === 0) return;

        setIsUpdating(true);
        try {
            const docRef = doc(firestore, 'sender_profiles', editingProfile.id);
            await updateDoc(docRef, {
                name: editName.trim(),
                identifier: editIdentifier.trim(),
                workspaceIds: editWorkspaceIds,
                updatedAt: new Date().toISOString(),
            });
            setEditingProfile(null);
            toast({ title: 'Profile Synchronized' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Update Failed' });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSetDefault = async (profile: SenderProfile) => {
        if (!firestore || !profiles) return;
        
        const batch = writeBatch(firestore);
        const channelProfiles = profiles.filter(p => p.channel === profile.channel);
        
        channelProfiles.forEach(p => {
            const ref = doc(firestore, 'sender_profiles', p.id);
            batch.update(ref, { 
                isDefault: p.id === profile.id,
                updatedAt: new Date().toISOString()
            });
        });

        try {
            await batch.commit();
            toast({ 
                title: 'Channel Default Updated', 
                description: `"${profile.name}" is now the primary gateway for ${profile.channel.toUpperCase()} in this hub.` 
            });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error' });
        }
    };

    const handleSyncStatus = async (profile: SenderProfile) => {
        if (!firestore) return;
        setSyncingId(profile.id);
        
        try {
            if (profile.channel === 'sms') {
                const result = await checkSenderIdStatusAction(profile.identifier);
                if (result.success) {
                    const normalizedStatus = result.message?.toLowerCase().includes('approved') ? 'approved' : 
                                           result.message?.toLowerCase().includes('pending') ? 'pending' : 
                                           'not_registered';

                    await updateDoc(doc(firestore, 'sender_profiles', profile.id), {
                        mNotifyStatus: normalizedStatus,
                        mNotifyMessage: result.message,
                        updatedAt: new Date().toISOString()
                    });
                    toast({ title: 'mNotify Sync Complete', description: result.message });
                } else throw new Error(result.error);
            } else {
                const result = await fetchVerifiedDomainsAction();
                if (result.success) {
                    const domainPart = profile.identifier.split('@')[1];
                    const domainMatch = result.domains.find((d: any) => d.name === domainPart);
                    const status = domainMatch?.status || 'not_registered';
                    await updateDoc(doc(firestore, 'sender_profiles', profile.id), {
                        resendStatus: status,
                        updatedAt: new Date().toISOString()
                    });
                    toast({ title: 'Resend Sync Complete' });
                } else throw new Error(result.error);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Sync Failed', description: e.message });
        } finally {
            setSyncingId(null);
        }
    }

    const handleStartRegistration = (profile: SenderProfile) => {
        setRegisteringProfile(profile);
        setRegPurpose(`Communication for ${profile.name}`);
    }

    const handleCompleteRegistration = async () => {
        if (!registeringProfile || !regPurpose.trim()) return;
        setIsRegProcessing(true);
        
        try {
            const result = await registerSenderIdAction(registeringProfile.identifier, regPurpose.trim());
            if (result.success) {
                toast({ title: 'Registration Submitted' });
                await handleSyncStatus(registeringProfile);
                setRegisteringProfile(null);
            } else throw new Error(result.error);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Registration Failed' });
        } finally {
            setIsRegProcessing(false);
        }
    }

    const toggleActive = async (profile: SenderProfile) => {
        if (!firestore) return;
        const docRef = doc(firestore, 'sender_profiles', profile.id);
        await updateDoc(docRef, { isActive: !profile.isActive, updatedAt: new Date().toISOString() });
    };

    const handleDelete = async (id: string) => {
        if (!firestore || !confirm('Permanently purge this sender identity?')) return;
        await deleteDoc(doc(firestore, 'sender_profiles', id));
        toast({ title: 'Profile Purged' });
    };

    const getStatusBadge = (profile: any) => {
        const status = profile.channel === 'sms' ? (profile.mNotifyStatus || 'unknown') : (profile.resendStatus || 'unknown');
        switch (status) {
            case 'approved':
            case 'verified':
                return <Badge className="bg-emerald-500 text-white border-none text-[8px] h-5 gap-1 uppercase tracking-tighter"><ShieldCheck className="h-2.5 w-2.5" /> Approved</Badge>;
            case 'pending':
                return <Badge variant="secondary" className="text-[8px] h-5 gap-1 uppercase tracking-tighter border-orange-200 text-orange-700 bg-orange-50"><Clock className="h-2.5 w-2.5" /> Pending</Badge>;
            case 'not_registered':
                return <Badge variant="outline" className="text-[8px] h-5 gap-1 uppercase tracking-tighter border-dashed"><Globe className="h-2.5 w-2.5" /> Unverified</Badge>;
            default:
                return <Badge variant="secondary" className="text-[8px] h-5 uppercase tracking-tighter opacity-40">Unsynced</Badge>;
        }
    }

    return (
 <div className="h-full overflow-y-auto  bg-background text-left">
 <div className=" space-y-8">
 <div className="flex items-center justify-end flex-wrap gap-4">
 <Button onClick={() => setIsAdding(!isAdding)} className="rounded-xl font-semibold shadow-lg h-11 px-8">
 {isAdding ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                        {isAdding ? 'Discard' : 'Initialize Identity'}
                    </Button>
                </div>

                {isAdding && (
 <Card className="mb-8 border-primary/20 bg-primary/5 animate-in slide-in-from-top-4 duration-300 rounded-[2.5rem] overflow-hidden shadow-xl">
 <CardHeader className="bg-primary/5 border-b p-8 text-left">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20"><Fingerprint size={24} /></div>
                                <div>
 <CardTitle className="text-2xl font-semibold tracking-tight">Identity Hub Architect</CardTitle>
 <CardDescription className="text-xs font-bold text-primary/60">Configure sender credentials across institutional tracks.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
 <CardContent className="p-8 space-y-8 text-left">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div className="space-y-6">
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Friendly Label</Label>
 <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Primary SMS Uplink" className="h-12 rounded-xl bg-card border-none shadow-inner font-bold" />
                                    </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Shared Visibility</Label>
                                        <MultiSelect options={workspaceOptions} value={workspaceIds} onChange={setWorkspaceIds} placeholder="Assign to hubs..." />
                                    </div>
                                </div>
 <div className="space-y-6">
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Channel Medium</Label>
                                        <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
 <SelectTrigger className="h-12 rounded-xl bg-card border-none shadow-inner font-bold"><SelectValue /></SelectTrigger>
 <SelectContent className="rounded-xl">
                                                <SelectItem value="sms">SMS (Sender ID)</SelectItem>
                                                <SelectItem value="email">Email (From Addr)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">{channel === 'sms' ? 'Alphanumeric ID' : 'Verified Endpoint'}</Label>
                                        <Input 
                                            value={identifier} 
                                            onChange={e => setIdentifier(e.target.value)} 
                                            placeholder={channel === 'sms' ? 'SMARTSAPP' : 'onboarding@enroll.smartsapp.com'} 
 className="h-12 rounded-xl bg-card border-none shadow-inner font-mono font-bold"
                                        />
                                    </div>
                                </div>
                            </div>
 <div className="flex justify-end pt-4">
 <Button onClick={handleAdd} disabled={isSubmitting || !name || !identifier || workspaceIds.length === 0} className="h-14 px-12 rounded-2xl font-semibold shadow-2xl text-sm active:scale-95 transition-all">
 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                    Commit Identity
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

 <div className="rounded-[2.5rem] border border-border/50 bg-card shadow-sm overflow-hidden ring-1 ring-black/5">
                    <Table>
 <TableHeader className="bg-muted/30">
                            <TableRow>
 <TableHead className="text-[10px] font-semibold pl-8 py-5">Corporate Identity</TableHead>
 <TableHead className="text-[10px] font-semibold ">Visibility</TableHead>
 <TableHead className="text-[10px] font-semibold text-center">Status</TableHead>
 <TableHead className="text-[10px] font-semibold text-center">Default</TableHead>
 <TableHead className="text-[10px] font-semibold text-center">Active</TableHead>
 <TableHead className="text-[10px] font-semibold text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
 <TableCell className="pl-8 py-6"><Skeleton className="h-4 w-32" /></TableCell>
 <TableCell><Skeleton className="h-4 w-24" /></TableCell>
 <TableCell className="text-center"><Skeleton className="h-6 w-12 mx-auto rounded-full" /></TableCell>
 <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto rounded" /></TableCell>
 <TableCell className="text-center"><Skeleton className="h-6 w-10 mx-auto rounded-full" /></TableCell>
 <TableCell className="pr-8"><Skeleton className="h-8 w-8 ml-auto rounded-lg" /></TableCell>
                                    </TableRow>
                                ))
                            ) : profiles?.length ? (
                                profiles.map((profile) => (
 <TableRow key={profile.id} className="group hover:bg-muted/30 transition-colors">
 <TableCell className="pl-8 py-4">
 <div className="flex flex-col gap-1">
 <div className="flex items-center gap-2">
 <span className="font-semibold text-foreground tracking-tight">{profile.name}</span>
 {profile.channel === 'sms' ? <Smartphone className="h-3 w-3 text-orange-500" /> : <Mail className="h-3 w-3 text-blue-500" />}
                                                </div>
 <code className="text-[10px] font-mono text-muted-foreground opacity-60 font-semibold">{profile.identifier}</code>
                                            </div>
                                        </TableCell>
                                        <TableCell>
 <div className="flex flex-wrap gap-1">
                                                {profile.workspaceIds?.map(wId => (
                                                    <Badge key={wId} variant="outline" className="text-[8px] font-semibold uppercase h-4 border-primary/20 bg-primary/5 text-primary">{wId}</Badge>
                                                )) || <Badge variant="secondary" className="text-[8px] font-bold opacity-30">Unbound</Badge>}
                                            </div>
                                        </TableCell>
 <TableCell className="text-center">
 <div className="flex flex-col items-center gap-1">
                                                {getStatusBadge(profile)}
                                                <button 
                                                    onClick={() => handleSyncStatus(profile)} 
                                                    disabled={syncingId === profile.id}
 className="text-[8px] font-semibold text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
 {syncingId === profile.id ? <Loader2 size={8} className="animate-spin" /> : 'Sync Status'}
                                                </button>
                                            </div>
                                        </TableCell>
 <TableCell className="text-center">
                                            <button onClick={() => handleSetDefault(profile)}>
 {profile.isDefault ? <Star className="h-4 w-4 text-amber-500 fill-amber-500 mx-auto" /> : <Star className="h-4 w-4 text-muted-foreground/20 mx-auto hover:text-amber-500 transition-colors" />}
                                            </button>
                                        </TableCell>
 <TableCell className="text-center">
                                            <Switch 
                                                checked={profile.isActive} 
                                                onCheckedChange={() => toggleActive(profile)}
 className="scale-75 mx-auto"
                                            />
                                        </TableCell>
 <TableCell className="text-right pr-8">
                                            <DropdownMenu modal={false}>
                                                <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl"><MoreVertical size={16} /></Button>
                                                </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-2xl">
 <DropdownMenuLabel className="text-[10px] font-semibold px-3 py-2 text-muted-foreground">Identity Logic</DropdownMenuLabel>
 <DropdownMenuItem className="rounded-xl p-2.5 gap-3" onClick={() => handleEditClick(profile)}>
 <div className="p-1.5 bg-primary/10 rounded-lg text-primary"><Pencil className="h-3.5 w-3.5" /></div>
 <span className="font-bold text-sm">Edit Hierarchy</span>
                                                    </DropdownMenuItem>
                                                    {profile.channel === 'sms' && (
 <DropdownMenuItem className="rounded-xl p-2.5 gap-3" onClick={() => handleStartRegistration(profile)}>
 <div className="p-1.5 bg-orange-50 rounded-lg text-orange-600"><Sparkles className="h-3.5 w-3.5" /></div>
 <span className="font-bold text-sm">Register with mNotify</span>
                                                        </DropdownMenuItem>
                                                    )}
 <DropdownMenuSeparator className="my-2" />
                                                    <DropdownMenuItem 
 className="text-destructive gap-3 rounded-xl p-2.5 focus:bg-destructive/10 focus:text-destructive"
                                                        onClick={() => handleDelete(profile.id)}
                                                    >
 <div className="p-1.5 bg-destructive/10 rounded-lg"><Trash2 className="h-3.5 w-3.5" /></div>
 <span className="font-bold text-sm">Purge Identity</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
 <TableCell colSpan={6} className="h-64 text-center">
 <div className="flex flex-col items-center justify-center gap-3 opacity-20">
 <Fingerprint className="h-12 w-12" />
 <p className="text-xs font-semibold ">No Authorized Identities</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingProfile} onOpenChange={(o) => !o && setEditingProfile(null)}>
 <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
 <form onSubmit={handleUpdate} className="text-left">
 <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-primary text-white rounded-2xl shadow-xl">
                                    <Pencil size={24} />
                                </div>
 <div className="text-left">
 <DialogTitle className="text-xl font-semibold tracking-tight">Sync Identity</DialogTitle>
 <DialogDescription className="text-[10px] font-bold text-muted-foreground">Updating institutional sender protocol</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
 <div className="p-8 space-y-6">
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Friendly Label</Label>
 <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-none font-bold shadow-inner" required />
                            </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Shared Visibility</Label>
                                <MultiSelect options={workspaceOptions} value={editWorkspaceIds} onChange={setEditWorkspaceIds} placeholder="Assign to hubs..." />
                            </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Identity Endpoint</Label>
 <Input value={editIdentifier} onChange={e => setEditIdentifier(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-none font-mono font-semibold shadow-inner" required />
                            </div>
                        </div>
 <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between">
 <Button type="button" variant="ghost" onClick={() => setEditingProfile(null)} disabled={isUpdating} className="rounded-xl font-bold h-12 px-8">Cancel</Button>
 <Button type="submit" disabled={isUpdating || !editName.trim() || editWorkspaceIds.length === 0} className="rounded-xl font-semibold h-12 px-10 shadow-2xl text-xs">
 {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
 <span className="ml-2">Commit Logic</span>
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* mNotify Registration Dialog */}
            <Dialog open={!!registeringProfile} onOpenChange={(o) => !o && setRegisteringProfile(null)}>
 <DialogContent className="sm:max-w-md rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
 <DialogHeader className="p-8 pb-4">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-orange-500 text-white rounded-2xl shadow-xl shadow-orange-200"><Smartphone size={24} /></div>
 <div className="text-left">
 <DialogTitle className="text-xl font-semibold tracking-tight text-orange-950">Provider Enrollment</DialogTitle>
 <DialogDescription className="text-xs font-bold text-orange-700 opacity-70">Registering ID: {registeringProfile?.identifier}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
 <div className="p-8 pt-0 space-y-6 text-left">
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Operational Purpose</Label>
                            <Textarea 
                                value={regPurpose} 
                                onChange={e => setRegPurpose(e.target.value)} 
                                placeholder="Explain how this ID will be used (e.g. Transactional alerts for school parents)..." 
 className="min-h-[120px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 font-medium"
                            />
                        </div>
 <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
 <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
 <p className="text-[9px] font-bold text-blue-800 leading-relaxed tracking-tighter">
                                mNotify IDs typically require 24-48 hours for institutional verification.
                            </p>
                        </div>
                    </div>
 <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between">
 <Button variant="ghost" onClick={() => setRegisteringProfile(null)} disabled={isRegProcessing} className="rounded-xl font-bold h-12 px-8">Discard</Button>
 <Button onClick={handleCompleteRegistration} disabled={isRegProcessing || !regPurpose.trim()} className="rounded-xl font-semibold h-12 px-10 shadow-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs">
 {isRegProcessing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
 <span className="ml-2">Submit Application</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
