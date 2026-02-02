
'use client';

import { useFieldArray, useFormContext, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, PlusCircle, ArrowUp, ArrowDown, GripVertical, Bot } from 'lucide-react';
import type { SurveyElement, SurveyQuestion } from '@/lib/types';
import * as React from 'react';
import { FormMessage, FormItem, FormLabel } from '@/components/ui/form';
import AddElementModal from './add-element-modal';
import { MediaSelect } from '../../schools/components/media-select';

function isQuestion(element: SurveyElement): element is SurveyQuestion {
    return 'isRequired' in element;
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

  const potentialTargetElements = allElements.filter(
    (el, idx) => (isQuestion(el) || el.type === 'heading') && idx > elementIndex
  );

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
      {fields.map((field, index) => {
        const operator = watch(`elements.${elementIndex}.rules.${index}.operator`);
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
                <div className="flex-grow flex items-center gap-2">
                    <Controller
                        name={`elements.${elementIndex}.rules.${index}.action`}
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="w-1/2"><SelectValue placeholder="Action..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="jump">Jump To</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                    <Controller
                        name={`elements.${elementIndex}.rules.${index}.targetElementId`}
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Target element..." /></SelectTrigger>
                                <SelectContent>
                                {potentialTargetElements.map((el) => (
                                        <SelectItem key={el.id} value={el.id}>
                                            {isQuestion(el) ? `Q${allElements.findIndex(e => e.id === el.id) + 1}: ${el.title}` : `Section: ${el.title}`}
                                        </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            </div>
            </div>
        );
      })}
       <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ sourceQuestionId: '', operator: 'isEqualTo', targetValue: '', action: 'jump', targetElementId: '' })}
      >
        Add Rule
      </Button>
    </div>
  );
}


export default function QuestionEditor() {
  const { control, watch, formState: { errors } } = useFormContext();
  const { fields, append, remove, swap } = useFieldArray({
    control,
    name: 'elements',
  });
  
  const [isAddElementModalOpen, setIsAddElementModalOpen] = React.useState(false);

  const elements = watch('elements');

  const addElement = (type: SurveyElement['type']) => {
    const newElement: SurveyElement = {
      id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
    } as any; // Cast to any to build the object

    if (isQuestion(newElement)) {
        (newElement as SurveyQuestion).title = '';
        (newElement as SurveyQuestion).isRequired = true;
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
  
  const formErrors = errors.elements as any[] | undefined;

  const getMediaFilterType = (type: SurveyElement['type']): 'image' | 'video' | 'audio' | 'document' | undefined => {
      if (type === 'image') return 'image';
      if (type === 'video') return 'video';
      if (type === 'audio') return 'audio';
      if (type === 'document') return 'document';
      return undefined;
  }

  return (
    <div className="space-y-6">
      {fields.map((field, index) => {
        const element = elements[index];
        const elementErrors = formErrors?.[index] as Record<string, { message: string }> | undefined;
        
        const isElementQuestion = isQuestion(element);

        return (
            <Card key={field.id} className="relative bg-muted/30 border-2 border-transparent has-[:focus]:border-primary transition-colors group">
            <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-grab active:cursor-grabbing"
                    disabled
                >
                    <GripVertical className="h-4 w-4" />
                </Button>
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
                <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <Label>Question Type</Label>
                                <Controller
                                    name={`elements.${index}.type`}
                                    control={control}
                                    render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="text">Short Text</SelectItem>
                                        <SelectItem value="long-text">Long Text (Paragraph)</SelectItem>
                                        <SelectItem value="yes-no">Yes/No</SelectItem>
                                        <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                                        <SelectItem value="checkboxes">Checkboxes</SelectItem>
                                        <SelectItem value="dropdown">Dropdown</SelectItem>
                                        <SelectItem value="rating">Rating (1-5)</SelectItem>
                                        <SelectItem value="date">Date</SelectItem>
                                        <SelectItem value="time">Time</SelectItem>
                                        <SelectItem value="file-upload" disabled>File Upload (Soon)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    )}
                                />
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-3 bg-background">
                                <Label>Required</Label>
                                <Controller name={`elements.${index}.isRequired`} control={control} render={({ field }) => ( <Switch checked={field.value} onCheckedChange={field.onChange} /> )} />
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
    </div>
  );
}

    