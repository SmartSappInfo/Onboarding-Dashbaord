
'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, addDoc, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';

import { 
    Calendar, 
    Loader2, 
    Plus, 
    Globe, 
    Building, 
    Video, 
    Zap,
    ImageIcon,
    Settings2,
    Save
} from 'lucide-react';

import type { School, MeetingType } from '@/lib/types';
import { MEETING_TYPES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Form,
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
import { Separator } from '@/components/ui/separator';
import InternalNotificationConfig from '@/app/admin/components/internal-notification-config';
import { triggerInternalNotification } from '@/lib/notification-engine';
import { format } from 'date-fns';
import { MediaSelect } from '../../schools/components/media-select';

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
  heroImageUrl: z.string().url().optional().or(z.literal('')),
  recordingUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  brochureUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  adminAlertsEnabled: z.boolean().default(false),
  adminAlertChannel: z.enum(['email', 'sms', 'both']).default('both'),
  adminAlertNotifyManager: z.boolean().default(false),
  adminAlertSpecificUserIds: z.array(z.string()).default([]),
  adminAlertEmailTemplateId: z.string().optional(),
  adminAlertSmsTemplateId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

/**
 * @fileOverview Meeting Initialization Logic.
 * Automatically synchronizes workspace visibility with the parent school record.
 */
export default function NewMeetingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { activeOrganizationId } = useTenant();

  const [hasInitialized, setHasInitialized] = React.useState(false);

  const schoolsCol = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'schools'), where('workspaceIds', 'array-contains', activeWorkspaceId), orderBy('name', 'asc'));
  }, [firestore, activeWorkspaceId]);
  
  const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsCol);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      school: undefined,
      schoolSlug: '',
      meetingTime: undefined,
      meetingLink: '',
      heroImageUrl: '',
      recordingUrl: '',
      brochureUrl: '',
      type: MEETING_TYPES[0], 
      adminAlertsEnabled: false,
      adminAlertChannel: 'both',
      adminAlertNotifyManager: true,
      adminAlertSpecificUserIds: [],
      adminAlertEmailTemplateId: '',
      adminAlertSmsTemplateId: '',
    },
  });

  const { watch, setValue, reset } = form;
  const watchedType = watch('type');

  React.useEffect(() => {
    const schoolIdFromUrl = searchParams.get('schoolId');
    if (schoolIdFromUrl && schools && !hasInitialized) {
      const selectedSchool = schools.find(s => s.id === schoolIdFromUrl);
      if (selectedSchool) {
        reset({
            ...form.getValues(),
            school: selectedSchool,
            schoolSlug: selectedSchool.slug,
            type: MEETING_TYPES[0],
        });
        setHasInitialized(true);
      }
    }
  }, [searchParams, schools, reset, form, hasInitialized]);


  const onSubmit = async (data: FormData) => {
    if (!firestore || !user) return;

    try {
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
            // Inherit multi-workspace visibility from the school
            workspaceIds: data.school.workspaceIds || [activeWorkspaceId], 
            meetingTime: data.meetingTime.toISOString(),
            meetingLink: data.meetingLink,
            type: data.type,
            heroImageUrl: data.heroImageUrl || '',
            recordingUrl: data.recordingUrl || '',
            brochureUrl: data.brochureUrl || '',
            adminAlertsEnabled: data.adminAlertsEnabled,
            adminAlertChannel: data.adminAlertChannel,
            adminAlertNotifyManager: data.adminAlertNotifyManager,
            adminAlertSpecificUserIds: data.adminAlertSpecificUserIds || [],
            adminAlertEmailTemplateId: data.adminAlertEmailTemplateId || '',
            adminAlertSmsTemplateId: data.adminAlertSmsTemplateId || '',
        };

        const docRef = await addDoc(meetingsRef, meetingData);
        
        toast({ title: 'Meeting Scheduled', description: `Session for ${data.school.name} created.` });
        
        logActivity({
            organizationId: activeOrganizationId,
            schoolId: data.school.id,
            userId: user.uid,
            workspaceId: activeWorkspaceId,
            type: 'meeting_created',
            source: 'user_action',
            description: `scheduled a ${data.type.name} session for "${data.school.name}".`,
            metadata: { meetingId: docRef.id, meetingTime: data.meetingTime.toISOString() }
        }).catch(err => console.warn("Activity log deferred:", err.message));

        if (data.adminAlertsEnabled) {
            triggerInternalNotification({
                schoolId: data.school.id,
                notifyManager: data.adminAlertNotifyManager,
                specificUserIds: data.adminAlertSpecificUserIds,
                emailTemplateId: data.adminAlertEmailTemplateId,
                smsTemplateId: data.adminAlertSmsTemplateId,
                channel: data.adminAlertChannel,
                variables: {
                    school_name: data.school.name,
                    meeting_type: data.type.name,
                    date: format(data.meetingTime, 'PPPP'),
                    time: format(data.meetingTime, 'p'),
                    link: data.meetingLink,
                    event_type: 'Session Scheduled'
                }
            }).catch(err => console.warn("Notification deferred:", err.message));
        }

        router.push('/admin/meetings');
    } catch (error: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'meetings',
            operation: 'create',
            requestResourceData: data,
        }));
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-end">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-background px-3 py-1 rounded-full border shadow-sm">
                <Zap className="h-3 w-3 text-primary" />
                Draft Mode
            </div>
        </div>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-32">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
                <div className="lg:col-span-2 space-y-8">
                    <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b pb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <Calendar className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-black uppercase tracking-tight">Session Configuration</CardTitle>
                                <CardDescription className="text-xs font-medium text-left">Core setup, timing, and assets.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8 bg-background">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                        value={field.value?.id || ""}
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="meetingTime"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col text-left">
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
                                        <div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-muted/20 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-inner">
                                            <div className="bg-muted px-3 flex items-center text-[10px] font-black uppercase text-muted-foreground/60 border-r"><Video className="h-3 w-3" /></div>
                                            <Input placeholder="https://meet.google.com/..." {...field} className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent font-mono text-sm" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Separator className="bg-border/50" />

                        <div className="space-y-6">
                            <FormField
                                control={form.control}
                                name="heroImageUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary ml-1 flex items-center gap-2">
                                            <ImageIcon className="h-3.5 w-3.5" /> Hero Spotlight Media
                                        </FormLabel>
                                        <FormControl>
                                            <MediaSelect 
                                                value={field.value} 
                                                onValueChange={field.onChange} 
                                                className="rounded-2xl"
                                            />
                                        </FormControl>
                                        <FormDescription className="text-[9px] uppercase font-bold tracking-tighter text-left">
                                            This image will be the primary visual focus on the meeting page.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Separator className="bg-border/50" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="recordingUrl"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Recording URL (YouTube)</FormLabel>
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
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Event Brochure</FormLabel>
                                    <FormControl>
                                        <BrochureSelect {...field} className="rounded-xl overflow-hidden bg-muted/20 border-none" />
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
                                    <CardTitle className="text-lg font-black tracking-tight uppercase">Public Presence</CardTitle>
                                    <CardDescription className="text-xs font-bold text-primary/60 uppercase tracking-widest text-left">Define the public URL identity.</CardDescription>
                                </div>
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
                                <FormDescription className="text-[10px] uppercase font-black text-muted-foreground/40 mt-2 ml-1 text-left">
                                    MUST MATCH THE OFFICIAL SCHOOL SLUG FOR AUTOMATIC ROUTING.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                    </CardContent>
                    </Card>
                </div>

                <div className="space-y-8">
                    <InternalNotificationConfig prefix="adminAlert" />
                    
                    <div className="pt-4 sticky top-24">
                        <Button 
                            type="submit" 
                            size="lg" 
                            disabled={form.formState.isSubmitting}
                            className="w-full h-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/20 gap-3 transition-all active:scale-95 uppercase tracking-widest"
                        >
                            {form.formState.isSubmitting ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
                            Schedule Session
                        </Button>
                    </div>
                </div>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
