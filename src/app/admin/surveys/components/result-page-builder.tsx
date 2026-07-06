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
    List, ListOrdered, AlignJustify, Sparkles, Settings, X
} from 'lucide-react';
import { cn, stripHtml } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { SurveyResultPage, SurveyResultBlock } from '@/lib/types';
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

function PagePreviewModal({ open, onOpenChange, page, maxScore, displayMode }: { open: boolean, onOpenChange: (o: boolean) => void, page: SurveyResultPage, maxScore: number, displayMode: 'points' | 'percentage' }) {
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
    duplicate,
    requestAddBlock,
    isSelected,
    onSelect
}: { 
    id: string, 
    index: number, 
    pageIndex: number, 
    block: SurveyResultBlock, 
    remove: (i: number) => void,
    swap: (a: number, b: number) => void,
    duplicate: (i: number) => void,
    requestAddBlock: (i: number) => void,
    isSelected: boolean,
    onSelect: () => void
}) {
    const { setValue } = useFormContext();
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const [isHovered, setIsHovered] = React.useState(false);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const alignClass = block.style?.textAlign === 'center' 
        ? 'text-center flex flex-col items-center' 
        : block.style?.textAlign === 'right' 
        ? 'text-right flex flex-col items-end' 
        : block.style?.textAlign === 'justify' 
        ? 'text-justify' 
        : 'text-left';

    const renderWysiwygContent = () => {
        switch (block.type) {
            case 'heading': {
                const fontClass = block.variant === 'h1' 
                    ? 'text-3xl sm:text-4xl font-semibold tracking-tight' 
                    : block.variant === 'h3' 
                    ? 'text-lg sm:text-xl font-bold tracking-tight' 
                    : 'text-2xl sm:text-3xl font-semibold tracking-tight';

                return (
                    <div className={cn("w-full py-1", alignClass)}>
                        <input
                            type="text"
                            placeholder="Type heading here..."
                            value={block.title || ''}
                            onChange={(e) => setValue(`resultPages.${pageIndex}.blocks.${index}.title`, e.target.value, { shouldDirty: true })}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect();
                            }}
                            className={cn(
                                "w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 text-foreground font-semibold",
                                fontClass,
                                block.style?.textAlign === 'center' ? 'text-center' : block.style?.textAlign === 'right' ? 'text-right' : 'text-left'
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
                            value={block.content || ''}
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
                                block.style?.textAlign === 'center' ? 'text-center' : block.style?.textAlign === 'right' ? 'text-right' : 'text-left'
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
                                value={block.content || ''}
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
                            variant={block.style?.variant as 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost' | null | undefined || 'default'} 
                            className="h-12 px-6 rounded-xl shadow-sm inline-flex items-center gap-2 max-w-full overflow-hidden active:scale-[0.97] transition-all"
                        >
                            <input
                                type="text"
                                value={block.title || ''}
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
                const listItems = block.items || [];
                return (
                    <div className={cn("w-full py-1", alignClass)}>
                        {listItems.length > 0 && listItems.some(i => i.trim() !== '') ? (
                            block.listStyle === 'ordered' ? (
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
                        {block.url ? (
                            <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-sm border bg-card">
                                <Image src={block.url} alt="preview" fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" />
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
                        {block.url ? (
                            <VideoEmbed url={block.url} thumbnailUrl={block.thumbnailUrl} />
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
                        {block.url ? (
                            <div className="p-4 bg-muted/20 border rounded-2xl shadow-sm">
                                <audio controls src={block.url} className="w-full" />
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
                "relative group rounded-3xl border transition-all duration-300 overflow-hidden cursor-pointer",
                isSelected 
                    ? "border-primary bg-card/90 shadow-lg ring-1 ring-primary/20" 
                    : "border-border hover:border-primary/30 bg-card/30"
            )}
            onClick={onSelect}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Hover Floating Actions Menu */}
            {(isSelected || isHovered) && (
                <div 
                    className="absolute top-3 right-3 z-30 flex items-center gap-0.5 bg-background border shadow-md rounded-xl p-1 animate-in fade-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-muted rounded-lg shrink-0">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <Separator orientation="vertical" className="h-4 mx-0.5" />
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={() => swap(index, index - 1)} disabled={index === 0}><ArrowUp className="h-3 w-3" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={() => swap(index, index + 1)}><ArrowDown className="h-3 w-3" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" onClick={() => duplicate(index)}><Copy className="h-3 w-3" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => remove(index)}><Trash2 className="h-3 w-3" /></Button>
                </div>
            )}

            {/* WYSIWYG Content Body */}
            <div className="p-6">
                {renderWysiwygContent()}
            </div>

            {/* Visual Block Type Badge indicator */}
            <Badge variant="outline" className="absolute bottom-2 right-3 text-[9px] font-semibold opacity-0 group-hover:opacity-40 transition-opacity bg-background select-none uppercase tracking-wider">
                {block.type}
            </Badge>

            {/* Insertion Trigger on Hover Bottom */}
            <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20 cursor-pointer p-1.5 bg-card border rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                onClick={(e) => {
                    e.stopPropagation();
                    requestAddBlock(index);
                }}
            >
                <PlusCircle className="h-4 w-4 text-primary" />
            </div>
        </div>
    );
}

export function PageEditor({ pageIndex }: { pageIndex: number }) {
    const { control, getValues, setValue } = useFormContext();
    const { fields: blocks, remove, move, swap, insert } = useFieldArray({
        control,
        name: `resultPages.${pageIndex}.blocks`,
    });

    const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
    const [insertionIndex, setInsertionIndex] = React.useState(0);
    const [selectedBlockIdx, setSelectedBlockIdx] = React.useState<number | null>(null);

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

        insert(insertionIndex, newBlock);
        setSelectedBlockIdx(insertionIndex);
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

    return (
        <div className="space-y-6">
            {/* Top Config Card */}
            <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                <div className="space-y-0.5">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" /> Celebrate Submission
                    </Label>
                    <p className="text-xs text-muted-foreground font-medium">Trigger a confetti explosion when the respondent views this page.</p>
                </div>
                <Controller
                    name={`resultPages.${pageIndex}.confettiEnabled`}
                    control={control}
                    render={({ field }) => (
                        <Switch
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-amber-500"
                        />
                    )}
                />
            </div>

            {/* Split Screen Layout */}
            <div className="flex flex-col xl:flex-row gap-6 items-start">
                
                {/* 1. Left Canvas (WYSIWYG layout) */}
                <div className="flex-1 w-full space-y-6 min-h-[400px]">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-6">
                                {blocks.map((block, bIndex) => (
                                    <SortableResultBlock 
                                        key={block.id}
                                        id={block.id}
                                        index={bIndex}
                                        pageIndex={pageIndex}
                                        block={block as SurveyResultBlock}
                                        remove={removeBlock}
                                        swap={swapBlocks}
                                        duplicate={duplicateBlock}
                                        requestAddBlock={requestAddBlock}
                                        isSelected={selectedBlockIdx === bIndex}
                                        onSelect={() => setSelectedBlockIdx(bIndex)}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>

                    {blocks.length === 0 && (
                        <div className="text-center py-20 border-2 border-dashed rounded-3xl bg-muted/10">
                            <p className="text-sm text-muted-foreground mb-4 font-semibold italic">This page has no content yet.</p>
                            <Button type="button" variant="outline" onClick={() => { setInsertionIndex(0); setIsAddModalOpen(true); }} className="font-bold">
                                <PlusCircle className="mr-2 h-4 w-4" /> Add First Block
                            </Button>
                        </div>
                    )}
                </div>

                {/* 2. Right Properties Sidebar */}
                <Card className="w-full xl:w-[320px] shrink-0 border bg-card shadow-sm rounded-[1.5rem] overflow-hidden self-start">
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
                            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                                <Layout className="h-8 w-8 opacity-30 text-primary animate-pulse" />
                                <p className="text-xs font-semibold leading-relaxed max-w-[200px] mx-auto text-muted-foreground/80">
                                    Click any block on the left canvas to customize its settings.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>

            <AddResultBlockModal 
                open={isAddModalOpen} 
                onOpenChange={setIsAddModalOpen} 
                onSelect={handleBlockSelect} 
            />
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
                <Button onClick={() => append({ id: `pg_${Date.now()}`, name: `Outcome Page ${pages.length + 1}`, blocks: [], isDefault: pages.length === 0 })} className="gap-2 font-bold shadow-lg">
                    <Plus className="h-4 w-4" /> New Page
                </Button>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
                {pages.map((page, index) => (
                    <AccordionItem key={page.id} value={page.id} className="border rounded-2xl px-4 bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <AccordionTrigger className="hover:no-underline py-6">
                            <div className="flex items-center gap-4 text-left">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <Layout className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="font-semibold text-lg leading-none mb-1">{(page as SurveyResultPage).name}</p>
                                    <p className="text-xs text-muted-foreground font-bold ">{(page as SurveyResultPage).blocks?.length || 0} Content Blocks</p>
                                </div>
                                {(page as SurveyResultPage).isDefault && <Badge variant="secondary" className="ml-2 bg-green-50 text-green-700 border-green-200">Default Fallback</Badge>}
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4 pb-8 space-y-8 border-t">
                            <div className="flex flex-wrap items-end gap-4">
                                <div className="flex-grow space-y-1.5 min-w-[200px]">
                                    <Label className="text-[10px] font-bold text-muted-foreground">Internal Page Name</Label>
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
                                    <Label className="text-xs font-bold">Default Page</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button type="button" variant="outline" className="h-11 px-4 gap-2 font-bold" onClick={() => setPreviewPageIdx(index)}>
                                        <Eye className="h-4 w-4" /> Preview
                                    </Button>
                                    <Button type="button" variant="outline" className="h-11 px-4 gap-2 font-bold" onClick={() => clonePage(index)}>
                                        <Copy className="h-4 w-4" /> Clone
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
                    page={pages[previewPageIdx] as SurveyResultPage}
                    maxScore={maxScore}
                    displayMode={scoreDisplayMode}
                />
            )}
        </div>
    );
}
