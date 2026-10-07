'use client';

/**
 * @fileoverview Cross-Workspace & Cross-Pipeline Transfer / Copy Modal
 *
 * ARCHITECTURAL POINTER (Rule 10 & agents_mcp_rules.md Compliance):
 * Provides full CRM capability to Move or Copy an opportunity across pipelines
 * and authorized workspaces directly from the Kanban Board or Deals List View.
 *
 * WORKSPACE RULES & DESIGN SPECIFICATION:
 * - Standardized Modal Architecture (theme.md Section 8): Demarcated header with
 *   CardInfoTooltip, sr-only description, and demarcated footer.
 * - Strict Scoped Assignee Verification: The assignee picker dynamically queries
 *   users belonging to the target workspace (via useWorkspaceUsers(targetWorkspaceId)),
 *   strictly enforcing that only eligible members of that workspace can be assigned.
 * - AI Deal Summary & Next Steps Engine: Integrates generateDealTransferAiSummaryAction
 *   with a Preview-Before-Commit model (Rule 21 & 22) and deterministic circuit breaker fallback.
 * - Mobile Ergonomics (Rule 7): All interactive touch targets >= 44px (min-h-[44px]),
 *   tactile mechanical presses (active:scale-[0.97]), and accessible keyboard focus.
 * - Strict Typing (Rule 5): Zero 'any' or 'any[]'.
 *
 * @testability Validated by component unit tests in TransferDealModal.test.tsx.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { transferDealAction } from '@/app/actions/deal-actions';
import { generateDealTransferAiSummaryAction } from '@/app/actions/deal-ai-actions';
import type {
  Deal,
  Pipeline,
  OnboardingStage,
  DealNextStep,
  TransferDealResult,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Copy,
  Move,
  Check,
  Loader2,
  Sparkles,
  Search,
  Building2,
  UserCheck,
  UserX,
  FileText,
  ChevronRight,
} from 'lucide-react';

export interface TransferDealModalProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferred?: (result: TransferDealResult) => void;
  initialMode?: 'move' | 'copy';
}

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function TransferDealModal({
  deal,
  open,
  onOpenChange,
  onTransferred,
  initialMode = 'move',
}: TransferDealModalProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { accessibleWorkspaces, activeWorkspaceId } = useTenant();

  // Mode Selection: 'move' (transfer ownership) vs 'copy' (duplicate into new pipeline)
  const [mode, setMode] = React.useState<'move' | 'copy'>(initialMode);

  // Cascading Destination State
  const [targetWorkspaceId, setTargetWorkspaceId] = React.useState<string>('');
  const [targetPipelineId, setTargetPipelineId] = React.useState<string>('');
  const [targetStageId, setTargetStageId] = React.useState<string>('');

  // Assignee Selection State (Strictly scoped to target workspace)
  const [selectedAssignee, setSelectedAssignee] = React.useState<{
    userId: string | null;
    name: string | null;
    email: string | null;
  } | null>(null);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = React.useState<string>('');

  // Context & Summary State
  const [dealSummary, setDealSummary] = React.useState<string>('');

  // Next Step State
  const [nextStepType, setNextStepType] = React.useState<'task' | 'meeting' | 'call' | 'follow_up'>('call');
  const [nextStepTitle, setNextStepTitle] = React.useState<string>('');
  const [nextStepDueDate, setNextStepDueDate] = React.useState<string>('');

  // AI Recommendation Preview State (Preview-Before-Commit model - Rule 21)
  const [isGeneratingAi, setIsGeneratingAi] = React.useState(false);
  const [aiRecommendation, setAiRecommendation] = React.useState<{
    summary: string;
    nextStep?: DealNextStep;
  } | null>(null);

  // Copy Options (only used when mode === 'copy')
  const [copyName, setCopyName] = React.useState<string>('');
  const [copyLineItems, setCopyLineItems] = React.useState(true);
  const [copyContacts, setCopyContacts] = React.useState(true);
  const [copyCustomFields, setCopyCustomFields] = React.useState(true);

  // Submission State
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset & initialize state when dialog opens or deal changes
  React.useEffect(() => {
    if (open && deal) {
      setMode(initialMode);
      const initialWsId = deal.workspaceId || activeWorkspaceId || (accessibleWorkspaces[0]?.id ?? '');
      setTargetWorkspaceId(initialWsId);
      setTargetPipelineId(deal.pipelineId || '');
      setTargetStageId(deal.stageId || '');
      setSelectedAssignee(deal.assignedTo || null);
      setAssigneeSearchQuery('');
      setDealSummary('');
      setCopyName(`${deal.name} (Copy)`);
      setCopyLineItems(true);
      setCopyContacts(true);
      setCopyCustomFields(true);
      setAiRecommendation(null);

      if (deal.nextStep) {
        if (typeof deal.nextStep === 'object' && deal.nextStep !== null) {
          setNextStepType(deal.nextStep.type || 'call');
          setNextStepTitle(deal.nextStep.title || '');
          setNextStepDueDate(deal.nextStep.dueDate ? deal.nextStep.dueDate.slice(0, 10) : '');
        } else if (typeof deal.nextStep === 'string') {
          setNextStepType('call');
          setNextStepTitle(deal.nextStep);
          setNextStepDueDate('');
        }
      } else {
        setNextStepType('call');
        setNextStepTitle('');
        setNextStepDueDate('');
      }
    }
  }, [open, deal, initialMode, activeWorkspaceId, accessibleWorkspaces]);

  // Query Pipelines for the Target Workspace (real-time from Firestore)
  const pipelinesQuery = useMemoFirebase(() => {
    if (!firestore || !targetWorkspaceId) return null;
    return query(
      collection(firestore, 'pipelines'),
      where('workspaceIds', 'array-contains', targetWorkspaceId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, targetWorkspaceId]);

  const { data: rawPipelines, isLoading: isLoadingPipelines } = useCollection<Pipeline>(pipelinesQuery);

  const availablePipelines = React.useMemo(() => {
    return (rawPipelines || []).filter((p) => !p.isArchived);
  }, [rawPipelines]);

  // Synchronize targetPipelineId when pipelines list loads or targetWorkspaceId changes
  React.useEffect(() => {
    if (!availablePipelines || availablePipelines.length === 0) return;
    const exists = availablePipelines.some((p) => p.id === targetPipelineId);
    if (!exists) {
      setTargetPipelineId(availablePipelines[0].id);
    }
  }, [availablePipelines, targetPipelineId]);

  // Query Stages for the Target Pipeline (real-time from Firestore)
  const stagesQuery = useMemoFirebase(() => {
    if (!firestore || !targetPipelineId) return null;
    return query(
      collection(firestore, 'onboardingStages'),
      where('pipelineId', '==', targetPipelineId),
      orderBy('order', 'asc')
    );
  }, [firestore, targetPipelineId]);

  const { data: rawStages, isLoading: isLoadingStages } = useCollection<OnboardingStage>(stagesQuery);

  const availableStages = React.useMemo(() => {
    return rawStages || [];
  }, [rawStages]);

  // Synchronize targetStageId when stages load or targetPipelineId changes
  React.useEffect(() => {
    if (!availableStages || availableStages.length === 0) return;
    const exists = availableStages.some((s) => s.id === targetStageId);
    if (!exists) {
      setTargetStageId(availableStages[0].id);
    }
  }, [availableStages, targetStageId]);

  // Query Workspace Members for the Selected Target Workspace (Strict Scoping Rule)
  const { data: workspaceUsers, isLoading: isLoadingUsers } = useWorkspaceUsers(targetWorkspaceId);

  // If destination workspace changes, ensure current assignee is a valid member; otherwise reset to Unassigned
  React.useEffect(() => {
    if (!workspaceUsers || !selectedAssignee?.userId) return;
    const isMember = workspaceUsers.some((u) => u.id === selectedAssignee.userId);
    if (!isMember) {
      setSelectedAssignee(null);
    }
  }, [targetWorkspaceId, workspaceUsers, selectedAssignee]);

  // Filter assignees by search input
  const filteredUsers = React.useMemo(() => {
    if (!workspaceUsers) return [];
    const q = assigneeSearchQuery.trim().toLowerCase();
    if (!q) return workspaceUsers;
    return workspaceUsers.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [workspaceUsers, assigneeSearchQuery]);

  // Target Workspace display name
  const targetWorkspaceName = React.useMemo(() => {
    const ws = accessibleWorkspaces.find((w) => w.id === targetWorkspaceId);
    return ws?.name || 'Selected Workspace';
  }, [accessibleWorkspaces, targetWorkspaceId]);

  const targetPipeline = React.useMemo(() => {
    return availablePipelines.find((p) => p.id === targetPipelineId);
  }, [availablePipelines, targetPipelineId]);

  const targetStage = React.useMemo(() => {
    return availableStages.find((s) => s.id === targetStageId);
  }, [availableStages, targetStageId]);

  // AI Summary & Next Step Recommendation Generator
  const handleGenerateAiRecommendation = async () => {
    if (!deal) return;
    setIsGeneratingAi(true);
    try {
      const res = await generateDealTransferAiSummaryAction(deal.id, targetWorkspaceId);
      if (res.success && res.summary) {
        setAiRecommendation({
          summary: res.summary,
          nextStep: res.nextStep,
        });
        toast({
          title: res.isFallback ? 'Summary Generated' : 'AI Insights Ready',
          description: res.isFallback
            ? 'A baseline summary and recommended next step have been prepared for your review.'
            : 'Transfer summary and recommended next step generated for your review.',
        });
      } else {
        throw new Error(res.error || 'Failed to generate recommendation');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI generation unavailable.';
      toast({
        title: 'AI Service Notice',
        description: `${msg} You can write the summary manually.`,
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Accept AI Recommendation (Rule 21: Approval Binding Before Commit)
  const handleAcceptRecommendation = () => {
    if (!aiRecommendation) return;
    setDealSummary(aiRecommendation.summary);
    if (aiRecommendation.nextStep) {
      setNextStepTitle(aiRecommendation.nextStep.title);
      setNextStepType(aiRecommendation.nextStep.type);
      if (aiRecommendation.nextStep.dueDate) {
        setNextStepDueDate(aiRecommendation.nextStep.dueDate.slice(0, 10));
      }
    }
    setAiRecommendation(null);
    toast({
      title: 'Recommendation Applied',
      description: 'AI summary and next steps bound to transfer state.',
    });
  };

  // Submit Transfer or Copy
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal) return;

    if (!targetWorkspaceId) {
      toast({ variant: 'destructive', title: 'Workspace Required', description: 'Please select a destination workspace.' });
      return;
    }
    if (!targetPipelineId) {
      toast({ variant: 'destructive', title: 'Pipeline Required', description: 'Please select a destination pipeline.' });
      return;
    }
    if (!targetStageId) {
      toast({ variant: 'destructive', title: 'Stage Required', description: 'Please select a destination stage.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const constructedNextStep: DealNextStep | undefined = nextStepTitle.trim()
        ? {
            type: nextStepType,
            title: nextStepTitle.trim(),
            dueDate: nextStepDueDate
              ? new Date(nextStepDueDate).toISOString()
              : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            assigneeName: selectedAssignee?.name || undefined,
            isCompleted: false,
          }
        : undefined;

      const result = await transferDealAction({
        dealId: deal.id,
        mode,
        sourceWorkspaceId: deal.workspaceId,
        targetWorkspaceId,
        targetPipelineId,
        targetStageId,
        assignedTo: selectedAssignee,
        summary: dealSummary.trim() || undefined,
        nextStep: constructedNextStep,
        newName: mode === 'copy' ? (copyName.trim() || `${deal.name} (Copy)`) : undefined,
        copyLineItems: mode === 'copy' ? copyLineItems : undefined,
        copyContacts: mode === 'copy' ? copyContacts : undefined,
        copyCustomFields: mode === 'copy' ? copyCustomFields : undefined,
      });

      if (!result.success) {
        throw new Error(result.error || 'Transfer failed');
      }

      toast({
        title: mode === 'move' ? 'Deal Moved' : 'Deal Copied',
        description: `Successfully ${mode === 'move' ? 'moved' : 'copied'} deal to "${targetPipeline?.name || 'pipeline'}" (${targetStage?.name || 'stage'}).`,
      });

      onTransferred?.(result);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during transfer.';
      toast({
        variant: 'destructive',
        title: mode === 'move' ? 'Transfer Failed' : 'Copy Failed',
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!deal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Demarcated Header (theme.md Section 8.2) */}
        <DialogHeader demarcated className="min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              {mode === 'move' ? <Move className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-foreground">
                  {mode === 'move' ? 'Move Deal to Pipeline' : 'Copy Deal to Pipeline'}
                </DialogTitle>
                <CardInfoTooltip text="Move or duplicate this opportunity across pipelines and workspaces with scoped assignee assignment, asset cloning, and AI next-step assistance." />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                Current: <span className="font-semibold text-foreground">{deal.name}</span>
              </p>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Move or copy opportunity across pipelines and workspaces
          </DialogDescription>
        </DialogHeader>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Mode Switcher Segmented Control */}
          <div className="flex p-1 bg-muted/50 rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => setMode('move')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all min-h-[44px] active:scale-[0.98]',
                mode === 'move'
                  ? 'bg-card text-primary shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Move className="h-3.5 w-3.5" />
              <span>Move Deal (Transfer)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('copy')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all min-h-[44px] active:scale-[0.98]',
                mode === 'copy'
                  ? 'bg-card text-primary shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copy Deal (Duplicate)</span>
            </button>
          </div>

          {/* Section 1: Destination Selection */}
          <div className="space-y-4 rounded-xl border border-border/60 bg-muted/10 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <span>Target Destination</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Workspace Picker */}
              <div className="space-y-1.5">
                <Label htmlFor="target-workspace" className="text-xs font-bold text-foreground">
                  Target Workspace <span className="text-destructive">*</span>
                </Label>
                <select
                  id="target-workspace"
                  value={targetWorkspaceId}
                  onChange={(e) => {
                    const newWsId = e.target.value;
                    setTargetWorkspaceId(newWsId);
                    setTargetPipelineId('');
                    setTargetStageId('');
                  }}
                  className="w-full h-11 min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {accessibleWorkspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name} {ws.id === deal.workspaceId ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pipeline Picker */}
              <div className="space-y-1.5">
                <Label htmlFor="target-pipeline" className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Target Pipeline <span className="text-destructive">*</span></span>
                  {isLoadingPipelines && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </Label>
                <select
                  id="target-pipeline"
                  value={targetPipelineId}
                  onChange={(e) => {
                    setTargetPipelineId(e.target.value);
                    setTargetStageId('');
                  }}
                  disabled={isLoadingPipelines || availablePipelines.length === 0}
                  className="w-full h-11 min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {availablePipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.id === deal.pipelineId ? '(Current)' : ''}
                    </option>
                  ))}
                  {availablePipelines.length === 0 && !isLoadingPipelines && (
                    <option value="">No pipelines available</option>
                  )}
                </select>
              </div>
            </div>

            {/* Stage Selector (Horizontal Progression Pills) */}
            <div className="space-y-2 pt-2">
              <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Target Stage <span className="text-destructive">*</span></span>
                {isLoadingStages && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {availableStages.map((stage) => {
                  const isSelected = stage.id === targetStageId;
                  const isCurrent = stage.id === deal.stageId && targetPipelineId === deal.pipelineId;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => setTargetStageId(stage.id)}
                      className={cn(
                        'flex flex-col items-start p-2.5 rounded-xl border text-left transition-all min-h-[52px] active:scale-[0.98]',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-xs'
                          : 'border-border/70 bg-card hover:bg-muted/50 text-foreground'
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold truncate">{stage.name}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {stage.probability ?? 0}%
                        </span>
                        {isCurrent && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary">
                            Current
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Scoped Assignee Picker (Strict Destination Workspace Check) */}
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                <span>Assign Deal Owner</span>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground">
                Scoped to: {targetWorkspaceName}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={`Search team members in ${targetWorkspaceName}...`}
                value={assigneeSearchQuery}
                onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                className="pl-9 h-10 min-h-[44px] rounded-xl text-xs bg-background"
              />
            </div>

            {/* Assignee Options List */}
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {/* Unassigned Option */}
              <button
                type="button"
                onClick={() => setSelectedAssignee(null)}
                className={cn(
                  'w-full flex items-center justify-between p-2.5 rounded-xl border transition-all min-h-[44px] text-left active:scale-[0.98]',
                  selectedAssignee === null
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 bg-card hover:bg-muted/50 text-foreground'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <UserX className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Unassigned</p>
                    <p className="text-[10px] text-muted-foreground">Leave deal open for claiming</p>
                  </div>
                </div>
                {selectedAssignee === null && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>

              {/* Workspace User List */}
              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Loading members of {targetWorkspaceName}...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-3 text-center text-xs text-muted-foreground">
                  No matching team members found in {targetWorkspaceName}.
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = selectedAssignee?.userId === user.id;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() =>
                        setSelectedAssignee({
                          userId: user.id,
                          name: user.name || user.email || 'Team Member',
                          email: user.email || null,
                        })
                      }
                      className={cn(
                        'w-full flex items-center justify-between p-2.5 rounded-xl border transition-all min-h-[44px] text-left active:scale-[0.98]',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/60 bg-card hover:bg-muted/50 text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={user.photoURL || undefined} alt={user.name || 'User'} />
                          <AvatarFallback className="text-[10px] font-bold bg-primary/15 text-primary">
                            {getInitials(user.name || user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-foreground">{user.name || 'Team Member'}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{user.email || 'No email'}</p>
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 3: Copy Options (Only in Copy Mode) */}
          {mode === 'copy' && (
            <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
                <Copy className="h-3.5 w-3.5 text-primary" />
                <span>Duplication Settings</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="copy-name" className="text-xs font-bold text-foreground">
                  New Deal Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="copy-name"
                  value={copyName}
                  onChange={(e) => setCopyName(e.target.value)}
                  placeholder="Enter copied deal name..."
                  className="h-11 min-h-[44px] rounded-xl text-xs bg-background"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-card cursor-pointer hover:bg-muted/50 transition-colors min-h-[44px]">
                  <Checkbox
                    checked={copyLineItems}
                    onCheckedChange={(checked) => setCopyLineItems(Boolean(checked))}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">Line Items</p>
                    <p className="text-[10px] text-muted-foreground">Clone pricing & quotes</p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-card cursor-pointer hover:bg-muted/50 transition-colors min-h-[44px]">
                  <Checkbox
                    checked={copyContacts}
                    onCheckedChange={(checked) => setCopyContacts(Boolean(checked))}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">Contacts</p>
                    <p className="text-[10px] text-muted-foreground">Attach stakeholders</p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-card cursor-pointer hover:bg-muted/50 transition-colors min-h-[44px]">
                  <Checkbox
                    checked={copyCustomFields}
                    onCheckedChange={(checked) => setCopyCustomFields(Boolean(checked))}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">Custom Fields</p>
                    <p className="text-[10px] text-muted-foreground">Copy field values</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Section 4: Handover Summary & AI Recommendation */}
          <div className="space-y-4 rounded-xl border border-border/60 bg-muted/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Deal Summary & Next Steps</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateAiRecommendation}
                disabled={isGeneratingAi}
                className="h-8 min-h-[32px] text-xs font-bold gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/10 active:scale-[0.97]"
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Analyzing History...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-primary fill-primary/20" />
                    <span>Auto-Generate with AI</span>
                  </>
                )}
              </Button>
            </div>

            {/* AI Recommendation Preview Banner (Rule 21: Preview Before Commit) */}
            {aiRecommendation && (
              <div className="p-4 rounded-xl border border-primary/40 bg-primary/10 space-y-3 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary fill-primary/30" />
                    <span className="text-xs font-black text-foreground">AI Recommendation Preview</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold border-primary text-primary">
                    Review & Accept
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Summary</p>
                  <p className="text-xs text-foreground bg-card/70 p-2.5 rounded-lg border border-border/60">
                    {aiRecommendation.summary}
                  </p>
                </div>

                {aiRecommendation.nextStep && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Recommended Next Step</p>
                    <div className="flex items-center gap-2 text-xs text-foreground bg-card/70 p-2.5 rounded-lg border border-border/60">
                      <Badge variant="secondary" className="capitalize text-[10px]">
                        {aiRecommendation.nextStep.type}
                      </Badge>
                      <span className="font-bold flex-1">{aiRecommendation.nextStep.title}</span>
                      {aiRecommendation.nextStep.dueDate && (
                        <span className="text-[10px] text-muted-foreground">
                          Due: {aiRecommendation.nextStep.dueDate.slice(0, 10)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAiRecommendation(null)}
                    className="h-8 text-xs font-semibold rounded-lg"
                  >
                    Dismiss
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAcceptRecommendation}
                    className="h-8 text-xs font-bold rounded-lg gap-1.5 bg-primary text-primary-foreground active:scale-[0.97]"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Accept Recommendation</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Deal Summary Textarea */}
            <div className="space-y-1.5">
              <Label htmlFor="deal-summary" className="text-xs font-bold text-foreground">
                Transfer Summary / Rationale (Optional)
              </Label>
              <Textarea
                id="deal-summary"
                value={dealSummary}
                onChange={(e) => setDealSummary(e.target.value)}
                placeholder="Add context or notes for the receiving pipeline team..."
                rows={3}
                className="text-xs rounded-xl bg-background"
              />
            </div>

            {/* Next Step Configuration */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-bold text-foreground">Next Action Plan</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground">Action Type</span>
                  <select
                    value={nextStepType}
                    onChange={(e) =>
                      setNextStepType(e.target.value as 'task' | 'meeting' | 'call' | 'follow_up')
                    }
                    className="w-full h-10 min-h-[44px] rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="call">Call</option>
                    <option value="meeting">Meeting</option>
                    <option value="task">Task</option>
                    <option value="follow_up">Follow Up</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground">Action Description</span>
                  <Input
                    value={nextStepTitle}
                    onChange={(e) => setNextStepTitle(e.target.value)}
                    placeholder="e.g. Call decision maker to review fee schedule"
                    className="h-10 min-h-[44px] rounded-xl text-xs bg-background"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Due Date</span>
                <Input
                  type="date"
                  value={nextStepDueDate}
                  onChange={(e) => setNextStepDueDate(e.target.value)}
                  className="h-10 min-h-[44px] rounded-xl text-xs bg-background max-w-xs"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Demarcated Footer Bar (theme.md Section 8.5) */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-xs">
            <span className="truncate">{targetWorkspaceName}</span>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="truncate">{targetPipeline?.name || 'Pipeline'}</span>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="font-semibold text-foreground truncate">{targetStage?.name || 'Stage'}</span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl min-h-[44px] px-4 font-bold text-xs active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !targetWorkspaceId || !targetPipelineId || !targetStageId}
              className="rounded-xl min-h-[44px] px-5 font-bold text-xs gap-2 bg-primary text-primary-foreground shadow-sm active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{mode === 'move' ? 'Moving Deal...' : 'Copying Deal...'}</span>
                </>
              ) : mode === 'move' ? (
                <>
                  <ArrowRight className="h-4 w-4" />
                  <span>Move Deal</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Deal</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
