"use client";

import * as React from "react";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
    Calendar as CalendarIcon, 
    X, 
    Building, 
    Users, 
    Zap, 
    ShieldCheck,
    Banknote,
    CreditCard,
    Wallet,
    Percent,
    Loader2, 
    Target
} from "lucide-react";
import { collection, query, where, orderBy } from 'firebase/firestore';
import { handleSignupAction } from '@/lib/signup-actions';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useFirestore, errorEmitter, FirestorePermissionError, useCollection, useMemoFirebase } from "@/firebase";
import { FocalPersonManager } from "@/app/admin/entities/components/FocalPersonManager";
import { PackageSelect } from "@/app/admin/entities/components/PackageSelect";
import { type SubscriptionPackage } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = z.object({
  organization: z.string().min(2, { message: "Organization must be at least 2 characters." }),
  location: z.string().min(5, { message: "Location must be at least 5 characters." }),
  nominalRoll: z.coerce.number().min(1, { message: "Nominal roll must be at least 1." }),
  modules: z.string().min(10, { message: "Modules description must be at least 10 characters." }),
  includeDroneFootage: z.boolean().default(false),
  implementationDate: z.date({
    required_error: "An implementation date is required.",
  }),
  referee: z.string().optional(),
  focalPersons: z.array(z.object({
    name: z.string().min(2, 'Name required.'),
    email: z.string().email('Invalid email.'),
    phone: z.string().min(10, 'Invalid phone.'),
    type: z.string().min(1, 'Role required.'),
    isSignatory: z.boolean().default(false),
  })).min(1, 'At least one focal person is required.')
    .refine(people => people.some(p => p.isSignatory), { message: 'One person must be marked as Signatory.' }),
  
  // Financial Profile
  billingAddress: z.string().optional(),
  currency: z.string().default('GHS'),
  subscriptionPackageId: z.string().optional(),
  subscriptionRate: z.coerce.number().default(0),
  discountPercentage: z.coerce.number().min(0).max(100).default(0),
  arrearsBalance: z.coerce.number().default(0),
  creditBalance: z.coerce.number().default(0),

  notifySchool: z.boolean().default(true),
  notifySchoolEmails: z.array(z.string().email()).default([]),
  notifySmartSapp: z.boolean().default(true),
  notifyOnboarding: z.boolean().default(true),
  notifySchoolBySms: z.boolean().default(true),
  notifySchoolSmsNumbers: z.array(z.string().min(10, { message: "Phone number must be at least 10 digits." })).default([]),
});

type FormData = z.infer<typeof formSchema>;

export default function NewSchoolSignupForm() {
  const { toast } = useToast();
  const firestore = useFirestore();

  // For public form, we filter for active packages explicitly shared with the 'onboarding' workspace
  const packagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'subscription_packages'), 
        where('workspaceIds', 'array-contains', 'onboarding'),
        where('isActive', '==', true), 
        orderBy('name', 'asc')
    );
  }, [firestore]);
  const { data: packages } = useCollection<SubscriptionPackage>(packagesQuery);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      organization: "",
      location: "",
      nominalRoll: 0,
      modules: "",
      includeDroneFootage: false,
      referee: "",
      focalPersons: [{ name: '', email: '', phone: '', type: 'School Owner', isSignatory: true }],
      billingAddress: "",
      currency: "GHS",
      subscriptionPackageId: "none",
      subscriptionRate: 0,
      discountPercentage: 0,
      arrearsBalance: 0,
      creditBalance: 0,
      notifySchool: true,
      notifySchoolEmails: [],
      notifySmartSapp: true,
      notifyOnboarding: true,
      notifySchoolBySms: true,
      notifySchoolSmsNumbers: [],
    },
  });

  const [emailInputValue, setEmailInputValue] = React.useState("");
  const emailInputRef = React.useRef<HTMLInputElement>(null);
  const [smsInputValue, setSmsInputValue] = React.useState("");
  const smsInputRef = React.useRef<HTMLInputElement>(null);

  const watchNotifySchool = form.watch("notifySchool");
  const watchFocalPersons = form.watch("focalPersons");
  const watchPackageId = form.watch("subscriptionPackageId");
  
  const primarySignatory = watchFocalPersons.find(p => p.isSignatory) || watchFocalPersons[0];
  const watchMainEmail = primarySignatory?.email;
  const isMainEmailValid = z.string().email().safeParse(watchMainEmail).success;

  const watchNotifySchoolBySms = form.watch("notifySchoolBySms");
  const watchMainPhone = primarySignatory?.phone;
  const isMainPhoneValid = z.string().min(10).safeParse(watchMainPhone).success;

  const handleDiscountChange = (val: number) => {
    const pkg = packages?.find(p => p.id === watchPackageId);
    if (!pkg) return;
    const newRate = pkg.ratePerStudent * (1 - val / 100);
    form.setValue('subscriptionRate', parseFloat(newRate.toFixed(2)), { shouldDirty: true });
  };

  const handleRateChange = (val: number) => {
    const pkg = packages?.find(p => p.id === watchPackageId);
    if (!pkg || pkg.ratePerStudent === 0) return;
    const newDiscount = ((pkg.ratePerStudent - val) / pkg.ratePerStudent) * 100;
    form.setValue('discountPercentage', parseFloat(newDiscount.toFixed(2)), { shouldDirty: true });
  };

  const onSubmit = async (data: FormData) => {
    
    // 1. Send to Pabbly Webhook
    try {
      const schoolEmails = [];
      if (data.notifySchool) {
        if (watchMainEmail) schoolEmails.push(watchMainEmail);
        if (data.notifySchoolEmails) schoolEmails.push(...data.notifySchoolEmails);
      }
      
      const schoolSmsNumbers = [];
      if (data.notifySchoolBySms) {
          if (watchMainPhone) schoolSmsNumbers.push(watchMainPhone);
          if (data.notifySchoolSmsNumbers) schoolSmsNumbers.push(...data.notifySchoolSmsNumbers);
      }

      const webhookData: Record<string, any> = { ...data };
      
      webhookData.submissionDate = new Date().toISOString();
      webhookData.implementationDate = format(data.implementationDate, 'yyyy-MM-dd');
      webhookData.includeDroneFootage = data.includeDroneFootage ? "Yes" : "No";
      webhookData.notifySchoolEmails = [...new Set(schoolEmails)].join(',');
      webhookData.notifySchoolSmsNumbers = [...new Set(schoolSmsNumbers)].join(',');
      webhookData.notifySmartSappEmails = data.notifySmartSapp ? "team@minex360.com" : "";
      webhookData.notifyOnboardingEmails = data.notifyOnboarding ? "joseph.aidoo@smartsapp.com, onboarding@minex360.com, sitso.aglago@smartsapp.com, finance@smartsapp.com" : "";

      webhookData.notifySchool = data.notifySchool ? "Yes" : "No";
      webhookData.notifySmartSapp = data.notifySmartSapp ? "Yes" : "No";
      webhookData.notifyOnboarding = data.notifyOnboarding ? "Yes" : "No";
      webhookData.notifySchoolBySms = data.notifySchoolBySms ? "Yes" : "No";

      await fetch("https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTZiMDYzNTA0MzE1MjZkNTUzMzUxMzYi_pc", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookData),
      });

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Communication Error",
        description: "Problem with the gateway submission. Please try again.",
      });
      return;
    }

    // 2. Create entity and workspace_entity records (Requirements 10.1, 10.2, 10.3)
    if (!firestore) return;

    const selectedPackage = packages?.find(p => p.id === data.subscriptionPackageId);

    try {
      // Use the new signup action that creates entity + workspace_entity
      // This does NOT create legacy school records (Requirement 10.3)
      const result = await handleSignupAction({
        organizationId: 'default_org', // TODO: Get from user context
        workspaceId: 'onboarding', // Default workspace for new signups
        name: data.organization,
        location: data.location,
        focalPersons: data.focalPersons,
        nominalRoll: data.nominalRoll,
        billingAddress: data.billingAddress,
        currency: data.currency,
        subscriptionPackageId: data.subscriptionPackageId === 'none' ? undefined : data.subscriptionPackageId,
        subscriptionPackageName: selectedPackage ? selectedPackage.name : 'Standard',
        subscriptionRate: data.subscriptionRate,
        discountPercentage: data.discountPercentage,
        arrearsBalance: data.arrearsBalance,
        creditBalance: data.creditBalance,
        implementationDate: data.implementationDate.toISOString(),
        referee: data.referee,
        includeDroneFootage: data.includeDroneFootage,
        pipelineId: 'default_pipeline', // TODO: Get default pipeline for onboarding workspace
        stageId: 'welcome', // Default stage for new signups
        userId: 'system', // TODO: Get from user context if available
      });

      if (result.success) {
        toast({ 
          title: "Registration Successful!", 
          description: "Institutional profile initialized with entity architecture." 
        });
        form.reset();
      } else {
        throw new Error(result.error || 'Failed to create signup');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "Could not complete signup. Please try again.",
      });
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12 text-left pb-20">
        
        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                        <Building className="h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black uppercase tracking-tight">Institutional Profile</CardTitle>
                        <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Core identification and logistics</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
                <FormField
                    control={form.control}
                    name="organization"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Official School Name</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g. Ghana International School" {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold text-lg" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Physical Location</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Airport Residential Area, Accra" {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="nominalRoll"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Student Footprint (Roll)</FormLabel>
                            <FormControl>
                                <Input type="number" {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-black" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                        <Users className="h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black uppercase tracking-tight">Staff focal persons</CardTitle>
                        <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Authorized institutional representatives</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8">
                <FocalPersonManager />
            </CardContent>
        </Card>

        {/* Financial Profile Card */}
        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                        <Banknote className="h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black uppercase tracking-tight">Financial Profile</CardTitle>
                        <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Configure billing preferences and effective rates</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField control={form.control} name="subscriptionPackageId" render={({ field, fieldState }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Subscription Tier</FormLabel>
                            <FormControl>
                                <PackageSelect 
                                    value={field.value} 
                                    onValueChange={(val, pkg) => {
                                        field.onChange(val);
                                        if (pkg) {
                                            form.setValue('subscriptionRate', pkg.ratePerStudent, { shouldDirty: true });
                                            form.setValue('discountPercentage', 0, { shouldDirty: true });
                                        }
                                    }}
                                    error={!!fieldState.error}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="currency" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Billing Currency</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-black">
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
                    watchPackageId && watchPackageId !== 'none' ? "bg-primary/5 border-primary/20" : "bg-slate-50 border-border opacity-40 pointer-events-none"
                )}>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-primary text-white rounded-lg shadow-sm"><Target className="h-4 w-4" /></div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Rate Optimization Engine</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField control={form.control} name="discountPercentage" render={({ field }) => (
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
                                        className="h-12 rounded-xl bg-card border-primary/10 shadow-inner font-black text-xl text-center" 
                                    />
                                </FormControl>
                                <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Grant a reduction for this campus</FormDescription>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="subscriptionRate" render={({ field }) => (
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
                                        className="h-12 rounded-xl bg-card border-primary/10 shadow-inner font-black text-xl text-center" 
                                    />
                                </FormControl>
                                <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Effective rate billed per student</FormDescription>
                            </FormItem>
                        )} />
                    </div>
                </div>

                <FormField control={form.control} name="billingAddress" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Billing Remittance Address</FormLabel>
                        <FormControl>
                            <Textarea {...field} placeholder="Specific address for financial documents..." className="min-h-[100px] rounded-xl bg-slate-50 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-medium shadow-inner" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                    <FormField control={form.control} name="arrearsBalance" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-rose-600 ml-1 flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> Carried Arrears</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" {...field} className="h-11 rounded-xl bg-rose-500/10 border-none shadow-inner font-black text-rose-500" />
                            </FormControl>
                            <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Previous system outstanding balance</FormDescription>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="creditBalance" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1 flex items-center gap-1.5"><Wallet className="h-3 w-3" /> Initial Credit</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" {...field} className="h-11 rounded-xl bg-emerald-500/10 border-none shadow-inner font-black text-emerald-500" />
                            </FormControl>
                            <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Overpayments from old system</FormDescription>
                        </FormItem>
                    )} />
                </div>
            </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-slate-50 border-b p-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                        <Zap className="h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black uppercase tracking-tight">Functional Needs</CardTitle>
                        <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Requirements and implementation window</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
                <FormField
                    control={form.control}
                    name="modules"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Required Capabilities</FormLabel>
                        <FormControl>
                            <Textarea placeholder="e.g. Student Billing, Child Security, Staff Attendance..." {...field} className="min-h-[120px] rounded-2xl bg-slate-50 border-none p-6 font-medium leading-relaxed shadow-inner" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                        control={form.control}
                        name="implementationDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col text-left">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 mb-2">Target Go-Live Date</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button variant={"outline"} className={cn("h-12 justify-start pl-4 text-left font-bold rounded-xl border-none bg-slate-50 shadow-inner", !field.value && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="referee"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Referral Source</FormLabel>
                            <FormControl>
                                <Input placeholder="How did you hear about us?" {...field} className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            </CardContent>
        </Card>

        <div className="space-y-6">
            <h3 className="text-xl font-black uppercase tracking-tight px-2 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Dispatch Protocols
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-[2rem] border border-border/50 bg-white">
                    <CardContent className="p-6 space-y-6">
                        <FormField
                            control={form.control}
                            name="notifySchool"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-2xl border p-4 bg-slate-50">
                                <div className="space-y-0.5">
                                <FormLabel className="text-sm font-black uppercase">Email Acknowledgement</FormLabel>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Confirmation to focal persons</p>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                            )}
                        />
                        {watchNotifySchool && (
                            <div className="space-y-3 px-1 animate-in fade-in slide-in-from-top-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Additional Receivers</Label>
                                <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-slate-50 shadow-inner">
                                    {isMainEmailValid && <Badge variant="outline" className="bg-card font-bold h-6 border-primary/20 text-primary">{watchMainEmail}</Badge>}
                                    {form.getValues('notifySchoolEmails').map(e => <Badge key={e} className="bg-primary h-6 font-bold">{e}</Badge>)}
                                    <Input 
                                        placeholder="Add email..." 
                                        value={emailInputValue} 
                                        onChange={e => setEmailInputValue(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ',') {
                                                e.preventDefault();
                                                const email = emailInputValue.trim();
                                                if (z.string().email().safeParse(email).success) {
                                                    const current = form.getValues('notifySchoolEmails');
                                                    if (!current.includes(email)) form.setValue('notifySchoolEmails', [...current, email]);
                                                    setEmailInputValue('');
                                                }
                                            }
                                        }}
                                        className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0 text-xs w-32"
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border border-border/50 bg-white">
                    <CardContent className="p-6 space-y-6">
                        <FormField
                            control={form.control}
                            name="notifySchoolBySms"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-2xl border p-4 bg-slate-50">
                                <div className="space-y-0.5">
                                <FormLabel className="text-sm font-black uppercase">SMS Alerting</FormLabel>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Real-time handset confirmation</p>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                            )}
                        />
                        {watchNotifySchoolBySms && (
                            <div className="space-y-3 px-1 animate-in fade-in slide-in-from-top-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Handset Targets</Label>
                                <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-slate-50 shadow-inner">
                                    {isMainPhoneValid && <Badge variant="outline" className="bg-card font-bold h-6 border-primary/20 text-primary">{watchMainPhone}</Badge>}
                                    {form.getValues('notifySchoolSmsNumbers').map(n => <Badge key={n} className="bg-primary h-6 font-bold">{n}</Badge>)}
                                    <Input 
                                        placeholder="Add number..." 
                                        value={smsInputValue} 
                                        onChange={e => setSmsInputValue(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ',') {
                                                e.preventDefault();
                                                const num = smsInputValue.trim();
                                                if (num.length >= 10) {
                                                    const current = form.getValues('notifySchoolSmsNumbers');
                                                    if (!current.includes(num)) form.setValue('notifySchoolSmsNumbers', [...current, num]);
                                                    setSmsInputValue('');
                                                }
                                            }
                                        }}
                                        className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0 text-xs w-32"
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>

        <div className="flex justify-center pt-8">
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="h-16 px-20 rounded-[2rem] font-black text-xl shadow-2xl shadow-primary/30 transition-all active:scale-95 uppercase tracking-widest">
            {form.formState.isSubmitting ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <Building className="mr-3 h-6 w-6" />}
            Execute Institutional Registration
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
