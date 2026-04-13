'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator, SelectGroup } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Users } from 'lucide-react';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { Label } from '@/components/ui/label';
import { useTenant } from '@/context/TenantContext';

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={12} />;

export default function AssignedUserGlobalFilter() {
  const { assignedUserId, setAssignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
  const firestore = useFirestore();
  const { activeOrganizationId } = useTenant();
  
  const usersCol = useMemoFirebase(() => 
    firestore && activeOrganizationId ? query(
      collection(firestore, 'users'),
      where('organizationId', '==', activeOrganizationId),
      where('isAuthorized', '==', true),
      orderBy('name', 'asc')
    ) : null, 
  [firestore, activeOrganizationId]);

  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersCol);
  
  const isLoading = isLoadingFilter || isLoadingUsers;

  const handleValueChange = (selectedValue: string) => {
    if (selectedValue === 'all') {
      setAssignedUserId(null);
    } else {
      setAssignedUserId(selectedValue);
    }
  };

  const selectedUser = users?.find(u => u.id === assignedUserId);

  if (isLoading) {
 return <Skeleton className="h-10 w-48" />;
  }

  return (
 <div className="flex flex-col gap-2 w-full px-2 py-1">
 <span className="text-[10px] font-semibold text-muted-foreground/60">Global View Filter</span>
      <Select value={assignedUserId ?? 'all'} onValueChange={handleValueChange} name="global-user-filter">
 <SelectTrigger className="w-full h-9 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-xs">
          <SelectValue asChild>
 <div className="flex items-center gap-2 overflow-hidden">
              {assignedUserId === 'unassigned' ? (
                <span>Unassigned</span>
              ) : selectedUser ? (
                 <>
 <Avatar className="h-5 w-5">
                    <AvatarImage src={selectedUser.photoURL} alt={selectedUser.name} />
 <AvatarFallback className="text-[10px]">{getInitials(selectedUser.name)}</AvatarFallback>
                  </Avatar>
 <span className="truncate">{selectedUser.name}</span>
                 </>
              ) : (
                <>
 <Users className="h-4 w-4 text-muted-foreground"/>
                  <span>All Users</span>
                </>
              )}
            </div>
          </SelectValue>
        </SelectTrigger>
 <SelectContent className="rounded-2xl border-none shadow-2xl">
          <SelectGroup>
 <SelectItem value="all" className="rounded-xl">
 <div className="flex items-center gap-2">
 <Users className="h-4 w-4"/>
 <span className="font-bold">All Users</span>
                </div>
            </SelectItem>
 <SelectItem value="unassigned" className="rounded-xl">
 <div className="flex items-center gap-2">
 <UserIcon className="h-4 w-4"/>
 <span className="font-bold">Unassigned</span>
                </div>
            </SelectItem>
          </SelectGroup>
          {users && users.length > 0 && (
            <SelectGroup>
              <SelectSeparator />
              {users.map(user => (
 <SelectItem key={user.id} value={user.id} className="rounded-xl">
 <div className="flex items-center gap-2">
 <Avatar className="h-5 w-5">
                      <AvatarImage src={user.photoURL} alt={user.name} />
 <AvatarFallback className="text-[10px]">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
 <span className="font-bold">{user.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
