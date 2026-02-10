

'use client';

import { useMemo } from 'react';
import { collection, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { UserProfile } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon } from 'lucide-react';
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

  const handleAuthorizationChange = (user: UserProfile, isAuthorized: boolean) => {
    if (!firestore) return;

    const userDocRef = doc(firestore, 'users', user.id);
    updateDoc(userDocRef, { isAuthorized })
      .then(() => {
        toast({
          title: 'User Updated',
          description: `${user.name} has been ${isAuthorized ? 'authorized' : 'de-authorized'}.`,
        });
      })
      .catch((e) => {
        const permissionError = new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'update',
          requestResourceData: { isAuthorized },
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: 'You may not have the required permissions to change authorization status.',
        });
      });
  };
  
  const handleColorChange = async (user: UserProfile, color: string) => {
    if (!firestore) return;
    const userDocRef = doc(firestore, 'users', user.id);
    try {
      await updateDoc(userDocRef, { color });
      toast({
        title: 'Color Updated',
        description: `Color updated for ${user.name}.`,
      });
    } catch (e) {
      const permissionError = new FirestorePermissionError({
        path: userDocRef.path,
        operation: 'update',
        requestResourceData: { color },
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Failed to update user color.',
      });
    }
  };


  if (error) {
    return <div className="text-destructive">Error loading users: {error.message}</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Color</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="w-[180px]">Created At</TableHead>
              <TableHead className="w-[120px] text-right">Authorized</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-5 w-32" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-6 w-10 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : users && users.length > 0 ? (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-8 h-8 p-0 border-2" style={{ borderColor: user.color || '#ccc' }}>
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
                            <label htmlFor={`color-picker-${user.id}`} className="text-sm font-medium">Custom</label>
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
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                       <Avatar>
                        <AvatarImage src={user.photoURL} alt={user.name} />
                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      <span>{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone || 'N/A'}</TableCell>
                  <TableCell>
                    {user.createdAt ? format(new Date(user.createdAt), "PPP") : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
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
                <TableCell colSpan={6} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
