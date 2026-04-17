import * as React from 'react';
import { Activity, Play, AlertCircle, Building2, CheckCircle2, XCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { runTenantDiagnostics } from '@/lib/backoffice/backoffice-job-actions';
import { useBackoffice } from '../../context/BackofficeProvider';

export default function TenantDiagnostics() {
  const { profile, can } = useBackoffice();
  
  const [scopeType, setScopeType] = React.useState<'organization' | 'workspace'>('organization');
  const [scopeId, setScopeId] = React.useState('');
  
  const [isRunning, setIsRunning] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);

  const handleRunDiagnostics = async () => {
     if (!profile) return;
     if (!scopeId.trim()) {
        alert('Please provide a target ID.');
        return;
     }
     
     setIsRunning(true);
     setResult(null);

     // Artificial minor delay to simulate intense hooking
     await new Promise(r => setTimeout(r, 600));

     const res = await runTenantDiagnostics(scopeType, scopeId.trim(), {
        userId: profile.id,
        name: profile.name,
        email: profile.email,
        role: 'super_admin'
     });

     if (res.success) {
        setResult(res.data);
     } else {
        alert(`Failed to execute engine: ${res.error}`);
     }

     setIsRunning(false);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full p-4 md:p-6 bg-background rounded-xl border border-border overflow-hidden">
       {/* Diagnostic Driver */}
       <div className="w-full md:w-[400px] flex flex-col gap-6 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">Diagnostic Engine</h2>
            <p className="text-sm text-muted-foreground">
               Run isolated schema integrity, fallback parameter matching, and orphaned reference scans against a targeted tenant architecture layer.
            </p>
          </div>

          <div className="bg-muted/60 border border-border rounded-xl p-5 space-y-5">
             <div>
                <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-2">Target Type</label>
                <div className="grid grid-cols-2 gap-2">
                   <Button 
                      variant={scopeType === 'organization' ? 'secondary' : 'outline'}
                      onClick={() => setScopeType('organization')}
                      className={`h-10 text-xs ${scopeType === 'organization' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-transparent text-muted-foreground border-border'}`}
                   >
                      <Building2 className="h-3.5 w-3.5 mr-2" /> Organization
                   </Button>
                   <Button 
                      variant={scopeType === 'workspace' ? 'secondary' : 'outline'}
                      onClick={() => setScopeType('workspace')}
                      className={`h-10 text-xs ${scopeType === 'workspace' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-transparent text-muted-foreground border-border'}`}
                   >
                      <Activity className="h-3.5 w-3.5 mr-2" /> Workspace
                   </Button>
                </div>
             </div>

             <div>
                <label className="text-[10px] text-muted-foreground uppercase font-semibold block mb-2">Target ID</label>
                <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                   <Input 
                      placeholder={`Enter ${scopeType} ID...`}
                      value={scopeId}
                      onChange={(e) => setScopeId(e.target.value)}
                      className="h-10 pl-9 bg-background border-border focus:border-indigo-500/50 text-foreground font-mono text-sm"
                   />
                </div>
             </div>

             <Button 
                onClick={handleRunDiagnostics}
                disabled={isRunning || !can('operations', 'execute')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-foreground shadow-[0_0_15px_rgba(79,70,229,0.3)] h-10"
             >
                {isRunning ? (
                   <span className="flex items-center"><Activity className="animate-spin h-4 w-4 mr-2" /> Penetrating Configuration Layer...</span>
                ) : (
                   <span className="flex items-center"><Play className="h-4 w-4 mr-2" /> Initialize System Scan</span>
                )}
             </Button>

             <div className="p-3 bg-background rounded-lg border border-border text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-muted-foreground mb-1 block">Audit Tracking Note</span>
                Diagnostic scans perform read-heavy document traversals without mutation side-effects, but their triggers are hard-logged into the audit trail for compliance.
             </div>
          </div>
       </div>

       {/* Interactive Reporting Pane */}
       <div className="flex-1 bg-muted border border-border rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
          
          <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#f8fafc 1px, transparent 1px), linear-gradient(90deg, #f8fafc 1px, transparent 1px)', backgroundSize: '40px 40px', maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 80%)' }} />

          {!result && !isRunning && (
             <div className="z-10 text-center px-6">
                <div className="h-16 w-16 bg-accent/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-border shadow-xl shadow-slate-900">
                   <Activity className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-foreground font-semibold text-lg">System Telemetry Awaiting Scan</h3>
                <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">Input a target ID and run diagnostics to fetch live system health markers and potential orphaned state errors.</p>
             </div>
          )}

          {isRunning && (
             <div className="z-10 flex flex-col items-center">
                 <div className="relative">
                    <div className="h-24 w-24 border-t-2 border-indigo-500 border-solid rounded-full animate-spin relative z-20"></div>
                    <div className="absolute inset-0 h-24 w-24 border-2 border-border border-solid rounded-full z-10"></div>
                 </div>
                 <span className="text-indigo-400 mt-6 font-mono text-xs tracking-[0.2em] font-semibold animate-pulse">EVALUATING INTEGRITY</span>
             </div>
          )}

          {result && !isRunning && (
             <div className="z-10 w-full h-full p-6 flex flex-col">
                <div className="flex items-center justify-between border-b border-border pb-4 mb-4 shrink-0">
                   <div>
                      <h3 className="text-foreground font-semibold flex items-center gap-2">
                         Diagnostic Output
                         {result.stats.passed ? <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">PASSED</Badge> : <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">DEFICIENT</Badge>}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">Run Logged At: {new Date(result.timestamp).toLocaleString()}</p>
                   </div>
                   <div className="flex gap-4">
                      <div className="text-center">
                         <span className="block text-2xl font-bold text-foreground">{result.stats.configChecks}</span>
                         <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Config Node Checks</span>
                      </div>
                      <div className="text-center">
                         <span className="block text-2xl font-bold text-foreground">{result.stats.schemaValidations}</span>
                         <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Schema Checks</span>
                      </div>
                   </div>
                </div>

                <div className="flex-1 overflow-auto space-y-3 pr-2">
                   {result.issues.length === 0 ? (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                         <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                         <div>
                            <span className="text-sm font-semibold text-emerald-400">Perfect Execution</span>
                            <p className="text-xs text-emerald-500/70 mt-0.5">All configuration nodes bounded properly. No orphaned components tracked dynamically.</p>
                         </div>
                      </div>
                   ) : (
                      result.issues.map((issue: any, i: number) => (
                         <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${issue.severity === 'error' ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                            {issue.severity === 'error' ? <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />}
                            <div className="flex-1">
                               <div className="flex justify-between">
                                  <span className={`text-sm font-semibold ${issue.severity === 'error' ? 'text-red-400' : 'text-amber-400'}`}>{issue.component}</span>
                               </div>
                               <p className="text-xs text-foreground/80 mt-1 leading-relaxed">{issue.message}</p>
                               {issue.resolution && (
                                  <div className="mt-3 pt-3 border-t border-border">
                                     <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Recommended Resolution</span>
                                     <p className="text-xs text-muted-foreground">{issue.resolution}</p>
                                  </div>
                               )}
                            </div>
                         </div>
                      ))
                   )}
                </div>
             </div>
          )}
       </div>
    </div>
  );
}
