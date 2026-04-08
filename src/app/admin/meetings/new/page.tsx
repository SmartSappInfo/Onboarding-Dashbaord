
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
    Save,
    ChevronRight,
    ChevronLeft,
    Check,
    Type,
    Sparkles,
    Bell,
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
import { Textarea } from '@/components/ui/textarea';
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
import { getMeetingHeroDefaults } from '@/lib/meeting-hero-defaults';
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
  heroImageUrl: z.string().url().optional().or(z.literal('')),
  heroTitle: z.string().optional().or(z.literal('')),
  heroDescription: z.string().optional().or(z.literal('')),
  heroTagline: z.string().optional().or(z.literal('')),
  heroCtaLabel: z.string().optional().or(z.literal('')),
  recordingUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  brochureUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  adminAlertsEnabled: z.boolean().default(false),
  adminAlertChannel: z.enum(['email', 'sms', 'both']).default('both'),
  adminAlertNotifyManager: z.boolean().default(false),
  adminAlertSpecificUserIds: z.array(z.string()).default([]),
  adminAlertEmailTemplateId: z.string().optional(),
  adminAlertSmsTemplateId: z.string().optional(),
  entityId: z.string().optional(),
  entityType: z.enum(['institution', 'family', 'person']).optional(),
});

type FormData = z.infer<typeof formSchema>;

const WIZARD_STEPS = [
  { id: 'config', label: 'Configuration', icon: Calendar, description: 'Setup, timing & assets' },
  { id: 'hero', label: 'Hero Content', icon: Type, description: 'Public-facing messaging' },
  { id: 'options', label: 'Options', icon: Bell, description: 'Notifications & advanced' },
] as const;

/**
 * @fileOverview Multi-step Meeting Creation Wizard (Phase 1 - Meetings V2).
 * Replaces the dense single-page form with a guided 3-step flow.
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
  const [currentStep, setCurrentStep] = React.useState(0);

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
      heroTitle: '',
      heroDescription: '',
      heroTagline: '',
      heroCtaLabel: '',
      recordingUrl: '',
      brochureUrl: '',
      type: MEETING_TYPES[0], 
      adminAlertsEnabled: false,
      adminAlertChannel: 'both',
      adminAlertNotifyManager: true,
      adminAlertSpecificUserIds: [],
      adminAlertEmailTemplateId: '',
      adminAlertSmsTemplateId: '',
      entityId: undefined,
      entityType: undefined,
    },
  });

  const { watch, setValue, reset } = form;
  const watchedType = watch('type');
  const watchedSchool = watch('school');

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

  // Auto-populate hero defaults when meeting type changes
  React.useEffect(() => {
    if (watchedType) {
      const defaults = getMeetingHeroDefaults(watchedType.id);
      const schoolName = watchedSchool?.name || '{{school}}';
      // Only prefill if the field is currently empty
      const currentTitle = form.getValues('heroTitle');
      const currentDesc = form.getValues('heroDescription');
      if (!currentTitle) {
        setValue('heroTitle', defaults.title.replace(/\{\{school\}\}/g, schoolName));
      }
      if (!currentDesc) {
        setValue('heroDescription', defaults.description.replace(/\{\{school\}\}/g, schoolName));
      }
    }
  }, [watchedType?.id]); // eslint-disable-line react-hooks/exhaustive-deps


  const onSubmit = async (data: FormData) => {
    if (!firestore || !user) return;

    try {
        const meetingsRef = collection(firestore, 'meetings');
        const q = query(meetingsRef, where('type.slug', '==', data.type.slug), where('schoolSlug', '==', data.schoolSlug));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            form.setError('schoolSlug', { type: 'manual', message: 'This slug is already in use for this meeting type.' });
            toast({ variant: 'destructive', title: 'Slug already exists', description: 'Please choose a unique URL backhalf.' });
            setCurrentStep(0); // Jump back to config step
            return;
        }
        
        const meetingData = {
            schoolId: data.school.id,
            schoolName: data.school.name,
            schoolSlug: data.schoolSlug,
            entityId: data.school.entityId || null,
            entityType: (data.school.entityId ? 'institution' : null) as 'institution' | null,
            workspaceIds: data.school.workspaceIds || [activeWorkspaceId], 
            meetingTime: data.meetingTime.toISOString(),
            meetingLink: data.meetingLink,
            type: data.type,
            heroImageUrl: data.heroImageUrl || '',
            heroTitle: data.heroTitle || '',
            heroDescription: data.heroDescription || '',
            heroTagline: data.heroTagline || '',
            heroCtaLabel: data.heroCtaLabel || '',
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
            entityId: data.school.entityId || null,
            entityType: data.school.entityId ? 'institution' : null,
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

  const canProceed = () => {
    if (currentStep === 0) {
      const school = form.getValues('school');
      const type = form.getValues('type');
      const meetingTime = form.getValues('meetingTime');
      const meetingLink = form.getValues('meetingLink');
      const slug = form.getValues('schoolSlug');
      return !!school && !!type && !!meetingTime && !!meetingLink && slug.length >= 3;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Wizard Header */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-background px-3 py-1 rounded-full border shadow-sm">
                <Zap className="h-3 w-3 text-primary" />
                Draft Mode
            </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 p-2 bg-background rounded-2xl border shadow-sm">
          {WIZARD_STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  className={cn(
                    "flex-1 flex items-center gap-3 p-3 rounded-xl transition-all duration-300 text-left",
                    isActive && "bg-primary/10 ring-1 ring-primary/20 shadow-sm",
                    isCompleted && "bg-emerald-50 dark:bg-emerald-950/20",
                    !isActive && !isCompleted && "hover:bg-muted/50 opacity-60"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-lg shrink-0 transition-colors",
                    isActive && "bg-primary text-white",
                    isCompleted && "bg-emerald-500 text-white",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}>
                    {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  </div>
                  <div className="hidden sm:block min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest truncate">
                      {step.label}
                    </p>
                    <p className="text-[9px] font-medium text-muted-foreground truncate">
                      {step.description}
                    </p>
                  </div>
                </button>
                {index < WIZARD_STEPS.length - 1 && (
                  <ChevronRight className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    index < currentStep ? "text-emerald-500" : "text-muted-foreground/30"
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-32">

            {/* ──────── STEP 1: Configuration ──────── */}
            <div className={cn(currentStep !== 0 && "hidden")}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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

                        <FormField
                            control={form.control}
                            name="schoolSlug"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">URL Path Context</FormLabel>
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

                {/* Right column - preview */}
                <div className="space-y-6">
                    <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-primary/5">
                        <CardHeader className="bg-primary/10 border-b pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
                                    <Globe className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-black tracking-tight uppercase">Public URL Preview</CardTitle>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="p-3 bg-background rounded-xl border font-mono text-xs break-all text-muted-foreground">
                                /meetings/{watchedType?.slug || '...'}/{form.watch('schoolSlug') || '...'}
                            </div>
                        </CardContent>
                    </Card>
                </div>
              </div>
            </div>

            {/* ──────── STEP 2: Hero Content ──────── */}
            <div className={cn(currentStep !== 1 && "hidden")}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b pb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-violet-500/10 rounded-xl">
                                <Type className="h-5 w-5 text-violet-600" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-black uppercase tracking-tight">Hero Content</CardTitle>
                                <CardDescription className="text-xs font-medium text-left">Customize the public-facing messaging shown on the meeting page.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8 bg-background">
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                <Sparkles className="h-3.5 w-3.5" />
                                Pre-filled from {watchedType?.name || 'meeting type'} defaults — edit freely.
                            </p>
                        </div>

                        <FormField
                            control={form.control}
                            name="heroTitle"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Hero Title</FormLabel>
                                    <FormControl>
                                        <Input 
                                            {...field} 
                                            placeholder="e.g. Join Our Digital Transformation Journey"
                                            className="h-14 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-lg"
                                        />
                                    </FormControl>
                                    <FormDescription className="text-[9px] uppercase font-bold tracking-tighter text-left">
                                        The main headline on the public meeting page. Leave blank to use the type default.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="heroDescription"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Hero Description</FormLabel>
                                    <FormControl>
                                        <Textarea 
                                            {...field} 
                                            placeholder="A short paragraph describing the session..."
                                            rows={4}
                                            className="rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-medium resize-none"
                                        />
                                    </FormControl>
                                    <FormDescription className="text-[9px] uppercase font-bold tracking-tighter text-left">
                                        Supporting text below the title. Leave blank for the type default.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Separator className="bg-border/50" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="heroTagline"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Tagline (Optional)</FormLabel>
                                        <FormControl>
                                            <Input 
                                                {...field} 
                                                placeholder="e.g. Free for all parents"
                                                className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="heroCtaLabel"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">CTA Button Label (Optional)</FormLabel>
                                        <FormControl>
                                            <Input 
                                                {...field} 
                                                placeholder="e.g. Register Now"
                                                className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Separator className="bg-border/50" />

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
                    </CardContent>
                    </Card>
                </div>

                {/* Right column - live preview card */}
                <div className="space-y-6">
                    <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden sticky top-24">
                        <CardHeader className="bg-muted/30 border-b pb-4">
                            <CardTitle className="text-sm font-black tracking-tight uppercase flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                Live Preview
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                {watchedType?.name || 'Meeting'}
                            </div>
                            <h3 className="text-lg font-black uppercase tracking-tight leading-tight">
                                {form.watch('heroTitle') || 'Hero Title Will Appear Here'}
                            </h3>
                            <p className="text-xs text-muted-foreground font-medium leading-relaxed line-clamp-4">
                                {form.watch('heroDescription') || 'Hero description text will appear here...'}
                            </p>
                            {form.watch('heroTagline') && (
                                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                                    {form.watch('heroTagline')}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
              </div>
            </div>

            {/* ──────── STEP 3: Options ──────── */}
            <div className={cn(currentStep !== 2 && "hidden")}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b pb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <Settings2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-black uppercase tracking-tight">Advanced Options</CardTitle>
                                <CardDescription className="text-xs font-medium text-left">Recording, brochure, and notifications.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8 bg-background">
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

                    <InternalNotificationConfig prefix="adminAlert" />
                </div>

                <div className="space-y-8">
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
            </div>

            {/* ──────── Wizard Navigation ──────── */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="rounded-xl font-bold gap-2 h-12 px-6"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex items-center gap-1.5">
                {WIZARD_STEPS.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      index === currentStep ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/20"
                    )}
                  />
                ))}
              </div>

              {currentStep < WIZARD_STEPS.length - 1 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="rounded-xl font-bold gap-2 h-12 px-6"
                >
                  Next Step
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="rounded-xl font-bold gap-2 h-12 px-6 shadow-lg"
                >
                  {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Schedule Session
                </Button>
              )}
            </div>

          </form>
        </FormProvider>
      </div>
    </div>
  );
}
