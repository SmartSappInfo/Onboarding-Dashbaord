
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
    Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { SmartSappIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

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
            toast({ title: 'CSV Processed', description: `${data.length} records identified.` });
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
                "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                step > num ? "bg-primary border-primary text-white" : step === num ? "border-primary text-primary" : "border-muted-foreground"
            )}>
                {step > num ? <Check className="w-3 h-3" /> : num}
            </div>
            {label}
        </div>
    );

    const isOutOfCredits = watchedChannel === 'sms' && smsBalance !== null && smsBalance <= 0;

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
                    <Card className="shadow-xl">
                        <CardHeader>
                            <CardTitle>Select Template</CardTitle>
                            <CardDescription>Choose the channel and the pre-defined message structure.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">1. Choose Channel</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Button 
                                            type="button" 
                                            variant={watchedChannel === 'email' ? 'default' : 'outline'} 
                                            className="h-20 flex-col gap-2 rounded-2xl"
                                            onClick={() => setValue('channel', 'email')}
                                        >
                                            <Mail className="h-6 w-6" />
                                            <span>Email</span>
                                        </Button>
                                        <Button 
                                            type="button" 
                                            variant={watchedChannel === 'sms' ? 'default' : 'outline'} 
                                            className="h-20 flex-col gap-2 rounded-2xl"
                                            onClick={() => setValue('channel', 'sms')}
                                        >
                                            <Smartphone className="h-6 w-6" />
                                            <span>SMS</span>
                                        </Button>
                                    </div>
                                    {watchedChannel === 'sms' && (
                                        <div className="flex items-center justify-between px-2 text-[10px] font-black uppercase tracking-tighter">
                                            <span className="text-muted-foreground">Current Balance</span>
                                            <span className={cn("flex items-center gap-1.5", smsBalance !== null && smsBalance < 10 ? "text-red-500 animate-pulse" : "text-emerald-600")}>
                                                <Wallet className="h-3 w-3" />
                                                {smsBalance !== null ? `${smsBalance} Credits` : 'Loading...'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">2. Select Template</Label>
                                    <Controller
                                        name="templateId"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger className="h-12 rounded-xl">
                                                    <SelectValue placeholder="Choose a template..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    {isLoadingTemplates ? (
                                                        <div className="p-4 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                                                    ) : templates?.map(t => (
                                                        <SelectItem key={t.id} value={t.id}>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="text-[8px] uppercase">{t.category}</Badge>
                                                                {t.name}
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
                                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Template Variables Detected</Label>
                                        <Badge className="bg-primary text-white border-none text-[8px] uppercase">{selectedTemplate.variables.length} Required</Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedTemplate.variables.map(v => (
                                            <code key={v} className="bg-white px-2 py-1 rounded border text-[10px] font-bold text-primary">{"{{" + v + "}}"}</code>
                                        ))}
                                        {selectedTemplate.variables.length === 0 && <p className="text-xs italic text-muted-foreground">No variables in this template.</p>}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="justify-end bg-muted/30 pt-6">
                            <Button type="button" variant="outline" size="lg" onClick={handleNext} disabled={!watchedTemplateId} className="px-10 rounded-xl font-bold border-2">
                                Next Step <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 2 && (
                    <Card className="shadow-xl">
                        <CardHeader>
                            <CardTitle>Recipients & Timing</CardTitle>
                            <CardDescription>Configure who receives the message and when it should be delivered.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">3. Sender Profile</Label>
                                    <Controller
                                        name="senderProfileId"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger className="h-12 rounded-xl">
                                                    <SelectValue placeholder="Choose sender..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    {isLoadingProfiles ? (
                                                        <div className="p-4 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                                                    ) : profiles?.map(p => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold">{p.name}</span>
                                                                <span className="text-[10px] text-muted-foreground">({p.identifier})</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">4. Delivery Mode</Label>
                                    <div className="grid grid-cols-2 gap-2 bg-muted p-1 rounded-xl">
                                        <Button 
                                            type="button" 
                                            variant={watchedMode === 'single' ? 'secondary' : 'ghost'} 
                                            className={cn("h-10 rounded-lg", watchedMode === 'single' && "bg-background shadow-sm")}
                                            onClick={() => setValue('mode', 'single')}
                                        >
                                            <User className="mr-2 h-4 w-4" /> Single
                                        </Button>
                                        <Button 
                                            type="button" 
                                            variant={watchedMode === 'bulk' ? 'secondary' : 'ghost'} 
                                            className={cn("h-10 rounded-lg", watchedMode === 'bulk' && "bg-background shadow-sm")}
                                            onClick={() => setValue('mode', 'bulk')}
                                        >
                                            <Users className="mr-2 h-4 w-4" /> Bulk
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-6 rounded-2xl border-2 border-primary/10 bg-primary/5 space-y-4 transition-all">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("p-2 rounded-xl transition-colors", watchedIsScheduled ? "bg-primary text-white shadow-lg" : "bg-muted text-muted-foreground")}>
                                                <CalendarClock className="h-5 w-5" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <Label className="text-sm font-black uppercase tracking-tight">Schedule for Later</Label>
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Queue for future delivery</p>
                                            </div>
                                        </div>
                                        <Controller
                                            name="isScheduled"
                                            control={control}
                                            render={({ field }) => (
                                                <Switch 
                                                    checked={field.value} 
                                                    onCheckedChange={field.onChange} 
                                                    className="scale-110"
                                                />
                                            )}
                                        />
                                    </div>
                                    
                                    {watchedIsScheduled && (
                                        <div className="pt-4 border-t border-primary/10 animate-in fade-in slide-in-from-top-2">
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

                                <div className="p-6 rounded-2xl border-2 border-muted bg-muted/10 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-muted text-muted-foreground">
                                            <Building className="h-5 w-5" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-black uppercase tracking-tight">School Context</Label>
                                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Auto-fill variables from school data</p>
                                        </div>
                                    </div>
                                    <Controller
                                        name="schoolId"
                                        control={control}
                                        render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                <SelectTrigger className="h-11 rounded-xl bg-background">
                                                    <SelectValue placeholder="Select a school..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="none">No School Context</SelectItem>
                                                    {schools?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-6">
                                {watchedMode === 'single' ? (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Recipient Identity</Label>
                                        <Controller
                                            name="recipient"
                                            control={control}
                                            render={({ field }) => (
                                                <Input 
                                                    {...field} 
                                                    placeholder={watchedChannel === 'email' ? 'parent@example.com' : '+233 XX XXX XXXX'} 
                                                    className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"
                                                />
                                            )}
                                        />
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                            {selectedTemplate?.variables.map(v => (
                                                <div key={v} className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold uppercase ml-1 text-muted-foreground">{v.replace(/_/g, ' ')}</Label>
                                                    <Controller
                                                        name={`variables.${v}`}
                                                        control={control}
                                                        render={({ field }) => (
                                                            <Input {...field} value={field.value || ''} placeholder={`Enter ${v.replace(/_/g, ' ')}...`} className="bg-muted/30 border-none h-10 rounded-lg shadow-inner focus-visible:ring-1 focus-visible:ring-primary/20" />
                                                        )}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                                        <div className="p-8 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center gap-4 bg-muted/20 border-border/50 hover:border-primary/30 transition-colors">
                                            <div className="p-4 bg-primary/10 rounded-full text-primary shadow-xl">
                                                <Upload className="h-8 w-8" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-lg">Upload Recipient List (CSV)</p>
                                                <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">Map your spreadsheet columns directly to template variables.</p>
                                            </div>
                                            <Input type="file" accept=".csv" className="hidden" id="csv-upload" onChange={handleCsvUpload} />
                                            <Button asChild variant="outline" className="rounded-xl border-2 font-bold h-11 px-8 hover:bg-background">
                                                <label htmlFor="csv-upload">Select File</label>
                                            </Button>
                                        </div>

                                        {csvData.length > 0 && (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Data Audit (Top 3 Records)</Label>
                                                    <Button variant="ghost" size="sm" onClick={() => setCsvData([])} className="h-7 text-[10px] text-destructive uppercase font-bold">Clear List</Button>
                                                </div>
                                                <div className="rounded-xl border bg-background overflow-hidden overflow-x-auto shadow-sm">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-muted/50 border-b">
                                                            <tr>
                                                                {csvHeaders.slice(0, 5).map(h => <th key={h} className="p-3 text-left font-black uppercase text-[9px] tracking-tighter">{h}</th>)}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {csvData.slice(0, 3).map((row, i) => (
                                                                <tr key={i} className="border-b last:border-0">
                                                                    {csvHeaders.slice(0, 5).map(h => <td key={h} className="p-3 font-medium text-muted-foreground truncate max-w-[150px]">{row[h]}</td>)}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <p className="text-[10px] italic text-muted-foreground text-center">+ {csvData.length - 3} more records successfully identified.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="justify-between bg-muted/30 pt-6">
                            <Button type="button" variant="ghost" onClick={handlePrev} className="font-bold">Previous</Button>
                            <Button type="button" onClick={handleNext} disabled={!getValues('senderProfileId') || (watchedMode === 'single' ? !getValues('recipient') : csvData.length === 0)} className="px-10 rounded-xl font-bold border-2">
                                Review & Preview <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 3 && (
                    <Card className="shadow-xl">
                        <CardHeader>
                            <CardTitle>Final Review</CardTitle>
                            <CardDescription>Preview your message and confirm delivery details.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">From</Label>
                                            <p className="font-bold">{profiles?.find(p => p.id === getValues('senderProfileId'))?.name}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Timing</Label>
                                            <p className={cn("font-bold capitalize", watchedIsScheduled && "text-primary flex items-center gap-1.5")}>
                                                {watchedIsScheduled ? <CalendarClock className="h-3 w-3" /> : null}
                                                {watchedIsScheduled ? 'Scheduled' : 'Immediate'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Recipients</Label>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="font-bold bg-background">
                                                {watchedMode === 'single' ? '1 Recipient' : `${csvData.length} Recipients`}
                                            </Badge>
                                            {watchedMode === 'single' && <span className="text-xs font-mono text-muted-foreground">{getValues('recipient')}</span>}
                                        </div>
                                    </div>
                                    
                                    {isOutOfCredits && (
                                        <div className="p-4 rounded-xl border-2 border-destructive/20 bg-destructive/5 flex items-start gap-3">
                                            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                                            <div className="space-y-1">
                                                <p className="text-xs font-black uppercase tracking-widest text-destructive">Insufficient Balance</p>
                                                <p className="text-[10px] text-destructive/80 leading-relaxed font-medium">
                                                    Your SMS credit balance is zero. Please top up your mNotify account to continue sending communications.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-4 rounded-xl border bg-blue-50/50 border-blue-200 flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold text-blue-800 uppercase tracking-tighter">System Compliance</p>
                                            <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
                                                SmartSapp audit logs will capture this dispatch. Ensure all recipients have explicitly opted in to receive {watchedChannel} communications.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                        <Eye className="h-3 w-3" /> Live Message Preview
                                    </Label>
                                    <MessagePreviewer 
                                        template={selectedTemplate!} 
                                        variables={getValues('variables')} 
                                        sampleRow={watchedMode === 'bulk' ? csvData[0] : null}
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="justify-between bg-muted/30 pt-6">
                            <Button type="button" variant="ghost" onClick={handlePrev} disabled={isSubmitting} className="font-bold">Previous</Button>
                            <Button type="submit" size="lg" disabled={isSubmitting || isOutOfCredits} className="px-12 font-black shadow-xl h-14 gap-3 bg-primary text-white hover:bg-primary/90 rounded-2xl transition-all active:scale-95">
                                {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
                                {watchedMode === 'single' ? (watchedIsScheduled ? 'Schedule Message' : 'Send Message Now') : `Start Bulk Dispatch`}
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 4 && (
                    <Card className="shadow-2xl border-primary/20">
                        <CardHeader className="text-center pb-8 border-b bg-muted/30">
                            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                                {jobStatus === 'processing' ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Check className="h-8 w-8 text-green-600" />}
                            </div>
                            <CardTitle className="text-2xl font-black tracking-tight">Bulk Dispatch In Progress</CardTitle>
                            <CardDescription>Communicating with {csvData.length} recipients. Stay on this page.</CardDescription>
                        </CardHeader>
                        <CardContent className="py-12 space-y-10">
                            <div className="space-y-4 max-w-lg mx-auto">
                                <div className="flex justify-between items-end mb-2">
                                    <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Overall Progress</p>
                                    <p className="text-2xl font-black tabular-nums">{jobProgress}%</p>
                                </div>
                                <Progress value={jobProgress} className="h-4 rounded-full" />
                            </div>

                            <div className="grid grid-cols-2 gap-6 max-w-sm mx-auto">
                                <div className="p-6 rounded-2xl bg-slate-50 border text-center space-y-1 shadow-sm">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-2">Processed</p>
                                    <p className="text-3xl font-black">{Math.round((jobProgress/100) * csvData.length)}</p>
                                </div>
                                <div className="p-6 rounded-2xl bg-slate-50 border text-center space-y-1 shadow-sm">
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-2">Total</p>
                                    <p className="text-3xl font-black">{csvData.length}</p>
                                </div>
                            </div>

                            {jobStatus === 'completed' && (
                                <div className="max-w-md mx-auto animate-in zoom-in-95 duration-500">
                                    <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-4">
                                        <div className="bg-green-600 text-white p-2 rounded-lg"><Check className="h-5 w-5" /></div>
                                        <p className="text-sm font-bold text-green-800">Job Finished Successfully!</p>
                                        <Button asChild size="sm" variant="outline" className="ml-auto bg-white border-green-200">
                                            <Link href="/admin/messaging">Done</Link>
                                        </Button>
                                    </div>
                                </div>
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
            "rounded-2xl border-2 overflow-hidden shadow-2xl transition-all",
            template.channel === 'email' ? "bg-white" : "bg-[#0A1427] max-w-sm mx-auto"
        )}>
            {template.channel === 'email' ? (
                <div className="flex flex-col h-96">
                    <div className="p-4 border-b bg-muted/20 space-y-1.5 shrink-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subject Preview</p>
                        <p className="font-bold text-sm truncate">{resolvedSubject || '(No Subject)'}</p>
                    </div>
                    <div className="flex-1 overflow-auto p-6 bg-white relative">
                        <div className="prose prose-sm max-w-none italic text-muted-foreground/60 mb-4 text-[10px] text-center border-b pb-2">
                            Visual Style wrapper applied during dispatch.
                        </div>
                        <div className="whitespace-pre-wrap font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: resolvedBody }} />
                    </div>
                </div>
            ) : (
                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <SmartSappIcon className="h-6 w-6 text-white opacity-20" />
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">SMS Preview</p>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl relative shadow-inner">
                        <div className="absolute -left-2 top-4 w-4 h-4 bg-[#1a243a] border-l border-b border-white/10 rotate-45 rounded-sm" />
                        <p className="text-sm text-white/90 leading-relaxed font-medium whitespace-pre-wrap">{resolvedBody}</p>
                    </div>
                    <div className="pt-2 flex justify-between items-center text-[9px] font-bold uppercase tracking-tighter text-white/30">
                        <span>Characters: {resolvedBody.length}</span>
                        <span>Estimated: {Math.ceil(resolvedBody.length / 160)} SMS</span>
                    </div>
                </div>
            )}
        </div>
    );
}
