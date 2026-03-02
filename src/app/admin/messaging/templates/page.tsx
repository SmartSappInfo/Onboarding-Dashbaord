'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc, where, getDocs, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { MessageTemplate, MessageStyle, VariableDefinition, MessageBlock, MessageBlockRule, SurveyResultPage, School, Meeting, Survey } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
    FileType, Plus, Trash2, Mail, Smartphone, X, Loader2, ArrowLeft, 
    Search, LayoutGrid, ListTree, Eye, Sparkles, Check, Pencil, 
    Database, Tag, Library, Save, ShieldAlert, GripVertical, Heading1, 
    Type, Image as ImageIcon, Video, MousePointer2, Quote, Square, 
    PlusCircle, ArrowUp, ArrowDown, Bold, Italic, Underline,
    AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Layers,
    ChevronDown, Layout, Trophy as TrophyIcon, Zap, Filter,
    MonitorPlay,
    Bug,
    ShieldCheck,
    Wand2,
    Palette,
    Info,
    Copy
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SmartSappIcon } from '@/components/icons';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MediaSelect } from '../../schools/components/media-select';
import { renderBlocksToHtml, resolveVariables, shouldShowBlock } from '@/lib/messaging-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchContextualData } from '@/lib/messaging-actions';
import { generateEmailTemplate } from '@/ai/flows/generate-email-template-flow';

const blockIcons: Record<string, React.ElementType> = {
    heading: Heading1,
    text: Type,
    list: List,
    image: ImageIcon,
    video: Video,
    button: MousePointer2,
    quote: Quote,
    divider: Square,
    header: Layers,
    footer: Layers,
    logo: SmartSappIcon,
    columns: Layout,
    'score-card': TrophyIcon,
};

type GroupByOption = 'none' | 'category' | 'channel';

// --- SUB-COMPONENTS ---

function BlockLogicEditor({ 
    block, 
    variables, 
    onChange 
}: { 
    block: MessageBlock, 
    variables: VariableDefinition[], 
    onChange: (logic: MessageBlock['visibilityLogic']) => void 
}) {
    const logic = block.visibilityLogic || { rules: [], matchType: 'all' };

    const addRule = () => {
        const newRule: MessageBlockRule = { variableKey: variables[0]?.key || '', operator: 'isEqualTo', value: '' };
        onChange({ ...logic, rules: [...logic.rules, newRule] });
    };

    const removeRule = (idx: number) => {
        const newRules = logic.rules.filter((_, i) => i !== idx);
        onChange({ ...logic, rules: newRules });
    };

    const updateRule = (idx: number, props: Partial<MessageBlockRule>) => {
        const newRules = [...logic.rules];
        newRules[idx] = { ...newRules[idx], ...props };
        onChange({ ...logic, rules: newRules });
    };

    return (
        <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] h-5 px-2 font-black uppercase">Block Logic</Badge>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Define conditional visibility</p>
                </div>
                {logic.rules.length > 1 && (
                    <Select value={logic.matchType} onValueChange={(v: any) => onChange({ ...logic, matchType: v })}>
                        <SelectTrigger className="h-6 w-20 text-[8px] font-black uppercase bg-muted/50 border-none">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Match All</SelectItem>
                            <SelectItem value="any">Match Any</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            </div>

            {logic.rules.length > 0 ? (
                <div className="space-y-3">
                    {logic.rules.map((rule, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-muted/20 border border-border/50 relative group/rule">
                            <div className="grid grid-cols-1 gap-2">
                                <div className="flex items-center gap-2">
                                    <Select value={rule.variableKey} onValueChange={(v) => updateRule(idx, { variableKey: v })}>
                                        <SelectTrigger className="h-8 text-[10px] font-bold bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {variables.map(v => <SelectItem key={v.id} value={v.key}>{v.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select value={rule.operator} onValueChange={(v: any) => updateRule(idx, { operator: v })}>
                                        <SelectTrigger className="h-8 text-[10px] font-bold bg-white w-28">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="isEqualTo">Is</SelectItem>
                                            <SelectItem value="isNotEqualTo">Is not</SelectItem>
                                            <SelectItem value="contains">Contains</SelectItem>
                                            <SelectItem value="isGreaterThan">&gt;</SelectItem>
                                            <SelectItem value="isLessThan">&lt;</SelectItem>
                                            <SelectItem value="isEmpty">Empty</SelectItem>
                                            <SelectItem value="isNotEmpty">Not Empty</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {rule.operator !== 'isEmpty' && rule.operator !== 'isNotEmpty' && (
                                    <Input 
                                        value={rule.value} 
                                        onChange={e => updateRule(idx, { value: e.target.value })} 
                                        placeholder="Compare to value..." 
                                        className="h-8 text-[10px] bg-white"
                                    />
                                )}
                            </div>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border opacity-0 group-hover/rule:opacity-100 transition-opacity"
                                onClick={() => removeRule(idx)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="py-6 text-center border-2 border-dashed rounded-xl bg-muted/10">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mb-3">No active logic</p>
                    <Button type="button" variant="outline" size="sm" onClick={addRule} className="h-7 text-[9px] font-black uppercase rounded-lg gap-1.5">
                        <Plus className="h-3 w-3" /> Add Logic Condition
                    </Button>
                </div>
            )}
            
            {logic.rules.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={addRule} className="w-full h-8 text-[9px] font-black uppercase text-primary hover:bg-primary/5">
                    <Plus className="h-3 w-3 mr-1.5" /> Add Another Condition
                </Button>
            )}
        </div>
    );
}

function ColumnEditor({ 
    block, 
    variables, 
    onChange 
}: { 
    block: MessageBlock, 
    variables: VariableDefinition[], 
    onChange: (props: Partial<MessageBlock>) => void 
}) {
    const columns = block.columns || [{ blocks: [] }];

    const updateColumn = (colIdx: number, blocks: MessageBlock[]) => {
        const newCols = [...columns];
        newCols[colIdx] = { ...newCols[colIdx], blocks };
        onChange({ columns: newCols });
    };

    const addColumn = () => {
        onChange({ columns: [...columns, { blocks: [] }] });
    };

    const removeColumn = (idx: number) => {
        onChange({ columns: columns.filter((_, i) => i !== idx) });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Columns ({columns.length})</Label>
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={addColumn} 
                    disabled={columns.length >= 3}
                    className="h-7 rounded-lg text-[9px] font-black uppercase"
                >
                    <Plus className="h-3 w-3 mr-1" /> Add Col
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {columns.map((col, cIdx) => (
                    <div key={cIdx} className="p-4 rounded-xl border border-dashed bg-muted/20 relative group/col">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[9px] font-black uppercase text-primary/60 tracking-widest">Column #{cIdx + 1}</span>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-destructive opacity-0 group-hover/col:opacity-100" 
                                onClick={() => removeColumn(cIdx)}
                                disabled={columns.length === 1}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                        
                        <div className="space-y-3">
                            {col.blocks.map((innerBlock, bIdx) => (
                                <div key={innerBlock.id} className="p-2.5 rounded-lg bg-white border shadow-sm flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {React.createElement(blockIcons[innerBlock.type] || Type, { className: "h-3 w-3 text-muted-foreground" })}
                                        <span className="text-[10px] font-bold truncate">{innerBlock.title || innerBlock.type}</span>
                                    </div>
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-5 w-5 text-destructive" 
                                        onClick={() => updateColumn(cIdx, col.blocks.filter((_, i) => i !== bIdx))}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                            
                            <Select onValueChange={(type: any) => {
                                const newBlock: MessageBlock = { id: `blk_${Date.now()}`, type, title: `New ${type}`, content: '', style: { textAlign: 'left' } };
                                updateColumn(cIdx, [...col.blocks, newBlock]);
                            }}>
                                <SelectTrigger className="h-8 border-dashed bg-white/50 text-[9px] font-black uppercase">
                                    <SelectValue placeholder="+ Add Inner Block" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="heading">Heading</SelectItem>
                                    <SelectItem value="text">Text</SelectItem>
                                    <SelectItem value="image">Image</SelectItem>
                                    <SelectItem value="button">Button</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

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
        <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-8 bg-muted/50 p-1 mb-4">
                <TabsTrigger value="content" className="text-[9px] font-black uppercase tracking-widest">Content</TabsTrigger>
                <TabsTrigger value="logic" className="text-[9px] font-black uppercase tracking-widest gap-1.5">
                    <Zap className={cn("h-3 w-3", block.visibilityLogic?.rules?.length ? "text-primary fill-primary/20" : "text-muted-foreground")} />
                    Logic
                </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300 m-0">
                {block.type === 'columns' ? (
                    <ColumnEditor block={block} variables={variables} onChange={onChange} />
                ) : (
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

                        {(block.type === 'header' || block.type === 'footer') && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{block.type} Content</Label>
                                <Input 
                                    value={block.content || ''} 
                                    onChange={e => onChange({ content: e.target.value })} 
                                    className="font-bold" 
                                />
                            </div>
                        )}

                        {block.type === 'logo' && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Logo Source</Label>
                                <Input 
                                    value={block.url || '{{school_logo}}'} 
                                    onChange={e => onChange({ url: e.target.value })} 
                                    className="font-mono text-xs" 
                                />
                                <p className="text-[9px] text-muted-foreground italic px-1">Defaults to School Registry logo variable.</p>
                            </div>
                        )}

                        {['image', 'video'].includes(block.type) && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Asset URL</Label>
                                <MediaSelect 
                                    value={block.url} 
                                    onValueChange={(val) => onChange({ url: val })}
                                    filterType={block.type as any}
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
                                            onClick={() => onChange({ listStyle: 'unordered' })}
                                        >
                                            <List className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button 
                                            type="button" 
                                            variant={block.listStyle === 'ordered' ? 'secondary' : 'ghost'} 
                                            size="sm" 
                                            className="h-7 rounded-md px-2"
                                            onClick={() => onChange({ listStyle: 'ordered' })}
                                        >
                                            <ListOrdered className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">List Items</Label>
                                    <div className="space-y-2">
                                        {block.items?.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <Input 
                                                    value={item} 
                                                    onChange={e => {
                                                        const newItems = [...(block.items || [])];
                                                        newItems[idx] = e.target.value;
                                                        onChange({ items: newItems });
                                                    }}
                                                    className="h-9"
                                                />
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 shrink-0 text-destructive"
                                                    onClick={() => onChange({ items: block.items?.filter((_, i) => i !== idx) })}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="sm" 
                                            className="w-full border-dashed"
                                            onClick={() => onChange({ items: [...(block.items || []), 'New item'] })}
                                        >
                                            <Plus className="h-3 w-3 mr-2" /> Add Item
                                        </Button>
                                    </div>
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
                )}
            </TabsContent>

            <TabsContent value="logic" className="m-0 animate-in fade-in slide-in-from-top-2 duration-300">
                <BlockLogicEditor 
                    block={block} 
                    variables={variables} 
                    onChange={(logic) => onChange({ visibilityLogic: logic })} 
                />
            </TabsContent>
        </Tabs>
    );
}

function SortableBlockItem({ 
    id, index, block, variables, simulationVars, onUpdate, onRemove, onDuplicate, onMoveUp, onMoveDown, onInsertVariable 
}: { 
    id: string, index: number, block: MessageBlock, variables: VariableDefinition[], simulationVars?: Record<string, any>, onUpdate: (p: Partial<MessageBlock>) => void, 
    onRemove: () => void, onDuplicate: () => void, onMoveUp: () => void, onMoveDown: () => void,
    onInsertVariable: (key: string) => void
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
                            {hasLogic && (
                                <Badge variant="secondary" className={cn(
                                    "h-4 border-none text-[7px] px-1.5 font-black uppercase flex items-center gap-1",
                                    isHiddenByLogic ? "bg-red-500 text-white" : "bg-primary text-white"
                                )}>
                                    <Zap className="h-2 w-2 fill-white" /> 
                                    {isHiddenByLogic ? 'Filtered Out' : 'Logic Active'}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/block:opacity-100 transition-all">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onMoveUp} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onMoveDown}><ArrowDown className="h-3.5 w-3.5" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4">
                    <BlockInspector block={block} variables={variables} onChange={onUpdate} />
                </CardContent>
            </Card>
            {isHiddenByLogic && (
                <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none text-center">
                    <div className="bg-red-600/90 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] rotate-[-5deg] shadow-2xl flex items-center gap-2">
                        <Bug className="h-3 w-3" /> Logic simulation: Block Hidden
                    </div>
                </div>
            )}
        </div>
    );
}

// --- MAIN PAGE ---

export default function MessageTemplatesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isAdding, setIsAdding] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<MessageTemplate | null>(null);
    
    // View State
    const [searchTerm, setSearchTerm] = React.useState('');
    const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
    const [groupBy, setGroupBy] = React.useState<GroupByOption>('none');
    const [previewTemplate, setPreviewTemplate] = React.useState<MessageTemplate | null>(null);

    // AI Generation State
    const [isAiArchitectOpen, setIsAiArchitectOpen] = React.useState(false);
    const [aiPromptText, setAiPromptText] = React.useState('');
    const [isAiGenerating, setIsAiGenerating] = React.useState(false);

    // Template State
    const [name, setName] = React.useState('');
    const [category, setCategory] = React.useState<MessageTemplate['category']>('general');
    const [channel, setChannel] = React.useState<'sms' | 'email'>('sms');
    const [subject, setSubject] = React.useState('');
    const [body, setBody] = React.useState('');
    const [blocks, setBlocks] = React.useState<MessageBlock[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Theme Engine State
    const [themeBgColor, setThemeBgColor] = React.useState('#F1F5F9');
    const [themeWidth, setThemeWidth] = React.useState('600px');

    // Simulation State
    const [simEntity, setSimEntity] = React.useState<'School' | 'Meeting' | 'Survey' | 'none'>('none');
    const [simRecordId, setSimRecordId] = React.useState('none');
    const [simVariables, setSimVariables] = React.useState<Record<string, any>>({});
    const [isSimLoading, setIsSimLoading] = React.useState(false);

    const sensors = useSensors(useSensor(PointerSensor));

    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_templates'), orderBy('createdAt', 'desc'));
    }, [firestore]);

    const varsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'messaging_variables'));
    }, [firestore]);

    const schoolsQuery = useMemoFirebase(() => {
        if (!firestore || simEntity !== 'School') return null;
        return query(collection(firestore, 'schools'), orderBy('name', 'asc'));
    }, [firestore, simEntity]);

    const meetingsQuery = useMemoFirebase(() => {
        if (!firestore || simEntity !== 'Meeting') return null;
        return query(collection(firestore, 'meetings'), orderBy('meetingTime', 'desc'));
    }, [firestore, simEntity]);

    const surveysQuery = useMemoFirebase(() => {
        if (!firestore || simEntity !== 'Survey') return null;
        return query(collection(firestore, 'surveys'), where('status', '==', 'published'));
    }, [firestore, simEntity]);

    const { data: templates, isLoading } = useCollection<MessageTemplate>(templatesQuery);
    const { data: variables } = useCollection<VariableDefinition>(varsQuery);
    const { data: simSchools } = useCollection<School>(schoolsQuery);
    const { data: simMeetings } = useCollection<Meeting>(meetingsQuery);
    const { data: simSurveys } = useCollection<Survey>(surveysQuery);

    const contextVariables = React.useMemo(() => {
        if (!variables) return [];
        const activeCategory = editingTemplate ? editingTemplate.category : category;
        const filtered = variables.filter(v => v.category === 'general' || v.category === activeCategory);
        const uniqueMap = new Map<string, VariableDefinition>();
        filtered.forEach(v => uniqueMap.set(v.key, v));
        return Array.from(uniqueMap.values());
    }, [variables, category, editingTemplate]);

    const handleAiGenerate = async () => {
        if (!aiPromptText.trim()) return;
        setIsAiGenerating(true);
        try {
            const result = await generateEmailTemplate({
                prompt: aiPromptText,
                channel,
                availableVariables: contextVariables.map(v => v.key)
            });

            setName(result.name);
            setSubject(result.subject || '');
            setBody(result.body);
            if (result.blocks) setBlocks(result.blocks as any);
            
            setIsAiArchitectOpen(false);
            setAiPromptText('');
            setIsAdding(true);
            toast({ title: 'Template Architected', description: result.explanation });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Architect Failed', description: e.message });
        } finally {
            setIsAiGenerating(false);
        }
    };

    // Handle Simulation Resolution
    React.useEffect(() => {
        const resolveSimData = async () => {
            if (simEntity === 'none' || simRecordId === 'none') {
                setSimVariables({});
                return;
            }
            setIsSimLoading(true);
            try {
                let entityType = simEntity === 'Survey' ? 'SurveyResponse' : simEntity;
                let id = simRecordId;
                let parentId = undefined;

                if (simEntity === 'Survey') {
                    const respSnap = await getDocs(query(collection(firestore!, `surveys/${simRecordId}/responses`), limit(1)));
                    if (!respSnap.empty) {
                        id = respSnap.docs[0].id;
                        parentId = simRecordId;
                    }
                }

                const result = await fetchContextualData(entityType, id, parentId);
                if (result.success && result.data) {
                    const vars: Record<string, any> = { ...result.data };
                    // Flatten for rendering
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
            id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            type,
            title: type === 'heading' ? 'New Heading' : type === 'button' ? 'Action Button' : '',
            content: type === 'text' ? 'New paragraph content...' : '',
            items: type === 'list' ? ['Point one', 'Point two'] : undefined,
            listStyle: type === 'list' ? 'unordered' : undefined,
            style: { textAlign: type === 'logo' ? 'center' : 'left' },
            variant: type === 'heading' ? 'h2' : undefined,
            columns: type === 'columns' ? [{ blocks: [] }, { blocks: [] }] : undefined,
        };
        setBlocks(prev => [...prev, newBlock]);
    };

    const handleUpdateBlock = (id: string, updates: Partial<MessageBlock>) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    };

    const handleRemoveBlock = (id: string) => {
        setBlocks(prev => prev.filter(b => b.id !== id));
    };

    const handleDuplicateBlock = (id: string) => {
        const block = blocks.find(b => b.id === id);
        if (!block) return;
        const newBlock = { ...JSON.parse(JSON.stringify(block)), id: `blk_${Date.now()}` };
        const idx = blocks.findIndex(b => b.id === id);
        const nextBlocks = [...blocks];
        nextBlocks.splice(idx + 1, 0, newBlock);
        setBlocks(nextBlocks);
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

    const handleInsertVariable = (key: string) => {
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
                active.setSelectionRange(start + tag.length, start + tag.length);
            }, 0);
        } else if (channel === 'sms') {
            setBody(prev => prev + tag);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !name) return;
        
        setIsSubmitting(true);
        const combinedContent = `${subject} ${body} ${JSON.stringify(blocks)}`;
        const varMatches = combinedContent.match(/\{\{(.*?)\}\}/g);
        const variableList = varMatches ? [...new Set(varMatches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];

        const templateData = {
            name: name.trim(),
            category,
            channel,
            subject: channel === 'email' ? subject.trim() : undefined,
            body: channel === 'sms' ? body.trim() : '',
            blocks: channel === 'email' ? blocks : undefined,
            variables: variableList,
            isActive: true,
            updatedAt: new Date().toISOString(),
        };

        try {
            if (editingTemplate) {
                await updateDoc(doc(firestore, 'message_templates', editingTemplate.id), templateData);
                setEditingTemplate(null);
            } else {
                await addDoc(collection(firestore, 'message_templates'), { ...templateData, createdAt: new Date().toISOString() });
                setIsAdding(false);
            }
            resetForm();
            toast({ title: 'Template Saved' });
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
        setChannel('sms');
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
        setIsAdding(true);
    };

    const filteredTemplates = React.useMemo(() => {
        if (!templates) return [];
        let t = templates;
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            t = t.filter(x => x.name.toLowerCase().includes(s) || (x.body && x.body.toLowerCase().includes(s)));
        }
        if (categoryFilter !== 'all') {
            t = t.filter(x => x.category === categoryFilter);
        }
        return t;
    }, [templates, searchTerm, categoryFilter]);

    const groupedTemplates = React.useMemo(() => {
        if (groupBy === 'none') return { 'All Templates': filteredTemplates };
        return filteredTemplates.reduce((acc, t) => {
            const key = groupBy === 'category' ? t.category : t.channel;
            const groupKey = key.charAt(0).toUpperCase() + key.slice(1);
            if (!acc[groupKey]) acc[groupKey] = [];
            acc[groupKey].push(t);
            return acc;
        }, {} as Record<string, MessageTemplate[]>);
    }, [filteredTemplates, groupBy]);

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
            <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
                <div>
                    <Button asChild variant="ghost" className="-ml-2 mb-2">
                        <Link href="/admin/messaging">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Hub
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">
                        Message Templates
                    </h1>
                    <p className="text-muted-foreground font-medium">Build structural communication assets with institutional data.</p>
                </div>
                <div className="flex items-center gap-2">
                    <RainbowButton onClick={() => setIsAiArchitectOpen(true)} className="h-10 px-6 gap-2 font-bold shadow-xl">
                        <Sparkles className="h-4 w-4" /> AI Architect
                    </RainbowButton>
                    <Button onClick={() => { setIsAdding(!isAdding); if(!isAdding) resetForm(); }} variant={isAdding ? "ghost" : "default"} className="font-bold rounded-xl h-10 px-6 shadow-xl">
                        {isAdding ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                        {isAdding ? 'Cancel' : 'New Template'}
                    </Button>
                </div>
            </div>

            {isAdding ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="lg:col-span-3 space-y-8">
                        <Card className="shadow-2xl border-none ring-1 ring-border rounded-[2.5rem] overflow-hidden bg-white">
                            <CardHeader className="bg-muted/30 border-b pb-6 p-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Template Identity</Label>
                                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome Email" className="h-11 rounded-xl bg-background font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category Context</Label>
                                        <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                                            <SelectTrigger className="h-11 rounded-xl bg-background font-bold"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="general">General</SelectItem>
                                                <SelectItem value="meetings">Meetings</SelectItem>
                                                <SelectItem value="surveys">Surveys</SelectItem>
                                                <SelectItem value="forms">Doc Signing</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Channel</Label>
                                        <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
                                            <SelectTrigger className="h-11 rounded-xl bg-background font-bold"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="sms">SMS</SelectItem>
                                                <SelectItem value="email">Email</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">
                                {channel === 'email' ? (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Subject Line</Label>
                                            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Enter email subject..." className="h-14 rounded-2xl bg-muted/20 border-none shadow-inner font-black text-xl px-6" />
                                        </div>
                                        
                                        <div className="space-y-6">
                                            <div className="flex flex-wrap items-center justify-between gap-4 px-1">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Content Studio</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddBlock('logo')} className="h-7 text-[8px] font-black uppercase rounded-lg gap-1.5"><SmartSappIcon className="h-3 w-3" /> Logo</Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddBlock('header')} className="h-7 text-[8px] font-black uppercase rounded-lg gap-1.5"><Layers className="h-3 w-3" /> Header</Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddBlock('heading')} className="h-7 text-[8px] font-black uppercase rounded-lg gap-1.5"><Heading1 className="h-3 w-3" /> Title</Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddBlock('columns')} className="h-7 text-[8px] font-black uppercase rounded-lg gap-1.5"><Layout className="h-3 w-3" /> Columns</Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddBlock('text')} className="h-7 text-[8px] font-black uppercase rounded-lg gap-1.5"><Type className="h-3 w-3" /> Text</Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddBlock('list')} className="h-7 text-[8px] font-black uppercase rounded-lg gap-1.5"><List className="h-3 w-3" /> List</Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddBlock('image')} className="h-7 text-[8px] font-black uppercase rounded-lg gap-1.5"><ImageIcon className="h-3 w-3" /> Image</Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddBlock('button')} className="h-7 text-[8px] font-black uppercase rounded-lg gap-1.5"><MousePointer2 className="h-3 w-3" /> CTA</Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddBlock('score-card')} className="h-7 text-[8px] font-black uppercase rounded-lg gap-1.5"><TrophyIcon className="h-3 w-3" /> Score</Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddBlock('footer')} className="h-7 text-[8px] font-black uppercase rounded-lg gap-1.5"><Layers className="h-3 w-3" /> Footer</Button>
                                                </div>
                                            </div>

                                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                                    <div className="space-y-6 min-h-[400px] p-8 border-2 border-dashed border-primary/10 rounded-[3rem] bg-muted/5 shadow-inner">
                                                        {blocks.map((block, idx) => (
                                                            <SortableBlockItem 
                                                                key={block.id} 
                                                                id={block.id} 
                                                                index={idx} 
                                                                block={block}
                                                                variables={contextVariables}
                                                                simulationVars={simVariables}
                                                                onUpdate={(u) => handleUpdateBlock(block.id, u)}
                                                                onRemove={() => handleRemoveBlock(block.id)}
                                                                onDuplicate={() => handleDuplicateBlock(block.id)}
                                                                onMoveUp={() => idx > 0 && setBlocks(prev => arrayMove(prev, idx, idx - 1))}
                                                                onMoveDown={() => idx < blocks.length - 1 && setBlocks(prev => arrayMove(prev, idx, idx + 1))}
                                                                onInsertVariable={handleInsertVariable}
                                                            />
                                                        ))}
                                                        {blocks.length === 0 && (
                                                            <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 opacity-30">
                                                                <LayoutGrid className="h-12 w-12" />
                                                                <p className="text-xs font-black uppercase tracking-widest">Canvas Empty</p>
                                                                <Button type="button" variant="ghost" onClick={() => handleAddBlock('text')}>Add Start Block</Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </SortableContext>
                                            </DndContext>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">SMS Message Content</Label>
                                        <Textarea 
                                            value={body} 
                                            onChange={e => setBody(e.target.value)} 
                                            className="min-h-[250px] rounded-[2rem] bg-muted/20 border-none shadow-inner p-8 text-xl font-medium leading-relaxed" 
                                            placeholder="Write your SMS message here. Use variables from the sidebar..."
                                        />
                                        <div className="flex justify-between px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                                            <span>Chars: {body.length}</span>
                                            <span>~ {Math.ceil(body.length / 160)} Segments</span>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="bg-muted/30 border-t p-8 flex justify-end gap-4">
                                <Button variant="ghost" onClick={() => setIsAdding(false)} className="font-bold">Discard</Button>
                                <Button onClick={handleSave} disabled={isSubmitting} className="px-12 rounded-[1.25rem] font-black shadow-2xl active:scale-95 transition-all text-base uppercase tracking-widest bg-primary text-white">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {editingTemplate ? 'Update Template' : 'Save Template'}
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                        {/* Theme Engine */}
                        <Card className="rounded-[2rem] overflow-hidden border-none ring-1 ring-border shadow-sm">
                            <CardHeader className="bg-muted/10 py-4 px-6 border-b flex flex-row items-center gap-2">
                                <Palette className="h-4 w-4 text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Theme Engine</span>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Master Background</Label>
                                    <div className="flex gap-2 p-1.5 bg-muted/30 rounded-xl border border-border/50">
                                        <Input type="color" value={themeBgColor} onChange={e => setThemeBgColor(e.target.value)} className="w-8 h-8 p-0 border-none bg-transparent rounded-lg cursor-pointer" />
                                        <Input value={themeBgColor} onChange={e => setThemeBgColor(e.target.value)} className="h-8 border-none bg-transparent shadow-none font-mono text-[10px] uppercase p-0" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Canonical Width</Label>
                                    <Select value={themeWidth} onValueChange={setThemeWidth}>
                                        <SelectTrigger className="h-10 bg-white border-primary/10 rounded-xl font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="500px">Compact (500px)</SelectItem>
                                            <SelectItem value="600px">Standard (600px)</SelectItem>
                                            <SelectItem value="700px">Wide (700px)</SelectItem>
                                            <SelectItem value="100%">Full Flow (100%)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Simulation Panel */}
                        <Card className="rounded-[2rem] overflow-hidden border-none ring-1 ring-primary/20 shadow-xl bg-primary/5">
                            <CardHeader className="bg-primary text-white py-4 px-6 shrink-0 flex flex-row items-center justify-between space-y-0">
                                <div className="flex items-center gap-2">
                                    <MonitorPlay className="h-4 w-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Simulator Studio</span>
                                </div>
                                {isSimLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase text-primary/60 tracking-widest">Sample Provider</Label>
                                        <Select value={simEntity} onValueChange={(v: any) => { setSimEntity(v); setSimRecordId('none'); }}>
                                            <SelectTrigger className="h-10 bg-white border-primary/10 rounded-xl font-bold">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No Simulation</SelectItem>
                                                <SelectItem value="School">School Data</SelectItem>
                                                <SelectItem value="Meeting">Meeting Record</SelectItem>
                                                <SelectItem value="Survey">Survey Result</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {simEntity !== 'none' && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                            <Label className="text-[9px] font-black uppercase text-primary/60 tracking-widest">Target Record</Label>
                                            <Select value={simRecordId} onValueChange={setSimRecordId}>
                                                <SelectTrigger className="h-10 bg-white border-primary/10 rounded-xl font-bold">
                                                    <SelectValue placeholder="Pick sample..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Choose record...</SelectItem>
                                                    {simEntity === 'School' && simSchools?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                    {simEntity === 'Meeting' && simMeetings?.map(m => <SelectItem key={m.id} value={m.id}>{m.schoolName} - {m.type.name}</SelectItem>)}
                                                    {simEntity === 'Survey' && simSurveys?.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                {Object.keys(simVariables).length > 0 ? (
                                    <div className="pt-4 border-t border-primary/10 space-y-3">
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[9px] font-black uppercase text-primary/60">Resolved Trace</span>
                                            <Badge className="bg-emerald-50 text-white text-[7px] h-4 border-none">Active</Badge>
                                        </div>
                                        <ScrollArea className="h-48 rounded-xl bg-white/50 border border-primary/10 p-2 shadow-inner">
                                            <div className="space-y-1.5">
                                                {Object.entries(simVariables).map(([k, v]) => (
                                                    <div key={k} className="flex flex-col gap-0.5 px-2 py-1.5 hover:bg-white rounded-lg transition-colors">
                                                        <span className="text-[8px] font-mono font-black text-primary/40 uppercase">{"{{" + k + "}}"}</span>
                                                        <span className="text-[10px] font-bold truncate text-foreground/80">{String(v)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                ) : simEntity !== 'none' && (
                                    <div className="p-4 rounded-xl border border-dashed border-primary/20 text-center space-y-2">
                                        <Info className="h-5 w-5 text-primary/30 mx-auto" />
                                        <p className="text-[9px] font-bold text-primary/60 uppercase leading-relaxed">Select a record to simulate variable resolution and logic branching.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="rounded-[2rem] overflow-hidden border-none ring-1 ring-border shadow-sm">
                            <CardHeader className="bg-muted/10 py-4 px-6 shrink-0 flex flex-row items-center justify-between space-y-0 border-b">
                                <div className="flex items-center gap-2">
                                    <Database className="h-4 w-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Variable Library</span>
                                </div>
                            </CardHeader>
                            <ScrollArea className="h-[400px] bg-background">
                                <div className="p-4 space-y-4">
                                    <div className="space-y-2">
                                        {contextVariables.map(v => (
                                            <button
                                                key={v.id}
                                                type="button"
                                                onClick={() => handleInsertVariable(v.key)}
                                                className="w-full flex flex-col items-start gap-1 p-2.5 rounded-xl bg-card border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="text-[8px] font-black uppercase text-primary/60 tracking-tighter">{v.sourceName || 'Core'}</span>
                                                    <PlusCircle className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <p className="text-xs font-bold leading-tight line-clamp-1">{v.label}</p>
                                                <code className="text-[9px] font-mono text-muted-foreground bg-muted/50 px-1.5 rounded uppercase mt-1">{"{{" + v.key + "}}"}</code>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </ScrollArea>
                        </Card>
                    </div>
                </div>
            ) : (
                <>
                    <div className="mb-12 flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-3xl border border-border/50 shadow-sm">
                        <div className="relative flex-grow w-full md:w-auto">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                            <Input 
                                placeholder="Filter by name or content..." 
                                className="pl-11 h-12 rounded-2xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="h-12 w-[160px] text-[10px] font-black uppercase tracking-widest border-none bg-muted/20 rounded-2xl">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    <SelectItem value="all">All Categories</SelectItem>
                                    <SelectItem value="general">General</SelectItem>
                                    <SelectItem value="forms">Doc Signing</SelectItem>
                                    <SelectItem value="surveys">Surveys</SelectItem>
                                    <SelectItem value="meetings">Meetings</SelectItem>
                                </SelectContent>
                            </Select>

                            <div className="flex items-center gap-1 bg-muted/30 p-1.5 rounded-2xl border border-border/50 shadow-inner">
                                <Button 
                                    variant={groupBy === 'none' ? 'secondary' : 'ghost'} 
                                    size="sm" 
                                    className={cn("h-9 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", groupBy === 'none' && "bg-white shadow-md text-primary")}
                                    onClick={() => setGroupBy('none')}
                                >
                                    <LayoutGrid className="h-3.5 w-3.5 mr-2" /> Grid
                                </Button>
                                <Button 
                                    variant={groupBy === 'category' ? 'secondary' : 'ghost'} 
                                    size="sm" 
                                    className={cn("h-9 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", groupBy === 'category' && "bg-white shadow-md text-primary")}
                                    onClick={() => setGroupBy('category')}
                                >
                                    <ListTree className="h-3.5 w-3.5 mr-2" /> Context
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-16">
                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-64 animate-pulse bg-muted rounded-[2.5rem]" />)}
                            </div>
                        ) : Object.entries(groupedTemplates).map(([groupTitle, groupItems]) => (
                            <div key={groupTitle} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                {groupBy !== 'none' && (
                                    <div className="flex items-center gap-4 px-2">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{groupTitle}</h3>
                                        <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
                                        <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 h-6 px-3 font-black rounded-lg">{groupItems.length}</Badge>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {groupItems.map((template) => (
                                        <Card key={template.id} className="group relative border-2 transition-all duration-500 rounded-[2.5rem] overflow-hidden bg-card shadow-sm hover:shadow-2xl border-border/50">
                                            <div className="absolute top-4 right-4 flex items-center gap-3 z-20">
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 text-primary" onClick={() => setPreviewTemplate(template)}>
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 text-primary" onClick={() => handleEditClick(template)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl" onClick={async () => { if(confirm('Delete?')) await deleteDoc(doc(firestore, 'message_templates', template.id))}}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <Switch checked={template.isActive} onCheckedChange={async (v) => await updateDoc(doc(firestore, 'message_templates', template.id), { isActive: v })} className="scale-90" />
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
                                                    {template.variables.map(v => (
                                                        <Badge key={v} variant="outline" className="text-[9px] h-6 font-black uppercase tracking-tight px-2.5 rounded-lg shadow-sm bg-white border-primary/10 text-primary">
                                                            &#123;&#123;{v}&#125;&#125;
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* AI Architect Dialog */}
            <Dialog open={isAiArchitectOpen} onOpenChange={setIsAiArchitectOpen}>
                <DialogContent className="sm:max-w-2xl rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl">
                    <DialogHeader className="p-8 pb-4 bg-primary text-white shrink-0">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-xl"><Wand2 className="h-8 w-8" /></div>
                            <div>
                                <DialogTitle className="text-3xl font-black uppercase tracking-tight">AI Template Architect</DialogTitle>
                                <DialogDescription className="text-white/70 font-bold uppercase tracking-widest text-[10px]">Multi-Block High Fidelity Generation</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="p-8 space-y-8">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Describe your communication objective</Label>
                            <Textarea 
                                value={aiPromptText}
                                onChange={e => setAiPromptText(e.target.value)}
                                placeholder="e.g. A formal admission offer for the 2024 academic year. Include sections for financial aid, orientation dates, and a primary CTA to sign the agreement."
                                className="min-h-[180px] rounded-[1.5rem] bg-muted/20 border-none shadow-inner p-6 text-base leading-relaxed resize-none"
                            />
                        </div>
                        <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-4 shadow-inner">
                            <Info className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-black text-blue-900 uppercase tracking-tight">Structural Awareness</p>
                                <p className="text-[10px] text-blue-700 leading-relaxed font-bold uppercase tracking-widest opacity-80">
                                    The AI will generate modular content blocks (Headings, Text, Buttons) that you can refine manually in the Template Studio.
                                </p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-muted/30 border-t flex flex-col sm:flex-row gap-4">
                        <Button variant="ghost" onClick={() => setIsAiArchitectOpen(false)} disabled={isAiGenerating} className="font-bold flex-1">Discard</Button>
                        <Button 
                            onClick={handleAiGenerate} 
                            disabled={isAiGenerating || !aiPromptText.trim()}
                            className="flex-[2] h-14 rounded-2xl font-black shadow-2xl bg-primary text-white hover:bg-primary/90 transition-all active:scale-95 text-lg uppercase tracking-widest"
                        >
                            {isAiGenerating ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" />}
                            {isAiGenerating ? 'Architecting...' : 'Build Template'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Template Preview Dialog */}
            <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
                <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-[3rem] border-none shadow-2xl">
                    <DialogHeader className="p-8 border-b bg-muted/30 shrink-0">
                        <div className="flex items-center justify-between pr-8">
                            <div className="flex items-center gap-4">
                                <div className={cn("p-3 rounded-2xl border shadow-xl transition-transform", previewTemplate?.channel === 'email' ? "bg-blue-500/10 text-blue-500 border-blue-100" : "bg-orange-500/10 text-orange-500 border-orange-100")}>
                                    {previewTemplate?.channel === 'email' ? <Mail className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Visual Simulation</DialogTitle>
                                    <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Authorized rendering for &ldquo;{previewTemplate?.name}&rdquo;</DialogDescription>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <Badge className="bg-primary h-5 text-[8px] font-black uppercase tracking-widest">Real-time simulation</Badge>
                                {simVariables.school_name && <p className="text-[9px] font-bold text-primary mt-1">Bound: {simVariables.school_name}</p>}
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden relative bg-slate-100 p-4 sm:p-10">
                        <ScrollArea className="h-full bg-white rounded-[2.5rem] shadow-2xl border-[12px] border-white overflow-hidden relative ring-1 ring-border/50">
                            {previewTemplate?.channel === 'email' ? (
                                <div className="flex flex-col h-full">
                                    <div className="p-8 bg-muted/30 border-b space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">Handset Subject</p>
                                        <p className="font-black text-xl text-foreground">{resolveVariables(previewTemplate.subject || '', simVariables) || '(No Subject)'}</p>
                                    </div>
                                    <div className="flex-1 p-1">
                                        <iframe 
                                            srcDoc={renderBlocksToHtml(previewTemplate.blocks || [], simVariables, { width: themeWidth, backgroundColor: themeBgColor })}
                                            className="w-full min-h-[600px] border-none"
                                            title="Email Rendering"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="p-12 flex flex-col items-center justify-center min-h-full bg-[#0A1427]">
                                    <div className="w-full max-w-xs space-y-10">
                                        <div className="flex items-center justify-between px-2">
                                            <SmartSappIcon className="h-8 w-8 text-white opacity-20" />
                                            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">SMS Gateway Simulator</p>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 relative shadow-inner group">
                                            <div className="absolute -left-3 top-10 w-6 h-6 bg-[#0A1427] rotate-45 rounded-sm border-l border-b border-white/10" />
                                            <p className="text-[15px] text-white/95 leading-relaxed font-bold whitespace-pre-wrap">{resolveVariables(previewTemplate?.body || '', simVariables)}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
