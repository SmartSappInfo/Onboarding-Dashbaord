
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, orderBy, doc, getDoc, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { MessageTemplate, SenderProfile, MessageStyle, School, FocalPerson, MessageLog, Meeting, Survey, PDFForm, SurveyResponse, Submission } from '@/lib/types';
import { sendMessage } from '@/lib/messaging-engine';
import { resolveVariables, renderBlocksToHtml } from '@/lib/messaging-utils';
import { createBulkMessageJob, processBulkJobChunk } from '@/lib/bulk-messaging';
import { fetchSmsBalanceAction } from '@/lib/mnotify-actions';
import { fetchContextualData } from '@/lib/messaging-actions';
import { refineMessage } from '@/ai/flows/refine-message-flow';
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
    CheckCircle2,
    Target,
    Layers,
    Wand2,
    ArrowRight,
    ArrowLeft,
    FileText,
    ClipboardList,
    Calendar,
    Database,
    PlusCircle,
    Search
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { SmartSappIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import QuickTemplateDialog from '../../components/quick-template-dialog';
import { cn } from '@/lib/utils';

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
    // Data Source Bindings
    sourceMeetingId: z.string().optional(),
    sourceSurveyId: z.string().optional(),
    sourceResponseId: z.string().optional(),
    sourcePdfId: z.string().optional(),
    sourceSubmissionId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function ComposerWizard() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const [step, setStep] = React.useState(1);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isQuickCreateOpen, setIsQuickCreateOpen] = React.useState(false);
    
    // AI Refiner State
    const [isRefining, setIsRefining] = React.useState(false);
    const [selectedTone, setSelectedTone] = React.useState<'formal' | 'friendly' | 'urgent' | 'concise'>('formal');

    // Bulk / CSV State
    const [csvData, setCsvData] = React.useState<any[]>([]);
    const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
    const [columnMapping, setColumnMapping] = React.useState<Record<string, string>>({});
    
    const [jobId, setJobId] = React.useState<string | null>(null);
    const [jobProgress, setJobProgress] = React.useState(0);
    const [jobStatus, setJobStatus] = React.useState<string | null>(null);
    const [smsBalance, setSmsBalance] = React.useState<number | null>(null);

    // Recipient Targeting State
    const [recipientSuggestions, setRecipientSuggestions] = React.useState<{ label: string, value: string, source: string }[]>([]);
    const [recipientSearchTerm, setRecipientSearchTerm] = React.useState('');

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
    
    // Watched Data Sources
    const watchedSourceMeetingId = watch('sourceMeetingId');
    const watchedSourceSurveyId = watch('sourceSurveyId');
    const watchedSourceResponseId = watch('sourceResponseId');
    const watchedSourcePdfId = watch('sourcePdfId');
    const watchedSourceSubmissionId = watch('sourceSubmissionId');

    // Load SMS Balance
    React.useEffect(() => {
        const fetchBalance = async () => {
            const result = await fetchSmsBalanceAction();
            if (result.success) setSmsBalance(result.balance ?? 0);
        };
        fetchBalance();
    }, []);

    // Load Collections for Contextual Binding
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

    const meetingsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'meetings'), orderBy('meetingTime', 'desc'));
    }, [firestore]);

    const surveysQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'surveys'), where('status', '==', 'published'));
    }, [firestore]);

    const pdfsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'pdfs'), where('status', '==', 'published'));
    }, [firestore]);

    const responsesQuery = useMemoFirebase(() => {
        if (!firestore || !watchedSourceSurveyId) return null;
        return query(collection(firestore, `surveys/${watchedSourceSurveyId}/responses`), orderBy('submittedAt', 'desc'), limit(50));
    }, [firestore, watchedSourceSurveyId]);

    const submissionsQuery = useMemoFirebase(() => {
        if (!firestore || !watchedSourcePdfId) return null;
        return query(collection(firestore, `pdfs/${watchedSourcePdfId}/submissions`), orderBy('submittedAt', 'desc'), limit(50));
    }, [firestore, watchedSourcePdfId]);

    const { data: templates, isLoading: isLoadingTemplates } = useCollection<MessageTemplate>(templatesQuery);
    const { data: profiles } = useCollection<SenderProfile>(profilesQuery);
    const { data: schools } = useCollection<School>(schoolsQuery);
    const { data: meetings } = useCollection<Meeting>(meetingsQuery);
    const { data: surveys } = useCollection<Survey>(surveysQuery);
    const { data: pdfs } = useCollection<PDFForm>(pdfsQuery);
    const { data: responses } = useCollection<SurveyResponse>(responsesQuery);
    const { data: submissions } = useCollection<Submission>(submissionsQuery);

    const selectedTemplate = React.useMemo(() => 
        templates?.find(t => t.id === watchedTemplateId), 
    [templates, watchedTemplateId]);

    const selectedSchool = React.useMemo(() => 
        schools?.find(s => s.id === watchedSchoolId),
    [schools, watchedSchoolId]);

    // Recipient Discovery Logic
    const discoverRecipients = React.useCallback((data: any, source: string) => {
        const candidates: { label: string, value: string, source: string }[] = [];
        if (!data) return candidates;

        const isEmail = watchedChannel === 'email';
        
        // Strategy 1: Check standard fields
        if (isEmail && data.email) candidates.push({ label: `School Admin (${data.email})`, value: data.email, source });
        if (!isEmail && data.phone) candidates.push({ label: `School Phone (${data.phone})`, value: data.phone, source });
        if (data.contactPerson) candidates.push({ label: `Contact: ${data.contactPerson}`, value: isEmail ? data.email : data.phone, source });

        // Strategy 2: Check deep focal persons (Schools)
        if (data.focalPersons && Array.isArray(data.focalPersons)) {
            data.focalPersons.forEach((p: FocalPerson) => {
                candidates.push({ label: `${p.type}: ${p.name}`, value: isEmail ? p.email : p.phone, source: 'Focal Person' });
            });
        }

        // Strategy 3: Dynamic harvesting from survey answers or PDF fields
        if (data.answers || data.formData) {
            const fields = data.answers || Object.entries(data.formData).map(([k, v]) => ({ questionId: k, value: v }));
            fields.forEach((f: any) => {
                const val = String(f.value);
                if (isEmail && val.includes('@') && val.includes('.')) {
                    candidates.push({ label: `Detected Email`, value: val, source });
                } else if (!isEmail && val.length >= 10 && /^\+?[\d\s-]+$/.test(val)) {
                    candidates.push({ label: `Detected Phone`, value: val, source });
                }
            });
        }

        return candidates.filter(c => !!c.value);
    }, [watchedChannel]);

    // Search Result Filtering
    const searchResults = React.useMemo(() => {
        if (!recipientSearchTerm || !schools) return [];
        const s = recipientSearchTerm.toLowerCase();
        const results: { label: string, value: string, source: string }[] = [];

        schools.forEach(school => {
            if (school.name.toLowerCase().includes(s)) {
                results.push(...discoverRecipients(school, school.name));
            }
        });

        return results.slice(0, 5);
    }, [recipientSearchTerm, schools, discoverRecipients]);

    // Handle Contextual Binding (Automatic Resolution)
    React.useEffect(() => {
        const resolveRecord = async () => {
            if (watchedSourceMeetingId) {
                const result = await fetchContextualData('Meeting', watchedSourceMeetingId);
                if (result.success && result.data) {
                    setValue('variables.meeting_time', format(new Date(result.data.meetingTime), 'PPP p'));
                    setValue('variables.meeting_link', result.data.meetingLink);
                    setValue('variables.meeting_type', result.data.type?.name || '');
                }
            }
        };
        resolveRecord();
    }, [watchedSourceMeetingId, setValue]);

    React.useEffect(() => {
        const resolveResponse = async () => {
            if (watchedSourceResponseId && watchedSourceSurveyId) {
                const result = await fetchContextualData('SurveyResponse', watchedSourceResponseId, watchedSourceSurveyId);
                if (result.success && result.data) {
                    setValue('variables.score', result.data.score || 0);
                    result.data.answers?.forEach((a: any) => {
                        setValue(`variables.${a.questionId}`, typeof a.value === 'object' ? JSON.stringify(a.value) : String(a.value));
                    });
                    setRecipientSuggestions(discoverRecipients(result.data, 'Survey'));
                }
            }
        };
        resolveResponse();
    }, [watchedSourceResponseId, watchedSourceSurveyId, setValue, discoverRecipients]);

    React.useEffect(() => {
        const resolveSubmission = async () => {
            if (watchedSourceSubmissionId && watchedSourcePdfId) {
                const result = await fetchContextualData('Submission', watchedSourceSubmissionId, watchedSourcePdfId);
                if (result.success && result.data) {
                    Object.entries(result.data.formData || {}).forEach(([key, val]) => {
                        setValue(`variables.${key}`, String(val));
                    });
                    setRecipientSuggestions(discoverRecipients(result.data, 'PDF'));
                }
            }
        };
        resolveSubmission();
    }, [watchedSourceSubmissionId, watchedSourcePdfId, setValue, discoverRecipients]);

    // Smart Variable Resolution for Schools
    React.useEffect(() => {
        if (selectedSchool) {
            setValue('variables.school_name', selectedSchool.name);
            setValue('variables.school_location', selectedSchool.location || '');
            setValue('variables.school_phone', selectedSchool.phone || '');
            setValue('variables.school_email', selectedSchool.email || '');
            setValue('variables.contact_name', selectedSchool.contactPerson || '');
            setRecipientSuggestions(discoverRecipients(selectedSchool, 'School'));
        }
    }, [selectedSchool, setValue, discoverRecipients]);

    // Handle CSV Processing
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
            
            const mapping: Record<string, string> = {};
            selectedTemplate?.variables.forEach(v => {
                const match = headers.find(h => h.toLowerCase() === v.toLowerCase());
                if (match) mapping[v] = match;
            });
            setColumnMapping(mapping);

            toast({ title: 'CSV Processed', description: `${data.length} records identified.` });
        };
        reader.readAsText(file);
    };

    // AI Refinement Handler
    const handleAiRefine = async () => {
        if (!selectedTemplate || isRefining) return;
        setIsRefining(true);
        try {
            const result = await refineMessage({
                text: selectedTemplate.body,
                tone: selectedTone,
                channel: watchedChannel
            });
            setValue('variables.ai_refined_body', result.refinedText);
            toast({ title: 'AI Refinement Applied', description: `Message polished with a ${selectedTone} tone.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Refinement Failed', description: e.message });
        } finally {
            setIsRefining(false);
        }
    };

    const handleNext = () => setStep(s => s + 1);
    const handlePrev = () => setStep(s => s - 1);

    const onSubmit = async (data: FormData) => {
        if (!user) return;
        setIsSubmitting(true);

        const scheduledAt = data.isScheduled ? data.scheduledAt?.toISOString() : undefined;

        try {
            if (data.mode === 'single') {
                const targets = [...data.selectedContacts];
                if (data.recipient?.trim()) targets.push(data.recipient.trim());

                if (targets.length === 0) throw new Error("No recipients selected.");
                
                for (const target of targets) {
                    await sendMessage({
                        templateId: data.templateId,
                        senderProfileId: data.senderProfileId,
                        recipient: target,
                        variables: data.variables,
                        schoolId: data.schoolId,
                        scheduledAt
                    });
                }

                toast({ title: data.isScheduled ? 'Messages Scheduled' : 'Dispatch Complete' });
                setStep(1);
                form.reset();
            } else {
                if (csvData.length === 0) throw new Error("No recipient data found.");
                
                const recipients = csvData.map(row => {
                    const mappedVars: Record<string, any> = { ...data.variables };
                    Object.entries(columnMapping).forEach(([templateVar, csvCol]) => {
                        mappedVars[templateVar] = row[csvCol];
                    });
                    
                    return {
                        recipient: row.recipient || row.phone || row.email || row[Object.values(columnMapping)[0] || ''],
                        variables: mappedVars
                    };
                });

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
                if (result.status === 'completed' || result.status === 'failed') finished = true;
                await new Promise(r => setTimeout(r, 1000));
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

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-center gap-8 mb-12">
                {stepLabel(1, "Blueprint")}
                {stepLabel(2, "Identities")}
                {stepLabel(3, "Validation")}
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 text-left">
                {step === 1 && (
                    <Card className="shadow-xl border-none ring-1 ring-border rounded-[2.5rem] overflow-hidden bg-white">
                        <CardHeader className="bg-muted/30 border-b pb-6 p-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                    <Sparkles className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-black uppercase tracking-tight">Channel & Logic</CardTitle>
                                    <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Identify the communication protocol.</CardDescription>
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
                                            className={cn("h-28 flex-col gap-2 rounded-3xl border-2 transition-all duration-500", watchedChannel === 'email' ? "shadow-2xl scale-105 border-primary bg-primary text-white" : "border-muted-foreground/10")}
                                            onClick={() => setValue('channel', 'email')}
                                        >
                                            <Mail className="h-7 w-7" />
                                            <span className="font-black uppercase text-[10px] tracking-[0.2em]">Email</span>
                                        </Button>
                                        <Button 
                                            type="button" 
                                            variant={watchedChannel === 'sms' ? 'default' : 'outline'} 
                                            className={cn("h-28 flex-col gap-2 rounded-3xl border-2 transition-all duration-500", watchedChannel === 'sms' ? "shadow-2xl scale-105 border-primary bg-primary text-white" : "border-muted-foreground/10")}
                                            onClick={() => setValue('channel', 'sms')}
                                        >
                                            <Smartphone className="h-7 w-7" />
                                            <span className="font-black uppercase text-[10px] tracking-[0.2em]">SMS</span>
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">2. Core Template</Label>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 px-2 text-[9px] font-black uppercase tracking-tighter text-primary gap-1"
                                            onClick={() => setIsQuickCreateOpen(true)}
                                        >
                                            <PlusCircle className="h-3 w-3" /> New Template
                                        </Button>
                                    </div>
                                    <Controller
                                        name="templateId"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger className="h-16 rounded-[1.25rem] bg-muted/20 border-none shadow-inner font-black text-xl px-6 transition-all">
                                                    <SelectValue placeholder="Pick template..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl p-2 border-none shadow-2xl">
                                                    {isLoadingTemplates ? (
                                                        <div className="p-8 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                                                    ) : templates?.map(t => (
                                                        <SelectItem key={t.id} value={t.id} className="rounded-xl my-1.5 p-3">
                                                            <div className="flex items-center gap-4">
                                                                <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary h-5 bg-primary/5">{t.category}</Badge>
                                                                <span className="font-black text-foreground">{t.name}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>

                            {selectedTemplate && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-8 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-200 space-y-8 text-left">
                                    <div className="flex justify-between items-center px-2">
                                        <div className="flex items-center gap-3">
                                            <Zap className="h-5 w-5 text-primary" />
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Content Intelligence</Label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Select value={selectedTone} onValueChange={(v: any) => setSelectedTone(v)}>
                                                <SelectTrigger className="h-8 w-32 text-[10px] font-black uppercase bg-white border-primary/20">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="formal">Formal</SelectItem>
                                                    <SelectItem value="friendly">Friendly</SelectItem>
                                                    <SelectItem value="urgent">Urgent</SelectItem>
                                                    <SelectItem value="concise">Concise</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button type="button" size="sm" variant="outline" onClick={handleAiRefine} disabled={isRefining} className="h-8 gap-2 font-black text-[10px] uppercase border-primary/20 hover:bg-primary/5">
                                                {isRefining ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                                                Refine with AI
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {selectedTemplate.variables.map(v => (
                                            <code key={v} className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-[10px] font-black text-primary shadow-sm uppercase tracking-tighter">{"{{" + v + "}}"}</code>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </CardContent>
                        <CardFooter className="justify-end bg-muted/30 p-8 border-t">
                            <Button type="button" size="lg" onClick={handleNext} disabled={!watchedTemplateId} className="px-16 rounded-2xl font-black shadow-2xl h-16 uppercase tracking-[0.1em] active:scale-95 group">
                                Next Phase <ChevronRight className="ml-2 h-6 w-6 transition-transform group-hover:translate-x-1" />
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
                                    <CardTitle className="text-2xl font-black uppercase tracking-tight">Identities & Resolution</CardTitle>
                                    <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Select target identities and bind records for variable resolution.</CardDescription>
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
                                                    <SelectValue placeholder="Sender ID..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl p-2 border-none shadow-2xl">
                                                    {profiles?.map(p => (
                                                        <SelectItem key={p.id} value={p.id} className="rounded-xl my-1.5 p-3">
                                                            <div className="flex items-center gap-4">
                                                                <span className="font-black text-foreground uppercase tracking-tight">{p.name}</span>
                                                                <span className="text-[9px] font-black text-muted-foreground tracking-[0.1em] bg-muted px-2.5 py-1 rounded-lg italic">ID: {p.identifier}</span>
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
                                    <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1.5 rounded-[1.25rem] border border-border/50 shadow-inner">
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

                            <div className="space-y-8">
                                {watchedMode === 'single' ? (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
                                        {/* Contextual Binding Selectors */}
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            {/* School Selector (Always visible) */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                                    <Building className="h-3 w-3" /> Bind Institution
                                                </Label>
                                                <Controller
                                                    name="schoolId"
                                                    control={control}
                                                    render={({ field }) => (
                                                        <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                            <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none font-bold">
                                                                <SelectValue placeholder="Pick school..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                <SelectItem value="none">Independent</SelectItem>
                                                                {schools?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                />
                                            </div>

                                            {/* Meeting Binder */}
                                            {selectedTemplate?.category === 'meetings' && (
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                        <Calendar className="h-3 w-3" /> Bind Session
                                                    </Label>
                                                    <Controller
                                                        name="sourceMeetingId"
                                                        control={control}
                                                        render={({ field }) => (
                                                            <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                                <SelectTrigger className="h-12 rounded-xl bg-primary/5 border-primary/20 text-primary font-black">
                                                                    <SelectValue placeholder="Pick meeting..." />
                                                                </SelectTrigger>
                                                                <SelectContent className="rounded-xl">
                                                                    <SelectItem value="none">No Binding</SelectItem>
                                                                    {meetings?.map(m => <SelectItem key={m.id} value={m.id}>{m.schoolName} - {m.type.name}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    />
                                                </div>
                                            )}

                                            {/* Survey Binder */}
                                            {selectedTemplate?.category === 'surveys' && (
                                                <>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                            <ClipboardList className="h-3 w-3" /> Bind Survey
                                                        </Label>
                                                        <Controller
                                                            name="sourceSurveyId"
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                                    <SelectTrigger className="h-12 rounded-xl bg-primary/5 border-primary/20 text-primary font-black">
                                                                        <SelectValue placeholder="Pick survey..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl">
                                                                        <SelectItem value="none">No Binding</SelectItem>
                                                                        {surveys?.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        />
                                                    </div>
                                                    {watchedSourceSurveyId && (
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                                <Database className="h-3 w-3" /> Select Record
                                                            </Label>
                                                            <Controller
                                                                name="sourceResponseId"
                                                                control={control}
                                                                render={({ field }) => (
                                                                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                                        <SelectTrigger className="h-12 rounded-xl bg-primary/5 border-primary/20 text-primary font-black">
                                                                            <SelectValue placeholder="Pick response..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="rounded-xl">
                                                                            <SelectItem value="none">None</SelectItem>
                                                                            {responses?.map(r => (
                                                                                <SelectItem key={r.id} value={r.id}>
                                                                                    {format(new Date(r.submittedAt), 'MMM d, HH:mm')} - Score: {r.score}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                )}
                                                            />
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* PDF Binder */}
                                            {selectedTemplate?.category === 'forms' && (
                                                <>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                            <FileText className="h-3 w-3" /> Bind Document
                                                        </Label>
                                                        <Controller
                                                            name="sourcePdfId"
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                                    <SelectTrigger className="h-12 rounded-xl bg-primary/5 border-primary/20 text-primary font-black">
                                                                        <SelectValue placeholder="Pick PDF..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl">
                                                                        <SelectItem value="none">No Binding</SelectItem>
                                                                        {pdfs?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        />
                                                    </div>
                                                    {watchedSourcePdfId && (
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                                <Database className="h-3 w-3" /> Select Submission
                                                            </Label>
                                                            <Controller
                                                                name="sourceSubmissionId"
                                                                control={control}
                                                                render={({ field }) => (
                                                                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                                        <SelectTrigger className="h-12 rounded-xl bg-primary/5 border-primary/20 text-primary font-black">
                                                                            <SelectValue placeholder="Pick submission..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="rounded-xl">
                                                                            <SelectItem value="none">None</SelectItem>
                                                                            {submissions?.map(s => (
                                                                                <SelectItem key={s.id} value={s.id}>
                                                                                    {format(new Date(s.submittedAt), 'MMM d, HH:mm')} - ID: {s.id.substring(0,8)}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                )}
                                                            />
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        <div className="h-px bg-border/50" />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-1">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Manual Recipient Overlay</Label>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className={cn(
                                                                    "flex items-center gap-1.5 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border transition-all duration-500",
                                                                    recipientSuggestions.length > 0 ? "text-emerald-600 bg-emerald-50 border-emerald-100" : "text-muted-foreground opacity-20 bg-muted/10 border-border"
                                                                )}>
                                                                    <CheckCircle2 className="h-2.5 w-2.5" /> Discovery Engine
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Targeting suggestions harvested from bound records</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                                
                                                <div className="space-y-4">
                                                    <div className="relative group">
                                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground opacity-20 group-focus-within:text-primary group-focus-within:opacity-100 transition-all" />
                                                        <Controller
                                                            name="recipient"
                                                            control={control}
                                                            render={({ field }) => (
                                                                <Input 
                                                                    {...field} 
                                                                    placeholder={watchedChannel === 'email' ? 'parent@example.com' : 'e.g. 024XXXXXXX'} 
                                                                    className="h-16 rounded-[1.25rem] bg-muted/20 border-none shadow-inner font-black text-2xl px-12 focus-visible:ring-1 focus-visible:ring-primary/20"
                                                                    value={field.value || ''}
                                                                    onChange={(e) => {
                                                                        field.onChange(e.target.value);
                                                                        setRecipientSearchTerm(e.target.value);
                                                                    }}
                                                                />
                                                            )}
                                                        />
                                                    </div>
                                                    
                                                    {/* Smart Suggestions & Discovery Hub */}
                                                    {(recipientSuggestions.length > 0 || searchResults.length > 0) && (
                                                        <div className="p-4 rounded-2xl bg-slate-50 border border-border shadow-inner space-y-4 animate-in fade-in slide-in-from-top-2">
                                                            {recipientSuggestions.length > 0 && (
                                                                <div className="space-y-2">
                                                                    <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Discovered Contacts</p>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {recipientSuggestions.map((sug, i) => (
                                                                            <button
                                                                                key={i}
                                                                                type="button"
                                                                                onClick={() => { setValue('recipient', sug.value); setRecipientSearchTerm(''); }}
                                                                                className={cn(
                                                                                    "flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 shadow-sm",
                                                                                    watch('recipient') === sug.value ? "bg-primary border-primary text-white" : "bg-white border-primary/10 text-primary hover:bg-primary/5"
                                                                                )}
                                                                            >
                                                                                <Contact className="h-3.5 w-3.5" />
                                                                                <div className="text-left leading-none">
                                                                                    <p className="text-[10px] font-black uppercase tracking-tighter truncate max-w-[120px]">{sug.label}</p>
                                                                                    <p className="text-[8px] opacity-60 font-bold uppercase mt-0.5">{sug.source}</p>
                                                                                </div>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {searchResults.length > 0 && recipientSearchTerm && (
                                                                <div className="space-y-2 pt-2 border-t border-border/50">
                                                                    <p className="text-[8px] font-black uppercase tracking-widest text-primary ml-1">Network Search</p>
                                                                    <div className="space-y-1">
                                                                        {searchResults.map((res, i) => (
                                                                            <button
                                                                                key={i}
                                                                                type="button"
                                                                                onClick={() => { setValue('recipient', res.value); setRecipientSearchTerm(''); }}
                                                                                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-primary/10 transition-colors group"
                                                                            >
                                                                                <div className="flex items-center gap-3">
                                                                                    <Building className="h-3 w-3 text-muted-foreground opacity-40" />
                                                                                    <span className="text-xs font-bold text-foreground/80">{res.label}</span>
                                                                                </div>
                                                                                <Badge variant="outline" className="text-[8px] font-black uppercase text-primary border-primary/20 opacity-0 group-hover:opacity-100">{res.source}</Badge>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Schedule Delay (Optional)</Label>
                                                <Controller
                                                    name="isScheduled"
                                                    control={control}
                                                    render={({ field }) => (
                                                        <div className="flex items-center justify-between h-16 bg-muted/20 rounded-[1.25rem] px-6 shadow-inner">
                                                            <div className="flex items-center gap-3">
                                                                <CalendarClock className="h-5 w-5 text-muted-foreground" />
                                                                <span className="text-xs font-bold uppercase tracking-widest">Enable Scheduling</span>
                                                            </div>
                                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                        </div>
                                                    )}
                                                />
                                                {watchedIsScheduled && (
                                                    <Controller
                                                        name="scheduledAt"
                                                        control={control}
                                                        render={({ field }) => (
                                                            <DateTimePicker value={field.value} onChange={field.onChange} />
                                                        )}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-muted/10 p-6 rounded-[2rem] border border-border/50 shadow-inner">
                                            <div className="col-span-full flex items-center justify-between mb-2">
                                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Context Overrides</Label>
                                                <Badge variant="outline" className="text-[8px] font-black uppercase opacity-40">Auto-filled via binding</Badge>
                                            </div>
                                            {selectedTemplate?.variables.map(v => (
                                                <div key={v} className="space-y-2">
                                                    <Label className="text-[9px] font-black uppercase ml-1 text-muted-foreground">{v.replace(/_/g, ' ')}</Label>
                                                    <Controller
                                                        name={`variables.${v}`}
                                                        control={control}
                                                        render={({ field }) => <Input {...field} value={field.value ?? ''} className="bg-white border border-primary/10 h-11 rounded-xl shadow-sm focus-visible:ring-1 focus-visible:ring-primary/20 font-bold px-4" />}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
                                        {!csvData.length ? (
                                            <div className="p-16 border-4 border-dashed rounded-[4rem] flex flex-col items-center justify-center text-center gap-8 bg-muted/10 border-muted-foreground/10 hover:border-primary/30 transition-all duration-700">
                                                <Upload className="h-12 w-12 text-primary" />
                                                <input type="file" accept=".csv" className="hidden" id="csv-upload" onChange={handleCsvUpload} />
                                                <Button asChild variant="outline" className="rounded-2xl border-2 font-black h-16 px-16 uppercase tracking-widest text-xs">
                                                    <label htmlFor="csv-upload" className="cursor-pointer">Identify Data Stream (.CSV)</label>
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-8 animate-in zoom-in-95 duration-700">
                                                <div className="p-8 rounded-[2.5rem] bg-primary/5 border border-primary/10 shadow-inner space-y-8">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-primary text-white rounded-xl shadow-lg"><Layers className="h-4 w-4" /></div>
                                                            <Label className="text-sm font-black uppercase tracking-tight text-primary">Visual Data Mapper</Label>
                                                        </div>
                                                        <Badge className="bg-primary h-7 font-black uppercase text-[10px] px-4 rounded-xl shadow-lg">{csvData.length} Records</Badge>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                        {selectedTemplate?.variables.map(v => (
                                                            <div key={v} className="space-y-2">
                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                                    Map &#123;&#123;{v}&#125;&#125; to column:
                                                                </Label>
                                                                <Select value={columnMapping[v] || ''} onValueChange={(val) => setColumnMapping(prev => ({ ...prev, [v]: val }))}>
                                                                    <SelectTrigger className="h-12 rounded-xl bg-white border-primary/10 font-bold">
                                                                        <SelectValue placeholder="Select CSV column..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl">
                                                                        {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex justify-center">
                                                    <Button variant="ghost" onClick={() => setCsvData([])} className="text-destructive font-black uppercase text-[10px] tracking-[0.2em] gap-2">
                                                        <X className="h-4 w-4" /> Purge Repository
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="justify-between bg-muted/30 p-8 border-t">
                            <Button type="button" variant="ghost" onClick={handlePrev} className="font-black rounded-xl uppercase tracking-widest text-xs px-8 h-12 gap-2">
                                <ArrowLeft className="h-4 w-4" /> Back
                            </Button>
                            <Button type="button" onClick={handleNext} disabled={!getValues('senderProfileId') || (watchedMode === 'single' ? !getValues('recipient') : !csvData.length)} className="px-16 rounded-2xl font-black shadow-2xl h-16 uppercase tracking-[0.1em] active:scale-95 transition-all group">
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

                                    <div className="p-6 rounded-3xl border-2 border-blue-100 bg-blue-50/30 flex items-start gap-5 shadow-inner">
                                        <div className="p-2.5 bg-blue-100 rounded-xl text-blue-600 shadow-sm"><Info className="h-6 w-6" /></div>
                                        <div className="space-y-1.5">
                                            <p className="text-base font-black text-blue-900 uppercase tracking-tight leading-none mb-1">Operational Audit</p>
                                            <p className="text-[10px] text-blue-700 leading-relaxed font-bold uppercase tracking-[0.1em] opacity-80">
                                                This task will be logged for regulatory oversight. All dispatches use official organizational gateways.
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
                                        variables={{ ...getValues('variables'), ...(watchedMode === 'bulk' ? csvData[0] : {}) }} 
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="justify-between bg-muted/30 p-10 border-t">
                            <Button type="button" variant="ghost" onClick={handlePrev} disabled={isSubmitting} className="font-black rounded-xl uppercase tracking-widest text-xs px-8 h-12 gap-2">
                                <ArrowLeft className="h-4 w-4" /> Back
                            </Button>
                            <Button type="submit" size="lg" disabled={isSubmitting} className="px-20 font-black shadow-2xl h-20 gap-5 bg-primary text-white hover:bg-primary/90 rounded-[2rem] transition-all active:scale-95 text-xl uppercase tracking-[0.2em] shadow-primary/30">
                                {isSubmitting ? <Loader2 className="h-8 w-8 animate-spin" /> : <Sparkles className="h-8 w-8" />}
                                {watchedMode === 'single' ? 'Launch Dispatch' : 'Execute Broadcast'}
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 4 && (
                    <Card className="shadow-2xl border-none ring-1 ring-primary/20 rounded-[4rem] overflow-hidden bg-white">
                        <CardHeader className="text-center pb-12 pt-16 border-b bg-muted/30">
                            <div className="mx-auto bg-primary/10 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl shadow-primary/10">
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

                            {jobStatus === 'completed' && (
                                <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto">
                                    <div className="p-8 rounded-[3rem] bg-emerald-50 border-2 border-emerald-100 flex items-center gap-8 shadow-2xl shadow-emerald-500/10">
                                        <div className="bg-emerald-600 text-white p-5 rounded-[1.5rem] shadow-xl"><Check className="h-8 w-8" /></div>
                                        <div className="flex-1">
                                            <p className="font-black text-xl text-emerald-900 uppercase tracking-tight">Mission Success</p>
                                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest opacity-80 mt-1">Audit protocols successfully generated.</p>
                                        </div>
                                        <Button asChild className="rounded-2xl font-black h-14 px-10 shadow-xl bg-emerald-600 hover:bg-emerald-700 uppercase tracking-widest text-xs">
                                            <Link href="/admin/messaging">Acknowledge Hub</Link>
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </form>

            <QuickTemplateDialog 
                open={isQuickCreateOpen}
                onOpenChange={setIsQuickCreateOpen}
                channel={watchedChannel}
                category="general"
                onCreated={(id) => setValue('templateId', id, { shouldDirty: true })}
            />
        </div>
    );
}

function MessagePreviewer({ template, variables }: { template: MessageTemplate, variables: Record<string, any> }) {
    const combinedVars = { ...variables };
    if (variables.ai_refined_body) {
        return (
            <div className={cn(
                "rounded-[3rem] border-2 overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] transition-all duration-700 p-8",
                template.channel === 'email' ? "bg-white border-blue-50" : "bg-white border-slate-200"
            )}>
                <div className="flex items-center gap-2 mb-4 text-emerald-600">
                    <Wand2 className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">AI Polished Draft</span>
                </div>
                <div className={cn("whitespace-pre-wrap font-medium leading-relaxed", template.channel === 'sms' ? "text-slate-900 text-sm" : "text-slate-700 prose prose-sm max-w-none")} dangerouslySetInnerHTML={{ __html: resolveVariables(variables.ai_refined_body, combinedVars) }} />
            </div>
        );
    }

    const resolvedBody = template.blocks?.length 
        ? renderBlocksToHtml(template.blocks, combinedVars)
        : resolveVariables(template.body, combinedVars);

    return (
        <div className={cn(
            "rounded-[3rem] border-2 overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] transition-all duration-700",
            template.channel === 'email' ? "bg-white border-blue-50" : "bg-slate-50 border-slate-200 max-w-sm mx-auto"
        )}>
            {template.channel === 'email' ? (
                <div className="flex flex-col h-[450px]">
                    <div className="p-8 border-b bg-muted/20 space-y-2 shrink-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">Inbox Perspective</p>
                        <p className="font-black text-lg truncate text-foreground">{resolveVariables(template.subject || '', combinedVars) || '(No Subject)'}</p>
                    </div>
                    <div className="flex-1 overflow-auto p-10 bg-white relative">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-purple-500 opacity-20" />
                        <div className="whitespace-pre-wrap font-medium leading-relaxed text-slate-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: resolvedBody }} />
                    </div>
                </div>
            ) : (
                <div className="p-10 space-y-8">
                    <div className="flex items-center justify-between">
                        <SmartSappIcon className="h-8 w-8 text-primary opacity-20" />
                        <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em]">SMS Gateway Simulator</p>
                    </div>
                    <div className="p-6 bg-white border border-slate-200 rounded-[2rem] relative shadow-xl">
                        <div className="absolute -left-2.5 top-8 w-5 h-5 bg-white border-l border-b border-slate-200 rotate-45 rounded-sm" />
                        <p className="text-sm text-slate-900 leading-relaxed font-bold whitespace-pre-wrap">{resolvedBody}</p>
                    </div>
                    <div className="pt-6 text-center border-t border-slate-200">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">~ {Math.ceil(resolvedBody.length / 160)} SMS Segment(s)</span>
                    </div>
                </div>
            )}
        </div>
    );
}
