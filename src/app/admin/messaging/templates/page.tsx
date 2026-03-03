
'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, where, getDocs, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { MessageTemplate, MessageBlock, VariableDefinition, School, Meeting, Survey, MessageStyle } from '@/lib/types';
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
    FileType, Plus, Trash2, Mail, Smartphone, X, Loader2, ArrowLeft, 
    Code, Eye, Sparkles, Check, Pencil, Database, Zap, Trophy, 
    MonitorPlay, Palette, Layout, Wand2, Info, Copy, GripVertical, 
    Heading1, Type, Image as ImageIcon, Video, MousePointer2, Quote, 
    Square, List, PlusCircle, ArrowUp, ArrowDown, AlignLeft, 
    AlignCenter, AlignRight, Bold, Italic, Underline
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { generateEmailTemplate } from '@/ai/flows/generate-email-template-flow';
import { renderBlocksToHtml, resolveVariables, shouldShowBlock } from '@/lib/messaging-utils';
import { format } from 'date-fns';
import { fetchContextualData } from '@/lib/messaging-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

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
    logo: SmartSappIcon,
    'score-card': Trophy,
};

function SmartSappIcon({ className }: { className?: string }) {
    return <Zap className={cn("h-4 w-4", className)} />;
}

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
        transform: CSS.Transform.toString(transform),
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

// --- MAIN PAGE ---

export default function MessageTemplatesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    
    // UI State
    const [isAdding, setIsAdding] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
    const [editorMode, setEditorMode] = React.useState<'builder' | 'code' | 'text'>('builder');

    // Template State
    const [name, setName] = React.useState('');
    const [category, setCategory] = React.useState<MessageTemplate['category']>('general');
    const [channel, setChannel] = React.useState<'sms' | 'email'>('email');
    const [subject, setSubject] = React.useState('');
    const [body, setBody] = React.useState('');
    const [blocks, setBlocks] = React.useState<MessageBlock[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Simulation State
    const [simEntity, setSimEntity] = React.useState<'School' | 'Meeting' | 'Survey' | 'none'>('none');
    const [simRecordId, setSimRecordId] = React.useState('none');
    const [simVariables, setSimVariables] = React.useState<Record<string, any>>({});
    const [isSimLoading, setIsSimLoading] = React.useState(false);

    const sensors = useSensors(useSensor(PointerSensor));

    // Data Queries
    const templatesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'message_templates'), orderBy('createdAt', 'desc')) : null, [firestore]);
    const varsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'messaging_variables')) : null, [firestore]);
    const schoolsQuery = useMemoFirebase(() => (firestore && simEntity === 'School') ? query(collection(firestore, 'schools'), orderBy('name', 'asc')) : null, [firestore, simEntity]);
    const meetingsQuery = useMemoFirebase(() => (firestore && simEntity === 'Meeting') ? query(collection(firestore, 'meetings'), orderBy('meetingTime', 'desc')) : null, [firestore, simEntity]);
    const surveysQuery = useMemoFirebase(() => (firestore && simEntity === 'Survey') ? query(collection(firestore, 'surveys'), where('status', '==', 'published')) : null, [firestore, simEntity]);

    const { data: templates, isLoading: isLoadingTemplates } = useCollection<MessageTemplate>(templatesQuery);
    const { data: variables } = useCollection<VariableDefinition>(varsQuery);
    const { data: simSchools } = useCollection<School>(schoolsQuery);
    const { data: simMeetings } = useCollection<Meeting>(meetingsQuery);
    const { data: simSurveys } = useCollection<Survey>(surveysQuery);

    // Simulation Logic
    React.useEffect(() => {
        const resolveSimData = async () => {
            if (simEntity === 'none' || simRecordId === 'none' || !firestore) {
                setSimVariables({});
                return;
            }
            setIsSimLoading(true);
            try {
                let entityType = simEntity === 'Survey' ? 'SurveyResponse' : simEntity;
                let id = simRecordId;
                let parentId = undefined;

                if (simEntity === 'Survey') {
                    const respSnap = await getDocs(query(collection(firestore, `surveys/${simRecordId}/responses`), limit(1)));
                    if (!respSnap.empty) {
                        id = respSnap.docs[0].id;
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
        setBlocks([]);
        setCategory('general');
        setChannel('email');
        setSimEntity('none');
        setSimRecordId('none');
    };

    const handleEditClick = (template: MessageTemplate) => {
        setEditingTemplate(template);
        setName(template.name);
        setCategory(template.category);
        setChannel(template.channel);
        setSubject(template.subject || '');
        setBody(template.body || '');
        setBlocks(template.blocks || []);
        setEditorMode(template.blocks?.length ? 'builder' : 'code');
        setIsAdding(true);
    };

    const filteredTemplates = templates?.filter(t => 
        (categoryFilter === 'all' || t.category === categoryFilter) &&
        (t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.body.toLowerCase().includes(searchTerm.toLowerCase()))
    ) || [];

    const resolvedPreview = React.useMemo(() => {
        if (channel === 'sms') return resolveVariables(body, simVariables);
        if (editorMode === 'builder' && blocks.length > 0) return renderBlocksToHtml(blocks, simVariables);
        return resolveVariables(body, simVariables);
    }, [body, blocks, simVariables, editorMode, channel]);

    return (
        <div className="h-full flex flex-col bg-muted/5 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-4 sm:p-6 md:p-8 flex items-center justify-between border-b bg-background">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Template Studio</h1>
                    <p className="text-muted-foreground font-medium">Design structural, logic-aware communication blueprints.</p>
                </div>
                {!isAdding ? (
                    <Button onClick={() => { resetForm(); setIsAdding(true); }} className="rounded-xl font-black shadow-lg uppercase tracking-widest px-8">
                        <Plus className="mr-2 h-5 w-5" /> New Template
                    </Button>
                ) : (
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={() => setIsAdding(false)} className="font-bold">Discard</Button>
                        <Button onClick={handleSave} disabled={isSubmitting} className="rounded-xl font-black px-10 shadow-xl bg-primary text-white">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Commit Template
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-hidden">
                {isAdding ? (
                    <div className="flex h-full w-full">
                        {/* Editor Pane */}
                        <div className="flex-1 flex flex-col border-r bg-background">
                            <div className="p-6 border-b space-y-6 shrink-0">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Identity</Label>
                                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Booking Confirm" className="font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Context</Label>
                                        <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                                            <SelectTrigger className="font-bold"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="general">General</SelectItem>
                                                <SelectItem value="meetings">Meetings</SelectItem>
                                                <SelectItem value="surveys">Surveys</SelectItem>
                                                <SelectItem value="forms">Doc Signing</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Medium</Label>
                                        <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
                                            <SelectTrigger className="font-bold"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="email">Email</SelectItem>
                                                <SelectItem value="sms">SMS</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {channel === 'email' && (
                                    <Tabs value={editorMode} onValueChange={(v: any) => setEditorMode(v)} className="w-full">
                                        <TabsList className="grid w-full grid-cols-3 h-10 p-1 bg-muted/50 rounded-xl border">
                                            <TabsTrigger value="builder" className="font-black uppercase text-[10px] tracking-widest gap-2">
                                                <Layout className="h-3.5 w-3.5" /> Visual Builder
                                            </TabsTrigger>
                                            <TabsTrigger value="code" className="font-black uppercase text-[10px] tracking-widest gap-2">
                                                <Code className="h-3.5 w-3.5" /> Source Code
                                            </TabsTrigger>
                                            <TabsTrigger value="text" className="font-black uppercase text-[10px] tracking-widest gap-2">
                                                <Type className="h-3.5 w-3.5" /> Plain Text
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                )}
                            </div>

                            <ScrollArea className="flex-1 p-6 bg-muted/5">
                                <div className="max-w-3xl mx-auto space-y-8 pb-32">
                                    {channel === 'email' && editorMode === 'builder' ? (
                                        <div className="space-y-8">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Subject</Label>
                                                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject..." className="h-14 font-black text-xl bg-background shadow-inner" />
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-2 p-2 bg-background border rounded-2xl shadow-sm mb-4">
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
                                                                simulationVars={simVariables}
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
                                            {channel === 'email' && (
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Subject</Label>
                                                    <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject..." className="h-14 font-black text-xl" />
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">
                                                    {channel === 'sms' ? 'SMS Body' : editorMode === 'code' ? 'HTML Payload' : 'Plain Text Payload'}
                                                </Label>
                                                <Textarea 
                                                    value={body} 
                                                    onChange={e => setBody(e.target.value)} 
                                                    className="min-h-[500px] rounded-2xl font-mono text-sm leading-relaxed p-8 shadow-inner bg-background border-none focus-visible:ring-1 focus-visible:ring-primary/20"
                                                    placeholder={channel === 'sms' ? "Hi {{contact_name}}..." : "<html><body>...</body></html>"}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Preview Pane */}
                        <div className="hidden lg:flex w-[450px] xl:w-[550px] flex-col bg-slate-100 relative">
                            <div className="p-6 border-b bg-background shrink-0 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <MonitorPlay className="h-5 w-5 text-primary" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Studio Preview</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Select value={simEntity} onValueChange={(v: any) => { setSimEntity(v); setSimRecordId('none'); }}>
                                        <SelectTrigger className="h-8 w-32 text-[10px] font-black uppercase bg-muted/50 border-none">
                                            <SelectValue placeholder="Simulate..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Empty State</SelectItem>
                                            <SelectItem value="School">School</SelectItem>
                                            <SelectItem value="Meeting">Meeting</SelectItem>
                                            <SelectItem value="Survey">Survey</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {simEntity !== 'none' && (
                                        <Select value={simRecordId} onValueChange={setSimRecordId}>
                                            <SelectTrigger className="h-8 w-32 text-[10px] font-black uppercase bg-muted/50 border-none">
                                                <SelectValue placeholder="Record..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Pick...</SelectItem>
                                                {simEntity === 'School' && simSchools?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                {simEntity === 'Meeting' && simMeetings?.map(m => <SelectItem key={m.id} value={m.id}>{m.schoolName}</SelectItem>)}
                                                {simEntity === 'Survey' && simSurveys?.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto p-8 flex flex-col items-center">
                                <div className={cn(
                                    "w-full max-w-[400px] transition-all duration-700 shadow-2xl rounded-[2.5rem] overflow-hidden border-8 border-white bg-white",
                                    channel === 'sms' && "bg-[#0A1427] border-slate-800 p-8"
                                )}>
                                    {channel === 'sms' ? (
                                        <div className="space-y-8">
                                            <div className="flex items-center justify-between opacity-20"><SmartSappIcon className="text-white" /><span className="text-[8px] font-black text-white uppercase tracking-widest">SMS Mock</span></div>
                                            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl relative">
                                                <div className="absolute -left-2 top-6 w-4 h-4 bg-[#0A1427] border-l border-b border-white/10 rotate-45" />
                                                <p className="text-sm text-white/90 font-bold whitespace-pre-wrap">{resolvedPreview}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col">
                                            <div className="p-6 bg-muted/20 border-b space-y-1">
                                                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Resolved Subject</span>
                                                <p className="font-black text-sm">{resolveVariables(subject, simVariables) || '(No Subject)'}</p>
                                            </div>
                                            <iframe srcDoc={resolvedPreview} className="w-full min-h-[600px] border-none" title="Email Preview" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="h-full">
                        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8 pb-32">
                            <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-3xl border shadow-sm">
                                <div className="relative flex-grow w-full">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                                    <Input placeholder="Search templates..." className="pl-11 h-12 rounded-2xl bg-muted/20 border-none font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                </div>
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="h-12 w-full md:w-[200px] rounded-2xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="all">All Contexts</SelectItem>
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
                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl" onClick={async () => { if(confirm('Delete?')) await deleteDoc(doc(firestore!, 'message_templates', template.id))}}><Trash2 className="h-4 w-4" /></Button>
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
                                                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-60 mt-1">{template.category}</p>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="px-6 pb-6 space-y-6">
                                                <div className="p-5 bg-muted/20 rounded-[1.5rem] border border-dashed border-border/50 text-[13px] text-muted-foreground/80 italic line-clamp-3 min-h-[5.5rem] leading-relaxed shadow-inner">
                                                    &ldquo;{template.blocks?.length ? `${template.blocks.length} Content Blocks` : (template.body || '').replace(/<[^>]*>?/gm, '')}&rdquo;
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {template.variables.slice(0, 4).map(v => (
                                                        <Badge key={v} variant="outline" className="text-[9px] h-6 font-black uppercase tracking-tight px-2.5 rounded-lg shadow-sm bg-white border-primary/10 text-primary">
                                                            &#123;&#123;{v}&#125;&#125;
                                                        </Badge>
                                                    ))}
                                                    {template.variables.length > 4 && <Badge variant="ghost" className="text-[9px] font-black opacity-40">+{template.variables.length - 4} more</Badge>}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="col-span-full py-32 text-center border-4 border-dashed rounded-[4rem] bg-muted/5 flex flex-col items-center justify-center gap-4">
                                        <FileType className="h-16 w-16 text-muted-foreground/20" />
                                        <p className="text-muted-foreground font-black uppercase tracking-widest text-sm">No templates defined in this context.</p>
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

function Search({ className, ...props }: React.SVGProps<SVGSVGElement>) {
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
            className={cn("lucide lucide-search", className)}
        >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    )
}
