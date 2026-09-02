'use client';

/**
 * @fileOverview Workspace Membership & Role Architecture Sheet (Identity & Access 2.0)
 *
 * Slide-over sheet for managing a person's workspace memberships, assigning per-workspace
 * roles, setting the primary operational workspace, and previewing effective CRUD capabilities.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Uses Server Action `manageWorkspaceMembershipsAction` with atomic dual-write projection sync.
 * - Conforms to `emilkowal-animations`: spring transitions, asymmetric duration, responsive mobile sheet.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MultiSelect } from '@/components/ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { Building2, Shield, Star, Plus, Trash2, Check, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserProfile, Role, Workspace, WorkspaceMembership, PersonDetailView } from '@/lib/types';
import { manageWorkspaceMembershipsAction } from '@/app/actions/identity-actions';

interface WorkspaceMembershipSheetProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  personDetail?: PersonDetailView | null;
  roles: Role[];
  workspaces: Workspace[];
  onUpdated?: (updatedProfile: UserProfile) => void;
  onMembershipUpdated?: (updatedProfile?: UserProfile) => void;
}

interface WorkspaceAssignmentState {
  workspaceId: string;
  workspaceName: string;
  roleAssignmentIds: string[];
  isPrimary: boolean;
  isActive: boolean;
}

export function WorkspaceMembershipSheet({
  isOpen,
  onClose,
  user,
  personDetail,
  roles,
  workspaces,
  onUpdated,
  onMembershipUpdated,
}: WorkspaceMembershipSheetProps) {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [isSaving, setIsSaving] = React.useState(false);
  const [assignments, setAssignments] = React.useState<WorkspaceAssignmentState[]>([]);

  // Initialize assignments state
  React.useEffect(() => {
    if (!isOpen) return;

    const userWsIds = new Set(user.workspaceIds || []);
    const existingRolesMap = user.workspaceRoles || {};
    const primaryId = user.lastActiveWorkspaceId || user.defaultWorkspaceId || user.workspaceIds?.[0];

    const initial: WorkspaceAssignmentState[] = workspaces.map((ws) => {
      const isMember = userWsIds.has(ws.id);
      const assignedRoleIds = existingRolesMap[ws.id] || user.roles || [];

      return {
        workspaceId: ws.id,
        workspaceName: ws.name || 'Workspace',
        roleAssignmentIds: assignedRoleIds,
        isPrimary: isMember && ws.id === primaryId,
        isActive: isMember,
      };
    });

    // Sort active memberships to top
    initial.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
    setAssignments(initial);
  }, [user, workspaces, isOpen]);

  // Toggle workspace active status
  const handleToggleWorkspace = (workspaceId: string, active: boolean) => {
    setAssignments((prev) =>
      prev.map((item) => {
        if (item.workspaceId !== workspaceId) return item;

        // If activating and no roles selected, give first default role or first available role
        const defaultRoleIds =
          item.roleAssignmentIds.length > 0
            ? item.roleAssignmentIds
            : roles.length > 0
            ? [roles[0].id]
            : [];

        // If activating and no other active workspace is primary, make this primary
        const hasOtherPrimary = prev.some((p) => p.workspaceId !== workspaceId && p.isActive && p.isPrimary);

        return {
          ...item,
          isActive: active,
          roleAssignmentIds: active ? defaultRoleIds : [],
          isPrimary: active && !hasOtherPrimary ? true : false,
        };
      })
    );
  };

  // Set primary workspace
  const handleSetPrimary = (workspaceId: string) => {
    setAssignments((prev) =>
      prev.map((item) => ({
        ...item,
        isPrimary: item.workspaceId === workspaceId,
      }))
    );
  };

  // Update roles for workspace
  const handleUpdateRoles = (workspaceId: string, roleIds: string[]) => {
    setAssignments((prev) =>
      prev.map((item) =>
        item.workspaceId === workspaceId
          ? { ...item, roleAssignmentIds: roleIds }
          : item
      )
    );
  };

  // Save changes
  const handleSave = async () => {
    if (!authUser || !activeOrganizationId) {
      toast({
        title: 'Authentication Error',
        description: 'You must be signed in to manage workspace access.',
        variant: 'destructive',
      });
      return;
    }

    const activeAssignments = assignments.filter((a) => a.isActive);

    // Validate that at least one workspace has roles assigned
    for (const a of activeAssignments) {
      if (a.roleAssignmentIds.length === 0) {
        toast({
          title: 'Role Required',
          description: `Please select at least one role for ${a.workspaceName}.`,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const idToken = await authUser.getIdToken();
      const payload = activeAssignments.map((a) => ({
        workspaceId: a.workspaceId,
        workspaceName: a.workspaceName,
        roleAssignmentIds: a.roleAssignmentIds,
        roleNames: a.roleAssignmentIds.map((rId) => roles.find((r) => r.id === rId)?.name || rId),
        isPrimary: a.isPrimary,
      }));

      const res = await manageWorkspaceMembershipsAction({
        idToken,
        organizationId: activeOrganizationId,
        personId: user.id,
        memberships: payload,
      });

      if (res.success && res.userProfile) {
        toast({
          title: 'Workspace Access Updated',
          description: `Successfully updated workspace memberships for ${user.name}.`,
        });
        if (onUpdated) onUpdated(res.userProfile);
        if (onMembershipUpdated) onMembershipUpdated(res.userProfile);
        onClose();
      } else {
        throw new Error(res.error || 'Failed to update memberships');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Update Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const roleOptions = React.useMemo(
    () =>
      roles.map((r) => ({
        value: r.id,
        label: r.name,
      })),
    [roles]
  );

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col justify-between bg-card border-l shadow-2xl"
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Header */}
          <SheetHeader className="p-5 pb-4 border-b bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold">Workspace Access & Roles</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Configure operational workspaces and assigned permissions for <span className="font-medium text-foreground">{user.name}</span>
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Body */}
          <div className="p-5 space-y-4">
            <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground flex items-start gap-2">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                Assigning multiple roles to a workspace merges permissions additively using OR-logic. The primary workspace is the default entry point upon sign-in.
              </span>
            </div>

            <div className="space-y-3">
              {assignments.map((item) => (
                <div
                  key={item.workspaceId}
                  className={cn(
                    'p-4 rounded-xl border transition-all duration-200 space-y-3',
                    item.isActive ? 'bg-card border-border shadow-xs' : 'bg-muted/10 border-dashed border-border/60 opacity-60'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Switch
                        checked={item.isActive}
                        onCheckedChange={(checked) => handleToggleWorkspace(item.workspaceId, checked)}
                        className="data-[state=checked]:bg-primary"
                      />
                      <div>
                        <div className="text-sm font-semibold flex items-center gap-2">
                          {item.workspaceName}
                          {item.isActive && item.isPrimary && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">
                              <Star className="w-3 h-3 mr-0.5 fill-amber-500" /> Primary
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.isActive ? 'Access Enabled' : 'No Access'}
                        </p>
                      </div>
                    </div>

                    {item.isActive && (
                      <Button
                        type="button"
                        variant={item.isPrimary ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => handleSetPrimary(item.workspaceId)}
                        disabled={item.isPrimary}
                        className="text-xs h-8 px-2.5 active:scale-[0.97]"
                      >
                        <Star className={cn('w-3.5 h-3.5 mr-1', item.isPrimary && 'fill-primary text-primary')} />
                        {item.isPrimary ? 'Primary' : 'Make Primary'}
                      </Button>
                    )}
                  </div>

                  {item.isActive && (
                    <div className="pt-2 border-t border-border/40 space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" /> Assigned Roles
                      </Label>
                      <MultiSelect
                        options={roleOptions}
                        value={item.roleAssignmentIds}
                        onChange={(selected) => handleUpdateRoles(item.workspaceId, selected)}
                        placeholder="Select workspace roles..."
                        className="w-full text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="text-xs h-10 min-h-[44px] px-4 active:scale-[0.97]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs h-10 min-h-[44px] px-5 font-medium active:scale-[0.97]"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving Changes...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" /> Save Workspace Access
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default WorkspaceMembershipSheet;
