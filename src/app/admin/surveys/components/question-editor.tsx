
'use client';

import { useFormContext, Controller, get } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, PlusCircle, ArrowUp, ArrowDown, Bot, Check, ChevronsUpDown, X, Star, Clock, Upload, Pilcrow, Baseline, CheckCircle2, ListChecks, ChevronDownSquare, CheckCircle, Type, Copy, Eye, EyeOff, Heading1, Image as ImageIcon, Video as VideoIcon, AudioWaveform, FileText, Code, Minus, Text as TextIcon, MoreVertical, Calendar as CalendarIcon, GripVertical, Layers } from 'lucide-react';
import type { SurveyElement, SurveyQuestion, SurveyLayoutBlock, MediaAsset } from '@/lib/types';
import * as React from 'react';
import { FormMessage, FormItem, FormLabel } from '@/components/ui/form';
import { useFieldArray } from 'react-hook-form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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
import { MediaSelect } from '../../schools/components/media-select';

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
                <div className="relative group/media-preview rounded-lg border overflow-hidden">
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
                    className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
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
          className="w-full justify-between h-auto min-h-10"
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
              <span>{placeholder}</span>
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
  const { control, watch, setValue } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `elements.${questionIndex}.options`,
  });

  const questionType = watch(`elements.${questionIndex}.type`);
  const defaultValue = watch(`elements.${questionIndex}.defaultValue`);
  const allowOther = watch(`elements.${questionIndex}.allowOther`);

  const handleDefaultChange = (newValue: any) => {
    setValue(`elements.${questionIndex}.defaultValue`, newValue, { shouldDirty: true, shouldValidate: true });
  }

  return (
    <div className="space-y-3">
      <Label>Options</Label>
      {(questionType === 'multiple-choice' || questionType === 'dropdown') && (
        <RadioGroup onValueChange={handleDefaultChange} value={defaultValue}>
          {fields.map((field, index) => {
            const optionValue = watch(`elements.${questionIndex}.options.${index}`);
            return (
              <div key={field.id} className="flex items-center gap-2">
                <RadioGroupItem value={optionValue} id={`${field.id}-radio`} />
                <Controller
                  name={`elements.${questionIndex}.options.${index}`}
                  control={control}
                  render={({ field }) => <Input {...field} placeholder={`Option ${index + 1}`} />}
                />
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4" />
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
                <Controller
                  name={`elements.${questionIndex}.options.${index}`}
                  control={control}
                  render={({ field }) => <Input {...field} placeholder={`Option ${index + 1}`} />}
                />
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={() => append('')}>
        Add Option
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
                    // from string[] to { options: string[], other: '' }
                    const currentArray = Array.isArray(defaultValue) ? defaultValue : [];
                    handleDefaultChange({ options: currentArray, other: '' });
                  } else {
                    // from { options: string[] } to string[]
                    const currentOptions = defaultValue?.options || [];
                    handleDefaultChange(currentOptions);
                  }
                }}
              />
            )}
          />
          <Label htmlFor={`allowOther-${questionIndex}`}>Allow "Other" option</Label>
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
                return { value: el.id, label: label.length > 50 ? label.substring(0, 50) + '...' : label, icon: Icon };
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
      <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
        {fields.map((field, index) => {
          const operator = watch(`elements.${elementIndex}.rules.${index}.operator`);
          const actionType = watch(`elements.${elementIndex}.rules.${index}.action.type`);
          const showValueInput = operator !== 'isEmpty' && operator !== 'isNotEmpty';
  
          return (
              <div key={field.id} className="p-4 border rounded-md bg-background relative">
              <div className="absolute top-2 right-2">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4" />
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
                          <SelectTrigger><SelectValue placeholder="Select a question..." /></SelectTrigger>
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
                          <SelectTrigger className="w-1/2"><SelectValue placeholder="Operator..." /></SelectTrigger>
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
                          render={({ field }) => <Input {...field} placeholder="Value..." />}
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
                  <div className="flex-grow flex flex-col sm:flex-row items-center gap-2">
                      <Controller
                          name={`elements.${elementIndex}.rules.${index}.action.type`}
                          control={control}
                          render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger className="w-full sm:w-1/2"><SelectValue placeholder="Action..." /></SelectTrigger>
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
                                      <SelectTrigger><SelectValue placeholder="Target element..." /></SelectTrigger>
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
        >
          Add Rule
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
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateValue && "text-muted-foreground")} disabled={disabled}>
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
    
    // Local state to manage UI toggles
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
            {isElemQuestion && (
                <div className="space-y-4">
                    <h4 className="font-semibold text-muted-foreground text-sm px-1">Validation</h4>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor={`required-toggle-${index}`}>Required question</Label>
                        <Controller name={`elements.${index}.isRequired`} control={control} render={({ field }) => <Switch id={`required-toggle-${index}`} checked={field.value} onCheckedChange={field.onChange} />} />
                    </div>
                    {isTextQuestion && (
                        <>
                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <Label htmlFor={`min-chars-toggle-${index}`}>Min characters</Label>
                                <Switch id={`min-chars-toggle-${index}`} checked={useMin} onCheckedChange={(val) => handleToggle(setUseMin, val, 'minLength')} />
                            </div>
                            {useMin && <Controller name={`elements.${index}.minLength`} control={control} render={({ field }) => <Input type="number" {...field} placeholder="e.g., 10" onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}/>} />}

                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <Label htmlFor={`max-chars-toggle-${index}`}>Max characters</Label>
                                <Switch id={`max-chars-toggle-${index}`} checked={useMax} onCheckedChange={(val) => handleToggle(setUseMax, val, 'maxLength')} />
                            </div>
                            {useMax && <Controller name={`elements.${index}.maxLength`} control={control} render={({ field }) => <Input type="number" {...field} placeholder="e.g., 200" onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))} />} />}
                        </>
                    )}
                </div>
            )}
            <div className="space-y-4">
                <h4 className="font-semibold text-muted-foreground text-sm px-1">Content</h4>
                <div className="flex items-center justify-between rounded-lg border p-3">
                   <Label htmlFor={`hidden-toggle-${index}`}>Hidden by default</Label>
                   <Controller name={`elements.${index}.hidden`} control={control} render={({ field }) => <Switch id={`hidden-toggle-${index}`} checked={!!field.value} onCheckedChange={field.onChange} />} />
                </div>
            </div>
            <div className="space-y-4">
                <h4 className="font-semibold text-muted-foreground text-sm px-1">Change To</h4>
                <Select value={element.type} onValueChange={(type: SurveyElement['type']) => changeType(index, type)}>
                    <SelectTrigger><SelectValue placeholder="Turn into..." /></SelectTrigger>
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
  
  if (!element) return null;

  const isElementQuestion = isQuestion(element);
  const isElementLayout = isLayoutBlock(element);
  const isElementSection = element.type === 'section';
  const isMediaLayout = isElementLayout && ['image', 'video', 'audio', 'document', 'embed'].includes(element.type);
  const ElementIcon = getElementIcon(element.type);
  
  return (
    <div ref={setNodeRef} style={style} className="relative group">
        <div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 cursor-grab p-2 bg-card border rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            {...attributes}
            {...listeners}
        >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
        <Card className={cn(
            "border-2 border-transparent has-[:focus-within]:border-primary transition-colors",
            element.hidden ? "bg-disabled" : "bg-card"
        )}>
             <CardHeader className={cn(isMediaLayout && 'p-0 mb-4')}>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {(!isElementLayout || isElementSection) && (
                            <>
                                <ElementIcon className="w-5 h-5" />
                                {isElementQuestion && element.isRequired && <span className="text-destructive font-bold">*</span>}
                                <span>
                                  {isElementQuestion ? `Question #${watch('elements').filter(isQuestion).findIndex((q: SurveyQuestion) => q.id === element.id) + 1}`
                                    : isElementSection ? '' // No text for sections, title is in content
                                    : 'Logic Block'}
                                </span>
                            </>
                        )}
                        {element.hidden && <Badge variant="outline" className="ml-2">Hidden</Badge>}
                    </div>
                    <div className="flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={index === 0} onClick={() => swap(index, index - 1)} >
                            <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={getValues('elements').length - 1 === index} onClick={() => swap(index, index + 1)} >
                            <ArrowDown className="h-4 w-4" />
                        </Button>
                         <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleHidden(index)}>
                            {element.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateElement(index)}>
                            <Copy className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => remove(index)} disabled={isElementSection && index === 0}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
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
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 {isElementQuestion ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 items-start">
                        <div className="space-y-2">
                            <Label>Question Text</Label>
                            <Controller name={`elements.${index}.title`} control={control} render={({ field }) => <Textarea {...field} placeholder="e.g., What is your favorite color?" />} />
                            {elementErrors?.title && <FormMessage>{elementErrors.title.message}</FormMessage>}
                        </div>
                        <div className="space-y-2">
                             <Label>{(element.type === 'text' || element.type === 'long-text') ? 'Placeholder' : 'Default Value'}</Label>
                             
                             {(element.type !== 'multiple-choice' && element.type !== 'checkboxes' && element.type !== 'dropdown') ? (
                                 <Controller
                                    name={`elements.${index}.${(element.type === 'text' || element.type === 'long-text') ? 'placeholder' : 'defaultValue'}`}
                                    control={control}
                                    render={({ field }) => {
                                        switch(element.type) {
                                            case 'text':
                                                return <Input {...field} value={field.value || ''} placeholder="e.g., Type your answer here..." className="placeholder:italic placeholder:text-[#969696]" />;
                                            case 'long-text':
                                                return <Textarea {...field} value={field.value || ''} placeholder="e.g., Share your thoughts..." className="placeholder:italic placeholder:text-[#969696]" />;
                                            case 'yes-no':
                                                return <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" /><Label>Yes</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="No" /><Label>No</Label></div>
                                                </RadioGroup>;
                                            case 'rating':
                                                return <StarRatingInput value={field.value || 0} onChange={field.onChange} />;
                                            case 'date':
                                                return <DatePicker value={field.value} onChange={field.onChange} />;
                                            case 'time':
                                                return <Input type="time" step="1" className="w-fit bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none" {...field} value={field.value || ''} />;
                                            case 'file-upload':
                                                return (
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 border rounded-md border-dashed h-10 w-full">
                                                        <Upload className="w-4 h-4" />
                                                        <span>File Upload Field</span>
                                                    </div>
                                                );
                                            default:
                                                return null;
                                        }
                                    }}
                                />
                             ): (
                                <OptionsEditor questionIndex={index} />
                            )}
                             {element.type !== 'multiple-choice' && element.type !== 'checkboxes' && element.type !== 'dropdown' && elementErrors?.options && <FormMessage className="mt-2">{elementErrors.options.message}</FormMessage>}
                        </div>
                    </div>
                ) : isElementLayout ? (
                     <div className={cn(isMediaLayout && "bg-card rounded-lg border p-4")}>
                        {element.type === 'section' && (
                             <div className="w-full text-center space-y-2 p-4 border rounded-lg bg-muted/50">
                                 <div className="flex items-center gap-2">
                                     <div className="flex-grow h-px bg-border" />
                                     <Controller name={`elements.${index}.title`} control={control} render={({ field }) => <Input {...field} placeholder="Section Title" className="text-xl font-bold border-none shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent w-auto text-center" />} />
                                     <div className="flex-grow h-px bg-border" />
                                 </div>
                                 <Controller name={`elements.${index}.description`} control={control} render={({ field }) => <Textarea {...field} placeholder="Section description (optional)..." className="border-none shadow-none focus-visible:ring-0 p-0 bg-transparent text-center text-muted-foreground min-h-[20px]" />} />
                                <div className="flex justify-center items-center gap-2 pt-2">
                                    <Controller name={`elements.${index}.renderAsPage`} control={control} render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} id={`render-as-page-${index}`} />} />
                                    <Label htmlFor={`render-as-page-${index}`}>Render as a new page</Label>
                                </div>
                             </div>
                         )}
                        {element.type === 'heading' && <Controller name={`elements.${index}.title`} control={control} render={({ field }) => <Input {...field} placeholder="Heading" className="text-2xl font-bold border-none shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent" />} />}
                        {element.type === 'description' && <Controller name={`elements.${index}.text`} control={control} render={({ field }) => <Textarea {...field} placeholder="Description text..." className="border-none shadow-none focus-visible:ring-0 p-0 bg-transparent min-h-[40px]" />} />}
                        {element.type === 'divider' && <hr className="my-4 border-border" />}
                        
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
                                    <FormLabel>Embed HTML</FormLabel>
                                    <Textarea {...field} placeholder="&lt;p&gt;Paste your HTML code here&lt;/p&gt;" className="font-mono bg-background" />
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
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20 cursor-pointer p-2 bg-card border rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => requestAddElement(index)}
        >
            <PlusCircle className="h-5 w-5 text-muted-foreground" />
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
                <div className="space-y-6">
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
                <FormMessage>{(formErrors as any).message}</FormMessage>
            )}
        </div>
    </div>
  );
}
