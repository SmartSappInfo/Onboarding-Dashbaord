'use client';

import * as React from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  Search, PlayCircle, Loader2, StopCircle, RefreshCw,
  Network, RotateCcw, ShieldAlert, ChevronRight, Terminal,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  listAllJobs,
  createJob,
  cancelJob,
  triggerJobExecution,
} from '@/lib/backoffice/backoffice-job-actions';
import { useBackoffice } from '../../context/BackofficeProvider';
import { useAuth } from '@/firebase';
import { getErrorMessage } from '@/lib/backoffice/backoffice-errors';
import type { PlatformJob, PlatformJobType } from '@/lib/backoffice/backoffice-types';

type JobScopeType = 'platform' | 'organization' | 'workspace';

// ─────────────────────────────────────────────────
// Status badge color map
// ─────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-500/15 text-muted-foreground border-slate-500/20',
  running: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/15 text-red-400 border-red-500/20',
  cancelled: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
};

// ─────────────────────────────────────────────────
// Available job types exposed in the wizard
// ─────────────────────────────────────────────────

// Only job types with REAL execution handlers are exposed. The previous
// placeholder types (reseed_templates, reindex_search, repair_contacts, …)
// ran a generic no-op processor that logged a fake success message — they
// were removed rather than left to mislead operators.
const JOB_TYPES: { id: PlatformJobType; name: string }[] = [
   { id: 'migrate_messaging_templates_fer', name: 'Messaging Templates — FER' },
   { id: 'migrate_meetings_fer', name: 'Meetings Infrastructure — FER' },
   { id: 'migrate_hierarchical_rbac', name: 'Hierarchical RBAC Migration' },
   { id: 'encrypt_platform_secrets', name: 'Encrypt Platform Secrets (AI keys)' },
];

// ─────────────────────────────────────────────────
// Hydration-safe date component (rendering-hydration-no-flicker)
// ─────────────────────────────────────────────────

function ClientDate({ iso }: { iso: string }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="text-xs text-muted-foreground">—</span>;
  return <span className="text-xs text-muted-foreground">{new Date(iso).toLocaleString()}</span>;
}

// ─────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────

export default function JobRunner() {
  const { can, profile } = useBackoffice();
  const confirm = useConfirm();
  const auth = useAuth();
  const [jobs, setJobs] = React.useState<PlatformJob[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Non-blocking transition states (rendering-usetransition-loading)
  const [isSubmitting, startSubmitTransition] = React.useTransition();
  const [isCancelling, startCancelTransition] = React.useTransition();
  const [isTriggering, startTriggerTransition] = React.useTransition();

  // Create Job Form State
  const [newType, setNewType] = React.useState<PlatformJobType>('migrate_messaging_templates_fer');
  const [newLabel, setNewLabel] = React.useState('');
  const [newDryRun, setNewDryRun] = React.useState(true);
  const [newScope, setNewScope] = React.useState<JobScopeType>('platform');
  const [newScopeId, setNewScopeId] = React.useState('');

  // Slide-over drawer for log inspection
  const [selectedJob, setSelectedJob] = React.useState<PlatformJob | null>(null);

  const canExecute = can('operations', 'execute');

  // Helper to retrieve Firebase ID token (server-auth-actions)
  const getIdToken = React.useCallback(async (): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  }, [auth]);

  const loadJobs = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getIdToken();
      const res = await listAllJobs(token);
      if (res.success && res.data) {
        setJobs(res.data);
      }
    } catch {
      // Auth not ready yet — the AuthorizationGate handles redirects.
    } finally {
      setIsLoading(false);
    }
  }, [getIdToken]);

  React.useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleCreateJob = () => {
     if (!canExecute) return;
     if (newScope !== 'platform' && !newScopeId) {
        alert('Scope ID is required when not targeting the entire platform.');
        return;
     }

     startSubmitTransition(async () => {
       try {
         const token = await getIdToken();
         const res = await createJob({
           type: newType,
           label: newLabel || `${newType}_${Date.now()}`,
           isDryRun: newDryRun,
           scope: { type: newScope, id: newScopeId || undefined }
         }, token);

         if (res.success) {
           setNewLabel('');
           await loadJobs();
         } else {
           alert(res.error);
         }
       } catch (err: unknown) {
         alert(`Auth failed: ${getErrorMessage(err)}`);
       }
     });
  };

  const handleCancelJob = async (jobId: string) => {
     if (!(await confirm({ title: 'Cancel job?', description: 'Processing will halt safely.', confirmText: 'Cancel Job', variant: 'destructive' }))) return;

     startCancelTransition(async () => {
       try {
         const token = await getIdToken();
         const res = await cancelJob(jobId, token);
         if (res.success) await loadJobs();
       } catch (err: unknown) {
         alert(`Failed: ${getErrorMessage(err)}`);
       }
     });
  };

  const handleTriggerJob = (jobId: string) => {
    startTriggerTransition(async () => {
      try {
        const token = await getIdToken();
        const res = await triggerJobExecution(jobId, token);
        if (res.success) {
          await loadJobs();
        } else {
          alert(res.error);
        }
      } catch (err: unknown) {
        alert(`Failed: ${getErrorMessage(err)}`);
      }
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start">
       {/* ═══════════════════════════════════════════
           Sidebar Wizard — Create New Job
           ═══════════════════════════════════════════ */}
       <div className="w-full md:w-80 shrink-0 bg-muted/50 border border-border rounded-xl flex flex-col">
          <div className="p-4 border-b border-border sticky top-0 bg-muted z-10">
             <h3 className="font-semibold text-foreground">Create New Job</h3>
             <p className="text-[10px] text-muted-foreground mt-1">Deploy a mass asynchronous task across tenants.</p>
          </div>
          
          <div className="p-4 space-y-5 flex-1">
             <div>
                <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">Job Type</label>
                <Select value={newType} onValueChange={(v: PlatformJobType) => setNewType(v)}>
                   <SelectTrigger className="h-9 bg-background border-border text-sm">
                      <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                      {JOB_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                   </SelectContent>
                </Select>
             </div>

             <div>
                <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1">Job Label (Optional)</label>
                <Input 
                   placeholder="e.g. Weekly Search Fix" 
                   value={newLabel} onChange={(e) => setNewLabel(e.target.value)} 
                   className="h-9 bg-background border-border focus:border-blue-500/50 text-sm text-foreground" 
                />
             </div>

             <div className="pt-4 border-t border-border">
                <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-2">Scope Target</label>
                <Select value={newScope} onValueChange={(v: JobScopeType) => { setNewScope(v); setNewScopeId(''); }}>
                   <SelectTrigger className="h-9 bg-background border-border text-sm">
                      <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                      <SelectItem value="platform">Entire Platform (Global)</SelectItem>
                      <SelectItem value="organization">Specific Organization</SelectItem>
                      <SelectItem value="workspace">Specific Workspace</SelectItem>
                   </SelectContent>
                </Select>
                
                {newScope !== 'platform' && (
                   <Input 
                      placeholder={`Enter ${newScope} ID`} 
                      value={newScopeId} onChange={(e) => setNewScopeId(e.target.value)} 
                      className="h-9 mt-2 bg-background border-border font-mono text-xs text-foreground" 
                   />
                )}
             </div>

             <div className="pt-4 border-t border-border flex items-center justify-between">
                <div>
                   <label className="text-xs text-foreground font-medium block">Dry Run Enabled</label>
                   <span className="text-[10px] text-muted-foreground">Previews changes without writing.</span>
                </div>
                <Switch checked={newDryRun} onCheckedChange={setNewDryRun} className="data-[state=checked]:bg-emerald-500" />
             </div>
          </div>
          
          <div className="p-4 border-t border-border shrink-0">
             <TooltipProvider>
               <Tooltip>
                 <TooltipTrigger asChild>
                   <div>
                     <Button 
                        onClick={handleCreateJob} 
                        disabled={isSubmitting || !canExecute}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg group disabled:opacity-60"
                     >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <PlayCircle className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                        )}
                        Dispatch Job
                     </Button>
                   </div>
                 </TooltipTrigger>
                 {!canExecute && (
                   <TooltipContent side="top" className="bg-red-950 border-red-500/30 text-red-300 max-w-[240px]">
                     <div className="flex items-start gap-2">
                       <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                       <div>
                         <p className="text-xs font-semibold">Insufficient Permissions</p>
                         <p className="text-[10px] mt-1 opacity-80">
                           Your role lacks the <code className="bg-red-500/20 px-1 rounded">operations:execute</code> permission. Contact a Super Admin.
                         </p>
                       </div>
                     </div>
                   </TooltipContent>
                 )}
               </Tooltip>
             </TooltipProvider>
          </div>
       </div>

       {/* ═══════════════════════════════════════════
           Execution Queue Table
           ═══════════════════════════════════════════ */}
       <div className="flex-1 w-full min-w-0 bg-muted/30 border border-border rounded-xl flex flex-col overflow-hidden relative min-h-[40rem] max-h-[calc(100svh-13rem)]">
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
             <h3 className="font-semibold text-foreground">Execution Queue <span className="text-muted-foreground ml-2 font-normal text-sm">Last 100 Jobs</span></h3>
             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={loadJobs}>
                <RefreshCw className="h-4 w-4" />
             </Button>
          </div>
          
          <div className="flex-1 overflow-auto">
             <Table>
               <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10">
                 <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-[10px] uppercase font-semibold">Job ID & Details</TableHead>
                    <TableHead className="text-muted-foreground text-[10px] uppercase font-semibold">Target</TableHead>
                    <TableHead className="text-muted-foreground text-[10px] uppercase font-semibold">Status</TableHead>
                    <TableHead className="text-muted-foreground text-[10px] uppercase font-semibold text-right">Initiated</TableHead>
                    <TableHead className="text-muted-foreground text-[10px] uppercase font-semibold w-28 text-right">Actions</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                  {isLoading ? (
                     <TableRow className="border-border">
                        <TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">Loading Job Queue...</TableCell>
                     </TableRow>
                  ) : jobs.length === 0 ? (
                     <TableRow className="border-border">
                        <TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">No jobs historically executed.</TableCell>
                     </TableRow>
                  ) : jobs.map(job => (
                     <TableRow key={job.id} className="border-border hover:bg-accent/20 cursor-pointer" onClick={() => setSelectedJob(job)}>
                        <TableCell>
                           <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-semibold text-foreground hover:text-blue-400 flex items-center gap-1">
                                {job.label || job.type}
                                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                              </span>
                              <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-mono text-muted-foreground">{job.id.substring(0, 8)}...</span>
                                 {job.isDryRun && <Badge variant="outline" className="h-4 px-1 py-0 text-[8px] bg-accent border-border text-foreground/80">Dry Run</Badge>}
                              </div>
                           </div>
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-foreground/80 capitalize flex items-center gap-1">
                                 {job.scope.type === 'platform' ? <Network className="h-3 w-3 text-indigo-400" /> : <div className="h-2 w-2 rounded-full bg-blue-500" />}
                                 {job.scope.type}
                              </span>
                              {job.scope.id && <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[100px]">{job.scope.id}</span>}
                           </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className={`text-[9px] uppercase px-1.5 h-5 ${STATUS_COLORS[job.status]}`}>{job.status}</Badge>
                            {job.status === 'running' && (
                               <div className="w-20 bg-accent rounded-full h-1 mt-1.5 overflow-hidden">
                                  <div className="bg-blue-500 h-1 rounded-full animate-pulse" style={{ width: '60%' }} />
                               </div>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                           <ClientDate iso={job.createdAt} />
                           <span className="block text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px] ml-auto">by {job.createdBy.name}</span>
                        </TableCell>
                        <TableCell className="text-right">
                           <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                             {/* Manual Start/Retry Button — for pending or failed jobs */}
                             {(job.status === 'pending' || job.status === 'failed') && canExecute && (
                               <TooltipProvider>
                                 <Tooltip>
                                   <TooltipTrigger asChild>
                                     <Button
                                       variant="ghost"
                                       size="icon"
                                       className="h-8 w-8 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10"
                                       disabled={isTriggering}
                                       onClick={() => handleTriggerJob(job.id)}
                                     >
                                       {isTriggering ? (
                                         <Loader2 className="h-4 w-4 animate-spin" />
                                       ) : job.status === 'failed' ? (
                                         <RotateCcw className="h-4 w-4" />
                                       ) : (
                                         <PlayCircle className="h-4 w-4" />
                                       )}
                                     </Button>
                                   </TooltipTrigger>
                                   <TooltipContent side="left">
                                     <p className="text-xs">{job.status === 'failed' ? 'Retry Execution' : 'Start Execution'}</p>
                                   </TooltipContent>
                                 </Tooltip>
                               </TooltipProvider>
                             )}

                             {/* Cancel Button — for pending or running jobs */}
                             {(job.status === 'pending' || job.status === 'running') && can('operations', 'edit') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                  disabled={isCancelling}
                                  onClick={() => handleCancelJob(job.id)}
                                >
                                   <StopCircle className="h-4 w-4" />
                                </Button>
                             )}

                             {/* Log Inspector Button */}
                             <Button
                               variant="ghost"
                               size="icon"
                               className="h-8 w-8 text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10"
                               onClick={() => setSelectedJob(job)}
                             >
                               <Terminal className="h-4 w-4" />
                             </Button>
                           </div>
                        </TableCell>
                     </TableRow>
                  ))}
               </TableBody>
             </Table>
          </div>

          {/* ═══════════════════════════════════════════
              Slide-Over Log Console Drawer
              ═══════════════════════════════════════════ */}
          {selectedJob && (
            <div className="absolute inset-0 z-30 flex">
              {/* Backdrop */}
              <div
                className="flex-1 bg-black/40 backdrop-blur-sm"
                onClick={() => setSelectedJob(null)}
              />
              {/* Drawer Panel */}
              <div className="w-full max-w-md bg-background border-l border-border flex flex-col animate-in slide-in-from-right duration-300">
                {/* Drawer Header */}
                <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate">
                      {selectedJob.label || selectedJob.type}
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{selectedJob.id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <Badge variant="outline" className={`text-[9px] uppercase px-1.5 h-5 ${STATUS_COLORS[selectedJob.status]}`}>
                      {selectedJob.status}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setSelectedJob(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Metadata Row */}
                <div className="grid grid-cols-3 gap-3 p-4 border-b border-border text-center shrink-0">
                  <div>
                    <span className="block text-lg font-bold text-foreground">{selectedJob.progress?.total ?? 0}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Total</span>
                  </div>
                  <div>
                    <span className="block text-lg font-bold text-emerald-400">{selectedJob.progress?.processed ?? 0}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Processed</span>
                  </div>
                  <div>
                    <span className="block text-lg font-bold text-red-400">{selectedJob.progress?.errors ?? 0}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Errors</span>
                  </div>
                </div>

                {/* Console Log Terminal */}
                <div className="flex-1 overflow-auto bg-[#0c0c0c] p-4">
                  <div className="font-mono text-xs space-y-1.5 leading-relaxed">
                    {(selectedJob.logs || []).length === 0 ? (
                      <span className="text-slate-600 italic">No execution logs recorded.</span>
                    ) : (
                      (selectedJob.logs || []).map((log, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-slate-600 shrink-0 w-[130px]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className={`shrink-0 uppercase text-[9px] font-bold px-1 py-0.5 rounded ${
                            log.level === 'error' ? 'bg-red-500/20 text-red-400' :
                            log.level === 'warn' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {log.level}
                          </span>
                          <span className="text-slate-300 break-all">{log.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Drawer Footer Actions */}
                <div className="p-3 border-t border-border flex items-center justify-between shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    {selectedJob.isDryRun ? '🛡 Dry Run Mode' : '⚡ Live Execution'}
                  </span>
                  {(selectedJob.status === 'pending' || selectedJob.status === 'failed') && canExecute && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs"
                      disabled={isTriggering}
                      onClick={() => handleTriggerJob(selectedJob.id)}
                    >
                      {isTriggering ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5 mr-1.5" />}
                      {selectedJob.status === 'failed' ? 'Retry' : 'Start'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
       </div>
    </div>
  );
}
