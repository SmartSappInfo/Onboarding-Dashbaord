'use client';

import * as React from 'react';
import { collection, orderBy, query, doc, updateDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { UserProfile, Role, AppPermissionId, PermissionsSchema } from '@/lib/types';
import { mergePermissionsSchemas } from '@/lib/permissions-engine';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User as UserIcon, ShieldCheck, Zap, Info, Loader2, ShieldEllipsis, UserPlus, Key, Building2, Search, Filter, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { MultiSelect } from '@/components/ui/multi-select';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/context/TenantContext';
import InviteUserModal from './components/InviteUserModal';
import WorkspaceAccessDialog from './components/WorkspaceAccessDialog';
import { adminResetUserPasswordAction } from '@/lib/user-invite-actions';

// Extracted outside component per rerender-no-inline-components
const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '?';

// Memoized role lookup map (js-index-maps)
function useRoleLookup(roles: Role[] | null | undefined) {
  return React.useMemo(() => {
    const map = new Map<string, Role>();
    roles?.forEach(r => map.set(r.id, r));
    return map;
  }, [roles]);
}

/**
 * @fileOverview Identity Hub — Workspace-scoped user management.
 * Features permission flattening, workspace access management, and role assignment.
 */
export default function UsersClient() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeOrganizationId, activeWorkspaceId, activeWorkspace, isSuperAdmin } = useTenant();
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false);
  const [accessDialogUser, setAccessDialogUser] = React.useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');

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

  // Filtered users (rerender-derived-state-no-effect: derive during render)
  const filteredUsers = React.useMemo(() => {
    if (!users || !searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u => 
      u.name?.toLowerCase().includes(q) || 
      u.email?.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  // 2. WORKSPACE-SCOPED PERMISSION FLATTENING ENGINE
  const handleUpdateUser = React.useCallback(async (userId: string, updates: Partial<UserProfile>) => {
    if (!firestore || !roles || !activeWorkspaceId) return;
    setUpdatingId(userId);

    const userDocRef = doc(firestore, 'users', userId);
    const currentUser = users?.find(u => u.id === userId);
    
    // If roles changed, flatten permissions for the active workspace
    if (updates.roles) {
        const selectedRoleObjects = roles.filter(r => updates.roles!.includes(r.id));
        
        // Compute workspace-scoped permissions
        const allPerms = new Set<AppPermissionId>();
        selectedRoleObjects.forEach(r => {
            if (r.permissions) r.permissions.forEach(p => allPerms.add(p));
        });

        // Compute workspace-scoped schema
        const schemas = selectedRoleObjects
            .map(r => r.permissionsSchema)
            .filter((s): s is PermissionsSchema => !!s);
        const mergedSchema = schemas.length > 0 ? mergePermissionsSchemas(schemas) : undefined;

        // Build workspace-scoped updates (merge with existing workspace data)
        const existingWsRoles = currentUser?.workspaceRoles || {};
        const existingWsPerms = currentUser?.workspacePermissions || {};
        const existingWsSchemas = currentUser?.workspacePermissionsSchemas || {};

        const newWorkspaceRoles = { ...existingWsRoles, [activeWorkspaceId]: updates.roles };
        const newWorkspacePermissions = { ...existingWsPerms, [activeWorkspaceId]: Array.from(allPerms) };
        const newWorkspacePermissionsSchemas = mergedSchema 
            ? { ...existingWsSchemas, [activeWorkspaceId]: mergedSchema }
            : existingWsSchemas;

        // Ensure workspaceIds includes the active workspace
        const workspaceIds = Array.from(new Set([...(currentUser?.workspaceIds || []), activeWorkspaceId]));

        // Also maintain legacy fields for backward compatibility
        updates.permissions = Array.from(allPerms);
        if (mergedSchema) updates.permissionsSchema = mergedSchema;

        // Merge workspace-specific fields into the update
        Object.assign(updates, {
            workspaceIds,
            workspaceRoles: newWorkspaceRoles,
            workspacePermissions: newWorkspacePermissions,
            workspacePermissionsSchemas: newWorkspacePermissionsSchemas,
        });
    }

    try {
        await updateDoc(userDocRef, { ...updates, updatedAt: new Date().toISOString() });
        toast({ title: 'Access Synchronized', description: `Workspace permissions updated for ${activeWorkspace?.name || 'current workspace'}.` });
    } catch (e) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'update',
          requestResourceData: updates,
        }));
        toast({ variant: 'destructive', title: 'Update Failed' });
    } finally {
        setUpdatingId(null);
    }
  }, [firestore, roles, activeWorkspaceId, users, activeWorkspace, toast]);

  const handleResetPassword = React.useCallback(async (userId: string, userName: string) => {
      if (!confirm(`Are you sure you want to reset the password for ${userName}? A new temporary password will be sent via Email/SMS.`)) return;
      
      setUpdatingId(userId);
      try {
          const result = await adminResetUserPasswordAction(userId);
          if (result.success) {
              toast({ title: 'Reset Successful', description: result.message });
          } else {
              throw new Error(result.error);
          }
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Reset Failed', description: error.message });
      } finally {
          setUpdatingId(null);
      }
  }, [toast]);

  // Helper: get human-readable role names for workspace
  const getUserRoleNames = React.useCallback((user: UserProfile): string[] => {
    const roleIds = user.workspaceRoles?.[activeWorkspaceId] || user.roles || [];
    return roleIds
      .map(id => roleMap.get(id)?.name)
      .filter((n): n is string => !!n);
  }, [activeWorkspaceId, roleMap]);

  if (error) return <div className="text-destructive p-8 text-left">Error loading registry: {error.message}</div>;

    return (
        <div className="h-full overflow-y-auto w-full">
            <div className="space-y-6 pb-32 w-full">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col items-start">
                        <h1 className="text-2xl font-black tracking-tight text-foreground">
                            Team Members
                        </h1>
                        <p className="text-muted-foreground text-xs mt-0.5">
                            Manage access, roles, and workspace permissions
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border font-semibold px-3 h-9 rounded-lg flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-xs tabular-nums">{users?.length || 0} members</span>
                        </Badge>
                        <Button asChild variant="outline" className="rounded-lg font-semibold h-9 px-4 border-border hover:bg-muted/50 transition-all text-foreground bg-transparent text-xs">
                            <Link href="/admin/users/roles" className="flex items-center gap-1.5">
                                <ShieldEllipsis className="h-3.5 w-3.5" /> Roles
                            </Link>
                        </Button>
                        <Button 
                            onClick={() => setIsInviteModalOpen(true)}
                            className="rounded-lg font-semibold h-9 px-4 shadow-sm transition-all hover:shadow-md active:scale-[0.98] text-xs"
                        >
                            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite
                        </Button>
                    </div>
                </div>

 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Role Sidebar */}
  <div className="lg:col-span-1 space-y-4">
  <Card className="rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
 <CardHeader className="bg-muted/30 border-b px-4 py-3">
 <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
 <Zap className="h-3 w-3 text-primary" /> Roles
                        </CardTitle>
                    </CardHeader>
 <CardContent className="p-3 space-y-1">
                        {isLoadingRoles ? (
 Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)
                        ) : roles?.map(r => (
 <div key={r.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/40 transition-colors group cursor-default text-left">
 <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
 <div className="min-w-0 flex-1">
   <span className="text-xs font-semibold tracking-tight block truncate">{r.name}</span>
   <p className="text-[9px] text-muted-foreground leading-snug line-clamp-1 opacity-0 group-hover:opacity-70 transition-opacity">
                                    {r.description}
                                </p>
 </div>
                            </div>
                        ))}
 <Separator className="opacity-40 my-2" />
 <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-start gap-2">
 <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
 <p className="text-[9px] text-muted-foreground leading-relaxed">
                                    Permissions are <span className="font-semibold text-foreground">additive</span> — users gain the union of all assigned role capabilities.
                                </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* User Table */}
 <div className="lg:col-span-3 space-y-3">
                {/* Search & Workspace Context Bar */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 rounded-lg bg-muted/30 border-border text-xs focus-visible:ring-1 focus-visible:ring-primary/20"
                        />
                    </div>
                    {activeWorkspace && (
                        <Badge variant="outline" className="h-9 px-3 rounded-lg bg-indigo-50 text-indigo-600 border-indigo-200 text-xs font-semibold flex items-center gap-1.5 shrink-0">
                            <Building2 className="h-3 w-3" />
                            {activeWorkspace.name}
                        </Badge>
                    )}
                </div>

 <div className="rounded-xl border border-border bg-card/50 shadow-sm overflow-hidden">
                    <Table>
 <TableHeader className="bg-muted/20">
                            <TableRow>
 <TableHead className="w-[280px] pl-5 text-muted-foreground text-[10px] uppercase tracking-widest font-bold py-3">Member</TableHead>
 <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold py-3">Roles & Permissions</TableHead>
 <TableHead className="w-[140px] text-center text-muted-foreground text-[10px] uppercase tracking-widest font-bold py-3">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
 <TableCell className="pl-5"><Skeleton className="h-10 w-48 rounded-lg" /></TableCell>
 <TableCell><Skeleton className="h-9 w-48 rounded-lg" /></TableCell>
 <TableCell className="text-center"><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredUsers?.length ? (
                                filteredUsers.map((user) => {
                                    const wsPermissions = user.workspacePermissions?.[activeWorkspaceId] || user.permissions;
                                    const wsCount = user.workspaceIds?.length || 0;

                                    return (
 <TableRow key={user.id} className={cn("group hover:bg-muted/20 transition-colors", updatingId === user.id && "opacity-50")}>
 {/* Member Column — Merged Profile + Identity */}
 <TableCell className="pl-5 py-4">
   <div className="flex items-center gap-3">
     <div className="relative shrink-0">
       <Avatar className="h-9 w-9 ring-2 ring-border/30 shadow-sm">
                                                    <AvatarImage src={user.photoURL} alt={user.name} />
       <AvatarFallback className="font-bold text-[10px] bg-muted">{getInitials(user.name)}</AvatarFallback>
                                                </Avatar>
                                                {updatingId === user.id && (
       <div className="absolute inset-0 bg-card/70 rounded-full flex items-center justify-center">
       <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
       <span className="font-semibold text-sm tracking-tight text-foreground block truncate">{user.name}</span>
       <span className="text-[10px] text-muted-foreground block truncate">{user.email}</span>
                                                {wsCount > 0 && (
                                                    <button
                                                        onClick={() => setAccessDialogUser(user)}
                                                        className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                                                    >
                                                        <Building2 className="h-2.5 w-2.5" />
                                                        {wsCount} workspace{wsCount !== 1 ? 's' : ''}
                                                        <ChevronDown className="h-2 w-2 opacity-50" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        </TableCell>

                                        {/* Roles & Permissions Column */}
 <TableCell>
 <div className="flex flex-col gap-1.5">
                                                <MultiSelect 
                                                    options={roles?.map(r => ({ label: r.name, value: r.id })) || []}
                                                    value={user.workspaceRoles?.[activeWorkspaceId] || user.roles || []}
                                                    onChange={(vals) => handleUpdateUser(user.id, { roles: vals })}
                                                    placeholder="Assign roles..."
 className="border-none bg-muted/20 hover:bg-muted/40 shadow-none rounded-lg"
                                                />
                                                {wsPermissions && wsPermissions.length > 0 && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
 <div className="flex flex-wrap gap-1 px-0.5">
                                                                    {wsPermissions.slice(0, 4).map(p => (
                                                                        <Badge key={p} variant="secondary" className="h-[18px] text-[7px] font-semibold uppercase tracking-tight bg-muted/60 text-muted-foreground border-0 rounded-md px-1.5">
                                                                            {p.replace(/_/g, ' ')}
                                                                        </Badge>
                                                                    ))}
                                                                    {wsPermissions.length > 4 && (
                                                                        <Badge variant="secondary" className="h-[18px] text-[7px] font-semibold bg-muted/40 text-muted-foreground/70 border-0 rounded-md px-1.5">
                                                                            +{wsPermissions.length - 4}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </TooltipTrigger>
 <TooltipContent className="max-w-xs p-3 rounded-xl border-none shadow-2xl">
 <div className="space-y-2">
 <p className="text-[10px] font-bold text-primary border-b pb-1.5">Effective Permissions</p>
 <div className="flex flex-wrap gap-1">
                                                                        {wsPermissions.map(p => (
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
                                            <div className="flex items-center justify-center gap-2">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-7 w-7 rounded-md hover:bg-amber-500/10 hover:text-amber-600 text-muted-foreground"
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
                                                            <div className="flex items-center">
                                                                <Switch
                                                                    checked={user.isAuthorized}
                                                                    onCheckedChange={(checked) => handleUpdateUser(user.id, { isAuthorized: checked })}
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
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
 <TableCell colSpan={3} className="h-48 text-center">
 <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground/30">
 <UserIcon className="h-10 w-10" />
 <p className="text-xs font-semibold">
                                            {searchQuery ? 'No matching members' : 'No team members yet'}
                                        </p>
                                        {searchQuery && (
                                            <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="text-xs text-muted-foreground">
                                                Clear search
                                            </Button>
                                        )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            </div>
            
            <InviteUserModal 
                open={isInviteModalOpen} 
                onOpenChange={setIsInviteModalOpen} 
                roles={roles || []} 
            />

            {accessDialogUser && (
                <WorkspaceAccessDialog
                    open={!!accessDialogUser}
                    onOpenChange={(open) => { if (!open) setAccessDialogUser(null); }}
                    user={users?.find(u => u.id === accessDialogUser.id) || accessDialogUser}
                    roles={roles || []}
                />
            )}
        </div>
    </div>
  );
}