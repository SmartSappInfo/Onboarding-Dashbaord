
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { 
    ArrowLeft, 
    Calendar, 
    Link as LinkIcon, 
    Loader2, 
    Plus, 
    Globe, 
    Clock, 
    Building, 
    Video, 
    FileText,
    Zap
} from 'lucide-react';

import type { School, MeetingType } from '@/lib/types';
import { MEETING_TYPES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { BrochureSelect } from '../components/brochure-select';
import { logActivity } from '@/lib/activity-logger';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  school: z.custom<School>().refine(value => !!value, { message: "School is required." }),
  schoolSlug: z.string()
    .min(3, 'Slug must be at least 3 characters.')
    .regex(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens.'}),
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
  const { user } = useUser();

  const schoolsCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'schools');
  }, [firestore]);
  
  const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsCol);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      school: undefined,
      schoolSlug: '',
      meetingTime: undefined,
      meetingLink: '',
      recordingUrl: '',
      brochureUrl: '',
      type: MEETING_TYPES[0],
    },
  });

  const { watch, setValue } = form;
  const watchedType = watch('type');

  React.useEffect(() => {
    const schoolId = searchParams.get('schoolId');
    if (schoolId && schools) {
      const selectedSchool = schools.find(s => s.id === schoolId);
      if (selectedSchool) {
        form.setValue('school', selectedSchool);
        form.setValue('schoolSlug', selectedSchool.slug, { shouldValidate: true });
      }
    }
  }, [searchParams, schools, form]);


  const onSubmit = async (data: FormData) => {
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Error", description: "Authentication failed." });
      return;
    }

    // Uniqueness check
    const meetingsRef = collection(firestore, 'meetings');
    const q = query(meetingsRef, where('type.slug', '==', data.type.slug), where('schoolSlug', '==', data.schoolSlug));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
        form.setError('schoolSlug', { type: 'manual', message: 'This slug is already in use for this meeting type.' });
        toast({ variant: 'destructive', title: 'Slug already exists', description: 'Please choose a unique URL backhalf.' });
        return;
    }
    
    const meetingData = {
        schoolId: data.school.id,
        schoolName: data.school.name,
        schoolSlug: data.schoolSlug,
        meetingTime: data.meetingTime.toISOString(),
        meetingLink: data.meetingLink,
        type: data.type,
        recordingUrl: data.recordingUrl || '',
        brochureUrl: data.brochureUrl || '',
    };

    const meetingsCollection = collection(firestore, 'meetings');

    addDoc(meetingsCollection, meetingData)
      .then((docRef) => {
        toast({ title: 'Meeting Scheduled', description: `Session for ${data.school.name} created.` });
        logActivity({
            schoolId: data.school.id,
            userId: user.uid,
            type: 'meeting_created',
            source: 'user_action',
            description: `scheduled a ${data.type.name} session for "${data.school.name}".`,
            metadata: { meetingId: docRef.id, meetingTime: data.meetingTime.toISOString() }
        });
        router.push('/admin/meetings');
      })
      .catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: meetingsCollection.path,
            operation: 'create',
            requestResourceData: meetingData,
        }));
      });
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
            <Button asChild variant="ghost" className="-ml-2 text-muted-foreground hover:text-foreground font-bold">
                <Link href="/admin/meetings">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Directory
                </Link>
            </Button>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-background px-3 py-1 rounded-full border shadow-sm">
                <Zap className="h-3 w-3 text-primary" />
                Draft Mode
            </div>
        </div>

        <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">Schedule Session</h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Building className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-black uppercase tracking-tight">Identity & Classification</CardTitle>
                        <CardDescription className="text-xs font-medium">Establish session context.</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <FormField
                  control={form.control}
                  name="school"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Target School</FormLabel>
                       {isLoadingSchools ? <Skeleton className="h-12 w-full rounded-xl" /> : (
                        <Select
                          onValueChange={(schoolId: string) => {
                            const school = schools?.find((s) => s.id === schoolId);
                            field.onChange(school);
                            if (school) {
                              setValue('schoolSlug', school.slug, { shouldValidate: true });
                            }
                          }}
                          value={field.value?.id}
                        >
                          <FormControl>
                            <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all">
                              <SelectValue placeholder="Select an institution..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl">
                            {schools?.map((school) => (
                              <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
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
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Session Category</FormLabel>
                      <Select
                        onValueChange={(typeId: string) => {
                          const type = MEETING_TYPES.find(t => t.id === typeId);
                          field.onChange(type);
                        }}
                        value={field.value?.id}
                      >
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {MEETING_TYPES.map((type) => (
                            <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-black uppercase tracking-tight">Scheduling & Logistics</CardTitle>
                        <CardDescription className="text-xs font-medium">When and where the session happens.</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <FormField
                  control={form.control}
                  name="meetingTime"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Session Time</FormLabel>
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
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Meeting Link (Google Meet)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://meet.google.com/..." {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-mono text-sm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-black uppercase tracking-tight">Supporting Materials</CardTitle>
                        <CardDescription className="text-xs font-medium">Resources for participants.</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <FormField
                  control={form.control}
                  name="brochureUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Event Brochure</FormLabel>
                      <FormControl>
                        <BrochureSelect {...field} className="rounded-xl overflow-hidden bg-muted/20 border-none" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-primary/5">
              <CardHeader className="bg-primary/10 border-b pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
                        <Globe className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-black uppercase tracking-tight">Public Presence</CardTitle>
                        <CardDescription className="text-xs font-bold text-primary/60 uppercase tracking-widest">Define the public URL identity.</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <FormField
                  control={form.control}
                  name="schoolSlug"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary/60 ml-1">URL Path Context</FormLabel>
                          <div className="flex flex-col sm:flex-row group transition-all">
                                <div className="flex h-12 items-center bg-muted border border-border border-r-0 rounded-t-xl sm:rounded-l-xl sm:rounded-tr-none px-4 text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60 shrink-0">
                                    /meetings/{watchedType?.slug || 'parent-engagement'}/
                                </div>
                                <FormControl>
                                    <Input 
                                        {...field} 
                                        placeholder="e.g. school-slug" 
                                        className="h-12 rounded-t-none sm:rounded-l-none rounded-b-xl sm:rounded-r-xl bg-white border-2 border-slate-200 focus:border-primary focus-visible:ring-0 shadow-none font-bold text-lg px-4" 
                                    />
                                </FormControl>
                            </div>
                          <FormDescription className="text-[10px] uppercase font-black text-muted-foreground/40 mt-2 ml-1">
                              MUST MATCH THE OFFICIAL SCHOOL SLUG FOR AUTOMATIC ROUTING.
                          </FormDescription>
                          <FormMessage />
                      </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4 pt-8">
                <Button 
                    type="submit" 
                    size="lg" 
                    disabled={form.formState.isSubmitting}
                    className="h-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/20 gap-3 transition-all active:scale-95"
                >
                    {form.formState.isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
                    Initialize Session
                </Button>
                <Button type="button" variant="ghost" className="font-bold text-muted-foreground" onClick={() => router.push('/admin/meetings')}>
                    Cancel and Discard
                </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
