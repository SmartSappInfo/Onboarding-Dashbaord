'use client';

import * as React from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { WorkspaceEntity, Workspace, Pipeline, OnboardingStage } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import {
  linkEntityToWorkspaceAction,
  unlinkEntityFromWorkspaceAction,
} from '@/lib/workspace-entity-actions';
import {
  Share2,
  Plus,
  Building2,
  Workflow,
  Check,
  Loader2,
  X,
  Globe,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManageWorkspacesModalProps {
  entityId: string;
  entityType: string;
  entityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ManageWorkspacesModal({
  entityId,
  entityType,
  entityName,
  open,
  onOpenChange,
}: ManageWorkspacesModalProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeOrganizationId, accessibleWorkspaces } = useTenant();

  const [expandedWorkspaceId, setExpandedWorkspaceId] = React.useState<string | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string | null>(null);
  const [removingWeId, setRemovingWeId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // 1. All workspace_entities for this entity (cross-workspace)
  const membershipsQuery = useMemoFirebase(() => {
    if (!firestore || !entityId || !open) return null;
    return query(
      collection(firestore, 'workspace_entities'),
      where('entityId', '==', entityId),
    );
  }, [firestore, entityId, open]);
  const { data: memberships, isLoading: isLoadingMemberships } =
    useCollection<WorkspaceEntity>(membershipsQuery);

  // 2. Pipelines for the workspace currently being expanded
  const pipelinesQuery = useMemoFirebase(() => {
    if (!firestore || !expandedWorkspaceId) return null;
    return query(
      collection(firestore, 'pipelines'),
      where('workspaceIds', 'array-contains', expandedWorkspaceId),
      orderBy('name', 'asc'),
    );
  }, [firestore, expandedWorkspaceId]);
  const { data: availablePipelines, isLoading: isLoadingPipelines } =
    useCollection<Pipeline>(pipelinesQuery);

  // Derived: workspace id → name lookup from tenant context (already loaded)
  const workspaceMap = React.useMemo(
    () => new Map(accessibleWorkspaces.map(w => [w.id, w])),
    [accessibleWorkspaces],
  );

  // Active memberships (non-archived)
  const activeMemberships = React.useMemo(
    () => (memberships || []).filter(m => m.status !== 'archived'),
    [memberships],
  );

  // Member workspace IDs for exclusion
  const memberWorkspaceIds = React.useMemo(
    () => new Set(activeMemberships.map(m => m.workspaceId)),
    [activeMemberships],
  );

  // Compatible workspaces not yet linked
  const unlinkedWorkspaces = React.useMemo(
    () =>
      accessibleWorkspaces.filter(
        w =>
          w.status === 'active' &&
          w.contactScope === entityType &&
          !memberWorkspaceIds.has(w.id),
      ),
    [accessibleWorkspaces, entityType, memberWorkspaceIds],
  );

  const handleToggleExpand = (workspaceId: string) => {
    if (expandedWorkspaceId === workspaceId) {
      setExpandedWorkspaceId(null);
      setSelectedPipelineId(null);
    } else {
      setExpandedWorkspaceId(workspaceId);
      setSelectedPipelineId(null);
    }
  };

  const handleAddToWorkspace = async (targetWorkspace: Workspace) => {
    if (!user || !selectedPipelineId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Resolve first stage of selected pipeline
      const stagesSnap = await getDocs(
        query(
          collection(firestore!, 'onboardingStages'),
          where('pipelineId', '==', selectedPipelineId),
          orderBy('order', 'asc'),
          limit(1),
        ),
      );
      if (stagesSnap.empty) throw new Error('Selected pipeline has no stages.');
      const firstStage = {
        id: stagesSnap.docs[0].id,
        ...stagesSnap.docs[0].data(),
      } as OnboardingStage;

      const result = await linkEntityToWorkspaceAction({
        entityId,
        workspaceId: targetWorkspace.id,
        pipelineId: selectedPipelineId,
        stageId: firstStage.id,
        userId: user.uid,
        userName: user.displayName || undefined,
        userEmail: user.email || undefined,
      });

      if (result.success) {
        toast({
          title: 'Added to Workspace',
          description: `"${entityName}" is now active in ${targetWorkspace.name}.`,
        });
        setExpandedWorkspaceId(null);
        setSelectedPipelineId(null);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to Add', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveFromWorkspace = async (weId: string, workspaceName: string) => {
    if (!user || removingWeId) return;
    setRemovingWeId(weId);
    try {
      const result = await unlinkEntityFromWorkspaceAction({
        workspaceEntityId: weId,
        userId: user.uid,
        userName: user.displayName || undefined,
        userEmail: user.email || undefined,
      });
      if (result.success) {
        toast({
          title: 'Removed from Workspace',
          description: `"${entityName}" has been unlinked from ${workspaceName}.`,
        });
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to Remove', description: e.message });
    } finally {
      setRemovingWeId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-7 pb-5 bg-gradient-to-br from-primary/10 to-primary/5 border-b shrink-0 text-left">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-lg shrink-0">
              <Share2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold tracking-tight">
                Workspace Memberships
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                <span className="font-semibold text-foreground">{entityName}</span> — manage cross-workspace presence
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[65vh] bg-background">
          {/* ── Active Memberships ── */}
          <div className="p-6 pb-3 space-y-3">
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.15em] flex items-center gap-2">
              <Building2 className="h-3 w-3" />
              Active in {activeMemberships.length} Workspace{activeMemberships.length !== 1 ? 's' : ''}
            </p>

            {isLoadingMemberships ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-[64px] w-full rounded-2xl" />
              ))
            ) : activeMemberships.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 rounded-2xl border-2 border-dashed border-border/50 text-center">
                <AlertCircle className="h-6 w-6 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground italic">Not linked to any workspace yet</p>
              </div>
            ) : (
              activeMemberships.map(m => {
                const ws = workspaceMap.get(m.workspaceId);
                const wsName = ws?.name ?? m.workspaceId;
                const isRemoving = removingWeId === m.id;
                return (
                  <div
                    key={m.id}
                    className="group flex items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{wsName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {m.currentStageName && (
                            <Badge className="text-[8px] h-4 font-bold bg-primary/10 text-primary border-none px-2 uppercase tracking-wide">
                              {m.currentStageName}
                            </Badge>
                          )}
                          {m.assignedTo?.name && (
                            <span className="text-[9px] text-muted-foreground font-medium">
                              → {m.assignedTo.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-xl"
                      disabled={isRemoving}
                      title={`Remove from ${wsName}`}
                      onClick={() => handleRemoveFromWorkspace(m.id, wsName)}
                    >
                      {isRemoving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <Separator className="mx-6" />

          {/* ── Add to Workspace ── */}
          <div className="p-6 pt-4 space-y-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-2">
              <Globe className="h-3 w-3" />
              Add to Another Workspace
            </p>

            {unlinkedWorkspaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 rounded-2xl border-2 border-dashed border-border/50 text-center">
                <Check className="h-6 w-6 text-emerald-500/60 mb-2" />
                <p className="text-xs text-muted-foreground italic">
                  {accessibleWorkspaces.filter(w => w.contactScope === entityType).length === 0
                    ? `No ${entityType} workspaces found in your organization`
                    : 'Already in all compatible workspaces'}
                </p>
              </div>
            ) : (
              unlinkedWorkspaces.map(ws => {
                const isExpanded = expandedWorkspaceId === ws.id;
                return (
                  <div
                    key={ws.id}
                    className={cn(
                      'rounded-2xl border overflow-hidden transition-all',
                      isExpanded
                        ? 'border-primary/40 shadow-md shadow-primary/10'
                        : 'border-border/50',
                    )}
                  >
                    {/* Workspace row */}
                    <button
                      type="button"
                      className={cn(
                        'w-full flex items-center justify-between gap-3 p-4 text-left transition-colors',
                        isExpanded ? 'bg-primary/5' : 'bg-card hover:bg-muted/30',
                      )}
                      onClick={() => handleToggleExpand(ws.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            'p-2 rounded-xl shrink-0 transition-colors',
                            isExpanded ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          <Globe className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className={cn('font-semibold text-sm truncate', isExpanded && 'text-primary')}>
                            {ws.name}
                          </p>
                          {ws.description && (
                            <p className="text-[10px] text-muted-foreground truncate">{ws.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[8px] uppercase h-4">
                          {ws.contactScope}
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-primary" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Pipeline selector (expanded) */}
                    {isExpanded && (
                      <div className="p-4 pt-3 border-t border-primary/20 bg-muted/20 space-y-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Workflow className="h-3 w-3" />
                          Select Pipeline to enrol into
                        </p>

                        {isLoadingPipelines ? (
                          <Skeleton className="h-10 w-full rounded-xl" />
                        ) : !availablePipelines || availablePipelines.length === 0 ? (
                          <div className="text-center py-5 text-xs text-muted-foreground italic">
                            No pipelines configured for this workspace
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {availablePipelines.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setSelectedPipelineId(p.id)}
                                className={cn(
                                  'w-full flex items-center justify-between px-4 py-3 rounded-xl text-left border-2 transition-all',
                                  selectedPipelineId === p.id
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-transparent bg-card hover:border-border/80 text-foreground',
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Workflow className="h-3.5 w-3.5 shrink-0" />
                                  <span className="text-xs font-semibold">{p.name}</span>
                                  {p.description && (
                                    <span className="text-[10px] text-muted-foreground hidden sm:inline truncate max-w-[140px]">
                                      — {p.description}
                                    </span>
                                  )}
                                </div>
                                {selectedPipelineId === p.id && (
                                  <Check className="h-4 w-4 shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        <Button
                          size="sm"
                          className="w-full h-10 rounded-xl font-bold shadow-md mt-1 gap-2"
                          disabled={!selectedPipelineId || isSubmitting}
                          onClick={() => handleAddToWorkspace(ws)}
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          {isSubmitting ? 'Adding…' : `Add to ${ws.name}`}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
