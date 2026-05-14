'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap, ShieldAlert, Database, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';

import { getMigrationStatusAction } from '@/app/actions/get-migration-status-action';
import { executePurgeFocalPersonsFerAction } from '@/app/actions/purge-focal-persons-fer-action';
import { executePurgeLegacyFieldsFerAction } from '@/app/actions/purge-legacy-fields-fer-action';
import { SystemMigrationLog } from '@/lib/types';

export default function SeedsClient() {
    return (
        <div className="h-full overflow-y-auto w-full">
            <div className="space-y-12 pb-32 w-full max-w-4xl">
            
            {/* Header */}
            <div className="flex flex-col items-start text-left">
                <Badge variant="outline" className="mb-4 bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-widest text-[9px] px-3 py-1 ring-1 ring-primary/20">System Governance</Badge>
                <h1 className="text-3xl font-bold mb-2 text-foreground">Infrastructure Seeding</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Execute core schema enrichments and cross-workspace mappings
                </p>
            </div>

            {/* FER Protocol Banner */}
            <div className="bg-blue-50/50 border border-blue-200 p-4 rounded-xl flex items-start gap-3 mt-6">
                <ShieldAlert className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                    <h4 className="text-sm font-bold text-blue-900">FER Protocol Active (Fetch, Enrich, Restore)</h4>
                    <p className="text-xs text-blue-800/80 mt-1 leading-relaxed">
                        All major migrations on this page utilize the transactional FER protocol to guarantee data integrity. Data is **Fetched**, safely **Enriched** in-memory, and **Restored** (committed) via atomic write-batches.
                    </p>
                </div>
            </div>

            {/* Core Migrations */}
            <section className="space-y-8">
                <div className="flex flex-col gap-1 items-start">
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">Active Protocols</h3>
                    <p className="text-muted-foreground font-medium">Currently active Fetch, Enrich, and Restore (FER) streams.</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <MigrationTrackerCard 
                        migrationId="fer_purge_focal_persons"
                        title="FER Protocol: Purge Legacy Contacts"
                        description="Safely removes deprecated `focalPerson` fields from all Entity records. Execution will automatically skip records missing the new `entityContacts` model, preventing data loss."
                        icon={Database}
                        executeAction={executePurgeFocalPersonsFerAction}
                    />
                    
                    <MigrationTrackerCard 
                        migrationId="fer_purge_legacy_fields"
                        title="FER Protocol: Purge Legacy Fields"
                        description="Deletes outdated ghost fields (like nominalRoll, arrearsBalance) from the global field registry and immediately re-seeds the new modern field architecture. Preserves user-created custom fields."
                        icon={Database}
                        executeAction={executePurgeLegacyFieldsFerAction}
                    />
                </div>
            </section>

        </div>
    </div>
  );
}

interface MigrationTrackerCardProps {
    migrationId: string;
    title: string;
    description: string;
    icon: any;
    executeAction: (userId: string) => Promise<{ success: boolean; message: string; details?: any }>;
}

function MigrationTrackerCard({ migrationId, title, description, icon: Icon, executeAction }: MigrationTrackerCardProps) {
    const { toast } = useToast();
    const { activeWorkspaceId } = useTenant();
    
    const [status, setStatus] = useState<SystemMigrationLog | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isExecuting, setIsExecuting] = useState(false);
    const [consoleOutput, setConsoleOutput] = useState<string>('Initializing tracker...');

    // Fetch initial status on load
    useEffect(() => {
        let isMounted = true;
        const fetchStatus = async () => {
            try {
                const res = await getMigrationStatusAction(migrationId);
                if (isMounted && res.success && res.log) {
                    setStatus(res.log);
                    setConsoleOutput(
                        `> Last execution: ${new Date(res.log.lastRunAt).toLocaleString()}\n> Status: ${res.log.status.toUpperCase()}\n> ${res.log.summary || ''}\n\n${res.log.details ? JSON.stringify(res.log.details, null, 2) : ''}`
                    );
                } else if (isMounted) {
                    setConsoleOutput('> No execution history found. Ready to run.');
                }
            } catch (err) {
                if (isMounted) setConsoleOutput('> Error fetching migration history.');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        fetchStatus();
        return () => { isMounted = false; };
    }, [migrationId]);

    const handleExecute = async () => {
        setIsExecuting(true);
        setConsoleOutput('> Fetching records...\n> Enriching data...\n> Awaiting response...');
        try {
            // Using a dummy userId or an actual one if available in TenantContext. Using activeWorkspaceId as fallback for now.
            const executorId = 'system_admin'; 
            const res = await executeAction(executorId);
            
            if (res.success) {
                toast({ title: 'Migration Completed!', description: res.message });
                setConsoleOutput(`> SUCCESS\n> ${res.message}\n\n${res.details ? JSON.stringify(res.details, null, 2) : ''}`);
                // Refresh status
                const newStatus = await getMigrationStatusAction(migrationId);
                if (newStatus.success && newStatus.log) {
                    setStatus(newStatus.log);
                }
            } else {
                toast({ variant: 'destructive', title: 'Migration Failed', description: res.message });
                setConsoleOutput(`> FAILED\n> ${res.message}\n\n${res.details ? JSON.stringify(res.details, null, 2) : ''}`);
            }
        } catch (error: any) {
            setConsoleOutput(`> CRITICAL ERROR\n> ${error.message}`);
            toast({ variant: 'destructive', title: 'Execution Error', description: error.message });
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <Card className="border border-border bg-transparent shadow-sm rounded-2xl ring-1 ring-border overflow-hidden text-left flex flex-col md:flex-row gap-0">
            {/* Info Panel */}
            <div className="p-8 md:w-1/2 border-b md:border-b-0 md:border-r border-border/50 flex flex-col justify-between">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-primary/10 rounded-2xl w-fit text-primary ring-1 ring-primary/20"><Icon className="h-6 w-6" /></div>
                        {status?.status === 'completed' && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>}
                        {status?.status === 'failed' && <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20"><AlertCircle className="w-3 h-3 mr-1" /> Failed</Badge>}
                    </div>
                    <div>
                        <h4 className="text-xl font-bold tracking-tight text-foreground">{title}</h4>
                        <p className="text-sm font-medium text-muted-foreground leading-relaxed mt-2">{description}</p>
                    </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-border/50">
                    <Button 
                        onClick={handleExecute} 
                        disabled={isLoading || isExecuting} 
                        className="rounded-xl font-bold h-12 w-full shadow-lg transform active:scale-95 transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        {isExecuting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Play className="h-5 w-5 mr-2" />} 
                        {isExecuting ? 'Executing FER...' : (status?.status === 'completed' ? 'Re-run Protocol' : 'Execute Protocol')}
                    </Button>
                </div>
            </div>

            {/* Console Panel */}
            <div className="p-6 md:w-1/2 bg-slate-950 flex flex-col rounded-b-2xl md:rounded-b-none md:rounded-r-2xl">
                <div className="flex items-center gap-2 mb-4 px-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-rose-500"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500"></div>
                    <span className="ml-2 text-[10px] font-mono text-slate-500 uppercase tracking-wider">Seeding Output Tracker</span>
                </div>
                
                <div className="flex-1 bg-black/40 rounded-xl p-4 ring-1 ring-white/10 font-mono text-xs text-slate-300 overflow-y-auto whitespace-pre-wrap max-h-[300px]">
                    {isLoading ? '> Fetching tracker state...' : consoleOutput}
                </div>
                
                {status?.lastRunAt && !isExecuting && (
                    <div className="mt-4 px-2 text-[10px] text-slate-500 font-mono flex justify-between">
                        <span>Last Execution: {new Date(status.lastRunAt).toLocaleString()}</span>
                        {status.executedBy && <span>By: {status.executedBy}</span>}
                    </div>
                )}
            </div>
        </Card>
    );
}
