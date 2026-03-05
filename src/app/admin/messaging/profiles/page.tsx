'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
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
    Globe
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { checkSenderIdStatusAction, registerSenderIdAction } from '@/lib/mnotify-actions';
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
                identifier: channel === 'sms' ? identifier.trim().toUpperCase() : identifier.trim().toLowerCase(),
                isDefault: (profiles?.length || 0) === 0,
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
                identifier: editingProfile.channel === 'sms' ? editIdentifier.trim().toUpperCase() : editingProfile.channel === 'email' ? editIdentifier.trim().toLowerCase() : editIdentifier,
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
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
            <div className="mb-8 flex items-center justify-end">
                <Button onClick={() => setIsAdding(!isAdding)}>
                    {isAdding ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                    {isAdding ? 'Cancel' : 'Add Profile'}
                </Button>
            </div>

            {isAdding && (
                <Card className="mb-8 border-primary/20 bg-primary/5 animate-in slide-in-from-top-4 duration-300">
                    <CardHeader>
                        <CardTitle>Create New Profile</CardTitle>
                        <CardDescription>Sender IDs are used for SMS, and From addresses for Email.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="space-y-2">
                                <Label>Display Name</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Enrollment Team" required />
                            </div>
                            <div className="space-y-2">
                                <Label>Channel</Label>
                                <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
                                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="sms">SMS (Sender ID)</SelectItem>
                                        <SelectItem value="email">Email (From Addr)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{channel === 'sms' ? 'Sender ID (max 11 chars)' : 'From Email'}</Label>
                                <Input 
                                    value={identifier} 
                                    onChange={e => setIdentifier(e.target.value)} 
                                    placeholder={channel === 'sms' ? 'SMARTSAPP' : 'notifications@enroll.smartsapp.com'} 
                                    required 
                                    maxLength={channel === 'sms' ? 11 : undefined}
                                    className="rounded-xl"
                                />
                            </div>
                            <Button type="submit" disabled={isSubmitting} className="rounded-xl font-bold">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Profile
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest pl-6">Name</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Channel</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Identifier</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Identity Status</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Availability</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell className="pl-6"><Skeleton className="h-4 w-32 rounded" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16 rounded" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-48 rounded" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-12 mx-auto rounded" /></TableCell>
                                    <TableCell className="mx-auto text-center"><Skeleton className="h-6 w-10 mx-auto rounded-full" /></TableCell>
                                    <TableCell className="pr-6"><Skeleton className="h-8 w-16 ml-auto rounded" /></TableCell>
                                </TableRow>
                            ))
                        ) : profiles?.length ? (
                            profiles.map((profile) => (
                                <TableRow key={profile.id} className="group hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-bold pl-6">
                                        <div className="flex items-center gap-2">
                                            {profile.name}
                                            {profile.isDefault && <Badge className="h-4 text-[8px] uppercase tracking-tighter bg-primary/10 text-primary border-none font-black">Default</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tighter">
                                            {profile.channel === 'sms' ? <Smartphone className="h-3 w-3 text-orange-500" /> : <Mail className="h-3 w-3 text-blue-500" />}
                                            {profile.channel}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs uppercase">{profile.identifier}</TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col items-center gap-1.5">
                                            {getStatusBadge(profile)}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleSyncStatus(profile)} 
                                                    disabled={syncingId === profile.id}
                                                    className="text-[9px] font-black uppercase tracking-tighter text-primary flex items-center gap-1 hover:underline"
                                                >
                                                    <RefreshCw className={cn("h-2.5 w-2.5", syncingId === profile.id && "animate-spin")} />
                                                    Sync Gateway
                                                </button>
                                                {profile.channel === 'sms' && (!profile.mNotifyStatus || profile.mNotifyStatus === 'not_registered') && (
                                                    <>
                                                        <span className="text-[9px] text-muted-foreground/30">|</span>
                                                        <button 
                                                            onClick={() => handleStartRegistration(profile)}
                                                            className="text-[9px] font-black uppercase tracking-tighter text-orange-600 flex items-center gap-1 hover:underline"
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
                                    <TableCell className="text-right pr-6">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                                                onClick={() => handleEditClick(profile)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                                                onClick={() => handleDelete(profile.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">No sender profiles configured.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <form onSubmit={handleUpdate}>
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black">Modify Identity</DialogTitle>
                            <DialogDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                Updating profile for &ldquo;{editingProfile?.name}&rdquo;
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6 py-6 border-y my-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Label</Label>
                                <Input 
                                    value={editName} 
                                    onChange={e => setEditName(e.target.value)} 
                                    placeholder="e.g. Alerts Channel" 
                                    className="h-11 rounded-xl bg-muted/20 border-none font-bold"
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                    {editingProfile?.channel === 'sms' ? 'Sender ID' : 'Verified Address'}
                                </Label>
                                <Input 
                                    value={editIdentifier} 
                                    onChange={e => setEditIdentifier(editingProfile?.channel === 'sms' ? e.target.value.toUpperCase() : e.target.value.toLowerCase())} 
                                    className="h-11 rounded-xl bg-muted/20 border-none font-mono font-bold"
                                    required 
                                    maxLength={editingProfile?.channel === 'sms' ? 11 : undefined}
                                />
                            </div>
                        </div>
                        <DialogFooter className="gap-2">
                            <Button type="button" variant="ghost" onClick={() => setEditingProfile(null)} className="font-bold">Cancel</Button>
                            <Button type="submit" disabled={isUpdating} className="rounded-xl font-bold px-8 shadow-lg">
                                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Commit Update
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Registration Dialog */}
            <Dialog open={!!registeringProfile} onOpenChange={(open) => !open && setRegisteringProfile(null)}>
                <DialogContent className="sm:max-w-md rounded-[2rem] overflow-hidden p-0 border-none">
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
                        <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 space-y-1">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Requested Alphanumeric ID</Label>
                            <p className="text-3xl font-black text-foreground tracking-tighter uppercase">{registeringProfile?.identifier}</p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Business Justification</Label>
                            <Textarea 
                                value={regPurpose} 
                                onChange={e => setRegPurpose(e.target.value)}
                                placeholder="Explain how you will use this ID (e.g., automated enrollment confirmations and school event reminders for SmartSapp parents)"
                                className="min-h-[120px] rounded-2xl bg-muted/20 border-none shadow-inner p-4 leading-relaxed"
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
                    <DialogFooter className="bg-muted/30 p-6 flex justify-between items-center sm:justify-between">
                        <Button variant="ghost" onClick={() => setRegisteringProfile(null)} disabled={isRegProcessing} className="font-bold">Cancel</Button>
                        <Button 
                            onClick={handleCompleteRegistration} 
                            disabled={isRegProcessing || !regPurpose.trim()}
                            className="rounded-2xl font-black h-12 px-10 shadow-2xl bg-primary text-white hover:bg-primary/90 transition-all active:scale-95 uppercase tracking-widest text-xs"
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
