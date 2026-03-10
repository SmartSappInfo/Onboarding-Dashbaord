"use client";

import * as React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X, Building, User, Mail, Phone, MapPin, Users, Zap, ShieldCheck } from "lucide-react";
import { collection, addDoc } from 'firebase/firestore';

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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { FocalPersonManager } from "@/app/admin/schools/components/FocalPersonManager";

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

  const methods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      organization: "",
      location: "",
      nominalRoll: 0,
      modules: "",
      includeDroneFootage: false,
      referee: "",
      focalPersons: [{ name: '', email: '', phone: '', type: 'School Owner', isSignatory: true }],
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

  const watchNotifySchool = methods.watch("notifySchool");
  const watchFocalPersons = methods.watch("focalPersons");
  
  const primarySignatory = watchFocalPersons.find(p => p.isSignatory) || watchFocalPersons[0];
  const watchMainEmail = primarySignatory?.email;
  const isMainEmailValid = z.string().email().safeParse(watchMainEmail).success;

  const watchNotifySchoolBySms = methods.watch("notifySchoolBySms");
  const watchMainPhone = primarySignatory?.phone;
  const isMainPhoneValid = z.string().min(10).safeParse(watchMainPhone).success;

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

    // 2. Save to Firestore
    if (!firestore) return;

    const slug = data.organization
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const schoolData = {
      name: data.organization,
      slug,
      location: data.location,
      nominalRoll: data.nominalRoll,
      moduleRequestNotes: data.modules,
      implementationDate: data.implementationDate.toISOString(),
      referee: data.referee,
      includeDroneFootage: data.includeDroneFootage,
      stage: { id: 'welcome', name: 'Welcome', order: 1 },
      focalPersons: data.focalPersons,
      additionalEmails: data.notifySchoolEmails,
      additionalPhones: data.notifySchoolSmsNumbers,
      status: 'Active',
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(firestore, 'schools'), schoolData);
      toast({ title: "Registration Successful!", description: "Institutional profile initialized." });
      methods.reset();
    } catch (error: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'schools',
          operation: 'create',
          requestResourceData: schoolData,
      }));
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-12 text-left pb-20">
        
        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-muted/30 border-b p-8">
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
                    control={methods.control}
                    name="organization"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Official School Name</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g. Ghana International School" {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold text-lg" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                        control={methods.control}
                        name="location"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Physical Location</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Airport Residential Area, Accra" {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={methods.control}
                        name="nominalRoll"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Student Footprint (Roll)</FormLabel>
                            <FormControl>
                                <Input type="number" {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-black" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-muted/30 border-b p-8">
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

        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden ring-1 ring-black/5">
            <CardHeader className="bg-muted/30 border-b p-8">
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
                    control={methods.control}
                    name="modules"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Required Capabilities</FormLabel>
                        <FormControl>
                            <Textarea placeholder="e.g. Student Billing, Child Security, Staff Attendance..." {...field} className="min-h-[120px] rounded-2xl bg-muted/20 border-none p-6 font-medium leading-relaxed shadow-inner" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                        control={methods.control}
                        name="implementationDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 mb-2">Target Go-Live Date</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button variant={"outline"} className={cn("h-12 justify-start pl-4 text-left font-bold rounded-xl border-none bg-muted/20 shadow-inner", !field.value && "text-muted-foreground")}>
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
                        control={methods.control}
                        name="referee"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Referral Source</FormLabel>
                            <FormControl>
                                <Input placeholder="How did you hear about us?" {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold" />
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
                            control={methods.control}
                            name="notifySchool"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-2xl border p-4 bg-muted/10">
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
                                <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-muted/20 shadow-inner">
                                    {isMainEmailValid && <Badge variant="outline" className="bg-white font-bold h-6 border-primary/20 text-primary">{watchMainEmail}</Badge>}
                                    {methods.getValues('notifySchoolEmails').map(e => <Badge key={e} className="bg-primary h-6 font-bold">{e}</Badge>)}
                                    <Input 
                                        placeholder="Add email..." 
                                        value={emailInputValue} 
                                        onChange={e => setEmailInputValue(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ',') {
                                                e.preventDefault();
                                                const email = emailInputValue.trim();
                                                if (z.string().email().safeParse(email).success) {
                                                    const current = methods.getValues('notifySchoolEmails');
                                                    if (!current.includes(email)) methods.setValue('notifySchoolEmails', [...current, email]);
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
                            control={methods.control}
                            name="notifySchoolBySms"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-2xl border p-4 bg-muted/10">
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
                                <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-muted/20 shadow-inner">
                                    {isMainPhoneValid && <Badge variant="outline" className="bg-white font-bold h-6 border-primary/20 text-primary">{watchMainPhone}</Badge>}
                                    {methods.getValues('notifySchoolSmsNumbers').map(n => <Badge key={n} className="bg-primary h-6 font-bold">{n}</Badge>)}
                                    <Input 
                                        placeholder="Add number..." 
                                        value={smsInputValue} 
                                        onChange={e => setSmsInputValue(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ',') {
                                                e.preventDefault();
                                                const num = smsInputValue.trim();
                                                if (num.length >= 10) {
                                                    const current = methods.getValues('notifySchoolSmsNumbers');
                                                    if (!current.includes(num)) methods.setValue('notifySchoolSmsNumbers', [...current, num]);
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
          <Button type="submit" size="lg" disabled={methods.formState.isSubmitting} className="h-16 px-20 rounded-[2rem] font-black text-xl shadow-2xl shadow-primary/30 transition-all active:scale-95 uppercase tracking-widest">
            {methods.formState.isSubmitting ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <Building className="mr-3 h-6 w-6" />}
            Execute Institutional Registration
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
