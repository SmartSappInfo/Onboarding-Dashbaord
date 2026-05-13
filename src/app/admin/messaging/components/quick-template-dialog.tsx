'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import type { MessageTemplate, VariableDefinition, MessageBlock, Survey } from '@/lib/types';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
    Plus, 
    Loader2, 
    Sparkles, 
    Database, 
    Mail, 
    Smartphone, 
    Check, 
    Info,
    Wand2,
    ClipboardList,
    Building,
    Globe,
    Zap,
    Trophy,
    Save,
    CopyPlus,
    Pencil,
    Banknote,
    FlaskConical,
    Users,
    UserCheck,
    ShieldCheck,
    ArrowRight,
    ArrowLeft,
    ChevronRight,
    Edit3,
    X,
    AlertTriangle,
    Calendar,
    Video,
    Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateEmailTemplate } from '@/ai/flows/generate-email-template-flow';
import TestDispatchDialog from './TestDispatchDialog';
import { useTenant } from '@/context/TenantContext';
import { generateContactVariableDefinitions, groupContactVariableDefinitions } from '@/lib/contact-variable-definitions';
import { RichTextEditor, FormattingToolbar } from '../templates/components/editor-ui';

interface QuickTemplateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (template: any) => void;
    category: MessageTemplate['category'];
    channel: MessageTemplate['channel'];
    recipientType?: MessageTemplate['recipientType'];
    fixedSourceId?: string; // If provided, locks the dialog to a specific survey
    templateId?: string; // If provided, loads existing template for editing
}

interface VariableSectionProps {
    title: string;
    icon: any;
    items: VariableDefinition[];
    badge?: string;
    onInsert: (key: string) => void;
}

const VariableSection = ({ title, icon: Icon, items, badge, onInsert }: VariableSectionProps) => {
    if (items.length === 0) return null;
    return (
        <div className="space-y-3 pt-4 first:pt-0">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <Icon className="h-3 w-3 text-primary opacity-60" />
                    <span className="text-[9px] font-semibold text-primary/60">{title}</span>
                </div>
                {badge ? <Badge variant="outline" className="text-[7px] h-4 font-semibold uppercase border-primary/20 bg-primary/5 text-primary">{badge}</Badge> : null}
            </div>
            <div className="space-y-2">
                {items.map(v => (
                    <button
                        key={v.id}
                        type="button"
                        onClick={() => onInsert(v.key)}
                        className="w-full text-left p-3 rounded-xl bg-card border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all group shadow-sm"
                    >
                        <p className="text-xs font-bold truncate leading-none text-foreground/80">{v.label}</p>
                        <code className="text-[9px] font-mono text-muted-foreground opacity-60 mt-1.5 block">{"{{" + v.key + "}}"}</code>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default function QuickTemplateDialog({ 
    open, 
    onOpenChange, 
    onCreated, 
    category, 
    channel,
    recipientType,
    fixedSourceId,
    templateId
}: QuickTemplateDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeOrganizationId, activeWorkspaceId } = useTenant();
    
    const [name, setName] = React.useState('');
    const [subject, setSubject] = React.useState('');
    const [body, setBody] = React.useState('');
    const [blocks, setBlocks] = React.useState<MessageBlock[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isAiProcessing, setIsAiProcessing] = React.useState(false);
    const [aiPrompt, setAiPrompt] = React.useState('');
    const [showAiInput, setShowAiInput] = React.useState(false);
    const [isLoadingTemplate, setIsLoadingTemplate] = React.useState(false);
    const [isTestModalOpen, setIsTestModalOpen] = React.useState(false);
    const [existingTemplateType, setExistingTemplateType] = React.useState<string | undefined>(undefined);
    const [step, setStep] = React.useState(1);
    const [contentMode, setContentMode] = React.useState<any>('rich_builder');
    
    // Context Selection
    const [selectedSurveyId, setSelectedSurveyId] = React.useState<string | undefined>(fixedSourceId);

    const bodyRef = React.useRef<HTMLTextAreaElement>(null);
    const subjectRef = React.useRef<HTMLInputElement>(null);

    // Queries optimized for indices
    const surveysQuery = useMemoFirebase(() => 
        firestore ? query(
            collection(firestore, 'surveys'), 
            where('status', '==', 'published'), 
            orderBy('internalName', 'asc')
        ) : null, 
    [firestore]);

    const varsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'messaging_variables')) : null, [firestore]);

    // ORG-SCOPED USER QUERY
    const usersQuery = useMemoFirebase(() => {
        if (!firestore || !activeOrganizationId) return null;
        return query(
            collection(firestore, 'users'), 
            where('organizationId', '==', activeOrganizationId),
            where('isAuthorized', '==', true),
            orderBy('name', 'asc')
        );
    }, [firestore, activeOrganizationId]);

    const { data: surveys } = useCollection<Survey>(surveysQuery);
    const { data: allVariables } = useCollection<VariableDefinition>(varsQuery);

    // Load Template if templateId is provided
    React.useEffect(() => {
        if (open && templateId && firestore) {
            const loadTemplate = async () => {
                setIsLoadingTemplate(true);
                try {
                    const docSnap = await getDoc(doc(firestore, 'message_templates', templateId));
                    if (docSnap.exists()) {
                        const data = docSnap.data() as MessageTemplate;
                        setName(data.name);
                        setSubject(data.subject || '');
                        setBody(data.body);
                        setBlocks(data.blocks || []);
                        setExistingTemplateType(data.templateType);
                        if (data.contentMode) setContentMode(data.contentMode);
                    }
                } catch (e) {
                    toast({ variant: 'destructive', title: 'Error', description: 'Failed to load template.' });
                } finally {
                    setIsLoadingTemplate(false);
                }
            };
            loadTemplate();
        }
    }, [open, templateId, firestore, toast]);

    // Filtered & Grouped Variables Logic
    const groupedVariables = React.useMemo(() => {
        if (!allVariables) return { survey: [], metrics: [], core: [], finance: [], constants: [] };

        const surveyVars: VariableDefinition[] = [];
        const metricVars: VariableDefinition[] = [];
        const coreVars: VariableDefinition[] = [];
        const financeVars: VariableDefinition[] = [];
        const constantVars: VariableDefinition[] = [];

        allVariables.forEach(v => {
            if (v.hidden) return;

            // 1. Core Metrics (survey_score, max_score, outcome_label, result_url)
            const isResultMetric = v.entity === 'SurveyResponse' && ['survey_score', 'max_score', 'outcome_label', 'result_url'].includes(v.key);
            
            // 2. Question-specific context
            const isQuestionFromSurvey = v.source === 'survey' && v.sourceId === selectedSurveyId;

            if (isResultMetric) {
                metricVars.push(v);
            } else if (isQuestionFromSurvey) {
                surveyVars.push(v);
            } else if (v.category === 'finance' || (category === 'agreements' && v.category === 'finance')) {
                financeVars.push(v);
            } else if (v.category === category && v.source === 'survey' && !selectedSurveyId) {
                surveyVars.push(v);
            } else if (v.source === 'static' && v.category === 'general') {
                coreVars.push(v);
            } else if (v.source === 'constant') {
                constantVars.push(v);
            }
        });

        return { 
            survey: surveyVars.sort((a, b) => a.label.localeCompare(b.label)), 
            metrics: metricVars.sort((a, b) => a.label.localeCompare(b.label)), 
            core: coreVars, 
            finance: financeVars,
            constants: constantVars 
        };
    }, [allVariables, selectedSurveyId, category]);

    // FER-02: Generate dynamic contact variable definitions
    // TODO: When org/workspace override fetching is added client-side, pass overrides here
    const contactGroups = React.useMemo(() => {
        const defs = generateContactVariableDefinitions('institution');
        return groupContactVariableDefinitions(defs);
    }, []);

    // Meeting-specific variables (Phase 8)
    const meetingVariables: VariableDefinition[] = React.useMemo(() => {
        if (category !== 'meetings') return [];
        return [
            { id: 'mv_title', key: 'meeting_title', label: 'Meeting Title', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.heroTitle', type: 'string' },
            { id: 'mv_date', key: 'meeting_date', label: 'Meeting Date', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.meetingTime', type: 'date' },
            { id: 'mv_time', key: 'meeting_time', label: 'Meeting Time', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.meetingTime', type: 'time' },
            { id: 'mv_timezone', key: 'meeting_timezone', label: 'Meeting Timezone', entity: 'Meeting', source: 'static', category: 'meetings', path: 'org.settings.defaultTimezone', type: 'string' },
            { id: 'mv_link', key: 'meeting_link', label: 'Meeting Link', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.meetingLink', type: 'url' },
            { id: 'mv_cal', key: 'calendar_link', label: 'Calendar Link', entity: 'Meeting', source: 'static', category: 'meetings', path: 'computed', type: 'url' },
            { id: 'mv_type', key: 'meeting_type', label: 'Meeting Type', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.type.name', type: 'string' },
            { id: 'mv_organizer', key: 'organizer_name', label: 'Organizer Name', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.assignedTo.name', type: 'string' },
            { id: 'mv_recording', key: 'recording_link', label: 'Recording Link', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.recordingUrl', type: 'url' },
            { id: 'mv_feedback', key: 'feedback_form_link', label: 'Feedback Form Link', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.feedbackFormUrl', type: 'url' },
            { id: 'mv_resource', key: 'resource_link', label: 'Resource Link', entity: 'Meeting', source: 'static', category: 'meetings', path: 'meeting.resourceUrl', type: 'url' },
            { id: 'mv_dashboard', key: 'dashboard_link', label: 'Dashboard Link', entity: 'Meeting', source: 'static', category: 'meetings', path: 'computed', type: 'url' },
            { id: 'mv_reg_count', key: 'registrant_count', label: 'Registrant Count', entity: 'Meeting', source: 'static', category: 'meetings', path: 'computed', type: 'number' },
            { id: 'mv_att_count', key: 'attendee_count', label: 'Attendee Count', entity: 'Meeting', source: 'static', category: 'meetings', path: 'computed', type: 'number' },
            { id: 'mv_noshow', key: 'no_show_count', label: 'No-Show Count', entity: 'Meeting', source: 'static', category: 'meetings', path: 'computed', type: 'number' },
        ];
    }, [category]);

    const handleAiArchitect = async () => {
        if (!aiPrompt.trim()) return;
        setIsAiProcessing(true);
        try {
            const availableKeys = [
                ...groupedVariables.survey.map(v => v.key),
                ...groupedVariables.metrics.map(v => v.key),
                ...groupedVariables.core.map(v => v.key),
                ...groupedVariables.finance.map(v => v.key),
                ...groupedVariables.constants.map(v => v.key)
            ];

            const result = await generateEmailTemplate({
                prompt: aiPrompt,
                channel: (channel === 'email' || channel === 'sms') ? channel : 'email',
                availableVariables: availableKeys
            });

            setName(result.name);
            setSubject(result.subject || '');
            setBody(result.body);
            if (result.blocks) setBlocks(result.blocks as any);
            setShowAiInput(false);
            toast({ title: 'Template Draft Created', description: result.explanation });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Generation Failed', description: e.message });
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleInsert = (key: string) => {
        const tag = `{{${key}}}`;
        const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
            const start = active.selectionStart || 0;
            const end = active.selectionEnd || 0;
            const val = active.value;
            active.value = val.substring(0, start) + tag + val.substring(end);
            active.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => {
                active.focus();
                active.setRangeText ? active.setRangeText(tag) : null;
                active.setSelectionRange(start + tag.length, start + tag.length);
            }, 0);
        } else {
            setBody(prev => prev + tag);
        }
    };

    const handleCommit = async (mode: 'update' | 'new') => {
        if (!name || (!body && blocks.length === 0) || !firestore) return;
        setIsSubmitting(true);

        const varMatches = `${subject} ${body} ${JSON.stringify(blocks)}`.match(/\{\{(.*?)\}\}/g);
        const variableList = varMatches ? [...new Set(varMatches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];

        const templateData: any = {
            name: name.trim(),
            category,
            channel,
            target: 'external_client',
            contentMode: channel === 'sms' ? 'plain_text' : contentMode,
            body: body.trim(),
            variables: variableList,
            status: 'active',
            isActive: true, // backward compat
            updatedAt: new Date().toISOString(),
            scope: 'organization',
            organizationId: activeOrganizationId,
            workspaceIds: [activeWorkspaceId || ''],
            templateType: existingTemplateType || `custom_${category}_${Date.now()}`
        };

        if (recipientType) {
            templateData.recipientType = recipientType;
        }

        if (channel === 'email') {
            templateData.subject = subject.trim();
            if (blocks && blocks.length > 0) {
                templateData.blocks = blocks;
            }
        }

        try {
            if (mode === 'update' && templateId) {
                await updateDoc(doc(firestore, 'message_templates', templateId), templateData);
                onCreated({ id: templateId, ...templateData });
                toast({ title: 'Template Updated' });
            } else {
                const docRef = await addDoc(collection(firestore, 'message_templates'), {
                    ...templateData,
                    createdAt: new Date().toISOString(),
                });
                onCreated({ id: docRef.id, ...templateData });
                toast({ title: 'Template Created' });
            }
            reset();
            onOpenChange(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Operation Failed' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const reset = () => {
        setName('');
        setSubject('');
        setBody('');
        setBlocks([]);
        setAiPrompt('');
        setShowAiInput(false);
        setStep(1);
        if (!fixedSourceId) setSelectedSurveyId(undefined);
    };

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            reset();
        }
        onOpenChange(isOpen);
    };



    const STEPS = [
        { num: 1, label: 'Identity', icon: Mail },
        { num: 2, label: 'Content', icon: Edit3 },
    ];

    const canAdvanceToStep2 = () => {
        if (!name.trim()) return false;
        if (channel === 'email' && !subject.trim()) return false;
        return true;
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="w-screen h-screen max-w-none m-0 rounded-none flex flex-col p-0 overflow-hidden border-none shadow-none bg-background">
                <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
                    <div className="flex items-center justify-between text-left">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "p-2.5 rounded-xl shadow-sm",
                                channel === 'email' ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-500"
                            )}>
                                {channel === 'email' ? <Mail className="h-5 w-5" aria-hidden="true" /> : <Smartphone className="h-5 w-5" aria-hidden="true" />}
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                                    {templateId ? 'Template Editor' : 'Quick Template Studio'}
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold text-muted-foreground opacity-90">
                                    Creating {channel} template for {category}
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="hidden md:flex items-center gap-1.5 bg-background p-1.5 rounded-2xl border shadow-sm">
                                {STEPS.map((s, i) => (
                                    <React.Fragment key={s.num}>
                                        <div className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold shrink-0 transition-all",
                                            s.num === step ? "bg-primary text-primary-foreground shadow-sm" :
                                            s.num < step ? "bg-primary/10 text-primary" : "text-muted-foreground"
                                        )}>
                                            {s.num < step ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
                                            {s.label}
                                        </div>
                                        {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
                                    </React.Fragment>
                                ))}
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="rounded-xl font-bold gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                                    onClick={() => setIsTestModalOpen(true)}
                                >
                                    <FlaskConical className="h-4 w-4" /> <span className="hidden sm:inline">Send Test</span>
                                </Button>
                                <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 border" onClick={() => handleOpenChange(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    <div className="flex-1 overflow-y-auto p-8 bg-background relative text-left">
                        {isLoadingTemplate ? (
                            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <p className="text-[10px] font-semibold opacity-40">Loading Template...</p>
                            </div>
                        ) : null}

                        <div className="max-w-4xl mx-auto space-y-8 pb-20">
                            {step === 1 ? (
                                <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold tracking-tight">Template Identity</h3>
                                        <p className="text-xs text-muted-foreground font-semibold">Configure the basic details and content mode for this template.</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Template Label</Label>
                                            <Input 
                                                value={name} 
                                                onChange={e => setName(e.target.value)} 
                                                placeholder="e.g. Admission Confirmation" 
                                                className="h-12 rounded-xl bg-card border-border/50 font-bold text-sm px-4"
                                                autoFocus
                                            />
                                        </div>

                                        {channel === 'email' ? (
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Content Format</Label>
                                                <Select value={contentMode} onValueChange={setContentMode}>
                                                    <SelectTrigger className="h-12 rounded-xl bg-card border-border/50 font-bold text-sm px-4">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="rich_builder" className="font-semibold text-xs">Rich Visual Builder</SelectItem>
                                                        <SelectItem value="html_code" className="font-semibold text-xs">Custom HTML Code</SelectItem>
                                                        <SelectItem value="plain_text" className="font-semibold text-xs">Plain Text Only</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ) : null}
                                    </div>

                                    {channel === 'email' ? (
                                        <div className="space-y-2 max-w-2xl">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Subject Line</Label>
                                            <Input 
                                                ref={subjectRef}
                                                value={subject} 
                                                onChange={e => setSubject(e.target.value)} 
                                                placeholder="Email subject line…" 
                                                className="h-12 rounded-xl bg-card border-border/50 font-bold text-sm px-4"
                                            />
                                        </div>
                                    ) : null}

                                    {!templateId ? (
                                        <div className="pt-6 border-t border-border/50 max-w-2xl">
                                            <div className="p-6 rounded-[2rem] bg-primary/5 border border-primary/10 space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <Sparkles className="h-4 w-4 text-primary" />
                                                    <Label className="text-sm font-bold text-primary">AI Draft Assistant</Label>
                                                </div>
                                                <div className="flex gap-3">
                                                    <Input 
                                                        value={aiPrompt} 
                                                        onChange={e => setAiPrompt(e.target.value)}
                                                        placeholder="Describe tone... e.g. friendly welcome email"
                                                        className="h-11 rounded-xl bg-card border-none font-semibold text-xs"
                                                    />
                                                    <Button 
                                                        onClick={() => {
                                                            handleAiArchitect();
                                                            setStep(2); // Auto-advance to step 2 when done
                                                        }} 
                                                        disabled={isAiProcessing || !aiPrompt.trim()}
                                                        className="h-11 rounded-xl font-bold px-6 shrink-0"
                                                    >
                                                        {isAiProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500 h-full flex flex-col">
                                    <div className="flex justify-between items-center px-1 shrink-0">
                                        <div>
                                            <h3 className="text-lg font-bold tracking-tight">Message Composition</h3>
                                            <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">Use the variables panel on the right to inject dynamic data.</p>
                                        </div>
                                        {blocks.length > 0 && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[8px] font-semibold uppercase h-5 px-2">Using Blocks</Badge>}
                                    </div>
                                    <div className="relative group flex-1 flex flex-col h-full bg-card rounded-[2rem] border border-border/50 overflow-hidden shadow-inner">
                                        {contentMode === 'rich_builder' && channel !== 'sms' && blocks.length === 0 ? (
                                            <>
                                                <div className="p-4 border-b border-border/50 bg-muted/20">
                                                    <FormattingToolbar />
                                                </div>
                                                <div className="flex-1 p-6 overflow-y-auto">
                                                    <RichTextEditor 
                                                        value={body}
                                                        onChange={setBody}
                                                        placeholder="Hi {{contact_name}}, ..."
                                                        className="min-h-full font-medium leading-relaxed text-sm focus:outline-none"
                                                    />
                                                </div>
                                            </>
                                        ) : contentMode === 'html_code' && channel !== 'sms' && blocks.length === 0 ? (
                                            <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200">
                                                <Textarea 
                                                    ref={bodyRef}
                                                    value={body} 
                                                    onChange={e => setBody(e.target.value)}
                                                    className="h-full min-h-[400px] bg-transparent border-none p-0 font-mono text-xs leading-relaxed resize-none focus-visible:ring-0 shadow-none"
                                                    placeholder="<html><body>Hi {{contact_name}}</body></html>"
                                                />
                                            </div>
                                        ) : (
                                            <Textarea 
                                                ref={bodyRef}
                                                value={body} 
                                                onChange={e => setBody(e.target.value)}
                                                className="h-full min-h-[400px] bg-transparent border-none p-6 font-medium leading-relaxed resize-none shadow-none text-sm placeholder:italic focus-visible:ring-0"
                                                placeholder={blocks.length > 0 ? "Blocks are driving this template. Use Template Studio for full control." : "Hi {{contact_name}}, ..."}
                                            />
                                        )}
                                        <div className="absolute top-4 right-4 opacity-10 pointer-events-none">
                                            <Zap className="h-12 w-12 text-primary" />
                                        </div>
                                    </div>

                                    {/* SMS Character Counter */}
                                    {channel === 'sms' && (
                                        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-muted/50 border border-border/50">
                                            <div className="flex items-center gap-2">
                                                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="text-[10px] font-bold text-muted-foreground">
                                                    {body.length} characters · {Math.max(1, Math.ceil(body.length / 160))} segment{Math.ceil(body.length / 160) !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            {body.length > 320 ? (
                                                <div className="flex items-center gap-1.5 text-red-500">
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                    <span className="text-[9px] font-bold">Very long — consider shortening</span>
                                                </div>
                                            ) : body.length > 160 ? (
                                                <div className="flex items-center gap-1.5 text-amber-500">
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                    <span className="text-[9px] font-bold">Multi-segment SMS</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                    {channel === 'sms' && (
                                        <p className="text-[9px] text-muted-foreground/60 font-medium px-1">
                                            Variables like {`{{contact_name}}`} expand to real values at send time and may increase the final character count.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* VARIABLE PANEL - Only shown on Step 2 */}
                    {step === 2 ? (
                        <div className="w-full lg:w-80 xl:w-96 border-l bg-muted/10 p-6 shrink-0 overflow-hidden flex flex-col gap-6 text-left animate-in fade-in slide-in-from-right-8 duration-500">
                            <div className="space-y-4 shrink-0">
                                <div className="flex items-center gap-2">
                                    <Database className="h-4 w-4 text-primary" />
                                    <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">Available Variables</span>
                                </div>
                                
                                {!fixedSourceId && category === 'surveys' ? (
                                    <div className="space-y-1.5">
                                        <Label className="text-[9px] font-semibold text-muted-foreground ml-1">Filter by Survey</Label>
                                        <Select value={selectedSurveyId || 'none'} onValueChange={setSelectedSurveyId}>
                                            <SelectTrigger className="h-10 rounded-xl border-border/50 bg-card font-bold text-xs shadow-sm">
                                                <SelectValue placeholder="All Sources" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="none">All Sources</SelectItem>
                                                {surveys?.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.internalName || s.title}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : null}
                            </div>
                            
                            <ScrollArea className="flex-1 -mx-2 px-2">
                                <div className="space-y-8 pb-20 divide-y divide-border/50">
                                    {category === 'surveys' ? (
                                        <>
                                            <VariableSection title="Submission Metrics" icon={Trophy} items={groupedVariables.metrics} badge="Real-time" onInsert={handleInsert} />
                                            <VariableSection title="Dynamic Survey Data" icon={ClipboardList} items={groupedVariables.survey} onInsert={handleInsert} />
                                        </>
                                    ) : null}
                                    <VariableSection title="Institutional Tags" icon={Building} items={groupedVariables.core} onInsert={handleInsert} />
                                    <VariableSection title="Financial Logic" icon={Banknote} items={groupedVariables.finance} onInsert={handleInsert} />
                                    <VariableSection title="Custom Constants" icon={Globe} items={groupedVariables.constants} onInsert={handleInsert} />
                                    
                                    {/* FER-02: Contact variable groups */}
                                    <VariableSection title="Primary Contact" icon={UserCheck} items={contactGroups.primary} badge="Dynamic" onInsert={handleInsert} />
                                    <VariableSection title="Signatory Contact" icon={ShieldCheck} items={contactGroups.signatory} badge="Dynamic" onInsert={handleInsert} />
                                    <VariableSection title="Role-Based Contacts" icon={Users} items={contactGroups.roles} onInsert={handleInsert} />

                                    {/* Meeting variables (Phase 8) */}
                                    {category === 'meetings' && (
                                        <>
                                            <VariableSection title="Meeting Details" icon={Calendar} items={meetingVariables.slice(0, 8)} badge="Meeting" onInsert={handleInsert} />
                                            <VariableSection title="Post-Event Links" icon={Video} items={meetingVariables.slice(8, 12)} onInsert={handleInsert} />
                                            <VariableSection title="Attendance Stats" icon={Clock} items={meetingVariables.slice(12)} onInsert={handleInsert} />
                                        </>
                                    )}

                                    {category === 'surveys' && groupedVariables.survey.length === 0 && !selectedSurveyId ? (
                                        <div className="py-10 text-center opacity-40 space-y-2 border-t mt-4 pt-4">
                                            <Info className="h-6 w-6 mx-auto" />
                                            <p className="text-[9px] font-semibold tracking-tighter">Select a survey to view<br/>question-specific tags</p>
                                        </div>
                                    ) : null}
                                </div>
                            </ScrollArea>

                            <div className="p-4 rounded-2xl bg-card border border-border/50 flex items-start gap-3 mt-auto shadow-sm">
                                <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <p className="text-[9px] font-bold text-muted-foreground leading-relaxed tracking-tighter">
                                    Click any tag to inject it into your active input field.
                                </p>
                            </div>
                        </div>
                    ) : null}
                </div>

                <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div>
                        {step === 2 ? (
                            <Button 
                                variant="outline" 
                                onClick={() => setStep(1)} 
                                className="font-bold rounded-xl h-12 px-6 border-border/50 gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" /> Back
                            </Button>
                        ) : null}
                    </div>
                    <div className="flex-grow shrink-0 flex gap-3 sm:justify-end w-full sm:w-auto">
                        {step === 1 ? (
                            <Button 
                                onClick={() => setStep(2)} 
                                disabled={!canAdvanceToStep2()}
                                className="px-10 rounded-xl font-bold h-12 text-sm w-full sm:w-auto gap-2"
                            >
                                Continue to Editor <ArrowRight className="h-4 w-4" />
                            </Button>
                        ) : (
                            <>
                                {templateId ? (
                                    <Button 
                                        variant="outline"
                                        onClick={() => handleCommit('new')} 
                                        disabled={isSubmitting || !name || (blocks.length === 0 && !body)}
                                        className="rounded-xl font-bold border-primary/20 text-primary hover:bg-primary/5 h-12 px-6 gap-2 w-full sm:w-auto"
                                    >
                                        <CopyPlus className="h-4 w-4" />
                                        Save as New
                                    </Button>
                                ) : null}
                                <Button 
                                    onClick={() => handleCommit(templateId ? 'update' : 'new')} 
                                    disabled={isSubmitting || !name || (blocks.length === 0 && !body)}
                                    className="px-10 rounded-xl font-bold shadow-lg h-12 text-sm w-full sm:w-auto gap-2"
                                >
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : templateId ? <Save className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                    {templateId ? 'Update Template' : 'Save Template'}
                                </Button>
                            </>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>

            <TestDispatchDialog 
                open={isTestModalOpen}
                onOpenChange={setIsTestModalOpen}
                channel={channel as 'email' | 'sms'}
                rawBody={body}
                rawSubject={subject}
                templateId={templateId}
            />
        </Dialog>
    );
}