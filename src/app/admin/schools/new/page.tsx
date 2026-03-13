
'use client';

import * as React from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Building, MapPin, User, Plus, UserCheck, Banknote, CreditCard, Wallet, Percent, Target, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, query, where, orderBy } from 'firebase/firestore';

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
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, errorEmitter, FirestorePermissionError, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { ModuleSelect } from '../components/ModuleSelect';
import { ZoneSelect } from '../components/ZoneSelect';
import { FocalPersonManager } from '../components/FocalPersonManager';
import { ManagerSelect } from '../components/ManagerSelect';
import { PackageSelect } from '../components/PackageSelect';
import { MediaSelect } from '../components/media-select';
import { logActivity } from '@/lib/activity-logger';
import { type UserProfile, type SubscriptionPackage } from '@/lib/types';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  name: z.string().min(2, { message: 'School name must be at least 2 characters.' }),
  initials: z.string().optional(),
  slogan: z.string().optional(),
  status: z.enum(['Active', 'Inactive', 'Archived']),
  lifecycleStatus: z.enum(['Onboarding', 'Active', 'Churned']),
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
    type: z.string().min(1, 'Role required.'),
    isSignatory: z.boolean().default(false),
  })).min(1, 'At least one focal person is required.')
    .refine(people => people.some(p => p.isSignatory), { message: 'Exactly one signatory must be selected.' }),
  modules: z.array(z.object({
    id: z.string(),
    name: z.string(),
    abbreviation: z.string(),
    color: z.string(),
  })).optional(),
  implementationDate: z.date().optional(),
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

type FormData = z.infer<typeof formSchema>;

export default function NewSchoolPage() {
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('isAuthorized', '==', true));
  }, [firestore]);
  const { data: users, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

  const packagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'subscription_packages'), where('isActive', '==', true), orderBy('name', 'asc'));
  }, [firestore]);
  const { data: packages } = useCollection<SubscriptionPackage>(packagesQuery);

  const methods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      initials: '',
      slogan: '',
      status: 'Active',
      lifecycleStatus: 'Onboarding',
      location: '',
      nominalRoll: 0,
      focalPersons: [{ name: '', email: '', phone: '', type: 'Administrator', isSignatory: true }],
      modules: [],
      referee: '',
      includeDroneFootage: false,
      assignedToId: 'unassigned',
      currency: 'GHS',
      subscriptionRate: 0,
      discountPercentage: 0,
      arrearsBalance: 0,
      creditBalance: 0,
      subscriptionPackageId: 'none'
    },
  });

  const watchName = methods.watch("name");
  const watchPackageId = methods.watch("subscriptionPackageId");

  // Auto-generate initials
  React.useEffect(() => {
    if (watchName) {
        const initials = watchName.split(' ').map(word => word[0]).join('').toUpperCase();
        methods.setValue('initials', initials, { shouldValidate: true });
    }
  }, [watchName, methods]);

  React.useEffect(() => {
      if (user && methods.getValues('assignedToId') === 'unassigned') {
          methods.setValue('assignedToId', user.uid);
      }
  }, [user, methods]);

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

  const onSubmit = async (data: FormData) => {
    if (!firestore || !user || !users) return;

    const selectedManager = users.find(u => u.id === data.assignedToId);
    const assignedTo = selectedManager 
        ? { userId: selectedManager.id, name: selectedManager.name, email: selectedManager.email }
        : { userId: null, name: 'Unassigned', email: null };

    const slug = data.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Resolve Package Name for variables
    const selectedPackage = packages?.find(p => p.id === data.subscriptionPackageId);

    const { assignedToId, ...rest } = data;
    const schoolData = {
      ...rest,
      slug,
      assignedTo,
      pipelineId: 'institutional_onboarding', // Default pipeline
      subscriptionPackageId: data.subscriptionPackageId === 'none' ? null : data.subscriptionPackageId,
      subscriptionPackageName: selectedPackage ? selectedPackage.name : 'Standard',
      implementationDate: data.implementationDate?.toISOString() || null,
      stage: { id: 'welcome', name: 'Welcome', order: 1, color: '#f72585' },
      createdAt: new Date().toISOString(),
    };

    const schoolsCol = collection(firestore, 'schools');
    try {
      const docRef = await addDoc(schoolsCol, schoolData);
      toast({ title: 'School Initialized', description: `${data.name} is now active in the pipeline.` });
      await logActivity({
          schoolId: docRef.id, schoolName: data.name, schoolSlug: slug, userId: user.uid,
          type: 'school_created', source: 'user_action',
          description: `registered new school "${data.name}" in ${data.zone.name}`,
      });
      router.push('/admin/schools');
    } catch (error: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: schoolsCol.path, operation: 'create', requestResourceData: schoolData }));
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
      <div className="max-w-5xl mx-auto space-y-8">
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8 pb-24 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                  <CardHeader className="bg-muted/30 border-b pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Building className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-lg font-black uppercase tracking-tight">General Identity</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField control={methods.control} name="name" render={({ field }) => (
                        <FormItem className="md:col-span-2"><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Official Name</FormLabel><FormControl><Input placeholder="School name..." {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-lg" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={methods.control} name="initials" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Initials</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-black text-center" /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={methods.control} name="status" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Operational Status</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl shadow-2xl border-none">
                                        <SelectItem value="Active" className="font-bold">Active</SelectItem>
                                        <SelectItem value="Inactive" className="font-bold">Inactive</SelectItem>
                                        <SelectItem value="Archived" className="font-bold">Archived</SelectItem>
                                    </SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={methods.control} name="lifecycleStatus" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Lifecycle Status</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-11 rounded-xl bg-primary/5 border-primary/20 text-primary font-black"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent className="rounded-xl shadow-2xl border-none">
                                        <SelectItem value="Onboarding" className="font-black">Onboarding</SelectItem>
                                        <SelectItem value="Active" className="font-black">Active</SelectItem>
                                        <SelectItem value="Churned" className="font-black">Churned</SelectItem>
                                    </SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )} />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Institutional Logo</Label>
                        <Controller 
                            name="logoUrl"
                            control={methods.control}
                            render={({ field }) => (
                                <MediaSelect {...field} filterType="image" className="rounded-2xl" />
                            )}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Motto / Slogan</Label>
                        <FormField control={methods.control} name="slogan" render={({ field }) => (
                            <FormItem><FormControl><Input placeholder="e.g. Forward Ever" {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 italic font-medium" /></FormControl><FormMessage /></FormItem>
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
                            <FormField control={methods.control} name="subscriptionPackageId" render={({ field, fieldState }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Subscription Tier</FormLabel>
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
                            "p-6 rounded-[1.5rem] border-2 border-dashed transition-all duration-500",
                            watchPackageId && watchPackageId !== 'none' ? "bg-primary/5 border-primary/20" : "bg-muted/10 border-border opacity-40 pointer-events-none"
                        )}>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-primary text-white rounded-lg shadow-sm"><Target className="h-4 w-4" /></div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Rate Optimization Engine</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <FormField control={methods.control} name="discountPercentage" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-primary ml-1 flex items-center gap-1.5"><Percent className="h-3 w-3" /> Preferred Discount</FormLabel>
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
                                        <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Grant a reduction for this campus</FormDescription>
                                    </FormItem>
                                )} />
                                <FormField control={methods.control} name="subscriptionRate" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase text-primary ml-1 flex items-center gap-1.5"><Banknote className="h-3 w-3" /> Target Unit Rate</FormLabel>
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
                                        <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Effective rate billed per student</FormDescription>
                                    </FormItem>
                                )} />
                            </div>
                        </div>

                        <FormField control={methods.control} name="billingAddress" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Billing Remittance Address</FormLabel>
                                <FormControl>
                                    <Textarea {...field} placeholder="Specific address for financial documents..." className="min-h-[100px] rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-medium shadow-inner" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                            <FormField control={methods.control} name="arrearsBalance" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-rose-600 ml-1 flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> Carried Arrears</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} className="h-11 rounded-xl bg-rose-50/50 border-none shadow-inner font-black text-rose-700" />
                                    </FormControl>
                                    <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Previous system outstanding balance</FormDescription>
                                </FormItem>
                            )} />
                            <FormField control={methods.control} name="creditBalance" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1 flex items-center gap-1.5"><Wallet className="h-3 w-3" /> Initial Credit</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} className="h-11 rounded-xl bg-emerald-50/50 border-none shadow-inner font-black text-emerald-700" />
                                    </FormControl>
                                    <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Overpayments from old system</FormDescription>
                                </FormItem>
                            )} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b pb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl"><UserCheck className="h-5 w-5 text-primary" /></div>
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Account Assignment</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <FormField control={methods.control} name="assignedToId" render={({ field, fieldState }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Assign Account Manager</FormLabel>
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

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden"><CardHeader className="bg-muted/30 border-b pb-6"><div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><User className="h-5 w-5 text-primary" /></div><CardTitle className="text-lg font-black uppercase tracking-tight">Contact Directory</CardTitle></div></CardHeader><CardContent className="p-6"><FocalPersonManager /></CardContent></Card>
                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden"><CardHeader className="bg-muted/30 border-b pb-6"><div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><Plus className="h-5 w-5 text-primary" /></div><CardTitle className="text-lg font-black uppercase tracking-tight">Functional Selection</CardTitle></div></CardHeader><CardContent className="p-6"><FormField control={methods.control} name="modules" render={({ field }) => (<FormItem><FormControl><ModuleSelect {...field} /></FormControl><FormMessage /></FormItem>)} /></CardContent></Card>
              </div>
              <div className="space-y-8">
                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden"><CardHeader className="bg-muted/30 border-b pb-6"><div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><MapPin className="h-5 w-5 text-primary" /></div><CardTitle className="text-lg font-black uppercase tracking-tight">Geographic Assignment</CardTitle></div></CardHeader><CardContent className="p-6 space-y-6"><FormField control={methods.control} name="zone" render={({ field, fieldState }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Assigned Zone</FormLabel><FormControl><ZoneSelect value={field.value} onValueChange={field.onChange} error={!!fieldState.error} /></FormControl><FormMessage /></FormItem>)} /> <FormField control={methods.control} name="location" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Address</FormLabel><FormControl><Textarea {...field} className="min-h-[80px] rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-sm p-4" /></FormControl><FormMessage /></FormItem>)} /> <FormField control={methods.control} name="nominalRoll" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Total Roll</FormLabel><FormControl><Input type="number" {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" /></FormControl><FormMessage /></FormItem>)} /></CardContent></Card>
                <div className="pt-4 sticky top-24"><Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl gap-3 transition-all active:scale-95" disabled={methods.formState.isSubmitting || isUsersLoading}>{methods.formState.isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Building className="h-6 w-6" />} Initialize School</Button></div>
              </div>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
