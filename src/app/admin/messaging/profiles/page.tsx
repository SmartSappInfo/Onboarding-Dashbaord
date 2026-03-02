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
    Send
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { checkSenderIdStatusAction, registerSenderIdAction } from '@/lib/mnotify-actions';
import { Textarea } from '@/components/ui/textarea';

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

    // mNotify Logic State
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
                identifier: identifier.trim().toUpperCase(),
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
                identifier: editIdentifier.trim().toUpperCase(),
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
        if (profile.channel !== 'sms' || !firestore) return;
        setSyncingId(profile.id);
        
        try {
            const result = await checkSenderIdStatusAction(profile.identifier);
            if (result.success) {
                // Determine a normalized status string based on mNotify response
                // Logic based on mNotify docs where Success code means approved or it gives text feedback
                const normalizedStatus = result.message?.toLowerCase().includes('approved') ? 'approved' : 
                                       result.message?.toLowerCase().includes('pending') ? 'pending' : 
                                       'not_registered';

                await updateDoc(doc(firestore, 'sender_profiles', profile.id), {
                    mNotifyStatus: normalizedStatus,
                    mNotifyMessage: result.message,
                    updatedAt: new Date().toISOString()
                });
                toast({ title: 'Status Synchronized', description: result.message });
            } else {
                throw new Error(result.error);
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
        if (profile.channel !== 'sms') return null;
        
        const status = profile.mNotifyStatus || 'unknown';
        
        switch (status) {
            case 'approved': return <Badge className="bg-green-500 hover:bg-green-600 text-white border-none text-[8px] h-5 gap-1 uppercase tracking-tighter"><ShieldCheck className="h-2.5 w-2.5" /> Approved</Badge>;
            case 'pending': return <Badge variant="secondary" className="text-[8px] h-5 gap-1 uppercase tracking-tighter border-orange-200 text-orange-700 bg-orange-50"><Clock className="h-2.5 w-2.5" /> Pending</Badge>;
            case 'not_registered': return <Badge variant="outline" className="text-[8px] h-5 gap-1 uppercase tracking-tighter border-dashed"><X className="h-2.5 w-2.5" /> Not Registered</Badge>;
            default: return <Badge variant="ghost" className="text-[8px] h-5 uppercase tracking-tighter opacity-40">Unsynced</Badge>;
        }
    }

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <Button asChild variant="ghost" className="-ml-2 mb-2">
                        <Link href="/admin/messaging">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Engine
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <Fingerprint className="h-8 w-8 text-primary" />
                        Sender Profiles
                    </h1>
                    <p className="text-muted-foreground">Define your organization&apos;s authorized sending identities.</p>
                </div>
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
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alerts Channel" required />
                            </div>
                            <div className="space-y-2">
                                <Label>Channel</Label>
                                <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
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
                                    placeholder={channel === 'sms' ? 'SMARTSAPP' : 'notifications@smartsapp.com'} 
                                    required 
                                    maxLength={channel === 'sms' ? 11 : undefined}
                                />
                            </div>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Profile
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest pl-6">Name</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Channel</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Identifier</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Status</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Active</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell className="pl-6"><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-48 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-12 bg-muted animate-pulse mx-auto rounded" /></TableCell>
                                    <TableCell className="pr-6"><div className="h-8 w-16 bg-muted animate-pulse ml-auto rounded" /></TableCell>
                                </TableRow>
                            ))
                        ) : profiles?.length ? (
                            profiles.map((profile) => (
                                <TableRow key={profile.id} className="group hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-bold pl-6">
                                        <div className="flex items-center gap-2">
                                            {profile.name}
                                            {profile.isDefault && <Badge className="h-4 text-[8px] uppercase tracking-tighter">Default</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-tighter">
                                            {profile.channel === 'sms' ? <Smartphone className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                                            {profile.channel}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs uppercase">{profile.identifier}</TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col items-center gap-1.5">
                                            {getStatusBadge(profile)}
                                            {profile.channel === 'sms' && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => handleSyncStatus(profile)} 
                                                        disabled={syncingId === profile.id}
                                                        className="text-[9px] font-bold text-primary flex items-center gap-1 hover:underline"
                                                    >
                                                        <RefreshCw className={cn("h-2.5 w-2.5", syncingId === profile.id && "animate-spin")} />
                                                        Sync
                                                    </button>
                                                    {(!profile.mNotifyStatus || profile.mNotifyStatus === 'not_registered') && (
                                                        <>
                                                            <span className="text-[9px] text-muted-foreground/30">|</span>
                                                            <button 
                                                                onClick={() => handleStartRegistration(profile)}
                                                                className="text-[9px] font-bold text-orange-600 flex items-center gap-1 hover:underline"
                                                            >
                                                                <Sparkles className="h-2.5 w-2.5" />
                                                                Register
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
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
                                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleEditClick(profile)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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
                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">No sender profiles configured.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
                <DialogContent className="sm:max-w-md">
                    <form onSubmit={handleUpdate}>
                        <DialogHeader>
                            <DialogTitle>Edit Sender Profile</DialogTitle>
                            <DialogDescription>
                                Modify details for {editingProfile?.name}. Note that the channel cannot be changed once a profile is created.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Display Name</Label>
                                <Input 
                                    id="edit-name"
                                    value={editName} 
                                    onChange={e => setEditName(e.target.value)} 
                                    placeholder="e.g. Alerts Channel" 
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-identifier">
                                    {editingProfile?.channel === 'sms' ? 'Sender ID (max 11 chars)' : 'From Email'}
                                </Label>
                                <Input 
                                    id="edit-identifier"
                                    value={editIdentifier} 
                                    onChange={e => setEditIdentifier(e.target.value.toUpperCase())} 
                                    placeholder={editingProfile?.channel === 'sms' ? 'SMARTSAPP' : 'notifications@smartsapp.com'} 
                                    required 
                                    maxLength={editingProfile?.channel === 'sms' ? 11 : undefined}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setEditingProfile(null)}>Cancel</Button>
                            <Button type="submit" disabled={isUpdating}>
                                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Registration Dialog */}
            <Dialog open={!!registeringProfile} onOpenChange={(open) => !open && setRegisteringProfile(null)}>
                <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden">
                    <DialogHeader className="p-6 pb-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                                <Smartphone className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black">Register Sender ID</DialogTitle>
                                <DialogDescription>Register &ldquo;{registeringProfile?.identifier}&rdquo; with mNotify.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="p-6 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Purpose of ID</Label>
                            <Textarea 
                                value={regPurpose} 
                                onChange={e => setRegPurpose(e.target.value)}
                                placeholder="Explain how you will use this ID (e.g., for school announcements and notifications)"
                                className="min-h-[100px] rounded-xl bg-muted/20 border-none"
                            />
                        </div>
                        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                            <Info className="h-5 w-5 text-blue-600 shrink-0" />
                            <p className="text-[10px] font-bold text-blue-800 leading-relaxed uppercase tracking-tighter">
                                mNotify usually reviews Sender ID requests within 24-48 business hours. 
                                You will be able to sync the status once processed.
                            </p>
                        </div>
                    </div>
                    <DialogFooter className="bg-muted/30 p-4">
                        <Button variant="ghost" onClick={() => setRegisteringProfile(null)} disabled={isRegProcessing}>Cancel</Button>
                        <Button 
                            onClick={handleCompleteRegistration} 
                            disabled={isRegProcessing || !regPurpose.trim()}
                            className="rounded-xl font-bold px-8 shadow-lg"
                        >
                            {isRegProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Submit for Approval
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
