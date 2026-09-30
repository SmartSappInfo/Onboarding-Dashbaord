'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, where, doc, onSnapshot } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { MessageTemplate, TemplateVariable, MessageStyle, SenderProfile } from '@/lib/types';
import { createBulkMessageJob, processJobChunkBackground } from '@/lib/bulk-messaging';
import { resolveContact } from '@/lib/contact-adapter';
import { fetchSmsBalanceAction } from '@/lib/mnotify-actions';
import { fetchContextualData, resolveRecipientContacts, updateEntityLastContactedAt } from '@/lib/messaging-actions';
import { contactResolutionChannel } from '@/lib/messaging/channel-registry';
import { getVariablesForContext } from '@/lib/template-variable-utils';
import { getWorkspaceVariablesAction } from '@/lib/fields-actions';
import { getSystemDispatchGovernanceAction } from '@/lib/surveys/survey-campaign-actions';
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

import {
    Check, ChevronRight, Smartphone, Mail, MessageCircle, Users, Upload, Loader2,
    X, AlertCircle, Info, Building, Trophy, TrendingUp,
    CheckCircle2, Target, Layers, Wand2, ArrowLeft, FileText,
    PlusCircle, Tag, Send, Settings2,
    User, Filter, BookmarkCheck, Table, Code,
} from 'lucide-react';
import { getErrorMessage } from '@/lib/errors/report-error';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
    AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TemplateWorkshopSheet } from '@/app/admin/messaging/components/TemplateWorkshopSheet';
import TestDispatchDialog from '../../components/TestDispatchDialog';
import { TagAudienceSelector, type TagSegment } from './TagAudienceSelector';
import { EntitySelector } from './EntitySelector';
import { cn } from '@/lib/utils';
import { MessagingTemplateSelector } from '../../../components/MessagingTemplateSelector';
import { PreFlightCockpit } from './PreFlightCockpit';
import { PublishPreviewCanvas } from './PublishPreviewCanvas';
import { SafeguardBlastModal } from './SafeguardBlastModal';
import { useAudiences } from '@/lib/audience-hooks';
import { getEffectiveContactTypes } from '@/lib/contact-type-actions';
import type { InvitationRecipient } from '@/lib/contacts/contact-repository';
import type { ComposerAudienceMode, AdHocContactItem, InternalUserRecipient } from '@/lib/types/composer-audience';
import { AdHocContactPillsInput } from '@/components/messaging/AdHocContactPillsInput';
import { SpreadsheetRecipientImporter } from '@/components/messaging/SpreadsheetRecipientImporter';
import { InternalUserAudienceSelector } from '@/components/messaging/InternalUserAudienceSelector';

interface CSVRecord {
    [key: string]: string;
}

interface SavedAudienceFilter {
    field: string;
    operator: string;
    value?: string[];
}

interface SavedAudienceItem {
    id: string;
    name: string;
    filters?: SavedAudienceFilter[];
}

interface SurveyAnswerItem {
    questionId: string;
    value: unknown;
}

interface FailedSendEntity {
    entityId: string;
    entityName: string;
    contactName?: string;
    contactDetail?: string;
    error: string;
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const formSchema = z.object({
    // Step 1 – Message Type
    channel: z.enum(['email', 'sms', 'whatsapp']),
    messageSourceType: z.enum(['template', 'new']).default('template'),
    templateId: z.string().optional(),
    senderProfileId: z.string().optional(),
    // Step 3 – Audience
    audienceMode: z.enum(['entities', 'team', 'adhoc']).default('entities'),
    mode: z.enum(['single', 'bulk']).default('single'),
    selectedEntityIds: z.array(z.string()).default([]),
    contactScope: z.enum(['primary', 'signatories', 'roles', 'all']).default('primary'),
    contactTypeFilter: z.array(z.string()).default([]),
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
    variables: z.record(z.unknown()).default({}),
    sourceMeetingId: z.string().optional(),
    sourceSurveyId: z.string().optional(),
    sourceResponseId: z.string().optional(),
    sourcePdfId: z.string().optional(),
    sourceSubmissionId: z.string().optional(),
    // Custom ad-hoc content
    customBody: z.string().optional(),
    customSubject: z.string().optional(),
    // CSV bulk
    recipient: z.string().optional(),
    selectedContacts: z.array(z.string()).default([]),
});

type FormData = z.infer<typeof formSchema>;

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS = [
    { n: 1, label: 'Details',        icon: Mail },
    { n: 2, label: 'Builder',        icon: Wand2 },
    { n: 3, label: 'Audience',       icon: Users },
    { n: 4, label: 'Tags & Actions', icon: Tag },
    { n: 5, label: 'Publish',        icon: Send },
] as const;

// ─── Sub-components (extracted for stability) ─────────────────────────────────

const Stepper = ({ currentStep, onStepClick }: { currentStep: number; onStepClick: (n: number) => void }) => (
    <nav
        aria-label="Composer Workflow Steps"
        className="flex items-center justify-center mb-8 px-2"
    >
        <div className="inline-flex items-center bg-muted/40 backdrop-blur-md p-1 rounded-full border border-border/60 shadow-xs max-w-full overflow-x-auto scrollbar-none gap-0.5 sm:gap-1">
            {STEPS.map((s, idx) => {
                const isActive = currentStep === s.n;
                const isDone = currentStep > s.n;
                const isClickable = isDone;

                return (
                    <React.Fragment key={s.n}>
                        <button
                            type="button"
                            onClick={() => isClickable && onStepClick(s.n)}
                            disabled={!isClickable}
                            aria-current={isActive ? 'step' : undefined}
                            aria-label={`Step ${s.n}: ${s.label}${isDone ? ' (Completed)' : isActive ? ' (Active)' : ''}`}
                            className={cn(
                                'px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 transition-all duration-200 select-none min-h-[38px] sm:min-h-[36px]',
                                isActive
                                    ? 'bg-background text-primary font-semibold shadow-xs ring-1 ring-border/50'
                                    : isDone
                                    ? 'text-primary/90 hover:text-primary hover:bg-background/60 cursor-pointer active:scale-[0.97]'
                                    : 'text-muted-foreground/60 cursor-not-allowed opacity-75'
                            )}
                        >
                            <span
                                className={cn(
                                    'w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 transition-colors',
                                    isActive
                                        ? 'bg-primary text-primary-foreground shadow-2xs'
                                        : isDone
                                        ? 'bg-primary/10 text-primary'
                                        : 'bg-muted-foreground/20 text-muted-foreground'
                                )}
                            >
                                {isDone ? <Check className="w-3 h-3 stroke-[2.5]" /> : s.n}
                            </span>
                            <span className={cn(
                                'transition-colors whitespace-nowrap',
                                isActive ? 'text-primary font-semibold' : ''
                            )}>
                                {s.label}
                            </span>
                        </button>

                        {idx < STEPS.length - 1 && (
                            <ChevronRight
                                className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 mx-0.5"
                                aria-hidden="true"
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    </nav>
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
interface ComposerWizardProps {
    composerContext?: {
        category?: 'forms' | 'surveys' | 'meetings' | 'agreements' | 'campaigns' | 'reminders' | 'general';
        meetingId?: string;
        formId?: string;
        surveyId?: string;
        agreementId?: string;
    };
}

export default function ComposerWizard({ composerContext }: ComposerWizardProps = {}) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { activeWorkspace, activeWorkspaceId, activeOrganizationId, currentOrganization } = useWorkspace();
    const { toast } = useToast();
    const searchParams = useSearchParams();

    const [step, setStep] = React.useState(1);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isQuickCreateOpen, setIsQuickCreateOpen] = React.useState(false);
    const [isTestModalOpen, setIsTestModalOpen] = React.useState(false);
    const [isBlastModalOpen, setIsBlastModalOpen] = React.useState(false);
    const [isRefining, setIsRefining] = React.useState(false);
    const [selectedTone, _setSelectedTone] = React.useState<'formal'|'friendly'|'urgent'|'concise'>('formal');
    const [csvData, setCsvData] = React.useState<CSVRecord[]>([]);
    const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
    const [columnMapping, setColumnMapping] = React.useState<Record<string, string>>({});
    const [tagSegment, setTagSegment] = React.useState<TagSegment>({ includeTagIds: [], excludeTagIds: [], includeLogic: 'OR' });
    const [smsBalance, setSmsBalance] = React.useState<number | null>(null);
    const [sendProgress, setSendProgress] = React.useState({ sent: 0, total: 0, currentEntity: '' });
    const [isSending, setIsSending] = React.useState(false);
    const [sendSummary, setSendSummary] = React.useState<{
        success: boolean;
        totalSent: number;
        totalFailed: number;
        failedEntities: FailedSendEntity[];
        logIds: string[];
    } | null>(null);
    const [showSummaryDialog, setShowSummaryDialog] = React.useState(false);
    const [isExporting, setIsExporting] = React.useState(false);
    const [exportingType, setExportingType] = React.useState<'pdf' | 'csv' | 'json' | null>(null);
    const [sampleVariables, setSampleVariables] = React.useState<Record<string, string>>({});
    const [jobProgress, setJobProgress] = React.useState(0);
    const [jobStatus, setJobStatus] = React.useState<string | null>(null);
    const [jobProcessed, setJobProcessed] = React.useState(0);
    const [jobFailed, setJobFailed] = React.useState(0);
    const [jobTotal, setJobTotal] = React.useState(0);
    const [_availableVariables, setAvailableVariables] = React.useState<TemplateVariable[]>([]);
    const [selectedTemplate, setSelectedTemplate] = React.useState<MessageTemplate | null>(null);
    const [selectedSenderProfile, setSelectedSenderProfile] = React.useState<SenderProfile | null>(null);
    const [blastThreshold, setBlastThreshold] = React.useState<number>(50);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            channel: 'email', messageSourceType: 'template', audienceMode: 'entities', mode: 'single',
            selectedEntityIds: [], contactScope: 'primary', entityId: '',
            isScheduled: false, variables: {}, applyTagIds: [], triggerAutomationIds: [],
            tagSegmentInclude: [], tagSegmentExclude: [], tagSegmentLogic: 'OR',
            selectedContacts: [],
            customBody: '', customSubject: 'Important Update',
            senderProfileId: 'default',
        },
    });

    const { watch, setValue, getValues, control } = form;
    const watchedChannel = watch('channel');
    const watchedTemplateId = watch('templateId');
    const watchedAudienceMode = (watch('audienceMode') || 'entities') as ComposerAudienceMode;
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
    const _watchedCustomBody = watch('customBody');
    const _watchedMessageSourceType = watch('messageSourceType');
    const watchedSenderProfileId = watch('senderProfileId');

    const [audienceSource, setAudienceSource] = React.useState<'individual' | 'manual' | 'saved'>('individual');
    const [savedAudienceId, setSavedAudienceId] = React.useState('');
    const [assigneeFilter, setAssigneeFilter] = React.useState<'all' | 'mine'>('all');
    const [selectedRoles, setSelectedRoles] = React.useState<string[]>([]);
    const [availableRoles, setAvailableRoles] = React.useState<{ key: string; label: string }[]>([]);
    const [filteredRecipients, setFilteredRecipients] = React.useState<InvitationRecipient[]>([]);
    const [isResolvingRecipients, setIsResolvingRecipients] = React.useState(false);
    const [selectedTeamMembers, setSelectedTeamMembers] = React.useState<InternalUserRecipient[]>([]);
    const [adhocContacts, setAdhocContacts] = React.useState<AdHocContactItem[]>([]);
    const [adhocSubTab, setAdhocSubTab] = React.useState<'pills' | 'spreadsheet'>('pills');

    const { audiences: savedAudiences } = useAudiences(activeWorkspaceId);

    // Fetch contact roles
    React.useEffect(() => {
        if (!activeWorkspaceId) return;
        const scope = (activeWorkspace?.contactScope || 'institution') as 'institution' | 'family' | 'person';
        let cancelled = false;
        getEffectiveContactTypes(scope, activeOrganizationId, activeWorkspaceId)
            .then((types) => {
                if (cancelled) return;
                setAvailableRoles(types.filter((t) => t.active).map((t) => ({ key: t.key, label: t.label })));
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [activeWorkspace?.contactScope, activeOrganizationId, activeWorkspaceId]);

    const toggleRole = React.useCallback((key: string) => {
        setSelectedRoles((prev) =>
            prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]
        );
    }, []);

    const handleSavedAudienceChange = React.useCallback((audienceId: string) => {
        setSavedAudienceId(audienceId);
        const aud = (savedAudiences as SavedAudienceItem[]).find((a) => a.id === audienceId);
        if (aud && aud.filters) {
            const includeTagFilter = aud.filters.find((f) => f.field === 'tags' && (f.operator === 'any_of' || f.operator === 'all_of'));
            const excludeTagFilter = aud.filters.find((f) => f.field === 'tags' && f.operator === 'is_not');
            const inc = includeTagFilter?.value || [];
            const exc = excludeTagFilter?.value || [];
            const logic: 'AND' | 'OR' = includeTagFilter?.operator === 'all_of' ? 'AND' : 'OR';
            setTagSegment({
                includeTagIds: inc,
                excludeTagIds: exc,
                includeLogic: logic,
            });
            setValue('tagSegmentInclude', inc);
            setValue('tagSegmentExclude', exc);
            setValue('tagSegmentLogic', logic);
        }
    }, [savedAudiences, setValue]);

    const recipientFilterKey = JSON.stringify({
        audienceSource,
        channels: [watchedChannel],
        assignee: assigneeFilter === 'mine' ? user?.uid ?? null : null,
        inc: tagSegment.includeTagIds,
        exc: tagSegment.excludeTagIds,
        logic: tagSegment.includeLogic,
        scope: watchedContactScope,
        roles: selectedRoles,
    });

    React.useEffect(() => {
        if (!activeWorkspaceId || audienceSource === 'individual') {
            setFilteredRecipients([]);
            return;
        }
        let cancelled = false;
        setIsResolvingRecipients(true);
        const t = setTimeout(async () => {
            try {
                const f = JSON.parse(recipientFilterKey);
                const { resolveInvitationRecipients } = await import('@/lib/contacts/contact-repository');
                const { recipients } = await resolveInvitationRecipients(activeWorkspaceId, {
                    channels: (f.channels || []).filter((c: string) => c === 'email' || c === 'sms'),
                    assignedUserId: f.assignee,
                    includeTagIds: f.inc || [],
                    excludeTagIds: f.exc || [],
                    includeLogic: f.logic === 'AND' ? 'AND' : 'OR',
                    contactScope: f.scope,
                    roles: f.roles || [],
                });
                if (!cancelled) setFilteredRecipients(recipients);
            } catch {
                if (!cancelled) setFilteredRecipients([]);
            } finally {
                if (!cancelled) setIsResolvingRecipients(false);
            }
        }, 300);
        return () => { cancelled = true; clearTimeout(t); };
    }, [activeWorkspaceId, recipientFilterKey, audienceSource]);

    // ── Firestore queries ──────────────────────────────────────────────────────

    const stylesQuery = useMemoFirebase(() =>
        (firestore && activeWorkspaceId)
            ? query(collection(firestore, 'message_styles'), where('workspaceIds', 'array-contains', activeWorkspaceId))
            : null,
    [firestore, activeWorkspaceId]);

    const { data: styles } = useCollection<MessageStyle>(stylesQuery);

    // Entity selection is now search-backed inside EntitySelector (no full-set
    // load). Recipient resolution happens server-side per entity at send time.


    // ── Effects ────────────────────────────────────────────────────────────────
    React.useEffect(() => {
        fetchSmsBalanceAction(activeOrganizationId).then(r => { if (r.success) setSmsBalance(r.balance ?? 0); });
    }, [activeOrganizationId]);

    // Keep sender profile sentinel in sync with active channel
    React.useEffect(() => {
        if (watchedChannel === 'whatsapp') {
            if (watchedSenderProfileId !== 'whatsapp') {
                setValue('senderProfileId', 'whatsapp');
            }
        } else if (!watchedSenderProfileId || watchedSenderProfileId === 'whatsapp') {
            setValue('senderProfileId', 'default');
        }
    }, [watchedChannel, watchedSenderProfileId, setValue]);

    React.useEffect(() => {
        getSystemDispatchGovernanceAction()
            .then(res => {
                if (res.success && res.config?.highVolumeThreshold) {
                    setBlastThreshold(res.config.highVolumeThreshold);
                }
            })
            .catch(() => {});
    }, []);

    React.useEffect(() => {
        if (!searchParams) return;
        const r = searchParams.get('recipient');
        if (r) setValue('recipient', r);

        const entityIdParam = searchParams.get('entityId');
        if (entityIdParam) {
            setValue('entityId', entityIdParam);
            setValue('selectedEntityIds', [entityIdParam]);
        }
        
        // Parse contactRoles from directory link and pre-populate contact type filter
        const rolesParam = searchParams.get('contactRoles');
        if (rolesParam) {
            const roles = rolesParam.split(',').filter(Boolean);
            if (roles.length > 0) {
                // Map directory role filter keys to composer contactTypeFilter keys
                const typeFilterKeys = roles.filter(r => r !== 'primary' && r !== 'signatories')
                    .map(r => r.startsWith('role:') ? r.substring(5) : r);
                if (typeFilterKeys.length > 0) {
                    setValue('contactTypeFilter', typeFilterKeys);
                }
                // If primary or signatories is in roles, set contactScope accordingly
                if (roles.includes('primary')) {
                    setValue('contactScope', 'primary');
                } else if (roles.includes('signatories') || roles.includes('signatory')) {
                    setValue('contactScope', 'signatories');
                } else {
                    setValue('contactScope', 'all');
                }
            }
        }
    }, [searchParams, setValue]);

    React.useEffect(() => {
        if (!searchParams || !firestore) return;
        const templateId = searchParams.get('templateId');
        if (templateId) {
            const fetchTemplateOnMount = async () => {
                try {
                    const { doc, getDoc } = await import('firebase/firestore');
                    const tDoc = await getDoc(doc(firestore, 'message_templates', templateId));
                    if (tDoc.exists()) {
                        const template = { id: tDoc.id, ...tDoc.data() } as MessageTemplate;
                        setValue('templateId', template.id);
                        setValue('messageSourceType', 'template');
                        if (template.channel === 'email' || template.channel === 'sms' || template.channel === 'whatsapp') {
                            setValue('channel', template.channel);
                        }
                        setSelectedTemplate(template);
                        setStep(3); // Go straight to audience definition
                    }
                } catch (err) {
                    console.error("Failed to load template on mount:", err);
                }
            };
            fetchTemplateOnMount();
        }
    }, [searchParams, firestore, setValue]);

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
                (res.data.answers as SurveyAnswerItem[] | undefined)?.forEach((a) => setValue(`variables.${a.questionId}`, typeof a.value === 'object' ? JSON.stringify(a.value) : String(a.value)));
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
                const primary = contacts.find((c: { isPrimary?: boolean; name?: string; email?: string; phone?: string }) => Boolean(c.isPrimary)) || contacts[0];
                const contactName = primary?.name || res.data.displayName || '';
                setSampleVariables({
                    name: res.data.displayName || res.data.name || '',
                    school_name: res.data.displayName || res.data.name || '',
                    email: res.data.primaryEmail || primary?.email || '',
                    phone: res.data.primaryPhone || primary?.phone || '',
                    contact_name: contactName,
                    first_name: (contactName || '').split(' ')[0] || '',
                });
            }
        });
    }, [step, watchedSelectedEntityIds, activeWorkspace?.id]);

    // Load variables when template is selected
    React.useEffect(() => {
        if (!activeWorkspaceId) return;
        
        const loadVars = async () => {
            const res = await getWorkspaceVariablesAction(activeWorkspaceId);
            if (res.success && res.variables) {
                // Filter by context if selectedTemplate exists
                if (selectedTemplate) {
                    const filtered = res.variables.filter(v => 
                        v.context === 'common' || v.context === selectedTemplate.variableContext
                    );
                    setAvailableVariables(filtered);
                } else {
                    setAvailableVariables(res.variables);
                }
            } else {
                // Fallback to static if action fails
                const fallback = getVariablesForContext(selectedTemplate?.variableContext || 'common');
                setAvailableVariables(fallback);
            }
        };

        loadVars();
    }, [activeWorkspaceId, selectedTemplate]);
    
    // Sync selectedTemplate when templateId changes (e.g. on mount or via form)
    React.useEffect(() => {
        if (!watchedTemplateId || (selectedTemplate && selectedTemplate.id === watchedTemplateId)) return;
        
        // If we don't have the template object yet, fetch it
        const fetchTemplate = async () => {
            try {
                const { doc, getDoc } = await import('firebase/firestore');
                const tDoc = await getDoc(doc(firestore, 'message_templates', watchedTemplateId));
                if (tDoc.exists()) {
                    setSelectedTemplate({ id: tDoc.id, ...tDoc.data() } as MessageTemplate);
                }
            } catch (err) {
                console.error("Failed to fetch template for sync:", err);
            }
        };
        fetchTemplate();
    }, [watchedTemplateId, firestore, selectedTemplate]);

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = (ev.target?.result as string) || '';
            const rows = text.split('\n').filter(r => r.trim());
            if (rows.length < 2) { toast({ variant: 'destructive', title: 'Invalid CSV' }); return; }
            const headers = rows[0].split(',').map(h => h.trim());
            const data: CSVRecord[] = rows.slice(1).map(row => {
                const vals = row.split(',').map(v => v.trim());
                return headers.reduce<CSVRecord>((o, h, i) => { o[h] = vals[i] || ''; return o; }, {});
            });
            setCsvHeaders(headers); setCsvData(data);
            const mapping: Record<string, string> = {};
            const templateVars = selectedTemplate?.declaredVariables || selectedTemplate?.variables || [];
            templateVars.forEach(v => {
                const m = headers.find(h => h.toLowerCase() === v.toLowerCase());
                if (m) mapping[v] = m;
            });
            setColumnMapping(mapping);
            toast({ title: 'CSV Processed', description: `${data.length} records loaded.` });
        };
        reader.readAsText(file);
    };

    const _handleAiRefine = async () => {
        if (!selectedTemplate || isRefining) return;
        setIsRefining(true);
        try {
            const result = await refineMessage({ text: selectedTemplate.body, tone: selectedTone, channel: contactResolutionChannel(watchedChannel) });
            setValue('variables.ai_refined_body', result.refinedText);
            toast({ title: 'AI Refinement Applied' });
        } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : 'Refinement failed';
            toast({ variant: 'destructive', title: 'Refinement Failed', description: errMsg });
        } finally { setIsRefining(false); }
    };

    const startJobProcessing = async (id: string) => {
        setJobStatus('processing');
        setJobProgress(0);
        setJobProcessed(0);
        setJobFailed(0);

        // Fire-and-forget: kick off the background worker.
        // The server processes chunks via after() without requiring
        // this browser tab to remain open.
        processJobChunkBackground(id).catch((e) => {
            console.error('>>> [COMPOSER] Background worker init failed:', e);
        });

        // Passive listener: subscribe to job document for real-time updates.
        // This replaces the while-loop polling model entirely.
        const jobDocRef = doc(firestore, 'message_jobs', id);
        const unsubscribe = onSnapshot(jobDocRef, (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            const total = data.totalRecipients || 1;
            const processed = data.processed || 0;
            const progress = Math.round((processed / total) * 100);

            setJobTotal(total);
            setJobProcessed(processed);
            setJobFailed(data.failed || 0);
            setJobProgress(progress);
            setJobStatus(data.status);

            // Clean up listener when job finishes
            if (data.status === 'completed' || data.status === 'failed') {
                unsubscribe();
            }
        }, (error) => {
            console.error('>>> [COMPOSER] Job snapshot error:', error);
            setJobStatus('failed');
            unsubscribe();
        });
    };

    const onSubmit = async (data: FormData) => {
        if (!user) return;

        // GUARD: Only allow actual submission on Step 5
        if (step < 5) {
            // Check if we can progress (logic similar to NavFooter)
            if (step === 1) setStep(2);
            else if (step === 2) {
                if (data.messageSourceType === 'template' && !data.templateId) return;
                if (data.messageSourceType === 'new' && !data.customBody) return;
                setStep(3);
            }
            else if (step === 3) {
                if (data.audienceMode === 'entities') {
                    const hasEntities = audienceSource === 'individual' 
                        ? data.selectedEntityIds.length > 0 
                        : filteredRecipients.length > 0;
                    if (!hasEntities && data.mode === 'single') return;
                    if (data.mode === 'bulk' && !csvData.length) return;
                } else if (data.audienceMode === 'team') {
                    if (selectedTeamMembers.length === 0) return;
                } else if (data.audienceMode === 'adhoc') {
                    if (adhocContacts.filter(c => c.isValid).length === 0) return;
                }
                setStep(4);
            }
            else if (step === 4) setStep(5);
            return;
        }

        setIsSubmitting(true);
        const scheduledAt = data.isScheduled ? data.scheduledAt?.toISOString() : undefined;
        try {
            if (data.audienceMode === 'team') {
                const totalCount = selectedTeamMembers.length;
                if (!totalCount) throw new Error('Please select at least one teammate.');

                // High-volume team broadcast (> 50) template offloading via background worker (Rule 9)
                if (selectedTeamMembers.length > 50 && data.messageSourceType === 'template' && data.templateId) {
                    const bulkRecipients = selectedTeamMembers.map(m => ({
                        recipient: data.channel === 'email' ? m.email : (m.phone || ''),
                        displayName: m.name,
                        entityId: m.userId,
                        variables: {
                            ...data.variables,
                            contact_name: m.name,
                            user_name: m.name,
                            user_email: m.email,
                            user_role: m.role || 'Member',
                            user_department: m.department || '',
                            channel: data.channel,
                        },
                    })).filter(r => Boolean(r.recipient));

                    const { jobId } = await createBulkMessageJob({
                        templateId: data.templateId,
                        senderProfileId: data.senderProfileId!,
                        recipients: bulkRecipients,
                        userId: user.uid,
                    });
                    setStep(6);
                    startJobProcessing(jobId);
                    return;
                }

                setIsSending(true);
                setSendProgress({ sent: 0, total: totalCount, currentEntity: '' });

                interface FailedEntity {
                    entityId: string;
                    entityName: string;
                    contactName?: string;
                    contactDetail?: string;
                    error: string;
                }
                interface SendResults {
                    success: boolean;
                    totalSent: number;
                    totalFailed: number;
                    failedEntities: FailedEntity[];
                    logIds: string[];
                }

                const results: SendResults = { success: true, totalSent: 0, totalFailed: 0, failedEntities: [], logIds: [] };
                const { sendRawMessage, sendMessage } = await import('@/lib/messaging-engine');

                for (let i = 0; i < selectedTeamMembers.length; i++) {
                    const m = selectedTeamMembers[i];
                    const recipient = data.channel === 'email' ? m.email : m.phone;
                    setSendProgress(p => ({ ...p, currentEntity: m.name }));

                    if (!recipient) {
                        results.totalFailed++;
                        results.failedEntities.push({
                            entityId: m.userId,
                            entityName: 'Internal Team',
                            contactName: m.name,
                            error: `Missing contact detail (${data.channel === 'email' ? 'email' : 'phone'}).`,
                        });
                        setSendProgress(p => ({ ...p, sent: i + 1 }));
                        continue;
                    }

                    try {
                        let res: { success: boolean; error?: string; logId?: string };
                        const teamVariables: Record<string, unknown> = {
                            ...data.variables,
                            contact_name: m.name,
                            user_name: m.name,
                            user_email: m.email,
                            user_role: m.role || 'Member',
                            user_department: m.department || '',
                            channel: data.channel,
                        };

                        if (data.messageSourceType === 'template') {
                            res = await sendMessage({
                                templateId: data.templateId!,
                                senderProfileId: data.senderProfileId!,
                                recipient,
                                variables: teamVariables,
                                workspaceId: activeWorkspace?.id,
                                scheduledAt,
                                entityId: m.userId,
                            });
                        } else if (data.channel === 'whatsapp') {
                            res = { success: false, error: 'WhatsApp requires selecting an approved template.' };
                        } else {
                            res = await sendRawMessage({
                                channel: data.channel,
                                recipient,
                                body: data.customBody!,
                                subject: data.channel === 'email' ? data.customSubject : undefined,
                                senderProfileId: data.senderProfileId,
                                variables: teamVariables,
                                workspaceIds: [activeWorkspace?.id].filter(Boolean) as string[],
                                scheduledAt,
                            });
                        }

                        if (res.success) {
                            results.totalSent++;
                            if (res.logId) results.logIds.push(res.logId);
                        } else {
                            results.totalFailed++;
                            results.failedEntities.push({
                                entityId: m.userId,
                                entityName: 'Internal Team',
                                contactName: m.name,
                                contactDetail: recipient,
                                error: res.error || 'Unknown error',
                            });
                        }
                    } catch (e: unknown) {
                        results.totalFailed++;
                        results.failedEntities.push({
                            entityId: m.userId,
                            entityName: 'Internal Team',
                            contactName: m.name,
                            contactDetail: recipient,
                            error: e instanceof Error ? e.message : 'Unknown error',
                        });
                    }

                    setSendProgress(p => ({ ...p, sent: i + 1 }));
                    if (i < selectedTeamMembers.length - 1) await new Promise(r => setTimeout(r, 250));
                }

                setIsSending(false);
                setSendSummary(results);
                setShowSummaryDialog(true);
                if (results.totalSent > 0) {
                    setStep(1);
                    form.reset();
                    setSelectedTeamMembers([]);
                }
            } else if (data.audienceMode === 'adhoc') {
                const validAdHoc = adhocContacts.filter(c => c.isValid);
                if (!validAdHoc.length) throw new Error('Please provide at least one valid recipient.');

                if (validAdHoc.length > 50 && data.messageSourceType === 'template' && data.templateId) {
                    const bulkRecipients = validAdHoc.map(item => ({
                        recipient: item.target,
                        displayName: item.displayName,
                        variables: {
                            ...data.variables,
                            contact_name: item.displayName || 'Direct Recipient',
                            ...(item.customVars || {}),
                            channel: data.channel,
                        },
                    }));
                    const { jobId } = await createBulkMessageJob({
                        templateId: data.templateId,
                        senderProfileId: data.senderProfileId!,
                        recipients: bulkRecipients,
                        userId: user.uid,
                    });
                    setStep(6);
                    startJobProcessing(jobId);
                    return;
                }

                setIsSending(true);
                setSendProgress({ sent: 0, total: validAdHoc.length, currentEntity: '' });

                interface FailedEntity {
                    entityId: string;
                    entityName: string;
                    contactName?: string;
                    contactDetail?: string;
                    error: string;
                }
                interface SendResults {
                    success: boolean;
                    totalSent: number;
                    totalFailed: number;
                    failedEntities: FailedEntity[];
                    logIds: string[];
                }

                const results: SendResults = { success: true, totalSent: 0, totalFailed: 0, failedEntities: [], logIds: [] };
                const { sendRawMessage, sendMessage } = await import('@/lib/messaging-engine');

                for (let i = 0; i < validAdHoc.length; i++) {
                    const item = validAdHoc[i];
                    const recipient = item.target;
                    setSendProgress(p => ({ ...p, currentEntity: item.displayName || item.target }));

                    try {
                        let res: { success: boolean; error?: string; logId?: string };
                        const adhocVariables: Record<string, unknown> = {
                            ...data.variables,
                            contact_name: item.displayName || 'Direct Recipient',
                            ...(item.customVars || {}),
                            channel: data.channel,
                        };

                        if (data.messageSourceType === 'template') {
                            res = await sendMessage({
                                templateId: data.templateId!,
                                senderProfileId: data.senderProfileId!,
                                recipient,
                                variables: adhocVariables,
                                workspaceId: activeWorkspace?.id,
                                scheduledAt,
                            });
                        } else if (data.channel === 'whatsapp') {
                            res = { success: false, error: 'WhatsApp requires selecting an approved template.' };
                        } else {
                            res = await sendRawMessage({
                                channel: data.channel,
                                recipient,
                                body: data.customBody!,
                                subject: data.channel === 'email' ? data.customSubject : undefined,
                                senderProfileId: data.senderProfileId,
                                variables: adhocVariables,
                                workspaceIds: [activeWorkspace?.id].filter(Boolean) as string[],
                                scheduledAt,
                            });
                        }

                        if (res.success) {
                            results.totalSent++;
                            if (res.logId) results.logIds.push(res.logId);
                        } else {
                            results.totalFailed++;
                            results.failedEntities.push({
                                entityId: item.id,
                                entityName: item.displayName || 'Direct Contact',
                                contactName: item.displayName,
                                contactDetail: recipient,
                                error: res.error || 'Unknown error',
                            });
                        }
                    } catch (e: unknown) {
                        results.totalFailed++;
                        results.failedEntities.push({
                            entityId: item.id,
                            entityName: item.displayName || 'Direct Contact',
                            contactName: item.displayName,
                            contactDetail: recipient,
                            error: e instanceof Error ? e.message : 'Unknown error',
                        });
                    }

                    setSendProgress(p => ({ ...p, sent: i + 1 }));
                    if (i < validAdHoc.length - 1) await new Promise(r => setTimeout(r, 250));
                }

                setIsSending(false);
                setSendSummary(results);
                setShowSummaryDialog(true);
                if (results.totalSent > 0) {
                    setStep(1);
                    form.reset();
                    setAdhocContacts([]);
                }
            } else if (data.mode === 'single') {
                const totalCount = audienceSource === 'individual' ? data.selectedEntityIds.length : filteredRecipients.length;
                if (!totalCount) throw new Error('Please select at least one recipient.');
                setIsSending(true);
                setSendProgress({ sent: 0, total: totalCount, currentEntity: '' });

                interface FailedEntity {
                    entityId: string;
                    entityName: string;
                    contactName?: string;
                    contactDetail?: string;
                    error: string;
                }
                interface SendResults {
                    success: boolean;
                    totalSent: number;
                    totalFailed: number;
                    failedEntities: FailedEntity[];
                    logIds: string[];
                }

                const results: SendResults = { success: true, totalSent: 0, totalFailed: 0, failedEntities: [], logIds: [] };

                if (audienceSource === 'individual') {
                    for (let i = 0; i < data.selectedEntityIds.length; i++) {
                        const entityId = data.selectedEntityIds[i];
                        let entityName = 'Unknown Entity';
                        setSendProgress(p => ({ ...p, currentEntity: entityId }));
                        try {
                            // Resolve the display name server-side (no client entity cache).
                            const contactRes = await resolveContact(entityId, activeWorkspace?.id || '');
                            entityName = contactRes?.name || 'Unknown Entity';

                            const recipients = await resolveRecipientContacts({
                                entityId, workspaceId: activeWorkspace?.id,
                                contactScope: data.contactScope,
                                contactTypeFilter: data.contactTypeFilter,
                                channel: contactResolutionChannel(data.channel),
                            });
                            if (!recipients.length) { 
                                results.totalFailed++; 
                                results.failedEntities.push({ 
                                    entityId, 
                                    entityName,
                                    error: 'No contacts for scope/channel.' 
                                }); 
                                continue; 
                            }
                            
                            const { sendRawMessage, sendMessage } = await import('@/lib/messaging-engine');

                            for (const r of recipients) {
                                let res: { success: boolean; error?: string; logId?: string };
                                const recipient = r.contact;
                                if (data.messageSourceType === 'template') {
                                    res = await sendMessage({
                                        templateId: data.templateId!, senderProfileId: data.senderProfileId!,
                                        recipient, variables: { ...data.variables, channel: data.channel },
                                        workspaceId: activeWorkspace?.id, scheduledAt, entityId,
                                    });
                                } else if (data.channel === 'whatsapp') {
                                    // WhatsApp free-form is only valid inside an open 24h session and has
                                    // no raw composer path in v1 — require an approved template.
                                    res = { success: false, error: 'WhatsApp requires selecting an approved template.' };
                                } else {
                                    res = await sendRawMessage({
                                        channel: data.channel, recipient,
                                        body: data.customBody!,
                                        subject: data.channel === 'email' ? data.customSubject : undefined,
                                        senderProfileId: data.senderProfileId,
                                        variables: { ...data.variables, channel: data.channel },
                                        workspaceIds: [activeWorkspace?.id].filter(Boolean) as string[],
                                        scheduledAt,
                                    });
                                }

                                if (res.success) {
                                    results.totalSent++;
                                    if (res.logId) results.logIds.push(res.logId);
                                    if (entityId && activeWorkspace?.id) {
                                        updateEntityLastContactedAt(entityId, activeWorkspace.id).catch(() => {});
                                    }
                                }
                                else { 
                                    results.totalFailed++; 
                                    results.failedEntities.push({ 
                                        entityId, 
                                        entityName: r.entityName || entityName,
                                        contactName: r.contactName,
                                        contactDetail: recipient,
                                        error: res.error || 'Unknown' 
                                    }); 
                                }
                            }
                        } catch (e: unknown) {
                            results.totalFailed++;
                            results.failedEntities.push({
                                entityId,
                                entityName,
                                error: e instanceof Error ? e.message : 'Unknown error'
                            });
                        }
                        setSendProgress(p => ({ ...p, sent: i + 1 }));
                        if (i < data.selectedEntityIds.length - 1) await new Promise(r => setTimeout(r, 500));
                    }
                } else {
                    const { sendRawMessage, sendMessage } = await import('@/lib/messaging-engine');
                    for (let i = 0; i < filteredRecipients.length; i++) {
                        const r = filteredRecipients[i];
                        const entityId = r.entityId || '';
                        const entityName = r.entityName || 'Unknown Entity';
                        const recipient = data.channel === 'email' ? r.email : r.phone;
                        setSendProgress(p => ({ ...p, currentEntity: entityId }));

                        if (!recipient) {
                            results.totalFailed++;
                            results.failedEntities.push({
                                entityId,
                                entityName,
                                contactName: r.name,
                                error: 'Missing contact detail (email/phone).'
                            });
                            setSendProgress(p => ({ ...p, sent: i + 1 }));
                            continue;
                        }

                        try {
                            let res: { success: boolean; error?: string; logId?: string };
                            if (data.messageSourceType === 'template') {
                                res = await sendMessage({
                                    templateId: data.templateId!, senderProfileId: data.senderProfileId!,
                                    recipient, variables: { ...data.variables, channel: data.channel },
                                    workspaceId: activeWorkspace?.id, scheduledAt, entityId,
                                });
                            } else if (data.channel === 'whatsapp') {
                                res = { success: false, error: 'WhatsApp requires selecting an approved template.' };
                            } else {
                                res = await sendRawMessage({
                                    channel: data.channel, recipient,
                                    body: data.customBody!,
                                    subject: data.channel === 'email' ? data.customSubject : undefined,
                                    senderProfileId: data.senderProfileId,
                                    variables: { ...data.variables, channel: data.channel },
                                    workspaceIds: [activeWorkspace?.id].filter(Boolean) as string[],
                                    scheduledAt,
                                });
                            }

                            if (res.success) {
                                results.totalSent++;
                                if (res.logId) results.logIds.push(res.logId);
                                if (entityId && activeWorkspace?.id) {
                                    updateEntityLastContactedAt(entityId, activeWorkspace.id).catch(() => {});
                                }
                            } else {
                                results.totalFailed++;
                                results.failedEntities.push({
                                    entityId,
                                    entityName,
                                    contactName: r.name,
                                    contactDetail: recipient,
                                    error: res.error || 'Unknown'
                                });
                            }
                        } catch (e: unknown) {
                            results.totalFailed++;
                            results.failedEntities.push({
                                entityId,
                                entityName,
                                contactName: r.name,
                                contactDetail: recipient,
                                error: e instanceof Error ? e.message : 'Unknown error'
                            });
                        }
                        setSendProgress(p => ({ ...p, sent: i + 1 }));
                        if (i < filteredRecipients.length - 1) await new Promise(r => setTimeout(r, 500));
                    }
                }
                setIsSending(false); setSendSummary(results); setShowSummaryDialog(true);
                if (results.totalSent > 0) { setStep(1); form.reset(); }
            } else {
                if (!csvData.length) throw new Error('No CSV data found.');
                const recipients = csvData.map(row => {
                    const vars: Record<string, unknown> = { ...data.variables };
                    Object.entries(columnMapping).forEach(([tv, cv]) => { vars[tv] = row[cv]; });
                    return { recipient: row.recipient || row.phone || row.email || '', variables: vars };
                });
                const { jobId } = await createBulkMessageJob({ templateId: data.templateId!, senderProfileId: data.senderProfileId!, recipients, userId: user.uid });
                setStep(6); startJobProcessing(jobId);
            }
        } catch (e: unknown) {
            toast({ variant: 'destructive', title: 'Failed', description: e instanceof Error ? e.message : 'Unknown error' });
            setIsSending(false);
        } finally { setIsSubmitting(false); }
    };

    // ── Export Handlers for Failed Deliveries (Rule 10 Maintainer Documentation) ──
    /**
     * Exports failed delivery incident logs as RFC 4180 compliant CSV.
     */
    const handleExportCSV = React.useCallback(() => {
        if (!sendSummary?.failedEntities || sendSummary.failedEntities.length === 0) {
            toast({ title: 'No failed records', description: 'There are no failed dispatches to export.' });
            return;
        }
        setExportingType('csv');
        setIsExporting(true);
        try {
            const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
            const headers = ['Entity ID', 'Entity Name', 'Contact Name', 'Recipient Detail', 'Channel', 'Failure Reason', 'Dispatched At'];
            
            // Neutralize spreadsheet formula injection (CWE-1236 / OWASP)
            const sanitizeCSVCell = (val: unknown): string => {
                const str = String(val ?? '');
                const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
                return `"${sanitized.replace(/"/g, '""')}"`;
            };

            const rows = sendSummary.failedEntities.map((item) => [
                item.entityId || '',
                item.entityName || '',
                item.contactName || '',
                item.contactDetail || '',
                watchedChannel.toUpperCase(),
                item.error || '',
                format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
            ]);

            const csvContent = [
                headers.map(sanitizeCSVCell).join(','),
                ...rows.map((r) => r.map(sanitizeCSVCell).join(',')),
            ].join('\r\n');

            // Prepend \uFEFF for proper UTF-8 decoding in Excel & Google Sheets
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `failed_deliveries_${watchedChannel}_${timestamp}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast({ title: 'CSV Exported', description: `Exported ${sendSummary.failedEntities.length} failed delivery logs.` });
        } catch (err: unknown) {
            toast({ title: 'Export Failed', description: getErrorMessage(err), variant: 'destructive' });
        } finally {
            setIsExporting(false);
            setExportingType(null);
        }
    }, [sendSummary, watchedChannel, toast]);

    /**
     * Exports failed delivery incident logs as formatted JSON with system metadata.
     */
    const handleExportJSON = React.useCallback(() => {
        if (!sendSummary?.failedEntities || sendSummary.failedEntities.length === 0) {
            toast({ title: 'No failed records', description: 'There are no failed dispatches to export.' });
            return;
        }
        setExportingType('json');
        setIsExporting(true);
        try {
            const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
            const exportData = {
                exportTimestamp: new Date().toISOString(),
                organization: currentOrganization?.name || 'SmartSapp CRM',
                workspace: activeWorkspace?.name || 'Default Workspace',
                channel: watchedChannel,
                summary: {
                    totalSent: sendSummary.totalSent,
                    totalFailed: sendSummary.totalFailed,
                    success: sendSummary.success,
                },
                failedEntities: sendSummary.failedEntities.map((f) => ({
                    entityId: f.entityId,
                    entityName: f.entityName,
                    contactName: f.contactName || null,
                    contactDetail: f.contactDetail || null,
                    error: f.error,
                })),
            };

            const jsonStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `failed_deliveries_${watchedChannel}_${timestamp}.json`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast({ title: 'JSON Exported', description: `Exported ${sendSummary.failedEntities.length} failed delivery logs.` });
        } catch (err: unknown) {
            toast({ title: 'Export Failed', description: getErrorMessage(err), variant: 'destructive' });
        } finally {
            setIsExporting(false);
            setExportingType(null);
        }
    }, [sendSummary, currentOrganization, activeWorkspace, watchedChannel, toast]);

    /**
     * Exports failed delivery incident logs as a presentation-grade executive PDF audit report.
     */
    const handleExportPDF = React.useCallback(async () => {
        if (!sendSummary?.failedEntities || sendSummary.failedEntities.length === 0) {
            toast({ title: 'No failed records', description: 'There are no failed dispatches to export.' });
            return;
        }
        setExportingType('pdf');
        setIsExporting(true);
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            });

            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 14;
            const contentWidth = pageWidth - margin * 2; // 182mm
            let y = margin;

            const checkPageBreak = (neededHeight: number) => {
                if (y + neededHeight > pageHeight - 16) {
                    doc.addPage();
                    y = margin;
                    // Mini continuation banner on subsequent pages
                    doc.setFillColor(15, 23, 42); // slate-900
                    doc.rect(margin, y, contentWidth, 7, 'F');
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(8);
                    doc.setTextColor(248, 250, 252);
                    doc.text(`Failed Deliveries Audit Report — Continued`, margin + 4, y + 4.8);
                    y += 11;
                    drawTableHeader(y);
                    y += 7;
                }
            };

            const drawTableHeader = (yPos: number) => {
                doc.setFillColor(241, 245, 249); // slate-100
                doc.setDrawColor(203, 213, 225); // slate-300
                doc.rect(margin, yPos, contentWidth, 7, 'FD');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                doc.setTextColor(51, 65, 85); // slate-700
                doc.text('#', margin + 2, yPos + 4.5);
                doc.text('ENTITY / RECIPIENT', margin + 8, yPos + 4.5);
                doc.text('CONTACT DETAIL', margin + 70, yPos + 4.5);
                doc.text('FAILURE REASON / ERROR', margin + 116, yPos + 4.5);
            };

            // Header Background Banner (Slate-900)
            doc.setFillColor(15, 23, 42);
            doc.roundedRect(margin, y, contentWidth, 24, 2.5, 2.5, 'F');

            // Header Title
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('FAILED DISPATCH AUDIT REPORT', margin + 6, y + 7.5);

            // Subtitle / Org
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(203, 213, 225); // slate-300
            const orgInfo = `${currentOrganization?.name || 'SmartSapp CRM'} • Channel: ${watchedChannel.toUpperCase()} • ${format(new Date(), 'PPpp')}`;
            doc.text(orgInfo, margin + 6, y + 14);

            // Workspace subtitle
            doc.setFontSize(7.5);
            doc.setTextColor(148, 163, 184); // slate-400
            doc.text(`Workspace: ${activeWorkspace?.name || 'Active Workspace'} • Total Failed Records: ${sendSummary.failedEntities.length}`, margin + 6, y + 19.5);

            y += 28;

            // Metric summary cards
            const cardWidth = (contentWidth - 5) / 2;

            // Total Sent Box
            doc.setFillColor(240, 253, 244); // emerald-50
            doc.setDrawColor(187, 247, 208); // emerald-200
            doc.roundedRect(margin, y, cardWidth, 13, 2, 2, 'FD');
            doc.setTextColor(22, 101, 52); // emerald-800
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text('SUCCESSFULLY DELIVERED', margin + 4, y + 4.5);
            doc.setFontSize(11);
            doc.text(String(sendSummary.totalSent), margin + 4, y + 10);

            // Total Failed Box
            doc.setFillColor(254, 242, 242); // rose-50
            doc.setDrawColor(254, 202, 202); // rose-200
            doc.roundedRect(margin + cardWidth + 5, y, cardWidth, 13, 2, 2, 'FD');
            doc.setTextColor(153, 27, 27); // rose-800
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text('FAILED DISPATCHES', margin + cardWidth + 9, y + 4.5);
            doc.setFontSize(11);
            doc.text(String(sendSummary.totalFailed), margin + cardWidth + 9, y + 10);

            y += 17;

            // Section Title: Incident Logs
            doc.setTextColor(15, 23, 42); // slate-900
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(`Incident Logs (${sendSummary.failedEntities.length} Total)`, margin, y);
            y += 4;

            // Draw Table Header
            drawTableHeader(y);
            y += 7;

            // Table Rows
            sendSummary.failedEntities.forEach((item, idx) => {
                const entityLabel = item.entityName + (item.contactName && item.contactName !== item.entityName ? ` (${item.contactName})` : '');
                const detail = item.contactDetail || '—';
                const rawError = item.error || 'Unknown dispatch error';
                // Safeguard against extreme stack traces overflowing single-page bounds
                const errorMsg = rawError.length > 350 ? `${rawError.slice(0, 347)}...` : rawError;

                const splitEntity = doc.splitTextToSize(entityLabel, 58);
                const splitDetail = doc.splitTextToSize(detail, 42);
                const splitError = doc.splitTextToSize(errorMsg, 62);
                const maxLines = Math.max(splitEntity.length, splitDetail.length, splitError.length, 1);
                const rowHeight = Math.max(7, maxLines * 3.6 + 3);

                checkPageBreak(rowHeight);

                // Alternating row background
                if (idx % 2 === 0) {
                    doc.setFillColor(255, 255, 255);
                } else {
                    doc.setFillColor(248, 250, 252); // slate-50
                }
                doc.setDrawColor(226, 232, 240); // slate-200
                doc.rect(margin, y, contentWidth, rowHeight, 'FD');

                // Text cells
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(100, 116, 139); // slate-500
                doc.text(String(idx + 1), margin + 2, y + 4.5);

                doc.setFont('helvetica', 'bold');
                doc.setTextColor(15, 23, 42); // slate-900
                doc.text(splitEntity, margin + 8, y + 4.5);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(71, 85, 105); // slate-600
                doc.text(splitDetail, margin + 70, y + 4.5);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(190, 18, 60); // rose-700
                doc.text(splitError, margin + 116, y + 4.5);

                y += rowHeight;
            });

            // Update footer page numbers
            const totalPages = doc.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(148, 163, 184); // slate-400
                doc.text('SmartSapp CRM • Messaging Engine Audit', margin, pageHeight - 6);
                doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
            }

            const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
            doc.save(`failed_deliveries_${watchedChannel}_${timestamp}.pdf`);
            toast({ title: 'PDF Exported', description: 'Failed delivery audit report PDF downloaded.' });
        } catch (err: unknown) {
            toast({ title: 'PDF Export Failed', description: getErrorMessage(err), variant: 'destructive' });
        } finally {
            setIsExporting(false);
            setExportingType(null);
        }
    }, [sendSummary, currentOrganization, activeWorkspace, watchedChannel, toast]);

    // ── Stepper UI ─────────────────────────────────────────────────────────────


    // ── RENDER ─────────────────────────────────────────────────────────────────
    return (
        <div className={cn("space-y-6 mx-auto transition-all duration-300 w-full", step === 5 ? "max-w-7xl" : "max-w-4xl")}>
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
                                <div className="grid grid-cols-3 gap-3">
                                    {([['email', 'Email', Mail], ['sms', 'SMS', Smartphone], ['whatsapp', 'WhatsApp', MessageCircle]] as const).map(([val, label, Icon]) => (
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
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-600 dark:text-blue-400">
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
                                            <MessagingTemplateSelector 
                                                category={composerContext?.category || 'general'}
                                                recipientType="entity"
                                                channel={watchedChannel}
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                onSelect={setSelectedTemplate}
                                                placeholder="Choose message blueprint..."
                                            />
                                        )} />
                                    </div>

                                </div>
                            ) : (
                                /* Write new – placeholder for future rich editor */
                                <div className="p-8 rounded-2xl border-2 border-dashed border-border/50 text-center space-y-3">
                                    <Wand2 className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                                    <p className="text-sm font-semibold text-muted-foreground">Rich composer coming soon.</p>
                                    <p className="text-xs text-muted-foreground/60">For now, use a template or create one via &quot;New Template&quot;.</p>
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
                            {/* Audience Channel Selector: 3 primary tabs */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">Audience Channel</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-muted/30 p-1.5 rounded-xl border border-border/50">
                                    {[
                                        { val: 'entities' as const, label: 'Workspace Entities', icon: Building, desc: 'Clients & organizations' },
                                        { val: 'team' as const, label: 'Internal Team', icon: Users, desc: 'Teammates & staff' },
                                        { val: 'adhoc' as const, label: 'Direct & Spreadsheet', icon: FileText, desc: 'Pills or Excel/CSV' },
                                    ].map(({ val, label, icon: Icon, desc }) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setValue('audienceMode', val, { shouldValidate: true })}
                                            className={cn(
                                                'flex flex-col items-start justify-center p-3 rounded-lg font-semibold text-xs transition-all active:scale-[0.98] min-h-[44px]',
                                                watchedAudienceMode === val
                                                    ? 'bg-card shadow-md text-primary border border-primary/20'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-4 w-4 shrink-0 text-primary" />
                                                <span className="font-bold text-xs">{label}</span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-normal mt-0.5">{desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Mode 1: Workspace Entities ── */}
                            {watchedAudienceMode === 'entities' && (
                                <div className="space-y-6">
                                    {/* Dispatch mode */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">Delivery Mode</Label>
                                        <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1.5 rounded-xl border border-border/50">
                                            {([['single', 'Targeted', Target], ['bulk', 'Broadcast (CSV)', Layers]] as const).map(([val, label, Icon]) => (
                                                <button key={val} type="button" onClick={() => setValue('mode', val)}
                                                    className={cn('flex items-center justify-center gap-2 h-10 rounded-lg font-semibold text-xs transition-all active:scale-[0.97]',
                                                        watchedMode === val ? 'bg-card shadow-md text-primary' : 'text-muted-foreground hover:text-foreground'
                                                    )}>
                                                    <Icon className="h-3.5 w-3.5" /> {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {watchedMode === 'single' ? (
                                        <div className="space-y-6">
                                            {/* Audience Source Selector */}
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">Audience Source</Label>
                                                <div className="grid grid-cols-3 gap-3">
                                                    {[
                                                        { value: 'individual' as const, icon: <User className="h-4 w-4" />, label: 'Individual Selection' },
                                                        { value: 'manual' as const, icon: <Filter className="h-4 w-4" />, label: 'Custom Filters' },
                                                        { value: 'saved' as const, icon: <BookmarkCheck className="h-4 w-4" />, label: 'Saved Audience' },
                                                    ].map((m) => (
                                                        <button
                                                            key={m.value}
                                                            type="button"
                                                            onClick={() => setAudienceSource(m.value)}
                                                            className={cn(
                                                                'flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-semibold text-xs h-11 active:scale-[0.97]',
                                                                audienceSource === m.value
                                                                    ? 'border-primary bg-primary/5 text-primary'
                                                                    : 'border-border hover:border-primary/20 text-muted-foreground'
                                                            )}
                                                        >
                                                            {m.icon}
                                                            {m.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {audienceSource === 'individual' ? (
                                                <div className="space-y-6">
                                                    {/* Entity selector — data is lifted to wizard level so it's always live */}
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">Individual Selection</Label>
                                                        <EntitySelector
                                                            channel={contactResolutionChannel(watchedChannel)}
                                                            selectedEntityIds={watchedSelectedEntityIds}
                                                            activeContactTypeFilter={watchedContactTypeFilter || []}
                                                            onContactTypeFilterChange={(keys) => setValue('contactTypeFilter', keys)}
                                                            onSelectionChange={(ids) => {
                                                                setValue('selectedEntityIds', ids, { shouldValidate: true });
                                                                setValue('entityId', ids.length === 1 ? ids[0] : '');
                                                            }}
                                                        />
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
                                                                    <div key={s.id} onClick={() => setValue('contactScope', s.id as 'primary' | 'signatories' | 'all')}
                                                                        className={cn('cursor-pointer border-2 rounded-xl p-3.5 transition-all relative overflow-hidden active:scale-[0.98]',
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
                                                            {watchedContactTypeFilter && watchedContactTypeFilter.length > 0 && (
                                                                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs font-semibold text-primary">
                                                                    <Tag className="h-3.5 w-3.5 shrink-0" />
                                                                    Filtering to <span className="capitalize font-bold">{watchedContactTypeFilter.join(', ').replace(/_/g, ' ')}</span> contacts only.
                                                                    <button type="button" onClick={() => setValue('contactTypeFilter', [])} className="ml-auto hover:text-destructive">
                                                                        <X className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {watchedSelectedEntityIds.length === 0 && (
                                                        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                                                            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                                            <p className="text-xs font-semibold text-amber-800">Select at least one entity to continue.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : audienceSource === 'manual' ? (
                                                <div className="space-y-6">
                                                    {/* Assignee Filter */}
                                                    <div className="space-y-3">
                                                        <Label className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                                                            <User className="h-3.5 w-3.5" /> Filter by Assignee
                                                        </Label>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {[
                                                                { id: 'all', label: 'All Users' },
                                                                { id: 'mine', label: `My Assignees` },
                                                            ].map((opt) => (
                                                                <button
                                                                    key={opt.id}
                                                                    type="button"
                                                                    onClick={() => setAssigneeFilter(opt.id as 'all' | 'mine')}
                                                                    className={cn(
                                                                        'flex items-center justify-center p-3 rounded-xl border-2 transition-all font-semibold text-xs h-11 active:scale-[0.97]',
                                                                        assigneeFilter === opt.id
                                                                            ? 'border-primary bg-primary/5 text-primary'
                                                                            : 'border-border hover:border-primary/20 text-muted-foreground'
                                                                    )}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Contact Target Scope */}
                                                    <div className="space-y-3">
                                                        <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">Contact Target Scope</Label>
                                                        <div className="grid grid-cols-4 gap-2">
                                                            {[
                                                                { id: 'primary', label: 'Primary Contact' },
                                                                { id: 'signatories', label: 'Signatories' },
                                                                { id: 'roles', label: 'Specific Roles' },
                                                                { id: 'all', label: 'All Contacts' },
                                                            ].map((opt) => (
                                                                <button
                                                                    key={opt.id}
                                                                    type="button"
                                                                    onClick={() => setValue('contactScope', opt.id as 'primary' | 'signatories' | 'roles' | 'all')}
                                                                    className={cn('flex items-center justify-center p-3 rounded-xl border transition-all text-[11px] font-bold h-11 active:scale-[0.97]',
                                                                        watchedContactScope === opt.id
                                                                            ? 'bg-primary text-white border-primary shadow-sm'
                                                                            : 'bg-background hover:bg-muted/30 text-muted-foreground'
                                                                    )}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Roles list */}
                                                    {watchedContactScope === 'roles' && (
                                                        <div className="space-y-2 p-4 rounded-xl bg-muted/20 border border-dashed animate-in fade-in duration-300">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                                <Filter className="h-3.5 w-3.5" /> Select Roles
                                                            </span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {availableRoles.map((role) => {
                                                                    const isSelected = selectedRoles.includes(role.key);
                                                                    return (
                                                                        <button
                                                                            key={role.key}
                                                                            type="button"
                                                                            onClick={() => toggleRole(role.key)}
                                                                            className={cn('px-3 py-1 rounded-full text-[10px] font-bold border transition-all capitalize active:scale-[0.97]',
                                                                                isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-muted-foreground'
                                                                            )}
                                                                        >
                                                                            {role.label}
                                                                        </button>
                                                                    );
                                                                })}
                                                                {availableRoles.length === 0 && (
                                                                    <p className="text-xs text-muted-foreground italic">No contact roles found in workspace.</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Tag Filters */}
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                                                            <Tag className="h-3 w-3" /> Tag-Based Audience
                                                        </Label>
                                                        <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
                                                            <TagAudienceSelector
                                                                onChange={(seg) => {
                                                                    setTagSegment(seg);
                                                                    setValue('tagSegmentInclude', seg.includeTagIds);
                                                                    setValue('tagSegmentExclude', seg.excludeTagIds);
                                                                    setValue('tagSegmentLogic', seg.includeLogic);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-6">
                                                    {/* Saved Audience Select */}
                                                    <div className="space-y-3 p-4 rounded-xl bg-primary/5 border border-primary/20 animate-in fade-in duration-300">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                                            <Target className="h-3.5 w-3.5" /> Select Saved Audience
                                                        </span>
                                                        <Select value={savedAudienceId} onValueChange={handleSavedAudienceChange}>
                                                            <SelectTrigger className="h-11 rounded-xl font-bold text-xs bg-card border-border/50">
                                                                <SelectValue placeholder="Choose an audience..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                {(savedAudiences as SavedAudienceItem[]).map((a) => (
                                                                    <SelectItem key={a.id} value={a.id} className="text-xs font-semibold">
                                                                        {a.name} ({a.filters?.length || 0} filters)
                                                                    </SelectItem>
                                                                ))}
                                                                {savedAudiences.length === 0 && (
                                                                    <SelectItem value="_none" disabled className="text-xs text-muted-foreground italic">
                                                                        No saved audiences found
                                                                    </SelectItem>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Live matched recipients count */}
                                            {audienceSource !== 'individual' && (
                                                <div className="flex items-center gap-2 p-3.5 rounded-xl bg-muted/20 border border-border/50 text-xs font-semibold text-muted-foreground justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <Users className="h-4 w-4 text-primary" /> Matched Recipients (Live):
                                                    </span>
                                                    <Badge variant="secondary" className="font-bold text-xs gap-1.5 h-6">
                                                        {isResolvingRecipients && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                                                        {filteredRecipients.length} {filteredRecipients.length === 1 ? 'recipient' : 'recipients'}
                                                    </Badge>
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
                                                    <Button type="button" asChild variant="outline" className="rounded-xl font-semibold h-11 px-8 text-xs active:scale-[0.97]">
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
                                                            <Button type="button" variant="ghost" size="sm" onClick={() => setCsvData([])} className="h-7 text-destructive text-xs gap-1 active:scale-[0.97]">
                                                                <X className="h-3 w-3" /> Clear
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {(selectedTemplate?.declaredVariables || selectedTemplate?.variables || []).map(v => (
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
                                </div>
                            )}

                            {/* ── Mode 2: Internal Organization Team ── */}
                            {watchedAudienceMode === 'team' && (
                                <div className="space-y-4">
                                    <InternalUserAudienceSelector
                                        channel={watchedChannel}
                                        workspaceId={activeWorkspaceId}
                                        selectedUsers={selectedTeamMembers}
                                        onChange={setSelectedTeamMembers}
                                    />
                                </div>
                            )}

                            {/* ── Mode 3: Direct Ad-Hoc & Spreadsheet Contacts ── */}
                            {watchedAudienceMode === 'adhoc' && (
                                <div className="space-y-6">
                                    {/* Sub-tab switcher: Pills Input vs Spreadsheet Upload */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                                        <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-xl border border-border/50">
                                            <button
                                                type="button"
                                                onClick={() => setAdhocSubTab('pills')}
                                                className={cn(
                                                    'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all min-h-[44px] active:scale-[0.97]',
                                                    adhocSubTab === 'pills' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
                                                )}
                                            >
                                                <Code className="h-3.5 w-3.5" />
                                                <span>Delimited Text &amp; Pills</span>
                                                {adhocContacts.length > 0 && (
                                                    <Badge variant="secondary" className="text-[10px] ml-1">
                                                        {adhocContacts.length}
                                                    </Badge>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAdhocSubTab('spreadsheet')}
                                                className={cn(
                                                    'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all min-h-[44px] active:scale-[0.97]',
                                                    adhocSubTab === 'spreadsheet' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
                                                )}
                                            >
                                                <Table className="h-3.5 w-3.5" />
                                                <span>Spreadsheet (.xlsx, .csv)</span>
                                            </button>
                                        </div>

                                        {adhocContacts.length > 0 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setAdhocContacts([])}
                                                className="text-xs text-destructive hover:bg-destructive/10 min-h-[44px] active:scale-[0.97]"
                                            >
                                                <X className="h-3.5 w-3.5 mr-1" /> Clear Contacts
                                            </Button>
                                        )}
                                    </div>

                                    {adhocSubTab === 'pills' ? (
                                        <AdHocContactPillsInput
                                            channel={watchedChannel}
                                            items={adhocContacts}
                                            onChange={setAdhocContacts}
                                        />
                                    ) : (
                                        <SpreadsheetRecipientImporter
                                            channel={watchedChannel}
                                            declaredVariables={selectedTemplate?.declaredVariables || selectedTemplate?.variables || []}
                                            onImportComplete={(items, mapping) => {
                                                setAdhocContacts(items);
                                                setColumnMapping(mapping);
                                                setAdhocSubTab('pills');
                                                toast({
                                                    title: 'Spreadsheet Loaded',
                                                    description: `Imported ${items.filter(i => i.isValid).length} valid contacts ready for messaging.`,
                                                });
                                            }}
                                            onCancel={() => setAdhocSubTab('pills')}
                                        />
                                    )}
                                </div>
                            )}
                        </CardContent>
                        <NavFooter
                            onNext={() => setStep(4)}
                            onBack={() => setStep(2)}
                            isSubmitting={isSubmitting}
                            nextLabel="Next: Tags & Actions"
                            nextDisabled={
                                watchedAudienceMode === 'entities'
                                    ? (watchedMode === 'single'
                                        ? (audienceSource === 'individual' ? watchedSelectedEntityIds.length === 0 : filteredRecipients.length === 0)
                                        : !csvData.length)
                                    : watchedAudienceMode === 'team'
                                        ? selectedTeamMembers.length === 0
                                        : adhocContacts.filter(c => c.isValid).length === 0
                            }
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
                                <p className="text-[10px] text-muted-foreground/60">After sending, you&apos;ll be able to auto-tag recipients and trigger workflow automations.</p>
                            </div>
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">You can skip this step — it&apos;s optional. Tags and automations can also be applied manually after sending.</p>
                            </div>
                        </CardContent>
                        <NavFooter onNext={() => setStep(5)} onBack={() => setStep(3)} isSubmitting={isSubmitting} nextLabel="Next: Publish" />
                    </Card>
                )}

                {/* ── STEP 5: Publish & Dispatch Studio ─────────────────────── */}
                {step === 5 && (
                    <Card className="rounded-2xl border shadow-xl overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
                                        <Send className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-lg font-bold">Publish &amp; Dispatch</CardTitle>
                                            {composerContext?.category === 'surveys' && (
                                                <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5">
                                                    Survey Outreach
                                                </Badge>
                                            )}
                                        </div>
                                        <CardDescription className="text-xs font-medium text-muted-foreground/70">
                                            Configure sender identity, preview high-fidelity rendering, schedule, and send.
                                        </CardDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs font-semibold py-1 px-3">
                                        Step 5 of 5
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                {/* Left: Pre-Flight Dispatch Cockpit */}
                                <div className="lg:col-span-4 min-w-0">
                                    <PreFlightCockpit
                                        control={control}
                                        channel={watchedChannel}
                                        senderProfileId={watchedSenderProfileId}
                                        isScheduled={watchedIsScheduled}
                                        scheduledAt={watch('scheduledAt')}
                                        recipientCount={
                                            watchedAudienceMode === 'entities'
                                                ? (audienceSource === 'individual' ? watchedSelectedEntityIds.length : filteredRecipients.length)
                                                : watchedAudienceMode === 'team'
                                                    ? selectedTeamMembers.length
                                                    : adhocContacts.filter(c => c.isValid).length
                                        }
                                        audienceSource={audienceSource}
                                        audienceMode={watchedAudienceMode}
                                        activeOrganizationId={activeOrganizationId}
                                        activeWorkspaceId={activeWorkspaceId}
                                        onScheduleToggle={(scheduled) => setValue('isScheduled', scheduled, { shouldDirty: true })}
                                        onOpenTestModal={() => setIsTestModalOpen(true)}
                                        onSelectSenderProfile={setSelectedSenderProfile}
                                        highVolumeThreshold={blastThreshold}
                                    />
                                </div>

                                {/* Right: High-Fidelity Client Simulation Canvas */}
                                <div className="lg:col-span-8 min-w-0">
                                    <PublishPreviewCanvas
                                        template={selectedTemplate}
                                        variables={{
                                            ...sampleVariables,
                                            ...(getValues('variables') as Record<string, string | number | boolean | null | undefined>),
                                            ...(watchedAudienceMode === 'entities' && watchedMode === 'bulk' ? (csvData[0] as Record<string, string | number | boolean | null | undefined>) : {}),
                                            ...(watchedAudienceMode === 'adhoc' && adhocContacts.length > 0 ? (adhocContacts[0].customVars || {}) : {}),
                                        }}
                                        styles={styles || []}
                                        channel={watchedChannel}
                                        onOpenTestModal={() => setIsTestModalOpen(true)}
                                        activeSenderName={selectedSenderProfile?.name || currentOrganization?.name || 'SmartSapp'}
                                        activeSenderIdentifier={selectedSenderProfile?.identifier || currentOrganization?.email || 'info@smartsapp.com'}
                                        sampleRecipientName={
                                            watchedAudienceMode === 'team' && selectedTeamMembers.length > 0
                                                ? selectedTeamMembers[0].name
                                                : watchedAudienceMode === 'adhoc' && adhocContacts.length > 0
                                                    ? (adhocContacts.find(c => c.isValid)?.displayName || 'Direct Recipient')
                                                    : 'Jane Doe'
                                        }
                                        sampleRecipientIdentifier={
                                            watchedAudienceMode === 'team' && selectedTeamMembers.length > 0
                                                ? (watchedChannel === 'email' ? selectedTeamMembers[0].email : (selectedTeamMembers[0].phone || '+233 50 123 4567'))
                                                : watchedAudienceMode === 'adhoc' && adhocContacts.length > 0
                                                    ? (adhocContacts.find(c => c.isValid)?.target || (watchedChannel === 'email' ? 'jane.doe@example.com' : '+233 50 123 4567'))
                                                    : (watchedChannel === 'email' ? 'jane.doe@example.com' : '+233 50 123 4567')
                                        }
                                        smsBalance={smsBalance}
                                    />
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
                            nextDisabled={
                                !watch('senderProfileId') ||
                                (watchedAudienceMode === 'entities'
                                    ? (watchedMode === 'single'
                                        ? (audienceSource === 'individual' ? watchedSelectedEntityIds.length === 0 : filteredRecipients.length === 0)
                                        : !csvData.length)
                                    : watchedAudienceMode === 'team'
                                        ? selectedTeamMembers.length === 0
                                        : adhocContacts.filter(c => c.isValid).length === 0)
                            }
                            nextLabel={
                                watchedIsScheduled
                                    ? (watchedAudienceMode === 'team' ? 'Schedule Team Message' : watchedAudienceMode === 'adhoc' ? 'Schedule Message' : (watchedMode === 'single' ? 'Schedule Message' : 'Schedule Broadcast'))
                                    : (watchedAudienceMode === 'team' ? 'Send to Team' : watchedAudienceMode === 'adhoc' ? 'Send Message' : (watchedMode === 'single' ? 'Send Now' : 'Execute Broadcast'))
                            } 
                            onNext={
                                (watchedAudienceMode === 'entities'
                                    ? (audienceSource === 'individual' ? watchedSelectedEntityIds.length : filteredRecipients.length)
                                    : watchedAudienceMode === 'team'
                                        ? selectedTeamMembers.length
                                        : adhocContacts.filter(c => c.isValid).length) > blastThreshold && !watchedIsScheduled
                                    ? () => setIsBlastModalOpen(true)
                                    : undefined
                            }
                        />
                    </Card>
                )}

                {/* ── STEP 6: Bulk job progress ────────────────────────────── */}
                {step === 6 && (
                    <Card className="rounded-2xl border shadow-xl overflow-hidden">
                        <CardHeader className="text-center p-10 border-b bg-muted/30">
                            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/10">
                                {jobStatus === 'processing' ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : jobStatus === 'failed' ? <AlertCircle className="h-8 w-8 text-destructive" /> : <Trophy className="h-8 w-8 text-emerald-600" />}
                            </div>
                            <CardTitle className="text-2xl font-bold">
                                {jobStatus === 'completed' ? 'Broadcast Complete' : jobStatus === 'failed' ? 'Broadcast Failed' : 'Broadcast in Progress'}
                            </CardTitle>
                            <CardDescription className="font-semibold text-muted-foreground mt-1">
                                {jobStatus === 'completed'
                                    ? `All ${jobTotal} messages dispatched successfully.`
                                    : jobStatus === 'failed'
                                    ? 'An error occurred during dispatch.'
                                    : `Sending to ${jobTotal || csvData.length} recipients. You can close this tab.`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            {/* ── Progress Bar ────────────────────────── */}
                            <div className="space-y-3 max-w-lg mx-auto">
                                <div className="flex justify-between items-end">
                                    <p className="text-xs font-semibold text-muted-foreground">Progress</p>
                                    <p className="text-4xl font-bold tabular-nums text-primary">{jobProgress}%</p>
                                </div>
                                <div className="h-4 w-full bg-muted/30 rounded-full overflow-hidden border p-1">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${jobProgress}%` }}
                                        transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                                        className="h-full bg-primary rounded-full"
                                    />
                                </div>
                            </div>

                            {/* ── Real-time Stats Grid ────────────────── */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="grid grid-cols-3 gap-4 max-w-lg mx-auto"
                            >
                                <div className="text-center p-4 rounded-xl bg-muted/20 border">
                                    <p className="text-2xl font-bold tabular-nums text-foreground">{jobProcessed}</p>
                                    <p className="text-[11px] font-medium text-muted-foreground mt-1">Processed</p>
                                </div>
                                <div className="text-center p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                                    <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{jobProcessed - jobFailed}</p>
                                    <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-500 mt-1">Delivered</p>
                                </div>
                                <div className="text-center p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                                    <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{jobFailed}</p>
                                    <p className="text-[11px] font-medium text-red-700 dark:text-red-500 mt-1">Failed</p>
                                </div>
                            </motion.div>

                            {/* ── Safe to close notice ────────────────── */}
                            {jobStatus === 'processing' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="flex items-center gap-2 justify-center text-xs text-muted-foreground max-w-sm mx-auto"
                                >
                                    <Info className="h-3.5 w-3.5 shrink-0" />
                                    <span>Messages are sending in the background. You can safely close this tab.</span>
                                </motion.div>
                            )}

                            {/* ── Completion CTA ─────────────────────── */}
                            {jobStatus === 'completed' && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="max-w-sm mx-auto">
                                    <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-4">
                                        <div className="bg-emerald-600 text-white p-3 rounded-xl"><Check className="h-5 w-5" /></div>
                                        <div className="flex-1">
                                            <p className="font-bold text-emerald-900 dark:text-emerald-100">Broadcast Complete</p>
                                            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">All messages dispatched successfully.</p>
                                        </div>
                                        <Button asChild className="rounded-xl font-semibold h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-xs">
                                            <Link href="/admin/messaging">View Logs</Link>
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                            {/* ── Failure CTA ────────────────────────── */}
                            {jobStatus === 'failed' && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="max-w-sm mx-auto">
                                    <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-center gap-4">
                                        <div className="bg-red-600 text-white p-3 rounded-xl"><AlertCircle className="h-5 w-5" /></div>
                                        <div className="flex-1">
                                            <p className="font-bold text-red-900 dark:text-red-100">Broadcast Failed</p>
                                            <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">{jobFailed} message(s) failed to send.</p>
                                        </div>
                                        <Button asChild variant="destructive" className="rounded-xl font-semibold h-10 px-6 text-xs">
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
            <TemplateWorkshopSheet
                open={isQuickCreateOpen}
                onOpenChange={setIsQuickCreateOpen}
                initialContext={{
                    channel: watchedChannel,
                    category: "general"
                }}
                onCreated={(template) => { setValue('templateId', template.id, { shouldDirty: true }); setValue('messageSourceType', 'template'); }}
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
                <AlertDialogContent className="max-w-lg rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-950 text-slate-100 shadow-2xl p-6 overflow-hidden">
                    <AlertDialogHeader className="space-y-1.5 text-left">
                        <div className="flex items-center justify-between">
                            <AlertDialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-slate-100">
                                {sendSummary?.totalFailed === 0 ? (
                                    <>
                                        <div className="h-8 w-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                        </div>
                                        <span>Send Complete</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                                            <AlertCircle className="h-4 w-4 text-amber-400" />
                                        </div>
                                        <span>Completed with Errors</span>
                                    </>
                                )}
                            </AlertDialogTitle>
                            <Badge variant="outline" className="border-white/10 bg-slate-900 text-[10px] font-semibold text-slate-300 uppercase tracking-wider px-2 py-0.5">
                                {watchedChannel}
                            </Badge>
                        </div>
                        <AlertDialogDescription className="text-xs text-slate-400">
                            {sendSummary?.totalFailed === 0
                                ? 'All outbound messages have been successfully processed.'
                                : 'Some recipients encountered delivery errors during dispatch.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {sendSummary && (
                        <div className="space-y-4 py-2 text-left">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/25 flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                                        <Check className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-emerald-400/90 tracking-wider uppercase">Sent</p>
                                        <p className="text-2xl font-black text-emerald-300 tabular-nums leading-none mt-0.5">{sendSummary.totalSent}</p>
                                    </div>
                                </div>
                                <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/25 flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                                        <X className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-rose-400/90 tracking-wider uppercase">Failed</p>
                                        <p className="text-2xl font-black text-rose-300 tabular-nums leading-none mt-0.5">{sendSummary.totalFailed}</p>
                                    </div>
                                </div>
                            </div>

                            {sendSummary.totalFailed === 0 && (
                                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-center space-y-1 my-1">
                                    <CheckCircle2 className="h-7 w-7 text-emerald-400 mx-auto" />
                                    <p className="text-xs font-bold text-emerald-300">All messages dispatched successfully!</p>
                                    <p className="text-[11px] text-slate-400">Zero delivery failures were recorded for this dispatch batch.</p>
                                </div>
                            )}
                            
                            {sendSummary.totalFailed > 0 && sendSummary.failedEntities && (
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-rose-400 tracking-wider uppercase flex items-center gap-1.5">
                                            <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                                            <span>Error Logs</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono">
                                                {sendSummary.failedEntities.length}
                                            </span>
                                        </Label>

                                        {/* Export buttons */}
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-slate-400 font-medium mr-0.5 hidden xs:inline">Export:</span>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={isExporting}
                                                onClick={handleExportPDF}
                                                className="h-8 sm:h-7 px-2.5 text-xs sm:text-[11px] font-semibold gap-1.5 rounded-lg border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white hover:border-rose-500/40 active:scale-[0.97] transition-all"
                                                title="Export failed dispatches as PDF"
                                            >
                                                {isExporting && exportingType === 'pdf' ? (
                                                    <Loader2 className="h-3 w-3 animate-spin text-rose-400" />
                                                ) : (
                                                    <FileText className="h-3 w-3 text-rose-400" />
                                                )}
                                                <span>PDF</span>
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={isExporting}
                                                onClick={handleExportCSV}
                                                className="h-8 sm:h-7 px-2.5 text-xs sm:text-[11px] font-semibold gap-1.5 rounded-lg border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white hover:border-emerald-500/40 active:scale-[0.97] transition-all"
                                                title="Export failed dispatches as CSV"
                                            >
                                                {isExporting && exportingType === 'csv' ? (
                                                    <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                                                ) : (
                                                    <Table className="h-3 w-3 text-emerald-400" />
                                                )}
                                                <span>CSV</span>
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={isExporting}
                                                onClick={handleExportJSON}
                                                className="h-8 sm:h-7 px-2.5 text-xs sm:text-[11px] font-semibold gap-1.5 rounded-lg border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white hover:border-amber-500/40 active:scale-[0.97] transition-all"
                                                title="Export failed dispatches as JSON"
                                            >
                                                {isExporting && exportingType === 'json' ? (
                                                    <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                                                ) : (
                                                    <Code className="h-3 w-3 text-amber-400" />
                                                )}
                                                <span>JSON</span>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="max-h-44 overflow-y-auto rounded-2xl border border-rose-500/20 bg-slate-900/60 p-2 space-y-1.5">
                                        <div className="space-y-1.5">
                                            {sendSummary.failedEntities.map((f: FailedSendEntity, i: number) => (
                                                <div key={i} className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5 hover:border-rose-500/25 space-y-1 transition-colors">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <Building className="h-3 w-3 text-rose-400 shrink-0" />
                                                            <span className="text-xs font-semibold text-slate-200 truncate">
                                                                {f.entityName}{f.contactName && f.contactName !== f.entityName ? ` — ${f.contactName}` : ''}
                                                            </span>
                                                        </div>
                                                        {f.contactDetail ? (
                                                            <span className="text-[10px] font-mono text-slate-400 shrink-0 bg-slate-900 px-1.5 py-0.5 rounded border border-white/5">
                                                                {f.contactDetail}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <p className="text-[11px] text-rose-300/90 pl-4.5 break-words font-medium leading-relaxed">
                                                        {f.error}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <Button 
                                        type="button"
                                        variant="outline" 
                                        className="w-full h-10 rounded-xl font-bold border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 active:scale-[0.97] gap-2 text-xs transition-all shadow-sm"
                                        onClick={() => {
                                            const failedIds = sendSummary.failedEntities?.map(f => f.entityId).filter(Boolean) as string[];
                                            setAudienceSource('individual');
                                            setValue('selectedEntityIds', failedIds);
                                            setShowSummaryDialog(false); 
                                            setStep(3);
                                            toast({ title: 'Retry prepared', description: `${failedIds.length} entities selected for retry.` });
                                        }}
                                    >
                                        <TrendingUp className="h-3.5 w-3.5 text-rose-400" /> Retry Failed Entities
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                    <AlertDialogFooter className="bg-slate-900/80 -mx-6 -mb-6 p-4 border-t border-white/10 flex sm:justify-end gap-2">
                        <AlertDialogAction 
                            onClick={() => { 
                                setShowSummaryDialog(false); 
                                setSendSummary(null); 
                            }} 
                            className="rounded-xl font-bold px-8 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg active:scale-[0.97] transition-all"
                        >
                            Close
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── High-Volume Blast Confirmation Modal ── */}
            <SafeguardBlastModal
                open={isBlastModalOpen}
                onOpenChange={setIsBlastModalOpen}
                onConfirm={() => {
                    setIsBlastModalOpen(false);
                    form.handleSubmit(onSubmit)();
                }}
                recipientCount={audienceSource === 'individual' ? watchedSelectedEntityIds.length : filteredRecipients.length}
                channel={watchedChannel}
                senderProfileLabel={selectedSenderProfile ? `${selectedSenderProfile.name}${selectedSenderProfile.identifier ? ` (${selectedSenderProfile.identifier})` : ''}` : (watchedSenderProfileId === 'default' ? 'Default Active Profile' : watchedSenderProfileId)}
                isScheduled={watchedIsScheduled}
                scheduledAt={watch('scheduledAt')}
                isSubmitting={isSubmitting}
            />
        </div>
    );
}

