'use client';

import * as React from 'react';
import { collection, doc, writeBatch, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { WorkspaceEntity, UserProfile } from '@/lib/types';
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
import { useTerminology } from '@/hooks/use-terminology';

interface AssignUserModalProps {
  entity: WorkspaceEntity | null;
  selectedEntityIds?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={16} />;

export default function AssignUserModal({ entity, selectedEntityIds = [], open, onOpenChange, onComplete }: AssignUserModalProps) {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { activeOrganizationId } = useTenant();
  const { toast } = useToast();
  const { singular, plural } = useTerminology();
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

  React.useEffect(() => {
    if (open) {
      setSearchTerm('');
    }
  }, [open]);

  const handleAssign = async (userToAssign: UserProfile | null) => {
    if (!firestore || !currentUser) return;
    setIsAssigning(true);

    const assignmentData = userToAssign
      ? { userId: userToAssign.id, name: userToAssign.name, email: userToAssign.email }
      : { userId: null, name: 'Unassigned', email: null };

    try {
      const now = new Date().toISOString();
      const targetIds = selectedEntityIds.length > 0 
        ? selectedEntityIds 
        : entity 
          ? [entity.id] 
          : [];

      if (targetIds.length === 0) return;

      const batch = writeBatch(firestore);

      targetIds.forEach(id => {
        const docRef = doc(firestore, 'workspace_entities', id);
        batch.update(docRef, { 
          assignedTo: assignmentData,
          updatedAt: now
        });
      });

      await batch.commit();
      
      const count = targetIds.length;
      toast({
        title: count === 1 ? `${singular} Reassigned` : `${count} ${plural} Reassigned`,
        description: `Successfully reassigned to ${assignmentData.name || 'Unassigned'}.`,
      });

      if (entity && count === 1) {
        logActivity({
          organizationId: activeOrganizationId,
          entityId: entity.entityId,
          userId: currentUser.uid,
          type: 'entity_assigned',
          workspaceId: entity.workspaceId,
          source: 'user_action',
          description: `assigned ${singular.toLowerCase()} "${entity.displayName}" to ${assignmentData.name || 'Unassigned'}`,
          metadata: { from: entity.assignedTo?.name || 'Unassigned', to: assignmentData.name }
        });
      }

      onOpenChange(false);
      onComplete?.();
    } catch (e) {
      console.error('[AssignUserModal] Reassignment error:', e);
      toast({
        variant: 'destructive',
        title: 'Assignment Failed',
        description: `Failed to complete ownership reassignments.`,
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const dialogSubtitle = selectedEntityIds.length > 0
    ? `Select team member for ${selectedEntityIds.length} selected ${plural.toLowerCase()}`
    : `Select team member for "${entity?.displayName}"`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-card">
        <DialogHeader className="p-8 bg-muted/20 border-b shrink-0 text-left">
          <div className="flex flex-col items-start gap-2">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-sm mb-2">
              <UserIcon className="h-6 w-6" aria-hidden="true" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Assign Account Owner</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground mt-1">
              {dialogSubtitle}
            </DialogDescription>
          </div>
        </DialogHeader>
        
        <div className="p-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 pl-10 font-bold"
            />
          </div>
          <ScrollArea className="h-80 border-2 border-dashed border-border/60 rounded-2xl bg-card">
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
                    className="w-full text-left flex items-center gap-4 p-3 rounded-xl hover:bg-muted/30 transition-all group"
                    disabled={isAssigning}
                  >
                    <div className="h-10 w-10 rounded-full bg-muted border flex items-center justify-center text-muted-foreground/45 font-semibold">?</div>
                    <div className="flex-1">
                      <p className="font-semibold text-xs text-muted-foreground italic group-hover:text-foreground">Unassigned</p>
                    </div>
                  </button>
                  {filteredUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleAssign(user)}
                      className="w-full text-left flex items-center gap-4 p-3 rounded-xl hover:bg-muted/30 transition-all group"
                      disabled={isAssigning}
                    >
                      <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                        <AvatarImage src={user.photoURL} alt={user.name} />
                        <AvatarFallback className="font-semibold text-[10px]">{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-semibold text-xs truncate text-foreground/85 group-hover:text-primary transition-colors">{user.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate font-bold tracking-tighter opacity-65">{user.email}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}
              {!isLoading && filteredUsers.length === 0 && (
                <div className="py-20 text-center opacity-30">
                  <UserIcon className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-[10px] font-bold">No matching members</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="p-6 bg-muted/20 border-t flex justify-between items-center sm:justify-between">
          <div className="flex items-center gap-2 text-primary font-bold text-[10px]">
            {isAssigning && <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Reassigning...</>}
          </div>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isAssigning}
            className="rounded-xl font-bold h-10 px-6 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}