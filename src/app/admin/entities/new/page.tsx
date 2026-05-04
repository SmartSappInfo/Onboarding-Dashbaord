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
import { Loader2, Building, MapPin, User, Plus, UserCheck, Banknote, CreditCard, Wallet, Percent, Target, Image as ImageIcon, Zap, Layout, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy } from 'firebase/firestore';

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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { ModuleSelect } from '../components/ModuleSelect';
import { ZoneSelect } from '../components/ZoneSelect';
import { EntityContactManager } from '../components/EntityContactManager';
import { ManagerSelect } from '../components/ManagerSelect';
import { PackageSelect } from '../components/PackageSelect';
import { MediaSelect } from '../components/media-select';
import { createEntityAction } from '@/lib/entity-actions';
import { type UserProfile, type SubscriptionPackage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { useTerminology } from '@/hooks/use-terminology';
import { LocationCascade } from '@/components/location/LocationCascade';
import { TagSelector } from '@/components/tags/TagSelector';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Required name must be at least 2 characters.' }),
  initials: z.string().optional(),
  slogan: z.string().optional(),
  workspaceIds: z.array(z.string()).min(1, 'Select at least one workspace.'),
  status: z.enum(['active', 'inactive', 'archived']),
  lifecycleStatus: z.string().optional().default('Onboarding'),
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
  nominalRoll: z.coerce.number().optional(),
  // ── Narrative Fields (non-required, all industries) ──────────────────────
  currentNeeds: z.string().optional(),
  currentChallenges: z.string().optional(),
  interests: z.string().optional(),
  entityContacts: z.array(z.object({
    name: z.string().min(1, 'Name required.'),
    email: z.string().optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
    typeKey: z.string().optional().default('primary'),
    typeLabel: z.string().optional().default('Primary'),
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
  // Person fields
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  leadSource: z.string().optional(),
  customData: z.record(z.any()).optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function NewEntityPage() {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspace, activeWorkspaceId, allowedWorkspaces } = useWorkspace();
  const { activeOrganizationId } = useTenant();
  const { singular, termStatus } = useTerminology();

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

  const methods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      initials: '',
      slogan: '',
      workspaceIds: [activeWorkspaceId],
      status: 'active',
      lifecycleStatus: 'Onboarding',
      location: {},
      locationString: '',
      workspaceTags: [],
      nominalRoll: 0,
      entityContacts: [{ name: '', email: '', phone: '', typeKey: 'administrator', typeLabel: 'Administrator', isSignatory: true, isPrimary: true }],
      modules: [],
      assignedToId: 'unassigned',
      currency: 'GHS',
      subscriptionRate: 0,
      discountPercentage: 0,
      arrearsBalance: 0,
      creditBalance: 0,
      subscriptionPackageId: null,
      customData: {},
      currentNeeds: '',
      currentChallenges: '',
      interests: '',
    },
  });

  const watchName = methods.watch("name");
  const watchPackageId = methods.watch("subscriptionPackageId");

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

  // Auto-generate initials
  React.useEffect(() => {
    if (watchName && !methods.formState.dirtyFields.initials) {
        const initials = watchName.split(' ').map(word => word[0]).join('').toUpperCase();
        methods.setValue('initials', initials, { shouldValidate: true, shouldDirty: false });
    }
  }, [watchName, methods]);

  React.useEffect(() => {
      if (user && methods.getValues('assignedToId') === 'unassigned') {
          methods.setValue('assignedToId', user.uid);
      }
  }, [user, methods]);

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

  const onSubmit = async (data: FormData) => {
    if (!firestore || !user || !users) return;

    const contactScope = activeWorkspace?.contactScope || 'institution';
    const selectedManager = users.find(u => u.id === data.assignedToId);
    const assignedTo = selectedManager 
        ? { userId: selectedManager.id, name: selectedManager.name, email: selectedManager.email }
        : { userId: null, name: 'Unassigned', email: null };

    const selectedPackage = packages?.find(p => p.id === data.subscriptionPackageId);

    // Build Polymorphic Payload based on workspace scope
    const entityPayload: any = {
        name: data.name,
        entityContacts: data.entityContacts || [],
        status: data.status,
        lifecycleStatus: data.lifecycleStatus || 'Onboarding',
        location: { ...data.location, locationString: data.locationString },
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
        arrearsBalance: data.arrearsBalance,
        creditBalance: data.creditBalance,
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
      const result = await createEntityAction(
          entityPayload, 
          user.uid, 
          activeWorkspaceId, 
          contactScope as any, 
          activeOrganizationId || 'smartsapp-hq'
      );
      
      if (result.success) {
        toast({ title: 'Record Initialized', description: `${data.name} created successfully.` });
        router.push('/admin/entities');
      } else {
        throw new Error(result.error || `Failed to create ${singular.toLowerCase()}`);
      }
    } catch (error: any) {
      toast({ 
        title: 'Save Failed', 
        description: error.message || `An error occurred while creating the ${singular.toLowerCase()}`,
        variant: 'destructive'
      });
      console.error('Entity creation error:', error);
    }
  };

  const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

  return (
    <div className="h-full overflow-y-auto text-left">
      <div className="space-y-8">
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8 pb-24 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
              <div className="lg:col-span-2 space-y-8 text-left">
                {/* Hub Authorization Card */}
 <Card className="border border-border shadow-sm rounded-2xl overflow-hidden bg-card text-left">
 <CardHeader className="bg-primary/10 border-b p-6 text-left">
 <div className="flex items-center gap-3 text-left">
 <div className="p-2 bg-card rounded-xl shadow-sm text-primary text-left"><Layout className="h-4 w-4" /></div>
 <CardTitle className="text-sm font-semibold tracking-tight text-left">Hub Authorization</CardTitle>
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
 <p className="text-[9px] font-bold text-muted-foreground tracking-tight leading-relaxed text-left">
                            Shared records appear in the directory and pipelines of all selected workspaces.
                        </p>
                    </CardContent>
                </Card>

 <Card className="border border-border shadow-sm rounded-2xl overflow-hidden bg-card text-left">
 <CardHeader className="bg-card/20 border-b pb-6 text-left">
 <div className="flex items-center gap-3 text-left">
 <div className="p-2 bg-primary/10 rounded-xl text-left">
 <Building className="h-5 w-5 text-primary" />
                        </div>
 <CardTitle className="text-lg font-semibold tracking-tight text-left">General Identity</CardTitle>
                    </div>
                  </CardHeader>
 <CardContent className="p-6 space-y-8 text-left">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                      <FormField control={methods.control} name="name" render={({ field }) => (
 <FormItem className="md:col-span-2 text-left"><FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Official Name</FormLabel><FormControl><Input placeholder={`${singular} name...`} {...field} className="h-12 rounded-xl bg-background/50 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-lg" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={methods.control} name="initials" render={({ field }) => (
 <FormItem className="text-left"><FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Initials</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-semibold text-center" /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        <FormField control={methods.control} name="status" render={({ field }) => (
 <FormItem className="text-left"><FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">{termStatus}</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
 <FormControl><SelectTrigger className="h-11 rounded-xl bg-background/50 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"><SelectValue /></SelectTrigger></FormControl>
 <SelectContent className="rounded-xl shadow-2xl border-none">
 <SelectItem value="active" className="font-bold">Active</SelectItem>
 <SelectItem value="inactive" className="font-bold">Inactive</SelectItem>
 <SelectItem value="archived" className="font-bold">Archived</SelectItem>
                                    </SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={methods.control} name="lifecycleStatus" render={({ field }) => (
 <FormItem className="text-left"><FormLabel className="text-[10px] font-semibold text-primary ml-1">Operational State</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
 <FormControl><SelectTrigger className="h-11 rounded-xl bg-primary/5 border-primary/20 text-primary font-semibold"><SelectValue /></SelectTrigger></FormControl>
 <SelectContent className="rounded-xl shadow-2xl border-none">
                                        {(activeWorkspace?.statuses || []).map(s => (
 <SelectItem key={s.value} value={s.value} className="font-semibold">{s.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
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
 <FormItem className="text-left"><FormControl><Input placeholder="e.g. Forward Ever" {...field} className="h-11 rounded-xl bg-background/50 border-none shadow-none focus:ring-1 focus:ring-primary/20 italic font-medium" /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>

 <div className="space-y-2 text-left pt-4">
 <Label className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Tags & Categories</Label>
                        <FormField control={methods.control} name="workspaceTags" render={({ field }) => (
 <FormItem className="text-left"><FormControl><TagSelector currentTagIds={field.value || []} onTagsChange={field.onChange} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Profile Card */}
 <Card className="border border-border shadow-sm rounded-2xl overflow-hidden bg-card text-left">
 <CardHeader className="bg-card/20 border-b pb-6 text-left">
 <div className="flex items-center gap-3 text-left">
 <div className="p-2 bg-primary/10 rounded-xl text-left"><Banknote className="h-5 w-5 text-primary" /></div>
 <div className="text-left">
 <CardTitle className="text-lg font-semibold tracking-tight text-left">Financial Configuration</CardTitle>
 <CardDescription className="text-xs font-medium text-left">Initial billing rules and effective termly rates.</CardDescription>
                            </div>
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
 <SelectTrigger className="h-12 rounded-xl bg-background/50 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
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
                            watchPackageId && watchPackageId !== 'none' ? "bg-primary/5 border-primary/20" : "bg-background/50 border-border opacity-40 pointer-events-none"
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
 className="h-12 rounded-xl bg-background/50 border-primary/10 shadow-inner font-semibold text-xl text-center" 
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
 className="h-12 rounded-xl bg-background/50 border-primary/10 shadow-inner font-semibold text-xl text-center" 
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
 <Textarea {...field} placeholder="Specific address for financial documents..." className="min-h-[100px] rounded-xl bg-background/50 border-none focus-visible:ring-1 focus-visible:ring-primary/20 font-medium shadow-inner" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50 text-left">
                            <FormField control={methods.control} name="arrearsBalance" render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-rose-600 ml-1 flex items-center gap-1.5 text-left"><CreditCard className="h-3 w-3" /> System Arrears</FormLabel>
                                    <FormControl>
 <Input type="number" step="0.01" {...field} className="h-11 rounded-xl bg-rose-50/50 border-none shadow-inner font-semibold text-rose-700" />
                                    </FormControl>
 <FormDescription className="text-[9px] font-bold tracking-tighter opacity-60 text-left">Legacy system outstanding balance</FormDescription>
                                </FormItem>
                            )} />
                            <FormField control={methods.control} name="creditBalance" render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-emerald-600 ml-1 flex items-center gap-1.5 text-left"><Wallet className="h-3 w-3" /> Pre-paid Credit</FormLabel>
                                    <FormControl>
 <Input type="number" step="0.01" {...field} className="h-11 rounded-xl bg-emerald-50/50 border-none shadow-inner font-semibold text-emerald-700" />
                                    </FormControl>
 <FormDescription className="text-[9px] font-bold tracking-tighter opacity-60 text-left">Overpayments from legacy records</FormDescription>
                                </FormItem>
                            )} />
                        </div>
                    </CardContent>
                </Card>

 <Card className="border border-border shadow-sm rounded-2xl overflow-hidden bg-card text-left">
 <CardHeader className="bg-card/20 border-b pb-6 text-left">
 <div className="flex items-center gap-3 text-left">
 <div className="p-2 bg-primary/10 rounded-xl text-left"><UserCheck className="h-5 w-5 text-primary" /></div>
 <CardTitle className="text-lg font-semibold tracking-tight text-left">Account Ownership</CardTitle>
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

 <Card className="border border-border shadow-sm rounded-2xl overflow-hidden bg-card text-left">
 <CardHeader className="bg-card/20 border-b pb-6 text-left">
 <div className="flex items-center gap-3 text-left">
 <div className="p-2 bg-primary/10 rounded-xl text-left"><User className="h-5 w-5 text-primary" /></div>
 <div className="text-left">
 <CardTitle className="text-lg font-semibold tracking-tight text-left">Administrative Stakeholders</CardTitle>
 <CardDescription className="text-xs font-medium text-left">Primary directory of entity contacts.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
 <CardContent className="p-6 text-left">
                        <EntityContactManager />
                    </CardContent>
                </Card>

 <Card className="border border-border shadow-sm rounded-2xl overflow-hidden bg-card text-left">
 <CardHeader className="bg-card/20 border-b pb-6 text-left">
 <div className="flex items-center gap-3 text-left">
 <div className="p-2 bg-primary/10 rounded-xl text-left"><Plus className="h-5 w-5 text-primary" /></div>
 <CardTitle className="text-lg font-semibold tracking-tight text-left">Interests</CardTitle>
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
                                    <Input {...field} placeholder="e.g. Technology, Sports, Arts..." className="h-11 rounded-xl bg-background/50 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-medium" />
                                </FormControl>
                                <FormDescription className="text-[9px] font-bold opacity-60 text-left">Comma-separated list of areas of interest.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </CardContent>
                </Card>

                {/* Current Situation Card */}
                <Card className="border border-border shadow-sm rounded-2xl overflow-hidden bg-card text-left">
                    <CardHeader className="bg-card/20 border-b pb-6 text-left">
                        <div className="flex items-center gap-3 text-left">
                            <div className="p-2 bg-amber-500/10 rounded-xl text-left"><Target className="h-5 w-5 text-amber-600" /></div>
                            <div className="text-left">
                                <CardTitle className="text-lg font-semibold tracking-tight text-left">Current Situation</CardTitle>
                                <CardDescription className="text-xs font-medium text-left">Discovery notes for sales & pipeline context.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6 text-left">
                        <FormField control={methods.control} name="currentNeeds" render={({ field }) => (
                            <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-semibold text-amber-600 ml-1 text-left">Current Needs</FormLabel>
                                <FormControl>
                                    <Textarea {...field} placeholder="What is this entity actively looking for or needing right now?" className="min-h-[90px] rounded-xl bg-background/50 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-sm p-4" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={methods.control} name="currentChallenges" render={({ field }) => (
                            <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-semibold text-rose-600 ml-1 text-left">Current Challenges</FormLabel>
                                <FormControl>
                                    <Textarea {...field} placeholder="What pain points or obstacles is this entity facing?" className="min-h-[90px] rounded-xl bg-background/50 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-sm p-4" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </CardContent>
                </Card>

                {/* Dynamic Custom Field Groups */}
                {customFieldGroups.map((group) => (
                    <Card key={group.id} className="border border-border shadow-sm rounded-2xl overflow-hidden bg-card text-left">
                        <CardHeader className="bg-card/20 border-b pb-6 text-left">
                            <div className="flex items-center gap-3 text-left">
                                <div className="p-2 bg-primary/10 rounded-xl text-left"><Layout className="h-5 w-5 text-primary" /></div>
                                <CardTitle className="text-lg font-semibold tracking-tight text-left">{group.name}</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 text-left grid grid-cols-1 md:grid-cols-2 gap-6">
                            {group.fields.map((field: any) => (
                                <FormField key={field.id} control={methods.control} name={`customData.${field.variableName}`} render={({ field: formField }) => (
                                    <FormItem className="text-left">
                                        <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">{field.label}</FormLabel>
                                        <FormControl>
                                            {field.type === 'long_text' ? (
                                                <Textarea {...formField} value={formField.value || ''} className="min-h-[80px] rounded-xl bg-background/50 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-sm p-4" />
                                            ) : (
                                                <Input {...formField} value={formField.value || ''} type={field.type === 'number' ? 'number' : 'text'} className="h-11 rounded-xl bg-background/50 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-semibold" />
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
 <Card className="border border-border shadow-sm rounded-2xl overflow-hidden bg-card text-left">
 <CardHeader className="bg-card/20 border-b pb-6 text-left">
 <div className="flex items-center gap-3 text-left">
 <div className="p-2 bg-primary/10 rounded-xl text-left"><MapPin className="h-5 w-5 text-primary" /></div>
 <CardTitle className="text-lg font-semibold tracking-tight text-left">Regional Metadata</CardTitle>
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
                                    <Textarea {...field} className="min-h-[80px] rounded-xl bg-background/50 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-sm p-4" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} /> 
                        <FormField control={methods.control} name="nominalRoll" render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Nominal Strength</FormLabel>
                                <FormControl>
 <Input type="number" {...field} className="h-11 rounded-xl bg-background/50 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </CardContent>
                </Card>
 <div className="pt-4 sticky top-24 text-left">
 <Button type="submit" className="w-full h-14 rounded-2xl font-semibold text-lg shadow-xl gap-3 transition-all active:scale-95 text-left" disabled={methods.formState.isSubmitting || isUsersLoading}>
 {methods.formState.isSubmitting ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <Building className="mr-3 h-6 w-6" />} Initialize {singular}
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
