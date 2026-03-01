'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { collection, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { 
    ArrowLeft, 
    Loader2, 
    Save, 
    Settings2, 
    Globe, 
    Calendar,
    Building, 
    Link as LinkIcon,
    Video,
    Eye,
    ExternalLink
} from 'lucide-react';

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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { BrochureSelect } from '../../components/brochure-select';
import { logActivity } from '@/lib/activity-logger';
import { Separator } from '@/components/ui/separator';

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

export default function EditMeetingPage() {
  const params = useParams();
  const meetingId = params.id as string;
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();

  const [hasInitialized, setHasInitialized] = React.useState(false);

  const meetingDocRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
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
    defaultValues: {
      school: undefined,
      schoolSlug: '',
      meetingTime: undefined,
      type: undefined,
      meetingLink: '',
      recordingUrl: '',
      brochureUrl: '',
    },
  });

  const watchedType = form.watch('type');
  const watchedSlug = form.watch('schoolSlug');

  // Robust synchronization of DB data to form state
  React.useEffect(() => {
    if (meeting && schools && !hasInitialized) {
      const selectedSchool = schools.find(s => s.id === meeting.schoolId);
      const selectedType = MEETING_TYPES.find(t => t.id === meeting.type?.id) || 
                          MEETING_TYPES.find(t => t.slug === (meeting.type as any)?.slug) ||
                          MEETING_TYPES.find(t => t.id === (meeting as any).type) ||
                          MEETING_TYPES[0];

      if (selectedSchool) {
          form.reset({
            school: selectedSchool,
            schoolSlug: meeting.schoolSlug || selectedSchool.slug,
            meetingTime: meeting.meetingTime ? new Date(meeting.meetingTime) : new Date(),
            type: selectedType,
            meetingLink: meeting.meetingLink || '',
            recordingUrl: meeting.recordingUrl || '',
            brochureUrl: meeting.brochureUrl || '',
          });
          setHasInitialized(true);
      }
    }
  }, [meeting, schools, form, hasInitialized]);

  const onSubmit = async (data: FormData) => {
    if (!firestore || !meetingId || !user) return;
    
    const meetingsRef = collection(firestore, 'meetings');
    const q = query(meetingsRef, where('type.slug', '==', data.type.slug), where('schoolSlug', '==', data.schoolSlug));
    const querySnapshot = await getDocs(q);
    
    const isDuplicate = querySnapshot.docs.some(doc => doc.id !== meetingId);
    
    if (isDuplicate) {
        form.setError('schoolSlug', { type: 'manual', message: 'This slug is already in use for this meeting type.' });
        toast({ variant: 'destructive', title: 'Slug already exists', description: 'Please choose a unique URL backhalf.' });
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
    
    updateDoc(docRef, meetingData).then(() => {
        toast({ title: 'Meeting Updated', description: `Session for ${data.school.name} saved.` });
        logActivity({
            schoolId: data.school.id,
            userId: user.uid,
            type: 'school_updated',
            source: 'user_action',
            description: `updated the ${data.type.name} session for "${data.school.name}".`,
            metadata: { meetingId }
        });
        router.push('/admin/meetings');
    }).catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: meetingData,
        }));
    });
  };

  const publicUrl = watchedType && watchedSlug ? `/meetings/${watchedType.slug}/${watchedSlug}` : null;

  const isGlobalLoading = isLoadingMeeting || isLoadingSchools || !hasInitialized;

  if (isGlobalLoading) {
    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 space-y-8 bg-muted/5">
            <Skeleton className="h-10 w-48 mb-8" />
            <Card className="max-w-3xl mx-auto shadow-sm border-none ring-1 ring-border">
                <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
                <CardContent className="space-y-8">
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                </CardContent>
            </Card>
        </div>
    );
  }

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
            <div className="flex items-center gap-2">
                {publicUrl && (
                    <Button asChild variant="outline" size="sm" className="h-8 rounded-xl font-bold gap-2">
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-3.5 w-3.5" />
                            Preview Live Page
                        </a>
                    </Button>
                )}
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-background px-3 py-1 rounded-full border shadow-sm">
                    <Settings2 className="h-3 w-3" />
                    Configuration Mode
                </div>
            </div>
        </div>

        <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">Update Session</h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-black uppercase tracking-tight">Session Configuration</CardTitle>
                        <CardDescription className="text-xs font-medium">Core institutional setup, logistics, and supporting assets.</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-8 bg-background">
                {/* Institution & Category Group */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="school"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Target School</FormLabel>
                            <Select
                                onValueChange={(schoolId: string) => {
                                    const school = schools?.find((s) => s.id === schoolId);
                                    field.onChange(school);
                                    if (school && !form.getValues('schoolSlug')) {
                                        form.setValue('schoolSlug', school.slug, { shouldValidate: true });
                                    }
                                }}
                                value={field.value?.id || ""}
                            >
                                <FormControl>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                                        <SelectValue placeholder="Select institution..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                    {schools?.map((school) => (
                                        <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                                value={field.value?.id || ""}
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
                </div>

                <Separator className="bg-border/50" />

                {/* Logistics Group */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="meetingTime"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Scheduled Time</FormLabel>
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
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Google Meet URL</FormLabel>
                            <FormControl>
                                <div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-muted/20 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-inner">
                                    <div className="bg-muted px-3 flex items-center text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60 border-r"><Video className="h-3 w-3" /></div>
                                    <Input placeholder="https://meet.google.com/..." {...field} className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent font-mono text-sm" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>

                <Separator className="bg-border/50" />

                {/* Assets Group */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="recordingUrl"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Video Recording (YouTube)</FormLabel>
                            <FormControl>
                                <Input placeholder="https://youtu.be/..." {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20" />
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
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Public Brochure</FormLabel>
                                <FormControl>
                                    <BrochureSelect
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        className="rounded-xl border-none shadow-none bg-muted/20"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-primary/5">
              <CardHeader className="bg-primary/10 border-b pb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
                            <Globe className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-black tracking-tight uppercase">Public Addressing</CardTitle>
                            <CardDescription className="text-xs font-bold text-primary/60 uppercase tracking-widest">Define the public URL identity.</CardDescription>
                        </div>
                    </div>
                    {publicUrl && (
                        <Button asChild variant="link" size="sm" className="text-primary font-black text-[10px] uppercase tracking-widest">
                            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1.5" />
                                View Portal
                            </a>
                        </Button>
                    )}
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
                    {form.formState.isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                    Commit Changes
                </Button>
                <Button type="button" variant="ghost" className="font-bold text-muted-foreground" onClick={() => router.push('/admin/meetings')}>
                    Cancel and Discard
                </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
