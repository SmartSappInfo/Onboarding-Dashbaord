
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { seedMedia, seedSchools, seedMeetings, seedSurveys, seedUserAvatars, seedOnboardingStages } from '@/lib/seed';
import { Loader2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';
type Seeder = 'media' | 'schools' | 'meetings' | 'surveys' | 'users' | 'stages' | 'layout';

const DEFAULT_LAYOUT = [
    'quickActions', 'pipelinePieChart', 'latestSurveys', 'upcomingMeetings', 
    'monthlySchoolsChart', 'recentActivity', 'userAssignments'
];

export default function SettingsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [seedingStatus, setSeedingStatus] = useState<Record<Seeder, SeedingState>>({
    media: 'idle',
    schools: 'idle',
    meetings: 'idle',
    surveys: 'idle',
    users: 'idle',
    stages: 'idle',
    layout: 'idle',
  });

  const handleSeed = async (seeder: Seeder) => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore is not available.',
      });
      return;
    }

    setSeedingStatus(prev => ({ ...prev, [seeder]: 'seeding' }));

    try {
      if (seeder === 'layout') {
          if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
            setSeedingStatus(prev => ({ ...prev, [seeder]: 'error' }));
            return;
          }
          await setDoc(doc(firestore, 'dashboardLayouts', user.uid), { componentIds: DEFAULT_LAYOUT });
          toast({ title: 'Layout Reset', description: 'Dashboard layout has been reset to default.' });
      } else {
        let count = 0;
        let name = '';
        
        if (seeder === 'media') {
          count = await seedMedia(firestore);
          name = 'Media Assets';
        } else if (seeder === 'schools') {
          count = await seedSchools(firestore);
          name = 'Schools';
        } else if (seeder === 'meetings') {
          count = await seedMeetings(firestore);
          name = 'Meetings';
        } else if (seeder === 'surveys') {
          count = await seedSurveys(firestore);
          name = 'Surveys';
        } else if (seeder === 'users') {
          count = await seedUserAvatars(firestore);
          toast({
              title: 'Update Complete',
              description: count > 0 ? `${count} user profiles updated with new avatars.` : 'All users already have avatars.',
          });
        } else if (seeder === 'stages') {
          const { stagesCreated, schoolsUpdated } = await seedOnboardingStages(firestore);
          toast({
              title: 'Pipeline Stages Updated',
              description: `${stagesCreated} default stages were created/reset. ${schoolsUpdated} schools were updated.`,
          });
        }

        if (name) {
          toast({
              title: 'Seeding Successful',
              description: `${count} ${name} seeded into the database.`,
          });
        }
      }
      
      setSeedingStatus(prev => ({ ...prev, [seeder]: 'success' }));
      setTimeout(() => setSeedingStatus(prev => ({ ...prev, [seeder]: 'idle' })), 3000);

    } catch (error: any) {
      console.error(`Error processing ${seeder}:`, error);
      setSeedingStatus(prev => ({ ...prev, [seeder]: 'error' }));
      toast({
        variant: 'destructive',
        title: 'Operation Failed',
        description: `Could not process ${seeder}. Check the console for details.`,
      });
    }
  };

  const SeedingButton = ({ seeder, children }: { seeder: Seeder, children: React.ReactNode }) => {
    const status = seedingStatus[seeder];
    const isLoading = status === 'seeding';
    return (
      <Button onClick={() => handleSeed(seeder)} disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </Button>
    );
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Data Seeding</CardTitle>
          <CardDescription>
            Use these actions to manage sample data in your Firestore database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
              <h3 className="text-base font-semibold mb-2">Destructive Actions</h3>
              <p className="text-sm text-muted-foreground mb-4">These actions will first delete all existing data in the respective collections before adding the sample data.</p>
              <div className="flex flex-wrap gap-4">
                  <SeedingButton seeder="media">Seed Media Assets</SeedingButton>
                  <SeedingButton seeder="schools">Seed Schools</SeedingButton>
                  <SeedingButton seeder="meetings">Seed Meetings</SeedingButton>
                  <SeedingButton seeder="surveys">Seed Surveys</SeedingButton>
              </div>
          </div>
          <div>
              <h3 className="text-base font-semibold mb-2">Non-Destructive & Update Actions</h3>
              <p className="text-sm text-muted-foreground mb-4">These actions update existing data or add/reset default configurations.</p>
              <div className="flex flex-wrap gap-4">
                  <SeedingButton seeder="users">Update User Avatars</SeedingButton>
                  <SeedingButton seeder="stages">Reset & Seed Pipeline Stages</SeedingButton>
                  <SeedingButton seeder="layout">Reset Dashboard Layout</SeedingButton>
              </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
