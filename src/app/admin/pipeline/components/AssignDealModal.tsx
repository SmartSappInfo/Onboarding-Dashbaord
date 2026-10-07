'use client';

/**
 * @fileoverview Assign Deal Modal
 *
 * ARCHITECTURAL POINTER (Rule 10 Maintainer Guidance):
 * High-fidelity, accessible dialog for assigning or reassigning deal ownership to
 * workspace team members directly from the Kanban Board or Deals List View.
 *
 * STANDARDS & WORKSPACE RULES COMPLIANCE:
 * - Theme Architecture (theme.md Section 8): Standardized modal styling with semantic tokens,
 *   demarcated header with CardInfoTooltip, sr-only description, and demarcated footer bar.
 * - Strict Typing (Rule 5): Zero 'any' or 'any[]'. All user profiles and deal interfaces strictly typed.
 * - Mobile Ergonomics & Accessibility (Rule 7): All interactive touch targets >= 44px (min-h-[44px]),
 *   keyboard navigable list, tactile mechanical press animations (active:scale-[0.97] / active:scale-[0.98]).
 * - Multi-Tenant Security & Single Source of Truth: Uses useWorkspaceUsers hook and calls updateDealOwnerAction.
 *
 * @testability Can be tested with standard React Testing Library queries and simulated user selections.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useToast } from '@/hooks/use-toast';
import {
  UserCheck,
  UserX,
  Search,
  Check,
  Loader2,
  X,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import { updateDealOwnerAction } from '@/app/actions/deal-actions';
import type { Deal, UserProfile } from '@/lib/types';
import { cn, toTitleCase } from '@/lib/utils';
import { formatCurrency } from '@/lib/currency-utils';

export interface AssignDealModalProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: (newOwnerId: string | null, newOwnerName: string | null) => void;
}

/**
 * Extracts 1-2 capital initials from a user's display name or email for clean avatar fallbacks.
 */
function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AssignDealModal({
  deal,
  open,
  onOpenChange,
  onAssigned,
}: AssignDealModalProps) {
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();
  const { data: workspaceUsers, isLoading: isLoadingUsers } = useWorkspaceUsers(activeWorkspaceId);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Sync state whenever modal opens or active deal changes
  React.useEffect(() => {
    if (open && deal) {
      setSelectedUserId(deal.assignedTo?.userId || null);
      setSearchQuery('');
    }
  }, [open, deal]);

  const currentDealOwnerId = deal?.assignedTo?.userId || null;

  // Filter users by search query (name, email, role)
  const filteredUsers = React.useMemo(() => {
    if (!workspaceUsers) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return workspaceUsers;

    return workspaceUsers.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      return name.includes(query) || email.includes(query) || role.includes(query);
    });
  }, [workspaceUsers, searchQuery]);

  const handleSaveAssignment = async () => {
    if (!deal?.id) return;
    setIsSubmitting(true);
    try {
      let targetUser: UserProfile | undefined;
      if (selectedUserId) {
        targetUser = workspaceUsers?.find((u) => u.id === selectedUserId);
      }

      const targetUserId = targetUser ? targetUser.id : null;
      const targetUserName = targetUser ? (targetUser.name || targetUser.email || 'Team Member') : null;
      const targetUserEmail = targetUser?.email || null;

      const res = await updateDealOwnerAction(
        deal.id,
        targetUserId,
        targetUserName,
        targetUserEmail
      );

      if (res.success) {
        toast({
          title: targetUserId ? 'Deal Assigned' : 'Deal Unassigned',
          description: targetUserId
            ? `Successfully assigned "${deal.name || 'Deal'}" to ${toTitleCase(targetUserName || '')}.`
            : `Removed owner from "${deal.name || 'Deal'}".`,
        });
        onAssigned?.(targetUserId, targetUserName);
        onOpenChange(false);
      } else {
        throw new Error(res.error || 'Failed to update deal owner.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update assignee.';
      toast({
        variant: 'destructive',
        title: 'Assignment Failed',
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!deal) return null;

  const isCurrentSelection = selectedUserId === currentDealOwnerId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl z-[150]"
      >
        {/* Demarcated Header (theme.md Section 8) */}
        <DialogHeader
          className="px-6 py-4 border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0 text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  {currentDealOwnerId ? 'Reassign Deal' : 'Assign Deal'}
                </DialogTitle>
                <CardInfoTooltip text="Assign or reassign ownership of this deal to a team member in this workspace, or leave it unassigned." />
              </div>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Select a team member to assign this deal to.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Deal Context Card */}
          <div className="p-3 rounded-xl border border-border/70 bg-muted/20 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Deal Target
              </p>
              <p className="text-xs font-bold text-foreground truncate mt-0.5">
                {deal.name || 'Unnamed Deal'}
              </p>
              {deal.value !== undefined && deal.value > 0 && (
                <p className="text-[11px] font-semibold text-primary/80 mt-0.5">
                  {formatCurrency(deal.value)}
                </p>
              )}
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Current Owner
              </p>
              <div
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full mt-0.5',
                  currentDealOwnerId
                    ? 'bg-primary/10 text-primary'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    currentDealOwnerId ? 'bg-primary' : 'bg-amber-500'
                  )}
                />
                <span className="truncate max-w-[120px]">
                  {deal.assignedTo?.name ? toTitleCase(deal.assignedTo.name) : 'Unassigned'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search team members by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 min-h-[44px] h-11 rounded-xl text-xs font-semibold bg-background border border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md active:scale-95 transition-transform"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Team Members List */}
          <div className="space-y-1.5">
            {/* Option: Unassigned (Always available or when search query matches) */}
            {(!searchQuery || 'unassigned'.includes(searchQuery.toLowerCase())) && (
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className={cn(
                  'w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 min-h-[48px] active:scale-[0.98] cursor-pointer',
                  selectedUserId === null
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm'
                    : 'border-border/60 hover:border-border hover:bg-muted/40'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      'h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors',
                      selectedUserId === null
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <UserX className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate">Leave Unassigned</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      No owner assigned to this deal
                    </p>
                  </div>
                </div>
                {selectedUserId === null && (
                  <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                )}
              </button>
            )}

            {/* Separator / Counter */}
            <div className="pt-2 pb-1 flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Workspace Team ({filteredUsers.length})
              </span>
              {isLoadingUsers && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* User List */}
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredUsers.map((user) => {
                const isSelected = selectedUserId === user.id;
                const isCurrentlyAssigned = currentDealOwnerId === user.id;

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={cn(
                      'w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 min-h-[48px] active:scale-[0.98] cursor-pointer',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm'
                        : 'border-border/60 hover:border-border hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9 border border-border/80 shrink-0">
                        {user.photoURL && (
                          <AvatarImage src={user.photoURL} alt={user.name || 'User'} />
                        )}
                        <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                          {getInitials(user.name || user.email)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-foreground truncate">
                            {toTitleCase(user.name || user.email || 'Team Member')}
                          </p>
                          {isCurrentlyAssigned && (
                            <span className="text-[9px] font-extrabold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.2 rounded-full shrink-0">
                              Current
                            </span>
                          )}
                        </div>
                        {user.email && (
                          <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}

              {filteredUsers.length === 0 && searchQuery && (
                <div className="text-center py-6 text-muted-foreground">
                  <UserX className="h-7 w-7 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold">No team members found</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    No users matching &quot;{searchQuery}&quot;
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Demarcated Footer Bar (theme.md Section 8) */}
        <DialogFooter
          className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 shrink-0"
        >
          <div className="text-[11px] text-muted-foreground font-medium hidden sm:flex items-center gap-1.5 truncate">
            <Sparkles className="h-3 w-3 text-primary/70 shrink-0" />
            <span className="truncate">
              {selectedUserId ? '1 assignee selected' : 'Deal will be unassigned'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl font-bold min-h-[44px] h-11 px-4 hover:bg-muted active:scale-[0.97] transition-all text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveAssignment}
              disabled={isSubmitting || isCurrentSelection}
              className="rounded-xl font-bold min-h-[44px] h-11 px-5 shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.97] transition-all text-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  {selectedUserId ? 'Assign Deal' : 'Save as Unassigned'}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
