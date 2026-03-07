'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
    Bold, 
    Italic, 
    Underline, 
    AlignLeft, 
    AlignCenter, 
    AlignRight, 
    AlignJustify,
    Type,
    List,
    ListOrdered
} from 'lucide-react';
import type { MessageBlock, VariableDefinition } from '@/lib/types';
import { MediaSelect } from '@/app/admin/schools/components/media-select';
import { cn } from '@/lib/utils';

interface BlockInspectorProps {
    block: MessageBlock;
    variables: VariableDefinition[];
    onUpdate: (props: Partial<MessageBlock>) => void;
}

export function BlockInspector({ block, onUpdate }: BlockInspectorProps) {
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
                                className="min-h-[200px] text-sm rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 p-4 leading-relaxed"
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
                            <Input value={block.link || ''} onChange={e => onUpdate({ link: e.target.value })} className="rounded-xl h-11 bg-muted/20 border-none font-mono text-[10px]" />
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
                    </div>
                )}

                {isTextType && (
                    <div className="pt-6 border-t border-dashed space-y-6">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <Label className="text-xs flex items-center gap-1.5"><Type className="h-3 w-3 text-muted-foreground" /> Font Size</Label>
                                <span className="text-[10px] font-mono font-black tabular-nums">{block.style?.width ? parseInt(block.style.width) : (block.type === 'heading' ? 22 : 16)}pt</span>
                            </div>
                            <Slider 
                                value={[block.style?.width ? parseInt(block.style.width) : (block.type === 'heading' ? 22 : 16)]} 
                                onValueChange={([v]) => onUpdate({ style: { ...block.style, width: String(v) } })}
                                min={8} max={48} step={1}
                            />
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block ml-1">Alignment</Label>
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
                    </div>
                )}
            </div>
        </div>
    );
}
