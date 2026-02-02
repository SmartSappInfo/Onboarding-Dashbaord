'use client';

import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDoc, collection } from 'firebase/firestore';

import type { Survey, SurveyQuestion } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import * as React from 'react';

interface SurveyFormProps {
    survey: Survey;
    onSubmitted: () => void;
}

// Generates a Zod schema with conditional validation
const generateSchema = (questions: SurveyQuestion[]) => {
    // Create a base schema object where every field is optional initially.
    // Validation will be handled by superRefine.
    const baseSchemaObject = questions.reduce((acc, q) => {
        acc[q.id] = z.any().optional();
        return acc;
    }, {} as Record<string, z.ZodTypeAny>);

    return z.object(baseSchemaObject).superRefine((data, ctx) => {
        questions.forEach((q) => {
            // Determine if the current question should be visible based on its displayCondition
            let isVisible = true;
            if (q.displayCondition) {
                const parentValue = data[q.displayCondition.questionId];
                if (parentValue !== q.displayCondition.expectedValue) {
                    isVisible = false;
                }
            }

            // If the question is visible and marked as required, perform validation.
            if (isVisible && q.isRequired) {
                const value = data[q.id];
                let hasError = false;
                let errorMessage = "This field is required.";

                switch (q.type) {
                    case 'yes-no':
                    case 'multiple-choice':
                        if (!value) hasError = true;
                        break;
                    case 'text':
                        if (!value || typeof value !== 'string' || !value.trim()) hasError = true;
                        break;
                    case 'checkboxes':
                        if (q.allowOther) {
                            if (!value || typeof value !== 'object' || (value.options?.length === 0 && (!value.other || !value.other.trim()))) {
                                hasError = true;
                                errorMessage = "Please select at least one option or specify 'Other'.";
                            }
                        } else {
                            if (!value || !Array.isArray(value) || value.length === 0) {
                                hasError = true;
                                errorMessage = "Please select at least one option.";
                            }
                        }
                        break;
                }

                if (hasError) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [q.id],
                        message: errorMessage,
                    });
                }
            }
        });
    });
};


// A component to render a single question, handling its own visibility.
const QuestionRenderer = ({ question, index, control, getValues, setValue, errors }: { question: SurveyQuestion; index: number; control: any, getValues: any, setValue: any, errors: any }) => {
    const { displayCondition } = question;
    // Watch the value of the parent question, if one exists
    const parentValue = useWatch({
        control,
        name: displayCondition ? displayCondition.questionId : 'non-existent-field',
    });

    const isVisible = React.useMemo(() => {
        if (!displayCondition) return true;
        return parentValue === displayCondition.expectedValue;
    }, [displayCondition, parentValue]);

    React.useEffect(() => {
        // If a question becomes hidden, reset its value to avoid submitting stale data
        if (!isVisible) {
            setValue(question.id, undefined, { shouldValidate: false });
        }
    }, [isVisible, question.id, setValue]);

    if (!isVisible) return null;

    return (
        <Card>
            <CardContent className="pt-6">
                <Label className="text-base font-semibold">
                    {index + 1}. {question.title}
                    {question.isRequired && <span className="text-destructive ml-1">*</span>}
                </Label>
                <div className="mt-4">
                    {question.type === 'yes-no' && (
                        <Controller
                            control={control}
                            name={question.id}
                            render={({ field }) => (
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Yes" id={`${question.id}-yes`} /><Label htmlFor={`${question.id}-yes`}>Yes</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="No" id={`${question.id}-no`} /><Label htmlFor={`${question.id}-no`}>No</Label></div>
                                </RadioGroup>
                            )}
                        />
                    )}
                    {question.type === 'multiple-choice' && (
                         <Controller
                            control={control}
                            name={question.id}
                            render={({ field }) => (
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-2">
                                    {question.options?.map(opt => (
                                        <div key={opt} className="flex items-center space-x-2"><RadioGroupItem value={opt} id={`${question.id}-${opt}`} /><Label htmlFor={`${question.id}-${opt}`}>{opt}</Label></div>
                                    ))}
                                </RadioGroup>
                            )}
                        />
                    )}
                     {question.type === 'checkboxes' && (
                         <Controller
                            name={question.id}
                            control={control}
                            defaultValue={question.allowOther ? { options: [], other: ''} : []}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    {question.options?.map(opt => (
                                        <div key={opt} className="flex items-start space-x-2">
                                            <Checkbox
                                                id={`${question.id}-${opt}`}
                                                checked={question.allowOther ? field.value?.options?.includes(opt) : field.value?.includes(opt)}
                                                onCheckedChange={(checked) => {
                                                    if (question.allowOther) {
                                                        const currentOptions = field.value?.options || [];
                                                        const newOptions = checked ? [...currentOptions, opt] : currentOptions.filter((v:string) => v !== opt);
                                                        field.onChange({ ...field.value, options: newOptions });
                                                    } else {
                                                        const currentVal = field.value || [];
                                                        const newVal = checked ? [...currentVal, opt] : currentVal.filter((v:string) => v !== opt);
                                                        field.onChange(newVal);
                                                    }
                                                }}
                                            />
                                            <Label htmlFor={`${question.id}-${opt}`} className="font-normal">{opt}</Label>
                                        </div>
                                    ))}
                                    {question.allowOther && (
                                        <div className="flex items-start space-x-2 pt-2">
                                            <Checkbox
                                                id={`${question.id}-other-checkbox`}
                                                checked={!!(field.value?.other || '')}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setTimeout(() => document.getElementById(`${question.id}-other-input`)?.focus(), 0);
                                                    } else {
                                                        field.onChange({ ...field.value, other: '' });
                                                    }
                                                }}
                                            />
                                            <Input
                                                id={`${question.id}-other-input`}
                                                placeholder="Other (please specify)"
                                                className="h-8 flex-1"
                                                value={field.value?.other || ''}
                                                onChange={(e) => field.onChange({ ...field.value, other: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        />
                    )}
                    {question.type === 'text' && (
                        <Controller control={control} name={question.id} render={({ field }) => <Textarea {...field} />} />
                    )}
                     {errors[question.id] && (
                         <p className="text-sm font-medium text-destructive mt-2">
                            { (errors as any)[question.id]?.message }
                         </p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

export default function SurveyForm({ survey, onSubmitted }: SurveyFormProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const surveySchema = React.useMemo(() => generateSchema(survey.questions), [survey.questions]);

    const form = useForm<z.infer<typeof surveySchema>>({
        resolver: zodResolver(surveySchema),
        defaultValues: survey.questions.reduce((acc, q) => {
            if (q.type === 'checkboxes') {
                if (q.allowOther) {
                     acc[q.id] = { options: [], other: '' };
                } else {
                     acc[q.id] = [];
                }
            }
            return acc;
        }, {} as any)
    });

    const onSubmit = async (data: z.infer<typeof surveySchema>) => {
        if (!firestore) return;
        
        const cleanedData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));

        const answers = Object.entries(cleanedData).map(([questionId, value]) => ({
            questionId,
            value,
        }));

        const responseData = {
            surveyId: survey.id,
            submittedAt: new Date().toISOString(),
            answers,
        };

        const responsesCollection = collection(firestore, `surveys/${survey.id}/responses`);
        form.control.disabled = true;

        addDoc(responsesCollection, responseData)
            .then(() => {
                toast({ title: 'Success', description: 'Your response has been submitted.' });
                onSubmitted();
            })
            .catch((error) => {
                 const permissionError = new FirestorePermissionError({
                    path: responsesCollection.path,
                    operation: 'create',
                    requestResourceData: responseData,
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to submit response.' });
            }).finally(() => {
                form.control.disabled = false;
            });
    };

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {survey.questions.map((q, index) => (
                <QuestionRenderer 
                    key={q.id}
                    question={q}
                    index={index}
                    control={form.control}
                    getValues={form.getValues}
                    setValue={form.setValue}
                    errors={form.formState.errors}
                />
            ))}
            <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Submitting...' : 'Submit Survey'}
            </Button>
        </form>
    );
}
