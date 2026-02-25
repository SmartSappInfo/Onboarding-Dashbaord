'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
    Trash2, PlusCircle, ArrowUp, ArrowDown, Bot, Check, ChevronsUpDown, X, Star, Clock, 
    Upload, Pilcrow, Baseline, CheckCircle2, ListChecks, ChevronDownSquare, CheckCircle, 
    Type, Copy, Eye, EyeOff, Heading1, Image as ImageIcon, Video as VideoIcon, 
    AudioWaveform, FileText, Code, Minus, Text as TextIcon, MoreVertical, 
    Calendar as CalendarIcon, GripVertical, Layers, Bold, Italic, Underline,
    AlignLeft, AlignCenter, AlignRight, Zap, Asterisk, Trophy as TrophyIcon
} from 'lucide-react';
import type { SurveyElement, SurveyQuestion, SurveyLayoutBlock, MediaAsset } from '@/lib/types';
import * as React from 'react';
import { FormMessage, FormItem, FormLabel } from '@/components/ui/form';
import { useFieldArray } from 'react-hook-form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { format, isValid, parseISO } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import Image from 'next/image';
import VideoEmbed from '@/components/video-embed';
import MediaSelectorDialog from '../../media/components/media-selector-dialog';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * A simple Rich Text Editor using contenteditable that integrates with react-hook-form.
 */
const RichTextEditor = ({ 
    value, 
    onChange, 
    placeholder, 
    className,
    textAlign = 'left' 
}: { 
    value: string; 
    onChange: (val: string) => void; 
    placeholder?: string;
    className?: string;
    textAlign?: 'left' | 'center' | 'right';
}) => {
    const editorRef = React.useRef<HTMLDivElement>(null);

    // Sync external value to editor (only if different)
    React.useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') { e.preventDefault(); document.execCommand('bold', false); }
            if (e.key === 'i') { e.preventDefault(); document.execCommand('italic', false); }
            if (e.key === 'u') { e.preventDefault(); document.execCommand('underline', false); }
        }
    };

    return (
        <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            className={cn(
                "min-h-[1em] outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:italic whitespace-pre-wrap",
                textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left',
                className
            )}
            data-placeholder={placeholder}
        />
    );
};

function isQuestion(element: SurveyElement): element is SurveyQuestion {
    const questionTypes: SurveyQuestion['type'][] = ['text', 'long-text', 'yes-no', 'multiple-choice', 'checkboxes', 'dropdown', 'rating', 'date', 'time', 'file-upload'];
    return questionTypes.includes(element.type as any);
}

function isLayoutBlock(element: SurveyElement): element is SurveyLayoutBlock {
    const layoutTypes = ['heading', 'description', 'divider', 'image', 'video', 'audio', 'document', 'embed', 'section'];
    return layoutTypes.includes(element.type);
}

const getElementIcon = (type: SurveyElement['type']) => {
    const iconMap: { [key in SurveyElement['type']]: React.ElementType } = {
        'text': Baseline,
        'long-text': Pilcrow,
        'yes-no': CheckCircle2,
        'multiple-choice': CheckCircle,
        'checkboxes': ListChecks,
        'dropdown': ChevronDownSquare,
        'rating': Star,
        'date': CalendarIcon,
        'time': Clock,
        'file-upload': Upload,
        'heading': Heading1,
        'description': TextIcon,
        'divider': Minus,
        'image': ImageIcon,
        'video': VideoIcon,
        'audio': AudioWaveform,
        'document': FileText,
        'embed': Code,
        'logic': Bot,
        'section': Layers,
    };
    return iconMap[type] || Type;
}

const getMediaFilterType = (type: SurveyElement['type']): 'image' | 'video' | 'audio' | 'document' | undefined => {
      if (type === 'image') return 'image';
      if (type === 'video') return 'video';
      if (type === 'audio') return 'audio';
      if (type === 'document') return 'document';
      return undefined;
}

function FormattingToolbar({ fieldName, alignValue, onAlignChange, minimal }: { 
    fieldName: string;
    alignValue?: 'left' | 'center' | 'right';
    onAlignChange?: (val: 'left' | 'center' | 'right') => void;
    minimal?: boolean;
}) {
    const applyStyle = (cmd: string) => {
        document.execCommand(cmd, false);
    };

    return (
        <div className={cn("flex items-center gap-0.5", !minimal && "bg-muted p-1 rounded-md mb-2")}>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyStyle('bold')} title="Bold (Ctrl+B)">
                <Bold className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyStyle('italic')} title="Italic (Ctrl+I)">
                <Italic className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyStyle('underline')} title="Underline (Ctrl+U)">
                <Underline className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            
            {onAlignChange && (
                <>
                    <Button type="button" variant={alignValue === 'left' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => onAlignChange('left')}>
                        <AlignLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant={alignValue === 'center' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => onAlignChange('center')}>
                        <AlignCenter className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant={alignValue === 'right' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => onAlignChange('right')}>
                        <AlignRight className="h-3.5 w-3.5" />
                    </Button>
                </>
            )}
        </div>
    );
}

const MediaLayoutEditor = ({ element, field }: { element: SurveyLayoutBlock; field: any }) => {
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    
    const handleSelect = (asset: MediaAsset) => {
        field.onChange(asset.url);
        setIsDialogOpen(false);
    };

    const filterType = getMediaFilterType(element.type);
    const Icon = getElementIcon(element.type);

    return (
        <>
            {field.value ? (
                <div className="relative group/media-preview rounded-lg border border-border/50 overflow-hidden">
                    {element.type === 'image' && <Image src={field.value} alt={element.title || 'image preview'} width={800} height={450} className="w-full h-auto object-cover" />}
                    {element.type === 'video' && <VideoEmbed url={field.value} />}
                    {element.type === 'audio' && <div className="p-4"><audio controls src={field.value} className="w-full" /></div>}
                    {element.type === 'document' && (
                        <a href={field.value} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 hover:bg-muted">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="font-semibold">Document</p>
                                <p className="text-sm text-muted-foreground truncate">{field.value}</p>
                            </div>
                        </a>
                    )}
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/media-preview:opacity-100 transition-opacity">
                         <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(true)}>Change {element.type}</Button>
                    </div>
                </div>
            ) : (
                <div 
                    className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setIsDialogOpen(true)}
                >
                    <Icon className="h-12 w-12 text-muted-foreground" />
                    <span className="mt-4 text-sm font-semibold text-muted-foreground">Select an {element.type}</span>
                </div>
            )}
            <MediaSelectorDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSelectAsset={handleSelect}
                filterType={filterType}
            />
        </>
    );
};

interface MultiSelectProps {
  options: { label: string; value: string; }[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

function MultiSelect({ options, value, onChange, placeholder = "Select options..." }: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const selectedValues = new Set(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-10 border-border"
        >
          <div className="flex gap-1 flex-wrap">
            {selectedValues.size > 0 ? (
                options.filter(opt => selectedValues.has(opt.value)).map(option => (
                    <Badge
                        variant="secondary"
                        key={option.value}
                        className="mr-1 mb-1"
                    >
                        {option.label}
                         <div
                            role="button"
                            tabIndex={0}
                            aria-label={`Remove ${option.label}`}
                            className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                const newSelection = Array.from(selectedValues).filter((v) => v !== option.value);
                                onChange(newSelection);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                    const newSelection = Array.from(selectedValues).filter((v) => v !== option.value);
                                    onChange(newSelection);
                                }
                            }}
                        >
                            <X className="h-3 w-3" />
                        </div>
                    </Badge>
                ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[--radix-popover-trigger-width] p-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onSelect={() => {
                    const newSelection = new Set(selectedValues);
                    if (newSelection.has(option.value)) {
                      newSelection.delete(option.value);
                    } else {
                      newSelection.add(option.value);
                    }
                    onChange(Array.from(newSelection));
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedValues.has(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OptionsEditor({ questionIndex }: { questionIndex: number }) {
  const { control, watch, setValue, getValues } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `elements.${questionIndex}.options`,
  });

  const questionType = watch(`elements.${questionIndex}.type`);
  const defaultValue = watch(`elements.${questionIndex}.defaultValue`);
  const allowOther = watch(`elements.${questionIndex}.allowOther`);
  const enableScoring = watch(`elements.${questionIndex}.enableScoring`);

  const handleAddOption = () => {
    append('');
    if (enableScoring) {
        const currentScores = getValues(`elements.${questionIndex}.optionScores`) || [];
        setValue(`elements.${questionIndex}.optionScores`, [...currentScores, 0], { shouldDirty: true });
    }
  };

  const handleRemoveOption = (index: number) => {
    remove(index);
    if (enableScoring) {
        const currentScores = getValues(`elements.${questionIndex}.optionScores`) || [];
        const newScores = currentScores.filter((_:any, i:number) => i !== index);
        setValue(`elements.${questionIndex}.optionScores`, newScores, { shouldDirty: true });
    }
  };

  const handleDefaultChange = (newValue: any) => {
    setValue(`elements.${questionIndex}.defaultValue`, newValue, { shouldDirty: true, shouldValidate: true });
  }

  return (
    <div className="space-y-3">
      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Options</Label>
      {(questionType === 'multiple-choice' || questionType === 'dropdown') && (
        <RadioGroup onValueChange={handleDefaultChange} value={defaultValue}>
          {fields.map((field, index) => {
            const optionValue = watch(`elements.${questionIndex}.options.${index}`);
            return (
              <div key={field.id} className="flex items-center gap-2">
                <RadioGroupItem value={optionValue} id={`${field.id}-radio`} />
                <div className="flex-1 space-y-1">
                    <Controller
                    name={`elements.${questionIndex}.options.${index}`}
                    control={control}
                    render={({ field }) => <Input {...field} value={field.value ?? ''} placeholder={`Option ${index + 1}`} className="bg-muted/20 h-11 rounded-xl border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20" />}
                    />
                </div>
                 {enableScoring && (
                    <Controller
                    name={`elements.${questionIndex}.optionScores.${index}`}
                    control={control}
                    defaultValue={0}
                    render={({ field: scoreField }) => (
                        <Input
                        type="number"
                        placeholder="Score"
                        className="w-24 bg-muted/20 h-11 rounded-xl border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20"
                        {...scoreField}
                        value={scoreField.value ?? ''}
                        onChange={e => scoreField.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                        />
                    )}
                    />
                )}
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => handleRemoveOption(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )
          })}
        </RadioGroup>
      )}
      {questionType === 'checkboxes' && (
        <div className="space-y-2">
          {fields.map((field, index) => {
            const optionValue = watch(`elements.${questionIndex}.options.${index}`);
            const isChecked = allowOther
              ? Array.isArray(defaultValue?.options) && defaultValue.options.includes(optionValue)
              : Array.isArray(defaultValue) && defaultValue.includes(optionValue);

            return (
              <div key={field.id} className="flex items-center gap-2">
                <Checkbox
                  id={`${field.id}-checkbox`}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    if (allowOther) {
                      const currentSelected = defaultValue?.options || [];
                      const newSelected = checked
                        ? [...currentSelected, optionValue]
                        : currentSelected.filter((v: string) => v !== optionValue);
                      handleDefaultChange({ ...(defaultValue || { options: [], other: '' }), options: newSelected });
                    } else {
                      const currentSelected = Array.isArray(defaultValue) ? defaultValue : [];
                      const newSelected = checked
                        ? [...currentSelected, optionValue]
                        : currentSelected.filter((v: string) => v !== optionValue);
                      handleDefaultChange(newSelected);
                    }
                  }}
                />
                <div className="flex-1">
                    <Controller
                    name={`elements.${questionIndex}.options.${index}`}
                    control={control}
                    render={({ field }) => <Input {...field} value={field.value ?? ''} placeholder={`Option ${index + 1}`} className="bg-muted/20 h-11 rounded-xl border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20" />}
                    />
                </div>
                 {enableScoring && (
                    <Controller
                    name={`elements.${questionIndex}.optionScores.${index}`}
                    control={control}
                    defaultValue={0}
                    render={({ field: scoreField }) => (
                        <Input
                        type="number"
                        placeholder="Score"
                        className="w-24 bg-muted/20 h-11 rounded-xl border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20"
                        {...scoreField}
                        value={scoreField.value ?? ''}
                        onChange={e => scoreField.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                        />
                    )}
                    />
                )}
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => handleRemoveOption(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={handleAddOption} className="rounded-xl font-bold border-border/50">
        <PlusCircle className="h-4 w-4 mr-2" /> Add Option
      </Button>
      {questionType === 'checkboxes' && (
        <div className="flex items-center space-x-2 pt-2">
          <Controller
            name={`elements.${questionIndex}.allowOther`}
            control={control}
            render={({ field }) => (
              <Switch
                id={`allowOther-${questionIndex}`}
                checked={!!field.value}
                onCheckedChange={(isChecked) => {
                  field.onChange(isChecked);
                  if (isChecked) {
                    const currentArray = Array.isArray(defaultValue) ? defaultValue : [];
                    handleDefaultChange({ options: currentArray, other: '' });
                  } else {
                    const currentOptions = defaultValue?.options || [];
                    handleDefaultChange(currentOptions);
                  }
                }}
              />
            )}
          />
          <Label htmlFor={`allowOther-${questionIndex}`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Allow "Other" option</Label>
        </div>
      )}
    </div>
  );
}

function LogicBlockEditor({ elementIndex }: { elementIndex: number }) {
    const { control, watch } = useFormContext();
    const { fields, append, remove } = useFieldArray({
      control,
      name: `elements.${elementIndex}.rules`,
    });
  
    const allElements: SurveyElement[] = watch('elements') || [];
  
    const potentialSourceQuestions = allElements
      .slice(0, elementIndex)
      .filter((el): el is SurveyQuestion => isQuestion(el));
  
    const getTargetableElements = (excludeSelf = true) => {
        return allElements
            .map((el, idx) => ({ el, idx }))
            .filter(({ el, idx }) => excludeSelf ? idx !== elementIndex : true)
            .map(({ el, idx }) => {
                const Icon = getElementIcon(el.type);
                const prefix = isQuestion(el) ? `Q${allElements.filter(isQuestion).findIndex(q => q.id === el.id) + 1}` : (el.type.charAt(0).toUpperCase() + el.type.slice(1));
                const label = el.title ? `${prefix}: ${el.title}` : `${prefix}: untitled`;
                return { value: el.id, label: label.label || label, icon: Icon };
            });
    }

    const getJumpTargets = () => {
        return allElements
            .slice(elementIndex + 1)
            .map((el, idx) => ({ el, originalIndex: elementIndex + 1 + idx }))
            .filter(({ el }) => isQuestion(el) || el.type === 'heading' || el.type === 'section')
            .map(({ el, originalIndex }) => {
                const prefix = isQuestion(el) ? `Q${allElements.filter(isQuestion).findIndex(q => q.id === el.id) + 1}` : 'Section';
                return {
                    value: el.id,
                    label: `${prefix}: ${el.title || 'untitled'}`
                }
            })
    }
  
    return (
      <div className="space-y-4 p-4 border border-primary/20 rounded-2xl bg-primary/10">
        {fields.map((field, index) => {
          const operator = watch(`elements.${elementIndex}.rules.${index}.operator`);
          const actionType = watch(`elements.${elementIndex}.rules.${index}.action.type`);
          const showValueInput = operator !== 'isEmpty' && operator !== 'isNotEmpty';
  
          return (
              <div key={field.id} className="p-4 border border-border/50 rounded-xl bg-background shadow-xs relative">
              <div className="absolute top-2 right-2">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
              </div>
              <div className="flex items-start gap-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground pt-2">
                      <Bot className="h-5 w-5" />
                      <span>When</span>
                  </div>
                  <div className="flex-grow space-y-2">
                  <Controller
                      name={`elements.${elementIndex}.rules.${index}.sourceQuestionId`}
                      control={control}
                      render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="bg-muted/50 border-border/50"><SelectValue placeholder="Select a question..." /></SelectTrigger>
                          <SelectContent>
                          {potentialSourceQuestions.map((q) => (
                              <SelectItem key={q.id} value={q.id}>
                              Q{allElements.filter(isQuestion).findIndex(el => el.id === q.id) + 1}: {q.title}
                              </SelectItem>
                          ))}
                          </SelectContent>
                      </Select>
                      )}
                  />
                  <div className="flex items-center gap-2">
                      <Controller
                      name={`elements.${elementIndex}.rules.${index}.operator`}
                      control={control}
                      render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="w-1/2 bg-muted/50 border-border/50"><SelectValue placeholder="Operator..." /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="isEqualTo">Is</SelectItem>
                              <SelectItem value="isNotEqualTo">Is not</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                              <SelectItem value="doesNotContain">Does not contain</SelectItem>
                              <SelectItem value="startsWith">Starts with</SelectItem>
                              <SelectItem value="doesNotStartWith">Does not start with</SelectItem>
                              <SelectItem value="endsWith">Ends with</SelectItem>
                              <SelectItem value="doesNotEndWith">Does not end with</SelectItem>
                              <SelectItem value="isEmpty">Is empty</SelectItem>
                              <SelectItem value="isNotEmpty">Is not empty</SelectItem>
                              <SelectItem value="isGreaterThan">Is greater than</SelectItem>
                              <SelectItem value="isLessThan">Is less than</SelectItem>
                          </SelectContent>
                          </Select>
                      )}
                      />
                      {showValueInput && (
                          <Controller
                          name={`elements.${elementIndex}.rules.${index}.targetValue`}
                          control={control}
                          render={({ field }) => <Input {...field} value={field.value ?? ''} placeholder="Value..." className="bg-muted/50 border-border/50" />}
                          />
                      )}
                  </div>
                  </div>
              </div>
              <div className="flex items-start gap-4 mt-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground pt-2">
                      <span className="text-lg">↳</span>
                      <span>Then</span>
                  </div>
                  <div className="flex-grow flex flex-col gap-2">
                      <Controller
                          name={`elements.${elementIndex}.rules.${index}.action.type`}
                          control={control}
                          render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger className="w-full bg-muted/50 border-border/50"><SelectValue placeholder="Action..." /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="jump">Jump To...</SelectItem>
                                      <SelectItem value="show">Show Element(s)...</SelectItem>
                                      <SelectItem value="hide">Hide Element(s)...</SelectItem>
                                      <SelectItem value="require">Require Element(s)...</SelectItem>
                                      <SelectItem value="disableSubmit">Disable Submit</SelectItem>
                                  </SelectContent>
                              </Select>
                          )}
                      />
                      {actionType === 'jump' && (
                          <Controller
                              name={`elements.${elementIndex}.rules.${index}.action.targetElementId`}
                              control={control}
                              render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value}>
                                      <SelectTrigger className="bg-muted/50 border-border/50"><SelectValue placeholder="Target element..." /></SelectTrigger>
                                      <SelectContent>
                                      {getJumpTargets().map((el) => (
                                          <SelectItem key={el.value} value={el.value}>{el.label}</SelectItem>
                                      ))}
                                      </SelectContent>
                                  </Select>
                              )}
                          />
                      )}
                       {(actionType === 'show' || actionType === 'hide' || actionType === 'require') && (
                          <Controller
                              name={`elements.${elementIndex}.rules.${index}.action.targetElementIds`}
                              control={control}
                              defaultValue={[]}
                              render={({ field }) => (
                                  <MultiSelect 
                                      options={getTargetableElements()}
                                      value={field.value || []}
                                      onChange={field.onChange}
                                      placeholder="Select target element(s)..."
                                  />
                              )}
                          />
                       )}
                  </div>
              </div>
              </div>
          );
        })}
         <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ sourceQuestionId: '', operator: 'isEqualTo', action: { type: 'jump' } })}
          className="rounded-xl font-bold border-border/50"
        >
          <PlusCircle className="h-4 w-4 mr-2" /> Add Rule
        </Button>
      </div>
    );
}

const StarRatingInput = ({ value, onChange, disabled }: { value: number, onChange: (value: number) => void, disabled?: boolean }) => {
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
                <Star
                    key={star}
                    className={cn(
                        'w-8 h-8 cursor-pointer',
                        star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300',
                        disabled ? 'cursor-not-allowed opacity-50' : ''
                    )}
                    onClick={() => !disabled && onChange(star)}
                />
            ))}
        </div>
    );
};

const DatePicker = ({ value, onChange, disabled }: { value?: string | Date, onChange: (date?: Date) => void, disabled?: boolean }) => {
    let dateValue: Date | undefined = undefined;
    if (value) {
        const parsed = value instanceof Date ? value : parseISO(value);
        if (isValid(parsed)) {
            dateValue = parsed;
        }
    }
    
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-11 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl", !dateValue && "text-muted-foreground")} disabled={disabled}>
                    <CalendarIcon className="mr-2 h-4" />
                    {dateValue ? format(dateValue, "PPP") : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={dateValue} onSelect={onChange} />
            </PopoverContent>
        </Popover>
    );
}

function QuestionSettingsPopover({ element, index, changeType }: {
    element: SurveyElement;
    index: number;
    changeType: (index: number, type: SurveyElement['type']) => void;
}) {
    const { control, getValues, setValue } = useFormContext();
    const isElemQuestion = isQuestion(element);
    const isTextQuestion = isElemQuestion && (element.type === 'text' || element.type === 'long-text');
    
    const [useMin, setUseMin] = React.useState(false);
    const [useMax, setUseMax] = React.useState(false);

    const handleToggle = (setter: React.Dispatch<React.SetStateAction<boolean>>, value: boolean, fieldName: string) => {
        setter(value);
        if (!value) {
            setValue(`elements.${index}.${fieldName}`, undefined);
        }
    };
    
    const questionTypes: { type: SurveyQuestion['type'], label: string }[] = [
        { type: 'text', label: 'Short Text'}, { type: 'long-text', label: 'Long Text'}, { type: 'yes-no', label: 'Yes/No'},
        { type: 'multiple-choice', label: 'Multiple Choice'}, { type: 'checkboxes', label: 'Checkboxes'}, { type: 'dropdown', label: 'Dropdown'},
        { type: 'rating', label: 'Rating'}, { type: 'date', label: 'Date'}, { type: 'time', label: 'Time'},
        { type: 'file-upload', label: 'File Upload'},
    ];

    React.useEffect(() => {
        setUseMin(isTextQuestion && getValues(`elements.${index}.minLength`) !== undefined);
        setUseMax(isTextQuestion && getValues(`elements.${index}.maxLength`) !== undefined);
    }, [getValues, index, isTextQuestion]);

    return (
        <div className="space-y-4">
            {isElemQuestion && isTextQuestion && (
                <div className="space-y-4">
                    <h4 className="font-semibold text-muted-foreground text-sm px-1 text-[10px] uppercase tracking-widest">Validation</h4>
                    <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                        <Label htmlFor={`min-chars-toggle-${index}`} className="text-xs">Min characters</Label>
                        <Switch id={`min-chars-toggle-${index}`} checked={useMin} onCheckedChange={(val) => handleToggle(setUseMin, val, 'minLength')} />
                    </div>
                    {useMin && <Controller name={`elements.${index}.minLength`} control={control} render={({ field }) => <Input type="number" {...field} value={field.value ?? ''} placeholder="e.g., 10" className="h-9" onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}/>} />}

                    <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                        <Label htmlFor={`max-chars-toggle-${index}`} className="text-xs">Max characters</Label>
                        <Switch id={`max-chars-toggle-${index}`} checked={useMax} onCheckedChange={(val) => handleToggle(setUseMax, val, 'maxLength')} />
                    </div>
                    {useMax && <Controller name={`elements.${index}.maxLength`} control={control} render={({ field }) => <Input type="number" {...field} value={field.value ?? ''} placeholder="e.g., 200" className="h-9" onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))} />} />}
                </div>
            )}
            <div className="space-y-4">
                <h4 className="font-semibold text-muted-foreground text-sm px-1 text-[10px] uppercase tracking-widest">Content</h4>
                <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                   <Label htmlFor={`hidden-toggle-${index}`} className="text-xs">Hidden by default</Label>
                   <Controller name={`elements.${index}.hidden`} control={control} render={({ field }) => <Switch id={`hidden-toggle-${index}`} checked={!!field.value} onCheckedChange={field.onChange} />} />
                </div>
            </div>
            <div className="space-y-4">
                <h4 className="font-semibold text-muted-foreground text-sm px-1 text-[10px] uppercase tracking-widest">Change To</h4>
                <Select value={element.type} onValueChange={(type: SurveyElement['type']) => changeType(index, type)}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Turn into..." /></SelectTrigger>
                    <SelectContent>
                        {questionTypes.map(qType => <SelectItem key={qType.type} value={qType.type}>{qType.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}

function SortableSurveyElement({ id, index, remove, swap, insert, requestAddElement }: { 
    id: string; 
    index: number;
    remove: (index: number) => void;
    swap: (indexA: number, indexB: number) => void;
    insert: (index: number, value: SurveyElement) => void;
    requestAddElement: (index: number) => void;
}) {
  const { control, watch, setValue, getValues, formState: { errors } } = useFormContext();
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const element = watch(`elements.${index}`);
  const formErrors = errors.elements as any[] | undefined;
  const elementErrors = formErrors?.[index] as Record<string, { message: string }> | undefined;
  
  const hasErrors = elementErrors && Object.keys(elementErrors).length > 0;

  const enableScoring = watch(`elements.${index}.enableScoring`);

  const duplicateElement = (index: number) => {
    const elementToDuplicate = getValues(`elements.${index}`);
    const newElement = {
        ...JSON.parse(JSON.stringify(elementToDuplicate)),
        id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    insert(index + 1, newElement);
  };

  const changeElementType = (index: number, newType: SurveyElement['type']) => {
      const currentElement = getValues(`elements.${index}`);
      const newElement = { ...currentElement, type: newType };
      
      if(newType === 'multiple-choice' || newType === 'checkboxes' || newType === 'dropdown') {
          if(!newElement.options) newElement.options = ['Option 1', 'Option 2'];
      } else {
          delete newElement.options;
          delete newElement.allowOther;
      }
      
      setValue(`elements.${index}`, newElement, { shouldDirty: true });
  }

  const toggleHidden = (index: number) => {
    const currentHiddenState = getValues(`elements.${index}.hidden`);
    setValue(`elements.${index}.hidden`, !currentHiddenState, { shouldDirty: true });
  };

  const toggleRequired = (index: number) => {
    const current = getValues(`elements.${index}.isRequired`);
    setValue(`elements.${index}.isRequired`, !current, { shouldDirty: true });
  };
  
  if (!element) return null;

  const isElementQuestion = isQuestion(element);
  const isElementLayout = isLayoutBlock(element);
  const isElementSection = element.type === 'section';
  const isMediaLayout = isElementLayout && ['image', 'video', 'audio', 'document', 'embed'].includes(element.type);
  const ElementIcon = getElementIcon(element.type);
  const SCOREABLE_TYPES: SurveyQuestion['type'][] = ['multiple-choice', 'dropdown', 'checkboxes', 'yes-no'];
  const isScoreable = isElementQuestion && SCOREABLE_TYPES.includes(element.type);
  const isAutoAdvanceable = isElementQuestion && (element.type === 'multiple-choice' || element.type === 'yes-no');

  const sectionNumber = React.useMemo(() => {
    const all = watch('elements') || [];
    const sections = all.filter((el: any) => el.type === 'section');
    return sections.findIndex((el: any) => el.id === id) + 1;
  }, [watch('elements'), id]);

  const questionNumber = React.useMemo(() => {
    if (!isElementQuestion) return null;
    const all = watch('elements') || [];
    const questions = all.filter(isQuestion);
    return questions.findIndex((el: any) => el.id === id) + 1;
  }, [watch('elements'), id, isElementQuestion]);
  
  return (
    <div className="relative group" ref={setNodeRef} style={style}>
        <div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 cursor-grab p-2 bg-card border rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            {...attributes}
            {...listeners}
        >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <Card 
            id={element.id}
            className={cn(
                "border transition-all duration-200",
                hasErrors ? "border-destructive shadow-lg" : "border-border shadow-xs group-hover:shadow-md",
                element.hidden ? "opacity-60 bg-muted/20" : "bg-card"
            )}
        >
             <CardHeader className="py-3 px-4 border-b bg-muted/10">
                <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        <div className={cn(
                            "flex items-center justify-center rounded border p-1.5 bg-primary/10 shadow-xs",
                            element.hidden && "opacity-50"
                        )}>
                            <ElementIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                        </div>
                        <span>
                            {isElementQuestion ? `Question #${questionNumber}`
                            : isElementSection ? `Section #${sectionNumber}`
                            : isElementLayout ? `${element.type} Block`
                            : 'Logic Block'}
                        </span>
                        {element.hidden && <Badge variant="secondary" className="ml-2 h-5 text-[8px] font-bold uppercase">Hidden</Badge>}
                    </div>
                    <div className="flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-all ml-auto">
                        <TooltipProvider>
                            {/* Formatting and Level Controls Group */}
                            {(isElementQuestion || (isElementLayout && ['heading', 'description'].includes(element.type))) && (
                                <div className="flex items-center">
                                    <FormattingToolbar 
                                        fieldName={isElementQuestion ? `elements.${index}.title` : element.type === 'heading' ? `elements.${index}.title` : `elements.${index}.text`}
                                        alignValue={element.style?.textAlign}
                                        onAlignChange={(val) => setValue(`elements.${index}.style.textAlign`, val, { shouldDirty: true })}
                                        minimal
                                    />
                                    {element.type === 'heading' && (
                                        <>
                                            <Separator orientation="vertical" className="h-4 mx-1" />
                                            <Select 
                                                value={element.variant || 'h2'} 
                                                onValueChange={(val) => setValue(`elements.${index}.variant`, val, { shouldDirty: true })}
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
                            {isElementQuestion && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon" 
                                            className={cn("h-8 w-8 rounded-lg transition-all", element.isRequired ? "text-primary bg-primary/10 shadow-inner" : "text-muted-foreground")}
                                            onClick={() => toggleRequired(index)}
                                        >
                                            <Asterisk className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Required Field</TooltipContent>
                                </Tooltip>
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => toggleHidden(index)}>
                                        {element.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{element.hidden ? 'Show Block' : 'Hide Block'}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => duplicateElement(index)}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Duplicate</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={index === 0} onClick={() => swap(index, index - 1)} >
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Move Up</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={getValues('elements').length - 1 === index} onClick={() => swap(index, index + 1)} >
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Move Down</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => remove(index)} disabled={isElementSection && index === 0}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-2">
                                    <QuestionSettingsPopover
                                        element={element}
                                        index={index}
                                        changeType={changeElementType}
                                    />
                                </PopoverContent>
                            </Popover>
                        </TooltipProvider>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                 {isElementQuestion ? (
                    <div className="grid grid-cols-1 gap-y-8">
                        <div className="space-y-2">
                            <Controller 
                                name={`elements.${index}.title`} 
                                control={control} 
                                render={({ field }) => (
                                    <RichTextEditor 
                                        value={field.value} 
                                        onChange={field.onChange} 
                                        placeholder="e.g., What is your favorite color?" 
                                        textAlign={element.style?.textAlign}
                                        className={cn(
                                            "text-lg font-bold min-h-[1.5em] focus:ring-0 px-1 py-1 transition-all",
                                            elementErrors?.title && "text-destructive underline decoration-dotted"
                                        )}
                                    />
                                )} 
                            />
                            {elementErrors?.title && <FormMessage>{elementErrors.title.message}</FormMessage>}
                        </div>
                        <div className="space-y-3">
                             <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 block ml-1">
                                {(element.type === 'text' || element.type === 'long-text') ? 'Placeholder' : 'Default Value'}
                             </Label>
                             
                             {(element.type !== 'multiple-choice' && element.type !== 'checkboxes' && element.type !== 'dropdown') ? (
                                 <div className="bg-primary/10 p-4 rounded-2xl border-2 border-primary/20 shadow-inner">
                                    <Controller
                                        name={`elements.${index}.${(element.type === 'text' || element.type === 'long-text') ? 'placeholder' : 'defaultValue'}`}
                                        control={control}
                                        render={({ field }) => {
                                            switch(element.type) {
                                                case 'text':
                                                    return <Input {...field} value={field.value || ''} placeholder={question.placeholder || "Type your answer here..."} className="bg-muted/20 border-none shadow-none h-11 text-base placeholder:italic placeholder:text-muted-foreground/40 rounded-xl px-4 focus-visible:ring-1 focus-visible:ring-primary/20" />;
                                                case 'long-text':
                                                    return <Textarea {...field} value={field.value || ''} placeholder={question.placeholder || "Share your thoughts..."} className="bg-muted/20 border-none shadow-none min-h-[100px] text-base placeholder:italic placeholder:text-muted-foreground/40 rounded-xl p-4 resize-none focus-visible:ring-1 focus-visible:ring-primary/20" />;
                                                case 'yes-no':
                                                    return (
                                                        <div className="space-y-4">
                                                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                                                <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" /><Label className="font-bold">Yes</Label></div>
                                                                <div className="flex items-center space-x-2"><RadioGroupItem value="No" /><Label className="font-bold">No</Label></div>
                                                            </RadioGroup>
                                                            {enableScoring && (
                                                                <div className="flex gap-4 items-center rounded-xl border border-primary/20 bg-muted/20 p-4 shadow-xs mt-4">
                                                                    <FormItem className="flex-1">
                                                                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Score for "Yes"</FormLabel>
                                                                        <Controller name={`elements.${index}.yesScore`} control={control} defaultValue={0} render={({field: scoreField}) => <Input type="number" {...scoreField} value={scoreField.value ?? ''} onChange={e => scoreField.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))} className="h-9 font-bold bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20" />} />
                                                                    </FormItem>
                                                                    <FormItem className="flex-1">
                                                                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Score for "No"</FormLabel>
                                                                        <Controller name={`elements.${index}.noScore`} control={control} defaultValue={0} render={({field: scoreField}) => <Input type="number" {...scoreField} value={scoreField.value ?? ''} onChange={e => scoreField.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))} className="h-9 font-bold bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20" />} />
                                                                    </FormItem>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                case 'rating':
                                                    return <StarRatingInput value={field.value || 0} onChange={field.onChange} />;
                                                case 'date':
                                                    return <DatePicker value={field.value} onChange={field.onChange} />;
                                                case 'time':
                                                    return <Input type="time" step="1" className="w-full sm:w-fit bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 text-base h-11 font-bold rounded-xl px-4" {...field} value={field.value || ''} />;
                                                case 'file-upload':
                                                    return (
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border-2 border-dashed border-primary/20 rounded-xl h-12 w-full bg-muted/20">
                                                            <Upload className="w-4 h-4 text-primary" />
                                                            <span className="font-bold">File Upload Field</span>
                                                        </div>
                                                    );
                                                default:
                                                    return null;
                                            }
                                        }}
                                    />
                                 </div>
                             ): (
                                <div className="bg-primary/10 p-6 rounded-2xl border-2 border-primary/20 shadow-inner">
                                    <OptionsEditor questionIndex={index} />
                                </div>
                            )}
                             {elementErrors?.options && <FormMessage className="mt-2 ml-1">{elementErrors.options.message}</FormMessage>}
                        </div>
                        <div className="flex items-center gap-6 pt-6 border-t border-border/50">
                            {isAutoAdvanceable && (
                                <div className="flex items-center gap-2.5">
                                    <Controller 
                                        name={`elements.${index}.autoAdvance`} 
                                        control={control} 
                                        render={({ field }) => (
                                            <Switch id={`auto-advance-${index}`} checked={!!field.value} onCheckedChange={field.onChange} />
                                        )} 
                                    />
                                    <Label htmlFor={`auto-advance-${index}`} className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" /> Auto-advance</Label>
                                </div>
                            )}
                            {isScoreable && (
                                <div className="flex items-center gap-2.5">
                                    <Controller name={`elements.${index}.enableScoring`} control={control} render={({ field }) => <Switch id={`scoring-${index}`} checked={!!field.value} onCheckedChange={field.onChange} />} />
                                    <Label htmlFor={`scoring-${index}`} className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><TrophyIcon className="h-3.5 w-3.5 text-yellow-500" /> Enable Scoring</Label>
                                </div>
                            )}
                        </div>
                    </div>
                ) : isElementLayout ? (
                     <div className={cn(isMediaLayout && "bg-primary/10 rounded-2xl border-2 border-primary/20 p-6")}>
                        {element.type === 'section' && (
                             <div className="w-full text-center space-y-6 p-8 border-2 border-primary/20 rounded-[2.5rem] bg-primary/10 shadow-inner">
                                 <div className="space-y-4">
                                     <div className="flex items-center gap-4">
                                         <div className="flex-grow h-px bg-primary/20" />
                                         <div className="w-full max-w-2xl mx-auto">
                                            <Controller 
                                                name={`elements.${index}.title`} 
                                                control={control} 
                                                render={({ field }) => (
                                                    <RichTextEditor 
                                                        value={field.value} 
                                                        onChange={field.onChange} 
                                                        placeholder="Enter Section Title..." 
                                                        textAlign="center"
                                                        className="text-2xl sm:text-3xl font-black text-foreground min-h-[1.2em] leading-tight"
                                                    />
                                                )} 
                                            />
                                         </div>
                                         <div className="flex-grow h-px bg-primary/20" />
                                     </div>
                                     <div className="w-full max-w-2xl mx-auto">
                                        <Controller 
                                            name={`elements.${index}.description`} 
                                            control={control} 
                                            render={({ field }) => (
                                                <RichTextEditor 
                                                    value={field.value} 
                                                    onChange={field.onChange} 
                                                    placeholder="Section description (optional)..." 
                                                    textAlign="center"
                                                    className="text-muted-foreground text-base sm:text-lg font-medium italic min-h-[1.5em] leading-relaxed whitespace-pre-wrap"
                                                />
                                            )} 
                                        />
                                     </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-end pt-8 border-t border-primary/20">
                                    <div className="space-y-4 bg-muted/20 rounded-xl p-4 shadow-xs border border-primary/10">
                                        <div className="flex justify-between items-center gap-3">
                                            <Controller 
                                                name={`elements.${index}.renderAsPage`} 
                                                control={control} 
                                                render={({ field }) => (
                                                    <Switch 
                                                        checked={!!field.value} 
                                                        onCheckedChange={field.onChange} 
                                                        id={`render-as-page-${index}`} 
                                                    />
                                                )} 
                                            />
                                            <Label htmlFor={`render-as-page-${index}`} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">New Page Break</Label>
                                        </div>
                                        <div className="flex justify-between items-center gap-3 pt-2 border-t border-primary/10">
                                            <Controller 
                                                name={`elements.${index}.validateBeforeNext`} 
                                                control={control} 
                                                render={({ field }) => (
                                                    <Switch 
                                                        checked={!!field.value} 
                                                        onCheckedChange={field.onChange} 
                                                        id={`validate-before-next-${index}`} 
                                                    />
                                                )} 
                                            />
                                            <Label htmlFor={`validate-before-next-${index}`} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Validate before next</Label>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-left">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Stepper Navigation Label</Label>
                                        <Controller 
                                            name={`elements.${index}.stepperTitle`} 
                                            control={control} 
                                            render={({ field }) => (
                                                <Input 
                                                    {...field} 
                                                    value={field.value ?? ''} 
                                                    placeholder="e.g., Company Details" 
                                                    className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-bold px-4 transition-all" 
                                                />
                                            )} 
                                        />
                                    </div>
                                </div>
                             </div>
                         )}
                        {element.type === 'heading' && (
                            <div className="space-y-4">
                                <Controller 
                                    name={`elements.${index}.title`} 
                                    control={control} 
                                    render={({ field }) => (
                                        <RichTextEditor 
                                            value={field.value} 
                                            onChange={field.onChange} 
                                            placeholder="Heading Text" 
                                            textAlign={element.style?.textAlign}
                                            className={cn(
                                                "font-black leading-tight whitespace-pre-wrap",
                                                element.variant === 'h1' ? "text-3xl sm:text-4xl" : element.variant === 'h3' ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl"
                                            )} 
                                        />
                                    )} 
                                />
                            </div>
                        )}
                        {element.type === 'description' && (
                            <div className="space-y-2">
                                <Controller 
                                    name={`elements.${index}.text`} 
                                    control={control} 
                                    render={({ field }) => (
                                        <RichTextEditor 
                                            value={field.value} 
                                            onChange={field.onChange} 
                                            placeholder="Description text..." 
                                            textAlign={element.style?.textAlign}
                                            className="text-base sm:text-lg leading-relaxed text-muted-foreground min-h-[1.5em] whitespace-pre-wrap" 
                                        />
                                    )} 
                                />
                            </div>
                        )}
                        {element.type === 'divider' && <hr className="my-4 border-border/50" />}
                        
                        {(element.type === 'image' || element.type === 'video' || element.type === 'audio' || element.type === 'document') && (
                            <Controller
                                name={`elements.${index}.url`}
                                control={control}
                                render={({ field }) => <MediaLayoutEditor element={element} field={field} />}
                            />
                        )}
                        {element.type === 'embed' && (
                            <Controller name={`elements.${index}.html`} control={control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Embed HTML Code</FormLabel>
                                    <Textarea {...field} value={field.value ?? ''} placeholder="<p>Paste your HTML code here</p>" className="font-mono bg-muted/20 rounded-xl border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 min-h-[120px] resize-none" />
                                </FormItem>
                            )} />
                        )}
                    </div>
                ) : (
                    <LogicBlockEditor elementIndex={index} />
                )}
            </CardContent>
        </Card>
        <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20 cursor-pointer p-2 bg-card border rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-lg"
            onClick={() => requestAddElement(index)}
        >
            <PlusCircle className="h-5 w-5 text-primary" />
        </div>
    </div>
  );
}

export default function QuestionEditor({ fields, remove, move, swap, insert, requestAddElement }: {
    fields: any[];
    remove: (index: number) => void;
    move: (from: number, to: number) => void;
    swap: (indexA: number, indexB: number) => void;
    insert: (index: number, value: SurveyElement) => void;
    requestAddElement: (index: number) => void;
}) {
  const { formState: { errors } } = useFormContext();
  const formErrors = errors.elements as any[] | undefined;
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((field) => field.id === active.id);
      const newIndex = fields.findIndex((field) => field.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
          move(oldIndex, newIndex);
      }
    }
  }

  return (
    <div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-8">
                    {fields.map((field, index) => (
                        <SortableSurveyElement 
                            key={field.id} 
                            id={field.id} 
                            index={index} 
                            remove={remove} 
                            swap={swap} 
                            insert={insert}
                            requestAddElement={requestAddElement}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
        <div className="mt-6">
            {formErrors && typeof formErrors === 'object' && 'message' in formErrors && (
                <FormMessage className="text-sm font-bold bg-destructive/10 p-3 rounded-lg flex items-center gap-2">
                    <X className="h-4 w-4" />
                    {(formErrors as any).message}
                </FormMessage>
            )}
        </div>
    </div>
  );
}
