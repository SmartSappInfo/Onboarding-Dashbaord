'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { useTerminology } from '@/hooks/use-terminology';

import { 
    Calendar, 
    Loader2, 
    Globe, 
    Video, 
    Settings2,
    Save,
    ChevronRight,
    ChevronLeft,
    Check,
    Type,
    Sparkles,
    Bell,
    ClipboardCheck,
    ImageIcon
} from 'lucide-react';

import type { WorkspaceEntity, MeetingType, MeetingRegistrationField } from '@/lib/types';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { BrochureSelect } from '../components/brochure-select';
import { logActivity } from '@/lib/activity-logger';
import { Separator } from '@/components/ui/separator';
import InternalNotificationConfig from '@/app/admin/components/internal-notification-config';
import { triggerInternalNotification } from '@/lib/notification-engine';
import { format } from 'date-fns';
import { MediaSelect } from '../../entities/components/media-select';
import { getMeetingHeroDefaults } from '@/lib/meeting-hero-defaults';
import { getDefaultRegistrationFields } from '@/lib/meeting-tokens';
import RegistrationFieldBuilder from '../components/registration-field-builder';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  entity: z.custom<WorkspaceEntity>().refine(value => !!value, { message: "Entity is required." }),
  entitySlug: z.string()
    .min(3, 'Slug must be at least 3 characters.')
    .regex(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens.'}),
  meetingTime: z.date({
    required_error: "A meeting time is required.",
  }),
  type: z.custom<MeetingType>().refine(value => !!value, { message: "Meeting type is required." }),
  meetingLink: z.string().url({ message: 'Please enter a valid Google Meet URL.' }),
  
  // Registration
  registrationEnabled: z.boolean().default(false),
  registrationRequiredToJoin: z.boolean().default(false),
  registrationMode: z.enum(['open', 'approval_required']).default('open'),
  registrationFields: z.array(z.custom<MeetingRegistrationField>()).default(getDefaultRegistrationFields()),
  registrationSuccessMessage: z.string().optional(),
  capacityLimit: z.number().int().min(0).optional(),
  waitlistEnabled: z.boolean().default(false),

  // Hero
  heroImageUrl: z.string().url().optional().or(z.literal('')),
  heroTitle: z.string().optional().or(z.literal('')),
  heroDescription: z.string().optional().or(z.literal('')),
  heroTagline: z.string().optional().or(z.literal('')),
  heroCtaLabel: z.string().optional().or(z.literal('')),
  
  // Options
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
  { id: 'config', label: 'Configuration', icon: Calendar, description: 'Setup & timing' },
  { id: 'registration', label: 'Registration', icon: ClipboardCheck, description: 'Signup & capacity' },
  { id: 'hero', label: 'Hero Content', icon: Type, description: 'Public messaging' },
  { id: 'options', label: 'Options', icon: Bell, description: 'Advanced features' },
] as const;

export default function NewMeetingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { activeOrganizationId } = useTenant();
  const { singular } = useTerminology();

  const [hasInitialized, setHasInitialized] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);

  const entitiesCol = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'workspace_entities'), where('workspaceId', '==', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);
  
  const { data: entities, isLoading: isLoadingEntities } = useCollection<WorkspaceEntity>(entitiesCol);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entity: undefined,
      entitySlug: '',
      meetingTime: new Date(new Date().setHours(10, 0, 0, 0)),
      type: undefined,
      meetingLink: '',
      registrationEnabled: false,
      registrationRequiredToJoin: false,
      registrationMode: 'open',
      registrationFields: getDefaultRegistrationFields(),
      registrationSuccessMessage: 'You have successfully registered for this session.',
      capacityLimit: 0,
      waitlistEnabled: false,
      heroImageUrl: '',
      heroTitle: '',
      heroDescription: '',
      heroTagline: '',
      heroCtaLabel: '',
      recordingUrl: '',
      brochureUrl: '',
      adminAlertsEnabled: false,
      adminAlertChannel: 'both',
      adminAlertNotifyManager: true,
      adminAlertSpecificUserIds: [],
      adminAlertEmailTemplateId: '',
      adminAlertSmsTemplateId: '',
    },
  });

  const { setValue, reset } = form;
  const watchedType = form.watch('type');
  const watchedEntity = form.watch('entity');
  const watchedSlug = form.watch('entitySlug');
  const registrationEnabled = form.watch('registrationEnabled');

  React.useEffect(() => {
    const entityIdFromUrl = searchParams.get('entityId');
    if (entityIdFromUrl && entities && !hasInitialized) {
      const selectedEntity = entities.find(s => s.id === entityIdFromUrl);
      if (selectedEntity) {
        reset({
            ...form.getValues(),
            entity: selectedEntity,
            entitySlug: selectedEntity.slug,
            type: MEETING_TYPES[0],
        });
        setHasInitialized(true);
      }
    }
  }, [searchParams, entities, reset, form, hasInitialized]);

  // Auto-enable registration for webinars
  React.useEffect(() => {
    if (watchedType?.slug === 'webinar') {
      setValue('registrationEnabled', true);
      setValue('registrationRequiredToJoin', true);
    }
  }, [watchedType?.slug, setValue]);

  // Auto-populate hero defaults when meeting type changes
  React.useEffect(() => {
    if (watchedType) {
      const defaults = getMeetingHeroDefaults(watchedType.id);
      const entityName = watchedEntity?.displayName || `{{${singular}}}`;
      const currentTitle = form.getValues('heroTitle');
      const currentDesc = form.getValues('heroDescription');
      if (!currentTitle) {
        setValue('heroTitle', defaults.title.replace(/\{\{school\}\}/g, entityName));
      }
      if (!currentDesc) {
        setValue('heroDescription', defaults.description.replace(/\{\{school\}\}/g, entityName));
      }
    }
  }, [watchedType?.id, watchedEntity?.id, singular]);

  const onSubmit = async (data: FormData) => {
    if (!firestore || !user) return;

    try {
        const meetingsRef = collection(firestore, 'meetings');
        const q = query(meetingsRef, where('type.slug', '==', data.type.slug), where('entitySlug', '==', data.entitySlug));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            form.setError('entitySlug', { type: 'manual', message: 'This slug is already in use for this meeting type.' });
            toast({ variant: 'destructive', title: 'Slug already exists', description: 'Please choose a unique URL backhalf.' });
            setCurrentStep(0);
            return;
        }
        
        const meetingData = {
            entityId: data.entity.entityId, // Store Global Entity ID instead of WorkspaceEntity ID
            entityName: data.entity.displayName,
            entitySlug: data.entitySlug,
            entityType: data.entity.entityType || 'institution',
            workspaceIds: [activeWorkspaceId], 
            meetingTime: data.meetingTime.toISOString(),
            meetingLink: data.meetingLink,
            type: data.type,
            
            // Registration fields
            registrationEnabled: data.registrationEnabled,
            registrationRequiredToJoin: data.registrationRequiredToJoin,
            registrationMode: data.registrationMode,
            registrationFields: data.registrationFields,
            registrationSuccessMessage: data.registrationSuccessMessage || '',
            capacityLimit: data.capacityLimit || 0,
            waitlistEnabled: data.waitlistEnabled,

            // Hero fields
            heroImageUrl: data.heroImageUrl || '',
            heroTitle: data.heroTitle || '',
            heroDescription: data.heroDescription || '',
            heroTagline: data.heroTagline || '',
            heroCtaLabel: data.heroCtaLabel || '',
            
            // Options
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
        
        toast({ title: 'Meeting Scheduled', description: `Session for ${data.entity.displayName} created.` });
        
        logActivity({
            organizationId: activeOrganizationId,
            entityId: data.entity.id,
            entityType: data.entity.entityType || 'institution',
            userId: user.uid,
            workspaceId: activeWorkspaceId,
            type: 'meeting_created',
            source: 'user_action',
            description: `scheduled a ${data.type.name} session for "${data.entity.displayName}".`,
            metadata: { meetingId: docRef.id, meetingTime: data.meetingTime.toISOString() }
        }).catch(err => console.warn("Activity log deferred:", err.message));

        if (data.adminAlertsEnabled) {
            triggerInternalNotification({
                entityId: data.entity.id,
                notifyManager: data.adminAlertNotifyManager,
                specificUserIds: data.adminAlertSpecificUserIds,
                emailTemplateId: data.adminAlertEmailTemplateId,
                smsTemplateId: data.adminAlertSmsTemplateId,
                channel: data.adminAlertChannel,
                variables: {
                    school_name: data.entity.displayName,
                    meeting_type: data.type.name,
                    date: format(data.meetingTime, 'PPPP'),
                    time: format(data.meetingTime, 'p'),
                    link: data.meetingLink,
                    event_type: 'New Session Created'
                }
            }).catch(err => console.warn("Notification deferred:", err.message));
        }

        router.push('/admin/meetings');
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Schedule failed', description: error.message });
    }
  };

  const publicUrl = watchedType && watchedSlug ? `/meetings/${watchedType.slug}/${watchedSlug}` : null;

  const handleNext = async () => {
    let isValid = false;
    
    // Validate current step before proceeding
    if (currentStep === 0) {
      isValid = await form.trigger(['entity', 'entitySlug', 'meetingTime', 'type', 'meetingLink']);
    } else if (currentStep === 1) {
      isValid = await form.trigger(['registrationEnabled', 'registrationRequiredToJoin', 'capacityLimit']);
    } else if (currentStep === 2) {
      isValid = await form.trigger(['heroTitle', 'heroDescription', 'heroTagline', 'heroCtaLabel', 'heroImageUrl']);
    }
    
    if (isValid && currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (isLoadingEntities) {
    return (
 <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 space-y-8 bg-muted/5">
 <Card className="max-w-3xl mx-auto shadow-sm border-none ring-1 ring-border rounded-2xl">
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
 <div className="max-w-5xl mx-auto space-y-8 text-left">
        
        {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
 <h1 className="text-3xl font-semibold tracking-tight text-foreground leading-none mb-1 text-left">Create Session</h1>
 <p className="text-[10px] font-bold text-muted-foreground text-left">Meeting & Webinar Configuration</p>
            </div>
 <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground bg-background px-3 py-1 rounded-full border shadow-sm w-fit">
 <Settings2 className="h-3 w-3" />
                Wizard Mode
            </div>
        </div>

        {/* Step Indicator */}
 <div className="flex items-center gap-2 p-2 bg-background rounded-2xl border shadow-sm overflow-x-auto">
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
                    "flex-1 flex items-center gap-3 p-3 rounded-xl transition-all duration-300 text-left min-w-[140px]",
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
 <div className="hidden lg:block min-w-0">
 <p className="text-[10px] font-semibold truncate">
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
                {/* Copied existing Step 1 structure */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 <div className="lg:col-span-2 space-y-8">
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl"><Calendar className="h-5 w-5 text-primary" /></div>
                                    <div>
 <CardTitle className="text-lg font-semibold tracking-tight">Session Configuration</CardTitle>
 <CardDescription className="text-xs font-medium text-left">Core institutional setup and timing.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
 <CardContent className="p-6 space-y-8 bg-background">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="entity"
                                    render={({ field }) => (
                                    <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Context {singular}</FormLabel>
                                        <Select
                                            onValueChange={(entityId: string) => {
                                                const entity = entities?.find((s) => s.id === entityId);
                                                field.onChange(entity);
                                                if (entity && !form.getValues('entitySlug')) {
                                                    form.setValue('entitySlug', entity.slug, { shouldValidate: true });
                                                }
                                            }}
                                            value={field.value?.id || ""}
                                        >
                                            <FormControl>
 <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all">
                                                    <SelectValue placeholder={`Select ${singular.toLowerCase()}...`} />
                                                </SelectTrigger>
                                            </FormControl>
 <SelectContent className="rounded-xl">
                                                {entities?.map((entity) => (
                                                    <SelectItem key={entity.id} value={entity.id}>{entity.displayName}</SelectItem>
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
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Session Category</FormLabel>
                                        <Select
                                            onValueChange={(typeId: string) => field.onChange(MEETING_TYPES.find(t => t.id === typeId))}
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
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Scheduled Time</FormLabel>
                                        <FormControl>
                                            <DateTimePicker value={field.value} onChange={field.onChange} disabled={form.formState.isSubmitting} />
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
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Meeting URL (e.g. Google Meet)</FormLabel>
                                        <FormControl>
 <div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-muted/20 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-inner">
 <div className="bg-muted px-3 flex items-center text-[10px] font-semibold tracking-tighter text-muted-foreground/60 border-r"><Video className="h-3 w-3" /></div>
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
                                name="entitySlug"
                                render={({ field }) => (
                                    <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">URL Path Context</FormLabel>
 <div className="flex flex-col sm:flex-row group transition-all">
 <div className="flex h-12 items-center bg-muted border border-border border-r-0 rounded-t-xl sm:rounded-l-xl sm:rounded-tr-none px-4 text-[10px] font-semibold tracking-tighter text-muted-foreground/60 shrink-0">
                                                /meetings/{watchedType?.slug || 'parent-engagement'}/
                                            </div>
                                            <FormControl>
                                                <Input 
                                                    {...field} 
                                                    placeholder="e.g. school-name" 
 className="h-12 rounded-t-none sm:rounded-l-none rounded-b-xl sm:rounded-r-xl bg-white border-2 border-slate-200 focus:border-primary focus-visible:ring-0 shadow-none font-bold text-lg px-4 transition-all" 
                                                />
                                            </FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Preview Sidebar */}
 <div className="space-y-6">
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-primary/5 sticky top-24">
 <CardHeader className="bg-primary/10 border-b pb-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20"><Globe className="h-5 w-5" /></div>
 <CardTitle className="text-sm font-semibold tracking-tight ">Public URL</CardTitle>
                                </div>
                            </CardHeader>
 <CardContent className="p-4">
 <div className="p-3 bg-background rounded-xl border font-mono text-xs break-all text-muted-foreground">
                                    /meetings/{watchedType?.slug || '...'}/{watchedSlug || '...'}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* ──────── STEP 2: Registration ──────── */}
 <div className={cn(currentStep !== 1 && "hidden")}>
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 <div className="lg:col-span-2 space-y-8">
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-amber-500/10 rounded-xl"><ClipboardCheck className="h-5 w-5 text-amber-600" /></div>
                                        <div>
 <CardTitle className="text-lg font-semibold tracking-tight">Registration Engine</CardTitle>
 <CardDescription className="text-xs font-medium text-left">Control how attendees sign up and reserve a spot.</CardDescription>
                                        </div>
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="registrationEnabled"
                                        render={({ field }) => (
 <FormItem className="flex items-center gap-2 space-y-0 text-left">
 <Label htmlFor="reg-enable" className="text-[10px] font-semibold text-muted-foreground">Enable Registration</Label>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} id="reg-enable" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </CardHeader>

                            {registrationEnabled ? (
 <CardContent className="p-6 space-y-8 bg-background animate-in fade-in slide-in-from-top-2">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20 p-4 rounded-xl border">
                                        <FormField
                                            control={form.control}
                                            name="registrationRequiredToJoin"
                                            render={({ field }) => (
 <FormItem className="flex flex-row items-start space-x-3 space-y-0 text-left">
                                                    <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                    </FormControl>
 <div className="space-y-1 leading-none">
 <FormLabel className="font-bold">Require Registration to Join</FormLabel>
 <FormDescription className="text-xs">If off, attendees can bypass registration via the original join form.</FormDescription>
                                                    </div>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="registrationMode"
                                            render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Approval Mode</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
 <SelectTrigger className="h-10 rounded-xl bg-white focus:ring-1 focus:ring-primary/20">
                                                            <SelectValue placeholder="Approval mode..." />
                                                        </SelectTrigger>
                                                    </FormControl>
 <SelectContent className="rounded-xl">
                                                        <SelectItem value="open">Open (Auto-Approve)</SelectItem>
                                                        <SelectItem value="approval_required">Manual Approval Required</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                            )}
                                        />
                                    </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="capacityLimit"
                                            render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Capacity Limit (0 for unlimited)</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        min={0}
                                                        onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                                                        value={field.value || 0}
 className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold tabular-nums" 
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="waitlistEnabled"
                                            render={({ field }) => (
 <FormItem className="flex flex-row items-center justify-between p-3 h-11 bg-muted/20 rounded-xl mt-6">
 <div className="space-y-0.5 text-left">
 <FormLabel className="text-xs font-bold">Enable Waitlist</FormLabel>
                                                    </div>
                                                    <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>

 <Separator className="bg-border/50" />

                                    <FormField
                                        control={form.control}
                                        name="registrationFields"
                                        render={({ field }) => (
 <FormItem className="text-left">
                                                <FormControl>
                                                    <RegistrationFieldBuilder value={field.value} onChange={field.onChange} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

 <Separator className="bg-border/50" />

                                    <FormField
                                        control={form.control}
                                        name="registrationSuccessMessage"
                                        render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Confirmation Message</FormLabel>
                                                <FormControl>
                                                    <Textarea 
                                                        {...field} 
                                                        placeholder="Message shown after successful registration..."
                                                        rows={2}
 className="rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 resize-none font-medium text-sm"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            ) : (
 <CardContent className="p-12 flex flex-col items-center justify-center text-center opacity-40">
 <ClipboardCheck className="h-12 w-12 mb-4" />
 <p className="text-sm font-bold ">Registration Disabled</p>
 <p className="text-xs font-medium">Attendees will enter directly without signing up prior.</p>
                                </CardContent>
                            )}
                        </Card>
                    </div>
                </div>
            </div>

            {/* ──────── STEP 3: Hero Content ──────── */}
 <div className={cn(currentStep !== 2 && "hidden")}>
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 <div className="lg:col-span-2 space-y-8">
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-violet-500/10 rounded-xl"><Type className="h-5 w-5 text-violet-600" /></div>
                                    <div>
 <CardTitle className="text-lg font-semibold tracking-tight">Hero Content</CardTitle>
 <CardDescription className="text-xs font-medium text-left">Customize the public-facing messaging shown on the meeting page.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
 <CardContent className="p-6 space-y-8 bg-background">
                                <FormField
                                    control={form.control}
                                    name="heroTitle"
                                    render={({ field }) => (
                                        <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Hero Title</FormLabel>
                                            <FormControl>
 <Input {...field} placeholder="e.g. Join Our Transformation Journey" className="h-14 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-lg" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="heroDescription"
                                    render={({ field }) => (
                                        <FormItem>
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Hero Description</FormLabel>
                                            <FormControl>
 <Textarea {...field} placeholder="Supporting text..." rows={4} className="rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-medium resize-none" />
                                            </FormControl>
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
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Tagline</FormLabel>
                                                <FormControl>
 <Input {...field} placeholder="e.g. Free for all parents" className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20" />
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
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">{registrationEnabled ? 'Register Button Label' : 'CTA Button Label'}</FormLabel>
                                                <FormControl>
 <Input {...field} placeholder={registrationEnabled ? 'Register Now' : 'Join Session'} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20" />
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
 <FormLabel className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5" /> Hero Spotlight Media</FormLabel>
                                            <FormControl>
 <MediaSelect value={field.value} onValueChange={field.onChange} className="rounded-2xl" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </div>

 <div className="space-y-6">
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden sticky top-24">
 <CardHeader className="bg-muted/30 border-b pb-4">
 <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Live Preview</CardTitle>
                            </CardHeader>
 <CardContent className="p-4 space-y-3">
 <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">
                                    {watchedType?.name || 'Meeting'}
                                </div>
 <h3 className="text-lg font-semibold tracking-tight leading-tight">
                                    {form.watch('heroTitle') || 'Hero Title Will Appear Here'}
                                </h3>
 <p className="text-xs text-muted-foreground font-medium leading-relaxed line-clamp-4">
                                    {form.watch('heroDescription') || 'Hero description text will appear here...'}
                                </p>
 {form.watch('heroTagline') && <p className="text-[10px] font-bold text-primary tracking-wider">{form.watch('heroTagline')}</p>}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* ──────── STEP 4: Options ──────── */}
 <div className={cn(currentStep !== 3 && "hidden")}>
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 <div className="lg:col-span-2 space-y-8">
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-xl"><Settings2 className="h-5 w-5 text-primary" /></div>
                                    <div>
 <CardTitle className="text-lg font-semibold tracking-tight">Advanced Options</CardTitle>
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
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Video Recording (YouTube)</FormLabel>
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
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Public Brochure</FormLabel>
                                                <FormControl>
 <BrochureSelect value={field.value} onValueChange={field.onChange} className="rounded-xl border-none shadow-none bg-muted/20" />
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
 <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="w-full h-16 rounded-2xl font-semibold text-xl shadow-2xl shadow-primary/20 gap-3 transition-all active:scale-95 ">
 {form.formState.isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                                Launch Session
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ──────── Wizard Navigation ──────── */}
 <div className="flex items-center justify-between pt-4 border-t">
 <Button type="button" variant="outline" onClick={handlePrev} disabled={currentStep === 0} className="rounded-xl font-bold gap-2 h-12 px-6">
 <ChevronLeft className="h-4 w-4" /> Previous
              </Button>

 <div className="hidden sm:flex items-center gap-1.5">
                {WIZARD_STEPS.map((_, index) => (
 <div key={index} className={cn("h-1.5 rounded-full transition-all duration-300", index === currentStep ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/20")} />
                ))}
              </div>

              {currentStep < WIZARD_STEPS.length - 1 ? (
 <Button type="button" onClick={handleNext} className="rounded-xl font-bold gap-2 h-12 px-6">
 Next Step <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
 <Button type="submit" disabled={form.formState.isSubmitting} className="rounded-xl font-bold gap-2 h-12 px-6 shadow-lg">
 {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Launch Session
                </Button>
              )}
            </div>

          </form>
        </FormProvider>
      </div>
    </div>
  )
}
