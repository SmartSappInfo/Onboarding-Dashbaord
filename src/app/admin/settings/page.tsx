'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { seedMedia, seedSchools, seedMeetings } from '@/lib/seed';
import { Loader2 } from 'lucide-react';

type SeedingState = 'idle' | 'seeding' | 'success' | 'error';
type Seeder = 'media' | 'schools' | 'meetings';

export default function SettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [seedingStatus, setSeedingStatus] = useState<Record<Seeder, SeedingState>>({
    media: 'idle',
    schools: 'idle',
    meetings: 'idle',
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
      } else if (seeder === 'schools') {
        count = await seedSchools(firestore);
        name = 'Schools';
      } else if (seeder === 'meetings') {
        count = await seedMeetings(firestore);
        name = 'Meetings';
      }
      
      setSeedingStatus(prev => ({ ...prev, [seeder]: 'success' }));
      toast({
        title: 'Seeding Successful',
        description: `${count} ${name} seeded into the database.`,
      });
      
      setTimeout(() => setSeedingStatus(prev => ({ ...prev, [seeder]: 'idle' })), 3000);

    } catch (error: any) {
      console.error(`Error seeding ${seeder}:`, error);
      setSeedingStatus(prev => ({ ...prev, [seeder]: 'error' }));
      toast({
        variant: 'destructive',
        title: 'Seeding Failed',
        description: `Could not seed ${seeder}. Check the console for details.`,
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
    <div>
      <h1 className="text-4xl font-bold tracking-tight mb-8">Settings</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Data Seeding</CardTitle>
          <CardDescription>
            Use these actions to populate your Firestore database with sample data. 
            This will clear any existing data in the respective collections.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <SeedingButton seeder="media">Seed Media Assets</SeedingButton>
          <SeedingButton seeder="schools">Seed Schools</SeedingButton>
          <SeedingButton seeder="meetings">Seed Meetings</SeedingButton>
        </CardContent>
      </Card>
    </div>
  );
}
