
'use client';

import * as React from 'react';
import { useFormContext, useFieldArray, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Layout, Settings2, MoreHorizontal, Copy, GripVertical, Heading1, AlignLeft, AlignCenter, AlignRight, Type, Image as ImageIcon, Video, Quote, Square, MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { SurveyResultPage, SurveyResultBlock } from '@/lib/types';
import { MediaSelect } from '../../schools/components/media-select';

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

function BlockInspector({ pageIndex, blockIndex }: { pageIndex: number, blockIndex: number }) {
    const { register, watch, setValue } = useFormContext();
    const block: SurveyResultBlock = useWatch({ name: `resultPages.${pageIndex}.blocks.${blockIndex}` });

    if (!block) return null;

    return (
        <div className="space-y-6 pt-4 border-t mt-4">
            <div className="grid gap-4">
                {/* Content Configuration */}
                {['heading', 'button'].includes(block.type) && (
                    <div className="space-y-2">
                        <Label>Title / Text</Label>
                        <Input {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.title`)} />
                    </div>
                )}
                {block.type === 'text' && (
                    <div className="space-y-2">
                        <Label>Content (HTML Supported)</Label>
                        <Textarea {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.content`)} className="min-h-[150px]" />
                    </div>
                )}
                {block.type === 'quote' && (
                    <div className="space-y-2">
                        <Label>Quote Text</Label>
                        <Textarea {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.content`)} />
                    </div>
                )}
                {['image', 'video'].includes(block.type) && (
                    <div className="space-y-2">
                        <Label>Media URL</Label>
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
                            <Label>Link URL</Label>
                            <Input placeholder="https://..." {...register(`resultPages.${pageIndex}.blocks.${blockIndex}.link`)} />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Open in New Tab</Label>
                            <Switch 
                                checked={!!block.openInNewTab} 
                                onCheckedChange={(val) => setValue(`resultPages.${pageIndex}.blocks.${blockIndex}.openInNewTab`, val, { shouldDirty: true })}
                            />
                        </div>
                    </div>
                )}

                {/* Style Configuration */}
                <div className="pt-4 border-t space-y-4">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Styling</Label>
                    
                    <div className="space-y-2">
                        <Label className="text-xs">Text Alignment</Label>
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
                            <Label className="text-xs">Button Variant</Label>
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
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Animate Celebration</Label>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
                {Object.entries(blockIcons).map(([type, Icon]) => (
                    <Button
                        key={type}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 text-[10px] font-bold uppercase gap-2"
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
                        <Card key={block.id} className="bg-muted/30 shadow-none border-dashed border-2 hover:border-primary/50 transition-colors">
                            <CardHeader className="py-2 px-4 flex flex-row items-center justify-between space-y-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-background rounded border">
                                        <Icon className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{blockType} Block</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(bIndex, bIndex - 1)} disabled={bIndex === 0}><GripVertical className="h-3 w-3" /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(bIndex)}><Trash2 className="h-3 w-3" /></Button>
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
    const { control, watch } = useFormContext();
    const { fields: pages, append, remove } = useFieldArray({
        control,
        name: 'resultPages',
    });

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-primary">Outcome Pages</h3>
                    <p className="text-sm text-muted-foreground">Design unique landing pages for different user scores.</p>
                </div>
                <Button onClick={() => append({ id: `pg_${Date.now()}`, name: `Outcome Page ${pages.length + 1}`, blocks: [], isDefault: pages.length === 0 })} className="gap-2">
                    <Plus className="h-4 w-4" /> New Page
                </Button>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
                {pages.map((page, index) => (
                    <AccordionItem key={page.id} value={page.id} className="border rounded-xl px-4 bg-background">
                        <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-4 text-left">
                                <Layout className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="font-bold">{(page as any).name}</p>
                                    <p className="text-xs text-muted-foreground">{(page as any).blocks?.length || 0} blocks</p>
                                </div>
                                {(page as any).isDefault && <Badge variant="secondary" className="ml-2">Default</Badge>}
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4 pb-8 space-y-8 border-t">
                            <div className="flex items-end gap-4 max-w-lg">
                                <div className="flex-grow space-y-1.5">
                                    <Label className="text-xs font-bold uppercase">Internal Name</Label>
                                    <Input {...register(`resultPages.${index}.name`)} />
                                </div>
                                <div className="flex items-center gap-2 pb-2">
                                    <Switch 
                                        checked={!!watch(`resultPages.${index}.isDefault`)} 
                                        onCheckedChange={(val) => {
                                            if (val) {
                                                pages.forEach((_, i) => setValue(`resultPages.${i}.isDefault`, i === index, { shouldDirty: true }));
                                            }
                                        }}
                                    />
                                    <Label className="text-xs">Set as Default</Label>
                                </div>
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>

                            <PageEditor pageIndex={index} />
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>

            {pages.length === 0 && (
                <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-2xl">
                    <Layout className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">No outcome pages built yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Start by adding your first landing page.</p>
                </div>
            )}
        </div>
    );
}
