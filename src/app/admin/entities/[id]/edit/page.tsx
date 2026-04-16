'use client';

import * as React from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Building, MapPin, User, Plus, UserCheck, ShieldCheck, Banknote, CreditCard, Wallet, Percent, Target, Zap, Layout, Camera } from 'lucide-react';
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
  nominalRoll: z.coerce.number().optional(),
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
  const { activeOrganizationId } = useTenant();
  const { singular, updateStatus, termStatus } = useTerminology();

  const [hasInitialized, setHasInitialized] = React.useState(false);

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

  const methods = useForm<EntityEditValues>({
    resolver: zodResolver(entityEditSchema),
    defaultValues: {
      name: '', initials: '', slogan: '', status: 'active', lifecycleStatus: 'Onboarding',
      nominalRoll: 0, entityContacts: [], modules: [],
      assignedToId: 'unassigned',
      currency: 'GHS', subscriptionRate: 0, discountPercentage: 0, arrearsBalance: 0, creditBalance: 0,
      subscriptionPackageId: 'none'
    }
  });

  const watchPackageId = methods.watch("subscriptionPackageId");

  React.useEffect(() => {
    if (entityData && weData && !hasInitialized) {
      const institutionData = entityData.institutionData;
      
      methods.reset({
        name: entityData.name || weData.displayName || '',
        initials: institutionData?.initials || '',
        slogan: institutionData?.slogan || '',
        status: (weData.status as any) || 'active',
        lifecycleStatus: weData.lifecycleStatus || 'Onboarding',
        logoUrl: institutionData?.logoUrl || '',
        heroImageUrl: institutionData?.heroImageUrl || '',
        zone: institutionData?.location?.zone || undefined,
        locationString: institutionData?.location?.locationString || '',
        nominalRoll: institutionData?.nominalRoll || 0,
        entityContacts: (entityData.entityContacts && entityData.entityContacts.length > 0) ? entityData.entityContacts : (entityData.contacts?.map((c: any, i: number) => ({
          name: c.name || '',
          email: c.email || '',
          phone: c.phone || '',
          typeKey: c.type?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'other',
          typeLabel: c.type || 'Other',
          isSignatory: !!c.isSignatory,
          isPrimary: i === 0,
        })) || []),
        modules: weData.interests || institutionData?.modules || [],
        assignedToId: weData.assignedTo?.userId || 'unassigned',
        billingAddress: institutionData?.billingAddress || '',
        currency: institutionData?.currency || 'GHS',
        subscriptionPackageId: institutionData?.subscriptionPackageId || 'none',
        subscriptionRate: institutionData?.subscriptionRate || 0,
        discountPercentage: institutionData?.discountPercentage || 0,
        arrearsBalance: institutionData?.arrearsBalance || 0,
        creditBalance: institutionData?.creditBalance || 0,
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

    // Structural Mapping for new architecture
    const updatePayload = {
        name: data.name,
        status: data.status,
        lifecycleStatus: data.lifecycleStatus,
        entityContacts: data.entityContacts,
        assignedTo,
        institutionData: {
            initials: data.initials,
            slogan: data.slogan,
            logoUrl: data.logoUrl,
            heroImageUrl: data.heroImageUrl,
            nominalRoll: data.nominalRoll,
            modules: data.modules,
            location: {
                zone: data.zone,
                locationString: data.locationString
            },
            billingAddress: data.billingAddress,
            currency: data.currency,
            subscriptionPackageId: data.subscriptionPackageId === 'none' ? null : data.subscriptionPackageId,
            subscriptionPackageName: selectedPackage ? selectedPackage.name : (data.subscriptionPackageId && data.subscriptionPackageId !== 'none' ? 'Assigned' : 'Standard'),
            subscriptionRate: data.subscriptionRate,
            discountPercentage: data.discountPercentage,
            arrearsBalance: data.arrearsBalance,
            creditBalance: data.creditBalance
        }
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
            {/* Identity Card */}
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6 text-left">
 <div className="flex items-center gap-3 text-left">
 <div className="p-2 bg-primary/10 rounded-xl text-left">
 <Building className="h-5 w-5 text-primary" />
                    </div>
 <div className="text-left">
 <CardTitle className="text-lg font-semibold tracking-tight text-left">Identity & Status</CardTitle>
 <CardDescription className="text-xs font-medium text-left">Core institutional metadata.</CardDescription>
                    </div>
                </div>
              </CardHeader>
 <CardContent className="p-6 space-y-8 text-left">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                  <FormField 
                    control={methods.control} 
                    name="name" 
                    render={({ field }) => (
 <FormItem className="md:col-span-2 text-left">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">Official {singular} Name</FormLabel>
                            <FormControl>
 <Input {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-lg" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} 
                  />
                  <FormField 
                    control={methods.control} 
                    name="status" 
                    render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1">{termStatus}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
 <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
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
                    )} 
                  />
                </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                    <FormField 
                        control={methods.control} 
                        name="lifecycleStatus" 
                        render={({ field }) => (
 <FormItem className="md:col-span-1 text-left">
 <FormLabel className="text-[10px] font-semibold text-primary ml-1">Operational State</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
 <SelectTrigger className="h-12 rounded-xl bg-primary/5 border-primary/20 shadow-sm font-semibold text-xs text-primary">
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
                        )} 
                    />
 <div className="md:col-span-2 pt-2 text-left">
 <p className="text-[10px] font-medium text-muted-foreground leading-relaxed italic text-left">
                            Resolution cycle: {activeWorkspace?.name}. Updating this affects pipeline categorization.
                        </p>
                    </div>
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

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50 text-left">
                    <FormField control={methods.control} name="initials" render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">{singular} Initials</FormLabel>
                            <FormControl>
 <Input {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-semibold text-center" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={methods.control} name="slogan" render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Vision/Motto</FormLabel>
                            <FormControl>
 <Input {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 italic font-medium" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
              </CardContent>
            </Card>

            {/* Financial Profile Card */}
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden text-left">
 <CardHeader className="bg-muted/30 border-b pb-6 text-left">
 <div className="flex items-center gap-3 text-left">
 <div className="p-2 bg-primary/10 rounded-xl text-left"><Banknote className="h-5 w-5 text-primary" /></div>
 <div className="text-left">
 <CardTitle className="text-lg font-semibold tracking-tight text-left">Financial Configuration</CardTitle>
 <CardDescription className="text-xs font-medium text-left">Billing rules and effective termly rates.</CardDescription>
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
                                        value={field.value} 
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
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={methods.control} name="currency" render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Default Currency</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
 <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-semibold">
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
                        watchPackageId && watchPackageId !== 'none' ? "bg-primary/5 border-primary/20" : "bg-background border-border opacity-40 pointer-events-none"
                    )}>
 <div className="flex items-center gap-3 mb-6 text-left">
 <div className="p-2 bg-primary text-white rounded-lg shadow-sm text-left"><Target className="h-4 w-4" /></div>
 <p className="text-[10px] font-semibold text-left">Rate Optimization Engine</p>
                        </div>
                        
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                            <FormField control={methods.control} name="discountPercentage" render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-1.5 text-left"><Percent className="h-3 w-3" /> Grant Factor</FormLabel>
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
 className="h-12 rounded-xl bg-card border-primary/10 shadow-inner font-semibold text-xl text-center" 
                                        />
                                    </FormControl>
 <FormDescription className="text-[9px] font-bold tracking-tighter opacity-60 text-left">Specific fee reduction percentage</FormDescription>
                                </FormItem>
                            )} />
                            <FormField control={methods.control} name="subscriptionRate" render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-1.5 text-left"><Banknote className="h-3 w-3" /> Net Unit Rate</FormLabel>
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
 className="h-12 rounded-xl bg-card border-primary/10 shadow-inner font-semibold text-xl text-center" 
                                        />
                                    </FormControl>
 <FormDescription className="text-[9px] font-bold tracking-tighter opacity-60 text-left">Final billed unit cost</FormDescription>
                                </FormItem>
                            )} />
                        </div>
                    </div>

                    <FormField control={methods.control} name="billingAddress" render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Service Address</FormLabel>
                            <FormControl>
 <Textarea {...field} placeholder="If different from primary location..." className="min-h-[100px] rounded-xl bg-muted/20 border-none shadow-inner" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50 text-left">
                        <FormField control={methods.control} name="arrearsBalance" render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-rose-600 ml-1 flex items-center gap-1.5 text-left"><CreditCard className="h-3 w-3" /> Arrears Balance</FormLabel>
                                <FormControl>
 <Input type="number" step="0.01" {...field} className="h-11 rounded-xl bg-rose-50/50 border-none shadow-inner font-semibold text-rose-700" />
                                </FormControl>
 <FormDescription className="text-[9px] font-bold tracking-tighter opacity-60 text-left">Initial outstanding debt</FormDescription>
                            </FormItem>
                        )} />
                        <FormField control={methods.control} name="creditBalance" render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-emerald-600 ml-1 flex items-center gap-1.5 text-left"><Wallet className="h-3 w-3" /> Credit Limit</FormLabel>
                                <FormControl>
 <Input type="number" step="0.01" {...field} className="h-11 rounded-xl bg-emerald-50/50 border-none shadow-inner font-semibold text-emerald-700" />
                                </FormControl>
 <FormDescription className="text-[9px] font-bold tracking-tighter opacity-60 text-left">Initial overpayment credit</FormDescription>
                            </FormItem>
                        )} />
                    </div>
                </CardContent>
            </Card>
            
            {/* Account Assignment Card */}
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden text-left">
 <CardHeader className="bg-muted/30 border-b pb-6 text-left">
 <div className="flex items-center gap-3 text-left">
 <div className="p-2 bg-primary/10 rounded-xl text-left"><UserCheck className="h-5 w-5 text-primary" /></div>
 <div className="text-left">
 <CardTitle className="text-lg font-semibold tracking-tight text-left">Account Ownership</CardTitle>
 <CardDescription className="text-xs font-medium text-left">Internal manager responsible for this record.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
 <CardContent className="p-6 text-left">
                    <FormField control={methods.control} name="assignedToId" render={({ field, fieldState }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Account Manager</FormLabel>
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
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden text-left">
 <CardHeader className="bg-muted/30 border-b pb-6 text-left">  <div className="flex items-center gap-3 text-left">
 <div className="p-2 bg-primary/10 rounded-xl text-left"><User className="h-5 w-5 text-primary" /></div>
 <div className="text-left">
 <CardTitle className="text-lg font-semibold tracking-tight text-left">Administrative stakeholders</CardTitle>
 <CardDescription className="text-xs font-medium text-left">Primary directory of entity contacts.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
 <CardContent className="p-6 text-left">
                    <EntityContactManager />
                </CardContent>
            </Card>

 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden text-left">
 <CardHeader className="bg-muted/30 border-b pb-6 text-left">
 <div className="flex items-center gap-3 text-left">
 <div className="p-2 bg-primary/10 rounded-xl text-left"><Plus className="h-5 w-5 text-primary" /></div>
 <div className="text-left">
 <CardTitle className="text-lg font-semibold tracking-tight text-left">Requested Capabilities</CardTitle>
 <CardDescription className="text-xs font-medium text-left">Features activated for this institution.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
 <CardContent className="p-6 text-left">
                    <FormField control={methods.control} name="modules" render={({ field }) => (
 <FormItem className="text-left">
                            <FormControl>
                                <ModuleSelect {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
            </Card>
          </div>

          {/* Right Sidebar: Operations */}
 <div className="space-y-8 text-left">
 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden text-left">
 <CardHeader className="bg-muted/30 border-b pb-6 text-left">
 <div className="flex items-center gap-3 text-left">
 <div className="p-2 bg-primary/10 rounded-xl text-left"><MapPin className="h-5 w-5 text-primary" /></div>
 <div className="text-left">
 <CardTitle className="text-lg font-semibold tracking-tight text-left">Regional Metadata</CardTitle>
 <CardDescription className="text-xs font-medium text-left">Geographic and scale classification.</CardDescription>
                        </div>
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
                    <FormField control={methods.control} name="locationString" render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Physical Hub</FormLabel>
                            <FormControl>
 <Textarea {...field} className="min-h-[80px] rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-sm p-4" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} /> 
                    <FormField control={methods.control} name="nominalRoll" render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground/60 ml-1 text-left">Nominal Strength</FormLabel>
                            <FormControl>
 <Input type="number" {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
            </Card>

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
 <div className="h-full overflow-y-auto  bg-background">
 <div className="max-w-5xl mx-auto space-y-8">
 {entityId ? <EditEntityForm entityId={entityId} /> : <p className="text-center py-20 text-muted-foreground font-medium">{singular} context not found.</p>}
      </div>
    </div>
  );
}
