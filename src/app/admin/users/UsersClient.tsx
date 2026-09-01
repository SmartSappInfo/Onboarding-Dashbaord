'use client';

/**
 * @fileOverview Identity, Workforce & People Hub 2.0 (`/admin/users` & `/admin/people`)
 *
 * Professional, industry-grade member and access governance center.
 * Conforms to `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`,
 * `frontend-design`, `ui-ux-pro-max`, and `table-filters`.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Unified 4-Tab Center: Directory, Teams & Departments, Invitations, and Access Requests.
 * - Multi-select bulk workforce action floating toolbar with safe chunking (<= 250 ops).
 * - Integrates PersonProfileDrawer and WorkspaceMembershipSheet.
 * - Responsive Mobile Card Reflow: card stack on mobile (<768px) and full table on desktop.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { collection, orderBy, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type {
  UserProfile,
  Role,
  Workspace,
  MembershipStatus,
  PeopleDirectoryFilter,
  Department,
  Team,
  PersonDetailView,
} from '@/lib/types';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  User as UserIcon,
  ShieldCheck,
  Zap,
  Info,
  Loader2,
  ShieldEllipsis,
  UserPlus,
  Building2,
  Search,
  Filter,
  SlidersHorizontal,
  Star,
  ExternalLink,
  Ban,
  CheckCircle2,
  Clock,
  Users,
  Mail,
  ShieldAlert,
  Building,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/context/TenantContext';

import { PeopleMetricsRibbon } from './components/PeopleMetricsRibbon';
import { PeopleFilterDrawer } from './components/PeopleFilterDrawer';
import { PersonProfileDrawer } from './components/PersonProfileDrawer';
import { WorkspaceMembershipSheet } from './components/WorkspaceMembershipSheet';
import { BulkActionsFloatingToolbar } from './components/BulkActionsFloatingToolbar';
import { TeamsDepartmentsManager } from './components/TeamsDepartmentsManager';
import { InvitationsManager } from './components/InvitationsManager';
import { AccessRequestsManager } from './components/AccessRequestsManager';
import { SavedViewsPillBar } from './components/SavedViewsPillBar';
import type { SavedDirectoryView } from '@/lib/types';
import { getPeopleDirectoryAction } from '@/app/actions/identity-actions';
import { listDepartmentsAction, listTeamsAction } from '@/app/actions/workforce-actions';
import {
  adminUpdateUserAccessAction,
  removeUserFromOrgAction,
} from '@/lib/user-invite-actions';

const getInitials = (name?: string) =>
  name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?';

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
  const { activeOrganizationId, activeWorkspaceId, accessibleWorkspaces } = useTenant();
  const { user: currentUser } = useUser();

  // Top Tab Navigation State
  const [activeTab, setActiveTab] = React.useState<'directory' | 'teams' | 'invitations' | 'requests'>('directory');

  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = React.useState(false);

  // Detail & Workspace Sheets State
  const [inspectingUser, setInspectingUser] = React.useState<UserProfile | null>(null);
  const [managingWsUser, setManagingWsUser] = React.useState<UserProfile | null>(null);

  // Multi-select Selection State for Bulk Actions
  const [selectedPersonIds, setSelectedPersonIds] = React.useState<string[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<MembershipStatus | 'all'>('all');
  const [activeViewId, setActiveViewId] = React.useState('preset_all');
  const [advancedFilters, setAdvancedFilters] = React.useState<PeopleDirectoryFilter>({
    status: 'all',
  });

  const handleSelectSavedView = (view: SavedDirectoryView) => {
    setActiveViewId(view.id);
    if (view.filters.status) {
      setSelectedStatus(view.filters.status as MembershipStatus);
    } else {
      setSelectedStatus('all');
    }
    setAdvancedFilters({
      department: view.filters.departmentId,
      teamId: view.filters.teamId,
      workspaceId: view.filters.workspaceId,
      roleId: view.filters.roleId,
    });
    if (view.filters.searchQuery) {
      setSearchQuery(view.filters.searchQuery);
    }
  };

  // Departments & Teams State
  const [canonicalDepartments, setCanonicalDepartments] = React.useState<Department[]>([]);
  const [canonicalTeams, setCanonicalTeams] = React.useState<Team[]>([]);
  const [canonicalPeople, setCanonicalPeople] = React.useState<PersonDetailView[]>([]);

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

  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);
  const { data: roles, isLoading: isLoadingRoles } = useCollection<Role>(rolesQuery);
  const roleMap = useRoleLookup(roles);

  const isLoading = isLoadingUsers || isLoadingRoles;

  // Load Canonical Departments, Teams, and People
  const loadWorkforceData = React.useCallback(async () => {
    if (!currentUser || !activeOrganizationId) return;
    try {
      const idToken = await currentUser.getIdToken();
      const [deptRes, teamRes, peopleRes] = await Promise.all([
        listDepartmentsAction({ idToken, organizationId: activeOrganizationId }),
        listTeamsAction({ idToken, organizationId: activeOrganizationId }),
        getPeopleDirectoryAction({ idToken, organizationId: activeOrganizationId }),
      ]);

      if (deptRes.success) setCanonicalDepartments(deptRes.departments);
      if (teamRes.success) setCanonicalTeams(teamRes.teams);
      if (peopleRes.success) setCanonicalPeople(peopleRes.people);
    } catch (err: unknown) {
      console.warn('[UsersClient] Error loading workforce metadata:', err);
    }
  }, [currentUser, activeOrganizationId]);

  React.useEffect(() => {
    loadWorkforceData();
  }, [loadWorkforceData]);

  // Extract unique departments for filter drawer
  const departmentNames = React.useMemo(() => {
    if (canonicalDepartments.length > 0) {
      return canonicalDepartments.map((d) => d.name);
    }
    if (!users) return [];
    const depts = new Set<string>();
    users.forEach((u) => {
      if (u.department) depts.add(u.department);
    });
    return Array.from(depts);
  }, [canonicalDepartments, users]);

  // Handle Multi-Select Checkboxes
  const handleToggleSelectAll = () => {
    if (!filteredUsers) return;
    if (selectedPersonIds.length === filteredUsers.length) {
      setSelectedPersonIds([]);
    } else {
      setSelectedPersonIds(filteredUsers.map((u) => u.id));
    }
  };

  const handleToggleSelectPerson = (personId: string) => {
    setSelectedPersonIds((prev) =>
      prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId]
    );
  };

  // Authorize / De-authorize user
  const handleToggleAuth = async (targetUser: UserProfile) => {
    if (!activeOrganizationId) return;
    setUpdatingId(targetUser.id);
    const newStatus = !targetUser.isAuthorized;

    try {
      const res = await adminUpdateUserAccessAction({
        targetUserId: targetUser.id,
        isAuthorized: newStatus,
        organizationId: activeOrganizationId,
      });

      if (res.success) {
        toast({
          title: newStatus ? 'Member Authorized' : 'Member Access Revoked',
          description: `${targetUser.name || targetUser.email} is now ${newStatus ? 'active' : 'suspended'}.`,
        });
        loadWorkforceData();
      } else {
        throw new Error(res.error || 'Failed to update access');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating access';
      toast({ title: 'Update Failed', description: msg, variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  // Remove member from organization
  const handleRemoveUser = async (targetUser: UserProfile) => {
    if (!activeOrganizationId) return;

    const ok = await confirm({
      title: 'Remove Member from Organization?',
      description: `Are you sure you want to remove ${targetUser.name || targetUser.email}? This will invalidate all workspace memberships.`,
      confirmText: 'Remove Member',
      variant: 'destructive',
    });
    if (!ok) return;

    setUpdatingId(targetUser.id);
    try {
      const res = await removeUserFromOrgAction({
        targetUserId: targetUser.id,
        organizationId: activeOrganizationId,
      });

      if (res.success) {
        toast({ title: 'Member Removed' });
        setSelectedPersonIds((prev) => prev.filter((id) => id !== targetUser.id));
        loadWorkforceData();
      } else {
        throw new Error(res.error || 'Failed to remove member');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error removing member';
      toast({ title: 'Removal Failed', description: msg, variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtered Users List
  const filteredUsers = React.useMemo(() => {
    if (!users) return [];

    return users.filter((u) => {
      // 1. Status Filter
      if (selectedStatus !== 'all') {
        const memStatus = u.membershipStatus || (u.isAuthorized ? 'active' : 'suspended');
        if (memStatus !== selectedStatus) return false;
      }
      if (advancedFilters.status && advancedFilters.status !== 'all') {
        const memStatus = u.membershipStatus || (u.isAuthorized ? 'active' : 'suspended');
        if (memStatus !== advancedFilters.status) return false;
      }

      // 2. Department Filter
      if (advancedFilters.department && u.department !== advancedFilters.department) {
        return false;
      }

      // 3. Workspace Filter
      if (advancedFilters.workspaceId) {
        const hasWs = u.workspaceIds?.includes(advancedFilters.workspaceId);
        if (!hasWs) return false;
      }

      // 4. Role Filter
      if (advancedFilters.roleId) {
        const hasRole =
          u.roles?.includes(advancedFilters.roleId) ||
          Object.values(u.workspaceRoles || {}).some((wsRoles) =>
            wsRoles.includes(advancedFilters.roleId!)
          );
        if (!hasRole) return false;
      }

      // 5. Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q))
      );
    });
  }, [users, selectedStatus, advancedFilters, searchQuery]);

  const allRolesList = roles || [];

  return (
    <div className="space-y-6 pb-32 w-full p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> People & Workforce Hub
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage organization members, workforce departments, squad teams, and cryptographic invitations
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button asChild variant="outline" size="sm" className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
            <Link href="/admin/users/roles">
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-primary" /> Roles Architecture
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setActiveTab('invitations')}
            className="rounded-lg font-semibold h-9 px-4 shadow-sm transition-all hover:shadow-md active:scale-[0.97] text-xs"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite Members
          </Button>
        </div>
      </div>

      {/* Main Top Tab Navigation */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'directory' | 'teams' | 'invitations' | 'requests')}>
        <TabsList className="h-10 bg-card border p-1 rounded-xl">
          <TabsTrigger value="directory" className="text-xs font-semibold px-4 h-8 data-[state=active]:bg-muted/60">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Directory ({users?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="teams" className="text-xs font-semibold px-4 h-8 data-[state=active]:bg-muted/60">
            <Building2 className="w-3.5 h-3.5 mr-1.5" /> Teams & Departments
          </TabsTrigger>
          <TabsTrigger value="invitations" className="text-xs font-semibold px-4 h-8 data-[state=active]:bg-muted/60">
            <Mail className="w-3.5 h-3.5 mr-1.5" /> Invitations
          </TabsTrigger>
          <TabsTrigger value="requests" className="text-xs font-semibold px-4 h-8 data-[state=active]:bg-muted/60">
            <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Access Requests
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Directory */}
        <TabsContent value="directory" className="space-y-6 pt-2 m-0">
          {/* Metrics Ribbon */}
          <PeopleMetricsRibbon
            users={users || []}
            selectedStatus={selectedStatus}
            onSelectStatus={setSelectedStatus}
          />

          {/* Saved Views Quick Filter Bar */}
          <SavedViewsPillBar
            activeViewId={activeViewId}
            onSelectView={handleSelectSavedView}
          />

          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8.5 text-xs bg-muted/20 border-border"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFilterDrawerOpen(true)}
                className="text-xs h-8.5 px-3 active:scale-[0.97]"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Filter Drawer
              </Button>
            </div>
          </div>

          {/* Directory Table */}
          <Card className="border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/20 border-b">
                  <TableRow>
                    <TableHead className="w-[40px] pl-4">
                      <Checkbox
                        checked={
                          filteredUsers.length > 0 && selectedPersonIds.length === filteredUsers.length
                        }
                        onCheckedChange={handleToggleSelectAll}
                        className="h-3.5 w-3.5"
                      />
                    </TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3">Member</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3">Department</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3">Workspaces & Roles</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3 text-center">Active</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold py-3 text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6} className="p-4">
                          <div className="h-8 bg-muted/40 animate-pulse rounded-md" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => {
                      const isSelected = selectedPersonIds.includes(user.id);
                      const assignedWorkspaces = accessibleWorkspaces.filter((w) =>
                        user.workspaceIds?.includes(w.id)
                      );

                      return (
                        <TableRow
                          key={user.id}
                          className={cn(
                            'hover:bg-muted/10 transition-colors',
                            isSelected && 'bg-primary/5'
                          )}
                        >
                          <TableCell className="pl-4">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelectPerson(user.id)}
                              className="h-3.5 w-3.5"
                            />
                          </TableCell>

                          <TableCell>
                            <div
                              onClick={() => setInspectingUser(user)}
                              className="flex items-center gap-2.5 cursor-pointer group"
                            >
                              <Avatar className="h-8 w-8 rounded-lg border">
                                <AvatarImage src={user.photoURL || undefined} />
                                <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                                  {getInitials(user.name || user.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="space-y-0.5 min-w-0">
                                <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors block truncate">
                                  {user.name || user.email.split('@')[0]}
                                </span>
                                <span className="text-[10px] text-muted-foreground block truncate">
                                  {user.email}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs text-foreground font-medium">
                              {user.department || '—'}
                            </span>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {assignedWorkspaces.length === 0 ? (
                                <span className="text-[10px] text-muted-foreground italic">No workspaces</span>
                              ) : (
                                assignedWorkspaces.map((ws) => (
                                  <Badge key={ws.id} variant="outline" className="text-[9px] py-0 bg-muted/30">
                                    <Building className="w-2.5 h-2.5 mr-1" />
                                    {ws.name}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <Switch
                              checked={user.isAuthorized}
                              disabled={updatingId === user.id}
                              onCheckedChange={() => handleToggleAuth(user)}
                              className="data-[state=checked]:bg-primary"
                            />
                          </TableCell>

                          <TableCell className="text-right pr-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setManagingWsUser(user)}
                                className="text-xs h-7 px-2 active:scale-[0.97]"
                              >
                                Workspaces
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setInspectingUser(user)}
                                className="text-xs h-7 px-2 active:scale-[0.97]"
                              >
                                Profile
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                        No team members match the search and filter criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Teams & Departments */}
        <TabsContent value="teams" className="pt-2 m-0">
          <TeamsDepartmentsManager
            departments={canonicalDepartments}
            teams={canonicalTeams}
            people={canonicalPeople}
            workspaces={accessibleWorkspaces}
            onRefresh={loadWorkforceData}
          />
        </TabsContent>

        {/* Tab 3: Invitations */}
        <TabsContent value="invitations" className="pt-2 m-0">
          <InvitationsManager
            roles={allRolesList}
            workspaces={accessibleWorkspaces}
            departments={canonicalDepartments}
            onRefresh={loadWorkforceData}
          />
        </TabsContent>

        {/* Tab 4: Access Requests */}
        <TabsContent value="requests" className="pt-2 m-0">
          <AccessRequestsManager onRefreshParent={loadWorkforceData} />
        </TabsContent>
      </Tabs>

      {/* Floating Bulk Actions Toolbar */}
      <BulkActionsFloatingToolbar
        selectedPersonIds={selectedPersonIds}
        onClearSelection={() => setSelectedPersonIds([])}
        roles={allRolesList}
        workspaces={accessibleWorkspaces}
        departments={canonicalDepartments}
        onActionCompleted={() => {
          loadWorkforceData();
        }}
      />

      {/* Slide-over Person Profile Drawer */}
      {inspectingUser && (
        <PersonProfileDrawer
          isOpen={Boolean(inspectingUser)}
          onClose={() => setInspectingUser(null)}
          user={inspectingUser}
          roles={allRolesList}
          workspaces={accessibleWorkspaces}
          people={canonicalPeople}
          onManageWorkspaces={(u) => {
            setManagingWsUser(u);
          }}
          onProfileUpdated={() => {
            loadWorkforceData();
          }}
        />
      )}

      {/* Slide-over Workspace Membership Sheet */}
      {managingWsUser && (
        <WorkspaceMembershipSheet
          isOpen={Boolean(managingWsUser)}
          onClose={() => setManagingWsUser(null)}
          user={managingWsUser}
          roles={allRolesList}
          workspaces={accessibleWorkspaces}
          onMembershipUpdated={() => {
            loadWorkforceData();
          }}
        />
      )}

      {/* Filter Drawer */}
      <PeopleFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        roles={allRolesList}
        workspaces={accessibleWorkspaces}
        departments={departmentNames}
        filters={advancedFilters}
        onApplyFilters={setAdvancedFilters}
        onResetFilters={() => setAdvancedFilters({ status: 'all' })}
      />
    </div>
  );
}