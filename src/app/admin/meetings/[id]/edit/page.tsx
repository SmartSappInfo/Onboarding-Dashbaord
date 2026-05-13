'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { collection, doc, updateDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { useTerminology } from '@/hooks/use-terminology';
import { 
    Loader2, 
    Save, 
    Settings2, 
    Globe, 
    Calendar,
    Building, 
    Video,
    Eye,
    EyeOff,
    ExternalLink,
    ImageIcon,
    ChevronRight,
    ChevronLeft,
    Check,
    Type,
    Sparkles,
    Palette,
    LayoutTemplate,
    Bell,
    ClipboardCheck,
    Clock,
    MessageSquare,
    Zap,
    Rocket,
    Copy,
    QrCode,
    Link2,
    Users
} from 'lucide-react';

import type { WorkspaceEntity, Meeting, MeetingType, MeetingRegistrationField } from '@/lib/types';
import { MEETING_TYPES, REMINDER_OFFSETS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
  Form,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { BrochureSelect } from '../../components/brochure-select';
import { logActivity } from '@/lib/activity-logger';
import { Separator } from '@/components/ui/separator';
import InternalNotificationConfig from '@/app/admin/components/internal-notification-config';
import { triggerInternalNotification } from '@/lib/notification-engine';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { format } from 'date-fns';
import { MediaSelect } from '../../../entities/components/media-select';
import { getMeetingHeroDefaults } from '@/lib/meeting-hero-defaults';
import { getDefaultRegistrationFields } from '@/lib/meeting-tokens';
import RegistrationFieldBuilder from '../../components/registration-field-builder';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { scheduleRemindersForMeeting, rescheduleRemindersForMeeting, scheduleMessagingConfigReminders, scheduleFacilitatorAlerts } from '@/lib/reminder-actions';
import { scheduleMeetingPostEvent, cancelMeetingPostEvent } from '@/app/actions/meeting-post-event-action';
import { Checkbox } from '@/components/ui/checkbox';
import MeetingLeadCaptureSection from '../../components/MeetingLeadCaptureSection';
import MeetingMessagingTab from '../../components/MeetingMessagingTab';
import { MeetingFacilitatorsSection } from '../../components/MeetingFacilitatorsSection';

const formSchema = z.object({
  entity: z.custom<WorkspaceEntity>().optional().nullable(),
  meetingSlug: z.string()
    .min(3, 'Slug must be at least 3 characters.')
    .regex(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens.'}),
  meetingTime: z.date({
    required_error: "A meeting time is required.",
  }),
  type: z.custom<MeetingType>().refine(value => !!value, { message: "Meeting type is required." }),
  meetingLink: z.string().url({ message: 'Please enter a valid Google Meet URL.' }),
  
  // V3: Branding controls
  logoUrl: z.string().url().optional().or(z.literal('')),
  brandingName: z.string().optional().or(z.literal('')),
  brandingSlogan: z.string().optional().or(z.literal('')),
  brandingEnabled: z.boolean().default(true),
  heroLayout: z.enum(['image', 'form']).default('image'),

  // V3: Banner controls
  bannerType: z.enum(['none', 'image', 'embed']).default('none'),
  bannerImageUrl: z.string().url().optional().or(z.literal('')),
  bannerEmbedCode: z.string().optional().or(z.literal('')),

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
  
  // Reminders (Task 12.1)
  enabledReminders: z.array(z.string()).default([]),

  // Lead Capture (Phase 4)
  createEntity: z.boolean().default(false),
  entityMapping: z.object({
    nameField: z.string().default(''),
    primaryContactField: z.string().optional().default(''),
    emailField: z.string().optional().default(''),
    phoneField: z.string().optional().default(''),
    additionalMappings: z.array(z.object({
      sourceField: z.string(),
      targetProperty: z.string(),
    })).default([]),
  }).default({}),
  autoTags: z.array(z.string()).default([]),
  
  facilitators: z.array(z.object({
    id: z.string(),
    type: z.enum(['workspace_user', 'custom']),
    userId: z.string().optional(),
    name: z.string(),
    role: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    image: z.string().optional(),
    joinLink: z.string()
  })).default([]),

  // Messaging Config (Phase 5)
  messagingConfig: z.any().optional(),

  // Publish Status (Phase 7)
  publishStatus: z.enum(['draft', 'published', 'archived']).default('draft'),
}).refine((data) => {
  if (data.brandingEnabled && !data.entity) {
    return !!data.logoUrl && !!data.brandingName && !!data.brandingSlogan;
  }
  return true;
}, {
  message: "Logo, Name, and Slogan are required for standalone branding.",
  path: ["brandingEnabled"]
});

type FormData = z.infer<typeof formSchema>;

const WIZARD_STEPS = [
  { id: 'config', label: 'Configuration', icon: Calendar, description: 'Setup & timing' },
  { id: 'branding', label: 'Branding', icon: Palette, description: 'Theme, hero & preview' },
  { id: 'registration', label: 'Registration', icon: ClipboardCheck, description: 'Signup, capacity & leads' },
  { id: 'messaging', label: 'Messaging', icon: MessageSquare, description: 'Automated comms' },
  { id: 'publish', label: 'Publish', icon: Rocket, description: 'Go live' },
] as const;

const stepIndex = (id: string) => WIZARD_STEPS.findIndex(s => s.id === id);

export default function EditMeetingPage() {
  const params = useParams();
  const meetingId = params.id as string;
  const pathname = usePathname();
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { activeOrganizationId } = useTenant();

  const [hasInitialized, setHasInitialized] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);
  const [lastStepChangeTime, setLastStepChangeTime] = React.useState(0);

  const meetingDocRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return doc(firestore, 'meetings', meetingId);
  }, [firestore, meetingId]);
  
  const { data: meeting, isLoading: isLoadingMeeting } = useDoc<Meeting>(meetingDocRef);
  const { singular } = useTerminology();
  
  useSetBreadcrumb(meeting?.entityName, `/admin/meetings/${meetingId}`);

  const entitiesCol = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'workspace_entities'), where('workspaceId', '==', activeWorkspaceId), orderBy('displayName', 'asc'));
  }, [firestore, activeWorkspaceId]);
  
  const { data: entities, isLoading: isLoadingEntities } = useCollection<WorkspaceEntity>(entitiesCol);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entity: null,
      meetingSlug: '',
      meetingTime: undefined,
      type: undefined,
      meetingLink: '',
      logoUrl: '',
      brandingName: '',
      brandingSlogan: '',
      brandingEnabled: true,
      heroLayout: 'image',
      bannerType: 'none',
      bannerImageUrl: '',
      bannerEmbedCode: '',
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
      enabledReminders: [],
    },
  });

  const { setValue, watch } = form;
  const watchedType = form.watch('type');
  const watchedEntity = form.watch('entity');
  const watchedSlug = form.watch('meetingSlug');
  const registrationEnabled = form.watch('registrationEnabled');
  const watchedBrandingEnabled = form.watch('brandingEnabled');

  // V3: Automatically toggle branding based on entity selection
  React.useEffect(() => {
    // If watchedEntity is strictly undefined, it means we're still loading the initial document.
    // Don't auto-set branding until the document has loaded and we have a definitive entity state.
    // Also skip if we've already initialized (respect document value)
    if (watchedEntity === undefined || hasInitialized) return;
    
    if (!watchedEntity) {
      form.setValue('brandingEnabled', false);
    } else {
      form.setValue('brandingEnabled', true);
    }
  }, [watchedEntity?.id, hasInitialized]);

  React.useEffect(() => {
    if (meeting && entities && !hasInitialized) {
      const selectedEntity = entities.find(s => s.entityId === meeting.entityId);
      const selectedType = MEETING_TYPES.find(t => t.id === meeting.type?.id) || 
                          MEETING_TYPES.find(t => t.slug === (meeting.type as any)?.slug) ||
                          MEETING_TYPES.find(t => t.id === (meeting as any).type) ||
                          MEETING_TYPES[0];

      form.reset({
        entity: selectedEntity || null,
        meetingSlug: meeting.meetingSlug || meeting.entitySlug || '',
        meetingTime: meeting.meetingTime ? new Date(meeting.meetingTime) : new Date(),
        type: selectedType,
        meetingLink: meeting.meetingLink || '',
        
        // V3 Branding
        logoUrl: meeting.logoUrl || '',
        brandingName: meeting.brandingName || '',
        brandingSlogan: meeting.brandingSlogan || '',
        brandingEnabled: meeting.brandingEnabled ?? !!selectedEntity,
        heroLayout: meeting.heroLayout || 'image',

        // V3 Banners
        bannerType: meeting.bannerType || 'none',
        bannerImageUrl: meeting.bannerImageUrl || '',
        bannerEmbedCode: meeting.bannerEmbedCode || '',

        registrationEnabled: meeting.registrationEnabled || false,
        registrationRequiredToJoin: meeting.registrationRequiredToJoin || false,
        registrationMode: meeting.registrationMode || 'open',
        registrationFields: meeting.registrationFields || getDefaultRegistrationFields(),
        registrationSuccessMessage: meeting.registrationSuccessMessage || 'You have successfully registered for this session.',
        capacityLimit: meeting.capacityLimit || 0,
        waitlistEnabled: meeting.waitlistEnabled || false,
        heroImageUrl: meeting.heroImageUrl || '',
        heroTitle: meeting.heroTitle || '',
        heroDescription: meeting.heroDescription || '',
        heroTagline: meeting.heroTagline || '',
        heroCtaLabel: meeting.heroCtaLabel || '',
        recordingUrl: meeting.recordingUrl || '',
        brochureUrl: meeting.brochureUrl || '',
      });
      setHasInitialized(true);
    }
  }, [meeting, entities, form, hasInitialized]);

  const onSubmit = async (data: FormData) => {
    if (!firestore || !meetingId || !user) return;
    
    // Prevent accidental submit immediately after step transition (fixes click bubbling)
    if (Date.now() - lastStepChangeTime < 100) return;
    
    
    try {
        const meetingsRef = collection(firestore, 'meetings');
        const q = query(meetingsRef, where('type.slug', '==', data.type.slug), where('meetingSlug', '==', data.meetingSlug));
        const querySnapshot = await getDocs(q);
        
        const isDuplicate = querySnapshot.docs.some(doc => doc.id !== meetingId);
        
        if (isDuplicate) {
            form.setError('meetingSlug', { type: 'manual', message: 'This slug is already in use for this meeting type.' });
            toast({ variant: 'destructive', title: 'Slug already exists', description: 'Please choose a unique URL backhalf.' });
            setCurrentStep(0);
            return;
        }

        const meetingData = {
            entityId: data.entity?.entityId || '', 
            entityName: data.entity?.displayName || data.brandingName || data.heroTitle || 'Standalone Session',
            entitySlug: data.meetingSlug,
            meetingSlug: data.meetingSlug,
            entityType: data.entity?.entityType || 'institution',
            workspaceIds: [activeWorkspaceId],
            meetingTime: data.meetingTime.toISOString(),
            meetingLink: data.meetingLink,
            type: data.type,
            
            // V3 Branding
            logoUrl: data.logoUrl || '',
            brandingName: data.brandingName || '',
            brandingSlogan: data.brandingSlogan || '',
            brandingEnabled: data.brandingEnabled,
            heroLayout: data.heroLayout,

            // V3 Banners
            bannerType: data.bannerType,
            bannerImageUrl: data.bannerImageUrl || '',
            bannerEmbedCode: data.bannerEmbedCode || '',

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
            
            // Phase 4: Lead Capture
            createEntity: data.createEntity || false,
            entityMapping: data.entityMapping || {},
            autoTags: data.autoTags || [],
            facilitators: data.facilitators || [],

            // Phase 5: Messaging Config
            messagingConfig: data.messagingConfig || null,

            // Phase 7: Publish Status
            publishStatus: data.publishStatus || 'draft',
        };

        // Clean up legacy properties by removing them from payload if present
        delete (meetingData as any).adminAlertsEnabled;
        delete (meetingData as any).adminAlertChannel;
        delete (meetingData as any).adminAlertNotifyManager;
        delete (meetingData as any).adminAlertSpecificUserIds;
        delete (meetingData as any).adminAlertEmailTemplateId;
        delete (meetingData as any).adminAlertSmsTemplateId;
        delete (meetingData as any).enabledReminders;

        const docRef = doc(firestore, 'meetings', meetingId);
        
        await updateDoc(docRef, meetingData);
        toast({ title: 'Meeting Updated', description: `Session for ${data.entity?.displayName || data.heroTitle || 'Standalone Session'} saved.` });
        
        logActivity({
            organizationId: activeOrganizationId,
            entityId: data.entity?.entityId || '',
            entityType: data.entity?.entityType || 'institution',
            userId: user.uid,
            workspaceId: activeWorkspaceId,
            type: 'entity_updated',
            source: 'user_action',
            description: `updated the ${data.type.name} session for "${data.entity?.displayName || data.heroTitle || 'Standalone Session'}".`,
            metadata: { meetingId }
        }).catch(err => console.warn("Activity log deferred:", err.message));

        // Task 12.3: Reschedule reminders if meeting time changed
        const timeChanged = meeting?.meetingTime !== data.meetingTime.toISOString();
        if (timeChanged) {
            rescheduleRemindersForMeeting(
                { id: meetingId, ...meetingData } as any,
                activeOrganizationId
            ).catch(err => console.warn("Reminder rescheduling deferred:", err.message));
        }

        // Phase 8: Schedule messaging config reminders if present
        if (data.messagingConfig?.reminders?.length > 0) {
            // Cancel existing messaging slot reminders first
            cancelMeetingPostEvent(meetingId).catch(err => console.warn('Post-event cancel deferred:', err.message));
            
            scheduleMessagingConfigReminders(
                { id: meetingId, ...meetingData } as any,
                activeOrganizationId
            ).catch(err => console.warn('Messaging reminders deferred:', err.message));
        }

        // Phase 8: Schedule facilitator pre-event alerts
        if (data.messagingConfig?.facilitatorUserIds?.length > 0) {
            scheduleFacilitatorAlerts(
                { id: meetingId, ...meetingData } as any,
                activeOrganizationId,
                'pre_event'
            ).catch(err => console.warn('Facilitator alerts deferred:', err.message));
        }

        // Phase 8: Schedule post-event follow-up
        if (data.messagingConfig?.postEventEnabled) {
            scheduleMeetingPostEvent(
                { id: meetingId, ...meetingData } as any,
                activeOrganizationId
            ).catch(err => console.warn('Post-event scheduling deferred:', err.message));
        }

        router.push(`/admin/meetings/${meetingId}`);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Update failed', description: error.message });
    }
  };

  const publicUrl = watchedType && watchedSlug ? `/meetings/${watchedType.slug}/${watchedSlug}` : null;

  const handleNext = async () => {
    let isValid = false;
    
    if (currentStep === stepIndex('config')) {
      isValid = await form.trigger(['entity', 'meetingSlug', 'meetingTime', 'type', 'meetingLink']);
    } else if (currentStep === stepIndex('branding')) {
      isValid = await form.trigger(['brandingEnabled', 'logoUrl', 'brandingName', 'brandingSlogan', 'heroLayout', 'bannerType', 'heroTitle', 'heroDescription', 'heroTagline', 'heroCtaLabel', 'heroImageUrl']);
    } else if (currentStep === stepIndex('registration')) {
      isValid = await form.trigger(['registrationEnabled', 'registrationRequiredToJoin', 'capacityLimit']);
    } else {
      // messaging, automations, publish — no required validation
      isValid = true;
    }
    
    if (isValid && currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
      setLastStepChangeTime(Date.now());
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setLastStepChangeTime(Date.now());
    }
  };

  if (isLoadingMeeting || isLoadingEntities || !hasInitialized) {
    return (
 <div className="h-full overflow-y-auto  space-y-8 bg-background">
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
 <div className="h-full flex flex-col items-center">
 <div className="w-full max-w-5xl px-4 sm:px-6 md:px-8 py-8 space-y-8 flex-1 text-left">
        
        {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
 <h1 className="text-3xl font-semibold tracking-tight text-foreground leading-none mb-1 text-left">Edit Session</h1>
 <p className="text-[10px] font-bold text-muted-foreground text-left">Meeting & Webinar Configuration</p>
            </div>
 <div className="flex items-center gap-3">
                {publicUrl && (
 <Button asChild variant="outline" size="sm" className="h-9 px-4 rounded-full font-bold gap-2 text-[10px] bg-background">
                        <Link href={publicUrl} target="_blank">
 <ExternalLink className="h-3.5 w-3.5" /> View Public Page
                        </Link>
                    </Button>
                )}
 <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground bg-background px-3 py-1 rounded-full border shadow-sm w-fit">
 <Settings2 className="h-3 w-3" /> Wizard Mode
                </div>
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
                    !isActive && !isCompleted && "hover:bg-background0 opacity-60"
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
 <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-12">

            {/* ──────── STEP 1: Configuration ──────── */}
 <div className={cn(currentStep !== stepIndex('config') && "hidden")}>
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
                                                if (entityId === 'no_entity') {
                                                    field.onChange(null);
                                                    return;
                                                }
                                                const entity = entities?.find((s) => s.id === entityId);
                                                field.onChange(entity);
                                                if (entity && !form.getValues('meetingSlug')) {
                                                    form.setValue('meetingSlug', entity.slug || '', { shouldValidate: true });
                                                }
                                            }}
                                            value={field.value?.id || "no_entity"}
                                        >
                                            <FormControl>
 <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all">
                                                    <SelectValue placeholder={`Select ${singular.toLowerCase()}...`} />
                                                </SelectTrigger>
                                            </FormControl>
 <SelectContent className="rounded-xl">
                                                <SelectItem value="no_entity">No Entity Context Binding</SelectItem>
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
                                name="meetingSlug"
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
 className="h-12 rounded-t-none sm:rounded-l-none rounded-b-xl sm:rounded-r-xl bg-card border-2 border-slate-200 focus:border-primary focus-visible:ring-0 shadow-none font-bold text-lg px-4 transition-all" 
                                                />
                                            </FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <Separator className="bg-border/50" />
                            
                            <MeetingFacilitatorsSection />
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

                {/* ──────── STEP 2: Branding (V3) ──────── */}
                <div className={cn(currentStep !== stepIndex('branding') && "hidden")}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="lg:col-span-2 space-y-8">
                            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                                <CardHeader className="bg-muted/30 border-b pb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-xl"><Palette className="h-5 w-5 text-primary" /></div>
                                        <div>
                                            <CardTitle className="text-lg font-semibold tracking-tight">Branding & Layout</CardTitle>
                                            <CardDescription className="text-xs font-medium text-left">Control logo, entity branding visibility, and hero layout mode.</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-8 bg-background">
                                    {/* Logo Override */}
                                    <FormField
                                        control={form.control}
                                        name="logoUrl"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5" /> Meeting Logo</FormLabel>
                                                <FormDescription className="text-xs text-muted-foreground">Upload a logo specific to this meeting. If empty, uses the linked entity&apos;s logo (if any).</FormDescription>
                                                <FormControl>
                                                    <MediaSelect value={field.value} onValueChange={field.onChange} className="rounded-2xl" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <Separator className="bg-border/50" />

                                    {/* Branding Toggle */}
                                    <FormField
                                        control={form.control}
                                        name="brandingEnabled"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between p-4 bg-muted/20 rounded-xl border">
                                                <div className="space-y-1 text-left">
                                                    <FormLabel className="font-bold flex items-center gap-2">
                                                        {field.value ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                                                        Show Branding
                                                    </FormLabel>
                                                    <FormDescription className="text-xs">When enabled, the meeting logo, entity name, and slogan are shown on the public page.</FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {watchedBrandingEnabled && !watchedEntity && (
                                        <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <FormField
                                                    control={form.control}
                                                    name="brandingName"
                                                    render={({ field }) => (
                                                        <FormItem className="text-left">
                                                            <FormLabel className="text-[10px] font-semibold text-primary ml-1">Branding Name</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} placeholder="e.g. My Organization" className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="brandingSlogan"
                                                    render={({ field }) => (
                                                        <FormItem className="text-left">
                                                            <FormLabel className="text-[10px] font-semibold text-primary ml-1">Branding Slogan</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} placeholder="e.g. Excellence in Education" className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <p className="text-[10px] italic text-amber-600 font-medium text-left">
                                                Since no entity is selected, manual branding details are required.
                                            </p>
                                        </div>
                                    )}

                                    <Separator className="bg-border/50" />

                                    {/* Hero Layout Mode */}
                                    <FormField
                                        control={form.control}
                                        name="heroLayout"
                                        render={({ field }) => (
                                            <FormItem className="text-left">
                                                <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 flex items-center gap-2"><LayoutTemplate className="h-3.5 w-3.5" /> Form Placement</FormLabel>
                                                <FormDescription className="text-xs text-left">Decide where the registration or join form appears.</FormDescription>
                                                <div className="grid grid-cols-2 gap-4 mt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => field.onChange('image')}
                                                        className={cn(
                                                            "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 text-center cursor-pointer",
                                                            field.value === 'image'
                                                                ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm"
                                                                : "border-border hover:border-primary/30"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            <Type className="h-5 w-5 text-muted-foreground" />
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                                                            <ClipboardCheck className="h-5 w-5 text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold">Below Titles</p>
                                                            <p className="text-[10px] text-muted-foreground">Form follows the text</p>
                                                        </div>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => field.onChange('form')}
                                                        className={cn(
                                                            "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 text-center cursor-pointer",
                                                            field.value === 'form'
                                                                ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm"
                                                                : "border-border hover:border-primary/30"
                                                        )}
                                                    >
                                                        <ClipboardCheck className={cn("h-8 w-8", field.value === 'form' ? "text-primary" : "text-muted-foreground")} />
                                                        <div>
                                                            <p className="text-sm font-bold">Right Panel</p>
                                                            <p className="text-[10px] text-muted-foreground">Replaces hero image</p>
                                                        </div>
                                                    </button>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <Separator className="bg-border/50" />

                                    {/* V3: Banner Configuration */}
                                    <div className="space-y-6">
                                        <FormField
                                            control={form.control}
                                            name="bannerType"
                                            render={({ field }) => (
                                                <FormItem className="text-left">
                                                    <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Top Banner</FormLabel>
                                                    <FormDescription className="text-xs">Add a custom banner image or HTML embed at the top of the page.</FormDescription>
                                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                                        {['none', 'image', 'embed'].map((type) => (
                                                            <button
                                                                key={type}
                                                                type="button"
                                                                onClick={() => field.onChange(type)}
                                                                className={cn(
                                                                    "h-10 rounded-xl border transition-all text-xs font-bold capitalize",
                                                                    field.value === type 
                                                                        ? "bg-primary text-primary-foreground border-primary shadow-md" 
                                                                        : "bg-muted/20 border-border hover:bg-muted/40"
                                                                )}
                                                            >
                                                                {type}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </FormItem>
                                            )}
                                        />

                                        {form.watch('bannerType') === 'image' && (
                                            <div className="space-y-2 p-4 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-top-2">
                                                <FormField
                                                    control={form.control}
                                                    name="bannerImageUrl"
                                                    render={({ field }) => (
                                                        <FormItem className="text-left">
                                                            <FormLabel className="text-[10px] font-bold text-primary">Banner Image (820x360)</FormLabel>
                                                            <FormControl>
                                                                <MediaSelect value={field.value} onValueChange={field.onChange} className="rounded-xl h-24" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}

                                        {form.watch('bannerType') === 'embed' && (
                                            <div className="space-y-2 p-4 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-top-2">
                                                <FormField
                                                    control={form.control}
                                                    name="bannerEmbedCode"
                                                    render={({ field }) => (
                                                        <FormItem className="text-left">
                                                            <FormLabel className="text-[10px] font-bold text-primary">HTML Embed Code</FormLabel>
                                                            <FormControl>
                                                                <Textarea 
                                                                    {...field} 
                                                                    placeholder="<iframe ...></iframe>" 
                                                                    className="min-h-[100px] bg-background border-none ring-1 ring-border focus-visible:ring-primary/40 font-mono text-[10px]" 
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Hero Content Card (merged from old Step 4) */}
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

                        {/* Live Preview (Right Column) */}
                        <div className="space-y-6">
                            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden sticky top-24">
                                <CardHeader className="bg-muted/30 border-b pb-4">
                                    <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Live Preview</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3">
                                    {form.watch('logoUrl') && (
                                        <div className="w-10 h-10 rounded-lg bg-muted/30 overflow-hidden">
                                            <img src={form.watch('logoUrl')} alt="Logo" className="w-full h-full object-contain" />
                                        </div>
                                    )}
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
                                    {form.watch('heroImageUrl') && (
                                        <div className="rounded-xl overflow-hidden border bg-muted/20 mt-2">
                                            <img src={form.watch('heroImageUrl')} alt="Hero" className="w-full h-32 object-cover" />
                                        </div>
                                    )}
                                    <div className="pt-2">
                                        <div className="h-9 rounded-lg bg-primary/80 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-white">{form.watch('heroCtaLabel') || (registrationEnabled ? 'Register Now' : 'Join Session')}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
            </div>

            {/* ──────── STEP 3: Registration ──────── */}
                <div className={cn(currentStep !== stepIndex('registration') && "hidden")}>
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
 <SelectTrigger className="h-10 rounded-xl bg-card focus:ring-1 focus:ring-primary/20">
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

                                    <Separator className="bg-border/50" />

                                    {/* Lead Capture Section */}
                                    <MeetingLeadCaptureSection registrationFields={form.watch('registrationFields') || []} />
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

            {/* ──────── STEP 4: Messaging ──────── */}
                <div className={cn(currentStep !== stepIndex('messaging') && "hidden")}>
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <MeetingMessagingTab />
                    </div>
                </div>



            {/* ──────── STEP 6: Publish ──────── */}
                <div className={cn(currentStep !== stepIndex('publish') && "hidden")}>
                    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* ── Assets Card: Recording & Brochure ── */}
                        <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                            <CardHeader className="bg-muted/30 border-b pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-xl"><Video className="h-4 w-4 text-blue-600" /></div>
                                    <div>
                                        <CardTitle className="text-sm font-semibold tracking-tight">Meeting Assets</CardTitle>
                                        <CardDescription className="text-[10px] font-medium text-left">Attach recording and brochure for attendees.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4 bg-background">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                        {/* ── Publish Card ── */}
                        <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                            <CardHeader className="bg-muted/30 border-b pb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 rounded-xl"><Rocket className="h-5 w-5 text-emerald-600" /></div>
                                    <div>
                                        <CardTitle className="text-lg font-semibold tracking-tight">Publish Your Meeting</CardTitle>
                                        <CardDescription className="text-xs font-medium text-left">Set the status and share your meeting with the world.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6 bg-background">
                                {/* Publish Status */}
                                <FormField
                                    control={form.control}
                                    name="publishStatus"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Meeting Status</FormLabel>
                                            <div className="grid grid-cols-3 gap-2 bg-muted/30 p-1.5 rounded-2xl border">
                                                {[
                                                    { value: 'draft', label: 'Draft', icon: '📝' },
                                                    { value: 'published', label: 'Published', icon: '🚀' },
                                                    { value: 'archived', label: 'Archived', icon: '📦' },
                                                ].map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => field.onChange(opt.value)}
                                                        className={cn(
                                                            "h-11 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5",
                                                            field.value === opt.value
                                                                ? "bg-card shadow-md text-primary"
                                                                : "text-muted-foreground opacity-60 hover:opacity-100"
                                                        )}
                                                    >
                                                        <span>{opt.icon}</span> {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Public URL Section */}
                                {publicUrl && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Link2 className="h-4 w-4 text-primary" />
                                            <h4 className="text-sm font-bold tracking-tight">Public Registration Link</h4>
                                        </div>
                                        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl border">
                                            <code className="flex-1 text-xs font-mono text-primary truncate">
                                                {typeof window !== 'undefined' ? `${window.location.origin}${publicUrl}` : publicUrl}
                                            </code>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="shrink-0 h-8 px-3 rounded-lg"
                                                onClick={() => {
                                                    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${publicUrl}` : publicUrl;
                                                    navigator.clipboard.writeText(fullUrl);
                                                    toast({ title: 'Link copied!', description: 'Public meeting link copied to clipboard.' });
                                                }}
                                            >
                                                <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="shrink-0 h-8 px-3 rounded-lg"
                                                onClick={() => window.open(publicUrl, '_blank')}
                                            >
                                                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <Separator className="bg-border/50" />

                                {/* Save Actions */}
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        size="lg"
                                        disabled={form.formState.isSubmitting}
                                        onClick={() => form.setValue('publishStatus', 'draft')}
                                        className="flex-1 h-14 rounded-xl font-bold gap-2"
                                    >
                                        {form.formState.isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                        Save as Draft
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="lg"
                                        disabled={form.formState.isSubmitting}
                                        onClick={() => form.setValue('publishStatus', 'published')}
                                        className="flex-1 h-14 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20"
                                    >
                                        {form.formState.isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
                                        Save & Publish
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
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
                    <Button key="btn-next" type="button" onClick={handleNext} className="rounded-xl font-bold gap-2 h-12 px-6">
                        Next Step <ChevronRight className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button key="btn-save" type="submit" disabled={form.formState.isSubmitting} className="rounded-xl font-bold gap-2 h-12 px-6 shadow-lg">
                        {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                        Publish & Save
                    </Button>
                )}
            </div>

          </form>
        </FormProvider>
      </div>
    </div>
  )
}

