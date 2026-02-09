
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { collection, doc, updateDoc } from 'firebase/firestore';

import type { School, Meeting, MeetingType } from '@/lib/types';
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
import { useFirestore, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { BrochureSelect } from '../../components/brochure-select';

const formSchema = z.object({
  school: z.custom<School>().refine(value => value, { message: "School is required." }),
  meetingTime: z.date({
    required_error: "A meeting time is required.",
  }),
  type: z.custom<MeetingType>().refine(value => !!value, { message: "Meeting type is required." }),
  meetingLink: z.string().url({ message: 'Please enter a valid Google Meet URL.' }),
  recordingUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  brochureUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

function EditMeetingForm({ meetingId }: { meetingId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();

  const meetingDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'meetings', meetingId);
  }, [firestore, meetingId]);
  const { data: meeting, isLoading: isLoadingMeeting } = useDoc<Meeting>(meetingDocRef);
  
  const schoolsCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'schools');
  }, [firestore]);
  const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsCol);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  React.useEffect(() => {
    if (meeting && schools) {
      const selectedSchool = schools.find(s => s.id === meeting.schoolId);
      form.reset({
        school: selectedSchool,
        meetingTime: new Date(meeting.meetingTime),
        type: meeting.type || MEETING_TYPES[0],
        meetingLink: meeting.meetingLink,
        recordingUrl: meeting.recordingUrl || '',
        brochureUrl: meeting.brochureUrl || '',
      });
    }
  }, [meeting, schools, form]);

  const onSubmit = (data: FormData) => {
    if (!firestore || !meetingId) {
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
        type: data.type,
        meetingLink: data.meetingLink,
        recordingUrl: data.recordingUrl || '',
        brochureUrl: data.brochureUrl || '',
    };

    const docRef = doc(firestore, 'meetings', meetingId);
    form.control.disabled = true;

    updateDoc(docRef, meetingData).then(() => {
        toast({
            title: 'Meeting Updated',
            description: `The meeting for ${data.school.name} has been updated.`,
        });
        router.push('/admin/meetings');
    }).catch((error) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: meetingData,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
            variant: 'destructive',
            title: 'Uh oh! Something went wrong.',
            description: 'There was a problem updating the meeting.',
        });
    }).finally(() => {
        form.control.disabled = false;
    });
  };

  if (isLoadingMeeting || isLoadingSchools) {
    return (
       <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Meeting Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
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
                      <Input placeholder="https://youtu.be/..." {...field} value={field.value ?? ''} />
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
                        <BrochureSelect
                            value={field.value}
                            onValueChange={field.onChange}
                        />
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
                {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default function EditMeetingPage() {
  const params = useParams();
  const meetingId = params.id as string;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
      <h1 className="text-4xl font-bold tracking-tight mb-8">Edit Meeting</h1>
      {meetingId ? <EditMeetingForm meetingId={meetingId} /> : <p>Meeting ID not found.</p>}
    </div>
  );
}
