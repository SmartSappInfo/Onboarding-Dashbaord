'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import {
    Layout,
    Settings2,
    MonitorPlay,
    Check,
    ArrowRight,
    ArrowLeft,
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
    UserCog,
    ClipboardList,
    Calendar,
    FileCheck,
    CheckSquare,
    Cpu,
    QrCode,
    Mail as MailIcon,
    Zap,
    Megaphone,
    Bell,
    Undo,
    Redo
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Skeleton } from '@/components/ui/skeleton';
import type { MessageTemplate, MessageBlock, VariableDefinition, MessageStyle, WorkspaceEntity, Meeting, Survey, PDFForm, ContentMode, TemplateTarget, TemplateStatus } from '@/lib/types';
import { renderBlocksToHtml, resolveVariables, plainTextToHtml } from '@/lib/messaging-utils';
import { SortableBlockItem, blockIcons } from './visual-block';
import { BlockInspector } from './block-inspector';
import { PlainTextEditor } from './PlainTextEditor';
import { SimulationStudio } from './simulation-studio';
import { useToast } from '@/hooks/use-toast';
import TestDispatchDialog from '../../components/TestDispatchDialog';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTerminology } from '@/hooks/use-terminology';
import { MultiSelect } from '@/components/ui/multi-select';
import { groupContactVariableDefinitions } from '@/lib/contact-variable-definitions';
import { getAllSystemVariables } from '@/lib/system-variable-definitions';
import { validateTemplateVariables } from '@/lib/template-validator';
import { Users, UserCheck, ShieldCheck as ShieldCheckIcon, AlertTriangle, AlertCircle } from 'lucide-react';

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

const CATEGORIES_META = [
    { id: 'general', label: 'General', description: 'Generic system notifications', icon: Settings2 },
    { id: 'surveys', label: 'Surveys', description: 'Feedback and questionnaire flows', icon: ClipboardList },
    { id: 'meetings', label: 'Meetings', description: 'Scheduling and event invites', icon: Calendar },
    { id: 'forms', label: 'Forms', description: 'Data intake and submission updates', icon: FileText },
    { id: 'agreements', label: 'Agreements', description: 'Contracts and signature tasks', icon: FileCheck },
    { id: 'campaigns', label: 'Campaigns', description: 'Marketing outreach and announcements', icon: Megaphone },
    { id: 'reminders', label: 'Reminders', description: 'Deadlines and alert follow-ups', icon: Bell },
    { id: 'tasks', label: 'Tasks', description: 'To-do assignments and status updates', icon: CheckSquare },
    { id: 'automations', label: 'Automations', description: 'Backend events and webhook triggers', icon: Cpu },
    { id: 'qr_codes', label: 'QR Codes', description: 'Physical check-ins and scan routing', icon: QrCode },
    { id: 'users', label: 'Users', description: 'Auth, profile, and account alerts', icon: Users }
];

// Dynamic recipient roles are defined within the component utilizing workspace terminology

interface StepperProps {
    currentStep: number;
    onStepClick: (step: number) => void;
    name: string;
}

function Stepper({ currentStep, onStepClick, name }: StepperProps) {
    const steps = [
        { n: 1, label: 'Details', icon: Settings2 },
        { n: 2, label: 'Builder', icon: Layout },
        { n: 3, label: 'Simulation', icon: MonitorPlay },
        { n: 4, label: 'Publish', icon: Share2 }
    ];

    return (
        <div className="flex justify-center items-center max-w-2xl mx-auto px-4 w-full">
            {steps.map((stepItem, index) => {
                const isActive = currentStep === stepItem.n;
                const isCompleted = currentStep > stepItem.n;
                const Icon = stepItem.icon;

                return (
                    <React.Fragment key={stepItem.label}>
                        <button
                            type="button"
                            onClick={() => onStepClick(stepItem.n)}
                            className="flex flex-col items-center group outline-none"
                        >
                            <div className={cn(
                                'flex items-center justify-center w-9 h-9 rounded-2xl border-2 transition-all duration-300 shadow-sm',
                                isCompleted ? 'bg-primary border-primary text-white' :
                                isActive ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10' :
                                'bg-background border-border text-muted-foreground',
                            )}>
                                {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-5 h-5" />}
                            </div>
                            <span className={cn(
                                'mt-3 text-[10px] font-semibold uppercase transition-colors tracking-wider',
                                isActive || isCompleted ? 'text-primary animate-pulse-once' : 'text-muted-foreground opacity-60 group-hover:opacity-100'
                            )}>
                                {stepItem.label}
                            </span>
                        </button>
                        {index < steps.length - 1 && (
                            <div className="flex-1 mx-4 h-[2px] bg-muted rounded-full overflow-hidden relative min-w-[2rem] -mt-5">
                                <motion.div
                                    initial={false}
                                    animate={{ width: isCompleted ? '100%' : '0%' }}
                                    className="absolute inset-0 bg-primary"
                                />
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

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
    mode?: 'org_override' | 'superadmin_blueprint';
}

export function TemplateWorkshop({
    initialTemplate,
    variables: rawVariables,
    styles,
    entities,
    meetings,
    surveys,
    pdfs,
    onSave,
    onCancel,
    isSaving,
    initialContext,
    mode = 'org_override'
}: TemplateWorkshopProps) {
    const { toast } = useToast();
    const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();
    const { singular: entityTerminology } = useTerminology();

    const variables = React.useMemo(() => {
        const filtered = (rawVariables || []).filter(v => !v.key.startsWith('school_'));
        
        // Dynamically build and inject terminology variables
        const terminologyVars: VariableDefinition[] = [
            {
                id: 'branding_entity_name',
                key: 'entity_name',
                label: `${entityTerminology || 'Campus'} Name`,
                category: 'common',
                source: 'branding',
                sourceName: 'Branding & Constants',
                entity: 'Entity',
                path: 'name',
                type: 'string',
            },
            {
                id: 'branding_entity_email',
                key: 'entity_email',
                label: `${entityTerminology || 'Campus'} Email`,
                category: 'common',
                source: 'branding',
                sourceName: 'Branding & Constants',
                entity: 'Entity',
                path: 'email',
                type: 'string',
            },
            {
                id: 'branding_entity_phone',
                key: 'entity_phone',
                label: `${entityTerminology || 'Campus'} Phone`,
                category: 'common',
                source: 'branding',
                sourceName: 'Branding & Constants',
                entity: 'Entity',
                path: 'phone',
                type: 'string',
            },
            {
                id: 'branding_entity_location',
                key: 'entity_location',
                label: `${entityTerminology || 'Campus'} Location`,
                category: 'common',
                source: 'branding',
                sourceName: 'Branding & Constants',
                entity: 'Entity',
                path: 'locationString',
                type: 'string',
            },
            {
                id: 'branding_entity_initials',
                key: 'entity_initials',
                label: `${entityTerminology || 'Campus'} Initials`,
                category: 'common',
                source: 'branding',
                sourceName: 'Branding & Constants',
                entity: 'Entity',
                path: 'initials',
                type: 'string',
            },
            {
                id: 'branding_entity_package',
                key: 'entity_package',
                label: `${entityTerminology || 'Campus'} Package`,
                category: 'common',
                source: 'branding',
                sourceName: 'Branding & Constants',
                entity: 'Entity',
                path: 'subscriptionPackageName',
                type: 'string',
            }
        ];
        
        const seenKeys = new Set(filtered.map(v => v.key));
        const filteredTerminologyVars = terminologyVars.filter(v => !seenKeys.has(v.key));

        return [...filteredTerminologyVars, ...filtered];
    }, [rawVariables, entityTerminology]);

    const recipientRoles = React.useMemo(() => [
        { id: 'participant', label: 'Meeting Participant or Client', type: 'external_client' },
        { id: 'referee', label: 'Referee / Second Party Reference', type: 'external_client' },
        { id: 'signatory', label: 'PDF or Agreement Signatory', type: 'external_client' },
        { id: 'external_alert', label: `External Messages to ${entityTerminology || 'Entity'}`, type: 'external_client' },
        { id: 'team_member', label: 'Users and Team Member Alerts', type: 'internal_team' },
        { id: 'admin', label: 'System and Admin Alerts', type: 'internal_team' },
        { id: 'internal_alert', label: 'System and Operations Alerts', type: 'internal_team' },
        { id: 'respondent', label: 'Survey Respondents', type: 'external_client' },
        { id: 'assignee', label: 'Task Assignee', type: 'internal_team' }
    ], [entityTerminology]);

    const [step, setStep] = React.useState(1);
    const [editorMode, setEditorMode] = React.useState<'designer' | 'code'>('designer');
    const [isFullScreen, setIsFullScreen] = React.useState(false);
    const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);
    const [sidebarTab, setSidebarTab] = React.useState<'blocks' | 'tags' | 'properties' | 'validation'>('blocks');
    const [variablesWidth, setVariablesWidth] = React.useState(320);
    const [isResizing, setIsResizing] = React.useState(false);
    const [isTestModalOpen, setIsTestModalOpen] = React.useState(false);
    const [showValidationErrorDialog, setShowValidationErrorDialog] = React.useState(false);

    // Active editor insertion reference
    const editorInsertRef = React.useRef<((token: string) => void) | null>(null);

    // Sidebar collapsible tags accordion state
    const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});

    // Form State
    const [status, setStatus] = React.useState<TemplateStatus>(initialTemplate?.status || 'draft');
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
    
    // Default style wrapper selector logic
    const [styleId, setStyleId] = React.useState(() => {
        if (initialTemplate) return initialTemplate.styleId || 'none';
        if (initialContext?.channel === 'sms') return 'none';
        const defaultStyle = styles.find(s => s.isDefault);
        return defaultStyle?.id || 'none';
    });

    React.useEffect(() => {
        if (!initialTemplate) {
            if (contentMode === 'html_code') {
                setStyleId('none');
            } else {
                const defaultStyle = styles.find(s => s.isDefault);
                setStyleId(defaultStyle?.id || 'none');
            }
        }
    }, [contentMode, initialTemplate, styles]);

    // Undo / Redo History State tracking
    const [historyStack, setHistoryStack] = React.useState<{ body: string; blocks: MessageBlock[] }[]>([]);
    const [historyPointer, setHistoryPointer] = React.useState(-1);
    const preventHistoryPushRef = React.useRef(false);

    // Initialize history stack
    React.useEffect(() => {
        if (historyStack.length === 0 && (body || blocks.length > 0)) {
            setHistoryStack([{ body, blocks }]);
            setHistoryPointer(0);
        }
    }, [body, blocks]);

    const pushHistoryState = React.useCallback((newBody: string, newBlocks: MessageBlock[]) => {
        if (preventHistoryPushRef.current) return;
        setHistoryStack(prev => {
            const cleaned = prev.slice(0, historyPointer + 1);
            const last = cleaned[cleaned.length - 1];
            if (last && last.body === newBody && JSON.stringify(last.blocks) === JSON.stringify(newBlocks)) {
                return prev;
            }
            const nextStack = [...cleaned, { body: newBody, blocks: newBlocks }];
            setHistoryPointer(nextStack.length - 1);
            return nextStack;
        });
    }, [historyPointer]);

    const debouncedPushHistoryRef = React.useRef<NodeJS.Timeout | null>(null);
    const pushHistoryStateDebounced = React.useCallback((newBody: string, newBlocks: MessageBlock[]) => {
        if (debouncedPushHistoryRef.current) {
            clearTimeout(debouncedPushHistoryRef.current);
        }
        debouncedPushHistoryRef.current = setTimeout(() => {
            pushHistoryState(newBody, newBlocks);
        }, 500);
    }, [pushHistoryState]);

    const handleUndo = React.useCallback(() => {
        if (historyPointer > 0) {
            preventHistoryPushRef.current = true;
            const nextPointer = historyPointer - 1;
            const prevState = historyStack[nextPointer];
            setHistoryPointer(nextPointer);
            setBody(prevState.body);
            setBlocks(prevState.blocks);
            setTimeout(() => {
                preventHistoryPushRef.current = false;
            }, 50);
        }
    }, [historyPointer, historyStack]);

    const handleRedo = React.useCallback(() => {
        if (historyPointer < historyStack.length - 1) {
            preventHistoryPushRef.current = true;
            const nextPointer = historyPointer + 1;
            const nextState = historyStack[nextPointer];
            setHistoryPointer(nextPointer);
            setBody(nextState.body);
            setBlocks(nextState.blocks);
            setTimeout(() => {
                preventHistoryPushRef.current = false;
            }, 50);
        }
    }, [historyPointer, historyStack]);

    // Track active changes to body/blocks and push them to the history stack
    React.useEffect(() => {
        if (preventHistoryPushRef.current) return;
        const lastState = historyStack[historyPointer];
        if (!lastState) return;

        const blocksChanged = JSON.stringify(lastState.blocks) !== JSON.stringify(blocks);
        const bodyChanged = lastState.body !== body;

        if (blocksChanged) {
            pushHistoryState(body, blocks);
        } else if (bodyChanged) {
            pushHistoryStateDebounced(body, blocks);
        }
    }, [body, blocks, historyStack, historyPointer, pushHistoryState, pushHistoryStateDebounced]);

    // Keyboard shortcuts listener (Cmd+Z / Ctrl+Z, Cmd+Shift+Z / Ctrl+Shift+Z)
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (step !== 2) return;
            const isZ = e.key.toLowerCase() === 'z';
            const isY = e.key.toLowerCase() === 'y';
            const isMeta = e.metaKey || e.ctrlKey;
            const isShift = e.shiftKey;

            if (isMeta && isZ) {
                e.preventDefault();
                if (isShift) {
                    handleRedo();
                } else {
                    handleUndo();
                }
            } else if (isMeta && isY) {
                e.preventDefault();
                handleRedo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [step, handleUndo, handleRedo]);

    // Simulation State
    const [simEntity, setSimEntity] = React.useState('none');
    const [simRecordId, setSimRecordId] = React.useState('none');
    const [simVariables, setSimVariables] = React.useState<Record<string, any>>({});
    const [isSimLoading, setIsSimLoading] = React.useState(false);

    // Simulation variable fallbacks for brand wrapper previews
    const orgFallbacks = React.useMemo(() => ({
        org_name: 'SmartSapp Hub',
        org_logo_url: 'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/SmartSapp%20Logo%20short.png?alt=media&token=046f95a8-b331-4129-a4ef-43ae7837eadd',
        org_email: 'support@smartsapp.com',
        org_phone: '+233 24 273 7120',
        org_address: 'SmartSapp Intelligence Hub, Accra, Ghana',
        org_website: 'https://smartsapp.com',
        current_year: new Date().getFullYear().toString()
    }), []);

    const activeSimVariables = React.useMemo(() => {
        return { ...orgFallbacks, ...simVariables };
    }, [simVariables, orgFallbacks]);

    const [pendingContentMode, setPendingContentMode] = React.useState<ContentMode | null>(null);
    const [isTemplateTypeDirty, setIsTemplateTypeDirty] = React.useState(!!initialTemplate?.templateType || !!initialContext?.templateType);

    // Auto-generate templateType from name if not manually modified
    React.useEffect(() => {
        if (!isTemplateTypeDirty && !initialContext?.templateType && name) {
            setTemplateType(slugify(`${category}_${recipientType}_${name}`));
        }
    }, [name, category, recipientType, isTemplateTypeDirty, initialContext?.templateType]);

    // Sync recipientType -> target audience
    React.useEffect(() => {
        const internalRoles = ['internal_alert', 'assignee', 'team_member', 'admin'];
        if (internalRoles.includes(recipientType)) {
            setTarget('internal_team');
        } else {
            setTarget('external_client');
        }
    }, [recipientType]);

    const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

    // Sync simulation variables when record ID, entity, or workspace changes
    React.useEffect(() => {
        let active = true;
        if (simRecordId === 'none' || simEntity === 'none') {
            setSimVariables({});
            return;
        }

        const loadSimVars = async () => {
            setIsSimLoading(true);
            try {
                const { getSimulationVariablesAction } = await import('@/lib/messaging-actions');
                const res = await getSimulationVariablesAction({
                    entityId: simEntity === 'School' ? simRecordId : undefined,
                    meetingId: simEntity === 'Meeting' ? simRecordId : undefined,
                    surveyId: simEntity === 'Survey' ? simRecordId : undefined,
                    pdfId: simEntity === 'Submission' ? simRecordId : undefined,
                    workspaceId: activeWorkspaceId,
                });
                if (active && res.success && res.variables) {
                    setSimVariables(res.variables);
                } else if (active) {
                    setSimVariables({});
                }
            } catch (err) {
                console.error("Failed to load simulation variables:", err);
                if (active) setSimVariables({});
            } finally {
                if (active) setIsSimLoading(false);
            }
        };

        loadSimVars();
        return () => {
            active = false;
        };
    }, [simRecordId, simEntity, activeWorkspaceId]);

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

    const handleDragEnd = (event: any) => {
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
        if (contentMode !== 'rich_builder' && sidebarTab !== 'tags' && sidebarTab !== 'validation') {
            setSidebarTab('tags');
        }
    }, [contentMode, sidebarTab]);

    const confirmContentModeSwitch = React.useCallback(() => {
        if (!pendingContentMode) return;
        // Clear stale data for the old mode (Risk Analysis: Improvement 2)
        if (contentMode === 'rich_builder') {
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
    const executeCommit = () => {
        const categoryToContextMap: Record<string, string> = {
            meetings: 'meeting',
            surveys: 'survey',
            forms: 'form',
            agreements: 'agreement',
            users: 'users',
        };
        const variableContext = categoryToContextMap[category] || 'common';

        // Clear irrelevant data on save (Risk Analysis: Improvement 2)
        const saveData: any = {
            name, category, channel, contentMode, target, workspaceIds,
            subject, previewText, body, blocks, styleId, templateType,
            recipientType, status, variableContext
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

    const handleCommit = () => {
        if (errorCount > 0) {
            setShowValidationErrorDialog(true);
            return;
        }
        executeCommit();
    };

    // contentMode-aware preview (Risk Analysis: Risk 3 fix)
    const extractBgColor = React.useCallback((html: string) => {
        const bodyMatch = html.match(/<body[^>]*style=["']([^"']*)["']/i);
        if (bodyMatch) {
            const style = bodyMatch[1];
            const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/i);
            if (bgMatch) return bgMatch[1].trim();
        }
        const divMatch = html.match(/<div[^>]*style=["']([^"']*)["']/i);
        if (divMatch) {
            const style = divMatch[1];
            const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/i);
            if (bgMatch) return bgMatch[1].trim();
        }
        return '';
    }, []);

    const wrapperStyles = React.useMemo(() => {
        const activeStyle = styleId !== 'none' ? styles.find(s => s.id === styleId) : null;
        if (!activeStyle) return null;
        
        const html = activeStyle.htmlWrapper;
        let outerBg = '';
        const bodyStyleMatch = html.match(/<body[^>]*style=["']([^"']*)["']/i);
        if (bodyStyleMatch) {
            const bgMatch = bodyStyleMatch[1].match(/background(?:-color)?:\s*([^;]+)/i);
            if (bgMatch) outerBg = bgMatch[1].trim();
        }
        
        let cardBg = '';
        let borderRadius = '';
        let border = '';
        const cardDivMatch = html.match(/<div[^>]*style=["']([^"']*)["']/gi);
        if (cardDivMatch) {
            const cardStyle = cardDivMatch.find(s => s.includes('max-width') || s.includes('margin') || s.includes('border'));
            if (cardStyle) {
                const bgMatch = cardStyle.match(/background(?:-color)?:\s*([^;]+)/i);
                if (bgMatch) cardBg = bgMatch[1].trim();
                const brMatch = cardStyle.match(/border-radius:\s*([^;]+)/i);
                if (brMatch) borderRadius = brMatch[1].trim();
                const borderMatch = cardStyle.match(/border:\s*([^;]+)/i);
                if (borderMatch) border = borderMatch[1].trim();
            }
        }
        
        return { outerBg, cardBg, borderRadius, border };
    }, [styleId, styles]);

    const resolvedHeader = React.useMemo(() => {
        const activeStyle = styleId !== 'none' ? styles.find(s => s.id === styleId) : null;
        if (!activeStyle) return '';
        const html = activeStyle.htmlWrapper;
        const contentIdx = html.indexOf('{{content}}');
        if (contentIdx === -1) return '';
        let headerPart = html.substring(0, contentIdx);
        
        headerPart = headerPart.replace(/<html[^>]*>/i, '')
                               .replace(/<\/html>/i, '')
                               .replace(/<head[^>]*>[\s\S]*?<\/head>/i, '')
                               .replace(/<body[^>]*>/i, '')
                               .replace(/<\/body>/i, '');
                               
        const firstDiv = headerPart.match(/<div[^>]*style=["'][^"']*max-width[^"']*["'][^>]*>/i);
        if (firstDiv) {
            headerPart = headerPart.replace(firstDiv[0], '');
        }
        const lastDiv = headerPart.match(/<div[^>]*style=["'][^"']*padding[^"']*["'][^>]*>$/i);
        if (lastDiv) {
            headerPart = headerPart.replace(lastDiv[0], '');
        }
        
        return resolveVariables(headerPart, activeSimVariables);
    }, [styleId, styles, activeSimVariables]);

    const resolvedFooter = React.useMemo(() => {
        const activeStyle = styleId !== 'none' ? styles.find(s => s.id === styleId) : null;
        if (!activeStyle) return '';
        const html = activeStyle.htmlWrapper;
        const contentIdx = html.indexOf('{{content}}');
        if (contentIdx === -1) return '';
        let footerPart = html.substring(contentIdx + 11);
        
        footerPart = footerPart.replace(/<html[^>]*>/i, '')
                               .replace(/<\/html>/i, '')
                               .replace(/<body[^>]*>/i, '')
                               .replace(/<\/body>/i, '')
                               .replace(/<\/div>\s*<\/body>/i, '')
                               .replace(/<\/div>\s*<\/div>\s*<\/body>/i, '');
                               
        footerPart = footerPart.replace(/<\/div>\s*$/i, '')
                               .replace(/<\/div>\s*<\/div>\s*$/i, '');
                               
        return resolveVariables(footerPart, activeSimVariables);
    }, [styleId, styles, activeSimVariables]);

    const resolvedPreviewHtml = React.useMemo(() => {
        const activeStyle = styleId !== 'none' ? styles.find(s => s.id === styleId) : null;
        const effectiveMode = channel === 'sms' ? 'plain_text' : contentMode;

        if (effectiveMode === 'rich_builder') {
            return renderBlocksToHtml(blocks, activeSimVariables, {
                wrapper: activeStyle?.htmlWrapper
            });
        }
        let resolved = resolveVariables(body, activeSimVariables);
        if (effectiveMode === 'plain_text' && channel === 'email') {
            resolved = resolved.replace(/\n/g, '<br>\n');
        }
        if (activeStyle?.htmlWrapper?.includes('{{content}}')) {
            resolved = resolveVariables(activeStyle.htmlWrapper, activeSimVariables).replace('{{content}}', resolved);
        } else if (effectiveMode === 'plain_text' && channel === 'email') {
            resolved = plainTextToHtml(resolved);
        }
        return resolved;
    }, [contentMode, blocks, body, activeSimVariables, styleId, styles, channel]);

    const filteredVars = React.useMemo(() => {
        let list = variables;
        if (category === 'general') {
            list = variables.filter(v => v.category === 'general' || v.category === 'common' || v.category === 'custom');
        } else {
            list = variables.filter(v => 
                v.category === 'general' || 
                v.category === 'common' || 
                v.category === 'custom' ||
                v.category === category
            );
        }

        // Active simulation context-aware variable filtering
        if (simRecordId !== 'none') {
            list = list.filter(v => {
                if (v.category === 'general' || v.category === 'common' || v.category === 'custom' || v.key.startsWith('contact_') || v.category === 'contact') {
                    return true;
                }
                if (simEntity === 'Survey') {
                    return v.id.includes(simRecordId) || v.sourceId === simRecordId;
                }
                if (simEntity === 'Meeting') {
                    return v.id.includes(simRecordId) || v.sourceId === simRecordId;
                }
                if (simEntity === 'Submission') {
                    return v.id.includes(simRecordId) || v.sourceId === simRecordId;
                }
                return true;
            });
        }
        return list;
    }, [variables, category, simEntity, simRecordId]);

    const validationErrors = React.useMemo(() => {
        const tmpl: Partial<MessageTemplate> = {
            subject,
            previewText,
            body,
            blocks,
            category: category as MessageTemplate['category']
        };
        return validateTemplateVariables(tmpl, [...filteredVars, ...getAllSystemVariables()]);
    }, [subject, previewText, body, blocks, category, filteredVars]);

    const errorCount = React.useMemo(() => validationErrors.filter(e => e.type === 'error').length, [validationErrors]);
    const warningCount = React.useMemo(() => validationErrors.filter(e => e.type === 'warning').length, [validationErrors]);

    const contactVars = React.useMemo(() => {
        return filteredVars.filter(v => v.key.startsWith('contact_') || v.category === 'contact');
    }, [filteredVars]);

    const nonContactVars = React.useMemo(() => {
        return filteredVars.filter(v => !v.key.startsWith('contact_') && v.category !== 'contact' && v.category !== 'custom');
    }, [filteredVars]);

    const customVars = React.useMemo(() => {
        return filteredVars.filter(v => v.category === 'custom');
    }, [filteredVars]);

    const contactVarGroups = React.useMemo(() => {
        const primary = contactVars.filter(v => !v.key.includes('_roles_') && !v.key.includes('_signatory_'));
        const signatory = contactVars.filter(v => v.key.includes('_signatory_'));
        const roles = contactVars.filter(v => v.key.includes('_roles_'));
        return {
            primary,
            signatory,
            roles,
            custom: customVars,
            other: nonContactVars
        };
    }, [contactVars, nonContactVars, customVars]);

    // Filtered variables for editors based on classification category to prevent context mix-ups
    const availableVarsForEditor = React.useMemo(() => {
        const workspaceVars = filteredVars;
        const sysVars = getAllSystemVariables().filter(v => 
            v.category === 'general' || 
            v.category === 'common' || 
            v.category === category ||
            (category === 'agreements' && v.category === 'forms') ||
            (category === 'forms' && v.category === 'agreements')
        );

        // Deduplicate keys (prefer workspace-specific definitions if there is a collision)
        const seenKeys = new Set(workspaceVars.map(v => v.key));
        const dedupedSysVars = sysVars.filter(v => !seenKeys.has(v.key));

        return [...workspaceVars, ...dedupedSysVars];
    }, [filteredVars, category]);

    // Group dynamically harvested survey question variables by individual surveys
    const surveyGroups = React.useMemo(() => {
        if (category !== 'surveys') return [];
        const surveyVars = filteredVars.filter(v => v.category === 'surveys' || v.source === 'surveys');
        const groupsMap: Record<string, { title: string; variables: VariableDefinition[] }> = {};

        surveyVars.forEach(v => {
            const survey = surveys?.find(s => v.id.startsWith(`survey_${s.id}_`));
            if (survey) {
                const gId = `survey_${survey.id}`;
                if (!groupsMap[gId]) {
                    groupsMap[gId] = { title: survey.title || survey.internalName || 'Survey', variables: [] };
                }
                groupsMap[gId].variables.push(v);
            } else {
                const gId = 'survey_general';
                if (!groupsMap[gId]) {
                    groupsMap[gId] = { title: 'Other Survey Answers', variables: [] };
                }
                groupsMap[gId].variables.push(v);
            }
        });

        return Object.entries(groupsMap).map(([id, g]) => ({ id, ...g }));
    }, [filteredVars, category, surveys]);

    // Group dynamically harvested PDF form field variables by individual forms
    const pdfGroups = React.useMemo(() => {
        if (category !== 'forms' && category !== 'agreements') return [];
        const pdfVars = filteredVars.filter(v => v.category === 'forms' || v.source === 'forms');
        const groupsMap: Record<string, { title: string; variables: VariableDefinition[] }> = {};

        pdfVars.forEach(v => {
            const pdf = pdfs?.find(p => v.id.startsWith(`pdf_${p.id}_`));
            if (pdf) {
                const gId = `pdf_${pdf.id}`;
                if (!groupsMap[gId]) {
                    groupsMap[gId] = { title: pdf.name || pdf.publicTitle || 'Form', variables: [] };
                }
                groupsMap[gId].variables.push(v);
            } else {
                const gId = 'pdf_general';
                if (!groupsMap[gId]) {
                    groupsMap[gId] = { title: 'Other Form Fields', variables: [] };
                }
                groupsMap[gId].variables.push(v);
            }
        });

        return Object.entries(groupsMap).map(([id, g]) => ({ id, ...g }));
    }, [filteredVars, category, pdfs]);

    // Dynamic labels dictionary for VariablePicker contexts
    const contextLabels = React.useMemo(() => {
        const labels: Record<string, string> = {
            common: 'Common Variables',
            meeting: 'Meeting Variables',
            survey: 'Survey Variables',
            form: 'Form Variables',
            agreement: 'Agreement Variables',
            entity: 'Entity Variables',
            campaign: 'Campaign Variables',
            custom: 'Custom Variables',
        };

        if (surveys) {
            surveys.forEach(s => {
                labels[`survey_${s.id}`] = `Survey: ${s.title || s.internalName}`;
            });
        }
        if (pdfs) {
            pdfs.forEach(p => {
                labels[`pdf_${p.id}`] = `Form: ${p.name || p.publicTitle}`;
            });
        }

        return labels;
    }, [surveys, pdfs]);

    const featureSpecificVars = React.useMemo(() => {
        const sysVars = getAllSystemVariables();
        if (category === 'meetings') {
            return sysVars.filter(v => v.category === 'meetings');
        } else if (category === 'surveys') {
            return sysVars.filter(v => v.category === 'surveys');
        } else if (category === 'forms' || category === 'agreements') {
            return sysVars.filter(v => v.category === 'forms' || v.category === 'agreements');
        }
        return [];
    }, [category]);

    const stepTransition = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { type: 'spring' as const, damping: 25, stiffness: 200 }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden text-left bg-background">
            <header className="sticky top-0 z-50 border-b px-6 h-16 flex items-center justify-between shrink-0 bg-background">
                <div className="flex items-center gap-4 text-left">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={onCancel}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="font-semibold text-sm tracking-tight leading-none mb-1 truncate max-w-[200px]">
                            {name || 'Untitled Template'}
                        </h1>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[8px] h-4 font-semibold uppercase border-primary/20 text-primary bg-primary/5">
                                Messaging Studio
                            </Badge>
                            <Badge variant="secondary" className="text-[8px] h-4 font-semibold uppercase">
                                {mode === 'superadmin_blueprint' ? 'System Blueprint' : 'Workspace'}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {step > 1 && (
                        <Button
                            variant="outline"
                            onClick={() => setIsTestModalOpen(true)}
                            className="rounded-xl font-bold border-blue-200 text-blue-600 hover:bg-blue-50/55 h-9 px-4 gap-2 text-[10px] active:scale-95 transition-all"
                        >
                            <FlaskConical className="h-4 w-4" /> Send Test
                        </Button>
                    )}
                    <Button variant="ghost" onClick={onCancel} className="font-bold h-9 text-xs">Discard</Button>
                    <Button
                        onClick={handleCommit}
                        disabled={isSaving || !name}
                        className="rounded-xl font-semibold px-5 bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs transition-all active:scale-95"
                    >
                        {isSaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                        Save Template
                    </Button>
                </div>
            </header>

            <div className="shrink-0 bg-muted/10 border-b py-4 flex justify-center items-center shadow-sm z-40 relative">
                <Stepper currentStep={step} onStepClick={setStep} name={name} />
            </div>

            {mode === 'superadmin_blueprint' && (
                <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-3 flex items-center justify-center gap-3 shadow-sm z-10 relative">
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <span className="uppercase tracking-widest opacity-80 mr-2">Superadmin Mode:</span>
                        You are editing a Global System Blueprint. Changes will instantly deploy to all organizations unless overridden.
                    </p>
                </div>
            )}

            <div className="flex-1 relative overflow-hidden">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div key="step1" {...stepTransition} className="absolute inset-0 overflow-y-auto">
                            <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-8 text-left pb-20">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                    {/* Left Column: Delivery Channel Card */}
                                    <div className="space-y-6">
                                        <Card className="rounded-2xl border border-border shadow-sm bg-card">
                                            <CardHeader>
                                                <CardTitle className="text-base font-semibold">Delivery Channel</CardTitle>
                                                <CardDescription className="text-xs">Specify communication channel and format mode.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-5 text-left">
                                                <div className={cn("grid grid-cols-2 gap-3", initialContext?.channel ? "opacity-70 pointer-events-none" : "")}>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setChannel('email'); }}
                                                        className={cn(
                                                            "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200",
                                                            channel === 'email'
                                                                ? "border-primary bg-primary/5 text-primary shadow-sm"
                                                                : "border-border/40 bg-card text-muted-foreground hover:border-primary/20 hover:text-foreground"
                                                        )}
                                                    >
                                                        <div className={cn("p-2 rounded-lg transition-colors", channel === 'email' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                                                            <MailIcon className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold">Email</p>
                                                            <p className="text-[9px] text-muted-foreground">Rich messages</p>
                                                        </div>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setChannel('sms'); setContentMode('plain_text'); }}
                                                        className={cn(
                                                            "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200",
                                                            channel === 'sms'
                                                                ? "border-primary bg-primary/5 text-primary shadow-sm"
                                                                : "border-border/40 bg-card text-muted-foreground hover:border-primary/20 hover:text-foreground"
                                                        )}
                                                    >
                                                        <div className={cn("p-2 rounded-lg transition-colors", channel === 'sms' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                                                            <PhoneIcon className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold">SMS Text</p>
                                                            <p className="text-[9px] text-muted-foreground">Plain text alerts</p>
                                                        </div>
                                                    </button>
                                                </div>

                                                {channel === 'email' && (
                                                    <div className="space-y-3 pt-4 border-t border-dashed border-border/85">
                                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Content Mode</Label>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {[
                                                                { id: 'plain_text', label: 'Plain Text', desc: 'Simple body tag editor', icon: FileText },
                                                                { id: 'html_code', label: 'HTML Code', desc: 'Raw HTML source coder', icon: Code },
                                                                { id: 'rich_builder', label: 'Visual Blocks', desc: 'Drag-and-drop designer', icon: Layout }
                                                            ].map((modeItem) => (
                                                                <button
                                                                    key={modeItem.id}
                                                                    type="button"
                                                                    onClick={() => handleContentModeSwitch(modeItem.id as any)}
                                                                    className={cn(
                                                                        "flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all duration-200 aspect-video",
                                                                        contentMode === modeItem.id
                                                                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                                                                            : "border-border/40 bg-card text-muted-foreground hover:border-primary/20 hover:text-foreground"
                                                                    )}
                                                                >
                                                                    <modeItem.icon className={cn("h-4 w-4 shrink-0 mb-1", contentMode === modeItem.id ? "text-primary" : "text-muted-foreground")} />
                                                                    <span className="text-[10px] font-bold">{modeItem.label}</span>
                                                                    <span className="text-[8px] text-muted-foreground/60 leading-none mt-0.5">{modeItem.desc}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Subject & Preview (Email Only) */}
                                                {channel === 'email' && (
                                                    <div className="space-y-4 pt-4 border-t border-dashed border-border/80">
                                                        <div className="space-y-2 text-left">
                                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Subject Line</Label>
                                                            <Input
                                                                value={subject}
                                                                onChange={e => setSubject(e.target.value)}
                                                                placeholder="Enter email subject line..."
                                                                className="h-11 rounded-xl bg-background border border-border shadow-sm focus:ring-1 focus:ring-primary/20 transition-all font-semibold"
                                                                autoComplete="off"
                                                            />
                                                        </div>
                                                        <div className="space-y-2 text-left">
                                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Preview Text</Label>
                                                            <Input
                                                                value={previewText}
                                                                onChange={e => setPreviewText(e.target.value)}
                                                                placeholder="Enter email preview text..."
                                                                className="h-11 rounded-xl bg-background border border-border shadow-sm focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                                                                autoComplete="off"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Right Column: Taxonomy & Audience Card */}
                                    <div className="space-y-6">
                                        <Card className="rounded-2xl border border-border bg-card shadow-sm">
                                            <CardHeader>
                                                <CardTitle className="text-base font-semibold">Taxonomy & Audience</CardTitle>
                                                <CardDescription className="text-xs">Classify messaging workflow and identify recipient targeting.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-5 text-left">
                                                {/* Classification Category Select */}
                                                <div className="space-y-2 text-left">
                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Classification Category</Label>
                                                    <Select value={category} onValueChange={(v) => setCategory(v as any)} disabled={!!initialContext?.category}>
                                                        <SelectTrigger className="h-11 rounded-xl bg-background border border-border shadow-sm">
                                                            <SelectValue placeholder="Select classification category..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            {CATEGORIES_META.map((cat) => {
                                                                const CatIcon = cat.icon;
                                                                return (
                                                                    <SelectItem key={cat.id} value={cat.id} className="rounded-lg">
                                                                        <div className="flex items-center gap-2.5 py-0.5">
                                                                            <div className="p-1 rounded bg-muted text-muted-foreground">
                                                                                <CatIcon className="h-3.5 w-3.5" />
                                                                            </div>
                                                                            <div className="flex flex-col text-left">
                                                                                <span className="text-xs font-bold leading-none">{cat.label}</span>
                                                                                <span className="text-[9px] text-muted-foreground mt-0.5">{cat.description}</span>
                                                                            </div>
                                                                        </div>
                                                                    </SelectItem>
                                                                );
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Target Audience Inferred Card */}
                                                <div className="space-y-2 text-left">
                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Target Audience</Label>
                                                    <div className="p-4 rounded-xl bg-muted/20 border border-border flex items-center justify-between">
                                                        <div>
                                                            <p className="text-xs font-bold text-foreground">Audience Type</p>
                                                            <p className="text-[9px] text-muted-foreground">Inferred from Recipient Role</p>
                                                        </div>
                                                        <div className={cn(
                                                            "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm border",
                                                            target === 'external_client'
                                                                ? "bg-blue-50/50 text-blue-700 border-blue-100"
                                                                : "bg-indigo-50/50 text-indigo-700 border-indigo-100"
                                                        )}>
                                                            {target === 'external_client' ? 'External Client' : 'Team / Staff'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Recipient Role Select & Custom input */}
                                                <div className="space-y-3 text-left">
                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Recipient Role</Label>
                                                    <Select
                                                        value={recipientRoles.some(r => r.id === recipientType) ? recipientType : 'custom'}
                                                        onValueChange={(val) => {
                                                            if (val === 'custom') {
                                                                setRecipientType('');
                                                            } else {
                                                                setRecipientType(val);
                                                            }
                                                        }}
                                                        disabled={!!initialContext?.recipientType}
                                                    >
                                                        <SelectTrigger className="h-11 rounded-xl bg-background border border-border shadow-sm">
                                                            <SelectValue placeholder="Select recipient role..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            {recipientRoles.map((role) => (
                                                                <SelectItem key={role.id} value={role.id} className="rounded-lg">
                                                                    <div className="flex items-center justify-between w-full py-0.5 gap-2">
                                                                        <div className="flex flex-col text-left">
                                                                            <span className="text-xs font-bold leading-none">{role.label}</span>
                                                                            <span className="text-[9px] text-muted-foreground mt-1 font-mono">{role.id}</span>
                                                                        </div>
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                            <SelectItem value="custom" className="rounded-lg">
                                                                <div className="flex flex-col text-left">
                                                                    <span className="text-xs font-bold leading-none text-blue-600">Custom Role...</span>
                                                                    <span className="text-[9px] text-muted-foreground mt-1">Specify custom recipient role</span>
                                                                </div>
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>

                                                    {(!recipientRoles.some(r => r.id === recipientType) || recipientType === 'custom') && (
                                                        <div className="mt-2 space-y-1.5 animate-in fade-in-50 duration-200">
                                                            <Label className="text-[9px] font-semibold text-muted-foreground ml-1">Custom Role Name</Label>
                                                            <Input
                                                                value={!recipientRoles.some(r => r.id === recipientType) ? recipientType : ''}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    setRecipientType(slugify(val) || val);
                                                                }}
                                                                placeholder="Enter custom role (e.g. guest_speaker)..."
                                                                className="h-10 rounded-xl bg-background border border-border shadow-sm focus:ring-1 focus:ring-primary/20 transition-all font-semibold font-mono"
                                                                disabled={!!initialContext?.recipientType}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>

                                {/* Bottom Actions Bar */}
                                <div className="flex justify-between items-center pt-6 border-t border-border mt-8">
                                    <Button variant="ghost" onClick={onCancel} className="font-bold rounded-xl px-6 h-11 text-xs">
                                        Discard Changes
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => setStep(2)}
                                        className="px-8 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg h-11 text-xs transition-all active:scale-95 gap-2 group"
                                    >
                                        Next Phase: Builder
                                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="step2" {...stepTransition} className={cn("absolute inset-0 flex select-none bg-background transition-all duration-500", isFullScreen && "fixed inset-0 z-[100] h-screen w-screen")}>
                            <div className="border-r bg-background flex flex-col shrink-0 relative transition-all duration-300 shadow-xl" style={{ width: variablesWidth }}>
                                <Tabs value={sidebarTab} onValueChange={(v: any) => setSidebarTab(v)} className="flex-1 flex flex-col min-h-0">
                                    <div className="px-2 py-2 border-b bg-background shrink-0 text-left">
                                        {contentMode === 'rich_builder' ? (
                                            <TabsList className="grid w-full grid-cols-4 h-10 bg-background p-1 rounded-xl">
                                                <TabsTrigger value="blocks" className="text-[9px] font-semibold gap-1.5"><Layout className="h-3 w-3" /> Blocks</TabsTrigger>
                                                <TabsTrigger value="tags" className="text-[9px] font-semibold gap-1.5"><Database className="h-3 w-3" /> Tags</TabsTrigger>
                                                <TabsTrigger value="properties" className="text-[9px] font-semibold gap-1.5"><Settings2 className="h-3 w-3" /> Props</TabsTrigger>
                                                <TabsTrigger value="validation" className="text-[9px] font-semibold gap-1.5 relative">
                                                    <AlertTriangle className="h-3 w-3" /> Validation
                                                    {(errorCount > 0 || warningCount > 0) && (
                                                        <span className={cn(
                                                            "absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white shadow-sm",
                                                            errorCount > 0 ? "bg-red-500 animate-pulse" : "bg-amber-500"
                                                        )}>
                                                            {errorCount + warningCount}
                                                        </span>
                                                    )}
                                                </TabsTrigger>
                                            </TabsList>
                                        ) : (
                                            <TabsList className="grid w-full grid-cols-2 h-10 bg-background p-1 rounded-xl">
                                                <TabsTrigger value="tags" className="text-[9px] font-semibold gap-1.5"><Database className="h-3 w-3" /> Tags</TabsTrigger>
                                                <TabsTrigger value="validation" className="text-[9px] font-semibold gap-1.5 relative">
                                                    <AlertTriangle className="h-3 w-3" /> Validation
                                                    {(errorCount > 0 || warningCount > 0) && (
                                                        <span className={cn(
                                                            "absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white shadow-sm",
                                                            errorCount > 0 ? "bg-red-500 animate-pulse" : "bg-amber-500"
                                                        )}>
                                                            {errorCount + warningCount}
                                                        </span>
                                                    )}
                                                </TabsTrigger>
                                            </TabsList>
                                        )}
                                    </div>

                                    <div className="flex-1 min-h-0 relative overflow-hidden bg-muted/5">
                                        {contentMode === 'rich_builder' && sidebarTab === 'blocks' && (
                                            <div className="absolute inset-0 overflow-y-auto p-4 space-y-4">
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-left mb-2">Block Types</p>
                                                <div className="grid grid-cols-2 gap-2.5">
                                                    {(Object.keys(blockIcons) as Array<keyof typeof blockIcons>).map(type => {
                                                        const BIcon = blockIcons[type];
                                                        return (
                                                            <button
                                                                key={type}
                                                                type="button"
                                                                onClick={() => handleAddBlock(type as MessageBlock['type'])}
                                                                className="flex flex-col items-center justify-center p-3 rounded-xl border bg-card hover:bg-muted/10 hover:border-primary/20 transition-all text-center aspect-[1.1]"
                                                            >
                                                                <BIcon className="h-4.5 w-4.5 text-muted-foreground mb-1.5 shrink-0" />
                                                                <span className="text-[9px] font-semibold capitalize">{type}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {sidebarTab === 'tags' && (
                                            <div className="absolute inset-0 flex flex-col overflow-hidden">
                                                <ScrollArea className="flex-1">
                                                    <div className="p-4 space-y-6">
                                                        {/* 1. System Variables */}
                                                        <div>
                                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-left mb-3">System Variables</p>
                                                            <div className="space-y-3">
                                                                {[
                                                                    { category: 'Primary Contacts', variables: contactVarGroups.primary },
                                                                    { category: 'Signatory Contacts', variables: contactVarGroups.signatory },
                                                                    { category: 'Role-based Contacts', variables: contactVarGroups.roles },
                                                                    { category: 'Branding & Constants', variables: contactVarGroups.other }
                                                                ].filter(grp => grp.variables.length > 0).map(grp => (
                                                                    <div key={grp.category} className="space-y-1.5">
                                                                        <span className="text-[8px] font-bold text-primary uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded-md">{grp.category}</span>
                                                                        <div className="space-y-1">
                                                                            {grp.variables.map(v => (
                                                                                <button
                                                                                    key={v.key}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const token = `{{${v.key}}}`;
                                                                                        if (editorInsertRef.current) {
                                                                                            editorInsertRef.current(v.key);
                                                                                        } else {
                                                                                            navigator.clipboard.writeText(token);
                                                                                            toast({ title: 'Token copied to clipboard', description: token });
                                                                                        }
                                                                                    }}
                                                                                    className="w-full flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-muted/10 text-left transition-all group"
                                                                                >
                                                                                    <div className="min-w-0">
                                                                                        <p className="text-[10px] font-bold truncate">{v.label}</p>
                                                                                        <p className="text-[8px] text-muted-foreground font-mono truncate leading-none mt-0.5">{`{{${v.key}}}`}</p>
                                                                                    </div>
                                                                                    <PlusCircle className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* 2. Feature-Specific System Variables */}
                                                        {featureSpecificVars.length > 0 && (
                                                            <div>
                                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-left mb-3">Feature System Variables</p>
                                                                <div className="space-y-1">
                                                                    {featureSpecificVars.map(v => (
                                                                        <button
                                                                            key={v.key}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const token = `{{${v.key}}}`;
                                                                                if (editorInsertRef.current) {
                                                                                    editorInsertRef.current(v.key);
                                                                                } else {
                                                                                    navigator.clipboard.writeText(token);
                                                                                    toast({ title: 'Token copied to clipboard', description: token });
                                                                                }
                                                                            }}
                                                                            className="w-full flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-muted/10 text-left transition-all group"
                                                                        >
                                                                            <div className="min-w-0">
                                                                                <p className="text-[10px] font-bold truncate text-indigo-600">{v.label}</p>
                                                                                <p className="text-[8px] text-muted-foreground font-mono truncate leading-none mt-0.5">{`{{${v.key}}}`}</p>
                                                                            </div>
                                                                            <PlusCircle className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* 3. Collapsible Dynamic Survey Question Groups */}
                                                        {category === 'surveys' && surveyGroups.length > 0 && (
                                                            <div className="space-y-3">
                                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-left">Surveys Answers</p>
                                                                {surveyGroups.map(grp => {
                                                                    const isExpanded = !!expandedGroups[grp.id];
                                                                    return (
                                                                        <div key={grp.id} className="border rounded-xl p-2 bg-muted/5 space-y-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setExpandedGroups(prev => ({ ...prev, [grp.id]: !isExpanded }))}
                                                                                className="w-full flex items-center justify-between text-left text-xs font-bold text-indigo-600 px-1 py-0.5"
                                                                            >
                                                                                <span className="truncate max-w-[85%]">{grp.title}</span>
                                                                                <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200 shrink-0", isExpanded && "rotate-90")} />
                                                                            </button>
                                                                            <AnimatePresence initial={false}>
                                                                                {isExpanded && (
                                                                                    <motion.div
                                                                                        initial={{ height: 0, opacity: 0 }}
                                                                                        animate={{ height: "auto", opacity: 1 }}
                                                                                        exit={{ height: 0, opacity: 0 }}
                                                                                        transition={{ duration: 0.18 }}
                                                                                        className="overflow-hidden space-y-1"
                                                                                    >
                                                                                        {grp.variables.map(v => (
                                                                                            <button
                                                                                                key={v.key}
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    if (editorInsertRef.current) {
                                                                                                        editorInsertRef.current(v.key);
                                                                                                    } else {
                                                                                                        const token = `{{${v.key}}}`;
                                                                                                        navigator.clipboard.writeText(token);
                                                                                                        toast({ title: 'Token copied to clipboard', description: token });
                                                                                                    }
                                                                                                }}
                                                                                                className="w-full flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-muted/10 text-left transition-all group"
                                                                                            >
                                                                                                <div className="min-w-0">
                                                                                                    <p className="text-[10px] font-bold truncate text-indigo-600">{v.label}</p>
                                                                                                    <p className="text-[8px] text-muted-foreground font-mono truncate leading-none mt-0.5">{`{{${v.key}}}`}</p>
                                                                                                </div>
                                                                                                <PlusCircle className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                                            </button>
                                                                                        ))}
                                                                                    </motion.div>
                                                                                )}
                                                                            </AnimatePresence>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* 4. Collapsible Dynamic PDF Form Groups */}
                                                        {(category === 'forms' || category === 'agreements') && pdfGroups.length > 0 && (
                                                            <div className="space-y-3">
                                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-left">Forms Fields</p>
                                                                {pdfGroups.map(grp => {
                                                                    const isExpanded = !!expandedGroups[grp.id];
                                                                    return (
                                                                        <div key={grp.id} className="border rounded-xl p-2 bg-muted/5 space-y-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setExpandedGroups(prev => ({ ...prev, [grp.id]: !isExpanded }))}
                                                                                className="w-full flex items-center justify-between text-left text-xs font-bold text-indigo-600 px-1 py-0.5"
                                                                            >
                                                                                <span className="truncate max-w-[85%]">{grp.title}</span>
                                                                                <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200 shrink-0", isExpanded && "rotate-90")} />
                                                                            </button>
                                                                            <AnimatePresence initial={false}>
                                                                                {isExpanded && (
                                                                                    <motion.div
                                                                                        initial={{ height: 0, opacity: 0 }}
                                                                                        animate={{ height: "auto", opacity: 1 }}
                                                                                        exit={{ height: 0, opacity: 0 }}
                                                                                        transition={{ duration: 0.18 }}
                                                                                        className="overflow-hidden space-y-1"
                                                                                    >
                                                                                        {grp.variables.map(v => (
                                                                                            <button
                                                                                                key={v.key}
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    if (editorInsertRef.current) {
                                                                                                        editorInsertRef.current(v.key);
                                                                                                    } else {
                                                                                                        const token = `{{${v.key}}}`;
                                                                                                        navigator.clipboard.writeText(token);
                                                                                                        toast({ title: 'Token copied to clipboard', description: token });
                                                                                                    }
                                                                                                }}
                                                                                                className="w-full flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-muted/10 text-left transition-all group"
                                                                                            >
                                                                                                <div className="min-w-0">
                                                                                                    <p className="text-[10px] font-bold truncate text-indigo-600">{v.label}</p>
                                                                                                    <p className="text-[8px] text-muted-foreground font-mono truncate leading-none mt-0.5">{`{{${v.key}}}`}</p>
                                                                                                </div>
                                                                                                <PlusCircle className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                                            </button>
                                                                                        ))}
                                                                                    </motion.div>
                                                                                )}
                                                                            </AnimatePresence>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* 5. Workspace Custom Fields */}
                                                        {contactVarGroups.custom.length > 0 && (
                                                            <div>
                                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-left mb-3">Workspace Custom Fields</p>
                                                                <div className="space-y-1">
                                                                    {contactVarGroups.custom.map(v => (
                                                                        <button
                                                                            key={v.key}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const token = `{{${v.key}}}`;
                                                                                if (editorInsertRef.current) {
                                                                                    editorInsertRef.current(v.key);
                                                                                } else {
                                                                                    navigator.clipboard.writeText(token);
                                                                                    toast({ title: 'Token copied to clipboard', description: token });
                                                                                }
                                                                            }}
                                                                            className="w-full flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-muted/10 text-left transition-all group"
                                                                        >
                                                                            <div className="min-w-0">
                                                                                <p className="text-[10px] font-bold truncate text-emerald-600">{v.label}</p>
                                                                                <p className="text-[8px] text-muted-foreground font-mono truncate leading-none mt-0.5">{`{{${v.key}}}`}</p>
                                                                            </div>
                                                                            <PlusCircle className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}

                                        {sidebarTab === 'validation' && (
                                            <div className="absolute inset-0 flex flex-col overflow-hidden">
                                                <ScrollArea className="flex-1">
                                                    <div className="p-4 space-y-4">
                                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-left mb-2">
                                                            Validation Status
                                                        </p>
                                                        {validationErrors.length === 0 ? (
                                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                                <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                                                                    <Check className="h-5 w-5" />
                                                                </div>
                                                                <p className="text-xs font-bold text-foreground">All variables are valid</p>
                                                                <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
                                                                    No typos or context mismatches detected in your subject, preview text, or body content.
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4 text-left">
                                                                {errorCount > 0 && (
                                                                    <div className="space-y-2">
                                                                        <span className="text-[8px] font-bold text-red-600 uppercase tracking-widest bg-red-500/5 px-2 py-0.5 rounded-md">
                                                                            Errors ({errorCount})
                                                                        </span>
                                                                        <div className="space-y-1.5">
                                                                            {validationErrors.filter(e => e.type === 'error').map((err, i) => (
                                                                                <div key={i} className="p-3 rounded-xl border border-red-100 bg-red-50/30 text-left space-y-1">
                                                                                    <div className="flex items-center gap-1.5 text-red-700 font-bold text-[10px] font-mono">
                                                                                        <AlertCircle className="h-3.5 w-3.5" />
                                                                                        <span>{`{{${err.variable}}}`}</span>
                                                                                    </div>
                                                                                    <p className="text-[9px] text-red-600/90 leading-relaxed font-semibold">
                                                                                        {err.message}
                                                                                    </p>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {warningCount > 0 && (
                                                                    <div className="space-y-2 pt-2">
                                                                        <span className="text-[8px] font-bold text-amber-600 uppercase tracking-widest bg-amber-500/5 px-2 py-0.5 rounded-md">
                                                                            Warnings ({warningCount})
                                                                        </span>
                                                                        <div className="space-y-1.5">
                                                                            {validationErrors.filter(e => e.type === 'warning').map((err, i) => (
                                                                                <div key={i} className="p-3 rounded-xl border border-amber-100 bg-amber-50/30 text-left space-y-1">
                                                                                    <div className="flex items-center gap-1.5 text-amber-700 font-bold text-[10px] font-mono">
                                                                                        <AlertTriangle className="h-3.5 w-3.5" />
                                                                                        <span>{`{{${err.variable}}}`}</span>
                                                                                    </div>
                                                                                    <p className="text-[9px] text-amber-600/90 leading-relaxed font-semibold">
                                                                                        {err.message}
                                                                                    </p>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}

                                        {contentMode === 'rich_builder' && sidebarTab === 'properties' && (
                                            <div className="absolute inset-0 overflow-y-auto p-4">
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
                                        )}
                                    </div>
                                </Tabs>

                                <div className="absolute bottom-0 right-[-10px] top-0 w-2.5 cursor-col-resize z-50 hover:bg-primary/20 active:bg-primary/45 transition-colors" onMouseDown={handleMouseDown} />
                            </div>

                            <div 
                                className="flex-1 flex flex-col overflow-hidden relative transition-all duration-500"
                                style={{ backgroundColor: wrapperStyles?.outerBg || 'transparent' }}
                            >
                                <div className="h-14 shrink-0 bg-background border-b px-6 flex items-center justify-between z-10 shadow-sm text-left">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase">{channel}</Badge>
                                        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase">{contentMode}</Badge>
                                        
                                        {/* Undo/Redo controls */}
                                        <div className="flex items-center gap-1 border-l pl-3 ml-1 border-border/80">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg"
                                                onClick={handleUndo}
                                                disabled={historyPointer <= 0}
                                                title="Undo (Cmd+Z)"
                                            >
                                                <Undo className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg"
                                                onClick={handleRedo}
                                                disabled={historyPointer >= historyStack.length - 1}
                                                title="Redo (Cmd+Shift+Z)"
                                            >
                                                <Redo className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        {/* Style wrapper select */}
                                        {contentMode !== 'html_code' && (
                                            <div className="flex items-center gap-2 border-l pl-3 ml-1 border-border/80">
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase shrink-0">Style:</span>
                                                <Select value={styleId} onValueChange={setStyleId}>
                                                    <SelectTrigger className="h-8 w-[140px] rounded-lg text-[10px] bg-background border shadow-sm">
                                                        <SelectValue placeholder="No Wrapper" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="none" className="rounded-lg text-xs font-semibold text-muted-foreground">
                                                            None
                                                        </SelectItem>
                                                        {styles.map(style => (
                                                            <SelectItem key={style.id} value={style.id} className="rounded-lg text-xs">
                                                                <div className="flex items-center justify-between w-full gap-1">
                                                                    <span className="font-semibold truncate max-w-[80px]">{style.name}</span>
                                                                    {style.isDefault && (
                                                                        <Badge className="ml-1 bg-emerald-500/10 text-emerald-600 border-none text-[8px] font-bold h-4 px-1 rounded shrink-0">Def</Badge>
                                                                    )}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        {/* Simulation Context Selectors */}
                                        <div className="flex items-center gap-2 border-l pl-3 ml-1 border-border/80">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase shrink-0">Simulate:</span>
                                            <Select value={simEntity} onValueChange={(val) => { setSimEntity(val); setSimRecordId('none'); }}>
                                                <SelectTrigger className="h-8 w-[100px] rounded-lg text-[10px] bg-background border shadow-sm">
                                                    <SelectValue placeholder="Context..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="none" className="rounded-lg text-xs">None</SelectItem>
                                                    <SelectItem value="School" className="rounded-lg text-xs">{entityTerminology || 'Client'}</SelectItem>
                                                    <SelectItem value="Meeting" className="rounded-lg text-xs">Meeting</SelectItem>
                                                    <SelectItem value="Survey" className="rounded-lg text-xs">Survey</SelectItem>
                                                    <SelectItem value="Submission" className="rounded-lg text-xs">Form</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            {simEntity !== 'none' && (
                                                <Select value={simRecordId} onValueChange={setSimRecordId}>
                                                    <SelectTrigger className="h-8 w-[130px] rounded-lg text-[10px] bg-background border shadow-sm animate-in slide-in-from-left-2 duration-200">
                                                        <SelectValue placeholder="Record..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="none" className="rounded-lg text-xs">Select...</SelectItem>
                                                        {simEntity === 'School' && entities?.map(e => (
                                                            <SelectItem key={e.id} value={e.id} className="rounded-lg text-xs">{e.displayName || e.entityName}</SelectItem>
                                                        ))}
                                                        {simEntity === 'Meeting' && meetings?.map(m => (
                                                            <SelectItem key={m.id} value={m.id} className="rounded-lg text-xs">{m.heroTitle || m.meetingSlug}</SelectItem>
                                                        ))}
                                                        {simEntity === 'Survey' && surveys?.map(s => (
                                                            <SelectItem key={s.id} value={s.id} className="rounded-lg text-xs">{s.title || s.internalName}</SelectItem>
                                                        ))}
                                                        {simEntity === 'Submission' && pdfs?.map(p => (
                                                            <SelectItem key={p.id} value={p.id} className="rounded-lg text-xs">{p.name || p.publicTitle}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => setIsFullScreen(!isFullScreen)} className="h-9 w-9 rounded-lg">
                                            {isFullScreen ? <Minimize2 className="h-4.5 w-4.5" /> : <Maximize2 className="h-4.5 w-4.5" />}
                                        </Button>
                                        <Button onClick={() => setStep(3)} className="h-9 rounded-xl font-bold gap-2 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95 transition-all">
                                            Next: Simulation <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <ScrollArea className="flex-1" onClick={() => setSelectedBlockId(null)}>
                                    <div className="max-w-4xl mx-auto p-8 pb-64">
                                        {/* contentMode-aware editor routing */}
                                        {channel === 'sms' || contentMode === 'plain_text' ? (
                                            <PlainTextEditor 
                                                value={body} 
                                                onChange={setBody} 
                                                variables={availableVarsForEditor} 
                                                channel={channel as 'email' | 'sms'} 
                                                registerInsertCallback={(cb) => { editorInsertRef.current = cb; }}
                                                contextLabels={contextLabels}
                                            />
                                        ) : contentMode === 'html_code' ? (
                                            <HtmlCodeEditor 
                                                value={body} 
                                                onChange={setBody} 
                                                variables={availableVarsForEditor} 
                                                registerInsertCallback={(cb) => { editorInsertRef.current = cb; }}
                                                contextLabels={contextLabels}
                                            />
                                        ) : editorMode === 'designer' ? (
                                            <div 
                                                className="max-w-[600px] mx-auto shadow-2xl overflow-hidden text-left transition-all duration-300"
                                                style={{ 
                                                    backgroundColor: wrapperStyles?.cardBg || 'var(--card)',
                                                    borderRadius: wrapperStyles?.borderRadius || '2.5rem',
                                                    border: wrapperStyles?.border || '1px solid var(--border)'
                                                }}
                                            >
                                                {resolvedHeader && (
                                                    <div 
                                                        className="px-12 pt-12 pb-6 border-b border-dashed border-border/50" 
                                                        dangerouslySetInnerHTML={{ __html: resolvedHeader }} 
                                                    />
                                                )}
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
                                                                        simulationVars={activeSimVariables}
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
                                                {resolvedFooter && (
                                                    <div 
                                                        className="px-12 pb-12 pt-6 border-t border-dashed border-border/50" 
                                                        dangerouslySetInnerHTML={{ __html: resolvedFooter }} 
                                                    />
                                                )}
                                            </div>
                                        ) : null}
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
                            resolvedPreview={(tmpl, vars, isDark) => {
                                const activeStyle = styleId !== 'none' ? styles.find(s => s.id === styleId) : null;
                                const effectiveMode = channel === 'sms' ? 'plain_text' : contentMode;
                                if (effectiveMode === 'rich_builder') {
                                    return renderBlocksToHtml(blocks, vars, { wrapper: activeStyle?.htmlWrapper, isDark });
                                }
                                let resolved = resolveVariables(body, vars);
                                if (effectiveMode === 'html_code' && activeStyle?.htmlWrapper?.includes('{{content}}')) {
                                    resolved = resolveVariables(activeStyle.htmlWrapper, vars).replace('{{content}}', resolved);
                                } else if (effectiveMode === 'plain_text' && channel === 'email') {
                                    resolved = plainTextToHtml(resolved, isDark);
                                }
                                return resolved;
                            }}
                            onNextStep={() => setStep(4)}
                        />
                    )}

                    {step === 4 && (
                        <motion.div key="step4" {...stepTransition} className="absolute inset-0 overflow-y-auto">
                            <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-8 text-left pb-20">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                    {/* Left Column */}
                                    <div className="space-y-6">
                                        {/* Template Identity Card */}
                                        <Card className="rounded-2xl border border-border shadow-sm bg-card">
                                            <CardHeader>
                                                <CardTitle className="text-base font-semibold">Template Identity</CardTitle>
                                                <CardDescription className="text-xs">Configure names, keys, and identifiers.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-5">
                                                {/* Template Name */}
                                                <div className="space-y-2 text-left">
                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Template Name *</Label>
                                                    <Input
                                                        value={name}
                                                        onChange={e => setName(e.target.value)}
                                                        placeholder="e.g. Confirmation For School B"
                                                        className="h-11 rounded-xl bg-background border border-border shadow-sm focus:ring-1 focus:ring-primary/20 transition-all font-semibold"
                                                    />
                                                </div>

                                                {/* Template Key Slug */}
                                                <div className="space-y-2 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Template Key / Slug</Label>
                                                        {isTemplateTypeDirty && !initialContext?.templateType && (
                                                            <Button type="button" variant="ghost" size="sm" onClick={() => setIsTemplateTypeDirty(false)} className="h-5 text-[10px] font-bold text-blue-600 hover:text-blue-700 px-2 rounded-lg">Reset</Button>
                                                        )}
                                                    </div>
                                                    <div className={cn("flex h-11 border border-border/50 rounded-xl overflow-hidden bg-background/50", CORE_SYSTEM_KEYS.includes(templateType) ? "border-amber-500/50" : "")}>
                                                        <div className="bg-muted px-3 flex items-center text-[10px] font-semibold text-muted-foreground/60 border-r">key</div>
                                                        <Input
                                                            value={templateType}
                                                            onChange={e => {
                                                                setTemplateType(e.target.value);
                                                                setIsTemplateTypeDirty(true);
                                                            }}
                                                            placeholder="e.g. invitation, reminder_1"
                                                            className="border-none rounded-none shadow-none focus-visible:ring-0 bg-transparent font-mono font-semibold"
                                                            disabled={!!initialContext?.templateType}
                                                        />
                                                    </div>
                                                    {CORE_SYSTEM_KEYS.includes(templateType) && (
                                                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                                            ⚠️ This key matches a core blueprint. Saving will override the default behavior.
                                                        </p>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Workspace Visibility Card */}
                                        <Card className="rounded-2xl border border-border shadow-sm bg-card">
                                            <CardHeader>
                                                <CardTitle className="text-base font-semibold">Workspace Visibility</CardTitle>
                                                <CardDescription className="text-xs">Select hubs with access permission to dispatch this template.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4 text-left">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Shared Hubs</Label>
                                                    <div className="p-1 rounded-xl border border-border bg-background shadow-sm hover:border-primary/20 transition-all">
                                                        <MultiSelect
                                                            options={workspaceOptions}
                                                            value={workspaceIds}
                                                            onChange={setWorkspaceIds}
                                                            placeholder="Select hubs..."
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground ml-1 mt-1">Shared templates are available for logic and manual dispatch across selected hubs.</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Right Column */}
                                    <div className="space-y-6">
                                        {/* Published / Draft Status Card */}
                                        <Card className="rounded-2xl border border-border shadow-sm bg-card">
                                            <CardHeader>
                                                <CardTitle className="text-base font-semibold">Publishing Status</CardTitle>
                                                <CardDescription className="text-xs">Control the lifecycle stage of this messaging template.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4 text-left">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Lifecycle Status</Label>
                                                    <Select value={status} onValueChange={(v: TemplateStatus) => setStatus(v)}>
                                                        <SelectTrigger className="h-11 rounded-xl bg-background border border-border shadow-sm font-semibold">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            <SelectItem value="draft" className="rounded-lg">
                                                                <div className="flex flex-col text-left py-0.5">
                                                                    <span className="text-xs font-bold leading-none text-amber-600">Draft</span>
                                                                    <span className="text-[9px] text-muted-foreground mt-0.5">Work-in-progress, hidden from workflow choices</span>
                                                                </div>
                                                            </SelectItem>
                                                            <SelectItem value="active" className="rounded-lg">
                                                                <div className="flex flex-col text-left py-0.5">
                                                                    <span className="text-xs font-bold leading-none text-emerald-600">Active / Published</span>
                                                                    <span className="text-[9px] text-muted-foreground mt-0.5">Available for production logic and manual sends</span>
                                                                </div>
                                                            </SelectItem>
                                                            <SelectItem value="archived" className="rounded-lg">
                                                                <div className="flex flex-col text-left py-0.5">
                                                                    <span className="text-xs font-bold leading-none text-rose-600">Archived</span>
                                                                    <span className="text-[9px] text-muted-foreground mt-0.5">Read-only history, disabled from active dispatching</span>
                                                                </div>
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Summary & Save Trigger Card */}
                                        <Card className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.02] shadow-sm overflow-hidden">
                                            <CardContent className="p-6 space-y-6">
                                                <div className="flex items-start gap-4">
                                                    <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl shrink-0 mt-1">
                                                        <Zap className="h-6 w-6" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <h4 className="font-bold text-sm text-foreground">Ready to Deploy Template?</h4>
                                                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                            Please verify the template name, keywords, and workspace sharing setup. Your template will deploy immediately according to your chosen lifecycle status.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="p-4 rounded-xl bg-background border space-y-2.5 text-xs font-semibold">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Delivery Channel:</span>
                                                        <span className="capitalize">{channel}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Editor Mode:</span>
                                                        <span className="uppercase text-[10px]">{contentMode?.replace('_', ' ')}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Shared Hubs:</span>
                                                        <span>{workspaceIds.length} hubs</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Target Audience:</span>
                                                        <span>{target === 'internal_team' ? 'Staff / Team' : 'Clients'}</span>
                                                    </div>
                                                </div>

                                                <Button
                                                    onClick={handleCommit}
                                                    disabled={isSaving || !name}
                                                    className="w-full h-12 rounded-2xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 active:scale-95 transition-all text-xs"
                                                >
                                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                    {status === 'active' ? 'Publish & Save Template' : 'Save Template Draft'}
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center pt-6 border-t border-border mt-8">
                                    <Button
                                        variant="outline"
                                        type="button"
                                        onClick={() => setStep(3)}
                                        className="rounded-xl font-bold border-border bg-background hover:bg-muted/10 h-11 px-6 gap-2 text-xs transition-all active:scale-95"
                                    >
                                        <ArrowLeft className="h-4 w-4" /> Back to Simulation
                                    </Button>
                                    <Button
                                        onClick={handleCommit}
                                        disabled={isSaving || !name}
                                        className="rounded-xl font-semibold px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-lg h-11 text-xs transition-all active:scale-95 gap-2"
                                    >
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        {status === 'active' ? 'Publish & Save Template' : 'Save Template Draft'}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
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

            {/* Validation Errors Saving Warning Dialog */}
            <AlertDialog open={showValidationErrorDialog} onOpenChange={setShowValidationErrorDialog}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertCircle className="h-5 w-5 animate-bounce" />
                            Unresolved Variable Errors
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3 text-left">
                            <p>
                                This template contains <strong>{errorCount} variable error(s)</strong> (typos or unrecognized tags) that will fail to resolve during messaging dispatch:
                            </p>
                            <div className="p-3 bg-muted rounded-xl max-h-[150px] overflow-y-auto font-mono text-[10px] space-y-1 border">
                                {validationErrors.filter(e => e.type === 'error').map((err, i) => (
                                    <div key={i} className="text-red-600 font-semibold">
                                        • {`{{${err.variable}}}`}: Unrecognized variable name
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Sending messages with invalid tags will display raw tokens to your users. Are you sure you want to save anyway?
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl font-semibold">Cancel and Fix</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { setShowValidationErrorDialog(false); executeCommit(); }} className="rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white">Save Anyway</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
