'use client';

import * as React from 'react';
import {
  Users,
  Search,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Square,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  MoreHorizontal,
  X,
  Loader2,
  Globe,
  ArrowLeft,
  Table2,
  Braces,
  Copy,
  Check,
  Database,
  Filter,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import type { AutomationRun, StepExecution } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  restartRunAction,
  retryFailedStepAction,
  forceEndRunAction,
  forceAdvanceRunAction,
  pauseRunAction,
  resumeRunAction,
} from '@/lib/automation-actions';
import { StepTimeline } from './StepTimeline';
import { formatDistanceToNow, format } from 'date-fns';

// ── Types ───────────────────────────────────────────────────────────────────────

type StatusFilter = 'ALL' | 'running' | 'completed' | 'failed' | 'paused' | 'waiting';

interface AutomationActivityLogProps {
  automationId: string;
  nodes: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function getRunDisplayName(run: AutomationRun, entityNames?: Record<string, string>): string {
  const td = run.triggerData || {};
  const name =
    (td.entityName as string) ||
    (td.displayName as string) ||
    (td.name as string);

  if (name) return name;
  if (run.entityId && entityNames?.[run.entityId]) return entityNames[run.entityId];
  return run.entityId ? `Entity ${run.entityId.substring(0, 8)}…` : 'Unknown';
}

function getRunEmail(run: AutomationRun): string {
  const td = run.triggerData || {};
  return (td.email as string) || (td.primaryContactEmail as string) || '';
}

function getRunPhone(run: AutomationRun): string {
  const td = run.triggerData || {};
  return (td.phone as string) || (td.primaryContactPhone as string) || '';
}

function isWebhookRun(run: AutomationRun): boolean {
  const td = run.triggerData || {};
  return td.source === 'external_webhook' || !!td.ingressId;
}

function getEffectiveStatus(run: AutomationRun): StatusFilter {
  if (run.status === 'paused') return 'paused';
  if (run.status === 'running') {
    // Check if any step is waiting (delay node)
    const steps = run.steps || {};
    const hasWaiting = Object.values(steps).some((s) => s.status === 'waiting');
    if (hasWaiting) return 'waiting';
    return 'running';
  }
  return run.status;
}

function getDuration(run: AutomationRun): string {
  const start = new Date(run.startedAt).getTime();
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now();
  const diff = end - start;
  if (diff < 1000) return `${diff}ms`;
  if (diff < 60000) return `${Math.round(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m`;
  return `${Math.round(diff / 3600000)}h ${Math.round((diff % 3600000) / 60000)}m`;
}

function getFailedStepNodeId(run: AutomationRun): string | null {
  if (!run.steps) return null;
  const failed = Object.entries(run.steps).find(([, step]) => step.status === 'failed');
  return failed ? failed[0] : null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  running: { label: 'Active', color: 'bg-blue-500', icon: Play },
  waiting: { label: 'Waiting', color: 'bg-amber-500', icon: Clock },
  paused: { label: 'Paused', color: 'bg-orange-500', icon: Pause },
  failed: { label: 'Failed', color: 'bg-rose-500', icon: XCircle },
  completed: { label: 'Completed', color: 'bg-emerald-500', icon: CheckCircle2 },
};

// ── Component ───────────────────────────────────────────────────────────────────

export function AutomationActivityLog({ automationId, nodes }: AutomationActivityLogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [entityNames, setEntityNames] = React.useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [stepFilter, setStepFilter] = React.useState<string>('ALL');
  const [selectedRun, setSelectedRun] = React.useState<AutomationRun | null>(null);
  const [isProcessing, setIsProcessing] = React.useState<string | null>(null);
  const [triggerDataView, setTriggerDataView] = React.useState<'table' | 'json'>('table');
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [resolvedContact, setResolvedContact] = React.useState<{
    email: string;
    phone: string;
  } | null>(null);

  // Real-time runs query
  const runsQuery = useMemoFirebase(() => {
    if (!firestore || !automationId) return null;
    return query(
      collection(firestore, 'automation_runs'),
      where('automationId', '==', automationId),
      orderBy('startedAt', 'desc'),
      limit(100)
    );
  }, [firestore, automationId]);

  const { data: runs, isLoading } = useCollection<AutomationRun>(runsQuery);

  // Sync selected run with real-time data
  React.useEffect(() => {
    if (selectedRun && runs) {
      const updated = runs.find((r) => r.id === selectedRun.id);
      if (updated && JSON.stringify(updated.steps) !== JSON.stringify(selectedRun.steps)) {
        setSelectedRun(updated);
      }
    }
  }, [runs, selectedRun]);

  // Dynamically resolve entity names on the client if they are not in triggerData
  React.useEffect(() => {
    if (!runs || !firestore) return;

    const missingIds = Array.from(new Set(
      runs
        .filter(run => {
          if (!run.entityId) return false;
          if (entityNames[run.entityId]) return false;
          const td = run.triggerData || {};
          const hasName = td.entityName || td.displayName || td.name;
          return !hasName;
        })
        .map(run => run.entityId!)
    ));

    if (missingIds.length === 0) return;

    let cancelled = false;

    async function fetchNames() {
      const updates: Record<string, string> = {};
      await Promise.all(
        missingIds.map(async (id) => {
          try {
            let snap = await getDoc(doc(firestore, 'workspace_entities', id));
            if (!snap.exists()) {
              snap = await getDoc(doc(firestore, 'schools', id));
            }
            if (snap.exists()) {
              const name = snap.data()?.name as string;
              if (name) {
                updates[id] = name;
              }
            }
          } catch (e) {
            console.error('Failed to fetch entity name for', id, e);
          }
        })
      );

      if (!cancelled && Object.keys(updates).length > 0) {
        setEntityNames(prev => ({ ...prev, ...updates }));
      }
    }

    fetchNames();
    return () => { cancelled = true; };
  }, [runs, entityNames, firestore]);

  // Resolve contact email/phone for the drill-down info cards.
  // triggerData often lacks these for entity-triggered runs, so we
  // fall back to a Firestore lookup on the entity document.
  React.useEffect(() => {
    if (!selectedRun?.entityId || !selectedRun.workspaceId || !firestore) {
      setResolvedContact(null);
      return;
    }

    // Fast path: triggerData already has both
    const td = selectedRun.triggerData || {};
    const tdEmail = (td.email as string) || (td.primaryContactEmail as string) || '';
    const tdPhone = (td.phone as string) || (td.primaryContactPhone as string) || '';
    if (tdEmail && tdPhone) {
      setResolvedContact({ email: tdEmail, phone: tdPhone });
      return;
    }

    // Slow path: fetch from Firestore
    let cancelled = false;

    async function fetchContact() {
      try {
        const entityId = selectedRun!.entityId!;

        // Try workspace_entities first
        let snap = await getDoc(doc(firestore, 'workspace_entities', entityId));
        if (!snap.exists()) {
          // Fall back to schools (legacy)
          snap = await getDoc(doc(firestore, 'schools', entityId));
        }

        if (cancelled || !snap.exists()) return;

        const data = snap.data() as Record<string, unknown>;
        const email =
          tdEmail ||
          (data.email as string) ||
          (data.primaryContactEmail as string) ||
          '';
        const phone =
          tdPhone ||
          (data.phone as string) ||
          (data.primaryContactPhone as string) ||
          '';

        setResolvedContact({ email, phone });
      } catch {
        // Non-fatal; fall back to triggerData values
        setResolvedContact({ email: tdEmail, phone: tdPhone });
      }
    }

    setResolvedContact(null);
    fetchContact();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRun?.id, selectedRun?.entityId]);

  // Get unique step labels for filter dropdown
  const stepOptions = React.useMemo(() => {
    const actionNodes = nodes.filter((n) => n.type !== 'triggerNode');
    return actionNodes.map((n) => ({
      id: n.id,
      label: (n.data?.label as string) || n.id,
    }));
  }, [nodes]);

  // Filter runs
  const filteredRuns = React.useMemo(() => {
    if (!runs) return [];
    return runs.filter((run) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const effective = getEffectiveStatus(run);
        if (effective !== statusFilter) return false;
      }

      // Step filter
      if (stepFilter !== 'ALL') {
        if (run.currentNodeId !== stepFilter) return false;
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = getRunDisplayName(run, entityNames).toLowerCase();
        const email = getRunEmail(run).toLowerCase();
        const phone = getRunPhone(run).toLowerCase();
        const entityId = (run.entityId || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !phone.includes(q) && !entityId.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [runs, statusFilter, stepFilter, searchQuery, entityNames]);

  // Stats
  const stats = React.useMemo(() => {
    if (!runs) return { total: 0, running: 0, waiting: 0, paused: 0, failed: 0, completed: 0 };
    const result = { total: runs.length, running: 0, waiting: 0, paused: 0, failed: 0, completed: 0 };
    for (const run of runs) {
      const s = getEffectiveStatus(run);
      if (s in result) (result as Record<string, number>)[s]++;
    }
    return result;
  }, [runs]);

  // ── Action Handlers ─────────────────────────────────────────────────────────

  async function handleAction(
    action: 'restart' | 'retry' | 'forceEnd' | 'forceAdvance' | 'pause' | 'resume',
    run: AutomationRun
  ) {
    if (!user?.uid) return;
    setIsProcessing(`${run.id}-${action}`);

    try {
      let result: { success: boolean; error?: string };

      switch (action) {
        case 'restart': {
          const confirmed = await confirm({
            title: 'Restart automation?',
            description: `This will create a new run for "${getRunDisplayName(run, entityNames)}" from the trigger node.`,
            confirmText: 'Restart',
            variant: 'default',
          });
          if (!confirmed) { setIsProcessing(null); return; }
          result = await restartRunAction(run.id, user.uid);
          break;
        }
        case 'retry': {
          const failedNode = getFailedStepNodeId(run);
          if (!failedNode) { toast({ variant: 'destructive', title: 'No failed step found' }); setIsProcessing(null); return; }
          result = await retryFailedStepAction(run.id, failedNode, user.uid);
          break;
        }
        case 'forceEnd': {
          const confirmed = await confirm({
            title: 'Force end automation?',
            description: `This will immediately terminate the run for "${getRunDisplayName(run, entityNames)}" and remove all pending jobs.`,
            confirmText: 'End Now',
            variant: 'destructive',
          });
          if (!confirmed) { setIsProcessing(null); return; }
          result = await forceEndRunAction(run.id, user.uid);
          break;
        }
        case 'forceAdvance':
          result = await forceAdvanceRunAction(run.id, user.uid);
          break;
        case 'pause':
          result = await pauseRunAction(run.id, user.uid);
          break;
        case 'resume':
          result = await resumeRunAction(run.id, user.uid);
          break;
        default:
          return;
      }

      if (result.success) {
        toast({ title: `Action "${action}" completed successfully` });
      } else {
        toast({ variant: 'destructive', title: 'Action failed', description: result.error });
      }
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Action failed', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsProcessing(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-30" />
      </div>
    );
  }

  // ── Drill-Down View ─────────────────────────────────────────────────────────
  if (selectedRun) {
    const isWebhook = isWebhookRun(selectedRun);
    const effectiveStatus = getEffectiveStatus(selectedRun);
    const statusCfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.completed;

    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between bg-muted/5">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl"
              onClick={() => setSelectedRun(null)}
            >
              <ArrowLeft size={16} />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">
                  {isWebhook ? 'Webhook Request' : getRunDisplayName(selectedRun, entityNames)}
                </h3>
                <Badge className={cn('h-5 text-[8px] font-bold uppercase text-white', statusCfg.color)}>
                  {statusCfg.label}
                </Badge>
                {selectedRun.terminatedManually && (
                  <Badge variant="outline" className="h-5 text-[8px] font-bold border-orange-500/30 text-orange-600">
                    Manually Ended
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Run ID: {selectedRun.id} · Started {formatDistanceToNow(new Date(selectedRun.startedAt), { addSuffix: true })}
              </p>
            </div>
          </div>

          {/* Drill-down actions */}
          <div className="flex items-center gap-1.5">
            {(selectedRun.status === 'running' || selectedRun.status === 'paused') && (
              <>
                {selectedRun.status === 'running' && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl" onClick={() => handleAction('pause', selectedRun)} disabled={!!isProcessing}>
                          <Pause size={14} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom"><p className="text-[10px] font-bold">Pause</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {selectedRun.status === 'paused' && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl" onClick={() => handleAction('resume', selectedRun)} disabled={!!isProcessing}>
                          <Play size={14} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom"><p className="text-[10px] font-bold">Resume</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl" onClick={() => handleAction('forceAdvance', selectedRun)} disabled={!!isProcessing}>
                        <SkipForward size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p className="text-[10px] font-bold">Skip to next step</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl text-rose-500 hover:text-rose-600" onClick={() => handleAction('forceEnd', selectedRun)} disabled={!!isProcessing}>
                        <Square size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p className="text-[10px] font-bold">Force end</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
            {(selectedRun.status === 'failed' || selectedRun.status === 'completed') && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl" onClick={() => handleAction('restart', selectedRun)} disabled={!!isProcessing}>
                      <RotateCcw size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-[10px] font-bold">Restart from trigger</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {selectedRun.status === 'failed' && getFailedStepNodeId(selectedRun) && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl text-amber-600" onClick={() => handleAction('retry', selectedRun)} disabled={!!isProcessing}>
                      <RefreshCw size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-[10px] font-bold">Retry failed step</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Drill-down body */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {/* Entity Info Card */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Entity', value: isWebhook ? 'Webhook' : getRunDisplayName(selectedRun, entityNames) },
                { label: 'Email', value: resolvedContact?.email || getRunEmail(selectedRun) || '—' },
                { label: 'Phone', value: resolvedContact?.phone || getRunPhone(selectedRun) || '—' },
                { label: 'Duration', value: getDuration(selectedRun) },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-xl bg-muted/20 border border-border/40">
                  <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className="text-xs font-semibold mt-0.5 truncate">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Current Step */}
            {selectedRun.currentNodeLabel && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-2">
                <div className={cn('h-2 w-2 rounded-full', statusCfg.color, selectedRun.status === 'running' && 'animate-pulse')} />
                <span className="text-[10px] font-bold text-muted-foreground">Current Step:</span>
                <span className="text-xs font-bold text-foreground">{selectedRun.currentNodeLabel}</span>
              </div>
            )}

            {/* Error */}
            {selectedRun.error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={14} className="text-rose-500 shrink-0" />
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Error</span>
                </div>
                <pre className="text-xs font-mono text-rose-600 dark:text-rose-400 whitespace-pre-wrap leading-relaxed">{selectedRun.error}</pre>
              </div>
            )}

            {/* Step Timeline */}
            {selectedRun.steps && Object.keys(selectedRun.steps).length > 0 && (
              <div className="space-y-3">
                <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <ChevronRight size={10} /> Execution Path ({Object.keys(selectedRun.steps).filter((k) => k !== '__overflow').length} steps)
                </h5>
                <StepTimeline
                  steps={selectedRun.steps}
                  nodes={nodes}
                  onRetryStep={async (nodeId: string) => {
                    if (!user?.uid || !selectedRun) return;
                    const result = await retryFailedStepAction(selectedRun.id, nodeId, user.uid);
                    if (result.success) {
                      toast({ title: 'Step retry initiated', description: 'The failed step is being re-executed.' });
                    } else {
                      toast({ variant: 'destructive', title: 'Retry failed', description: result.error });
                    }
                  }}
                />
              </div>
            )}

            {/* Trigger Payload — Table / JSON toggle */}
            <div className="border border-border/50 rounded-xl overflow-hidden bg-background">
              <div className="p-3 flex items-center justify-between bg-muted/10">
                <span className="text-[10px] font-bold text-foreground flex items-center gap-1.5">
                  <Database size={12} className="text-primary" /> Trigger Payload
                  <span className="text-muted-foreground">({Object.keys(selectedRun.triggerData || {}).length} fields)</span>
                </span>
                <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setTriggerDataView('table')}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold transition-all',
                      triggerDataView === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Table2 size={10} /> Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setTriggerDataView('json')}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold transition-all',
                      triggerDataView === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Braces size={10} /> JSON
                  </button>
                </div>
              </div>

              {triggerDataView === 'table' ? (
                <div className="px-3 pb-3 pt-1">
                  <div className="rounded-lg border border-border/40 overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border/40">
                          <th className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-1.5 w-[35%]">Key</th>
                          <th className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-1.5">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(selectedRun.triggerData || {}).map(([key, value], idx) => {
                          const isComplex = typeof value === 'object' && value !== null;
                          const displayValue = isComplex ? JSON.stringify(value) : String(value ?? '—');
                          const isCopied = copiedKey === key;
                          return (
                            <tr
                              key={key}
                              className={cn(
                                'border-b border-border/20 last:border-b-0 group/row cursor-pointer hover:bg-primary/5 transition-colors',
                                idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                              )}
                              onClick={() => { navigator.clipboard.writeText(displayValue); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 1500); }}
                              title="Click to copy value"
                            >
                              <td className="px-3 py-1.5 align-top"><code className="text-[9px] font-bold text-primary/80 break-all">{key}</code></td>
                              <td className="px-3 py-1.5 align-top">
                                <div className="flex items-start gap-1.5">
                                  {isComplex
                                    ? <code className="text-[9px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md break-all leading-relaxed">{displayValue}</code>
                                    : <span className="text-[9px] font-medium text-foreground/80 break-all leading-relaxed">{displayValue}</span>
                                  }
                                  <span className={cn('shrink-0 mt-0.5 transition-all', isCopied ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-40')}>
                                    {isCopied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} className="text-muted-foreground" />}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-muted/5 font-mono text-[9px] text-foreground/80 overflow-x-auto leading-relaxed select-all">
                  <pre className="m-0">{JSON.stringify(selectedRun.triggerData, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // ── Main List View ──────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Stats Bar */}
      <div className="border-b border-border/50 px-6 py-4 bg-muted/5">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: 'Total', value: stats.total, color: 'text-foreground', bgColor: 'bg-muted/20' },
            { label: 'Active', value: stats.running, color: 'text-blue-600', bgColor: 'bg-blue-500/10' },
            { label: 'Waiting', value: stats.waiting, color: 'text-amber-600', bgColor: 'bg-amber-500/10' },
            { label: 'Paused', value: stats.paused, color: 'text-orange-600', bgColor: 'bg-orange-500/10' },
            { label: 'Failed', value: stats.failed, color: 'text-rose-600', bgColor: 'bg-rose-500/10' },
            { label: 'Completed', value: stats.completed, color: 'text-emerald-600', bgColor: 'bg-emerald-500/10' },
          ].map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={() => setStatusFilter(stat.label === 'Total' ? 'ALL' : stat.label.toLowerCase() as StatusFilter)}
              className={cn(
                'p-2.5 rounded-xl border border-border/40 text-left transition-all hover:shadow-sm active:scale-[0.98]',
                stat.bgColor,
                statusFilter === (stat.label === 'Total' ? 'ALL' : stat.label.toLowerCase()) && 'ring-2 ring-primary/30 shadow-sm'
              )}
            >
              <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              <p className={cn('text-lg font-bold tabular-nums', stat.color)}>{stat.value}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-border/50 px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone or entity ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-9 text-xs rounded-xl bg-muted/20 border-border/40"
          />
        </div>

        {/* Step filter */}
        <div className="flex items-center gap-1.5">
          <Filter size={12} className="text-muted-foreground" />
          <select
            value={stepFilter}
            onChange={(e) => setStepFilter(e.target.value)}
            className="h-8 text-[10px] font-bold rounded-xl bg-muted/20 border border-border/40 px-2 pr-6 appearance-none cursor-pointer text-foreground"
          >
            <option value="ALL">All Steps</option>
            {stepOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>

        <p className="text-[10px] text-muted-foreground font-medium ml-auto">
          {filteredRuns.length} of {runs?.length || 0} runs
        </p>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="px-6">
          <table className="w-full">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b border-border/40">
                <th className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider text-left px-3 py-2.5 w-[28%]">Contact / Entity</th>
                <th className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider text-left px-3 py-2.5 w-[14%]">Status</th>
                <th className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider text-left px-3 py-2.5 w-[22%]">Current Step</th>
                <th className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider text-left px-3 py-2.5 w-[14%]">Started</th>
                <th className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider text-left px-3 py-2.5 w-[10%]">Duration</th>
                <th className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider text-right px-3 py-2.5 w-[12%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((run, idx) => {
                const effectiveStatus = getEffectiveStatus(run);
                const statusCfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.completed;
                const isWebhook = isWebhookRun(run);
                const runIsProcessing = isProcessing?.startsWith(run.id);

                return (
                  <tr
                    key={run.id}
                    className={cn(
                      'border-b border-border/20 hover:bg-muted/10 transition-colors cursor-pointer group',
                      idx % 2 === 0 ? 'bg-background' : 'bg-muted/5'
                    )}
                    onClick={() => setSelectedRun(run)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {isWebhook && <Globe size={12} className="text-primary shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{isWebhook ? 'Webhook Request' : getRunDisplayName(run, entityNames)}</p>
                          {!isWebhook && getRunEmail(run) && (
                            <p className="text-[9px] text-muted-foreground truncate">{getRunEmail(run)}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={cn('h-5 text-[8px] font-bold uppercase text-white', statusCfg.color)}>
                        {statusCfg.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-medium text-foreground/70">
                        {run.currentNodeLabel || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-medium tabular-nums">{getDuration(run)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" disabled={!!runIsProcessing}>
                            {runIsProcessing ? <Loader2 size={12} className="animate-spin" /> : <MoreHorizontal size={14} />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                          {run.status === 'running' && (
                            <>
                              <DropdownMenuItem onClick={() => handleAction('pause', run)} className="text-xs font-medium gap-2">
                                <Pause size={12} /> Pause
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction('forceAdvance', run)} className="text-xs font-medium gap-2">
                                <SkipForward size={12} /> Skip to Next Step
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAction('forceEnd', run)} className="text-xs font-medium gap-2 text-rose-600">
                                <Square size={12} /> Force End
                              </DropdownMenuItem>
                            </>
                          )}
                          {run.status === 'paused' && (
                            <>
                              <DropdownMenuItem onClick={() => handleAction('resume', run)} className="text-xs font-medium gap-2">
                                <Play size={12} /> Resume
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction('forceAdvance', run)} className="text-xs font-medium gap-2">
                                <SkipForward size={12} /> Skip to Next Step
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAction('forceEnd', run)} className="text-xs font-medium gap-2 text-rose-600">
                                <Square size={12} /> Force End
                              </DropdownMenuItem>
                            </>
                          )}
                          {run.status === 'failed' && (
                            <>
                              {getFailedStepNodeId(run) && (
                                <DropdownMenuItem onClick={() => handleAction('retry', run)} className="text-xs font-medium gap-2">
                                  <RefreshCw size={12} /> Retry Failed Step
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleAction('restart', run)} className="text-xs font-medium gap-2">
                                <RotateCcw size={12} /> Restart from Trigger
                              </DropdownMenuItem>
                            </>
                          )}
                          {run.status === 'completed' && (
                            <DropdownMenuItem onClick={() => handleAction('restart', run)} className="text-xs font-medium gap-2">
                              <RotateCcw size={12} /> Restart from Trigger
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {filteredRuns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center">
                    <Users size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs font-medium text-muted-foreground">
                      {runs?.length ? 'No runs match your filters' : 'No contacts have entered this automation yet'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
}
