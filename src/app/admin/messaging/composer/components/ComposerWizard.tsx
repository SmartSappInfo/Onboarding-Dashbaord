
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { MessageTemplate, SenderProfile, MessageStyle, School, FocalPerson } from '@/lib/types';
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
    Zap,
    Contact,
    CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { SmartSappIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

const formSchema = z.object({
    channel: z.enum(['email', 'sms']),
    templateId: z.string().min(1, "Please select a template."),
    senderProfileId: z.string().min(1, "Please select a sender profile."),
    mode: z.enum(['single', 'bulk']),
    recipient: z.string().optional(),
    selectedContacts: z.array(z.string()).default([]),
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
            selectedContacts: [],
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
    const watchedSelectedContacts = watch('selectedContacts');

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

    const selectedSchool = React.useMemo(() => 
        schools?.find(s => s.id === watchedSchoolId),
    [schools, watchedSchoolId]);

    // Credit Estimation Logic
    const creditEstimation = React.useMemo(() => {
        if (watchedChannel !== 'sms' || !selectedTemplate) return null;
        
        const resolvedBody = resolveVariables(selectedTemplate.body, watchedVariables);
        const charsPerSms = 160;
        const segmentsPerMsg = Math.ceil(resolvedBody.length / charsPerSms);
        
        let recipientCount = 1;
        if (watchedMode === 'bulk') {
            recipientCount = csvData.length;
        } else if (watchedSelectedContacts.length > 0) {
            recipientCount = watchedSelectedContacts.length;
        }
        
        return {
            segments: segmentsPerMsg,
            totalCredits: segmentsPerMsg * recipientCount,
            recipientCount
        };
    }, [watchedChannel, selectedTemplate, watchedVariables, watchedMode, csvData, watchedSelectedContacts]);

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

                // Clear manual recipient if we have a school selected, unless it's bulk
                if (watchedMode === 'single') {
                    // Logic handled in UI by showing contact picker
                }

                // Map matching variables
                selectedTemplate?.variables.forEach(v => {
                    if (schoolVars[v]) {
                        setValue(`variables.${v}`, schoolVars[v]);
                    }
                });
            }
        }
    }, [watchedSchoolId, schools, selectedTemplate, watchedMode, watchedChannel, setValue]);

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
                // Determine recipients (manual + selected school contacts)
                const targets = [...data.selectedContacts];
                if (data.recipient?.trim()) targets.push(data.recipient.trim());

                if (targets.length === 0) throw new Error("No recipients selected.");
                
                // Process each recipient
                for (const target of targets) {
                    const result = await sendMessage({
                        templateId: data.templateId,
                        senderProfileId: data.senderProfileId,
                        recipient: target,
                        variables: data.variables,
                        schoolId: data.schoolId,
                        scheduledAt
                    });

                    if (!result.success) {
                        toast({ variant: 'warning', title: 'Partial Failure', description: `Failed to notify ${target}: ${result.error}` });
                    }
                }

                toast({ title: data.isScheduled ? 'Messages Scheduled' : 'Dispatch Complete', description: `${targets.length} communication tasks processed.` });
                setStep(1);
                form.reset();
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
            "flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors",
            step >= num ? "text-primary" : "text-muted-foreground opacity-40"
        )}>
            <div className={cn(
                "w-7 h-7 rounded-2xl border-2 flex items-center justify-center transition-all",
                step > num ? "bg-primary border-primary text-white" : step === num ? "border-primary text-primary shadow-lg shadow-primary/20 scale-110" : "border-muted-foreground"
            )}>
                {step > num ? <Check className="w-4 h-4" /> : num}
            </div>
            {label}
        </div>
    );

    const isOutOfCredits = watchedChannel === 'sms' && smsBalance !== null && creditEstimation && smsBalance < creditEstimation.totalCredits;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-center gap-8 mb-12">
                {stepLabel(1, "Blueprint")}
                <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                {stepLabel(2, "Recipients")}
                <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                {stepLabel(3, "Validation")}
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {step === 1 && (
                    <Card className="shadow-xl border-none ring-1 ring-border rounded-[2.5rem] overflow-hidden bg-white">
                        <CardHeader className="bg-muted/30 border-b pb-6 p-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                    <Sparkles className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-black uppercase tracking-tight">Select Infrastructure</CardTitle>
                                    <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Choose the channel and architectural template.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-12 p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">1. Communication Medium</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Button 
                                            type="button" 
                                            variant={watchedChannel === 'email' ? 'default' : 'outline'} 
                                            className={cn(
                                                "h-28 flex-col gap-2 rounded-3xl border-2 transition-all duration-500",
                                                watchedChannel === 'email' ? "shadow-2xl scale-105 border-primary bg-primary text-white" : "border-muted-foreground/10 hover:border-primary/30"
                                            )}
                                            onClick={() => setValue('channel', 'email')}
                                        >
                                            <div className={cn("p-3 rounded-2xl", watchedChannel === 'email' ? "bg-white/20" : "bg-blue-500/10 text-blue-500")}>
                                                <Mail className="h-7 w-7" />
                                            </div>
                                            <span className="font-black uppercase text-[10px] tracking-[0.2em]">Email Portal</span>
                                        </Button>
                                        <Button 
                                            type="button" 
                                            variant={watchedChannel === 'sms' ? 'default' : 'outline'} 
                                            className={cn(
                                                "h-28 flex-col gap-2 rounded-3xl border-2 transition-all duration-500",
                                                watchedChannel === 'sms' ? "shadow-2xl scale-105 border-primary bg-primary text-white" : "border-muted-foreground/10 hover:border-primary/30"
                                            )}
                                            onClick={() => setValue('channel', 'sms')}
                                        >
                                            <div className={cn("p-3 rounded-2xl", watchedChannel === 'sms' ? "bg-white/20" : "bg-orange-500/10 text-orange-500")}>
                                                <Smartphone className="h-7 w-7" />
                                            </div>
                                            <span className="font-black uppercase text-[10px] tracking-[0.2em]">SMS Gateway</span>
                                        </Button>
                                    </div>
                                    <AnimatePresence>
                                        {watchedChannel === 'sms' && (
                                            <motion.div 
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="flex items-center justify-between px-4 py-3 rounded-2xl bg-orange-50 border border-orange-100 text-[10px] font-black uppercase tracking-tighter"
                                            >
                                                <span className="text-orange-700/60">mNotify Credits Available</span>
                                                <span className={cn("flex items-center gap-1.5", smsBalance !== null && smsBalance < 50 ? "text-red-500 animate-pulse" : "text-emerald-600")}>
                                                    <Wallet className="h-3.5 w-3.5" />
                                                    {smsBalance !== null ? `${smsBalance.toLocaleString()} Credits` : 'Resolving...'}
                                                </span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">2. Target Logic Template</Label>
                                    <Controller
                                        name="templateId"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger className="h-16 rounded-[1.25rem] bg-muted/20 border-none shadow-inner focus:ring-1 focus:ring-primary/20 font-black text-xl px-6 transition-all">
                                                    <SelectValue placeholder="Identify template..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl p-2 border-none shadow-2xl">
                                                    {isLoadingTemplates ? (
                                                        <div className="p-8 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                                                    ) : templates?.map(t => (
                                                        <SelectItem key={t.id} value={t.id} className="rounded-xl my-1.5 p-3 hover:bg-primary/5 transition-colors focus:bg-primary/10">
                                                            <div className="flex items-center gap-4">
                                                                <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary h-5 px-2 bg-primary/5">{t.category}</Badge>
                                                                <span className="font-black text-foreground">{t.name}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100/50 flex items-start gap-4">
                                        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                                        <p className="text-[10px] font-bold text-blue-800/70 leading-relaxed uppercase tracking-widest">
                                            Templates automatically apply institutional branding and ensure regulatory compliance across all handsets.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {selectedTemplate && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-8 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-200 space-y-6"
                                >
                                    <div className="flex justify-between items-center px-2">
                                        <div className="flex items-center gap-3">
                                            <Zap className="h-5 w-5 text-primary" />
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Dynamic logic nodes mapped</Label>
                                        </div>
                                        <Badge className="bg-primary text-white border-none text-[9px] font-black uppercase tracking-widest px-4 h-7 rounded-xl shadow-lg shadow-primary/20">{selectedTemplate.variables.length} Data Points</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {selectedTemplate.variables.map(v => (
                                            <code key={v} className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-[10px] font-black text-primary shadow-sm uppercase tracking-tighter transition-all hover:border-primary/30">{"{{" + v + "}}"}</code>
                                        ))}
                                        {selectedTemplate.variables.length === 0 && <p className="text-xs font-bold text-muted-foreground italic px-2">This template uses static content.</p>}
                                    </div>
                                </motion.div>
                            )}
                        </CardContent>
                        <CardFooter className="justify-end bg-muted/30 p-8 border-t">
                            <Button type="button" size="lg" onClick={handleNext} disabled={!watchedTemplateId} className="px-16 rounded-2xl font-black shadow-2xl h-16 uppercase tracking-[0.1em] active:scale-95 transition-all group">
                                Next Step <ChevronRight className="ml-2 h-6 w-6 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 2 && (
                    <Card className="shadow-xl border-none ring-1 ring-border rounded-[2.5rem] overflow-hidden bg-white">
                        <CardHeader className="bg-muted/30 border-b pb-6 p-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                    <Users className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-black uppercase tracking-tight">Identity & Reach</CardTitle>
                                    <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Configure recipients and delivery throughput.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-12 p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">3. Authorized Sender</Label>
                                    <Controller
                                        name="senderProfileId"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger className="h-16 rounded-[1.25rem] bg-muted/20 border-none shadow-inner font-black text-xl px-6 transition-all">
                                                    <SelectValue placeholder="Identify sender..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl p-2 border-none shadow-2xl">
                                                    {isLoadingProfiles ? (
                                                        <div className="p-8 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                                                    ) : profiles?.map(p => (
                                                        <SelectItem key={p.id} value={p.id} className="rounded-xl my-1.5 p-3 hover:bg-primary/5 transition-colors focus:bg-primary/10">
                                                            <div className="flex items-center gap-4">
                                                                <span className="font-black text-foreground">{p.name}</span>
                                                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.1em] bg-muted px-2.5 py-1 rounded-lg">GATEWAY ID: {p.identifier}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">4. Dispatch Velocity</Label>
                                    <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1.5 rounded-[1.25rem] border border-border/50">
                                        <Button 
                                            type="button" 
                                            variant={watchedMode === 'single' ? 'secondary' : 'ghost'} 
                                            className={cn("h-12 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all", watchedMode === 'single' && "bg-white shadow-xl text-primary")}
                                            onClick={() => setValue('mode', 'single')}
                                        >
                                            <Target className="mr-2 h-4 w-4" /> Targeted
                                        </Button>
                                        <Button 
                                            type="button" 
                                            variant={watchedMode === 'bulk' ? 'secondary' : 'ghost'} 
                                            className={cn("h-12 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all", watchedMode === 'bulk' && "bg-white shadow-xl text-primary")}
                                            onClick={() => setValue('mode', 'bulk')}
                                        >
                                            <Layers className="mr-2 h-4 w-4" /> Broadcast
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <Separator className="bg-border/50" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className={cn(
                                    "p-8 rounded-[2.5rem] border-2 transition-all duration-700",
                                    watchedIsScheduled ? "bg-primary/5 border-primary shadow-2xl shadow-primary/5" : "bg-muted/10 border-border/50 opacity-60"
                                )}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-5">
                                            <div className={cn("p-4 rounded-3xl transition-all duration-700 shadow-lg", watchedIsScheduled ? "bg-primary text-white shadow-primary/30 rotate-6" : "bg-muted text-muted-foreground")}>
                                                <CalendarClock className="h-7 w-7" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-lg font-black uppercase tracking-tight">Deferred Task</Label>
                                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Async execution logic</p>
                                            </div>
                                        </div>
                                        <Controller
                                            name="isScheduled"
                                            control={control}
                                            render={({ field }) => (
                                                <Switch 
                                                    checked={field.value} 
                                                    onCheckedChange={field.onChange} 
                                                    className="scale-150"
                                                />
                                            )}
                                        />
                                    </div>
                                    
                                    <AnimatePresence>
                                        {watchedIsScheduled && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="pt-8 mt-8 border-t border-primary/10"
                                            >
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
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="p-8 rounded-[2.5rem] border-2 border-slate-100 bg-slate-50/50 space-y-8 shadow-inner">
                                    <div className="flex items-center gap-5">
                                        <div className="p-4 rounded-3xl bg-white text-primary shadow-xl border border-slate-100">
                                            <Building className="h-7 w-7" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-lg font-black uppercase tracking-tight">Campus Link</Label>
                                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Connect with official records</p>
                                        </div>
                                    </div>
                                    <Controller
                                        name="schoolId"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                <SelectTrigger className="h-14 rounded-2xl bg-white border-none shadow-lg font-black text-base px-6">
                                                    <SelectValue placeholder="Identify campus..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl p-2 border-none shadow-2xl">
                                                    <SelectItem value="none" className="rounded-xl italic">Independent Dispatch</SelectItem>
                                                    {schools?.map(s => <SelectItem key={s.id} value={s.id} className="rounded-xl font-bold">{s.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>

                            <Separator className="bg-border/50" />

                            <div className="space-y-8">
                                {watchedMode === 'single' ? (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="space-y-10"
                                    >
                                        {/* Contact Directory Picker */}
                                        {selectedSchool && (
                                            <div className="space-y-4 p-8 rounded-[2rem] bg-primary/5 border-2 border-primary/10 shadow-inner">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="p-2 bg-primary text-white rounded-xl shadow-lg"><Contact className="h-4 w-4" /></div>
                                                    <Label className="text-sm font-black uppercase tracking-tight text-primary">Campus Focal Directory</Label>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {selectedSchool.focalPersons?.map((person, idx) => {
                                                        const contactValue = watchedChannel === 'email' ? person.email : person.phone;
                                                        const isSelected = watchedSelectedContacts.includes(contactValue);
                                                        
                                                        return (
                                                            <div 
                                                                key={idx} 
                                                                className={cn(
                                                                    "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer group",
                                                                    isSelected ? "bg-white border-primary shadow-xl ring-4 ring-primary/5" : "bg-white border-transparent shadow-sm hover:border-primary/20"
                                                                )}
                                                                onClick={() => {
                                                                    const current = getValues('selectedContacts') || [];
                                                                    if (isSelected) setValue('selectedContacts', current.filter(c => c !== contactValue));
                                                                    else setValue('selectedContacts', [...current, contactValue]);
                                                                }}
                                                            >
                                                                <Checkbox 
                                                                    checked={isSelected}
                                                                    className="size-5 rounded-lg border-2 border-slate-200 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-black text-sm truncate uppercase tracking-tight">{person.name}</p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <Badge variant="outline" className="text-[8px] font-black uppercase h-4 px-1.5 border-primary/20 text-primary">{person.type}</Badge>
                                                                        <span className="text-[10px] font-mono text-muted-foreground truncate">{contactValue}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {(!selectedSchool.focalPersons || selectedSchool.focalPersons.length === 0) && (
                                                    <p className="text-center py-6 text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-40">No verified staff contacts found for this campus.</p>
                                                )}
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Manual Recipient Overlay</Label>
                                            <Controller
                                                name="recipient"
                                                control={control}
                                                render={({ field }) => (
                                                    <Input 
                                                        {...field} 
                                                        value={field.value ?? ''}
                                                        placeholder={watchedChannel === 'email' ? 'parent@example.com' : 'e.g. 024XXXXXXX'} 
                                                        className="h-16 rounded-[1.25rem] bg-muted/20 border-none shadow-inner focus:ring-1 focus:ring-primary/20 font-black text-2xl px-8"
                                                    />
                                                )}
                                            />
                                        </div>
                                        
                                        <div className="space-y-6">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Contextual Variable Injection</Label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                                                                    placeholder={`Inject value...`} 
                                                                    className="bg-muted/30 border-none h-12 rounded-xl shadow-inner focus-visible:ring-1 focus-visible:ring-primary/20 font-bold" 
                                                                />
                                                            )}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="space-y-8"
                                    >
                                        <div className="p-16 border-4 border-dashed rounded-[4rem] flex flex-col items-center justify-center text-center gap-8 bg-muted/10 border-muted-foreground/10 hover:border-primary/30 hover:bg-primary/5 transition-all duration-700 group">
                                            <div className="p-8 bg-white rounded-[2rem] text-primary shadow-2xl group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
                                                <Upload className="h-12 w-12" />
                                            </div>
                                            <div className="space-y-3">
                                                <p className="font-black text-3xl tracking-tight">Broadcast Repository (CSV)</p>
                                                <p className="text-sm text-muted-foreground max-w-[320px] mx-auto font-medium uppercase tracking-[0.15em] leading-relaxed">Map institutional datasets directly to template logic nodes.</p>
                                            </div>
                                            <Input type="file" accept=".csv" className="hidden" id="csv-upload" onChange={handleCsvUpload} />
                                            <Button asChild variant="outline" className="rounded-2xl border-2 font-black h-16 px-16 hover:bg-white shadow-2xl active:scale-95 transition-all uppercase tracking-widest text-xs">
                                                <label htmlFor="csv-upload" className="cursor-pointer">Identify Data Stream</label>
                                            </Button>
                                        </div>

                                        {csvData.length > 0 && (
                                            <div className="space-y-6 animate-in zoom-in-95 duration-700">
                                                <div className="flex items-center justify-between px-4">
                                                    <div className="flex items-center gap-3">
                                                        <Badge className="bg-primary h-7 font-black uppercase text-[10px] tracking-widest px-4 rounded-xl shadow-lg shadow-primary/20">{csvData.length} Targets Verified</Badge>
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Integrity Audit</Label>
                                                    </div>
                                                    <Button variant="ghost" size="sm" onClick={() => setCsvData([])} className="h-9 text-[10px] text-destructive uppercase font-black tracking-widest hover:bg-destructive/5 rounded-xl px-4">Purge List</Button>
                                                </div>
                                                <div className="rounded-3xl border bg-white overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)]">
                                                    <ScrollArea className="w-full">
                                                        <table className="w-full text-xs">
                                                            <thead className="bg-muted/50 border-b">
                                                                <tr>
                                                                    {csvHeaders.slice(0, 5).map(h => <th key={h} className="p-5 text-left font-black uppercase text-[10px] tracking-widest text-muted-foreground/60">{h}</th>)}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-muted/50">
                                                                {csvData.slice(0, 3).map((row, i) => (
                                                                    <tr key={i} className="hover:bg-primary/5 transition-colors">
                                                                        {csvHeaders.slice(0, 5).map(h => <td key={h} className="p-5 font-black text-foreground truncate max-w-[180px] uppercase tracking-tighter">{row[h]}</td>)}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        <ScrollBar orientation="horizontal" />
                                                    </ScrollArea>
                                                </div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 text-center">+ {csvData.length - 3} additional identifiers resolved.</p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="justify-between bg-muted/30 p-8 border-t">
                            <Button type="button" variant="ghost" onClick={handlePrev} className="font-black rounded-xl uppercase tracking-widest text-xs px-8 h-12">Previous Phase</Button>
                            <Button type="button" onClick={handleNext} disabled={!getValues('senderProfileId') || (watchedMode === 'single' ? (watchedSelectedContacts.length === 0 && !getValues('recipient')) : csvData.length === 0)} className="px-16 rounded-2xl font-black shadow-2xl h-16 uppercase tracking-[0.1em] active:scale-95 transition-all group">
                                Review Blueprint <ChevronRight className="ml-2 h-6 w-6 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 3 && (
                    <Card className="shadow-2xl border-none ring-1 ring-border rounded-[3rem] overflow-hidden bg-white">
                        <CardHeader className="bg-muted/30 border-b pb-8 p-10">
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-primary text-white rounded-[1.5rem] shadow-2xl shadow-primary/20 rotate-3">
                                    <CheckCircle2 className="h-8 w-8" />
                                </div>
                                <div>
                                    <CardTitle className="text-3xl font-black uppercase tracking-tight">Final Verification</CardTitle>
                                    <CardDescription className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Validate payload and confirm operational metrics.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-12 p-10 pt-12">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                                <div className="space-y-10">
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-2 p-6 rounded-3xl bg-muted/20 border border-border/50 shadow-inner">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Authority ID</Label>
                                            <p className="font-black text-primary uppercase text-lg leading-tight">{profiles?.find(p => p.id === getValues('senderProfileId'))?.name}</p>
                                        </div>
                                        <div className="space-y-2 p-6 rounded-3xl bg-muted/20 border border-border/50 shadow-inner">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Task Priority</Label>
                                            <p className={cn("font-black uppercase text-base flex items-center gap-2", watchedIsScheduled ? "text-primary" : "text-emerald-600")}>
                                                {watchedIsScheduled ? <CalendarClock className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                                                {watchedIsScheduled ? 'Queued' : 'Real-time'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Cost Analytics */}
                                    {watchedChannel === 'sms' && creditEstimation && (
                                        <Card className="bg-orange-50 border-orange-200 overflow-hidden rounded-[2.5rem] shadow-xl shadow-orange-500/5">
                                            <CardHeader className="pb-4 border-b border-orange-100 bg-orange-100/50 p-8">
                                                <CardTitle className="text-xs font-black uppercase tracking-widest text-orange-800 flex items-center gap-3">
                                                    <TrendingUp className="h-4 w-4" /> Operational Resource Audit
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-8 space-y-6">
                                                <div className="grid grid-cols-3 gap-8">
                                                    <div className="text-center space-y-2">
                                                        <p className="text-[9px] font-black uppercase text-orange-700/60 leading-none">Identities</p>
                                                        <p className="text-4xl font-black text-orange-900 tabular-nums tracking-tighter">{creditEstimation.recipientCount}</p>
                                                    </div>
                                                    <div className="text-center space-y-2 border-x border-orange-200 px-4">
                                                        <p className="text-[9px] font-black uppercase text-orange-700/60 leading-none">SMS Units</p>
                                                        <p className="text-4xl font-black text-orange-900 tabular-nums tracking-tighter">{creditEstimation.segments}</p>
                                                    </div>
                                                    <div className="text-center space-y-2">
                                                        <p className="text-[9px] font-black uppercase text-orange-700/60 leading-none">Net Credits</p>
                                                        <p className="text-4xl font-black text-orange-900 tabular-nums tracking-tighter">{creditEstimation.totalCredits}</p>
                                                    </div>
                                                </div>
                                                
                                                {isOutOfCredits ? (
                                                    <motion.div 
                                                        animate={{ scale: [1, 1.02, 1] }}
                                                        transition={{ repeat: Infinity, duration: 2 }}
                                                        className="p-5 rounded-2xl bg-red-100 border-2 border-red-200 flex items-start gap-4"
                                                    >
                                                        <AlertCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-red-800">Resource Deficiency Detected</p>
                                                            <p className="text-xs text-red-700 leading-relaxed font-bold uppercase tracking-tighter">
                                                                Execution requires {creditEstimation.totalCredits} units but balance is {smsBalance?.toLocaleString()}. Top up gateway to proceed.
                                                            </p>
                                                        </div>
                                                    </motion.div>
                                                ) : (
                                                    <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/50 border border-orange-200 shadow-sm">
                                                        <span className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Gateway Threshold</span>
                                                        <Badge className="bg-emerald-500 text-white border-none text-[10px] font-black tabular-nums h-6 px-3">{smsBalance?.toLocaleString()} Available</Badge>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}

                                    <div className="p-6 rounded-3xl border-2 border-blue-100 bg-blue-50/30 flex items-start gap-5 shadow-inner">
                                        <div className="p-2.5 bg-blue-100 rounded-xl text-blue-600 shadow-sm"><ShieldAlert className="h-6 w-6" /></div>
                                        <div className="space-y-1.5">
                                            <p className="text-base font-black text-blue-900 uppercase tracking-tight leading-none mb-1">Compliance Policy Audit</p>
                                            <p className="text-[10px] text-blue-700 leading-relaxed font-bold uppercase tracking-[0.1em] opacity-80">
                                                All outgoing traffic is logged for regulatory oversight. By launching this task, you confirm explicit consent from all target recipients.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-3 ml-1">
                                        <Eye className="h-4 w-4" /> Live Payload Simulation
                                    </Label>
                                    <MessagePreviewer 
                                        template={selectedTemplate!} 
                                        variables={getValues('variables')} 
                                        sampleRow={watchedMode === 'bulk' ? csvData[0] : null}
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="justify-between bg-muted/30 p-10 border-t">
                            <Button type="button" variant="ghost" onClick={handlePrev} disabled={isSubmitting} className="font-black rounded-xl uppercase tracking-widest text-xs px-8 h-12">Edit Architecture</Button>
                            <Button type="submit" size="lg" disabled={isSubmitting || isOutOfCredits} className="px-20 font-black shadow-2xl h-20 gap-5 bg-primary text-white hover:bg-primary/90 rounded-[2rem] transition-all active:scale-95 text-xl uppercase tracking-[0.2em] shadow-primary/30">
                                {isSubmitting ? <Loader2 className="h-8 w-8 animate-spin" /> : <Sparkles className="h-8 w-8" />}
                                {watchedMode === 'single' ? (watchedIsScheduled ? 'Queue Multi-Task' : 'Launch Dispatch') : `Execute Broadcast`}
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 4 && (
                    <Card className="shadow-2xl border-none ring-1 ring-primary/20 rounded-[4rem] overflow-hidden bg-white">
                        <CardHeader className="text-center pb-12 pt-16 border-b bg-muted/30">
                            <div className="mx-auto bg-primary/10 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl shadow-primary/10 rotate-6 transition-transform hover:rotate-0">
                                {jobStatus === 'processing' ? <Loader2 className="h-12 w-12 animate-spin text-primary" /> : <Trophy className="h-12 w-12 text-emerald-600" />}
                            </div>
                            <CardTitle className="text-4xl font-black tracking-tighter text-foreground uppercase leading-none">Task Force Execution</CardTitle>
                            <CardDescription className="text-base font-bold uppercase tracking-[0.3em] text-muted-foreground mt-4">Connecting with {csvData.length} identities via secured gateway.</CardDescription>
                        </CardHeader>
                        <CardContent className="py-20 space-y-16">
                            <div className="space-y-8 max-w-2xl mx-auto px-4">
                                <div className="flex justify-between items-end mb-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Throughput Velocity</p>
                                    <p className="text-6xl font-black tabular-nums tracking-tighter text-primary">{jobProgress}%</p>
                                </div>
                                <div className="h-6 w-full bg-muted/30 rounded-full overflow-hidden border-2 p-1.5 shadow-inner">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${jobProgress}%` }}
                                        className="h-full bg-primary rounded-full shadow-[0_0_25px_rgba(59,95,255,0.6)]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-12 max-w-2xl mx-auto">
                                <div className="p-10 rounded-[3rem] bg-slate-50 border-2 border-slate-100 text-center space-y-2 shadow-inner group hover:border-primary/20 transition-all duration-500">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-4">Resolved Packets</p>
                                    <p className="text-6xl font-black tabular-nums text-foreground group-hover:scale-110 transition-transform">{Math.round((jobProgress/100) * csvData.length)}</p>
                                </div>
                                <div className="p-10 rounded-[3rem] bg-slate-50 border-2 border-slate-100 text-center space-y-2 shadow-inner group hover:border-primary/20 transition-all duration-500">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-4">Total Workforce</p>
                                    <p className="text-6xl font-black tabular-nums text-foreground">{csvData.length}</p>
                                </div>
                            </div>

                            {jobStatus === 'completed' && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 40, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    className="max-w-xl mx-auto"
                                >
                                    <div className="p-8 rounded-[3rem] bg-emerald-50 border-2 border-emerald-100 flex items-center gap-8 shadow-2xl shadow-emerald-500/10">
                                        <div className="bg-emerald-600 text-white p-5 rounded-[1.5rem] shadow-xl"><Check className="h-8 w-8" /></div>
                                        <div className="flex-1">
                                            <p className="font-black text-xl text-emerald-900 uppercase tracking-tight">Mission Success</p>
                                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest opacity-80 mt-1">Audit protocols successfully generated.</p>
                                        </div>
                                        <Button asChild className="rounded-2xl font-black h-14 px-10 shadow-xl bg-emerald-600 hover:bg-emerald-700 uppercase tracking-widest text-xs">
                                            <Link href="/admin/messaging">Acknowledge</Link>
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

    if (!isMounted) return <Skeleton className="h-64 w-full rounded-[2.5rem]" />;

    const combinedVars = { ...variables, ...sampleRow };
    const resolvedSubject = template.channel === 'email' ? resolveVariables(template.subject || '', combinedVars) : null;
    const resolvedBody = resolveVariables(template.body, combinedVars);

    return (
        <div className={cn(
            "rounded-[3rem] border-2 overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] transition-all duration-700",
            template.channel === 'email' ? "bg-white border-blue-50" : "bg-[#0A1427] border-slate-800 max-w-sm mx-auto"
        )}>
            {template.channel === 'email' ? (
                <div className="flex flex-col h-[550px]">
                    <div className="p-8 border-b bg-muted/20 space-y-2 shrink-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">Inbox Perception Audit</p>
                        <p className="font-black text-lg truncate text-foreground">{resolvedSubject || '(No Subject Defined)'}</p>
                    </div>
                    <div className="flex-1 overflow-auto p-10 bg-white relative">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20" />
                        <div className="prose prose-sm max-w-none italic text-muted-foreground/40 mb-8 text-[10px] font-black uppercase tracking-[0.2em] text-center border-b pb-4">
                            High-Fidelity Branded Wrapper Active
                        </div>
                        <div className="whitespace-pre-wrap font-medium leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: resolvedBody }} />
                    </div>
                </div>
            ) : (
                <div className="p-10 space-y-8">
                    <div className="flex items-center justify-between">
                        <SmartSappIcon className="h-8 w-8 text-white opacity-20" />
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Device Simulation</p>
                    </div>
                    <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] relative shadow-inner group hover:bg-white/10 transition-colors">
                        <div className="absolute -left-2.5 top-8 w-5 h-5 bg-[#1a243a] border-l border-b border-white/10 rotate-45 rounded-sm" />
                        <p className="text-sm text-white/95 leading-relaxed font-bold whitespace-pre-wrap">{resolvedBody}</p>
                    </div>
                    <div className="pt-6 flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-white/30 border-t border-white/5">
                        <div className="flex flex-col gap-1">
                            <span>Chars: {resolvedBody.length}</span>
                            <span>Units: {Math.ceil(resolvedBody.length / 160)} SMS</span>
                        </div>
                        <Badge variant="outline" className="text-white/40 border-white/10 text-[8px] h-6 px-3 rounded-xl uppercase tracking-tighter">Verified Logic</Badge>
                    </div>
                </div>
            )}
        </div>
    );
}

function ShieldAlert(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  )
}
