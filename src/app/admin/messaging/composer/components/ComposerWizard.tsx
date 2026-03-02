
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { MessageTemplate, SenderProfile, MessageStyle, School } from '@/lib/types';
import { sendMessage } from '@/lib/messaging-engine';
import { resolveVariables } from '@/lib/messaging-utils';
import { createBulkMessageJob, processBulkJobChunk } from '@/lib/bulk-messaging';
import { fetchSmsBalanceAction } from '@/lib/mnotify-actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { 
    Check, 
    ChevronRight, 
    Smartphone, 
    Mail, 
    Users, 
    User, 
    Upload, 
    Loader2, 
    Sparkles, 
    Eye,
    X,
    AlertCircle,
    Info,
    CalendarClock,
    Building,
    Wallet,
    Trophy,
    TrendingUp,
    Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { SmartSappIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const formSchema = z.object({
    channel: z.enum(['email', 'sms']),
    templateId: z.string().min(1, "Please select a template."),
    senderProfileId: z.string().min(1, "Please select a sender profile."),
    mode: z.enum(['single', 'bulk']),
    recipient: z.string().optional(),
    variables: z.record(z.any()).default({}),
    schoolId: z.string().optional(),
    isScheduled: z.boolean().default(false),
    scheduledAt: z.date().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function ComposerWizard() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const [step, setStep] = React.useState(1);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    
    const [csvData, setCsvData] = React.useState<any[]>([]);
    const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
    const [jobId, setJobId] = React.useState<string | null>(null);
    const [jobProgress, setJobProgress] = React.useState(0);
    const [jobStatus, setJobStatus] = React.useState<string | null>(null);
    const [smsBalance, setSmsBalance] = React.useState<number | null>(null);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            channel: 'email',
            mode: 'single',
            recipient: '',
            variables: {},
            schoolId: '',
            isScheduled: false,
        }
    });

    const { watch, setValue, getValues, control } = form;
    const watchedChannel = watch('channel');
    const watchedTemplateId = watch('templateId');
    const watchedMode = watch('mode');
    const watchedIsScheduled = watch('isScheduled');
    const watchedSchoolId = watch('schoolId');
    const watchedVariables = watch('variables');

    React.useEffect(() => {
        const fetchBalance = async () => {
            const result = await fetchSmsBalanceAction();
            if (result.success) setSmsBalance(result.balance ?? 0);
        };
        fetchBalance();
    }, []);

    React.useEffect(() => {
        const tId = searchParams.get('templateId');
        const chan = searchParams.get('channel') as 'email' | 'sms' | null;
        const rec = searchParams.get('recipient');
        const sId = searchParams.get('schoolId');
        
        if (chan) setValue('channel', chan);
        if (tId) setValue('templateId', tId);
        if (rec) setValue('recipient', rec);
        if (sId) setValue('schoolId', sId);

        searchParams.forEach((value, key) => {
            if (key.startsWith('var_')) {
                const varName = key.replace('var_', '');
                setValue(`variables.${varName}`, value);
            }
        });
    }, [searchParams, setValue]);

    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_templates'), where('isActive', '==', true), where('channel', '==', watchedChannel));
    }, [firestore, watchedChannel]);

    const profilesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'sender_profiles'), where('isActive', '==', true), where('channel', '==', watchedChannel));
    }, [firestore, watchedChannel]);

    const schoolsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'schools'), orderBy('name', 'asc'));
    }, [firestore]);

    const { data: templates, isLoading: isLoadingTemplates } = useCollection<MessageTemplate>(templatesQuery);
    const { data: profiles, isLoading: isLoadingProfiles } = useCollection<SenderProfile>(profilesQuery);
    const { data: schools } = useCollection<School>(schoolsQuery);

    const selectedTemplate = React.useMemo(() => 
        templates?.find(t => t.id === watchedTemplateId), 
    [templates, watchedTemplateId]);

    // Credit Estimation Logic
    const creditEstimation = React.useMemo(() => {
        if (watchedChannel !== 'sms' || !selectedTemplate) return null;
        
        const resolvedBody = resolveVariables(selectedTemplate.body, watchedVariables);
        const charsPerSms = 160;
        const segmentsPerMsg = Math.ceil(resolvedBody.length / charsPerSms);
        const recipientCount = watchedMode === 'bulk' ? csvData.length : 1;
        
        return {
            segments: segmentsPerMsg,
            totalCredits: segmentsPerMsg * recipientCount,
            recipientCount
        };
    }, [watchedChannel, selectedTemplate, watchedVariables, watchedMode, csvData]);

    // Auto-populate variables based on selected school
    React.useEffect(() => {
        if (watchedSchoolId && schools) {
            const school = schools.find(s => s.id === watchedSchoolId);
            if (school) {
                const schoolVars: Record<string, any> = {
                    school_name: school.name,
                    contact_person: school.contactPerson || school.focalPersons?.[0]?.name,
                    phone: school.phone || school.focalPersons?.[0]?.phone,
                    email: school.email || school.focalPersons?.[0]?.email,
                    location: school.location,
                    slug: school.slug
                };

                // Auto-fill recipient if empty and single mode
                if (watchedMode === 'single' && !getValues('recipient')) {
                    const recipient = watchedChannel === 'email' ? schoolVars.email : schoolVars.phone;
                    if (recipient) setValue('recipient', recipient);
                }

                // Map matching variables
                selectedTemplate?.variables.forEach(v => {
                    if (schoolVars[v]) {
                        setValue(`variables.${v}`, schoolVars[v]);
                    }
                });
            }
        }
    }, [watchedSchoolId, schools, selectedTemplate, watchedMode, watchedChannel, setValue, getValues]);

    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const rows = text.split('\n').filter(row => row.trim() !== '');
            if (rows.length < 2) {
                toast({ variant: 'destructive', title: 'Invalid CSV', description: 'File must contain a header row and at least one data row.' });
                return;
            }

            const headers = rows[0].split(',').map(h => h.trim());
            const data = rows.slice(1).map(row => {
                const values = row.split(',').map(v => v.trim());
                return headers.reduce((obj, header, i) => {
                    obj[header] = values[i];
                    return obj;
                }, {} as any);
            });

            setCsvHeaders(headers);
            setCsvData(data);
            toast({ title: 'CSV Process Processed', description: `${data.length} records identified.` });
        };
        reader.readAsText(file);
    };

    const handleNext = () => setStep(s => s + 1);
    const handlePrev = () => setStep(s => s - 1);

    const onSubmit = async (data: FormData) => {
        if (!user) return;
        setIsSubmitting(true);

        const scheduledAt = data.isScheduled ? data.scheduledAt?.toISOString() : undefined;

        try {
            if (data.mode === 'single') {
                if (!data.recipient) throw new Error("Recipient is required for single send.");
                
                const result = await sendMessage({
                    templateId: data.templateId,
                    senderProfileId: data.senderProfileId,
                    recipient: data.recipient,
                    variables: data.variables,
                    schoolId: data.schoolId,
                    scheduledAt
                });

                if (result.success) {
                    toast({ title: data.isScheduled ? 'Message Scheduled' : 'Message Sent', description: 'Communication processed successfully.' });
                    setStep(1);
                    form.reset();
                } else {
                    throw new Error(result.error);
                }
            } else {
                if (csvData.length === 0) throw new Error("No recipient data found.");
                
                const recipients = csvData.map(row => ({
                    recipient: row.recipient || row.phone || row.email,
                    variables: { ...data.variables, ...row, schoolId: data.schoolId }
                }));

                const { jobId: newJobId } = await createBulkMessageJob({
                    templateId: data.templateId,
                    senderProfileId: data.senderProfileId,
                    recipients,
                    userId: user.uid
                });

                setJobId(newJobId);
                setStep(4);
                startJobProcessing(newJobId);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const startJobProcessing = async (id: string) => {
        setJobStatus('processing');
        let finished = false;
        while (!finished) {
            try {
                const result = await processBulkJobChunk(id);
                setJobProgress(result.progress);
                setJobStatus(result.status);
                if (result.status === 'completed' || result.status === 'failed') {
                    finished = true;
                }
                await new Promise(r => setTimeout(r, 500));
            } catch (e) {
                setJobStatus('failed');
                finished = true;
            }
        }
    };

    const stepLabel = (num: number, label: string) => (
        <div className={cn(
            "flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors",
            step >= num ? "text-primary" : "text-muted-foreground opacity-40"
        )}>
            <div className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                step > num ? "bg-primary border-primary text-white" : step === num ? "border-primary text-primary shadow-lg shadow-primary/20 scale-110" : "border-muted-foreground"
            )}>
                {step > num ? <Check className="w-3 h-3" /> : num}
            </div>
            {label}
        </div>
    );

    const isOutOfCredits = watchedChannel === 'sms' && smsBalance !== null && creditEstimation && smsBalance < creditEstimation.totalCredits;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-center gap-8 mb-12">
                {stepLabel(1, "Template")}
                <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                {stepLabel(2, "Recipients")}
                <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                {stepLabel(3, "Preview")}
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {step === 1 && (
                    <Card className="shadow-xl border-none ring-1 ring-border rounded-2xl overflow-hidden bg-white">
                        <CardHeader className="bg-muted/30 border-b pb-6">
                            <CardTitle className="text-xl font-black uppercase tracking-tight">Select Template</CardTitle>
                            <CardDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">Choose the channel and the pre-defined message structure.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-10 p-6 pt-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">1. Choose Communication Medium</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Button 
                                            type="button" 
                                            variant={watchedChannel === 'email' ? 'default' : 'outline'} 
                                            className={cn(
                                                "h-24 flex-col gap-2 rounded-2xl border-2 transition-all",
                                                watchedChannel === 'email' ? "shadow-xl scale-105 border-primary" : "border-muted-foreground/10"
                                            )}
                                            onClick={() => setValue('channel', 'email')}
                                        >
                                            <Mail className={cn("h-7 w-7", watchedChannel === 'email' ? "text-white" : "text-blue-500")} />
                                            <span className="font-black uppercase text-xs tracking-widest">Email</span>
                                        </Button>
                                        <Button 
                                            type="button" 
                                            variant={watchedChannel === 'sms' ? 'default' : 'outline'} 
                                            className={cn(
                                                "h-24 flex-col gap-2 rounded-2xl border-2 transition-all",
                                                watchedChannel === 'sms' ? "shadow-xl scale-105 border-primary" : "border-muted-foreground/10"
                                            )}
                                            onClick={() => setValue('channel', 'sms')}
                                        >
                                            <Smartphone className={cn("h-7 w-7", watchedChannel === 'sms' ? "text-white" : "text-orange-500")} />
                                            <span className="font-black uppercase text-xs tracking-widest">SMS</span>
                                        </Button>
                                    </div>
                                    {watchedChannel === 'sms' && (
                                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-orange-50 border border-orange-100 text-[10px] font-black uppercase tracking-tighter">
                                            <span className="text-orange-700/60">Current mNotify Balance</span>
                                            <span className={cn("flex items-center gap-1.5", smsBalance !== null && smsBalance < 10 ? "text-red-500 animate-pulse" : "text-emerald-600")}>
                                                <Wallet className="h-3 w-3" />
                                                {smsBalance !== null ? `${smsBalance} Credits` : 'Loading...'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">2. Select Message Architecture</Label>
                                    <Controller
                                        name="templateId"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger className="h-14 rounded-2xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-black text-lg">
                                                    <SelectValue placeholder="Choose a template..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl">
                                                    {isLoadingTemplates ? (
                                                        <div className="p-4 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
                                                    ) : templates?.map(t => (
                                                        <SelectItem key={t.id} value={t.id} className="rounded-xl my-1">
                                                            <div className="flex items-center gap-3">
                                                                <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary">{t.category}</Badge>
                                                                <span className="font-bold">{t.name}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                                        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                                        <p className="text-[10px] font-bold text-blue-800 leading-relaxed uppercase tracking-tighter">
                                            Templates provide standardized branding and ensure compliance across all school communications.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {selectedTemplate && (
                                <div className="p-6 rounded-[2rem] bg-primary/5 border-2 border-dashed border-primary/20 space-y-4 animate-in fade-in zoom-in-95">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Dynamic Logic Points Detected</Label>
                                        <Badge className="bg-primary text-white border-none text-[8px] font-black uppercase tracking-widest px-3 h-6">{selectedTemplate.variables.length} Variables</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedTemplate.variables.map(v => (
                                            <code key={v} className="bg-white px-3 py-1.5 rounded-xl border border-primary/10 text-[10px] font-black text-primary shadow-sm uppercase tracking-tighter">{"{{" + v + "}}"}</code>
                                        ))}
                                        {selectedTemplate.variables.length === 0 && <p className="text-xs italic text-muted-foreground">This is a static announcement with no variables.</p>}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="justify-end bg-muted/30 p-6 border-t">
                            <Button type="button" size="lg" onClick={handleNext} disabled={!watchedTemplateId} className="px-12 rounded-2xl font-black shadow-xl shadow-primary/20 h-14 uppercase tracking-widest active:scale-95 transition-all">
                                Next Step <ChevronRight className="ml-2 h-5 w-5" />
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 2 && (
                    <Card className="shadow-xl border-none ring-1 ring-border rounded-2xl overflow-hidden bg-white">
                        <CardHeader className="bg-muted/30 border-b pb-6">
                            <CardTitle className="text-xl font-black uppercase tracking-tight">Recipients & Optimization</CardTitle>
                            <CardDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">Configure delivery mode and timing.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-10 p-6 pt-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">3. Official Sender Identity</Label>
                                    <Controller
                                        name="senderProfileId"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger className="h-14 rounded-2xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-black text-lg transition-all">
                                                    <SelectValue placeholder="Choose sender..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl">
                                                    {isLoadingProfiles ? (
                                                        <div className="p-4 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
                                                    ) : profiles?.map(p => (
                                                        <SelectItem key={p.id} value={p.id} className="rounded-xl my-1">
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-black">{p.name}</span>
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted px-2 py-0.5 rounded">ID: {p.identifier}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">4. Dispatch Mode</Label>
                                    <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1.5 rounded-2xl border border-border/50">
                                        <Button 
                                            type="button" 
                                            variant={watchedMode === 'single' ? 'secondary' : 'ghost'} 
                                            className={cn("h-11 rounded-xl font-bold uppercase text-[10px] tracking-widest", watchedMode === 'single' && "bg-white shadow-lg text-primary")}
                                            onClick={() => setValue('mode', 'single')}
                                        >
                                            <User className="mr-2 h-4 w-4" /> Single
                                        </Button>
                                        <Button 
                                            type="button" 
                                            variant={watchedMode === 'bulk' ? 'secondary' : 'ghost'} 
                                            className={cn("h-11 rounded-xl font-bold uppercase text-[10px] tracking-widest", watchedMode === 'bulk' && "bg-white shadow-lg text-primary")}
                                            onClick={() => setValue('mode', 'bulk')}
                                        >
                                            <Users className="mr-2 h-4 w-4" /> Bulk Upload
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <Separator className="bg-border/50" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className={cn(
                                    "p-6 rounded-[2rem] border-2 transition-all duration-500",
                                    watchedIsScheduled ? "bg-primary/5 border-primary shadow-xl shadow-primary/5" : "bg-muted/10 border-border/50"
                                )}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={cn("p-3 rounded-2xl transition-all duration-500", watchedIsScheduled ? "bg-primary text-white shadow-xl shadow-primary/20 rotate-3" : "bg-muted text-muted-foreground")}>
                                                <CalendarClock className="h-6 w-6" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-black uppercase tracking-tight">Deferred Dispatch</Label>
                                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">Queue for future execution</p>
                                            </div>
                                        </div>
                                        <Controller
                                            name="isScheduled"
                                            control={control}
                                            render={({ field }) => (
                                                <Switch 
                                                    checked={field.value} 
                                                    onCheckedChange={field.onChange} 
                                                    className="scale-125"
                                                />
                                            )}
                                        />
                                    </div>
                                    
                                    {watchedIsScheduled && (
                                        <div className="pt-6 mt-6 border-t border-primary/10 animate-in fade-in slide-in-from-top-4 duration-500">
                                            <Controller
                                                name="scheduledAt"
                                                control={control}
                                                render={({ field }) => (
                                                    <DateTimePicker 
                                                        value={field.value} 
                                                        onChange={field.onChange} 
                                                    />
                                                )}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 rounded-[2rem] border-2 border-muted bg-muted/10 space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-2xl bg-muted text-muted-foreground shadow-inner">
                                            <Building className="h-6 w-6" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-black uppercase tracking-tight">School Context</Label>
                                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">Smart variables from DB</p>
                                        </div>
                                    </div>
                                    <Controller
                                        name="schoolId"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                <SelectTrigger className="h-12 rounded-2xl bg-white border-none shadow-sm font-bold">
                                                    <SelectValue placeholder="Select a school..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl">
                                                    <SelectItem value="none" className="rounded-xl italic">No School Context</SelectItem>
                                                    {schools?.map(s => <SelectItem key={s.id} value={s.id} className="rounded-xl">{s.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>

                            <Separator className="bg-border/50" />

                            <div className="space-y-6">
                                {watchedMode === 'single' ? (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Recipient Identity</Label>
                                            <Controller
                                                name="recipient"
                                                control={control}
                                                render={({ field }) => (
                                                    <Input 
                                                        {...field} 
                                                        value={field.value ?? ''}
                                                        placeholder={watchedChannel === 'email' ? 'parent@example.com' : 'e.g. 024XXXXXXX'} 
                                                        className="h-14 rounded-2xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-black text-xl px-6"
                                                    />
                                                )}
                                            />
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                                            {selectedTemplate?.variables.map(v => (
                                                <div key={v} className="space-y-2 group">
                                                    <Label className="text-[9px] font-black uppercase ml-1 text-muted-foreground group-focus-within:text-primary transition-colors">{v.replace(/_/g, ' ')}</Label>
                                                    <Controller
                                                        name={`variables.${v}`}
                                                        control={control}
                                                        render={({ field }) => (
                                                            <Input 
                                                                {...field} 
                                                                value={field.value ?? ''} 
                                                                placeholder={`Enter value...`} 
                                                                className="bg-muted/30 border-none h-11 rounded-xl shadow-inner focus-visible:ring-1 focus-visible:ring-primary/20 font-bold" 
                                                            />
                                                        )}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                                        <div className="p-12 border-4 border-dashed rounded-[3rem] flex flex-col items-center justify-center text-center gap-6 bg-muted/10 border-muted-foreground/10 hover:border-primary/30 hover:bg-primary/5 transition-all duration-500 group">
                                            <div className="p-6 bg-white rounded-full text-primary shadow-2xl group-hover:scale-110 transition-transform">
                                                <Upload className="h-10 w-10" />
                                            </div>
                                            <div className="space-y-2">
                                                <p className="font-black text-2xl tracking-tight">Upload Recipient List (CSV)</p>
                                                <p className="text-xs text-muted-foreground max-w-[280px] mx-auto font-medium uppercase tracking-widest leading-relaxed">Map your spreadsheet columns directly to template variables.</p>
                                            </div>
                                            <Input type="file" accept=".csv" className="hidden" id="csv-upload" onChange={handleCsvUpload} />
                                            <Button asChild variant="outline" className="rounded-2xl border-2 font-black h-14 px-12 hover:bg-white shadow-lg active:scale-95 transition-all uppercase tracking-widest">
                                                <label htmlFor="csv-upload" className="cursor-pointer">Select File</label>
                                            </Button>
                                        </div>

                                        {csvData.length > 0 && (
                                            <div className="space-y-4 animate-in zoom-in-95 duration-500">
                                                <div className="flex items-center justify-between px-2">
                                                    <div className="flex items-center gap-2">
                                                        <Badge className="bg-primary h-6 font-black uppercase text-[10px] tracking-widest px-3">{csvData.length} Records</Badge>
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data Integrity Audit</Label>
                                                    </div>
                                                    <Button variant="ghost" size="sm" onClick={() => setCsvData([])} className="h-8 text-[10px] text-destructive uppercase font-black tracking-widest hover:bg-destructive/5 rounded-xl">Clear List</Button>
                                                </div>
                                                <div className="rounded-2xl border bg-white overflow-hidden shadow-2xl">
                                                    <ScrollArea className="w-full">
                                                        <table className="w-full text-xs">
                                                            <thead className="bg-muted/50 border-b">
                                                                <tr>
                                                                    {csvHeaders.slice(0, 5).map(h => <th key={h} className="p-4 text-left font-black uppercase text-[9px] tracking-tighter text-muted-foreground">{h}</th>)}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-muted/50">
                                                                {csvData.slice(0, 3).map((row, i) => (
                                                                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                                                                        {csvHeaders.slice(0, 5).map(h => <td key={h} className="p-4 font-bold text-foreground truncate max-w-[150px]">{row[h]}</td>)}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        <ScrollBar orientation="horizontal" />
                                                    </ScrollArea>
                                                </div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 text-center">+ {csvData.length - 3} additional records identified.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="justify-between bg-muted/30 p-6 border-t">
                            <Button type="button" variant="ghost" onClick={handlePrev} className="font-bold rounded-xl uppercase tracking-widest text-xs">Previous</Button>
                            <Button type="button" onClick={handleNext} disabled={!getValues('senderProfileId') || (watchedMode === 'single' ? !getValues('recipient') : csvData.length === 0)} className="px-12 rounded-2xl font-black shadow-xl shadow-primary/20 h-14 uppercase tracking-widest active:scale-95 transition-all">
                                Review & Preview <ChevronRight className="ml-2 h-5 w-5" />
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 3 && (
                    <Card className="shadow-2xl border-none ring-1 ring-border rounded-[2rem] overflow-hidden bg-white">
                        <CardHeader className="bg-muted/30 border-b pb-6">
                            <CardTitle className="text-xl font-black uppercase tracking-tight">Final Verification</CardTitle>
                            <CardDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">Preview your message and confirm operational cost.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-10 p-6 pt-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                <div className="space-y-8">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1.5 p-4 rounded-2xl bg-muted/20 border border-border/50">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sender Identity</Label>
                                            <p className="font-black text-primary uppercase">{profiles?.find(p => p.id === getValues('senderProfileId'))?.name}</p>
                                        </div>
                                        <div className="space-y-1.5 p-4 rounded-2xl bg-muted/20 border border-border/50">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Timeline</Label>
                                            <p className={cn("font-black uppercase text-xs flex items-center gap-2", watchedIsScheduled ? "text-primary" : "text-emerald-600")}>
                                                {watchedIsScheduled ? <CalendarClock className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                                                {watchedIsScheduled ? 'Scheduled' : 'Immediate'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Cost Analytics */}
                                    {watchedChannel === 'sms' && creditEstimation && (
                                        <Card className="bg-orange-50 border-orange-200 overflow-hidden rounded-2xl">
                                            <CardHeader className="pb-3 border-b border-orange-100 bg-orange-100/50">
                                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-orange-800 flex items-center gap-2">
                                                    <TrendingUp className="h-3.5 w-3.5" /> Credit Usage Estimate
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-5 space-y-4">
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="text-center space-y-1">
                                                        <p className="text-[8px] font-black uppercase text-orange-700/60 leading-none">Recipients</p>
                                                        <p className="text-2xl font-black text-orange-900 tabular-nums">{creditEstimation.recipientCount}</p>
                                                    </div>
                                                    <div className="text-center space-y-1 border-x border-orange-200">
                                                        <p className="text-[8px] font-black uppercase text-orange-700/60 leading-none">Segments</p>
                                                        <p className="text-2xl font-black text-orange-900 tabular-nums">{creditEstimation.segments}</p>
                                                    </div>
                                                    <div className="text-center space-y-1">
                                                        <p className="text-[8px] font-black uppercase text-orange-700/60 leading-none">Total Cost</p>
                                                        <p className="text-2xl font-black text-orange-900 tabular-nums">{creditEstimation.totalCredits}</p>
                                                    </div>
                                                </div>
                                                
                                                {isOutOfCredits ? (
                                                    <div className="p-3 rounded-xl bg-red-100 border border-red-200 flex items-start gap-3 animate-in shake-1">
                                                        <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-red-800">Insufficient Credits</p>
                                                            <p className="text-[9px] text-red-700 leading-relaxed font-bold uppercase tracking-tighter">
                                                                Dispatch requires {creditEstimation.totalCredits} but balance is {smsBalance}. Top up mNotify to proceed.
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between px-2 pt-2 border-t border-orange-200">
                                                        <span className="text-[10px] font-bold text-orange-800 uppercase">Available Credits</span>
                                                        <Badge className="bg-emerald-500 text-white border-none text-[10px] font-black tabular-nums">{smsBalance}</Badge>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}

                                    <div className="p-5 rounded-2xl border bg-blue-50/50 border-blue-200 flex items-start gap-4">
                                        <AlertCircle className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-blue-800 uppercase tracking-tighter leading-none mb-1">Operational Compliance</p>
                                            <p className="text-[10px] text-blue-700 leading-relaxed font-bold uppercase tracking-widest opacity-80">
                                                All dispatches are audited. By initiating this job, you confirm that recipients have consented to receive {watchedChannel} communications.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 ml-1">
                                        <Eye className="h-3.5 w-3.5" /> Visual Message Validation
                                    </Label>
                                    <MessagePreviewer 
                                        template={selectedTemplate!} 
                                        variables={getValues('variables')} 
                                        sampleRow={watchedMode === 'bulk' ? csvData[0] : null}
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="justify-between bg-muted/30 p-8 border-t">
                            <Button type="button" variant="ghost" onClick={handlePrev} disabled={isSubmitting} className="font-bold rounded-xl uppercase tracking-widest text-xs">Edit Details</Button>
                            <Button type="submit" size="lg" disabled={isSubmitting || isOutOfCredits} className="px-16 font-black shadow-2xl h-16 gap-4 bg-primary text-white hover:bg-primary/90 rounded-[1.5rem] transition-all active:scale-95 text-lg uppercase tracking-[0.1em]">
                                {isSubmitting ? <Loader2 className="h-7 w-7 animate-spin" /> : <Sparkles className="h-7 w-7" />}
                                {watchedMode === 'single' ? (watchedIsScheduled ? 'Schedule Message' : 'Initiate Dispatch') : `Launch Bulk Job`}
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 4 && (
                    <Card className="shadow-2xl border-none ring-1 ring-primary/20 rounded-[3rem] overflow-hidden bg-white">
                        <CardHeader className="text-center pb-10 pt-12 border-b bg-muted/30">
                            <div className="mx-auto bg-primary/10 w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-primary/10 rotate-3">
                                {jobStatus === 'processing' ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : <Trophy className="h-10 w-10 text-emerald-600" />}
                            </div>
                            <CardTitle className="text-3xl font-black tracking-tight text-foreground uppercase">Bulk Job Execution</CardTitle>
                            <CardDescription className="text-sm font-bold uppercase tracking-widest text-muted-foreground mt-2">Connecting with {csvData.length} recipients via mNotify Gateway.</CardDescription>
                        </CardHeader>
                        <CardContent className="py-16 space-y-12">
                            <div className="space-y-6 max-w-xl mx-auto px-4">
                                <div className="flex justify-between items-end mb-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Gateway Throughput</p>
                                    <p className="text-4xl font-black tabular-nums tracking-tighter text-primary">{jobProgress}%</p>
                                </div>
                                <div className="h-4 w-full bg-muted/30 rounded-full overflow-hidden border p-1">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${jobProgress}%` }}
                                        className="h-full bg-primary rounded-full shadow-[0_0_15px_rgba(59,95,255,0.5)]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8 max-w-md mx-auto">
                                <div className="p-8 rounded-[2.5rem] bg-slate-50 border-2 border-slate-100 text-center space-y-1 shadow-inner group hover:border-primary/20 transition-all">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-3">Successfully Sent</p>
                                    <p className="text-5xl font-black tabular-nums text-foreground group-hover:scale-110 transition-transform">{Math.round((jobProgress/100) * csvData.length)}</p>
                                </div>
                                <div className="p-8 rounded-[2.5rem] bg-slate-50 border-2 border-slate-100 text-center space-y-1 shadow-inner group hover:border-primary/20 transition-all">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-3">Total Target</p>
                                    <p className="text-5xl font-black tabular-nums text-foreground">{csvData.length}</p>
                                </div>
                            </div>

                            {jobStatus === 'completed' && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    className="max-w-md mx-auto"
                                >
                                    <div className="p-6 rounded-[2rem] bg-emerald-50 border-2 border-emerald-100 flex items-center gap-6 shadow-xl shadow-emerald-500/10">
                                        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-lg"><Check className="h-6 w-6" /></div>
                                        <div className="flex-1">
                                            <p className="font-black text-emerald-900 uppercase tracking-tight">Job Finalized</p>
                                            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest opacity-80">Audit logs have been generated.</p>
                                        </div>
                                        <Button asChild className="rounded-xl font-black px-6 shadow-lg bg-emerald-600 hover:bg-emerald-700">
                                            <Link href="/admin/messaging">Dismiss</Link>
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </form>
        </div>
    );
}

function MessagePreviewer({ template, variables, sampleRow }: { template: MessageTemplate, variables: Record<string, any>, sampleRow?: any }) {
    const [isMounted, setIsMounted] = React.useState(false);
    
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return <Skeleton className="h-64 w-full rounded-2xl" />;

    const combinedVars = { ...variables, ...sampleRow };
    const resolvedSubject = template.channel === 'email' ? resolveVariables(template.subject || '', combinedVars) : null;
    const resolvedBody = resolveVariables(template.body, combinedVars);

    return (
        <div className={cn(
            "rounded-[2rem] border-2 overflow-hidden shadow-2xl transition-all duration-500",
            template.channel === 'email' ? "bg-white border-blue-50" : "bg-[#0A1427] border-slate-800 max-w-sm mx-auto"
        )}>
            {template.channel === 'email' ? (
                <div className="flex flex-col h-[450px]">
                    <div className="p-5 border-b bg-muted/20 space-y-1.5 shrink-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Recipient Inbox Subject</p>
                        <p className="font-black text-base truncate text-foreground">{resolvedSubject || '(No Subject)'}</p>
                    </div>
                    <div className="flex-1 overflow-auto p-8 bg-white relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 opacity-20" />
                        <div className="prose prose-sm max-w-none italic text-muted-foreground/40 mb-6 text-[9px] font-bold uppercase tracking-widest text-center border-b pb-3">
                            Branded HTML Layout applied during delivery
                        </div>
                        <div className="whitespace-pre-wrap font-medium leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: resolvedBody }} />
                    </div>
                </div>
            ) : (
                <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <SmartSappIcon className="h-7 w-7 text-white opacity-20" />
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Handset SMS Preview</p>
                    </div>
                    <div className="p-5 bg-white/5 border border-white/10 rounded-[1.5rem] relative shadow-inner group hover:bg-white/10 transition-colors">
                        <div className="absolute -left-2 top-6 w-4 h-4 bg-[#1a243a] border-l border-b border-white/10 rotate-45 rounded-sm" />
                        <p className="text-sm text-white/90 leading-relaxed font-medium whitespace-pre-wrap">{resolvedBody}</p>
                    </div>
                    <div className="pt-4 flex justify-between items-center text-[10px] font-black uppercase tracking-tighter text-white/30 border-t border-white/5">
                        <div className="flex flex-col gap-0.5">
                            <span>Chars: {resolvedBody.length}</span>
                            <span>Segments: {Math.ceil(resolvedBody.length / 160)}</span>
                        </div>
                        <Badge variant="outline" className="text-white/40 border-white/10 text-[8px] h-5">GSM-7 Compliant</Badge>
                    </div>
                </div>
            )}
        </div>
    );
}
