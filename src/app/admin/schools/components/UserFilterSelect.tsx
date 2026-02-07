'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { collection } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator, SelectGroup } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon } from 'lucide-react';

interface UserFilterSelectProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
}

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={12} />;

export default function UserFilterSelect({ value, onValueChange }: UserFilterSelectProps) {
  const firestore = useFirestore();
  const usersCol = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users, isLoading } = useCollection<UserProfile>(usersCol);
  
  const handleValueChange = (selectedValue: string) => {
    onValueChange(selectedValue === 'all' ? null : selectedValue);
  };

  if (isLoading) {
    return <Skeleton className="h-10 w-full max-w-xs" />;
  }

  return (
    <Select value={value ?? 'all'} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full max-w-xs">
        <SelectValue placeholder="Filter by assigned user..." />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="all">All Users</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
        </SelectGroup>
        {users && users.length > 0 && (
          <SelectGroup>
            <SelectSeparator />
            {users.map(user => (
              <SelectItem key={user.id} value={user.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.photoURL} alt={user.name} />
                    <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <span>{user.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
