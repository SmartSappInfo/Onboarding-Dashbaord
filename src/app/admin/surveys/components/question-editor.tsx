'use client';

import { useFieldArray, useFormContext, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, PlusCircle, ArrowUp, ArrowDown, X } from 'lucide-react';
import type { SurveyQuestion } from '@/lib/types';
import * as React from 'react';
import { FormMessage, useFormField } from '@/components/ui/form';

function OptionsEditor({ questionIndex }: { questionIndex: number }) {
  const { control, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `questions.${questionIndex}.options`,
  });
  
  const questionType = watch(`questions.${questionIndex}.type`);

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-background">
      <Label>Options</Label>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <Controller
            name={`questions.${questionIndex}.options.${index}`}
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
                name={`questions.${questionIndex}.allowOther`}
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

function ConditionalLogicEditor({ questionIndex }: { questionIndex: number }) {
  const { control, watch, setValue } = useFormContext();
  const allQuestions: SurveyQuestion[] = watch('questions') || [];
  const condition = watch(`questions.${questionIndex}.displayCondition`);
  const parentQuestionId = condition?.questionId;

  const potentialParents = allQuestions
      .slice(0, questionIndex)
      .filter(q => q.type === 'yes-no' || q.type === 'multiple-choice');

  const parentQuestion = potentialParents.find(q => q.id === parentQuestionId);

  const handleParentChange = (id: string) => {
    if (id === 'none') {
        setValue(`questions.${questionIndex}.displayCondition`, undefined);
    } else {
        setValue(`questions.${questionIndex}.displayCondition`, { questionId: id, expectedValue: '' });
    }
  }

  if (questionIndex === 0) return null;

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-background">
        <div className="flex justify-between items-center">
             <Label>Conditional Logic</Label>
             <Controller
                name={`questions.${questionIndex}.displayCondition`}
                control={control}
                render={({ field }) => (
                    <Switch
                        checked={!!field.value}
                        onCheckedChange={(checked) => {
                            if (checked) {
                                setValue(`questions.${questionIndex}.displayCondition`, { questionId: '', expectedValue: '' });
                            } else {
                                setValue(`questions.${questionIndex}.displayCondition`, undefined);
                            }
                        }}
                    />
                )}
             />
        </div>
       {condition && (
            <>
                <p className="text-sm text-muted-foreground">Show this question only when...</p>
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
                                        Question {i + 1}: {q.title.substring(0,20)}...
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {parentQuestion && (
                        <div>
                            <Label className="text-xs font-normal">...has this answer:</Label>
                            <Controller
                                name={`questions.${questionIndex}.displayCondition.expectedValue`}
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
    name: 'questions',
  });

  const questions = watch('questions');

  const addQuestion = () => {
    append({
      id: `q${Date.now()}`,
      title: '',
      type: 'text',
      isRequired: true,
      options: [],
      allowOther: false,
    });
  };

  const formErrors = errors.questions as any[] | undefined;

  return (
    <div className="space-y-6">
      {fields.map((field, index) => {
        const questionErrors = formErrors?.[index] as Record<string, { message: string }> | undefined;
        return (
            <Card key={field.id} className="relative bg-muted/30 border-2 border-transparent has-[input:focus]:border-primary has-[textarea:focus]:border-primary transition-colors">
            <div className="absolute top-3 right-3 flex items-center gap-1">
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
                <CardTitle className="text-lg">Question {index + 1}</CardTitle>
                 {questionErrors?.title && <FormMessage>{questionErrors.title.message}</FormMessage>}
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                <Label>Question Text</Label>
                <Controller
                    name={`questions.${index}.title`}
                    control={control}
                    render={({ field }) => (
                    <Input {...field} placeholder="e.g., What is your favorite color?" />
                    )}
                />
                </div>
                
                <div>
                <Label>Question Type</Label>
                <Controller
                    name={`questions.${index}.type`}
                    control={control}
                    render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="yes-no">Yes/No</SelectItem>
                        <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                        <SelectItem value="checkboxes">Checkboxes</SelectItem>
                        </SelectContent>
                    </Select>
                    )}
                />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3 bg-background">
                <Label>Required</Label>
                <Controller
                    name={`questions.${index}.isRequired`}
                    control={control}
                    render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )}
                />
                </div>
                
                {(questions[index]?.type === 'multiple-choice' || questions[index]?.type === 'checkboxes') && (
                <div className="md:col-span-2">
                    <OptionsEditor questionIndex={index} />
                    {questionErrors?.options && <FormMessage className="mt-2">{questionErrors.options.message}</FormMessage>}
                </div>
                )}

                <div className="md:col-span-2">
                    <ConditionalLogicEditor questionIndex={index} />
                </div>

            </CardContent>
            </Card>
        )
      })}

      {formErrors && typeof formErrors === 'object' && 'message' in formErrors && (
          <FormMessage>{(formErrors as any).message}</FormMessage>
      )}

      <Button type="button" variant="outline" onClick={addQuestion}>
        <PlusCircle className="mr-2 h-4 w-4" />
        Add Question
      </Button>
    </div>
  );
}
