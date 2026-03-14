
'use client';

import * as React from 'react';
import { collection, orderBy, query, doc, updateDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { UserProfile, Role, AppPermissionId } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User as UserIcon, ShieldCheck, Zap, Info, Loader2, Target, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { MultiSelect } from '@/components/ui/multi-select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={16} />;

/**
 * @fileOverview Institutional Identity Hub.
 * Features permission flattening logic and role-based access management.
 */
export default function UsersClient() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  // 1. DATA SUBSCRIPTIONS
  const usersQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'users'), orderBy('createdAt', 'desc')) : null, 
  [firestore]);

  const rolesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'roles'), orderBy('name', 'asc')) : null, 
  [firestore]);

  const { data: users, isLoading: isLoadingUsers, error } = useCollection<UserProfile>(usersQuery);
  const { data: roles, isLoading: isLoadingRoles } = useCollection<Role>(rolesQuery);

  const isLoading = isLoadingUsers || isLoadingRoles;

  // 2. PERMISSION FLATTENING ENGINE
  const handleUpdateUser = async (userId: string, updates: Partial<UserProfile>) => {
    if (!firestore || !roles) return;
    setUpdatingId(userId);

    const userDocRef = doc(firestore, 'users', userId);
    
    // If roles changed, we need to flatten the associated permissions
    if (updates.roles) {
        const selectedRoleObjects = roles.filter(r => updates.roles!.includes(r.id));
        const allPerms = new Set<AppPermissionId>();
        selectedRoleObjects.forEach(r => {
            if (r.permissions) r.permissions.forEach(p => allPerms.add(p));
        });
        updates.permissions = Array.from(allPerms);
    }

    try {
        await updateDoc(userDocRef, { ...updates, updatedAt: new Date().toISOString() });
        toast({ title: 'Access Synchronized', description: 'Institutional permissions have been updated.' });
    } catch (e) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'update',
          requestResourceData: updates,
        }));
        toast({ variant: 'destructive', title: 'Update Failed' });
    } finally {
        setUpdatingId(null);
    }
  };

  if (error) return <div className="text-destructive p-8 text-left">Error loading registry: {error.message}</div>;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
      <div className="max-w-7xl mx-auto space-y-10 pb-32">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
                <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-foreground uppercase">
                    <ShieldCheck className="h-10 w-10 text-primary" />
                    Identity Hub
                </h1>
                <p className="text-muted-foreground font-medium text-lg mt-1">Manage institutional access levels and flattened permission sets.</p>
            </div>
            <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black px-4 h-8 uppercase tracking-widest">
                    {users?.length || 0} Registered Members
                </Badge>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Permission Matrix Preview */}
            <div className="lg:col-span-1 space-y-6">
                <Card className="rounded-[2rem] border-none ring-1 ring-border bg-white overflow-hidden shadow-sm">
                    <CardHeader className="bg-primary/5 border-b pb-4">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Zap className="h-3 w-3" /> Collective Logic
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {isLoadingRoles ? (
                            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)
                        ) : roles?.map(r => (
                            <div key={r.id} className="space-y-1.5 group cursor-help text-left">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: r.color }} />
                                    <span className="text-xs font-black uppercase tracking-tight">{r.name}</span>
                                </div>
                                <p className="text-[9px] text-muted-foreground font-medium leading-relaxed pl-4 line-clamp-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                    {r.description}
                                </p>
                            </div>
                        ))}
                        <Separator className="opacity-50" />
                        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3 shadow-inner">
                            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-blue-900 uppercase">Additive Access</p>
                                <p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase tracking-tighter text-left">
                                    Permissions are flattened across all assigned roles. Users gain the union of all capabilities.
                                </p>
                            </div>
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
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-5">Architecture</TableHead>
                                <TableHead className="w-[120px] text-center text-[10px] font-black uppercase tracking-widest py-5">Access</TableHead>
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
                                            <div className="flex flex-col text-left">
                                                <span className="font-black text-sm uppercase tracking-tight text-foreground">{user.name}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 tabular-nums mt-0.5">{user.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="min-w-[250px]">
                                            <div className="flex flex-col gap-2">
                                                <MultiSelect 
                                                    options={roles?.map(r => ({ label: r.name, value: r.id })) || []}
                                                    value={user.roles || []}
                                                    onChange={(vals) => handleUpdateUser(user.id, { roles: vals })}
                                                    placeholder="Assign Role Architecture..."
                                                    className="border-none bg-muted/20 hover:bg-muted/40 shadow-none rounded-xl"
                                                />
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex flex-wrap gap-1 px-1">
                                                                {user.permissions?.slice(0, 3).map(p => (
                                                                    <Badge key={p} variant="ghost" className="h-4 text-[7px] font-black uppercase tracking-tighter bg-primary/5 text-primary">
                                                                        {p.replace('_', ' ')}
                                                                    </Badge>
                                                                ))}
                                                                {(user.permissions?.length || 0) > 3 && (
                                                                    <Badge variant="ghost" className="h-4 text-[7px] font-black uppercase bg-muted text-muted-foreground">
                                                                        +{(user.permissions?.length || 0) - 3} more
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs p-3 rounded-xl border-none shadow-2xl">
                                                            <div className="space-y-2">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-primary border-b pb-1.5">Flattened Matrix</p>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {user.permissions?.map(p => (
                                                                        <Badge key={p} className="text-[8px] font-bold uppercase tracking-tight h-5">
                                                                            {p.replace('_', ' ')}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={user.isAuthorized}
                                                onCheckedChange={(checked) => handleUpdateUser(user.id, { isAuthorized: checked })}
                                                className="mx-auto scale-90"
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
