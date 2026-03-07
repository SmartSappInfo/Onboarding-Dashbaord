'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
    GripVertical, 
    ArrowUp, 
    ArrowDown, 
    Copy, 
    Trash2, 
    Heading1, 
    Type, 
    Image as ImageIcon, 
    Video, 
    MousePointer2, 
    Quote, 
    Square, 
    List, 
    Trophy,
    Layout
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MessageBlock } from '@/lib/types';
import { resolveVariables } from '@/lib/messaging-utils';
import { RichTextEditor, FormattingToolbar } from './editor-ui';

export const blockIcons: Record<string, React.ElementType> = {
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

function Zap(props: any) { return <Trophy {...props} /> } // Helper for logo icon fallback

interface VisualBlockProps {
    block: MessageBlock;
    simulationVars: Record<string, any>;
    isEditing?: boolean;
    onContentUpdate?: (props: Partial<MessageBlock>) => void;
}

export function VisualBlock({ 
    block, 
    simulationVars, 
    isEditing, 
    onContentUpdate 
}: VisualBlockProps) {
    const align = block.style?.textAlign || 'left';
    const resolvedTitle = resolveVariables(block.title || '', simulationVars);
    const resolvedContent = resolveVariables(block.content || '', simulationVars);
    const resolvedUrl = resolveVariables(block.url || '', simulationVars);

    const alignmentClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : align === 'justify' ? 'text-justify' : 'text-left';
    
    const baseFontSize = block.style?.width ? parseInt(block.style.width) : (block.type === 'heading' ? 22 : 16);
    const textStyle = { 
        textAlign: align as any, 
        fontSize: `${baseFontSize}px`,
        color: block.style?.color 
    };

    switch (block.type) {
        case 'heading': {
            const Tag = block.variant || 'h2';
            const sizeClass = Tag === 'h1' ? "text-3xl" : Tag === 'h2' ? "text-2xl" : "text-lg";
            return (
                <div className={cn("w-full", alignmentClass)}>
                    {isEditing ? (
                        <RichTextEditor 
                            value={block.title || ''} 
                            onChange={(val) => onContentUpdate?.({ title: val })}
                            textAlign={align}
                            placeholder="Heading Text..."
                            className={cn("font-black tracking-tight leading-tight m-0", sizeClass)}
                        />
                    ) : (
                        <Tag 
                            className={cn("font-black tracking-tight leading-tight m-0", sizeClass)} 
                            style={textStyle}
                            dangerouslySetInnerHTML={{ __html: resolvedTitle || 'New Heading' }}
                        />
                    )}
                </div>
            );
        }
        case 'text':
            return (
                <div className={cn("w-full", alignmentClass)}>
                    {isEditing ? (
                        <RichTextEditor 
                            value={block.content || ''} 
                            onChange={(val) => onContentUpdate?.({ content: val })}
                            textAlign={align}
                            placeholder="Paragraph content..."
                            className="text-base text-muted-foreground leading-relaxed m-0"
                        />
                    ) : (
                        <p 
                            className="text-base text-muted-foreground leading-relaxed m-0 whitespace-pre-wrap" 
                            style={textStyle}
                            dangerouslySetInnerHTML={{ __html: resolvedContent || 'New paragraph content...' }}
                        />
                    )}
                </div>
            );
        case 'button':
            return (
                <div className={cn("w-full py-4", alignmentClass)}>
                    {isEditing ? (
                        <div className="inline-flex items-center gap-2">
                            <Input 
                                value={block.title || ''} 
                                onChange={(e) => onContentUpdate?.({ title: e.target.value })} 
                                placeholder="Button Label"
                                className="h-12 px-8 font-black rounded-xl shadow-lg w-auto text-center border-primary/20 bg-primary text-white placeholder:text-white/50"
                            />
                        </div>
                    ) : (
                        <Button variant={block.style?.variant as any || 'default'} className="rounded-xl font-bold h-12 px-8 uppercase tracking-widest shadow-md">
                            <span dangerouslySetInnerHTML={{ __html: resolvedTitle || 'Click Me' }} />
                        </Button>
                    )}
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
                    {isEditing ? (
                        <RichTextEditor 
                            value={block.content || ''} 
                            onChange={(val) => onContentUpdate?.({ content: val })}
                            textAlign={align}
                            placeholder="Quote..."
                            className="text-xl font-medium"
                        />
                    ) : (
                        <span 
                            style={textStyle}
                            dangerouslySetInnerHTML={{ __html: resolvedContent || 'Quote content...' }}
                        />
                    )}
                </div>
            );
        case 'list':
            const ListTag = block.listStyle === 'ordered' ? 'ol' : 'ul';
            return (
                <div className={cn("w-full", alignmentClass)}>
                    {isEditing ? (
                        <Textarea 
                            value={block.items?.join('\n') || ''}
                            onChange={(e) => onContentUpdate?.({ items: e.target.value.split('\n') })}
                            placeholder="List items (one per line)..."
                            className="min-h-[100px] bg-transparent border-none shadow-none focus-visible:ring-0 p-0 text-base leading-relaxed text-muted-foreground"
                        />
                    ) : (
                        <ListTag className={cn("text-base text-muted-foreground leading-relaxed m-0 space-y-2", block.listStyle === 'ordered' ? "list-decimal text-left" : "list-disc text-left", "list-inside")} style={textStyle}>
                            {(block.items || ['New point...']).map((item, i) => (
                                <li key={item + i} dangerouslySetInnerHTML={{ __html: resolveVariables(item, simulationVars) }} />
                            ))}
                        </ListTag>
                    )}
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

interface SortableBlockItemProps {
    id: string;
    index: number;
    block: MessageBlock;
    isSelected: boolean;
    simulationVars: Record<string, any>;
    onSelect: () => void;
    onRemove: () => void;
    onDuplicate: () => void;
    onSwap: (a: number, b: number) => void;
    totalCount: number;
    onUpdate: (u: Partial<MessageBlock>) => void;
}

export function SortableBlockItem({ 
    id, index, block, isSelected, simulationVars, onSelect, onRemove, onDuplicate, onSwap, totalCount, onUpdate
}: SortableBlockItemProps) {
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

            <div className={cn(
                "absolute -left-12 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1 transition-all duration-300",
                isSelected || "opacity-0 group-hover/block:opacity-100"
            )}>
                <div {...attributes} {...listeners} className="cursor-grab p-2 bg-background border rounded-full shadow-xl hover:text-primary">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full bg-background shadow-lg" onClick={(e) => { e.stopPropagation(); onSwap(index, index - 1); }} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full bg-background shadow-lg" onClick={(e) => { e.stopPropagation(); onSwap(index, index + 1); }} disabled={index === totalCount - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
            </div>

            <div className={cn(
                "absolute -right-12 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 transition-all duration-300",
                isSelected || "opacity-0 group-hover/block:opacity-100"
            )}>
                <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full bg-background shadow-lg hover:text-primary" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}><Copy className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background shadow-lg text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onRemove(); }}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>

            {isSelected && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-background border shadow-2xl rounded-xl p-1 flex items-center gap-1">
                        <FormattingToolbar 
                            alignValue={block.style?.textAlign}
                            onAlignChange={(val) => onUpdate({ style: { ...block.style, textAlign: val } })}
                            minimal 
                        />
                    </div>
                </div>
            )}
            
            <div className="relative py-2 px-4">
                <VisualBlock 
                    block={block} 
                    simulationVars={simulationVars} 
                    isEditing={isSelected}
                    onContentUpdate={onUpdate}
                />
            </div>
        </div>
    );
}