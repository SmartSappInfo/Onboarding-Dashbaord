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
    Fingerprint, 
    Plus, 
    Trash2, 
    Mail, 
    Smartphone, 
    Check, 
    X,
    Loader2,
    ArrowLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function SenderProfilesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAdding, setIsAdding] = React.useState(false);
    
    // Form State
    const [name, setName] = React.useState('');
    const [channel, setChannel] = React.useState<'sms' | 'email'>('sms');
    const [identifier, setIdentifier] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

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

    const toggleActive = async (profile: SenderProfile) => {
        if (!firestore) return;
        const docRef = doc(firestore, 'sender_profiles', profile.id);
        await updateDoc(docRef, { isActive: !profile.isActive, updatedAt: new Date().toISOString() });
    };

    const handleDelete = async (id: string) => {
        if (!firestore || !confirm('Are you sure?')) return;
        await deleteDoc(doc(firestore, 'sender_profiles', id));
        toast({ title: 'Profile Deleted' });
    };

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
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Name</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Channel</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Identifier</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Status</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-48 bg-muted animate-pulse rounded" /></TableCell>
                                    <TableCell><div className="h-4 w-12 bg-muted animate-pulse mx-auto rounded" /></TableCell>
                                    <TableCell><div className="h-8 w-8 bg-muted animate-pulse ml-auto rounded" /></TableCell>
                                </TableRow>
                            ))
                        ) : profiles?.length ? (
                            profiles.map((profile) => (
                                <TableRow key={profile.id} className="group hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-bold">
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
                                    <TableCell className="font-mono text-xs">{profile.identifier}</TableCell>
                                    <TableCell className="text-center">
                                        <Switch 
                                            checked={profile.isActive} 
                                            onCheckedChange={() => toggleActive(profile)}
                                            className="scale-75 mx-auto"
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDelete(profile.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No sender profiles configured.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
