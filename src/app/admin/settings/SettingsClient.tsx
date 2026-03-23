
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { 
    Tooltip, 
    TooltipContent, 
    TooltipProvider, 
    TooltipTrigger 
} from '@/components/ui/tooltip';
import { 
    enrichOperationalData,
    syncOperationalArchitecture,
    enrichAndRestorePortals,
    rollbackSchoolsMigration,
    seedWorkspaces,
    seedPipelines,
    seedRolesAndPermissions,
    seedBillingData,
    seedPortals
} from '@/lib/seed';
import { 
    Loader2, 
    Database, 
    ShieldCheck, 
    Layout,
    ArrowRightLeft,
    RotateCcw,
    Zap,
    Workflow,
    Building,
    Banknote,
    RefreshCw,
    Globe,
    FileText,
    Layers
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import ModuleEditor from './components/ModuleEditor';
import ZoneEditor from './components/ZoneEditor';
import RoleEditor from './components/RoleEditor';
import WorkspaceEditor from './components/WorkspaceEditor';
import { Badge } from '@/components/ui/badge';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';

const DEFAULT_LAYOUT = [
    'userAssignments', 'taskWidget', 'messagingWidget', 'pipelinePieChart', 
    'upcomingMeetings', 'recentActivity', 'zoneDistribution', 
    'moduleRadarChart', 'latestSurveys', 'monthlySchoolsChart',
];

export default function SettingsClient() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [seedingStatus, setSeedingStatus] = useState<Record<string, SeedingState>>({
    enrich_op: 'idle',
    sync_arch: 'idle',
    portals_sync: 'idle',
    workspaces: 'idle',
    pipelines: 'idle',
    roles: 'idle',
    layout: 'idle',
    billing: 'idle',
    portals: 'idle'
  });

  const handleSeed = async (seeder: string) => {
    if (!firestore) return;
    setSeedingStatus(prev => ({ ...prev, [seeder]: 'seeding' }));

    try {
      if (seeder === 'layout') {
          if (!user) throw new Error('Not logged in');
          await setDoc(doc(firestore, 'dashboardLayouts', user.uid), { componentIds: DEFAULT_LAYOUT });
          toast({ title: 'Layout Reset' });
      } else if (seeder === 'enrich_op') {
          const count = await enrichOperationalData(firestore);
          toast({ title: 'Operational Sync Complete', description: `Enriched ${count} records.` });
      } else if (seeder === 'sync_arch') {
          const count = await syncOperationalArchitecture(firestore);
          toast({ title: 'Architecture Restored', description: `Rebuilt ${count} nodes.` });
      } else if (seeder === 'portals_sync') {
          const count = await enrichAndRestorePortals(firestore);
          toast({ title: 'Portal Identity Sync Complete', description: `Synchronized ${count} blueprints with institutional hubs.` });
      } else if (seeder === 'workspaces') {
          await seedWorkspaces(firestore);
          toast({ title: 'Workspaces Seeded' });
      } else if (seeder === 'pipelines') {
          await seedPipelines(firestore);
          toast({ title: 'Pipelines Initialized' });
      } else if (seeder === 'roles') {
          await seedRolesAndPermissions(firestore);
          toast({ title: 'Roles Initialized' });
      } else if (seeder === 'billing') {
          await seedBillingData(firestore);
          toast({ title: 'Billing Profiles Initialized' });
      } else if (seeder === 'portals') {
          const count = await seedPortals(firestore);
          toast({ title: 'Portals Seeded', description: `Generated ${count} sample blueprints.` });
      }

      setSeedingStatus(prev => ({ ...prev, [seeder]: 'success' }));
      setTimeout(() => setSeedingStatus(prev => ({ ...prev, [seeder]: 'idle' })), 2000);
    } catch (error: any) {
      setSeedingStatus(prev => ({ ...prev, [seeder]: 'error' }));
      toast({ variant: 'destructive', title: 'Action Failed', description: error.message });
    }
  };

  return (
    <TooltipProvider>
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 space-y-12 bg-muted/5 text-left">
            <div className="max-w-7xl mx-auto space-y-12">
                
                {/* Partitioning Engine */}
                <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-border overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 border-b p-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
                                <ArrowRightLeft className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-black uppercase tracking-tight">Institutional Migration Engine</CardTitle>
                                <CardDescription className="text-xs font-medium text-left text-primary/60 uppercase tracking-widest">Surgical enrichment for multi-workspace partitioning.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="p-6 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 space-y-6">
                            <div className="space-y-3">
                                <div className="p-2 bg-white rounded-xl w-fit shadow-sm text-primary border"><Building className="h-5 w-5" /></div>
                                <h4 className="text-sm font-black uppercase">Shared Registry Sync</h4>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Migrates operational records to shared workspace arrays.</p>
                            </div>
                            <Button onClick={() => handleSeed('enrich_op')} disabled={seedingStatus.enrich_op === 'seeding'} className="w-full rounded-xl font-black h-11 shadow-lg gap-2 uppercase text-[10px] tracking-widest">
                                {seedingStatus.enrich_op === 'seeding' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4" />}
                                Launch Sync
                            </Button>
                        </div>

                        <div className="p-6 rounded-3xl bg-blue-50 border-2 border-dashed border-blue-200 space-y-6">
                            <div className="space-y-3">
                                <div className="p-2 bg-white rounded-xl w-fit shadow-sm text-blue-600 border border-blue-100"><Workflow className="h-5 w-5" /></div>
                                <h4 className="text-sm font-black uppercase">Architecture Restore</h4>
                                <p className="text-[10px] font-bold text-blue-800/60 uppercase tracking-tighter">Rebuilds pipelines/stages from school data snapshots.</p>
                            </div>
                            <Button onClick={() => handleSeed('sync_arch')} disabled={seedingStatus.sync_arch === 'seeding'} className="w-full rounded-xl font-black h-11 shadow-lg bg-blue-600 hover:bg-blue-700 text-white gap-2 uppercase text-[10px] tracking-widest">
                                {seedingStatus.sync_arch === 'seeding' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4" />}
                                Restore Logic
                            </Button>
                        </div>

                        <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-dashed border-emerald-200 space-y-6">
                            <div className="space-y-3">
                                <div className="p-2 bg-white rounded-xl w-fit shadow-sm text-emerald-600 border border-emerald-100"><Layers className="h-5 w-5" /></div>
                                <h4 className="text-sm font-black uppercase">Portal Identity Sync</h4>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Synchronizes portal workspaces with their parent school context.</p>
                            </div>
                            <Button onClick={() => handleSeed('portals_sync')} disabled={seedingStatus.portals_sync === 'seeding'} className="w-full rounded-xl font-black h-11 shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-2 uppercase text-[10px] tracking-widest">
                                {seedingStatus.portals_sync === 'seeding' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4" />}
                                Sync Portals
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <WorkspaceEditor />

                <div className="space-y-8">
                    <RoleEditor />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <ModuleEditor />
                        <ZoneEditor />
                    </div>
                </div>

                {/* Legacy Seeders */}
                <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-border bg-white overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b p-6 px-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary"><Database className="h-5 w-5" /></div>
                            <CardTitle className="text-sm font-black uppercase">Infrastructure Seeders</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="flex flex-wrap gap-3">
                            <Button variant="outline" size="sm" onClick={() => handleSeed('workspaces')} className="rounded-xl font-bold gap-2">
                                <Layout size={16} className="text-primary" /> Seed Workspaces
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleSeed('pipelines')} className="rounded-xl font-bold gap-2">
                                <Workflow size={16} className="text-primary" /> Seed Pipelines
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleSeed('roles')} className="rounded-xl font-bold gap-2">
                                <ShieldCheck size={16} className="text-primary" /> Seed Roles
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleSeed('billing')} className="rounded-xl font-bold gap-2">
                                <Banknote size={16} className="text-primary" /> Seed Billing
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleSeed('portals')} className="rounded-xl font-bold gap-2">
                                <Globe size={16} className="text-primary" /> Seed Sample Portals
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleSeed('layout')} className="rounded-xl font-bold gap-2 text-rose-600 border-rose-100 hover:bg-rose-50">
                                <RotateCcw size={16} /> Reset Layout
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    </TooltipProvider>
  );
}
