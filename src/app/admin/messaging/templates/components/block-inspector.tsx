'use client';

import * as React from 'react';
import { VariablePicker } from './variable-picker';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
    Bold, 
    Italic, 
    Underline, 
    AlignLeft, 
    AlignCenter, 
    AlignRight, 
    AlignJustify,
    Type,
    List as ListIcon,
    ListOrdered,
    Link as LinkIcon,
    FileText,
    Settings,
    ChevronDown,
    Plus,
    Palette,
    Layers,
    Database,
    Zap,
    X
} from 'lucide-react';
import type { MessageBlock, VariableDefinition, MessageTemplate, TemplateVariable } from '@/lib/types';
import { MediaSelect } from '@/app/admin/entities/components/media-select';
import { cn } from '@/lib/utils';
import { blockIcons } from './block-icons';
import { SlashInput, SlashTextarea } from '@/components/messaging/SlashInput';

interface BlockInspectorProps {
    block: MessageBlock;
    variables: VariableDefinition[];
    onUpdate: (props: Partial<MessageBlock>) => void;
    templateCategory?: MessageTemplate['category'];
}

export function BlockInspector({ block, variables, onUpdate, templateCategory }: BlockInspectorProps) {
    const autocompleteVariables = React.useMemo<TemplateVariable[]>(() => {
        return variables.map(v => ({
            id: v.id,
            name: v.key,
            label: v.label || v.key,
            context: (v.category || 'general') as any,
            description: '',
            dataType: (v.type === 'date' || v.type === 'number' || v.type === 'url' || v.type === 'html' ? v.type : 'string') as any,
            exampleValue: `{{${v.key}}}`,
            isDynamic: false,
            isComputed: false,
        }));
    }, [variables]);

    const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
        typography: true,
        spacing: false,
        borders: false,
        background: false
    });

    const titleInputRef = React.useRef<HTMLInputElement>(null);
    const contentTextareaRef = React.useRef<HTMLTextAreaElement>(null);
    const linkInputRef = React.useRef<HTMLInputElement>(null);
    const dateInputRef = React.useRef<HTMLInputElement>(null);
    const timeInputRef = React.useRef<HTMLInputElement>(null);
    const locationInputRef = React.useRef<HTMLInputElement>(null);
    const pillInputRef = React.useRef<HTMLInputElement>(null);
    const descTextareaRef = React.useRef<HTMLTextAreaElement>(null);
    const dateLabelInputRef = React.useRef<HTMLInputElement>(null);
    const timeLabelInputRef = React.useRef<HTMLInputElement>(null);
    const locationLabelInputRef = React.useRef<HTMLInputElement>(null);
    const headingPillRef = React.useRef<HTMLInputElement>(null);
    const headingSubtextRef = React.useRef<HTMLInputElement>(null);
    const headingUrlRef = React.useRef<HTMLInputElement>(null);
    const headingRsvpDateRef = React.useRef<HTMLInputElement>(null);
    const headingRsvpTimeRef = React.useRef<HTMLInputElement>(null);

    if (!block) return null;

    const isFinanceContext = templateCategory === 'agreements';
    const s = block.style || {};

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleStyleUpdate = (updates: Partial<NonNullable<MessageBlock['style']>>) => {
        onUpdate({ style: { ...s, ...updates } });
    };

    // Helper to insert token at cursor position
    const insertToken = (
        ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
        tokenKey: string,
        currentValue: string,
        onFieldChange: (newVal: string) => void
    ) => {
        const input = ref.current;
        if (!input) return;
        
        const token = `{{${tokenKey}}}`;
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        const newVal = currentValue.slice(0, start) + token + currentValue.slice(end);
        
        onFieldChange(newVal);
        
        requestAnimationFrame(() => {
            const newPos = start + token.length;
            input.setSelectionRange(newPos, newPos);
            input.focus();
        });
    };

    // Inline variable picker component for inputs
    const InlineVariablePicker = ({ 
        targetRef, 
        currentValue, 
        onFieldChange 
    }: { 
        targetRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
        currentValue: string,
        onFieldChange: (newVal: string) => void
    }) => {
        return (
            <VariablePicker
                variables={variables}
                templateCategory={templateCategory || 'general'}
                onSelect={(key) => insertToken(targetRef, key, currentValue, onFieldChange)}
            />
        );
    };

    // Relevance Flags for Accordion panels
    const hasTypography = ['heading', 'text', 'quote', 'list', 'button', 'header', 'footer', 'rsvp'].includes(block.type);
    const hasSpacing = true; // Spacing is universally applicable
    const hasBorders = ['heading', 'text', 'quote', 'button', 'image', 'video', 'columns', 'score-card', 'rsvp'].includes(block.type);
    const hasBackground = ['heading', 'text', 'quote', 'button', 'list', 'columns', 'score-card', 'logo', 'rsvp'].includes(block.type);

    return (
        <div className="flex flex-col h-full bg-background animate-in fade-in slide-in-from-left-4 duration-300">
            
            {/* Header info detailing active block type */}
            <div className="mb-6 pb-4 border-b flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold tracking-tight capitalize">{block.type} Properties</h3>
                    <p className="text-[9px] font-bold text-muted-foreground/60 tracking-tighter uppercase mt-0.5">Customize properties & styles</p>
                </div>
                <div className="p-2 bg-blue-500/5 text-blue-600 rounded-xl border border-blue-500/10">
                    {React.createElement(blockIcons[block.type] || Type, { className: "h-4 w-4" })}
                </div>
            </div>

            {/* Combined Properties List */}
            <div className="flex-1 space-y-6 overflow-y-auto pr-1">
                
                {/* 1. Content/Block-Type Unique Inputs */}
                <div className="space-y-4">
                    {/* Heading Block Settings */}
                    {/* Heading Block Settings */}
                    {block.type === 'heading' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Title Text</Label>
                                    <InlineVariablePicker 
                                        targetRef={titleInputRef} 
                                        currentValue={block.title || ''} 
                                        onFieldChange={val => onUpdate({ title: val })} 
                                    />
                                </div>
                                <SlashInput 
                                    value={block.title || ''} 
                                    onChange={val => onUpdate({ title: val })} 
                                    variables={autocompleteVariables}
                                    enableFormatting={true}
                                    className="font-bold rounded-xl h-11 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                    placeholder="Enter heading title..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Hierarchy Level</Label>
                                <div className="flex gap-2">
                                    {(['h1', 'h2', 'h3'] as const).map(v => (
                                        <Button 
                                            key={v}
                                            type="button"
                                            size="sm"
                                            variant={block.variant === v ? 'default' : 'outline'}
                                            className="h-8 flex-1 rounded-lg font-semibold"
                                            onClick={() => onUpdate({ variant: v })}
                                        >
                                            {v.toUpperCase()}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Badge / Pill Text</Label>
                                    <InlineVariablePicker 
                                        targetRef={headingPillRef} 
                                        currentValue={block.pillText || ''} 
                                        onFieldChange={val => onUpdate({ pillText: val })} 
                                    />
                                </div>
                                <SlashInput 
                                    value={block.pillText || ''} 
                                    onChange={val => onUpdate({ pillText: val })} 
                                    variables={autocompleteVariables}
                                    className="rounded-xl h-11 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                    placeholder="e.g. High Priority (optional)"
                                    onKeyDown={(e) => e.stopPropagation()}
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Subtitle / Subtext</Label>
                                    <InlineVariablePicker 
                                        targetRef={headingSubtextRef} 
                                        currentValue={block.content || ''} 
                                        onFieldChange={val => onUpdate({ content: val })} 
                                    />
                                </div>
                                <SlashInput 
                                    value={block.content || ''} 
                                    onChange={val => onUpdate({ content: val })} 
                                    variables={autocompleteVariables}
                                    enableFormatting={true}
                                    className="rounded-xl h-11 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                    placeholder="e.g. Invited by Alex Chen (optional)"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Style Variant</Label>
                                <Select 
                                    value={block.style?.variant || 'standard'} 
                                    onValueChange={(val) => handleStyleUpdate({ variant: val })}
                                >
                                    <SelectTrigger className="h-10 rounded-xl font-semibold bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-blue-500/20">
                                        <SelectValue placeholder="Standard Heading" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border border-slate-200">
                                        <SelectItem value="standard">Standard Heading</SelectItem>
                                        <SelectItem value="left_accent">Left Accent Card (Theme 1)</SelectItem>
                                        <SelectItem value="dark_slate">Dark Slate Card (Theme 2)</SelectItem>
                                        <SelectItem value="envelope_badge">Envelope Badge (Theme 3)</SelectItem>
                                        <SelectItem value="nested_card">Nested Card (Theme 4)</SelectItem>
                                        <SelectItem value="simple_wide">Wide Banner (Theme 5)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Icon / Avatar URL</Label>
                                    <InlineVariablePicker 
                                        targetRef={headingUrlRef} 
                                        currentValue={block.url || ''} 
                                        onFieldChange={val => onUpdate({ url: val })} 
                                    />
                                </div>
                                <Input 
                                    ref={headingUrlRef}
                                    value={block.url || ''} 
                                    onChange={e => onUpdate({ url: e.target.value })} 
                                    className="rounded-xl h-11 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                    placeholder="Type 'calendar', 'clock', 'envelope' or image URL"
                                />
                            </div>
                            {block.style?.variant === 'left_accent' && (
                                <>
                                    <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Date Info</Label>
                                            <InlineVariablePicker 
                                                targetRef={headingRsvpDateRef} 
                                                currentValue={block.rsvpDate || ''} 
                                                onFieldChange={val => onUpdate({ rsvpDate: val })} 
                                            />
                                        </div>
                                        <SlashInput 
                                            value={block.rsvpDate || ''} 
                                            onChange={val => onUpdate({ rsvpDate: val })} 
                                            variables={autocompleteVariables}
                                            className="rounded-xl h-11 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                            placeholder="e.g. Thursday, Oct 26"
                                        />
                                    </div>
                                    <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Time Info</Label>
                                            <InlineVariablePicker 
                                                targetRef={headingRsvpTimeRef} 
                                                currentValue={block.rsvpTime || ''} 
                                                onFieldChange={val => onUpdate({ rsvpTime: val })} 
                                            />
                                        </div>
                                        <SlashInput 
                                            value={block.rsvpTime || ''} 
                                            onChange={val => onUpdate({ rsvpTime: val })} 
                                            variables={autocompleteVariables}
                                            className="rounded-xl h-11 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                            placeholder="e.g. 10:00 AM - 11:30 AM (PST)"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Text & Quote Block Settings */}
                    {(block.type === 'text' || block.type === 'quote') && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Text Content</Label>
                                <InlineVariablePicker 
                                    targetRef={contentTextareaRef} 
                                    currentValue={block.content || ''} 
                                    onFieldChange={val => onUpdate({ content: val })} 
                                    />
                            </div>
                            <SlashTextarea 
                                value={block.content || ''} 
                                onChange={val => onUpdate({ content: val })}
                                variables={autocompleteVariables}
                                enableFormatting={true}
                                className="min-h-[140px] rounded-2xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20 p-4 leading-relaxed text-sm" 
                            />
                        </div>
                    )}

                    {/* List Settings */}
                    {block.type === 'list' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">List Style</Label>
                                <Select 
                                    value={block.listStyle || 'unordered'} 
                                    onValueChange={(val) => onUpdate({ listStyle: val as any })}
                                >
                                    <SelectTrigger className="h-10 rounded-xl font-semibold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="unordered">Standard Bullets (•)</SelectItem>
                                        <SelectItem value="ordered">Decimal Numbers (1, 2, 3)</SelectItem>
                                        <SelectItem value="roman">Roman Numerals (I, II, III)</SelectItem>
                                        <SelectItem value="checkmark">Checklist Tasks (✓)</SelectItem>
                                        <SelectItem value="arrow">Blue Arrows (→)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Items (One per line)</Label>
                                    <InlineVariablePicker 
                                        targetRef={contentTextareaRef} 
                                        currentValue={block.items?.join('\n') || ''} 
                                        onFieldChange={val => onUpdate({ items: val.split('\n') })} 
                                    />
                                </div>
                                <SlashTextarea 
                                    value={block.items?.join('\n') || ''}
                                    onChange={val => onUpdate({ items: val.split('\n') })}
                                    variables={autocompleteVariables}
                                    enableFormatting={true}
                                    className="min-h-[140px] text-sm rounded-2xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20 p-4 leading-relaxed"
                                    placeholder="Pasting a list works here too..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Button Settings */}
                    {block.type === 'button' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Button Label</Label>
                                    <InlineVariablePicker 
                                        targetRef={titleInputRef} 
                                        currentValue={block.title || ''} 
                                        onFieldChange={val => onUpdate({ title: val })} 
                                    />
                                </div>
                                <SlashInput 
                                    value={block.title || ''} 
                                    onChange={val => onUpdate({ title: val })} 
                                    variables={autocompleteVariables}
                                    className="font-bold rounded-xl h-11" 
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Link Target URL</Label>
                                    {isFinanceContext && (
                                        <button 
                                            type="button"
                                            onClick={() => onUpdate({ link: '{{agreement_url}}' })}
                                            className="flex items-center gap-1 text-[9px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 hover:bg-blue-100/50 transition-all"
                                        >
                                            <FileText className="h-2.5 w-2.5" /> Use Agreement Link
                                        </button>
                                    )}
                                </div>
                                <div className="relative group flex items-center w-full">
                                    <div className="absolute left-3 text-muted-foreground/40 z-10"><LinkIcon className="h-3.5 w-3.5" /></div>
                                    <SlashInput 
                                        value={block.link || ''} 
                                        onChange={val => onUpdate({ link: val })} 
                                        variables={autocompleteVariables}
                                        placeholder="https://..."
                                        className="rounded-xl h-11 bg-muted/20 border-none font-mono text-[10px] pl-9 pr-8 w-full" 
                                    />
                                    <div className="absolute right-2 z-10">
                                        <InlineVariablePicker 
                                            targetRef={linkInputRef} 
                                            currentValue={block.link || ''} 
                                            onFieldChange={val => onUpdate({ link: val })} 
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Button Theme</Label>
                                <Select value={s.variant || 'default'} onValueChange={(val) => handleStyleUpdate({ variant: val })}>
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

                    {/* RSVP Block Settings */}
                    {block.type === 'rsvp' && (() => {
                        const style = block.rsvpStyle || 'standard';
                        const isDetailed = [
                            'card_bento', 'card_inline',
                            'event_full_bento', 'event_full_inline',
                            'event_compact_bento', 'event_compact_inline'
                        ].includes(style);
                        const isFull = ['event_full_bento', 'event_full_inline'].includes(style);
                        const isEvent = [
                            'event_full_bento', 'event_full_inline',
                            'event_compact_bento', 'event_compact_inline'
                        ].includes(style);

                        return (
                            <div className="space-y-4 animate-in fade-in duration-200">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">RSVP Layout Style</Label>
                                    <Select 
                                        value={style} 
                                        onValueChange={(val) => onUpdate({ rsvpStyle: val as any })}
                                    >
                                        <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-blue-500/20 font-semibold text-xs">
                                            <SelectValue placeholder="Select style..." />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-none shadow-lg">
                                            <SelectItem value="standard" className="text-xs font-semibold">Standard (Buttons Only)</SelectItem>
                                            <SelectItem value="card_bento" className="text-xs font-semibold">Detailed Card (Bento Buttons)</SelectItem>
                                            <SelectItem value="card_inline" className="text-xs font-semibold">Detailed Card (Inline Buttons)</SelectItem>
                                            <SelectItem value="event_full_bento" className="text-xs font-semibold">Event Card (Full - Bento)</SelectItem>
                                            <SelectItem value="event_full_inline" className="text-xs font-semibold">Event Card (Full - Inline)</SelectItem>
                                            <SelectItem value="event_compact_bento" className="text-xs font-semibold">Event Card (Compact - Bento)</SelectItem>
                                            <SelectItem value="event_compact_inline" className="text-xs font-semibold">Event Card (Compact - Inline)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {isFull && (
                                    <>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Pill Badge Text</Label>
                                                <InlineVariablePicker 
                                                    targetRef={pillInputRef} 
                                                    currentValue={block.pillText || ''} 
                                                    onFieldChange={val => onUpdate({ pillText: val })} 
                                                />
                                            </div>
                                            <SlashInput 
                                                value={block.pillText || ''} 
                                                onChange={val => onUpdate({ pillText: val })} 
                                                variables={autocompleteVariables}
                                                placeholder="e.g. Invitation"
                                                className="font-semibold rounded-xl h-10 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Event Description</Label>
                                                <InlineVariablePicker 
                                                    targetRef={descTextareaRef} 
                                                    currentValue={block.content || ''} 
                                                    onFieldChange={val => onUpdate({ content: val })} 
                                                />
                                            </div>
                                            <SlashTextarea 
                                                value={block.content || ''} 
                                                onChange={val => onUpdate({ content: val })} 
                                                variables={autocompleteVariables}
                                                placeholder="Describe your event details..."
                                                className="font-medium text-xs rounded-xl min-h-[60px] bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                            />
                                        </div>
                                    </>
                                )}

                                {isDetailed && (
                                    <>
                                        {/* Date Details */}
                                        <div className="border-t border-slate-100/50 pt-3 space-y-2">
                                            {isEvent && (
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 ml-1">Date Label</Label>
                                                    <InlineVariablePicker 
                                                        targetRef={dateLabelInputRef} 
                                                        currentValue={block.rsvpDateLabel || ''} 
                                                        onFieldChange={val => onUpdate({ rsvpDateLabel: val })} 
                                                    />
                                                </div>
                                            )}
                                            {isEvent && (
                                                <SlashInput 
                                                    value={block.rsvpDateLabel || ''} 
                                                    onChange={val => onUpdate({ rsvpDateLabel: val })} 
                                                    variables={autocompleteVariables}
                                                    placeholder="DATE (default)"
                                                    className="font-bold text-[10px] h-8 rounded-xl bg-muted/10 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20 mb-1" 
                                                />
                                            )}
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">{isEvent ? "Date Value" : "Date Text"}</Label>
                                                <InlineVariablePicker 
                                                    targetRef={dateInputRef} 
                                                    currentValue={block.rsvpDate || ''} 
                                                    onFieldChange={val => onUpdate({ rsvpDate: val })} 
                                                />
                                            </div>
                                            <SlashInput 
                                                value={block.rsvpDate || ''} 
                                                onChange={val => onUpdate({ rsvpDate: val })} 
                                                variables={autocompleteVariables}
                                                placeholder="e.g. Dec 15, 2024"
                                                className="font-semibold rounded-xl h-10 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                            />
                                        </div>

                                        {/* Time Details */}
                                        <div className="border-t border-slate-100/50 pt-3 space-y-2">
                                            {isEvent && (
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 ml-1">Time Label</Label>
                                                    <InlineVariablePicker 
                                                        targetRef={timeLabelInputRef} 
                                                        currentValue={block.rsvpTimeLabel || ''} 
                                                        onFieldChange={val => onUpdate({ rsvpTimeLabel: val })} 
                                                    />
                                                </div>
                                            )}
                                            {isEvent && (
                                                <SlashInput 
                                                    value={block.rsvpTimeLabel || ''} 
                                                    onChange={val => onUpdate({ rsvpTimeLabel: val })} 
                                                    variables={autocompleteVariables}
                                                    placeholder="TIME (default)"
                                                    className="font-bold text-[10px] h-8 rounded-xl bg-muted/10 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20 mb-1" 
                                                />
                                            )}
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">{isEvent ? "Time Value" : "Time Text"}</Label>
                                                <InlineVariablePicker 
                                                    targetRef={timeInputRef} 
                                                    currentValue={block.rsvpTime || ''} 
                                                    onFieldChange={val => onUpdate({ rsvpTime: val })} 
                                                />
                                            </div>
                                            <SlashInput 
                                                value={block.rsvpTime || ''} 
                                                onChange={val => onUpdate({ rsvpTime: val })} 
                                                variables={autocompleteVariables}
                                                placeholder="e.g. 2:00 PM"
                                                className="font-semibold rounded-xl h-10 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                            />
                                        </div>

                                        {/* Location/Type Details */}
                                        <div className="border-t border-slate-100/50 pt-3 space-y-2">
                                            {isEvent && (
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 ml-1">Location Label</Label>
                                                    <InlineVariablePicker 
                                                        targetRef={locationLabelInputRef} 
                                                        currentValue={block.rsvpLocationLabel || ''} 
                                                        onFieldChange={val => onUpdate({ rsvpLocationLabel: val })} 
                                                    />
                                                </div>
                                            )}
                                            {isEvent && (
                                                <SlashInput 
                                                    value={block.rsvpLocationLabel || ''} 
                                                    onChange={val => onUpdate({ rsvpLocationLabel: val })} 
                                                    variables={autocompleteVariables}
                                                    placeholder="TYPE (default)"
                                                    className="font-bold text-[10px] h-8 rounded-xl bg-muted/10 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20 mb-1" 
                                                />
                                            )}
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">{isEvent ? "Location Value" : "Location/Join Text"}</Label>
                                                <InlineVariablePicker 
                                                    targetRef={locationInputRef} 
                                                    currentValue={block.rsvpLocation || ''} 
                                                    onFieldChange={val => onUpdate({ rsvpLocation: val })} 
                                                />
                                            </div>
                                            <SlashInput 
                                                value={block.rsvpLocation || ''} 
                                                onChange={val => onUpdate({ rsvpLocation: val })} 
                                                variables={autocompleteVariables}
                                                placeholder="e.g. Virtual Meeting"
                                                className="font-semibold rounded-xl h-10 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                            />
                                        </div>
                                    </>
                                )}

                                {(!isEvent || isFull) && (
                                    <div className="space-y-2 border-t border-slate-100/50 pt-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">{isEvent ? "Event Title" : "Invitation Text"}</Label>
                                            <InlineVariablePicker 
                                                targetRef={titleInputRef} 
                                                currentValue={block.title || ''} 
                                                onFieldChange={val => onUpdate({ title: val })} 
                                            />
                                        </div>
                                        <SlashInput 
                                            value={block.title || ''} 
                                            onChange={val => onUpdate({ title: val })} 
                                            variables={autocompleteVariables}
                                            placeholder="e.g. Design Team Synchronization"
                                            className="font-bold rounded-xl h-11 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                        />
                                    </div>
                                )}

                                <div className="space-y-2 border-t border-slate-100/50 pt-3">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">"Going" Button Label</Label>
                                    <SlashInput 
                                        value={block.goingLabel || 'Going'} 
                                        onChange={val => onUpdate({ goingLabel: val })} 
                                        variables={autocompleteVariables}
                                        placeholder="Going"
                                        className="font-semibold rounded-xl h-10 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">"Later" Button Label</Label>
                                    <SlashInput 
                                        value={block.laterLabel || 'Later'} 
                                        onChange={val => onUpdate({ laterLabel: val })} 
                                        variables={autocompleteVariables}
                                        placeholder="Later"
                                        className="font-semibold rounded-xl h-10 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">"Not Going" Button Label</Label>
                                    <SlashInput 
                                        value={block.declinedLabel || 'Not Going'} 
                                        onChange={val => onUpdate({ declinedLabel: val })} 
                                        variables={autocompleteVariables}
                                        placeholder="Not Going"
                                        className="font-semibold rounded-xl h-10 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500/20" 
                                    />
                                </div>
                            </div>
                        );
                    })()}

                    {/* Image & Video Settings */}
                    {(block.type === 'image' || block.type === 'video') && (
                        <div className="space-y-4">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                                {block.type === 'image' ? 'Image File Source' : 'Video File Source'}
                            </Label>
                            <MediaSelect 
                                value={block.url} 
                                onValueChange={(val) => onUpdate({ url: val })}
                                filterType={block.type as any}
                                className="rounded-xl border-none shadow-none bg-muted/20"
                            />
                            <div className="space-y-2 pt-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Or Paste Direct URL Link</Label>
                                <Input 
                                    value={block.url || ''} 
                                    onChange={e => onUpdate({ url: e.target.value })} 
                                    placeholder="https://..."
                                    className="h-10 rounded-xl text-xs font-mono bg-muted/10"
                                />
                            </div>
                        </div>
                    )}

                    {/* Logo Settings */}
                    {block.type === 'logo' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Logo URL</Label>
                                <Input 
                                    value={block.url || ''} 
                                    onChange={e => onUpdate({ url: e.target.value })} 
                                    placeholder="Paste logo image link..."
                                    className="h-10 rounded-xl text-xs bg-muted/10"
                                />
                            </div>
                        </div>
                    )}

                    {/* Divider unique settings (Thickness/Color) */}
                    {block.type === 'divider' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Thickness (Height)</Label>
                                    <span className="text-[10px] font-mono font-bold">{s.borderWidth ? parseInt(s.borderWidth) : 1}px</span>
                                </div>
                                <Slider 
                                    value={[s.borderWidth ? parseInt(s.borderWidth) : 1]} 
                                    onValueChange={([v]) => handleStyleUpdate({ borderWidth: `${v}px` })}
                                    min={1} max={10} step={1}
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Line Color</Label>
                                    <span className="text-[10px] font-mono font-semibold">{s.borderColor || '#cbd5e1'}</span>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="color" 
                                        value={s.borderColor || '#cbd5e1'}
                                        onChange={e => handleStyleUpdate({ borderColor: e.target.value })}
                                        className="w-8 h-8 rounded-lg border cursor-pointer shrink-0" 
                                    />
                                    <Input 
                                        value={s.borderColor || ''}
                                        onChange={e => handleStyleUpdate({ borderColor: e.target.value || undefined })}
                                        placeholder="#cbd5e1"
                                        className="h-10 rounded-xl font-mono text-xs"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Columns settings */}
                    {block.type === 'columns' && (
                        <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-blue-600 space-y-2">
                            <span className="text-xs font-bold flex items-center gap-1.5"><Layers className="h-4 w-4" /> Multi-Column Block</span>
                            <p className="text-[10px] font-medium leading-relaxed">
                                Select blocks nested inside the column cells directly on the canvas to configure their individual content and styling parameters.
                            </p>
                        </div>
                    )}
                </div>

                {/* 2. Collapsible Visual Layout Accordions (Filtered by Block Type Relevance) */}
                <div className="space-y-4 pt-4 border-t">
                    
                    {/* A. Typography accordion */}
                    {hasTypography && (
                        <div className="border rounded-2xl overflow-hidden bg-muted/5">
                            <button
                                type="button"
                                onClick={() => toggleSection('typography')}
                                className="w-full px-4 py-3 bg-muted/10 hover:bg-muted/20 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider transition-colors"
                            >
                                <span className="flex items-center gap-2"><Type className="h-4 w-4 text-muted-foreground" /> Typography Settings</span>
                                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedSections.typography && "rotate-180")} />
                            </button>
                            {expandedSections.typography && (
                                <div className="p-4 space-y-4 border-t bg-card animate-in fade-in duration-200">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <Label className="text-[10px] font-semibold text-muted-foreground">Font Size</Label>
                                            <span className="text-[10px] font-mono font-semibold tabular-nums">{s.fontSize ? parseInt(s.fontSize) : 16}pt</span>
                                        </div>
                                        <Slider 
                                            value={[s.fontSize ? parseInt(s.fontSize) : 16]} 
                                            onValueChange={([v]) => handleStyleUpdate({ fontSize: `${v}px` })}
                                            min={8} max={64} step={1}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Alignment</Label>
                                        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border">
                                            {(['left', 'center', 'right', 'justify'] as const).map(a => (
                                                <Button 
                                                    key={a}
                                                    type="button" 
                                                    variant={s.textAlign === a ? 'secondary' : 'ghost'} 
                                                    className={cn("flex-1 h-9 rounded-lg transition-all", s.textAlign === a ? "bg-card shadow-sm text-blue-600" : "text-muted-foreground opacity-60")} 
                                                    onClick={() => handleStyleUpdate({ textAlign: a })}
                                                >
                                                    {a === 'left' ? <AlignLeft className="h-3.5 w-3.5" /> : a === 'center' ? <AlignCenter className="h-3.5 w-3.5" /> : a === 'right' ? <AlignRight className="h-3.5 w-3.5" /> : <AlignJustify className="h-3.5 w-3.5" />}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Font Family</Label>
                                        <Select value={s.fontFamily || 'default'} onValueChange={(val) => handleStyleUpdate({ fontFamily: val === 'default' ? undefined : val })}>
                                            <SelectTrigger className="h-10 rounded-xl font-semibold"><SelectValue placeholder="System Default" /></SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="default">System Default</SelectItem>
                                                <SelectItem value="'Figtree', sans-serif">Figtree (Standard)</SelectItem>
                                                <SelectItem value="Arial, sans-serif">Arial / Helvetica</SelectItem>
                                                <SelectItem value="'Times New Roman', serif">Times New Roman</SelectItem>
                                                <SelectItem value="Georgia, serif">Georgia</SelectItem>
                                                <SelectItem value="monospace">Monospace (Courier)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Font Weight</Label>
                                        <Select value={s.fontWeight || 'default'} onValueChange={(val) => handleStyleUpdate({ fontWeight: val === 'default' ? undefined : val })}>
                                            <SelectTrigger className="h-10 rounded-xl font-semibold"><SelectValue placeholder="Inherit" /></SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="default">Default / Inherit</SelectItem>
                                                <SelectItem value="300">Light (300)</SelectItem>
                                                <SelectItem value="400">Regular (400)</SelectItem>
                                                <SelectItem value="500">Medium (500)</SelectItem>
                                                <SelectItem value="700">Bold (700)</SelectItem>
                                                <SelectItem value="900">Heavy (900)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Text Color</Label>
                                        <div className="flex gap-2 items-center">
                                            <input 
                                                type="color" 
                                                value={s.color || '#1e293b'}
                                                onChange={e => handleStyleUpdate({ color: e.target.value })}
                                                className="w-8 h-8 rounded-lg border cursor-pointer shrink-0" 
                                            />
                                            <Input 
                                                value={s.color || ''}
                                                onChange={e => handleStyleUpdate({ color: e.target.value || undefined })}
                                                placeholder="#1e293b"
                                                className="h-10 rounded-xl font-mono text-xs"
                                            />
                                            {s.color && (
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full shrink-0" onClick={() => handleStyleUpdate({ color: undefined })}>
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* B. Spacing Accordion */}
                    {hasSpacing && (
                        <div className="border rounded-2xl overflow-hidden bg-muted/5">
                            <button
                                type="button"
                                onClick={() => toggleSection('spacing')}
                                className="w-full px-4 py-3 bg-muted/10 hover:bg-muted/20 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider transition-colors"
                            >
                                <span className="flex items-center gap-2"><Layers className="h-4 w-4 text-muted-foreground" /> Spacing (Margins & Padding)</span>
                                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedSections.spacing && "rotate-180")} />
                            </button>
                            {expandedSections.spacing && (
                                <div className="p-4 space-y-4 border-t bg-card animate-in fade-in duration-200">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <Label className="text-[10px] font-semibold text-muted-foreground">Margin Top</Label>
                                            <span className="text-[10px] font-mono font-semibold tabular-nums">{s.marginTop ? parseInt(s.marginTop) : 0}px</span>
                                        </div>
                                        <Slider 
                                            value={[s.marginTop ? parseInt(s.marginTop) : 0]} 
                                            onValueChange={([v]) => handleStyleUpdate({ marginTop: `${v}px` })}
                                            min={0} max={100} step={1}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <Label className="text-[10px] font-semibold text-muted-foreground">Margin Bottom</Label>
                                            <span className="text-[10px] font-mono font-semibold tabular-nums">{s.marginBottom ? parseInt(s.marginBottom) : 12}px</span>
                                        </div>
                                        <Slider 
                                            value={[s.marginBottom ? parseInt(s.marginBottom) : 12]} 
                                            onValueChange={([v]) => handleStyleUpdate({ marginBottom: `${v}px` })}
                                            min={0} max={100} step={1}
                                        />
                                    </div>
                                    {/* Don't show block padding settings for divider blocks */}
                                    {block.type !== 'divider' && (
                                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground">Padding Top</Label>
                                                <Input 
                                                    type="number"
                                                    value={s.paddingTop ? parseInt(s.paddingTop) : 12}
                                                    onChange={e => handleStyleUpdate({ paddingTop: `${e.target.value}px` })}
                                                    className="h-10 rounded-xl text-xs font-semibold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground">Padding Bottom</Label>
                                                <Input 
                                                    type="number"
                                                    value={s.paddingBottom ? parseInt(s.paddingBottom) : 12}
                                                    onChange={e => handleStyleUpdate({ paddingBottom: `${e.target.value}px` })}
                                                    className="h-10 rounded-xl text-xs font-semibold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground">Padding Left</Label>
                                                <Input 
                                                    type="number"
                                                    value={s.paddingLeft ? parseInt(s.paddingLeft) : 0}
                                                    onChange={e => handleStyleUpdate({ paddingLeft: `${e.target.value}px` })}
                                                    className="h-10 rounded-xl text-xs font-semibold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-semibold text-muted-foreground">Padding Right</Label>
                                                <Input 
                                                    type="number"
                                                    value={s.paddingRight ? parseInt(s.paddingRight) : 0}
                                                    onChange={e => handleStyleUpdate({ paddingRight: `${e.target.value}px` })}
                                                    className="h-10 rounded-xl text-xs font-semibold"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* C. Borders Accordion */}
                    {hasBorders && (
                        <div className="border rounded-2xl overflow-hidden bg-muted/5">
                            <button
                                type="button"
                                onClick={() => toggleSection('borders')}
                                className="w-full px-4 py-3 bg-muted/10 hover:bg-muted/20 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider transition-colors"
                            >
                                <span className="flex items-center gap-2"><Layers className="h-4 w-4 text-muted-foreground" /> Borders & Corners</span>
                                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedSections.borders && "rotate-180")} />
                            </button>
                            {expandedSections.borders && (
                                <div className="p-4 space-y-4 border-t bg-card animate-in fade-in duration-200">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <Label className="text-[10px] font-semibold text-muted-foreground">Corner Radius</Label>
                                            <span className="text-[10px] font-mono font-semibold tabular-nums">{s.borderRadius ? parseInt(s.borderRadius) : 0}px</span>
                                        </div>
                                        <Slider 
                                            value={[s.borderRadius ? parseInt(s.borderRadius) : 0]} 
                                            onValueChange={([v]) => handleStyleUpdate({ borderRadius: `${v}px` })}
                                            min={0} max={60} step={1}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <Label className="text-[10px] font-semibold text-muted-foreground">Border Width</Label>
                                            <span className="text-[10px] font-mono font-semibold tabular-nums">{s.borderWidth ? parseInt(s.borderWidth) : 0}px</span>
                                        </div>
                                        <Slider 
                                            value={[s.borderWidth ? parseInt(s.borderWidth) : 0]} 
                                            onValueChange={([v]) => handleStyleUpdate({ borderWidth: `${v}px` })}
                                            min={0} max={10} step={1}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Border Style</Label>
                                        <Select value={s.borderStyle || 'none'} onValueChange={(val) => handleStyleUpdate({ borderStyle: val === 'none' ? undefined : val })}>
                                            <SelectTrigger className="h-10 rounded-xl font-semibold"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="none">None</SelectItem>
                                                <SelectItem value="solid">Solid Line</SelectItem>
                                                <SelectItem value="dashed">Dashed Line</SelectItem>
                                                <SelectItem value="dotted">Dotted Line</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {s.borderStyle && s.borderStyle !== 'none' && (
                                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Border Color</Label>
                                            <div className="flex gap-2 items-center">
                                                <input 
                                                    type="color" 
                                                    value={s.borderColor || '#cbd5e1'}
                                                    onChange={e => handleStyleUpdate({ borderColor: e.target.value })}
                                                    className="w-8 h-8 rounded-lg border cursor-pointer shrink-0" 
                                                />
                                                <Input 
                                                    value={s.borderColor || ''}
                                                    onChange={e => handleStyleUpdate({ borderColor: e.target.value || undefined })}
                                                    placeholder="#cbd5e1"
                                                    className="h-10 rounded-xl font-mono text-xs"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* D. Background Accordion */}
                    {hasBackground && (
                        <div className="border rounded-2xl overflow-hidden bg-muted/5">
                            <button
                                type="button"
                                onClick={() => toggleSection('background')}
                                className="w-full px-4 py-3 bg-muted/10 hover:bg-muted/20 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider transition-colors"
                            >
                                <span className="flex items-center gap-2"><Palette className="h-4 w-4 text-muted-foreground" /> Block Background</span>
                                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedSections.background && "rotate-180")} />
                            </button>
                            {expandedSections.background && (
                                <div className="p-4 space-y-4 border-t bg-card animate-in fade-in duration-200">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Background Color</Label>
                                        <div className="flex gap-2 items-center">
                                            <input 
                                                type="color" 
                                                value={s.backgroundColor || '#ffffff'}
                                                onChange={e => handleStyleUpdate({ backgroundColor: e.target.value })}
                                                className="w-8 h-8 rounded-lg border cursor-pointer shrink-0" 
                                            />
                                            <Input 
                                                value={s.backgroundColor || ''}
                                                onChange={e => handleStyleUpdate({ backgroundColor: e.target.value || undefined })}
                                                placeholder="#ffffff"
                                                className="h-10 rounded-xl font-mono text-xs"
                                            />
                                            {s.backgroundColor && (
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full shrink-0" onClick={() => handleStyleUpdate({ backgroundColor: undefined })}>
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
