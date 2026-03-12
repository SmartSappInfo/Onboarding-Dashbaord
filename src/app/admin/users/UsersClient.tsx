'use client';

import * as React from 'react';
import { collection, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { UserProfile, UserRole } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User as UserIcon, ShieldCheck, Zap, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { MultiSelect } from '@/components/ui/multi-select';

const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={16} />;

const ROLE_OPTIONS: { value: UserRole; label: string; description: string; color: string }[] = [
    { value: 'admin', label: 'Administrator', description: 'Full system control and user management.', color: 'bg-rose-500' },
    { value: 'finance', label: 'Finance', description: 'Billing, invoicing, and legal agreements.', color: 'bg-emerald-500' },
    { value: 'supervisor', label: 'Supervisor', description: 'Regional oversight and design studios.', color: 'bg-blue-500' },
    { value: 'trainer', label: 'Trainer', description: 'Training workshops and meeting coordination.', color: 'bg-indigo-500' },
    { value: 'cse', label: 'CSE', description: 'Institutional operations and task execution.', color: 'bg-slate-500' },
];

export default function UsersClient() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const usersCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  
  const usersQuery = useMemoFirebase(() => {
    if (!usersCol) return null;
    return query(usersCol, orderBy('createdAt', 'desc'));
  }, [usersCol]);

  const { data: users, isLoading, error } = useCollection<UserProfile>(usersQuery);

  const handleUpdateUser = async (userId: string, updates: Partial<UserProfile>) => {
    if (!firestore) return;
    setUpdatingId(userId);

    const userDocRef = doc(firestore, 'users', userId);
    try {
        await updateDoc(userDocRef, { ...updates, updatedAt: new Date().toISOString() });
        toast({ title: 'Access Updated', description: 'User permissions synchronized.' });
    } catch (e) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'update',
          requestResourceData: updates,
        }));
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Unauthorized operation.' });
    } finally {
        setUpdatingId(null);
    }
  };

  if (error) return <div className="text-destructive p-8 text-left">Error loading registry: {error.message}</div>;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
      <div className="max-w-7xl mx-auto space-y-10">
        
        <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-foreground uppercase">
                <ShieldCheck className="h-10 w-10 text-primary" />
                Identity Command
            </h1>
            <p className="text-muted-foreground font-medium text-lg mt-1">Manage institutional roles and cumulative permission sets.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Permission Legend */}
            <div className="lg:col-span-1 space-y-6">
                <Card className="rounded-[2rem] border-none ring-1 ring-border bg-white overflow-hidden shadow-sm">
                    <CardHeader className="bg-primary/5 border-b pb-4">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Zap className="h-3 w-3" /> Permission Matrix
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {ROLE_OPTIONS.map(r => (
                            <div key={r.value} className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", r.color)} />
                                    <span className="text-xs font-black uppercase tracking-tight">{r.label}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-medium leading-relaxed pl-4">{r.description}</p>
                            </div>
                        ))}
                        <Separator className="opacity-50" />
                        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3 shadow-inner">
                            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase tracking-tighter">
                                Permissions are additive. Assigning multiple roles grants the combined access of all selections.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* User Registry */}
            <div className="lg:col-span-3">
                <div className="rounded-[2rem] border border-border/50 bg-card shadow-sm overflow-hidden ring-1 ring-black/5">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="w-16 pl-8 text-[10px] font-black uppercase tracking-widest py-5">Profile</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-5">Corporate Identity</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-5">Assigned Roles</TableHead>
                                <TableHead className="w-[120px] text-center text-[10px] font-black uppercase tracking-widest py-5">Authorized</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="pl-8"><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-48 rounded" /></TableCell>
                                        <TableCell><Skeleton className="h-9 w-48 rounded-xl" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-6 w-10 mx-auto rounded-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : users?.length ? (
                                users.map((user) => (
                                    <TableRow key={user.id} className={cn("group hover:bg-muted/30 transition-colors", updatingId === user.id && "opacity-50")}>
                                        <TableCell className="pl-8 py-6">
                                            <div className="relative">
                                                <Avatar className="h-11 w-11 ring-4 ring-white shadow-xl">
                                                    <AvatarImage src={user.photoURL} alt={user.name} />
                                                    <AvatarFallback className="font-black text-xs">{getInitials(user.name)}</AvatarFallback>
                                                </Avatar>
                                                {updatingId === user.id && (
                                                    <div className="absolute inset-0 bg-white/60 rounded-full flex items-center justify-center">
                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-black text-sm uppercase tracking-tight text-foreground">{user.name}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 tabular-nums mt-0.5">{user.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="min-w-[250px]">
                                            <MultiSelect 
                                                options={ROLE_OPTIONS.map(r => ({ label: r.label, value: r.value }))}
                                                value={user.roles || (user.role ? [user.role] : ['cse'])}
                                                onChange={(vals) => handleUpdateUser(user.id, { roles: vals as UserRole[] })}
                                                placeholder="Assign Roles..."
                                                className="border-none bg-muted/20 hover:bg-muted/40 shadow-none rounded-xl"
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={user.isAuthorized}
                                                onCheckedChange={(checked) => handleUpdateUser(user.id, { isAuthorized: checked })}
                                                className="mx-auto"
                                                disabled={updatingId === user.id}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                                            <UserIcon className="h-12 w-12" />
                                            <p className="text-xs font-black uppercase tracking-widest">No identities found</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}