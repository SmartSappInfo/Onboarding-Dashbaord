
'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, where, getDocs, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { MessageTemplate, MessageBlock, VariableDefinition, School, Meeting, Survey, PDFForm } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
    FileType, Plus, Trash2, Mail, Smartphone, X, Loader2, ArrowLeft, ArrowRight,
    Code, Eye, Sparkles, Check, Pencil, Database, Zap, Trophy, 
    MonitorPlay, Layout, Wand2, Info, Copy, GripVertical, 
    Heading1, Type, Image as ImageIcon, Video, MousePointer2, Quote, 
    Square, List, ListOrdered, ArrowUp, ArrowDown, AlignLeft, 
    AlignCenter, AlignRight, Save, Search,
    Settings2, ChevronRight, Monitor, Smartphone as PhoneIcon,
    Maximize2, Minimize2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { resolveVariables, renderBlocksToHtml, shouldShowBlock } from '@/lib/messaging-utils';
import { format } from 'date-fns';
import { fetchContextualData } from '@/lib/messaging-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { SmartSappIcon } from '@/components/icons';

const blockIcons: Record<string, React.ElementType> = {
    heading: Heading1,
    text: Type,
    list: List,
    image: ImageIcon,
    video: Video,
    button: MousePointer2,
    quote: Quote,
    divider: Square,
    header: Layout,
    footer: Layout,
    logo: Zap,
    'score-card': Trophy,
};

// --- SUB-COMPONENTS ---

function BlockInspector({ 
    block, 
    variables, 
    onChange 
}: { 
    block: MessageBlock, 
    variables: VariableDefinition[], 
    onChange: (props: Partial<MessageBlock>) => void 
}) {
    const isTextType = ['text', 'heading', 'quote', 'button', 'header', 'footer'].includes(block.type);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid gap-4">
                {block.type === 'heading' && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Heading Title</Label>
                        <Input 
                            value={block.title || ''} 
                            onChange={e => onChange({ title: e.target.value })} 
                            className="font-bold text-lg border-none shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent" 
                        />
                        <div className="flex gap-2">
                            {(['h1', 'h2', 'h3'] as const).map(v => (
                                <Button 
                                    key={v}
                                    type="button"
                                    size="sm"
                                    variant={block.variant === v ? 'secondary' : 'ghost'}
                                    className="h-7 text-[10px] uppercase font-black"
                                    onClick={() => onChange({ variant: v })}
                                >
                                    {v}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {(block.type === 'text' || block.type === 'quote') && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{block.type === 'quote' ? 'Quote' : 'Paragraph'} Content</Label>
                        <Textarea 
                            value={block.content || ''} 
                            onChange={e => onChange({ content: e.target.value })}
                            className={cn(
                                "min-h-[120px] text-base border-none shadow-none focus-visible:ring-0 p-0 bg-transparent leading-relaxed",
                                block.type === 'quote' && "italic"
                            )} 
                        />
                    </div>
                )}

                {block.type === 'button' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Label</Label>
                            <Input value={block.title || ''} onChange={e => onChange({ title: e.target.value })} placeholder="Click Me" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Action Link</Label>
                            <Input value={block.link || ''} onChange={e => onChange({ link: e.target.value })} placeholder="https://..." />
                        </div>
                    </div>
                )}

                {isTextType && (
                    <div className="pt-4 border-t border-dashed">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 block">Alignment</Label>
                        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit border shadow-inner">
                            {(['left', 'center', 'right'] as const).map(a => (
                                <Button 
                                    key={a}
                                    type="button" 
                                    variant={block.style?.textAlign === a ? 'secondary' : 'ghost'} 
                                    size="icon" 
                                    className="h-8 w-8 rounded-lg" 
                                    onClick={() => onChange({ style: { ...block.style, textAlign: a } })}
                                >
                                    {a === 'left' ? <AlignLeft className="h-4 w-4" /> : a === 'center' ? <AlignCenter className="h-4 w-4" /> : <AlignRight className="h-4 w-4" />}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function SortableBlockItem({ 
    id, index, block, variables, simulationVars, onUpdate, onRemove, onDuplicate 
}: { 
    id: string, index: number, block: MessageBlock, variables: VariableDefinition[], simulationVars?: Record<string, any>, onUpdate: (p: Partial<MessageBlock>) => void, 
    onRemove: () => void, onDuplicate: () => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const Icon = blockIcons[block.type] || Type;

    const style = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
    };

    const hasLogic = block.visibilityLogic?.rules?.length && block.visibilityLogic.rules.length > 0;
    const isHiddenByLogic = hasLogic && simulationVars && !shouldShowBlock(block, simulationVars);

    return (
        <div ref={setNodeRef} style={style} className="relative group/block">
            <div
                {...attributes}
                {...listeners}
                className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 cursor-grab p-2 bg-background border rounded-full opacity-0 group-hover/block:opacity-100 transition-opacity shadow-lg"
            >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            
            <Card className={cn(
                "bg-card shadow-none border transition-all rounded-2xl overflow-hidden",
                hasLogic ? "border-primary/40 ring-1 ring-primary/5" : "hover:border-primary/40",
                isHiddenByLogic && "grayscale opacity-40 border-dashed border-red-200"
            )}>
                <CardHeader className="py-2 px-4 border-b bg-muted/10">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-primary/10 rounded-lg">
                                <Icon className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{block.type}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/block:opacity-100 transition-all">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4">
                    <BlockInspector block={block} variables={variables} onChange={onUpdate} />
                </CardContent>
            </Card>
        </div>
    );
}

// --- STEPPER UI ---

const Stepper = ({ currentStep, onStepClick }: { currentStep: number, onStepClick: (step: number) => void }) => {
    const steps = [
        { name: 'Configuration', icon: Settings2 },
        { name: 'Workshop', icon: Layout },
        { name: 'Simulation', icon: MonitorPlay }
    ];

    return (
        <div className="flex justify-center items-center mb-8 max-w-2xl mx-auto px-4">
            {steps.map((step, index) => {
                const stepNum = index + 1;
                const Icon = step.icon;
                const isActive = currentStep === stepNum;
                const isCompleted = currentStep > stepNum;

                return (
                    <React.Fragment key={step.name}>
                        <button 
                            type="button"
                            onClick={() => onStepClick(stepNum)}
                            className="flex flex-col items-center group outline-none"
                        >
                            <div
                                className={cn(
                                    'flex items-center justify-center w-10 h-10 rounded-2xl border-2 transition-all duration-300 shadow-sm group-hover:scale-110',
                                    isCompleted ? 'bg-primary border-primary text-primary-foreground' : 
                                    isActive ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-background border-border text-muted-foreground',
                                )}
                            >
                                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                            </div>
                            <p className={cn(
                                'mt-3 text-[10px] font-black uppercase tracking-widest transition-colors', 
                                isActive || isCompleted ? 'text-primary' : 'text-muted-foreground opacity-60 group-hover:opacity-100'
                            )}>
                                {step.name}
                            </p>
                        </button>
                        {index < steps.length - 1 && (
                            <div className="flex-1 mx-4 h-[2px] relative overflow-hidden bg-muted rounded-full">
                                <motion.div 
                                    initial={false}
                                    animate={{ width: isCompleted ? '100%' : '0%' }}
                                    className="absolute left-0 top-0 h-full bg-primary"
                                />
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

// --- MAIN PAGE ---

export default function MessageTemplatesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    
    // UI Flow State
    const [isAdding, setIsAdding] = React.useState(false);
    const [step, setStep] = React.useState(1);
    const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
    const [editorMode, setEditorMode] = React.useState<'builder' | 'code' | 'text'>('builder');
    const [isFullScreen, setIsFullScreen] = React.useState(false);

    // Resizable Sidebar State
    const [variablesWidth, setVariablesWidth] = React.useState(288); // Default w-72 (288px)
    const [isResizing, setIsResizing] = React.useState(false);

    // Template State
    const [name, setName] = React.useState('');
    const [category, setCategory] = React.useState<MessageTemplate['category']>('general');
    const [channel, setChannel] = React.useState<'sms' | 'email'>('email');
    const [subject, setSubject] = React.useState('');
    const [previewText, setPreviewText] = React.useState('');
    const [body, setBody] = React.useState('');
    const [blocks, setBlocks] = React.useState<MessageBlock[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Simulation State
    const [simEntity, setSimEntity] = React.useState<'School' | 'Meeting' | 'Survey' | 'Submission' | 'none'>('none');
    const [simRecordId, setSimRecordId] = React.useState('none');
    const [simVariables, setSimVariables] = React.useState<Record<string, any>>({});
    const [isSimLoading, setIsSimLoading] = React.useState(false);
    const [previewDevice, setPreviewDevice] = React.useState<'desktop' | 'mobile'>('desktop');

    const sensors = useSensors(useSensor(PointerSensor));

    // Data Queries
    const schoolsQuery = useMemoFirebase(() => (firestore && simEntity === 'School') ? query(collection(firestore, 'schools'), orderBy('name', 'asc')) : null, [firestore, simEntity]);
    const meetingsQuery = useMemoFirebase(() => (firestore && simEntity === 'Meeting') ? query(collection(firestore, 'meetings'), orderBy('meetingTime', 'desc')) : null, [firestore, simEntity]);
    const surveysQuery = useMemoFirebase(() => (firestore && simEntity === 'Survey') ? query(collection(firestore, 'surveys'), where('status', '==', 'published')) : null, [firestore, simEntity]);
    const pdfsQuery = useMemoFirebase(() => (firestore && simEntity === 'Submission') ? query(collection(firestore, 'pdfs'), where('status', '==', 'published')) : null, [firestore, simEntity]);

    const templatesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'message_templates'), orderBy('createdAt', 'desc')) : null, [firestore]);
    const varsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'messaging_variables')) : null, [firestore]);

    const { data: templates, isLoading: isLoadingTemplates } = useCollection<MessageTemplate>(templatesQuery);
    const { data: variables } = useCollection<VariableDefinition>(varsQuery);
    const { data: simSchools } = useCollection<School>(schoolsQuery);
    const { data: simMeetings } = useCollection<Meeting>(meetingsQuery);
    const { data: simSurveys } = useCollection<Survey>(surveysQuery);
    const { data: simPdfs } = useCollection<PDFForm>(pdfsQuery);

    // Resize Handler
    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = Math.max(200, Math.min(600, e.clientX));
            setVariablesWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // Simulation Logic
    React.useEffect(() => {
        const resolveSimData = async () => {
            if (simEntity === 'none' || simRecordId === 'none' || !firestore) {
                setSimVariables({});
                return;
            }
            setIsSimLoading(true);
            try {
                let entityType = simEntity === 'Survey' ? 'SurveyResponse' : simEntity === 'Submission' ? 'Submission' : simEntity;
                let id = simRecordId;
                let parentId = undefined;

                if (simEntity === 'Survey') {
                    const respSnap = await getDocs(query(collection(firestore, `surveys/${simRecordId}/responses`), limit(1)));
                    if (!respSnap.empty) {
                        id = respSnap.docs[0].id;
                        parentId = simRecordId;
                    }
                } else if (simEntity === 'Submission') {
                    const subSnap = await getDocs(query(collection(firestore, `pdfs/${simRecordId}/submissions`), limit(1)));
                    if (!subSnap.empty) {
                        id = subSnap.docs[0].id;
                        parentId = simRecordId;
                    }
                }

                const result = await fetchContextualData(entityType, id, parentId);
                if (result.success && result.data) {
                    const vars: Record<string, any> = { ...result.data };
                    if (simEntity === 'Meeting') {
                        vars.meeting_time = format(new Date(result.data.meetingTime), 'PPP p');
                        vars.meeting_link = result.data.meetingLink;
                        vars.meeting_type = result.data.type?.name;
                    }
                    if (simEntity === 'School') {
                        vars.school_name = result.data.name;
                        vars.contact_name = result.data.contactPerson;
                    }
                    if (simEntity === 'Survey' && result.data.answers) {
                        result.data.answers.forEach((a: any) => { vars[a.questionId] = a.value; });
                    }
                    if (simEntity === 'Submission' && result.data.formData) {
                        Object.entries(result.data.formData).forEach(([k, v]) => { vars[k] = v; });
                    }
                    setSimVariables(vars);
                }
            } catch (e) {
                console.error("Simulation failed:", e);
            } finally {
                setIsSimLoading(false);
            }
        };
        resolveSimData();
    }, [simEntity, simRecordId, firestore]);

    const handleAddBlock = (type: MessageBlock['type']) => {
        const newBlock: MessageBlock = {
            id: `blk_${Date.now()}`,
            type,
            title: type === 'heading' ? 'New Heading' : type === 'button' ? 'Action Button' : '',
            content: type === 'text' ? 'New paragraph content...' : '',
            style: { textAlign: 'left' }
        };
        setBlocks(prev => [...prev, newBlock]);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setBlocks((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleSave = async () => {
        if (!firestore || !name) return;
        setIsSubmitting(true);

        const templateData = {
            name: name.trim(),
            category,
            channel,
            subject: channel === 'email' ? subject.trim() : undefined,
            previewText: channel === 'email' ? previewText.trim() : undefined,
            body: body.trim(),
            blocks: channel === 'email' && editorMode === 'builder' ? blocks : undefined,
            isActive: true,
            updatedAt: new Date().toISOString(),
        };

        try {
            if (editingTemplate) {
                await updateDoc(doc(firestore, 'message_templates', editingTemplate.id), templateData);
            } else {
                await addDoc(collection(firestore, 'message_templates'), { ...templateData, createdAt: new Date().toISOString() });
            }
            toast({ title: 'Template Saved' });
            setIsAdding(false);
            setEditingTemplate(null);
            resetForm();
        } catch (e) {
            toast({ variant: 'destructive', title: 'Save Failed' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setName('');
        setBody('');
        setSubject('');
        setPreviewText('');
        setBlocks([]);
        setCategory('general');
        setChannel('email');
        setSimEntity('none');
        setSimRecordId('none');
        setStep(1);
        setIsFullScreen(false);
    };

    const handleEditClick = (template: MessageTemplate) => {
        setEditingTemplate(template);
        setName(template.name);
        setCategory(template.category);
        setChannel(template.channel);
        setSubject(template.subject || '');
        setPreviewText(template.previewText || '');
        setBody(template.body || '');
        setBlocks(template.blocks || []);
        setEditorMode(template.blocks?.length ? 'builder' : 'code');
        setIsAdding(true);
        setStep(1);
    };

    const handleStepClick = (target: number) => {
        if (target > step) {
            if (step === 1 && !name) {
                toast({ variant: 'destructive', title: 'Identity Required', description: 'Please provide a name for the template.' });
                return;
            }
        }
        setStep(target);
    };

    const resolvedPreview = React.useMemo(() => {
        if (channel === 'sms') return resolveVariables(body, simVariables);
        if (editorMode === 'builder' && blocks.length > 0) return renderBlocksToHtml(blocks, simVariables);
        return resolveVariables(body, simVariables);
    }, [body, blocks, simVariables, editorMode, channel]);

    const filteredTemplates = templates?.filter(t => 
        (categoryFilter === 'all' || t.category === categoryFilter) &&
        (t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.body.toLowerCase().includes(searchTerm.toLowerCase()))
    ) || [];

    const filteredVars = variables?.filter(v => v.category === 'general' || v.category === category) || [];

    const stepTransition = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { type: 'spring', damping: 25, stiffness: 200 }
    };

    return (
        <div className="h-full flex flex-col bg-muted/5 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-4 sm:p-6 flex items-center justify-between border-b bg-background shadow-sm z-20">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground uppercase">Template Studio</h1>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                        {isAdding ? (editingTemplate ? 'Editing Protocol' : 'Designing New Blueprint') : 'Institutional Template Hub'}
                    </p>
                </div>
                {!isAdding ? (
                    <Button onClick={() => { resetForm(); setIsAdding(true); }} className="rounded-xl font-black shadow-lg uppercase tracking-widest px-8 h-11 transition-all active:scale-95">
                        <Plus className="mr-2 h-5 w-5" /> New Template
                    </Button>
                ) : (
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={() => setIsAdding(false)} className="font-bold h-11">Discard</Button>
                        <Button onClick={handleSave} disabled={isSubmitting || !name} className="rounded-xl font-black px-10 shadow-xl bg-primary text-white h-11 transition-all active:scale-95">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Commit Changes
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
                {isAdding ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Stepper Header */}
                        <div className="bg-background border-b pt-6 shrink-0">
                            <Stepper currentStep={step} onStepClick={handleStepClick} />
                        </div>

                        <div className="flex-1 relative overflow-hidden">
                            <AnimatePresence mode="wait">
                                {/* STEP 1: CONFIGURATION */}
                                {step === 1 && (
                                    <motion.div key="step1" {...stepTransition} className="absolute inset-0 p-8 overflow-y-auto">
                                        <div className="max-w-2xl mx-auto space-y-8 pb-20">
                                            <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
                                                <CardHeader className="bg-muted/30 border-b p-8">
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20"><Settings2 className="h-6 w-6" /></div>
                                                        <div>
                                                            <CardTitle className="text-2xl font-black uppercase tracking-tight">Identity & Parameters</CardTitle>
                                                            <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Configure the master parameters for this blueprint.</CardDescription>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-10 space-y-10">
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Protocol Name (Internal)</Label>
                                                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Admission Confirmation" className="h-14 rounded-2xl bg-muted/20 border-none shadow-inner font-black text-xl px-6 focus:ring-1 focus:ring-primary/20 transition-all" />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                        <div className="space-y-4">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Operational Context</Label>
                                                            <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                                                                <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none font-bold"><SelectValue /></SelectTrigger>
                                                                <SelectContent className="rounded-xl">
                                                                    <SelectItem value="general">General Broadcast</SelectItem>
                                                                    <SelectItem value="meetings">Meeting Logistics</SelectItem>
                                                                    <SelectItem value="surveys">Survey Intelligence</SelectItem>
                                                                    <SelectItem value="forms">Doc Signing</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-4">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Delivery Medium</Label>
                                                            <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1 rounded-xl border shadow-inner">
                                                                <button type="button" onClick={() => setChannel('email')} className={cn("h-10 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all", channel === 'email' ? "bg-white shadow-md text-primary" : "text-muted-foreground opacity-60")}>Email</button>
                                                                <button type="button" onClick={() => setChannel('sms')} className={cn("h-10 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all", channel === 'sms' ? "bg-white shadow-md text-primary" : "text-muted-foreground opacity-60")}>SMS</button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {channel === 'email' && (
                                                        <div className="space-y-8 pt-8 border-t border-dashed">
                                                            <div className="flex items-center gap-2">
                                                                <Monitor className="h-4 w-4 text-primary" />
                                                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Inbox Perspective</h3>
                                                            </div>
                                                            
                                                            <div className="space-y-6">
                                                                <div className="space-y-2">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Subject Line</Label>
                                                                    <Input 
                                                                        value={subject} 
                                                                        onChange={e => setSubject(e.target.value)} 
                                                                        placeholder="e.g. Welcome to {{school_name}}" 
                                                                        className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold text-lg px-6" 
                                                                    />
                                                                </div>
                                                                
                                                                <div className="space-y-2">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Preview Text (Preheader)</Label>
                                                                    <Input 
                                                                        value={previewText} 
                                                                        onChange={e => setPreviewText(e.target.value)} 
                                                                        placeholder="Brief summary that appears in the inbox preview..." 
                                                                        className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-medium text-sm px-6" 
                                                                    />
                                                                    <p className="text-[9px] font-bold text-muted-foreground/60 px-1 uppercase tracking-tighter">This text appears after the subject line in most email clients.</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardContent>
                                                <CardFooter className="bg-muted/30 p-8 border-t justify-end">
                                                    <Button size="lg" onClick={() => handleStepClick(2)} disabled={!name} className="px-12 rounded-2xl font-black h-14 uppercase tracking-widest group">
                                                        Continue to Workshop <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        </div>
                                    </motion.div>
                                )}

                                {/* STEP 2: WORKSHOP (BUILDER + VARIABLES) */}
                                {step === 2 && (
                                    <motion.div 
                                        key="step2" 
                                        {...stepTransition} 
                                        className={cn(
                                            "absolute inset-0 flex select-none bg-background transition-all duration-500",
                                            isFullScreen && "fixed inset-0 z-[100] h-screen w-screen"
                                        )}
                                    >
                                        {/* Left: Variables Library (Resizable) */}
                                        <div 
                                            className="border-r bg-background flex flex-col shrink-0 relative"
                                            style={{ width: variablesWidth }}
                                        >
                                            <div className="p-4 border-b bg-muted/10 flex items-center gap-2">
                                                <Database className="h-4 w-4 text-primary" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Data Hub</span>
                                            </div>
                                            <ScrollArea className="flex-1">
                                                <div className="p-4 space-y-2">
                                                    {filteredVars.map(v => (
                                                        <TooltipProvider key={v.id}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const tag = `{{${v.key}}}`;
                                                                            navigator.clipboard.writeText(tag);
                                                                            toast({ title: 'Tag Copied', description: `${tag} is ready to paste.` });
                                                                        }}
                                                                        className="w-full text-left p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                                                                    >
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <span className="text-[8px] font-black uppercase text-muted-foreground group-hover:text-primary transition-colors">{v.sourceName || 'Core'}</span>
                                                                            <Copy className="h-2.5 w-2.5 text-primary opacity-0 group-hover:opacity-100" />
                                                                        </div>
                                                                        <p className="text-xs font-bold truncate text-foreground/80">{v.label}</p>
                                                                        <code className="text-[9px] font-mono text-primary/60 mt-1 block">{"{{" + v.key + "}}"}</code>
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="right">Click to Copy Tag</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    ))}
                                                </div>
                                            </ScrollArea>

                                            {/* Resize Handle */}
                                            <div 
                                                className={cn(
                                                    "absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize z-50 transition-colors",
                                                    isResizing ? "bg-primary/40" : "hover:bg-primary/20"
                                                )}
                                                onMouseDown={handleMouseDown}
                                            />
                                        </div>

                                        {/* Center: Editor Workspace */}
                                        <div className="flex-1 flex flex-col bg-muted/5 min-w-0 relative">
                                            <div className="p-4 border-b bg-background shrink-0 flex items-center justify-between z-20 shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    {channel === 'email' && (
                                                        <Tabs value={editorMode} onValueChange={(v: any) => setEditorMode(v)} className="w-fit">
                                                            <TabsList className="bg-muted/50 p-1 rounded-xl h-9 border">
                                                                <TabsTrigger value="builder" className="text-[9px] font-black uppercase tracking-widest gap-1.5"><Layout className="h-3 w-3" /> Blocks</TabsTrigger>
                                                                <TabsTrigger value="code" className="text-[9px] font-black uppercase tracking-widest gap-1.5"><Code className="h-3 w-3" /> Code</TabsTrigger>
                                                                <TabsTrigger value="text" className="text-[9px] font-black uppercase tracking-widest gap-1.5"><Type className="h-3 w-3" /> Text</TabsTrigger>
                                                            </TabsList>
                                                        </Tabs>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => setIsFullScreen(!isFullScreen)} 
                                                        className={cn("h-9 rounded-xl font-bold gap-2 text-xs", isFullScreen && "text-primary bg-primary/5")}
                                                    >
                                                        {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                                        {isFullScreen ? 'Exit Full Screen' : 'Zen Mode'}
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={() => setStep(3)} className="h-9 rounded-xl font-bold gap-2 text-xs">
                                                        <Eye className="h-4 w-4" /> Final Simulation
                                                    </Button>
                                                </div>
                                            </div>

                                            <ScrollArea className="flex-1">
                                                <div className="max-w-3xl mx-auto p-8 pb-32">
                                                    {channel === 'email' && editorMode === 'builder' ? (
                                                        <div className="space-y-8">
                                                            <div className="flex flex-wrap gap-2 p-2 bg-background/80 backdrop-blur-md border rounded-2xl shadow-sm mb-4 sticky top-0 z-10 ring-1 ring-black/5">
                                                                <Button variant="ghost" size="sm" onClick={() => handleAddBlock('heading')} className="h-8 text-[9px] font-black uppercase"><Heading1 className="h-3.5 w-3.5 mr-1.5" /> Title</Button>
                                                                <Button variant="ghost" size="sm" onClick={() => handleAddBlock('text')} className="h-8 text-[9px] font-black uppercase"><Type className="h-3.5 w-3.5 mr-1.5" /> Text</Button>
                                                                <Button variant="ghost" size="sm" onClick={() => handleAddBlock('button')} className="h-8 text-[9px] font-black uppercase"><MousePointer2 className="h-3.5 w-3.5 mr-1.5" /> Button</Button>
                                                                <Button variant="ghost" size="sm" onClick={() => handleAddBlock('image')} className="h-8 text-[9px] font-black uppercase"><ImageIcon className="h-3.5 w-3.5 mr-1.5" /> Image</Button>
                                                                <Button variant="ghost" size="sm" onClick={() => handleAddBlock('score-card')} className="h-8 text-[9px] font-black uppercase"><Trophy className="h-3.5 w-3.5 mr-1.5" /> Score</Button>
                                                            </div>

                                                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                                                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                                                    <div className="space-y-6 min-h-[400px]">
                                                                        {blocks.map((block, idx) => (
                                                                            <SortableBlockItem 
                                                                                key={block.id} 
                                                                                id={block.id} 
                                                                                index={idx} 
                                                                                block={block}
                                                                                variables={variables || []}
                                                                                onUpdate={(u) => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, ...u } : b))}
                                                                                onRemove={() => setBlocks(prev => prev.filter(b => b.id !== block.id))}
                                                                                onDuplicate={() => {
                                                                                    const newBlock = { ...block, id: `blk_${Date.now()}` };
                                                                                    const next = [...blocks];
                                                                                    next.splice(idx + 1, 0, newBlock);
                                                                                    setBlocks(next);
                                                                                }}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                </SortableContext>
                                                            </DndContext>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-6">
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">
                                                                    {channel === 'sms' ? 'Handset Payload' : editorMode === 'code' ? 'HTML Payload' : 'Text Payload'}
                                                                </Label>
                                                                <Textarea 
                                                                    value={body} 
                                                                    onChange={e => setBody(e.target.value)} 
                                                                    className="min-h-[500px] rounded-[2.5rem] font-mono text-sm leading-relaxed p-10 shadow-2xl bg-white border-none focus-visible:ring-1 focus-visible:ring-primary/20"
                                                                    placeholder={channel === 'sms' ? "Hi {{contact_name}}..." : "<html><body>...</body></html>"}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </div>

                                        {/* Right: Live Preview Mini */}
                                        <div className="hidden xl:flex w-[400px] border-l bg-slate-100 flex-col overflow-hidden shrink-0">
                                            <div className="p-4 border-b bg-background flex items-center gap-2">
                                                <Eye className="h-4 w-4 text-primary" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Live Feedback</span>
                                            </div>
                                            <div className="flex-1 overflow-auto p-6">
                                                <div className={cn(
                                                    "w-full transition-all duration-700 shadow-2xl rounded-3xl overflow-hidden border-4 border-white bg-white",
                                                    channel === 'sms' && "bg-[#0A1427] border-slate-800 p-6"
                                                )}>
                                                    {channel === 'sms' ? (
                                                        <div className="space-y-6">
                                                            <div className="flex items-center justify-between opacity-20"><Zap className="text-white h-4 w-4" /><span className="text-[8px] font-black text-white uppercase tracking-widest">SMS Mock</span></div>
                                                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl relative">
                                                                <div className="absolute -left-2 top-6 w-4 h-4 bg-[#0A1427] border-l border-b border-white/10 rotate-45" />
                                                                <p className="text-sm text-white/90 font-bold whitespace-pre-wrap">{resolvedPreview}</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col">
                                                            <div className="p-4 bg-muted/20 border-b space-y-1">
                                                                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Resolved Subject</span>
                                                                <p className="font-black text-xs truncate">{resolveVariables(subject, simVariables) || '(No Subject)'}</p>
                                                            </div>
                                                            <iframe srcDoc={resolvedPreview} className="w-full min-h-[500px] border-none" title="Live Preview" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* STEP 3: SIMULATION STUDIO */}
                                {step === 3 && (
                                    <motion.div key="step3" {...stepTransition} className="absolute inset-0 flex flex-col bg-slate-50">
                                        <div className="p-6 border-b bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-sm z-10">
                                            <div className="flex items-center gap-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded-xl"><MonitorPlay className="h-5 w-5 text-primary" /></div>
                                                    <div>
                                                        <h3 className="text-sm font-black uppercase tracking-tight">Simulation Studio</h3>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Live data record binding</p>
                                                    </div>
                                                </div>
                                                <Separator orientation="vertical" className="h-10 hidden sm:block" />
                                                <div className="flex items-center gap-3">
                                                    <Select value={simEntity} onValueChange={(v: any) => { setSimEntity(v); setSimRecordId('none'); }}>
                                                        <SelectTrigger className="h-10 w-[160px] rounded-xl bg-muted/20 border-none font-black text-[10px] uppercase tracking-widest"><SelectValue placeholder="Pick Source..." /></SelectTrigger>
                                                        <SelectContent className="rounded-xl">
                                                            <SelectItem value="none">Empty State</SelectItem>
                                                            <SelectItem value="School">School Directory</SelectItem>
                                                            <SelectItem value="Meeting">Meeting Record</SelectItem>
                                                            <SelectItem value="Survey">Survey Result</SelectItem>
                                                            <SelectItem value="Submission">Doc Signing Submission</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    {simEntity !== 'none' && (
                                                        <Select value={simRecordId} onValueChange={setSimRecordId}>
                                                            <SelectTrigger className="h-10 w-[200px] rounded-xl bg-muted/20 border-none font-bold text-xs"><SelectValue placeholder="Pick Record..." /></SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                <SelectItem value="none">Select Instance...</SelectItem>
                                                                {simEntity === 'School' && simSchools?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                                {simEntity === 'Meeting' && simMeetings?.map(m => <SelectItem key={m.id} value={m.id}>{m.schoolName} - {m.type.name}</SelectItem>)}
                                                                {simEntity === 'Survey' && simSurveys?.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                                                                {simEntity === 'Submission' && simPdfs?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border">
                                                <Button 
                                                    variant={previewDevice === 'desktop' ? 'secondary' : 'ghost'} 
                                                    size="sm" 
                                                    className="h-8 gap-2 rounded-lg font-black text-[10px] uppercase"
                                                    onClick={() => setPreviewDevice('desktop')}
                                                >
                                                    <Monitor className="h-3.5 w-3.5" /> Desktop
                                                </Button>
                                                <Button 
                                                    variant={previewDevice === 'mobile' ? 'secondary' : 'ghost'} 
                                                    size="sm" 
                                                    className="h-8 gap-2 rounded-lg font-black text-[10px] uppercase"
                                                    onClick={() => setPreviewDevice('mobile')}
                                                >
                                                    <PhoneIcon className="h-3.5 w-3.5" /> Mobile
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-auto p-8 flex justify-center">
                                            <div className={cn(
                                                "transition-all duration-700 bg-white shadow-2xl rounded-[2.5rem] overflow-hidden border-8 border-white relative",
                                                previewDevice === 'mobile' ? "w-[375px] h-[667px]" : "w-full max-w-4xl",
                                                channel === 'sms' && "bg-[#0A1427] border-slate-800 p-12 flex flex-col justify-center items-center"
                                            )}>
                                                {isSimLoading && (
                                                    <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
                                                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Synchronizing Data Hub...</p>
                                                    </div>
                                                )}

                                                {channel === 'sms' ? (
                                                    <div className="w-full max-w-sm space-y-10 animate-in zoom-in-95 duration-700">
                                                        <div className="flex items-center justify-between opacity-20"><Zap className="text-white h-6 w-6" /><span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">SMS Uplink Simulation</span></div>
                                                        <div className="p-8 bg-white/5 border border-white/10 rounded-[2rem] relative shadow-inner">
                                                            <div className="absolute -left-3 top-10 w-6 h-6 bg-[#0A1427] border-l border-b border-white/10 rotate-45 rounded-sm" />
                                                            <p className="text-lg text-white/95 font-bold whitespace-pre-wrap leading-relaxed">{resolvedPreview}</p>
                                                        </div>
                                                        <div className="pt-8 border-t border-white/5 text-center">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-white/20">~ {Math.ceil(resolvedPreview.length / 160)} SMS Segments</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col h-full animate-in fade-in duration-1000">
                                                        <div className="p-8 bg-muted/20 border-b space-y-2">
                                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40">Resolved Subject Payload</span>
                                                            <p className="font-black text-xl text-foreground">{resolveVariables(subject, simVariables) || '(No Subject)'}</p>
                                                        </div>
                                                        <iframe srcDoc={resolvedPreview} className="flex-1 w-full border-none bg-white" title="High Fidelity Preview" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="h-full">
                        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8 pb-32">
                            <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-3xl border shadow-sm ring-1 ring-black/5">
                                <div className="relative flex-grow w-full">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                                    <Input placeholder="Filter blueprints..." className="pl-11 h-12 rounded-2xl bg-muted/20 border-none font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                </div>
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="h-12 w-full md:w-[200px] rounded-2xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest transition-all hover:bg-muted/40"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="all">Global Hub</SelectItem>
                                        <SelectItem value="general">General</SelectItem>
                                        <SelectItem value="meetings">Meetings</SelectItem>
                                        <SelectItem value="surveys">Surveys</SelectItem>
                                        <SelectItem value="forms">Doc Signing</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {isLoadingTemplates ? (
                                    Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-64 animate-pulse bg-muted rounded-[2.5rem]" />)
                                ) : filteredTemplates.length > 0 ? (
                                    filteredTemplates.map(template => (
                                        <Card key={template.id} className="group relative border-2 transition-all duration-500 rounded-[2.5rem] overflow-hidden bg-card shadow-sm hover:shadow-2xl border-border/50">
                                            <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 text-primary" onClick={() => handleEditClick(template)}><Pencil className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl" onClick={async () => { if(confirm('Are you sure?')) await deleteDoc(doc(firestore!, 'message_templates', template.id))}}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                            <CardHeader className="p-6 pb-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "p-3 rounded-2xl border shadow-sm transition-transform group-hover:scale-110 group-hover:rotate-3 duration-500", 
                                                        template.channel === 'sms' ? "bg-orange-500/10 text-orange-500 border-orange-100" : "bg-blue-500/10 text-blue-500 border-blue-100"
                                                    )}>
                                                        {template.channel === 'sms' ? <Smartphone className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <CardTitle className="text-lg font-black truncate text-foreground group-hover:text-primary transition-colors leading-tight">{template.name}</CardTitle>
                                                        <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground opacity-60 mt-1">{template.category === 'forms' ? 'Doc Signing' : template.category}</p>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="px-6 pb-6 space-y-6">
                                                <div className="p-5 bg-muted/20 rounded-[1.5rem] border border-dashed border-border/50 text-[13px] text-muted-foreground/80 italic line-clamp-3 min-h-[5.5rem] leading-relaxed shadow-inner">
                                                    &ldquo;{template.blocks?.length ? `${template.blocks.length} Structural Blocks` : (template.body || '').replace(/<[^>]*>?/gm, '')}&rdquo;
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {template.variables.slice(0, 4).map(v => (
                                                        <Badge key={v} variant="outline" className="text-[9px] h-6 font-black uppercase tracking-tight px-2.5 rounded-lg shadow-sm bg-white border-primary/10 text-primary">
                                                            &#123;&#123;{v}&#125;&#125;
                                                        </Badge>
                                                    ))}
                                                    {template.variables.length > 4 && <Badge variant="ghost" className="text-[9px] font-black opacity-40">+{template.variables.length - 4}</Badge>}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="col-span-full py-32 text-center border-4 border-dashed rounded-[4rem] bg-muted/5 flex flex-col items-center justify-center gap-4">
                                        <FileType className="h-16 w-16 text-muted-foreground/20" />
                                        <p className="text-muted-foreground font-black uppercase tracking-widest text-sm">No protocol blueprints found.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>
    );
}
