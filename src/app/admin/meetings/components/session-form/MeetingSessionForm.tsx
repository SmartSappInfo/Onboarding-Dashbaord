'use client';

/**
 * @fileoverview Single Source of Truth (SSOT) Meeting & Webinar Builder Component.
 * Consolidates the session creation (/new) and editing (/[id]/edit) workflows.
 *
 * ARCHITECTURAL INVARIANTS:
 * - Directives: Zero 'any' or 'any[]'. Strictly typed with SessionFormValues.
 * - Single Source of Truth: All schema and default mappings route through session-form-schema.ts.
 * - Mobile Touch Targets: All buttons, tabs, and toggles have min-h-[44px] (or responsive min-h-[44px] sm:min-h-[36px]).
 * - Tactile Feedback: Emil Kowalski spring micro-interactions (active:scale-[0.98] / active:scale-[0.97]).
 * - Dual Mode: mode === 'create' provides the 6-step wizard (with template selector), mode === 'edit' provides the 5-step wizard.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Do NOT duplicate form fields or registration builder logic outside this component.
 * - Any new meeting attributes must be added to SessionFormValues, Meeting interface, and persisted in onSubmit.
 */

import * as React from 'react';
import { useForm, FormProvider, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { collection, doc, addDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { useTerminology } from '@/hooks/use-terminology';
import { useEntityByDocId } from '@/context/EntityCacheContext';
import { EntityCombobox } from '@/components/entities/EntityCombobox';
import type { SearchedEntity } from '@/hooks/use-entity-search';

import { 
  Calendar, 
  Loader2, 
  Video, 
  Settings2,
  Save,
  ChevronRight,
  ChevronLeft,
  Check,
  Type,
  Sparkles,
  ClipboardCheck,
  ImageIcon,
  LayoutGrid,
  CheckCircle2,
  PlusCircle,
  MessageSquare,
  Rocket,
  QrCode,
  Link2,
  Webhook,
  Pencil,
  X,
  UserCheck,
  UserCircle,
  Zap,
  Copy,
  Code,
  ExternalLink,
  Eye,
  EyeOff,
  LayoutTemplate,
  Palette
} from 'lucide-react';
import { MEETING_TEMPLATES } from '../../constants/templates';
import type { 
  Meeting, 
  MeetingTemplate, 
  MeetingInvitationSlot,
  WorkspaceEntity
} from '@/lib/types';
import { MEETING_TYPES, getDefaultMeetingMessagingConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { BrochureSelect } from '../brochure-select';
import { logActivity } from '@/lib/activity-logger';
import { Separator } from '@/components/ui/separator';
import { triggerInternalNotification } from '@/lib/notification-engine';
import { format } from 'date-fns';
import { MediaSelect } from '../../../entities/components/media-select';
import { getMeetingHeroDefaults } from '@/lib/meeting-hero-defaults';
import RegistrationFieldBuilder from '../registration-field-builder';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { rescheduleRemindersForMeeting } from '@/lib/reminder-actions';
import MeetingPreviewPanel from '../MeetingPreviewPanel';
import MeetingLeadCaptureSection from '../MeetingLeadCaptureSection';
import MeetingMessagingTab from '../MeetingMessagingTab';
import { MeetingFacilitatorsSection } from '../MeetingFacilitatorsSection';
import dynamic from 'next/dynamic';
import { getErrorMessage } from '@/lib/errors/report-error';
import ShareEmbedDialog from '@/components/share-embed-dialog';
import { 
  sessionFormSchema, 
  type SessionFormValues, 
  getDefaultSessionFormValues, 
  mapMeetingToFormValues 
} from './session-form-schema';

const MeetingQRDialog = dynamic(() => import('../MeetingQRDialog'), { ssr: false });

export interface MeetingSessionFormProps {
  mode: 'create' | 'edit';
  meetingId?: string;
  initialData?: Meeting | null;
  isLoadingInitialData?: boolean;
  onSuccess?: (meeting: Meeting) => void;
}

const CREATE_STEPS = [
  { id: 'template', label: 'Template', icon: LayoutGrid, description: 'Choose your base' },
  { id: 'config', label: 'Configuration', icon: Calendar, description: 'Setup & timing' },
  { id: 'branding', label: 'Branding', icon: Palette, description: 'Theme, hero & preview' },
  { id: 'registration', label: 'Registration', icon: ClipboardCheck, description: 'Signup, capacity & leads' },
  { id: 'messaging', label: 'Messaging', icon: MessageSquare, description: 'Automated comms' },
  { id: 'publish', label: 'Publish', icon: Rocket, description: 'Go live' },
] as const;

const EDIT_STEPS = [
  { id: 'config', label: 'Configuration', icon: Calendar, description: 'Setup & timing' },
  { id: 'branding', label: 'Branding', icon: Palette, description: 'Theme, hero & preview' },
  { id: 'registration', label: 'Registration', icon: ClipboardCheck, description: 'Signup, capacity & leads' },
  { id: 'messaging', label: 'Messaging', icon: MessageSquare, description: 'Automated comms' },
  { id: 'publish', label: 'Publish', icon: Rocket, description: 'Go live' },
] as const;

interface DisplayTemplate {
  id: string;
  title: string;
  description: string;
  typeId: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  defaults: Record<string, unknown>;
  isCustom?: boolean;
}

export function MeetingSessionForm({
  mode,
  meetingId,
  initialData,
  isLoadingInitialData = false,
  onSuccess,
}: MeetingSessionFormProps) {
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
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string | null>(null);
  const [showQrDialog, setShowQrDialog] = React.useState(false);
  const [isShareOpen, setIsShareOpen] = React.useState(false);
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [localTitle, setLocalTitle] = React.useState('');
  const [lastStepChangeTime, setLastStepChangeTime] = React.useState(0);

  const steps = mode === 'create' ? CREATE_STEPS : EDIT_STEPS;
  const stepIndex = (id: string) => steps.findIndex(s => s.id === id);

  // Optional URL entity context
  const entityIdFromUrl = searchParams.get('entityId');
  const urlEntity = useEntityByDocId(entityIdFromUrl);

  // Custom templates query for create mode
  const customTemplatesCol = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId || mode !== 'create') return null;
    return query(collection(firestore, 'custom_meeting_templates'), where('workspaceId', '==', activeWorkspaceId));
  }, [firestore, activeWorkspaceId, mode]);

  const { data: customTemplates, isLoading: isLoadingCustomTemplates } = useCollection<MeetingTemplate>(customTemplatesCol);

  const allTemplates: DisplayTemplate[] = React.useMemo(() => {
    const custom: DisplayTemplate[] = (customTemplates || []).map(t => ({
      id: t.id,
      title: t.name,
      description: t.description || 'Custom organization template',
      typeId: t.typeId || 'parent',
      icon: LayoutGrid,
      color: 'bg-emerald-600',
      defaults: t.defaults as Record<string, unknown>,
      isCustom: true,
    }));
    return [...MEETING_TEMPLATES, ...custom];
  }, [customTemplates]);

  const form = useForm<SessionFormValues>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: mode === 'create' 
      ? getDefaultSessionFormValues(MEETING_TYPES[0]) 
      : (initialData ? mapMeetingToFormValues(initialData) : getDefaultSessionFormValues(MEETING_TYPES[0])),
  });

  const { setValue, watch, trigger } = form;

  // Hydrate initial data if editing
  React.useEffect(() => {
    if (mode === 'edit' && initialData && !hasInitialized) {
      form.reset(mapMeetingToFormValues(initialData));
      setLocalTitle(initialData.title || '');
      setHasInitialized(true);
    }
  }, [mode, initialData, hasInitialized, form]);

  // Bind URL entity if creating
  React.useEffect(() => {
    if (mode === 'create' && urlEntity && !form.getValues('entity')) {
      setValue('entity', urlEntity);
      if (!form.getValues('meetingSlug')) {
        setValue('meetingSlug', urlEntity.slug || '', { shouldValidate: true });
      }
    }
  }, [mode, urlEntity, setValue, form]);

  // Watched fields for reactivity
  const watchedHeroTitle = watch('heroTitle');
  const watchedType = watch('type');
  const watchedSlug = watch('meetingSlug');
  const watchedEntity = watch('entity');
  const watchedBrandingEnabled = watch('brandingEnabled');
  const registrationEnabled = watch('registrationEnabled');
  const titleVal = watch('title');

  React.useEffect(() => {
    if (titleVal && !localTitle && !isEditingTitle) {
      setLocalTitle(titleVal);
    }
  }, [titleVal, localTitle, isEditingTitle]);

  const handleSaveTitle = () => {
    if (localTitle.trim()) {
      setValue('title', localTitle.trim(), { shouldValidate: true });
    } else {
      setLocalTitle(titleVal);
    }
    setIsEditingTitle(false);
  };

  // Auto-generate slug for standalone meetings if entity is empty
  React.useEffect(() => {
    if (mode === 'create' && !watchedEntity && watchedType && !form.getValues('meetingSlug')) {
      const typeSlug = watchedType.slug;
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      form.setValue('meetingSlug', `${typeSlug}-${randomSuffix}`, { shouldValidate: true });
    }
  }, [mode, watchedEntity?.id, watchedType?.id, watchedType, form]);

  // Automatically toggle branding based on entity selection
  React.useEffect(() => {
    if (mode === 'create') {
      if (!watchedEntity) {
        form.setValue('brandingEnabled', false);
      } else {
        form.setValue('brandingEnabled', true);
      }
    }
  }, [mode, watchedEntity?.id, watchedEntity, form]);

  // Auto-enable registration for webinars in create mode
  React.useEffect(() => {
    if (mode === 'create' && watchedType?.slug === 'webinar') {
      setValue('registrationEnabled', true);
      setValue('registrationRequiredToJoin', true);
    }
  }, [mode, watchedType?.slug, setValue]);

  // Auto-populate hero defaults when meeting type changes
  React.useEffect(() => {
    if (mode === 'create' && watchedType) {
      const defaults = getMeetingHeroDefaults(watchedType.id);
      const entityName = watchedEntity?.displayName || '{{entity_name}}';
      const currentTitle = form.getValues('heroTitle');
      const currentDesc = form.getValues('heroDescription');
      if (!currentTitle) {
        setValue('heroTitle', defaults.title.replace(/\{\{(school|entity_name)\}\}/g, entityName));
      }
      if (!currentDesc) {
        setValue('heroDescription', defaults.description.replace(/\{\{(school|entity_name)\}\}/g, entityName));
      }
    }
  }, [mode, watchedType?.id, watchedType, watchedEntity?.id, watchedEntity, setValue, form]);

  const handleSelectTemplate = (template: DisplayTemplate) => {
    setSelectedTemplateId(template.id);
    const type = MEETING_TYPES.find(t => t.id === template.typeId);
    
    if (template.defaults) {
      Object.entries(template.defaults).forEach(([key, value]) => {
        setValue(key as Path<SessionFormValues>, value as SessionFormValues[keyof SessionFormValues]);
      });
    }
    
    if (type) setValue('type', type);
    
    setCurrentStep(stepIndex('config'));
    toast({
      title: "Template Applied",
      description: `Starting with ${template.title} layout.`
    });
  };

  const handleNext = async () => {
    let isValid = false;
    
    if (currentStep === stepIndex('template')) {
      isValid = true; 
    } else if (currentStep === stepIndex('config')) {
      isValid = await trigger(['meetingSlug', 'meetingTime', 'type', 'meetingLink']);
    } else if (currentStep === stepIndex('branding')) {
      isValid = await trigger(['logoUrl', 'brandingEnabled', 'heroLayout', 'heroTitle', 'heroDescription', 'heroTagline', 'heroCtaLabel', 'heroImageUrl']);
    } else if (currentStep === stepIndex('registration')) {
      isValid = await trigger(['registrationEnabled', 'registrationRequiredToJoin', 'capacityLimit']);
    } else {
      isValid = true;
    }
    
    if (isValid && currentStep < steps.length - 1) {
      setLastStepChangeTime(Date.now());
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setLastStepChangeTime(Date.now());
      setCurrentStep(prev => prev - 1);
    }
  };

  const onSubmit = async (data: SessionFormValues) => {
    if (!firestore || !user) return;
    if (Date.now() - lastStepChangeTime < 100) return; // Prevent double submit from click bubbling

    try {
      const meetingsRef = collection(firestore, 'meetings');

      if (mode === 'create') {
        // Check meetingSlug uniqueness within type
        const q = query(meetingsRef, where('meetingSlug', '==', data.meetingSlug), where('type.slug', '==', data.type.slug));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          form.setError('meetingSlug', { type: 'manual', message: 'This slug is already in use for this meeting type.' });
          toast({ variant: 'destructive', title: 'Slug already exists', description: 'Please choose a unique URL backhalf.' });
          setCurrentStep(stepIndex('config'));
          return;
        }

        const meetingData: Omit<Meeting, 'id'> = {
          title: data.title,
          meetingSlug: data.meetingSlug,
          ...(data.entity ? {
            entityId: data.entity.entityId,
            entityName: data.entity.displayName,
            entitySlug: data.entity.slug || data.meetingSlug,
            entityType: data.entity.entityType || 'institution',
          } : {}),
          logoUrl: data.logoUrl || '',
          brandingName: data.brandingName || '',
          brandingSlogan: data.brandingSlogan || '',
          brandingEnabled: data.brandingEnabled ?? true,
          heroLayout: data.heroLayout || 'image',
          bannerType: data.bannerType || 'none',
          bannerImageUrl: data.bannerImageUrl || '',
          bannerEmbedCode: data.bannerEmbedCode || '',
          workspaceIds: [activeWorkspaceId],
          meetingTime: data.meetingTime.toISOString(),
          meetingLink: data.meetingLink,
          type: data.type,
          registrationEnabled: data.registrationEnabled,
          registrationRequiredToJoin: data.registrationRequiredToJoin,
          registrationMode: data.registrationMode,
          registrationFields: data.registrationFields,
          registrationSuccessMessage: data.registrationSuccessMessage || '',
          capacityLimit: data.capacityLimit || 0,
          waitlistEnabled: data.waitlistEnabled,
          collectAttendeeDetails: data.collectAttendeeDetails ?? false,
          heroImageUrl: data.heroImageUrl || '',
          heroTitle: data.heroTitle || '',
          heroDescription: data.heroDescription || '',
          heroTagline: data.heroTagline || '',
          heroCtaLabel: data.heroCtaLabel || '',
          recordingUrl: data.recordingUrl || '',
          brochureUrl: data.brochureUrl || '',
          resourceUrl: data.resourceUrl || '',
          feedbackFormUrl: data.feedbackFormUrl || '',
          durationMinutes: data.durationMinutes || 60,
          adminAlertsEnabled: data.adminAlertsEnabled,
          adminAlertChannel: data.adminAlertChannel,
          adminAlertNotifyManager: data.adminAlertNotifyManager,
          adminAlertSpecificUserIds: data.adminAlertSpecificUserIds || [],
          adminAlertEmailTemplateId: data.adminAlertEmailTemplateId || '',
          adminAlertSmsTemplateId: data.adminAlertSmsTemplateId || '',
          adminAlertWhatsappTemplateId: data.adminAlertWhatsappTemplateId || '',
          enabledReminders: data.enabledReminders || [],
          createEntity: data.createEntity || false,
          entityMapping: data.entityMapping || {},
          autoTags: data.autoTags || [],
          facilitators: data.facilitators || [],
          messagingConfig: {
            ...(data.messagingConfig || getDefaultMeetingMessagingConfig()),
            registrationWebhookEnabled: data.registrationWebhookEnabled || false,
            registrationWebhookUrl: data.registrationWebhookUrl || '',
            registrationWebhookSecret: data.registrationWebhookSecret || '',
          },
          publishStatus: data.publishStatus || 'published',
          ...(data.seo ? { seo: data.seo } : {}),
        };

        const docRef = await addDoc(meetingsRef, meetingData);
        const displayName = data.entity?.displayName || data.heroTitle || data.type.name;
        toast({ title: 'Meeting Scheduled', description: `Session "${displayName}" created.` });

        logActivity({
          organizationId: activeOrganizationId,
          entityId: data.entity?.id || 'standalone',
          entityType: data.entity?.entityType || 'institution',
          userId: user.uid,
          workspaceId: activeWorkspaceId,
          type: 'meeting_created',
          source: 'user_action',
          description: data.entity 
            ? `scheduled a ${data.type.name} session for "${data.entity.displayName}".`
            : `scheduled a standalone ${data.type.name} session.`,
          metadata: { 
            meetingId: docRef.id, 
            meetingTime: data.meetingTime.toISOString(),
            isStandalone: !data.entity 
          }
        }).catch(err => console.warn("Activity log deferred:", err.message));

        if (data.adminAlertsEnabled) {
          triggerInternalNotification({
            entityId: data.entity?.id || '',
            notifyManager: data.adminAlertNotifyManager,
            specificUserIds: data.adminAlertSpecificUserIds,
            emailTemplateId: data.adminAlertEmailTemplateId,
            smsTemplateId: data.adminAlertSmsTemplateId,
            whatsappTemplateId: data.adminAlertWhatsappTemplateId,
            channel: data.adminAlertChannel,
            variables: {
              school_name: data.entity?.displayName || data.heroTitle || 'Standalone Session',
              meeting_type: data.type.name,
              date: format(data.meetingTime, 'PPPP'),
              time: format(data.meetingTime, 'p'),
              link: data.meetingLink,
              event_type: 'New Session Created'
            }
          }).catch(err => console.warn("Notification deferred:", err.message));
        }

        const createdMeeting: Meeting = {
          id: docRef.id,
          ...meetingData,
        };

        rescheduleRemindersForMeeting(
          createdMeeting,
          activeOrganizationId,
          true
        ).catch(err => console.warn("Reminder rescheduling deferred:", err.message));

        if (onSuccess) {
          onSuccess(createdMeeting);
        } else {
          router.push(`/admin/meetings/${docRef.id}`);
        }

      } else {
        // Edit mode
        if (!meetingId) throw new Error("Meeting ID is required for editing.");

        // Check duplicate slug among other documents
        const q = query(meetingsRef, where('type.slug', '==', data.type.slug), where('meetingSlug', '==', data.meetingSlug));
        const querySnapshot = await getDocs(q);
        const isDuplicate = querySnapshot.docs.some(d => d.id !== meetingId);
        
        if (isDuplicate) {
          form.setError('meetingSlug', { type: 'manual', message: 'This slug is already in use for this meeting type.' });
          toast({ variant: 'destructive', title: 'Slug already exists', description: 'Please choose a unique URL backhalf.' });
          setCurrentStep(stepIndex('config'));
          return;
        }

        // Adjust invitation slot dates if meetingTime changed
        if (initialData?.meetingTime && data.meetingTime) {
          const oldTime = new Date(initialData.meetingTime).getTime();
          const newTime = data.meetingTime.getTime();
          const diffMs = newTime - oldTime;
          
          if (diffMs !== 0 && data.messagingConfig?.invitationSeries) {
            const adjustedSeries = data.messagingConfig.invitationSeries.map((slot: MeetingInvitationSlot) => {
              if (slot.id === 'initial') {
                const updated = { ...slot };
                if (slot.emailScheduledDate) {
                  const d = new Date(slot.emailScheduledDate);
                  updated.emailScheduledDate = new Date(d.getTime() + diffMs).toISOString();
                }
                if (slot.smsScheduledDate) {
                  const d = new Date(slot.smsScheduledDate);
                  updated.smsScheduledDate = new Date(d.getTime() + diffMs).toISOString();
                }
                return updated;
              }
              return slot;
            });
            data.messagingConfig = {
              ...data.messagingConfig,
              invitationSeries: adjustedSeries
            };
            setValue('messagingConfig', data.messagingConfig);
          }
        }

        const meetingData: Omit<Meeting, 'id'> = {
          title: data.title,
          entityId: data.entity?.entityId || '', 
          entityName: data.entity?.displayName || data.brandingName || data.heroTitle || 'Standalone Session',
          entitySlug: data.meetingSlug,
          meetingSlug: data.meetingSlug,
          entityType: data.entity?.entityType || 'institution',
          workspaceIds: [activeWorkspaceId],
          meetingTime: data.meetingTime.toISOString(),
          meetingLink: data.meetingLink,
          type: data.type,
          logoUrl: data.logoUrl || '',
          brandingName: data.brandingName || '',
          brandingSlogan: data.brandingSlogan || '',
          brandingEnabled: data.brandingEnabled,
          heroLayout: data.heroLayout,
          bannerType: data.bannerType,
          bannerImageUrl: data.bannerImageUrl || '',
          bannerEmbedCode: data.bannerEmbedCode || '',
          registrationEnabled: data.registrationEnabled,
          registrationRequiredToJoin: data.registrationRequiredToJoin,
          registrationMode: data.registrationMode,
          registrationFields: data.registrationFields,
          registrationSuccessMessage: data.registrationSuccessMessage || '',
          capacityLimit: data.capacityLimit || 0,
          waitlistEnabled: data.waitlistEnabled,
          collectAttendeeDetails: data.collectAttendeeDetails ?? false,
          heroImageUrl: data.heroImageUrl || '',
          heroTitle: data.heroTitle || '',
          heroDescription: data.heroDescription || '',
          heroTagline: data.heroTagline || '',
          heroCtaLabel: data.heroCtaLabel || '',
          ...(data.seo ? { seo: data.seo } : {}),
          recordingUrl: data.recordingUrl || '',
          brochureUrl: data.brochureUrl || '',
          resourceUrl: data.resourceUrl || '',
          feedbackFormUrl: data.feedbackFormUrl || '',
          durationMinutes: data.durationMinutes || 60,
          createEntity: data.createEntity || false,
          entityMapping: data.entityMapping || {},
          autoTags: data.autoTags || [],
          facilitators: data.facilitators || [],
          messagingConfig: {
            ...(data.messagingConfig || getDefaultMeetingMessagingConfig()),
            registrationWebhookEnabled: data.registrationWebhookEnabled || false,
            registrationWebhookUrl: data.registrationWebhookUrl || '',
            registrationWebhookSecret: data.registrationWebhookSecret || '',
          },
          publishStatus: data.publishStatus || 'published',
        };

        const docRef = doc(firestore, 'meetings', meetingId);
        await updateDoc(docRef, meetingData);
        toast({ 
          title: 'Meeting Updated', 
          description: `Session for ${data.entity?.displayName || data.heroTitle || 'Standalone Session'} saved.` 
        });

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

        const meetingTimeChanged = initialData?.meetingTime && data.meetingTime
          ? new Date(initialData.meetingTime).getTime() !== data.meetingTime.getTime()
          : false;

        const updatedMeeting: Meeting = {
          id: meetingId,
          ...meetingData,
        };

        rescheduleRemindersForMeeting(
          updatedMeeting,
          activeOrganizationId,
          meetingTimeChanged
        ).catch(err => console.warn("Reminder rescheduling deferred:", err.message));

        if (onSuccess) {
          onSuccess(updatedMeeting);
        } else {
          router.push(`/admin/meetings/${meetingId}`);
        }
      }

    } catch (error: unknown) {
      toast({ 
        variant: 'destructive', 
        title: mode === 'create' ? 'Schedule failed' : 'Update failed', 
        description: getErrorMessage(error) 
      });
    }
  };

  const publicTypeSlug = (watchedType?.slug as string) === 'parent' ? 'parent-engagement' : watchedType?.slug;
  const publicUrl = watchedType && watchedSlug ? `/meetings/${publicTypeSlug}/${watchedSlug}` : null;

  if (isLoadingInitialData || (mode === 'create' && isLoadingCustomTemplates)) {
    return (
      <div className="h-full w-full overflow-y-auto">
        <div className="w-full p-8 space-y-8">
          <Card className="max-w-3xl mx-auto shadow-sm border border-border/80 rounded-2xl bg-card">
            <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
            <CardContent className="space-y-8">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="w-full p-8 space-y-8 pb-24 text-left">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="rounded-xl h-10 w-10 shrink-0" type="button">
              <Link href={mode === 'edit' && meetingId ? `/admin/meetings/${meetingId}` : "/admin/meetings"}>
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex flex-col justify-center text-left">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input 
                    value={localTitle}
                    onChange={(e) => setLocalTitle(e.target.value)}
                    className="text-2xl font-black tracking-tight text-foreground bg-transparent border-b border-input focus-visible:ring-0 focus-visible:border-primary rounded-none px-0 py-1 h-auto w-full max-w-md font-bold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveTitle();
                      } else if (e.key === 'Escape') {
                        setLocalTitle(titleVal);
                        setIsEditingTitle(false);
                      }
                    }}
                  />
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-emerald-500 hover:bg-emerald-500/10 shrink-0" onClick={handleSaveTitle}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted/10 shrink-0" onClick={() => { setLocalTitle(titleVal); setIsEditingTitle(false); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group/title">
                  <h1 className="text-2xl font-black tracking-tight text-foreground leading-none">
                    {titleVal || (mode === 'create' ? 'New Executive Session' : 'Edit Session')}
                  </h1>
                  <Button 
                    type="button" 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 rounded-lg opacity-0 group-hover/title:opacity-100 group-focus-within/title:opacity-100 scale-95 group-hover/title:scale-100 transition-all duration-200 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-1.5">
                {mode === 'create' ? 'New Session Builder' : 'Session Studio & Configuration'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground bg-card px-3 py-1 rounded-full border border-border/80 shadow-sm w-fit">
            <Settings2 className="h-3 w-3" />
            Wizard Mode ({currentStep + 1}/{steps.length})
          </div>
        </div>

        {/* Wizard Steps Bar */}
        <div className="flex items-center gap-2 p-2 bg-card rounded-2xl border border-border/80 shadow-sm overflow-x-auto">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => {
                    setLastStepChangeTime(Date.now());
                    setCurrentStep(index);
                  }}
                  className={cn(
                    "flex-1 flex items-center gap-3 p-3 rounded-xl transition-all duration-300 text-left min-w-[140px] min-h-[44px] active:scale-[0.98]",
                    isActive && "bg-primary/10 ring-1 ring-primary/20 shadow-sm",
                    isCompleted && "bg-emerald-50 dark:bg-emerald-950/20",
                    !isActive && !isCompleted && "hover:bg-muted/50 opacity-70"
                  )}
                  aria-current={isActive ? 'step' : undefined}
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
                {index < steps.length - 1 && (
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
            
            {/* STEP: Template Selection (Create mode only) */}
            {mode === 'create' && currentStep === stepIndex('template') && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {allTemplates.map((template) => {
                    const Icon = template.icon;
                    const isSelected = selectedTemplateId === template.id;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => handleSelectTemplate(template)}
                        className={cn(
                          "group relative flex flex-col text-left p-6 sm:rounded-2xl border-2 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 active:scale-[0.98]",
                          isSelected 
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xl" 
                            : "border-border bg-card hover:border-primary/40"
                        )}
                      >
                        <div className={cn(
                          "p-4 rounded-2xl w-fit mb-6 transition-all group-hover:scale-110 group-hover:rotate-3",
                          template.color,
                          "text-white shadow-lg"
                        )}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <h3 className="font-bold text-lg tracking-tight mb-2">{template.title}</h3>
                        <p className="text-xs font-medium text-muted-foreground leading-relaxed flex-1">
                          {template.description}
                        </p>
                        
                        <div className="mt-6 flex items-center justify-between">
                          <div className="px-3 py-1 rounded-full bg-muted text-[9px] font-bold uppercase tracking-wider text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            {template.typeId}
                          </div>
                          {isSelected && (
                            <div className="bg-primary text-white p-1 rounded-full shadow-lg">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          )}
                        </div>

                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <PlusCircle className="h-5 w-5 text-primary/40" />
                        </div>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setCurrentStep(stepIndex('config'))}
                    className="flex flex-col items-center justify-center p-6 sm:rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/30 transition-all group active:scale-[0.98]"
                  >
                    <div className="p-4 rounded-2xl bg-muted text-muted-foreground mb-4 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <PlusCircle className="h-8 w-8" />
                    </div>
                    <h3 className="font-bold text-lg tracking-tight">Blank Slate</h3>
                    <p className="text-[10px] font-semibold text-muted-foreground">Start from scratch</p>
                  </button>
                </div>
              </div>
            )}

            {/* STEP: Configuration */}
            {currentStep === stepIndex('config') && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="xl:col-span-7 space-y-8">
                  <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card text-card-foreground">
                    <CardHeader className="bg-muted/15 border-b border-border/70 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl"><Calendar className="h-5 w-5 text-primary" /></div>
                        <CardTitle className="text-lg font-semibold tracking-tight">Session Configuration</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8 bg-card">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="entity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Context {singular} <span className="text-primary/60">(Optional)</span></FormLabel>
                              <FormControl>
                                <EntityCombobox
                                  value={field.value?.id || '__none__'}
                                  valueKey="id"
                                  noneLabel="No Entity Context Binding"
                                  noneValue="__none__"
                                  placeholder={`Select ${singular.toLowerCase()}...`}
                                  className="h-12 rounded-xl bg-background border border-input shadow-xs hover:border-foreground/30 focus:ring-2 focus:ring-primary/20 font-semibold"
                                  onChange={(val, entity?: SearchedEntity) => {
                                    if (val === '__none__' || !entity) {
                                      field.onChange(null);
                                      return;
                                    }
                                    field.onChange(entity);
                                    if (!form.getValues('meetingSlug')) {
                                      form.setValue('meetingSlug', entity.slug || '', { shouldValidate: true });
                                    }
                                  }}
                                />
                              </FormControl>
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
                                  <SelectTrigger className="h-12 rounded-xl bg-background border border-input shadow-xs hover:border-foreground/30 focus:ring-2 focus:ring-primary/20 font-semibold transition-all">
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
                                <div className="flex h-12 border border-input rounded-xl overflow-hidden bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-xs">
                                  <div className="bg-muted/40 px-3.5 flex items-center text-xs font-semibold text-muted-foreground border-r border-input"><Video className="h-4 w-4" /></div>
                                  <Input placeholder="https://meet.google.com/..." {...field} className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent font-mono text-xs px-3" />
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
                            <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Meeting URL Slug</FormLabel>
                            <div className="flex flex-col sm:flex-row group transition-all">
                              <div className="flex h-12 items-center bg-muted/40 border border-input sm:border-r-0 rounded-t-xl sm:rounded-l-xl sm:rounded-tr-none px-4 text-xs font-medium text-muted-foreground shrink-0">
                                /meetings/{watchedType?.slug || 'parent-engagement'}/
                              </div>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="e.g. q3-kickoff-session" 
                                  className="h-12 rounded-t-none sm:rounded-l-none rounded-b-xl sm:rounded-r-xl bg-background border border-input focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 shadow-xs font-bold text-sm px-4 transition-all" 
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
                <div className="xl:col-span-5 space-y-6">
                  <MeetingPreviewPanel 
                    data={{
                      heroTitle: form.watch('heroTitle'),
                      heroDescription: form.watch('heroDescription'),
                      heroTagline: form.watch('heroTagline'),
                      heroCtaLabel: form.watch('heroCtaLabel'),
                      heroImageUrl: form.watch('heroImageUrl'),
                      logoUrl: form.watch('logoUrl'),
                      brandingEnabled: form.watch('brandingEnabled'),
                      heroLayout: form.watch('heroLayout'),
                      type: form.watch('type'),
                      entityName: form.watch('entity')?.displayName || form.watch('brandingName'),
                      registrationEnabled: form.watch('registrationEnabled'),
                    }}
                  />
                </div>
              </div>
            )}

            {/* STEP: Branding */}
            {currentStep === stepIndex('branding') && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="xl:col-span-7 space-y-8">
                  <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card text-card-foreground">
                    <CardHeader className="bg-muted/15 border-b border-border/70 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl"><Palette className="h-5 w-5 text-primary" /></div>
                        <CardTitle className="text-lg font-semibold tracking-tight">Branding & Layout</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8 bg-card">
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

                      <FormField
                        control={form.control}
                        name="brandingEnabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between p-4 bg-muted/10 rounded-xl border border-border/80">
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
                                    <Input {...field} placeholder="e.g. My Organization" className="h-11 rounded-xl bg-background border border-input shadow-xs hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/20 font-semibold" />
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
                                    <Input {...field} placeholder="e.g. Excellence in Education" className="h-11 rounded-xl bg-background border border-input shadow-xs hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/20 font-semibold" />
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
                                  "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 text-center cursor-pointer min-h-[44px]",
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
                                  "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 text-center cursor-pointer min-h-[44px]",
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
                                    onClick={() => field.onChange(type as 'none' | 'image' | 'embed')}
                                    className={cn(
                                      "h-11 min-h-[44px] rounded-xl border transition-all text-xs font-bold capitalize active:scale-[0.98]",
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
                                      className="min-h-[100px] bg-background border border-input shadow-xs hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/20 font-mono text-[11px] rounded-xl" 
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

                  <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card text-card-foreground">
                    <CardHeader className="bg-muted/15 border-b border-border/70 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-500/10 rounded-xl"><Type className="h-5 w-5 text-violet-600" /></div>
                        <CardTitle className="text-lg font-semibold tracking-tight">Top Of Page Content</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8 bg-card">
                      <FormField control={form.control} name="heroTitle" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Hero Title</FormLabel>
                          <FormControl><Input {...field} placeholder="e.g. Join Our Transformation Journey" className="h-14 rounded-xl bg-background border border-input shadow-xs hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/20 font-bold text-lg" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="heroDescription" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Hero Description</FormLabel>
                          <FormControl><Textarea {...field} placeholder="Supporting text..." rows={4} className="rounded-xl bg-background border border-input shadow-xs hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/20 font-medium resize-none" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Separator className="bg-border/50" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="heroTagline" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Tagline</FormLabel>
                            <FormControl><Input {...field} placeholder="e.g. Free for all parents" className="h-11 rounded-xl bg-background border border-input shadow-xs hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/20" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="heroCtaLabel" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">{registrationEnabled ? 'Register Button Label' : 'CTA Button Label'}</FormLabel>
                            <FormControl><Input {...field} placeholder={registrationEnabled ? 'Register Now' : 'Join Session'} className="h-11 rounded-xl bg-background border border-input shadow-xs hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/20" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <Separator className="bg-border/50" />
                      <FormField control={form.control} name="heroImageUrl" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5" /> Hero Spotlight Media</FormLabel>
                          <FormControl><MediaSelect value={field.value} onValueChange={field.onChange} className="rounded-2xl" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>
                </div>

                {/* Live Preview */}
                <div className="xl:col-span-5 space-y-6">
                  <MeetingPreviewPanel 
                    data={{
                      heroTitle: form.watch('heroTitle'),
                      heroDescription: form.watch('heroDescription'),
                      heroTagline: form.watch('heroTagline'),
                      heroCtaLabel: form.watch('heroCtaLabel'),
                      heroImageUrl: form.watch('heroImageUrl'),
                      logoUrl: form.watch('logoUrl'),
                      brandingEnabled: form.watch('brandingEnabled'),
                      heroLayout: form.watch('heroLayout'),
                      type: form.watch('type'),
                      entityName: form.watch('entity')?.displayName || form.watch('brandingName'),
                      registrationEnabled: form.watch('registrationEnabled'),
                    }}
                    className="sticky top-24"
                  />
                </div>
              </div>
            )}

            {/* STEP: Registration */}
            {currentStep === stepIndex('registration') && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="xl:col-span-7 space-y-8">
                  <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card text-card-foreground">
                    <CardHeader className="bg-muted/15 border-b border-border/70 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-500/10 rounded-xl"><ClipboardCheck className="h-5 w-5 text-amber-600" /></div>
                          <CardTitle className="text-lg font-semibold tracking-tight">Registration Engine</CardTitle>
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
                      <CardContent className="p-6 space-y-8 bg-card animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/10 p-4 rounded-xl border border-border/80">
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
                                    <SelectTrigger className="h-11 min-h-[44px] rounded-xl bg-background border border-input shadow-xs hover:border-foreground/30 focus:ring-2 focus:ring-primary/20">
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
                                    className="h-11 rounded-xl bg-background border border-input shadow-xs hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/20 font-bold tabular-nums" 
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
                              <FormItem className="flex flex-row items-center justify-between p-3 h-11 bg-muted/10 rounded-xl border border-border/80 mt-6">
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
                                  className="rounded-xl bg-background border border-input shadow-xs hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/20 resize-none font-medium text-sm"
                                />
                              </FormControl>
                              <div className="flex flex-wrap gap-1.5 pt-2">
                                <span className="text-[9px] font-semibold text-muted-foreground/50 mr-1 self-center">Insert:</span>
                                {[
                                  { label: 'Name', token: '{{registrant_name}}' },
                                  { label: 'Email', token: '{{registrant_email}}' },
                                  { label: 'Meeting', token: '{{meeting_title}}' },
                                  { label: 'Date', token: '{{meeting_date}}' },
                                  { label: 'Time', token: '{{meeting_time}}' },
                                  { label: 'Join Link', token: '{{registrant_join_link}}' },
                                ].map(v => (
                                  <button
                                    key={v.token}
                                    type="button"
                                    onClick={() => {
                                      const current = field.value || '';
                                      field.onChange(current + (current.endsWith(' ') || !current ? '' : ' ') + v.token);
                                    }}
                                    className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-colors cursor-pointer min-h-[28px]"
                                  >
                                    {v.label}
                                  </button>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Separator className="bg-border/50" />
                        <MeetingLeadCaptureSection registrationFields={form.watch('registrationFields') || []} />
                      </CardContent>
                    ) : (
                      <CardContent className="p-12 flex flex-col items-center justify-center text-center opacity-40">
                        <ClipboardCheck className="h-12 w-12 mb-4" />
                        <p className="text-sm font-bold">Registration Disabled</p>
                        <p className="text-xs font-medium">Attendees will enter directly without signing up prior.</p>
                      </CardContent>
                    )}
                  </Card>

                  {/* Guest & Live Entry Access Card */}
                  <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card text-card-foreground">
                    <CardHeader className="bg-muted/15 border-b border-border/70 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-500/10 rounded-xl">
                            <UserCheck className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div className="text-left">
                            <CardTitle className="text-lg font-semibold tracking-tight">Guest & Live Entry Access</CardTitle>
                            <p className="text-xs text-muted-foreground">Controls how attendees access the live session room</p>
                          </div>
                        </div>
                        <FormField
                          control={form.control}
                          name="collectAttendeeDetails"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0 text-left">
                              <Label htmlFor="collect-details-toggle" className="text-[10px] font-semibold text-muted-foreground">
                                Collect Details Before Entry
                              </Label>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} id="collect-details-toggle" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 bg-card">
                      {form.watch('collectAttendeeDetails') ? (
                        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3 text-left">
                          <div className="p-2 bg-primary/10 rounded-lg shrink-0 mt-0.5">
                            <UserCircle className="h-4 w-4 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-foreground">Information Gate Active</p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              Attendees are asked to enter their Full Name before opening the meeting room. Attendance will be logged in the participants list.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3 text-left">
                          <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0 mt-0.5">
                            <Zap className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Direct 1-Click Join Active (Default)</p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              Attendees can enter the meeting room instantly with zero form fields once the countdown ends. Fast, frictionless access for public broadcasts.
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Live Preview */}
                <div className="xl:col-span-5 space-y-6">
                  <MeetingPreviewPanel 
                    data={{
                      heroTitle: form.watch('heroTitle'),
                      heroDescription: form.watch('heroDescription'),
                      heroTagline: form.watch('heroTagline'),
                      heroCtaLabel: form.watch('heroCtaLabel'),
                      heroImageUrl: form.watch('heroImageUrl'),
                      logoUrl: form.watch('logoUrl'),
                      brandingEnabled: form.watch('brandingEnabled'),
                      heroLayout: form.watch('heroLayout'),
                      type: form.watch('type'),
                      entityName: form.watch('entity')?.displayName || form.watch('brandingName'),
                      registrationEnabled: form.watch('registrationEnabled'),
                      collectAttendeeDetails: form.watch('collectAttendeeDetails'),
                    }}
                    className="sticky top-24"
                  />
                </div>
              </div>
            )}

            {/* STEP: Messaging */}
            {currentStep === stepIndex('messaging') && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <MeetingMessagingTab />
              </div>
            )}

            {/* STEP: Publish */}
            {currentStep === stepIndex('publish') && (
              <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Assets Card */}
                <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card text-card-foreground">
                  <CardHeader className="bg-muted/15 border-b border-border/70 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-xl"><Video className="h-4 w-4 text-blue-600" /></div>
                      <CardTitle className="text-sm font-semibold tracking-tight">Meeting Assets</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4 bg-card">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="recordingUrl" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Video Recording (YouTube)</FormLabel>
                          <FormControl><Input placeholder="https://youtu.be/..." {...field} className="h-11 rounded-xl bg-background border border-input shadow-xs hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/20" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="brochureUrl" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Public Brochure</FormLabel>
                          <FormControl><BrochureSelect value={field.value} onValueChange={field.onChange} className="rounded-xl border border-input bg-background shadow-xs hover:border-foreground/30" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </CardContent>
                </Card>

                {/* Registration Webhook Card */}
                <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card text-card-foreground">
                  <CardHeader className="bg-muted/15 border-b border-border/70 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-500/10 rounded-xl"><Webhook className="h-4 w-4 text-violet-600" /></div>
                        <CardTitle className="text-sm font-semibold tracking-tight">Registration Webhook</CardTitle>
                      </div>
                      <FormField control={form.control} name="registrationWebhookEnabled" render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )} />
                    </div>
                  </CardHeader>
                  {form.watch('registrationWebhookEnabled') && (
                    <CardContent className="p-6 space-y-4 bg-card animate-in fade-in slide-in-from-top-2">
                      <FormField control={form.control} name="registrationWebhookUrl" render={({ field }) => (
                        <FormItem className="text-left">
                          <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">POST Endpoint URL</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="https://your-crm.com/webhooks/registrations"
                              className="h-11 rounded-xl bg-background border border-input shadow-xs hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/20 font-mono text-xs"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="registrationWebhookSecret" render={({ field }) => (
                        <FormItem className="text-left">
                          <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Webhook Secret <span className="text-muted-foreground/40">(optional — HMAC-SHA256 signature)</span></FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Enter a secret to sign payloads..."
                              className="h-11 rounded-xl bg-background border border-input shadow-xs hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/20 font-mono text-xs"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="p-3 bg-violet-500/5 rounded-xl border border-violet-500/10">
                        <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                          📡 On every new registration, a signed JSON payload will be POSTed to this URL containing registrant details and CRM context.
                        </p>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Publish Card */}
                <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card text-card-foreground">
                  <CardHeader className="bg-muted/15 border-b border-border/70 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-xl"><Rocket className="h-5 w-5 text-emerald-600" /></div>
                      <CardTitle className="text-lg font-semibold tracking-tight">
                        {mode === 'create' ? 'Launch Your Session' : 'Save Session Changes'}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6 bg-card">
                    <FormField
                      control={form.control}
                      name="publishStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Meeting Status</FormLabel>
                          <div className="grid grid-cols-3 gap-2 bg-muted/20 p-1.5 rounded-2xl border border-border/80">
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
                                  "h-11 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 min-h-[44px]",
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

                    {publicUrl && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-primary" />
                          <h4 className="text-sm font-bold tracking-tight">Public URL Preview</h4>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-muted/10 rounded-xl border border-border/80">
                          <code className="flex-1 text-xs font-mono text-primary truncate">
                            {typeof window !== 'undefined' ? `${window.location.origin}${publicUrl}` : publicUrl}
                          </code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 px-3 rounded-lg font-bold gap-1 text-xs hover:bg-primary/10 hover:text-primary transition-colors shrink-0 min-h-[36px]"
                            onClick={() => {
                              const full = typeof window !== 'undefined' ? `${window.location.origin}${publicUrl}` : publicUrl;
                              navigator.clipboard.writeText(full).catch(() => {});
                              toast({ title: 'Link copied!', description: 'Public link copied to clipboard.' });
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" /> Copy
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 px-3 rounded-lg font-bold gap-1 text-xs hover:bg-primary/10 hover:text-primary transition-colors shrink-0 min-h-[36px]"
                            onClick={() => setIsShareOpen(true)}
                          >
                            <Code className="h-3.5 w-3.5" /> Share & Embed
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 px-3 rounded-lg font-bold gap-1 text-xs hover:bg-primary/10 hover:text-primary transition-colors shrink-0 min-h-[36px]"
                            onClick={() => setShowQrDialog(true)}
                          >
                            <QrCode className="h-3.5 w-3.5" /> QR
                          </Button>
                        </div>
                      </div>
                    )}

                    <Separator className="bg-border/50" />

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button
                        type="submit"
                        variant="outline"
                        size="lg"
                        disabled={form.formState.isSubmitting}
                        onClick={() => form.setValue('publishStatus', 'draft')}
                        className="flex-1 h-14 min-h-[56px] rounded-xl font-bold gap-2 active:scale-[0.98]"
                      >
                        {form.formState.isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        Save as Draft
                      </Button>
                      <Button
                        type="submit"
                        size="lg"
                        disabled={form.formState.isSubmitting}
                        onClick={() => form.setValue('publishStatus', 'published')}
                        className="flex-1 h-14 min-h-[56px] rounded-xl font-bold gap-2 shadow-lg shadow-primary/20 active:scale-[0.98]"
                      >
                        {form.formState.isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
                        {mode === 'create' ? 'Create & Launch Session' : 'Save & Publish Session'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Wizard Navigation Footer */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handlePrev} 
                disabled={currentStep === 0} 
                className="rounded-xl font-bold gap-2 h-12 min-h-[48px] px-6 active:scale-[0.97]"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>

              <div className="hidden sm:flex items-center gap-1.5">
                {steps.map((_, index) => (
                  <div key={index} className={cn("h-1.5 rounded-full transition-all duration-300", index === currentStep ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/20")} />
                ))}
              </div>

              {currentStep < steps.length - 1 ? (
                <Button 
                  type="button" 
                  onClick={handleNext} 
                  className="rounded-xl font-bold gap-2 h-12 min-h-[48px] px-6 active:scale-[0.97]"
                >
                  Next Step <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={form.formState.isSubmitting} 
                  className="rounded-xl font-bold gap-2 h-12 min-h-[48px] px-6 shadow-lg active:scale-[0.97]"
                >
                  {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  {mode === 'create' ? 'Launch Session' : 'Save Changes'}
                </Button>
              )}
            </div>
            
            {publicUrl && (
              <MeetingQRDialog
                open={showQrDialog}
                onOpenChange={setShowQrDialog}
                meetingTitle={form.getValues('title') || 'Meeting'}
                publicUrl={publicUrl}
              />
            )}

            {isShareOpen && publicUrl && (
              <ShareEmbedDialog
                isOpen={isShareOpen}
                onOpenChange={setIsShareOpen}
                title="Share & Embed Meeting"
                resourceName="Meeting"
                publicUrl={typeof window !== 'undefined' ? `${window.location.origin}${publicUrl}` : publicUrl}
                embedUrl={typeof window !== 'undefined' ? `${window.location.origin}${publicUrl}?embed=true` : `${publicUrl}?embed=true`}
              />
            )}

          </form>
        </FormProvider>
      </div>
    </div>
  );
}
