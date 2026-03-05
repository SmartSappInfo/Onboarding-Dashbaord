'use client';

import * as React from 'react';
import { useFormContext, useFieldArray, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Plus, Trash2, Layout, GripVertical, Heading1, AlignLeft, AlignCenter, AlignRight, 
    Type, Image as ImageIcon, Video, Quote, Square, MousePointer2, Eye, Copy, 
    ArrowRight, ArrowUp, ArrowDown, Trophy as TrophyIcon, PlusCircle, Bold, Italic, Underline,
    List, ListOrdered, AlignJustify
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { SurveyResultPage, SurveyResultBlock } from '@/lib/types';
import { MediaSelect } from '../../schools/components/media-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SmartSappLogo } from '@/components/icons';
import VideoEmbed from '@/components/video-embed';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AddResultBlockModal from './add-result-block-modal';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const blockIcons: Record<string, React.ElementType> = {
    heading: Heading1,
    text: Type,
    list: List,
    image: ImageIcon,
    video: Video,
    button: MousePointer2,
    quote: Quote,
    divider: Square,
    'score-card': TrophyIcon,
};

function PagePreviewModal({ open, onOpenChange, page, maxScore, displayMode }: { open: boolean, onOpenChange: (o: boolean) => void, page: SurveyResultPage, maxScore: number, displayMode: 'points' | 'percentage' }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-50">
                <DialogHeader className="p-6 bg-white border-b shrink-0">
                    <DialogTitle>Outcome Preview: {page.name}</DialogTitle>
                    <DialogDescription>This is how this specific result page will appear to users.</DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-hidden relative">
                    <ScrollArea className="h-full">
                        <div className="max-w-2xl mx-auto py-12 px-4 space-y-8">
                            <div className="flex justify-center mb-8">
                                <SmartSappLogo className="h-8 opacity-50 grayscale" />
                            </div>
                            {page.blocks.map(block => (
                                <div key={block.id} className={cn(
                                    "w-full",
                                    block.style?.textAlign === 'center' ? 'text-center flex flex-col items-center' : block.style?.textAlign === 'right' ? 'text-right flex flex-col items-end' : block.style?.textAlign === 'justify' ? 'text-justify' : 'text-left'
                                )}>
                                    {block.type === 'heading' && (
                                        block.variant === 'h1' ? <h1 className="text-4xl font-black tracking-tight">{block.title}</h1> :
                                        block.variant === 'h3' ? <h3 className="text-xl font-bold tracking-tight">{block.title}</h3> :
                                        <h2 className="text-3xl font-black tracking-tight">{block.title}</h2>
                                    )}
                                    {block.type === 'text' && <div className="prose prose-slate max-w-none text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: block.content || '' }} />}
                                    {block.type === 'list' && (
                                        block.listStyle === 'ordered' ? (
                                            <ol className="list-decimal list-inside space-y-2 text-lg font-medium text-slate-700">
                                                {block.items?.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: item }} />)}
                                            </ol>
                                        ) : (
                                            <ul className="list-disc list-inside space-y-2 text-lg font-medium text-slate-700">
                                                {block.items?.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: item }} />)}
                                            </ul>
                                        )
                                    )}
                                    {block.type === 'image' && block.url && <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-lg border-4 border-white bg-white"><Image src={block.url} alt="preview" fill className="object-cover" /></div>}
                                    {block.type === 'video' && block.url && <div className="w-full"><VideoEmbed url={block.url} /></div>}
                                    {block.type === 'button' && <Button size="lg" variant={block.style?.variant as any} className="h-14 px-8 text-lg font-black rounded-xl shadow-lg">{block.title} <ArrowRight className="ml-2 h-5 w-5"/></Button>}
                                    {block.type === 'quote' && <div className="p-8 bg-white border-l-4 border-primary rounded-r-2xl italic text-xl shadow-sm text-left"><Quote className="h-8 w-8 text-primary/20 mb-4" />{block.content}</div>}
                                    {block.type === 'score-card' && (
                                        <Card className="w-full bg-primary text-white border-none shadow-xl rounded-3xl p-8 flex flex-col items-center text-center">
                                            <Badge variant="outline" className="mb-4 bg-white/10 text-white border-white/20 px-4 py-1.5 text-[10px] font-black tracking-widest uppercase">Sample Result</Badge>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center justify-center">
                                                    <span className="text-7xl font-black tabular-nums tracking-tighter">
                                                        {displayMode === 'percentage' ? '85' : (maxScore * 0.85).toFixed(0)}
                                                    </span>
                                                    {displayMode === 'percentage' && <span className="text-4xl font-black ml-1">%</span>}
                                                </div>
                                                <span className="text-lg font-bold opacity-60 uppercase tracking-widest">
                                                    {displayMode === 'percentage' ? 'Overall Accuracy' : `out of ${maxScore} points`}
                                                </span>
                                            </div>
                                            <div className="mt-6 w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                                                <div className="h-full bg-white w-[85%]" />
                                            </div>
                                        </Card>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter className="p-4 bg-white border-t shrink-0">
                    <Button onClick={() => onOpenChange(false)} variant="outline">Close Preview</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function ResultFormattingToolbar({ pageIndex, blockIndex, minimal }: { pageIndex: number, blockIndex: number, minimal?: boolean }) {
    const { getValues, setValue } = useFormContext();
    const block: SurveyResultBlock = useWatch({ name: `resultPages.${pageIndex}.blocks.${blockIndex}` });

    const applyFormatting = (tag: string) => {
        const isList = block.type === 'list';
        const fieldName = isList 
            ? `resultPages.${pageIndex}.blocks.${blockIndex}.items`
            : `resultPages.${pageIndex}.blocks.${blockIndex}.${block.type === 'heading' || block.type === 'button' ? 'title' : 'content'}`;
        
        const input = document.activeElement as HTMLTextAreaElement | HTMLInputElement;
        if (!input || !['TEXTAREA', 'INPUT'].includes(input.tagName)) return;

        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        
        const currentVal = getValues(fieldName);
        const text = isList ? (currentVal as string[]).join('\n') : (currentVal || '');
        
        const selectedText = text.substring(start, end);
        if (!selectedText) return;

        const newText = text.substring(0, start) + `<${tag}>${selectedText}</${tag}>` + text.substring(end);
        
        if (isList) {
            setValue(fieldName, newText.split('\n'), { shouldDirty: true });
        } else {
            setValue(fieldName, newText, { shouldDirty: true });
        }
        
        setTimeout(() => {
            input.focus();
            input.setSelectionRange(start, start + selectedText.length + (tag.length * 2) + 5);
        }, 0);
    };

    return (
        <div className={cn("flex items-center gap-0.5", !minimal && "bg-muted/50 p-1 rounded-md mb-2")}>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormatting('b')} title="Bold">
                <Bold className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormatting('i')} title="Italic">
                <Italic className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormatting('u')} title="Underline">
                <Underline className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            
            <Button type="button" variant={block.style?.textAlign === 'left' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.style.textAlign`, 'left', { shouldDirty: true })}>
                <AlignLeft className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant={block.style?.textAlign === 'center' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.style.textAlign`, 'center', { shouldDirty: true })}>
                <AlignCenter className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant={block.style?.textAlign === 'right' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.style.textAlign`, 'right', { shouldDirty: true })}>
                <AlignRight className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant={block.style?.textAlign === 'justify' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.style.textAlign`, 'justify', { shouldDirty: true })}>
                <AlignJustify className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}

function BlockInspector({ pageIndex, blockIndex }: { pageIndex: number, blockIndex: number }) {
    const { register, setValue, watch } = useFormContext();
    const block: SurveyResultBlock = useWatch({ name: `resultPages.${pageIndex}.blocks.${blockIndex}` });

    if (!block) return null;

    return (
        <div className="space-y-6 pt-4">
            <div className="grid gap-4">
                {block.type === 'heading' && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Heading Text</Label>
                        <Input {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.title`)} className="font-bold text-lg border-none shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent" />
                    </div>
                )}
                {block.type === 'button' && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Button Text</Label>
                        <Input {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.title`)} className="font-bold" />
                    </div>
                )}
                {block.type === 'text' && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Content (HTML Supported)</Label>
                        <Textarea {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.content`)} className="min-h-[150px] text-base border-none shadow-none focus-visible:ring-0 p-0 bg-transparent" />
                    </div>
                )}
                {block.type === 'quote' && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quote Text</Label>
                        <Textarea {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.content`)} className="text-lg italic border-none shadow-none focus-visible:ring-0 p-0 bg-transparent" />
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
                                    onClick={() => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.listStyle`, 'unordered', { shouldDirty: true })}
                                >
                                    <List className="h-3.5 w-3.5" />
                                </Button>
                                <Button 
                                    type="button" 
                                    variant={block.listStyle === 'ordered' ? 'secondary' : 'ghost'} 
                                    size="sm" 
                                    className="h-7 rounded-md px-2"
                                    onClick={() => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.listStyle`, 'ordered', { shouldDirty: true })}
                                >
                                    <ListOrdered className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">List Items (One per line)</Label>
                            <Textarea 
                                value={block.items?.join('\n') || ''}
                                onChange={(e) => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.items`, e.target.value.split('\n'), { shouldDirty: true })}
                                className="min-h-[200px] text-sm rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 p-4 font-medium"
                                placeholder="Pasting a list works here too..."
                            />
                        </div>
                    </div>
                )}
                {['image', 'video'].includes(block.type) && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Media URL</Label>
                        <MediaSelect 
                            value={block.url} 
                            onValueChange={(val) => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.url`, val, { shouldDirty: true })}
                            filterType={block.type as any}
                        />
                    </div>
                )}
                {block.type === 'button' && (
                    <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Link URL</Label>
                            <Input placeholder="https://..." {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.link`)} />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase tracking-widest">Open in New Tab</Label>
                            <Switch 
                                checked={!!block.openInNewTab} 
                                onCheckedChange={(val) => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.openInNewTab`, val, { shouldDirty: true })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Button Style</Label>
                            <Select 
                                value={block.style?.variant || 'default'} 
                                onValueChange={(val) => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.style.variant`, val, { shouldDirty: true })}
                            >
                                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {['default', 'outline', 'secondary', 'destructive', 'ghost'].map(v => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {block.type === 'score-card' && (
                    <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                        <Label className="text-sm font-bold uppercase tracking-widest">Animate Celebration</Label>
                        <Switch 
                            checked={!!block.style?.animate} 
                            onCheckedChange={(val) => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.style.animate`, val, { shouldDirty: true })}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function SortableResultBlock({ 
    id, 
    index, 
    pageIndex, 
    block, 
    remove, 
    swap, 
    duplicate,
    requestAddBlock
}: { 
    id: string, 
    index: number, 
    pageIndex: number, 
    block: any, 
    remove: (i: number) => void,
    swap: (a: number, b: number) => void,
    duplicate: (i: number) => void,
    requestAddBlock: (i: number) => void
}) {
    const { setValue } = useFormContext();
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const blockType = block.type;
    const Icon = blockIcons[blockType] || Type;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="relative group">
            <div
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 cursor-grab p-2 bg-card border rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <Card className="bg-card shadow-none border hover:border-primary/50 transition-colors">
                <CardHeader className="py-2 px-4 flex flex-row items-center justify-between space-y-0 border-b bg-muted/10">
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        <div className="flex items-center justify-center rounded border p-1 bg-background">
                            <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <span>{blockType} Block</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <TooltipProvider>
                            {/* Formatting and Level Controls Group */}
                            {['heading', 'text', 'quote', 'button', 'list'].includes(block.type) && (
                                <div className="flex items-center">
                                    <ResultFormattingToolbar pageIndex={pageIndex} blockIndex={index} minimal />
                                    {block.type === 'heading' && (
                                        <>
                                            <Separator orientation="vertical" className="h-4 mx-1" />
                                            <Select 
                                                value={block.variant || 'h2'} 
                                                onValueChange={(val) => setValue(`resultPages.${pageIndex}.blocks.${index}.variant`, val, { shouldDirty: true })}
                                            >
                                                <SelectTrigger className="w-16 h-8 text-[10px] uppercase font-black border-none bg-transparent hover:bg-muted focus:ring-0 shadow-none">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="h1">H1</SelectItem>
                                                    <SelectItem value="h2">H2</SelectItem>
                                                    <SelectItem value="h3">H3</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </>
                                    )}
                                    <Separator orientation="vertical" className="h-4 mx-1" />
                                </div>
                            )}

                            {/* System Actions Group */}
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => swap(index, index - 1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => swap(index, index + 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicate(index)}><Copy className="h-3.5 w-3.5" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => remove(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </TooltipProvider>
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    <BlockInspector pageIndex={pageIndex} blockIndex={index} />
                </CardContent>
            </Card>
            <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20 cursor-pointer p-2 bg-card border rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => requestAddBlock(index)}
            >
                <PlusCircle className="h-5 w-5 text-muted-foreground" />
            </div>
        </div>
    );
}

function PageEditor({ pageIndex }: { pageIndex: number }) {
    const { control, getValues } = useFormContext();
    const { fields: blocks, append, remove, move, swap, insert } = useFieldArray({
        control,
        name: `resultPages.${pageIndex}.blocks`,
    });

    const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
    const [insertionIndex, setInsertionIndex] = React.useState(0);

    const sensors = useSensors(useSensor(PointerSensor));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = blocks.findIndex((b) => b.id === active.id);
            const newIndex = blocks.findIndex((b) => b.id === over.id);
            move(oldIndex, newIndex);
        }
    };

    const requestAddBlock = (index: number) => {
        setInsertionIndex(index + 1);
        setIsAddModalOpen(true);
    };

    const handleBlockSelect = (type: SurveyResultBlock['type']) => {
        const newBlock: Partial<SurveyResultBlock> = {
            id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            type,
            style: { textAlign: 'center', animate: true, variant: 'default' },
        };

        if (type === 'heading') {
            newBlock.title = 'Outcome Heading';
            newBlock.variant = 'h2';
        }
        if (type === 'text') newBlock.content = '<p>Your descriptive text here...</p>';
        if (type === 'list') {
            newBlock.listStyle = 'unordered';
            newBlock.items = ['First point', 'Second important point'];
        }
        if (type === 'button') {
            newBlock.title = 'Next Step';
            newBlock.link = '#';
        }
        if (type === 'quote') newBlock.content = 'Inspirational or analytical quote...';

        insert(insertionIndex, newBlock);
    };

    const duplicateBlock = (index: number) => {
        const blockToDuplicate = getValues(`resultPages.${pageIndex}.blocks.${index}`);
        const newBlock = {
            ...JSON.parse(JSON.stringify(blockToDuplicate)),
            id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        };
        insert(index + 1, newBlock);
    };

    return (
        <div className="space-y-6">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-6">
                        {blocks.map((block, bIndex) => (
                            <SortableResultBlock 
                                key={block.id}
                                id={block.id}
                                index={bIndex}
                                pageIndex={pageIndex}
                                block={block}
                                remove={remove}
                                swap={swap}
                                duplicate={duplicateBlock}
                                requestAddBlock={requestAddBlock}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {blocks.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/20">
                    <p className="text-sm text-muted-foreground mb-4 font-medium italic">This page has no content yet.</p>
                    <Button type="button" variant="outline" onClick={() => { setInsertionIndex(0); setIsAddModalOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add First Block
                    </Button>
                </div>
            )}

            <AddResultBlockModal 
                open={isAddModalOpen} 
                onOpenChange={setIsAddModalOpen} 
                onSelect={handleBlockSelect} 
            />
        </div>
    );
}

export default function ResultPageBuilder() {
    const { control, watch, setValue, register } = useFormContext();
    const { fields: pages, append, remove } = useFieldArray({
        control,
        name: 'resultPages',
    });
    const maxScore = watch('maxScore') || 100;
    const scoreDisplayMode = watch('scoreDisplayMode') || 'points';
    const [previewPageIdx, setPreviewPageIdx] = React.useState<number | null>(null);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-black text-foreground">Outcome Pages</h3>
                    <p className="text-sm text-muted-foreground">Design unique landing pages for different user scores.</p>
                </div>
                <Button onClick={() => append({ id: `pg_${Date.now()}`, name: `Outcome Page ${pages.length + 1}`, blocks: [], isDefault: pages.length === 0 })} className="gap-2 font-bold shadow-lg">
                    <Plus className="h-4 w-4" /> New Page
                </Button>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
                {pages.map((page, index) => (
                    <AccordionItem key={page.id} value={page.id} className="border rounded-2xl px-4 bg-background shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <AccordionTrigger className="hover:no-underline py-6">
                            <div className="flex items-center gap-4 text-left">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <Layout className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="font-black text-lg leading-none mb-1">{(page as any).name}</p>
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{(page as any).blocks?.length || 0} Content Blocks</p>
                                </div>
                                {(page as any).isDefault && <Badge variant="secondary" className="ml-2 bg-green-50 text-green-700 border-green-200">Default Fallback</Badge>}
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4 pb-8 space-y-8 border-t">
                            <div className="flex flex-wrap items-end gap-4">
                                <div className="flex-grow space-y-1.5 min-w-[200px]">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Internal Page Name</Label>
                                    <Input {...register(`resultPages.${index}.name`)} className="h-11 font-bold" />
                                </div>
                                <div className="flex items-center gap-2 pb-2 h-11 px-4 rounded-xl border bg-muted/30">
                                    <Switch 
                                        checked={!!watch(`resultPages.${index}.isDefault`)} 
                                        onCheckedChange={(val) => {
                                            if (val) {
                                                pages.forEach((_, i) => setValue(`resultPages.${i}.isDefault`, i === index, { shouldDirty: true }));
                                            }
                                        }}
                                    />
                                    <Label className="text-xs font-bold uppercase">Default Page</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button type="button" variant="outline" className="h-11 px-4 gap-2 font-bold" onClick={() => setPreviewPageIdx(index)}>
                                        <Eye className="h-4 w-4" /> Preview
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-destructive" onClick={() => remove(index)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <PageEditor pageIndex={index} />
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>

            {pages.length === 0 && (
                <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-3xl">
                    <Layout className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">No outcome pages built yet.</p>
                    <Button variant="link" onClick={() => append({ id: `pg_${Date.now()}`, name: `Welcome Page`, blocks: [], isDefault: true })} className="mt-2">
                        Add your first landing page
                    </Button>
                </div>
            )}

            {previewPageIdx !== null && (
                <PagePreviewModal 
                    open={previewPageIdx !== null} 
                    onOpenChange={(o) => !o && setPreviewPageIdx(null)} 
                    page={pages[previewPageIdx] as any}
                    maxScore={maxScore}
                    displayMode={scoreDisplayMode}
                />
            )}
        </div>
    );
}
