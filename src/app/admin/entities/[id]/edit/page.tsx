'use client';

import * as React from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Building, MapPin, User, Plus, UserCheck, ShieldCheck, Banknote, CreditCard, Wallet, Percent, Target, Zap, Layout, Camera, Share2, Globe, Hash, Network, Phone as PhoneIcon } from 'lucide-react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { doc, updateDoc, collection, query, orderBy, where } from 'firebase/firestore';

import type { Entity, WorkspaceEntity, UserProfile, SubscriptionPackage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useDoc, useMemoFirebase, useUser, useCollection } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { ModuleSelect } from '../../components/ModuleSelect';
import { ZoneSelect } from '../../components/ZoneSelect';
import { LocationCascade, type LocationValue } from '@/components/location/LocationCascade';
import { EntityContactManager } from '../../components/EntityContactManager';
import { ManagerSelect } from '../../components/ManagerSelect';
import { PackageSelect } from '../../components/PackageSelect';
import { MediaSelect } from '../../components/media-select';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { updateEntityAction } from '@/lib/entity-actions';
import { useTerminology } from '@/hooks/use-terminology';
import EntityNotesTab from '../../components/EntityNotesTab';
import { TagSelector } from '@/components/tags/TagSelector';

const entityEditSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  initials: z.string().optional(),
  slogan: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']),
  lifecycleStatus: z.string().min(1, 'Status is required.'),
  logoUrl: z.string().url().optional().or(z.literal('')),
  heroImageUrl: z.string().url().optional().or(z.literal('')),
  zone: z.object({
    id: z.string().min(1, 'Please select a zone.'),
    name: z.string(),
  }, { required_error: 'Please assign a geographic zone.' }),
  locationString: z.string().optional(),
  capacity: z.coerce.number().optional(),
  workspaceTags: z.array(z.string()).optional().default([]),
  currentNeeds: z.string().optional(),
  currentChallenges: z.string().optional(),
  interests: z.string().optional(),
  customData: z.record(z.any()).optional(),
  entityContacts: z.array(z.object({
    name: z.string().min(2, 'Name required.'),
    email: z.string().email('Invalid email.').optional().or(z.literal('')),
    phone: z.string().min(10, 'Invalid phone.').optional().or(z.literal('')),
    typeKey: z.string().min(1, 'Role required.'),
    typeLabel: z.string().min(1, 'Role label required.'),
    isSignatory: z.boolean().default(false),
    isPrimary: z.boolean().default(false),
  })).min(1, 'At least one contact is required.')
    .refine(people => people.filter(p => p.isSignatory).length === 1, { message: 'Exactly one signatory must be selected.' })
    .refine(people => people.filter(p => p.isPrimary).length === 1, { message: 'Exactly one primary contact must be selected.' }),
  modules: z.array(z.object({
    id: z.string(),
    name: z.string(),
    abbreviation: z.string(),
    color: z.string(),
  })).optional(),
  assignedToId: z.string().min(1, 'Please select an account manager.'),
  // Billing Fields
  billingAddress: z.string().optional(),
  currency: z.string().default('GHS'),
  subscriptionPackageId: z.string().optional(),
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
});

type EntityEditValues = z.infer<typeof entityEditSchema>;

interface EditFormProps {
  entityId: string;
}

function EditEntityForm({ entityId }: EditFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspace, activeWorkspaceId } = useWorkspace();
  const { activeOrganizationId, activeOrganization } = useTenant();
  const { singular, updateStatus, termStatus } = useTerminology();

  const [hasInitialized, setHasInitialized] = React.useState(false);
  const [locationValue, setLocationValue] = React.useState<LocationValue>({});
  const defaultCountryId = activeOrganization?.defaultCountryId || 'GH';

  // 1. Subscribe to Global Entity
  const entityDocRef = useMemoFirebase(() => {
    if (!firestore || !entityId) return null;
    return doc(firestore, 'entities', entityId);
  }, [firestore, entityId]);
  const { data: entityData, isLoading: isLoadingEntity } = useDoc<Entity>(entityDocRef);

  // 2. Subscribe to Workspace Entity
  const workspaceEntityId = `${activeWorkspaceId}_${entityId}`;
  const weDocRef = useMemoFirebase(() => {
      if (!firestore || !activeWorkspaceId || !entityId) return null;
      return doc(firestore, 'workspace_entities', workspaceEntityId);
  }, [firestore, activeWorkspaceId, entityId]);
  const { data: weData, isLoading: isLoadingWE } = useDoc<WorkspaceEntity>(weDocRef);

  useSetBreadcrumb(entityData?.name || weData?.displayName, pathname.replace('/edit', ''));

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
        collection(firestore, 'users'), 
        where('organizationId', '==', activeOrganizationId),
        where('isAuthorized', '==', true), 
        orderBy('name', 'asc')
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
  const { data: appFields } = useCollection<any>(fieldsQuery);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
        collection(firestore, 'field_groups'),
        where('workspaceId', '==', activeWorkspaceId),
        orderBy('order', 'asc')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: fieldGroups } = useCollection<any>(groupsQuery);

  const contactScope = activeWorkspace?.contactScope || 'institution';

  const customFieldGroups = React.useMemo(() => {
      if (!fieldGroups || !appFields) return [];
      
      return fieldGroups.map(group => {
          const groupFields = appFields.filter((f: any) => 
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

  const methods = useForm<EntityEditValues>({
    resolver: zodResolver(entityEditSchema),
    defaultValues: {
      name: '', initials: '', slogan: '', status: 'active', lifecycleStatus: 'Onboarding',
      capacity: 0, entityContacts: [], modules: [],
      assignedToId: 'unassigned',
      currency: 'GHS', subscriptionRate: 0, discountPercentage: 0, arrearsBalance: 0, creditBalance: 0,
      subscriptionPackageId: 'none',
      workspaceTags: [],
      currentNeeds: '',
      currentChallenges: '',
      interests: '',
      customData: {},
    }
  });

  const watchPackageId = methods.watch("subscriptionPackageId");

  React.useEffect(() => {
    if (entityData && weData && !hasInitialized) {
      // New schema — read directly from root fields / financeData / industryData
      const financeData = (entityData.financeData as any) || {};
      const industryData = (entityData.industryData as any) || {};

      methods.reset({
        name: entityData.name || weData.displayName || '',
        initials: entityData.initials || '',
        slogan: (entityData as any).slogan || '',
        status: (weData.status as any) || 'active',
        lifecycleStatus: weData.lifecycleStatus || 'Onboarding',
        logoUrl: entityData.logoUrl || '',
        heroImageUrl: (entityData as any).heroImageUrl || '',
        zone: entityData.location?.zone || undefined,
        locationString: entityData.location?.locationString || '',
        capacity: industryData.capacity ?? 0,
        entityContacts: (entityData.entityContacts && entityData.entityContacts.length > 0)
          ? entityData.entityContacts
          : (entityData.contacts?.map((c: any, i: number) => ({
              name: c.name || '',
              email: c.email || '',
              phone: c.phone || '',
              typeKey: c.type?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'other',
              typeLabel: c.type || 'Other',
              isSignatory: !!c.isSignatory,
              isPrimary: i === 0,
            })) || []),
        modules: weData.interests || [],
        assignedToId: weData.assignedTo?.userId || 'unassigned',
        billingAddress: financeData.billingAddress || '',
        currency: financeData.currency || 'GHS',
        subscriptionPackageId: financeData.subscriptionPackageId || 'none',
        subscriptionRate: financeData.subscriptionRate ?? 0,
        discountPercentage: financeData.discountPercentage ?? 0,
        arrearsBalance: financeData.arrearsBalance ?? 0,
        creditBalance: financeData.creditBalance ?? 0,
        workspaceTags: weData.workspaceTags || [],
        currentNeeds: (weData as any).currentNeeds || (entityData as any).currentNeeds || '',
        currentChallenges: (weData as any).currentChallenges || (entityData as any).currentChallenges || '',
        interests: (weData as any).interestsText || (entityData as any).interestsText || '',
        customData: entityData.customData || {},
        // Online Presence
        op_website: entityData.onlinePresence?.website || (entityData as any).website || '',
        op_digitalAddress: entityData.onlinePresence?.digitalAddress || '',
        op_googleMapLocation: entityData.onlinePresence?.googleMapLocation || '',
        op_googleBusinessProfile: entityData.onlinePresence?.googleBusinessProfile || '',
        op_facebook: entityData.onlinePresence?.facebook || '',
        op_whatsapp: entityData.onlinePresence?.whatsapp || '',
        op_linkedin: entityData.onlinePresence?.linkedin || '',
        op_pinterest: entityData.onlinePresence?.pinterest || '',
        op_instagram: entityData.onlinePresence?.instagram || '',
        op_tiktok: entityData.onlinePresence?.tiktok || '',
        op_youtube: entityData.onlinePresence?.youtube || '',
        op_x: entityData.onlinePresence?.x || '',
      });
      // Set location cascade values from entity
      setLocationValue({
        country: entityData.location?.country || null,
        region: entityData.location?.region || null,
        district: entityData.location?.district || null,
      });
      setHasInitialized(true);
    }
  }, [entityData, weData, methods, hasInitialized]);

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

  const handleFormSubmit = async (data: EntityEditValues) => {
    if (!firestore || !user || !users) return;

    const selectedManager = users.find(u => u.id === data.assignedToId);
    const assignedTo = selectedManager 
        ? { userId: selectedManager.id, name: selectedManager.name, email: selectedManager.email }
        : { userId: null, name: 'Unassigned', email: null };

    const selectedPackage = packages?.find(p => p.id === data.subscriptionPackageId);

    // New schema: write to root fields + financeData + interests
    const updatePayload = {
        name: data.name,
        status: data.status,
        lifecycleStatus: data.lifecycleStatus,
        entityContacts: data.entityContacts,
        assignedTo,
        // Root identity fields
        initials: data.initials,
        slogan: data.slogan,
        logoUrl: data.logoUrl,
        heroImageUrl: data.heroImageUrl,
        workspaceTags: data.workspaceTags || [],
        currentNeeds: data.currentNeeds || '',
        currentChallenges: data.currentChallenges || '',
        interestsText: data.interests || '',
        customData: data.customData || {},
        location: {
            zone: data.zone,
            locationString: data.locationString,
            ...(locationValue.country ? { country: locationValue.country } : {}),
            ...(locationValue.region ? { region: locationValue.region } : {}),
            ...(locationValue.district ? { district: locationValue.district } : {}),
        },
        // Interests (renamed from modules)
        interests: data.modules,
        // Finance data (consolidated)
        financeData: {
            billingAddress: data.billingAddress,
            currency: data.currency,
            subscriptionPackageId: data.subscriptionPackageId === 'none' ? null : data.subscriptionPackageId,
            subscriptionPackageName: selectedPackage
                ? selectedPackage.name
                : (data.subscriptionPackageId && data.subscriptionPackageId !== 'none' ? 'Assigned' : 'Standard'),
            subscriptionRate: data.subscriptionRate,
            discountPercentage: data.discountPercentage,
            arrearsBalance: data.arrearsBalance,
            creditBalance: data.creditBalance,
        },
        // Industry data (capacity)
        industryData: {
            ...(entityData?.industryData || {}),
            capacity: data.capacity ?? 0,
        },
        // Online Presence
        onlinePresence: {
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
        },
    };

    try {
        const result = await updateEntityAction(
            entityId, 
            updatePayload, 
            user.uid, 
            activeWorkspaceId, 
            activeOrganizationId || 'smartsapp-hq'
        );

        if (result.success) {
            toast({ title: 'Profile Updated', description: `Changes to ${data.name} saved successfully.` });
            router.push(`/admin/entities/${entityId}`);
        } else {
            throw new Error(result.error);
        }
    } catch (error: any) {
        toast({ 
            title: 'Save Failed', 
            description: error.message || 'An error occurred while updating the profile.',
            variant: 'destructive'
        });
        console.error('Profile update error:', error);
    }
  };

  const isGlobalLoading = isLoadingEntity || isLoadingWE || isUsersLoading || !hasInitialized;

  if (isGlobalLoading) {
    return (
 <div className="space-y-8">
 <Skeleton className="h-64 w-full rounded-2xl" />
 <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
    );
  }

  return (
    <FormProvider {...methods}>
 <form onSubmit={methods.handleSubmit(handleFormSubmit)} className="space-y-8 pb-24 text-left">
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 <div className="lg:col-span-2 space-y-8">
            {/* General Identity Card */}
            <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
              <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                <div className="flex items-center gap-2 text-left">
                  <Building className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold tracking-tight">General Identity</CardTitle>
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
                  <FormField control={methods.control} name="lifecycleStatus" render={({ field }) => (
                    <FormItem className="text-left">
                      <FormLabel className="text-[10px] font-semibold text-primary ml-1">Operational State</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 transition-colors hover:border-border/60 font-semibold text-primary">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl shadow-2xl border-none">
                          {(activeWorkspace?.statuses || []).map(s => (
                            <SelectItem key={s.value} value={s.value} className="font-semibold">{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-2 text-left">
                  <Label className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left flex items-center gap-2"><Camera className="h-3 w-3" /> {singular} Logo</Label>
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

            {/* Financial Profile Card */}
            <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
              <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                <div className="flex items-center gap-2 text-left">
                  <Banknote className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold tracking-tight">Financial Configuration</CardTitle>
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

            {/* Account Assignment Card */}
            <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
              <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                <div className="flex items-center gap-2 text-left">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold tracking-tight">Account Ownership</CardTitle>
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Contacts & Modules Section */}
            <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
              <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                <div className="flex items-center gap-2 text-left">
                  <User className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold tracking-tight">Administrative Stakeholders</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 text-left">
                <EntityContactManager />
              </CardContent>
            </Card>

            {/* Interests Card */}
            <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
              <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                <div className="flex items-center gap-2 text-left">
                  <Plus className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold tracking-tight">Interests</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6 text-left">
                <FormField control={methods.control} name="modules" render={({ field }) => (
                  <FormItem className="text-left">
                    <FormLabel className="text-[10px] font-semibold text-muted-foreground/50 ml-1 text-left">Specific Interests</FormLabel>
                    <FormControl>
                      <ModuleSelect {...field} />
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

            {/* Current Situation Card */}
            <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
              <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                <div className="flex items-center gap-2 text-left">
                  <Target className="h-4 w-4 text-amber-600" />
                  <CardTitle className="text-sm font-semibold tracking-tight">Current Situation</CardTitle>
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

            {/* Online Presence Card */}
            <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
              <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                <div className="flex items-center gap-2 text-left">
                  <Globe className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold tracking-tight">Online Presence</CardTitle>
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
                  <div className="flex items-center gap-2 text-left">
                    <Layout className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-semibold tracking-tight">{group.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6 text-left grid grid-cols-1 md:grid-cols-2 gap-6">
                  {group.fields.map((field: any) => (
                    <FormField key={field.id} control={methods.control} name={`customData.${field.variableName}`} render={({ field: formField }) => (
                      <FormItem className="text-left">
                        <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">{field.label}</FormLabel>
                        <FormControl>
                          {field.type === 'long_text' ? (
                            <Textarea {...formField} value={formField.value || ''} placeholder={field.placeholder || ''} className="min-h-[80px] rounded-xl bg-muted/30 border border-border/40 shadow-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-colors hover:border-border/60 placeholder:text-muted-foreground/40 text-sm p-4 text-left" />
                          ) : (field.type === 'select' || field.type === 'dropdown') ? (
                            <Select onValueChange={formField.onChange} value={formField.value || ''}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border border-border/40 shadow-none focus:ring-1 focus:ring-primary/30 transition-colors hover:border-border/60 font-semibold text-left">
                                  <SelectValue placeholder={field.placeholder || "Select option..."} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl shadow-2xl border-none">
                                {(field.options || []).map((opt: any) => (
                                  <SelectItem key={opt.value} value={opt.value} className="font-semibold">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.type === 'multi_select' ? (
                            <MultiSelect
                              options={(field.options || []).map((opt: any) => ({ label: opt.label, value: opt.value }))}
                              value={Array.isArray(formField.value) ? formField.value : (formField.value ? [formField.value] : [])}
                              onChange={formField.onChange}
                              placeholder={field.placeholder || "Select options..."}
                            />
                          ) : (
                            <Input
                              {...formField}
                              value={formField.value || ''}
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
          </div>

          {/* Right Sidebar: Operations */}
          <div className="space-y-8 text-left">
            <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 text-left">
              <CardHeader className="bg-transparent border-b border-border/50 pb-4 pt-5 px-6 text-left">
                <div className="flex items-center gap-2 text-left">
                  <MapPin className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold tracking-tight">Regional Metadata</CardTitle>
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

                {/* Location Hierarchy: Country → Region → District */}
                <div className="pt-2 border-t border-border/30">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 ml-1 mb-2">Administrative Location</p>
                  <LocationCascade
                    value={locationValue}
                    onChange={setLocationValue}
                    defaultCountryId={defaultCountryId}
                  />
                </div>
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

            <EntityNotesTab entityId={entityId} />

            <div className="pt-4 sticky top-24 text-left">
              <Button 
                type="submit" 
                className="w-full h-14 rounded-2xl font-semibold text-lg shadow-xl gap-3 transition-all active:scale-95" 
                disabled={methods.formState.isSubmitting}
              >
                {methods.formState.isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <ShieldCheck className="h-6 w-6" />} 
                Update Profile
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

export default function EditEntityPage() {
  const params = useParams();
  const entityId = params.id as string;
  const { singular } = useTerminology();

  return (
        <div className="h-full overflow-y-auto">
 <div className="max-w-5xl mx-auto space-y-8">
 {entityId ? <EditEntityForm entityId={entityId} /> : <p className="text-center py-20 text-muted-foreground font-medium">{singular} context not found.</p>}
      </div>
    </div>
  );
}
