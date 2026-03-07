'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
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
    ArrowLeft,
    RefreshCw,
    Sparkles,
    ShieldCheck,
    Clock,
    AlertCircle,
    Info,
    Send,
    Globe,
    MoreVertical,
    Star
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { checkSenderIdStatusStatusAction, registerSenderIdAction } from '@/lib/mnotify-actions';
import { fetchVerifiedDomainsAction } from '@/lib/resend-actions';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function SenderProfilesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAdding, setIsAdding] = React.useState(false);
    
    // Add Form State
    const [name, setName] = React.useState('');
    const [channel, setChannel] = React.useState<'sms' | 'email'>('sms');
    const [identifier, setIdentifier] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Edit State
    const [editingProfile, setEditingProfile] = React.useState<SenderProfile | null>(null);
    const [editName, setEditName] = React.useState('');
    const [editIdentifier, setEditIdentifier] = React.useState('');
    const [isUpdating, setIsUpdating] = React.useState(false);

    // Provider Sync State
    const [syncingId, setSyncingId] = React.useState<string | null>(null);
    const [registeringProfile, setRegisteringProfile] = React.useState<SenderProfile | null>(null);
    const [regPurpose, setRegPurpose] = React.useState('');
    const [isRegProcessing, setIsRegProcessing] = React.useState(false);

    const profilesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'sender_profiles'), orderBy('createdAt', 'desc'));
    }, [firestore]);

    const { data: profiles, isLoading } = useCollection<SenderProfile>(profilesQuery);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !name || !identifier) return;
        
        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'sender_profiles'), {
                name: name.trim(),
                channel,
                identifier: identifier.trim(),
                isDefault: (profiles?.filter(p => p.channel === channel).length || 0) === 0,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            setName('');
            setIdentifier('');
            setIsAdding(false);
            toast({ title: 'Profile Added', description: 'Sender profile is now available for messaging.' });
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
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !editingProfile || !editName || !editIdentifier) return;

        setIsUpdating(true);
        try {
            const docRef = doc(firestore, 'sender_profiles', editingProfile.id);
            await updateDoc(docRef, {
                name: editName.trim(),
                identifier: editIdentifier.trim(),
                updatedAt: new Date().toISOString(),
            });
            setEditingProfile(null);
            toast({ title: 'Profile Updated', description: 'Changes have been saved successfully.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not save profile changes.' });
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
                title: 'Default Updated', 
                description: `"${profile.name}" is now the primary gateway for ${profile.channel.toUpperCase()}.` 
            });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update default profile.' });
        }
    };

    const handleSyncStatus = async (profile: SenderProfile) => {
        if (!firestore) return;
        setSyncingId(profile.id);
        
        try {
            if (profile.channel === 'sms') {
                const result = await checkSenderIdStatusStatusAction(profile.identifier);
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
                // Resend Domain Verification
                const result = await fetchVerifiedDomainsAction();
                if (result.success) {
                    const domainPart = profile.identifier.split('@')[1];
                    const domainMatch = result.domains.find((d: any) => d.name === domainPart);
                    
                    const status = domainMatch?.status || 'not_registered';
                    await updateDoc(doc(firestore, 'sender_profiles', profile.id), {
                        resendStatus: status,
                        updatedAt: new Date().toISOString()
                    });
                    toast({ title: 'Resend Sync Complete', description: `Domain status: ${status}` });
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
                toast({ title: 'Registration Submitted', description: result.message });
                await handleSyncStatus(registeringProfile);
                setRegisteringProfile(null);
            } else {
                throw new Error(result.error);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Registration Failed', description: e.message });
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
        if (!firestore || !confirm('Are you sure you want to delete this sender profile? This action cannot be undone.')) return;
        await deleteDoc(doc(firestore, 'sender_profiles', id));
        toast({ title: 'Profile Deleted' });
    };

    const getStatusBadge = (profile: any) => {
        const status = profile.channel === 'sms' ? (profile.mNotifyStatus || 'unknown') : (profile.resendStatus || 'unknown');
        
        switch (status) {
            case 'approved':
            case 'verified':
                return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none text-[8px] h-5 gap-1 uppercase tracking-tighter"><ShieldCheck className="h-2.5 w-2.5" /> {profile.channel === 'sms' ? 'Approved' : 'Verified'}</Badge>;
            case 'pending':
                return <Badge variant="secondary" className="text-[8px] h-5 gap-1 uppercase tracking-tighter border-orange-200 text-orange-700 bg-orange-50"><Clock className="h-2.5 w-2.5" /> Pending</Badge>;
            case 'not_registered':
                return <Badge variant="outline" className="text-[8px] h-5 gap-1 uppercase tracking-tighter border-dashed"><Globe className="h-2.5 w-2.5" /> Unverified</Badge>;
            default:
                return <Badge variant="ghost" className="text-[8px] h-5 uppercase tracking-tighter opacity-40">Unsynced</Badge>;
        }
    }

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="mb-8 flex items-center justify-end flex-wrap gap-4">
                <Button onClick={() => setIsAdding(!isAdding)} className="rounded-xl font-black uppercase tracking-widest shadow-lg h-11 px-8">
                    {isAdding ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                    {isAdding ? 'Cancel' : 'Add Profile'}
                </Button>
            </div>

            {isAdding && (
                <Card className="mb-8 border-primary/20 bg-primary/5 animate-in slide-in-from-top-4 duration-300 rounded-[2rem] overflow-hidden shadow-xl">
                    <CardHeader className="bg-primary/5 border-b border-primary/10">
                        <CardTitle className="text-xl font-black uppercase tracking-tight">Create Identity Blueprint</CardTitle>
                        <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Configure sender credentials for SMS or Email channels.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Friendly Label</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Enrollment Team" className="h-12 rounded-xl bg-white border-none shadow-inner font-bold" required />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Channel Medium</Label>
                                <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
                                    <SelectTrigger className="h-12 rounded-xl bg-white border-none shadow-inner font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="sms">SMS (Sender ID)</SelectItem>
                                        <SelectItem value="email">Email (From Addr)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{channel === 'sms' ? 'Alphanumeric ID' : 'Verified Address'}</Label>
                                <Input 
                                    value={identifier} 
                                    onChange={e => setIdentifier(e.target.value)} 
                                    placeholder={channel === 'sms' ? 'SMARTSAPP' : 'notifications@enroll.smartsapp.com'} 
                                    required 
                                    maxLength={channel === 'sms' ? 11 : undefined}
                                    className="h-12 rounded-xl bg-white border-none shadow-inner font-mono font-bold"
                                />
                            </div>
                            <Button type="submit" disabled={isSubmitting} className="h-12 rounded-xl font-black shadow-2xl uppercase tracking-widest">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                Commit Identity
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="rounded-[2rem] border border-border/50 bg-card shadow-sm overflow-hidden ring-1 ring-black/5">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest pl-8 py-5">Corporate Identity</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Channel</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Identifier</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Status</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Active</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-8">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell className="pl-8"><Skeleton className="h-4 w-32 rounded" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16 rounded" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-48 rounded" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-12 mx-auto rounded" /></TableCell>
                                    <TableCell className="mx-auto text-center"><Skeleton className="h-6 w-10 mx-auto rounded-full" /></TableCell>
                                    <TableCell className="pr-8"><Skeleton className="h-8 w-16 ml-auto rounded" /></TableCell>
                                </TableRow>
                            ))
                        ) : profiles?.length ? (
                            profiles.map((profile) => (
                                <TableRow key={profile.id} className="group hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-bold pl-8 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-foreground uppercase tracking-tight">{profile.name}</span>
                                            {profile.isDefault && <Badge className="h-5 text-[8px] uppercase tracking-widest bg-primary text-white border-none font-black shadow-lg shadow-primary/20">Default</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                            {profile.channel === 'sms' ? <Smartphone className="h-3.5 w-3.5 text-orange-500" /> : <Mail className="h-3.5 w-3.5 text-blue-500" />}
                                            {profile.channel}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground font-bold">{profile.identifier}</TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col items-center gap-1.5">
                                            {getStatusBadge(profile)}
                                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleSyncStatus(profile)} 
                                                    disabled={syncingId === profile.id}
                                                    className="text-[8px] font-black uppercase tracking-widest text-primary flex items-center gap-1 hover:underline"
                                                >
                                                    <RefreshCw className={cn("h-2.5 w-2.5", syncingId === profile.id && "animate-spin")} />
                                                    Sync
                                                </button>
                                                {profile.channel === 'sms' && (!profile.mNotifyStatus || profile.mNotifyStatus === 'not_registered') && (
                                                    <>
                                                        <span className="text-[8px] text-muted-foreground/30">|</span>
                                                        <button 
                                                            onClick={() => handleStartRegistration(profile)}
                                                            className="text-[8px] font-black uppercase tracking-widest text-orange-600 flex items-center gap-1 hover:underline"
                                                        >
                                                            <Sparkles className="h-2.5 w-2.5" />
                                                            Apply
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
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
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-primary/5">
                                                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-2xl">
                                                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">Profile Actions</DropdownMenuLabel>
                                                
                                                <DropdownMenuItem onClick={() => handleEditClick(profile)} className="rounded-xl p-2.5 gap-3">
                                                    <div className="p-1.5 bg-primary/10 rounded-lg text-primary"><Pencil className="h-3.5 w-3.5" /></div>
                                                    <span className="font-bold text-sm">Edit Blueprint</span>
                                                </DropdownMenuItem>

                                                {!profile.isDefault && (
                                                    <DropdownMenuItem onClick={() => handleSetDefault(profile)} className="rounded-xl p-2.5 gap-3">
                                                        <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600"><Star className="h-3.5 w-3.5" /></div>
                                                        <span className="font-bold text-sm">Set as Channel Default</span>
                                                    </DropdownMenuItem>
                                                )}

                                                <DropdownMenuSeparator className="my-2" />
                                                
                                                <DropdownMenuItem 
                                                    onClick={() => handleDelete(profile.id)} 
                                                    className="rounded-xl p-2.5 gap-3 text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                >
                                                    <div className="p-1.5 bg-destructive/10 rounded-lg"><Trash2 className="h-3.5 w-3.5" /></div>
                                                    <span className="font-bold text-sm">Remove Identity</span>
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
                                        <p className="text-xs font-black uppercase tracking-widest">Registry Empty</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
                <DialogContent className="sm:max-w-md rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
                    <form onSubmit={handleUpdate}>
                        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                            <div className="flex items-center gap-4 mb-1">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                    <Pencil className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black tracking-tight uppercase">Edit Blueprint</DialogTitle>
                                    <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Updating institutional identity protocol</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="p-8 space-y-8">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Friendly Label</Label>
                                <Input 
                                    value={editName} 
                                    onChange={e => setEditName(e.target.value)} 
                                    placeholder="e.g. Alerts Channel" 
                                    className="h-12 rounded-xl bg-muted/20 border-none font-bold shadow-inner"
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                    {editingProfile?.channel === 'sms' ? 'Provider Alphanumeric ID' : 'Verified Endpoint Address'}
                                </Label>
                                <Input 
                                    value={editIdentifier} 
                                    onChange={e => setEditIdentifier(e.target.value)} 
                                    className="h-12 rounded-xl bg-muted/20 border-none font-mono font-bold shadow-inner"
                                    required 
                                    maxLength={editingProfile?.channel === 'sms' ? 11 : undefined}
                                />
                            </div>
                        </div>
                        <DialogFooter className="bg-muted/30 p-6 flex justify-between gap-3 sm:justify-between border-t">
                            <Button type="button" variant="ghost" onClick={() => setEditingProfile(null)} className="font-bold rounded-xl px-8 h-12">Cancel</Button>
                            <Button type="submit" disabled={isUpdating} className="rounded-xl font-black px-12 shadow-2xl h-12 uppercase tracking-widest text-sm">
                                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Commit Change
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Registration Dialog */}
            <Dialog open={!!registeringProfile} onOpenChange={(open) => !open && setRegisteringProfile(null)}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl">
                    <DialogHeader className="p-8 pb-0">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-orange-500 text-white rounded-2xl shadow-xl shadow-orange-200">
                                <Smartphone className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black tracking-tight uppercase">Apply for ID</DialogTitle>
                                <DialogDescription className="text-xs font-bold text-orange-600 uppercase tracking-widest">Formal registration with mNotify</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="p-8 space-y-8">
                        <div className="p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 space-y-1 shadow-inner">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Requested Alphanumeric ID</Label>
                            <p className="text-4xl font-black text-foreground tracking-tighter">{registeringProfile?.identifier}</p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Business Justification</Label>
                            <Textarea 
                                value={regPurpose} 
                                onChange={e => setRegPurpose(e.target.value)}
                                placeholder="Explain how you will use this ID (e.g., automated enrollment confirmations and school event reminders for SmartSapp parents)"
                                className="min-h-[140px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 leading-relaxed"
                            />
                        </div>
                        <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-4">
                            <Info className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-black text-blue-800 uppercase tracking-tighter">Network Policy Note</p>
                                <p className="text-[10px] text-blue-700 leading-relaxed font-bold uppercase tracking-widest opacity-80">
                                    mNotify manually reviews all IDs within 24-48 business hours. You must maintain this ID for authorized school use only.
                                </p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="bg-muted/30 p-6 border-t flex justify-between items-center sm:justify-between">
                        <Button variant="ghost" onClick={() => setRegisteringProfile(null)} disabled={isRegProcessing} className="font-bold rounded-xl h-12 px-8">Cancel</Button>
                        <Button 
                            onClick={handleCompleteRegistration} 
                            disabled={isRegProcessing || !regPurpose.trim()}
                            className="rounded-xl font-black h-12 px-10 shadow-2xl bg-primary text-white hover:bg-primary/90 transition-all active:scale-95 uppercase tracking-widest text-xs"
                        >
                            {isRegProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Submit Application
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
