

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { collection, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';

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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { BrochureSelect } from '../../components/brochure-select';
import { logActivity } from '@/lib/activity-logger';

const formSchema = z.object({
  school: z.custom<School>().refine(value => value, { message: "School is required." }),
  schoolSlug: z.string().min(3, 'Slug must be at least 3 characters.').regex(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens.'}),
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
  const { user } = useUser();

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
        schoolSlug: meeting.schoolSlug,
        meetingTime: new Date(meeting.meetingTime),
        type: meeting.type || MEETING_TYPES[0],
        meetingLink: meeting.meetingLink,
        recordingUrl: meeting.recordingUrl || '',
        brochureUrl: meeting.brochureUrl || '',
      });
    }
  }, [meeting, schools, form]);

  const onSubmit = async (data: FormData) => {
    if (!firestore || !meetingId || !user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to perform this action.",
      });
      return;
    }
    
    // Uniqueness check
    const meetingsRef = collection(firestore, 'meetings');
    const q = query(meetingsRef, where('type.slug', '==', data.type.slug), where('schoolSlug', '==', data.schoolSlug));
    const querySnapshot = await getDocs(q);
    
    const isDuplicate = querySnapshot.docs.some(doc => doc.id !== meetingId);
    
    if (isDuplicate) {
        form.setError('schoolSlug', { type: 'manual', message: 'This slug is already in use for this meeting type. Please choose another.' });
        toast({ variant: 'destructive', title: 'Slug already exists', description: 'Please choose a unique slug for this meeting type.' });
        return;
    }

    const meetingData = {
        schoolId: data.school.id,
        schoolName: data.school.name,
        schoolSlug: data.schoolSlug,
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
        if (user) {
            logActivity({
                schoolId: data.school.id,
                userId: user.uid,
                type: 'school_updated',
                source: 'user_action',
                description: `${user.displayName} updated the ${data.type.name} meeting for "${data.school.name}".`,
                metadata: { meetingId }
            });
        }
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
                          if (school) {
                            form.setValue('schoolSlug', school.slug, { shouldValidate: true });
                          }
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
                  name="schoolSlug"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>Meeting Page Slug</FormLabel>
                          <FormControl>
                              <Input placeholder="e.g., ghana-international-school" {...field} />
                          </FormControl>
                           <FormDescription>
                              The unique slug for this meeting's public page URL.
                          </FormDescription>
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
