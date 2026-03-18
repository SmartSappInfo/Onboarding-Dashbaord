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
    seedMedia, 
    seedSchools, 
    seedMeetings, 
    seedSurveys, 
    seedOnboardingStages, 
    seedModules, 
    seedZones, 
    seedPipelines, 
    seedOnboardingPipelineFromCurrentData, 
    enrichAndRestoreSchools, 
    rollbackSchoolsMigration, 
    seedWorkspaces,
    enrichSchoolStatuses,
    enrichTasksWithWorkspace,
    enrichAutomationsWithWorkspace,
    enrichMediaWithWorkspace,
    enrichRolesWithWorkspaces,
    enrichActivitiesWithWorkspace,
    enrichTemplatesWithWorkspace,
    enrichStylesWithWorkspace,
    enrichProfilesWithWorkspace,
    enrichLogsWithWorkspace,
    enrichJobsWithWorkspace,
    enrichSurveysWithWorkspace,
    enrichPdfsWithWorkspace,
    enrichMeetingsWithWorkspace,
    enrichFinanceWithWorkspace,
    rollbackFinanceMigration
} from '@/lib/seed';
import { 
    Loader2, 
    RefreshCw, 
    Database, 
    ShieldCheck, 
    ClipboardList, 
    Film, 
    School as SchoolIcon, 
    History, 
    MapPin, 
    Workflow, 
    Zap, 
    ArrowRightLeft, 
    RotateCcw, 
    Layout,
    Receipt,
    Calendar,
    FileText,
    Fingerprint
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import ModuleEditor from './components/ModuleEditor';
import ZoneEditor from './components/ZoneEditor';
import RoleEditor from './components/RoleEditor';
import WorkspaceEditor from './components/WorkspaceEditor';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';
type Seeder = 'media' | 'schools' | 'meetings' | 'surveys' | 'users' | 'stages' | 'layout' | 'modules' | 'activities' | 'pdfs' | 'messaging' | 'zones' | 'logs' | 'tasks' | 'billing' | 'roles' | 'pipelines' | 'harvest' | 'enrich' | 'rollback' | 'workspaces' | 'enrich_status' | 'rollback_status' | 'enrich_tasks' | 'rollback_tasks' | 'enrich_automations' | 'rollback_automations' | 'enrich_media' | 'rollback_media' | 'enrich_roles' | 'rollback_roles' | 'enrich_activities' | 'rollback_activities' | 'enrich_templates' | 'rollback_templates' | 'enrich_styles' | 'rollback_styles' | 'enrich_profiles' | 'rollback_profiles' | 'enrich_logs' | 'rollback_logs' | 'enrich_jobs' | 'rollback_jobs' | 'enrich_surveys' | 'rollback_surveys' | 'enrich_pdfs' | 'rollback_pdfs' | 'enrich_meetings' | 'rollback_meetings' | 'enrich_finance' | 'rollback_finance';

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
    media: 'idle', schools: 'idle', meetings: 'idle', surveys: 'idle', 
    users: 'idle', stages: 'idle', layout: 'idle', modules: 'idle', 
    activities: 'idle', pdfs: 'idle', messaging: 'idle', zones: 'idle', 
    logs: 'idle', tasks: 'idle', billing: 'idle', roles: 'idle', pipelines: 'idle',
    harvest: 'idle', enrich: 'idle', rollback: 'idle', workspaces: 'idle', 
    enrich_finance: 'idle', rollback_finance: 'idle'
  });

  const handleSeed = async (seeder: Seeder) => {
    if (!firestore) return;
    setSeedingStatus(prev => ({ ...prev, [seeder]: 'seeding' }));

    try {
      if (seeder === 'layout') {
          if (!user) throw new Error('Not logged in');
          await setDoc(doc(firestore, 'dashboardLayouts', user.uid), { componentIds: DEFAULT_LAYOUT });
          toast({ title: 'Layout Reset', description: 'Dashboard layout has been reset to default.' });
      } else if (seeder === 'harvest') {
          const count = await seedOnboardingPipelineFromCurrentData(firestore);
          toast({ title: 'Harvest Complete', description: `Initialized pipeline with ${count} unique stages.` });
      } else if (seeder === 'enrich') {
          const count = await enrichAndRestoreSchools(firestore);
          toast({ title: 'Migration Complete', description: `Enriched ${count} schools.` });
      } else if (seeder === 'rollback') {
          const count = await rollbackSchoolsMigration(firestore);
          toast({ title: 'Rollback Successful', description: `Restored ${count} schools.` });
      } else if (seeder === 'enrich_finance') {
          const count = await enrichFinanceWithWorkspace(firestore);
          toast({ title: 'Finance Sync Complete', description: `Enriched ${count} financial records.` });
      } else if (seeder === 'rollback_finance') {
          const count = await rollbackFinanceMigration(firestore);
          toast({ title: 'Finance Rollback Success' });
      } else if (seeder === 'enrich_status') {
          const count = await enrichSchoolStatuses(firestore);
          toast({ title: 'Status Enrich Complete', description: `Updated ${count} schools.` });
      } else {
        let count = 0;
        let name = '';
        if (seeder === 'media') { count = await seedMedia(firestore); name = 'Media Assets'; }
        else if (seeder === 'schools') { count = await seedSchools(firestore); name = 'Schools'; }
        else if (seeder === 'meetings') { count = await seedMeetings(firestore); name = 'Meetings'; }
        else if (seeder === 'surveys') { count = await seedSurveys(firestore); name = 'Surveys'; }
        else if (seeder === 'workspaces') { count = await seedWorkspaces(firestore); name = 'Workspaces'; }
        else if (seeder === 'pipelines') { count = await seedPipelines(firestore); name = 'Workflows'; }
        
        toast({ title: 'Success', description: `${count} ${name} processed.` });
      }
      setSeedingStatus(prev => ({ ...prev, [seeder]: 'success' }));
      setTimeout(() => setSeedingStatus(prev => ({ ...prev, [seeder]: 'idle' })), 2000);
    } catch (error: any) {
      console.error(error);
      setSeedingStatus(prev => ({ ...prev, [seeder]: 'error' }));
      toast({ variant: 'destructive', title: 'Error', description: error.message || `Could not process ${seeder}.` });
    }
  };

  return (
    <TooltipProvider>
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 space-y-12 bg-muted/5 text-left">
        <div className="max-w-7xl mx-auto space-y-12">
            
            {/* Institutional Migration Hub */}
            <Card className="rounded-[2.5rem] border-none shadow-sm ring-1 ring-border overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 border-b pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
                            <ArrowRightLeft className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Institutional Migration Hub</CardTitle>
                            <CardDescription className="text-xs font-medium text-left uppercase tracking-widest text-primary/60">Non-destructive data enrichment protocols</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    
                    {/* Finance Sync */}
                    <div className="p-6 rounded-3xl bg-emerald-50/50 border-2 border-dashed border-emerald-100 flex flex-col justify-between gap-6 transition-all hover:bg-emerald-50">
                        <div className="space-y-3">
                            <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-emerald-600 border border-emerald-100"><Receipt className="h-5 w-5" /></div>
                            <h4 className="text-sm font-black uppercase tracking-tight">Finance Hub Sync</h4>
                            <p className="text-[10px] font-medium text-emerald-800 leading-relaxed uppercase tracking-tighter">Retrieves and enriches Invoices, Pricing Tiers, and Billing Cycles with workspace metadata.</p>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => handleSeed('enrich_finance')} disabled={seedingStatus.enrich_finance === 'seeding'} className="flex-1 rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 h-11 text-white">
                                {seedingStatus.enrich_finance === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                                Sync Finance
                            </Button>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" onClick={() => handleSeed('rollback_finance')} disabled={seedingStatus.rollback_finance === 'seeding'} className="rounded-xl font-bold border-emerald-200 text-emerald-700 h-11 bg-white">
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Restore Previous State</TooltipContent>
                            </Tooltip>
                        </div>
                    </div>

                    {/* School Registry Sync */}
                    <div className="p-6 rounded-3xl bg-slate-50/50 border-2 border-dashed border-slate-200 flex flex-col justify-between gap-6 transition-all hover:bg-slate-50">
                        <div className="space-y-3">
                            <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-primary border border-slate-100"><Building className="h-5 w-5" /></div>
                            <h4 className="text-sm font-black uppercase tracking-tight">School Directory Sync</h4>
                            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase tracking-tighter">Migrates schools to multi-workspace array schema. Ensures visibility across all hubs.</p>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => handleSeed('enrich')} disabled={seedingStatus.enrich === 'seeding'} className="flex-1 rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest bg-primary text-white h-11">
                                {seedingStatus.enrich === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                                Sync Directory
                            </Button>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" onClick={() => handleSeed('rollback')} disabled={seedingStatus.rollback === 'seeding'} className="rounded-xl font-bold border-border text-muted-foreground h-11 bg-white">
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Restore Directory Backup</TooltipContent>
                            </Tooltip>
                        </div>
                    </div>

                    {/* Session Registry Sync */}
                    <div className="p-6 rounded-3xl bg-purple-50/50 border-2 border-dashed border-purple-100 flex flex-col justify-between gap-6 transition-all hover:bg-purple-50">
                        <div className="space-y-3">
                            <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-purple-600 border border-purple-100"><Calendar className="h-5 w-5" /></div>
                            <h4 className="text-sm font-black uppercase tracking-tight">Session Registry Sync</h4>
                            <p className="text-[10px] font-medium text-purple-800 leading-relaxed uppercase tracking-tighter">Binds meeting records to multi-workspace array context for institutional sharing.</p>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => handleSeed('enrich_meetings')} disabled={seedingStatus.enrich_meetings === 'seeding'} className="flex-1 rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest bg-purple-600 hover:bg-purple-700 h-11 text-white">
                                {seedingStatus.enrich_meetings === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                                Sync Sessions
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <WorkspaceEditor />

            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-white">
                <CardHeader className="bg-muted/30 border-b pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-black uppercase tracking-tight">System Infrastructure</CardTitle>
                        <CardDescription className="text-xs font-medium text-left">Core structural management.</CardDescription>
                    </div>
                </div>
                </CardHeader>
                <CardContent className="p-6 space-y-10">
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 ml-1">Structural Configuration</h3>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" size="sm" onClick={() => handleSeed('workspaces')} disabled={seedingStatus.workspaces === 'seeding'} className="rounded-xl font-bold">
                            {seedingStatus.workspaces === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layout className="mr-2 h-4 w-4 text-primary" />}
                            Seed Workspaces
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleSeed('pipelines')} disabled={seedingStatus.pipelines === 'seeding'} className="rounded-xl font-bold">
                            {seedingStatus.pipelines === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Workflow className="mr-2 h-4 w-4 text-primary" />}
                            Seed Workflows
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleSeed('roles')} disabled={seedingStatus.roles === 'seeding'} className="rounded-xl font-bold">
                            {seedingStatus.roles === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4 text-primary" />}
                            Seed Roles & Permissions
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleSeed('layout')} disabled={seedingStatus.layout === 'seeding'} className="rounded-xl font-bold">
                            {seedingStatus.layout === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layout className="mr-2 h-4 w-4 text-primary" />}
                            Reset Dashboard Layout
                        </Button>
                    </div>
                </div>
                </CardContent>
            </Card>
            
            <div className="space-y-8">
                <RoleEditor />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <ModuleEditor />
                    <ZoneEditor />
                </div>
            </div>
        </div>
        </div>
    </TooltipProvider>
  );
}