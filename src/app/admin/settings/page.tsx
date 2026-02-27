'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { seedMedia, seedSchools, seedMeetings, seedSurveys, seedUserAvatars, seedOnboardingStages, seedModules, seedActivities, seedPdfForms, seedMessaging } from '@/lib/seed';
import { Loader2, RefreshCcw, Database, ShieldCheck, ClipboardList, Film, School as SchoolIcon, History, MessageSquareText } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import ModuleEditor from './components/ModuleEditor';
import { Separator } from '@/components/ui/separator';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';
type Seeder = 'media' | 'schools' | 'meetings' | 'surveys' | 'users' | 'stages' | 'layout' | 'modules' | 'activities' | 'pdfs' | 'messaging';

const DEFAULT_LAYOUT = [
    'userAssignments', 'pipelinePieChart', 'upcomingMeetings', 
    'recentActivity', 'moduleRadarChart', 'latestSurveys', 'monthlySchoolsChart',
];

export default function SettingsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [seedingStatus, setSeedingStatus] = useState<Record<Seeder, SeedingState>>({
    media: 'idle', schools: 'idle', meetings: 'idle', surveys: 'idle', 
    users: 'idle', stages: 'idle', layout: 'idle', modules: 'idle', 
    activities: 'idle', pdfs: 'idle', messaging: 'idle',
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
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Data Seeding</CardTitle>
          <CardDescription>Populate your database with sample data for testing and development.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Core Infrastructure</h3>
              <div className="flex flex-wrap gap-3">
                  <Button variant="outline" size="sm" onClick={() => handleSeed('stages')} disabled={seedingStatus.stages === 'seeding'}>
                    {seedingStatus.stages === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    Seed Stages
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSeed('modules')} disabled={seedingStatus.modules === 'seeding'}>
                    {seedingStatus.modules === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    Seed Modules
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSeed('users')} disabled={seedingStatus.users === 'seeding'}>
                    {seedingStatus.users === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    Update Avatars
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSeed('layout')} disabled={seedingStatus.layout === 'seeding'}>
                    {seedingStatus.layout === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    Reset Layout
                  </Button>
              </div>
          </div>

          <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Sample Content</h3>
              <div className="flex flex-wrap gap-3">
                  <Button onClick={() => handleSeed('schools')} disabled={seedingStatus.schools === 'seeding'}>
                    {seedingStatus.schools === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SchoolIcon className="mr-2 h-4 w-4" />}
                    Seed Schools
                  </Button>
                  <Button onClick={() => handleSeed('meetings')} disabled={seedingStatus.meetings === 'seeding'}>
                    {seedingStatus.meetings === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    Seed Meetings
                  </Button>
                  <Button onClick={() => handleSeed('media')} disabled={seedingStatus.media === 'seeding'}>
                    {seedingStatus.media === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Film className="mr-2 h-4 w-4" />}
                    Seed Media
                  </Button>
                  <Button onClick={() => handleSeed('surveys')} disabled={seedingStatus.surveys === 'seeding'}>
                    {seedingStatus.surveys === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
                    Seed Surveys
                  </Button>
                  <Button onClick={() => handleSeed('pdfs')} disabled={seedingStatus.pdfs === 'seeding'}>
                    {seedingStatus.pdfs === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Seed Doc Signing
                  </Button>
                  <Button onClick={() => handleSeed('messaging')} disabled={seedingStatus.messaging === 'seeding'}>
                    {seedingStatus.messaging === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}
                    Seed Messaging
                  </Button>
                  <Button onClick={() => handleSeed('activities')} disabled={seedingStatus.activities === 'seeding'}>
                    {seedingStatus.activities === 'seeding' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <History className="mr-2 h-4 w-4" />}
                    Seed Activity Feed
                  </Button>
              </div>
          </div>
        </CardContent>
      </Card>
      
      <Separator />
      <ModuleEditor />
    </div>
  );
}