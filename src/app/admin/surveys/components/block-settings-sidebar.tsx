'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { 
    Settings, Asterisk, Zap, Trophy, ShieldCheck, 
    ChevronRight, Info, AlertCircle, Trash2, Copy, 
    EyeOff, Eye, AlignLeft, AlignCenter, AlignRight, AlignJustify, 
    Layers, ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine,
    Bold, Italic, Underline, Baseline, Pilcrow, CheckCircle2,
    ListChecks, ChevronDownSquare, Star, Calendar as CalendarIcon,
    Clock, Upload, Heading1, Type, Minus, Image as ImageIcon,
    Video as VideoIcon, AudioWaveform, FileText, Code, Bot,
    Link as LinkIcon, CheckCircle, ChevronDown, Mail, Phone, Hash, Filter
} from 'lucide-react';
import { 
    Select, SelectContent, SelectGroup, SelectItem, 
    SelectLabel, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { 
    Card, CardContent, CardHeader, CardTitle, CardDescription 
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SurveyElement, SurveyQuestion, SurveyLayoutBlock } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { MediaSelect } from '../../entities/components/media-select';

interface BlockSettingsSidebarProps {
    selectedBlockIds: string[];
}

export default function BlockSettingsSidebar({ selectedBlockIds }: BlockSettingsSidebarProps) {
    const { watch, setValue, control, register, getValues } = useFormContext();
    const elements = watch('elements') || [];
    
    const activeIndex = selectedBlockIds.length === 1 
        ? elements.findIndex((el: SurveyElement) => el.id === selectedBlockIds[0]) 
        : -1;
    const element = activeIndex !== -1 ? elements[activeIndex] : null;

    if (selectedBlockIds.length > 1) {
        return (
            <div className="flex flex-col h-full bg-card/50 backdrop-blur-xl border-l border-border/50 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-6 border-b border-border/50 space-y-1 bg-foreground text-background">
                    <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-primary text-white border-none rounded-md uppercase tracking-widest text-[10px] font-black px-1.5 py-0">
                            Bulk selection
                        </Badge>
                    </div>
                    <h3 className="font-black text-xl tracking-tight leading-tight">Batch Editing</h3>
                    <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{selectedBlockIds.length} blocks active</p>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-8">
                    <div className="space-y-4">
                        <Label className="text-sm font-black uppercase tracking-wider text-muted-foreground">Selected Items</Label>
                        <div className="space-y-2">
                            {selectedBlockIds.map(id => {
                                const el = elements.find((e: SurveyElement) => e.id === id);
                                if (!el) return null;
                                return (
                                    <div key={id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-2xl border border-border/50 group hover:border-primary/30 transition-colors">
                                        <div className="h-8 w-8 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
                                            <Layers className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary leading-none mb-1">{el.type}</p>
                                            <p className="text-xs font-bold truncate opacity-70">
                                                {el.title || el.text || 'Untitled Block'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Separator />

                    <div className="p-4 bg-primary/5 rounded-[2rem] border border-primary/10 space-y-4">
                        <div className="flex items-center gap-3 text-primary">
                            <Info className="h-5 w-5" />
                            <span className="text-xs font-black uppercase tracking-[0.2em]">Quick Tip</span>
                        </div>
                        <p className="text-xs font-medium leading-relaxed opacity-70">
                            Use the <span className="font-black text-primary">Floating Action Bar</span> at the bottom of the canvas to perform batch movements, cloning, deletion, and styling across all selected blocks.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (!element) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-40">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                    <Settings className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                    <p className="font-bold text-lg">No Block Selected</p>
                    <p className="text-sm">Click a block in the canvas to configure its settings here.</p>
                </div>
            </div>
        );
    }

    const isQuestion = (el: SurveyElement): el is SurveyQuestion => 'isRequired' in el;
    const isLayout = (el: SurveyElement): el is SurveyLayoutBlock => !('isRequired' in el);

    const convertBlockType = (newType: SurveyElement['type']) => {
        if (!element) return;
        
        const oldType = element.type;
        const newElements = [...elements];
        
        // Base object with preserved common fields
        const base: Record<string, unknown> = {
            ...element,
            type: newType,
        };

        // 1. Data Preservation Logic
        const choiceTypes = ['multiple-choice', 'checkboxes', 'dropdown'];
        const mediaTypes = ['image', 'video', 'audio', 'document'];
        const staticTypes = ['heading', 'description', 'section'];

        // Between Choice Types: Preserve options, scoring, and auto-advance
        if (choiceTypes.includes(oldType) && choiceTypes.includes(newType)) {
            // No extra mapping needed, base spreading handles it
        }

        // To Choice Types from non-choice: Initialize options
        if (!choiceTypes.includes(oldType) && choiceTypes.includes(newType)) {
            base.options = ['Option 1', 'Option 2'];
        }

        // To Yes/No: Enforce Yes/No options
        if (newType === 'yes-no') {
            base.options = ['Yes', 'No'];
            base.autoAdvance = true;
        }

        // Between Media Types: Preserve URL
        if (mediaTypes.includes(oldType) && mediaTypes.includes(newType)) {
            // url is already in base
        }

        // Between Static Types: Preserve Title/Text
        if (staticTypes.includes(oldType) && staticTypes.includes(newType)) {
            if (newType === 'description') base.text = element.title || element.text;
            else base.title = element.text || element.title;
        }

        // 2. Specific field cleanup/initialization
        if (newType === 'rating') base.ratingMax = 5;
        if (newType === 'heading') base.variant = 'h2';

        newElements[activeIndex] = base;
        setValue('elements', newElements, { shouldDirty: true });
    };

    const BLOCK_TYPE_GROUPS = [
        {
            label: 'Question Inputs',
            types: [
                { id: 'text', label: 'Short Text', icon: Baseline },
                { id: 'long-text', label: 'Long Text', icon: Pilcrow },
                { id: 'email', label: 'Email', icon: Mail },
                { id: 'phone', label: 'Phone', icon: Phone },
                { id: 'number', label: 'Number', icon: Hash },
                { id: 'link', label: 'Link', icon: LinkIcon },
                { id: 'date', label: 'Date', icon: CalendarIcon },
                { id: 'rating', label: 'Rating', icon: Star },
                { id: 'file-upload', label: 'File Upload', icon: Upload },
            ]
        },
        {
            label: 'Choices & Logic',
            types: [
                { id: 'multiple-choice', label: 'Multiple Choice', icon: CheckCircle },
                { id: 'checkboxes', label: 'Checkboxes', icon: ListChecks },
                { id: 'dropdown', label: 'Dropdown', icon: ChevronDownSquare },
                { id: 'yes-no', label: 'Yes / No', icon: CheckCircle2 },
            ]
        },
        {
            label: 'Media Content',
            types: [
                { id: 'image', label: 'Image', icon: ImageIcon },
                { id: 'video', label: 'Video', icon: VideoIcon },
                { id: 'audio', label: 'Audio', icon: AudioWaveform },
                { id: 'document', label: 'Document', icon: FileText },
                { id: 'embed', label: 'Embed HTML', icon: Code },
            ]
        },
        {
            label: 'Layout & Static',
            types: [
                { id: 'section', label: 'Section', icon: Layers },
                { id: 'heading', label: 'Heading', icon: Heading1 },
                { id: 'description', label: 'Text Block', icon: Type },
                { id: 'divider', label: 'Divider', icon: Minus },
            ]
        }
    ];

    return (
        <div className="flex flex-col h-full bg-card/50 backdrop-blur-xl border-l border-border/50 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="p-6 border-b border-border/50 space-y-1">
                <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="rounded-md uppercase tracking-widest text-[10px] font-black px-1.5 py-0">
                        {element.type} block
                    </Badge>
                </div>
                <h3 className="font-black text-xl tracking-tight leading-tight">Block Settings</h3>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
                <div className="p-6 space-y-8 pb-32">
                    {/* 0. Block Type Transformation */}
                    <div className="space-y-4">
                        <Label className="text-sm font-black uppercase tracking-wider text-muted-foreground/60">Block Type</Label>
                        <Select value={element.type} onValueChange={convertBlockType}>
                            <SelectTrigger className="h-14 bg-primary/5 border-primary/20 rounded-2xl ring-0 focus:ring-4 focus:ring-primary/5 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg">
                                        {(() => {
                                            const Group = BLOCK_TYPE_GROUPS.find(g => g.types.some(t => t.id === element.type));
                                            const TypeIcon = Group?.types.find(t => t.id === element.type)?.icon || Type;
                                            return <TypeIcon className="h-4 w-4" />;
                                        })()}
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <SelectValue placeholder="Change block type..." />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">Transform Block</span>
                                    </div>
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-border/50 shadow-2xl z-[100]" position="popper" sideOffset={8}>
                                {BLOCK_TYPE_GROUPS.map((group) => (
                                    <SelectGroup key={group.label}>
                                        <SelectLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground py-3 px-4">{group.label}</SelectLabel>
                                        {group.types.map((type) => (
                                            <SelectItem 
                                                key={type.id} 
                                                value={type.id}
                                                className="rounded-xl py-3 px-4 focus:bg-primary/5 transition-colors group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="h-6 w-6 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors flex items-center justify-center">
                                                        <type.icon className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    </div>
                                                    <span className="font-bold text-sm tracking-tight">{type.label}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 1. Quick Actions */}
                    <div className="space-y-4">
                        <Label className="text-sm font-semibold">Quick Actions</Label>
                        <div className="grid grid-cols-2 gap-2">
                             <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-9 gap-2 rounded-lg font-bold text-xs"
                                onClick={() => {
                                    const newElem = { ...element, id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` };
                                    const newElements = [...elements];
                                    newElements.splice(activeIndex + 1, 0, newElem);
                                    setValue('elements', newElements, { shouldDirty: true });
                                }}
                            >
                                <Copy className="h-3.5 w-3.5" /> Clone
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-9 gap-2 rounded-lg font-bold text-xs text-destructive hover:text-destructive"
                                onClick={() => {
                                    const newElements = elements.filter((_:any, i:number) => i !== activeIndex);
                                    setValue('elements', newElements, { shouldDirty: true });
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-9 w-full rounded-lg" disabled={activeIndex === 0} onClick={() => {
                                            const newElements = [...elements];
                                            const [moved] = newElements.splice(activeIndex, 1);
                                            newElements.splice(activeIndex - 1, 0, moved);
                                            setValue('elements', newElements, { shouldDirty: true });
                                        }}>
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Move Up</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-9 w-full rounded-lg" disabled={activeIndex === elements.length - 1} onClick={() => {
                                            const newElements = [...elements];
                                            const [moved] = newElements.splice(activeIndex, 1);
                                            newElements.splice(activeIndex + 1, 0, moved);
                                            setValue('elements', newElements, { shouldDirty: true });
                                        }}>
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Move Down</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-9 w-full rounded-lg" onClick={() => {
                                            const newElements = [...elements];
                                            const item = newElements[activeIndex];
                                            newElements.splice(activeIndex, 1);
                                            
                                            if (item.type === 'section') {
                                                newElements.unshift(item);
                                            } else {
                                                let targetIdx = 0;
                                                for (let i = activeIndex - 1; i >= 0; i--) {
                                                    if (newElements[i].type === 'section') {
                                                        targetIdx = i + 1;
                                                        break;
                                                    }
                                                }
                                                newElements.splice(targetIdx, 0, item);
                                            }
                                            setValue('elements', newElements, { shouldDirty: true });
                                        }}>
                                            <ArrowUpToLine className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Move to Top (Section)</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-9 w-full rounded-lg" onClick={() => {
                                            const newElements = [...elements];
                                            const item = newElements[activeIndex];
                                            newElements.splice(activeIndex, 1);
                                            
                                            if (item.type === 'section') {
                                                newElements.push(item);
                                            } else {
                                                let targetIdx = newElements.length;
                                                for (let i = activeIndex; i < newElements.length; i++) {
                                                    if (newElements[i].type === 'section') {
                                                        targetIdx = i;
                                                        break;
                                                    }
                                                }
                                                newElements.splice(targetIdx, 0, item);
                                            }
                                            setValue('elements', newElements, { shouldDirty: true });
                                        }}>
                                            <ArrowDownToLine className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Move to Bottom (Section)</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>

                    <Separator />
                {/* 1. Core Visibility & Status */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between group">
                        <Label htmlFor="block-hidden" className="flex items-center gap-2 cursor-pointer">
                            <EyeOff className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="font-bold">Hidden block</span>
                        </Label>
                        <Controller
                            control={control}
                            name={`elements.${activeIndex}.hidden`}
                            render={({ field }) => (
                                <Switch 
                                    id="block-hidden" 
                                    checked={field.value} 
                                    onCheckedChange={field.onChange} 
                                />
                            )}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                        Hidden blocks are not visible to respondents but can be toggled via logic.
                    </p>
                </div>

                <Separator />

                {/* 2. Question Specific Settings */}
                {isQuestion(element) && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between group">
                            <div className="space-y-0.5">
                                <Label htmlFor="question-required" className="flex items-center gap-2 cursor-pointer">
                                    <Asterisk className="h-4 w-4 text-destructive group-hover:scale-125 transition-transform" />
                                    <span className="font-bold">Mark as Required</span>
                                </Label>
                                <p className="text-[10px] text-muted-foreground font-medium">Respondents must answer this block.</p>
                            </div>
                            <Controller
                                control={control}
                                name={`elements.${activeIndex}.isRequired`}
                                render={({ field }) => (
                                    <Switch 
                                        id="question-required" 
                                        checked={field.value} 
                                        onCheckedChange={field.onChange} 
                                    />
                                )}
                            />
                        </div>

                        <div className="flex items-center justify-between group">
                            <div className="space-y-0.5">
                                <Label htmlFor="question-filterfield" className="flex items-center gap-2 cursor-pointer">
                                    <Filter className="h-4 w-4 text-primary group-hover:scale-125 transition-transform" />
                                    <span className="font-bold">Mark as Filter Field</span>
                                </Label>
                                <p className="text-[10px] text-muted-foreground font-medium">Use answers of this field to filter survey responses.</p>
                            </div>
                            <Controller
                                control={control}
                                name={`elements.${activeIndex}.isFilterField`}
                                render={({ field }) => (
                                    <Switch 
                                        id="question-filterfield" 
                                        checked={field.value || false} 
                                        onCheckedChange={field.onChange} 
                                    />
                                )}
                            />
                        </div>

                        {(element.type === 'multiple-choice' || element.type === 'yes-no') && (
                            <div className="flex items-center justify-between group">
                                <div className="space-y-0.5">
                                    <Label htmlFor="question-autoadvance" className="flex items-center gap-2 cursor-pointer">
                                        <Zap className="h-4 w-4 text-primary group-hover:animate-pulse" />
                                        <span className="font-bold">Auto-Advance</span>
                                    </Label>
                                    <p className="text-[10px] text-muted-foreground font-medium">Proceed to next page on selection.</p>
                                </div>
                                <Controller
                                    control={control}
                                    name={`elements.${activeIndex}.autoAdvance`}
                                    render={({ field }) => (
                                        <Switch 
                                            id="question-autoadvance" 
                                            checked={field.value} 
                                            onCheckedChange={field.onChange} 
                                        />
                                    )}
                                />
                            </div>
                        )}

                        {element.type === 'email' && (
                            <div className="space-y-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                                <div className="flex items-center gap-2 text-primary">
                                    <ShieldCheck className="h-4 w-4" />
                                    <span className="text-xs font-black uppercase tracking-widest">Email Validation</span>
                                </div>
                                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                                    SmartSapp automatically enforces RFC 5322 compliance for this field.
                                </p>
                            </div>
                        )}

                        {(element.type === 'text' || element.type === 'long-text') && (
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Min Length</Label>
                                    <Controller
                                        control={control}
                                        name={`elements.${activeIndex}.minLength`}
                                        render={({ field }) => (
                                            <Input 
                                                type="number" 
                                                className="h-11 bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 rounded-xl font-bold" 
                                                {...field}
                                                onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                                            />
                                        )}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Max Length</Label>
                                    <Controller
                                        control={control}
                                        name={`elements.${activeIndex}.maxLength`}
                                        render={({ field }) => (
                                            <Input 
                                                type="number" 
                                                className="h-11 bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 rounded-xl font-bold" 
                                                {...field}
                                                onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {element.type === 'file-upload' && (
                            <div className="space-y-6 pt-2">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Allowed File Types</Label>
                                    <Controller
                                        control={control}
                                        name={`elements.${activeIndex}.allowedFileTypes`}
                                        defaultValue={['all']}
                                        render={({ field }) => {
                                            const currentType = (field.value && field.value.length > 0) ? field.value[0] : 'all';
                                            return (
                                                <Select
                                                    value={currentType}
                                                    onValueChange={(val) => field.onChange([val])}
                                                >
                                                    <SelectTrigger className="h-11 bg-card border border-border/50 rounded-xl font-bold">
                                                        <SelectValue placeholder="Select allowed format..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-border/50">
                                                        <SelectItem value="all">All Formats (No Restriction)</SelectItem>
                                                        <SelectItem value="spreadsheets">Spreadsheets (.xlsx, .xls, .csv)</SelectItem>
                                                        <SelectItem value="documents">Documents & PDFs (.pdf, .docx, .txt)</SelectItem>
                                                        <SelectItem value="images">Images (.png, .jpg, .webp, .svg)</SelectItem>
                                                        <SelectItem value="archives">Archives (.zip, .rar, .7z)</SelectItem>
                                                        <SelectItem value="custom">Custom Extensions</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            );
                                        }}
                                    />
                                </div>

                                <Controller
                                    control={control}
                                    name={`elements.${activeIndex}.allowedFileTypes`}
                                    render={({ field }) => {
                                        const isCustom = field.value?.includes('custom');
                                        if (!isCustom) return <></>;
                                        return (
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold">Custom File Extensions</Label>
                                                <Input
                                                    {...register(`elements.${activeIndex}.customFileExtensions`)}
                                                    placeholder=".xlsx, .csv, .pdf"
                                                    className="h-11 bg-card border border-border/50 rounded-xl font-bold"
                                                />
                                                <p className="text-[10px] text-muted-foreground font-medium">
                                                    Comma-separated extensions (e.g. .xlsx, .csv, .pdf)
                                                </p>
                                            </div>
                                        );
                                    }}
                                />

                                <div className="flex items-center justify-between group">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="file-allow-multiple" className="flex items-center gap-2 cursor-pointer">
                                            <Upload className="h-4 w-4 text-primary" />
                                            <span className="font-bold">Allow Multiple Files</span>
                                        </Label>
                                        <p className="text-[10px] text-muted-foreground font-medium">
                                            Respondents can upload more than one file.
                                        </p>
                                    </div>
                                    <Controller
                                        control={control}
                                        name={`elements.${activeIndex}.allowMultipleFiles`}
                                        render={({ field }) => (
                                            <Switch
                                                id="file-allow-multiple"
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        )}
                                    />
                                </div>

                                <Controller
                                    control={control}
                                    name={`elements.${activeIndex}.allowMultipleFiles`}
                                    render={({ field }) => {
                                        if (!field.value) return <></>;
                                        return (
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold">Max Files Allowed</Label>
                                                <Controller
                                                    control={control}
                                                    name={`elements.${activeIndex}.maxFiles`}
                                                    defaultValue={5}
                                                    render={({ field: countField }) => (
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            max={20}
                                                            className="h-11 bg-card border border-border/50 rounded-xl font-bold"
                                                            {...countField}
                                                            onChange={(e) => countField.onChange(parseInt(e.target.value) || 5)}
                                                        />
                                                    )}
                                                />
                                            </div>
                                        );
                                    }}
                                />

                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Max File Size</Label>
                                    <Controller
                                        control={control}
                                        name={`elements.${activeIndex}.maxFileSizeMB`}
                                        defaultValue={25}
                                        render={({ field }) => (
                                            <Select
                                                value={String(field.value || 25)}
                                                onValueChange={(val) => field.onChange(parseInt(val) || 25)}
                                            >
                                                <SelectTrigger className="h-11 bg-card border border-border/50 rounded-xl font-bold">
                                                    <SelectValue placeholder="Select max size..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-border/50">
                                                    <SelectItem value="5">5 MB</SelectItem>
                                                    <SelectItem value="10">10 MB</SelectItem>
                                                    <SelectItem value="25">25 MB (Recommended)</SelectItem>
                                                    <SelectItem value="50">50 MB</SelectItem>
                                                    <SelectItem value="100">100 MB</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {element.type === 'matrix' && (
                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Matrix Rows (1 per line)</Label>
                                    <Controller
                                        control={control}
                                        name={`elements.${activeIndex}.matrixRows`}
                                        defaultValue={['Statement 1', 'Statement 2', 'Statement 3']}
                                        render={({ field }) => (
                                            <Textarea
                                                value={(field.value || []).join('\n')}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        e.target.value
                                                            .split('\n')
                                                            .map((s) => s.trim())
                                                            .filter(Boolean)
                                                    )
                                                }
                                                rows={4}
                                                placeholder="Row item 1&#10;Row item 2&#10;Row item 3"
                                                className="text-xs rounded-xl"
                                            />
                                        )}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Matrix Columns (1 per line)</Label>
                                    <Controller
                                        control={control}
                                        name={`elements.${activeIndex}.matrixColumns`}
                                        defaultValue={['Poor', 'Fair', 'Good', 'Excellent']}
                                        render={({ field }) => (
                                            <Textarea
                                                value={(field.value || []).join('\n')}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        e.target.value
                                                            .split('\n')
                                                            .map((s) => s.trim())
                                                            .filter(Boolean)
                                                    )
                                                }
                                                rows={4}
                                                placeholder="Poor&#10;Fair&#10;Good&#10;Excellent"
                                                className="text-xs rounded-xl"
                                            />
                                        )}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Selection Mode</Label>
                                    <Controller
                                        control={control}
                                        name={`elements.${activeIndex}.matrixType`}
                                        defaultValue="single"
                                        render={({ field }) => (
                                            <Select value={field.value || 'single'} onValueChange={field.onChange}>
                                                <SelectTrigger className="h-10 text-xs rounded-xl">
                                                    <SelectValue placeholder="Select mode" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="single">Single choice per row (Radio)</SelectItem>
                                                    <SelectItem value="multiple">Multiple selections per row (Checkboxes)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {element.type === 'ranking' && (
                            <div className="space-y-2 pt-2">
                                <Label className="text-sm font-semibold">Rankable Items (1 per line)</Label>
                                <Controller
                                    control={control}
                                    name={`elements.${activeIndex}.rankingItems`}
                                    defaultValue={['Item 1', 'Item 2', 'Item 3', 'Item 4']}
                                    render={({ field }) => (
                                        <Textarea
                                            value={(field.value || []).join('\n')}
                                            onChange={(e) =>
                                                field.onChange(
                                                    e.target.value
                                                        .split('\n')
                                                        .map((s) => s.trim())
                                                        .filter(Boolean)
                                                )
                                            }
                                            rows={5}
                                            placeholder="Option A&#10;Option B&#10;Option C"
                                            className="text-xs rounded-xl"
                                        />
                                    )}
                                />
                            </div>
                        )}

                        {element.type === 'slider' && (
                            <div className="space-y-4 pt-2">
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Min</Label>
                                        <Controller
                                            control={control}
                                            name={`elements.${activeIndex}.sliderMin`}
                                            defaultValue={0}
                                            render={({ field }) => (
                                                <Input
                                                    type="number"
                                                    value={field.value ?? 0}
                                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                                    className="h-9 text-xs rounded-xl"
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Max</Label>
                                        <Controller
                                            control={control}
                                            name={`elements.${activeIndex}.sliderMax`}
                                            defaultValue={100}
                                            render={({ field }) => (
                                                <Input
                                                    type="number"
                                                    value={field.value ?? 100}
                                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                                    className="h-9 text-xs rounded-xl"
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Step</Label>
                                        <Controller
                                            control={control}
                                            name={`elements.${activeIndex}.sliderStep`}
                                            defaultValue={1}
                                            render={({ field }) => (
                                                <Input
                                                    type="number"
                                                    value={field.value ?? 1}
                                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                                    className="h-9 text-xs rounded-xl"
                                                />
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Min Label</Label>
                                        <Input
                                            {...register(`elements.${activeIndex}.sliderMinLabel`)}
                                            placeholder="e.g. 0% / Low"
                                            className="h-9 text-xs rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Max Label</Label>
                                        <Input
                                            {...register(`elements.${activeIndex}.sliderMaxLabel`)}
                                            placeholder="e.g. 100% / High"
                                            className="h-9 text-xs rounded-xl"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {element.type === 'nps' && (
                            <div className="space-y-3 pt-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">0 Score Label</Label>
                                        <Input
                                            {...register(`elements.${activeIndex}.npsMinLabel`)}
                                            placeholder="0 - Not at all likely"
                                            className="h-9 text-xs rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">10 Score Label</Label>
                                        <Input
                                            {...register(`elements.${activeIndex}.npsMaxLabel`)}
                                            placeholder="10 - Extremely likely"
                                            className="h-9 text-xs rounded-xl"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {element.type === 'ces' && (
                            <div className="space-y-3 pt-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">1 Score Label</Label>
                                        <Input
                                            {...register(`elements.${activeIndex}.cesMinLabel`)}
                                            placeholder="1 - Strongly Disagree"
                                            className="h-9 text-xs rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">7 Score Label</Label>
                                        <Input
                                            {...register(`elements.${activeIndex}.cesMaxLabel`)}
                                            placeholder="7 - Strongly Agree"
                                            className="h-9 text-xs rounded-xl"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {element.type === 'consent' && (
                            <div className="space-y-3 pt-2">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Consent Notice Text</Label>
                                    <Textarea
                                        {...register(`elements.${activeIndex}.consentText`)}
                                        rows={3}
                                        placeholder="I agree to the data collection and processing policy."
                                        className="text-xs rounded-xl"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Policy Document Link URL (Optional)</Label>
                                    <Input
                                        {...register(`elements.${activeIndex}.consentLinkUrl`)}
                                        placeholder="https://myschool.org/privacy.pdf"
                                        className="h-9 text-xs rounded-xl"
                                    />
                                </div>
                            </div>
                        )}

                        {element.type === 'calculated' && (
                            <div className="space-y-3 pt-2">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Calculation Formula</Label>
                                    <Input
                                        {...register(`elements.${activeIndex}.calculationFormula`)}
                                        placeholder="e.g. q1 * 0.4 + q2 * 0.6"
                                        className="h-9 text-xs rounded-xl font-mono"
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        Refer to question fieldKeys or order IDs in mathematical formulas.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. Section Specific Settings */}
                {element.type === 'section' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between group">
                            <div className="space-y-0.5">
                                <Label htmlFor="section-page" className="flex items-center gap-2 cursor-pointer">
                                    <Layers className="h-4 w-4 text-primary" />
                                    <span className="font-bold">Render as New Page</span>
                                </Label>
                            </div>
                            <Controller
                                control={control}
                                name={`elements.${activeIndex}.renderAsPage`}
                                render={({ field }) => (
                                    <Switch 
                                        id="section-page" 
                                        checked={field.value} 
                                        onCheckedChange={field.onChange} 
                                    />
                                )}
                            />
                        </div>

                        <div className="flex items-center justify-between group">
                            <div className="space-y-0.5">
                                <Label htmlFor="section-validate" className="flex items-center gap-2 cursor-pointer">
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                    <span className="font-bold">Validate on Next</span>
                                </Label>
                            </div>
                            <Controller
                                control={control}
                                name={`elements.${activeIndex}.validateBeforeNext`}
                                render={({ field }) => (
                                    <Switch 
                                        id="section-validate" 
                                        checked={field.value} 
                                        onCheckedChange={field.onChange} 
                                    />
                                )}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Stepper Title</Label>
                            <Controller
                                control={control}
                                name={`elements.${activeIndex}.stepperTitle`}
                                render={({ field }) => (
                                    <Input 
                                        className="h-11 bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 rounded-xl font-bold" 
                                        placeholder="e.g. Basic Info"
                                        {...field}
                                    />
                                )}
                            />
                        </div>

                        <div className="flex items-center justify-between group">
                            <div className="space-y-0.5">
                                <Label htmlFor="section-header-visible" className="flex items-center gap-2 cursor-pointer">
                                    <Eye className="h-4 w-4 text-primary" />
                                    <span className="font-bold">Show Section Header</span>
                                </Label>
                                <p className="text-[10px] text-muted-foreground font-semibold pl-6">
                                    When off, section acts as a page break only
                                </p>
                            </div>
                            <Controller
                                control={control}
                                name={`elements.${activeIndex}.showSectionHeader`}
                                render={({ field }) => (
                                    <Switch 
                                        id="section-header-visible" 
                                        checked={field.value ?? true} 
                                        onCheckedChange={field.onChange} 
                                    />
                                )}
                            />
                        </div>
                    </div>
                )}

                {/* 4. Appearance & Formatting */}
                <div className="space-y-4">
                    <Label className="text-sm font-semibold">Appearance</Label>
                    
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                             <span className="text-[10px] font-bold text-muted-foreground/60">Rich Text Formatting</span>
                             <div className="flex p-1 bg-muted/20 rounded-xl border border-border/50 gap-1">
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="flex-1 h-8 rounded-lg"
                                    onClick={() => document.execCommand('bold', false)}
                                >
                                    <Bold className="h-3.5 w-3.5" />
                                </Button>
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="flex-1 h-8 rounded-lg"
                                    onClick={() => document.execCommand('italic', false)}
                                >
                                    <Italic className="h-3.5 w-3.5" />
                                </Button>
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="flex-1 h-8 rounded-lg"
                                    onClick={() => document.execCommand('underline', false)}
                                >
                                    <Underline className="h-3.5 w-3.5" />
                                </Button>
                             </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground/60">Text Alignment</span>
                            <Controller
                                control={control}
                                name={`elements.${activeIndex}.style.textAlign`}
                                defaultValue="left"
                                render={({ field }) => (
                                    <div className="flex p-1 bg-muted/20 rounded-xl border border-border/50 gap-1">
                                        <Button 
                                            size="icon" 
                                            variant={field.value === 'left' ? 'secondary' : 'ghost'} 
                                            className="flex-1 h-8 rounded-lg"
                                            onClick={() => field.onChange('left')}
                                        >
                                            <AlignLeft className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button 
                                            size="icon" 
                                            variant={field.value === 'center' ? 'secondary' : 'ghost'} 
                                            className="flex-1 h-8 rounded-lg"
                                            onClick={() => field.onChange('center')}
                                        >
                                            <AlignCenter className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button 
                                            size="icon" 
                                            variant={field.value === 'right' ? 'secondary' : 'ghost'} 
                                            className="flex-1 h-8 rounded-lg"
                                            onClick={() => field.onChange('right')}
                                        >
                                            <AlignRight className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button 
                                            size="icon" 
                                            variant={field.value === 'justify' ? 'secondary' : 'ghost'} 
                                            className="flex-1 h-8 rounded-lg"
                                            onClick={() => field.onChange('justify')}
                                        >
                                            <AlignJustify className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                )}
                            />
                        </div>

                        {element.type === 'document' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Template / Document Source</Label>
                                    <Controller
                                        control={control}
                                        name={`elements.${activeIndex}.url`}
                                        render={({ field }) => (
                                            <MediaSelect 
                                                value={field.value} 
                                                onValueChange={field.onChange}
                                                filterType="document"
                                            />
                                        )}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                        Template Title / Headline
                                    </Label>
                                    <Input 
                                        {...register(`elements.${activeIndex}.title`)} 
                                        placeholder="e.g. School Data Spreadsheet Template"
                                        className="h-10 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                        Instructions / Description Copy
                                    </Label>
                                    <Textarea 
                                        {...register(`elements.${activeIndex}.description`)} 
                                        placeholder="Explain how to fill out the template..."
                                        className="min-h-[80px] bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl text-xs font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                        Download Button Label
                                    </Label>
                                    <Input 
                                        {...register(`elements.${activeIndex}.buttonText`)} 
                                        placeholder="Download Template (Default: Download Document)"
                                        className="h-10 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl"
                                    />
                                </div>
                            </div>
                        )}

                        {['image', 'video', 'audio'].includes(element.type) && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Media Source</Label>
                                    <Controller
                                        control={control}
                                        name={`elements.${activeIndex}.url`}
                                        render={({ field }) => (
                                            <MediaSelect 
                                                value={field.value} 
                                                onValueChange={field.onChange}
                                                filterType={element.type as any}
                                            />
                                        )}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                        {element.type === 'image' ? 'Alt Text' : 'Caption'}
                                    </Label>
                                    <Input 
                                        {...register(`elements.${activeIndex}.title`)} 
                                        placeholder={`Add a descriptive ${element.type === 'image' ? 'alt text' : 'caption'}...`}
                                        className="h-10 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl"
                                    />
                                </div>
                            </div>
                        )}

                        {element.type === 'embed' && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">HTML Embed Code</Label>
                                <Textarea 
                                    {...register(`elements.${activeIndex}.html`)} 
                                    placeholder="Paste iframe or HTML code..."
                                    className="min-h-[120px] font-mono text-xs bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl"
                                />
                            </div>
                        )}

                        {element.type === 'heading' && (
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground/60">Heading Size</span>
                                <Controller
                                    control={control}
                                    name={`elements.${activeIndex}.variant`}
                                    defaultValue="h2"
                                    render={({ field }) => (
                                        <div className="flex p-1 bg-muted/20 rounded-xl border border-border/50 gap-1">
                                            {['h1', 'h2', 'h3'].map((h) => (
                                                <Button 
                                                    key={h}
                                                    size="sm" 
                                                    variant={field.value === h ? 'secondary' : 'ghost'} 
                                                    className="flex-1 h-8 rounded-lg text-[10px] font-black"
                                                    onClick={() => field.onChange(h)}
                                                >
                                                    {h.toUpperCase()}
                                                </Button>
                                            ))}
                                        </div>
                                    )}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="scoring" className="border-none">
                        <AccordionTrigger className="hover:no-underline p-0 pb-4">
                             <div className="flex items-center gap-2">
                                <Trophy className="h-4 w-4 text-yellow-500" />
                                <span className="font-bold text-sm">Scoring Engine</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4 pt-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold">Enable Scoring</Label>
                                    <Controller
                                        control={control}
                                        name={`elements.${activeIndex}.enableScoring`}
                                        render={({ field }) => (
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        )}
                                    />
                                </div>
                                
                                <AnimatePresence>
                                    {element.enableScoring && (
                                        <motion.div 
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="space-y-4 overflow-hidden pt-2"
                                        >
                                            {element.type === 'yes-no' ? (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-sm font-semibold">"Yes" Points</Label>
                                                        <Controller
                                                            control={control}
                                                            name={`elements.${activeIndex}.yesScore`}
                                                            render={({ field }) => (
                                                                <Input 
                                                                    type="number" 
                                                                    className="h-11 bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 rounded-xl font-bold" 
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                                />
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-sm font-semibold">"No" Points</Label>
                                                        <Controller
                                                            control={control}
                                                            name={`elements.${activeIndex}.noScore`}
                                                            render={({ field }) => (
                                                                <Input 
                                                                    type="number" 
                                                                    className="h-11 bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 rounded-xl font-bold" 
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                                />
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (element.options && element.options.length > 0) ? (
                                                <div className="space-y-3">
                                                    <Label className="text-sm font-semibold">Points per Option</Label>
                                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                                                        {element.options.map((opt: string, optIdx: number) => (
                                                            <div key={optIdx} className="flex items-center gap-3">
                                                                <div className="flex-1 truncate text-xs font-medium text-muted-foreground">
                                                                    {opt}
                                                                </div>
                                                                <Controller
                                                                    control={control}
                                                                    name={`elements.${activeIndex}.optionScores.${optIdx}`}
                                                                    render={({ field }) => (
                                                                        <Input 
                                                                            type="number" 
                                                                            className="h-8 w-16 bg-card border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 rounded-md text-right font-bold text-xs" 
                                                                            value={field.value ?? 0}
                                                                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                                        />
                                                                    )}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-muted-foreground italic">Add options to the question to configure scoring.</p>
                                            )}
                                            
                                            <div className="p-3 bg-yellow-500/5 rounded-xl border border-yellow-500/10">
                                                <p className="text-[10px] text-yellow-600 font-medium leading-relaxed">
                                                    Scores are summed automatically during submission to determine the final respondent outcome.
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    </div>
    );
}
