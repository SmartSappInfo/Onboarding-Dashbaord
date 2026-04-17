'use client';

import * as React from 'react';
import { Search, History, Filter, User, Fingerprint, CalendarDays, KeyRound, Maximize2, Shield } from 'lucide-react';
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
import { fetchAuditLogs } from '@/lib/backoffice/backoffice-audit-actions';
import AuditDiffViewer from './AuditDiffViewer';
import type { PlatformAuditLog } from '@/lib/backoffice/backoffice-types';

export default function AuditLogViewerClient() {
  const [logs, setLogs] = React.useState<PlatformAuditLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  // Filters
  const [searchFilter, setSearchFilter] = React.useState('');
  const [resourceFilter, setResourceFilter] = React.useState('all');
  const [actorFilter, setActorFilter] = React.useState('all');

  const [expandedLog, setExpandedLog] = React.useState<string | null>(null);

  const loadLogs = React.useCallback(async () => {
    setIsLoading(true);
    const res = await fetchAuditLogs({ limit: 150 });
    if (res.success && res.data) {
      setLogs(res.data);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const uniqueResources = React.useMemo(() => Array.from(new Set(logs.map(L => L.resourceType))).sort(), [logs]);
  const uniqueActors = React.useMemo(() => Array.from(new Set(logs.map(L => L.actor.name))).sort(), [logs]);

  const filteredLogs = React.useMemo(() => {
     let temp = logs;
     if (resourceFilter !== 'all') temp = temp.filter(L => L.resourceType === resourceFilter);
     if (actorFilter !== 'all') temp = temp.filter(L => L.actor.name === actorFilter);
     if (searchFilter) {
        const q = searchFilter.toLowerCase();
        temp = temp.filter(L => 
           L.action.toLowerCase().includes(q) || 
           L.resourceId.toLowerCase().includes(q)
        );
     }
     return temp;
  }, [logs, resourceFilter, actorFilter, searchFilter]);

  return (
    <div className="space-y-6 flex flex-col h-full overflow-hidden">
      {/* Page Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-indigo-400" /> Platform Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Immutable log of all super-administrative operations and tenant-scoped structural mutations.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-muted/50 border border-border rounded-xl p-3 shrink-0">
         <div className="relative flex-1 min-w-[200px]">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input
             placeholder="Search Actions or Resource IDs..."
             value={searchFilter}
             onChange={(e) => setSearchFilter(e.target.value)}
             className="pl-10 h-10 bg-background border-border text-foreground font-mono text-xs rounded-lg"
           />
         </div>

         <Select value={resourceFilter} onValueChange={setResourceFilter}>
           <SelectTrigger className="w-[180px] h-10 bg-background border-border text-foreground/80 rounded-lg">
             <Filter className="h-4 w-4 mr-2 text-muted-foreground" /> <SelectValue placeholder="Resource Type" />
           </SelectTrigger>
           <SelectContent className="bg-muted border-border">
             <SelectItem value="all">Any Resource</SelectItem>
             {uniqueResources.map(r => <SelectItem key={r} value={r} className="capitalize">{r.replace('_', ' ')}</SelectItem>)}
           </SelectContent>
         </Select>

         <Select value={actorFilter} onValueChange={setActorFilter}>
           <SelectTrigger className="w-[180px] h-10 bg-background border-border text-foreground/80 rounded-lg">
             <User className="h-4 w-4 mr-2 text-muted-foreground" /> <SelectValue placeholder="Actor" />
           </SelectTrigger>
           <SelectContent className="bg-muted border-border">
             <SelectItem value="all">Any Actor</SelectItem>
             {uniqueActors.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
           </SelectContent>
         </Select>
         
         <Button variant="outline" className="h-10 border-border text-muted-foreground bg-transparent hover:bg-accent hover:text-foreground" onClick={loadLogs}>
            <History className="h-4 w-4" />
         </Button>
      </div>

      <div className="flex-1 bg-muted/30 border border-border rounded-xl overflow-hidden flex flex-col">
         <div className="flex-1 overflow-auto">
            <Table>
               <TableHeader className="sticky top-0 bg-background border-b border-border z-10">
                 <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-[10px] uppercase font-semibold">Timeline</TableHead>
                    <TableHead className="text-muted-foreground text-[10px] uppercase font-semibold">Actor Identity</TableHead>
                    <TableHead className="text-muted-foreground text-[10px] uppercase font-semibold">Mutation Context</TableHead>
                    <TableHead className="text-muted-foreground text-[10px] uppercase font-semibold text-right">Payload Checksum</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                  {isLoading ? (
                     <TableRow className="border-border">
                        <TableCell colSpan={4} className="text-center py-16">
                           <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent flex items-center justify-center rounded-full animate-spin mx-auto mb-4" />
                           <span className="text-xs text-muted-foreground font-mono">Decrypting Governance Payload...</span>
                        </TableCell>
                     </TableRow>
                  ) : filteredLogs.length === 0 ? (
                     <TableRow className="border-border">
                        <TableCell colSpan={4} className="text-center py-12 text-sm text-muted-foreground">No governed actions found in specified constraints.</TableCell>
                     </TableRow>
                  ) : filteredLogs.map((log) => {
                     const isExpanded = expandedLog === log.id;
                     return (
                        <React.Fragment key={log.id}>
                           <TableRow 
                              className={`border-border cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-500/5' : 'hover:bg-accent/30'}`}
                              onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                           >
                              <TableCell className="align-top py-4">
                                 <div className="flex items-start gap-2">
                                    <CalendarDays className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
                                    <div>
                                       <span className="text-xs text-foreground/80 block">{new Date(log.timestamp).toLocaleDateString()}</span>
                                       <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                 </div>
                              </TableCell>
                              <TableCell className="align-top py-4">
                                 <div className="flex bg-muted border border-border rounded-lg p-2 gap-3 w-fit items-center">
                                    <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
                                       {log.actor.name.charAt(0)}
                                    </div>
                                    <div className="flex flex-col pr-2">
                                       <span className="text-xs font-semibold text-foreground leading-none mb-1">{log.actor.name}</span>
                                       <span className="text-[9px] text-muted-foreground uppercase tracking-widest">{log.actor.role.replace('_', ' ')}</span>
                                    </div>
                                 </div>
                              </TableCell>
                              <TableCell className="align-top py-4">
                                 <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                       <Badge variant="outline" className={`text-[9px] uppercase px-1.5 py-0 border-indigo-500/30 bg-indigo-500/10 text-indigo-400 font-mono tracking-wider`}>
                                          {log.action}
                                       </Badge>
                                       <span className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1 font-semibold">
                                          <KeyRound className="h-3 w-3" /> {log.resourceType.replace('_', ' ')}
                                       </span>
                                    </div>
                                    <span className="text-xs font-mono text-muted-foreground truncate max-w-sm" title={log.resourceId}>{log.resourceId}</span>
                                 </div>
                              </TableCell>
                              <TableCell className="align-top py-4 text-right">
                                 <div className="flex flex-col items-end gap-2">
                                    <span className="text-[10px] font-mono text-slate-600 bg-muted px-1.5 py-0.5 rounded border border-border">{log.id.split('-').pop()}</span>
                                    <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase tracking-widest text-indigo-400 hover:bg-accent hover:text-foreground mt-1">
                                       <Maximize2 className="h-3 w-3 mr-1.5" /> Toggle Diff
                                    </Button>
                                 </div>
                              </TableCell>
                           </TableRow>
                           
                           {isExpanded && (
                              <TableRow className="bg-[#0f172a] hover:bg-[#0f172a] border-b-2 border-indigo-500/20 shadow-inner">
                                 <TableCell colSpan={4} className="p-4 sm:p-6 !m-0">
                                    <div className="flex items-center justify-between mb-4">
                                       <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                          <Fingerprint className="h-4 w-4 text-indigo-400" /> Event Topology
                                       </h4>
                                       <div className="text-[10px] text-muted-foreground space-x-4 flex">
                                          <span>Scope: <b className="uppercase">{log.scope}</b></span>
                                          {log.metadata && <span>Meta: <b className="font-mono">{JSON.stringify(log.metadata)}</b></span>}
                                       </div>
                                    </div>
                                    <AuditDiffViewer before={log.before} after={log.after} />
                                 </TableCell>
                              </TableRow>
                           )}
                        </React.Fragment>
                     );
                  })}
               </TableBody>
            </Table>
         </div>
      </div>
    </div>
  );
}
