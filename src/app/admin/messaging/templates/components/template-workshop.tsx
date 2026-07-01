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
    MousePointer2,
    List,
    Mail as MailIcon,
    Zap,
    Megaphone,
    Bell,
    Undo,
    Redo,
    ArrowUp,
    ArrowDown,
    Copy,
    Trash2,
    Search,
    GripVertical,
    Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCollection, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { createFieldAction, createFieldGroupAction } from '@/lib/fields-actions';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { EntityCombobox } from '@/components/entities/EntityCombobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, rectIntersection, pointerWithin } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Skeleton } from '@/components/ui/skeleton';
import type { MessageTemplate, MessageBlock, VariableDefinition, MessageStyle, WorkspaceEntity, Meeting, Survey, PDFForm, ContentMode, TemplateTarget, TemplateStatus, FieldGroup, AppField, RecipientType, TemplateVariable } from '@/lib/types';
import { renderBlocksToHtml, resolveVariables, plainTextToHtml } from '@/lib/messaging-utils';
import { SortableBlockItem } from './visual-block';
import { blockIcons } from './block-icons';
import { BlockInspector } from './block-inspector';
import { PlainTextEditor } from './PlainTextEditor';
import { SimulationStudio } from './simulation-studio';
import { useToast } from '@/hooks/use-toast';
import { SlashInput } from '@/components/messaging/SlashInput';
import TestDispatchDialog from '../../components/TestDispatchDialog';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTerminology } from '@/hooks/use-terminology';
import { MultiSelect } from '@/components/ui/multi-select';
import { groupContactVariableDefinitions, generateContactVariableDefinitions, generateEntityFieldVariables } from '@/lib/contact-variable-definitions';
import { getAllSystemVariables } from '@/lib/system-variable-definitions';
import { validateTemplateVariables } from '@/lib/template-validator';
import { Users, UserCheck, ShieldCheck as ShieldCheckIcon, AlertTriangle, AlertCircle } from 'lucide-react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

async function uploadArchitectImage(file: File, workspaceId: string): Promise<string> {
    if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
    }
    if (file.size > 4 * 1024 * 1024) {
        throw new Error('Image size must be less than 4MB');
    }
    const storage = getStorage();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `media/workspaces/${workspaceId}/templates/architect/${Date.now()}-${sanitizedName}`;
    const fileRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(fileRef, file);
    return getDownloadURL(snapshot.ref);
}

interface SortableLayerItemProps {
    id: string;
    block: MessageBlock;
    isSelected: boolean;
    isNested: boolean;
    onSelect: () => void;
    onSwap: (dir: 'up' | 'down') => void;
    onDuplicate: () => void;
    onRemove: () => void;
    blockIcons: Record<string, React.ComponentType<{ className?: string }>>;
    renderItem: (block: MessageBlock, isNested: boolean) => React.ReactNode;
}

function SortableLayerItem({
    id,
    block,
    isSelected,
    isNested,
    onSelect,
    onSwap,
    onDuplicate,
    onRemove,
    blockIcons,
    renderItem
}: SortableLayerItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const BIcon = blockIcons[block.type] || Layout;

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className="space-y-1"
        >
            <div 
                className={cn(
                    "flex items-center justify-between p-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all",
                    isSelected ? "bg-blue-500/10 border-blue-500 text-blue-600 font-bold" : "bg-card hover:bg-muted/10 border-border text-foreground",
                    isNested && "ml-4"
                )}
                onClick={onSelect}
            >
                <div className="flex items-center gap-1.5 truncate max-w-[55%]">
                    <div 
                        {...attributes} 
                        {...listeners} 
                        className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground p-0.5 rounded hover:bg-muted transition-colors shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical className="h-3 w-3" />
                    </div>
                    <BIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate capitalize">{block.type}</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 rounded-md hover:bg-muted text-muted-foreground"
                        onClick={(e) => {
                            e.stopPropagation();
                            onSwap('up');
                        }}
                    >
                        <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 rounded-md hover:bg-muted text-muted-foreground"
                        onClick={(e) => {
                            e.stopPropagation();
                            onSwap('down');
                        }}
                    >
                        <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 rounded-md hover:bg-muted text-muted-foreground"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDuplicate();
                        }}
                    >
                        <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 rounded-md hover:bg-muted text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </div>
            </div>
            {block.type === 'columns' && block.columns && (
                <div className="pl-2 border-l border-dashed border-border/60 ml-3 space-y-2 py-1 animate-in fade-in duration-200">
                    {block.columns.map((col, idx) => (
                        <div key={idx} className="space-y-1.5">
                            <div className="text-[8px] font-bold text-muted-foreground/45 uppercase tracking-widest pl-4">Column {idx + 1}</div>
                            <SortableContext 
                                items={col.blocks.map(b => b.id)} 
                                strategy={verticalListSortingStrategy}
                            >
                                {col.blocks.map(b => renderItem(b, true))}
                            </SortableContext>
                            {col.blocks.length === 0 && (
                                <div className="text-[8px] font-semibold text-muted-foreground/30 italic pl-4 py-0.5">Empty dropzone</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

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

const blockTypeTemplates: Record<string, Array<{
    name: string;
    description: string;
    aspectRatio?: string;
    create: () => MessageBlock;
}>> = {
    heading: [
        {
            name: 'Left Accent Card',
            description: 'Left-accented meeting card with date/time details at the bottom',
            aspectRatio: 'aspect-[1/1]',
            create: () => ({
                id: `blk_heading_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'heading',
                variant: 'h1',
                title: 'Design Team Sync',
                content: 'Join us for our weekly alignment. We\'ll be reviewing the latest component updates, discussing the upcoming Q3 roadmap, and tackling any immediate blockers.',
                pillText: 'MEETING',
                rsvpDate: 'Thursday, Oct 26',
                rsvpTime: '10:00 AM - 11:30 AM (PST)',
                url: 'clock',
                style: {
                    variant: 'left_accent',
                    textAlign: 'left',
                    color: '#0f172a',
                    backgroundColor: '#f8fafc',
                    borderRadius: '16px',
                    borderWidth: '1px',
                    borderColor: '#f1f5f9',
                    borderStyle: 'solid',
                    paddingTop: '20px',
                    paddingBottom: '20px',
                    paddingLeft: '20px',
                    paddingRight: '20px',
                    marginTop: '10px',
                    marginBottom: '10px'
                }
            })
        },
        {
            name: 'Dark Slate Card',
            description: 'Centered dark slate header card with clean white/grey typography',
            aspectRatio: 'aspect-[3/4]',
            create: () => ({
                id: `blk_heading_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'heading',
                variant: 'h1',
                title: 'Annual Strategy Summit',
                content: 'Join executive leadership for an exclusive three-day retreat focusing on innovation, global expansion, and future frameworks.',
                pillText: 'OCTOBER 15-17, 2024',
                style: {
                    variant: 'dark_slate',
                    textAlign: 'center',
                    color: '#ffffff',
                    backgroundColor: '#344154',
                    borderRadius: '16px',
                    paddingTop: '24px',
                    paddingBottom: '24px',
                    paddingLeft: '20px',
                    paddingRight: '20px',
                    marginTop: '10px',
                    marginBottom: '10px'
                }
            })
        },
        {
            name: 'Envelope Badge Header',
            description: 'Centered card layout featuring an envelope-icon invitation badge',
            aspectRatio: 'aspect-[1/1]',
            create: () => ({
                id: `blk_heading_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'heading',
                variant: 'h1',
                title: 'Digital Horizon Summit',
                content: 'Join us for an exclusive gathering of industry leaders exploring the intersection of design, technology, and modern correspondence.',
                pillText: 'INVITATION',
                url: 'envelope',
                style: {
                    variant: 'envelope_badge',
                    textAlign: 'center',
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    borderWidth: '1px',
                    borderColor: '#e2e8f0',
                    borderStyle: 'solid',
                    paddingTop: '24px',
                    paddingBottom: '24px',
                    paddingLeft: '20px',
                    paddingRight: '20px',
                    marginTop: '10px',
                    marginBottom: '10px'
                }
            })
        },
        {
            name: 'Nested Card Content',
            description: 'Light blue gradient card where the description is nested inside a grey sub-card',
            aspectRatio: 'aspect-[4/3]',
            create: () => ({
                id: `blk_heading_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'heading',
                variant: 'h1',
                title: 'Design Team Sync',
                content: 'Join us for our weekly alignment. We\'ll be reviewing the latest component updates, discussing the upcoming Q3 roadmap, and tackling any immediate blockers.',
                pillText: 'MEETING',
                style: {
                    variant: 'nested_card',
                    textAlign: 'left',
                    color: '#0f172a',
                    backgroundColor: '#f0f7ff',
                    backgroundImage: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    borderRadius: '16px',
                    paddingTop: '20px',
                    paddingBottom: '20px',
                    paddingLeft: '20px',
                    paddingRight: '20px',
                    marginTop: '10px',
                    marginBottom: '10px'
                }
            })
        },
        {
            name: 'Wide Banner Header',
            description: 'Minimalist wide layout featuring badge and centered header title',
            aspectRatio: 'aspect-[21/9]',
            create: () => ({
                id: `blk_heading_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'heading',
                variant: 'h1',
                title: 'Design Team Sync',
                pillText: 'MEETING',
                style: {
                    variant: 'simple_wide',
                    textAlign: 'center',
                    color: '#0f172a',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    paddingTop: '16px',
                    paddingBottom: '16px',
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    marginTop: '10px',
                    marginBottom: '10px'
                }
            })
        },
        {
            name: 'Hero Title Banner',
            description: 'Large, bold, centered title for headers',
            aspectRatio: 'aspect-[21/9]',
            create: () => ({
                id: `blk_heading_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'heading',
                variant: 'h1',
                title: 'Welcome to SmartSapp!',
                style: {
                    textAlign: 'center',
                    color: '#1e293b',
                    fontSize: '28px',
                    fontWeight: '900',
                    paddingTop: '20px',
                    paddingBottom: '8px',
                    marginTop: '0px',
                    marginBottom: '12px'
                }
            })
        },
        {
            name: 'Section Title',
            description: 'Clean left-aligned title for sections',
            aspectRatio: 'aspect-[16/5]',
            create: () => ({
                id: `blk_heading_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'heading',
                variant: 'h2',
                title: 'Key Project Updates',
                style: {
                    textAlign: 'left',
                    color: '#0f172a',
                    fontSize: '20px',
                    fontWeight: '700',
                    paddingTop: '16px',
                    paddingBottom: '8px',
                    marginTop: '16px',
                    marginBottom: '8px'
                }
            })
        },
        {
            name: 'Sub-section Title',
            description: 'Subtle left-aligned header',
            aspectRatio: 'aspect-[16/4]',
            create: () => ({
                id: `blk_heading_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'heading',
                variant: 'h3',
                title: 'Onboarding Instructions',
                style: {
                    textAlign: 'left',
                    color: '#475569',
                    fontSize: '16px',
                    fontWeight: '600',
                    paddingTop: '12px',
                    paddingBottom: '4px',
                    marginTop: '8px',
                    marginBottom: '4px'
                }
            })
        },
        {
            name: 'Accent Brand Heading',
            description: 'Branded blue header',
            aspectRatio: 'aspect-[16/5]',
            create: () => ({
                id: `blk_heading_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'heading',
                variant: 'h2',
                title: 'Exclusive Offer For You',
                style: {
                    textAlign: 'center',
                    color: '#2563eb',
                    fontSize: '22px',
                    fontWeight: '800',
                    paddingTop: '16px',
                    paddingBottom: '8px',
                    marginTop: '10px',
                    marginBottom: '10px'
                }
            })
        }
    ],
    text: [
        {
            name: 'Standard Paragraph',
            description: 'Standard reading text layout',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_text_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'text',
                content: 'This is a clean, readable text body block. Keep your paragraphs around 2-3 sentences to optimize for email scanning on mobile devices.',
                style: {
                    textAlign: 'left',
                    color: '#334155',
                    fontSize: '15px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    lineHeight: '1.6'
                }
            })
        },
        {
            name: 'Prominent Intro',
            description: 'Centered, slightly larger lead text',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_text_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'text',
                content: 'We are thrilled to welcome you to our growing community. Let’s walk through the details of your active dashboard configuration below.',
                style: {
                    textAlign: 'center',
                    color: '#1e293b',
                    fontSize: '17px',
                    fontWeight: '500',
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    lineHeight: '1.6'
                }
            })
        },
        {
            name: 'Fine Print / Unsubscribe',
            description: 'Muted footnote style for disclaimers',
            aspectRatio: 'aspect-[16/6]',
            create: () => ({
                id: `blk_text_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'text',
                content: '© 2026 SmartSapp Inc. All rights reserved. You received this email because you subscribed to our service. To manage your preferences or unsubscribe, click the link below.',
                style: {
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '11px',
                    paddingTop: '16px',
                    paddingBottom: '16px',
                    lineHeight: '1.5'
                }
            })
        },
        {
            name: 'Highlighted Callout',
            description: 'Text highlighted inside a custom box card',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_text_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'text',
                content: 'Pro-Tip: You can change the background color, padding, and corner radius of this callout block directly inside the Properties inspector on the right!',
                style: {
                    textAlign: 'left',
                    color: '#1e3a8a',
                    backgroundColor: '#eff6ff',
                    borderRadius: '12px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#bfdbfe',
                    paddingTop: '14px',
                    paddingBottom: '14px',
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    fontSize: '14px',
                    lineHeight: '1.5'
                }
            })
        }
    ],
    list: [
        {
            name: 'Circular Bullets',
            description: 'Standard bulleted list',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_list_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'list',
                listStyle: 'unordered',
                items: [
                    'Review your dashboard settings',
                    'Complete details for workspace profile',
                    'Invite team members to collaborate'
                ],
                style: {
                    color: '#334155',
                    fontSize: '15px',
                    paddingTop: '8px',
                    paddingBottom: '8px'
                }
            })
        },
        {
            name: 'Numbered Steps',
            description: 'Step-by-step ordered list',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_list_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'list',
                listStyle: 'ordered',
                items: [
                    'Step 1: Link your active profile credentials',
                    'Step 2: Define your core terminology preference',
                    'Step 3: Save and publish your workspace templates'
                ],
                style: {
                    color: '#334155',
                    fontSize: '15px',
                    paddingTop: '8px',
                    paddingBottom: '8px'
                }
            })
        },
        {
            name: 'Roman Numerals',
            description: 'List with uppercase roman numerals',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_list_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'list',
                listStyle: 'roman',
                items: [
                    'Section I: Pre-onboarding checklist verification',
                    'Section II: Active template testing & validation',
                    'Section III: Final production deployment steps'
                ],
                style: {
                    color: '#334155',
                    fontSize: '15px',
                    paddingTop: '8px',
                    paddingBottom: '8px'
                }
            })
        },
        {
            name: 'Checklist Task Panel',
            description: 'Task items with green checkmarks',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_list_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'list',
                listStyle: 'checkmark',
                items: [
                    'Account setup fully verified',
                    'Template files synchronized',
                    'Dnd-kit workspace integrated'
                ],
                style: {
                    color: '#0f172a',
                    fontSize: '14px',
                    paddingTop: '10px',
                    paddingBottom: '10px'
                }
            })
        },
        {
            name: 'Arrow Bullet Points',
            description: 'Items bulleted with blue indicators',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_list_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'list',
                listStyle: 'arrow',
                items: [
                    'Maximize efficiency with agent templates',
                    'Save hours of development build resources',
                    'Streamline admin workspace operations'
                ],
                style: {
                    color: '#334155',
                    fontSize: '14px',
                    paddingTop: '8px',
                    paddingBottom: '8px'
                }
            })
        }
    ],
    image: [
        {
            name: 'Full Hero Card Image',
            description: 'Rounded image with card frame shadow',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_image_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'image',
                url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
                style: {
                    borderRadius: '16px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#e2e8f0',
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    marginTop: '8px',
                    marginBottom: '8px'
                }
            })
        },
        {
            name: 'Avatar Portrait Circle',
            description: 'Centered circular profile frame',
            aspectRatio: 'aspect-[1/1]',
            create: () => ({
                id: `blk_image_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'image',
                url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
                style: {
                    borderRadius: '9999px',
                    borderWidth: '3px',
                    borderStyle: 'solid',
                    borderColor: '#2563eb',
                    textAlign: 'center',
                    paddingTop: '12px',
                    paddingBottom: '12px'
                }
            })
        },
        {
            name: 'Polaroid Style Card',
            description: 'Image with bottom white margin frame',
            aspectRatio: 'aspect-[3/4]',
            create: () => ({
                id: `blk_image_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'image',
                url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
                style: {
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#e2e8f0',
                    paddingTop: '12px',
                    paddingBottom: '32px',
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    marginTop: '12px',
                    marginBottom: '12px'
                }
            })
        }
    ],
    video: [
        {
            name: 'Cinema Wide Player',
            description: '16:9 mockup player layout',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_video_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'video',
                url: '',
                style: {
                    borderRadius: '12px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    marginTop: '12px',
                    marginBottom: '12px'
                }
            })
        }
    ],
    button: [
        {
            name: 'CTA Pill Button',
            description: 'Rounded primary button style',
            aspectRatio: 'aspect-[21/9]',
            create: () => ({
                id: `blk_button_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'button',
                title: 'Get Started Today',
                url: 'https://',
                style: {
                    textAlign: 'center',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '9999px',
                    paddingTop: '14px',
                    paddingBottom: '14px',
                    paddingLeft: '32px',
                    paddingRight: '32px',
                    fontWeight: '700',
                    fontSize: '16px'
                }
            })
        },
        {
            name: 'Modern Outline Button',
            description: 'Transparent style with clean border',
            aspectRatio: 'aspect-[21/9]',
            create: () => ({
                id: `blk_button_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'button',
                title: 'Learn More Details',
                url: 'https://',
                style: {
                    textAlign: 'center',
                    backgroundColor: 'transparent',
                    color: '#2563eb',
                    borderRadius: '12px',
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: '#2563eb',
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    fontWeight: '600',
                    fontSize: '15px'
                }
            })
        },
        {
            name: 'Soft Secondary Action',
            description: 'Minimalistic gray background button',
            aspectRatio: 'aspect-[21/9]',
            create: () => ({
                id: `blk_button_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'button',
                title: 'View Dashboard',
                url: 'https://',
                style: {
                    textAlign: 'center',
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    borderRadius: '12px',
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    fontWeight: '600',
                    fontSize: '15px'
                }
            })
        },
        {
            name: 'Destructive / Warning Button',
            description: 'Red solid warning button style',
            aspectRatio: 'aspect-[21/9]',
            create: () => ({
                id: `blk_button_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'button',
                title: 'Decline Agreement',
                url: 'https://',
                style: {
                    textAlign: 'center',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    borderRadius: '12px',
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    fontWeight: '600',
                    fontSize: '15px'
                }
            })
        }
    ],
    quote: [
        {
            name: 'Editorial Callout Quote',
            description: 'Quote with thick colored left border',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_quote_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'quote',
                content: 'Onboarding is not just a process. It is a critical milestone for employee validation and system synchronization.',
                style: {
                    textAlign: 'left',
                    color: '#475569',
                    borderColor: '#2563eb',
                    borderWidth: '4px',
                    borderStyle: 'solid',
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    paddingLeft: '16px',
                    paddingRight: '12px',
                    fontSize: '15px',
                    lineHeight: '1.6'
                }
            })
        },
        {
            name: 'Centered Testimonial',
            description: 'Minimal italic statement block',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_quote_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'quote',
                content: '“SmartSapp transformed how we handle our internal communications and automation agreements.”',
                style: {
                    textAlign: 'center',
                    color: '#1e293b',
                    fontSize: '18px',
                    fontWeight: '500',
                    paddingTop: '16px',
                    paddingBottom: '16px',
                    lineHeight: '1.6'
                }
            })
        },
        {
            name: 'Warm Highlight Bubble',
            description: 'Warm background styled card bubble',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_quote_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'quote',
                content: 'Important Reminder: Make sure to verify your connection security keys before triggering automated pipeline rules.',
                style: {
                    textAlign: 'left',
                    color: '#78350f',
                    backgroundColor: '#fffbeb',
                    borderRadius: '16px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#fde68a',
                    paddingTop: '16px',
                    paddingBottom: '16px',
                    paddingLeft: '20px',
                    paddingRight: '20px',
                    fontSize: '14px',
                    lineHeight: '1.5'
                }
            })
        }
    ],
    divider: [
        {
            name: 'Subtle Spacer Line',
            description: 'Thin slate-200 border line',
            aspectRatio: 'aspect-[16/3]',
            create: () => ({
                id: `blk_divider_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'divider',
                style: {
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#e2e8f0',
                    marginTop: '16px',
                    marginBottom: '16px'
                }
            })
        },
        {
            name: 'Thick Accent Line',
            description: 'Thicker blue border line',
            aspectRatio: 'aspect-[16/3]',
            create: () => ({
                id: `blk_divider_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'divider',
                style: {
                    borderWidth: '3px',
                    borderStyle: 'solid',
                    borderColor: '#2563eb',
                    marginTop: '20px',
                    marginBottom: '20px'
                }
            })
        },
        {
            name: 'Dashed Gap Separator',
            description: 'Modern dashed border line separator',
            aspectRatio: 'aspect-[16/3]',
            create: () => ({
                id: `blk_divider_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'divider',
                style: {
                    borderWidth: '2px',
                    borderStyle: 'dashed',
                    borderColor: '#cbd5e1',
                    marginTop: '24px',
                    marginBottom: '24px'
                }
            })
        },
        {
            name: 'Invisible Spacer (30px)',
            description: 'Spacing buffer gap for vertical layouts',
            aspectRatio: 'aspect-[16/3]',
            create: () => ({
                id: `blk_divider_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'divider',
                style: {
                    borderWidth: '0px',
                    borderStyle: 'none',
                    marginTop: '15px',
                    marginBottom: '15px'
                }
            })
        }
    ],
    logo: [
        {
            name: 'Centered Branding Logo',
            description: 'Centered organizational logo',
            aspectRatio: 'aspect-[21/9]',
            create: () => ({
                id: `blk_logo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'logo',
                url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&h=120&q=80',
                style: {
                    textAlign: 'center',
                    paddingTop: '16px',
                    paddingBottom: '16px'
                }
            })
        },
        {
            name: 'Left Aligned Mini Logo',
            description: 'Compact left-aligned logo',
            aspectRatio: 'aspect-[21/9]',
            create: () => ({
                id: `blk_logo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'logo',
                url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&h=120&q=80',
                style: {
                    textAlign: 'left',
                    paddingTop: '12px',
                    paddingBottom: '12px'
                }
            })
        }
    ],
    columns: [
        {
            name: 'Balanced 50/50 Columns',
            description: 'Equal split two-column layout',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_columns_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'columns',
                style: {
                    paddingTop: '12px',
                    paddingBottom: '12px'
                },
                columns: [
                    { width: '50%', blocks: [] },
                    { width: '50%', blocks: [] }
                ]
            })
        },
        {
            name: 'Balanced Three Columns',
            description: 'Equal split three-column layout',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_columns_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'columns',
                style: {
                    paddingTop: '12px',
                    paddingBottom: '12px'
                },
                columns: [
                    { width: '33.33%', blocks: [] },
                    { width: '33.33%', blocks: [] },
                    { width: '33.33%', blocks: [] }
                ]
            })
        },
        {
            name: 'Asymmetric 70/30 Content',
            description: 'Wide content left, narrow sidebar right',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_columns_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'columns',
                style: {
                    paddingTop: '12px',
                    paddingBottom: '12px'
                },
                columns: [
                    { width: '70%', blocks: [] },
                    { width: '30%', blocks: [] }
                ]
            })
        },
        {
            name: 'Asymmetric 30/70 Content',
            description: 'Narrow sidebar left, wide content right',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_columns_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'columns',
                style: {
                    paddingTop: '12px',
                    paddingBottom: '12px'
                },
                columns: [
                    { width: '30%', blocks: [] },
                    { width: '70%', blocks: [] }
                ]
            })
        }
    ],
    'score-card': [
        {
            name: 'Blue Score Card',
            description: 'Centered score display in active blue brand banner',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_score_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'score-card',
                style: {
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '16px',
                    paddingTop: '24px',
                    paddingBottom: '24px'
                }
            })
        },
        {
            name: 'Stats Bordered Panel',
            description: 'Metric count badge with thin border outline',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_score_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'score-card',
                style: {
                    backgroundColor: '#f8fafc',
                    color: '#0f172a',
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: '#cbd5e1',
                    borderRadius: '16px',
                    paddingTop: '20px',
                    paddingBottom: '20px'
                }
            })
        },
        {
            name: 'Warning Score Card',
            description: 'Centered score display in warning amber color',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_score_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'score-card',
                style: {
                    backgroundColor: '#f59e0b',
                    color: '#ffffff',
                    borderRadius: '16px',
                    paddingTop: '24px',
                    paddingBottom: '24px'
                }
            })
        }
    ],
    header: [
        {
            name: 'Branded Header Logo',
            description: 'Branded header with logo and bottom divider line',
            aspectRatio: 'aspect-[16/4]',
            create: () => ({
                id: `blk_header_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'header',
                url: '{{org_logo_url}}',
                style: {
                    paddingTop: '16px',
                    paddingBottom: '16px'
                }
            })
        }
    ],
    footer: [
        {
            name: 'Copyright Info Footer',
            description: 'Branded copyright notice text block',
            aspectRatio: 'aspect-[16/4]',
            create: () => ({
                id: `blk_footer_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'footer',
                content: '© {{org_name}}. All rights reserved.',
                style: {
                    paddingTop: '24px',
                    paddingBottom: '24px'
                }
            })
        }
    ],
    rsvp: [
        {
            name: 'Event Card (Full Bento)',
            description: 'Invitation card with pill badge, title, description, and Bento RSVP buttons',
            aspectRatio: 'aspect-[3/4]',
            create: () => ({
                id: `blk_rsvp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'rsvp',
                rsvpStyle: 'event_full_bento',
                pillText: 'Invitation',
                title: 'Design Team Synchronization',
                content: 'Reviewing the quarterly brand evolution and digital style guidance for the upcoming luxury client launch.',
                rsvpDateLabel: 'DATE',
                rsvpDate: 'Dec 15, 2024',
                rsvpTimeLabel: 'TIME',
                rsvpTime: '2:00 PM',
                rsvpLocationLabel: 'TYPE',
                rsvpLocation: 'Virtual Meeting',
                goingLabel: 'Going',
                laterLabel: 'Later',
                declinedLabel: 'Not Going',
                style: {
                    textAlign: 'left',
                    backgroundColor: '#ffffff',
                    paddingTop: '24px',
                    paddingBottom: '24px',
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    borderRadius: '16px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#e2e8f0'
                }
            })
        },
        {
            name: 'Event Card (Full Inline)',
            description: 'Invitation card with pill badge, title, description, and Inline/Adaptive RSVP buttons',
            aspectRatio: 'aspect-[3/4]',
            create: () => ({
                id: `blk_rsvp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'rsvp',
                rsvpStyle: 'event_full_inline',
                pillText: 'Invitation',
                title: 'Design Team Synchronization',
                content: 'Reviewing the quarterly brand evolution and digital style guidance for the upcoming luxury client launch.',
                rsvpDateLabel: 'DATE',
                rsvpDate: 'Dec 15, 2024',
                rsvpTimeLabel: 'TIME',
                rsvpTime: '2:00 PM',
                rsvpLocationLabel: 'TYPE',
                rsvpLocation: 'Virtual Meeting',
                goingLabel: 'Going',
                laterLabel: 'Later',
                declinedLabel: 'Not Going',
                style: {
                    textAlign: 'left',
                    backgroundColor: '#ffffff',
                    paddingTop: '24px',
                    paddingBottom: '24px',
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    borderRadius: '16px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#e2e8f0'
                }
            })
        },
        {
            name: 'Event Card (Compact Bento)',
            description: 'RSVP card with event details and Bento buttons, without header section',
            aspectRatio: 'aspect-[1/1]',
            create: () => ({
                id: `blk_rsvp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'rsvp',
                rsvpStyle: 'event_compact_bento',
                rsvpDateLabel: 'DATE',
                rsvpDate: 'Dec 15, 2024',
                rsvpTimeLabel: 'TIME',
                rsvpTime: '2:00 PM',
                rsvpLocationLabel: 'TYPE',
                rsvpLocation: 'Virtual Meeting',
                goingLabel: 'Going',
                laterLabel: 'Later',
                declinedLabel: 'Not Going',
                style: {
                    textAlign: 'left',
                    backgroundColor: '#ffffff',
                    paddingTop: '24px',
                    paddingBottom: '24px',
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    borderRadius: '16px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#e2e8f0'
                }
            })
        },
        {
            name: 'Event Card (Compact Inline)',
            description: 'RSVP card with event details and Adaptive Inline buttons, without header section',
            aspectRatio: 'aspect-[1/1]',
            create: () => ({
                id: `blk_rsvp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'rsvp',
                rsvpStyle: 'event_compact_inline',
                rsvpDateLabel: 'DATE',
                rsvpDate: 'Dec 15, 2024',
                rsvpTimeLabel: 'TIME',
                rsvpTime: '2:00 PM',
                rsvpLocationLabel: 'TYPE',
                rsvpLocation: 'Virtual Meeting',
                goingLabel: 'Going',
                laterLabel: 'Later',
                declinedLabel: 'Not Going',
                style: {
                    textAlign: 'left',
                    backgroundColor: '#ffffff',
                    paddingTop: '24px',
                    paddingBottom: '24px',
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    borderRadius: '16px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#e2e8f0'
                }
            })
        },
        {
            name: 'Interactive Event Card (Bento)',
            description: 'Date, time, and location card with bento-style RSVP buttons',
            aspectRatio: 'aspect-[1/1]',
            create: () => ({
                id: `blk_rsvp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'rsvp',
                title: '', // No title by default, starts directly with details
                goingLabel: 'Going',
                laterLabel: 'Later',
                declinedLabel: 'Not Going',
                rsvpStyle: 'card_bento',
                rsvpDate: 'Tuesday, Sep 24',
                rsvpTime: '10:00 - 11:00 AM',
                rsvpLocation: 'Google Meet',
                style: {
                    textAlign: 'left',
                    backgroundColor: '#ffffff',
                    paddingTop: '24px',
                    paddingBottom: '24px',
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    borderRadius: '16px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#cbd5e1'
                }
            })
        },
        {
            name: 'Interactive Event Card (Inline)',
            description: 'Date, time, and location card with inline adaptive RSVP buttons',
            aspectRatio: 'aspect-[1/1]',
            create: () => ({
                id: `blk_rsvp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'rsvp',
                title: '', // No title by default, starts directly with details
                goingLabel: 'Going',
                laterLabel: 'Later',
                declinedLabel: 'Not Going',
                rsvpStyle: 'card_inline',
                rsvpDate: 'Tuesday, Sep 24',
                rsvpTime: '10:00 - 11:00 AM',
                rsvpLocation: 'Google Meet',
                style: {
                    textAlign: 'left',
                    backgroundColor: '#ffffff',
                    paddingTop: '24px',
                    paddingBottom: '24px',
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    borderRadius: '16px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#cbd5e1'
                }
            })
        },
        {
            name: 'Minimal RSVP Card',
            description: 'Sleek, centered, compact card with RSVP options',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_rsvp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'rsvp',
                title: 'Will you attend the upcoming onboarding session?',
                goingLabel: 'Going',
                laterLabel: 'Decide Later',
                declinedLabel: 'Not Attending',
                style: {
                    textAlign: 'center',
                    backgroundColor: '#ffffff',
                    paddingTop: '20px',
                    paddingBottom: '20px',
                    paddingLeft: '20px',
                    paddingRight: '20px',
                    borderRadius: '12px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#e2e8f0'
                }
            })
        },
        {
            name: 'Modern Card RSVP',
            description: 'Wide card with background shadow and spaced buttons',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_rsvp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'rsvp',
                title: 'Kindly RSVP for the Scheduled Sync Meeting',
                goingLabel: 'Accept Invitation',
                laterLabel: 'Tentative',
                declinedLabel: 'Decline',
                style: {
                    textAlign: 'center',
                    backgroundColor: '#f8fafc',
                    paddingTop: '24px',
                    paddingBottom: '24px',
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    borderRadius: '16px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#cbd5e1'
                }
            })
        },
        {
            name: 'Elegant Slate RSVP',
            description: 'High-contrast card with deep slate border',
            aspectRatio: 'aspect-[16/9]',
            create: () => ({
                id: `blk_rsvp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'rsvp',
                title: 'Please confirm your attendance below',
                goingLabel: 'Yes, I am in',
                laterLabel: 'Later',
                declinedLabel: 'No, I cannot',
                style: {
                    textAlign: 'center',
                    backgroundColor: '#f1f5f9',
                    paddingTop: '20px',
                    paddingBottom: '20px',
                    paddingLeft: '20px',
                    paddingRight: '20px',
                    borderRadius: '8px',
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: '#475569'
                }
            })
        }
    ]
};

function BlockTemplatePreview({ block }: { block: MessageBlock }) {
    const s = block.style || {};
    
    // Scale styles down for miniature preview representation
    const miniStyle: React.CSSProperties = {
        textAlign: s.textAlign as any || 'left',
        backgroundColor: s.backgroundColor || 'transparent',
        color: s.color || 'inherit',
        borderRadius: s.borderRadius || '0px',
        borderWidth: s.borderWidth ? `${Math.max(1, parseInt(s.borderWidth) / 2)}px` : undefined,
        borderStyle: s.borderStyle as any,
        borderColor: s.borderColor,
        fontWeight: s.fontWeight as any,
        fontSize: '8px',
        paddingTop: s.paddingTop ? `${Math.max(2, parseInt(s.paddingTop) / 4)}px` : '4px',
        paddingBottom: s.paddingBottom ? `${Math.max(2, parseInt(s.paddingBottom) / 4)}px` : '4px',
        paddingLeft: s.paddingLeft ? `${Math.max(4, parseInt(s.paddingLeft) / 4)}px` : '8px',
        paddingRight: s.paddingRight ? `${Math.max(4, parseInt(s.paddingRight) / 4)}px` : '8px',
        marginTop: '0px',
        marginBottom: '0px',
    };

    switch (block.type) {
        case 'heading': {
            const variant = s.variant || 'standard';
            const pillTextVal = block.pillText || '';
            const contentVal = block.content || '';
            
            const align = s.textAlign || (variant === 'dark_slate' || variant === 'envelope_badge' || variant === 'simple_wide' ? 'center' : 'left');
            const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
            const flexAlignClass = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';

            const fontColor = variant === 'dark_slate' ? '#ffffff' : (s.color || '#0f172a');
            const subTextColor = variant === 'dark_slate' ? '#cbd5e1' : '#64748b';

            const isLeftAccent = variant === 'left_accent';
            const isEnvelopeBadge = variant === 'envelope_badge';
            const isNestedCard = variant === 'nested_card';
            const isSimpleWide = variant === 'simple_wide';

            const previewStyle: React.CSSProperties = {
                backgroundColor: s.backgroundColor || 'transparent',
                backgroundImage: s.backgroundImage || undefined,
                backgroundSize: s.backgroundSize || undefined,
                borderRadius: s.borderRadius ? `${Math.max(6, parseInt(s.borderRadius) / 2)}px` : '12px',
                borderWidth: s.borderWidth ? '1px' : undefined,
                borderStyle: s.borderStyle || undefined,
                borderColor: s.borderColor || undefined,
                borderLeft: isLeftAccent ? '2.5px solid #2563eb' : undefined,
            };

            return (
                <div 
                    className="w-full h-full text-left p-3 flex flex-col justify-center transition-all min-h-0 relative select-none"
                    style={previewStyle}
                >
                    {/* Badge / Pill */}
                    {block.pillText && (
                        <div className={cn("mb-1 flex", flexAlignClass)}>
                            {isEnvelopeBadge ? (
                                <span className="inline-flex items-center bg-blue-50/80 text-blue-600 rounded-full px-1 py-0.2 text-[4px] font-black tracking-tight scale-90 leading-none">
                                    ✉️ {pillTextVal}
                                </span>
                            ) : variant === 'dark_slate' ? (
                                <span className="text-[4.5px] font-black tracking-wider text-blue-300 uppercase leading-none">
                                    {pillTextVal}
                                </span>
                            ) : (
                                <span className="inline-flex bg-blue-50 text-blue-600 rounded-full px-1.5 py-0.2 text-[4.5px] font-bold leading-none">
                                    {pillTextVal}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Title */}
                    <div 
                        className={cn("font-extrabold leading-tight", alignClass)}
                        style={{ 
                            fontSize: isSimpleWide ? '10px' : '9px', 
                            color: fontColor,
                        }}
                    >
                        {block.title || 'Heading Title'}
                    </div>

                    {/* Content (Description) */}
                    {block.content && !isSimpleWide && (
                        isNestedCard ? (
                            <div className="mt-1 p-1 bg-white/70 border border-slate-100 rounded-lg text-[4.5px] leading-tight text-slate-500 font-medium w-full text-left">
                                {contentVal}
                            </div>
                        ) : (
                            <div className={cn("mt-1 text-[5px] font-medium leading-tight flex items-center gap-0.5", alignClass, flexAlignClass)} style={{ color: subTextColor }}>
                                {block.url === 'calendar' && (
                                    <span className="scale-75 select-none origin-left">📅</span>
                                )}
                                {block.url && block.url.startsWith('http') && (
                                    <img src={block.url} alt="avatar" className="w-2.5 h-2.5 rounded-full object-cover shrink-0" />
                                )}
                                <span className="truncate">{contentVal}</span>
                            </div>
                        )
                    )}

                    {/* Bottom Metadata row (Left Accent style footer) */}
                    {isLeftAccent && block.rsvpDate && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-150/60 flex items-center gap-1 text-slate-700 text-[4.5px] font-bold">
                            <span className="text-blue-500 scale-75 origin-left shrink-0">🕒</span>
                            <div className="flex flex-col leading-none">
                                <span className="font-extrabold text-[4.5px] text-slate-800">{block.rsvpDate}</span>
                                {block.rsvpTime && <span className="text-slate-500 text-[3.5px] font-semibold">{block.rsvpTime}</span>}
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        case 'text':
            return (
                <div className="w-full p-2.5 overflow-hidden" style={{ backgroundColor: s.backgroundColor, borderRadius: s.borderRadius ? `${Math.max(4, parseInt(s.borderRadius) / 2)}px` : '6px', border: s.borderStyle ? `1px ${s.borderStyle} ${s.borderColor}` : undefined }}>
                    <div className="space-y-1" style={{ textAlign: s.textAlign as any }}>
                        <div className="h-1 bg-slate-300 rounded w-full inline-block" />
                        <div className="h-1 bg-slate-300 rounded w-5/6 inline-block" />
                        <div className="h-1 bg-slate-200 rounded w-2/3 inline-block" />
                    </div>
                </div>
            );
        case 'button': {
            const btnBg = s.backgroundColor || '#2563eb';
            const btnColor = s.color || '#ffffff';
            const btnRadius = s.borderRadius ? `${Math.max(4, parseInt(s.borderRadius) / 2)}px` : '6px';
            const align = s.textAlign || 'center';
            return (
                <div className={`w-full flex ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'} py-2`}>
                    <span 
                        style={{
                            ...miniStyle,
                            backgroundColor: btnBg,
                            color: btnColor,
                            borderRadius: btnRadius,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                        className="inline-block text-[7.5px] font-bold truncate max-w-[120px] pointer-events-none text-center"
                    >
                        {block.title || 'Button'}
                    </span>
                </div>
            );
        }
        case 'list': {
            const isOrdered = block.listStyle === 'ordered';
            const isRoman = block.listStyle === 'roman';
            const isCheckmark = block.listStyle === 'checkmark';
            const isArrow = block.listStyle === 'arrow';
            return (
                <div className="w-full p-2.5 space-y-1.5 text-[8px] text-slate-500">
                    {[1, 2].map((n) => (
                        <div key={n} className="flex items-center gap-1.5">
                            {isOrdered ? (
                                <span className="font-mono text-[7px]">{n}.</span>
                            ) : isRoman ? (
                                <span className="font-mono text-[7px]">{n === 1 ? 'I.' : 'II.'}</span>
                            ) : isCheckmark ? (
                                <span className="text-emerald-500 text-[8px]">✓</span>
                            ) : isArrow ? (
                                <span className="text-blue-500 text-[8px]">→</span>
                            ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                            )}
                            <div className="h-1 bg-slate-200 rounded w-20" />
                        </div>
                    ))}
                </div>
            );
        }
        case 'divider': {
            const borderW = s.borderWidth ? parseInt(s.borderWidth) : 1;
            const styleBorder = s.borderStyle || 'solid';
            const colorBorder = s.borderColor || '#cbd5e1';
            return (
                <div className="w-full py-3.5 px-2">
                    <div 
                        style={{ 
                            borderTop: `${Math.min(4, borderW)}px ${styleBorder} ${colorBorder}`,
                            height: '0px'
                        }} 
                    />
                </div>
            );
        }
        case 'quote':
            return (
                <div 
                    className="w-full p-2.5 border-l-2 bg-slate-50"
                    style={{ 
                        borderLeftColor: s.borderColor || '#3b82f6',
                        backgroundColor: s.backgroundColor || '#f8fafc',
                        borderRadius: s.borderRadius ? `${Math.max(4, parseInt(s.borderRadius) / 2)}px` : '4px'
                    }}
                >
                    <div className="h-1 bg-slate-400 rounded w-full" />
                    <div className="h-1 bg-slate-300 rounded w-5/6 mt-1" />
                </div>
            );
        case 'image': {
            const imgUrl = block.url || '';
            return (
                <div className="w-full py-1 px-2 flex justify-center">
                    {imgUrl && !imgUrl.includes('{{') ? (
                        <img 
                            src={imgUrl} 
                            alt="Preview" 
                            className="w-full h-10 object-cover border" 
                            style={{ borderRadius: s.borderRadius ? `${Math.max(4, parseInt(s.borderRadius) / 2)}px` : '4px' }} 
                        />
                    ) : (
                        <div 
                            className="bg-slate-100 border border-dashed rounded flex flex-col items-center justify-center w-full h-10 text-[7px] text-slate-400 font-bold"
                            style={{ borderRadius: s.borderRadius ? `${Math.max(4, parseInt(s.borderRadius) / 2)}px` : '4px' }}
                        >
                            Image Preview
                        </div>
                    )}
                </div>
            );
        }
        case 'video':
            return (
                <div className="w-full py-1 px-2 flex justify-center">
                    <div 
                        className="bg-slate-800 rounded relative flex items-center justify-center w-full h-10 text-[7px] text-white font-bold"
                        style={{ borderRadius: s.borderRadius ? `${Math.max(4, parseInt(s.borderRadius) / 2)}px` : '4px' }}
                    >
                        <span className="w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center text-[7px]">▶</span>
                    </div>
                </div>
            );
        case 'logo': {
            const logoUrl = block.url || '';
            const align = s.textAlign || 'center';
            return (
                <div className={`w-full py-1.5 flex ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
                    {logoUrl && !logoUrl.includes('{{') ? (
                        <img src={logoUrl} alt="Logo" className="h-6 w-auto object-contain" />
                    ) : (
                        <div className="bg-slate-100 rounded-full w-6 h-6 border flex items-center justify-center text-[7px] text-slate-400 font-bold">
                            Logo
                        </div>
                    )}
                </div>
            );
        }
        case 'columns': {
            const cols = block.columns || [{ width: '50%' }, { width: '50%' }];
            return (
                <div className="w-full p-2 flex gap-1.5 bg-slate-50 rounded border">
                    {cols.map((col, idx) => (
                        <div 
                            key={idx} 
                            className="bg-white border rounded p-1.5 flex-1 flex flex-col gap-1 items-center justify-center min-h-[28px]"
                            style={{ width: col.width }}
                        >
                            <div className="h-0.5 bg-slate-200 rounded w-full" />
                            <div className="h-0.5 bg-slate-150 rounded w-2/3" />
                        </div>
                    ))}
                </div>
            );
        }
        case 'score-card':
            return (
                <div className="w-full p-2.5 bg-blue-600 rounded-xl text-white text-center space-y-1 shadow-sm" style={{ backgroundColor: s.backgroundColor }}>
                    <div className="text-[5px] tracking-widest opacity-85 uppercase font-bold">SCORE</div>
                    <div className="text-[12px] font-black font-sans leading-none">85</div>
                </div>
            );
        case 'rsvp': {
            const rStyle = block.rsvpStyle || 'standard';
            const isEvent = ['event_full_bento', 'event_full_inline', 'event_compact_bento', 'event_compact_inline'].includes(rStyle);
            const isDetailed = ['card_bento', 'card_inline'].includes(rStyle);
            const hasPillDesc = ['event_full_bento', 'event_full_inline'].includes(rStyle);
            const isBento = ['card_bento', 'event_full_bento', 'event_compact_bento'].includes(rStyle);

            const going = block.goingLabel || 'Going';
            const declined = block.declinedLabel || 'Not Going';
            const later = block.laterLabel || 'Later';
            const rDate = block.rsvpDate || 'Tuesday, Sep 24';
            const rTime = block.rsvpTime || '10:00 - 11:00 AM';
            const rLoc = block.rsvpLocation || 'Google Meet';

            if (isEvent) {
                return (
                    <div className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-left text-[6px] space-y-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.02)]" style={{ backgroundColor: s.backgroundColor || '#ffffff' }}>
                        {hasPillDesc && (
                            <div className="space-y-0.5">
                                <span className="inline-block bg-blue-50 text-blue-600 rounded-full px-1.5 py-0.2 text-[4.5px] font-bold">
                                    {block.pillText || 'Invitation'}
                                </span>
                                <div className="text-[7.5px] font-black text-slate-800 leading-none truncate">
                                    {block.title || 'Event Title'}
                                </div>
                                <div className="text-[5px] text-slate-400 leading-none truncate">
                                    {block.content || 'Event description...'}
                                </div>
                                <div className="border-t border-slate-100 my-0.5" />
                            </div>
                        )}
                        
                        {/* Metadata Grid */}
                        <div className="grid grid-cols-3 gap-0.5 text-[4px] leading-tight">
                            <div className="flex items-center gap-0.5 truncate">
                                <span className="text-blue-500 scale-95 shrink-0">📅</span>
                                <div className="truncate">
                                    <div className="font-bold text-slate-400 text-[3.5px] scale-90 origin-left">DATE</div>
                                    <div className="font-bold text-slate-700 truncate">{rDate}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-0.5 truncate border-l border-slate-100 pl-0.5">
                                <span className="text-blue-500 scale-95 shrink-0">🕒</span>
                                <div className="truncate">
                                    <div className="font-bold text-slate-400 text-[3.5px] scale-90 origin-left">TIME</div>
                                    <div className="font-bold text-slate-700 truncate">{rTime}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-0.5 truncate border-l border-slate-100 pl-0.5">
                                <span className="text-blue-500 scale-95 shrink-0">📹</span>
                                <div className="truncate">
                                    <div className="font-bold text-slate-400 text-[3.5px] scale-90 origin-left">TYPE</div>
                                    <div className="font-bold text-slate-700 truncate">{rLoc}</div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 my-0.5" />

                        {/* Buttons */}
                        {isBento ? (
                            <div className="space-y-0.5 w-full">
                                <div className="w-full bg-[#0052cc] text-white rounded-lg py-0.5 text-[5px] font-bold flex items-center justify-center gap-0.5 leading-none select-none">
                                    {going}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="5" height="5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                    <div className="bg-white border border-slate-200 text-slate-650 rounded-lg py-0.5 text-[4px] font-bold flex items-center justify-center gap-0.5 leading-none select-none">
                                        {later}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="4.5" height="4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                    </div>
                                    <div className="bg-white border border-slate-200 text-slate-655 rounded-lg py-0.5 text-[4px] font-bold flex items-center justify-center gap-0.5 leading-none select-none">
                                        {declined}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="4.5" height="4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-1 w-full">
                                <div className="bg-[#0052cc] text-white rounded-lg py-0.5 text-[4px] font-bold flex items-center justify-center gap-0.5 leading-none select-none truncate">
                                    {going}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="4.5" height="4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                                </div>
                                <div className="bg-white border border-slate-200 text-slate-650 rounded-lg py-0.5 text-[4px] font-bold flex items-center justify-center gap-0.5 leading-none select-none truncate">
                                    {later}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                </div>
                                <div className="bg-white border border-slate-200 text-slate-655 rounded-lg py-0.5 text-[4px] font-bold flex items-center justify-center gap-0.5 leading-none select-none truncate">
                                    {declined}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            if (isDetailed) {
                return (
                    <div className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-left text-[6px] space-y-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.02)]" style={{ backgroundColor: s.backgroundColor || '#ffffff' }}>
                        {block.title && (
                            <div className="text-[7.5px] font-black text-slate-800 leading-none truncate">
                                {block.title}
                            </div>
                        )}
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1 leading-none text-slate-700">
                                <span className="text-blue-500 scale-90">🕒</span>
                                <div className="truncate font-bold">{rDate} • {rTime}</div>
                            </div>
                            <div className="flex items-center gap-1 leading-none text-slate-700">
                                <span className="text-blue-500 scale-90">📹</span>
                                <div className="truncate font-semibold">{rLoc}</div>
                            </div>
                        </div>

                        {/* Buttons */}
                        {isBento ? (
                            <div className="space-y-0.5 w-full">
                                <div className="w-full bg-[#0062cc] text-white rounded-lg py-0.5 text-[5px] font-bold flex items-center justify-center gap-0.5 leading-none select-none">
                                    {going}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="5" height="5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                    <div className="bg-white border border-slate-200 text-[#0062cc] rounded-lg py-0.5 text-[4px] font-bold flex items-center justify-center gap-0.5 leading-none select-none">
                                        {declined}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="4.5" height="4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                    </div>
                                    <div className="bg-white border border-slate-200 text-[#0062cc] rounded-lg py-0.5 text-[4px] font-bold flex items-center justify-center gap-0.5 leading-none select-none">
                                        {later}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="4.5" height="4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-1 w-full">
                                <div className="bg-[#0062cc] text-white rounded-lg py-0.5 text-[4px] font-bold flex items-center justify-center gap-0.5 leading-none select-none truncate">
                                    {going}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="4.5" height="4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                                </div>
                                <div className="bg-white border border-slate-200 text-[#0062cc] rounded-lg py-0.5 text-[4px] font-bold flex items-center justify-center gap-0.5 leading-none select-none truncate">
                                    {declined}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                </div>
                                <div className="bg-white border border-slate-200 text-[#0062cc] rounded-lg py-0.5 text-[4px] font-bold flex items-center justify-center gap-0.5 leading-none select-none truncate">
                                    {later}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            // Standard Style
            return (
                <div className="w-full p-2 bg-white border border-slate-100 rounded-lg text-center text-[6px] space-y-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.02)]" style={{ backgroundColor: s.backgroundColor }}>
                    <div className="font-bold text-slate-700 leading-none truncate">
                        {block.title || 'Will you attend this meeting?'}
                    </div>
                    <div className="flex gap-1 justify-center">
                        <span className="bg-emerald-500 text-white rounded px-1.5 py-0.5 text-[4px] font-bold leading-none select-none">{going}</span>
                        <span className="bg-amber-500 text-white rounded px-1.5 py-0.5 text-[4px] font-bold leading-none select-none">{later}</span>
                        <span className="bg-rose-500 text-white rounded px-1.5 py-0.5 text-[4px] font-bold leading-none select-none">{declined}</span>
                    </div>
                </div>
            );
        }
        default:
            return <div className="text-[8px] text-slate-400">Preview</div>;
    }
}

interface TemplateWorkshopProps {
    initialTemplate?: MessageTemplate | null;
    variables: VariableDefinition[];
    styles: MessageStyle[];
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
    const { activeWorkspaceId, activeOrganizationId, allowedWorkspaces } = useWorkspace();
    const { singular: entityTerminology } = useTerminology();

    // Query field groups dynamically to allow adding custom variables to a specific group
    const firestore = useFirestore();
    const groupsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'field_groups'), where('workspaceId', '==', activeWorkspaceId), orderBy('order', 'asc'));
    }, [firestore, activeWorkspaceId]);
    const { data: fieldGroups } = useCollection<FieldGroup>(groupsQuery);

    const { user } = useUser();

    // Dialog state for dynamic variable creation
    const [variableSearchQuery, setVariableSearchQuery] = React.useState('');
    const [isAddVarOpen, setIsAddVarOpen] = React.useState(false);
    const [isCreatingVar, setIsCreatingVar] = React.useState(false);
    const [varForm, setVarForm] = React.useState({
        label: '',
        variableName: '',
        scope: 'common' as 'common' | 'person' | 'institution',
        type: 'short_text' as AppField['type'],
        groupId: '',
        defaultValue: '',
    });
    const [accordionValue, setAccordionValue] = React.useState<string[]>(['branding', 'primary_contacts', 'entity_fields', 'custom_vars']);

    React.useEffect(() => {
        if (!variableSearchQuery.trim()) {
            setAccordionValue(['branding', 'primary_contacts', 'entity_fields', 'custom_vars']);
            return;
        }
        setAccordionValue([
            'branding',
            'primary_contacts',
            'signatory_contacts',
            'roles_contacts',
            'entity_fields',
            'feature_vars',
            'surveys',
            'forms',
            'custom_vars'
        ]);
    }, [variableSearchQuery]);

    const handleCreateVariable = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!varForm.label.trim() || !varForm.variableName.trim() || !activeWorkspaceId || !activeOrganizationId || !user) return;
        
        setIsCreatingVar(true);
        try {
            const varName = varForm.variableName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
            
            // Check for duplicate key locally in variables prop first to give fast feedback
            const isDuplicate = variables.some(v => v.key.toLowerCase() === varName.toLowerCase());
            if (isDuplicate) {
                toast({ variant: 'destructive', title: 'Duplicate Variable', description: `A variable with key "${varName}" already exists.` });
                setIsCreatingVar(false);
                return;
            }

            let targetGroupId = varForm.groupId;
            if (!targetGroupId) {
                // Find or create group "Custom Variables"
                const existingGroup = fieldGroups?.find(g => g.slug === 'custom_variables');
                if (existingGroup) {
                    targetGroupId = existingGroup.id;
                } else {
                    const newGroupRes = await createFieldGroupAction({
                        workspaceId: activeWorkspaceId,
                        organizationId: activeOrganizationId,
                        name: 'Custom Variables',
                        description: 'Custom messaging and template variables',
                        icon: 'Database',
                        color: '#3B5FFF',
                        entityTypes: ['person', 'institution', 'family'],
                    }, user.uid);
                    if (newGroupRes.success && newGroupRes.group) {
                        targetGroupId = newGroupRes.group.id;
                    } else {
                        throw new Error(newGroupRes.error || 'Failed to create variable group');
                    }
                }
            }

            const fieldData = {
                workspaceId: activeWorkspaceId,
                organizationId: activeOrganizationId,
                name: varForm.label.trim(),
                label: varForm.label.trim(),
                variableName: varName,
                type: varForm.type,
                groupId: targetGroupId,
                section: varForm.scope,
                isNative: false,
                compatibilityScope: [varForm.scope],
                status: 'active' as const,
                defaultValue: varForm.defaultValue.trim() || null,
                placeholder: '',
                helpText: '',
            };

            const res = await createFieldAction(fieldData, user.uid);
            if (res.success) {
                toast({ title: 'Variable Created', description: `Variable {{${varName}}} is now available.` });
                setIsAddVarOpen(false);
                setVarForm({
                    label: '',
                    variableName: '',
                    scope: 'common',
                    type: 'short_text',
                    groupId: '',
                    defaultValue: '',
                });
            } else {
                throw new Error(res.error || 'Failed to create custom field/variable');
            }
        } catch (error) {
            const err = error as Error;
            console.error('Failed to create custom variable:', err);
            toast({ variant: 'destructive', title: 'Creation Failed', description: err.message });
        } finally {
            setIsCreatingVar(false);
        }
    };

    const variables = React.useMemo(() => {
        const filtered = (rawVariables || []).filter(v => !v.key.startsWith('school_'));
        
        // Dynamically build and inject contact variables
        const contactVarDefs = generateContactVariableDefinitions('institution');
        const contactKeys = new Set(contactVarDefs.map(v => v.key));
        
        // Filter out existing contact keys from rawVariables to prevent duplicate definitions
        const nonDuplicateFiltered = filtered.filter(v => !contactKeys.has(v.key));

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
        
        // Entity field variables (all fields from entity creation/editing forms)
        const entityFieldVars = generateEntityFieldVariables(entityTerminology || 'Entity');

        const seenKeys = new Set(nonDuplicateFiltered.map(v => v.key));
        const filteredTerminologyVars = terminologyVars.filter(v => !seenKeys.has(v.key));
        const filteredEntityFieldVars = entityFieldVars.filter(v => !seenKeys.has(v.key) && !new Set(filteredTerminologyVars.map(t => t.key)).has(v.key));

        return [...filteredTerminologyVars, ...contactVarDefs, ...filteredEntityFieldVars, ...nonDuplicateFiltered];
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
    const [sidebarTab, setSidebarTab] = React.useState<'blocks' | 'variables' | 'validation'>('blocks');
    const [variablesWidth, setVariablesWidth] = React.useState(320);
    const [isResizing, setIsResizing] = React.useState(false);
    const dragStartRef = React.useRef({ mouseX: 0, startWidth: 0 });
    const [isTestModalOpen, setIsTestModalOpen] = React.useState(false);
    const [showValidationErrorDialog, setShowValidationErrorDialog] = React.useState(false);

    // Active editor insertion reference
    const editorInsertRef = React.useRef<((token: string) => void) | null>(null);

    // Variable click-to-insert handler
    const handleVariableInsert = React.useCallback((key: string) => {
        const token = `{{${key}}}`;
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            const input = activeEl as HTMLInputElement | HTMLTextAreaElement;
            const start = input.selectionStart ?? 0;
            const end = input.selectionEnd ?? 0;
            const value = input.value;
            const newValue = value.slice(0, start) + token + value.slice(end);
            
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                activeEl.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype,
                'value'
            )?.set;
            
            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(input, newValue);
            } else {
                input.value = newValue;
            }
            
            input.dispatchEvent(new Event('input', { bubbles: true }));
            
            requestAnimationFrame(() => {
                const newPos = start + token.length;
                input.setSelectionRange(newPos, newPos);
                input.focus();
            });
        } else if (editorInsertRef.current) {
            editorInsertRef.current(key);
        } else {
            navigator.clipboard.writeText(token);
            toast({ title: 'Token copied to clipboard', description: token });
        }
    }, [toast]);

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
    const [recipientType, setRecipientType] = React.useState<string>(initialTemplate?.recipientType || initialContext?.recipientType || 'external_alert');
    const [workspaceIds, setWorkspaceIds] = React.useState<string[]>(initialTemplate?.workspaceIds || [activeWorkspaceId]);
    const [subject, setSubject] = React.useState(initialTemplate?.subject || '');
    const [previewText, setPreviewText] = React.useState(initialTemplate?.previewText || '');
    const [subjectOptions, setSubjectOptions] = React.useState<Array<{ subject: string; previewText: string }>>(
        initialTemplate?.subjectOptions || []
    );
    const [manualSubject, setManualSubject] = React.useState(initialTemplate?.subject || '');
    const [manualPreviewText, setManualPreviewText] = React.useState(initialTemplate?.previewText || '');
    const [activeOptionIndex, setActiveOptionIndex] = React.useState<number | null>(null);
    const [isAlternativesOpen, setIsAlternativesOpen] = React.useState(false);

    const handleSubjectChange = React.useCallback((val: string) => {
        setSubject(val);
        setManualSubject(val);
        setActiveOptionIndex(null);
    }, []);

    const handlePreviewTextChange = React.useCallback((val: string) => {
        setPreviewText(val);
        setManualPreviewText(val);
        setActiveOptionIndex(null);
    }, []);

    const [body, setBody] = React.useState(initialTemplate?.body || '');
    const [blocks, setBlocks] = React.useState<MessageBlock[]>(initialTemplate?.blocks || []);
    const [activeBlockSubView, setActiveBlockSubView] = React.useState<string | null>(null);
    const [rightPanelTab, setRightPanelTab] = React.useState<'properties' | 'layers'>('properties');
    
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

    // Email Architect State Hooks
    const [architectPrompt, setArchitectPrompt] = React.useState('');
    const [architectImageUrl, setArchitectImageUrl] = React.useState('');
    const [architectMode, setArchitectMode] = React.useState<'layout_analysis' | 'direct_placement'>('layout_analysis');
    const [isArchitecting, setIsArchitecting] = React.useState(false);
    const [lastBlocksBackup, setLastBlocksBackup] = React.useState<MessageBlock[] | null>(null);
    const [isUploadingImage, setIsUploadingImage] = React.useState(false);

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

    const findBlockRecursively = React.useCallback((items: MessageBlock[], id: string): MessageBlock | undefined => {
        for (const item of items) {
            if (item.id === id) return item;
            if (item.type === 'columns' && item.columns) {
                for (const col of item.columns) {
                    const found = findBlockRecursively(col.blocks, id);
                    if (found) return found;
                }
            }
        }
        return undefined;
    }, []);

    const updateBlockRecursively = React.useCallback((items: MessageBlock[], id: string, updates: Partial<MessageBlock>): MessageBlock[] => {
        return items.map(item => {
            if (item.id === id) {
                return { ...item, ...updates };
            }
            if (item.type === 'columns' && item.columns) {
                return {
                    ...item,
                    columns: item.columns.map(col => ({
                        ...col,
                        blocks: updateBlockRecursively(col.blocks, id, updates)
                    }))
                };
            }
            return item;
        });
    }, []);

    const removeBlockRecursively = React.useCallback((items: MessageBlock[], id: string): MessageBlock[] => {
        return items.filter(item => item.id !== id).map(item => {
            if (item.type === 'columns' && item.columns) {
                return {
                    ...item,
                    columns: item.columns.map(col => ({
                        ...col,
                        blocks: removeBlockRecursively(col.blocks, id)
                    }))
                };
            }
            return item;
        });
    }, []);

    const duplicateBlockRecursively = React.useCallback((items: MessageBlock[], id: string): MessageBlock[] => {
        const next: MessageBlock[] = [];
        for (const item of items) {
            if (item.id === id) {
                next.push(item);
                next.push({
                    ...item,
                    id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
                });
            } else if (item.type === 'columns' && item.columns) {
                next.push({
                    ...item,
                    columns: item.columns.map(col => ({
                        ...col,
                        blocks: duplicateBlockRecursively(col.blocks, id)
                    }))
                });
            } else {
                next.push(item);
            }
        }
        return next;
    }, []);

    const swapBlocksRecursively = React.useCallback((items: MessageBlock[], id: string, direction: 'up' | 'down'): MessageBlock[] => {
        const idx = items.findIndex(item => item.id === id);
        if (idx !== -1) {
            const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (targetIdx >= 0 && targetIdx < items.length) {
                return arrayMove(items, idx, targetIdx);
            }
            return items;
        }
        return items.map(item => {
            if (item.type === 'columns' && item.columns) {
                return {
                    ...item,
                    columns: item.columns.map(col => ({
                        ...col,
                        blocks: swapBlocksRecursively(col.blocks, id, direction)
                    }))
                };
            }
            return item;
        });
    }, []);

    const handleSwapSubBlocks = React.useCallback((parentBlockId: string, colIdx: number, a: number, b: number) => {
        setBlocks(prev => {
            const updateSwap = (items: MessageBlock[]): MessageBlock[] => {
                return items.map(item => {
                    if (item.id === parentBlockId && item.type === 'columns' && item.columns) {
                        return {
                            ...item,
                            columns: item.columns.map((col, idx) => {
                                if (idx === colIdx) {
                                    return {
                                        ...col,
                                        blocks: arrayMove(col.blocks, a, b)
                                    };
                                }
                                return col;
                            })
                        };
                    }
                    if (item.type === 'columns' && item.columns) {
                        return {
                            ...item,
                            columns: item.columns.map(col => ({
                                ...col,
                                blocks: updateSwap(col.blocks)
                            }))
                        };
                    }
                    return item;
                });
            };
            return updateSwap(prev);
        });
    }, []);

    const customCollisionDetection = React.useCallback((args: any) => {
        const pointerCollisions = pointerWithin(args);
        if (pointerCollisions.length > 0) {
            const colCellCollision = pointerCollisions.find(c => String(c.id).startsWith('col-cell-'));
            if (colCellCollision) {
                return [colCellCollision];
            }
            return pointerCollisions;
        }
        return rectIntersection(args);
    }, []);

    const handleAddBlock = (type: MessageBlock['type'], variant?: 'h1' | 'h2' | 'h3') => {
        const id = `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newBlock: MessageBlock = { id, type, title: '', content: '', variant, style: { textAlign: 'left', variant: 'default' } };
        if (type === 'list') { newBlock.listStyle = 'unordered'; newBlock.items = ['Item 1']; }
        if (type === 'columns') {
            newBlock.columns = [
                { width: '50%', blocks: [] },
                { width: '50%', blocks: [] }
            ];
        }
        setBlocks(prev => [...prev, newBlock]);
        setSelectedBlockId(id);
        setSidebarTab('blocks');
    };

    const handleAddTemplateBlock = (createFn: () => MessageBlock) => {
        const newBlock = createFn();
        setBlocks(prev => [...prev, newBlock]);
        setSelectedBlockId(newBlock.id);
        setSidebarTab('blocks');
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (!over) return;
        
        const activeId = active.id;
        const overId = over.id;
        
        if (activeId === overId) return;

        setBlocks(prev => {
            const activeBlock = findBlockRecursively(prev, activeId);
            if (!activeBlock) return prev;

            const cleanTree = removeBlockRecursively(prev, activeId);

            if (String(overId).startsWith('col-cell-')) {
                const parts = String(overId).split('-');
                const colIdx = parseInt(parts.pop() || '0');
                const parentBlockId = parts.slice(2).join('-');

                return cleanTree.map(item => {
                    if (item.id === parentBlockId && item.type === 'columns' && item.columns) {
                        return {
                            ...item,
                            columns: item.columns.map((col, idx) => {
                                if (idx === colIdx) {
                                    return {
                                        ...col,
                                        blocks: [...col.blocks, activeBlock]
                                    };
                                }
                                return col;
                            })
                        };
                    }
                    return item;
                });
            }

            const insertRelative = (items: MessageBlock[]): MessageBlock[] => {
                const next: MessageBlock[] = [];
                for (const item of items) {
                    if (item.id === overId) {
                        next.push(item);
                        next.push(activeBlock);
                    } else if (item.type === 'columns' && item.columns) {
                        next.push({
                            ...item,
                            columns: item.columns.map(col => ({
                                ...col,
                                blocks: insertRelative(col.blocks)
                            }))
                        });
                    } else {
                        next.push(item);
                    }
                }
                return next;
            };

            return insertRelative(cleanTree);
        });
    };

    const findParentBlocksList = (items: MessageBlock[], id: string): MessageBlock[] | null => {
        if (items.some(item => item.id === id)) {
            return items;
        }
        for (const item of items) {
            if (item.type === 'columns' && item.columns) {
                for (const col of item.columns) {
                    const list = findParentBlocksList(col.blocks, id);
                    if (list) return list;
                }
            }
        }
        return null;
    };

    const replaceBlocksListRecursively = (
        items: MessageBlock[], 
        targetIdInList: string, 
        newList: MessageBlock[]
    ): MessageBlock[] => {
        if (items.some(item => item.id === targetIdInList)) {
            return newList;
        }
        return items.map(item => {
            if (item.type === 'columns' && item.columns) {
                return {
                    ...item,
                    columns: item.columns.map(col => {
                        if (col.blocks.some(b => b.id === targetIdInList)) {
                            return {
                                ...col,
                                blocks: newList
                            };
                        }
                        return {
                            ...col,
                            blocks: replaceBlocksListRecursively(col.blocks, targetIdInList, newList)
                        };
                    })
                };
            }
            return item;
        });
    };

    const handleSidebarDragEnd = (event: any) => {
        const { active, over } = event;
        if (!over) return;
        
        const activeId = active.id;
        const overId = over.id;
        
        if (activeId === overId) return;

        setBlocks(prev => {
            const parentList = findParentBlocksList(prev, activeId);
            if (!parentList) return prev;
            
            const hasOver = parentList.some(item => item.id === overId);
            if (!hasOver) return prev;

            const oldIndex = parentList.findIndex(item => item.id === activeId);
            const newIndex = parentList.findIndex(item => item.id === overId);
            
            const reorderedList = arrayMove(parentList, oldIndex, newIndex);
            return replaceBlocksListRecursively(prev, activeId, reorderedList);
        });
    };

    const renderSidebarBlockOutline = () => {
        const sidebarSensors = useSensors(
            useSensor(PointerSensor, {
                activationConstraint: {
                    distance: 5,
                },
            })
        );

        const renderItem = (block: MessageBlock, isNested = false): React.ReactNode => {
            return (
                <SortableLayerItem
                    key={block.id}
                    id={block.id}
                    block={block}
                    isSelected={selectedBlockId === block.id}
                    isNested={isNested}
                    onSelect={() => setSelectedBlockId(block.id)}
                    onSwap={(dir) => setBlocks(p => swapBlocksRecursively(p, block.id, dir))}
                    onDuplicate={() => setBlocks(prev => duplicateBlockRecursively(prev, block.id))}
                    onRemove={() => {
                        setBlocks(prev => removeBlockRecursively(prev, block.id));
                        if (selectedBlockId === block.id) setSelectedBlockId(null);
                    }}
                    blockIcons={blockIcons}
                    renderItem={renderItem}
                />
            );
        };

        return (
            <div className="space-y-3 text-left">
                {blocks.length === 0 ? (
                    <div className="py-20 text-center opacity-30 animate-in fade-in duration-200">
                        <Layout className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-[10px] font-semibold">No blocks placed yet</p>
                    </div>
                ) : (
                    <DndContext 
                        sensors={sidebarSensors} 
                        collisionDetection={closestCenter} 
                        onDragEnd={handleSidebarDragEnd}
                    >
                        <SortableContext 
                            items={blocks.map(b => b.id)} 
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                                {blocks.map(b => renderItem(b, false))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        );
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        dragStartRef.current = {
            mouseX: e.clientX,
            startWidth: variablesWidth
        };
        setIsResizing(true);
    };
    React.useEffect(() => {
        const move = (e: MouseEvent) => {
            if (!isResizing) return;
            const deltaX = e.clientX - dragStartRef.current.mouseX;
            const newWidth = Math.max(250, Math.min(600, dragStartRef.current.startWidth + deltaX));
            setVariablesWidth(newWidth);
        };
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

    // Safety sync: If we switch away from rich_builder, force the sidebar to 'variables' so it doesn't break
    React.useEffect(() => {
        if (contentMode !== 'rich_builder' && sidebarTab !== 'variables' && sidebarTab !== 'validation') {
            setSidebarTab('variables');
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

    const handleArchitectSubmit = async () => {
        if (!architectPrompt.trim() && !architectImageUrl) {
            toast({ title: 'Input required', description: 'Please enter a description prompt or attach an image.', variant: 'destructive' });
            return;
        }
        setIsArchitecting(true);
        try {
            const { generateEmailBlocksAction } = (await import('@/lib/campaign-ai')) as {
                generateEmailBlocksAction: (params: {
                    prompt: string;
                    imageUrl?: string;
                    mode: 'layout_analysis' | 'direct_placement';
                    organizationId?: string;
                    brandColors?: { primary?: string; secondary?: string; background?: string };
                }) => Promise<{
                    success: boolean;
                    blocks?: MessageBlock[];
                    subject?: string;
                    previewText?: string;
                    subjectOptions?: Array<{ subject: string; previewText: string }>;
                    error?: string;
                }>;
            };
            const resolvedOrgId = activeOrganizationId || initialTemplate?.organizationId || allowedWorkspaces?.find(w => w.id === activeWorkspaceId)?.organizationId || undefined;
            const res = await generateEmailBlocksAction({
                prompt: architectPrompt,
                imageUrl: architectImageUrl || undefined,
                mode: architectMode,
                organizationId: resolvedOrgId,
            });

            if (res.success && res.blocks) {
                // Map generated blocks to add unique IDs
                const formatted: MessageBlock[] = res.blocks.map((b: MessageBlock) => ({
                    ...b,
                    id: `${b.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    columns: b.columns?.map((c) => ({
                        ...c,
                        blocks: c.blocks?.map((sb: MessageBlock) => ({
                            ...sb,
                            id: `${sb.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                        })) || []
                    }))
                }));

                // Back up blocks before mutation for Undo capability
                setLastBlocksBackup([...blocks]);
                setBlocks((prev) => [...prev, ...formatted]);

                // Sync subject options and auto-apply if current input is empty
                if (res.subjectOptions && res.subjectOptions.length > 0) {
                    setSubjectOptions(res.subjectOptions);
                    if (!subject.trim() && !previewText.trim()) {
                        const primSub = res.subject || '';
                        const primPrev = res.previewText || '';
                        setSubject(primSub);
                        setPreviewText(primPrev);
                        setManualSubject(primSub);
                        setManualPreviewText(primPrev);
                        setActiveOptionIndex(null);
                    }
                }

                toast({ title: 'Blocks Appended', description: `Successfully added ${formatted.length} layout blocks.` });
                setArchitectPrompt('');
                setArchitectImageUrl('');
            } else {
                toast({ title: 'Architect Failed', description: res.error || 'Unable to build blocks.', variant: 'destructive' });
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Action trigger error';
            toast({ title: 'Error', description: msg, variant: 'destructive' });
        } finally {
            setIsArchitecting(false);
        }
    };

    const handleUndoArchitect = () => {
        if (lastBlocksBackup) {
            setBlocks(lastBlocksBackup);
            setLastBlocksBackup(null);
            toast({ title: 'Action Undone', description: 'Appended blocks have been removed.' });
        }
    };

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
        const saveData: Partial<MessageTemplate> = {
            name, category, channel, contentMode, target, workspaceIds,
            subject, previewText, subjectOptions, body, blocks, styleId, templateType,
            recipientType: recipientType as RecipientType, status, variableContext
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
        const activeStyle = styleId !== 'none'
            ? (styleId === 'default' || !styleId ? styles.find(s => s.isDefault) : styles.find(s => s.id === styleId))
            : null;
        if (!activeStyle) return null;
        
        const html = target === 'internal_team'
            ? (activeStyle.htmlWrapperInternal ?? activeStyle.htmlWrapper ?? '')
            : (activeStyle.htmlWrapperExternal ?? activeStyle.htmlWrapper ?? '');
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
    }, [styleId, styles, target]);

    const resolvedHeader = React.useMemo(() => {
        const activeStyle = styleId !== 'none'
            ? (styleId === 'default' || !styleId ? styles.find(s => s.isDefault) : styles.find(s => s.id === styleId))
            : null;
        if (!activeStyle) return '';
        const html = target === 'internal_team'
            ? (activeStyle.htmlWrapperInternal ?? activeStyle.htmlWrapper ?? '')
            : (activeStyle.htmlWrapperExternal ?? activeStyle.htmlWrapper ?? '');
        const contentIdx = html.indexOf('{{content}}');
        if (contentIdx === -1) return '';
        let headerPart = html.substring(0, contentIdx);
        
        headerPart = headerPart.replace(/<html[^>]*>/i, '')
                               .replace(/<\/html>/i, '')
                               .replace(/<head[^>]*>[\s\S]*?<\/head>/i, '')
                               .replace(/<body[^>]*>/i, '')
                               .replace(/<\/body>/i, '');
                               
        const firstDiv = headerPart.match(/<div[^>]*style=["']/i);
        if (firstDiv) {
            headerPart = headerPart.replace(firstDiv[0], '');
        }
        const lastDiv = headerPart.match(/<div[^>]*style=["']/i);
        if (lastDiv) {
            headerPart = headerPart.replace(lastDiv[0], '');
        }
        
        return resolveVariables(headerPart, activeSimVariables);
    }, [styleId, styles, activeSimVariables, target]);

    const resolvedFooter = React.useMemo(() => {
        const activeStyle = styleId !== 'none'
            ? (styleId === 'default' || !styleId ? styles.find(s => s.isDefault) : styles.find(s => s.id === styleId))
            : null;
        if (!activeStyle) return '';
        const html = target === 'internal_team'
            ? (activeStyle.htmlWrapperInternal ?? activeStyle.htmlWrapper ?? '')
            : (activeStyle.htmlWrapperExternal ?? activeStyle.htmlWrapper ?? '');
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
    }, [styleId, styles, activeSimVariables, target]);

    const resolvedPreviewHtml = React.useMemo(() => {
        const activeStyle = styleId !== 'none'
            ? (styleId === 'default' || !styleId ? styles.find(s => s.isDefault) : styles.find(s => s.id === styleId))
            : null;
        const effectiveMode = channel === 'sms' ? 'plain_text' : contentMode;
        
        const styleWrapper = activeStyle
            ? (target === 'internal_team'
                ? (activeStyle.htmlWrapperInternal ?? activeStyle.htmlWrapper ?? '')
                : (activeStyle.htmlWrapperExternal ?? activeStyle.htmlWrapper ?? ''))
            : '';

        if (effectiveMode === 'rich_builder') {
            return renderBlocksToHtml(blocks, activeSimVariables, {
                wrapper: styleWrapper || undefined,
                style: activeStyle || undefined
            });
        }
        let resolved = resolveVariables(body, activeSimVariables);
        if (effectiveMode === 'plain_text' && channel === 'email') {
            resolved = resolved.replace(/\n/g, '<br>\n');
        }
        if (styleWrapper && styleWrapper.includes('{{content}}')) {
            resolved = resolveVariables(styleWrapper, activeSimVariables).replace('{{content}}', resolved);
        } else if (effectiveMode === 'plain_text' && channel === 'email') {
            resolved = plainTextToHtml(resolved);
        }
        return resolved;
    }, [contentMode, blocks, body, activeSimVariables, styleId, styles, channel, target]);

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

    const autocompleteVariables = React.useMemo<TemplateVariable[]>(() => {
        return availableVarsForEditor.map(v => ({
            id: v.id,
            name: v.key,
            label: v.label || v.key,
            context: (v.category || 'general') as any,
            description: '',
            dataType: (v.type === 'date' || v.type === 'number' || v.type === 'url' || v.type === 'html' ? v.type : 'string') as any,
            exampleValue: v.constantValue || `{{${v.key}}}`,
            isDynamic: false,
            isComputed: false,
        }));
    }, [availableVarsForEditor]);

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
        <TooltipProvider>
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

                                                {/* Subject & Preview moved to Builder (Step 2) for easier variable insertion */}
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
                            <div 
                                className={cn(
                                    "border-r bg-background flex flex-col shrink-0 relative shadow-xl",
                                    !isResizing && "transition-all duration-300"
                                )} 
                                style={{ width: variablesWidth }}
                            >
                                <Tabs value={sidebarTab} onValueChange={(v: any) => setSidebarTab(v)} className="flex-1 flex flex-col min-h-0">
                                    <div className="px-2 py-2 border-b bg-background shrink-0 text-left">
                                        {contentMode === 'rich_builder' ? (
                                            <TabsList className="grid w-full grid-cols-3 h-10 bg-background p-1 rounded-xl">
                                                <TabsTrigger value="blocks" className="text-[9px] font-semibold gap-1.5"><Layout className="h-3 w-3" /> Blocks</TabsTrigger>
                                                <TabsTrigger value="variables" className="text-[9px] font-semibold gap-1.5"><Database className="h-3 w-3" /> Variables</TabsTrigger>
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
                                                <TabsTrigger value="variables" className="text-[9px] font-semibold gap-1.5"><Database className="h-3 w-3" /> Variables</TabsTrigger>
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
                                                {activeBlockSubView ? (
                                                    <div className="space-y-4 animate-in fade-in duration-200">
                                                        {/* Back Header */}
                                                        <div className="flex items-center gap-2 pb-2 border-b">
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveBlockSubView(null)}
                                                                className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-2 py-1 rounded-lg border border-blue-200 transition-all animate-in slide-in-from-left-2 duration-200"
                                                            >
                                                                <ArrowLeft className="h-3 w-3" /> Back
                                                            </button>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground capitalize">
                                                                {activeBlockSubView === 'score-card' ? 'Score Card' : activeBlockSubView} Styles
                                                            </span>
                                                        </div>

                                                        {/* Templates List */}
                                                        <div className="grid grid-cols-1 gap-3 animate-in slide-in-from-bottom-2 duration-300">
                                                            {(blockTypeTemplates[activeBlockSubView] || []).map(tpl => {
                                                                const blockItem = tpl.create();
                                                                const buttonBg = blockItem.style?.backgroundColor || undefined;
                                                                const buttonBgImage = blockItem.style?.backgroundImage || undefined;
                                                                const buttonBgSize = blockItem.style?.backgroundSize || undefined;
                                                                return (
                                                                    <Tooltip key={tpl.name}>
                                                                        <TooltipTrigger asChild>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleAddTemplateBlock(tpl.create)}
                                                                                className={cn(
                                                                                    "w-full text-left rounded-xl border hover:border-primary/45 hover:shadow-md transition-all overflow-hidden p-0 flex items-center justify-center group relative",
                                                                                    tpl.aspectRatio || "aspect-[16/9]"
                                                                                )}
                                                                                style={{
                                                                                    backgroundColor: buttonBg,
                                                                                    backgroundImage: buttonBgImage,
                                                                                    backgroundSize: buttonBgSize,
                                                                                }}
                                                                            >
                                                                                <BlockTemplatePreview block={blockItem} />
                                                                            </button>
                                                                        </TooltipTrigger>
                                                                    <TooltipContent 
                                                                        side="right" 
                                                                        sideOffset={12} 
                                                                        className="p-3 max-w-[280px] space-y-1 rounded-xl bg-slate-950 border border-slate-800 text-white shadow-2xl select-none z-50 text-left animate-in fade-in slide-in-from-left-2 duration-150"
                                                                    >
                                                                        <p className="text-xs font-black text-white tracking-tight">{tpl.name}</p>
                                                                        <p className="text-[10px] font-medium text-slate-400 leading-relaxed">{tpl.description}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            );
                                                            })}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* Email Architect Card */}
                                                        <div className="bg-card border rounded-xl p-3 mb-4 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                                                                    <Sparkles className="h-3.5 w-3.5 text-blue-500 animate-pulse" /> Email Architect (AI)
                                                                </span>
                                                                {lastBlocksBackup && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleUndoArchitect}
                                                                        className="text-[9px] font-black text-red-500 hover:text-red-600 bg-red-55/10 hover:bg-red-55/20 px-2 py-0.5 rounded transition-colors"
                                                                    >
                                                                        Undo
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <textarea
                                                                value={architectPrompt}
                                                                onChange={(e) => setArchitectPrompt(e.target.value)}
                                                                placeholder="Describe the email sections or layout details..."
                                                                className="w-full text-xs bg-muted/40 border rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/20"
                                                                rows={2}
                                                            />
                                                            <div className="space-y-1.5">
                                                                <input
                                                                    type="text"
                                                                    value={architectImageUrl}
                                                                    onChange={(e) => setArchitectImageUrl(e.target.value)}
                                                                    placeholder="Paste public image URL..."
                                                                    className="w-full text-[10px] bg-muted/40 border rounded-lg px-2 py-1.5 focus:outline-none"
                                                                />
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        id="architect-file"
                                                                        className="hidden"
                                                                        onChange={async (e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file && activeWorkspaceId) {
                                                                                setIsUploadingImage(true);
                                                                                try {
                                                                                    const url = await uploadArchitectImage(file, activeWorkspaceId);
                                                                                    setArchitectImageUrl(url);
                                                                                    e.target.value = '';
                                                                                } catch (err: unknown) {
                                                                                    const msg = err instanceof Error ? err.message : 'Upload error';
                                                                                    toast({ title: 'Upload Failed', description: msg, variant: 'destructive' });
                                                                                } finally {
                                                                                    setIsUploadingImage(false);
                                                                                }
                                                                            }
                                                                        }}
                                                                    />
                                                                    <label
                                                                        htmlFor="architect-file"
                                                                        className="flex-1 flex items-center justify-center gap-1 cursor-pointer bg-muted hover:bg-muted-foreground/15 text-[9px] font-semibold py-1.5 px-3 rounded-lg border text-muted-foreground transition-all"
                                                                    >
                                                                        <Upload className="h-3 w-3" /> {isUploadingImage ? 'Uploading...' : 'Upload Image'}
                                                                    </label>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-[9px] font-semibold text-muted-foreground">
                                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                                    <input
                                                                        type="radio"
                                                                        name="architectMode"
                                                                        checked={architectMode === 'layout_analysis'}
                                                                        onChange={() => setArchitectMode('layout_analysis')}
                                                                    />
                                                                    Analyze Mockup
                                                                </label>
                                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                                    <input
                                                                        type="radio"
                                                                        name="architectMode"
                                                                        checked={architectMode === 'direct_placement'}
                                                                        onChange={() => setArchitectMode('direct_placement')}
                                                                    />
                                                                    Insert Image
                                                                </label>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                className="w-full h-8 text-[10px] font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                                                                onClick={handleArchitectSubmit}
                                                                disabled={isArchitecting || isUploadingImage}
                                                            >
                                                                {isArchitecting ? (
                                                                    <>
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Designing...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Sparkles className="h-3 w-3" /> Architect Email
                                                                    </>
                                                                )}
                                                            </Button>
                                                        </div>

                                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-left mb-2 animate-in fade-in duration-200">Block Types</p>
                                                        <div className="grid grid-cols-2 gap-2.5 animate-in slide-in-from-bottom-2 duration-250">
                                                            {(Object.keys(blockIcons) as Array<keyof typeof blockIcons>)
                                                                .map(type => {
                                                                    const BIcon = blockIcons[type];
                                                                    return (
                                                                        <button
                                                                            key={type}
                                                                            type="button"
                                                                            onClick={() => setActiveBlockSubView(type)}
                                                                            className="flex flex-col items-center justify-center p-3 rounded-xl border bg-card hover:bg-muted/10 hover:border-primary/20 transition-all text-center aspect-[1.1]"
                                                                        >
                                                                            <BIcon className="h-4.5 w-4.5 text-muted-foreground mb-1.5 shrink-0" />
                                                                            <span className="text-[9px] font-semibold capitalize">{type === 'score-card' ? 'Score Card' : type}</span>
                                                                        </button>
                                                                    );
                                                                })}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {sidebarTab === 'variables' && (
                                            <div className="absolute inset-0 flex flex-col overflow-hidden bg-muted/5">
                                                {/* Variable Header & Actions */}
                                                <div className="px-4 py-3 border-b border-border/60 shrink-0 bg-background/50 backdrop-blur-sm space-y-2.5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-left">
                                                            <h4 className="text-xs font-bold text-foreground">Variable Registry</h4>
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">Insert variables into template blocks</p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setIsAddVarOpen(true)}
                                                            className="h-8 rounded-lg font-bold text-[10px] gap-1 px-2 border-primary/20 hover:bg-primary/5 hover:text-primary text-primary"
                                                        >
                                                            <PlusCircle className="h-3.5 w-3.5" /> Add Custom
                                                        </Button>
                                                    </div>
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                                        <Input
                                                            placeholder="Search registry..."
                                                            value={variableSearchQuery}
                                                            onChange={(e) => setVariableSearchQuery(e.target.value)}
                                                            className="h-8 pl-8 text-xs rounded-lg bg-background/80 border-border/60 placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/20 w-full"
                                                        />
                                                    </div>
                                                </div>

                                                <ScrollArea className="flex-1">
                                                    <div className="p-3 text-left">
                                                        {(() => {
                                                            const q = variableSearchQuery.toLowerCase().trim();
                                                            const matchVar = (v: VariableDefinition) => !q || v.key.toLowerCase().includes(q) || v.label.toLowerCase().includes(q);

                                                            // Segregated categories
                                                            const brandingVars = contactVarGroups.other.filter(matchVar);
                                                            const primaryContacts = contactVarGroups.primary.filter(matchVar);
                                                            const signatoryContacts = contactVarGroups.signatory.filter(matchVar);
                                                            const roleContacts = contactVarGroups.roles.filter(matchVar);
                                                            const entityFieldVars = filteredVars.filter(v => v.source === 'entity_fields').filter(matchVar);
                                                            const featureVars = featureSpecificVars.filter(matchVar);
                                                            const customVars = contactVarGroups.custom.filter(matchVar);

                                                            const filteredSurveyGroups = category === 'surveys' ? surveyGroups.map(grp => ({
                                                                ...grp,
                                                                variables: grp.variables.filter(matchVar)
                                                            })).filter(grp => grp.variables.length > 0) : [];

                                                            const filteredPdfGroups = (category === 'forms' || category === 'agreements') ? pdfGroups.map(grp => ({
                                                                ...grp,
                                                                variables: grp.variables.filter(matchVar)
                                                            })).filter(grp => grp.variables.length > 0) : [];

                                                            const totalResults = brandingVars.length
                                                                + primaryContacts.length
                                                                + signatoryContacts.length
                                                                + roleContacts.length
                                                                + entityFieldVars.length
                                                                + featureVars.length
                                                                + customVars.length
                                                                + filteredSurveyGroups.reduce((s, g) => s + g.variables.length, 0)
                                                                + filteredPdfGroups.reduce((s, g) => s + g.variables.length, 0);

                                                            if (q && totalResults === 0) {
                                                                return (
                                                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                                                        <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
                                                                        <p className="text-xs font-semibold text-muted-foreground">No variables found</p>
                                                                        <p className="text-[10px] text-muted-foreground/60 mt-1">Try a different search term</p>
                                                                    </div>
                                                                );
                                                            }

                                                            const renderVarButton = (v: VariableDefinition, highlightColorClass = 'text-primary') => (
                                                                <button
                                                                    key={v.key}
                                                                    type="button"
                                                                    onClick={() => handleVariableInsert(v.key)}
                                                                    className="w-full flex items-center justify-between p-2 rounded-xl border border-border/40 bg-card hover:bg-primary/5 hover:border-primary/20 text-left transition-all group shadow-sm mb-1.5"
                                                                >
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-[10px] font-bold truncate text-foreground/90">{v.label}</p>
                                                                        <p className={cn("text-[8px] font-mono truncate leading-none mt-0.5 font-semibold", highlightColorClass)}>{`{{${v.key}}}`}</p>
                                                                    </div>
                                                                    <PlusCircle className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-2" />
                                                                </button>
                                                            );

                                                            return (
                                                                <Accordion type="multiple" value={accordionValue} onValueChange={setAccordionValue} className="space-y-2">
                                                                    
                                                                    {/* System Branding & Constants */}
                                                                    {brandingVars.length > 0 && (
                                                                        <AccordionItem value="branding" className="border rounded-2xl bg-card overflow-hidden px-4 shadow-sm border-border/50">
                                                                            <AccordionTrigger className="hover:no-underline py-3 text-xs font-bold text-foreground">
                                                                                <span className="flex items-center gap-2">Branding & Constants <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3.5 font-bold uppercase tracking-wider">{brandingVars.length}</Badge></span>
                                                                            </AccordionTrigger>
                                                                            <AccordionContent className="pt-1 pb-3">
                                                                                <div className="space-y-1">
                                                                                    {brandingVars.map(v => renderVarButton(v, 'text-orange-500'))}
                                                                                </div>
                                                                            </AccordionContent>
                                                                        </AccordionItem>
                                                                    )}

                                                                    {/* Primary Contacts */}
                                                                    {primaryContacts.length > 0 && (
                                                                        <AccordionItem value="primary_contacts" className="border rounded-2xl bg-card overflow-hidden px-4 shadow-sm border-border/50">
                                                                            <AccordionTrigger className="hover:no-underline py-3 text-xs font-bold text-foreground">
                                                                                <span className="flex items-center gap-2">Primary Contacts <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3.5 font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 border-blue-500/20">{primaryContacts.length}</Badge></span>
                                                                            </AccordionTrigger>
                                                                            <AccordionContent className="pt-1 pb-3">
                                                                                <div className="space-y-1">
                                                                                    {primaryContacts.map(v => renderVarButton(v, 'text-blue-600'))}
                                                                                </div>
                                                                            </AccordionContent>
                                                                        </AccordionItem>
                                                                    )}

                                                                    {/* Signatory Contacts */}
                                                                    {signatoryContacts.length > 0 && (
                                                                        <AccordionItem value="signatory_contacts" className="border rounded-2xl bg-card overflow-hidden px-4 shadow-sm border-border/50">
                                                                            <AccordionTrigger className="hover:no-underline py-3 text-xs font-bold text-foreground">
                                                                                <span className="flex items-center gap-2">Signatory Contacts <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3.5 font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 border-purple-500/20">{signatoryContacts.length}</Badge></span>
                                                                            </AccordionTrigger>
                                                                            <AccordionContent className="pt-1 pb-3">
                                                                                <div className="space-y-1">
                                                                                    {signatoryContacts.map(v => renderVarButton(v, 'text-purple-600'))}
                                                                                </div>
                                                                            </AccordionContent>
                                                                        </AccordionItem>
                                                                    )}

                                                                    {/* Role-based Contacts */}
                                                                    {roleContacts.length > 0 && (
                                                                        <AccordionItem value="roles_contacts" className="border rounded-2xl bg-card overflow-hidden px-4 shadow-sm border-border/50">
                                                                            <AccordionTrigger className="hover:no-underline py-3 text-xs font-bold text-foreground">
                                                                                <span className="flex items-center gap-2">Role-based Contacts <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3.5 font-bold uppercase tracking-wider bg-pink-500/10 text-pink-600 border-pink-500/20">{roleContacts.length}</Badge></span>
                                                                            </AccordionTrigger>
                                                                            <AccordionContent className="pt-1 pb-3">
                                                                                <div className="space-y-1">
                                                                                    {roleContacts.map(v => renderVarButton(v, 'text-pink-600'))}
                                                                                </div>
                                                                            </AccordionContent>
                                                                        </AccordionItem>
                                                                    )}

                                                                    {/* Entity Fields */}
                                                                    {entityFieldVars.length > 0 && (
                                                                        <AccordionItem value="entity_fields" className="border rounded-2xl bg-card overflow-hidden px-4 shadow-sm border-border/50">
                                                                            <AccordionTrigger className="hover:no-underline py-3 text-xs font-bold text-foreground">
                                                                                <span className="flex items-center gap-2">Entity Fields <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3.5 font-bold uppercase tracking-wider bg-sky-500/10 text-sky-600 border-sky-500/20">{entityFieldVars.length}</Badge></span>
                                                                            </AccordionTrigger>
                                                                            <AccordionContent className="pt-1 pb-3">
                                                                                <div className="space-y-1">
                                                                                    {entityFieldVars.map(v => renderVarButton(v, 'text-sky-600'))}
                                                                                </div>
                                                                            </AccordionContent>
                                                                        </AccordionItem>
                                                                    )}

                                                                    {/* Feature Specific Variables */}
                                                                    {featureVars.length > 0 && (
                                                                        <AccordionItem value="feature_vars" className="border rounded-2xl bg-card overflow-hidden px-4 shadow-sm border-border/50">
                                                                            <AccordionTrigger className="hover:no-underline py-3 text-xs font-bold text-foreground">
                                                                                <span className="flex items-center gap-2">Feature-Specific <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3.5 font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 border-indigo-500/20">{featureVars.length}</Badge></span>
                                                                            </AccordionTrigger>
                                                                            <AccordionContent className="pt-1 pb-3">
                                                                                <div className="space-y-1">
                                                                                    {featureVars.map(v => renderVarButton(v, 'text-indigo-600'))}
                                                                                </div>
                                                                            </AccordionContent>
                                                                        </AccordionItem>
                                                                    )}

                                                                    {/* Surveys Answers collapsible list */}
                                                                    {filteredSurveyGroups.length > 0 && (
                                                                        <AccordionItem value="surveys" className="border rounded-2xl bg-card overflow-hidden px-4 shadow-sm border-border/50">
                                                                            <AccordionTrigger className="hover:no-underline py-3 text-xs font-bold text-foreground">
                                                                                <span className="flex items-center gap-2">Surveys Answers <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3.5 font-bold uppercase tracking-wider bg-teal-500/10 text-teal-600 border-teal-500/20">{filteredSurveyGroups.reduce((a, c) => a + c.variables.length, 0)}</Badge></span>
                                                                            </AccordionTrigger>
                                                                            <AccordionContent className="pt-1 pb-3 space-y-3">
                                                                                {filteredSurveyGroups.map(grp => (
                                                                                    <div key={grp.id} className="space-y-1.5 p-2.5 bg-muted/40 rounded-xl border border-border/50">
                                                                                        <p className="text-[9px] font-extrabold text-foreground/80 tracking-wide uppercase px-1">{grp.title}</p>
                                                                                        <div className="space-y-1">
                                                                                            {grp.variables.map(v => renderVarButton(v, 'text-teal-600'))}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </AccordionContent>
                                                                        </AccordionItem>
                                                                    )}

                                                                    {/* Forms/PDFs Fields collapsible list */}
                                                                    {filteredPdfGroups.length > 0 && (
                                                                        <AccordionItem value="forms" className="border rounded-2xl bg-card overflow-hidden px-4 shadow-sm border-border/50">
                                                                            <AccordionTrigger className="hover:no-underline py-3 text-xs font-bold text-foreground">
                                                                                <span className="flex items-center gap-2">Forms Fields <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3.5 font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 border-rose-500/20">{filteredPdfGroups.reduce((a, c) => a + c.variables.length, 0)}</Badge></span>
                                                                            </AccordionTrigger>
                                                                            <AccordionContent className="pt-1 pb-3 space-y-3">
                                                                                {filteredPdfGroups.map(grp => (
                                                                                    <div key={grp.id} className="space-y-1.5 p-2.5 bg-muted/40 rounded-xl border border-border/50">
                                                                                        <p className="text-[9px] font-extrabold text-foreground/80 tracking-wide uppercase px-1">{grp.title}</p>
                                                                                        <div className="space-y-1">
                                                                                            {grp.variables.map(v => renderVarButton(v, 'text-rose-600'))}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </AccordionContent>
                                                                        </AccordionItem>
                                                                    )}

                                                                    {/* Workspace Custom Variables */}
                                                                    {customVars.length > 0 && (
                                                                        <AccordionItem value="custom_vars" className="border rounded-2xl bg-card overflow-hidden px-4 shadow-sm border-border/50">
                                                                            <AccordionTrigger className="hover:no-underline py-3 text-xs font-bold text-foreground">
                                                                                <span className="flex items-center gap-2">Custom Variables <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3.5 font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{customVars.length}</Badge></span>
                                                                            </AccordionTrigger>
                                                                            <AccordionContent className="pt-1 pb-3">
                                                                                <div className="space-y-1">
                                                                                    {customVars.map(v => renderVarButton(v, 'text-emerald-600'))}
                                                                                </div>
                                                                            </AccordionContent>
                                                                        </AccordionItem>
                                                                    )}
                                                                </Accordion>
                                                            );
                                                        })()}
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
                                    </div>
                                </Tabs>

                                <div className="absolute bottom-0 right-[-10px] top-0 w-2.5 cursor-col-resize z-50 hover:bg-primary/20 active:bg-primary/45 transition-colors" onMouseDown={handleMouseDown} />
                            </div>

                            <div 
                                className={cn(
                                    "flex-1 flex flex-col overflow-hidden relative",
                                    !isResizing && "transition-all duration-500",
                                    isResizing && "pointer-events-none select-none"
                                )}
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
                                                        <SelectItem value="default" className="rounded-lg text-xs font-semibold">
                                                            Use Default Style
                                                        </SelectItem>
                                                        <SelectItem value="none" className="rounded-lg text-xs font-semibold text-muted-foreground">
                                                            No Wrapper
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

                                            {simEntity === 'School' ? (
                                                <EntityCombobox
                                                    value={simRecordId}
                                                    onChange={setSimRecordId}
                                                    valueKey="id"
                                                    noneLabel="Select..."
                                                    noneValue="none"
                                                    placeholder="Record..."
                                                    className="h-8 w-[130px] text-[10px]"
                                                />
                                            ) : simEntity !== 'none' && (
                                                <Select value={simRecordId} onValueChange={setSimRecordId}>
                                                    <SelectTrigger className="h-8 w-[130px] rounded-lg text-[10px] bg-background border shadow-sm animate-in slide-in-from-left-2 duration-200">
                                                        <SelectValue placeholder="Record..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="none" className="rounded-lg text-xs">Select...</SelectItem>
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
                                        {/* Subject & Preview Text (Email Only) — with variable insertion support */}
                                        {channel === 'email' && (
                                            <div className="mb-6 space-y-3 rounded-2xl border border-border/60 bg-card/50 p-4 shadow-sm backdrop-blur-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <MailIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Email Header</span>
                                                    </div>
                                                    {subjectOptions && subjectOptions.length > 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setIsAlternativesOpen(true)}
                                                            className="h-6 rounded-lg text-[10px] font-bold gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 active:scale-95 transition-all"
                                                        >
                                                            <Sparkles className="h-3 w-3 animate-pulse text-blue-500" />
                                                            View AI Suggestions
                                                        </Button>
                                                    )}
                                                </div>
                                                {/* Subject Line */}
                                                <div className="space-y-1.5 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-0.5">Subject Line</Label>
                                                        <span className={cn(
                                                            "text-[9px] font-semibold transition-colors",
                                                            subject.length > 50 ? "text-amber-500" : "text-muted-foreground/50"
                                                        )}>
                                                            {subject.length} / 50 characters
                                                        </span>
                                                    </div>
                                                    <div className="relative group">
                                                        <SlashInput
                                                            value={subject}
                                                            onChange={handleSubjectChange}
                                                            variables={autocompleteVariables}
                                                            placeholder="Enter email subject line — supports {{variables}}"
                                                            className="h-10 pr-9 rounded-xl bg-background border border-border shadow-sm focus:ring-1 focus:ring-primary/20 transition-all font-semibold text-sm font-mono"
                                                            autoComplete="off"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const el = document.querySelector<HTMLInputElement>('input[placeholder*="subject line"]');
                                                                if (el) el.focus();
                                                                setSidebarTab('variables');
                                                            }}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-60 group-hover:opacity-100"
                                                            title="Insert Variable — focus this field then click a variable in the sidebar"
                                                        >
                                                            <Database className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {/* Preview Text */}
                                                <div className="space-y-1.5 text-left">
                                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-0.5">Preview Text</Label>
                                                    <div className="relative group">
                                                        <SlashInput
                                                            value={previewText}
                                                            onChange={handlePreviewTextChange}
                                                            variables={autocompleteVariables}
                                                            placeholder="Enter email preview text — supports {{variables}}"
                                                            className="h-10 pr-9 rounded-xl bg-background border border-border shadow-sm focus:ring-1 focus:ring-primary/20 transition-all text-sm font-mono"
                                                            autoComplete="off"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const el = document.querySelector<HTMLInputElement>('input[placeholder*="preview text"]');
                                                                if (el) el.focus();
                                                                setSidebarTab('variables');
                                                            }}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-60 group-hover:opacity-100"
                                                            title="Insert Variable — focus this field then click a variable in the sidebar"
                                                        >
                                                            <Database className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-[9px] text-muted-foreground/60 ml-0.5">Focus a field above, then click any variable in the sidebar to insert it at the cursor position.</p>
                                            </div>
                                        )}
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
                                                    <DndContext sensors={sensors} collisionDetection={customCollisionDetection} onDragEnd={handleDragEnd}>
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
                                                                        autocompleteVariables={autocompleteVariables}
                                                                        onSelect={() => { setSelectedBlockId(block.id); setSidebarTab('blocks'); }}
                                                                        onRemove={() => { setBlocks(prev => removeBlockRecursively(prev, block.id)); if (selectedBlockId === block.id) setSelectedBlockId(null); }}
                                                                        onDuplicate={() => { setBlocks(prev => duplicateBlockRecursively(prev, block.id)); }}
                                                                        onSwap={(a, b) => setBlocks(p => swapBlocksRecursively(p, block.id, b < a ? 'up' : 'down'))}
                                                                        totalCount={blocks.length}
                                                                        onUpdate={u => setBlocks(p => updateBlockRecursively(p, block.id, u))}
                                                                        selectedSubBlockId={selectedBlockId}
                                                                        onSelectSubBlock={(subId) => { setSelectedBlockId(subId); setSidebarTab('blocks'); }}
                                                                        onRemoveSubBlock={(parentBlockId, colIdx, subBlockId) => { setBlocks(prev => removeBlockRecursively(prev, subBlockId)); if (selectedBlockId === subBlockId) setSelectedBlockId(null); }}
                                                                        onDuplicateSubBlock={(parentBlockId, colIdx, subBlockId) => setBlocks(prev => duplicateBlockRecursively(prev, subBlockId))}
                                                                        onSwapSubBlocks={handleSwapSubBlocks}
                                                                        onUpdateSubBlock={(subBlockId, updates) => setBlocks(prev => updateBlockRecursively(prev, subBlockId, updates))}
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

                            {/* Right properties panel (only for Visual Blocks builder) */}
                            {contentMode === 'rich_builder' && (
                                <div className="border-l bg-background flex flex-col shrink-0 w-[340px] shadow-xl text-left select-text h-full overflow-hidden">
                                    {/* Tabs Header Switcher */}
                                    <div className="border-b bg-background shrink-0 flex">
                                        <button
                                            type="button"
                                            onClick={() => setRightPanelTab('properties')}
                                            className={cn(
                                                "flex-1 py-3 text-center text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5",
                                                rightPanelTab === 'properties'
                                                    ? "border-blue-600 text-blue-600 bg-blue-50/5 font-extrabold"
                                                    : "border-transparent text-muted-foreground hover:text-foreground bg-transparent"
                                            )}
                                        >
                                            <Settings2 className="h-3.5 w-3.5" /> Properties
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRightPanelTab('layers')}
                                            className={cn(
                                                "flex-1 py-3 text-center text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5",
                                                rightPanelTab === 'layers'
                                                    ? "border-blue-600 text-blue-600 bg-blue-50/5 font-extrabold"
                                                    : "border-transparent text-muted-foreground hover:text-foreground bg-transparent"
                                            )}
                                        >
                                            <Layout className="h-3.5 w-3.5" /> Layers
                                        </button>
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto p-4">
                                        {rightPanelTab === 'properties' ? (
                                            selectedBlockId ? (
                                                <BlockInspector
                                                    block={findBlockRecursively(blocks, selectedBlockId)!}
                                                    variables={variables}
                                                    templateCategory={category}
                                                    onUpdate={u => setBlocks(p => updateBlockRecursively(p, selectedBlockId, u))}
                                                />
                                            ) : (
                                                <div className="py-20 text-center opacity-30 animate-in fade-in duration-200">
                                                    <Layout className="h-8 w-8 mx-auto mb-2" />
                                                    <p className="text-[10px] font-semibold leading-relaxed">
                                                        Select a block on the canvas<br />to edit properties
                                                    </p>
                                                </div>
                                            )
                                        ) : (
                                            <div className="animate-in fade-in duration-200">
                                                {renderSidebarBlockOutline()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {step === 3 && (
                        <SimulationStudio
                            template={{
                                ...(initialTemplate || {}),
                                subject,
                                previewText,
                                body,
                                blocks
                            } as any}
                            simVariables={simVariables}
                            isSimLoading={isSimLoading}
                            simEntity={simEntity} setSimEntity={setSimEntity}
                            simRecordId={simRecordId} setSimRecordId={setSimRecordId}
                            meetings={meetings} surveys={surveys} pdfs={pdfs}
                            resolvedPreview={(tmpl, vars, isDark) => {
                                const activeStyle = styleId !== 'none'
                                    ? (styleId === 'default' || !styleId ? styles.find(s => s.isDefault) : styles.find(s => s.id === styleId))
                                    : null;
                                const effectiveMode = channel === 'sms' ? 'plain_text' : contentMode;
                                
                                const styleWrapper = activeStyle
                                    ? (target === 'internal_team'
                                        ? (activeStyle.htmlWrapperInternal ?? activeStyle.htmlWrapper ?? '')
                                        : (activeStyle.htmlWrapperExternal ?? activeStyle.htmlWrapper ?? ''))
                                    : '';

                                if (effectiveMode === 'rich_builder') {
                                    return renderBlocksToHtml(blocks, vars, { 
                                        wrapper: styleWrapper || undefined, 
                                        style: activeStyle || undefined, 
                                        isDark 
                                    });
                                }
                                let resolved = resolveVariables(body, vars);
                                if (effectiveMode === 'plain_text' && channel === 'email') {
                                    resolved = resolved.replace(/\n/g, '<br>\n');
                                }
                                if (styleWrapper && styleWrapper.includes('{{content}}')) {
                                    resolved = resolveVariables(styleWrapper, vars).replace('{{content}}', resolved);
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

            {/* Subject Line & Preview Text AI Alternatives Picker */}
            <Dialog open={isAlternativesOpen} onOpenChange={setIsAlternativesOpen}>
                <DialogContent className="max-w-2xl rounded-2xl p-6 bg-card border shadow-xl animate-in fade-in zoom-in-95 duration-200">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                            <Sparkles className="h-5 w-5 text-blue-500 animate-pulse" />
                            AI Subject Suggestions
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Optimize your email open rates. Compare and apply high-converting AI alternatives or stick to your manual copy.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 my-4 max-h-[450px] overflow-y-auto pr-1">
                        {/* Option 0: Current Manual Copy */}
                        <motion.div
                            whileHover={{ y: -2, scale: 1.005 }}
                            whileTap={{ scale: 0.995 }}
                            onClick={() => {
                                setSubject(manualSubject);
                                setPreviewText(manualPreviewText);
                                setActiveOptionIndex(null);
                                setIsAlternativesOpen(false);
                                toast({ title: 'Manual Version Applied', description: 'Restored your original manual copy.' });
                            }}
                            className={cn(
                                "p-4 rounded-2xl border cursor-pointer text-left transition-all duration-200 select-none",
                                activeOptionIndex === null
                                    ? "border-blue-600 bg-blue-500/[0.02] shadow-md"
                                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/10"
                            )}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Original / Manual Copy</span>
                                {activeOptionIndex === null ? (
                                    <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Check className="h-2.5 w-2.5" /> Active
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-semibold text-muted-foreground/60">Click to apply</span>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <div className="text-sm font-bold text-foreground">
                                    {manualSubject || <span className="text-muted-foreground/40 italic">Empty Subject Line</span>}
                                </div>
                                <div className="text-xs text-muted-foreground font-medium">
                                    {manualPreviewText || <span className="text-muted-foreground/30 italic">Empty Preview Text</span>}
                                </div>
                            </div>
                        </motion.div>

                        {/* AI Option 1 */}
                        {subjectOptions && subjectOptions[0] && (
                            <motion.div
                                whileHover={{ y: -2, scale: 1.005 }}
                                whileTap={{ scale: 0.995 }}
                                onClick={() => {
                                    setSubject(subjectOptions[0].subject);
                                    setPreviewText(subjectOptions[0].previewText);
                                    setActiveOptionIndex(0);
                                    setIsAlternativesOpen(false);
                                    toast({ title: 'AI Suggestion 1 Applied', description: 'Subject line and preview text updated.' });
                                }}
                                className={cn(
                                    "p-4 rounded-2xl border cursor-pointer text-left transition-all duration-200 select-none",
                                    activeOptionIndex === 0
                                        ? "border-blue-600 bg-blue-500/[0.02] shadow-md"
                                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/10"
                                )}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">AI Alternative 1</span>
                                        {subjectOptions[0].subject.length <= 50 && (
                                            <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded">
                                                Mobile Ready
                                            </span>
                                        )}
                                    </div>
                                    {activeOptionIndex === 0 ? (
                                        <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <Check className="h-2.5 w-2.5" /> Active
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-semibold text-muted-foreground/60">Click to apply • {subjectOptions[0].subject.length} chars</span>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <div className="text-sm font-bold text-foreground">{subjectOptions[0].subject}</div>
                                    <div className="text-xs text-muted-foreground font-medium">{subjectOptions[0].previewText}</div>
                                </div>
                            </motion.div>
                        )}

                        {/* AI Option 2 */}
                        {subjectOptions && subjectOptions[1] && (
                            <motion.div
                                whileHover={{ y: -2, scale: 1.005 }}
                                whileTap={{ scale: 0.995 }}
                                onClick={() => {
                                    setSubject(subjectOptions[1].subject);
                                    setPreviewText(subjectOptions[1].previewText);
                                    setActiveOptionIndex(1);
                                    setIsAlternativesOpen(false);
                                    toast({ title: 'AI Suggestion 2 Applied', description: 'Subject line and preview text updated.' });
                                }}
                                className={cn(
                                    "p-4 rounded-2xl border cursor-pointer text-left transition-all duration-200 select-none",
                                    activeOptionIndex === 1
                                        ? "border-blue-600 bg-blue-500/[0.02] shadow-md"
                                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/10"
                                )}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">AI Alternative 2</span>
                                        {subjectOptions[1].subject.length <= 50 && (
                                            <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded">
                                                Mobile Ready
                                            </span>
                                        )}
                                    </div>
                                    {activeOptionIndex === 1 ? (
                                        <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <Check className="h-2.5 w-2.5" /> Active
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-semibold text-muted-foreground/60">Click to apply • {subjectOptions[1].subject.length} chars</span>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <div className="text-sm font-bold text-foreground">{subjectOptions[1].subject}</div>
                                    <div className="text-xs text-muted-foreground font-medium">{subjectOptions[1].previewText}</div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create Custom Variable Dialog */}
            <Dialog open={isAddVarOpen} onOpenChange={setIsAddVarOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl bg-card border shadow-xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-foreground">Add Custom Variable</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Create a custom variable to capture and reuse dynamic parameters.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateVariable} className="space-y-4 text-left">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">Display Label</Label>
                            <Input
                                placeholder="e.g., Client Anniversary"
                                value={varForm.label}
                                onChange={e => {
                                    const label = e.target.value;
                                    const variableName = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
                                    setVarForm(prev => ({ ...prev, label, variableName }));
                                }}
                                required
                                className="h-10 rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">Variable Key (Insert Code)</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground/60">{"{{"}</span>
                                <Input
                                    placeholder="client_anniversary"
                                    value={varForm.variableName}
                                    onChange={e => setVarForm(prev => ({ ...prev, variableName: e.target.value }))}
                                    required
                                    className="pl-8 pr-8 font-mono text-xs h-10 rounded-xl"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground/60">{"}}"}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Variable Type</Label>
                                <Select
                                    value={varForm.type}
                                    onValueChange={v => setVarForm(prev => ({ ...prev, type: v as any }))}
                                >
                                    <SelectTrigger className="h-10 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="short_text">Short Text</SelectItem>
                                        <SelectItem value="long_text">Paragraph</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                        <SelectItem value="date">Date</SelectItem>
                                        <SelectItem value="yes_no">Boolean (Yes/No)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Scope</Label>
                                <Select
                                    value={varForm.scope}
                                    onValueChange={v => setVarForm(prev => ({ ...prev, scope: v as any }))}
                                >
                                    <SelectTrigger className="h-10 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="common">Common (All)</SelectItem>
                                        <SelectItem value="person">Person</SelectItem>
                                        <SelectItem value="institution">Institution</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">Default Fallback (Optional)</Label>
                            <Input
                                placeholder="e.g., N/A"
                                value={varForm.defaultValue}
                                onChange={e => setVarForm(prev => ({ ...prev, defaultValue: e.target.value }))}
                                className="h-10 rounded-xl"
                            />
                        </div>
                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsAddVarOpen(false)} className="rounded-xl font-semibold h-10">
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isCreatingVar} className="rounded-xl font-bold h-10 gap-2">
                                {isCreatingVar && <Loader2 className="h-4 w-4 animate-spin" />} Create Variable
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
        </TooltipProvider>
    );
}
