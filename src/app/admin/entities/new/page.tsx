'use client';

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
import { FocalPersonManager } from '../components/FocalPersonManager';
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

const formSchema = z.object({
  name: z.string().min(2, { message: 'Required name must be at least 2 characters.' }),
  initials: z.string().optional(),
  slogan: z.string().optional(),
  workspaceIds: z.array(z.string()).min(1, 'Select at least one workspace.'),
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
  contacts: z.array(z.object({
    name: z.string().min(2, 'Name required.'),
    email: z.string().email('Invalid email.').optional().or(z.literal('')),
    phone: z.string().min(10, 'Invalid phone.').optional().or(z.literal('')),
    type: z.string().min(1, 'Role required.'),
    isSignatory: z.boolean().default(false),
  })).min(1, 'At least one focal person is required.')
    .refine(people => people.some(p => p.isSignatory), { message: 'Exactly one focal person must be selected.' }),
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
  subscriptionPackageId: z.string().optional().nullable(),
  subscriptionRate: z.coerce.number().default(0),
  discountPercentage: z.coerce.number().min(0).max(100).default(0),
  arrearsBalance: z.coerce.number().default(0),
  creditBalance: z.coerce.number().default(0),
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

  const methods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      initials: '',
      slogan: '',
      workspaceIds: [activeWorkspaceId],
      status: 'active',
      lifecycleStatus: 'Onboarding',
      locationString: '',
      nominalRoll: 0,
      contacts: [{ name: '', email: '', phone: '', type: 'Administrator', isSignatory: true }],
      modules: [],
      assignedToId: 'unassigned',
      currency: 'GHS',
      subscriptionRate: 0,
      discountPercentage: 0,
      arrearsBalance: 0,
      creditBalance: 0,
      subscriptionPackageId: null
    },
  });

  const watchName = methods.watch("name");
  const watchPackageId = methods.watch("subscriptionPackageId");

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

    const selectedManager = users.find(u => u.id === data.assignedToId);
    const assignedTo = selectedManager 
        ? { userId: selectedManager.id, name: selectedManager.name, email: selectedManager.email }
        : { userId: null, name: 'Unassigned', email: null };

    const selectedPackage = packages?.find(p => p.id === data.subscriptionPackageId);

    // Build Polymorphic Payload
    const entityPayload = {
        name: data.name,
        contacts: data.contacts,
        status: data.status,
        lifecycleStatus: data.lifecycleStatus,
        assignedTo,
        primaryEmail: data.contacts.find(c => c.isSignatory)?.email || '',
        primaryPhone: data.contacts.find(c => c.isSignatory)?.phone || '',
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
            subscriptionPackageId: data.subscriptionPackageId || null,
            subscriptionPackageName: selectedPackage ? selectedPackage.name : 'Standard',
            subscriptionRate: data.subscriptionRate,
            discountPercentage: data.discountPercentage,
            arrearsBalance: data.arrearsBalance,
            creditBalance: data.creditBalance
        }
    };

    try {
      const result = await createEntityAction(
          entityPayload, 
          user.uid, 
          activeWorkspaceId, 
          'institution', 
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
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-background text-left">
      <div className="max-w-7xl mx-auto space-y-8">
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8 pb-24 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
              <div className="lg:col-span-2 space-y-8 text-left">
                {/* Hub Authorization Card */}
                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden glass-card bg-card text-left">
                    <CardHeader className="bg-primary/10 border-b p-6 text-left">
                        <div className="flex items-center gap-3 text-left">
                            <div className="p-2 bg-card rounded-xl shadow-sm text-primary text-left"><Layout className="h-4 w-4" /></div>
                            <CardTitle className="text-sm font-black uppercase tracking-tight text-left">Hub Authorization</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary ml-1 flex items-center gap-2 text-left">
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
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight leading-relaxed text-left">
                            Shared records appear in the directory and pipelines of all selected workspaces.
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden glass-card bg-card text-left">
                  <CardHeader className="bg-card/20 border-b pb-6 text-left">
                    <div className="flex items-center gap-3 text-left">
                        <div className="p-2 bg-primary/10 rounded-xl text-left">
                            <Building className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-lg font-black uppercase tracking-tight text-left">General Identity</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-8 text-left">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                      <FormField control={methods.control} name="name" render={({ field }) => (
                        <FormItem className="md:col-span-2 text-left"><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Official Name</FormLabel><FormControl><Input placeholder={`${singular} name...`} {...field} className="h-12 rounded-xl bg-background/50 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-lg" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={methods.control} name="initials" render={({ field }) => (
                        <FormItem className="text-left"><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Initials</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-background/50 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-black text-center" /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        <FormField control={methods.control} name="status" render={({ field }) => (
                            <FormItem className="text-left"><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">{termStatus}</FormLabel>
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
                            <FormItem className="text-left"><FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Operational State</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-11 rounded-xl bg-primary/5 border-primary/20 text-primary font-black"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl shadow-2xl border-none">
                                        {(activeWorkspace?.statuses || []).map(s => (
                                            <SelectItem key={s.value} value={s.value} className="font-black">{s.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )} />
                    </div>

                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 text-left flex items-center gap-2"><Camera className="h-3 w-3" /> {singular} Logo</Label>
                        <Controller 
                            name="logoUrl"
                            control={methods.control}
                            render={({ field }) => (
                                <MediaSelect {...field} filterType="image" className="rounded-2xl" />
                            )}
                        />
                    </div>

                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 text-left">Vision / Motto</Label>
                        <FormField control={methods.control} name="slogan" render={({ field }) => (
                            <FormItem className="text-left"><FormControl><Input placeholder="e.g. Forward Ever" {...field} className="h-11 rounded-xl bg-background/50 border-none shadow-none focus:ring-1 focus:ring-primary/20 italic font-medium" /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Profile Card */}
                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden glass-card bg-card text-left">
                    <CardHeader className="bg-card/20 border-b pb-6 text-left">
                        <div className="flex items-center gap-3 text-left">
                            <div className="p-2 bg-primary/10 rounded-xl text-left"><Banknote className="h-5 w-5 text-primary" /></div>
                            <div className="text-left">
                                <CardTitle className="text-lg font-black uppercase tracking-tight text-left">Financial Configuration</CardTitle>
                                <CardDescription className="text-xs font-medium text-left">Initial billing rules and effective termly rates.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8 text-left">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                            <FormField control={methods.control} name="subscriptionPackageId" render={({ field, fieldState }) => (
                                <FormItem className="text-left">
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 text-left">Subscription Tier</FormLabel>
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
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 text-left">Billing Currency</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-12 rounded-xl bg-background/50 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl shadow-2xl border-none">
                                            <SelectItem value="GHS" className="font-black">Ghanaian Cedi (GH¢)</SelectItem>
                                            <SelectItem value="USD" className="font-black">US Dollar ($)</SelectItem>
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
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary text-left">Rate Optimization Engine</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                                <FormField control={methods.control} name="discountPercentage" render={({ field }) => (
                                    <FormItem className="text-left">
                                        <FormLabel className="text-[10px] font-black uppercase text-primary ml-1 flex items-center gap-1.5 text-left"><Percent className="h-3 w-3" /> Preferred Grant</FormLabel>
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
                                                className="h-12 rounded-xl bg-background/50 border-primary/10 shadow-inner font-black text-xl text-center" 
                                            />
                                        </FormControl>
                                        <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Grant a reduction for this record</FormDescription>
                                    </FormItem>
                                )} />
                                <FormField control={methods.control} name="subscriptionRate" render={({ field }) => (
                                    <FormItem className="text-left">
                                        <FormLabel className="text-[10px] font-black uppercase text-primary ml-1 flex items-center gap-1.5 text-left"><Banknote className="h-3 w-3" /> Expected Net Rate</FormLabel>
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
                                                className="h-12 rounded-xl bg-background/50 border-primary/10 shadow-inner font-black text-xl text-center" 
                                            />
                                        </FormControl>
                                        <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Effective rate billed per unit</FormDescription>
                                    </FormItem>
                                )} />
                            </div>
                        </div>

                        <FormField control={methods.control} name="billingAddress" render={({ field }) => (
                            <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 text-left">Detailed Billing Address</FormLabel>
                                <FormControl>
                                    <Textarea {...field} placeholder="Specific address for financial documents..." className="min-h-[100px] rounded-xl bg-background/50 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-medium shadow-inner" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50 text-left">
                            <FormField control={methods.control} name="arrearsBalance" render={({ field }) => (
                                <FormItem className="text-left">
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-rose-600 ml-1 flex items-center gap-1.5 text-left"><CreditCard className="h-3 w-3" /> System Arrears</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} className="h-11 rounded-xl bg-rose-50/50 border-none shadow-inner font-black text-rose-700" />
                                    </FormControl>
                                    <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Legacy system outstanding balance</FormDescription>
                                </FormItem>
                            )} />
                            <FormField control={methods.control} name="creditBalance" render={({ field }) => (
                                <FormItem className="text-left">
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1 flex items-center gap-1.5 text-left"><Wallet className="h-3 w-3" /> Pre-paid Credit</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} className="h-11 rounded-xl bg-emerald-50/50 border-none shadow-inner font-black text-emerald-700" />
                                    </FormControl>
                                    <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Overpayments from legacy records</FormDescription>
                                </FormItem>
                            )} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden glass-card bg-card text-left">
                    <CardHeader className="bg-card/20 border-b pb-6 text-left">
                        <div className="flex items-center gap-3 text-left">
                            <div className="p-2 bg-primary/10 rounded-xl text-left"><UserCheck className="h-5 w-5 text-primary" /></div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight text-left">Account Ownership</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 text-left">
                        <FormField control={methods.control} name="assignedToId" render={({ field, fieldState }) => (
                            <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 text-left">Primary Representative</FormLabel>
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

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden glass-card bg-card text-left">
                    <CardHeader className="bg-card/20 border-b pb-6 text-left">
                        <div className="flex items-center gap-3 text-left">
                            <div className="p-2 bg-primary/10 rounded-xl text-left"><User className="h-5 w-5 text-primary" /></div>
                            <div className="text-left">
                                <CardTitle className="text-lg font-black uppercase tracking-tight text-left">Administrative Stakeholders</CardTitle>
                                <CardDescription className="text-xs font-medium text-left">Primary directory of focal persons.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 text-left">
                        <FocalPersonManager />
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden glass-card bg-card text-left">
                    <CardHeader className="bg-card/20 border-b pb-6 text-left">
                        <div className="flex items-center gap-3 text-left">
                            <div className="p-2 bg-primary/10 rounded-xl text-left"><Plus className="h-5 w-5 text-primary" /></div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight text-left">Interests</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 text-left">
                        <FormField control={methods.control} name="modules" render={({ field }) => (
                            <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 ml-1 text-left">Specific Interests</FormLabel>
                                <FormControl>
                                    <ModuleSelect {...field} />
                                </FormControl>
                                <FormDescription className="text-[9px] font-bold uppercase opacity-60 text-left">Identify the specific interests for this workspace.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </CardContent>
                </Card>
              </div>

              {/* Right Sidebar: Operations */}
              <div className="space-y-8 text-left">
                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden glass-card bg-card text-left">
                    <CardHeader className="bg-card/20 border-b pb-6 text-left">
                        <div className="flex items-center gap-3 text-left">
                            <div className="p-2 bg-primary/10 rounded-xl text-left"><MapPin className="h-5 w-5 text-primary" /></div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight text-left">Regional Metadata</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6 text-left">
                        <FormField control={methods.control} name="zone" render={({ field, fieldState }) => (
                            <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 text-left">Geographic Zone</FormLabel>
                                <FormControl>
                                    <ZoneSelect value={field.value} onValueChange={field.onChange} error={!!fieldState.error} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} /> 
                        <FormField control={methods.control} name="locationString" render={({ field }) => (
                            <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 text-left">Physical Address</FormLabel>
                                <FormControl>
                                    <Textarea {...field} className="min-h-[80px] rounded-xl bg-background/50 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-sm p-4" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} /> 
                        <FormField control={methods.control} name="nominalRoll" render={({ field }) => (
                            <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 text-left">Nominal Strength</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} className="h-11 rounded-xl bg-background/50 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </CardContent>
                </Card>
                <div className="pt-4 sticky top-24 text-left">
                  <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl gap-3 transition-all active:scale-95 uppercase tracking-widest text-left" disabled={methods.formState.isSubmitting || isUsersLoading}>
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
