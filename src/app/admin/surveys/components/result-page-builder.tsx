'use client';

import * as React from 'react';
import { useFormContext, useFieldArray, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Layout, GripVertical, Heading1, AlignLeft, AlignCenter, AlignRight, Type, Image as ImageIcon, Video, Quote, Square, MousePointer2, Eye, Copy, ArrowRight } from 'lucide-react';
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

const blockIcons: Record<string, React.ElementType> = {
    heading: Heading1,
    text: Type,
    image: ImageIcon,
    video: Video,
    button: MousePointer2,
    quote: Quote,
    divider: Square,
    'score-card': Trophy,
};

function Trophy(props: any) {
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
        >
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
    )
}

function PagePreviewModal({ open, onOpenChange, page, maxScore }: { open: boolean, onOpenChange: (o: boolean) => void, page: SurveyResultPage, maxScore: number }) {
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
                                    block.style?.textAlign === 'center' ? 'text-center flex flex-col items-center' : block.style?.textAlign === 'right' ? 'text-right flex flex-col items-end' : 'text-left'
                                )}>
                                    {block.type === 'heading' && <h2 className="text-3xl font-black tracking-tight">{block.title}</h2>}
                                    {block.type === 'text' && <div className="prose prose-slate max-w-none text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: block.content || '' }} />}
                                    {block.type === 'image' && block.url && <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-lg border-4 border-white"><Image src={block.url} alt="preview" fill className="object-cover" /></div>}
                                    {block.type === 'video' && block.url && <div className="w-full"><VideoEmbed url={block.url} /></div>}
                                    {block.type === 'button' && <Button size="lg" variant={block.style?.variant as any} className="h-14 px-8 text-lg font-black rounded-xl shadow-lg">{block.title} <ArrowRight className="ml-2 h-5 w-5"/></Button>}
                                    {block.type === 'quote' && <div className="p-8 bg-white border-l-4 border-primary rounded-r-2xl italic text-xl shadow-sm text-left"><Quote className="h-8 w-8 text-primary/20 mb-4" />{block.content}</div>}
                                    {block.type === 'score-card' && (
                                        <Card className="w-full bg-primary text-white border-none shadow-xl rounded-3xl p-8 flex flex-col items-center text-center">
                                            <Badge variant="outline" className="mb-4 bg-white/10 text-white border-white/20 px-4 py-1 text-[10px] font-black tracking-widest uppercase">Sample Result</Badge>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-7xl font-black tabular-nums tracking-tighter">{(maxScore * 0.85).toFixed(0)}</span>
                                                <span className="text-lg font-bold opacity-60 uppercase tracking-widest">out of {maxScore}</span>
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

function BlockInspector({ pageIndex, blockIndex }: { pageIndex: number, blockIndex: number }) {
    const { register, watch, setValue } = useFormContext();
    const block: SurveyResultBlock = useWatch({ name: `resultPages.${pageIndex}.blocks.${blockIndex}` });

    if (!block) return null;

    return (
        <div className="space-y-6 pt-4 border-t mt-4">
            <div className="grid gap-4">
                {['heading', 'button'].includes(block.type) && (
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Title / Text</Label>
                        <Input {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.title`)} />
                    </div>
                )}
                {block.type === 'text' && (
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Content (HTML Supported)</Label>
                        <Textarea {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.content`)} className="min-h-[150px] text-sm" />
                    </div>
                )}
                {block.type === 'quote' && (
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Quote Text</Label>
                        <Textarea {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.content`)} className="text-sm italic" />
                    </div>
                )}
                {['image', 'video'].includes(block.type) && (
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Media URL</Label>
                        <MediaSelect 
                            value={block.url} 
                            onValueChange={(val) => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.url`, val, { shouldDirty: true })}
                            filterType={block.type as any}
                        />
                    </div>
                )}
                {block.type === 'button' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Link URL</Label>
                            <Input placeholder="https://..." {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.link`)} />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Open in New Tab</Label>
                            <Switch 
                                checked={!!block.openInNewTab} 
                                onCheckedChange={(val) => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.openInNewTab`, val, { shouldDirty: true })}
                            />
                        </div>
                    </div>
                )}

                <div className="pt-4 border-t space-y-4">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Block Styling</Label>
                    
                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-muted-foreground">Text Alignment</Label>
                        <div className="flex gap-1">
                            {['left', 'center', 'right'].map((align) => {
                                const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
                                return (
                                    <Button
                                        key={align}
                                        type="button"
                                        variant={block.style?.textAlign === align ? 'default' : 'outline'}
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.style.textAlign`, align, { shouldDirty: true })}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </Button>
                                )
                            })}
                        </div>
                    </div>

                    {block.type === 'button' && (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground">Button Variant</Label>
                            <Select 
                                value={block.style?.variant || 'default'} 
                                onValueChange={(val) => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.style.variant`, val, { shouldDirty: true })}
                            >
                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {['default', 'outline', 'secondary', 'destructive', 'ghost'].map(v => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {block.type === 'score-card' && (
                        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/50">
                            <Label className="text-xs font-bold">Animate Celebration</Label>
                            <Switch 
                                checked={!!block.style?.animate} 
                                onCheckedChange={(val) => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.style.animate`, val, { shouldDirty: true })}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function PageEditor({ pageIndex }: { pageIndex: number }) {
    const { control, register } = useFormContext();
    const { fields: blocks, append, remove, move } = useFieldArray({
        control,
        name: `resultPages.${pageIndex}.blocks`,
    });

    const addBlock = (type: SurveyResultBlock['type']) => {
        const newBlock: Partial<SurveyResultBlock> = {
            id: `blk_${Date.now()}`,
            type,
            style: { textAlign: 'center', animate: true, variant: 'default' },
        };

        if (type === 'heading') newBlock.title = 'Outcome Heading';
        if (type === 'text') newBlock.content = '<p>Your descriptive text here...</p>';
        if (type === 'button') {
            newBlock.title = 'Next Step';
            newBlock.link = '#';
        }
        if (type === 'quote') newBlock.content = 'Inspirational or analytical quote...';

        append(newBlock);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8 bg-muted/30 p-2 rounded-xl border border-dashed">
                {Object.entries(blockIcons).map(([type, Icon]) => (
                    <Button
                        key={type}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10 text-[10px] font-black uppercase tracking-widest gap-2 hover:bg-background hover:shadow-sm transition-all"
                        onClick={() => addBlock(type as any)}
                    >
                        <Icon className="h-3 w-3 text-primary" /> {type}
                    </Button>
                ))}
            </div>

            <div className="space-y-4">
                {blocks.map((block, bIndex) => {
                    const blockType = (block as any).type;
                    const Icon = blockIcons[blockType] || Type;
                    return (
                        <Card key={block.id} className="bg-card shadow-none border hover:border-primary/50 transition-colors">
                            <CardHeader className="py-2 px-4 flex flex-row items-center justify-between space-y-0 border-b bg-muted/10">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-background rounded border">
                                        <Icon className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{blockType} Block</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(bIndex, bIndex - 1)} disabled={bIndex === 0}><GripVertical className="h-3 w-3" /></Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(bIndex)}><Trash2 className="h-3 w-3" /></Button>
                                </div>
                            </CardHeader>
                            <CardContent className="px-4 pb-4">
                                <BlockInspector pageIndex={pageIndex} blockIndex={bIndex} />
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
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
                />
            )}
        </div>
    );
}
