
'use client';

import { useFieldArray, useFormContext, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, PlusCircle, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import type { SurveyElement, SurveyQuestion } from '@/lib/types';
import * as React from 'react';
import { FormMessage } from '@/components/ui/form';
import AddElementModal from './add-question-modal';
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

function ConditionalLogicEditor({ elementIndex }: { elementIndex: number }) {
  const { control, watch, setValue } = useFormContext();
  const allElements: SurveyElement[] = watch('elements') || [];
  const condition = watch(`elements.${elementIndex}.displayCondition`);
  const parentQuestionId = condition?.questionId;

  const potentialParents = allElements
      .slice(0, elementIndex)
      .filter((el): el is SurveyQuestion => isQuestion(el) && (el.type === 'yes-no' || el.type === 'multiple-choice' || el.type === 'dropdown'));

  const parentQuestion = potentialParents.find(q => q.id === parentQuestionId);

  const handleParentChange = (id: string) => {
    if (id === 'none') {
        setValue(`elements.${elementIndex}.displayCondition`, undefined);
    } else {
        setValue(`elements.${elementIndex}.displayCondition`, { questionId: id, expectedValue: '' });
    }
  }

  if (elementIndex === 0) return null;

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-background">
        <div className="flex justify-between items-center">
             <Label>Conditional Logic</Label>
             <Controller
                name={`elements.${elementIndex}.displayCondition`}
                control={control}
                render={({ field }) => (
                    <Switch
                        checked={!!field.value}
                        onCheckedChange={(checked) => {
                            if (checked) {
                                setValue(`elements.${elementIndex}.displayCondition`, { questionId: '', expectedValue: '' });
                            } else {
                                setValue(`elements.${elementIndex}.displayCondition`, undefined);
                            }
                        }}
                    />
                )}
             />
        </div>
       {condition && (
            <>
                <p className="text-sm text-muted-foreground">Show this element only when...</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label className="text-xs font-normal">...this question...</Label>
                        <Select onValueChange={handleParentChange} value={parentQuestionId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a question..." />
                            </SelectTrigger>
                            <SelectContent>
                                {potentialParents.map((q, i) => (
                                    <SelectItem key={q.id} value={q.id}>
                                        Question #{allElements.findIndex(el => el.id === q.id) + 1}: {q.title.substring(0,20)}...
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {parentQuestion && (
                        <div>
                            <Label className="text-xs font-normal">...has this answer:</Label>
                            <Controller
                                name={`elements.${elementIndex}.displayCondition.expectedValue`}
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select an answer..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(parentQuestion.type === 'yes-no' ? ['Yes', 'No'] : parentQuestion.options || []).map(opt => (
                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                    )}
                </div>
            </>
       )}
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
      id: `el_${Date.now()}`,
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
    } else {
        if(type === 'heading') (newElement as any).title = '';
        if(type === 'description') (newElement as any).text = '';
        if(type === 'embed') (newElement as any).html = '';
        if(['image', 'video', 'audio', 'document'].includes(type)) (newElement as any).url = '';
    }
    
    append(newElement);
  };
  
  // This logic is a bit brittle, but it's the simplest way to add the `isQuestion` property for validation
  React.useEffect(() => {
    fields.forEach((field, index) => {
        const el = elements[index];
        if(el.type === 'text' || el.type === 'long-text' || el.type === 'yes-no' || el.type === 'multiple-choice' || el.type === 'checkboxes' || el.type === 'dropdown' || el.type === 'rating' || el.type === 'date' || el.type === 'time' || el.type === 'file-upload') {
            if(!('isRequired' in el)) {
                (el as any).isRequired = true; // Add it if it's missing
            }
        }
    })
  }, [elements, fields]);


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
            <Card key={field.id} className="relative bg-muted/30 border-2 border-transparent has-[input:focus]:border-primary has-[textarea:focus]:border-primary transition-colors group">
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
                    {isElementQuestion ? `Question #${index + 1}` : `Layout Block`}
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
                 <ConditionalLogicEditor elementIndex={index} />
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
