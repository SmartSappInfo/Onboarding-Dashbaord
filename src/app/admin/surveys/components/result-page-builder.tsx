'use client';

import * as React from 'react';
import { useFormContext, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Plus, Trash2, Layout, GripVertical, AlignLeft, AlignCenter, AlignRight, 
    Image as ImageIcon, Video, AudioWaveform, Quote, Eye, Copy, 
    ArrowRight, ArrowUp, ArrowDown, PlusCircle, Bold, Italic, Underline,
    List, ListOrdered, AlignJustify, Sparkles, Settings, X,
    Heading1, Type, MousePointer2, Square, Trophy as TrophyIcon,
    ClipboardCopy, ClipboardCheck, Clipboard, ChevronsUp, ChevronsDown,
    Pencil
} from 'lucide-react';
import { cn, stripHtml } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { SurveyResultPage, SurveyResultBlock } from '@/lib/types';
import AiChatEditor from './ai-chat-editor';
import { MediaSelect } from '../../entities/components/media-select';
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
import { Checkbox } from '@/components/ui/checkbox';

export function PagePreviewModal({ open, onOpenChange, page, maxScore = 100, displayMode = 'points' }: { open: boolean, onOpenChange: (o: boolean) => void, page: SurveyResultPage, maxScore?: number, displayMode?: 'points' | 'percentage' }) {
    React.useEffect(() => {
        if (open && page.confettiEnabled) {
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduceMotion) return;

            let active = true;
            let sidesTimer: NodeJS.Timeout;

            import('canvas-confetti').then(({ default: confetti }) => {
                if (!active) return;
                const burst = (opts: Record<string, unknown>) =>
                    confetti({
                        disableForReducedMotion: true,
                        colors: ['#5f30e2', '#ffc629', '#10b981', '#3B5FFF', '#e63946'],
                        ...opts,
                    });

                burst({ particleCount: 160, spread: 100, startVelocity: 45, origin: { x: 0.5, y: 0.55 } });
                sidesTimer = setTimeout(() => {
                    burst({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
                    burst({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
                }, 350);
            }).catch(console.error);

            return () => {
                active = false;
                if (sidesTimer) clearTimeout(sidesTimer);
            };
        }
    }, [open, page.id, page.confettiEnabled]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden bg-background">
                <DialogHeader className="p-6 bg-card border-b shrink-0">
                    <DialogTitle>Outcome Preview: {stripHtml(page.name)}</DialogTitle>
                    <DialogDescription>This is how this specific result page will appear to users.</DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-hidden relative">
                    <ScrollArea className="h-full">
                        <div className="max-w-2xl mx-auto py-12 px-4 space-y-8">
                            <div className="flex justify-center mb-8">
                                <SmartSappLogo className="h-8 opacity-50 grayscale" />
                            </div>
                            {page.blocks.map(block => {
                                const alignClass = block.style?.textAlign === 'center' 
                                    ? 'text-center flex flex-col items-center' 
                                    : block.style?.textAlign === 'right' 
                                    ? 'text-right flex flex-col items-end' 
                                    : block.style?.textAlign === 'justify' 
                                    ? 'text-justify' 
                                    : 'text-left';

                                return (
                                    <div key={block.id} className={cn("w-full", alignClass)}>
                                        {block.type === 'heading' && (
                                            block.variant === 'h1' ? <h1 className="text-4xl font-semibold tracking-tight">{block.title}</h1> :
                                            block.variant === 'h3' ? <h3 className="text-xl font-bold tracking-tight">{block.title}</h3> :
                                            <h2 className="text-3xl font-semibold tracking-tight">{block.title}</h2>
                                        )}
                                        {block.type === 'text' && <div className="prose prose-slate max-w-none text-lg leading-relaxed">{block.content || ''}</div>}
                                        {block.type === 'list' && (
                                            block.listStyle === 'ordered' ? (
                                                <ol className="list-decimal list-inside space-y-2 text-lg font-medium text-slate-700">
                                                    {block.items?.map((item, i) => <li key={i}>{item}</li>)}
                                                </ol>
                                            ) : (
                                                <ul className="list-disc list-inside space-y-2 text-lg font-medium text-slate-700">
                                                    {block.items?.map((item, i) => <li key={i}>{item}</li>)}
                                                </ul>
                                            )
                                        )}
                                        {block.type === 'image' && block.url && <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-lg border bg-card"><Image src={block.url} alt="preview" fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" /></div>}
                                        {block.type === 'video' && block.url && <div className="w-full"><VideoEmbed url={block.url} thumbnailUrl={block.thumbnailUrl} /></div>}
                                        {block.type === 'audio' && block.url && <div className="w-full p-6 bg-card border rounded-2xl shadow-sm"><audio controls src={block.url} className="w-full" /></div>}
                                        {block.type === 'button' && <Button size="lg" variant={block.style?.variant as 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost' | null | undefined} className="h-14 px-8 text-lg font-semibold rounded-xl shadow-lg">{block.title} <ArrowRight className="ml-2 h-5 w-5"/></Button>}
                                        {block.type === 'quote' && <div className="p-8 bg-card border-l-4 border-primary rounded-r-2xl italic text-xl shadow-sm text-left"><Quote className="h-8 w-8 text-primary/20 mb-4" />{block.content}</div>}
                                        {block.type === 'divider' && <Separator className="w-full my-8 bg-border/40" />}
                                        {block.type === 'score-card' && (
                                            <Card className="w-full bg-primary text-white border-none shadow-xl rounded-3xl p-8 flex flex-col items-center text-center">
                                                <Badge variant="outline" className="mb-4 bg-card/10 text-white border-white/20 px-4 py-1.5 text-[10px] font-semibold uppercase">Sample Result</Badge>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center justify-center">
                                                        <span className="text-7xl font-semibold tabular-nums tracking-tighter">
                                                            {displayMode === 'percentage' ? '85' : (maxScore * 0.85).toFixed(0)}
                                                        </span>
                                                        {displayMode === 'percentage' && <span className="text-4xl font-semibold ml-1">%</span>}
                                                    </div>
                                                    <span className="text-lg font-bold opacity-60">
                                                        {displayMode === 'percentage' ? 'Overall Accuracy' : `out of ${maxScore} points`}
                                                    </span>
                                                </div>
                                                <div className="mt-6 w-full h-1.5 bg-card/20 rounded-full overflow-hidden">
                                                    <div className="h-full bg-card w-[85%]" />
                                                </div>
                                            </Card>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter className="p-4 bg-card border-t shrink-0">
                    <Button onClick={() => onOpenChange(false)} variant="outline">Close Preview</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
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
        <div className={cn("flex items-center gap-0.5", !minimal && "bg-background p-1 rounded-md mb-2")}>
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
    const { register, setValue } = useFormContext();
    const block: SurveyResultBlock = useWatch({ name: `resultPages.${pageIndex}.blocks.${blockIndex}` });

    if (!block) return null;

    return (
        <div className="space-y-6 pt-4">
            <div className="grid gap-4">
                {block.type === 'heading' && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold text-muted-foreground">Heading Text</Label>
                        <Input {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.title`)} className="font-bold text-lg" />
                    </div>
                )}
                {block.type === 'button' && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold text-muted-foreground">Button Text</Label>
                        <Input {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.title`)} className="font-bold" />
                    </div>
                )}
                {block.type === 'text' && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold text-muted-foreground">Content (HTML Supported)</Label>
                        <Textarea {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.content`)} className="min-h-[150px] text-base" />
                    </div>
                )}
                {block.type === 'quote' && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold text-muted-foreground">Quote Text</Label>
                        <Textarea {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.content`)} className="text-lg italic" />
                    </div>
                )}
                {block.type === 'list' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-semibold text-muted-foreground">List Style</Label>
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
                            <Label className="text-[10px] font-semibold text-muted-foreground">List Items (One per line)</Label>
                            <Textarea 
                                value={block.items?.join('\n') || ''}
                                onChange={(e) => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.items`, e.target.value.split('\n'), { shouldDirty: true })}
                                className="min-h-[200px] text-sm rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 p-4 font-medium"
                                placeholder="Pasting a list works here too..."
                            />
                        </div>
                    </div>
                )}
                {['image', 'video', 'audio'].includes(block.type) && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Media URL</Label>
                            <MediaSelect 
                                value={block.url} 
                                onValueChange={(val) => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.url`, val, { shouldDirty: true })}
                                filterType={block.type as 'image' | 'video' | 'audio'}
                            />
                        </div>
                        {block.type === 'video' && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-muted-foreground">Video Thumbnail (Optional)</Label>
                                <MediaSelect 
                                    value={block.thumbnailUrl} 
                                    onValueChange={(val) => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.thumbnailUrl`, val, { shouldDirty: true })}
                                    filterType="image"
                                />
                            </div>
                        )}
                    </div>
                )}
                {block.type === 'button' && (
                    <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Link URL</Label>
                            <Input placeholder="https://..." {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.link`)} />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold">Open in New Tab</Label>
                            <Switch 
                                checked={!!block.openInNewTab} 
                                onCheckedChange={(val) => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.openInNewTab`, val, { shouldDirty: true })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Button Style</Label>
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
                        <Label className="text-sm font-bold">Animate Celebration</Label>
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
    move,
    duplicate,
    requestAddBlock,
    isSelected,
    onSelect,
    isSelectedForBatch,
    onToggleBatchSelect,
    onCopySingle,
    copiedBlocks,
    onPaste,
    blocksCount
}: { 
    id: string, 
    index: number, 
    pageIndex: number, 
    block: SurveyResultBlock, 
    remove: (i: number) => void,
    swap: (a: number, b: number) => void,
    move: (from: number, to: number) => void,
    duplicate: (i: number) => void,
    requestAddBlock: (i: number) => void,
    isSelected: boolean,
    onSelect: () => void,
    isSelectedForBatch: boolean,
    onToggleBatchSelect: (checked: boolean) => void,
    onCopySingle: () => void,
    copiedBlocks: SurveyResultBlock[],
    onPaste: (insertIdx: number) => void,
    blocksCount: number
}) {
    const { setValue } = useFormContext();
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const [isHovered, setIsHovered] = React.useState(false);

    const watchedBlock = useWatch({
        name: `resultPages.${pageIndex}.blocks.${index}`,
        defaultValue: block
    });
    const activeBlock = (watchedBlock || block) as SurveyResultBlock;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const alignClass = activeBlock.style?.textAlign === 'center' 
        ? 'text-center flex flex-col items-center' 
        : activeBlock.style?.textAlign === 'right' 
        ? 'text-right flex flex-col items-end' 
        : activeBlock.style?.textAlign === 'justify' 
        ? 'text-justify' 
        : 'text-left';

    const renderWysiwygContent = () => {
        switch (activeBlock.type) {
            case 'heading': {
                const fontClass = activeBlock.variant === 'h1' 
                    ? 'text-3xl sm:text-4xl font-semibold tracking-tight' 
                    : activeBlock.variant === 'h3' 
                    ? 'text-lg sm:text-xl font-bold tracking-tight' 
                    : 'text-2xl sm:text-3xl font-semibold tracking-tight';

                return (
                    <div className={cn("w-full py-1", alignClass)}>
                        <input
                            type="text"
                            placeholder="Type heading here..."
                            value={activeBlock.title || ''}
                            onChange={(e) => setValue(`resultPages.${pageIndex}.blocks.${index}.title`, e.target.value, { shouldDirty: true })}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect();
                            }}
                            className={cn(
                                "w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-foreground font-semibold",
                                fontClass,
                                activeBlock.style?.textAlign === 'center' ? 'text-center' : activeBlock.style?.textAlign === 'right' ? 'text-right' : 'text-left'
                            )}
                        />
                    </div>
                );
            }
            case 'text': {
                return (
                    <div className={cn("w-full py-1", alignClass)}>
                        <textarea
                            placeholder="Type paragraph content here..."
                            value={activeBlock.content || ''}
                            onChange={(e) => {
                                setValue(`resultPages.${pageIndex}.blocks.${index}.content`, e.target.value, { shouldDirty: true });
                                e.target.style.height = 'auto';
                                e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect();
                            }}
                            rows={1}
                            ref={(el) => {
                                if (el) {
                                    el.style.height = 'auto';
                                    el.style.height = `${el.scrollHeight}px`;
                                }
                            }}
                            className={cn(
                                "w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-muted-foreground leading-relaxed text-base resize-none overflow-hidden",
                                activeBlock.style?.textAlign === 'center' ? 'text-center' : activeBlock.style?.textAlign === 'right' ? 'text-right' : 'text-left'
                            )}
                        />
                    </div>
                );
            }
            case 'quote': {
                return (
                    <div className="w-full py-2">
                        <div className="p-4 sm:p-6 bg-muted/20 border-l-4 border-primary rounded-r-2xl italic text-lg shadow-sm text-left flex items-start gap-3 w-full">
                            <Quote className="h-6 w-6 text-primary/20 shrink-0 mt-1" />
                            <textarea
                                placeholder="Type quote here..."
                                value={activeBlock.content || ''}
                                onChange={(e) => {
                                    setValue(`resultPages.${pageIndex}.blocks.${index}.content`, e.target.value, { shouldDirty: true });
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${e.target.scrollHeight}px`;
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect();
                                }}
                                rows={1}
                                ref={(el) => {
                                    if (el) {
                                        el.style.height = 'auto';
                                        el.style.height = `${el.scrollHeight}px`;
                                    }
                                }}
                                className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-foreground italic resize-none overflow-hidden"
                            />
                        </div>
                    </div>
                );
            }
            case 'button': {
                return (
                    <div className={cn("w-full py-2", alignClass)}>
                        <Button 
                            type="button" 
                            size="lg" 
                            variant={activeBlock.style?.variant as 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost' | null | undefined || 'default'} 
                            className="h-12 px-6 rounded-xl shadow-sm inline-flex items-center gap-2 max-w-full overflow-hidden active:scale-[0.97] transition-all"
                        >
                            <input
                                type="text"
                                value={activeBlock.title || ''}
                                onChange={(e) => setValue(`resultPages.${pageIndex}.blocks.${index}.title`, e.target.value, { shouldDirty: true })}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect();
                                }}
                                className="bg-transparent border-none text-center outline-none focus:outline-none focus:ring-0 p-0 text-inherit font-semibold text-sm w-32 focus:w-40 transition-all"
                            />
                            <ArrowRight className="h-4 w-4 shrink-0" />
                        </Button>
                    </div>
                );
            }
            case 'list': {
                const listItems = activeBlock.items || [];
                return (
                    <div className={cn("w-full py-1", alignClass)}>
                        {listItems.length > 0 && listItems.some(i => i.trim() !== '') ? (
                            activeBlock.listStyle === 'ordered' ? (
                                <ol className="list-decimal list-inside space-y-1.5 text-base font-medium text-slate-700 w-full text-left">
                                    {listItems.map((item: string, i: number) => item.trim() !== '' && <li key={i}>{item}</li>)}
                                </ol>
                            ) : (
                                <ul className="list-disc list-inside space-y-1.5 text-base font-medium text-slate-700 w-full text-left">
                                    {listItems.map((item: string, i: number) => item.trim() !== '' && <li key={i}>{item}</li>)}
                                </ul>
                            )
                        ) : (
                            <p className="text-sm text-muted-foreground italic">List is empty. Click to configure list items.</p>
                        )}
                    </div>
                );
            }
            case 'divider': {
                return (
                    <div className="w-full py-4">
                        <Separator className="bg-border/60" />
                    </div>
                );
            }
            case 'image': {
                return (
                    <div className="w-full py-2 flex justify-center">
                        {activeBlock.url ? (
                            <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-sm border bg-card">
                                <Image src={activeBlock.url} alt="preview" fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" />
                            </div>
                        ) : (
                            <div className="w-full py-8 border border-dashed rounded-2xl bg-muted/10 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
                                <ImageIcon className="h-6 w-6 opacity-40 text-primary" />
                                <span className="font-semibold">No Image URL Configured</span>
                            </div>
                        )}
                    </div>
                );
            }
            case 'video': {
                return (
                    <div className="w-full py-2">
                        {activeBlock.url ? (
                            <VideoEmbed url={activeBlock.url} thumbnailUrl={activeBlock.thumbnailUrl} />
                        ) : (
                            <div className="w-full py-8 border border-dashed rounded-2xl bg-muted/10 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
                                <Video className="h-6 w-6 opacity-40 text-primary" />
                                <span className="font-semibold">No Video URL Configured</span>
                            </div>
                        )}
                    </div>
                );
            }
            case 'audio': {
                return (
                    <div className="w-full py-2">
                        {activeBlock.url ? (
                            <div className="p-4 bg-muted/20 border rounded-2xl shadow-sm">
                                <audio controls src={activeBlock.url} className="w-full" />
                            </div>
                        ) : (
                            <div className="w-full py-8 border border-dashed rounded-2xl bg-muted/10 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
                                <AudioWaveform className="h-6 w-6 opacity-40 text-primary" />
                                <span className="font-semibold">No Audio URL Configured</span>
                            </div>
                        )}
                    </div>
                );
            }
            case 'score-card': {
                return (
                    <div className="w-full py-2 flex justify-center">
                        <Card className="w-full bg-primary text-white border-none shadow-md rounded-3xl p-6 flex flex-col items-center text-center">
                            <Badge variant="outline" className="mb-2 bg-card/10 text-white border-white/20 px-3 py-1 text-[10px] font-semibold uppercase">Result Preview</Badge>
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center justify-center">
                                    <span className="text-5xl font-semibold tabular-nums tracking-tighter">85</span>
                                    <span className="text-2xl font-semibold ml-0.5">%</span>
                                </div>
                                <span className="text-sm font-bold opacity-60">Overall Score</span>
                            </div>
                        </Card>
                    </div>
                );
            }
            default:
                return null;
        }
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={cn(
                "relative group rounded-[1.5rem] border transition-all duration-200 cursor-pointer",
                isSelected 
                    ? "border-primary bg-card/90 shadow-md ring-1 ring-primary/10" 
                    : isHovered 
                    ? "border-border bg-card/30 shadow-sm" 
                    : "border-transparent bg-transparent"
            )}
            onClick={onSelect}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Hover Floating Actions Menu */}
            {(isSelected || isHovered) && (
                <div 
                    className="absolute left-1/2 -translate-x-1/2 -top-6 z-30 flex items-center gap-0.5 bg-background border shadow-md rounded-xl p-1 animate-in fade-in zoom-in-95 duration-200 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Checkbox (First Position) */}
                    <div className="px-2 shrink-0 flex items-center justify-center">
                        <Checkbox 
                            checked={isSelectedForBatch}
                            onCheckedChange={(checked) => onToggleBatchSelect(!!checked)}
                            className="h-3.5 w-3.5 border-muted-foreground/30 data-[state=checked]:bg-primary rounded shrink-0"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    {/* Dragging Handle */}
                    <div {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-muted rounded-lg shrink-0">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>

                    {/* Reordering Controls */}
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={() => swap(index, index - 1)} disabled={index === 0} title="Move up"><ArrowUp className="h-3 w-3" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={() => swap(index, index + 1)} disabled={index === blocksCount - 1} title="Move down"><ArrowDown className="h-3 w-3" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={() => move(index, 0)} disabled={index === 0} title="Move to top"><ChevronsUp className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={() => move(index, blocksCount - 1)} disabled={index === blocksCount - 1} title="Move to bottom"><ChevronsDown className="h-3.5 w-3.5" /></Button>

                    <Separator orientation="vertical" className="h-4 mx-0.5" />

                    {/* Copy Buttons */}
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={onCopySingle} title="Copy to clipboard"><ClipboardCopy className="h-3 w-3" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={() => duplicate(index)} title="Duplicate block"><Copy className="h-3 w-3" /></Button>

                    <Separator orientation="vertical" className="h-4 mx-0.5" />

                    {/* Formatting Toolbar */}
                    {['heading', 'text', 'quote', 'button', 'list'].includes(activeBlock.type) && (
                        <>
                            <ResultFormattingToolbar pageIndex={pageIndex} blockIndex={index} minimal />
                            <Separator orientation="vertical" className="h-4 mx-0.5" />
                        </>
                    )}

                    {/* Delete button (Last position) */}
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => remove(index)} title="Delete block"><Trash2 className="h-3 w-3" /></Button>
                </div>
            )}

            {/* WYSIWYG Content Body */}
            <div className="p-4">
                {renderWysiwygContent()}
            </div>

            {/* Visual Block Type Badge indicator */}
            <Badge variant="outline" className="absolute bottom-2 right-3 text-[9px] font-semibold opacity-0 group-hover:opacity-40 transition-opacity bg-background select-none uppercase tracking-wider">
                {activeBlock.type}
            </Badge>

            {/* Insertion Trigger on Hover Bottom */}
            <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20 flex items-center gap-1 p-1 bg-card border rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className="p-1 hover:bg-muted rounded-full text-primary transition-colors"
                    onClick={() => requestAddBlock(index)}
                    title="Add new block here"
                >
                    <PlusCircle className="h-4 w-4" />
                </button>
                {copiedBlocks && copiedBlocks.length > 0 && (
                    <>
                        <Separator orientation="vertical" className="h-3.5" />
                        <button
                            type="button"
                            className="p-1 hover:bg-muted rounded-full text-emerald-600 transition-colors"
                            onClick={() => onPaste(index + 1)}
                            title={`Paste ${copiedBlocks.length} block(s)`}
                        >
                            <Clipboard className="h-4 w-4" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export function PageEditor({ 
    pageIndex,
    copiedBlocks,
    setCopiedBlocks,
    selectedBlockIds,
    setSelectedBlockIds,
    selectedPageIdx,
    setSelectedPageIdx
}: { 
    pageIndex: number;
    copiedBlocks: SurveyResultBlock[];
    setCopiedBlocks: (blocks: SurveyResultBlock[]) => void;
    selectedBlockIds: Set<string>;
    setSelectedBlockIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    selectedPageIdx: number | null;
    setSelectedPageIdx: React.Dispatch<React.SetStateAction<number | null>>;
}) {
    const { control, getValues, setValue } = useFormContext();
    const { fields: blocks, remove, move, swap, insert } = useFieldArray({
        control,
        name: `resultPages.${pageIndex}.blocks`,
    });

    const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
    const [insertionIndex, setInsertionIndex] = React.useState(0);
    const [selectedBlockIdx, setSelectedBlockIdx] = React.useState<number | null>(null);

    const handleCopySingle = (block: SurveyResultBlock) => {
        setCopiedBlocks([block]);
    };

    const handleToggleSelect = (blockId: string, checked: boolean) => {
        setSelectedBlockIds((prev) => {
            const next = new Set(prev);
            if (checked) {
                next.add(blockId);
                setSelectedPageIdx(pageIndex);
            } else {
                next.delete(blockId);
                if (next.size === 0) {
                    setSelectedPageIdx(null);
                }
            }
            return next;
        });
    };

    const handleBatchCopy = () => {
        const selected = blocks.filter(b => selectedBlockIds.has(b.id)) as SurveyResultBlock[];
        if (selected.length > 0) {
            setCopiedBlocks(selected);
            setSelectedBlockIds(new Set());
            setSelectedPageIdx(null);
        }
    };

    const handleBatchDelete = () => {
        const indicesToRemove = blocks
            .map((b, i) => (selectedBlockIds.has(b.id) ? i : -1))
            .filter(idx => idx !== -1);
        
        if (indicesToRemove.length > 0) {
            remove(indicesToRemove);
            setSelectedBlockIds(new Set());
            setSelectedPageIdx(null);
        }
    };

    const handlePaste = (insertIdx: number) => {
        if (copiedBlocks.length === 0) return;
        const cloned = copiedBlocks.map(b => ({
            ...JSON.parse(JSON.stringify(b)),
            id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        }));
        insert(insertIdx, cloned);
    };

    const sensors = useSensors(useSensor(PointerSensor));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = blocks.findIndex((b) => b.id === active.id);
            const newIndex = blocks.findIndex((b) => b.id === over.id);
            move(oldIndex, newIndex);
            
            // Adjust selection index if currently selected block was moved
            if (selectedBlockIdx === oldIndex) {
                setSelectedBlockIdx(newIndex);
            } else if (selectedBlockIdx === newIndex) {
                setSelectedBlockIdx(oldIndex);
            }
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
        if (type === 'text') newBlock.content = 'Your descriptive text here...';
        if (type === 'list') {
            newBlock.listStyle = 'unordered';
            newBlock.items = ['First point', 'Second important point'];
        }
        if (type === 'button') {
            newBlock.title = 'Next Step';
            newBlock.link = '#';
        }
        if (type === 'quote') newBlock.content = 'Inspirational or analytical quote...';
        if (type === 'audio') {
            newBlock.url = '';
        }

        const idx = selectedBlockIdx !== null ? insertionIndex : blocks.length;
        insert(idx, newBlock);
        setSelectedBlockIdx(idx);
    };

    const duplicateBlock = (index: number) => {
        const blockToDuplicate = getValues(`resultPages.${pageIndex}.blocks.${index}`);
        const newBlock = {
            ...JSON.parse(JSON.stringify(blockToDuplicate)),
            id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        };
        insert(index + 1, newBlock);
        setSelectedBlockIdx(index + 1);
    };

    const removeBlock = (index: number) => {
        remove(index);
        setSelectedBlockIdx(null);
    };

    const swapBlocks = (a: number, b: number) => {
        swap(a, b);
        if (selectedBlockIdx === a) {
            setSelectedBlockIdx(b);
        } else if (selectedBlockIdx === b) {
            setSelectedBlockIdx(a);
        }
    };

    const moveBlock = (from: number, to: number) => {
        move(from, to);
        if (selectedBlockIdx === from) {
            setSelectedBlockIdx(to);
        }
    };

    return (
        <div className="space-y-6">
            {/* Split Screen Layout */}
            <div className="flex flex-col xl:flex-row gap-6 items-start">
                
                {/* 1. Left Properties Sidebar */}
                <Card className="w-full xl:w-[320px] shrink-0 border bg-card shadow-sm rounded-[1.5rem] overflow-hidden self-start xl:sticky xl:top-6 xl:z-20">
                    <CardHeader className="py-3.5 px-4 border-b bg-muted/10 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4 text-primary" />
                            <span className="font-bold text-sm">Block Properties</span>
                        </div>
                        {selectedBlockIdx !== null && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg" onClick={() => setSelectedBlockIdx(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="p-4">
                        {selectedBlockIdx !== null && blocks[selectedBlockIdx] ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between pb-2 border-b">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                        {(blocks[selectedBlockIdx] as SurveyResultBlock).type} Block Settings
                                    </span>
                                </div>
                                
                                {/* Formatting Controls inside Sidebar for Heading/Text */}
                                {['heading', 'text', 'quote', 'button', 'list'].includes((blocks[selectedBlockIdx] as SurveyResultBlock).type) && (
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold text-muted-foreground">Text Alignment</Label>
                                        <ResultFormattingToolbar pageIndex={pageIndex} blockIndex={selectedBlockIdx} minimal />
                                    </div>
                                )}

                                {/* Heading tags selection */}
                                {(blocks[selectedBlockIdx] as SurveyResultBlock).type === 'heading' && (
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold text-muted-foreground">Size Style</Label>
                                        <Select 
                                            value={(blocks[selectedBlockIdx] as SurveyResultBlock).variant || 'h2'} 
                                            onValueChange={(val) => setValue(`resultPages.${pageIndex}.blocks.${selectedBlockIdx}.variant`, val, { shouldDirty: true })}
                                        >
                                            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="h1">H1 (Large)</SelectItem>
                                                <SelectItem value="h2">H2 (Medium)</SelectItem>
                                                <SelectItem value="h3">H3 (Small)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <BlockInspector pageIndex={pageIndex} blockIndex={selectedBlockIdx} />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="text-center py-4 flex flex-col items-center justify-center gap-2 border-b">
                                    <Layout className="h-6 w-6 opacity-35 text-primary animate-pulse" />
                                    <p className="text-xs font-semibold leading-relaxed text-muted-foreground/80 max-w-[220px] mx-auto">
                                        Click any block on the right canvas to customize, or add a new block:
                                    </p>
                                </div>
                                <div className="space-y-3 pt-2">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block px-1">
                                        Add Content Block
                                    </span>
                                    <div className="grid grid-cols-2 gap-2">
                                        {([
                                            { type: 'heading', label: 'Heading', icon: Heading1 },
                                            { type: 'text', label: 'Text Block', icon: Type },
                                            { type: 'list', label: 'List View', icon: List },
                                            { type: 'image', label: 'Image', icon: ImageIcon },
                                            { type: 'video', label: 'Video', icon: Video },
                                            { type: 'audio', label: 'Audio', icon: AudioWaveform },
                                            { type: 'button', label: 'Button', icon: MousePointer2 },
                                            { type: 'quote', label: 'Quote', icon: Quote },
                                            { type: 'divider', label: 'Divider', icon: Square },
                                            { type: 'score-card', label: 'Score Card', icon: TrophyIcon },
                                        ] as const).map(({ type, label, icon: Icon }) => (
                                            <Button
                                                key={type}
                                                variant="outline"
                                                size="sm"
                                                type="button"
                                                className="h-auto py-3 px-2 flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-xs font-bold shadow-sm"
                                                onClick={() => handleBlockSelect(type)}
                                            >
                                                <div className="p-1 bg-primary/10 rounded-lg shrink-0">
                                                    <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                                                </div>
                                                <span className="text-[9px] tracking-tight text-foreground/80">{label}</span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 2. Right Canvas (WYSIWYG layout) */}
                <div className="flex-1 w-full min-h-[400px]">
                    <div className="border bg-background dark:bg-slate-950 rounded-[2rem] shadow-sm p-6 sm:p-10 min-h-[500px] border-border/80">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-4">
                                    {copiedBlocks && copiedBlocks.length > 0 && (
                                        <div className="flex justify-center -mb-2">
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handlePaste(0)}
                                                className="h-8 rounded-full border-dashed border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50 text-[10px] font-bold text-emerald-700 flex items-center gap-1.5 transition-all shadow-sm"
                                            >
                                                <Clipboard className="h-3 w-3" /> Paste {copiedBlocks.length} block(s) at start
                                            </Button>
                                        </div>
                                    )}
                                    {blocks.map((block, bIndex) => (
                                        <SortableResultBlock 
                                            key={block.id}
                                            id={block.id}
                                            index={bIndex}
                                            pageIndex={pageIndex}
                                            block={block as SurveyResultBlock}
                                            remove={removeBlock}
                                            swap={swapBlocks}
                                            move={moveBlock}
                                            duplicate={duplicateBlock}
                                            requestAddBlock={requestAddBlock}
                                            isSelected={selectedBlockIdx === bIndex}
                                            onSelect={() => setSelectedBlockIdx(bIndex)}
                                            isSelectedForBatch={selectedPageIdx === pageIndex && selectedBlockIds.has(block.id)}
                                            onToggleBatchSelect={(checked) => handleToggleSelect(block.id, checked)}
                                            onCopySingle={() => handleCopySingle(block as SurveyResultBlock)}
                                            copiedBlocks={copiedBlocks}
                                            onPaste={handlePaste}
                                            blocksCount={blocks.length}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>

                        {blocks.length === 0 && (
                            <div className="text-center py-20 border-2 border-dashed rounded-3xl bg-muted/10 flex flex-col items-center justify-center gap-3">
                                <p className="text-sm text-muted-foreground font-semibold italic">This page has no content yet.</p>
                                <div className="flex items-center gap-3">
                                    <Button type="button" variant="outline" onClick={() => { setInsertionIndex(0); setIsAddModalOpen(true); }} className="font-bold rounded-xl h-10 shadow-sm">
                                        <PlusCircle className="mr-2 h-4 w-4 text-primary" /> Add First Block
                                    </Button>
                                    {copiedBlocks && copiedBlocks.length > 0 && (
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            onClick={() => handlePaste(0)} 
                                            className="font-bold border-emerald-200 text-emerald-700 bg-emerald-50/30 hover:bg-emerald-50 rounded-xl h-10 shadow-sm animate-in fade-in zoom-in-95 duration-200"
                                        >
                                            <Clipboard className="mr-2 h-4 w-4 text-emerald-600" /> Paste {copiedBlocks.length} block(s)
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            <AddResultBlockModal 
                open={isAddModalOpen} 
                onOpenChange={setIsAddModalOpen} 
                onSelect={handleBlockSelect} 
            />

            {/* Batch Selection Floating Actions Bar */}
            {selectedPageIdx === pageIndex && selectedBlockIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-sm font-bold text-foreground">
                            {selectedBlockIds.size} {selectedBlockIds.size === 1 ? 'block' : 'blocks'} selected
                        </span>
                    </div>
                    
                    <Separator orientation="vertical" className="h-6" />
                    
                    <div className="flex items-center gap-2">
                        <Button 
                            type="button"
                            variant="secondary" 
                            size="sm" 
                            className="font-bold gap-2 rounded-xl h-9" 
                            onClick={handleBatchCopy}
                        >
                            <Copy className="h-3.5 w-3.5" /> Copy Selected
                        </Button>
                        <Button 
                            type="button"
                            variant="destructive" 
                            size="sm" 
                            className="font-bold gap-2 rounded-xl h-9" 
                            onClick={handleBatchDelete}
                        >
                            <Trash2 className="h-3.5 w-3.5" /> Delete Selected
                        </Button>
                    </div>

                    <Separator orientation="vertical" className="h-6" />

                    <Button 
                        type="button"
                        variant="ghost" 
                        size="sm" 
                        className="font-semibold text-xs h-9 rounded-xl hover:bg-muted" 
                        onClick={() => {
                            setSelectedBlockIds(new Set());
                            setSelectedPageIdx(null);
                        }}
                    >
                        Clear Selection
                    </Button>
                </div>
            )}
        </div>
    );
}

export default function ResultPageBuilder() {
    const { control, watch, setValue, register, getValues } = useFormContext();
    const { fields: pages, append, remove } = useFieldArray({
        control,
        name: 'resultPages',
    });
    const maxScore = watch('maxScore') || 100;
    const scoreDisplayMode = watch('scoreDisplayMode') || 'points';
    const [previewPageIdx, setPreviewPageIdx] = React.useState<number | null>(null);
    const watchedPages = watch('resultPages') || [];

    // Shared clipboard state for blocks (Next.js hydration-safe)
    const [copiedBlocks, setCopiedBlocks] = React.useState<SurveyResultBlock[]>([]);
    const [selectedBlockIds, setSelectedBlockIds] = React.useState<Set<string>>(new Set());
    const [selectedPageIdx, setSelectedPageIdx] = React.useState<number | null>(null);
    const [editingPageIdx, setEditingPageIdx] = React.useState<number | null>(null);

    React.useEffect(() => {
        try {
            const item = window.localStorage.getItem('smartsapp_copied_blocks');
            if (item) {
                const parsed = JSON.parse(item) as SurveyResultBlock[];
                if (Array.isArray(parsed)) {
                    setCopiedBlocks(parsed);
                }
            }
        } catch (e) {
            console.error('Failed to load copied blocks:', e);
        }
    }, []);

    const setAndStoreCopiedBlocks = (blocks: SurveyResultBlock[]) => {
        setCopiedBlocks(blocks);
        try {
            window.localStorage.setItem('smartsapp_copied_blocks', JSON.stringify(blocks));
        } catch (e) {
            console.error('Failed to save copied blocks:', e);
        }
    };

    const clonePage = (index: number) => {
        const pageToClone = getValues(`resultPages.${index}`) as SurveyResultPage;
        if (!pageToClone) return;

        const clonedPage: SurveyResultPage = {
            ...JSON.parse(JSON.stringify(pageToClone)),
            id: `pg_${Date.now()}`,
            name: `Copy of ${pageToClone.name || 'Outcome Page'}`,
            isDefault: false
        };

        if (clonedPage.blocks && Array.isArray(clonedPage.blocks)) {
            clonedPage.blocks = clonedPage.blocks.map((block: SurveyResultBlock) => ({
                ...block,
                id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
            }));
        }

        append(clonedPage);
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">Outcome Pages</h3>
                    <p className="text-sm text-muted-foreground">Design unique landing pages for different user scores.</p>
                </div>
                <div className="flex items-center gap-3">
                    <AiChatEditor variant="icon" />
                    <Button onClick={() => append({ id: `pg_${Date.now()}`, name: `Outcome Page ${pages.length + 1}`, blocks: [], isDefault: pages.length === 0 })} className="gap-2 font-bold shadow-lg">
                        <Plus className="h-4 w-4" /> New Page
                    </Button>
                </div>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
                {pages.map((page, index) => (
                    <AccordionItem key={page.id} value={page.id} className="border rounded-2xl px-4 bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <AccordionTrigger className="hover:no-underline py-6">
                            <div className="flex items-center justify-between w-full pr-4" onClick={(e) => {
                                // Prevent Accordion from opening/closing when clicking on elements in this container
                            }}>
                                <div className="flex items-center gap-4 text-left">
                                    <div className="p-2 bg-primary/10 rounded-xl">
                                        <Layout className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        {editingPageIdx === index ? (
                                            <Input 
                                                value={watch(`resultPages.${index}.name`)}
                                                onChange={(e) => setValue(`resultPages.${index}.name`, e.target.value, { shouldDirty: true })}
                                                onBlur={() => setEditingPageIdx(null)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        setEditingPageIdx(null);
                                                    }
                                                }}
                                                autoFocus
                                                className="h-8 py-0 px-2 text-sm font-semibold max-w-[200px] bg-background"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <div className="flex items-center gap-1.5 group/title">
                                                <span className="font-semibold text-lg leading-none">{(watchedPages[index] as SurveyResultPage)?.name || (page as SurveyResultPage).name || `Outcome Page ${index + 1}`}</span>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingPageIdx(index);
                                                    }}
                                                    className="p-1 hover:bg-muted rounded text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity"
                                                    title="Rename page"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-xs text-muted-foreground font-bold mt-1">{(page as SurveyResultPage).blocks?.length || 0} Content Blocks</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                    {/* Default Switch */}
                                    <div className="flex items-center gap-2 h-9 px-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                                        <Switch 
                                            checked={!!watch(`resultPages.${index}.isDefault`)} 
                                            onCheckedChange={(val) => {
                                                if (val) {
                                                    pages.forEach((_, i) => setValue(`resultPages.${i}.isDefault`, i === index, { shouldDirty: true }));
                                                }
                                            }}
                                        />
                                        <span className="text-xs font-bold text-muted-foreground select-none">Default</span>
                                    </div>

                                    {/* Celebrate Switch */}
                                    <div className="flex items-center gap-2 h-9 px-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                                        <Controller
                                            name={`resultPages.${index}.confettiEnabled`}
                                            control={control}
                                            render={({ field }) => (
                                                <Switch
                                                    checked={!!field.value}
                                                    onCheckedChange={field.onChange}
                                                    className="data-[state=checked]:bg-amber-500"
                                                />
                                            )}
                                        />
                                        <span className="text-xs font-bold text-muted-foreground select-none">Celebrate</span>
                                    </div>

                                    {/* Divider */}
                                    <div className="h-6 w-[1px] bg-border mx-1" />

                                    {/* Action Buttons with Tooltips */}
                                    <TooltipProvider>
                                        <div className="flex items-center gap-1">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button 
                                                        type="button" 
                                                        variant="outline" 
                                                        size="icon" 
                                                        className="h-9 w-9 rounded-lg" 
                                                        onClick={() => setPreviewPageIdx(index)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <span className="text-[10px] font-bold">Preview Page</span>
                                                </TooltipContent>
                                            </Tooltip>

                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button 
                                                        type="button" 
                                                        variant="outline" 
                                                        size="icon" 
                                                        className="h-9 w-9 rounded-lg" 
                                                        onClick={() => clonePage(index)}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <span className="text-[10px] font-bold">Clone Page</span>
                                                </TooltipContent>
                                            </Tooltip>

                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg" 
                                                        onClick={() => remove(index)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <span className="text-[10px] font-bold">Delete Page</span>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </TooltipProvider>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-6 pb-8 space-y-8 border-t">
                            <PageEditor 
                                pageIndex={index} 
                                copiedBlocks={copiedBlocks}
                                setCopiedBlocks={setAndStoreCopiedBlocks}
                                selectedBlockIds={selectedBlockIds}
                                setSelectedBlockIds={setSelectedBlockIds}
                                selectedPageIdx={selectedPageIdx}
                                setSelectedPageIdx={setSelectedPageIdx}
                            />
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>

            {pages.length === 0 && (
                <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-3xl">
                    <Layout className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground font-semibold text-xs">No outcome pages built yet.</p>
                    <Button variant="link" onClick={() => append({ id: `pg_${Date.now()}`, name: `Welcome Page`, blocks: [], isDefault: true })} className="mt-2">
                        Add your first landing page
                    </Button>
                </div>
            )}

            {previewPageIdx !== null && (
                <PagePreviewModal 
                    open={previewPageIdx !== null} 
                    onOpenChange={(o) => !o && setPreviewPageIdx(null)} 
                    page={{ ...pages[previewPageIdx], ...watchedPages[previewPageIdx] } as SurveyResultPage}
                    maxScore={maxScore}
                    displayMode={scoreDisplayMode}
                />
            )}
        </div>
    );
}
