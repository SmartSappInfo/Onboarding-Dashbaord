'use client';

import { useForm, Controller } from 'react-hook-form';
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

const generateSchema = (questions: SurveyQuestion[]) => {
    const schemaObject: Record<string, z.ZodTypeAny> = {};
  
    questions.forEach((q) => {
      let validator: z.ZodTypeAny;
  
      switch (q.type) {
        case 'yes-no':
          validator = z.enum(['Yes', 'No']);
          break;
        case 'multiple-choice':
          validator = z.string().min(1, 'Please select an option.');
          break;
        case 'checkboxes':
          validator = z.array(z.string());
          if (q.allowOther) {
             validator = z.object({
                options: z.array(z.string()),
                other: z.string().optional(),
             }).refine(data => data.options.length > 0 || (data.other && data.other.trim().length > 0), {
                message: 'Please select at least one option or specify "Other".'
             });
          }
          break;
        case 'text':
          validator = z.string();
          break;
        default:
          validator = z.any();
      }
  
      if (q.isRequired && validator instanceof z.ZodType) {
        if (q.type === 'text') {
            validator = (validator as z.ZodString).min(1, 'This field is required.');
        } else if (q.type === 'checkboxes' && !q.allowOther) {
            validator = (validator as z.ZodArray<any, any>).nonempty('Please select at least one option.');
        }
      } else {
        validator = validator.optional();
      }
  
      schemaObject[q.id] = validator;
    });
  
    return z.object(schemaObject);
};

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
            } else {
                acc[q.id] = '';
            }
            return acc;
        }, {} as any)
    });

    const onSubmit = async (data: z.infer<typeof surveySchema>) => {
        if (!firestore) return;

        const answers = Object.entries(data).map(([questionId, value]) => ({
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
                <Card key={q.id}>
                    <CardContent className="pt-6">
                        <Label className="text-base font-semibold">
                            {index + 1}. {q.title}
                            {q.isRequired && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        <div className="mt-4">
                            {q.type === 'yes-no' && (
                                <Controller
                                    control={form.control}
                                    name={q.id}
                                    render={({ field }) => (
                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="Yes" id={`${q.id}-yes`} />
                                                <Label htmlFor={`${q.id}-yes`}>Yes</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="No" id={`${q.id}-no`} />
                                                <Label htmlFor={`${q.id}-no`}>No</Label>
                                            </div>
                                        </RadioGroup>
                                    )}
                                />
                            )}
                            {q.type === 'multiple-choice' && (
                                <Controller
                                    control={form.control}
                                    name={q.id}
                                    render={({ field }) => (
                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-2">
                                            {q.options?.map(opt => (
                                                <div key={opt} className="flex items-center space-x-2">
                                                    <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                                                    <Label htmlFor={`${q.id}-${opt}`}>{opt}</Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    )}
                                />
                            )}
                             {q.type === 'checkboxes' && (
                                 <div className="space-y-2">
                                    {q.options?.map(opt => (
                                        <div key={opt} className="flex items-start space-x-2">
                                           <Checkbox
                                                id={`${q.id}-${opt}`}
                                                onCheckedChange={(checked) => {
                                                    const currentVal = form.getValues(q.id);
                                                    const options = q.allowOther ? currentVal.options : currentVal;
                                                    const newOptions = checked
                                                        ? [...options, opt]
                                                        : options.filter((v: string) => v !== opt);
                                                    
                                                    form.setValue(q.id, q.allowOther ? { ...currentVal, options: newOptions } : newOptions, { shouldValidate: true });
                                                }}
                                            />
                                            <Label htmlFor={`${q.id}-${opt}`} className="font-normal">{opt}</Label>
                                        </div>
                                    ))}
                                    {q.allowOther && (
                                        <div className="flex items-start space-x-2 pt-2">
                                            <Checkbox
                                                id={`${q.id}-other-checkbox`}
                                                onCheckedChange={(checked) => {
                                                    const currentVal = form.getValues(q.id);
                                                    form.setValue(q.id, { ...currentVal, other: checked ? currentVal.other : '' }, { shouldValidate: true });
                                                    if(checked) setTimeout(() => document.getElementById(`${q.id}-other-input`)?.focus(), 0);
                                                }}
                                            />
                                            <Input
                                                id={`${q.id}-other-input`}
                                                placeholder="Other (please specify)"
                                                className="h-8 flex-1"
                                                {...form.register(`${q.id}.other`)}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const currentVal = form.getValues(q.id);
                                                    form.setValue(q.id, { ...currentVal, other: val }, { shouldValidate: true });
                                                    if(val && !form.getValues(q.id).options.includes('Other')){
                                                        document.getElementById(`${q.id}-other-checkbox`)?.click();
                                                    }
                                                }}
                                            />
                                        </div>
                                    )}
                                 </div>
                            )}
                            {q.type === 'text' && (
                                <Controller
                                    control={form.control}
                                    name={q.id}
                                    render={({ field }) => <Textarea {...field} />}
                                />
                            )}
                             {form.formState.errors[q.id] && (
                                 <p className="text-sm font-medium text-destructive mt-2">
                                    { (form.formState.errors as any)[q.id]?.message || (form.formState.errors as any)[q.id]?.root?.message }
                                 </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
            <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Submitting...' : 'Submit Survey'}
            </Button>
        </form>
    );
}
