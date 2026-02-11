
'use client';

import * as React from 'react';
import { collection, doc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import type { School, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Loader2, Search } from 'lucide-react';

interface AssignUserModalProps {
  school: School | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={16} />;

export default function AssignUserModal({ school, open, onOpenChange }: AssignUserModalProps) {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isAssigning, setIsAssigning] = React.useState(false);

  const usersCol = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users, isLoading } = useCollection<UserProfile>(usersCol);

  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    return users.filter(user =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const handleAssign = async (userToAssign: UserProfile | null) => {
    if (!firestore || !school || !currentUser) return;
    setIsAssigning(true);

    const schoolDocRef = doc(firestore, 'schools', school.id);
    const assignmentData = userToAssign
      ? { userId: userToAssign.id, name: userToAssign.name, email: userToAssign.email }
      : { userId: null, name: 'Unassigned', email: null };

    try {
      await updateDoc(schoolDocRef, { assignedTo: assignmentData });
      
      toast({
        title: 'School Reassigned',
        description: `${school.name} has been assigned to ${assignmentData.name || 'Unassigned'}.`,
      });
      onOpenChange(false);
    } catch (e) {
        const permissionError = new FirestorePermissionError({
            path: schoolDocRef.path,
            operation: 'update',
            requestResourceData: { assignedTo: assignmentData },
        });
        errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'Assignment Failed',
        description: 'You may not have the required permissions to assign this school.',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign School</DialogTitle>
          <DialogDescription>
            Assign "{school?.name}" to a user.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
            />
        </div>
        <ScrollArea className="h-96 border rounded-md">
          <div className="p-2">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleAssign(null)}
                  className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors"
                  disabled={isAssigning}
                >
                  <Avatar>
                      <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                      <p className="font-medium italic">Unassigned</p>
                  </div>
                </button>
                {filteredUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleAssign(user)}
                    className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors"
                    disabled={isAssigning}
                  >
                    <Avatar>
                      <AvatarImage src={user.photoURL} alt={user.name} />
                      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-medium truncate">{user.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </button>
                ))}
              </>
            )}
            {!isLoading && filteredUsers.length === 0 && (
                <p className="text-center text-sm text-muted-foreground p-4">No users found.</p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
            {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAssigning}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
