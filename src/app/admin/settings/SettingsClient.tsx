'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { 
    seedMedia, 
    seedSchools, 
    seedMeetings, 
    seedSurveys, 
    seedUserAvatars, 
    seedOnboardingStages, 
    seedModules, 
    seedActivities, 
    seedPdfForms, 
    seedMessaging, 
    seedZones, 
    seedMessageLogs, 
    seedTasks, 
    seedBillingData, 
    seedRolesAndPermissions, 
    seedPipelines, 
    seedOnboardingPipelineFromCurrentData, 
    enrichAndRestoreSchools, 
    rollbackSchoolsMigration, 
    seedWorkspaces,
    enrichSchoolStatuses,
    rollbackSchoolStatuses,
    enrichTasksWithWorkspace,
    rollbackTasksMigration
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
    MessageSquareText, 
    MapPin, 
    CheckSquare, 
    Banknote, 
    ShieldAlert, 
    Workflow, 
    Zap, 
    ArrowRightLeft, 
    RotateCcw, 
    CheckCircle2, 
    Layout 
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import ModuleEditor from './components/ModuleEditor';
import ZoneEditor from './components/ZoneEditor';
import RoleEditor from './components/RoleEditor';
import WorkspaceEditor from './components/WorkspaceEditor';
import { cn } from '@/lib/utils';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';
type Seeder = 'media' | 'schools' | 'meetings' | 'surveys' | 'users' | 'stages' | 'layout' | 'modules' | 'activities' | 'pdfs' | 'messaging' | 'zones' | 'logs' | 'tasks' | 'billing' | 'roles' | 'pipelines' | 'harvest' | 'enrich' | 'rollback' | 'workspaces' | 'enrich_status' | 'rollback_status' | 'enrich_tasks' | 'rollback_tasks';

const DEFAULT_LAYOUT = [
    'userAssignments', 'taskWidget', 'messagingWidget', 'pipelinePieChart', 
    'upcomingMeetings', 'recentActivity', 'zoneDistribution', 
    'moduleRadarChart', 'latestSurveys', 'monthlySchoolsChart',
];

export default function SettingsClient() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [seedingStatus, setSeedingStatus] = useState<Record<Seeder, SeedingState>>({
    media: 'idle', schools: 'idle', meetings: 'idle', surveys: 'idle', 
    users: 'idle', stages: 'idle', layout: 'idle', modules: 'idle', 
    activities: 'idle', pdfs: 'idle', messaging: 'idle', zones: 'idle', 
    logs: 'idle', tasks: 'idle', billing: 'idle', roles: 'idle', pipelines: 'idle',
    harvest: 'idle', enrich: 'idle', rollback: 'idle', workspaces: 'idle',
    enrich_status: 'idle', rollback_status: 'idle', enrich_tasks: 'idle', rollback_tasks: 'idle'
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
          toast({ title: 'Migration Complete', description: `Enriched ${count} schools with workspace context.` });
      } else if (seeder === 'rollback') {
          const count = await rollbackSchoolsMigration(firestore);
          toast({ title: 'Rollback Successful', description: `Restored ${count} schools from backup.` });
      } else if (seeder === 'enrich_status') {
          const count = await enrichSchoolStatuses(firestore);
          toast({ title: 'Status Enrich Complete', description: `Updated ${count} schools based on stage logic.` });
      } else if (seeder === 'rollback_status') {
          const count = await rollbackSchoolStatuses(firestore);
          toast({ title: 'Status Rollback Success', description: `Restored status for ${count} schools.` });
      } else if (seeder === 'enrich_tasks') {
          const count = await enrichTasksWithWorkspace(firestore);
          toast({ title: 'CRM Sync Complete', description: `Enriched ${count} tasks with workspace context.` });
      } else if (seeder === 'rollback_tasks') {
          const count = await rollbackTasksMigration(firestore);
          toast({ title: 'CRM Rollback Success', description: `Restored ${count} tasks from backup.` });
      } else {
        let count = 0;
        let name = '';
        
        if (seeder === 'media') { count = await seedMedia(firestore); name = 'Media Assets'; }
        else if (seeder === 'schools') { count = await seedSchools(firestore); name = 'Schools'; }
        else if (seeder === 'meetings') { count = await seedMeetings(firestore); name = 'Meetings'; }
        else if (seeder === 'surveys') { count = await seedSurveys(firestore); name = 'Surveys'; }
        else if (seeder === 'activities') { count = await seedActivities(firestore); name = 'Activities'; }
        else if (seeder === 'users') { count = await seedUserAvatars(firestore); name = 'User Avatars'; }
        else if (seeder === 'modules') { count = await seedModules(firestore); name = 'Modules'; }
        else if (seeder === 'pdfs') { count = await seedPdfForms(firestore); name = 'Doc Signing Forms'; }
        else if (seeder === 'messaging') { count = await seedMessaging(firestore); name = 'Messaging Assets'; }
        else if (seeder === 'zones') { count = await seedZones(firestore); name = 'Organizational Zones'; }
        else if (seeder === 'logs') { count = await seedMessageLogs(firestore); name = 'Communication Logs'; }
        else if (seeder === 'tasks') { count = await seedTasks(firestore); name = 'CRM Tasks'; }
        else if (seeder === 'billing') { count = await seedBillingData(firestore); name = 'Billing Hubs'; }
        else if (seeder === 'roles') { count = await seedRolesAndPermissions(firestore); name = 'Roles & Permissions'; }
        else if (seeder === 'pipelines') { count = await seedPipelines(firestore); name = 'Workflows'; }
        else if (seeder === 'workspaces') { count = await seedWorkspaces(firestore); name = 'Global Workspaces'; }
        else if (seeder === 'stages') {
          const { stagesCreated } = await seedOnboardingStages(firestore);
          count = stagesCreated;
          name = 'Pipeline Stages';
        }

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
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 space-y-12 bg-muted/5 text-left">
      <div className="max-w-7xl auto space-y-12">
        
        {/* Advanced Migration Tools */}
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
                {/* Status Specific Migration */}
                <div className="p-6 rounded-3xl bg-emerald-50/50 border-2 border-dashed border-emerald-100 flex flex-col justify-between gap-6 transition-all hover:bg-emerald-50">
                    <div className="space-y-3">
                        <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-emerald-600 border border-emerald-100"><ShieldCheck className="h-5 w-5" /></div>
                        <h4 className="text-sm font-black uppercase tracking-tight">Status Harmonization</h4>
                        <p className="text-[10px] font-medium text-emerald-800 leading-relaxed uppercase tracking-tighter">Surgical update of "School Status". Maps Support stage to "Active" and others to "Onboarding".</p>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            onClick={() => handleSeed('enrich_status')} 
                            disabled={seedingStatus.enrich_status === 'seeding'} 
                            className="flex-1 rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 h-11"
                        >
                            {seedingStatus.enrich_status === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                            Enrich Status
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => handleSeed('rollback_status')} 
                            disabled={seedingStatus.rollback_status === 'seeding'} 
                            className="rounded-xl font-bold border-emerald-200 text-emerald-700 h-11"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Task Specific Migration */}
                <div className="p-6 rounded-3xl bg-blue-50/50 border-2 border-dashed border-blue-100 flex flex-col justify-between gap-6 transition-all hover:bg-blue-50">
                    <div className="space-y-3">
                        <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-blue-600 border border-blue-100"><CheckSquare className="h-5 w-5" /></div>
                        <h4 className="text-sm font-black uppercase tracking-tight">CRM Integrity Hub</h4>
                        <p className="text-[10px] font-medium text-blue-800 leading-relaxed uppercase tracking-tighter">Synchronizes legacy tasks with the new Workspace architecture. Ensures all records are authorized.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            onClick={() => handleSeed('enrich_tasks')} 
                            disabled={seedingStatus.enrich_tasks === 'seeding'} 
                            className="flex-1 rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest bg-blue-600 hover:bg-blue-700 h-11"
                        >
                            {seedingStatus.enrich_tasks === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                            Enrich CRM Tasks
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => handleSeed('rollback_tasks')} 
                            disabled={seedingStatus.rollback_tasks === 'seeding'} 
                            className="rounded-xl font-bold border-blue-200 text-blue-700 h-11"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="p-6 rounded-3xl bg-primary/[0.03] border-2 border-primary/10 flex flex-col justify-between gap-6 transition-all hover:bg-primary/[0.05]">
                    <div className="space-y-3">
                        <div className="p-2.5 bg-primary text-white rounded-xl w-fit shadow-lg shadow-primary/20"><Layout className="h-5 w-5" /></div>
                        <h4 className="text-sm font-black uppercase tracking-tight">Workspace Sync</h4>
                        <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase tracking-tighter">Maps all existing schools to the new workspace structure and ensure track consistency.</p>
                    </div>
                    <Button 
                        onClick={() => handleSeed('enrich')} 
                        disabled={seedingStatus.enrich === 'seeding'} 
                        className="w-full rounded-xl font-black shadow-xl uppercase text-[10px] tracking-widest h-11"
                    >
                        {seedingStatus.enrich === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        Enrich & Sync Workspaces
                    </Button>
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
                    <CardDescription className="text-xs font-medium text-left">Core system management and data initialization tools.</CardDescription>
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
                        {seedingStatus.roles === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4 text-primary" />}
                        Seed Roles
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleSeed('modules')} disabled={seedingStatus.modules === 'seeding'} className="rounded-xl font-bold">
                        {seedingStatus.modules === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4 text-primary" />}
                        Seed Modules
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleSeed('zones')} disabled={seedingStatus.zones === 'seeding'} className="rounded-xl font-bold">
                        {seedingStatus.zones === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4 text-primary" />}
                        Seed Zones
                    </Button>
                </div>
            </div>

            <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 ml-1">Sample Operations Data</h3>
                <div className="flex flex-wrap gap-3">
                    <Button onClick={() => handleSeed('schools')} disabled={seedingStatus.schools === 'seeding'} className="rounded-xl font-bold shadow-sm">
                        {seedingStatus.schools === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SchoolIcon className="mr-2 h-4 w-4" />}
                        Migrate Schools
                    </Button>
                    <Button onClick={() => handleSeed('meetings')} disabled={seedingStatus.meetings === 'seeding'} className="rounded-xl font-bold shadow-sm">
                        {seedingStatus.meetings === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Seed Meetings
                    </Button>
                    <Button onClick={() => handleSeed('media')} disabled={seedingStatus.media === 'seeding'} className="rounded-xl font-bold shadow-sm">
                        {seedingStatus.media === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Film className="mr-2 h-4 w-4" />}
                        Seed Media
                    </Button>
                    <Button onClick={() => handleSeed('surveys')} disabled={seedingStatus.surveys === 'seeding'} className="rounded-xl font-bold shadow-sm">
                        {seedingStatus.surveys === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
                        Seed Surveys
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
  );
}
