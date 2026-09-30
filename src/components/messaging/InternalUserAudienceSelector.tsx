'use client';

/**
 * @fileoverview Internal User Audience Selector Component.
 *
 * Provides an enterprise-grade, highly tactile UI for selecting internal workspace
 * teammates as broadcast/direct message recipients with:
 * - Dynamic channel eligibility validation (Email / SMS / WhatsApp).
 * - Automatic resolution of raw Firestore role IDs (e.g. 'aP8rWeyeU2uYleUj4VjX') to human-readable names.
 * - Humanizing of technical role slugs (e.g. 'customer_success_(cse)' -> 'Customer Success (CSE)').
 * - Balanced, distributed multi-column card layout eliminating squished metadata and wasted whitespace.
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
  Briefcase,
} from 'lucide-react';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import { useWorkspaceRoles } from '@/hooks/use-workspace-roles';
import { useTenant } from '@/context/TenantContext';
import type { UserProfile, Role } from '@/lib/types';
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
  organizationId?: string | null;
  roles?: Role[];
}

interface NormalizedTeammate extends InternalUserRecipient {
  photoURL?: string;
}

/**
 * Known technical role slugs mapped to clean, human-readable display titles.
 */
const SYSTEM_ROLE_DISPLAY_MAP: Record<string, string> = {
  admin: 'Admin',
  administrator: 'Administrator',
  superadmin: 'Super Admin',
  super_admin: 'Super Admin',
  user: 'Member',
  member: 'Member',
  agent: 'Agent',
  manager: 'Manager',
  owner: 'Owner',
  viewer: 'Viewer',
  editor: 'Editor',
  billing_manager: 'Billing Manager',
  finance_officer: 'Finance Officer',
  trainer: 'Trainer',
  supervisor: 'Supervisor',
  support: 'Support Agent',
  customer_success: 'Customer Success',
  'customer_success_(cse)': 'Customer Success (CSE)',
};

/**
 * Common technical and business acronyms to preserve in all-caps when humanizing role titles.
 */
const KNOWN_ACRONYMS = new Set([
  'CSE', 'CEO', 'CTO', 'CFO', 'COO', 'HR', 'IT', 'QA', 'CRM', 'API', 'UI', 'UX', 'SMS', 'VIP', 'SOP'
]);

/**
 * Checks if a string looks like an unformatted Firestore auto-generated document ID (e.g. 'aP8rWeyeU2uYleUj4VjX').
 * Firestore auto-IDs are 16-35 characters of base62 characters without whitespace.
 */
export function isRawFirestoreId(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  return (
    /^[A-Za-z0-9_-]{16,35}$/.test(trimmed) &&
    (/[0-9]/.test(trimmed) || (/[a-z]/.test(trimmed) && /[A-Z]/.test(trimmed)))
  );
}

/**
 * Humanizes a snake_case, kebab-case, or lowercase role slug into clean Title Case.
 * Examples:
 * - 'customer_success_(cse)' -> 'Customer Success (CSE)'
 * - 'finance_officer' -> 'Finance Officer'
 * - 'agency_operations' -> 'Agency Operations'
 */
export function humanizeRoleSlug(slug: string): string {
  if (!slug) return 'Member';

  const lower = slug.trim().toLowerCase();
  if (SYSTEM_ROLE_DISPLAY_MAP[lower]) {
    return SYSTEM_ROLE_DISPLAY_MAP[lower];
  }

  // Replace underscores and hyphens with spaces
  const cleaned = slug.replace(/[_]/g, ' ').trim();
  const words = cleaned.split(/\s+/);

  const formattedWords = words.map((word) => {
    // Handle parenthesized acronyms, e.g. '(cse)' -> '(CSE)'
    const parenMatch = word.match(/^\((.*)\)$/);
    if (parenMatch && parenMatch[1]) {
      const inner = parenMatch[1];
      const upperInner = inner.toUpperCase();
      if (KNOWN_ACRONYMS.has(upperInner) || inner.length <= 4) {
        return `(${upperInner})`;
      }
      return `(${inner.charAt(0).toUpperCase() + inner.slice(1).toLowerCase()})`;
    }

    const upper = word.toUpperCase();
    if (KNOWN_ACRONYMS.has(upper)) {
      return upper;
    }

    // Preserve minor grammatical words in lowercase if not at start
    if (['and', 'of', 'in', 'at', 'to', 'for', 'by', '&'].includes(word.toLowerCase())) {
      return word.toLowerCase();
    }

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  const result = formattedWords.join(' ');
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Formats a raw role string or document ID into a clean human-readable name,
 * leveraging the organization's role lookup map where available.
 */
export function formatRoleName(
  rawRole: string | undefined | null,
  roleMap?: Map<string, Role>
): string {
  if (!rawRole) return 'Member';
  const trimmed = rawRole.trim();
  if (!trimmed) return 'Member';

  // 1. Check if it's a known role ID in the roleMap
  if (roleMap?.has(trimmed)) {
    const roleObj = roleMap.get(trimmed);
    if (roleObj?.name?.trim()) {
      return humanizeRoleSlug(roleObj.name.trim());
    }
  }

  // 2. If it's a raw unmapped Firestore ID, never show the hash to the user
  if (isRawFirestoreId(trimmed)) {
    return 'Member';
  }

  // 3. Humanize technical slug/code
  return humanizeRoleSlug(trimmed);
}

/**
 * Resolves a UserProfile entity to a clean, human-readable primary role title.
 */
export function resolveUserRole(
  user: UserProfile,
  workspaceId: string | null | undefined,
  roleMap?: Map<string, Role>
): string {
  // 1. Check workspace-specific assigned roles first (workspaceRoles mapping)
  if (workspaceId && user.workspaceRoles?.[workspaceId]?.length) {
    for (const rId of user.workspaceRoles[workspaceId]) {
      if (roleMap?.has(rId)) {
        const name = roleMap.get(rId)?.name;
        if (name) return formatRoleName(name, roleMap);
      }
    }
    for (const rId of user.workspaceRoles[workspaceId]) {
      if (!isRawFirestoreId(rId)) {
        return formatRoleName(rId, roleMap);
      }
    }
  }

  // 2. Check user.role field
  if (user.role?.trim()) {
    const r = user.role.trim();
    if (roleMap?.has(r)) {
      const name = roleMap.get(r)?.name;
      if (name) return formatRoleName(name, roleMap);
    }
    if (!isRawFirestoreId(r)) {
      return formatRoleName(r, roleMap);
    }
  }

  // 3. Check legacy user.roles array
  if (user.roles?.length) {
    for (const rId of user.roles) {
      const trimmed = rId?.trim();
      if (!trimmed) continue;
      if (roleMap?.has(trimmed)) {
        const name = roleMap.get(trimmed)?.name;
        if (name) return formatRoleName(name, roleMap);
      }
    }
    for (const rId of user.roles) {
      const trimmed = rId?.trim();
      if (!trimmed) continue;
      if (!isRawFirestoreId(trimmed)) {
        return formatRoleName(trimmed, roleMap);
      }
    }
  }

  // 4. Check hydrated roleNames
  if (user.roleNames?.length) {
    for (const rName of user.roleNames) {
      const trimmed = rName?.trim();
      if (trimmed && !isRawFirestoreId(trimmed)) {
        return formatRoleName(trimmed, roleMap);
      }
    }
  }

  // 5. Fallback check for raw user.role (sanitized)
  if (user.role?.trim()) {
    return formatRoleName(user.role.trim(), roleMap);
  }

  return 'Member';
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
  channel: 'email' | 'sms' | 'whatsapp',
  workspaceId?: string | null,
  roleMap?: Map<string, Role>
): NormalizedTeammate {
  const name = user.displayName?.trim() || user.name?.trim() || 'Teammate';
  const email = user.email?.trim() || '';
  const phone = user.phone?.trim() || undefined;
  const role = resolveUserRole(user, workspaceId, roleMap);
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
  organizationId,
  roles: propRoles,
}: InternalUserAudienceSelectorProps) {
  const { activeOrganizationId } = useTenant();
  const { data: rawUsers, isLoading: isLoadingUsers } = useWorkspaceUsers(workspaceId);

  // Discover effective organization ID for querying roles
  const effectiveOrgId = organizationId || activeOrganizationId || rawUsers?.[0]?.organizationId;

  // Query workspace roles only when not explicitly supplied via props
  const { roleMap: fetchedRoleMap } = useWorkspaceRoles(
    propRoles ? null : effectiveOrgId
  );

  const effectiveRoleMap = useMemo(() => {
    if (propRoles) {
      const map = new Map<string, Role>();
      for (const r of propRoles) {
        if (r && r.id) map.set(r.id, r);
      }
      return map;
    }
    return fetchedRoleMap;
  }, [propRoles, fetchedRoleMap]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [imgLoadErrors, setImgLoadErrors] = useState<Record<string, boolean>>({});

  // 1. Teammate Normalization with Role ID Resolution
  const allTeammates: NormalizedTeammate[] = useMemo(() => {
    if (!rawUsers || rawUsers.length === 0) return [];
    return rawUsers.map((u) => normalizeUserProfile(u, channel, workspaceId, effectiveRoleMap));
  }, [rawUsers, channel, workspaceId, effectiveRoleMap]);

  // 2. Dynamic Unique Roles (Normalized and Humanized)
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
  if (isLoadingUsers) {
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
        <div className="size-12 rounded-2xl bg-muted/80 flex items-center justify-center text-muted-foreground shadow-xs">
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
            className="min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-xl border border-border/80 bg-card hover:bg-accent/60 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none flex items-center gap-1.5 shadow-2xs"
          >
            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Select All Eligible</span>
          </button>

          <button
            type="button"
            onClick={handleDeselectAll}
            disabled={disabled || selectedUsers.length === 0}
            className="min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-xl border border-border/80 bg-card hover:bg-accent/60 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none flex items-center gap-1.5 text-muted-foreground hover:text-foreground shadow-2xs"
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
          className="min-h-[44px] w-full rounded-xl border border-border/80 bg-background/60 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
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

      {/* Role Filter Pills (Humanized and ID-free) */}
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

      {/* Teammates List - Distributed Multi-Column Cards */}
      <div className="space-y-2.5">
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
              className="min-h-[44px] px-4 py-2 text-xs font-medium rounded-xl border border-border bg-card hover:bg-accent/60 active:scale-[0.97] transition-all duration-200 inline-flex items-center gap-1.5 shadow-2xs"
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
                  'group relative flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all duration-200 min-h-[68px] gap-3 select-none',
                  !isEligible
                    ? 'opacity-70 bg-muted/15 border-dashed border-border/70 cursor-not-allowed'
                    : isSelected
                    ? 'border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs cursor-pointer active:scale-[0.99]'
                    : 'border-border/70 bg-card hover:border-border hover:bg-accent/30 cursor-pointer active:scale-[0.99]',
                  disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
                )}
              >
                {/* ── Left Zone: Selection + Identity (Name, Role Badge, Mobile Dept) ── */}
                <div className="flex items-center gap-3.5 min-w-0 sm:flex-[1.2] lg:flex-1">
                  {/* Dedicated Accessible Checkbox Button (44px tap zone) */}
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
                      'min-h-[44px] min-w-[44px] -m-2 p-2 flex items-center justify-center rounded-lg transition-transform duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0',
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
                  <div className="relative size-10 rounded-full shrink-0 overflow-hidden border border-border/60 bg-muted flex items-center justify-center shadow-2xs">
                    {hasPhoto ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- External OAuth/Google/Firebase profile photo URLs vary across domains */
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

                  {/* Name and Role */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground truncate max-w-[180px] sm:max-w-xs">
                        {teammate.name}
                      </span>

                      {teammate.role && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted/80 text-muted-foreground border border-border/50 shrink-0">
                          {teammate.role}
                        </span>
                      )}
                    </div>

                    {/* Department on mobile (stacked under name) */}
                    {teammate.department && (
                      <p className="text-xs text-muted-foreground truncate sm:hidden flex items-center gap-1.5">
                        <Briefcase className="size-3 text-muted-foreground/70 shrink-0" />
                        <span>{teammate.department}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Center Zone: Department Badge (Tablet & Desktop) ── */}
                <div className="hidden sm:flex items-center min-w-0 sm:w-44 md:w-52 lg:w-56 shrink-0 text-xs text-muted-foreground">
                  {teammate.department ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/50 text-muted-foreground truncate max-w-full">
                      <Briefcase className="size-3.5 text-muted-foreground/70 shrink-0" />
                      <span className="truncate">{teammate.department}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40 italic text-[11px]">No department</span>
                  )}
                </div>

                {/* ── Right Zone: Contact Details + Channel Eligibility Warning ── */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 sm:ml-auto">
                  {/* Contact details */}
                  <div className="flex flex-col sm:items-end justify-center text-xs text-muted-foreground gap-1 min-w-0">
                    {teammate.email && (
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5 truncate max-w-[210px] transition-colors',
                          channel === 'email' ? 'text-foreground font-medium' : 'text-muted-foreground'
                        )}
                      >
                        <Mail
                          className={cn(
                            'size-3.5 shrink-0',
                            channel === 'email' ? 'text-primary' : 'text-muted-foreground/70'
                          )}
                        />
                        <span className="truncate">{teammate.email}</span>
                      </div>
                    )}

                    {teammate.phone && (
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5 truncate transition-colors',
                          channel === 'sms' || channel === 'whatsapp'
                            ? 'text-foreground font-medium'
                            : 'text-muted-foreground'
                        )}
                      >
                        <Phone
                          className={cn(
                            'size-3.5 shrink-0',
                            channel === 'sms' || channel === 'whatsapp'
                              ? 'text-primary'
                              : 'text-muted-foreground/70'
                          )}
                        />
                        <span>{teammate.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Channel Ineligibility Warning Badge */}
                  {!isEligible && (
                    <div className="shrink-0">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap shadow-2xs">
                        <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>{missingDetailLabel}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
