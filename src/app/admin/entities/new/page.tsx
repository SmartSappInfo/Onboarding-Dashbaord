'use client';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ENTITY DATA GOVERNANCE — READ BEFORE MODIFYING THIS FILE  ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║                                                              ║
 * ║  When you ADD, REMOVE, or RENAME any field in this form:    ║
 * ║                                                              ║
 * ║  1. Update BULK_IMPORT_FIELDS in BulkUploadClient.tsx        ║
 * ║     → Simple Template fields (Basic tab)                     ║
 * ║     → Advanced Template fields for each industry             ║
 * ║       (institution / person / family / …)                    ║
 * ║  2. Update processRow() in bulk-upload-actions.ts            ║
 * ║     → Ensure the new field is parsed from CSV data           ║
 * ║  3. Update the entity payload builder in this file           ║
 * ║     → entityPayload construction in onSubmit()               ║
 * ║  4. Update SAMPLE_ROWS in BulkUploadClient.tsx               ║
 * ║     → Add realistic sample data for each industry            ║
 * ║  5. Run a test E2E import to verify persistence              ║
 * ║                                                              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import * as React from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Loader2, 
  Building, 
  MapPin, 
  User, 
  Plus, 
  UserCheck, 
  Banknote, 
  CreditCard, 
  Wallet, 
  Percent, 
  Target, 
  Zap, 
  Layout, 
  Camera, 
  AlertTriangle, 
  Share2, 
  Globe, 
  Hash, 
  Network, 
  Sparkles, 
  Database, 
  ChevronDown,
  ArrowLeft 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy } from 'firebase/firestore';
import dynamic from 'next/dynamic';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';

const AiArchitectDialog = dynamic(
  () => import('../components/AiArchitectDialog').then((mod) => mod.AiArchitectDialog),
  { ssr: false }
);
import type { ExtractSchoolDataOutput } from '@/ai/flows/extract-school-data-flow';

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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { ModuleSelect } from '../components/ModuleSelect';
import { ZoneSelect } from '../components/ZoneSelect';
import { EntityContactManager } from '../components/EntityContactManager';
import { ManagerSelect } from '../components/ManagerSelect';
import { PackageSelect } from '../components/PackageSelect';
import { MediaSelect } from '../components/media-select';
import { createEntityAction } from '@/lib/entity-actions';
import { type UserProfile, type SubscriptionPackage, type Zone, type Module, type EntityType } from '@/lib/types';
import { UNASSIGNED_ZONE, zoneOrUnassigned } from '@/lib/zone-constants';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { useTerminology } from '@/hooks/use-terminology';
import { LocationCascade } from '@/components/location/LocationCascade';
import { TagSelector } from '@/components/tags/TagSelector';
import { useWorkspaceVisibility } from '@/hooks/use-workspace-visibility';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// Deal opportunity integration
import { DealOpportunityCard, type DealConfig } from '../components/DealOpportunityCard';
import { createDeal } from '@/app/actions/deal-actions';
import { getErrorMessage } from '@/lib/errors/report-error';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Required name must be at least 2 characters.' }),
  initials: z.string().optional(),
  slogan: z.string().optional(),
  workspaceIds: z.array(z.string()).min(1, 'Select at least one workspace.'),
  status: z.enum(['active', 'inactive', 'archived']),
  logoUrl: z.string().url().optional().or(z.literal('')),
  heroImageUrl: z.string().url().optional().or(z.literal('')),
  zone: z.object({
    id: z.string(),
    name: z.string(),
  }).optional().nullable(),
  location: z.object({
    country: z.object({ id: z.string(), name: z.string(), code: z.string(), flag: z.string() }).nullable().optional(),
    region: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
    district: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  }).optional(),
  locationString: z.string().optional(),
  workspaceTags: z.array(z.string()).optional().default([]),
  capacity: z.coerce.number().optional().default(0),

  // ── Narrative Fields (non-required, all industries) ──────────────────────
  currentNeeds: z.string().optional(),
  currentChallenges: z.string().optional(),
  interests: z.string().optional(),
  entityContacts: z.array(z.object({
    name: z.string().min(1, 'Name required.'),
    email: z.string().optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
    typeKey: z.string().optional().default('administrator'),
    typeLabel: z.string().optional().default('Administrator'),
    isSignatory: z.boolean().default(false),
    isPrimary: z.boolean().default(false),
  })).optional().default([]),
  modules: z.array(z.object({
    id: z.string(),
    name: z.string(),
    abbreviation: z.string(),
    color: z.string(),
  })).optional(),
  assignedToId: z.string().optional().default('unassigned'),
  // Billing Fields
  billingAddress: z.string().optional(),
  currency: z.string().default('GHS'),
  subscriptionPackageId: z.string().optional().nullable(),
  subscriptionRate: z.coerce.number().default(0),
  discountPercentage: z.coerce.number().min(0).max(100).default(0),
  arrearsBalance: z.coerce.number().default(0),
  creditBalance: z.coerce.number().default(0),

  // Online Presence
  op_website: z.string().optional(),
  op_digitalAddress: z.string().optional(),
  op_googleMapLocation: z.string().optional(),
  op_googleBusinessProfile: z.string().optional(),
  op_facebook: z.string().optional(),
  op_whatsapp: z.string().optional(),
  op_linkedin: z.string().optional(),
  op_pinterest: z.string().optional(),
  op_instagram: z.string().optional(),
  op_tiktok: z.string().optional(),
  op_youtube: z.string().optional(),
  op_x: z.string().optional(),

  // Person fields
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  leadSource: z.string().optional(),
  customData: z.record(z.unknown()).optional(),

  // Deal creation fields (optional/conditional)
  createDeal: z.boolean().default(false),
  dealPipelineId: z.string().optional(),
  dealStageId: z.string().optional(),
  dealName: z.string().optional(),
  dealValue: z.coerce.number().optional().default(0),
  dealExpectedCloseDate: z.string().optional(),
  dealSuppressAutomations: z.boolean().default(false),
}).superRefine((data, ctx) => {
  if (data.createDeal) {
    if (!data.dealPipelineId) {
      ctx.addIssue({ code: 'custom', path: ['dealPipelineId'], message: 'Select a pipeline.' });
    }
    if (!data.dealStageId) {
      ctx.addIssue({ code: 'custom', path: ['dealStageId'], message: 'Select a stage.' });
    }
  }
});

type FormData = z.infer<typeof formSchema>;

interface AppFieldItem {
  id: string;
  groupId?: string;
  status?: string;
  type?: string;
  variableName?: string;
  label?: string;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  compatibilityScope?: string[];
}

interface FieldGroupItem {
  id: string;
  name: string;
  order?: number;
  isSystem?: boolean;
}

interface DuplicateEntityRecord {
  entityId: string;
  name: string;
  reason: string;
}

interface PipelineOption {
  id: string;
  name: string;
}

interface StageOption {
  id: string;
  name: string;
  pipelineId?: string;
  order: number;
}

export default function NewEntityPage() {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspace, activeWorkspaceId, allowedWorkspaces } = useWorkspace();
  const { activeOrganizationId } = useTenant();
  const { singular, termStatus } = useTerminology();
  const { restrictToAssigned } = useWorkspaceVisibility();

  // Mode switcher: 'simple' (default) vs 'detailed'
  const [formMode, setFormMode] = React.useState<'simple' | 'detailed'>('simple');

  const [duplicateWarning, setDuplicateWarning] = React.useState<DuplicateEntityRecord[] | null>(null);
  const [pendingFormData, setPendingFormData] = React.useState<FormData | null>(null);
  const [isForceSubmitting, setIsForceSubmitting] = React.useState(false);
  const [isAiOpen, setIsAiOpen] = React.useState(false);
  const [pendingAiData, setPendingAiData] = React.useState<ExtractSchoolDataOutput | null>(null);
  const [isOverwriteAlertOpen, setIsOverwriteAlertOpen] = React.useState(false);
  const [isCustomVarsOpen, setIsCustomVarsOpen] = React.useState(false);

  const zonesQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(collection(firestore, 'zones'), where('organizationId', '==', activeOrganizationId), orderBy('name', 'asc'));
  }, [firestore, activeOrganizationId]);
  const { data: zones } = useCollection<Zone>(zonesQuery);

  const modulesQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(collection(firestore, 'modules'), where('organizationId', '==', activeOrganizationId), orderBy('order', 'asc'));
  }, [firestore, activeOrganizationId]);
  const { data: modules } = useCollection<Module>(modulesQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
        collection(firestore, 'users'), 
        where('organizationId', '==', activeOrganizationId),
        where('isAuthorized', '==', true)
    );
  }, [firestore, activeOrganizationId]);
  const { data: users, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

  const packagesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
        collection(firestore, 'subscription_packages'), 
        where('workspaceIds', 'array-contains', activeWorkspaceId),
        where('isActive', '==', true), 
        orderBy('name', 'asc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: packages } = useCollection<SubscriptionPackage>(packagesQuery);

  const fieldsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
        collection(firestore, 'app_fields'),
        where('workspaceId', '==', activeWorkspaceId),
        where('status', '==', 'active')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: appFields } = useCollection<AppFieldItem>(fieldsQuery);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
        collection(firestore, 'field_groups'),
        where('workspaceId', '==', activeWorkspaceId),
        orderBy('order', 'asc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: fieldGroups } = useCollection<FieldGroupItem>(groupsQuery);

  // Deal opportunity queries
  const pipelinesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'pipelines'), orderBy('name', 'asc'));
  }, [firestore]);
  const { data: pipelines } = useCollection<PipelineOption>(pipelinesQuery);

  const stagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'onboardingStages'), orderBy('order', 'asc'));
  }, [firestore]);
  const { data: stages } = useCollection<StageOption>(stagesQuery);

  // Deal opportunity state
  const [dealConfig, setDealConfig] = React.useState<DealConfig>({
    enabled: false,
    pipelineId: '',
    stageId: '',
    name: '',
    value: 0,
    expectedCloseDate: '',
    suppressAutomations: false,
  });

  const dealNameManuallyEdited = React.useRef(false);

  const setDealConfigPatch = React.useCallback((patch: Partial<DealConfig>) => {
    setDealConfig(prev => ({ ...prev, ...patch }));
  }, []);

  const methods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      initials: '',
      slogan: '',
      workspaceIds: [activeWorkspaceId],
      status: 'active',
      zone: UNASSIGNED_ZONE,
      location: {},
      locationString: '',
      workspaceTags: [],
      capacity: 0,

      entityContacts: [{ name: '', email: '', phone: '', typeKey: 'administrator', typeLabel: 'Administrator', isSignatory: true, isPrimary: true }],
      modules: [],
      assignedToId: 'unassigned',
      currency: 'GHS',
      subscriptionRate: 0,
      discountPercentage: 0,
      arrearsBalance: 0,
      creditBalance: 0,

      op_website: '',
      op_digitalAddress: '',
      op_googleMapLocation: '',
      op_googleBusinessProfile: '',
      op_facebook: '',
      op_whatsapp: '',
      op_linkedin: '',
      op_pinterest: '',
      op_instagram: '',
      op_tiktok: '',
      op_youtube: '',
      op_x: '',

      subscriptionPackageId: null,
      customData: {},
      currentNeeds: '',
      currentChallenges: '',
      interests: '',

      // Deal creation default values
      createDeal: false,
      dealPipelineId: '',
      dealStageId: '',
      dealName: '',
      dealValue: 0,
      dealExpectedCloseDate: '',
      dealSuppressAutomations: false,
    },
  });

  const watchName = methods.watch("name");
  const watchPackageId = methods.watch("subscriptionPackageId");

  const contactScope = activeWorkspace?.contactScope || 'institution';

  const customFieldGroups = React.useMemo(() => {
      if (!fieldGroups || !appFields) return [];
      
      return fieldGroups.map(group => {
          const groupFields = appFields.filter((f: AppFieldItem) => 
              f.groupId === group.id && 
              f.status === 'active' && 
              f.type !== 'hidden' &&
              (f.compatibilityScope?.includes('common') || f.compatibilityScope?.includes(contactScope))
          );
          
          return {
              ...group,
              fields: groupFields
          };
      }).filter(g => g.fields.length > 0 && !g.isSystem); // Only non-system groups for generic custom inputs
  }, [fieldGroups, appFields, contactScope]);

  // Auto-generate initials
  React.useEffect(() => {
    if (watchName && !methods.formState.dirtyFields.initials) {
        const initials = watchName.split(' ').map(word => word[0]).join('').toUpperCase();
        methods.setValue('initials', initials, { shouldValidate: true, shouldDirty: false });
    }
  }, [watchName, methods]);

  // Auto-sync deal name from entity name
  React.useEffect(() => {
    if (!dealNameManuallyEdited.current) {
      setDealConfig(prev => ({ ...prev, name: watchName || '' }));
    }
  }, [watchName]);

  // Sync local dealConfig into react-hook-form values for cross-field Zod validation
  React.useEffect(() => {
    methods.setValue('createDeal', dealConfig.enabled);
    methods.setValue('dealPipelineId', dealConfig.pipelineId);
    methods.setValue('dealStageId', dealConfig.stageId);
    methods.setValue('dealName', dealConfig.name);
    methods.setValue('dealValue', dealConfig.value);
    methods.setValue('dealExpectedCloseDate', dealConfig.expectedCloseDate);
    methods.setValue('dealSuppressAutomations', dealConfig.suppressAutomations);
  }, [dealConfig, methods]);

  React.useEffect(() => {
      if (user && methods.getValues('assignedToId') === 'unassigned') {
          methods.setValue('assignedToId', user.uid);
      }
  }, [user, methods]);

  const applyAiData = React.useCallback((result: ExtractSchoolDataOutput) => {
    if (!result) return;
    React.startTransition(() => {
      if (result.name) methods.setValue('name', result.name, { shouldDirty: true, shouldValidate: true });
      if (result.initials) methods.setValue('initials', result.initials, { shouldDirty: true });
      if (result.slogan) methods.setValue('slogan', result.slogan, { shouldDirty: true });
      if (typeof result.nominalRoll !== 'undefined') methods.setValue('capacity', result.nominalRoll, { shouldDirty: true });

      // Address & Location String
      if (result.location) {
        methods.setValue('locationString', result.location, { shouldDirty: true });
      }

      // Administrative Stakeholders mapping
      if (result.contacts && Array.isArray(result.contacts) && result.contacts.length > 0) {
        const mappedContacts = result.contacts.map((c, index: number) => ({
          name: c.name || '',
          email: c.email || '',
          phone: c.phone || '',
          typeKey: index === 0 ? 'administrator' : (c.role ? c.role.toLowerCase() : 'contact'),
          typeLabel: index === 0 ? 'Administrator' : (c.role || 'Contact'),
          isSignatory: index === 0,
          isPrimary: index === 0,
        }));
        methods.setValue('entityContacts', mappedContacts, { shouldDirty: true });
      }

      // Fuzzy matching for Geographic Zone — fall back to Unassigned on no match.
      if (result.location && zones) {
        const zoneName = result.location.toLowerCase();
        const matchedZone = zones.find((z: Zone) =>
          z.name.toLowerCase().includes(zoneName) || zoneName.includes(z.name.toLowerCase())
        );
        if (matchedZone) {
          methods.setValue(
            'zone',
            { id: matchedZone.id, name: matchedZone.name },
            { shouldDirty: true }
          );
        }
      }

      // Fuzzy matching for Modules (Interests)
      if (result.suggestedModuleNames && Array.isArray(result.suggestedModuleNames) && modules) {
        const matchedModules: Array<{ id: string; name: string; abbreviation: string; color: string }> = [];
        result.suggestedModuleNames.forEach((sName: string) => {
          const sNameLower = sName.toLowerCase();
          const match = modules.find((m: Module) =>
            m.name.toLowerCase().includes(sNameLower) || sNameLower.includes(m.name.toLowerCase())
          );
          if (match) {
            matchedModules.push({
              id: match.id,
              name: match.name,
              abbreviation: match.abbreviation || '',
              color: match.color || '#000000',
            });
          }
        });
        if (matchedModules.length > 0) {
          methods.setValue('modules', matchedModules, { shouldDirty: true });
        }
      }
    });
  }, [methods, zones, modules]);

  const handleAiDataExtracted = React.useCallback((result: ExtractSchoolDataOutput) => {
    if (!result) return;
    
    // Check if form is dirty
    const isDirty = Object.keys(methods.formState.dirtyFields).length > 0;
    if (isDirty) {
      setPendingAiData(result);
      setIsOverwriteAlertOpen(true);
    } else {
      applyAiData(result);
    }
  }, [methods.formState.dirtyFields, applyAiData]);

  const handleDiscountChange = (val: number) => {
    const pkg = packages?.find(p => p.id === watchPackageId);
    if (!pkg) return;
    const newRate = pkg.ratePerStudent * (1 - val / 100);
    methods.setValue('subscriptionRate', parseFloat(newRate.toFixed(2)), { shouldDirty: true });
  };

  const handleRateChange = (val: number) => {
    const pkg = packages?.find(p => p.id === watchPackageId);
    if (!pkg || pkg.ratePerStudent === 0) return;
    const newDiscount = ((pkg.ratePerStudent - val) / pkg.ratePerStudent) * 100;
    methods.setValue('discountPercentage', parseFloat(newDiscount.toFixed(2)), { shouldDirty: true });
  };

  const processSubmission = async (data: FormData, forceCreate = false) => {
    if (!firestore || !user || !users) return;

    if (forceCreate) setIsForceSubmitting(true);

    const contactScope = activeWorkspace?.contactScope || 'institution';
    const finalAssignedToId = restrictToAssigned ? (user?.uid || 'unassigned') : data.assignedToId;
    const selectedManager = users.find(u => u.id === finalAssignedToId);
    const assignedTo = selectedManager 
        ? { userId: selectedManager.id, name: selectedManager.name, email: selectedManager.email }
        : { userId: null, name: 'Unassigned', email: null };

    const selectedPackage = packages?.find(p => p.id === data.subscriptionPackageId);

    // Build Polymorphic Payload based on workspace scope
    const entityPayload: Record<string, unknown> = {
        name: data.name,
        entityContacts: data.entityContacts || [],
        status: data.status,
        location: { ...data.location, zone: zoneOrUnassigned(data.zone), locationString: data.locationString },
        workspaceTags: data.workspaceTags || [],
        assignedTo,
        primaryEmail: (data.entityContacts || []).find(c => c.isPrimary)?.email || (data.entityContacts || []).find(c => c.isSignatory)?.email || '',
        primaryPhone: (data.entityContacts || []).find(c => c.isPrimary)?.phone || (data.entityContacts || []).find(c => c.isSignatory)?.phone || '',
        customData: data.customData || {},
        currentNeeds: data.currentNeeds || undefined,
        currentChallenges: data.currentChallenges || undefined,
        interests: data.interests || undefined,
    };

    if (contactScope === 'institution') {
      // New schema: write to root fields + financeData + interests
      entityPayload.initials = data.initials;
      entityPayload.slogan = data.slogan;
      entityPayload.logoUrl = data.logoUrl;
      entityPayload.heroImageUrl = data.heroImageUrl;
      entityPayload.interests = data.modules;
      entityPayload.financeData = {
        billingAddress: data.billingAddress,
        currency: data.currency,
        subscriptionPackageId: data.subscriptionPackageId || null,
        subscriptionPackageName: selectedPackage ? selectedPackage.name : 'Standard',
        subscriptionRate: data.subscriptionRate,
        discountPercentage: data.discountPercentage,
        arrearsBalance: data.arrearsBalance || 0,
        creditBalance: data.creditBalance || 0,
      };
      entityPayload.industryData = {
        capacity: data.capacity ?? 0,
      };
      entityPayload.onlinePresence = {
        ...(data.op_website ? { website: data.op_website } : {}),
        ...(data.op_digitalAddress ? { digitalAddress: data.op_digitalAddress } : {}),
        ...(data.op_googleMapLocation ? { googleMapLocation: data.op_googleMapLocation } : {}),
        ...(data.op_googleBusinessProfile ? { googleBusinessProfile: data.op_googleBusinessProfile } : {}),
        ...(data.op_facebook ? { facebook: data.op_facebook } : {}),
        ...(data.op_whatsapp ? { whatsapp: data.op_whatsapp } : {}),
        ...(data.op_linkedin ? { linkedin: data.op_linkedin } : {}),
        ...(data.op_pinterest ? { pinterest: data.op_pinterest } : {}),
        ...(data.op_instagram ? { instagram: data.op_instagram } : {}),
        ...(data.op_tiktok ? { tiktok: data.op_tiktok } : {}),
        ...(data.op_youtube ? { youtube: data.op_youtube } : {}),
        ...(data.op_x ? { x: data.op_x } : {}),
      };
    } else if (contactScope === 'person') {
      entityPayload.personData = {
        firstName: data.firstName || data.name.split(' ')[0] || '',
        lastName: data.lastName || data.name.split(' ').slice(1).join(' ') || '',
        company: data.company || '',
        jobTitle: data.jobTitle || '',
        leadSource: data.leadSource || '',
      };
    } else if (contactScope === 'family') {
      // For family, derive guardian from contacts
      const primaryContact = (data.entityContacts || []).find(c => c.isPrimary) || (data.entityContacts || [])[0];
      entityPayload.familyData = {
        guardians: primaryContact ? [{
          name: primaryContact.name,
          phone: primaryContact.phone || '',
          email: primaryContact.email || '',
          relationship: 'Guardian',
          isPrimary: true,
        }] : [],
        children: [],
      };
    }

    try {
      const result = await createEntityAction({
          data: entityPayload,
          workspaceId: activeWorkspaceId,
          entityType: (contactScope as EntityType) || 'institution',
          forceCreate,
      });
      
      if (result.success) {
        // Create Deal Opportunity if enabled (Phase 1 / Risk 7 implementation)
        if (dealConfig.enabled) {
          const selectedStage = stages?.find(s => s.id === dealConfig.stageId);
          const dealResult = await createDeal({
            entityId: result.id!,
            pipelineId: dealConfig.pipelineId,
            stageId: dealConfig.stageId,
            stageName: selectedStage?.name || '',
            name: dealConfig.name || data.name,
            value: dealConfig.value || 0,
            expectedCloseDate: dealConfig.expectedCloseDate || null,
            workspaceId: activeWorkspaceId,
            organizationId: activeOrganizationId || 'smartsapp-hq',
            assignedTo,
            suppressAutomations: dealConfig.suppressAutomations,
          }).catch(err => ({ error: err.message }));

          if (dealResult.error) {
            toast({
              variant: 'destructive',
              title: 'Deal Not Created',
              description: 'Entity saved. The deal could not be added — try from the Pipeline view.'
            });
          }
        }

        toast({ title: 'Record Initialized', description: `${data.name} created successfully.` });
        router.push('/admin/entities');
      } else if (result.isDuplicate) {
        setDuplicateWarning(result.duplicates ?? []);
        setPendingFormData(data);
      } else {
        throw new Error(result.error || `Failed to create ${singular.toLowerCase()}`);
      }
    } catch (error: unknown) {
      toast({ 
        title: 'Save Failed', 
        description: getErrorMessage(error) || `An error occurred while creating the ${singular.toLowerCase()}`,
        variant: 'destructive'
      });
      console.error('Entity creation error:', error);
    } finally {
      if (forceCreate) setIsForceSubmitting(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    await processSubmission(data, false);
  };

  const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

  return (
    <div className="h-full overflow-y-auto text-left">
      <div className="space-y-8 p-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl border border-border/50 bg-background/50 hover:bg-accent hover:text-accent-foreground active:scale-[0.97] transition-all shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Create New {singular}</h1>
              <CardInfoTooltip text={`Set up metadata, location, and administrative stakeholders for this new ${singular.toLowerCase()}.`} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Simple vs Detailed Mode Switcher */}
            <div className="inline-flex items-center p-1 bg-muted/40 border border-border/40 rounded-xl" role="tablist" aria-label="Creation view complexity">
              <Button
                type="button"
                variant={formMode === 'simple' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFormMode('simple')}
                className={cn(
                  "h-9 px-3.5 rounded-lg text-xs font-semibold transition-all min-h-[36px]",
                  formMode === 'simple' 
                    ? "bg-background text-foreground shadow-sm hover:bg-background" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                role="tab"
                aria-selected={formMode === 'simple'}
              >
                Simple {singular}
              </Button>
              <Button
                type="button"
                variant={formMode === 'detailed' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFormMode('detailed')}
                className={cn(
                  "h-9 px-3.5 rounded-lg text-xs font-semibold transition-all min-h-[36px]",
                  formMode === 'detailed' 
                    ? "bg-background text-foreground shadow-sm hover:bg-background" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                role="tab"
                aria-selected={formMode === 'detailed'}
              >
                Detailed {singular}
              </Button>
            </div>

            <Button
              type="button"
              onClick={() => setIsAiOpen(true)}
              className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 px-5 py-2.5 h-10 min-h-[44px] gap-2 active:scale-[0.97]"
            >
              <Sparkles className="h-4 w-4 animate-pulse text-white" />
              AI Architect Fill
            </Button>
          </div>
        </div>

        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8 pb-24 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
              <div className="lg:col-span-2 space-y-8 text-left">
                {/* 1. {singular} Details (was General Identity) */}
                <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
                  <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                    <div className="flex items-center justify-between text-left">
                      <div className="flex items-center gap-2 text-left">
                        <Building className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-semibold tracking-tight">{singular} Details</CardTitle>
                      </div>
                      <CardInfoTooltip text={`Core identity, registration status, branding, and tags for this ${singular.toLowerCase()}.`} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-8 text-left">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                      <FormField control={methods.control} name="name" render={({ field }) => (
                        <FormItem className="md:col-span-2 text-left">
                          <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Official Name</FormLabel>
                          <FormControl>
                            <Input placeholder={`${singular} name...`} {...field} className="h-12 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-bold text-lg" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={methods.control} name="initials" render={({ field }) => (
                        <FormItem className="text-left">
                          <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Initials</FormLabel>
                          <FormControl>
                            <Input {...field} className="h-12 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-semibold text-center" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                      <FormField control={methods.control} name="status" render={({ field }) => (
                        <FormItem className="text-left">
                          <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">{termStatus}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 transition-colors hover:border-border/60 font-bold">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-xl shadow-2xl border-none">
                              <SelectItem value="active" className="font-bold">Active</SelectItem>
                              <SelectItem value="inactive" className="font-bold">Inactive</SelectItem>
                              <SelectItem value="archived" className="font-bold">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="space-y-2 text-left">
                      <Label className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left flex items-center gap-2">
                        <Camera className="h-3 w-3" /> {singular} Logo
                      </Label>
                      <Controller 
                        name="logoUrl"
                        control={methods.control}
                        render={({ field }) => (
                          <MediaSelect {...field} filterType="image" className="rounded-2xl" />
                        )}
                      />
                    </div>

                    <div className="space-y-2 text-left">
                      <Label className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Vision / Motto</Label>
                      <FormField control={methods.control} name="slogan" render={({ field }) => (
                        <FormItem className="text-left">
                          <FormControl>
                            <Input placeholder="e.g. Forward Ever" {...field} className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium italic" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="space-y-2 text-left pt-4">
                      <Label className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Tags & Categories</Label>
                      <FormField control={methods.control} name="workspaceTags" render={({ field }) => (
                        <FormItem className="text-left">
                          <FormControl>
                            <TagSelector currentTagIds={field.value || []} onTagsChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </CardContent>
                </Card>

                {/* 2. {singular} Stakeholders / Contacts (was Administrative Stakeholders) */}
                <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
                  <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                    <div className="flex items-center justify-between text-left">
                      <div className="flex items-center gap-2 text-left">
                        <User className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-semibold tracking-tight">{singular} Stakeholders / Contacts</CardTitle>
                      </div>
                      <CardInfoTooltip text={`Primary administrative, financial, and executive contacts associated with this ${singular.toLowerCase()}.`} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 text-left">
                    <EntityContactManager />
                  </CardContent>
                </Card>

                {/* 3. {singular} Location Details (was Regional Metadata) */}
                <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
                  <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                    <div className="flex items-center justify-between text-left">
                      <div className="flex items-center gap-2 text-left">
                        <MapPin className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-semibold tracking-tight">{singular} Location Details</CardTitle>
                      </div>
                      <CardInfoTooltip text={`Geographic zone, regional territory, and physical address for this ${singular.toLowerCase()}.`} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6 text-left">
                    <FormField control={methods.control} name="zone" render={({ field, fieldState }) => (
                      <FormItem className="text-left">
                        <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Geographic Zone</FormLabel>
                        <FormControl>
                          <ZoneSelect value={field.value} onValueChange={field.onChange} error={!!fieldState.error} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} /> 
                    <FormField control={methods.control} name="location" render={({ field }) => (
                      <FormItem className="text-left">
                        <FormControl>
                          <LocationCascade 
                            value={field.value || {}} 
                            onChange={field.onChange} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={methods.control} name="locationString" render={({ field }) => (
                      <FormItem className="text-left">
                        <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Descriptive Physical Address</FormLabel>
                        <FormControl>
                          <Textarea {...field} className="min-h-[80px] rounded-xl bg-muted/30 border border-border/40 shadow-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 text-sm p-4" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} /> 
                  </CardContent>
                </Card>

                {/* 4. Interests Card */}
                <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
                  <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                    <div className="flex items-center justify-between text-left">
                      <div className="flex items-center gap-2 text-left">
                        <Plus className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-semibold tracking-tight">Interests</CardTitle>
                      </div>
                      <CardInfoTooltip text={`Identify the specific interests and focus areas for this ${singular.toLowerCase()}.`} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6 text-left">
                    <FormField control={methods.control} name="modules" render={({ field }) => (
                      <FormItem className="text-left">
                        <FormLabel className="text-[10px] font-semibold text-muted-foreground/50 ml-1 text-left">Specific Interests</FormLabel>
                        <FormControl>
                          <ModuleSelect 
                            {...field} 
                            workspaceIds={methods.watch('workspaceIds') || (activeWorkspaceId ? [activeWorkspaceId] : [])}
                            organizationId={activeOrganizationId}
                          />
                        </FormControl>
                        <FormDescription className="text-[9px] font-bold opacity-60 text-left">Identify the specific interests for this workspace.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={methods.control} name="interests" render={({ field }) => (
                      <FormItem className="text-left">
                        <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Interests (Text)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. Technology, Sports, Arts..." className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium" />
                        </FormControl>
                        <FormDescription className="text-[9px] font-bold opacity-60 text-left">Comma-separated list of areas of interest.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                {/* 5. Detailed Mode: Advanced Cards */}
                {formMode === 'detailed' && (
                  <>
                    {/* Current Situation Card */}
                    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
                      <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                        <div className="flex items-center justify-between text-left">
                          <div className="flex items-center gap-2 text-left">
                            <Target className="h-4 w-4 text-amber-600" />
                            <CardTitle className="text-sm font-semibold tracking-tight">Current Situation</CardTitle>
                          </div>
                          <CardInfoTooltip text={`Current operational needs, key challenges, and pain points faced by this ${singular.toLowerCase()}.`} />
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6 text-left">
                        <FormField control={methods.control} name="currentNeeds" render={({ field }) => (
                          <FormItem className="text-left">
                            <FormLabel className="text-[10px] font-semibold text-amber-600 ml-1 text-left">Current Needs</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="What is this entity actively looking for or needing right now?" className="min-h-[90px] rounded-xl bg-muted/30 border border-border/40 shadow-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 text-sm p-4" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={methods.control} name="currentChallenges" render={({ field }) => (
                          <FormItem className="text-left">
                            <FormLabel className="text-[10px] font-semibold text-rose-600 ml-1 text-left">Current Challenges</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="What pain points or obstacles is this entity facing?" className="min-h-[90px] rounded-xl bg-muted/30 border border-border/40 shadow-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 text-sm p-4" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </CardContent>
                    </Card>

                    {/* Financial Configuration Card */}
                    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
                      <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                        <div className="flex items-center justify-between text-left">
                          <div className="flex items-center gap-2 text-left">
                            <Banknote className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm font-semibold tracking-tight">Financial Configuration</CardTitle>
                          </div>
                          <CardInfoTooltip text={`Subscription package tier, billing rates, currency, capacity, and account balances.`} />
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-8 text-left">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                          <FormField control={methods.control} name="subscriptionPackageId" render={({ field, fieldState }) => (
                            <FormItem className="text-left">
                              <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Subscription Tier</FormLabel>
                              <FormControl>
                                <PackageSelect 
                                  value={field.value || 'none'} 
                                  onValueChange={(val, pkg) => {
                                    field.onChange(val);
                                    if (pkg) {
                                      methods.setValue('subscriptionRate', pkg.ratePerStudent, { shouldDirty: true });
                                      methods.setValue('discountPercentage', 0, { shouldDirty: true });
                                    }
                                  }}
                                  error={!!fieldState.error}
                                />
                              </FormControl>
                            </FormItem>
                          )} />
                          <FormField control={methods.control} name="currency" render={({ field }) => (
                            <FormItem className="text-left">
                              <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Billing Currency</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-12 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 transition-colors hover:border-border/60 font-bold">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl shadow-2xl border-none">
                                  <SelectItem value="GHS" className="font-semibold">Ghanaian Cedi (GH¢)</SelectItem>
                                  <SelectItem value="USD" className="font-semibold">US Dollar ($)</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                        </div>

                        {/* Rate and Discount Adjustment */}
                        <div className={cn(
                          "p-6 rounded-[1.5rem] border-2 border-dashed transition-all duration-500 text-left",
                          watchPackageId && watchPackageId !== 'none' ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border opacity-40 pointer-events-none"
                        )}>
                          <div className="flex items-center gap-3 mb-6 text-left">
                            <div className="p-2 bg-primary text-white rounded-lg shadow-sm text-left"><Target className="h-4 w-4" /></div>
                            <p className="text-[10px] font-semibold text-primary text-left">Rate Optimization Engine</p>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                            <FormField control={methods.control} name="discountPercentage" render={({ field }) => (
                              <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-1.5 text-left"><Percent className="h-3 w-3" /> Preferred Grant</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    {...field} 
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      field.onChange(val);
                                      handleDiscountChange(val);
                                    }}
                                    className="h-12 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-semibold text-xl text-center" 
                                  />
                                </FormControl>
                                <FormDescription className="text-[9px] font-bold tracking-tighter opacity-60 text-left">Grant a reduction for this record</FormDescription>
                              </FormItem>
                            )} />
                            <FormField control={methods.control} name="subscriptionRate" render={({ field }) => (
                              <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-1.5 text-left"><Banknote className="h-3 w-3" /> Expected Net Rate</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    {...field} 
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      field.onChange(val);
                                      handleRateChange(val);
                                    }}
                                    className="h-12 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-semibold text-xl text-center" 
                                  />
                                </FormControl>
                                <FormDescription className="text-[9px] font-bold tracking-tighter opacity-60 text-left">Effective rate billed per unit</FormDescription>
                              </FormItem>
                            )} />
                          </div>
                        </div>

                        <FormField control={methods.control} name="billingAddress" render={({ field }) => (
                          <FormItem className="text-left">
                            <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Detailed Billing Address</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Specific address for financial documents..." className="min-h-[100px] rounded-xl bg-muted/30 border border-border/40 shadow-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        {/* Capacity & Ledger */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                          <FormField control={methods.control} name="capacity" render={({ field }) => (
                            <FormItem className="text-left">
                              <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 flex items-center gap-1.5 text-left"><Hash className="h-3 w-3" /> Capacity</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-semibold text-center" />
                              </FormControl>
                              <FormDescription className="text-[9px] font-bold opacity-60 text-left">Total unit capacity</FormDescription>
                            </FormItem>
                          )} />
                          <FormField control={methods.control} name="arrearsBalance" render={({ field }) => (
                            <FormItem className="text-left">
                              <FormLabel className="text-[10px] font-semibold text-rose-500 ml-1 flex items-center gap-1.5 text-left"><Wallet className="h-3 w-3" /> Arrears</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" {...field} className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-semibold text-center" />
                              </FormControl>
                              <FormDescription className="text-[9px] font-bold opacity-60 text-left">Outstanding balance owed</FormDescription>
                            </FormItem>
                          )} />
                          <FormField control={methods.control} name="creditBalance" render={({ field }) => (
                            <FormItem className="text-left">
                              <FormLabel className="text-[10px] font-semibold text-emerald-600 ml-1 flex items-center gap-1.5 text-left"><CreditCard className="h-3 w-3" /> Credit</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" {...field} className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-semibold text-center" />
                              </FormControl>
                              <FormDescription className="text-[9px] font-bold opacity-60 text-left">Advance credit on file</FormDescription>
                            </FormItem>
                          )} />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Online Presence Card */}
                    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
                      <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                        <div className="flex items-center justify-between text-left">
                          <div className="flex items-center gap-2 text-left">
                            <Globe className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm font-semibold tracking-tight">Online Presence</CardTitle>
                          </div>
                          <CardInfoTooltip text={`Website, digital mapping coordinates, and official social media profiles.`} />
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6 text-left">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                          <FormField control={methods.control} name="op_website" render={({ field }) => (
                            <FormItem className="text-left">
                              <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 flex items-center gap-1.5 text-left"><Globe className="h-3 w-3" /> Website</FormLabel>
                              <FormControl><Input {...field} placeholder="https://example.com" className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={methods.control} name="op_digitalAddress" render={({ field }) => (
                            <FormItem className="text-left">
                              <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 flex items-center gap-1.5 text-left"><Hash className="h-3 w-3" /> Digital Address</FormLabel>
                              <FormControl><Input {...field} placeholder="e.g. GA-000-0000" className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={methods.control} name="op_googleMapLocation" render={({ field }) => (
                            <FormItem className="text-left">
                              <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 flex items-center gap-1.5 text-left"><MapPin className="h-3 w-3" /> Google Map Link</FormLabel>
                              <FormControl><Input {...field} placeholder="https://maps.google.com/..." className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={methods.control} name="op_googleBusinessProfile" render={({ field }) => (
                            <FormItem className="text-left">
                              <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 flex items-center gap-1.5 text-left"><Network className="h-3 w-3" /> Google Business</FormLabel>
                              <FormControl><Input {...field} placeholder="Google Business Profile URL" className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>

                        <div className="pt-2">
                          <Label className="text-[10px] font-semibold text-muted-foreground/60 ml-1 flex items-center gap-1.5 text-left mb-4"><Share2 className="h-3 w-3" /> Social Media</Label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                            <FormField control={methods.control} name="op_facebook" render={({ field }) => (
                              <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Facebook</FormLabel>
                                <FormControl><Input {...field} placeholder="Facebook page URL" className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium" /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={methods.control} name="op_whatsapp" render={({ field }) => (
                              <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">WhatsApp</FormLabel>
                                <FormControl><Input {...field} placeholder="WhatsApp number or link" className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium" /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={methods.control} name="op_instagram" render={({ field }) => (
                              <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Instagram</FormLabel>
                                <FormControl><Input {...field} placeholder="Instagram profile URL" className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium" /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={methods.control} name="op_linkedin" render={({ field }) => (
                              <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">LinkedIn</FormLabel>
                                <FormControl><Input {...field} placeholder="LinkedIn page URL" className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium" /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={methods.control} name="op_x" render={({ field }) => (
                              <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">X (Twitter)</FormLabel>
                                <FormControl><Input {...field} placeholder="X profile URL" className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium" /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={methods.control} name="op_youtube" render={({ field }) => (
                              <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">YouTube</FormLabel>
                                <FormControl><Input {...field} placeholder="YouTube channel URL" className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium" /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={methods.control} name="op_tiktok" render={({ field }) => (
                              <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">TikTok</FormLabel>
                                <FormControl><Input {...field} placeholder="TikTok profile URL" className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium" /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={methods.control} name="op_pinterest" render={({ field }) => (
                              <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Pinterest</FormLabel>
                                <FormControl><Input {...field} placeholder="Pinterest profile URL" className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-medium" /></FormControl>
                              </FormItem>
                            )} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Dynamic Custom Field Groups */}
                    {customFieldGroups.map((group) => (
                      <Card key={group.id} className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
                        <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                          <div className="flex items-center justify-between text-left">
                            <div className="flex items-center gap-2 text-left">
                              <Layout className="h-4 w-4 text-primary" />
                              <CardTitle className="text-sm font-semibold tracking-tight">{group.name}</CardTitle>
                            </div>
                            <CardInfoTooltip text={`Custom fields configured under the ${group.name} group.`} />
                          </div>
                        </CardHeader>
                        <CardContent className="p-6 text-left grid grid-cols-1 md:grid-cols-2 gap-6">
                          {group.fields.map((field: AppFieldItem) => (
                            <FormField key={field.id} control={methods.control} name={`customData.${field.variableName}`} render={({ field: formField }) => (
                              <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">{field.label}</FormLabel>
                                <FormControl>
                                  {field.type === 'long_text' ? (
                                    <Textarea {...formField} value={typeof formField.value === 'string' ? formField.value : ''} placeholder={field.placeholder || ''} className="min-h-[80px] rounded-xl bg-muted/30 border border-border/40 shadow-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 text-sm p-4 text-left" />
                                  ) : (field.type === 'select' || field.type === 'dropdown') ? (
                                    <Select onValueChange={formField.onChange} value={typeof formField.value === 'string' ? formField.value : ''}>
                                      <FormControl>
                                        <SelectTrigger className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 transition-colors hover:border-border/60 font-semibold text-left">
                                          <SelectValue placeholder={field.placeholder || "Select option..."} />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent className="rounded-xl shadow-2xl border-none">
                                        {(field.options || []).map((opt: { label: string; value: string }) => (
                                          <SelectItem key={opt.value} value={opt.value} className="font-semibold">
                                            {opt.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : field.type === 'multi_select' ? (
                                    <MultiSelect
                                      options={(field.options || []).map((opt: { label: string; value: string }) => ({ label: opt.label, value: opt.value }))}
                                      value={Array.isArray(formField.value) ? (formField.value as string[]) : []}
                                      onChange={formField.onChange}
                                      placeholder={field.placeholder || "Select options..."}
                                    />
                                  ) : (
                                    <Input
                                      {...formField}
                                      value={typeof formField.value === 'string' || typeof formField.value === 'number' ? formField.value : ''}
                                      type={
                                        field.type === 'number' || field.type === 'currency'
                                          ? 'number'
                                          : field.type === 'date'
                                          ? 'date'
                                          : field.type === 'datetime'
                                          ? 'datetime-local'
                                          : field.type === 'email'
                                          ? 'email'
                                          : field.type === 'phone'
                                          ? 'tel'
                                          : field.type === 'url'
                                          ? 'url'
                                          : 'text'
                                      }
                                      placeholder={field.placeholder || ''}
                                      className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 font-semibold text-left"
                                    />
                                  )}
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}

                {/* 6. Simple Mode Hint / Toggle Banner */}
                {formMode === 'simple' && (
                  <div className="p-5 rounded-2xl bg-muted/20 border border-dashed border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">Need to configure financial tiers, online presence, or deal pipelines?</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Switch to Detailed {singular} mode anytime without losing any of your current progress.</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormMode('detailed')}
                      className="rounded-xl font-semibold text-xs min-h-[38px] px-4 active:scale-[0.97] shrink-0 self-start sm:self-auto border-border/60 hover:bg-background"
                    >
                      Detailed {singular} View
                    </Button>
                  </div>
                )}
              </div>

              {/* Right Sidebar: Operations */}
              <div className="space-y-8 text-left">
                {/* 1. Link to Workspace (was Hub Authorization) */}
                <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
                  <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                    <div className="flex items-center justify-between text-left">
                      <div className="flex items-center gap-2 text-left">
                        <Layout className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-semibold tracking-tight">Link to Workspace</CardTitle>
                      </div>
                      <CardInfoTooltip text={`Select the workspaces where this ${singular.toLowerCase()} record will be shared and accessible across directories and pipelines.`} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4 text-left">
                    <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2 text-left">
                      <Zap className="h-3 w-3" /> Targeted Workspaces
                    </Label>
                    <Controller 
                      name="workspaceIds"
                      control={methods.control}
                      render={({ field }) => (
                        <MultiSelect 
                          options={workspaceOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Assign to hubs..."
                        />
                      )}
                    />
                  </CardContent>
                </Card>

                {/* 2. Account Ownership -> {singular} Assigned To */}
                <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
                  <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                    <div className="flex items-center justify-between text-left">
                      <div className="flex items-center gap-2 text-left">
                        <UserCheck className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-semibold tracking-tight">{singular} Assigned To</CardTitle>
                      </div>
                      <CardInfoTooltip text={`Designate the primary representative or account manager responsible for this ${singular.toLowerCase()}.`} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 text-left">
                    <FormField control={methods.control} name="assignedToId" render={({ field, fieldState }) => (
                      <FormItem className="text-left">
                        <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Primary Representative</FormLabel>
                        <FormControl>
                          <ManagerSelect 
                            value={field.value} 
                            onValueChange={field.onChange}
                            error={!!fieldState.error}
                            disabled={restrictToAssigned}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                {/* 3. Detailed mode only: Custom Variables for Messaging */}
                {formMode === 'detailed' && (
                  <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
                    <CardHeader
                      className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left cursor-pointer select-none"
                      onClick={() => setIsCustomVarsOpen(prev => !prev)}
                    >
                      <div className="flex items-center justify-between text-left">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm font-semibold tracking-tight">Custom Variables for Messaging</CardTitle>
                          <CardInfoTooltip text={`These variables are available in messaging templates when sending to this ${singular.toLowerCase()}.`} />
                        </div>
                        <ChevronDown className={cn('h-4 w-4 text-muted-foreground/60 transition-transform duration-200', isCustomVarsOpen && 'rotate-180')} />
                      </div>
                    </CardHeader>
                    {isCustomVarsOpen && (
                      <CardContent className="p-6 space-y-3 text-left">
                        {appFields && appFields.length > 0 ? (
                          <>
                            <div className="space-y-2">
                              {appFields.filter((f: AppFieldItem) => f.status === 'active' && f.variableName).map((field: AppFieldItem) => (
                                <div key={field.id} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-xl bg-muted/30 border border-border/30">
                                  <span className="text-[10px] font-medium text-muted-foreground/80 truncate">{field.label}</span>
                                  <Badge variant="secondary" className="text-[8px] font-mono px-2 py-0.5 rounded-lg bg-primary/10 text-primary border-none shrink-0">
                                    {`{{${field.variableName}}}`}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                            <p className="text-[8px] text-muted-foreground/50 leading-relaxed mt-2">
                              These variables are available in messaging templates when sending to this entity.
                            </p>
                          </>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/50">No custom variables configured</p>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* 4. Detailed mode only: Deal Opportunity integration card */}
                {formMode === 'detailed' && (
                  <DealOpportunityCard
                    config={dealConfig}
                    onChange={setDealConfigPatch}
                    pipelines={pipelines || []}
                    stages={stages || []}
                    dealNameManuallyEdited={dealNameManuallyEdited}
                  />
                )}

                {/* 5. Sticky Primary Submit Action */}
                <div className="pt-4 sticky top-24 text-left">
                  <Button type="submit" className="w-full h-14 rounded-2xl font-semibold text-lg shadow-xl gap-3 transition-all active:scale-95 text-left" disabled={methods.formState.isSubmitting || isUsersLoading || isForceSubmitting}>
                    {(methods.formState.isSubmitting || isForceSubmitting) ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <Building className="mr-3 h-6 w-6" />} Initialize {singular}
                  </Button>
                </div>
              </div>
            </div>

</form>
         </FormProvider>

         <AlertDialog open={!!duplicateWarning} onOpenChange={(open) => !open && setDuplicateWarning(null)}>
           <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
             <AlertDialogHeader>
               <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                 <AlertTriangle className="h-5 w-5" /> Potential Duplicate Found
               </AlertDialogTitle>
               <AlertDialogDescription asChild>
                  <div className="space-y-4 text-sm text-muted-foreground">
                    <p>
                      We found existing records that match the name, email, or phone number of the {singular.toLowerCase()} you are trying to create.
                    </p>
                    <div className="bg-muted/50 p-4 rounded-xl max-h-40 overflow-y-auto space-y-2 text-sm text-left">
                      {duplicateWarning?.map((dup: DuplicateEntityRecord) => (
                        <div key={dup.entityId} className="flex flex-col">
                          <span className="font-semibold text-foreground">{dup.name}</span>
                          <span className="text-muted-foreground text-xs font-mono">{dup.reason}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs font-medium">
                      Since a contact person can own multiple {singular.toLowerCase()}s, you may proceed if this is intentional. Do you want to ignore this warning and create it anyway?
                    </p>
                  </div>
                </AlertDialogDescription>
             </AlertDialogHeader>
             <AlertDialogFooter>
               <AlertDialogCancel className="rounded-xl border-border">Cancel</AlertDialogCancel>
               <AlertDialogAction 
                 className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md"
                 onClick={() => {
                   setDuplicateWarning(null);
                   if (pendingFormData) processSubmission(pendingFormData, true);
                 }}
               >
                 Ignore & Create
               </AlertDialogAction>
             </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AiArchitectDialog
            isOpen={isAiOpen}
            onClose={() => setIsAiOpen(false)}
            onDataExtracted={handleAiDataExtracted}
          />

          <AlertDialog open={isOverwriteAlertOpen} onOpenChange={setIsOverwriteAlertOpen}>
            <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" /> Overwrite Form Data?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      You have already entered some data in the form. Extracting data via the AI Architect will overwrite existing fields.
                    </p>
                    <p className="text-xs font-medium">
                      Are you sure you want to proceed and overwrite the current form inputs?
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl border-border">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md"
                  onClick={() => {
                    setIsOverwriteAlertOpen(false);
                    if (pendingAiData) {
                      applyAiData(pendingAiData);
                      setPendingAiData(null);
                    }
                  }}
                >
                  Overwrite
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
     </div>
  );
}
