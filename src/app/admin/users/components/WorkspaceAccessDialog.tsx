'use client';

import * as React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { UserProfile, Role, PermissionsSchema, AppPermissionId, Workspace } from '@/lib/types';
import { mergePermissionsSchemas } from '@/lib/permissions-engine';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MultiSelect } from '@/components/ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    Building2,
    Plus,
    Trash2,
    ShieldCheck,
    Loader2,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkspaceAccessDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: UserProfile;
    roles: Role[];
}

/**
 * @fileOverview Workspace Access Manager Dialog.
 * 
 * Allows admins to view and manage which workspaces a user belongs to,
 * assign roles per workspace, and add/remove workspace memberships.
 */
export default function WorkspaceAccessDialog({
    open,
    onOpenChange,
    user,
    roles,
}: WorkspaceAccessDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { accessibleWorkspaces } = useTenant();

    const [isUpdating, setIsUpdating] = React.useState(false);
    const [addingWorkspaceId, setAddingWorkspaceId] = React.useState<string | null>(null);
    const [newRoles, setNewRoles] = React.useState<string[]>([]);

    // Workspaces the user currently belongs to
    const memberWorkspaces = React.useMemo(() => {
        const wsIds = user.workspaceIds || [];
        return accessibleWorkspaces.filter(w => wsIds.includes(w.id));
    }, [user.workspaceIds, accessibleWorkspaces]);

    // Workspaces the user does NOT belong to
    const availableWorkspaces = React.useMemo(() => {
        const wsIds = new Set(user.workspaceIds || []);
        return accessibleWorkspaces.filter(w => !wsIds.has(w.id));
    }, [user.workspaceIds, accessibleWorkspaces]);

    // Get role names for a workspace
    const getRoleNames = (workspaceId: string): string[] => {
        const roleIds = user.workspaceRoles?.[workspaceId] || [];
        return roleIds
            .map(id => roles.find(r => r.id === id)?.name)
            .filter((n): n is string => !!n);
    };

    // Add user to a new workspace with selected roles
    const handleAddToWorkspace = async () => {
        if (!firestore || !addingWorkspaceId || newRoles.length === 0) return;
        setIsUpdating(true);

        try {
            const userDocRef = doc(firestore, 'users', user.id);

            // Compute permissions for the new workspace
            const selectedRoleObjects = roles.filter(r => newRoles.includes(r.id));
            const allPerms = new Set<AppPermissionId>();
            selectedRoleObjects.forEach(r => {
                if (r.permissions) r.permissions.forEach(p => allPerms.add(p));
            });

            const schemas = selectedRoleObjects
                .map(r => r.permissionsSchema)
                .filter((s): s is PermissionsSchema => !!s);
            const mergedSchema = schemas.length > 0 ? mergePermissionsSchemas(schemas) : undefined;

            // Merge with existing workspace data
            const existingWsRoles = user.workspaceRoles || {};
            const existingWsPerms = user.workspacePermissions || {};
            const existingWsSchemas = user.workspacePermissionsSchemas || {};
            const existingWsIds = user.workspaceIds || [];

            const updates: Partial<UserProfile> = {
                workspaceIds: [...new Set([...existingWsIds, addingWorkspaceId])],
                workspaceRoles: { ...existingWsRoles, [addingWorkspaceId]: newRoles },
                workspacePermissions: { ...existingWsPerms, [addingWorkspaceId]: Array.from(allPerms) },
                ...(mergedSchema && {
                    workspacePermissionsSchemas: { ...existingWsSchemas, [addingWorkspaceId]: mergedSchema },
                }),
            };

            await updateDoc(userDocRef, { ...updates, updatedAt: new Date().toISOString() });

            const wsName = accessibleWorkspaces.find(w => w.id === addingWorkspaceId)?.name || 'workspace';
            toast({ title: 'Access Granted', description: `${user.name} added to ${wsName}.` });
            setAddingWorkspaceId(null);
            setNewRoles([]);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed', description: e.message });
        } finally {
            setIsUpdating(false);
        }
    };

    // Remove user from a workspace
    const handleRemoveFromWorkspace = async (workspaceId: string) => {
        if (!firestore) return;

        const wsName = accessibleWorkspaces.find(w => w.id === workspaceId)?.name || 'workspace';
        if (!confirm(`Remove ${user.name} from "${wsName}"? They will lose all roles and permissions in that workspace.`)) return;

        setIsUpdating(true);

        try {
            const userDocRef = doc(firestore, 'users', user.id);

            const updatedWsIds = (user.workspaceIds || []).filter(id => id !== workspaceId);
            const updatedWsRoles = { ...(user.workspaceRoles || {}) };
            const updatedWsPerms = { ...(user.workspacePermissions || {}) };
            const updatedWsSchemas = { ...(user.workspacePermissionsSchemas || {}) };

            delete updatedWsRoles[workspaceId];
            delete updatedWsPerms[workspaceId];
            delete updatedWsSchemas[workspaceId];

            await updateDoc(userDocRef, {
                workspaceIds: updatedWsIds,
                workspaceRoles: updatedWsRoles,
                workspacePermissions: updatedWsPerms,
                workspacePermissionsSchemas: updatedWsSchemas,
                updatedAt: new Date().toISOString(),
            });

            toast({ title: 'Access Revoked', description: `${user.name} removed from ${wsName}.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed', description: e.message });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg rounded-2xl border-none shadow-2xl bg-background/95 backdrop-blur-xl ring-1 ring-border p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-xl ring-1 ring-primary/20">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-black tracking-tight">
                                Workspace Access
                            </DialogTitle>
                            <DialogDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                                {user.name} · {memberWorkspaces.length} workspace{memberWorkspaces.length !== 1 ? 's' : ''}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="max-h-[420px]">
                    <div className="p-6 space-y-4">
                        {/* Current Workspace Memberships */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                Active Memberships
                            </p>

                            {memberWorkspaces.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground/40">
                                    <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-xs font-semibold">No workspace access</p>
                                </div>
                            ) : (
                                memberWorkspaces.map(ws => {
                                    const roleNames = getRoleNames(ws.id);
                                    return (
                                        <div
                                            key={ws.id}
                                            className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 group hover:border-border transition-all"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
                                                    style={{ backgroundColor: ws.color || '#6366f1' }}
                                                >
                                                    {ws.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold truncate">{ws.name}</p>
                                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                                        {roleNames.length > 0 ? (
                                                            roleNames.map(name => (
                                                                <Badge
                                                                    key={name}
                                                                    variant="secondary"
                                                                    className="text-[8px] font-bold h-4 bg-primary/5 text-primary px-1.5"
                                                                >
                                                                    {name}
                                                                </Badge>
                                                            ))
                                                        ) : (
                                                            <span className="text-[9px] text-muted-foreground italic">No roles assigned</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                                                onClick={() => handleRemoveFromWorkspace(ws.id)}
                                                disabled={isUpdating}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {availableWorkspaces.length > 0 && (
                            <>
                                <Separator className="opacity-50" />

                                {/* Add to Workspace */}
                                <div className="space-y-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        Add to Workspace
                                    </p>

                                    {!addingWorkspaceId ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {availableWorkspaces.map(ws => (
                                                <button
                                                    key={ws.id}
                                                    onClick={() => setAddingWorkspaceId(ws.id)}
                                                    className="flex items-center gap-2 p-2.5 rounded-xl border border-dashed border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all group text-left"
                                                >
                                                    <div
                                                        className="w-6 h-6 rounded-md flex items-center justify-center text-white font-bold text-[9px] shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                                                        style={{ backgroundColor: ws.color || '#6366f1' }}
                                                    >
                                                        {ws.name.charAt(0)}
                                                    </div>
                                                    <span className="text-xs font-semibold truncate text-muted-foreground group-hover:text-foreground transition-colors">
                                                        {ws.name}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-4 w-4 text-primary" />
                                                    <span className="text-sm font-bold">
                                                        {accessibleWorkspaces.find(w => w.id === addingWorkspaceId)?.name}
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => {
                                                        setAddingWorkspaceId(null);
                                                        setNewRoles([]);
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>

                                            <MultiSelect
                                                options={roles.map(r => ({ label: r.name, value: r.id }))}
                                                value={newRoles}
                                                onChange={setNewRoles}
                                                placeholder="Select roles to assign..."
                                                className="bg-background border-border"
                                            />

                                            <Button
                                                onClick={handleAddToWorkspace}
                                                disabled={newRoles.length === 0 || isUpdating}
                                                className="w-full rounded-xl font-bold h-10 shadow-lg shadow-primary/20"
                                            >
                                                {isUpdating ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : (
                                                    <Plus className="h-4 w-4 mr-2" />
                                                )}
                                                Grant Access
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
