
'use client';

import * as React from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Loader2, Building, MapPin, User, Plus, UserCheck, ShieldCheck, Banknote, CreditCard, Wallet, Percent, Target } from 'lucide-react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { doc, updateDoc, collection, query, orderBy, where } from 'firebase/firestore';

import type { School, UserProfile, SubscriptionPackage } from '@/lib/types';
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
import { useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser, useCollection } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { ModuleSelect } from '../../components/ModuleSelect';
import { ZoneSelect } from '../../components/ZoneSelect';
import { FocalPersonManager } from '../../components/FocalPersonManager';
import { logActivity } from '@/lib/activity-logger';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { cn } from '@/lib/utils';

const schoolEditSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  initials: z.string().optional(),
  slogan: z.string().optional(),
  status: z.enum(['Active', 'Inactive', 'Archived']),
  logoUrl: z.string().url().optional().or(z.literal('')),
  heroImageUrl: z.string().url().optional().or(z.literal('')),
  zone: z.object({
    id: z.string().min(1, 'Please select a zone.'),
    name: z.string(),
  }, { required_error: 'Please assign a geographic zone.' }),
  location: z.string().optional(),
  nominalRoll: z.coerce.number().optional(),
  focalPersons: z.array(z.object({
    name: z.string().min(2, 'Name required.'),
    email: z.string().email('Invalid email.'),
    phone: z.string().min(10, 'Invalid phone.'),
    type: z.enum(['Champion', 'Accountant', 'Administrator', 'Principal', 'School Owner']),
  })).min(1, 'At least one focal person is required.'),
  modules: z.array(z.object({
    id: z.string(),
    name: z.string(),
    abbreviation: z.string(),
    color: z.string(),
  })).optional(),
  implementationDate: z.date().optional().nullable(),
  referee: z.string().optional(),
  includeDroneFootage: z.boolean().default(false),
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

type SchoolEditValues = z.infer<typeof schoolEditSchema>;

interface EditFormProps {
  schoolId: string;
}

function EditSchoolForm({ schoolId }: EditFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const { user } = useUser();

  const schoolDocRef = useMemoFirebase(() => {
    if (!firestore || !schoolId) return null;
    return doc(firestore, 'schools', schoolId);
  }, [firestore, schoolId]);

  const { data: school, isLoading: isSchoolLoading } = useDoc<School>(schoolDocRef);

  useSetBreadcrumb(school?.name, pathname.replace('/edit', ''));

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), orderBy('name', 'asc'));
  }, [firestore]);
  const { data: users, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

  const packagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'subscription_packages'), where('isActive', '==', true), orderBy('name', 'asc'));
  }, [firestore]);
  const { data: packages } = useCollection<SubscriptionPackage>(packagesQuery);

  const methods = useForm<SchoolEditValues>({
    resolver: zodResolver(schoolEditSchema),
    defaultValues: {
      name: '', initials: '', slogan: '', status: 'Active',
      location: '', nominalRoll: 0, focalPersons: [], modules: [],
      referee: '', includeDroneFootage: false, assignedToId: '',
      currency: 'GHS', subscriptionRate: 0, discountPercentage: 0, arrearsBalance: 0, creditBalance: 0,
    }
  });

  const watchPackageId = methods.watch("subscriptionPackageId");
  const watchDiscount = methods.watch("discountPercentage");
  const watchRate = methods.watch("subscriptionRate");

  React.useEffect(() => {
    if (school && !methods.formState.isDirty) {
      methods.reset({
        name: school.name || '',
        initials: school.initials || '',
        slogan: school.slogan || '',
        status: school.status || 'Active',
        logoUrl: school.logoUrl || '',
        heroImageUrl: school.heroImageUrl || '',
        zone: school.zone || undefined,
        location: school.location || '',
        nominalRoll: school.nominalRoll || 0,
        focalPersons: (school.focalPersons as any) || [],
        modules: school.modules || [],
        implementationDate: school.implementationDate ? new Date(school.implementationDate) : null,
        referee: school.referee || '',
        includeDroneFootage: school.includeDroneFootage || false,
        assignedToId: school.assignedTo?.userId || 'unassigned',
        billingAddress: school.billingAddress || '',
        currency: school.currency || 'GHS',
        subscriptionPackageId: school.subscriptionPackageId || '',
        subscriptionRate: school.subscriptionRate || 0,
        discountPercentage: school.discountPercentage || 0,
        arrearsBalance: school.arrearsBalance || 0,
        creditBalance: school.creditBalance || 0,
      });
    }
  }, [school, methods]);

  // Handle Discount -> Calculate Rate
  const handleDiscountChange = (val: number) => {
    const pkg = packages?.find(p => p.id === watchPackageId);
    if (!pkg) return;
    const newRate = pkg.ratePerStudent * (1 - val / 100);
    methods.setValue('subscriptionRate', parseFloat(newRate.toFixed(2)), { shouldDirty: true });
  };

  // Handle Rate -> Calculate Discount
  const handleRateChange = (val: number) => {
    const pkg = packages?.find(p => p.id === watchPackageId);
    if (!pkg || pkg.ratePerStudent === 0) return;
    const newDiscount = ((pkg.ratePerStudent - val) / pkg.ratePerStudent) * 100;
    methods.setValue('discountPercentage', parseFloat(newDiscount.toFixed(2)), { shouldDirty: true });
  };

  const handleFormSubmit = (data: SchoolEditValues) => {
    if (!firestore || !user || !users) return;

    const selectedManager = users.find(u => u.id === data.assignedToId);
    const assignedTo = selectedManager 
        ? { userId: selectedManager.id, name: selectedManager.name, email: selectedManager.email }
        : { userId: null, name: 'Unassigned', email: null };

    const { assignedToId, ...rest } = data;
    const updateData = { 
        ...rest, 
        assignedTo, 
        implementationDate: data.implementationDate?.toISOString() || null 
    };

    const docRef = doc(firestore, 'schools', schoolId);
    updateDoc(docRef, updateData).then(() => {
        toast({ title: 'Profile Updated', description: `Changes to ${data.name} saved successfully.` });
        logActivity({ 
            schoolId, 
            userId: user.uid, 
            type: 'school_updated', 
            source: 'user_action', 
            description: `updated school profile for "${data.name}"` 
        });
        router.push('/admin/schools');
    }).catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
            path: docRef.path, 
            operation: 'update', 
            requestResourceData: updateData 
        }));
    });
  };

  const isGlobalLoading = isSchoolLoading || isUsersLoading;

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
              <CardHeader className="bg-muted/30 border-b pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Building className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-black uppercase tracking-tight">Identity & Status</CardTitle>
                        <CardDescription className="text-xs font-medium">Core institutional metadata.</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField 
                    control={methods.control} 
                    name="name" 
                    render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Official School Name</FormLabel>
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
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                    <SelectItem value="Archived">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} 
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                    <FormField control={methods.control} name="initials" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Initials</FormLabel>
                            <FormControl>
                                <Input {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-black text-center" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={methods.control} name="slogan" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Motto</FormLabel>
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
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl"><Banknote className="h-5 w-5 text-primary" /></div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Financial Profile</CardTitle>
                            <CardDescription className="text-xs font-medium">Configure billing preferences and effective rates.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={methods.control} name="subscriptionPackageId" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Subscription Tier</FormLabel>
                                <Select 
                                    onValueChange={(val) => {
                                        field.onChange(val);
                                        const pkg = packages?.find(p => p.id === val);
                                        if (pkg) {
                                            methods.setValue('subscriptionRate', pkg.ratePerStudent, { shouldDirty: true });
                                            methods.setValue('discountPercentage', 0, { shouldDirty: true });
                                        }
                                    }} 
                                    value={field.value || 'none'}
                                >
                                    <FormControl>
                                        <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all">
                                            <SelectValue placeholder="Pick a package..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="none">No Subscription</SelectItem>
                                        {packages?.map(pkg => (
                                            <SelectItem key={pkg.id} value={pkg.id}>{pkg.name} ({pkg.currency} {pkg.ratePerStudent}/student)</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={methods.control} name="currency" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Billing Currency</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-black">
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="GHS">Ghanaian Cedi (GH¢)</SelectItem>
                                        <SelectItem value="USD">US Dollar ($)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                    </div>

                    {/* Rate and Discount Adjustment */}
                    <div className={cn(
                        "p-6 rounded-[1.5rem] border-2 border-dashed transition-all duration-500",
                        watchPackageId && watchPackageId !== 'none' ? "bg-primary/5 border-primary/20" : "bg-muted/10 border-border opacity-40 pointer-events-none"
                    )}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-primary text-white rounded-lg shadow-sm"><Target className="h-4 w-4" /></div>
                            <p className="text-[10px] font-black uppercase tracking-widest">Rate Adjustment Engine</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <FormField control={methods.control} name="discountPercentage" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-primary ml-1 flex items-center gap-1.5"><Percent className="h-3 w-3" /> Percentage Grant</FormLabel>
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
                                            className="h-12 rounded-xl bg-white border-primary/10 shadow-inner font-black text-xl text-center" 
                                        />
                                    </FormControl>
                                    <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60">Grant a school-specific reduction</FormDescription>
                                </FormItem>
                            )} />
                            <FormField control={methods.control} name="subscriptionRate" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-primary ml-1 flex items-center gap-1.5"><Banknote className="h-3 w-3" /> Effective Unit Rate</FormLabel>
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
                                            className="h-12 rounded-xl bg-white border-primary/10 shadow-inner font-black text-xl text-center" 
                                        />
                                    </FormControl>
                                    <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60">Final amount billed per student</FormDescription>
                                </FormItem>
                            )} />
                        </div>
                    </div>

                    <FormField control={methods.control} name="billingAddress" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Custom Billing Address</FormLabel>
                            <FormControl>
                                <Textarea {...field} placeholder="If different from campus location..." className="min-h-[80px] rounded-xl bg-muted/20 border-none shadow-inner" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                        <FormField control={methods.control} name="arrearsBalance" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-rose-600 ml-1 flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> Outstanding Arrears</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} className="h-11 rounded-xl bg-rose-50/50 border-none shadow-inner font-black text-rose-700" />
                                </FormControl>
                                <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60">Manual adjustment for unpaid balance</FormDescription>
                            </FormItem>
                        )} />
                        <FormField control={methods.control} name="creditBalance" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1 flex items-center gap-1.5"><Wallet className="h-3 w-3" /> Available Credit</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} className="h-11 rounded-xl bg-emerald-50/50 border-none shadow-inner font-black text-emerald-700" />
                                </FormControl>
                                <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60">Manual adjustment for overpayments</FormDescription>
                            </FormItem>
                        )} />
                    </div>
                </CardContent>
            </Card>
            
            {/* Account Assignment Card */}
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl"><UserCheck className="h-5 w-5 text-primary" /></div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Account Assignment</CardTitle>
                            <CardDescription className="text-xs font-medium">Internal owner responsible for this account.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <FormField control={methods.control} name="assignedToId" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Assigned Account Manager</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all">
                                        <SelectValue placeholder="Select manager..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {users?.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
            </Card>

            {/* Contacts & Modules Section */}
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl"><User className="h-5 w-5 text-primary" /></div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Staff focal persons</CardTitle>
                            <CardDescription className="text-xs font-medium">Primary directory of stakeholders.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <FocalPersonManager />
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl"><Plus className="h-5 w-5 text-primary" /></div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Requested Modules</CardTitle>
                            <CardDescription className="text-xs font-medium">Select activated SmartSapp features.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <FormField control={methods.control} name="modules" render={({ field }) => (
                        <FormItem>
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
          <div className="space-y-8">
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl"><MapPin className="h-5 w-5 text-primary" /></div>
                        <div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Regional Settings</CardTitle>
                            <CardDescription className="text-xs font-medium">Geographic classification.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <FormField control={methods.control} name="zone" render={({ field, fieldState }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Geographic Zone</FormLabel>
                            <FormControl>
                                <ZoneSelect value={field.value} onValueChange={field.onChange} error={!!fieldState.error} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} /> 
                    <FormField control={methods.control} name="location" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Physical Address</FormLabel>
                            <FormControl>
                                <Textarea {...field} className="min-h-[80px] rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-sm p-4" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} /> 
                    <FormField control={methods.control} name="nominalRoll" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Nominal Roll</FormLabel>
                            <FormControl>
                                <Input type="number" {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
            </Card>

            <div className="pt-4 sticky top-24">
                <Button 
                    type="submit" 
                    className="w-full h-14 rounded-2xl font-black text-lg shadow-xl gap-3 transition-all active:scale-95" 
                    disabled={methods.formState.isSubmitting}
                >
                    {methods.formState.isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <ShieldCheck className="h-6 w-6" />} 
                    Commit Changes
                </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

export default function EditSchoolPage() {
  const params = useParams();
  const schoolId = params.id as string;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
      <div className="max-w-5xl mx-auto space-y-8">
        {schoolId ? <EditSchoolForm schoolId={schoolId} /> : <p className="text-center py-20 text-muted-foreground font-medium">School context not found.</p>}
      </div>
    </div>
  );
}
