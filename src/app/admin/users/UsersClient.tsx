'use client';

/**
 * @fileOverview Identity & People Hub 2.0 (`/admin/users` & `/admin/people`)
 *
 * Professional, industry-grade member and access governance center.
 * Conforms to `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`,
 * `frontend-design`, `ui-ux-pro-max`, and `table-filters`.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Features PeopleMetricsRibbon with direct status filtering.
 * - Integrates PersonProfileDrawer (4 tabs: Overview, Access & Workspaces, Security & Sessions, Preferences & AI).
 * - Integrates WorkspaceMembershipSheet for workspace role assignment and primary workspace tagging.
 * - Responsive Mobile Card Reflow: renders as an optimized card stack on mobile (<768px) and a full table on desktop.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { collection, orderBy, query, doc, updateDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import type { UserProfile, Role, AppPermissionId, PermissionsSchema, Workspace, MembershipStatus, PeopleDirectoryFilter } from '@/lib/types';
import { mergePermissionsSchemas } from '@/lib/permissions-engine';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  User as UserIcon,
  ShieldCheck,
  Zap,
  Info,
  Loader2,
  ShieldEllipsis,
  UserPlus,
  UserMinus,
  Key,
  Building2,
  Search,
  Filter,
  ChevronDown,
  SlidersHorizontal,
  Star,
  ExternalLink,
  Ban,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { PageContainerFluid } from '@/components/ui/page-container';
import { MultiSelect } from '@/components/ui/multi-select';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/context/TenantContext';

import InviteUserModal from './components/InviteUserModal';
import { PeopleMetricsRibbon } from './components/PeopleMetricsRibbon';
import { PeopleFilterDrawer } from './components/PeopleFilterDrawer';
import { PersonProfileDrawer } from './components/PersonProfileDrawer';
import { WorkspaceMembershipSheet } from './components/WorkspaceMembershipSheet';
import {
  adminResetUserPasswordAction,
  adminUpdateUserAccessAction,
  declineJoinRequestAction,
  removeUserFromOrgAction,
} from '@/lib/user-invite-actions';

// Extracted outside component per rerender-no-inline-components
const getInitials = (name?: string) =>
  name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?';

// Memoized role lookup map (js-index-maps)
function useRoleLookup(roles: Role[] | null | undefined) {
  return React.useMemo(() => {
    const map = new Map<string, Role>();
    roles?.forEach((r) => map.set(r.id, r));
    return map;
  }, [roles]);
}

export default function UsersClient() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { activeOrganizationId, activeWorkspaceId, activeWorkspace, accessibleWorkspaces } = useTenant();
  const { user: currentUser } = useUser();

  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = React.useState(false);

  // Detail & Workspace Sheets State
  const [inspectingUser, setInspectingUser] = React.useState<UserProfile | null>(null);
  const [managingWsUser, setManagingWsUser] = React.useState<UserProfile | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<MembershipStatus | 'all'>('all');
  const [advancedFilters, setAdvancedFilters] = React.useState<PeopleDirectoryFilter>({
    status: 'all',
  });

  // 1. DATA SUBSCRIPTIONS - ORG SCOPED
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
      collection(firestore, 'users'),
      where('organizationId', '==', activeOrganizationId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, activeOrganizationId]);

  const rolesQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
      collection(firestore, 'roles'),
      where('organizationId', '==', activeOrganizationId),
      orderBy('name', 'asc')
    );
  }, [firestore, activeOrganizationId]);

  const { data: users, isLoading: isLoadingUsers, error } = useCollection<UserProfile>(usersQuery);
  const { data: roles, isLoading: isLoadingRoles } = useCollection<Role>(rolesQuery);
  const roleMap = useRoleLookup(roles);

  const isLoading = isLoadingUsers || isLoadingRoles;

  // Extract unique departments for filtering
  const departments = React.useMemo(() => {
    if (!users) return [];
    const depts = new Set<string>();
    users.forEach((u) => {
      if (u.department) depts.add(u.department);
    });
    return Array.from(depts);
  }, [users]);

  // Compute metrics for ribbon
  const metrics = React.useMemo(() => {
    let total = 0;
    let active = 0;
    let pending = 0;
    let suspended = 0;

    if (users) {
      total = users.length;
      users.forEach((u) => {
        if (u.isAuthorized) active++;
        else if (u.approvalStatus === 'rejected') suspended++;
        else pending++;
      });
    }

    return {
      total,
      active,
      pending,
      suspended,
      workspacesCount: accessibleWorkspaces.length,
    };
  }, [users, accessibleWorkspaces]);

  // Filtered users pipeline
  const filteredUsers = React.useMemo(() => {
    if (!users) return [];

    return users.filter((u) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name?.toLowerCase().includes(q);
        const matchesEmail = u.email?.toLowerCase().includes(q);
        const matchesDept = u.department?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesDept) return false;
      }

      // Status filter from ribbon or drawer
      const effectiveStatus = advancedFilters.status && advancedFilters.status !== 'all' ? advancedFilters.status : selectedStatus;
      if (effectiveStatus !== 'all') {
        if (effectiveStatus === 'active' && !u.isAuthorized) return false;
        if (effectiveStatus === 'pending' && (u.isAuthorized || u.approvalStatus === 'rejected')) return false;
        if (effectiveStatus === 'suspended' && (u.isAuthorized || u.approvalStatus !== 'rejected')) return false;
      }

      // Workspace filter
      if (advancedFilters.workspaceId) {
        if (!u.workspaceIds?.includes(advancedFilters.workspaceId)) return false;
      }

      // Role filter
      if (advancedFilters.roleId) {
        const userRoles = u.roles || [];
        const wsRoles = Object.values(u.workspaceRoles || {}).flat();
        if (!userRoles.includes(advancedFilters.roleId) && !wsRoles.includes(advancedFilters.roleId)) return false;
      }

      // Department filter
      if (advancedFilters.departmentId) {
        if (u.department !== advancedFilters.departmentId) return false;
      }

      return true;
    });
  }, [users, searchQuery, selectedStatus, advancedFilters]);

  // Active filter count
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (selectedStatus !== 'all') count++;
    if (advancedFilters.workspaceId) count++;
    if (advancedFilters.roleId) count++;
    if (advancedFilters.departmentId) count++;
    return count;
  }, [selectedStatus, advancedFilters]);

  // 2. WORKSPACE-SCOPED ROLE MODIFIER HANDLER
  const handleUpdateUser = React.useCallback(
    async (userId: string, updates: Partial<UserProfile>) => {
      if (!firestore || !roles || !activeWorkspaceId) return;
      setUpdatingId(userId);

      const userDocRef = doc(firestore, 'users', userId);
      const currentUserDoc = users?.find((u) => u.id === userId);

      if (updates.roles) {
        const selectedRoleObjects = roles.filter((r) => updates.roles!.includes(r.id));

        const allPerms = new Set<AppPermissionId>();
        selectedRoleObjects.forEach((r) => {
          if (r.permissions) r.permissions.forEach((p) => allPerms.add(p));
        });

        const schemas = selectedRoleObjects
          .map((r) => r.permissionsSchema)
          .filter((s): s is PermissionsSchema => Boolean(s));
        const mergedSchema = schemas.length > 0 ? mergePermissionsSchemas(schemas) : undefined;

        const existingWsRoles = currentUserDoc?.workspaceRoles || {};
        const existingWsPerms = currentUserDoc?.workspacePermissions || {};
        const existingWsSchemas = currentUserDoc?.workspacePermissionsSchemas || {};

        const newWorkspaceRoles = { ...existingWsRoles, [activeWorkspaceId]: updates.roles };
        const newWorkspacePermissions = { ...existingWsPerms, [activeWorkspaceId]: Array.from(allPerms) };
        const newWorkspacePermissionsSchemas = mergedSchema
          ? { ...existingWsSchemas, [activeWorkspaceId]: mergedSchema }
          : existingWsSchemas;

        const workspaceIds = Array.from(new Set([...(currentUserDoc?.workspaceIds || []), activeWorkspaceId]));

        updates.permissions = Array.from(allPerms);
        if (mergedSchema) updates.permissionsSchema = mergedSchema;

        Object.assign(updates, {
          workspaceIds,
          workspaceRoles: newWorkspaceRoles,
          workspacePermissions: newWorkspacePermissions,
          workspacePermissionsSchemas: newWorkspacePermissionsSchemas,
        });
      }

      try {
        await updateDoc(userDocRef, { ...updates, updatedAt: new Date().toISOString() });
        toast({
          title: 'Access Synchronized',
          description: `Workspace permissions updated for ${activeWorkspace?.name || 'current workspace'}.`,
        });
      } catch (e: unknown) {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: updates,
          })
        );
        toast({ variant: 'destructive', title: 'Update Failed' });
      } finally {
        setUpdatingId(null);
      }
    },
    [firestore, roles, activeWorkspaceId, users, activeWorkspace, toast]
  );

  const handleResetPassword = React.useCallback(
    async (userId: string, userName: string) => {
      if (
        !(await confirm({
          title: 'Reset Password',
          description: `Generate a new temporary password and dispatch credentials to ${userName} via Email/SMS?`,
          confirmText: 'Reset Password',
        }))
      )
        return;

      setUpdatingId(userId);
      try {
        const result = await adminResetUserPasswordAction(userId);
        if (result.success) {
          toast({ title: 'Reset Successful', description: result.message });
        } else {
          throw new Error(result.error);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Reset failed';
        toast({ variant: 'destructive', title: 'Reset Failed', description: msg });
      } finally {
        setUpdatingId(null);
      }
    },
    [toast, confirm]
  );

  const handleToggleAccess = React.useCallback(
    async (userId: string, isAuthorized: boolean, userName: string) => {
      setUpdatingId(userId);
      try {
        const result = await adminUpdateUserAccessAction(userId, isAuthorized);
        if (result.success) {
          toast({
            title: isAuthorized ? 'Access Restored' : 'Access Revoked',
            description: result.message,
          });
        } else {
          throw new Error(result.error);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Update failed';
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: msg,
        });
      } finally {
        setUpdatingId(null);
      }
    },
    [toast]
  );

  const handleDeclineRequest = React.useCallback(
    async (userId: string, userName: string) => {
      if (!currentUser?.uid) return;
      if (
        !(await confirm({
          title: 'Decline joining request?',
          description: `This will reject ${userName}'s onboarding and disable their access.`,
          confirmText: 'Decline',
          variant: 'destructive',
        }))
      )
        return;

      setUpdatingId(userId);
      try {
        const result = await declineJoinRequestAction(userId, currentUser.uid);
        if (result.success) {
          toast({
            title: 'Request Declined',
            description: result.message,
          });
        } else {
          throw new Error(result.error);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Operation failed';
        toast({
          variant: 'destructive',
          title: 'Operation Failed',
          description: msg,
        });
      } finally {
        setUpdatingId(null);
      }
    },
    [currentUser, toast, confirm]
  );

  const handleRemoveUser = React.useCallback(
    async (userId: string, userName: string) => {
      if (!currentUser?.uid) return;
      if (userId === currentUser.uid) {
        toast({
          variant: 'destructive',
          title: 'Action Denied',
          description: 'You cannot remove yourself from the organization.',
        });
        return;
      }
      if (
        !(await confirm({
          title: 'Remove from organization?',
          description: `This immediately strips all of ${userName}'s organization and workspace access and resets their onboarding profile.`,
          confirmText: 'Remove',
          variant: 'destructive',
        }))
      )
        return;

      setUpdatingId(userId);
      try {
        const result = await removeUserFromOrgAction(userId, currentUser.uid);
        if (result.success) {
          toast({
            title: 'User Removed',
            description: result.message,
          });
        } else {
          throw new Error(result.error);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Operation failed';
        toast({
          variant: 'destructive',
          title: 'Operation Failed',
          description: msg,
        });
      } finally {
        setUpdatingId(null);
      }
    },
    [currentUser, toast, confirm]
  );

  if (error) {
    return (
      <PageContainerFluid>
        <div className="p-8 text-destructive border rounded-xl bg-destructive/10">
          Error loading team registry: {error.message}
        </div>
      </PageContainerFluid>
    );
  }

  return (
    <PageContainerFluid>
      <div className="space-y-6 pb-32 w-full">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              People & Access
            </h1>
            <p className="text-muted-foreground text-xs mt-0.5">
              Manage organization members, workspace memberships, and hierarchical access roles
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-lg font-semibold h-9 px-3.5 border-border hover:bg-muted/50 transition-all text-foreground text-xs active:scale-[0.97]"
            >
              <Link href="/admin/users/roles" className="flex items-center gap-1.5">
                <ShieldEllipsis className="h-3.5 w-3.5" /> Roles Matrix
              </Link>
            </Button>
            <Button
              size="sm"
              onClick={() => setIsInviteModalOpen(true)}
              className="rounded-lg font-semibold h-9 px-4 shadow-sm transition-all hover:shadow-md active:scale-[0.97] text-xs"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite Person
            </Button>
          </div>
        </div>

        {/* Metrics Summary Ribbon */}
        <PeopleMetricsRibbon
          total={metrics.total}
          active={metrics.active}
          pending={metrics.pending}
          suspended={metrics.suspended}
          workspacesCount={metrics.workspacesCount}
          selectedStatus={selectedStatus}
          onSelectStatus={(status) => {
            setSelectedStatus(status);
            setAdvancedFilters((prev) => ({ ...prev, status }));
          }}
          isLoading={isLoading}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Role Legend Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="rounded-xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden shadow-xs">
              <CardHeader className="bg-muted/30 border-b px-4 py-3">
                <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-primary" /> Active Roles ({roles?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-1">
                {isLoadingRoles ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))
                ) : (
                  roles?.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/40 transition-colors group cursor-default text-left"
                    >
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold tracking-tight block truncate">{r.name}</span>
                        <p className="text-[9px] text-muted-foreground leading-snug line-clamp-1 opacity-0 group-hover:opacity-70 transition-opacity">
                          {r.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <Separator className="opacity-40 my-2" />
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <p className="text-[9px] text-muted-foreground leading-relaxed">
                    Permissions are <span className="font-semibold text-foreground">additive</span> — assigning multiple roles merges capabilities with OR-logic.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Directory Column */}
          <div className="lg:col-span-3 space-y-3">
            {/* Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9.5 rounded-lg bg-card/60 border-border text-xs focus-visible:ring-1 focus-visible:ring-primary/20 min-h-[38px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="h-9.5 px-3 rounded-lg text-xs font-medium border-border active:scale-[0.97] min-h-[38px]"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px] font-bold">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>

                {activeWorkspace && (
                  <Badge
                    variant="outline"
                    className="h-9.5 px-3 rounded-lg bg-primary/10 text-primary border-primary/20 text-xs font-semibold flex items-center gap-1.5 shrink-0 min-h-[38px]"
                  >
                    <Building2 className="h-3 w-3" />
                    {activeWorkspace.name}
                  </Badge>
                )}
              </div>
            </div>

            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-xs overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30 border-b">
                  <TableRow>
                    <TableHead className="w-[280px] pl-5 text-muted-foreground text-[10px] uppercase tracking-widest font-bold py-3.5">
                      Member & Details
                    </TableHead>
                    <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold py-3.5">
                      Roles & Permissions ({activeWorkspace?.name || 'Workspace'})
                    </TableHead>
                    <TableHead className="w-[140px] text-center text-muted-foreground text-[10px] uppercase tracking-widest font-bold py-3.5">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-5 py-4">
                          <Skeleton className="h-10 w-48 rounded-lg" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-9 w-48 rounded-lg" />
                        </TableCell>
                        <TableCell className="text-center">
                          <Skeleton className="h-6 w-16 mx-auto rounded-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => {
                      const wsPermissions = user.workspacePermissions?.[activeWorkspaceId] || user.permissions;
                      const wsCount = user.workspaceIds?.length || 0;

                      return (
                        <TableRow
                          key={user.id}
                          className={cn(
                            'group hover:bg-muted/20 transition-colors',
                            updatingId === user.id && 'opacity-50'
                          )}
                        >
                          {/* Member Column */}
                          <TableCell className="pl-5 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                onClick={() => setInspectingUser(user)}
                                className="relative shrink-0 cursor-pointer group/avatar"
                              >
                                <Avatar className="h-9.5 w-9.5 ring-2 ring-border/40 shadow-xs transition-transform group-hover/avatar:scale-105">
                                  <AvatarImage src={user.photoURL} alt={user.name} />
                                  <AvatarFallback className="font-bold text-[10px] bg-muted">
                                    {getInitials(user.name)}
                                  </AvatarFallback>
                                </Avatar>
                                {updatingId === user.id && (
                                  <div className="absolute inset-0 bg-card/70 rounded-full flex items-center justify-center">
                                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center flex-wrap gap-1.5">
                                  <button
                                    onClick={() => setInspectingUser(user)}
                                    className="font-semibold text-sm tracking-tight text-foreground hover:text-primary transition-colors text-left block truncate"
                                  >
                                    {user.name}
                                  </button>
                                  {user.approvalStatus === 'pending' && (
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[9px] font-bold uppercase tracking-wider h-4 px-1 shrink-0"
                                    >
                                      Pending Approval
                                    </Badge>
                                  )}
                                  {user.department && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[9px] font-semibold uppercase tracking-wider h-4 px-1.5 shrink-0 bg-muted/60 text-muted-foreground border-0 rounded-md"
                                    >
                                      {user.department}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground block truncate">{user.email}</span>
                                {wsCount > 0 && (
                                  <button
                                    onClick={() => setManagingWsUser(user)}
                                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline transition-colors"
                                  >
                                    <Building2 className="h-3 w-3" />
                                    {wsCount} workspace{wsCount !== 1 ? 's' : ''}
                                    <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Roles & Permissions Column */}
                          <TableCell>
                            <div className="flex flex-col gap-1.5">
                              <MultiSelect
                                options={roles?.map((r) => ({ label: r.name, value: r.id })) || []}
                                value={user.workspaceRoles?.[activeWorkspaceId] || user.roles || []}
                                onChange={(vals) => handleUpdateUser(user.id, { roles: vals })}
                                placeholder="Assign roles..."
                                className="border-none bg-muted/20 hover:bg-muted/40 shadow-none rounded-lg text-xs"
                              />
                              {wsPermissions && wsPermissions.length > 0 && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex flex-wrap gap-1 px-0.5">
                                        {wsPermissions.slice(0, 4).map((p) => (
                                          <Badge
                                            key={p}
                                            variant="secondary"
                                            className="h-[18px] text-[7px] font-semibold uppercase tracking-tight bg-muted/60 text-muted-foreground border-0 rounded-md px-1.5"
                                          >
                                            {p.replace(/_/g, ' ')}
                                          </Badge>
                                        ))}
                                        {wsPermissions.length > 4 && (
                                          <Badge
                                            variant="secondary"
                                            className="h-[18px] text-[7px] font-semibold bg-muted/40 text-muted-foreground/70 border-0 rounded-md px-1.5"
                                          >
                                            +{wsPermissions.length - 4}
                                          </Badge>
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs p-3 rounded-xl border-none shadow-2xl">
                                      <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-primary border-b pb-1.5">
                                          Effective Permissions
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                          {wsPermissions.map((p) => (
                                            <Badge key={p} className="text-[8px] font-bold uppercase tracking-tight h-5">
                                              {p.replace(/_/g, ' ')}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>

                          {/* Actions Column */}
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {user.approvalStatus === 'pending' ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleToggleAccess(user.id, true, user.name || 'User')}
                                    className="h-7.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase transition-all shadow-xs shrink-0 border-none active:scale-[0.97]"
                                    disabled={updatingId === user.id}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleDeclineRequest(user.id, user.name || 'User')}
                                    className="h-7.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold uppercase transition-all shadow-xs shrink-0 border-none active:scale-[0.97]"
                                    disabled={updatingId === user.id}
                                  >
                                    Decline
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 rounded-md hover:bg-amber-500/10 hover:text-amber-600 text-muted-foreground active:scale-[0.97]"
                                          onClick={() => handleResetPassword(user.id, user.name || 'User')}
                                          disabled={updatingId === user.id}
                                        >
                                          <Key className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-xs">Reset Password</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center px-1">
                                          <Switch
                                            checked={user.isAuthorized}
                                            onCheckedChange={(checked) =>
                                              handleToggleAccess(user.id, checked, user.name || 'User')
                                            }
                                            className="scale-[0.8]"
                                            disabled={updatingId === user.id}
                                          />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-xs">
                                        {user.isAuthorized ? 'Access Enabled' : 'Access Disabled'}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 text-muted-foreground active:scale-[0.97]"
                                          onClick={() => handleRemoveUser(user.id, user.name || 'User')}
                                          disabled={updatingId === user.id || user.id === currentUser?.uid}
                                        >
                                          <UserMinus className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-xs">
                                        {user.id === currentUser?.uid ? 'Cannot Remove Yourself' : 'Remove from Org'}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
                          <UserIcon className="h-10 w-10" />
                          <p className="text-xs font-semibold">
                            {searchQuery ? 'No matching members found' : 'No team members registered yet'}
                          </p>
                          {searchQuery && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSearchQuery('')}
                              className="text-xs text-muted-foreground h-8"
                            >
                              Clear Search Query
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View (< 768px) */}
            <div className="md:hidden space-y-3">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-36 w-full rounded-xl bg-card border" />
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const wsCount = user.workspaceIds?.length || 0;
                  const assignedRoleIds = user.workspaceRoles?.[activeWorkspaceId] || user.roles || [];
                  const assignedRoleNames = assignedRoleIds
                    .map((id) => roleMap.get(id)?.name)
                    .filter((n): n is string => Boolean(n));

                  return (
                    <div
                      key={user.id}
                      className="p-4 rounded-xl border bg-card/60 backdrop-blur-sm shadow-xs space-y-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div
                          onClick={() => setInspectingUser(user)}
                          className="flex items-center gap-3 cursor-pointer min-w-0"
                        >
                          <Avatar className="h-10 w-10 ring-2 ring-border/40 shadow-xs shrink-0">
                            <AvatarImage src={user.photoURL} alt={user.name} />
                            <AvatarFallback className="font-bold text-xs bg-muted">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-foreground truncate">{user.name}</h3>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>

                        {user.approvalStatus === 'pending' ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[9px] font-bold uppercase tracking-wider shrink-0"
                          >
                            Pending
                          </Badge>
                        ) : user.isAuthorized ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[9px] font-bold uppercase tracking-wider shrink-0"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[9px] font-bold uppercase tracking-wider shrink-0">
                            Disabled
                          </Badge>
                        )}
                      </div>

                      {/* Department & Workspaces */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                        <span className="text-muted-foreground">Department</span>
                        <span className="font-medium text-foreground">{user.department || 'Not Assigned'}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Workspaces</span>
                        <button
                          onClick={() => setManagingWsUser(user)}
                          className="inline-flex items-center gap-1 font-semibold text-primary"
                        >
                          <Building2 className="h-3 w-3" />
                          {wsCount} workspace{wsCount !== 1 ? 's' : ''}
                          <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                        </button>
                      </div>

                      {/* Roles Tagging */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground block">
                          Assigned Roles ({activeWorkspace?.name || 'Workspace'})
                        </span>
                        <MultiSelect
                          options={roles?.map((r) => ({ label: r.name, value: r.id })) || []}
                          value={assignedRoleIds}
                          onChange={(vals) => handleUpdateUser(user.id, { roles: vals })}
                          placeholder="Assign roles..."
                          className="w-full text-xs"
                        />
                      </div>

                      {/* Action Bar */}
                      <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                        {user.approvalStatus === 'pending' ? (
                          <div className="grid grid-cols-2 gap-2 w-full">
                            <Button
                              size="sm"
                              onClick={() => handleToggleAccess(user.id, true, user.name || 'User')}
                              className="h-9 min-h-[44px] bg-emerald-600 text-white rounded-lg text-xs font-semibold"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDeclineRequest(user.id, user.name || 'User')}
                              className="h-9 min-h-[44px] bg-rose-600 text-white rounded-lg text-xs font-semibold"
                            >
                              Decline
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setInspectingUser(user)}
                              className="h-9 min-h-[44px] text-xs font-medium flex-1 active:scale-[0.97]"
                            >
                              Inspect Details
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetPassword(user.id, user.name || 'User')}
                              className="h-9 min-h-[44px] text-xs font-medium text-amber-600 dark:text-amber-400 active:scale-[0.97]"
                            >
                              <Key className="w-3.5 h-3.5 mr-1" /> Reset
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center border rounded-xl bg-card/60 text-xs text-muted-foreground">
                  No matching members found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invite User Modal */}
        <InviteUserModal
          open={isInviteModalOpen}
          onOpenChange={setIsInviteModalOpen}
          roles={roles || []}
        />

        {/* Filter Drawer */}
        <PeopleFilterDrawer
          isOpen={isFilterDrawerOpen}
          onClose={() => setIsFilterDrawerOpen(false)}
          filters={advancedFilters}
          onApplyFilters={(f) => {
            setAdvancedFilters(f);
            if (f.status) setSelectedStatus(f.status);
          }}
          onResetFilters={() => {
            setAdvancedFilters({ status: 'all' });
            setSelectedStatus('all');
          }}
          workspaces={accessibleWorkspaces}
          roles={roles || []}
          departments={departments}
        />

        {/* Person Detail Drawer */}
        {inspectingUser && (
          <PersonProfileDrawer
            isOpen={Boolean(inspectingUser)}
            onClose={() => setInspectingUser(null)}
            user={inspectingUser}
            roles={roles || []}
            workspaces={accessibleWorkspaces}
            onManageWorkspaces={(u) => setManagingWsUser(u)}
            onProfileUpdated={(updated) => {
              setInspectingUser(updated);
            }}
          />
        )}

        {/* Workspace Membership Sheet */}
        {managingWsUser && (
          <WorkspaceMembershipSheet
            isOpen={Boolean(managingWsUser)}
            onClose={() => setManagingWsUser(null)}
            user={managingWsUser}
            roles={roles || []}
            workspaces={accessibleWorkspaces}
            onUpdated={(updated) => {
              setManagingWsUser(null);
            }}
          />
        )}
      </div>
    </PageContainerFluid>
  );
}