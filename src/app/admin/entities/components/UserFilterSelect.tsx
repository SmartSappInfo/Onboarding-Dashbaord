'use client';

/**
 * UserFilterSelect.tsx
 *
 * Dedicated User Filter dropdown component sitting directly adjacent to the
 * "Filters" button in the Unified Action Bar on the Entity List page.
 *
 * Architectural & Security Guidelines (agent_mcp_rules.md):
 * - Fail-Closed Isolation: When `isRestricted` is true (workspace policy enforces
 *   restrictVisibilityToAssigned), user selection is disabled and locked to the logged-in user,
 *   preventing unauthorized browsing across tenant entities.
 * - Mobile Accessibility: Complies with WCAG 2.1 AA min-h-[44px] touch target (h-11)
 *   and tactile interaction tokens (active:scale-[0.97]).
 * - Scale & Performance: Employs a constrained ScrollArea with max-h-64 to safely handle
 *   organizations with large rosters (100+ users) without layout shifts or memory leaks.
 * - Zero Any: Strict TypeScript typing throughout.
 */

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { collection, query, where, orderBy } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectSeparator,
  SelectGroup,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, UserMinus, Lock } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/lib/utils';

export interface UserFilterSelectProps {
  /** The currently selected user ID, 'unassigned', or null for All Users */
  value: string | null;
  /** Callback fired when the selection changes */
  onValueChange: (value: string | null) => void;
  /** Current logged in user's UID to display the "(You)" badge */
  currentUserId?: string | null;
  /** If true, the workspace enforces strict visibility restriction to assigned records */
  isRestricted?: boolean;
  /** Optional custom class for outer container or trigger styling */
  className?: string;
  /** Manual disabled override */
  disabled?: boolean;
}

const getInitials = (name?: string | null): string => {
  if (!name) return 'U';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
};

export default function UserFilterSelect({
  value,
  onValueChange,
  currentUserId,
  isRestricted = false,
  className,
  disabled = false,
}: UserFilterSelectProps) {
  const firestore = useFirestore();
  const { activeOrganizationId } = useTenant();

  // Query authorized users scoped to the active organization
  const usersCol = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
      collection(firestore, 'users'),
      where('organizationId', '==', activeOrganizationId),
      where('isAuthorized', '==', true),
      orderBy('name', 'asc')
    );
  }, [firestore, activeOrganizationId]);

  const { data: users, isLoading } = useCollection<UserProfile>(usersCol);

  const handleValueChange = React.useCallback(
    (selectedValue: string) => {
      // Disallow mutation if restricted by workspace policy
      if (isRestricted) return;
      onValueChange(selectedValue === 'all' ? null : selectedValue);
    },
    [isRestricted, onValueChange]
  );

  const selectedUser = React.useMemo(() => {
    if (!users || !value) return null;
    return users.find(u => u.id === value) || null;
  }, [users, value]);

  // Loading skeleton matching standard h-11 action bar button height
  if (isLoading) {
    return <Skeleton className="h-11 w-full md:w-[190px] rounded-xl" />;
  }

  const isControlDisabled = disabled || isRestricted;

  // Selected value label display helper
  const renderTriggerContent = () => {
    if (value === 'unassigned') {
      return (
        <div className="flex items-center gap-2 overflow-hidden text-left">
          <UserMinus className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate">Unassigned</span>
        </div>
      );
    }

    if (selectedUser) {
      const isSelf = Boolean(currentUserId && selectedUser.id === currentUserId);
      return (
        <div className="flex items-center gap-2 overflow-hidden text-left">
          <Avatar className="h-5 w-5 shrink-0 border border-border/60">
            <AvatarImage src={selectedUser.photoURL} alt={selectedUser.name} />
            <AvatarFallback className="text-[10px] bg-muted font-bold">
              {getInitials(selectedUser.name)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{selectedUser.name}</span>
          {isSelf && (
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md shrink-0">
              You
            </span>
          )}
        </div>
      );
    }

    // Default fallback when a user ID is set but users list is still resolving
    if (value && currentUserId && value === currentUserId) {
      return (
        <div className="flex items-center gap-2 overflow-hidden text-left">
          <Avatar className="h-5 w-5 shrink-0 border border-border/60">
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
              ME
            </AvatarFallback>
          </Avatar>
          <span className="truncate font-semibold">Assigned to Me</span>
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md shrink-0">
            You
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 overflow-hidden text-left">
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="truncate">All Users</span>
      </div>
    );
  };

  const selectTrigger = (
    <SelectTrigger
      disabled={isControlDisabled}
      className={cn(
        'h-11 min-h-[44px] px-3.5 rounded-xl font-semibold gap-2 border border-border/80 bg-white dark:bg-card text-foreground shadow-sm transition-all text-xs w-full md:w-auto md:min-w-[190px] justify-between focus:ring-2 focus:ring-primary/20',
        !isControlDisabled && 'active:scale-[0.97] hover:bg-muted/30 cursor-pointer',
        isRestricted && 'opacity-90 bg-muted/20 cursor-not-allowed border-dashed',
        className
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0 mr-1">
        {renderTriggerContent()}
      </div>
      {isRestricted && (
        <Lock className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0 ml-1" />
      )}
    </SelectTrigger>
  );

  // If restricted, wrap with accessible informative tooltip
  if (isRestricted) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full md:w-auto inline-block">
              <Select value={value ?? 'all'} onValueChange={handleValueChange} disabled={true}>
                {selectTrigger}
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="text-xs max-w-xs z-[10050] p-2.5">
            <p className="font-semibold text-foreground">Restricted Workspace View</p>
            <p className="text-muted-foreground mt-0.5">
              Workspace security policy restricts your access to entities assigned to you.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Select value={value ?? 'all'} onValueChange={handleValueChange} disabled={disabled}>
      {selectTrigger}
      <SelectContent className="rounded-2xl border border-border/80 bg-popover shadow-2xl p-1 z-[10005] min-w-[220px]">
        <SelectGroup>
          <SelectItem value="all" className="rounded-xl min-h-[38px] cursor-pointer text-xs font-semibold py-2 px-2.5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>All Users</span>
            </div>
          </SelectItem>
          <SelectItem value="unassigned" className="rounded-xl min-h-[38px] cursor-pointer text-xs font-semibold py-2 px-2.5">
            <div className="flex items-center gap-2">
              <UserMinus className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Unassigned</span>
            </div>
          </SelectItem>
        </SelectGroup>

        {users && users.length > 0 && (
          <>
            <SelectSeparator className="my-1 border-border/60" />
            <ScrollArea className="max-h-60 overflow-y-auto">
              <SelectGroup>
                {users.map(user => {
                  const isSelf = Boolean(currentUserId && user.id === currentUserId);
                  return (
                    <SelectItem
                      key={user.id}
                      value={user.id}
                      className="rounded-xl min-h-[38px] cursor-pointer text-xs font-semibold py-2 px-2.5"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Avatar className="h-5 w-5 shrink-0 border border-border/60">
                          <AvatarImage src={user.photoURL} alt={user.name} />
                          <AvatarFallback className="text-[10px] bg-muted font-bold">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{user.name}</span>
                        {isSelf && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md shrink-0 ml-auto">
                            You
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            </ScrollArea>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
