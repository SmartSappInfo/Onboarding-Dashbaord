'use client';

import { useMemo } from 'react';
import { collection, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoMemoFirebase as useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { sendMessage } from '@/lib/messaging-engine';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Users } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ONBOARDING_STAGE_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={16} />;

export default function UsersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const usersCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  
  const usersQuery = useMemoFirebase(() => {
    if (!usersCol) return null;
    return query(usersCol, orderBy('createdAt', 'desc'));
  }, [usersCol]);

  const { data: users, isLoading, error } = useCollection<UserProfile>(usersQuery);

  const handleAuthorizationChange = async (user: UserProfile, isAuthorized: boolean) => {
    if (!firestore) return;

    const userDocRef = doc(firestore, 'users', user.id);
    try {
        await updateDoc(userDocRef, { isAuthorized });
        toast({
          title: 'User Updated',
          description: `${user.name} has been ${isAuthorized ? 'authorized' : 'de-authorized'}.`,
        });
    } catch (e) {
        const permissionError = new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'update',
          requestResourceData: { isAuthorized },
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: 'You may not have the required permissions.',
        });
    }
  };
  
  const handleColorChange = async (user: UserProfile, color: string) => {
    if (!firestore) return;
    const userDocRef = doc(firestore, 'users', user.id);
    try {
      await updateDoc(userDocRef, { color });
      toast({
        title: 'Color Updated',
        description: `Theme color updated for ${user.name}.`,
      });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Update Failed' });
    }
  };


  if (error) {
    return <div className="text-destructive p-8 text-left">Error loading users: {error.message}</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Team Access Control</h1>
            <p className="text-muted-foreground font-medium text-sm mt-1">Manage administrative authorization status, profile attributes, and organizational branding.</p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card text-card-foreground shadow-sm overflow-hidden ring-1 ring-black/5">
            <Table>
            <TableHeader className="bg-muted/30">
                <TableRow>
                <TableHead className="w-16 pl-6 text-[10px] font-bold uppercase tracking-widest py-4">Brand</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest py-4">Name</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest py-4">Email Identity</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest py-4">Phone</TableHead>
                <TableHead className="w-[180px] text-[10px] font-bold uppercase tracking-widest py-4">Joined On</TableHead>
                <TableHead className="w-[120px] text-right pr-6 text-[10px] font-bold uppercase tracking-widest py-4">Authorized</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-8 w-8 rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32 rounded" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full rounded" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-3/4 rounded" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full rounded" /></TableCell>
                    <TableCell className="text-right pr-6"><Skeleton className="h-6 w-10 ml-auto rounded-full" /></TableCell>
                    </TableRow>
                ))
                ) : users && users.length > 0 ? (
                users.map((user) => (
                    <TableRow key={user.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="pl-6 py-4">
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button variant="outline" className="w-8 h-8 p-0 border-2 rounded-lg" style={{ borderColor: user.color || '#ccc' }}>
                                <div className="w-full h-full rounded-sm" style={{ backgroundColor: user.color || '#FFFFFF' }} />
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2">
                            <div className="grid grid-cols-6 gap-1 mb-2">
                                {ONBOARDING_STAGE_COLORS.map((color) => (
                                <button
                                    key={color}
                                    className={cn("w-6 h-6 rounded-md border transition-transform hover:scale-110", color === user.color && 'ring-2 ring-ring ring-offset-2 ring-offset-background')}
                                    style={{ backgroundColor: color }}
                                    onClick={() => handleColorChange(user, color)}
                                />
                                ))}
                            </div>
                            <div className="flex items-center gap-2 border-t pt-2 mt-2">
                                <label htmlFor={`color-picker-${user.id}`} className="text-[10px] font-black uppercase tracking-tight">Custom</label>
                                <Input
                                id={`color-picker-${user.id}`}
                                type="color"
                                value={user.color || '#FFFFFF'}
                                onChange={(e) => handleColorChange(user, e.target.value)}
                                className="w-10 h-10 p-1"
                                />
                            </div>
                            </PopoverContent>
                        </Popover>
                    </TableCell>
                    <TableCell className="font-bold">
                        <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
                            <AvatarImage src={user.photoURL} alt={user.name} />
                            <AvatarFallback className="font-bold text-xs">{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-black uppercase tracking-tight">{user.name}</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-xs font-mono">{user.phone || <span className="opacity-20">—</span>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground uppercase tabular-nums">
                        {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                        <Switch
                        checked={user.isAuthorized}
                        onCheckedChange={(checked) => handleAuthorizationChange(user, checked)}
                        aria-label={`Authorize ${user.name}`}
                        />
                    </TableCell>
                    </TableRow>
                ))
                ) : (
                <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">No users found in the repository.</TableCell>
                </TableRow>
                )}
            </TableBody>
            </Table>
        </div>
      </div>
    </div>
  );
}
