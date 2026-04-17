import * as React from 'react';
import { Search, PlayCircle, Loader2, StopCircle, RefreshCw, Network } from 'lucide-react';
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
import { listAllJobs, createJob, cancelJob } from '@/lib/backoffice/backoffice-job-actions';
import { useBackoffice } from '../../context/BackofficeProvider';
import type { PlatformJob, PlatformJobType } from '@/lib/backoffice/backoffice-types';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-500/15 text-muted-foreground border-slate-500/20',
  running: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/15 text-red-400 border-red-500/20',
  cancelled: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
};

const JOB_TYPES: { id: PlatformJobType; name: string }[] = [
   { id: 'reseed_templates', name: 'Reseed System Templates' },
   { id: 'reindex_search', name: 'Rebuild Search Indices' },
   { id: 'repair_contacts', name: 'Repair Contact Relationships' },
   { id: 'backfill_analytics', name: 'Backfill Missing Analytics' },
   { id: 'migrate_data', name: 'Migrate Deprecated Data' }
];

export default function JobRunner() {
  const { can, profile } = useBackoffice();
  const [jobs, setJobs] = React.useState<PlatformJob[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Create Job Form State
  const [newType, setNewType] = React.useState<PlatformJobType>('reseed_templates');
  const [newLabel, setNewLabel] = React.useState('');
  const [newDryRun, setNewDryRun] = React.useState(true);
  const [newScope, setNewScope] = React.useState<'platform'|'organization'|'workspace'>('platform');
  const [newScopeId, setNewScopeId] = React.useState('');

  const loadJobs = React.useCallback(async () => {
    setIsLoading(true);
    const res = await listAllJobs();
    if (res.success && res.data) {
      setJobs(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleCreateJob = async () => {
     if (!profile) return;
     if (newScope !== 'platform' && !newScopeId) {
        alert('Scope ID is required when not targeting the entire platform.');
        return;
     }

     setIsSubmitting(true);
     const res = await createJob({
        type: newType,
        label: newLabel || `${newType}_${Date.now()}`,
        isDryRun: newDryRun,
        scope: { type: newScope, id: newScopeId || undefined }
     }, {
        userId: profile.id,
        name: profile.name,
        email: profile.email,
        role: 'super_admin'
     });

     if (res.success) {
        setNewLabel('');
        loadJobs();
     } else {
        alert(res.error);
     }
     setIsSubmitting(false);
  };

  const handleCancelJob = async (jobId: string) => {
     if (!profile) return;
     if (!confirm('Cancel this job? Processing will halt safely.')) return;
     
     const res = await cancelJob(jobId, {
        userId: profile.id,
        name: profile.name,
        email: profile.email,
        role: 'super_admin'
     });
     
     if (res.success) loadJobs();
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full overflow-hidden">
       {/* Sidebar Wizard */}
       <div className="w-full md:w-80 shrink-0 bg-muted/50 border border-border rounded-xl flex flex-col overflow-y-auto">
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
                <Select value={newScope} onValueChange={(v: any) => { setNewScope(v); setNewScopeId(''); }}>
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
             <Button 
                onClick={handleCreateJob} 
                disabled={isSubmitting || !can('operations', 'execute')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-foreground rounded-lg group"
             >
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />}
                Dispatch Job
             </Button>
          </div>
       </div>

       {/* Queue View */}
       <div className="flex-1 bg-muted/30 border border-border rounded-xl flex flex-col overflow-hidden">
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
                    <TableHead className="text-muted-foreground text-[10px] uppercase font-semibold w-12" />
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
                     <TableRow key={job.id} className="border-border hover:bg-accent/20">
                        <TableCell>
                           <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-semibold text-foreground hover:text-blue-400 cursor-pointer">{job.label || job.type}</span>
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
                                  <div className="bg-blue-500 h-1 rounded-full animate-pulse w-1/2"></div>
                               </div>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                           <span className="text-xs text-muted-foreground">{new Date(job.createdAt).toLocaleString()}</span>
                           <span className="block text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px] ml-auto">by {job.createdBy.name}</span>
                        </TableCell>
                        <TableCell>
                           {(job.status === 'pending' || job.status === 'running') && can('operations', 'edit') && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10" onClick={() => handleCancelJob(job.id)}>
                                 <StopCircle className="h-4 w-4" />
                              </Button>
                           )}
                        </TableCell>
                     </TableRow>
                  ))}
               </TableBody>
             </Table>
          </div>
       </div>
    </div>
  );
}
