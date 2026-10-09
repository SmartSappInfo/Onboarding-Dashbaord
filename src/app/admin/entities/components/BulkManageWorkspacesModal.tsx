'use client';

import * as React from 'react';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  bulkLinkEntitiesToWorkspacesAction,
  bulkUnlinkEntitiesFromWorkspacesAction,
  type BulkWorkspaceOperationResult,
} from '@/lib/workspace-entity-actions';
import {
  Building2,
  Check,
  Loader2,
  Search,
  AlertTriangle,
  Info,
  Layers,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { areScopesCompatible } from '@/lib/scope-guard';
import { getErrorMessage } from '@/lib/errors/report-error';

export interface BulkWorkspaceEntityItem {
  id: string;
  entityId?: string;
  displayName?: string;
  name?: string;
  entityType?: string;
  workspaceIds?: string[];
}

export interface BulkManageWorkspacesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEntities: BulkWorkspaceEntityItem[];
  currentWorkspaceId?: string;
  onSuccess?: () => void;
  onComplete?: () => void;
}

/**
 * BulkManageWorkspacesModal
 *
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Standardized Modal Architecture (theme.md Section 8):
 *   - Demarcated header with CardInfoTooltip and sr-only DialogDescription.
 *   - Demarcated footer with min-h-[44px] touch targets and active:scale-[0.97].
 * - Rule 8 (Multi-Tenancy): Workspaces sourced exclusively from TenantContext accessibleWorkspaces.
 * - Rule 19 (Idempotency): Bulk assign skips existing assignments automatically.
 * - Rule 2 (Defensive Guardrails): Validates scope compatibility and warns on active workspace removal.
 */
export function BulkManageWorkspacesModal({
  open,
  onOpenChange,
  selectedEntities,
  currentWorkspaceId,
  onSuccess,
  onComplete,
}: BulkManageWorkspacesModalProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { accessibleWorkspaces } = useTenant();

  const [activeTab, setActiveTab] = React.useState<'assign' | 'remove'>('assign');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedAssignWorkspaceIds, setSelectedAssignWorkspaceIds] = React.useState<Set<string>>(new Set());
  const [selectedRemoveWorkspaceIds, setSelectedRemoveWorkspaceIds] = React.useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Map of workspaceId -> count of selected entities already assigned to that workspace
  const [workspaceMemberCounts, setWorkspaceMemberCounts] = React.useState<Map<string, number>>(new Map());
  const [isLoadingMemberships, setIsLoadingMemberships] = React.useState(false);

  const masterEntityIds = React.useMemo(() => {
    return Array.from(new Set(selectedEntities.map(e => e.entityId || e.id).filter(Boolean)));
  }, [selectedEntities]);

  const selectedCount = selectedEntities.length;

  // Reset local state when modal opens
  React.useEffect(() => {
    if (open) {
      setSelectedAssignWorkspaceIds(new Set());
      setSelectedRemoveWorkspaceIds(new Set());
      setSearchQuery('');
      setIsSubmitting(false);
    }
  }, [open]);

  // Load existing memberships for selected entities to calculate assigned counts per workspace
  React.useEffect(() => {
    if (!open || !firestore || masterEntityIds.length === 0) {
      setWorkspaceMemberCounts(new Map());
      return;
    }

    let isSubscribed = true;

    async function loadMemberships() {
      setIsLoadingMemberships(true);
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < masterEntityIds.length; i += 30) {
          chunks.push(masterEntityIds.slice(i, i + 30));
        }

        const counts = new Map<string, number>();

        for (const chunk of chunks) {
          const q = query(
            collection(firestore!, 'workspace_entities'),
            where('entityId', 'in', chunk)
          );
          const snap = await getDocs(q);
          snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.status !== 'archived' && typeof data.workspaceId === 'string') {
              counts.set(data.workspaceId, (counts.get(data.workspaceId) || 0) + 1);
            }
          });
        }

        if (isSubscribed) {
          setWorkspaceMemberCounts(counts);
        }
      } catch (err: unknown) {
        console.warn('[BulkManageWorkspacesModal] Error pre-loading memberships:', err);
      } finally {
        if (isSubscribed) {
          setIsLoadingMemberships(false);
        }
      }
    }

    loadMemberships();

    return () => {
      isSubscribed = false;
    };
  }, [open, firestore, masterEntityIds]);

  // Filter workspaces based on active status and search
  const filteredWorkspaces = React.useMemo(() => {
    return accessibleWorkspaces
      .filter(w => w.status === 'active')
      .filter(w => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          w.name.toLowerCase().includes(q) ||
          (w.contactScope && w.contactScope.toLowerCase().includes(q))
        );
      });
  }, [accessibleWorkspaces, searchQuery]);

  // Entity types present in selected collection
  const entityTypes = React.useMemo(() => {
    return Array.from(new Set(selectedEntities.map(e => e.entityType || 'institution')));
  }, [selectedEntities]);

  // Toggles for Assign Selection
  const toggleAssignWorkspace = (workspaceId: string) => {
    setSelectedAssignWorkspaceIds(prev => {
      const next = new Set(prev);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      return next;
    });
  };

  const selectAllAssign = () => {
    const compatible = filteredWorkspaces.filter(w => {
      return entityTypes.every(t => areScopesCompatible(t, w.contactScope || 'institution'));
    });
    setSelectedAssignWorkspaceIds(new Set(compatible.map(w => w.id)));
  };

  const clearAllAssign = () => {
    setSelectedAssignWorkspaceIds(new Set());
  };

  // Toggles for Remove Selection
  const toggleRemoveWorkspace = (workspaceId: string) => {
    setSelectedRemoveWorkspaceIds(prev => {
      const next = new Set(prev);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      return next;
    });
  };

  const selectAllRemove = () => {
    const withMembers = filteredWorkspaces.filter(w => (workspaceMemberCounts.get(w.id) || 0) > 0);
    setSelectedRemoveWorkspaceIds(new Set(withMembers.map(w => w.id)));
  };

  const clearAllRemove = () => {
    setSelectedRemoveWorkspaceIds(new Set());
  };

  // Execution: Bulk Assign
  const handleAssignSubmit = async () => {
    if (!user || selectedAssignWorkspaceIds.size === 0 || masterEntityIds.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const targetWorkspaceIds = Array.from(selectedAssignWorkspaceIds);
      const res: BulkWorkspaceOperationResult = await bulkLinkEntitiesToWorkspacesAction({
        entityIds: masterEntityIds,
        workspaceIds: targetWorkspaceIds,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to assign workspaces');
      }

      const assignedMsg = res.assignedCount === 1 ? '1 contact assignment created' : `${res.assignedCount} contact assignments created`;
      const skippedMsg = res.skippedExistingCount > 0 ? ` (${res.skippedExistingCount} already assigned and skipped)` : '';
      const scopeMsg = res.skippedIncompatibleCount > 0 ? ` (${res.skippedIncompatibleCount} skipped due to scope mismatch)` : '';

      toast({
        title: 'Workspaces Assigned Successfully',
        description: `${assignedMsg} across ${targetWorkspaceIds.length} workspace(s)${skippedMsg}${scopeMsg}.`,
      });

      onSuccess?.();
      onComplete?.();
      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Bulk Assignment Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execution: Bulk Remove
  const handleRemoveSubmit = async () => {
    if (!user || selectedRemoveWorkspaceIds.size === 0 || masterEntityIds.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const targetWorkspaceIds = Array.from(selectedRemoveWorkspaceIds);
      const res: BulkWorkspaceOperationResult = await bulkUnlinkEntitiesFromWorkspacesAction({
        entityIds: masterEntityIds,
        workspaceIds: targetWorkspaceIds,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to remove from workspaces');
      }

      const removedMsg = res.removedCount === 1 ? '1 contact membership removed' : `${res.removedCount} contact memberships removed`;

      toast({
        title: 'Workspaces Removed Successfully',
        description: `${removedMsg} across ${targetWorkspaceIds.length} workspace(s).`,
      });

      onSuccess?.();
      onComplete?.();
      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Bulk Removal Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Warning check: is current active workspace selected for removal?
  const isRemovingFromCurrent = currentWorkspaceId ? selectedRemoveWorkspaceIds.has(currentWorkspaceId) : false;
  const currentWorkspaceName = accessibleWorkspaces.find(w => w.id === currentWorkspaceId)?.name || 'active workspace';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Demarcated Header */}
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                Manage Workspaces for {selectedCount} Contact{selectedCount === 1 ? '' : 's'}
              </DialogTitle>
              <CardInfoTooltip text="Assign or remove all selected contacts across multiple workspaces. Contacts already assigned to a target workspace will be safely skipped without duplicate errors." />
            </div>
            <DialogDescription className="sr-only">
              Manage workspace memberships in bulk for {selectedCount} contacts
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Tabs Control */}
        <Tabs
          value={activeTab}
          onValueChange={(val: string) => setActiveTab(val as 'assign' | 'remove')}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-6 pt-3 pb-2 border-b border-border/60 bg-muted/5 flex items-center justify-between gap-4">
            <TabsList className="grid grid-cols-2 w-full max-w-[340px] rounded-xl h-10 p-1 bg-muted/40">
              <TabsTrigger
                value="assign"
                className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground min-h-[32px]"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Assign Workspaces
              </TabsTrigger>
              <TabsTrigger
                value="remove"
                className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground min-h-[32px]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove Workspaces
              </TabsTrigger>
            </TabsList>

            {/* Quick search input */}
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter workspaces..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-9 pl-8 pr-3 text-xs rounded-xl bg-background/50 border-input"
              />
            </div>
          </div>

          {/* ─── TAB 1: ASSIGN TO WORKSPACES ─── */}
          <TabsContent value="assign" className="flex-1 flex flex-col overflow-hidden m-0 focus-visible:outline-none">
            {/* Context Info Banner */}
            <div className="px-6 py-2.5 bg-primary/5 border-b border-primary/10 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 text-foreground/80">
                <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Selected contacts will be assigned to all checked workspaces. Existing assignments are preserved.</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllAssign}
                  className="h-7 px-2 text-[11px] font-semibold text-primary hover:text-primary/90"
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllAssign}
                  className="h-7 px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Workspaces Scrollable List */}
            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
              {filteredWorkspaces.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No active workspaces match your search.
                </div>
              ) : (
                filteredWorkspaces.map(ws => {
                  const isChecked = selectedAssignWorkspaceIds.has(ws.id);
                  const isCompatible = entityTypes.every(t => areScopesCompatible(t, ws.contactScope || 'institution'));
                  const alreadyAssignedCount = workspaceMemberCounts.get(ws.id) || 0;
                  const isAllAlreadyAssigned = alreadyAssignedCount === selectedCount && selectedCount > 0;

                  return (
                    <div
                      key={ws.id}
                      onClick={() => isCompatible && toggleAssignWorkspace(ws.id)}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-xl border transition-all select-none',
                        !isCompatible
                          ? 'opacity-50 border-border/40 bg-muted/10 cursor-not-allowed'
                          : isChecked
                          ? 'border-primary/50 bg-primary/5 cursor-pointer shadow-xs'
                          : 'border-border/60 bg-card hover:bg-muted/30 cursor-pointer'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                          checked={isChecked}
                          disabled={!isCompatible}
                          onCheckedChange={() => isCompatible && toggleAssignWorkspace(ws.id)}
                          className="h-4 w-4 rounded"
                        />
                        <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground truncate">{ws.name}</span>
                            {ws.contactScope && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono uppercase bg-muted/30">
                                {ws.contactScope}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            {isLoadingMemberships ? (
                              <span className="flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Checking presence...
                              </span>
                            ) : isAllAlreadyAssigned ? (
                              <span className="text-emerald-500 font-medium">All {selectedCount} already assigned</span>
                            ) : alreadyAssignedCount > 0 ? (
                              <span>{alreadyAssignedCount} of {selectedCount} currently assigned</span>
                            ) : (
                              <span>Not yet assigned to these contacts</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        {!isCompatible && (
                          <Badge variant="destructive" className="text-[10px] py-0.5 px-2">
                            Scope Mismatch
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Demarcated Footer for Assign */}
            <DialogFooter demarcated className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5">
              <span className="text-xs text-muted-foreground font-medium">
                {selectedAssignWorkspaceIds.size} workspace{selectedAssignWorkspaceIds.size === 1 ? '' : 's'} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="rounded-xl min-h-[44px] px-4 font-semibold text-xs active:scale-[0.97]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAssignSubmit}
                  disabled={isSubmitting || selectedAssignWorkspaceIds.size === 0}
                  className="rounded-xl min-h-[44px] px-5 font-semibold text-xs active:scale-[0.97] gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Assign to {selectedAssignWorkspaceIds.size} Workspace{selectedAssignWorkspaceIds.size === 1 ? '' : 's'}
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </TabsContent>

          {/* ─── TAB 2: REMOVE FROM WORKSPACES ─── */}
          <TabsContent value="remove" className="flex-1 flex flex-col overflow-hidden m-0 focus-visible:outline-none">
            {/* Warning Banner if current workspace is selected */}
            {isRemovingFromCurrent && (
              <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Active Workspace Warning:</strong> Removing contacts from <strong>{currentWorkspaceName}</strong> will remove them from your current view. Master contact identities will remain intact.
                </span>
              </div>
            )}

            {/* Context Info Banner */}
            <div className="px-6 py-2.5 bg-muted/20 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 text-foreground/80">
                <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>Select the workspaces to unlink the selected contacts from.</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllRemove}
                  className="h-7 px-2 text-[11px] font-semibold text-primary hover:text-primary/90"
                >
                  Select Active
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllRemove}
                  className="h-7 px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Workspaces Scrollable List for Removal */}
            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
              {filteredWorkspaces.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No active workspaces match your search.
                </div>
              ) : (
                filteredWorkspaces.map(ws => {
                  const isChecked = selectedRemoveWorkspaceIds.has(ws.id);
                  const memberCount = workspaceMemberCounts.get(ws.id) || 0;
                  const isCurrent = ws.id === currentWorkspaceId;

                  return (
                    <div
                      key={ws.id}
                      onClick={() => toggleRemoveWorkspace(ws.id)}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-xl border transition-all select-none cursor-pointer',
                        isChecked
                          ? 'border-destructive/50 bg-destructive/5 shadow-xs'
                          : 'border-border/60 bg-card hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleRemoveWorkspace(ws.id)}
                          className={cn(
                            'h-4 w-4 rounded',
                            isChecked && 'data-[state=checked]:bg-destructive data-[state=checked]:border-destructive'
                          )}
                        />
                        <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground truncate">{ws.name}</span>
                            {isCurrent && (
                              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono uppercase">
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            {isLoadingMemberships ? (
                              <span className="flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Checking presence...
                              </span>
                            ) : memberCount > 0 ? (
                              <span className="text-foreground/90 font-medium">{memberCount} of {selectedCount} contacts will be unlinked</span>
                            ) : (
                              <span>0 of {selectedCount} contacts currently in this workspace</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {memberCount > 0 && (
                        <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-mono text-muted-foreground border-border/80">
                          {memberCount} linked
                        </Badge>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Demarcated Footer for Remove */}
            <DialogFooter demarcated className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5">
              <span className="text-xs text-muted-foreground font-medium">
                {selectedRemoveWorkspaceIds.size} workspace{selectedRemoveWorkspaceIds.size === 1 ? '' : 's'} selected for removal
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="rounded-xl min-h-[44px] px-4 font-semibold text-xs active:scale-[0.97]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleRemoveSubmit}
                  disabled={isSubmitting || selectedRemoveWorkspaceIds.size === 0}
                  className="rounded-xl min-h-[44px] px-5 font-semibold text-xs active:scale-[0.97] gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Remove from {selectedRemoveWorkspaceIds.size} Workspace{selectedRemoveWorkspaceIds.size === 1 ? '' : 's'}
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
