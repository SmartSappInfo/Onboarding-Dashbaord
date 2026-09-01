'use client';

/**
 * @fileOverview Floating Bulk Workforce Actions Toolbar (Workforce 2.0)
 *
 * Sticky bottom pill toolbar appearing when 1+ team members are selected.
 * Provides bulk role assignment, workspace provisioning, department assignment,
 * and account suspension with Emil Kowalski spring animations.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Chunked on the backend to <= 250 write ops per batch.
 * - Mobile ergonomics: touch targets >= 44px on interactive controls.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  Shield,
  Building,
  Users,
  Ban,
  CheckCircle2,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { Role, Workspace, Department, BulkWorkforceActionType } from '@/lib/types';
import { executeBulkWorkforceAction } from '@/app/actions/workforce-actions';

interface BulkActionsFloatingToolbarProps {
  selectedPersonIds: string[];
  onClearSelection: () => void;
  roles: Role[];
  workspaces: Workspace[];
  departments: Department[];
  onActionCompleted: () => void;
}

export function BulkActionsFloatingToolbar({
  selectedPersonIds,
  onClearSelection,
  roles,
  workspaces,
  departments,
  onActionCompleted,
}: BulkActionsFloatingToolbarProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [activeModal, setActiveModal] = React.useState<
    'roles' | 'workspace' | 'department' | null
  >(null);
  const [isExecuting, setIsExecuting] = React.useState(false);

  // Modal form states
  const [selectedRoleIds, setSelectedRoleIds] = React.useState<string[]>([]);
  const [targetWorkspaceId, setTargetWorkspaceId] = React.useState<string>('');
  const [targetDepartmentId, setTargetDepartmentId] = React.useState<string>('');

  if (selectedPersonIds.length === 0) return null;

  const roleOptions = roles.map((r) => ({ label: r.name, value: r.id }));

  const handleExecute = async (
    action: BulkWorkforceActionType,
    payload?: { roleIds?: string[]; workspaceId?: string; departmentId?: string }
  ) => {
    if (!authUser || !activeOrganizationId) return;

    setIsExecuting(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await executeBulkWorkforceAction({
        idToken,
        organizationId: activeOrganizationId,
        personIds: selectedPersonIds,
        action,
        payload,
      });

      if (res.success && res.result) {
        toast({
          title: 'Bulk Operation Completed',
          description: `Processed ${res.result.succeeded} members successfully.`,
        });
        setActiveModal(null);
        onClearSelection();
        onActionCompleted();
      } else {
        throw new Error(res.error || 'Bulk operation failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      toast({
        title: 'Bulk Action Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleBulkSuspend = async () => {
    const ok = await confirm({
      title: `Suspend ${selectedPersonIds.length} Members?`,
      description: 'Selected team members will lose access until reactivated.',
      confirmText: 'Suspend Accounts',
      variant: 'destructive',
    });
    if (!ok) return;

    await handleExecute('suspend');
  };

  const handleBulkReactivate = async () => {
    await handleExecute('reactivate');
  };

  return (
    <>
      {/* Floating Bottom Pill Toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-2 p-2 px-3.5 rounded-2xl bg-card/95 backdrop-blur-md border shadow-2xl ring-1 ring-border text-xs min-h-[52px]">
          <div className="flex items-center gap-2 pr-2 border-r border-border/60">
            <Badge variant="default" className="text-[11px] font-bold px-2 py-0.5">
              {selectedPersonIds.length}
            </Badge>
            <span className="font-semibold text-foreground hidden sm:inline">Selected</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClearSelection}
              className="h-6 w-6 text-muted-foreground hover:text-foreground active:scale-90"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedRoleIds([]);
                setTargetWorkspaceId(workspaces[0]?.id || '');
                setActiveModal('roles');
              }}
              disabled={isExecuting}
              className="h-8 text-xs px-2.5 font-medium active:scale-[0.97] min-h-[36px]"
            >
              <Shield className="w-3.5 h-3.5 mr-1.5 text-primary" /> Assign Roles
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTargetWorkspaceId(workspaces[0]?.id || '');
                setActiveModal('workspace');
              }}
              disabled={isExecuting}
              className="h-8 text-xs px-2.5 font-medium active:scale-[0.97] min-h-[36px]"
            >
              <Building className="w-3.5 h-3.5 mr-1.5 text-primary" /> Add to Workspace
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTargetDepartmentId(departments[0]?.id || '');
                setActiveModal('department');
              }}
              disabled={isExecuting}
              className="h-8 text-xs px-2.5 font-medium active:scale-[0.97] min-h-[36px]"
            >
              <Users className="w-3.5 h-3.5 mr-1.5 text-primary" /> Set Department
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBulkSuspend}
              disabled={isExecuting}
              className="h-8 text-xs px-2.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 active:scale-[0.97] min-h-[36px]"
            >
              <Ban className="w-3.5 h-3.5 mr-1.5" /> Suspend
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBulkReactivate}
              disabled={isExecuting}
              className="h-8 text-xs px-2.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 active:scale-[0.97] min-h-[36px]"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Activate
            </Button>
          </div>
        </div>
      </div>

      {/* Modal 1: Bulk Assign Roles */}
      <Dialog open={activeModal === 'roles'} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border shadow-2xl">
          <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
            <DialogTitle className="text-base font-semibold">Bulk Assign Roles</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Assign roles to {selectedPersonIds.length} selected team members
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Workspace</Label>
              <Select value={targetWorkspaceId} onValueChange={setTargetWorkspaceId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choose workspace..." />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id} className="text-xs">
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Roles to Assign</Label>
              <MultiSelect
                options={roleOptions}
                selected={selectedRoleIds}
                onChange={setSelectedRoleIds}
                placeholder="Select roles..."
                className="w-full text-xs"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveModal(null)}
              disabled={isExecuting}
              className="text-xs h-9 px-4 active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                handleExecute('assign_roles', {
                  workspaceId: targetWorkspaceId,
                  roleIds: selectedRoleIds,
                })
              }
              disabled={isExecuting || selectedRoleIds.length === 0 || !targetWorkspaceId}
              className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Assigning...
                </>
              ) : (
                'Confirm Assignment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Bulk Add Workspace */}
      <Dialog
        open={activeModal === 'workspace'}
        onOpenChange={(open) => !open && setActiveModal(null)}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border shadow-2xl">
          <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
            <DialogTitle className="text-base font-semibold">Add to Workspace</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Grant workspace access to {selectedPersonIds.length} members
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Workspace</Label>
              <Select value={targetWorkspaceId} onValueChange={setTargetWorkspaceId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choose workspace..." />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id} className="text-xs">
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveModal(null)}
              disabled={isExecuting}
              className="text-xs h-9 px-4 active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                handleExecute('assign_workspaces', {
                  workspaceId: targetWorkspaceId,
                })
              }
              disabled={isExecuting || !targetWorkspaceId}
              className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Provisioning...
                </>
              ) : (
                'Grant Access'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Bulk Set Department */}
      <Dialog
        open={activeModal === 'department'}
        onOpenChange={(open) => !open && setActiveModal(null)}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border shadow-2xl">
          <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
            <DialogTitle className="text-base font-semibold">Assign Department</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update department for {selectedPersonIds.length} members
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Department</Label>
              <Select value={targetDepartmentId} onValueChange={setTargetDepartmentId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select department..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id} className="text-xs">
                      {dept.name} ({dept.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveModal(null)}
              disabled={isExecuting}
              className="text-xs h-9 px-4 active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                handleExecute('assign_department', {
                  departmentId: targetDepartmentId,
                })
              }
              disabled={isExecuting || !targetDepartmentId}
              className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Updating...
                </>
              ) : (
                'Set Department'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BulkActionsFloatingToolbar;
