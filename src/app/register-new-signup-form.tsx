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
import { dispatchSignupWebhook } from '@/lib/webhook-actions';

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
import { EntityContactManager } from "@/app/admin/entities/components/EntityContactManager";
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
  entityContacts: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(2, 'Name required.'),
    email: z.string().email('Invalid email.').optional().or(z.literal('')),
    phone: z.string().min(10, 'Invalid phone.').optional().or(z.literal('')),
    typeKey: z.string().min(1, 'Role required.'),
    typeLabel: z.string().min(1, 'Role label required.'),
    isSignatory: z.boolean().default(false),
    isPrimary: z.boolean().default(false),
    order: z.number().default(0),
  })).min(1, 'At least one contact is required.')
    .refine(people => people.filter(p => p.isSignatory).length === 1, { message: 'Exactly one signatory must be selected.' })
    .refine(people => people.filter(p => p.isPrimary).length === 1, { message: 'Exactly one primary contact must be selected.' }),
  
  // Financial Profile
  billingAddress: z.string().optional(),
  currency: z.string().default('GHS'),
  subscriptionPackageId: z.string().optional(),
  subscriptionRate: z.coerce.number().default(0),
  discountPercentage: z.coerce.number().min(0).max(100).default(0),
  arrearsBalance: z.coerce.number().default(0),
  creditBalance: z.coerce.number().default(0),

  notifySchool: z.boolean().default(true),
  notifySmartSapp: z.boolean().default(true),
  notifyOnboarding: z.boolean().default(true),
  notifySchoolBySms: z.boolean().default(true),
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
      entityContacts: [{ id: 'primary-owner', name: '', email: '', phone: '', typeKey: 'school_owner', typeLabel: 'School Owner', isSignatory: true, isPrimary: true, order: 0 }],
      billingAddress: "",
      currency: "GHS",
      subscriptionPackageId: "none",
      subscriptionRate: 0,
      discountPercentage: 0,
      arrearsBalance: 0,
      creditBalance: 0,
      notifySchool: true,
      notifySmartSapp: true,
      notifyOnboarding: true,
      notifySchoolBySms: true,
    },
  });

  const watchEntityContacts = form.watch("entityContacts");
  const watchPackageId = form.watch("subscriptionPackageId");

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
    
    // 1. Send to Pabbly Webhook (via server action to avoid CORS)
    try {
      const schoolEmails = data.entityContacts
        .map(c => c.email?.trim())
        .filter(email => email && z.string().email().safeParse(email).success);
      
      const schoolSmsNumbers = data.entityContacts
        .map(c => c.phone?.trim())
        .filter(phone => phone && phone.length >= 10);

      const webhookData: Record<string, any> = { ...data };
      
      webhookData.submissionDate = new Date().toISOString();
      webhookData.implementationDate = format(data.implementationDate, 'yyyy-MM-dd');
      webhookData.includeDroneFootage = data.includeDroneFootage ? "Yes" : "No";
      
      // Extract Primary Contact for targeted template fields
      const primaryContact = data.entityContacts.find(c => c.isPrimary) || data.entityContacts[0];
      webhookData.contactPerson = primaryContact?.name || "";
      webhookData.phone = primaryContact?.phone || "";
      webhookData.email = primaryContact?.email || "";
      
      // Only include addresses if the corresponding notify flag is true
      webhookData.notifySchoolEmails = data.notifySchool ? [...new Set(schoolEmails)].join(',') : '';
      webhookData.notifySchoolSmsNumbers = data.notifySchoolBySms ? [...new Set(schoolSmsNumbers)].join(',') : '';
      
      webhookData.notifySmartSappEmails = data.notifySmartSapp ? "team@minex360.com" : "";
      webhookData.notifyOnboardingEmails = data.notifyOnboarding ? "joseph.aidoo@smartsapp.com, onboarding@minex360.com, sitso.aglago@smartsapp.com, finance@smartsapp.com" : "";

      webhookData.notifySchool = data.notifySchool ? "Yes" : "No";
      webhookData.notifySmartSapp = data.notifySmartSapp ? "Yes" : "No";
      webhookData.notifyOnboarding = data.notifyOnboarding ? "Yes" : "No";
      webhookData.notifySchoolBySms = data.notifySchoolBySms ? "Yes" : "No";

      // Clean non-serializable fields before sending
      delete webhookData.implementationDate_raw;
      
      console.log('>>> [SIGNUP:FORM] Preparing webhook data:', webhookData);
      const webhookResult = await dispatchSignupWebhook(webhookData);
      console.log('>>> [SIGNUP:FORM] Webhook result:', webhookResult);
      if (!webhookResult.success) {
        console.warn('Webhook dispatch warning:', webhookResult.error);
        // Don't block signup on webhook failure — entity creation continues
      }

    } catch (error) {
      console.warn('Webhook dispatch failed silently:', error);
      // Don't block signup on webhook failure
    }

    // 2. Create entity and workspace_entity records (Requirements 10.1, 10.2, 10.3)
    if (!firestore) return;

    const selectedPackage = packages?.find(p => p.id === data.subscriptionPackageId);

    try {
      // Use the new signup action that creates entity + workspace_entity
      // This does NOT create legacy school records (Requirement 10.3)
      const result = await handleSignupAction({
        organizationId: 'smartsapp-hq',
        workspaceId: 'onboarding', // Default workspace for new signups
        name: data.organization,
        location: data.location,
        entityContacts: data.entityContacts.map((c, i) => ({
            ...c,
            id: c.id || `contact-${Date.now()}-${i}`,
            order: i
        })),
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
        userId: 'system-signup', // Prefixed with 'system-' to bypass permission checks in createEntityAction
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="pb-20">
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border bg-card overflow-hidden">
            <CardContent className="p-0">
                {/* School Details Section */}
                <div className="p-8 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary rounded-xl ring-1 ring-primary/20 shadow-sm" aria-hidden="true">
                            <Building className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold tracking-tight">School Details</h3>
                    </div>

                    <FormField
                        control={form.control}
                        name="organization"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">School Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Ghana International School" {...field} autoComplete="off" spellCheck={false} className="h-12 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border-none shadow-inner font-bold text-lg focus-visible:ring-2 focus-visible:ring-primary/20" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="location"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Location</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Airport Residential Area, Accra" {...field} autoComplete="off" className="h-12 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border-none shadow-inner font-semibold focus-visible:ring-2 focus-visible:ring-primary/20" />
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
                                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Total Users (Students)</FormLabel>
                                <FormControl>
                                    <Input type="number" inputMode="numeric" {...field} className="h-12 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border-none shadow-inner font-black focus-visible:ring-2 focus-visible:ring-primary/20" />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <Separator className="bg-border/50" />

                {/* Contacts Section */}
                <div className="p-8 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary rounded-xl ring-1 ring-primary/20 shadow-sm" aria-hidden="true">
                            <Users className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold tracking-tight">Contacts & Owners</h3>
                    </div>
                    <EntityContactManager />
                </div>

                <Separator className="bg-border/50" />

                {/* Billing Section */}
                <div className="p-8 space-y-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary rounded-xl ring-1 ring-primary/20 shadow-sm" aria-hidden="true">
                            <Banknote className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold tracking-tight">Billing & Subscription</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="subscriptionPackageId" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Subscription Tier</FormLabel>
                                <Select 
                                    onValueChange={(val) => {
                                        field.onChange(val);
                                        const pkg = packages?.find(p => p.id === val);
                                        if (pkg) {
                                            form.setValue('subscriptionRate', pkg.ratePerStudent, { shouldDirty: true });
                                            form.setValue('discountPercentage', 0, { shouldDirty: true });
                                        }
                                    }} 
                                    value={field.value}
                                >
                                    <FormControl>
                                        <SelectTrigger className="h-12 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border-none shadow-inner focus:ring-1 focus:ring-primary/20 font-bold">
                                            <SelectValue placeholder="Pick a pricing tier…" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-xl shadow-2xl border border-border/50 bg-card">
                                        <SelectItem value="none" className="font-bold italic opacity-60 text-xs">No Active Subscription</SelectItem>
                                        {packages?.map(pkg => (
                                            <SelectItem key={pkg.id} value={pkg.id} className="font-bold text-xs">
                                                {pkg.name} ({pkg.currency} {pkg.ratePerStudent}/student)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="currency" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Currency</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-12 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border-none shadow-inner focus:ring-1 focus:ring-primary/20 font-black">
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-xl shadow-2xl border border-border/50 bg-card">
                                        <SelectItem value="GHS" className="font-bold text-xs">Ghanaian Cedi (GH¢)</SelectItem>
                                        <SelectItem value="USD" className="font-bold text-xs">US Dollar ($)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                    </div>

                    {/* Rate and Discount Adjustment */}
                    <div className={cn(
                        "p-6 rounded-2xl border border-dashed transition-all duration-500",
                        watchPackageId && watchPackageId !== 'none' 
                            ? "bg-primary/5 dark:bg-primary/10 border-primary/20" 
                            : "bg-slate-100/50 dark:bg-slate-800/50 border-border opacity-40 pointer-events-none"
                    )}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-primary/10 text-primary rounded-lg shadow-sm"><Target className="h-4 w-4" /></div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Rate Engine</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <FormField control={form.control} name="discountPercentage" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-bold uppercase text-primary ml-1 flex items-center gap-1.5"><Percent className="h-3 w-3" /> Discount %</FormLabel>
                                    <FormControl>
                                        <Input 
                                            type="number" 
                                            inputMode="numeric"
                                            step="0.01" 
                                            {...field} 
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                field.onChange(val);
                                                handleDiscountChange(val);
                                            }}
                                            className="h-12 rounded-xl bg-card border-primary/10 shadow-inner font-black text-xl text-center focus-visible:ring-2 focus-visible:ring-primary/20" 
                                        />
                                    </FormControl>
                                    <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Percentage off the normal price</FormDescription>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="subscriptionRate" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-bold uppercase text-primary ml-1 flex items-center gap-1.5"><Banknote className="h-3 w-3" /> Final Rate</FormLabel>
                                    <FormControl>
                                        <Input 
                                            type="number" 
                                            inputMode="numeric"
                                            step="0.01" 
                                            {...field} 
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                field.onChange(val);
                                                handleRateChange(val);
                                            }}
                                            className="h-12 rounded-xl bg-card border-primary/10 shadow-inner font-black text-xl text-center focus-visible:ring-2 focus-visible:ring-primary/20" 
                                        />
                                    </FormControl>
                                    <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">The actual amount charged per student</FormDescription>
                                </FormItem>
                            )} />
                        </div>
                    </div>

                    <FormField control={form.control} name="billingAddress" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Invoice Address</FormLabel>
                            <FormControl>
                                <Textarea {...field} placeholder="Where should we send financial documents?" className="min-h-[100px] rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border-none shadow-inner focus-visible:ring-2 focus-visible:ring-primary/20 font-medium" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                        <FormField control={form.control} name="arrearsBalance" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-rose-500 ml-1 flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> Old Arrears</FormLabel>
                                <FormControl>
                                    <Input type="number" inputMode="numeric" step="0.01" {...field} className="h-12 rounded-xl bg-rose-500/10 border-none shadow-inner font-black text-rose-500 text-lg focus-visible:ring-2 focus-visible:ring-rose-500/30" />
                                </FormControl>
                                <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Unpaid amount from your old system</FormDescription>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="creditBalance" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary ml-1 flex items-center gap-1.5"><Wallet className="h-3 w-3" /> Initial Credit</FormLabel>
                                <FormControl>
                                    <Input type="number" inputMode="numeric" step="0.01" {...field} className="h-12 rounded-xl bg-primary/10 border-none shadow-inner font-black text-primary text-lg focus-visible:ring-2 focus-visible:ring-primary/30" />
                                </FormControl>
                                <FormDescription className="text-[9px] uppercase font-bold tracking-tighter opacity-60 text-left">Money already paid in advance</FormDescription>
                            </FormItem>
                        )} />
                    </div>
                </div>

                <Separator className="bg-border/50" />

                {/* Requirements Section */}
                <div className="p-8 space-y-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary rounded-xl ring-1 ring-primary/20 shadow-sm" aria-hidden="true">
                            <Zap className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold tracking-tight">Software Requirements</h3>
                    </div>

                    <FormField
                        control={form.control}
                        name="modules"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Software Features</FormLabel>
                            <FormControl>
                                <Textarea placeholder="e.g. Student Billing, Child Security, Staff Attendance…" {...field} autoComplete="off" spellCheck={false} className="min-h-[120px] rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border-none p-6 font-medium leading-relaxed shadow-inner focus-visible:ring-2 focus-visible:ring-primary/20" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <FormField
                            control={form.control}
                            name="implementationDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col text-left">
                                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1 mb-2">Target Go-Live Date</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button variant={"outline"} className={cn("h-12 justify-start pl-4 text-left font-bold rounded-xl border-none bg-slate-100/50 dark:bg-slate-800/50 shadow-inner focus-visible:ring-2 focus-visible:ring-primary/20", !field.value && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-3 h-5 w-5 text-primary" aria-hidden="true" />
                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none" align="start">
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
                                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">Referee</FormLabel>
                                <FormControl>
                                    <Input placeholder="Name of Sales Executive" {...field} autoComplete="off" className="h-12 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border-none shadow-inner font-bold focus-visible:ring-2 focus-visible:ring-primary/20" />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="includeDroneFootage"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-xl border-2 border-dashed border-primary/20 p-4 bg-primary/5 h-12 mt-auto">
                                <div className="space-y-0.5">
                                <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-primary">Paid for Drone Footage</FormLabel>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                            )}
                        />
                    </div>
                </div>

                <Separator className="bg-border/50" />

                {/* Notifications Section */}
                <div className="p-8 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary rounded-xl ring-1 ring-primary/20 shadow-sm" aria-hidden="true">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold tracking-tight">Notifications</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="notifySchool"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/50 p-4 bg-slate-100/50 dark:bg-slate-800/50">
                                <div className="space-y-0.5">
                                <FormLabel className="text-sm font-bold uppercase tracking-tight">Email Alerts</FormLabel>
                                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">Confirmation emails</p>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="notifySchoolBySms"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/50 p-4 bg-slate-100/50 dark:bg-slate-800/50">
                                <div className="space-y-0.5">
                                <FormLabel className="text-sm font-bold uppercase tracking-tight">SMS Alerts</FormLabel>
                                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">Instant text messages</p>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="notifySmartSapp"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/50 p-4 bg-slate-100/50 dark:bg-slate-800/50">
                                <div className="space-y-0.5">
                                <FormLabel className="text-sm font-bold uppercase tracking-tight">Notify SmartSapp</FormLabel>
                                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">Team awareness alert</p>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="notifyOnboarding"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/50 p-4 bg-slate-100/50 dark:bg-slate-800/50">
                                <div className="space-y-0.5">
                                <FormLabel className="text-sm font-bold uppercase tracking-tight">Notify Onboarding</FormLabel>
                                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">Trigger deployment flow</p>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                            )}
                        />
                    </div>
                </div>

                <Separator className="bg-border/50" />

                <div className="p-8 flex justify-center" aria-live="polite">
                    <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="h-14 px-16 rounded-xl font-bold text-sm shadow-xl shadow-primary/20 transition-all active:scale-[0.98] bg-primary hover:bg-primary/90 text-primary-foreground">
                        {form.formState.isSubmitting ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Building className="mr-3 h-5 w-5" aria-hidden="true" />}
                        {form.formState.isSubmitting ? "Processing…" : "Register School"}
                    </Button>
                </div>
            </CardContent>
        </Card>
      </form>
    </FormProvider>
  );
}
