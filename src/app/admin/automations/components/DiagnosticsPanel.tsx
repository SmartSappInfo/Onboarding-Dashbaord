'use client';

import * as React from 'react';
import { 
  X, 
  ArrowLeft, 
  Search, 
  Activity, 
  Loader2, 
  ChevronRight, 
  Info,
  Calendar,
  AlertCircle,
  Database
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { StepTimeline } from './StepTimeline';
import type { AutomationRun } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { manuallyReleaseWaitJobAction, manuallyEndAutomationRunAction } from '@/lib/automation-actions';

interface DiagnosticsPanelProps {
  automationId: string;
  nodes: any[];
  onSelectRun: (run: AutomationRun | null) => void;
  selectedRun: AutomationRun | null;
  onClose: () => void;
  filterNodeId?: string | null;
  onClearFilterNodeId?: () => void;
}

type FilterStatus = 'ALL' | 'running' | 'completed' | 'failed';

export function DiagnosticsPanel({
  automationId,
  nodes,
  onSelectRun,
  selectedRun,
  onClose,
  filterNodeId = null,
  onClearFilterNodeId
}: DiagnosticsPanelProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [statusFilter, setStatusFilter] = React.useState<FilterStatus>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [jsonExpanded, setJsonExpanded] = React.useState(false);
  const [isProcessingAction, setIsProcessingAction] = React.useState<string | null>(null);

  // Memoized query to fetch automation runs in real-time
  const runsQuery = useMemoFirebase(() => {
    if (!firestore || !automationId) return null;
    return query(
      collection(firestore, 'automation_runs'),
      where('automationId', '==', automationId),
      orderBy('startedAt', 'desc'),
      limit(50)
    );
  }, [firestore, automationId]);

  const { data: runs, isLoading, error } = useCollection<AutomationRun>(runsQuery);

  // Memoized query to fetch pending jobs for filtered node
  const pendingJobsQuery = useMemoFirebase(() => {
    if (!firestore || !automationId || !filterNodeId) return null;
    return query(
      collection(firestore, 'automation_jobs'),
      where('automationId', '==', automationId),
      where('targetNodeId', '==', filterNodeId),
      where('status', '==', 'pending')
    );
  }, [firestore, automationId, filterNodeId]);

  const { data: pendingJobs } = useCollection<any>(pendingJobsQuery);

  // Reset selected run on unmount or automationId change
  React.useEffect(() => {
    return () => onSelectRun(null);
  }, [automationId, onSelectRun]);

  // Sync selected run with real-time updates from collection if it is currently selected
  React.useEffect(() => {
    if (selectedRun && runs) {
      const updated = runs.find(r => r.id === selectedRun.id);
      if (updated && JSON.stringify(updated.steps) !== JSON.stringify(selectedRun.steps)) {
        onSelectRun(updated);
      }
    }
  }, [runs, selectedRun, onSelectRun]);

  // Query jobs for currently selected run to locate wait step ids
  const selectedRunJobsQuery = useMemoFirebase(() => {
    if (!firestore || !selectedRun) return null;
    return query(
      collection(firestore, 'automation_jobs'),
      where('runId', '==', selectedRun.id),
      where('status', '==', 'pending')
    );
  }, [firestore, selectedRun]);

  const { data: selectedRunJobs } = useCollection<any>(selectedRunJobsQuery);
  const activeWaitJob = selectedRunJobs?.find((j: any) => j.status === 'pending');

  // Filter runs based on status, search query, and node filter list
  const filteredRuns = React.useMemo(() => {
    if (!runs) return [];
    return runs.filter(run => {
      const matchesStatus = statusFilter === 'ALL' || run.status === statusFilter;
      
      const displayName = (
        run.triggerData?.displayName ||
        run.triggerData?.entityName ||
        run.triggerData?.email ||
        run.entityId ||
        run.id
      ).toLowerCase();
      
      const matchesSearch = displayName.includes(searchQuery.toLowerCase());

      let matchesNodeFilter = true;
      if (filterNodeId && pendingJobs) {
        matchesNodeFilter = pendingJobs.some(job => job.runId === run.id);
      }
      
      return matchesStatus && matchesSearch && matchesNodeFilter;
    });
  }, [runs, statusFilter, searchQuery, filterNodeId, pendingJobs]);

  const filterNode = React.useMemo(() => {
    if (!filterNodeId) return null;
    return nodes.find(n => n.id === filterNodeId);
  }, [filterNodeId, nodes]);

  const handleForceResume = async (jobId: string) => {
    if (!user) return;
    setIsProcessingAction(jobId);
    try {
      const res = await manuallyReleaseWaitJobAction(jobId, user.uid);
      if (res.success) {
        toast({
          title: 'Wait Step Resumed',
          description: 'Contact has been successfully advanced to the next step.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Release Failed',
          description: res.error || 'Failed to manually advance step.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Server action failure.',
      });
    } finally {
      setIsProcessingAction(null);
    }
  };

  const handleEndAutomation = async (runId: string) => {
    if (!user) return;
    if (!(await confirm({ title: 'End automation run?', description: 'The contact will be marked as finished and pending steps will be cancelled.', confirmText: 'End Run', variant: 'destructive' }))) return;

    setIsProcessingAction(runId);
    try {
      const res = await manuallyEndAutomationRunAction(runId, user.uid);
      if (res.success) {
        toast({
          title: 'Automation Terminated',
          description: 'Execution run successfully completed and scheduled tasks cancelled.',
        });
        if (selectedRun?.id === runId) {
          onSelectRun(null);
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Termination Failed',
          description: res.error || 'Failed to cancel automation run.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Server action failure.',
      });
    } finally {
      setIsProcessingAction(null);
    }
  };

  const getStatusBadge = (status: AutomationRun['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-none text-[9px] uppercase font-bold px-1.5 py-0.5">Completed</Badge>;
      case 'failed':
        return <Badge className="bg-rose-500/15 text-rose-600 border-none text-[9px] uppercase font-bold px-1.5 py-0.5">Failed</Badge>;
      case 'running':
      default:
        return <Badge className="bg-purple-500/15 text-purple-600 border-none text-[9px] uppercase font-bold px-1.5 py-0.5 animate-pulse">Running</Badge>;
    }
  };

  const getRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <Card className="pointer-events-auto w-full h-full bg-card/95 backdrop-blur-md border border-border/70 rounded-[1.5rem] shadow-xl flex flex-col overflow-hidden">
      
      {/* Header */}
      <CardHeader className="p-4 border-b border-border/50 shrink-0 flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600">
            <Activity size={16} className="animate-pulse" />
          </div>
          <div className="text-left">
            <CardTitle className="text-sm font-bold text-foreground">Automation Diagnostics</CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">Execution audit logs and status tracing</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X size={15} />
        </Button>
      </CardHeader>

      {/* Main Content switcher: List OR Details */}
      {!selectedRun ? (
        // LIST VIEW
        <>
          <div className="p-3 border-b border-border/40 space-y-2 shrink-0">
            {/* Filter Node Warning Tag */}
            {filterNodeId && (
              <div className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-xl p-2 text-[10px] font-semibold text-purple-800">
                <span>Filtering by: <span className="font-bold text-purple-900">{filterNode?.data?.label || 'Target Node'}</span></span>
                <button
                  type="button"
                  onClick={onClearFilterNodeId}
                  className="p-1 rounded bg-purple-100 text-purple-800 hover:bg-purple-200 transition-colors"
                >
                  Clear filter
                </button>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg border">
              {(['ALL', 'running', 'completed', 'failed'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={cn(
                    "flex-1 text-[10px] font-semibold py-1 rounded-md transition-all uppercase tracking-wider",
                    statusFilter === tab
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab === 'ALL' ? 'All' : tab}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search contact or run ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg bg-muted/20 border-border/40 focus-visible:ring-primary/25"
              />
            </div>
          </div>

          {/* Runs List */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 space-y-1.5 text-left">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-[10px] font-semibold">Retrieving execution history...</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-rose-500 p-4 gap-2">
                  <AlertCircle size={20} />
                  <span className="text-[11px] font-bold">Failed to load run logs</span>
                  <span className="text-[9px] opacity-80 leading-normal">{error.message}</span>
                </div>
              ) : filteredRuns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center gap-2">
                  <Info size={20} className="text-muted-foreground/50" />
                  <span className="text-[11px] font-semibold">No runs match your filters</span>
                </div>
              ) : (
                filteredRuns.map(run => {
                  const entityName = 
                    run.triggerData?.displayName ||
                    run.triggerData?.entityName ||
                    run.triggerData?.email ||
                    run.entityId ||
                    `Run #${run.id.slice(0, 6)}`;
                  
                  return (
                    <div
                      key={run.id}
                      onClick={() => onSelectRun(run)}
                      className="w-full p-2.5 rounded-xl border border-border/40 hover:border-primary/20 hover:bg-primary/5 hover:shadow-sm transition-all duration-200 flex items-center justify-between gap-3 text-left cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground truncate max-w-[170px] group-hover:text-primary transition-colors">
                            {entityName}
                          </span>
                          {getStatusBadge(run.status)}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                          <Calendar size={10} />
                          <span>Started {getRelativeTime(run.startedAt)}</span>
                          {run.steps && (
                            <>
                              <span>•</span>
                              <span>{Object.keys(run.steps).filter(k => k !== '__overflow').length} steps</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {run.status === 'running' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isProcessingAction === run.id}
                            className="h-7 px-2 text-[9px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEndAutomation(run.id);
                            }}
                          >
                            {isProcessingAction === run.id ? 'Ending...' : 'End'}
                          </Button>
                        )}
                        <ChevronRight size={13} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </>
      ) : (
        // DETAILS VIEW
        <>
          {/* Back button header */}
          <div className="px-3 py-2 border-b border-border/40 bg-muted/20 shrink-0 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onSelectRun(null);
                setJsonExpanded(false);
              }}
              className="h-7 text-[10px] font-semibold text-muted-foreground hover:text-foreground rounded-lg px-2 flex items-center gap-1 text-left"
            >
              <ArrowLeft size={11} /> Back to Runs
            </Button>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-muted-foreground">ID: {selectedRun.id.slice(0, 8)}</span>
              {getStatusBadge(selectedRun.status)}
            </div>
          </div>

          {/* Details Scroll Area */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-4 text-left">
              {/* Entity Quick Info */}
              <div className="space-y-1 bg-muted/30 p-3 rounded-xl border border-border/40">
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Contact Context</span>
                <h4 className="text-xs font-bold text-foreground truncate">
                  {selectedRun.triggerData?.displayName || selectedRun.triggerData?.entityName || 'Unassigned'}
                </h4>
                <div className="flex flex-wrap gap-x-2 gap-y-1 text-[9px] text-muted-foreground">
                  {selectedRun.triggerData?.email && <span>{selectedRun.triggerData.email}</span>}
                  {selectedRun.entityId && (
                    <>
                      <span className="opacity-40">|</span>
                      <span>Entity ID: <code className="font-mono text-[8px]">{selectedRun.entityId}</code></span>
                    </>
                  )}
                </div>
              </div>

              {/* Active Wait Node Actions */}
              {selectedRun.status === 'running' && (
                <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-700">Automation Running</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={isProcessingAction === selectedRun.id}
                      onClick={() => handleEndAutomation(selectedRun.id)}
                      className="h-7 text-[9px] text-rose-600 hover:bg-rose-50 border-rose-200 rounded-lg font-bold"
                    >
                      {isProcessingAction === selectedRun.id ? 'Terminating...' : 'End Automation'}
                    </Button>
                  </div>
                  {activeWaitJob && (
                    <div className="flex items-center justify-between border-t border-purple-500/10 pt-2 mt-1">
                      <span className="text-muted-foreground font-medium text-[9px]">Contact is currently waiting at step.</span>
                      <Button 
                        size="sm" 
                        disabled={isProcessingAction === activeWaitJob.id}
                        onClick={() => handleForceResume(activeWaitJob.id)}
                        className="h-7 text-[9px] bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-sm"
                      >
                        {isProcessingAction === activeWaitJob.id ? 'Resuming...' : 'Force Resume / Next Step'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Execution Steps Title */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                  Execution Step Timeline
                </h5>
                <StepTimeline steps={selectedRun.steps} nodes={nodes} />
              </div>

              {/* Collapsible Trigger Payload JSON */}
              <div className="border border-border/50 rounded-xl overflow-hidden bg-background">
                <button
                  type="button"
                  onClick={() => setJsonExpanded(!jsonExpanded)}
                  className="w-full p-3 flex items-center justify-between bg-muted/10 hover:bg-muted/25 transition-colors text-left"
                >
                  <span className="text-[10px] font-bold text-foreground flex items-center gap-1.5">
                    <Database size={12} className="text-primary" /> Inspect Trigger Data
                  </span>
                  <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", jsonExpanded && "rotate-90")} />
                </button>
                {jsonExpanded && (
                  <div className="border-t border-border/40 p-3 bg-muted/5 font-mono text-[9px] text-foreground/80 overflow-x-auto leading-relaxed select-all">
                    <pre className="m-0">
                      {JSON.stringify(selectedRun.triggerData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </>
      )}
    </Card>
  );
}
