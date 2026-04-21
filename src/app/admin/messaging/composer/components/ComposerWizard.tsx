'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { MessageTemplate, SenderProfile, Meeting, Survey, PDFForm, SurveyResponse, Submission, ResolvedContact } from '@/lib/types';
import { sendMessage } from '@/lib/messaging-engine';
import { resolveVariables, renderBlocksToHtml } from '@/lib/messaging-utils';
import { createBulkMessageJob, processBulkJobChunk } from '@/lib/bulk-messaging';
import { type ScheduleMessageResult } from '@/lib/sequential-scheduler';
import { fetchSmsBalanceAction } from '@/lib/mnotify-actions';
import { fetchContextualData, resolveRecipientContacts } from '@/lib/messaging-actions';
import { refineMessage } from '@/ai/flows/refine-message-flow';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import {
    Check, ChevronRight, Smartphone, Mail, Users, Upload, Loader2, Sparkles, Eye,
    X, AlertCircle, Info, CalendarClock, Building, Trophy, TrendingUp, Zap,
    CheckCircle2, Target, Layers, Wand2, ArrowLeft, FileText, ClipboardList,
    Calendar, Database, PlusCircle, FlaskConical, Tag, Send, Settings2,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { SmartSappIcon } from '@/components/icons';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
    AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import QuickTemplateDialog from '../../components/quick-template-dialog';
import TestDispatchDialog from '../../components/TestDispatchDialog';
import { TagAudienceSelector, type TagSegment } from './TagAudienceSelector';
import { EntitySelector } from './EntitySelector';
import { cn } from '@/lib/utils';

// ─── Schema ───────────────────────────────────────────────────────────────────
const formSchema = z.object({
    // Step 1 – Message Type
    channel: z.enum(['email', 'sms']),
    messageSourceType: z.enum(['template', 'new']).default('template'),
    templateId: z.string().optional(),
    senderProfileId: z.string().optional(),
    // Step 3 – Audience
    mode: z.enum(['single', 'bulk']).default('single'),
    selectedEntityIds: z.array(z.string()).default([]),
    contactScope: z.enum(['primary', 'signatories', 'all']).default('primary'),
    contactTypeFilter: z.string().optional().nullable(),
    tagSegmentInclude: z.array(z.string()).default([]),
    tagSegmentExclude: z.array(z.string()).default([]),
    tagSegmentLogic: z.enum(['AND', 'OR']).default('OR'),
    entityId: z.string().optional(),
    // Step 4 – Tagging & Automations
    applyTagIds: z.array(z.string()).default([]),
    triggerAutomationIds: z.array(z.string()).default([]),
    // Step 5 – Publish
    isScheduled: z.boolean().default(false),
    scheduledAt: z.date().optional(),
    // Variables & bindings
    variables: z.record(z.any()).default({}),
    sourceMeetingId: z.string().optional(),
    sourceSurveyId: z.string().optional(),
    sourceResponseId: z.string().optional(),
    sourcePdfId: z.string().optional(),
    sourceSubmissionId: z.string().optional(),
    // CSV bulk
    recipient: z.string().optional(),
    selectedContacts: z.array(z.string()).default([]),
});

type FormData = z.infer<typeof formSchema>;

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS = [
    { n: 1, label: 'Message Type',   icon: Mail },
    { n: 2, label: 'Builder',        icon: Wand2 },
    { n: 3, label: 'Audience',       icon: Users },
    { n: 4, label: 'Tags & Actions', icon: Tag },
    { n: 5, label: 'Publish',        icon: Send },
] as const;

// ─── Sub-components (extracted for stability) ─────────────────────────────────

const Stepper = ({ currentStep, onStepClick }: { currentStep: number; onStepClick: (n: number) => void }) => (
    <div className="flex items-center justify-center gap-0 mb-10">
        {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = currentStep === s.n;
            const isDone = currentStep > s.n;
            return (
                <React.Fragment key={s.n}>
                    <button
                        type="button"
                        onClick={() => isDone && onStepClick(s.n)}
                        className={cn('flex flex-col items-center gap-1.5 outline-none group', isDone && 'cursor-pointer')}
                    >
                        <div className={cn(
                            'w-9 h-9 rounded-2xl border-2 flex items-center justify-center transition-all duration-300',
                            isDone  ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' :
                            isActive ? 'border-primary text-primary bg-primary/10 shadow-lg shadow-primary/10 scale-110' :
                                       'border-border text-muted-foreground',
                        )}>
                            {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                        </div>
                        <span className={cn('text-[9px] font-bold uppercase tracking-widest transition-colors hidden sm:block',
                            isActive || isDone ? 'text-primary' : 'text-muted-foreground opacity-50'
                        )}>{s.label}</span>
                    </button>
                    {idx < STEPS.length - 1 && (
                        <div className="flex-1 mx-2 h-[2px] bg-border rounded-full overflow-hidden max-w-[60px]">
                            <div className={cn('h-full bg-primary transition-all duration-500', isDone ? 'w-full' : 'w-0')} />
                        </div>
                    )}
                </React.Fragment>
            );
        })}
    </div>
);

const NavFooter = ({ 
    onNext, 
    onBack,
    nextLabel = 'Continue', 
    nextDisabled = false, 
    showBack = true,
    isSubmitting = false
}: {
    onNext?: () => void; 
    onBack: () => void;
    nextLabel?: string; 
    nextDisabled?: boolean; 
    showBack?: boolean;
    isSubmitting?: boolean;
}) => (
    <CardFooter className="justify-between bg-muted/20 p-6 border-t gap-4">
        {showBack ? (
            <Button type="button" variant="ghost" onClick={onBack} className="gap-2 font-semibold text-xs h-11 px-6 rounded-xl">
                <ArrowLeft className="h-4 w-4" /> Back
            </Button>
        ) : <div />}
        <Button
            type={onNext ? 'button' : 'submit'}
            onClick={onNext}
            disabled={nextDisabled || isSubmitting}
            className="gap-2 font-semibold h-12 px-10 rounded-2xl shadow-lg active:scale-95 transition-all"
        >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {nextLabel} <ChevronRight className="h-4 w-4" />
        </Button>
    </CardFooter>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ComposerWizard() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { activeWorkspace, activeWorkspaceId, activeOrganizationId } = useWorkspace() as any;
    const { toast } = useToast();
    const searchParams = useSearchParams();

    const [step, setStep] = React.useState(1);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isQuickCreateOpen, setIsQuickCreateOpen] = React.useState(false);
    const [isTestModalOpen, setIsTestModalOpen] = React.useState(false);
    const [isRefining, setIsRefining] = React.useState(false);
    const [selectedTone, setSelectedTone] = React.useState<'formal'|'friendly'|'urgent'|'concise'>('formal');
    const [csvData, setCsvData] = React.useState<any[]>([]);
    const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
    const [columnMapping, setColumnMapping] = React.useState<Record<string, string>>({});
    const [tagSegment, setTagSegment] = React.useState<TagSegment>({ includeTagIds: [], excludeTagIds: [], includeLogic: 'OR' });
    const [smsBalance, setSmsBalance] = React.useState<number | null>(null);
    const [sendProgress, setSendProgress] = React.useState({ sent: 0, total: 0, currentEntity: '' });
    const [isSending, setIsSending] = React.useState(false);
    const [sendSummary, setSendSummary] = React.useState<ScheduleMessageResult | null>(null);
    const [showSummaryDialog, setShowSummaryDialog] = React.useState(false);
    const [sampleVariables, setSampleVariables] = React.useState<Record<string, any>>({});
    const [jobProgress, setJobProgress] = React.useState(0);
    const [jobStatus, setJobStatus] = React.useState<string | null>(null);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            channel: 'email', messageSourceType: 'template', mode: 'single',
            selectedEntityIds: [], contactScope: 'primary', entityId: '',
            isScheduled: false, variables: {}, applyTagIds: [], triggerAutomationIds: [],
            tagSegmentInclude: [], tagSegmentExclude: [], tagSegmentLogic: 'OR',
            selectedContacts: [],
        },
    });

    const { watch, setValue, getValues, control } = form;
    const watchedChannel = watch('channel');
    const watchedTemplateId = watch('templateId');
    const watchedMode = watch('mode');
    const watchedIsScheduled = watch('isScheduled');
    const watchedSelectedEntityIds = watch('selectedEntityIds');
    const watchedContactScope = watch('contactScope');
    const watchedContactTypeFilter = watch('contactTypeFilter');
    const watchedSourceMeetingId = watch('sourceMeetingId');
    const watchedSourceSurveyId = watch('sourceSurveyId');
    const watchedSourceResponseId = watch('sourceResponseId');
    const watchedSourcePdfId = watch('sourcePdfId');
    const watchedSourceSubmissionId = watch('sourceSubmissionId');

    // ── Firestore queries ──────────────────────────────────────────────────────
    const templatesQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'message_templates'), where('isActive', '==', true), where('channel', '==', watchedChannel)) : null,
    [firestore, watchedChannel]);

    const profilesQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'sender_profiles'), where('isActive', '==', true), where('channel', '==', watchedChannel)) : null,
    [firestore, watchedChannel]);

    const meetingsQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'meetings'), orderBy('meetingTime', 'desc')) : null,
    [firestore]);

    const surveysQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'surveys'), where('status', '==', 'published')) : null,
    [firestore]);

    const pdfsQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'pdfs'), where('status', '==', 'published')) : null,
    [firestore]);

    const responsesQuery = useMemoFirebase(() =>
        firestore && watchedSourceSurveyId
            ? query(collection(firestore, `surveys/${watchedSourceSurveyId}/responses`), orderBy('submittedAt', 'desc'), limit(50))
            : null,
    [firestore, watchedSourceSurveyId]);

    const submissionsQuery = useMemoFirebase(() =>
        firestore && watchedSourcePdfId
            ? query(collection(firestore, `pdfs/${watchedSourcePdfId}/submissions`), orderBy('submittedAt', 'desc'), limit(50))
            : null,
    [firestore, watchedSourcePdfId]);

    const { data: templates, isLoading: isLoadingTemplates } = useCollection<MessageTemplate>(templatesQuery);
    const { data: profiles } = useCollection<SenderProfile>(profilesQuery);
    const { data: meetings } = useCollection<Meeting>(meetingsQuery);
    const { data: surveys } = useCollection<Survey>(surveysQuery);
    const { data: pdfs } = useCollection<PDFForm>(pdfsQuery);
    const { data: responses } = useCollection<SurveyResponse>(responsesQuery);
    const { data: submissions } = useCollection<Submission>(submissionsQuery);

    const weQuery = useMemoFirebase(() =>
        firestore && activeWorkspaceId
            ? query(collection(firestore, 'workspace_entities'), where('workspaceId', '==', activeWorkspaceId))
            : null,
    [firestore, activeWorkspaceId]);
    const { data: weRaw, isLoading: isLoadingWE } = useCollection<any>(weQuery);

    const entitiesQuery = useMemoFirebase(() =>
        firestore && activeOrganizationId
            ? query(collection(firestore, 'entities'), where('organizationId', '==', activeOrganizationId))
            : null,
    [firestore, activeOrganizationId]);
    const { data: entitiesRaw, isLoading: isLoadingEntities } = useCollection<any>(entitiesQuery);

    const workspaceEntities = React.useMemo(() => {
        const entities = entitiesRaw || [];
        const weItems = weRaw || [];
        
        const entitiesMap = new Map<string, any>();
        entities.forEach(e => entitiesMap.set(e.id, e));

        const weMap = new Map<string, any>();
        weItems.forEach(we => {
            if (we.entityId) weMap.set(we.entityId, we);
        });

        // Collect all unique entity IDs from both collections
        const allIds = new Set([
            ...entities.map(e => e.id),
            ...weItems.map(we => we.entityId).filter(Boolean) as string[]
        ]);

        return Array.from(allIds).map(id => {
            const entity = entitiesMap.get(id);
            const we = weMap.get(id);
            
            // Extract contacts, supporting both modern and legacy shapes
            const rawContacts = entity?.entityContacts || entity?.contacts || we?.entityContacts || we?.contacts || [];
            const sanitizedContacts = Array.isArray(rawContacts) ? rawContacts.map((c: any, i: number) => ({
                id: c.id || `c-${id}-${i}`,
                name: c.name || c.displayName || 'Unknown Contact',
                email: c.email,
                phone: c.phone || c.phoneNumber,
                typeKey: c.typeKey || c.role || 'other',
                typeLabel: c.typeLabel || c.roleLabel || c.type || 'Contact',
                isPrimary: !!c.isPrimary,
                isSignatory: !!c.isSignatory,
                order: c.order ?? i
            })) : [];

            return {
                id: id,
                entityId: id,
                workspaceEntityId: we?.id,
                name: we?.displayName || entity?.name || 'Unnamed Record',
                logoUrl: entity?.institutionData?.logoUrl || entity?.logoUrl || we?.logoUrl,
                entityType: we?.entityType || entity?.entityType || 'institution',
                workspaceTags: we?.workspaceTags || [],
                status: we?.status || entity?.status || 'active',
                entityContacts: sanitizedContacts,
                migrationStatus: 'migrated' as const,
            };
        });
    }, [weRaw, entitiesRaw]);

    const isCombinedLoading = isLoadingEntities || isLoadingWE;

    const selectedTemplate = React.useMemo(() => templates?.find(t => t.id === watchedTemplateId), [templates, watchedTemplateId]);

    // ── Effects ────────────────────────────────────────────────────────────────
    React.useEffect(() => {
        fetchSmsBalanceAction().then(r => { if (r.success) setSmsBalance(r.balance ?? 0); });
    }, []);

    React.useEffect(() => {
        if (!searchParams) return;
        const r = searchParams.get('recipient');
        if (r) setValue('recipient', r);
    }, [searchParams, setValue]);

    React.useEffect(() => {
        if (!watchedSourceMeetingId) return;
        fetchContextualData('Meeting', watchedSourceMeetingId).then(res => {
            if (res.success && res.data) {
                setValue('variables.meeting_time', format(new Date(res.data.meetingTime), 'PPP p'));
                setValue('variables.meeting_link', res.data.meetingLink);
                setValue('variables.meeting_type', res.data.type?.name || '');
            }
        });
    }, [watchedSourceMeetingId, setValue]);

    React.useEffect(() => {
        if (!watchedSourceResponseId || !watchedSourceSurveyId) return;
        fetchContextualData('SurveyResponse', watchedSourceResponseId, watchedSourceSurveyId).then(res => {
            if (res.success && res.data) {
                setValue('variables.score', res.data.score || 0);
                res.data.answers?.forEach((a: any) => setValue(`variables.${a.questionId}`, typeof a.value === 'object' ? JSON.stringify(a.value) : String(a.value)));
            }
        });
    }, [watchedSourceResponseId, watchedSourceSurveyId, setValue]);

    React.useEffect(() => {
        if (!watchedSourceSubmissionId || !watchedSourcePdfId) return;
        fetchContextualData('Submission', watchedSourceSubmissionId, watchedSourcePdfId).then(res => {
            if (res.success && res.data) {
                Object.entries(res.data.formData || {}).forEach(([k, v]) => setValue(`variables.${k}`, String(v)));
            }
        });
    }, [watchedSourceSubmissionId, watchedSourcePdfId, setValue]);

    // Sample variables for preview (step 5)
    React.useEffect(() => {
        if (step !== 5 || watchedSelectedEntityIds.length === 0) return;
        fetchContextualData('Entity', watchedSelectedEntityIds[0], undefined, activeWorkspace?.id).then(res => {
            if (res.success && res.data) {
                const contacts = res.data.entityContacts || [];
                const primary = contacts.find((c: any) => c.isPrimary) || contacts[0];
                const contactName = primary?.name || res.data.displayName || '';
                setSampleVariables({
                    name: res.data.displayName || res.data.name,
                    school_name: res.data.displayName || res.data.name,
                    email: res.data.primaryEmail || primary?.email || '',
                    phone: res.data.primaryPhone || primary?.phone || '',
                    contact_name: contactName,
                    first_name: (contactName || '').split(' ')[0],
                });
            }
        });
    }, [step, watchedSelectedEntityIds, activeWorkspace?.id]);

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const rows = text.split('\n').filter(r => r.trim());
            if (rows.length < 2) { toast({ variant: 'destructive', title: 'Invalid CSV' }); return; }
            const headers = rows[0].split(',').map(h => h.trim());
            const data = rows.slice(1).map(row => {
                const vals = row.split(',').map(v => v.trim());
                return headers.reduce((o, h, i) => { o[h] = vals[i]; return o; }, {} as any);
            });
            setCsvHeaders(headers); setCsvData(data);
            const mapping: Record<string, string> = {};
            selectedTemplate?.variables.forEach(v => {
                const m = headers.find(h => h.toLowerCase() === v.toLowerCase());
                if (m) mapping[v] = m;
            });
            setColumnMapping(mapping);
            toast({ title: 'CSV Processed', description: `${data.length} records loaded.` });
        };
        reader.readAsText(file);
    };

    const handleAiRefine = async () => {
        if (!selectedTemplate || isRefining) return;
        setIsRefining(true);
        try {
            const result = await refineMessage({ text: selectedTemplate.body, tone: selectedTone, channel: watchedChannel });
            setValue('variables.ai_refined_body', result.refinedText);
            toast({ title: 'AI Refinement Applied' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Refinement Failed', description: e.message });
        } finally { setIsRefining(false); }
    };

    const startJobProcessing = async (id: string) => {
        setJobStatus('processing');
        let done = false;
        while (!done) {
            try {
                const r = await processBulkJobChunk(id);
                setJobProgress(r.progress); setJobStatus(r.status);
                if (r.status === 'completed' || r.status === 'failed') done = true;
                await new Promise(r => setTimeout(r, 1000));
            } catch { setJobStatus('failed'); done = true; }
        }
    };

    const onSubmit = async (data: FormData) => {
        if (!user) return;

        // GUARD: Only allow actual submission on Step 5
        if (step < 5) {
            // Check if we can progress (logic similar to NavFooter)
            if (step === 1) setStep(2);
            else if (step === 2 && data.messageSourceType === 'template' && !data.templateId) return; // Wait for template
            else if (step === 2) setStep(3);
            else if (step === 3 && data.mode === 'single' && data.selectedEntityIds.length === 0 && tagSegment.includeTagIds.length === 0) return; // Wait for selection
            else if (step === 3) setStep(4);
            else if (step === 4) setStep(5);
            return;
        }

        setIsSubmitting(true);
        const scheduledAt = data.isScheduled ? data.scheduledAt?.toISOString() : undefined;
        try {
            if (data.mode === 'single') {
                if (!data.selectedEntityIds.length) throw new Error('Please select at least one recipient.');
                setIsSending(true);
                setSendProgress({ sent: 0, total: data.selectedEntityIds.length, currentEntity: '' });
                const results: any = { success: true, totalSent: 0, totalFailed: 0, failedEntities: [], logIds: [] };
                for (let i = 0; i < data.selectedEntityIds.length; i++) {
                    const entityId = data.selectedEntityIds[i];
                    setSendProgress(p => ({ ...p, currentEntity: entityId }));
                    try {
                        const recipients = await resolveRecipientContacts({
                            entityId, workspaceId: activeWorkspace?.id,
                            contactScope: data.contactScope,
                            contactTypeFilter: data.contactTypeFilter ?? null,
                            channel: data.channel,
                        });
                        if (!recipients.length) { results.totalFailed++; results.failedEntities.push({ entityId, error: 'No contacts for scope/channel.' }); continue; }
                        for (const recipient of recipients) {
                            const res = await sendMessage({
                                templateId: data.templateId!, senderProfileId: data.senderProfileId!,
                                recipient, variables: { ...data.variables, channel: data.channel },
                                workspaceId: activeWorkspace?.id, scheduledAt, entityId,
                            });
                            if (res.success) { results.totalSent++; if (res.logId) results.logIds.push(res.logId); }
                            else { results.totalFailed++; results.failedEntities.push({ entityId: `${entityId} (${recipient})`, error: res.error || 'Unknown' }); }
                        }
                    } catch (e: any) { results.totalFailed++; results.failedEntities.push({ entityId, error: e.message }); }
                    setSendProgress(p => ({ ...p, sent: i + 1 }));
                    if (i < data.selectedEntityIds.length - 1) await new Promise(r => setTimeout(r, 500));
                }
                setIsSending(false); setSendSummary(results); setShowSummaryDialog(true);
                if (results.totalSent > 0) { setStep(1); form.reset(); }
            } else {
                if (!csvData.length) throw new Error('No CSV data found.');
                const recipients = csvData.map(row => {
                    const vars: Record<string, any> = { ...data.variables };
                    Object.entries(columnMapping).forEach(([tv, cv]) => { vars[tv] = row[cv]; });
                    return { recipient: row.recipient || row.phone || row.email || '', variables: vars };
                });
                const { jobId } = await createBulkMessageJob({ templateId: data.templateId!, senderProfileId: data.senderProfileId!, recipients, userId: user.uid });
                setStep(6); startJobProcessing(jobId);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed', description: e.message });
            setIsSending(false);
        } finally { setIsSubmitting(false); }
    };

    // ── Stepper UI ─────────────────────────────────────────────────────────────


    // ── RENDER ─────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Stepper currentStep={step} onStepClick={setStep} />
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 text-left">

                {/* ── STEP 1: Message Type ─────────────────────────────────── */}
                {step === 1 && (
                    <Card className="rounded-2xl border shadow-xl overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b p-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20"><Mail className="h-5 w-5" /></div>
                                <div>
                                    <CardTitle className="text-lg font-semibold">Message Type & Format</CardTitle>
                                    <CardDescription className="text-xs font-medium text-muted-foreground/70">Choose your channel and how you want to build the message.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-8">
                            {/* Channel */}
                            <div className="space-y-3">
                                <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">1. Channel</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    {([['email', 'Email', Mail], ['sms', 'SMS', Smartphone]] as const).map(([val, label, Icon]) => (
                                        <button key={val} type="button" onClick={() => setValue('channel', val)}
                                            className={cn('flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all duration-300 font-semibold text-sm',
                                                watchedChannel === val ? 'border-primary bg-primary/5 text-primary shadow-lg shadow-primary/10' : 'border-border hover:border-primary/30 text-muted-foreground'
                                            )}>
                                            <Icon className="h-6 w-6" />
                                            {label}
                                            {watchedChannel === val && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Source type */}
                            <div className="space-y-3">
                                <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">2. Build From</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    {([
                                        ['template', 'Use Template', FileText, 'Pick from saved templates'],
                                        ['new',      'Write New',    Wand2,    'Compose from scratch'],
                                    ] as const).map(([val, label, Icon, desc]) => (
                                        <button key={val} type="button" onClick={() => setValue('messageSourceType', val)}
                                            className={cn('flex flex-col items-start gap-1 p-4 rounded-2xl border-2 transition-all duration-300 text-left',
                                                watch('messageSourceType') === val ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' : 'border-border hover:border-primary/30'
                                            )}>
                                            <div className="flex items-center gap-2">
                                                <Icon className={cn('h-4 w-4', watch('messageSourceType') === val ? 'text-primary' : 'text-muted-foreground')} />
                                                <span className={cn('text-xs font-bold', watch('messageSourceType') === val ? 'text-primary' : 'text-foreground')}>{label}</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground font-medium pl-6">{desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* SMS balance hint */}
                            {watchedChannel === 'sms' && smsBalance !== null && (
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800">
                                    <Info className="h-4 w-4 shrink-0" />
                                    SMS Balance: <span className="font-bold">{smsBalance} credits</span>
                                </div>
                            )}
                        </CardContent>
                        <NavFooter showBack={false} onNext={() => setStep(2)} onBack={() => {}} isSubmitting={isSubmitting} nextLabel="Next: Build Message" />
                    </Card>
                )}

                {/* ── STEP 2: Builder ──────────────────────────────────────── */}
                {step === 2 && (
                    <Card className="rounded-2xl border shadow-xl overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b p-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20"><Wand2 className="h-5 w-5" /></div>
                                <div>
                                    <CardTitle className="text-lg font-semibold">Message Builder</CardTitle>
                                    <CardDescription className="text-xs font-medium text-muted-foreground/70">
                                        {watch('messageSourceType') === 'template' ? 'Select a template and configure content.' : 'Compose your message from scratch.'}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            {watch('messageSourceType') === 'template' ? (
                                <div className="space-y-5">
                                    {/* Template picker */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">Template</Label>
                                            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[9px] font-semibold text-primary gap-1" onClick={() => setIsQuickCreateOpen(true)}>
                                                <PlusCircle className="h-3 w-3" /> New
                                            </Button>
                                        </div>
                                        <Controller name="templateId" control={control} render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                                <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-border/50 font-semibold">
                                                    <SelectValue placeholder="Select a template..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    {isLoadingTemplates ? (
                                                        <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                                                    ) : templates?.map(t => (
                                                        <SelectItem key={t.id} value={t.id} className="rounded-lg my-0.5">
                                                            <div className="flex items-center gap-3">
                                                                <Badge variant="outline" className="text-[8px] font-bold uppercase h-4 px-1.5 border-primary/20 text-primary">{t.category}</Badge>
                                                                <span className="font-semibold text-sm">{t.name}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )} />
                                    </div>

                                    {/* Template preview + AI refine */}
                                    {selectedTemplate && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                                            <div className="p-4 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Zap className="h-4 w-4 text-primary" />
                                                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Variables</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Select value={selectedTone} onValueChange={(v: any) => setSelectedTone(v)}>
                                                            <SelectTrigger className="h-7 w-28 text-[10px] font-semibold bg-card border-primary/20 rounded-lg">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {['formal','friendly','urgent','concise'].map(t => <SelectItem key={t} value={t} className="capitalize text-xs">{t}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                        <Button type="button" size="sm" variant="outline" onClick={handleAiRefine} disabled={isRefining} className="h-7 gap-1.5 font-semibold text-[10px] border-primary/20 hover:bg-primary/5 rounded-lg">
                                                            {isRefining ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                                                            AI Refine
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedTemplate.variables.map(v => (
                                                        <code key={v} className="bg-card px-3 py-1 rounded-lg border text-[10px] font-semibold text-primary shadow-sm">{`{{${v}}}`}</code>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Contextual binders */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {selectedTemplate.category === 'meetings' && (
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-bold text-primary flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Bind Meeting</Label>
                                                        <Controller name="sourceMeetingId" control={control} render={({ field }) => (
                                                            <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                                <SelectTrigger className="h-10 rounded-xl bg-primary/5 border-primary/20 text-primary font-semibold text-xs"><SelectValue placeholder="Pick meeting..." /></SelectTrigger>
                                                                <SelectContent className="rounded-xl">
                                                                    <SelectItem value="none">No Binding</SelectItem>
                                                                    {meetings?.map(m => <SelectItem key={m.id} value={m.id}>{m.entityName} – {m.type.name}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        )} />
                                                    </div>
                                                )}
                                                {selectedTemplate.category === 'surveys' && (
                                                    <>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px] font-bold text-primary flex items-center gap-1.5"><ClipboardList className="h-3 w-3" /> Bind Survey</Label>
                                                            <Controller name="sourceSurveyId" control={control} render={({ field }) => (
                                                                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                                    <SelectTrigger className="h-10 rounded-xl bg-primary/5 border-primary/20 text-primary font-semibold text-xs"><SelectValue placeholder="Pick survey..." /></SelectTrigger>
                                                                    <SelectContent className="rounded-xl">
                                                                        <SelectItem value="none">No Binding</SelectItem>
                                                                        {surveys?.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            )} />
                                                        </div>
                                                        {watchedSourceSurveyId && (
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[10px] font-bold text-primary flex items-center gap-1.5"><Database className="h-3 w-3" /> Response</Label>
                                                                <Controller name="sourceResponseId" control={control} render={({ field }) => (
                                                                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                                        <SelectTrigger className="h-10 rounded-xl bg-primary/5 border-primary/20 text-primary font-semibold text-xs"><SelectValue placeholder="Pick response..." /></SelectTrigger>
                                                                        <SelectContent className="rounded-xl">
                                                                            <SelectItem value="none">None</SelectItem>
                                                                            {responses?.map(r => <SelectItem key={r.id} value={r.id}>{format(new Date(r.submittedAt), 'MMM d, HH:mm')} – Score: {r.score}</SelectItem>)}
                                                                        </SelectContent>
                                                                    </Select>
                                                                )} />
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                {selectedTemplate.category === 'forms' && (
                                                    <>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px] font-bold text-primary flex items-center gap-1.5"><FileText className="h-3 w-3" /> Bind PDF</Label>
                                                            <Controller name="sourcePdfId" control={control} render={({ field }) => (
                                                                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                                    <SelectTrigger className="h-10 rounded-xl bg-primary/5 border-primary/20 text-primary font-semibold text-xs"><SelectValue placeholder="Pick PDF..." /></SelectTrigger>
                                                                    <SelectContent className="rounded-xl">
                                                                        <SelectItem value="none">No Binding</SelectItem>
                                                                        {pdfs?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            )} />
                                                        </div>
                                                        {watchedSourcePdfId && (
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[10px] font-bold text-primary flex items-center gap-1.5"><Database className="h-3 w-3" /> Submission</Label>
                                                                <Controller name="sourceSubmissionId" control={control} render={({ field }) => (
                                                                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                                        <SelectTrigger className="h-10 rounded-xl bg-primary/5 border-primary/20 text-primary font-semibold text-xs"><SelectValue placeholder="Pick submission..." /></SelectTrigger>
                                                                        <SelectContent className="rounded-xl">
                                                                            <SelectItem value="none">None</SelectItem>
                                                                            {submissions?.map(s => <SelectItem key={s.id} value={s.id}>{format(new Date((s as any).submittedAt), 'MMM d, HH:mm')}</SelectItem>)}
                                                                        </SelectContent>
                                                                    </Select>
                                                                )} />
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            ) : (
                                /* Write new – placeholder for future rich editor */
                                <div className="p-8 rounded-2xl border-2 border-dashed border-border/50 text-center space-y-3">
                                    <Wand2 className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                                    <p className="text-sm font-semibold text-muted-foreground">Rich composer coming soon.</p>
                                    <p className="text-xs text-muted-foreground/60">For now, use a template or create one via "New Template".</p>
                                    <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setIsQuickCreateOpen(true)}>
                                        <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Create Template
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                        <NavFooter onNext={() => setStep(3)} onBack={() => setStep(1)} isSubmitting={isSubmitting} nextLabel="Next: Audience" nextDisabled={watch('messageSourceType') === 'template' && !watchedTemplateId} />
                    </Card>
                )}

                {/* ── STEP 3: Audience ─────────────────────────────────────── */}
                {step === 3 && (
                    <Card className="rounded-2xl border shadow-xl overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b p-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20"><Users className="h-5 w-5" /></div>
                                <div>
                                    <CardTitle className="text-lg font-semibold">Target Audience</CardTitle>
                                    <CardDescription className="text-xs font-medium text-muted-foreground/70">Mix individual selection, tag filters, and contact-type targeting.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-8">
                            {/* Dispatch mode */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">Dispatch Mode</Label>
                                <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1.5 rounded-xl border border-border/50">
                                    {([['single', 'Targeted', Target], ['bulk', 'Broadcast (CSV)', Layers]] as const).map(([val, label, Icon]) => (
                                        <button key={val} type="button" onClick={() => setValue('mode', val)}
                                            className={cn('flex items-center justify-center gap-2 h-10 rounded-lg font-semibold text-xs transition-all',
                                                watchedMode === val ? 'bg-card shadow-md text-primary' : 'text-muted-foreground hover:text-foreground'
                                            )}>
                                            <Icon className="h-3.5 w-3.5" /> {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {watchedMode === 'single' ? (
                                <div className="space-y-6">
                                    {/* Entity selector — data is lifted to wizard level so it's always live */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">Individual Selection</Label>
                                        <EntitySelector
                                            entities={workspaceEntities}
                                            isLoading={isCombinedLoading}
                                            channel={watchedChannel}
                                            selectedEntityIds={watchedSelectedEntityIds}
                                            activeContactTypeFilter={watchedContactTypeFilter ?? null}
                                            onContactTypeFilterChange={(k) => setValue('contactTypeFilter', k ?? null)}
                                            onSelectionChange={(ids) => {
                                                setValue('selectedEntityIds', ids, { shouldValidate: true });
                                                setValue('entityId', ids.length === 1 ? ids[0] : '');
                                            }}
                                        />
                                    </div>

                                    {/* Tag-based audience */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                                            <Tag className="h-3 w-3" /> Tag-Based Audience
                                        </Label>
                                        <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
                                            <TagAudienceSelector onChange={(seg) => {
                                                setTagSegment(seg);
                                                setValue('tagSegmentInclude', seg.includeTagIds);
                                                setValue('tagSegmentExclude', seg.excludeTagIds);
                                                setValue('tagSegmentLogic', seg.includeLogic);
                                            }} />
                                        </div>
                                    </div>

                                    {/* Contact scope */}
                                    {watchedSelectedEntityIds.length > 0 && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                                                    <Settings2 className="h-3 w-3" /> Contact Targeting
                                                </Label>
                                                <Badge variant="outline" className="text-[8px] font-bold uppercase opacity-50">Server-side resolution</Badge>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                {[
                                                    { id: 'primary',    label: 'Primary',    desc: 'Main contact for the entity.' },
                                                    { id: 'signatories',label: 'Signatories', desc: 'Decision makers only.' },
                                                    { id: 'all',        label: 'Blast All',   desc: 'Every recorded contact.' },
                                                ].map(s => (
                                                    <div key={s.id} onClick={() => setValue('contactScope', s.id as any)}
                                                        className={cn('cursor-pointer border-2 rounded-xl p-3.5 transition-all relative overflow-hidden',
                                                            watchedContactScope === s.id ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/30'
                                                        )}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="text-xs font-bold">{s.label}</p>
                                                            {watchedContactScope === s.id && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                                                        {watchedContactScope === s.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Active contact-type filter indicator */}
                                            {watchedContactTypeFilter && (
                                                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs font-semibold text-primary">
                                                    <Tag className="h-3.5 w-3.5 shrink-0" />
                                                    Filtering to <span className="capitalize font-bold">{watchedContactTypeFilter.replace(/_/g, ' ')}</span> contacts only.
                                                    <button type="button" onClick={() => setValue('contactTypeFilter', null)} className="ml-auto hover:text-destructive">
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {watchedSelectedEntityIds.length === 0 && tagSegment.includeTagIds.length === 0 && (
                                        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                                            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                            <p className="text-xs font-semibold text-amber-800">Select at least one entity or add a tag filter to continue.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Bulk CSV */
                                <div className="space-y-6">
                                    <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
                                        <TagAudienceSelector onChange={setTagSegment} />
                                    </div>
                                    {!csvData.length ? (
                                        <div className="p-12 border-2 border-dashed rounded-2xl flex flex-col items-center gap-4 text-center hover:border-primary/30 transition-colors">
                                            <Upload className="h-8 w-8 text-muted-foreground/40" />
                                            <input type="file" accept=".csv" className="hidden" id="csv-upload" onChange={handleCsvUpload} />
                                            <Button type="button" asChild variant="outline" className="rounded-xl font-semibold h-11 px-8 text-xs">
                                                <label htmlFor="csv-upload" className="cursor-pointer">Upload CSV File</label>
                                            </Button>
                                            <p className="text-[10px] text-muted-foreground">Must include a header row with recipient, phone, or email column.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Layers className="h-4 w-4 text-primary" />
                                                    <span className="text-sm font-bold text-primary">CSV Loaded</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge className="bg-primary text-white text-[10px] font-bold">{csvData.length} records</Badge>
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => setCsvData([])} className="h-7 text-destructive text-xs gap-1">
                                                        <X className="h-3 w-3" /> Clear
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {selectedTemplate?.variables.map(v => (
                                                    <div key={v} className="space-y-1">
                                                        <Label className="text-[10px] font-semibold text-muted-foreground">Map {`{{${v}}}`}</Label>
                                                        <Select value={columnMapping[v] || ''} onValueChange={(val) => setColumnMapping(p => ({ ...p, [v]: val }))}>
                                                            <SelectTrigger className="h-9 rounded-lg bg-card border-border/50 font-semibold text-xs"><SelectValue placeholder="Select column..." /></SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                        <NavFooter
                            onNext={() => setStep(4)}
                            onBack={() => setStep(2)}
                            isSubmitting={isSubmitting}
                            nextLabel="Next: Tags & Actions"
                            nextDisabled={watchedMode === 'single'
                                ? (watchedSelectedEntityIds.length === 0 && tagSegment.includeTagIds.length === 0)
                                : !csvData.length}
                        />
                    </Card>
                )}

                {/* ── STEP 4: Tags & Automations ───────────────────────────── */}
                {step === 4 && (
                    <Card className="rounded-2xl border shadow-xl overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b p-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20"><Tag className="h-5 w-5" /></div>
                                <div>
                                    <CardTitle className="text-lg font-semibold">Tags & Automations</CardTitle>
                                    <CardDescription className="text-xs font-medium text-muted-foreground/70">Optionally apply tags or trigger automations on recipients after sending.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="p-6 rounded-2xl border-2 border-dashed border-border/50 flex flex-col items-center gap-3 text-center">
                                <Tag className="h-7 w-7 text-muted-foreground/30" />
                                <p className="text-sm font-semibold text-muted-foreground">Tag & automation assignment coming soon.</p>
                                <p className="text-[10px] text-muted-foreground/60">After sending, you'll be able to auto-tag recipients and trigger workflow automations.</p>
                            </div>
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
                                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                <p className="text-xs font-semibold text-blue-800">You can skip this step — it's optional. Tags and automations can also be applied manually after sending.</p>
                            </div>
                        </CardContent>
                        <NavFooter onNext={() => setStep(5)} onBack={() => setStep(3)} isSubmitting={isSubmitting} nextLabel="Next: Publish" />
                    </Card>
                )}

                {/* ── STEP 5: Publish ──────────────────────────────────────── */}
                {step === 5 && (
                    <Card className="rounded-2xl border shadow-xl overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b p-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20"><Send className="h-5 w-5" /></div>
                                <div>
                                    <CardTitle className="text-lg font-semibold">Publish</CardTitle>
                                    <CardDescription className="text-xs font-medium text-muted-foreground/70">Configure sender, preview, test, schedule, and send.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left: config */}
                                <div className="space-y-5">
                                    {/* Sender profile */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">Sender Profile</Label>
                                        <Controller name="senderProfileId" control={control} render={({ field }) => (
                                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                                <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-border/50 font-semibold">
                                                    <SelectValue placeholder="Select sender..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    {profiles?.map(p => (
                                                        <SelectItem key={p.id} value={p.id} className="rounded-lg my-0.5">
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-semibold">{p.name}</span>
                                                                <span className="text-[9px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{p.identifier}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )} />
                                    </div>

                                    {/* Scheduling */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">Delivery</Label>
                                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/20 border border-border/50">
                                            <div className="flex items-center gap-2">
                                                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-xs font-semibold">Schedule for later</span>
                                            </div>
                                            <Controller name="isScheduled" control={control} render={({ field }) => (
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            )} />
                                        </div>
                                        {watchedIsScheduled && (
                                            <Controller name="scheduledAt" control={control} render={({ field }) => (
                                                <DateTimePicker value={field.value} onChange={field.onChange} />
                                            )} />
                                        )}
                                    </div>

                                    {/* Summary */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-4 rounded-xl bg-muted/20 border border-border/50 space-y-1">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recipients</p>
                                            <p className="text-2xl font-bold text-primary tabular-nums">{watchedSelectedEntityIds.length}</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-muted/20 border border-border/50 space-y-1">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Delivery</p>
                                            <p className={cn('text-sm font-bold flex items-center gap-1.5', watchedIsScheduled ? 'text-primary' : 'text-emerald-600')}>
                                                {watchedIsScheduled ? <CalendarClock className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                                                {watchedIsScheduled ? 'Scheduled' : 'Immediate'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Test dispatch */}
                                    <Button type="button" variant="outline" onClick={() => setIsTestModalOpen(true)}
                                        className="w-full h-11 rounded-xl font-semibold border-primary/20 text-primary hover:bg-primary/5 gap-2 text-xs">
                                        <FlaskConical className="h-4 w-4" /> Send Test Message
                                    </Button>

                                    {/* Audit note */}
                                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50 border border-blue-200">
                                        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                        <p className="text-[10px] font-semibold text-blue-800 leading-relaxed">All dispatches are logged for audit. Messages use official organizational gateways.</p>
                                    </div>

                                    {/* High-volume warning */}
                                    {watchedSelectedEntityIds.length > 50 && (
                                        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                                            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                            <p className="text-[10px] font-semibold text-amber-800 leading-relaxed">
                                                High volume: {watchedSelectedEntityIds.length} messages. Estimated time: ~{Math.ceil(watchedSelectedEntityIds.length * 0.5 / 60)} min.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Right: preview */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                                        <Eye className="h-3 w-3" /> Live Preview
                                    </Label>
                                    {selectedTemplate ? (
                                        <MessagePreviewer
                                            template={selectedTemplate}
                                            variables={{ ...sampleVariables, ...getValues('variables'), ...(watchedMode === 'bulk' ? csvData[0] : {}) }}
                                        />
                                    ) : (
                                        <div className="p-8 rounded-xl border-2 border-dashed border-border/50 text-center text-muted-foreground text-xs">
                                            No template selected
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Send progress */}
                            {isSending && sendProgress.total > 0 && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border/50">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-primary">Sending… {sendProgress.sent}/{sendProgress.total}</p>
                                        <Badge className="bg-primary text-white text-[10px]">{Math.round((sendProgress.sent / sendProgress.total) * 100)}%</Badge>
                                    </div>
                                    <Progress value={(sendProgress.sent / sendProgress.total) * 100} className="h-2" />
                                    {sendProgress.currentEntity && <p className="text-[10px] text-muted-foreground">Current: {sendProgress.currentEntity}</p>}
                                </motion.div>
                            )}
                        </CardContent>
                        <NavFooter 
                            onBack={() => setStep(4)} 
                            isSubmitting={isSubmitting}
                            nextDisabled={!watch('senderProfileId') || (watchedMode === 'single' && watchedSelectedEntityIds.length === 0)}
                            nextLabel={watchedMode === 'single' ? 'Send Now' : 'Execute Broadcast'} 
                        />
                    </Card>
                )}

                {/* ── STEP 6: Bulk job progress ────────────────────────────── */}
                {step === 6 && (
                    <Card className="rounded-2xl border shadow-xl overflow-hidden">
                        <CardHeader className="text-center p-10 border-b bg-muted/30">
                            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/10">
                                {jobStatus === 'processing' ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Trophy className="h-8 w-8 text-emerald-600" />}
                            </div>
                            <CardTitle className="text-2xl font-bold">Broadcast in Progress</CardTitle>
                            <CardDescription className="font-semibold text-muted-foreground mt-1">Sending to {csvData.length} recipients via secured gateway.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="space-y-3 max-w-lg mx-auto">
                                <div className="flex justify-between items-end">
                                    <p className="text-xs font-semibold text-muted-foreground">Progress</p>
                                    <p className="text-4xl font-bold tabular-nums text-primary">{jobProgress}%</p>
                                </div>
                                <div className="h-4 w-full bg-muted/30 rounded-full overflow-hidden border p-1">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${jobProgress}%` }} className="h-full bg-primary rounded-full" />
                                </div>
                            </div>
                            {jobStatus === 'completed' && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm mx-auto">
                                    <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-4">
                                        <div className="bg-emerald-600 text-white p-3 rounded-xl"><Check className="h-5 w-5" /></div>
                                        <div className="flex-1">
                                            <p className="font-bold text-emerald-900">Broadcast Complete</p>
                                            <p className="text-xs text-emerald-700 mt-0.5">All messages dispatched successfully.</p>
                                        </div>
                                        <Button asChild className="rounded-xl font-semibold h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-xs">
                                            <Link href="/admin/messaging">View Logs</Link>
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </form>

            {/* ── Dialogs ──────────────────────────────────────────────────── */}
            <QuickTemplateDialog
                open={isQuickCreateOpen}
                onOpenChange={setIsQuickCreateOpen}
                channel={watchedChannel}
                category="general"
                onCreated={(id) => { setValue('templateId', id, { shouldDirty: true }); setValue('messageSourceType', 'template'); }}
            />

            <TestDispatchDialog
                open={isTestModalOpen}
                onOpenChange={setIsTestModalOpen}
                channel={watchedChannel}
                templateId={watchedTemplateId || ''}
                variables={getValues('variables')}
                senderProfileId={getValues('senderProfileId') || ''}
                entityId={getValues('entityId') || ''}
            />

            {/* Summary dialog */}
            <AlertDialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
                <AlertDialogContent className="max-w-lg rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-lg font-bold">
                            {sendSummary?.totalFailed === 0
                                ? <><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Send Complete</>
                                : <><AlertCircle className="h-5 w-5 text-amber-600" /> Completed with Errors</>}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-semibold text-muted-foreground">Message delivery summary</AlertDialogDescription>
                    </AlertDialogHeader>
                    {sendSummary && (
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                                    <div className="p-2 bg-emerald-600 text-white rounded-lg"><Check className="h-3.5 w-3.5" /></div>
                                    <div><p className="text-[10px] font-bold text-emerald-900">Sent</p><p className="text-xl font-bold text-emerald-600">{sendSummary.totalSent}</p></div>
                                </div>
                                <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
                                    <div className="p-2 bg-red-600 text-white rounded-lg"><X className="h-3.5 w-3.5" /></div>
                                    <div><p className="text-[10px] font-bold text-red-900">Failed</p><p className="text-xl font-bold text-red-600">{sendSummary.totalFailed}</p></div>
                                </div>
                            </div>
                            
                            {sendSummary.totalFailed > 0 && sendSummary.failedEntities && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-red-900 uppercase tracking-widest ml-1">Error Logs</Label>
                                    <div className="max-h-36 overflow-y-auto rounded-xl border border-red-200 bg-red-50/50 p-2">
                                        <div className="space-y-2">
                                            {sendSummary.failedEntities.map((f, i: number) => (
                                                <div key={i} className="p-2.5 rounded-lg bg-card border border-red-200 space-y-0.5 shadow-sm">
                                                    <div className="flex items-center gap-1.5">
                                                        <Building className="h-3 w-3 text-red-600" />
                                                        <span className="text-xs font-bold text-red-900">{f.entityId || 'Unknown'}</span>
                                                    </div>
                                                    <p className="text-[10px] text-red-700 pl-4">{f.error}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <Button 
                                        type="button"
                                        variant="outline" 
                                        className="w-full h-10 rounded-xl font-bold border-red-200 text-red-900 hover:bg-red-50 gap-2 text-xs transition-all shadow-sm"
                                        onClick={() => {
                                            const failedIds = sendSummary.failedEntities?.map(f => f.entityId).filter(Boolean) as string[];
                                            setValue('selectedEntityIds', failedIds);
                                            setShowSummaryDialog(false); 
                                            setStep(3);
                                            toast({ title: 'Retry prepared', description: `${failedIds.length} entities selected for retry.` });
                                        }}
                                    >
                                        <TrendingUp className="h-3.5 w-3.5" /> Retry Failed Entities
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                    <AlertDialogFooter className="bg-muted/20 -mx-6 -mb-6 p-4 border-t">
                        <AlertDialogAction 
                            onClick={() => { 
                                setShowSummaryDialog(false); 
                                setSendSummary(null); 
                            }} 
                            className="rounded-xl font-bold px-8 shadow-lg active:scale-95 transition-all"
                        >
                            Close
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ─── MessagePreviewer ─────────────────────────────────────────────────────────
function MessagePreviewer({ template, variables }: { template: MessageTemplate; variables: Record<string, any> }) {
    const combinedVars = { ...variables };

    if (variables.ai_refined_body) {
        return (
            <div className="rounded-2xl border-2 overflow-hidden shadow-lg p-6 bg-card">
                <div className="flex items-center gap-2 mb-3 text-emerald-600">
                    <Wand2 className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold">AI Polished Draft</span>
                </div>
                <div className="whitespace-pre-wrap font-medium leading-relaxed text-sm prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: resolveVariables(variables.ai_refined_body, combinedVars) }} />
            </div>
        );
    }

    const resolvedBody = template.blocks?.length
        ? renderBlocksToHtml(template.blocks, combinedVars)
        : resolveVariables(template.body, combinedVars);

    if (template.channel === 'email') {
        return (
            <div className="rounded-2xl border-2 overflow-hidden shadow-lg bg-card flex flex-col h-[380px]">
                <div className="p-4 border-b bg-muted/20 shrink-0">
                    <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase mb-1">Subject</p>
                    <p className="font-semibold text-sm truncate">{resolveVariables(template.subject || '', combinedVars) || '(No Subject)'}</p>
                </div>
                <div className="flex-1 overflow-auto p-6">
                    <div className="whitespace-pre-wrap font-medium leading-relaxed text-sm text-slate-700 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: resolvedBody }} />
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border-2 overflow-hidden shadow-lg bg-muted/10 max-w-xs mx-auto">
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <SmartSappIcon className="h-6 w-6 text-primary opacity-20" />
                    <p className="text-[9px] font-bold text-primary/40 tracking-widest uppercase">SMS Preview</p>
                </div>
                <div className="p-4 bg-card border rounded-2xl relative shadow-md">
                    <div className="absolute -left-2 top-6 w-4 h-4 bg-card border-l border-b rotate-45 rounded-sm" />
                    <p className="text-sm text-slate-900 leading-relaxed font-medium whitespace-pre-wrap">{resolvedBody}</p>
                </div>
                <p className="text-center text-[9px] font-semibold text-slate-300">~{Math.ceil(resolvedBody.length / 160)} segment(s)</p>
            </div>
        </div>
    );
}
