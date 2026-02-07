
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { seedMedia, seedSchools, seedMeetings, seedSurveys, seedUserAvatars, seedOnboardingStages } from '@/lib/seed';
import { Loader2 } from 'lucide-react';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';
type Seeder = 'media' | 'schools' | 'meetings' | 'surveys' | 'users' | 'stages';

export default function SettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [seedingStatus, setSeedingStatus] = useState<Record<Seeder, SeedingState>>({
    media: 'idle',
    schools: 'idle',
    meetings: 'idle',
    surveys: 'idle',
    users: 'idle',
    stages: 'idle',
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
      let count = 0;
      let name = '';
      
      if (seeder === 'media') {
        count = await seedMedia(firestore);
        name = 'Media Assets';
         toast({
            title: 'Seeding Successful',
            description: `${count} ${name} seeded into the database.`,
        });
      } else if (seeder === 'schools') {
        count = await seedSchools(firestore);
        name = 'Schools';
         toast({
            title: 'Seeding Successful',
            description: `${count} ${name} seeded into the database.`,
        });
      } else if (seeder === 'meetings') {
        count = await seedMeetings(firestore);
        name = 'Meetings';
         toast({
            title: 'Seeding Successful',
            description: `${count} ${name} seeded into the database.`,
        });
      } else if (seeder === 'surveys') {
        count = await seedSurveys(firestore);
        name = 'Surveys';
         toast({
            title: 'Seeding Successful',
            description: `${count} ${name} seeded into the database.`,
        });
      } else if (seeder === 'users') {
        count = await seedUserAvatars(firestore);
        toast({
            title: 'Update Complete',
            description: count > 0 ? `${count} user profiles updated with new avatars.` : 'All users already have avatars.',
          });
      } else if (seeder === 'stages') {
        const { stagesCreated, schoolsUpdated } = await seedOnboardingStages(firestore);
        if (stagesCreated === 0 && schoolsUpdated === 0) {
            toast({
                title: 'No Action Needed',
                description: 'Default onboarding stages already exist and all schools have a stage assigned.',
            });
            setSeedingStatus(prev => ({ ...prev, [seeder]: 'idle' }));
            return;
        }

        let description = '';
        if (stagesCreated > 0) {
            description += `${stagesCreated} stages created. `;
        }
        if (schoolsUpdated > 0) {
            description += `${schoolsUpdated} schools were assigned a default stage.`;
        }
        
        toast({
            title: 'Seeding Complete',
            description: description.trim(),
        });
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
            <h3 className="text-base font-semibold mb-2">Non-Destructive Actions</h3>
            <p className="text-sm text-muted-foreground mb-4">These actions update existing data or add default configurations without deleting anything.</p>
            <div className="flex flex-wrap gap-4">
                <SeedingButton seeder="users">Update User Avatars</SeedingButton>
                <SeedingButton seeder="stages">Seed Default Stages & Assign</SeedingButton>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
