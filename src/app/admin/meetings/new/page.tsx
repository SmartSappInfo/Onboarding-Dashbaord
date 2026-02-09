
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { collection, addDoc } from 'firebase/firestore';

import type { School, MeetingType } from '@/lib/types';
import { MEETING_TYPES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { BrochureSelect } from '../components/brochure-select';
import { ArrowLeft } from 'lucide-react';

const formSchema = z.object({
  school: z.custom<School>().refine(value => !!value, { message: "School is required." }),
  meetingTime: z.date({
    required_error: "A meeting time is required.",
  }),
  type: z.custom<MeetingType>().refine(value => !!value, { message: "Meeting type is required." }),
  meetingLink: z.string().url({ message: 'Please enter a valid Google Meet URL.' }),
  recordingUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  brochureUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

export default function NewMeetingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();

  const schoolsCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'schools');
  }, [firestore]);
  
  const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsCol);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      meetingLink: '',
      recordingUrl: '',
      brochureUrl: '',
      type: MEETING_TYPES[0], // Default to Parent Engagement
    },
  });

  React.useEffect(() => {
    const schoolId = searchParams.get('schoolId');
    if (schoolId && schools) {
      const selectedSchool = schools.find(s => s.id === schoolId);
      if (selectedSchool) {
        form.setValue('school', selectedSchool);
      }
    }
  }, [searchParams, schools, form]);


  const onSubmit = (data: FormData) => {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "Firestore not available",
        description: "Please check your Firebase connection.",
      });
      return;
    }
    
    const meetingData = {
        schoolId: data.school.id,
        schoolName: data.school.name,
        schoolSlug: data.school.slug,
        meetingTime: data.meetingTime.toISOString(),
        meetingLink: data.meetingLink,
        type: data.type,
        recordingUrl: data.recordingUrl || '',
        brochureUrl: data.brochureUrl || '',
    };

    const meetingsCollection = collection(firestore, 'meetings');
    form.control.disabled = true;

    addDoc(meetingsCollection, meetingData)
      .then(() => {
        toast({
          title: 'Meeting Created',
          description: `Meeting for ${data.school.name} has been scheduled.`,
        });
        router.push('/admin/meetings');
      })
      .catch((error) => {
        const permissionError = new FirestorePermissionError({
            path: meetingsCollection.path,
            operation: 'create',
            requestResourceData: meetingData,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Uh oh! Something went wrong.',
          description: 'There was a problem saving the meeting.',
        });
      }).finally(() => {
        form.control.disabled = false;
      });
  };

  return (
    <div>
      <Button asChild variant="ghost" className="mb-4 -ml-4">
        <Link href="/admin/meetings">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Meetings
        </Link>
      </Button>
      <h1 className="text-4xl font-bold tracking-tight mb-8">Add New Meeting</h1>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Meeting Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                  control={form.control}
                  name="school"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School</FormLabel>
                       {isLoadingSchools ? <Skeleton className="h-10 w-full" /> : (
                        <Select
                          onValueChange={(schoolId: string) => {
                            const school = schools?.find((s) => s.id === schoolId);
                            field.onChange(school);
                          }}
                          value={field.value?.id}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a school" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {schools?.map((school) => (
                              <SelectItem key={school.id} value={school.id}>
                                {school.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                       )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meeting Type</FormLabel>
                      <Select
                        onValueChange={(typeId: string) => {
                          const type = MEETING_TYPES.find(t => t.id === typeId);
                          field.onChange(type);
                        }}
                        value={field.value?.id}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a meeting type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MEETING_TYPES.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="meetingTime"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Meeting Time</FormLabel>
                      <FormControl>
                        <DateTimePicker
                            value={field.value}
                            onChange={field.onChange}
                            disabled={form.formState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="meetingLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meeting Link (Google Meet)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://meet.google.com/abc-xyz-pqr" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recordingUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recording URL (YouTube)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://youtu.be/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="brochureUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brochure URL</FormLabel>
                      <FormControl>
                        <BrochureSelect {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => router.push('/admin/meetings')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Creating...' : 'Create Meeting'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
