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
    Target,
    Sparkles
} from "lucide-react";
import { collection, query, where, orderBy } from 'firebase/firestore';
import { handleSignupAction, type SignupInput } from '@/lib/signup-actions';
import { dispatchSignupWebhook } from '@/lib/webhook-actions';
import { 
  checkSignupDuplicatesAction, 
  mergeSignupIntoEntityAction, 
  type EnrichedDuplicateMatch 
} from '@/lib/signup-conflict-actions';
import { SignupDuplicateResolutionModal } from '@/components/signup/SignupDuplicateResolutionModal';

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

const DRAFT_STORAGE_KEY = 'smartsapp_school_signup_draft_v1';

const DEFAULT_FORM_VALUES: Partial<FormData> = {
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
};

export default function NewSchoolSignupForm() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [hasRestoredDraft, setHasRestoredDraft] = React.useState(false);
  
  // Conflict resolution states
  const [isCheckingDuplicates, setIsCheckingDuplicates] = React.useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = React.useState(false);
  const [duplicateMatches, setDuplicateMatches] = React.useState<EnrichedDuplicateMatch[]>([]);
  const [pendingSignupInput, setPendingSignupInput] = React.useState<SignupInput | null>(null);

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
    defaultValues: DEFAULT_FORM_VALUES as FormData,
  });

  // 1. Rehydrate draft on mount
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.implementationDate) {
            parsed.implementationDate = new Date(parsed.implementationDate);
          }
          form.reset({
            ...DEFAULT_FORM_VALUES,
            ...parsed,
          });
          setHasRestoredDraft(true);
        }
      }
    } catch (e) {
      console.warn('Failed to restore signup draft:', e);
    }
  }, []);

  // 2. Auto-save form draft state to localStorage on field edits
  const watchAllFields = form.watch();
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const timeoutId = setTimeout(() => {
      try {
        const values = form.getValues();
        const hasEnteredData = Boolean(
          values.organization?.trim() ||
          values.location?.trim() ||
          values.referee?.trim() ||
          values.modules?.trim() ||
          values.entityContacts?.some(c => c.name?.trim() || c.email?.trim() || c.phone?.trim())
        );

        if (hasEnteredData) {
          const serializableValues = {
            ...values,
            implementationDate: values.implementationDate instanceof Date 
              ? values.implementationDate.toISOString() 
              : values.implementationDate,
          };
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(serializableValues));
        }
      } catch (e) {
        console.warn('Failed to auto-save signup draft:', e);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [watchAllFields]);

  const handleClearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {}
    form.reset(DEFAULT_FORM_VALUES as FormData);
    setHasRestoredDraft(false);
    toast({
      title: "Draft Cleared",
      description: "Form reset to blank state.",
    });
  };

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

  /**
   * Helper function to execute registration or merge completion.
   * Handles webhook dispatch, DB updates, draft cleanup, and toast notices.
   */
  const executeSignupCompletion = async (
    signupInput: SignupInput,
    rawFormData: FormData,
    mode: 'create' | 'merge',
    targetEntityId?: string
  ) => {
    // 1. Dispatch Webhook asynchronously (non-blocking)
    try {
      const schoolEmails = rawFormData.entityContacts
        .map(c => c.email?.trim())
        .filter(email => email && z.string().email().safeParse(email).success);
      
      const schoolSmsNumbers = rawFormData.entityContacts
        .map(c => c.phone?.trim())
        .filter(phone => phone && phone.length >= 10);

      const webhookData: Record<string, any> = { ...rawFormData };
      
      webhookData.submissionDate = new Date().toISOString();
      webhookData.implementationDate = format(rawFormData.implementationDate, 'yyyy-MM-dd');
      webhookData.includeDroneFootage = rawFormData.includeDroneFootage ? "Yes" : "No";
      
      const primaryContact = rawFormData.entityContacts.find(c => c.isPrimary) || rawFormData.entityContacts[0];
      webhookData.contactPerson = primaryContact?.name || "";
      webhookData.phone = primaryContact?.phone || "";
      webhookData.email = primaryContact?.email || "";
      
      webhookData.notifySchoolEmails = rawFormData.notifySchool ? [...new Set(schoolEmails)].join(',') : '';
      webhookData.notifySchoolSmsNumbers = rawFormData.notifySchoolBySms ? [...new Set(schoolSmsNumbers)].join(',') : '';
      
      webhookData.notifySmartSappEmails = rawFormData.notifySmartSapp ? "team@minex360.com" : "";
      webhookData.notifyOnboardingEmails = rawFormData.notifyOnboarding ? "joseph.aidoo@smartsapp.com, onboarding@minex360.com, sitso.aglago@smartsapp.com, finance@smartsapp.com" : "";

      webhookData.notifySchool = rawFormData.notifySchool ? "Yes" : "No";
      webhookData.notifySmartSapp = rawFormData.notifySmartSapp ? "Yes" : "No";
      webhookData.notifyOnboarding = rawFormData.notifyOnboarding ? "Yes" : "No";
      webhookData.notifySchoolBySms = rawFormData.notifySchoolBySms ? "Yes" : "No";

      delete webhookData.implementationDate_raw;
      
      dispatchSignupWebhook(webhookData).catch(err => console.warn('Webhook dispatch error:', err));
    } catch (error) {
      console.warn('Webhook dispatch failed silently:', error);
    }

    // 2. Perform DB creation or merge
    let result: { success: boolean; entityId?: string; error?: string };

    if (mode === 'merge' && targetEntityId) {
      result = await mergeSignupIntoEntityAction(targetEntityId, signupInput);
    } else {
      result = await handleSignupAction(signupInput);
    }

    if (result.success) {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) {}
      setHasRestoredDraft(false);
      setIsConflictModalOpen(false);
      setPendingSignupInput(null);
      setDuplicateMatches([]);

      toast({ 
        title: mode === 'merge' ? "Profile Merged & Saved!" : "Registration Successful!", 
        description: mode === 'merge' 
          ? "Institutional contact details updated cleanly."
          : "Institutional profile initialized with entity architecture." 
      });
      form.reset(DEFAULT_FORM_VALUES as FormData);
    } else {
      throw new Error(result.error || 'Failed to complete registration');
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!firestore) return;

    const selectedPackage = packages?.find(p => p.id === data.subscriptionPackageId);

    const preparedInput: SignupInput = {
      organizationId: 'smartsapp-hq',
      workspaceId: 'onboarding',
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
      pipelineId: 'default_pipeline',
      stageId: 'welcome',
      userId: 'system-signup',
    };

    setIsCheckingDuplicates(true);
    try {
      // Step 1: Run pre-flight duplicate conflict check
      const dupCheck = await checkSignupDuplicatesAction(preparedInput);

      if (dupCheck.hasDuplicates && dupCheck.duplicates.length > 0) {
        // Duplicates detected -> Open interactive conflict resolution screen
        setPendingSignupInput(preparedInput);
        setDuplicateMatches(dupCheck.duplicates);
        setIsConflictModalOpen(true);
      } else {
        // No conflicts -> Complete registration directly
        await executeSignupCompletion(preparedInput, data, 'create');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "Could not complete signup. Please try again.",
      });
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const handleResolveNew = async () => {
    if (!pendingSignupInput) return;
    const currentFormData = form.getValues();
    await executeSignupCompletion(pendingSignupInput, currentFormData, 'create');
  };

  const handleResolveMerge = async (targetEntityId: string) => {
    if (!pendingSignupInput) return;
    const currentFormData = form.getValues();
    await executeSignupCompletion(pendingSignupInput, currentFormData, 'merge', targetEntityId);
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="pb-20">
        {hasRestoredDraft && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 text-xs font-semibold text-primary animate-in fade-in-50 duration-300">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <span>We restored your previously unsaved registration draft.</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearDraft}
              className="h-7 text-xs font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Clear Draft
            </Button>
          </div>
        )}
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
                    <Button 
                      type="submit" 
                      size="lg" 
                      disabled={form.formState.isSubmitting || isCheckingDuplicates} 
                      className="h-14 px-16 rounded-xl font-bold text-sm shadow-xl shadow-primary/20 transition-all active:scale-[0.98] bg-primary hover:bg-primary/90 text-primary-foreground min-h-[44px]"
                    >
                        {form.formState.isSubmitting || isCheckingDuplicates ? (
                          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                        ) : (
                          <Building className="mr-3 h-5 w-5" aria-hidden="true" />
                        )}
                        {isCheckingDuplicates 
                          ? "Checking Duplicates..." 
                          : form.formState.isSubmitting 
                            ? "Processing…" 
                            : "Register School"}
                    </Button>
                </div>
            </CardContent>
        </Card>
      </form>

      {/* Duplicate Conflict Resolution Modal */}
      <SignupDuplicateResolutionModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        signupInput={pendingSignupInput}
        duplicates={duplicateMatches}
        onResolveNew={handleResolveNew}
        onResolveMerge={handleResolveMerge}
      />
    </FormProvider>
  );
}
