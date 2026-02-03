
'use client';

import { useMemo } from 'react';
import { collection, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { UserProfile } from '@/lib/types';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

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
    <div>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
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
                  <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-6 w-10 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : users && users.length > 0 ? (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone}</TableCell>
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

    