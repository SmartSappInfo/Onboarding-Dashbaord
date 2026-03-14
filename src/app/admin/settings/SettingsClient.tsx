'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { seedMedia, seedSchools, seedMeetings, seedSurveys, seedUserAvatars, seedOnboardingStages, seedModules, seedActivities, seedPdfForms, seedMessaging, seedZones, seedMessageLogs, seedTasks, seedBillingData, seedRolesAndPermissions, seedPipelines, seedOnboardingPipelineFromCurrentData, enrichAndRestoreSchools, rollbackSchoolsMigration } from '@/lib/seed';
import { Loader2, RefreshCw, Database, ShieldCheck, ClipboardList, Film, School as SchoolIcon, History, MessageSquareText, MapPin, CheckSquare, Banknote, ShieldAlert, Workflow, Zap, ArrowRightLeft, RotateCcw, CheckCircle2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import ModuleEditor from './components/ModuleEditor';
import ZoneEditor from './components/ZoneEditor';
import RoleEditor from './components/RoleEditor';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';
type Seeder = 'media' | 'schools' | 'meetings' | 'surveys' | 'users' | 'stages' | 'layout' | 'modules' | 'activities' | 'pdfs' | 'messaging' | 'zones' | 'logs' | 'tasks' | 'billing' | 'roles' | 'pipelines' | 'harvest' | 'enrich' | 'rollback';

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
    harvest: 'idle', enrich: 'idle', rollback: 'idle'
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
          toast({ title: 'Migration Complete', description: `Enriched ${count} schools with pipeline context.` });
      } else if (seeder === 'rollback') {
          const count = await rollbackSchoolsMigration(firestore);
          toast({ title: 'Rollback Successful', description: `Restored ${count} schools from backup.` });
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
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Advanced Migration Tools */}
        <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-white">
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
            <CardContent className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest">1. Architect</h4>
                    </div>
                    <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase tracking-tighter">Extracts unique stages from your current school records and builds the master onboarding pipeline.</p>
                    <Button 
                        variant="outline" 
                        onClick={() => handleSeed('harvest')} 
                        disabled={seedingStatus.harvest === 'seeding'} 
                        className="w-full rounded-xl font-bold border-primary/20 hover:bg-primary/5 text-primary"
                    >
                        {seedingStatus.harvest === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Workflow className="mr-2 h-4 w-4" />}
                        Initialize Master Pipeline
                    </Button>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest">2. Harmonize</h4>
                    </div>
                    <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase tracking-tighter">Maps all existing schools to the new pipeline structure and ensures stage data consistency (Backs up directory first).</p>
                    <Button 
                        onClick={() => handleSeed('enrich')} 
                        disabled={seedingStatus.enrich === 'seeding'} 
                        className="w-full rounded-xl font-black shadow-lg uppercase text-[10px] tracking-widest"
                    >
                        {seedingStatus.enrich === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        Enrich & Sync Schools
                    </Button>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <RotateCcw className="h-4 w-4 text-rose-600" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-600">3. Recovery</h4>
                    </div>
                    <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase tracking-tighter">Reverts the school directory to the state captured in the most recent enrichment backup.</p>
                    <Button 
                        variant="ghost" 
                        onClick={() => handleSeed('rollback')} 
                        disabled={seedingStatus.rollback === 'seeding'} 
                        className="w-full rounded-xl font-bold text-rose-600 hover:bg-rose-50"
                    >
                        {seedingStatus.rollback === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                        Emergency Rollback
                    </Button>
                </div>
            </CardContent>
        </Card>

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
                    <Button variant="outline" size="sm" onClick={() => handleSeed('billing')} disabled={seedingStatus.billing === 'seeding'} className="rounded-xl font-bold">
                        {seedingStatus.billing === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4 text-primary" />}
                        Seed Billing Hubs
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleSeed('users')} disabled={seedingStatus.users === 'seeding'} className="rounded-xl font-bold">
                        {seedingStatus.users === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4 text-primary" />}
                        Update Avatars
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleSeed('layout')} disabled={seedingStatus.layout === 'seeding'} className="rounded-xl font-bold">
                        {seedingStatus.layout === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4 text-primary" />}
                        Reset Layout
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
                    <Button onClick={() => handleSeed('pdfs')} disabled={seedingStatus.pdfs === 'seeding'} className="rounded-xl font-bold shadow-sm">
                        {seedingStatus.pdfs === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        Seed Doc Signing
                    </Button>
                    <Button onClick={() => handleSeed('tasks')} disabled={seedingStatus.tasks === 'seeding'} className="rounded-xl font-bold shadow-sm">
                        {seedingStatus.tasks === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                        Seed CRM Tasks
                    </Button>
                    <Button onClick={() => handleSeed('messaging')} disabled={seedingStatus.messaging === 'seeding'} className="rounded-xl font-bold shadow-sm">
                        {seedingStatus.messaging === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}
                        Seed Messaging
                    </Button>
                    <Button onClick={() => handleSeed('logs')} disabled={seedingStatus.logs === 'seeding'} className="rounded-xl font-bold shadow-sm">
                        {seedingStatus.logs === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <History className="mr-2 h-4 w-4" />}
                        Seed Message Logs
                    </Button>
                    <Button onClick={() => handleSeed('activities')} disabled={seedingStatus.activities === 'seeding'} className="rounded-xl font-bold shadow-sm">
                        {seedingStatus.activities === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <History className="mr-2 h-4 w-4" />}
                        Seed Activity Feed
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
