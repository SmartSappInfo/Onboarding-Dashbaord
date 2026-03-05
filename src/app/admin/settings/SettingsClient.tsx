'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { seedMedia, seedSchools, seedMeetings, seedSurveys, seedUserAvatars, seedOnboardingStages, seedModules, seedActivities, seedPdfForms, seedMessaging, seedZones, seedMessageLogs } from '@/lib/seed';
import { Loader2, RefreshCcw, Database, ShieldCheck, ClipboardList, Film, School as SchoolIcon, History, MessageSquareText, MapPin } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import ModuleEditor from './components/ModuleEditor';
import ZoneEditor from './components/ZoneEditor';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';
type Seeder = 'media' | 'schools' | 'meetings' | 'surveys' | 'users' | 'stages' | 'layout' | 'modules' | 'activities' | 'pdfs' | 'messaging' | 'zones' | 'logs';

const DEFAULT_LAYOUT = [
    'userAssignments', 'pipelinePieChart', 'upcomingMeetings', 
    'recentActivity', 'moduleRadarChart', 'latestSurveys', 'monthlySchoolsChart',
];

export default function SettingsClient() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [seedingStatus, setSeedingStatus] = useState<Record<Seeder, SeedingState>>({
    media: 'idle', schools: 'idle', meetings: 'idle', surveys: 'idle', 
    users: 'idle', stages: 'idle', layout: 'idle', modules: 'idle', 
    activities: 'idle', pdfs: 'idle', messaging: 'idle', zones: 'idle', logs: 'idle',
  });

  const handleSeed = async (seeder: Seeder) => {
    if (!firestore) return;
    setSeedingStatus(prev => ({ ...prev, [seeder]: 'seeding' }));

    try {
      if (seeder === 'layout') {
          if (!user) throw new Error('Not logged in');
          await setDoc(doc(firestore, 'dashboardLayouts', user.uid), { componentIds: DEFAULT_LAYOUT });
          toast({ title: 'Layout Reset', description: 'Dashboard layout has been reset to default.' });
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
      toast({ variant: 'destructive', title: 'Error', description: `Could not process ${seeder}.` });
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 space-y-12 bg-muted/5">
      <div className="max-w-7xl mx-auto space-y-12">
        <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">System Configuration</h1>
            <p className="text-muted-foreground font-medium text-sm mt-1">Initialize system data, reset layouts, and configure core platform modules and organizational zones.</p>
        </div>

        <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-muted/30 border-b pb-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                    <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <CardTitle className="text-lg font-black uppercase tracking-tight">System Infrastructure</CardTitle>
                    <CardDescription className="text-xs font-medium">Core system management and data initialization tools.</CardDescription>
                </div>
            </div>
            </CardHeader>
            <CardContent className="p-6 space-y-10">
            <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 ml-1">Structural Configuration</h3>
                <div className="flex flex-wrap gap-3">
                    <Button variant="outline" size="sm" onClick={() => handleSeed('stages')} disabled={seedingStatus.stages === 'seeding'} className="rounded-xl font-bold">
                        {seedingStatus.stages === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4 text-primary" />}
                        Seed Stages
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleSeed('modules')} disabled={seedingStatus.modules === 'seeding'} className="rounded-xl font-bold">
                        {seedingStatus.modules === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4 text-primary" />}
                        Seed Modules
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleSeed('zones')} disabled={seedingStatus.zones === 'seeding'} className="rounded-xl font-bold">
                        {seedingStatus.zones === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4 text-primary" />}
                        Seed Zones
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleSeed('users')} disabled={seedingStatus.users === 'seeding'} className="rounded-xl font-bold">
                        {seedingStatus.users === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4 text-primary" />}
                        Update Avatars
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleSeed('layout')} disabled={seedingStatus.layout === 'seeding'} className="rounded-xl font-bold">
                        {seedingStatus.layout === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4 text-primary" />}
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
                        {seedingStatus.meetings === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
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
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ModuleEditor />
            <ZoneEditor />
        </div>
      </div>
    </div>
  );
}
