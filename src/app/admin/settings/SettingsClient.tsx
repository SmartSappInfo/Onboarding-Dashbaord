'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    enrichTasksWithWorkspace,
    enrichAutomationsWithWorkspace,
    enrichMediaWithWorkspace,
    enrichRolesWithWorkspaces,
    enrichActivitiesWithWorkspace,
    enrichTemplatesWithWorkspace,
    rollbackTemplatesMigration,
    enrichStylesWithWorkspace,
    rollbackStylesMigration,
    enrichProfilesWithWorkspace,
    rollbackProfilesMigration,
    enrichLogsWithWorkspace,
    rollbackLogsMigration,
    enrichJobsWithWorkspace,
    rollbackJobsMigration,
    enrichSurveysWithWorkspace,
    rollbackSurveysMigration,
    enrichPdfsWithWorkspace,
    rollbackPdfsMigration,
    enrichMeetingsWithWorkspace,
    rollbackMeetingsMigration,
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
    Lock,
    Building,
    Mail,
    Palette,
    Fingerprint,
    Layers,
    FileText,
    Calendar,
    Receipt
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import ModuleEditor from './components/ModuleEditor';
import ZoneEditor from './components/ZoneEditor';
import RoleEditor from './components/RoleEditor';
import WorkspaceEditor from './components/WorkspaceEditor';
import { cn } from '@/lib/utils';

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
      } else if (seeder === 'enrich_profiles') {
          const count = await enrichProfilesWithWorkspace(firestore);
          toast({ title: 'Profiles Synced', description: `Enriched ${count} sender IDs.` });
      } else if (seeder === 'rollback_profiles') {
          const count = await rollbackProfilesMigration(firestore);
          toast({ title: 'Profiles Rollback Success' });
      } else if (seeder === 'enrich_logs') {
          const count = await enrichLogsWithWorkspace(firestore);
          toast({ title: 'Ledger Synced', description: `Enriched ${count} log entries.` });
      } else if (seeder === 'rollback_logs') {
          const count = await rollbackLogsMigration(firestore);
          toast({ title: 'Ledger Rollback Success' });
      } else if (seeder === 'enrich_jobs') {
          const count = await enrichJobsWithWorkspace(firestore);
          toast({ title: 'Bulk Engine Synced', description: `Enriched ${count} job records.` });
      } else if (seeder === 'rollback_jobs') {
          const count = await rollbackJobsMigration(firestore);
          toast({ title: 'Engine Rollback Success' });
      } else if (seeder === 'enrich_templates') {
          const count = await enrichTemplatesWithWorkspace(firestore);
          toast({ title: 'Messaging Sync Complete', description: `Enriched ${count} templates.` });
      } else if (seeder === 'rollback_templates') {
          const count = await rollbackTemplatesMigration(firestore);
          toast({ title: 'Messaging Rollback Success', description: `Restored ${count} templates.` });
      } else if (seeder === 'enrich_styles') {
          const count = await enrichStylesWithWorkspace(firestore);
          toast({ title: 'Styles Sync Complete', description: `Enriched ${count} visual styles.` });
      } else if (seeder === 'rollback_styles') {
          const count = await rollbackStylesMigration(firestore);
          toast({ title: 'Styles Rollback Success', description: `Restored ${count} styles.` });
      } else if (seeder === 'enrich_surveys') {
          const count = await enrichSurveysWithWorkspace(firestore);
          toast({ title: 'Surveys Sync Complete', description: `Enriched ${count} blueprints.` });
      } else if (seeder === 'rollback_surveys') {
          const count = await rollbackSurveysMigration(firestore);
          toast({ title: 'Surveys Rollback Success' });
      } else if (seeder === 'enrich_pdfs') {
          const count = await enrichPdfsWithWorkspace(firestore);
          toast({ title: 'PDF Sync Complete', description: `Enriched ${count} document templates.` });
      } else if (seeder === 'rollback_pdfs') {
          const count = await rollbackPdfsMigration(firestore);
          toast({ title: 'PDF Rollback Success' });
      } else if (seeder === 'enrich_status') {
          const count = await enrichSchoolStatuses(firestore);
          toast({ title: 'Status Enrich Complete', description: `Updated ${count} schools.` });
      } else if (seeder === 'enrich_tasks') {
          const count = await enrichTasksWithWorkspace(firestore);
          toast({ title: 'CRM Sync Complete', description: `Enriched ${count} tasks.` });
      } else if (seeder === 'enrich_automations') {
          const count = await enrichAutomationsWithWorkspace(firestore);
          toast({ title: 'Automation Sync Complete', description: `Enriched ${count} blueprints.` });
      } else if (seeder === 'enrich_media') {
          const count = await enrichMediaWithWorkspace(firestore);
          toast({ title: 'Media Hub Synced', description: `Enriched ${count} assets.` });
      } else if (seeder === 'enrich_roles') {
          const count = await enrichRolesWithWorkspaces(firestore);
          toast({ title: 'Role Architecture Synced', description: `Enriched ${count} roles.` });
      } else if (seeder === 'enrich_activities') {
          const count = await enrichActivitiesWithWorkspace(firestore);
          toast({ title: 'Timeline Protocols Synced', description: `Enriched ${count} activities.` });
      } else if (seeder === 'enrich_meetings') {
          const count = await enrichMeetingsWithWorkspace(firestore);
          toast({ title: 'Session Registry Synced', description: `Enriched ${count} meetings.` });
      } else if (seeder === 'rollback_meetings') {
          const count = await rollbackMeetingsMigration(firestore);
          toast({ title: 'Session Rollback Success' });
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
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 space-y-12 bg-muted/5 text-left">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Institutional Migration Hub - Retrieve, Enrich & Restore */}
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
                
                {/* Finance Sync - Retrieve & Enrich */}
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
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" onClick={() => handleSeed('rollback_finance')} disabled={seedingStatus.rollback_finance === 'seeding'} className="rounded-xl font-bold border-emerald-200 text-emerald-700 h-11 bg-white">
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Restore Previous State</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
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
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" onClick={() => handleSeed('rollback')} disabled={seedingStatus.rollback === 'seeding'} className="rounded-xl font-bold border-border text-muted-foreground h-11 bg-white">
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Restore Directory Backup</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
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
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" onClick={() => handleSeed('rollback_meetings')} disabled={seedingStatus.rollback_meetings === 'seeding'} className="rounded-xl font-bold border-purple-200 text-purple-700 h-11 bg-white">
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Restore Session Backup</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

                {/* Survey Protocol Sync */}
                <div className="p-6 rounded-3xl bg-blue-50/50 border-2 border-dashed border-blue-100 flex flex-col justify-between gap-6 transition-all hover:bg-blue-50">
                    <div className="space-y-3">
                        <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-blue-600 border border-blue-100"><ClipboardList className="h-5 w-5" /></div>
                        <h4 className="text-sm font-black uppercase tracking-tight">Survey Protocol Sync</h4>
                        <p className="text-[10px] font-medium text-blue-800 leading-relaxed uppercase tracking-tighter">Migrates survey blueprints to the shared workspace array schema.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => handleSeed('enrich_surveys')} disabled={seedingStatus.enrich_surveys === 'seeding'} className="flex-1 rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest bg-blue-600 hover:bg-blue-700 h-11 text-white">
                            {seedingStatus.enrich_surveys === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                            Sync Surveys
                        </Button>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" onClick={() => handleSeed('rollback_surveys')} disabled={seedingStatus.rollback_surveys === 'seeding'} className="rounded-xl font-bold border-blue-200 text-blue-700 h-11 bg-white">
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Restore Survey Blueprints</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

                {/* Doc Signing Sync */}
                <div className="p-6 rounded-3xl bg-orange-50/50 border-2 border-dashed border-orange-100 flex flex-col justify-between gap-6 transition-all hover:bg-orange-50">
                    <div className="space-y-3">
                        <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-orange-600 border border-orange-100"><FileText className="h-5 w-5" /></div>
                        <h4 className="text-sm font-black uppercase tracking-tight">Doc Signing Sync</h4>
                        <p className="text-[10px] font-medium text-orange-800 leading-relaxed uppercase tracking-widest">Enriches PDF form templates with workspace array context.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => handleSeed('enrich_pdfs')} disabled={seedingStatus.enrich_pdfs === 'seeding'} className="flex-1 rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest bg-orange-600 hover:bg-orange-700 h-11 text-white">
                            {seedingStatus.enrich_pdfs === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                            Sync Documents
                        </Button>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" onClick={() => handleSeed('rollback_pdfs')} disabled={seedingStatus.rollback_pdfs === 'seeding'} className="rounded-xl font-bold border-orange-200 text-orange-700 h-11 bg-white">
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Restore Template State</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

                {/* Sender Profiles Sync */}
                <div className="p-6 rounded-3xl bg-emerald-50/50 border-2 border-dashed border-emerald-100 flex flex-col justify-between gap-6 transition-all hover:bg-emerald-50">
                    <div className="space-y-3">
                        <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm text-emerald-600 border border-emerald-100"><Fingerprint className="h-5 w-5" /></div>
                        <h4 className="text-sm font-black uppercase tracking-tight">Sender Identities Sync</h4>
                        <p className="text-[10px] font-medium text-emerald-800 leading-relaxed uppercase tracking-widest">Enriches SMS Sender IDs and Email endpoints with workspace array context.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => handleSeed('enrich_profiles')} disabled={seedingStatus.enrich_profiles === 'seeding'} className="flex-1 rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest bg-emerald-600 hover:bg-emerald-700 h-11 text-white">
                            {seedingStatus.enrich_profiles === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                            Sync Profiles
                        </Button>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" onClick={() => handleSeed('rollback_profiles')} disabled={seedingStatus.rollback_profiles === 'seeding'} className="rounded-xl font-bold border-emerald-200 text-emerald-700 h-11 bg-white">
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Restore Identites Backup</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
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
                    <Button variant="outline" size="sm" onClick={() => handleSeed('stages')} disabled={seedingStatus.stages === 'seeding'} className="rounded-xl font-bold">
                        {seedingStatus.stages === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4 text-primary" />}
                        Seed Onboarding Stages
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleSeed('modules')} disabled={seedingStatus.modules === 'seeding'} className="rounded-xl font-bold">
                        {seedingStatus.modules === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4 text-primary" />}
                        Seed Modules
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleSeed('zones')} disabled={seedingStatus.zones === 'seeding'} className="rounded-xl font-bold">
                        {seedingStatus.zones === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4 text-primary" />}
                        Seed Zones
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
  );
}
