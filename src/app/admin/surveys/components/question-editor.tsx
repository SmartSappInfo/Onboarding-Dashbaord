
'use client';

import { useFieldArray, useFormContext, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, PlusCircle, ArrowUp, ArrowDown, Bot, Check, ChevronsUpDown, X, MoreVertical, Copy, EyeOff, CheckSquare, Square, Type, GitBranch, CalendarIcon, Star } from 'lucide-react';
import type { SurveyElement, SurveyQuestion } from '@/lib/types';
import * as React from 'react';
import { FormMessage, FormItem, FormLabel } from '@/components/ui/form';
import AddElementModal from './add-element-modal';
import { MediaSelect } from '../../schools/components/media-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

function isQuestion(element: SurveyElement): element is SurveyQuestion {
    return 'isRequired' in element;
}


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
          className="w-full justify-between h-auto"
        >
          <div className="flex gap-1 flex-wrap">
            {selectedValues.size > 0 ? (
                options.filter(opt => selectedValues.has(opt.value)).map(option => (
                    <Badge
                        variant="secondary"
                        key={option.value}
                        className="mr-1 mb-1"
                        onClick={() => {
                            const newSelection = Array.from(selectedValues).filter(v => v !== option.value);
                            onChange(newSelection);
                        }}
                    >
                        {option.label}
                        <X className="ml-1 h-3 w-3" />
                    </Badge>
                ))
            ) : (
              <span>{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
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
  const { control, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `elements.${questionIndex}.options`,
  });
  
  const questionType = watch(`elements.${questionIndex}.type`);

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-background">
      <Label>Options</Label>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <Controller
            name={`elements.${questionIndex}.options.${index}`}
            control={control}
            render={({ field }) => <Input {...field} placeholder={`Option ${index + 1}`} />}
          />
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => remove(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
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
                        onCheckedChange={field.onChange}
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
                const prefix = isQuestion(el) ? `Q${idx + 1}` : (el.type.charAt(0).toUpperCase() + el.type.slice(1));
                const label = el.title ? `${prefix}: ${el.title}` : `${prefix}: ${el.id}`;
                return { value: el.id, label: label.length > 50 ? label.substring(0, 50) + '...' : label };
            });
    }

    const getJumpTargets = () => {
        return allElements
            .slice(elementIndex + 1)
            .map((el, idx) => ({ el, originalIndex: elementIndex + 1 + idx }))
            .filter(({ el }) => isQuestion(el) || el.type === 'heading')
            .map(({ el, originalIndex }) => ({
                value: el.id,
                label: isQuestion(el)
                    ? `Q${originalIndex + 1}: ${el.title}`
                    : `Section: ${el.title}`
            }))
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
                              Q{allElements.findIndex(el => el.id === q.id) + 1}: {q.title}
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

const ResponseControlPreview = ({ question, index, control }: { question: SurveyQuestion; index: number; control: any }) => {
    switch (question.type) {
        case 'text':
            return <Controller name={`elements.${index}.placeholder`} control={control} render={({ field }) => <Input {...field} placeholder="Placeholder text..." />} />;
        case 'long-text':
            return <Controller name={`elements.${index}.placeholder`} control={control} render={({ field }) => <Textarea {...field} placeholder="Placeholder text..." />} />;
        case 'yes-no':
            return <RadioGroup disabled className="flex gap-4"><div className="flex items-center space-x-2"><RadioGroupItem value="Yes" /><Label>Yes</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="No" /><Label>No</Label></div></RadioGroup>;
        case 'multiple-choice':
            return <RadioGroup disabled className="space-y-2">{question.options?.map(opt => <div key={opt} className="flex items-center space-x-2"><RadioGroupItem value={opt} /><Label>{opt}</Label></div>)}</RadioGroup>;
        case 'checkboxes':
            return <div className="space-y-2">{question.options?.map(opt => <div key={opt} className="flex items-start space-x-2"><Checkbox disabled /><Label className="font-normal">{opt}</Label></div>)}{question.allowOther && <div className="flex items-start space-x-2 pt-2"><Checkbox disabled /><Input disabled placeholder="Other (please specify)" className="h-8 flex-1" /></div>}</div>
        case 'dropdown':
            return <Select disabled><SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger></Select>;
        case 'rating':
            return <StarRatingInput value={0} onChange={() => {}} disabled />;
        case 'date':
            return <Button variant="outline" disabled className="w-[280px] justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" /><span>Pick a date</span></Button>;
        case 'time':
            return <Input type="time" disabled className="w-fit" />;
        default:
            return null;
    }
}

const SetDefaultValueDialog = ({ question, index, open, onOpenChange }: { question: SurveyQuestion; index: number; open: boolean; onOpenChange: (open: boolean) => void }) => {
    const { control, getValues, setValue } = useFormContext();
    const [currentValue, setCurrentValue] = React.useState(getValues(`elements.${index}.defaultValue`));

    React.useEffect(() => {
        setCurrentValue(getValues(`elements.${index}.defaultValue`));
    }, [open, getValues, index]);

    const handleSave = () => {
        setValue(`elements.${index}.defaultValue`, currentValue);
        onOpenChange(false);
    }
    
    const renderInput = () => {
        switch(question.type) {
            case 'text':
            case 'long-text':
                return <Input value={currentValue || ''} onChange={(e) => setCurrentValue(e.target.value)} />
            case 'yes-no':
                return <RadioGroup onValueChange={setCurrentValue} value={currentValue} className="flex gap-4"><div className="flex items-center space-x-2"><RadioGroupItem value="Yes" /><Label>Yes</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="No" /><Label>No</Label></div></RadioGroup>;
            case 'multiple-choice':
            case 'dropdown':
                 return <RadioGroup onValueChange={setCurrentValue} value={currentValue}>{question.options?.map(opt => <div key={opt} className="flex items-center space-x-2"><RadioGroupItem value={opt} /><Label>{opt}</Label></div>)}</RadioGroup>;
            case 'checkboxes':
                return <p className="text-sm text-muted-foreground">Default values for checkboxes are not supported yet.</p>; // To be implemented
            case 'rating':
                return <StarRatingInput value={currentValue || 0} onChange={setCurrentValue} />;
            case 'date':
                return <Input type="date" value={currentValue ? format(new Date(currentValue), 'yyyy-MM-dd') : ''} onChange={(e) => setCurrentValue(e.target.value ? new Date(e.target.value).toISOString() : undefined)} />;
            case 'time':
                return <Input type="time" value={currentValue || ''} onChange={(e) => setCurrentValue(e.target.value)} />;
            default:
                return <p>This question type does not support default values.</p>
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Set Default Answer for "{question.title}"</DialogTitle>
                    <DialogDescription>This value will be pre-filled for users taking the survey.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {renderInput()}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save Default</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function QuestionEditor() {
  const { control, watch, setValue, formState: { errors } } = useFormContext();
  const { fields, append, remove, swap, insert } = useFieldArray({
    control,
    name: 'elements',
  });
  
  const [isAddElementModalOpen, setIsAddElementModalOpen] = React.useState(false);
  const [defaultingElement, setDefaultingElement] = React.useState<number | null>(null);

  const elements = watch('elements');

  const addElement = (type: SurveyElement['type']) => {
    const newElement: Partial<SurveyElement> = {
      id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
    };

    if (isQuestion(newElement as SurveyElement)) {
        (newElement as SurveyQuestion).title = '';
        (newElement as SurveyQuestion).isRequired = false;
        (newElement as SurveyQuestion).hidden = false;
        if (type === 'multiple-choice' || type === 'checkboxes' || type === 'dropdown') {
            (newElement as SurveyQuestion).options = ['Option 1', 'Option 2'];
        }
        if (type === 'checkboxes') {
            (newElement as SurveyQuestion).allowOther = false;
        }
    } else if (type === 'logic') {
        (newElement as any).rules = [];
    } else {
        if(type === 'heading') (newElement as any).title = 'New Section';
        if(type === 'description') (newElement as any).text = 'Descriptive text goes here.';
        if(type === 'embed') (newElement as any).html = '<!-- Paste your HTML code here -->';
        if(['image', 'video', 'audio', 'document'].includes(type)) (newElement as any).url = '';
    }
    
    append(newElement);
  };
  
  const duplicateElement = (index: number) => {
    const elementToDuplicate = fields[index];
    const newElement = {
        ...JSON.parse(JSON.stringify(elementToDuplicate)),
        id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    insert(index + 1, newElement);
  };

  const formErrors = errors.elements as any[] | undefined;

  const getMediaFilterType = (type: SurveyElement['type']): 'image' | 'video' | 'audio' | 'document' | undefined => {
      if (type === 'image') return 'image';
      if (type === 'video') return 'video';
      if (type === 'audio') return 'audio';
      if (type === 'document') return 'document';
      return undefined;
  }
  
  const questionTypes: { type: SurveyQuestion['type'], label: string }[] = [
    { type: 'text', label: 'Short Text'},
    { type: 'long-text', label: 'Long Text'},
    { type: 'yes-no', label: 'Yes/No'},
    { type: 'multiple-choice', label: 'Multiple Choice'},
    { type: 'checkboxes', label: 'Checkboxes'},
    { type: 'dropdown', label: 'Dropdown'},
    { type: 'rating', label: 'Rating'},
    { type: 'date', label: 'Date'},
    { type: 'time', label: 'Time'},
    { type: 'file-upload', label: 'File Upload'},
  ];

  return (
    <div className="space-y-6">
      {fields.map((field, index) => {
        const element = elements[index];
        const elementErrors = formErrors?.[index] as Record<string, { message: string }> | undefined;
        
        const isElementQuestion = isQuestion(element);

        return (
            <Card key={field.id} className="relative bg-muted/30 border-2 border-transparent has-[:focus-within]:border-primary transition-colors group">
            <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === 0}
                    onClick={() => swap(index, index - 1)}
                >
                    <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === fields.length - 1}
                    onClick={() => swap(index, index + 1)}
                >
                    <ArrowDown className="h-4 w-4" />
                </Button>
                
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                       {isElementQuestion && (
                        <>
                            <DropdownMenuCheckboxItem
                                checked={element.isRequired}
                                onCheckedChange={(checked) => setValue(`elements.${index}.isRequired`, checked)}
                            >
                                <CheckSquare className="mr-2 h-4 w-4" />
                                <span>Required</span>
                            </DropdownMenuCheckboxItem>
                             <DropdownMenuItem onSelect={() => setDefaultingElement(index)}>
                                Set Default Answer...
                             </DropdownMenuItem>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <Type className="mr-2 h-4 w-4" />
                                    <span>Turn into</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent>
                                        <DropdownMenuRadioGroup value={element.type} onValueChange={(type) => setValue(`elements.${index}.type`, type)}>
                                            {questionTypes.map(qType => (
                                                <DropdownMenuRadioItem key={qType.type} value={qType.type} disabled={qType.type === 'file-upload'}>
                                                    {qType.label} {qType.type === 'file-upload' && '(soon)'}
                                                </DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                        </>
                       )}
                        <DropdownMenuCheckboxItem
                            checked={element.hidden}
                            onCheckedChange={(checked) => setValue(`elements.${index}.hidden`, checked)}
                        >
                            <EyeOff className="mr-2 h-4 w-4" />
                            <span>Hide by default</span>
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuItem onClick={() => duplicateElement(index)}>
                            <Copy className="mr-2 h-4 w-4" />
                            <span>Duplicate</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                 <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => remove(index)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
            <CardHeader>
                <CardTitle className="text-lg">
                    {isElementQuestion ? `Question #${index + 1}` : element.type === 'logic' ? 'Logic Block' : `Layout Block`}
                </CardTitle>
                <CardDescription className="capitalize">{element.type.replace('-', ' ')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {isElementQuestion ? (
                    <>
                        <div className="space-y-2">
                             <Label>Question Text</Label>
                             <Controller name={`elements.${index}.title`} control={control} render={({ field }) => <Input {...field} placeholder="e.g., What is your favorite color?" />} />
                             {elementErrors?.title && <FormMessage>{elementErrors.title.message}</FormMessage>}
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">Response Preview</Label>
                            <div className="p-4 border rounded-lg bg-background">
                                <ResponseControlPreview question={element} index={index} control={control} />
                            </div>
                        </div>

                         {(element.type === 'multiple-choice' || element.type === 'checkboxes' || element.type === 'dropdown') && (
                            <div>
                                <OptionsEditor questionIndex={index} />
                                {elementErrors?.options && <FormMessage className="mt-2">{elementErrors.options.message}</FormMessage>}
                            </div>
                         )}
                    </>
                ) : element.type === 'logic' ? (
                     <LogicBlockEditor elementIndex={index} />
                ) : (
                    <>
                        {element.type === 'heading' && <Controller name={`elements.${index}.title`} control={control} render={({ field }) => <FormItem><FormLabel>Heading Text</FormLabel><Input {...field} /></FormItem>} />}
                        {element.type === 'description' && <Controller name={`elements.${index}.text`} control={control} render={({ field }) => <FormItem><FormLabel>Description Text</FormLabel><Textarea {...field} /></FormItem>} />}
                        {element.type === 'divider' && <hr className="border-border" />}
                        {(element.type === 'image' || element.type === 'video' || element.type === 'audio' || element.type === 'document') && (
                             <Controller name={`elements.${index}.url`} control={control} render={({ field }) => <FormItem><FormLabel>{element.type.charAt(0).toUpperCase() + element.type.slice(1)} URL</FormLabel><MediaSelect {...field} filterType={getMediaFilterType(element.type)}/></FormItem>} />
                        )}
                        {element.type === 'embed' && <Controller name={`elements.${index}.html`} control={control} render={({ field }) => <FormItem><FormLabel>Embed HTML</FormLabel><Textarea {...field} placeholder="<p>Paste your HTML code here</p>" className="font-mono" /></FormItem>} />}
                    </>
                )}
            </CardContent>
            </Card>
        )
      })}

      {formErrors && typeof formErrors === 'object' && 'message' in formErrors && (
          <FormMessage>{(formErrors as any).message}</FormMessage>
      )}

      <Button type="button" variant="outline" onClick={() => setIsAddElementModalOpen(true)}>
        <PlusCircle className="mr-2 h-4 w-4" />
        Add Element
      </Button>
      
      <AddElementModal 
        open={isAddElementModalOpen}
        onOpenChange={setIsAddElementModalOpen}
        onSelect={addElement}
      />
      
      {defaultingElement !== null && elements[defaultingElement] && isQuestion(elements[defaultingElement]) && (
        <SetDefaultValueDialog
            open={defaultingElement !== null}
            onOpenChange={(open) => !open && setDefaultingElement(null)}
            question={elements[defaultingElement]}
            index={defaultingElement}
        />
      )}
    </div>
  );
}

    