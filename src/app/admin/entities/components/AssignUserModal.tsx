'use client';

import * as React from 'react';
import { collection, doc, updateDoc, query, where, orderBy } from 'firebase/firestore';
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
import { logActivity } from '@/lib/activity-logger';
import { useTenant } from '@/context/TenantContext';

interface AssignUserModalProps {
  school: School | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={16} />;

export default function AssignUserModal({ school, open, onOpenChange }: AssignUserModalProps) {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { activeOrganizationId } = useTenant();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isAssigning, setIsAssigning] = React.useState(false);

  // ORG-SCOPED USER QUERY
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
        collection(firestore, 'users'), 
        where('organizationId', '==', activeOrganizationId),
        where('isAuthorized', '==', true), 
        orderBy('name', 'asc')
    );
  }, [firestore, activeOrganizationId]);

  const { data: users, isLoading } = useCollection<UserProfile>(usersQuery);

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

    const oldAssignedToName = school.assignedTo?.name || 'Unassigned';

    try {
      await updateDoc(schoolDocRef, { assignedTo: assignmentData });
      
      toast({
        title: 'School Reassigned',
        description: `${school.name} has been assigned to ${assignmentData.name || 'Unassigned'}.`,
      });
      logActivity({
        organizationId: activeOrganizationId,
        entityId: school.id,
        userId: currentUser.uid,
        type: 'school_assigned',
        workspaceId: school.workspaceIds[0] || 'onboarding',
        source: 'user_action',
        description: `assigned school "${school.name}" to ${assignmentData.name || 'Unassigned'}`,
        metadata: { from: oldAssignedToName, to: assignmentData.name }
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
      <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0 text-left">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
              <UserIcon className="h-6 w-6" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Assign Account Owner</DialogTitle>
              <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select a team member for "{school?.name}"</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="p-6 bg-background">
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                <Input
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 pl-10 font-bold"
                />
            </div>
            <ScrollArea className="h-80 border-2 border-dashed rounded-2xl bg-muted/10">
            <div className="p-2 space-y-1">
                {isLoading ? (
                <div className="space-y-2 p-2">
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
                    className="w-full text-left flex items-center gap-4 p-3 rounded-xl hover:bg-white hover:shadow-md transition-all group"
                    disabled={isAssigning}
                    >
                    <div className="h-10 w-10 rounded-full bg-muted border flex items-center justify-center text-muted-foreground/40 font-black">?</div>
                    <div className="flex-1">
                        <p className="font-black uppercase text-xs text-muted-foreground italic group-hover:text-foreground">Unassigned</p>
                    </div>
                    </button>
                    {filteredUsers.map(user => (
                    <button
                        key={user.id}
                        onClick={() => handleAssign(user)}
                        className="w-full text-left flex items-center gap-4 p-3 rounded-xl hover:bg-white hover:shadow-md transition-all group"
                        disabled={isAssigning}
                    >
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                        <AvatarImage src={user.photoURL} alt={user.name} />
                        <AvatarFallback className="font-black text-[10px]">{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 overflow-hidden">
                        <p className="font-black uppercase text-xs truncate text-foreground/80 group-hover:text-primary transition-colors">{user.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate uppercase font-bold tracking-tighter opacity-60">{user.email}</p>
                        </div>
                    </button>
                    ))}
                </>
                )}
                {!isLoading && filteredUsers.length === 0 && (
                    <div className="py-20 text-center opacity-30">
                        <UserIcon className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No matching members</p>
                    </div>
                )}
            </div>
            </ScrollArea>
        </div>

        <DialogFooter className="p-4 bg-muted/30 border-t shrink-0 flex justify-between gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isAssigning} className="rounded-xl font-bold h-11 px-8">Discard</Button>
            <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest animate-pulse px-4">
                {isAssigning && <><Loader2 className="h-3 w-3 animate-spin"/> Syncing...</>}
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}