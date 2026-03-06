'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, where, getDocs, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { MessageTemplate, MessageBlock, VariableDefinition, School, Meeting, Survey, PDFForm, MessageStyle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    Maximize2, Minimize2, Settings, Link as LinkIcon, Layers, PenTool,
    Palette, EyeOff, CopyPlus, AlignJustify
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { resolveVariables, renderBlocksToHtml, shouldShowBlock, parseHtmlToBlocks } from '@/lib/messaging-utils';
import { format } from 'date-fns';
import { fetchContextualData } from '@/lib/messaging-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AnimatePresence, motion } from 'framer-motion';
import { SmartSappIcon } from '@/components/icons';
import AiChatEditor from '../components/ai-chat-editor';
import { cloneTemplate } from '@/lib/template-actions';
import { MediaSelect } from '../../schools/components/media-select';

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

function VisualBlock({ block, simulationVars }: { block: MessageBlock, simulationVars: Record<string, any> }) {
    const align = block.style?.textAlign || 'left';
    const resolvedTitle = resolveVariables(block.title || '', simulationVars);
    const resolvedContent = resolveVariables(block.content || '', simulationVars);
    const resolvedUrl = resolveVariables(block.url || '', simulationVars);

    const alignmentClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : align === 'justify' ? 'text-justify' : 'text-left';

    switch (block.type) {
        case 'heading': {
            const Tag = block.variant || 'h2';
            const sizeClass = Tag === 'h1' ? "text-3xl" : Tag === 'h2' ? "text-2xl" : "text-lg";
            return (
                <div className={cn("w-full", alignmentClass)}>
                    <Tag className={cn("font-black tracking-tight leading-tight m-0", sizeClass)}>{resolvedTitle || 'New Heading'}</Tag>
                </div>
            );
        }
        case 'text':
            return (
                <div className={cn("w-full", alignmentClass)}>
                    <p className="text-base text-muted-foreground leading-relaxed m-0 whitespace-pre-wrap">{resolvedContent || 'New paragraph content...'}</p>
                </div>
            );
        case 'button':
            return (
                <div className={cn("w-full py-4", alignmentClass)}>
                    <Button variant={block.style?.variant as any || 'default'} className="rounded-xl font-bold h-12 px-8 uppercase tracking-widest shadow-md">{resolvedTitle || 'Click Me'}</Button>
                </div>
            );
        case 'image':
            return (
                <div className={cn("w-full py-2", alignmentClass)}>
                    {resolvedUrl ? (
                        <div className="relative aspect-video rounded-2xl overflow-hidden border bg-muted shadow-inner">
                            <img src={resolvedUrl} alt="block" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center bg-muted/20 text-muted-foreground gap-2">
                            <ImageIcon className="h-8 w-8 opacity-20" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Image Area</span>
                        </div>
                    )}
                </div>
            );
        case 'video':
            return (
                <div className={cn("w-full py-2", alignmentClass)}>
                    {resolvedUrl ? (
                        <div className="w-full">
                            <iframe 
                                src={`https://www.youtube.com/embed/${resolvedUrl.split('/').pop()?.split('v=')[1]?.split('&')[0] || resolvedUrl.split('/').pop()}`}
                                className="w-full aspect-video rounded-2xl shadow-lg border-4 border-white"
                                allowFullScreen
                            />
                        </div>
                    ) : (
                        <div className="aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center bg-muted/20 text-muted-foreground gap-2">
                            <Video className="h-8 w-8 opacity-20" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Video Area</span>
                        </div>
                    )}
                </div>
            );
        case 'quote':
            return (
                <div className={cn("w-full my-4 p-6 bg-slate-50 border-l-4 border-primary rounded-r-2xl italic text-xl leading-relaxed text-slate-700", alignmentClass)}>
                    <Quote className="h-6 w-6 text-primary/20 mb-2" />
                    {resolvedContent || 'Quote content...'}
                </div>
            );
        case 'list':
            const ListTag = block.listStyle === 'ordered' ? 'ol' : 'ul';
            return (
                <div className={cn("w-full", alignmentClass)}>
                    <ListTag className={cn("text-base text-muted-foreground leading-relaxed m-0 space-y-2", block.listStyle === 'ordered' ? "list-decimal text-left" : "list-disc text-left", "list-inside")}>
                        {(block.items || ['New point...']).map((item, i) => (
                            <li key={item + i}>{resolveVariables(item, simulationVars)}</li>
                        ))}
                    </ListTag>
                </div>
            );
        case 'divider':
            return <hr className="w-full my-6 border-slate-200" />;
        case 'score-card':
            return (
                <div className="w-full py-6">
                    <Card className="bg-primary text-white border-none shadow-2xl rounded-[2rem] p-8 flex flex-col items-center text-center">
                        <Badge variant="outline" className="mb-4 bg-white/10 text-white border-white/20 px-3 py-1 text-[8px] font-black uppercase tracking-widest">Assessment Result</Badge>
                        <span className="text-6xl font-black tabular-nums tracking-tighter">{simulationVars.score || 0}</span>
                        <span className="text-[10px] font-bold opacity-60 uppercase tracking-[0.2em] mt-1">Total Points Recorded</span>
                    </Card>
                </div>
            );
        default:
            return <div className="p-4 border border-dashed rounded text-[10px] text-muted-foreground uppercase text-center">{block.type} Block Content</div>;
    }
}

function SortableBlockItem({ 
    id, index, block, isSelected, simulationVars, onSelect, onRemove, onDuplicate 
}: { 
    id: string, index: number, block: MessageBlock, isSelected: boolean, simulationVars: Record<string, any>, onSelect: () => void, onRemove: () => void, onDuplicate: () => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={cn(
                "relative group/block transition-all duration-300",
                isSelected && "z-10"
            )}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
        >
            <div className={cn(
                "absolute -inset-4 border-2 rounded-[1.5rem] pointer-events-none transition-all duration-300",
                isSelected ? "border-primary shadow-2xl shadow-primary/10 bg-primary/[0.02]" : "border-transparent"
            )} />

            <div
                {...attributes}
                {...listeners}
                className={cn(
                    "absolute -left-10 top-1/2 -translate-y-1/2 z-20 cursor-grab p-2 bg-background border rounded-full transition-all duration-300 shadow-xl",
                    isSelected || "opacity-0 group-hover/block:opacity-100"
                )}
            >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className={cn(
                "absolute -right-10 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 transition-all duration-300",
                isSelected || "opacity-0 group-hover/block:opacity-100"
            )}>
                <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full bg-background shadow-lg hover:text-primary" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}><Copy className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full bg-background shadow-lg text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onRemove(); }}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            
            <div className="relative py-2 px-4">
                <VisualBlock block={block} simulationVars={simulationVars} />
            </div>
        </div>
    );
}

// --- SIDEBAR INSPECTOR ---

function GlobalBlockInspector({ 
    block, 
    variables, 
    onUpdate 
}: { 
    block: MessageBlock, 
    variables: VariableDefinition[], 
    onUpdate: (props: Partial<MessageBlock>) => void 
}) {
    const isTextType = ['text', 'heading', 'quote', 'button', 'header', 'footer', 'list'].includes(block.type);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="space-y-6">
                {block.type === 'heading' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Content</Label>
                            <Input 
                                value={block.title || ''} 
                                onChange={e => onUpdate({ title: e.target.value })} 
                                className="font-bold rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20" 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Importance Level</Label>
                            <div className="flex gap-2">
                                {(['h1', 'h2', 'h3'] as const).map(v => (
                                    <Button 
                                        key={v}
                                        type="button"
                                        size="sm"
                                        variant={block.variant === v ? 'default' : 'outline'}
                                        className="h-8 flex-1 rounded-lg font-black"
                                        onClick={() => onUpdate({ variant: v })}
                                    >
                                        {v.toUpperCase()}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {(block.type === 'text' || block.type === 'quote') && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Body Text</Label>
                        <Textarea 
                            value={block.content || ''} 
                            onChange={e => onUpdate({ content: e.target.value })}
                            className="min-h-[150px] rounded-2xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 p-4 leading-relaxed" 
                        />
                    </div>
                )}

                {block.type === 'list' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">List Style</Label>
                            <div className="flex gap-1 bg-muted/30 p-1 rounded-lg border">
                                <Button 
                                    type="button" 
                                    variant={block.listStyle === 'unordered' ? 'secondary' : 'ghost'} 
                                    size="sm" 
                                    className="h-7 rounded-md px-2"
                                    onClick={() => onUpdate({ listStyle: 'unordered' })}
                                >
                                    <List className="h-3.5 w-3.5" />
                                </Button>
                                <Button 
                                    type="button" 
                                    variant={block.listStyle === 'ordered' ? 'secondary' : 'ghost'} 
                                    size="sm" 
                                    className="h-7 rounded-md px-2"
                                    onClick={() => onUpdate({ listStyle: 'ordered' })}
                                >
                                    <ListOrdered className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">List Items (One per line)</Label>
                            <Textarea 
                                value={block.items?.join('\n') || ''}
                                onChange={e => onUpdate({ items: e.target.value.split('\n') })}
                                className="min-h-[200px] rounded-2xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 p-4 leading-relaxed"
                                placeholder="Pasting a list works here too..."
                            />
                        </div>
                    </div>
                )}

                {block.type === 'button' && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Button Label</Label>
                            <Input value={block.title || ''} onChange={e => onUpdate({ title: e.target.value })} className="font-bold rounded-xl h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Link</Label>
                            <div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-muted/20 focus-within:ring-1 focus-within:ring-primary/20 shadow-inner">
                                <div className="bg-muted px-3 flex items-center text-muted-foreground/40 border-r"><LinkIcon className="h-3.5 w-3.5" /></div>
                                <Input value={block.link || ''} onChange={e => onUpdate({ link: e.target.value })} className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent font-mono text-[10px]" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Style</Label>
                            <Select value={block.style?.variant || 'default'} onValueChange={(val) => onUpdate({ style: { ...block.style, variant: val } })}>
                                <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="default">Primary Solid</SelectItem>
                                    <SelectItem value="outline">Branded Outline</SelectItem>
                                    <SelectItem value="secondary">Soft Gray</SelectItem>
                                    <SelectItem value="destructive">Warning Red</SelectItem>
                                    <SelectItem value="ghost">Invisible Ghost</SelectItem>
                                    <SelectItem value="link">Simple Link</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {(block.type === 'image' || block.type === 'video') && (
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                            {block.type === 'image' ? 'Image Source' : 'Video Source'}
                        </Label>
                        <MediaSelect 
                            value={block.url} 
                            onValueChange={(val) => onUpdate({ url: val })}
                            filterType={block.type as any}
                            className="rounded-xl border-none shadow-none bg-muted/20"
                        />
                        <p className="text-[9px] font-bold text-muted-foreground uppercase px-1 italic">
                            Tip: Use variables like &#123;&#123;school_logo&#125;&#125; for dynamic content.
                        </p>
                    </div>
                )}

                {block.type === 'score-card' && (
                    <div className="p-4 rounded-xl border bg-primary/5 border-primary/10">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest text-center">Score Card UI is fixed</p>
                    </div>
                )}

                {isTextType && (
                    <div className="pt-6 border-t border-dashed">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 block ml-1">Paragraph Alignment</Label>
                        <div className="flex gap-1 bg-muted/30 p-1 rounded-[1.25rem] border shadow-inner">
                            {(['left', 'center', 'right', 'justify'] as const).map(a => (
                                <Button 
                                    key={a}
                                    type="button" 
                                    variant={block.style?.textAlign === a ? 'secondary' : 'ghost'} 
                                    className={cn("flex-1 h-10 rounded-xl transition-all", block.style?.textAlign === a ? "bg-white shadow-md text-primary" : "text-muted-foreground opacity-60")} 
                                    onClick={() => onUpdate({ style: { ...block.style, textAlign: a } })}
                                    title={a.charAt(0).toUpperCase() + a.slice(1)}
                                >
                                    {a === 'left' ? <AlignLeft className="h-4 w-4" /> : a === 'center' ? <AlignCenter className="h-4 w-4" /> : a === 'right' ? <AlignRight className="h-4 w-4" /> : <AlignJustify className="h-4 w-4" />}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- MAIN PAGE ---

export default function MessageTemplatesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    
    // UI Flow State
    const [isAdding, setIsAdding] = React.useState(false);
    const [step, setStep] = React.useState(1);
    const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
    const [previewTemplate, setPreviewTemplate] = React.useState<MessageTemplate | null>(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
    const [channelFilter, setChannelFilter] = React.useState<string>('all');
    const [editorMode, setEditorMode] = React.useState<'designer' | 'code'>('designer');
    const [isFullScreen, setIsFullScreen] = React.useState(false);
    const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);
    const [sidebarTab, setSidebarTab] = React.useState<'blocks' | 'tags' | 'properties'>('blocks');
    const [cloningId, setCloningId] = React.useState<string | null>(null);
    const [templateToDelete, setTemplateToDelete] = React.useState<MessageTemplate | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    // Resizable Sidebar State
    const [variablesWidth, setVariablesWidth] = React.useState(320); 
    const [isResizing, setIsResizing] = React.useState(false);

    // Template State
    const [name, setName] = React.useState('');
    const [category, setCategory] = React.useState<MessageTemplate['category']>('general');
    const [channel, setChannel] = React.useState<'sms' | 'email'>('email');
    const [subject, setSubject] = React.useState('');
    const [previewText, setPreviewText] = React.useState('');
    const [body, setBody] = React.useState('');
    const [blocks, setBlocks] = React.useState<MessageBlock[]>([]);
    const [styleId, setStyleId] = React.useState<string>('none');
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
    const simSurveysQuery = useMemoFirebase(() => (firestore && simEntity === 'Survey') ? query(collection(firestore, 'surveys'), where('status', '==', 'published')) : null, [firestore, simEntity]);
    const pdfsQuery = useMemoFirebase(() => (firestore && simEntity === 'Submission') ? query(collection(firestore, 'pdfs'), where('status', '==', 'published')) : null, [firestore, simEntity]);

    const templatesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'message_templates'), orderBy('createdAt', 'desc')) : null, [firestore]);
    const varsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'messaging_variables')) : null, [firestore]);
    const stylesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'message_styles'), orderBy('name', 'asc')) : null, [firestore]);

    const { data: templates, isLoading: isLoadingTemplates } = useCollection<MessageTemplate>(templatesQuery);
    const { data: variables } = useCollection<VariableDefinition>(varsQuery);
    const { data: styles } = useCollection<MessageStyle>(stylesQuery);
    const { data: simSchools } = useCollection<School>(schoolsQuery);
    const { data: simMeetings } = useCollection<Meeting>(meetingsQuery);
    const { data: simSurveys } = useCollection<Survey>(simSurveysQuery);
    const { data: simPdfs } = useCollection<PDFForm>(pdfsQuery);

    // Sync Designer -> Code
    React.useEffect(() => {
        if (channel === 'email' && editorMode === 'designer') {
            const generatedHtml = renderBlocksToHtml(blocks, {});
            if (generatedHtml !== body) {
                setBody(generatedHtml);
            }
        }
    }, [blocks, channel, editorMode, body]);

    // SMS Sidebar Logic: Force Tags tab
    React.useEffect(() => {
        if (channel === 'sms' && sidebarTab !== 'tags') {
            setSidebarTab('tags');
        }
    }, [channel, sidebarTab]);

    const handleCodeChange = (newHtml: string) => {
        setBody(newHtml);
    };

    const handleEditorTabChange = (mode: 'designer' | 'code') => {
        if (mode === 'designer' && editorMode === 'code') {
            const hydrated = parseHtmlToBlocks(body);
            if (hydrated.length > 0) {
                setBlocks(hydrated);
            }
        }
        setEditorMode(mode);
    }

    // Resize Handler
    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = Math.max(250, Math.min(600, e.clientX));
            setVariablesWidth(newWidth);
        };
        const handleMouseUp = () => setIsResizing(false);
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
                    if (!respSnap.empty) { id = respSnap.docs[0].id; parentId = simRecordId; }
                } else if (simEntity === 'Submission') {
                    const subSnap = await getDocs(query(collection(firestore, `pdfs/${simRecordId}/submissions`), limit(1)));
                    if (!subSnap.empty) { id = subSnap.docs[0].id; parentId = simRecordId; }
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

    const currentTemplateData = React.useMemo(() => {
        return {
            name,
            category,
            channel,
            subject,
            previewText,
            body,
            blocks,
            styleId,
            isActive: true,
            variables: [],
            createdAt: '',
            updatedAt: '',
            id: editingTemplate?.id || 'new'
        } as MessageTemplate;
    }, [name, category, channel, subject, previewText, body, blocks, styleId, editingTemplate]);

    const handleAddBlock = (type: MessageBlock['type'], variant?: 'h1'|'h2'|'h3') => {
        const newBlock: MessageBlock = {
            id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            type,
            title: type === 'heading' ? (variant === 'h1' ? 'Main Heading' : 'Subheading Content') : type === 'button' ? 'Action Button' : '',
            content: type === 'text' ? 'New paragraph content...' : '',
            variant: variant,
            style: { textAlign: 'left', variant: 'default' }
        };
        if (type === 'list') {
            newBlock.listStyle = 'unordered';
            newBlock.items = ['List item one', 'List item two'];
        }
        setBlocks(prev => [...prev, newBlock]);
        setSelectedBlockId(newBlock.id);
        setSidebarTab('properties');
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
        if (!firestore) return;
        if (!name.trim()) {
            toast({ variant: 'destructive', title: 'Name Required', description: 'Please provide a name for this template.' });
            return;
        }
        setIsSubmitting(true);

        const contentForExtraction = `${subject} ${body} ${JSON.stringify(blocks)}`;
        const varMatches = contentForExtraction.match(/\{\{(.*?)\}\}/g);
        const variableList = varMatches ? [...new Set(varMatches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];

        const templateData: any = {
            name: name.trim(),
            category,
            channel,
            body: body.trim(),
            variables: variableList,
            isActive: true,
            updatedAt: new Date().toISOString(),
        };

        if (channel === 'email') {
            templateData.subject = subject.trim();
            templateData.previewText = previewText.trim();
            templateData.blocks = blocks;
            templateData.styleId = styleId !== 'none' ? styleId : null;
        }

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
        } catch (e: any) {
            console.error("Save Failed:", e);
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloneClick = async (template: MessageTemplate) => {
        if (!user) return;
        setCloningId(template.id);
        toast({ title: 'Protocol Cloning', description: `Creating replica of "${template.name}"...` });
        
        const result = await cloneTemplate(template.id, user.uid);
        if (result.success) {
            toast({ title: 'Clone Successful', description: 'New template initialized in directory.' });
        } else {
            toast({ variant: 'destructive', title: 'Clone Failed', description: result.error });
        }
        cloningId && setCloningId(null);
    };

    const handleDelete = async () => {
        if (!firestore || !templateToDelete) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'message_templates', templateToDelete.id));
            toast({ title: 'Template Removed', description: `"${templateToDelete.name}" has been deleted.` });
            setTemplateToDelete(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Deletion Failed', description: e.message });
        } finally {
            setIsDeleting(false);
        }
    };

    const resetForm = () => {
        setName('');
        setBody('');
        setSubject('');
        setPreviewText('');
        setBlocks([]);
        setStyleId('none');
        setCategory('general');
        setChannel('email');
        setSimEntity('none');
        setSimRecordId('none');
        setStep(1);
        setIsFullScreen(false);
        setSelectedBlockId(null);
        setSidebarTab('blocks');
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
        setStyleId(template.styleId || 'none');
        setEditorMode(template.blocks?.length ? 'designer' : 'code');
        setIsAdding(true);
        setStep(1);
    };

    const handleStepChange = (target: number) => {
        if (target > step && step === 1 && !name) {
            toast({ variant: 'destructive', title: 'Identity Required', description: 'Please provide a name for the template.' });
            return;
        }
        setStep(target);
    };

    const resolvedPreview = React.useCallback((tmpl: MessageTemplate | null, vars: Record<string, any>) => {
        if (!tmpl || !tmpl.body) return '';
        let finalBody = resolveVariables(tmpl.body, vars);
        
        if (tmpl.channel === 'email' && tmpl.styleId && tmpl.styleId !== 'none') {
            const selectedStyle = styles?.find(s => s.id === tmpl.styleId);
            if (selectedStyle && selectedStyle.htmlWrapper && selectedStyle.htmlWrapper.includes('{{content}}')) {
                finalBody = selectedStyle.htmlWrapper.replace('{{content}}', finalBody);
            }
        }
        
        return finalBody;
    }, [styles]);

    const filteredTemplates = templates?.filter(t => 
        (categoryFilter === 'all' || t.category === categoryFilter) &&
        (channelFilter === 'all' || t.channel === channelFilter) &&
        (t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.body.toLowerCase().includes(searchTerm.toLowerCase()))
    ) || [];

    const filteredVars = React.useMemo(() => {
        if (!variables) return [];
        const result = variables.filter(v => (v.category === 'general' || v.category === category) && !v.hidden);
        
        // Prioritize specific survey metrics at the top
        return result.sort((a, b) => {
            const aIsMetric = a.entity === 'SurveyResponse' && ['survey_score', 'max_score', 'outcome_label', 'result_url'].includes(a.key);
            const bIsMetric = b.entity === 'SurveyResponse' && ['survey_score', 'max_score', 'outcome_label', 'result_url'].includes(b.key);
            if (aIsMetric && !bIsMetric) return -1;
            if (!aIsMetric && bIsMetric) return 1;
            return a.label.localeCompare(b.label);
        });
    }, [variables, category]);

    const selectedBlock = React.useMemo(() => blocks.find(b => b.id === selectedBlockId), [blocks, selectedBlockId]);

    const stepTransition = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { type: 'spring', damping: 25, stiffness: 200 }
    };

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

    const BlockLibraryTile = ({ icon: Icon, label, onClick }: { icon: React.ElementType, label: string, onClick: () => void }) => (
        <button
            type="button"
            onClick={onClick}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/50 bg-background hover:border-primary/40 hover:bg-primary/5 transition-all group aspect-square"
        >
            <div className="p-2.5 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors mb-2">
                <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-tight text-foreground/70 group-hover:text-primary">{label}</span>
        </button>
    );

    return (
        <div className="h-full flex flex-col bg-muted/5 overflow-hidden">
            {!isAdding && (
                <div className="shrink-0 p-4 sm:p-6 md:p-8 border-b bg-background shadow-sm z-20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <FileType className="h-5 w-5 text-primary" />
                            </div>
                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest leading-none">
                                Messaging Templates
                            </p>
                        </div>
                        <Button onClick={() => { resetForm(); setIsAdding(true); }} className="rounded-xl font-black shadow-lg uppercase tracking-widest px-8 h-11 transition-all active:scale-95">
                            <Plus className="mr-2 h-5 w-5" /> New Template
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-hidden flex flex-col">
                {isAdding ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="bg-background border-b pt-6 shrink-0 flex items-center justify-between px-8">
                            <Stepper currentStep={step} onStepClick={handleStepChange} />
                            <div className="flex items-center gap-3 pb-6">
                                <Button variant="ghost" onClick={() => setIsAdding(false)} className="font-bold h-11">Discard</Button>
                                <Button onClick={handleSave} disabled={isSubmitting || !name} className="rounded-xl font-black px-10 shadow-xl bg-primary text-white h-11 transition-all active:scale-95">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Commit Changes
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 relative overflow-hidden">
                            <AnimatePresence mode="wait">
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
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Template Name (Internal)</Label>
                                                        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Admission Confirmation" className="flex h-14 w-full rounded-2xl border-none bg-muted/20 px-6 py-2 text-xl font-black shadow-inner ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 transition-all" />
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
                                                                    <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Welcome to {{school_name}}" className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 transition-all font-bold text-lg px-6" />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Preview Text (Preheader)</Label>
                                                                    <Input value={previewText} onChange={e => setPreviewText(e.target.value)} placeholder="Brief summary..." className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 transition-all font-medium text-sm px-6" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardContent>
                                                <CardFooter className="bg-muted/30 p-8 border-t justify-end">
                                                    <Button size="lg" onClick={() => handleStepChange(2)} disabled={!name} className="px-12 rounded-2xl font-black h-14 uppercase tracking-widest group shadow-xl">
                                                        Continue to Workshop <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        </div>
                                    </motion.div>
                                )}

                                {step === 2 && (
                                    <motion.div key="step2" {...stepTransition} className={cn("absolute inset-0 flex select-none bg-background transition-all duration-500", isFullScreen && "fixed inset-0 z-[100] h-screen w-screen")}>
                                        <div className="border-r bg-background flex flex-col shrink-0 relative transition-all duration-300" style={{ width: variablesWidth }}>
                                            <Tabs value={sidebarTab} onValueChange={(v: any) => setSidebarTab(v)} className="flex-1 flex flex-col min-h-0">
                                                <div className="px-2 py-2 border-b bg-muted/10 shrink-0">
                                                    {channel === 'email' ? (
                                                        <TabsList className="grid w-full grid-cols-3 h-10 bg-muted/50 p-1 rounded-xl">
                                                            <TabsTrigger value="blocks" className="text-[9px] font-black uppercase tracking-widest gap-1.5"><Layout className="h-3 w-3" /> Blocks</TabsTrigger>
                                                            <TabsTrigger value="tags" className="text-[9px] font-black uppercase tracking-widest gap-1.5"><Database className="h-3 w-3" /> Tags</TabsTrigger>
                                                            <TabsTrigger value="properties" className="text-[9px] font-black uppercase tracking-widest gap-1.5"><Settings className="h-3 w-3" /> Props</TabsTrigger>
                                                        </TabsList>
                                                    ) : (
                                                        <div className="flex items-center gap-2 px-2 h-10">
                                                            <Database className="h-4 w-4 text-primary" />
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Contextual Registry</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {channel === 'email' && (
                                                    <TabsContent value="blocks" className="m-0 overflow-hidden data-[state=active]:flex flex-col flex-1 bg-muted/5 border-t">
                                                        <ScrollArea className="flex-1 h-full">
                                                            <div className="p-4 pt-2 space-y-8">
                                                                <div className="space-y-4">
                                                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Core Typography</h3>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <BlockLibraryTile icon={Heading1} label="Heading" onClick={() => handleAddBlock('heading', 'h1')} />
                                                                        <BlockLibraryTile icon={Type} label="Subheading" onClick={() => handleAddBlock('heading', 'h2')} />
                                                                        <BlockLibraryTile icon={PenTool} label="Content" onClick={() => handleAddBlock('text')} />
                                                                        <BlockLibraryTile icon={Quote} label="Quote" onClick={() => handleAddBlock('quote')} />
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-4">
                                                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Media & Interaction</h3>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <BlockLibraryTile icon={ImageIcon} label="Image" onClick={() => handleAddBlock('image')} />
                                                                        <BlockLibraryTile icon={MousePointer2} label="Button" onClick={() => handleAddBlock('button')} />
                                                                        <BlockLibraryTile icon={List} label="List" onClick={() => handleAddBlock('list')} />
                                                                        <BlockLibraryTile icon={Trophy} label="Score Card" onClick={() => handleAddBlock('score-card')} />
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-4">
                                                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Structural</h3>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <BlockLibraryTile icon={Square} label="Divider" onClick={() => handleAddBlock('divider')} />
                                                                        <BlockLibraryTile icon={Layout} label="Footer" onClick={() => handleAddBlock('footer')} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </ScrollArea>
                                                    </TabsContent>
                                                )}
                                                <TabsContent value="tags" className="m-0 overflow-hidden data-[state=active]:flex flex-col flex-1 bg-muted/5 border-t">
                                                    <ScrollArea className="flex-1 h-full">
                                                        <div className="p-4 pt-2 space-y-2">
                                                            {filteredVars.length > 0 ? filteredVars.map(v => {
                                                                const isMetric = v.entity === 'SurveyResponse' && ['survey_score', 'max_score', 'outcome_label', 'result_url'].includes(v.key);
                                                                return (
                                                                    <button key={v.id} type="button" onClick={() => { const tag = `{{${v.key}}}`; navigator.clipboard.writeText(tag); toast({ title: 'Tag Copied' }); }} className={cn(
                                                                        "w-full text-left p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all group",
                                                                        isMetric && "bg-primary/5 border-primary/10 shadow-inner"
                                                                    )}>
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <span className={cn("text-[8px] font-black uppercase tracking-widest", isMetric ? "text-primary" : "text-muted-foreground opacity-60")}>
                                                                                {isMetric ? 'Metric' : (v.sourceName || 'Core')}
                                                                            </span>
                                                                            <Copy className="h-2.5 w-2.5 text-primary opacity-0 group-hover:opacity-100" />
                                                                        </div>
                                                                        <p className="text-xs font-bold truncate text-foreground/80">{v.label}</p>
                                                                        <code className="text-[9px] font-mono text-primary/60 mt-1 block">{"{{" + v.key + "}}"}</code>
                                                                    </button>
                                                                );
                                                            }) : (
                                                                <div className="py-20 text-center opacity-30 px-4">
                                                                    <Database className="h-8 w-8 mx-auto mb-2" />
                                                                    <p className="text-[10px] font-black uppercase tracking-widest">No tags found</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </ScrollArea>
                                                </TabsContent>
                                                {channel === 'email' && (
                                                    <TabsContent value="properties" className="m-0 overflow-hidden data-[state=active]:flex flex-col flex-1 bg-muted/5 border-t">
                                                        <ScrollArea className="flex-1 h-full">
                                                            <div className="p-4 pt-2">
                                                                {selectedBlock ? (
                                                                    <div className="space-y-4">
                                                                        <div className="flex items-center gap-3 pb-4 border-b">
                                                                            <div className="p-2 bg-primary text-white rounded-xl shadow-lg">{React.createElement(blockIcons[selectedBlock.type] || Type, { className: "h-5 w-5" })}</div>
                                                                            <div><h3 className="font-black uppercase text-xs tracking-widest">{selectedBlock.type}</h3><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Configuration</p></div>
                                                                        </div>
                                                                        <GlobalBlockInspector block={selectedBlock} variables={variables || []} onUpdate={(u) => setBlocks(prev => prev.map(b => b.id === selectedBlock.id ? { ...b, ...u } : b))} />
                                                                    </div>
                                                                ) : (
                                                                    <div className="py-20 text-center space-y-4"><div className="mx-auto w-12 h-12 rounded-2xl bg-muted/50 border flex items-center justify-center text-muted-foreground/30"><Layout className="h-6 w-6" /></div><p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">Select a block on the canvas<br/>to edit its properties</p></div>
                                                                )}
                                                            </div>
                                                        </ScrollArea>
                                                    </TabsContent>
                                                )}
                                            </Tabs>
                                            <div className={cn("absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize z-50 transition-colors", isResizing ? "bg-primary/40" : "hover:bg-primary/20")} onMouseDown={handleMouseDown} />
                                        </div>

                                        <div className="flex-1 flex flex-col bg-muted/10 min-w-0 relative">
                                            <div className="p-4 border-b bg-background shrink-0 flex items-center justify-between z-20 shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    {channel === 'email' && (
                                                        <Tabs value={editorMode} onValueChange={(v: any) => handleEditorTabChange(v)} className="w-fit">
                                                            <TabsList className="bg-muted/50 p-1 rounded-xl h-9 border">
                                                                <TabsTrigger value="designer" className="text-[9px] font-black uppercase tracking-widest gap-1.5"><Layout className="h-3 w-3" /> Designer</TabsTrigger>
                                                                <TabsTrigger value="code" className="text-[9px] font-black uppercase tracking-widest gap-1.5"><Code className="h-3 w-3" /> Code</TabsTrigger>
                                                            </TabsList>
                                                        </Tabs>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {channel === 'email' && (
                                                        <div className="flex items-center gap-2 mr-2">
                                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Style Wrapper:</Label>
                                                            <Select value={styleId} onValueChange={setStyleId}>
                                                                <SelectTrigger className="h-9 w-40 rounded-xl bg-muted/20 border-none font-bold text-xs">
                                                                    <SelectValue placeholder="Standard Shell" />
                                                                </SelectTrigger>
                                                                <SelectContent className="rounded-xl">
                                                                    <SelectItem value="none">No Wrapper (Raw)</SelectItem>
                                                                    {styles?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}
                                                    <Button variant="ghost" size="sm" onClick={() => setIsFullScreen(!isFullScreen)} className={cn("h-9 rounded-xl font-bold gap-2 text-xs", isFullScreen && "text-primary bg-primary/5")}>{isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}{isFullScreen ? 'Exit Zen Mode' : 'Zen Mode'}</Button>
                                                    <Button variant="outline" size="sm" onClick={() => setStep(3)} className="h-9 rounded-xl font-bold gap-2 text-xs border-primary/20 hover:bg-primary/5 text-primary"><Eye className="h-4 w-4" /> Simulation Studio</Button>
                                                </div>
                                            </div>

                                            <ScrollArea className="flex-1" onClick={() => setSelectedBlockId(null)}>
                                                <div className="max-w-4xl mx-auto p-8 pb-64">
                                                    {channel === 'email' && editorMode === 'designer' ? (
                                                        <div className="space-y-12">
                                                            <div className="max-w-[600px] mx-auto bg-white shadow-2xl rounded-[2.5rem] border border-border/50 min-h-[800px] relative overflow-hidden ring-1 ring-black/5">
                                                                <div className="h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
                                                                <div className="p-12 space-y-2">
                                                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                                                        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                                                            <div className="space-y-4">
                                                                                {blocks.map((block, idx) => (
                                                                                    <SortableBlockItem 
                                                                                        key={block.id} id={block.id} index={idx} block={block} isSelected={selectedBlockId === block.id} simulationVars={simVariables}
                                                                                        onSelect={() => { setSelectedBlockId(block.id); setSidebarTab('properties'); }}
                                                                                        onRemove={() => setBlocks(prev => prev.filter(b => b.id !== block.id))}
                                                                                        onDuplicate={() => { const newBlock = { ...block, id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` }; const next = [...blocks]; next.splice(idx + 1, 0, newBlock); setBlocks(next); }}
                                                                                    />
                                                                                ))}
                                                                            </div>
                                                                        </SortableContext>
                                                                    </DndContext>
                                                                    {blocks.length === 0 && <div className="py-32 flex flex-col items-center justify-center text-center gap-4 opacity-30"><SmartSappIcon className="h-16 w-16" /><p className="font-black uppercase tracking-widest text-xs">Awaiting Architecture</p></div>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-6">
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{channel === 'sms' ? 'Handset Payload' : 'Source Code Editor'}</Label>
                                                                <div className={cn("p-1 rounded-[2.5rem] shadow-2xl transition-colors", channel === 'email' ? "bg-slate-900" : "bg-slate-100 border border-slate-200")}>
                                                                    <Textarea 
                                                                        value={body} 
                                                                        onChange={e => handleCodeChange(e.target.value)} 
                                                                        className={cn(
                                                                            "min-h-[600px] rounded-[2rem] font-mono text-sm leading-relaxed p-10 border-none shadow-none focus-visible:ring-0 selection:bg-blue-500/30",
                                                                            channel === 'email' ? "bg-slate-900 text-blue-400" : "bg-white text-slate-900"
                                                                        )}
                                                                        placeholder={channel === 'sms' ? "Hi {{contact_name}}..." : "<html><body>...</body></html>"}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    </motion.div>
                                )}

                                {step === 3 && (
                                    <motion.div key="step3" {...stepTransition} className="absolute inset-0 flex flex-col bg-slate-50">
                                        <div className="p-6 border-b bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-sm z-10">
                                            <div className="flex items-center gap-6">
                                                <div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><MonitorPlay className="h-5 w-5 text-primary" /></div><div><h3 className="text-sm font-black uppercase tracking-tight">Simulation Studio</h3><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Live data record binding</p></div></div>
                                                <Separator orientation="vertical" className="h-10 hidden sm:block" />
                                                <div className="flex items-center gap-3">
                                                    <Select value={simEntity} onValueChange={(v: any) => { setSimEntity(v); setSimRecordId('none'); }}>
                                                        <SelectTrigger className="h-10 w-[160px] rounded-xl bg-muted/20 border-none font-black text-[10px] uppercase tracking-widest"><SelectValue placeholder="Pick Source..." /></SelectTrigger>
                                                        <SelectContent className="rounded-xl"><SelectItem value="none">Empty State</SelectItem><SelectItem value="School">School Directory</SelectItem><SelectItem value="Meeting">Meeting Record</SelectItem><SelectItem value="Survey">Survey Result</SelectItem><SelectItem value="Submission">Doc Signing Submission</SelectItem></SelectContent>
                                                    </Select>
                                                    {simEntity !== 'none' && (
                                                        <Select value={simRecordId} onValueChange={setSimRecordId}>
                                                            <SelectTrigger className="h-10 w-[200px] rounded-xl bg-muted/20 border-none font-bold text-xs"><SelectValue placeholder="Pick Record..." /></SelectTrigger>
                                                            <SelectContent className="rounded-xl"><SelectItem value="none">Select Instance...</SelectItem>{simEntity === 'School' && simSchools?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}{simEntity === 'Meeting' && simMeetings?.map(m => <SelectItem key={m.id} value={m.id}>{m.schoolName} - {m.type.name}</SelectItem>)}{simEntity === 'Survey' && simSurveys?.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}{simEntity === 'Submission' && simPdfs?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border"><Button variant={previewDevice === 'desktop' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2 rounded-lg font-black text-[10px] uppercase" onClick={() => setPreviewDevice('desktop')}><Monitor className="h-3.5 w-3.5" /> Desktop</Button><Button variant={previewDevice === 'mobile' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2 rounded-lg font-black text-[10px] uppercase" onClick={() => setPreviewDevice('mobile')}><PhoneIcon className="h-3.5 w-3.5" /> Mobile</Button></div>
                                        </div>
                                        <div className="flex-1 overflow-auto p-8 flex justify-center">
                                            <div className={cn("transition-all duration-700 bg-white shadow-2xl rounded-[2.5rem] overflow-hidden border-8 border-white relative", previewDevice === 'mobile' ? "w-[375px] h-[667px]" : "w-full max-w-4xl", channel === 'sms' && "p-12 flex flex-col justify-center items-center")}>
                                                {isSimLoading && <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center flex-col gap-4"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Synchronizing Data Hub...</p></div>}
                                                {channel === 'sms' ? (
                                                    <div className="w-full max-w-sm space-y-10 animate-in zoom-in-95 duration-700">
                                                        <div className="flex items-center justify-between opacity-20">
                                                            <Zap className="text-primary h-6 w-6" />
                                                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">SMS Uplink Simulation</span>
                                                        </div>
                                                        <div className="p-8 bg-white border border-slate-200 rounded-[2rem] relative shadow-xl">
                                                            <div className="absolute -left-3 top-10 w-6 h-6 bg-white border-l border-b border-slate-200 rotate-45 rounded-sm" />
                                                            <p className="text-lg text-slate-900 font-bold whitespace-pre-wrap leading-relaxed">{resolvedPreview(currentTemplateData, simVariables)}</p>
                                                        </div>
                                                        <div className="pt-8 border-t border-slate-100 text-center">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">~ {Math.ceil(resolvedPreview(currentTemplateData, simVariables).length / 160)} SMS Segments</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col h-full animate-in fade-in duration-1000"><div className="p-8 bg-muted/20 border-b space-y-2"><span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40">Resolved Subject Payload</span><p className="font-black text-xl text-foreground">{resolveVariables(subject, simVariables) || '(No Subject)'}</p></div><iframe srcDoc={resolvedPreview(currentTemplateData, simVariables)} className="flex-1 w-full border-none bg-white" title="High Fidelity Preview" /></div>
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
                                <div className="relative flex-grow w-full"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" /><Input placeholder="Filter blueprints..." className="pl-11 h-12 rounded-2xl bg-muted/20 border-none font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <Select value={channelFilter} onValueChange={setChannelFilter}>
                                        <SelectTrigger className="h-12 w-full md:w-[160px] rounded-2xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest transition-all hover:bg-muted/40">
                                            <SelectValue placeholder="Channel" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="all">All Channels</SelectItem>
                                            <SelectItem value="email">Email Only</SelectItem>
                                            <SelectItem value="sms">SMS Only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                        <SelectTrigger className="h-12 w-full md:w-[160px] rounded-2xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest transition-all hover:bg-muted/40">
                                            <SelectValue placeholder="Category" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="all">All Categories</SelectItem>
                                            <SelectItem value="general">General</SelectItem>
                                            <SelectItem value="meetings">Meetings</SelectItem>
                                            <SelectItem value="surveys">Surveys</SelectItem>
                                            <SelectItem value="forms">Doc Signing</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {isLoadingTemplates ? Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-64 animate-pulse bg-muted rounded-2xl" />) : filteredTemplates.length > 0 ? filteredTemplates.map(template => (
                                    <Card key={template.id} className="group relative border-2 transition-all duration-500 rounded-2xl overflow-hidden bg-card shadow-sm hover:shadow-2xl border-border/50 flex flex-col h-[420px]">
                                        {/* MANAGEMENT HEADROOM */}
                                        <div className="h-12 shrink-0 border-b flex items-center justify-between px-4 bg-muted/5 group-hover:bg-background transition-colors duration-500">
                                            <div className="flex items-center gap-1.5">
                                                <div className={cn("p-1.5 rounded-lg border", template.channel === 'sms' ? "bg-orange-500/10 text-orange-500 border-orange-100" : "bg-blue-500/10 text-blue-500 border-blue-100")}>
                                                    {template.channel === 'sms' ? <Smartphone className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                                                </div>
                                                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{template.channel} Template</span>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 text-primary" title="Preview" onClick={() => setPreviewTemplate(template)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 text-primary" title="Edit" onClick={() => handleEditClick(template)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg hover:bg-primary/10 text-primary", cloningId === template.id && "animate-spin")} title="Clone" onClick={() => handleCloneClick(template)} disabled={!!cloningId}>
                                                    <CopyPlus className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" title="Delete" onClick={() => setTemplateToDelete(template)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        
                                        {/* PREVIEW CANVAS */}
                                        <div className="flex-1 overflow-hidden relative bg-white flex flex-col items-center justify-center p-1.5">
                                            {template.channel === 'email' ? (
                                                <div className="w-full h-full relative overflow-hidden bg-slate-50 border rounded-xl shadow-inner flex justify-center">
                                                    <div className="absolute inset-0 transform origin-top scale-[0.45] w-[222%] h-[222%] pointer-events-none p-4">
                                                        <iframe 
                                                            srcDoc={template.body} 
                                                            className="w-full h-full border-none bg-white rounded-3xl pointer-events-none shadow-xl" 
                                                            title="preview"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-full h-full bg-white rounded-xl p-6 flex flex-col justify-center gap-4 relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-500 border border-slate-100 shadow-inner">
                                                    <div className="absolute -right-4 -top-4 opacity-5 rotate-12 text-primary">
                                                        <Zap size={120} />
                                                    </div>
                                                    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xl backdrop-blur-sm">
                                                        <p className="text-[9px] font-bold text-slate-900 leading-relaxed line-clamp-[8] italic">&ldquo;{template.body}&rdquo;</p>
                                                    </div>
                                                    <div className="flex items-center justify-between opacity-20 border-t border-slate-200 pt-3">
                                                        <SmartSappIcon className="h-3.5 w-3.5" variant="primary" />
                                                        <span className="text-[7px] font-black uppercase tracking-widest text-slate-900">Handset Simulator</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-transparent z-10" />
                                        </div>

                                        {/* FOOTER */}
                                        <CardHeader className="p-5 shrink-0 bg-background border-t">
                                            <div className="min-w-0">
                                                <CardTitle className="text-sm font-black truncate text-foreground group-hover:text-primary transition-colors leading-tight">{template.name}</CardTitle>
                                                <p className="text-[8px] uppercase font-bold tracking-[0.2em] text-muted-foreground opacity-60 mt-1">{template.category === 'forms' ? 'Doc Signing' : template.category}</p>
                                            </div>
                                        </CardHeader>
                                    </Card>
                                )) : <div className="col-span-full py-32 text-center border-4 border-dashed rounded-[4rem] bg-muted/5 flex flex-col items-center justify-center gap-4"><FileType className="h-16 w-16 text-muted-foreground/20" /><p className="text-muted-foreground font-black uppercase tracking-widest text-sm">No protocol blueprints found.</p></div>}
                            </div>
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* QUICK PREVIEW MODAL */}
            <Dialog open={!!previewTemplate} onOpenChange={(o) => !o && setPreviewTemplate(null)}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-none shadow-2xl">
                    <DialogHeader className="p-6 border-b bg-white shrink-0 flex flex-row items-center justify-between space-y-0 pr-12">
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight">{previewTemplate?.name}</DialogTitle>
                            <DialogDescription className="text-xs font-bold uppercase tracking-widest">Global Template Preview</DialogDescription>
                        </div>
                        <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border">
                            <Button variant={previewDevice === 'desktop' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2 rounded-lg font-black text-[10px] uppercase" onClick={() => setPreviewDevice('desktop')}>
                                <Monitor className="h-3.5 w-3.5" /> Desktop
                            </Button>
                            <Button variant={previewDevice === 'mobile' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-2 rounded-lg font-black text-[10px] uppercase" onClick={() => setPreviewDevice('mobile')}>
                                <PhoneIcon className="h-3.5 w-3.5" /> Mobile
                            </Button>
                        </div>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden relative p-8 flex justify-center">
                        <div className={cn(
                            "transition-all duration-700 bg-white shadow-2xl rounded-[2.5rem] overflow-hidden border-8 border-white relative",
                            previewDevice === 'mobile' ? "w-[375px] h-full" : "w-full max-w-4xl",
                            previewTemplate?.channel === 'sms' && "p-12 flex flex-col justify-center items-center"
                        )}>
                            {previewTemplate?.channel === 'sms' ? (
                                <div className="w-full max-w-sm space-y-10">
                                    <div className="flex items-center justify-between opacity-20">
                                        <Zap className="text-primary h-6 w-6" />
                                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">SMS Uplink</span>
                                    </div>
                                    <div className="p-8 bg-white border border-slate-200 rounded-[2rem] relative shadow-xl">
                                        <div className="absolute -left-3 top-10 w-6 h-6 bg-white border-l border-b border-slate-200 rotate-45 rounded-sm" />
                                        <p className="text-lg text-slate-900 font-bold whitespace-pre-wrap leading-relaxed">{resolvedPreview(previewTemplate, {})}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full bg-white">
                                    <div className="p-8 bg-muted/20 border-b space-y-2"><span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40">Subject Line</span><p className="font-black text-xl text-foreground">{previewTemplate?.subject || '(No Subject)'}</p></div>
                                    <iframe srcDoc={resolvedPreview(previewTemplate!, {})} className="flex-1 w-full border-none bg-white" title="High Fidelity Preview" />
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <DialogFooter className="p-4 bg-white border-t shrink-0">
                        <Button onClick={() => setPreviewTemplate(null)} className="rounded-xl font-bold px-8">Close Preview</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!templateToDelete} onOpenChange={(o) => !o && setTemplateToDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black text-xl uppercase tracking-tight">Delete Template?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium">
                            This will permanently remove the template <span className="font-bold text-foreground">&ldquo;{templateToDelete?.name}&rdquo;</span> from the institutional library. Any automations currently referencing this blueprint may fail.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="rounded-xl font-bold">Retain Template</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDelete} 
                            disabled={isDeleting}
                            className="rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xl"
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Permanently Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
