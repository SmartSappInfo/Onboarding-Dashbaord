'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import {
    Layout,
    Settings2,
    MonitorPlay,
    Check,
    ArrowRight,
    Loader2,
    Save,
    Database,
    PlusCircle,
    Eye,
    Maximize2,
    Minimize2,
    Monitor,
    Smartphone as PhoneIcon,
    Code,
    Sparkles,
    ChevronRight,
    FlaskConical,
    Share2,
    FileText,
    UserCog
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Skeleton } from '@/components/ui/skeleton';
import type { MessageTemplate, MessageBlock, VariableDefinition, MessageStyle, WorkspaceEntity, Meeting, Survey, PDFForm, ContentMode, TemplateTarget } from '@/lib/types';
import { renderBlocksToHtml, resolveVariables } from '@/lib/messaging-utils';
import { SortableBlockItem, blockIcons } from './visual-block';
import { BlockInspector } from './block-inspector';
import { PlainTextEditor } from './PlainTextEditor';
import { SimulationStudio } from './simulation-studio';
import { useToast } from '@/hooks/use-toast';
import TestDispatchDialog from '../../components/TestDispatchDialog';
import { useWorkspace } from '@/context/WorkspaceContext';
import { MultiSelect } from '@/components/ui/multi-select';
import { groupContactVariableDefinitions } from '@/lib/contact-variable-definitions';
import { getAllSystemVariables } from '@/lib/system-variable-definitions';
import { Users, UserCheck, ShieldCheck as ShieldCheckIcon } from 'lucide-react';

// Dynamic import for HtmlCodeEditor (bundle-dynamic-imports)
const HtmlCodeEditor = dynamic(
    () => import('./HtmlCodeEditor'),
    { ssr: false, loading: () => <Skeleton className="h-[600px] rounded-2xl" /> }
);

const CORE_SYSTEM_KEYS = [
    'meeting_invitation', 'meeting_confirmation', 'survey_completion',
    'internal_alert', 'respondent_alert', 'campaign_outreach',
    'invoice_ready', 'contract_signature_request'
];

const slugify = (str: string) => {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};

interface TemplateWorkshopProps {
    initialTemplate?: MessageTemplate | null;
    variables: VariableDefinition[];
    styles: MessageStyle[];
    entities?: WorkspaceEntity[];
    meetings?: Meeting[];
    surveys?: Survey[];
    pdfs?: PDFForm[];
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
    isSaving: boolean;
    initialContext?: {
        category?: MessageTemplate['category'];
        channel?: MessageTemplate['channel'];
        recipientType?: MessageTemplate['recipientType'];
        templateType?: string;
    };
}

export function TemplateWorkshop({
    initialTemplate,
    variables,
    styles,
    entities,
    meetings,
    surveys,
    pdfs,
    onSave,
    onCancel,
    isSaving,
    initialContext
}: TemplateWorkshopProps) {
    const { toast } = useToast();
    const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();

    const [step, setStep] = React.useState(1);
    const [editorMode, setEditorMode] = React.useState<'designer' | 'code'>('designer');
    const [isFullScreen, setIsFullScreen] = React.useState(false);
    const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);
    const [sidebarTab, setSidebarTab] = React.useState<'blocks' | 'tags' | 'properties'>('blocks');
    const [variablesWidth, setVariablesWidth] = React.useState(320);
    const [isResizing, setIsResizing] = React.useState(false);
    const [isTestModalOpen, setIsTestModalOpen] = React.useState(false);

    // Form State
    const [name, setName] = React.useState(initialTemplate?.name || '');
    const [category, setCategory] = React.useState(initialTemplate?.category || initialContext?.category || 'general');
    const [channel, setChannel] = React.useState(initialTemplate?.channel || initialContext?.channel || 'email');
    const [contentMode, setContentMode] = React.useState<ContentMode>(
        initialTemplate?.contentMode || ((initialTemplate?.channel || initialContext?.channel) === 'sms' ? 'plain_text' : 'rich_builder')
    );
    const [target, setTarget] = React.useState<TemplateTarget>(initialTemplate?.target || 'external_client');
    const [templateType, setTemplateType] = React.useState<string>(initialTemplate?.templateType || initialContext?.templateType || '');
    const [recipientType, setRecipientType] = React.useState<string>(initialTemplate?.recipientType || initialContext?.recipientType || 'participant');
    const [workspaceIds, setWorkspaceIds] = React.useState<string[]>(initialTemplate?.workspaceIds || [activeWorkspaceId]);
    const [subject, setSubject] = React.useState(initialTemplate?.subject || '');
    const [previewText, setPreviewText] = React.useState(initialTemplate?.previewText || '');
    const [body, setBody] = React.useState(initialTemplate?.body || '');
    const [blocks, setBlocks] = React.useState<MessageBlock[]>(initialTemplate?.blocks || []);
    const [styleId, setStyleId] = React.useState(initialTemplate?.styleId || 'none');
    const [pendingContentMode, setPendingContentMode] = React.useState<ContentMode | null>(null);
    const [isTemplateTypeDirty, setIsTemplateTypeDirty] = React.useState(!!initialTemplate?.templateType || !!initialContext?.templateType);

    // Auto-generate templateType from name if not manually modified
    React.useEffect(() => {
        if (!isTemplateTypeDirty && !initialContext?.templateType && name) {
            setTemplateType(slugify(`${category}_${recipientType}_${name}`));
        }
    }, [name, category, recipientType, isTemplateTypeDirty, initialContext?.templateType]);

    const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

    // Simulation State
    const [simEntity, setSimEntity] = React.useState('none');
    const [simRecordId, setSimRecordId] = React.useState('none');
    const [simVariables, setSimVariables] = React.useState<Record<string, any>>({});
    const [isSimLoading, setIsSimLoading] = React.useState(false);

    const sensors = useSensors(useSensor(PointerSensor));

    // Sync Designers — only for rich_builder mode (Risk Analysis: Improvement 3)
    React.useEffect(() => {
        if (channel === 'email' && contentMode === 'rich_builder' && editorMode === 'designer') {
            const html = renderBlocksToHtml(blocks, {});
            if (html !== body) setBody(html);
        }
    }, [blocks, channel, contentMode, editorMode, body]);

    const handleAddBlock = (type: MessageBlock['type'], variant?: 'h1' | 'h2' | 'h3') => {
        const id = `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newBlock: MessageBlock = { id, type, title: '', content: '', variant, style: { textAlign: 'left', variant: 'default' } };
        if (type === 'list') { newBlock.listStyle = 'unordered'; newBlock.items = ['Item 1']; }
        setBlocks(prev => [...prev, newBlock]);
        setSelectedBlockId(id);
        setSidebarTab('properties');
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setBlocks(items => {
                const oldIdx = items.findIndex(i => i.id === active.id);
                const newIdx = items.findIndex(i => i.id === over.id);
                return arrayMove(items, oldIdx, newIdx);
            });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => { e.preventDefault(); setIsResizing(true); };
    React.useEffect(() => {
        const move = (e: MouseEvent) => isResizing && setVariablesWidth(Math.max(250, Math.min(600, e.clientX)));
        const stop = () => setIsResizing(false);
        if (isResizing) { window.addEventListener('mousemove', move); window.addEventListener('mouseup', stop); }
        return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); };
    }, [isResizing]);

    // Content mode switch handler with data integrity
    const handleContentModeSwitch = React.useCallback((newMode: ContentMode) => {
        if (newMode === contentMode) return;
        // Check if there's content that could be lost
        const hasContent = contentMode === 'rich_builder' ? blocks.length > 0 : body.length > 0;
        if (hasContent) {
            setPendingContentMode(newMode);
        } else {
            setContentMode(newMode);
        }
    }, [contentMode, blocks.length, body.length]);

    // Safety sync: If we switch away from rich_builder, force the sidebar to 'tags' so it doesn't break
    React.useEffect(() => {
        if (contentMode !== 'rich_builder' && sidebarTab !== 'tags') {
            setSidebarTab('tags');
        }
    }, [contentMode, sidebarTab]);

    const confirmContentModeSwitch = React.useCallback(() => {
        if (!pendingContentMode) return;
        // Clear stale data for the old mode (Risk Analysis: Improvement 2)
        if (contentMode === 'rich_builder') {
            // Moving away from blocks → preserve rendered body, clear blocks
            setBlocks([]);
        } else {
            // Moving to rich_builder → clear body, start fresh blocks
            if (pendingContentMode === 'rich_builder') {
                setBody('');
            }
        }
        setContentMode(pendingContentMode);
        setPendingContentMode(null);
    }, [pendingContentMode, contentMode]);

    const handleCommit = () => {
        // Clear irrelevant data on save (Risk Analysis: Improvement 2)
        const saveData: any = {
            name, category, channel, contentMode, target, workspaceIds,
            subject, previewText, body, blocks, styleId, templateType,
            recipientType
        };
        if (contentMode === 'rich_builder') {
            // blocks is source of truth — body is auto-generated
        } else {
            // body is source of truth — clear blocks
            saveData.blocks = [];
        }
        // SMS is always plain_text
        if (channel === 'sms') {
            saveData.contentMode = 'plain_text';
            saveData.blocks = [];
        }
        onSave(saveData);
    };

    // contentMode-aware preview (Risk Analysis: Risk 3 fix)
    const resolvedPreviewHtml = React.useMemo(() => {
        const activeStyle = styleId !== 'none' ? styles.find(s => s.id === styleId) : null;
        const effectiveMode = channel === 'sms' ? 'plain_text' : contentMode;

        if (effectiveMode === 'rich_builder') {
            return renderBlocksToHtml(blocks, simVariables, {
                wrapper: activeStyle?.htmlWrapper
            });
        }
        // plain_text and html_code both use body
        let resolved = resolveVariables(body, simVariables);
        if (effectiveMode === 'html_code' && activeStyle?.htmlWrapper?.includes('{{content}}')) {
            resolved = resolveVariables(activeStyle.htmlWrapper, simVariables).replace('{{content}}', resolved);
        }
        return resolved;
    }, [channel, contentMode, blocks, simVariables, styleId, styles, body]);

    const filteredVars = React.useMemo(() => {
        const combined = [...variables, ...getAllSystemVariables()];
        const allowedGlobalCategories = ['general', 'organization', 'workspace', 'entity', 'user', 'contact', 'core'];
        return combined.filter(v => (
            !v.category ||
            allowedGlobalCategories.includes(v.category) ||
            v.category === category ||
            (category === 'agreements' && v.category === 'finance')
        ) && !v.hidden);
    }, [variables, category]);

    const copyVariableToClipboard = React.useCallback((key: string) => {
        navigator.clipboard.writeText(`{{${key}}}`);
        toast({ title: 'Tag Copied' });
    }, [toast]);

    // FER-02: Group contact variables for dedicated sidebar sections
    const contactVarGroups = React.useMemo(() => {
        const contactVars = filteredVars.filter(v => v.source === 'entity_contacts');
        const nonContactVars = filteredVars.filter(v => v.source !== 'entity_contacts');
        return {
            ...groupContactVariableDefinitions(contactVars),
            other: nonContactVars,
        };
    }, [filteredVars]);

    const stepTransition = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { type: 'spring' as const, damping: 25, stiffness: 200 }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden text-left">
            <div className="bg-background border-b pt-6 shrink-0 flex items-center justify-between px-8">
                <div className="flex justify-center items-center mb-8 max-w-2xl mx-auto px-4">
                    {[
                        { n: 1, label: 'Configuration', icon: Settings2 },
                        { n: 2, label: 'Workshop', icon: Layout },
                        { n: 3, label: 'Simulation', icon: MonitorPlay }
                    ].map((s, i) => (
                        <React.Fragment key={s.n}>
                            <button type="button" onClick={() => (s.n < step || name) && setStep(s.n)} className="flex flex-col items-center group outline-none">
                                <div className={cn('flex items-center justify-center w-10 h-10 rounded-2xl border-2 transition-all duration-300 shadow-sm', step > s.n ? 'bg-primary border-primary text-white' : step === s.n ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-background border-border text-muted-foreground')}>
                                    {step > s.n ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                                </div>
                                <p className={cn('mt-3 text-[10px] font-semibold transition-colors', step >= s.n ? 'text-primary' : 'text-muted-foreground opacity-60')}>{s.label}</p>
                            </button>
                            {i < 2 && <div className="flex-1 mx-4 h-[2px] bg-muted rounded-full overflow-hidden relative"><motion.div initial={false} animate={{ width: step > s.n ? '100%' : '0%' }} className="h-full bg-primary" /></div>}
                        </React.Fragment>
                    ))}
                </div>
                <div className="flex items-center gap-3 pb-6">
                    {step > 1 && (
                        <Button
                            variant="outline"
                            onClick={() => setIsTestModalOpen(true)}
                            className="rounded-xl font-bold border-primary/20 text-primary h-11 px-6 gap-2"
                        >
                            <FlaskConical className="h-4 w-4" /> Send Test
                        </Button>
                    )}
                    <Button variant="ghost" onClick={onCancel} className="font-bold h-11">Discard</Button>
                    <Button onClick={handleCommit} disabled={isSaving || !name} className="rounded-xl font-semibold px-10 shadow-xl bg-primary text-white h-11 transition-all active:scale-95 ">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Template
                    </Button>
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div key="step1" {...stepTransition} className="absolute inset-0 p-8 overflow-y-auto">
                            <div className="max-w-3xl mx-auto space-y-8 pb-20 text-left">
                                <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-card">
                                    <CardHeader className="bg-muted/30 border-b p-8">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20"><Settings2 className="h-6 w-6" /></div>
                                            <div>
                                                <CardTitle className="text-2xl font-semibold tracking-tight">Identity & Authorization</CardTitle>
                                                <CardDescription className="text-xs font-bold text-muted-foreground/60">Configure the master parameters and shared context.</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-10 space-y-12">
                                        {/* Template Name */}
                                        <div className="space-y-4">
                                            <Label className="text-sm font-semibold text-muted-foreground ml-1">Template Name</Label>
                                            <div className="p-4 md:p-6 rounded-3xl border border-primary/10 bg-background shadow-sm hover:border-primary/20 transition-all">
                                                <Input
                                                    value={name}
                                                    onChange={e => setName(e.target.value)}
                                                    placeholder="e.g. Confirmation For School B"
                                                    className="h-10 text-lg md:text-xl font-bold border-none shadow-none px-2 bg-transparent placeholder:text-muted-foreground/40 focus-visible:ring-0"
                                                />
                                            </div>
                                        </div>

                                        {/* Shared Visibility */}
                                        <div className="space-y-4">
                                            <Label className="text-sm font-semibold text-primary ml-1 flex items-center gap-2">
                                                <Share2 className="h-4 w-4" /> Shared Visibility
                                            </Label>
                                            <div className="p-4 md:p-6 rounded-3xl border border-primary/10 bg-background shadow-sm hover:border-primary/20 transition-all">
                                                <MultiSelect
                                                    options={workspaceOptions}
                                                    value={workspaceIds}
                                                    onChange={setWorkspaceIds}
                                                    placeholder="Select hubs..."
                                                />
                                            </div>
                                            <p className="text-[11px] font-semibold text-muted-foreground px-1 leading-relaxed">Shared templates are available for logic and manual dispatch across selected hubs.</p>
                                        </div>

                                        <div className="border-t border-dashed border-border/60" />

                                        {/* Channel & Category */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                                            <div className="space-y-4">
                                                <Label className="text-sm font-semibold text-primary ml-1">Channel Logic</Label>
                                                <div className={cn("p-2 rounded-3xl border border-primary/10 bg-background shadow-sm grid grid-cols-2 gap-2", initialContext?.channel ? "opacity-70 pointer-events-none" : "")}>
                                                    <button type="button" onClick={() => { setChannel('email'); }} className={cn("h-14 rounded-2xl font-bold text-sm transition-all", channel === 'email' ? "bg-primary/5 text-primary" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50")}>Email</button>
                                                    <button type="button" onClick={() => { setChannel('sms'); setContentMode('plain_text'); }} className={cn("h-14 rounded-2xl font-bold text-sm transition-all", channel === 'sms' ? "bg-primary/5 text-primary" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50")}>SMS</button>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <Label className="text-sm font-semibold text-primary ml-1">Message Scope (Category)</Label>
                                                <div className={cn("p-3 rounded-3xl border border-primary/10 bg-background shadow-sm", initialContext?.category ? "opacity-70 pointer-events-none" : "")}>
                                                    <Select value={category} onValueChange={(v: any) => setCategory(v)} disabled={!!initialContext?.category}>
                                                        <SelectTrigger className="h-12 rounded-2xl bg-transparent border-none shadow-none font-bold text-base md:text-lg px-4 focus:ring-0"><SelectValue /></SelectTrigger>
                                                        <SelectContent className="rounded-2xl">
                                                            <SelectItem value="general">General</SelectItem>
                                                            <SelectItem value="surveys">Surveys</SelectItem>
                                                            <SelectItem value="meetings">Meetings</SelectItem>
                                                            <SelectItem value="forms">Forms</SelectItem>
                                                            <SelectItem value="agreements">Agreements</SelectItem>
                                                            <SelectItem value="campaigns">Campaigns</SelectItem>
                                                            <SelectItem value="reminders">Reminders</SelectItem>
                                                            <SelectItem value="tasks">Tasks</SelectItem>
                                                            <SelectItem value="automations">Automations</SelectItem>
                                                            <SelectItem value="qr_codes">QR Codes</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t border-dashed border-border/60" />

                                        {/* Key & Recipient */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-sm font-semibold text-primary ml-1">Template Identifier (Key)</Label>
                                                    {isTemplateTypeDirty && !initialContext?.templateType && (
                                                        <Button type="button" variant="ghost" size="sm" onClick={() => setIsTemplateTypeDirty(false)} className="h-6 text-[10px] font-bold text-primary/60 hover:text-primary px-2 rounded-lg">Reset to Auto</Button>
                                                    )}
                                                </div>
                                                <div className={cn("p-4 rounded-3xl border bg-background shadow-sm", CORE_SYSTEM_KEYS.includes(templateType) ? "border-amber-500/50" : "border-primary/10 hover:border-primary/20", initialContext?.templateType ? "opacity-70 pointer-events-none" : "")}>
                                                    <Input
                                                        value={templateType}
                                                        onChange={e => {
                                                            setTemplateType(e.target.value);
                                                            setIsTemplateTypeDirty(true);
                                                        }}
                                                        placeholder="e.g. invitation, reminder_1"
                                                        className="h-10 text-base md:text-lg font-bold font-mono border-none shadow-none bg-transparent focus-visible:ring-0"
                                                        disabled={!!initialContext?.templateType}
                                                    />
                                                </div>
                                                {CORE_SYSTEM_KEYS.includes(templateType) ? (
                                                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                                                        <div className="mt-0.5"><Save className="h-5 w-5" /></div>
                                                        <p className="text-[11px] font-bold leading-relaxed">
                                                            <span className="uppercase tracking-wider opacity-80 block mb-1">System Override</span>
                                                            This key matches a core blueprint. Saving will override the default behavior.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] font-semibold text-muted-foreground px-1 leading-relaxed">Required for system resolution. Overrides must use the same key as blueprints.</p>
                                                )}
                                            </div>
                                            <div className="space-y-4">
                                                <Label className="text-sm font-semibold text-primary ml-1">Recipient Role</Label>
                                                <div className={cn("p-3 rounded-3xl border border-primary/10 bg-background shadow-sm", initialContext?.recipientType ? "opacity-70 pointer-events-none" : "")}>
                                                    <Select value={recipientType} onValueChange={setRecipientType} disabled={!!initialContext?.recipientType}>
                                                        <SelectTrigger className="h-12 rounded-2xl bg-transparent border-none shadow-none font-bold text-base md:text-lg px-4 focus:ring-0">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-2xl">
                                                            <SelectItem value="participant">Participant / Client</SelectItem>
                                                            <SelectItem value="external_alert">External Alert</SelectItem>
                                                            <SelectItem value="internal_alert">Internal Alert</SelectItem>
                                                            <SelectItem value="referee">Referee / Second Party</SelectItem>
                                                            <SelectItem value="signatory">Signatory</SelectItem>
                                                            <SelectItem value="team_member">Team Member</SelectItem>
                                                            <SelectItem value="admin">Administrator</SelectItem>
                                                            {![
                                                                'participant', 'external_alert', 'internal_alert', 'referee', 'signatory', 'team_member', 'admin'
                                                            ].includes(recipientType) && recipientType && (
                                                                    <SelectItem value={recipientType}>{recipientType}</SelectItem>
                                                                )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <p className="text-[11px] font-semibold text-muted-foreground px-1 leading-relaxed">Specifies who the intended recipient type is.</p>
                                            </div>
                                        </div>

                                        <div className="border-t border-dashed border-border/60" />

                                        {/* Target Audience */}
                                        <div className="space-y-4">
                                            <Label className="text-sm font-semibold text-primary ml-1 flex items-center gap-2"><UserCog className="h-4 w-4" /> Target Audience</Label>
                                            <div className="p-2 rounded-3xl border border-primary/10 bg-background shadow-sm grid grid-cols-2 gap-2">
                                                <button type="button" onClick={() => setTarget('external_client')} className={cn("h-14 rounded-2xl font-bold text-sm transition-all", target === 'external_client' ? "bg-primary/5 text-primary" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50")}>External Client</button>
                                                <button type="button" onClick={() => setTarget('internal_team')} className={cn("h-14 rounded-2xl font-bold text-sm transition-all", target === 'internal_team' ? "bg-primary/5 text-primary" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50")}>Team / Staff</button>
                                            </div>
                                        </div>

                                        {/* Content Mode */}
                                        {channel === 'email' && (
                                            <>
                                                <div className="border-t border-dashed border-border/60" />
                                                <div className="space-y-4">
                                                    <Label className="text-sm font-semibold text-primary ml-1 flex items-center gap-2"><FileText className="h-4 w-4" /> Content Mode</Label>
                                                    <div className="p-2 rounded-3xl border border-primary/10 bg-background shadow-sm grid grid-cols-3 gap-2">
                                                        <button type="button" onClick={() => handleContentModeSwitch('plain_text')} className={cn("h-14 rounded-2xl font-bold text-sm transition-all", contentMode === 'plain_text' ? "bg-primary/5 text-primary" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50")}>Plain Text</button>
                                                        <button type="button" onClick={() => handleContentModeSwitch('html_code')} className={cn("h-14 rounded-2xl font-bold text-sm transition-all", contentMode === 'html_code' ? "bg-primary/5 text-primary" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50")}>HTML Code</button>
                                                        <button type="button" onClick={() => handleContentModeSwitch('rich_builder')} className={cn("h-14 rounded-2xl font-bold text-sm transition-all", contentMode === 'rich_builder' ? "bg-primary/5 text-primary" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50")}>Rich Builder</button>
                                                    </div>
                                                    <p className="text-[11px] font-semibold text-muted-foreground px-1 leading-relaxed">{contentMode === 'plain_text' ? 'Simple text with {{variable}} placeholders. Best for transactional alerts.' : contentMode === 'html_code' ? 'Raw HTML/CSS editor with live preview. Full control over markup.' : 'Visual drag-and-drop block editor. No coding required.'}</p>
                                                </div>
                                            </>
                                        )}
                                        {channel === 'email' && (
                                            <div className="space-y-8 pt-8 border-t border-dashed">
                                                <div className="space-y-6">
                                                    <div className="space-y-2"><Label className="text-[10px] font-semibold text-muted-foreground ml-1">Subject Line</Label><Input value={subject} onChange={e => setSubject(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-none font-bold text-lg px-6" autoComplete="off" /></div>
                                                    <div className="space-y-2"><Label className="text-[10px] font-semibold text-muted-foreground ml-1">Preview Text</Label><Input value={previewText} onChange={e => setPreviewText(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-none font-medium text-sm px-6" autoComplete="off" /></div>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                    <CardFooter className="justify-between bg-muted/30 p-8 border-t">
                                        <Button variant="ghost" onClick={onCancel} className="font-bold rounded-xl px-8 h-12">Cancel</Button>
                                        <Button
                                            type="button"
                                            onClick={() => setStep(2)}
                                            disabled={!name || workspaceIds.length === 0}
                                            className="px-12 rounded-xl font-semibold shadow-2xl h-12 text-sm transition-all active:scale-95 gap-2 group"
                                        >
                                            Next Phase
                                            <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="step2" {...stepTransition} className={cn("absolute inset-0 flex select-none bg-background transition-all duration-500", isFullScreen && "fixed inset-0 z-[100] h-screen w-screen")}>
                            <div className="border-r bg-background flex flex-col shrink-0 relative transition-all duration-300 shadow-xl" style={{ width: variablesWidth }}>
                                <Tabs value={sidebarTab} onValueChange={(v: any) => setSidebarTab(v)} className="flex-1 flex flex-col min-h-0">
                                    <div className="px-2 py-2 border-b bg-background shrink-0 text-left">
                                        {contentMode === 'rich_builder' ? (
                                            <TabsList className="grid w-full grid-cols-3 h-10 bg-background0 p-1 rounded-xl">
                                                <TabsTrigger value="blocks" className="text-[9px] font-semibold gap-1.5"><Layout className="h-3 w-3" /> Blocks</TabsTrigger>
                                                <TabsTrigger value="tags" className="text-[9px] font-semibold gap-1.5"><Database className="h-3 w-3" /> Tags</TabsTrigger>
                                                <TabsTrigger value="properties" className="text-[9px] font-semibold gap-1.5"><Settings2 className="h-3 w-3" /> Props</TabsTrigger>
                                            </TabsList>
                                        ) : (
                                            <div className="flex items-center gap-2 px-2 h-10"><Database className="h-4 w-4 text-primary" /><span className="text-[10px] font-semibold text-primary">Contextual Registry</span></div>
                                        )}
                                    </div>

                                    <TabsContent value="blocks" className="m-0 flex-1 min-h-0 bg-background border-t outline-none data-[state=active]:flex data-[state=active]:flex-col">
                                        <ScrollArea className="flex-1">
                                            <div className="p-4 space-y-8 text-left">
                                                <div className="grid grid-cols-2 gap-3">
                                                    {Object.entries(blockIcons).slice(0, 8).map(([type, Icon]) => (
                                                        <button key={type} onClick={() => handleAddBlock(type as any)} className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/50 bg-background hover:border-primary/40 hover:bg-primary/5 group aspect-square">
                                                            <Icon className="h-5 w-5 mb-2 group-hover:text-primary transition-colors" />
                                                            <span className="text-[10px] font-semibold tracking-tight text-foreground/70 group-hover:text-primary">{type}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>

                                    <TabsContent value="tags" className="m-0 flex-1 min-h-0 bg-background border-t text-left outline-none data-[state=active]:flex data-[state=active]:flex-col">
                                        <ScrollArea className="flex-1">
                                            <div className="p-4 space-y-6">
                                                {/* FER-02: Contact Variable Groups */}
                                                {contactVarGroups.primary.length > 0 && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2 px-1">
                                                            <UserCheck className="h-3 w-3 text-emerald-500" />
                                                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Primary Contact</span>
                                                        </div>
                                                        {contactVarGroups.primary.map(v => (
                                                            <button key={v.id} onClick={() => copyVariableToClipboard(v.key)} className="w-full text-left p-3 rounded-xl border border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group bg-card shadow-sm">
                                                                <p className="text-xs font-bold truncate text-foreground/80">{v.label}</p>
                                                                <code className="text-[9px] font-mono text-emerald-600/60 mt-1 block">{"{{" + v.key + "}}"}</code>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {contactVarGroups.signatory.length > 0 && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2 px-1">
                                                            <ShieldCheckIcon className="h-3 w-3 text-blue-500" />
                                                            <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Signatory Contact</span>
                                                        </div>
                                                        {contactVarGroups.signatory.map(v => (
                                                            <button key={v.id} onClick={() => copyVariableToClipboard(v.key)} className="w-full text-left p-3 rounded-xl border border-blue-100 hover:border-blue-300 hover:bg-blue-50 transition-all group bg-card shadow-sm">
                                                                <p className="text-xs font-bold truncate text-foreground/80">{v.label}</p>
                                                                <code className="text-[9px] font-mono text-blue-600/60 mt-1 block">{"{{" + v.key + "}}"}</code>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {contactVarGroups.roles.length > 0 && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2 px-1">
                                                            <Users className="h-3 w-3 text-violet-500" />
                                                            <span className="text-[9px] font-bold text-violet-600 uppercase tracking-wider">Role-Based Contacts</span>
                                                        </div>
                                                        {contactVarGroups.roles.map(v => (
                                                            <button key={v.id} onClick={() => copyVariableToClipboard(v.key)} className="w-full text-left p-3 rounded-xl border border-violet-100 hover:border-violet-300 hover:bg-violet-50 transition-all group bg-card shadow-sm">
                                                                <p className="text-xs font-bold truncate text-foreground/80">{v.label}</p>
                                                                <code className="text-[9px] font-mono text-violet-600/60 mt-1 block">{"{{" + v.key + "}}"}</code>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Existing Firestore Variables */}
                                                {contactVarGroups.other.length > 0 && (
                                                    <div className="space-y-2 pt-2 border-t border-border/30">
                                                        <div className="flex items-center gap-2 px-1">
                                                            <Database className="h-3 w-3 text-primary opacity-60" />
                                                            <span className="text-[9px] font-bold text-primary/60 uppercase tracking-wider">System Variables</span>
                                                        </div>
                                                        {contactVarGroups.other.map(v => (
                                                            <button key={v.id} onClick={() => copyVariableToClipboard(v.key)} className="w-full text-left p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all group bg-card shadow-sm">
                                                                <span className="text-[8px] font-semibold text-primary opacity-60">{v.sourceName || 'Core'}</span>
                                                                <p className="text-xs font-bold truncate text-foreground/80">{v.label}</p>
                                                                <code className="text-[9px] font-mono text-primary/60 mt-1 block">{"{{" + v.key + "}}"}</code>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>

                                    <TabsContent value="properties" className="m-0 flex-1 min-h-0 bg-background border-t text-left outline-none data-[state=active]:flex data-[state=active]:flex-col">
                                        <ScrollArea className="flex-1">
                                            <div className="p-4">
                                                {selectedBlockId ? (
                                                    <BlockInspector
                                                        block={blocks.find(b => b.id === selectedBlockId)!}
                                                        variables={variables}
                                                        templateCategory={category}
                                                        onUpdate={u => setBlocks(p => p.map(b => b.id === selectedBlockId ? { ...b, ...u } : b))}
                                                    />
                                                ) : (
                                                    <div className="py-20 text-center opacity-30"><Layout className="h-8 w-8 mx-auto mb-2" /><p className="text-[10px] font-semibold leading-relaxed">Select a block on the canvas<br />to edit properties</p></div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>
                                </Tabs>
                                <div className={cn("absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize z-50 transition-colors", isResizing ? "bg-primary/40" : "hover:bg-primary/20")} onMouseDown={handleMouseDown} />
                            </div>

                            <div className="flex-1 flex flex-col bg-background min-w-0">
                                <div className="p-4 border-b bg-background shrink-0 flex items-center justify-between z-20 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        {/* Designer/Code toggle only for rich_builder (Improvement 5) */}
                                        {channel === 'email' && contentMode === 'rich_builder' && (
                                            <Tabs value={editorMode} onValueChange={(v: any) => setEditorMode(v)}>
                                                <TabsList className="bg-background0 p-1 rounded-xl h-9 border">
                                                    <TabsTrigger value="designer" className="text-[9px] font-semibold gap-1.5"><Layout className="h-3 w-3" /> Designer</TabsTrigger>
                                                    <TabsTrigger value="code" className="text-[9px] font-semibold gap-1.5"><Code className="h-3 w-3" /> Code</TabsTrigger>
                                                </TabsList>
                                            </Tabs>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {channel === 'email' && contentMode !== 'plain_text' && (
                                            <div className="flex items-center gap-2 mr-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground">Style Wrapper:</Label>
                                                <Select value={styleId} onValueChange={setStyleId}>
                                                    <SelectTrigger className="h-9 w-40 rounded-xl bg-muted/20 border-none font-bold text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="none">No Wrapper (Raw)</SelectItem>
                                                        {styles.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => setIsFullScreen(!isFullScreen)} className="h-9 rounded-xl font-bold gap-2 text-xs border border-border/50">
                                            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                            {isFullScreen ? 'Exit Zen' : 'Zen Mode'}
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => setStep(3)} className="h-9 rounded-xl font-bold gap-2 text-xs border-primary/20 hover:bg-primary/5 text-primary">
                                            <Eye className="h-4 w-4" /> Simulation Studio
                                        </Button>
                                    </div>
                                </div>

                                <ScrollArea className="flex-1" onClick={() => setSelectedBlockId(null)}>
                                    <div className="max-w-4xl mx-auto p-8 pb-64">
                                        {/* contentMode-aware editor routing */}
                                        {channel === 'sms' || contentMode === 'plain_text' ? (
                                            <PlainTextEditor value={body} onChange={setBody} variables={filteredVars} channel={channel as 'email' | 'sms'} />
                                        ) : contentMode === 'html_code' ? (
                                            <HtmlCodeEditor value={body} onChange={setBody} variables={filteredVars} />
                                        ) : editorMode === 'designer' ? (
                                            <div className="max-w-[600px] mx-auto bg-card shadow-2xl rounded-[2.5rem] border border-border/50 min-h-[800px] relative overflow-hidden text-left">
                                                <div className="h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
                                                <div className="p-12 space-y-2">
                                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                                        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                                            <div className="space-y-4">
                                                                {blocks.map((block, idx) => (
                                                                    <SortableBlockItem
                                                                        key={block.id}
                                                                        id={block.id}
                                                                        index={idx}
                                                                        block={block}
                                                                        isSelected={selectedBlockId === block.id}
                                                                        simulationVars={simVariables}
                                                                        onSelect={() => { setSelectedBlockId(block.id); setSidebarTab('properties'); }}
                                                                        onRemove={() => { setBlocks(prev => prev.filter(b => b.id !== block.id)); if (selectedBlockId === block.id) setSelectedBlockId(null); }}
                                                                        onDuplicate={() => { const next = [...blocks]; next.splice(idx + 1, 0, { ...block, id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` }); setBlocks(next); }}
                                                                        onSwap={(a, b) => setBlocks(p => arrayMove(p, a, b))}
                                                                        totalCount={blocks.length}
                                                                        onUpdate={u => setBlocks(p => p.map(b => b.id === block.id ? { ...b, ...u } : b))}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </SortableContext>
                                                    </DndContext>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 text-left">
                                                <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Raw Block Code</Label>
                                                <div className="p-1 rounded-[2.5rem] shadow-2xl bg-slate-900 overflow-hidden">
                                                    <Textarea value={body} onChange={e => setBody(e.target.value)} className="min-h-[600px] rounded-[2rem] font-mono text-sm leading-relaxed p-10 border-none shadow-none focus-visible:ring-0 bg-slate-900 text-blue-400" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <SimulationStudio
                            template={initialTemplate || ({} as any)}
                            simVariables={simVariables}
                            isSimLoading={isSimLoading}
                            simEntity={simEntity} setSimEntity={setSimEntity}
                            simRecordId={simRecordId} setSimRecordId={setSimRecordId}
                            entities={entities} meetings={meetings} surveys={surveys} pdfs={pdfs}
                            resolvedPreview={(tmpl, vars) => {
                                const activeStyle = styleId !== 'none' ? styles.find(s => s.id === styleId) : null;
                                const effectiveMode = channel === 'sms' ? 'plain_text' : contentMode;
                                if (effectiveMode === 'rich_builder') {
                                    return renderBlocksToHtml(blocks, vars, { wrapper: activeStyle?.htmlWrapper });
                                }
                                let resolved = resolveVariables(body, vars);
                                if (effectiveMode === 'html_code' && activeStyle?.htmlWrapper?.includes('{{content}}')) {
                                    resolved = resolveVariables(activeStyle.htmlWrapper, vars).replace('{{content}}', resolved);
                                }
                                return resolved;
                            }}
                        />
                    )}
                </AnimatePresence>
            </div>

            <TestDispatchDialog
                open={isTestModalOpen}
                onOpenChange={setIsTestModalOpen}
                channel={channel as 'email' | 'sms'}
                rawBody={resolvedPreviewHtml}
                rawSubject={resolveVariables(subject, simVariables)}
                variables={simVariables}
                entityId={simEntity === 'School' ? simRecordId : undefined}
            />

            {/* Content Mode Switch Confirmation Dialog */}
            <AlertDialog open={!!pendingContentMode} onOpenChange={(open) => { if (!open) setPendingContentMode(null); }}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Switch Content Mode?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Switching content mode may reset your current content. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmContentModeSwitch} className="rounded-xl">Switch Mode</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
