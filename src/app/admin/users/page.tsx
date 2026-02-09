
'use client';

import { useMemo } from 'react';
import { collection, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { UserProfile } from '@/lib/types';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon } from 'lucide-react';

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


  if (error) {
    return <div className="text-destructive">Error loading users: {error.message}</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={5} className="h-24 text-center">
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
