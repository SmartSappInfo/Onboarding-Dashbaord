
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
    rollbackTasksMigration,
    enrichAutomationsWithWorkspace,
    rollbackAutomationsMigration,
    enrichMediaWithWorkspace,
    rollbackMediaMigration,
    enrichRolesWithWorkspaces,
    rollbackRolesMigration,
    enrichActivitiesWithWorkspace,
    rollbackActivitiesMigration
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
    Layout,
    Lock
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import ModuleEditor from './components/ModuleEditor';
import ZoneEditor from './components/ZoneEditor';
import RoleEditor from './components/RoleEditor';
import WorkspaceEditor from './components/WorkspaceEditor';
import { cn } from '@/lib/utils';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';
type Seeder = 'media' | 'schools' | 'meetings' | 'surveys' | 'users' | 'stages' | 'layout' | 'modules' | 'activities' | 'pdfs' | 'messaging' | 'zones' | 'logs' | 'tasks' | 'billing' | 'roles' | 'pipelines' | 'harvest' | 'enrich' | 'rollback' | 'workspaces' | 'enrich_status' | 'rollback_status' | 'enrich_tasks' | 'rollback_tasks' | 'enrich_automations' | 'rollback_automations' | 'enrich_media' | 'rollback_media' | 'enrich_roles' | 'rollback_roles' | 'enrich_activities' | 'rollback_activities';

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
    enrich_status: 'idle', rollback_status: 'idle', enrich_tasks: 'idle', rollback_tasks: 'idle',
    enrich_automations: 'idle', rollback_automations: 'idle',
    enrich_media: 'idle', rollback_media: 'idle', enrich_roles: 'idle', rollback_roles: 'idle',
    enrich_activities: 'idle', rollback_activities: 'idle'
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
      } else if (seeder === 'enrich_automations') {
          const count = await enrichAutomationsWithWorkspace(firestore);
          toast({ title: 'Automation Sync Complete', description: `Enriched ${count} blueprints with workspace context.` });
      } else if (seeder === 'rollback_automations') {
          const count = await rollbackAutomationsMigration(firestore);
          toast({ title: 'Logic Rollback Success', description: `Restored ${count} blueprints from backup.` });
      } else if (seeder === 'enrich_media') {
          const count = await enrichMediaWithWorkspace(firestore);
          toast({ title: 'Media Hub Synced', description: `Enriched ${count} assets with workspace context.` });
      } else if (seeder === 'rollback_media') {
          const count = await rollbackMediaMigration(firestore);
          toast({ title: 'Media Hub Rollback', description: `Restored ${count} assets from backup.` });
      } else if (seeder === 'enrich_roles') {
          const count = await enrichRolesWithWorkspaces(firestore);
          toast({ title: 'Role Architecture Synced', description: `Enriched ${count} roles with default workspace.` });
      } else if (seeder === 'rollback_roles') {
          const count = await rollbackRolesMigration(firestore);
          toast({ title: 'Role Rollback Success', description: `Restored ${count} roles from backup.` });
      } else if (seeder === 'enrich_activities') {
          const count = await enrichActivitiesWithWorkspace(firestore);
          toast({ title: 'Timeline Protocols Synced', description: `Enriched ${count} activities with workspace context.` });
      } else if (seeder === 'rollback_activities') {
          const count = await rollbackActivitiesMigration(firestore);
          toast({ title: 'Timeline Rollback Success', description: `Restored ${count} activities from backup.` });
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
        else if (seeder === 'zones') { count = await seedZones(firestore); name = 'Zones'; }
        else if (seeder === 'logs') { count = await seedMessageLogs(firestore); name = 'Logs'; }
        else if (seeder === 'tasks') { count = await seedTasks(firestore); name = 'Tasks'; }
        else if (seeder === 'billing') { count = await seedBillingData(firestore); name = 'Billing Hubs'; }
        else if (seeder === 'roles') { count = await seedRolesAndPermissions(firestore); name = 'Roles'; }
        else if (seeder === 'pipelines') { count = await seedPipelines(firestore); name = 'Workflows'; }
        else if (seeder === 'workspaces') { count = await seedWorkspaces(firestore); name = 'Workspaces'; }
        else if (seeder === 'stages') {
          const { stagesCreated } = await seedOnboardingStages(firestore);
          count = stagesCreated;
          name = 'Stages';
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
      <div className="max-w-7xl mx-auto space-y-12">
        
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
                
                {/* Activity Sync */}
                <div className="p-6 rounded-3xl bg-slate-50/50 border-2 border-dashed border-slate-200 flex flex-col justify-between gap-6 transition-all hover:bg-slate-50">
                    <div className="space-y-3">
                        <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-primary border border-slate-100"><History className="h-5 w-5" /></div>
                        <h4 className="text-sm font-black uppercase tracking-tight">Timeline Protocol Sync</h4>
                        <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase tracking-tighter">Enriches all activity logs with workspace context to ensure audit trails load correctly across tracks.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            onClick={() => handleSeed('enrich_activities')} 
                            disabled={seedingStatus.enrich_activities === 'seeding'} 
                            className="flex-1 rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest bg-primary hover:bg-primary/90 h-11 text-white"
                        >
                            {seedingStatus.enrich_activities === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                            Sync Timeline
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => handleSeed('rollback_activities')} 
                            disabled={seedingStatus.rollback_activities === 'seeding'} 
                            className="rounded-xl font-bold border-border text-muted-foreground h-11 bg-white"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Role Sync */}
                <div className="p-6 rounded-3xl bg-amber-50/50 border-2 border-dashed border-amber-100 flex flex-col justify-between gap-6 transition-all hover:bg-amber-50">
                    <div className="space-y-3">
                        <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-amber-600 border border-amber-100"><Lock className="h-5 w-5" /></div>
                        <h4 className="text-sm font-black uppercase tracking-tight">Role Architecture Sync</h4>
                        <p className="text-[10px] font-medium text-amber-800 leading-relaxed uppercase tracking-tighter">Binds all existing roles to the onboarding track to ensure no users are blocked by the new workspace logic.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            onClick={() => handleSeed('enrich_roles')} 
                            disabled={seedingStatus.enrich_roles === 'seeding'} 
                            className="flex-1 rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest bg-amber-600 hover:bg-amber-700 h-11 text-white"
                        >
                            {seedingStatus.enrich_roles === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                            Sync Roles
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => handleSeed('rollback_roles')} 
                            disabled={seedingStatus.rollback_roles === 'seeding'} 
                            className="rounded-xl font-bold border-amber-200 text-amber-700 h-11 bg-white"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Media Sync */}
                <div className="p-6 rounded-3xl bg-blue-50/50 border-2 border-dashed border-blue-100 flex flex-col justify-between gap-6 transition-all hover:bg-blue-50">
                    <div className="space-y-3">
                        <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-blue-600 border border-blue-100"><Film className="h-5 w-5" /></div>
                        <h4 className="text-sm font-black uppercase tracking-tight">Media Hub Integrity</h4>
                        <p className="text-[10px] font-medium text-blue-800 leading-relaxed uppercase tracking-tighter">Binds all orphan digital assets to the onboarding workspace to ensure visibility isolation.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            onClick={() => handleSeed('enrich_media')} 
                            disabled={seedingStatus.enrich_media === 'seeding'} 
                            className="flex-1 rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest bg-blue-600 hover:bg-blue-700 h-11 text-white"
                        >
                            {seedingStatus.enrich_media === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                            Sync Media
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => handleSeed('rollback_media')} 
                            disabled={seedingStatus.rollback_media === 'seeding'} 
                            className="rounded-xl font-bold border-blue-200 text-blue-700 h-11 bg-white"
                        >
                            <RotateCcw className="h-4 w-4" />
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
