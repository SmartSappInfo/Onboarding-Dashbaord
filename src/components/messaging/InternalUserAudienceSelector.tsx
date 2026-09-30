'use client';

/**
 * @fileoverview Internal User Audience Selector Component.
 *
 * Provides a production-grade, highly tactile UI for selecting internal workspace
 * teammates as broadcast/direct message recipients with:
 * - Dynamic channel eligibility validation (Email / SMS / WhatsApp).
 * - Real-time teammate search by name, email, phone, role, and department.
 * - Dynamic role-filter pills with tactile feedback (Emil Kowalski micro-animations).
 * - Batch selection actions ("Select All Eligible", "Deselect All").
 * - Mobile-first ergonomic touch zones (minimum 44px touch targets).
 * - Strict type-safety: Zero `any` or `any[]`.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  X,
  Check,
  Users,
  UserX,
  Mail,
  Phone,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import type { UserProfile } from '@/lib/types';
import type { InternalUserRecipient } from '@/lib/types/composer-audience';
import { cn } from '@/lib/utils';

export interface InternalUserAudienceSelectorProps {
  channel: 'email' | 'sms' | 'whatsapp';
  workspaceId: string | null | undefined;
  selectedUsers: InternalUserRecipient[];
  onChange: (users: InternalUserRecipient[]) => void;
  disabled?: boolean;
  className?: string;
  defaultCountry?: string;
}

interface NormalizedTeammate extends InternalUserRecipient {
  photoURL?: string;
}

/**
 * Derives uppercase initials from a user's display name.
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'T';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] ?? '';
  const last = parts[parts.length - 1][0] ?? '';
  return (first + last).toUpperCase();
}

/**
 * Normalizes a raw Firestore UserProfile into an internal teammate recipient.
 */
function normalizeUserProfile(
  user: UserProfile,
  channel: 'email' | 'sms' | 'whatsapp'
): NormalizedTeammate {
  const name = user.displayName?.trim() || user.name?.trim() || 'Teammate';
  const email = user.email?.trim() || '';
  const phone = user.phone?.trim() || undefined;
  const role = user.role?.trim() || (user.roles && user.roles[0]?.trim()) || 'Member';
  const department = user.department?.trim() || undefined;

  let isEligibleForChannel = false;
  if (channel === 'email') {
    isEligibleForChannel = Boolean(email && email.includes('@'));
  } else if (channel === 'sms' || channel === 'whatsapp') {
    isEligibleForChannel = Boolean(phone && phone.length >= 7);
  }

  return {
    userId: user.id,
    name,
    email,
    phone,
    role,
    department,
    isEligibleForChannel,
    photoURL: user.photoURL,
  };
}

export function InternalUserAudienceSelector({
  channel,
  workspaceId,
  selectedUsers,
  onChange,
  disabled = false,
  className,
}: InternalUserAudienceSelectorProps) {
  const { data: rawUsers, isLoading } = useWorkspaceUsers(workspaceId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [imgLoadErrors, setImgLoadErrors] = useState<Record<string, boolean>>({});

  // 1. Teammate Normalization
  const allTeammates: NormalizedTeammate[] = useMemo(() => {
    if (!rawUsers || rawUsers.length === 0) return [];
    return rawUsers.map((u) => normalizeUserProfile(u, channel));
  }, [rawUsers, channel]);

  // 2. Dynamic Unique Roles
  const uniqueRoles = useMemo(() => {
    const rolesSet = new Set<string>();
    for (const teammate of allTeammates) {
      if (teammate.role) {
        rolesSet.add(teammate.role);
      }
    }
    return Array.from(rolesSet).sort((a, b) => a.localeCompare(b));
  }, [allTeammates]);

  // 3. Filtered Teammates based on Search & Role
  const filteredTeammates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allTeammates.filter((teammate) => {
      // Role filter check
      if (
        selectedRole !== 'All' &&
        teammate.role?.toLowerCase() !== selectedRole.toLowerCase()
      ) {
        return false;
      }
      // Query filter check
      if (!q) return true;
      const nameMatch = teammate.name.toLowerCase().includes(q);
      const emailMatch = teammate.email.toLowerCase().includes(q);
      const phoneMatch = teammate.phone ? teammate.phone.toLowerCase().includes(q) : false;
      const roleMatch = teammate.role ? teammate.role.toLowerCase().includes(q) : false;
      const deptMatch = teammate.department
        ? teammate.department.toLowerCase().includes(q)
        : false;

      return nameMatch || emailMatch || phoneMatch || roleMatch || deptMatch;
    });
  }, [allTeammates, selectedRole, searchQuery]);

  // Selection Lookups
  const selectedIdSet = useMemo(() => {
    return new Set(selectedUsers.map((u) => u.userId));
  }, [selectedUsers]);

  const visibleEligibleTeammates = useMemo(() => {
    return filteredTeammates.filter((t) => t.isEligibleForChannel);
  }, [filteredTeammates]);

  const isAllVisibleEligibleSelected = useMemo(() => {
    if (visibleEligibleTeammates.length === 0) return false;
    return visibleEligibleTeammates.every((t) => selectedIdSet.has(t.userId));
  }, [visibleEligibleTeammates, selectedIdSet]);

  // Handlers
  const handleToggleTeammate = useCallback(
    (teammate: NormalizedTeammate) => {
      if (disabled) return;
      const isSelected = selectedIdSet.has(teammate.userId);

      if (isSelected) {
        onChange(selectedUsers.filter((u) => u.userId !== teammate.userId));
        return;
      }

      if (!teammate.isEligibleForChannel) return;

      const recipient: InternalUserRecipient = {
        userId: teammate.userId,
        name: teammate.name,
        email: teammate.email,
        phone: teammate.phone,
        role: teammate.role,
        department: teammate.department,
        isEligibleForChannel: teammate.isEligibleForChannel,
      };

      onChange([...selectedUsers, recipient]);
    },
    [disabled, selectedIdSet, selectedUsers, onChange]
  );

  const handleSelectAllEligible = useCallback(() => {
    if (disabled || visibleEligibleTeammates.length === 0) return;

    const newRecipients = [...selectedUsers];
    for (const t of visibleEligibleTeammates) {
      if (!selectedIdSet.has(t.userId)) {
        newRecipients.push({
          userId: t.userId,
          name: t.name,
          email: t.email,
          phone: t.phone,
          role: t.role,
          department: t.department,
          isEligibleForChannel: t.isEligibleForChannel,
        });
      }
    }
    onChange(newRecipients);
  }, [disabled, visibleEligibleTeammates, selectedUsers, selectedIdSet, onChange]);

  const handleDeselectAll = useCallback(() => {
    if (disabled || selectedUsers.length === 0) return;
    onChange([]);
  }, [disabled, selectedUsers.length, onChange]);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedRole('All');
  }, []);

  const handleImageError = useCallback((userId: string) => {
    setImgLoadErrors((prev) => ({ ...prev, [userId]: true }));
  }, []);

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div
        data-testid="internal-user-selector-skeleton"
        aria-busy="true"
        aria-label="Loading teammates..."
        className={cn('w-full space-y-3.5', className)}
      >
        <div className="h-11 w-full rounded-xl bg-muted/60 animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-16 rounded-full bg-muted/60 animate-pulse" />
          <div className="h-9 w-20 rounded-full bg-muted/60 animate-pulse" />
          <div className="h-9 w-20 rounded-full bg-muted/60 animate-pulse" />
        </div>
        <div className="space-y-2 pt-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 p-3 rounded-xl border border-border/40 bg-card/40 animate-pulse min-h-[64px]"
            >
              <div className="size-5 rounded bg-muted shrink-0" />
              <div className="size-10 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 rounded bg-muted" />
                <div className="h-2.5 w-48 rounded bg-muted/70" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Workspace Empty State
  if (!workspaceId || allTeammates.length === 0) {
    return (
      <div
        className={cn(
          'w-full p-8 rounded-2xl border border-dashed border-border bg-card/50 text-center flex flex-col items-center justify-center space-y-3',
          className
        )}
      >
        <div className="size-12 rounded-2xl bg-muted/80 flex items-center justify-center text-muted-foreground shadow-sm">
          <Users className="size-6" />
        </div>
        <div className="space-y-1 max-w-sm">
          <h4 className="font-semibold text-sm text-foreground">
            No teammates found in this workspace
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            There are no members assigned to this workspace yet. Add teammates in Workspace
            Settings to send them messages.
          </p>
        </div>
      </div>
    );
  }

  const missingDetailLabel = channel === 'email' ? 'Missing email' : 'Missing phone';

  return (
    <div className={cn('w-full space-y-3.5 text-foreground', className)}>
      {/* Action Header & Counter Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-0.5">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 w-fit">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            Selected {selectedUsers.length} of {allTeammates.length} teammates
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAllEligible}
            disabled={
              disabled ||
              visibleEligibleTeammates.length === 0 ||
              isAllVisibleEligibleSelected
            }
            className="min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-xl border border-border/80 bg-card hover:bg-accent/60 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none flex items-center gap-1.5 shadow-xs"
          >
            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Select All Eligible</span>
          </button>

          <button
            type="button"
            onClick={handleDeselectAll}
            disabled={disabled || selectedUsers.length === 0}
            className="min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-xl border border-border/80 bg-card hover:bg-accent/60 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none flex items-center gap-1.5 text-muted-foreground hover:text-foreground shadow-xs"
          >
            <RotateCcw className="size-3.5" />
            <span>Deselect All</span>
          </button>
        </div>
      </div>

      {/* Live Search Bar */}
      <div className="relative flex items-center w-full">
        <Search className="size-4 text-muted-foreground absolute left-3.5 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={disabled}
          placeholder="Search teammates by name, email, phone, role..."
          className="min-h-[44px] w-full rounded-xl border border-border/80 bg-background/60 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
        />
        {searchQuery.trim().length > 0 && !disabled && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setSearchQuery('')}
            className="absolute right-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 transition-all"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Role Filter Pills */}
      {uniqueRoles.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedRole('All')}
            disabled={disabled}
            className={cn(
              'min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-full transition-all duration-200 active:scale-[0.97] flex items-center gap-1.5 shrink-0',
              selectedRole === 'All'
                ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40',
              disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
            )}
          >
            <span>All</span>
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-mono',
                selectedRole === 'All'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-background/80 text-muted-foreground'
              )}
            >
              {allTeammates.length}
            </span>
          </button>

          {uniqueRoles.map((role) => {
            const count = allTeammates.filter(
              (t) => t.role?.toLowerCase() === role.toLowerCase()
            ).length;
            const isRoleActive = selectedRole.toLowerCase() === role.toLowerCase();

            return (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                disabled={disabled}
                className={cn(
                  'min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-full transition-all duration-200 active:scale-[0.97] flex items-center gap-1.5 shrink-0',
                  isRoleActive
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40',
                  disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
                )}
              >
                <span>{role}</span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-mono',
                    isRoleActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-background/80 text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Teammates List */}
      <div className="space-y-2">
        {filteredTeammates.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-border bg-card/40 text-center flex flex-col items-center justify-center space-y-3">
            <div className="size-11 rounded-2xl bg-muted/80 flex items-center justify-center text-muted-foreground">
              <UserX className="size-5" />
            </div>
            <div className="space-y-1">
              <h5 className="font-semibold text-sm text-foreground">
                No teammates match your search
              </h5>
              <p className="text-xs text-muted-foreground">
                Check your spelling or reset filters to see all available teammates.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[44px] px-4 py-2 text-xs font-medium rounded-xl border border-border bg-card hover:bg-accent/60 active:scale-[0.97] transition-all duration-200 inline-flex items-center gap-1.5 shadow-xs"
            >
              <RotateCcw className="size-3.5" />
              <span>Reset filters</span>
            </button>
          </div>
        ) : (
          filteredTeammates.map((teammate) => {
            const isSelected = selectedIdSet.has(teammate.userId);
            const isEligible = teammate.isEligibleForChannel;
            const hasPhoto = teammate.photoURL && !imgLoadErrors[teammate.userId];

            return (
              <div
                key={teammate.userId}
                data-testid={`teammate-row-${teammate.userId}`}
                onClick={() => handleToggleTeammate(teammate)}
                tabIndex={disabled || !isEligible ? -1 : 0}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === ' ' || e.key === 'Enter')) {
                    e.preventDefault();
                    handleToggleTeammate(teammate);
                  }
                }}
                className={cn(
                  'group relative flex items-center justify-between p-3 rounded-xl border transition-all duration-200 min-h-[64px] select-none',
                  !isEligible
                    ? 'opacity-65 bg-muted/15 border-dashed border-border/70 cursor-not-allowed'
                    : isSelected
                    ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs cursor-pointer active:scale-[0.98]'
                    : 'border-border/70 bg-card hover:border-border hover:bg-accent/40 cursor-pointer active:scale-[0.98]',
                  disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  {/* Dedicated Accessible Checkbox Button */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`Select ${teammate.name}`}
                    disabled={disabled || !isEligible}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleTeammate(teammate);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleToggleTeammate(teammate);
                      }
                    }}
                    className={cn(
                      'min-h-[44px] min-w-[44px] -m-2 p-2 flex items-center justify-center rounded-lg transition-transform duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      (!isEligible || disabled) && 'cursor-not-allowed pointer-events-none'
                    )}
                  >
                    <div
                      className={cn(
                        'size-5 rounded-md border flex items-center justify-center shrink-0 transition-all duration-200',
                        !isEligible
                          ? 'border-border/60 bg-muted/40 text-transparent cursor-not-allowed'
                          : isSelected
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                          : 'border-border bg-background group-hover:border-foreground/40'
                      )}
                    >
                      {isSelected && <Check className="size-3.5 stroke-[2.5]" />}
                    </div>
                  </button>

                  {/* Avatar */}
                  <div className="relative size-10 rounded-full shrink-0 overflow-hidden border border-border/60 bg-muted flex items-center justify-center">
                    {hasPhoto ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- External OAuth/Google/Firebase profile photo URLs vary across multiple dynamic domains */
                      <img
                        src={teammate.photoURL}
                        alt={teammate.name}
                        onError={() => handleImageError(teammate.userId)}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="font-semibold text-xs text-primary/80 tracking-tight">
                        {getInitials(teammate.name)}
                      </span>
                    )}
                  </div>

                  {/* Teammate Information */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-sm text-foreground truncate max-w-[180px] sm:max-w-xs">
                        {teammate.name}
                      </span>

                      {teammate.role && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border/40">
                          {teammate.role}
                        </span>
                      )}

                      {teammate.department && (
                        <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline-flex items-center gap-1">
                          <span>•</span>
                          <span>{teammate.department}</span>
                        </span>
                      )}

                      {!isEligible && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                          <AlertTriangle className="size-3 shrink-0" />
                          <span>{missingDetailLabel}</span>
                        </span>
                      )}
                    </div>

                    {/* Contact Details */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {teammate.email && (
                        <div
                          className={cn(
                            'inline-flex items-center gap-1 truncate max-w-[200px]',
                            channel === 'email' && 'text-foreground/90 font-medium'
                          )}
                        >
                          <Mail className="size-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{teammate.email}</span>
                        </div>
                      )}

                      {teammate.phone && (
                        <div
                          className={cn(
                            'inline-flex items-center gap-1',
                            (channel === 'sms' || channel === 'whatsapp') &&
                              'text-foreground/90 font-medium'
                          )}
                        >
                          <Phone className="size-3 text-muted-foreground shrink-0" />
                          <span>{teammate.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
