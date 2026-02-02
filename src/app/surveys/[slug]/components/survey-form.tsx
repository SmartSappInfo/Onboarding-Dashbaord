
'use client';

import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDoc, collection } from 'firebase/firestore';

import type { Survey, SurveyQuestion, SurveyElement } from '@/lib/types';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Star } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import VideoEmbed from '@/components/video-embed';

interface SurveyFormProps {
    survey: Survey;
    onSubmitted: () => void;
}

const isQuestion = (element: SurveyElement): element is SurveyQuestion => 'isRequired' in element;

const generateSchema = (questions: SurveyQuestion[]) => {
    const baseSchemaObject = questions.reduce((acc, q) => {
        acc[q.id] = z.any().optional();
        return acc;
    }, {} as Record<string, z.ZodTypeAny>);

    return z.object(baseSchemaObject).superRefine((data, ctx) => {
        questions.forEach((q) => {
            let isVisible = true;
            if (q.visibilityLogic) {
                const parentValue = data[q.visibilityLogic.questionId];
                if (parentValue !== q.visibilityLogic.expectedValue) {
                    isVisible = false;
                }
            }

            if (isVisible && q.isRequired) {
                const value = data[q.id];
                let hasError = false;
                let errorMessage = "This field is required.";

                switch (q.type) {
                    case 'text':
                    case 'long-text':
                        if (!value || typeof value !== 'string' || !value.trim()) hasError = true;
                        break;
                    case 'yes-no':
                    case 'multiple-choice':
                    case 'dropdown':
                        if (!value) hasError = true;
                        break;
                    case 'rating':
                        if (typeof value !== 'number' || value < 1) hasError = true;
                        break;
                    case 'date':
                        if (!value) hasError = true;
                        break;
                    case 'time':
                        if (!value || !/^\d{2}:\d{2}$/.test(value)) hasError = true;
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

const StarRating = ({ value, onChange, disabled }: { value: number, onChange: (value: number) => void, disabled?: boolean }) => {
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
                <Star
                    key={star}
                    className={cn(
                        'w-8 h-8 cursor-pointer',
                        star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300',
                        disabled ? 'cursor-not-allowed' : ''
                    )}
                    onClick={() => !disabled && onChange(star)}
                />
            ))}
        </div>
    );
};

const DatePicker = ({ value, onChange, disabled }: { value?: Date, onChange: (date?: Date) => void, disabled?: boolean }) => {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal", !value && "text-muted-foreground")} disabled={disabled}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {value ? format(value, "PPP") : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
            </PopoverContent>
        </Popover>
    );
}

const ElementRenderer = ({ element, index, control, setValue, errors }: { element: SurveyElement; index: number; control: any, setValue: any, errors: any }) => {
    const { visibilityLogic } = element;
    const parentValue = useWatch({
        control,
        name: visibilityLogic ? visibilityLogic.questionId : 'non-existent-field',
    });

    const isVisible = React.useMemo(() => {
        if (!visibilityLogic) return true;
        return parentValue === visibilityLogic.expectedValue;
    }, [visibilityLogic, parentValue]);

    React.useEffect(() => {
        if (!isVisible && isQuestion(element)) {
            setValue(element.id, undefined, { shouldValidate: false });
        }
    }, [isVisible, element, setValue]);

    if (!isVisible) return null;
    
    if (isQuestion(element)) {
        const question = element;
        return (
            <Card>
                <CardContent className="pt-6">
                    <Label className="text-base font-semibold">
                        {index + 1}. {question.title}
                        {question.isRequired && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <div className="mt-4">
                        {question.type === 'text' && (
                            <Controller control={control} name={question.id} render={({ field }) => <Input {...field} />} />
                        )}
                        {question.type === 'long-text' && (
                            <Controller control={control} name={question.id} render={({ field }) => <Textarea {...field} />} />
                        )}
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
                        {question.type === 'dropdown' && (
                            <Controller
                                control={control}
                                name={question.id}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="w-full sm:w-1/2">
                                            <SelectValue placeholder="Select an option" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {question.options?.map(opt => (
                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        )}
                        {question.type === 'rating' && (
                            <Controller control={control} name={question.id} render={({ field }) => <StarRating {...field} />} />
                        )}
                        {question.type === 'date' && (
                            <Controller control={control} name={question.id} render={({ field }) => <DatePicker {...field} />} />
                        )}
                        {question.type === 'time' && (
                            <Controller control={control} name={question.id} render={({ field }) => <Input type="time" className="w-fit" {...field} />} />
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
    } else {
        const block = element;
        switch (block.type) {
            case 'heading':
                return <h2 id={block.id} className="text-2xl font-bold mt-8 mb-4 border-b pb-2">{block.title}</h2>;
            case 'description':
                return <p className="text-muted-foreground my-4">{block.text}</p>;
            case 'divider':
                return <hr className="my-8" />;
            case 'image':
                return block.url ? <div className="relative aspect-video my-6 rounded-lg overflow-hidden"><Image src={block.url} alt={block.title || 'Survey Image'} layout="fill" objectFit="contain" /></div> : null;
            case 'video':
                 return block.url ? <div className="my-6"><VideoEmbed url={block.url} /></div> : null;
            case 'audio':
                return block.url ? <audio controls src={block.url} className="w-full my-6">Your browser does not support the audio element.</audio> : null;
            case 'document':
                 return block.url ? <Button asChild variant="outline" className="my-6"><a href={block.url} target="_blank" rel="noopener noreferrer">Download Document</a></Button> : null;
            case 'embed':
                return block.html ? <div className="my-6" dangerouslySetInnerHTML={{ __html: block.html }} /> : null;
            default:
                return null;
        }
    }
}

export default function SurveyForm({ survey, onSubmitted }: SurveyFormProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const questions = React.useMemo(() => survey.elements.filter(isQuestion), [survey.elements]);
    const surveySchema = React.useMemo(() => generateSchema(questions), [questions]);

    const form = useForm<z.infer<typeof surveySchema>>({
        resolver: zodResolver(surveySchema),
        defaultValues: questions.reduce((acc, q) => {
            if (q.type === 'checkboxes') {
                if (q.allowOther) {
                     acc[q.id] = { options: [], other: '' };
                } else {
                     acc[q.id] = [];
                }
            }
            if (q.type === 'rating') {
                acc[q.id] = 0;
            }
            return acc;
        }, {} as any)
    });

    const watchedValues = useWatch({ control: form.control });

    React.useEffect(() => {
        if (!watchedValues) return;

        Object.keys(watchedValues).forEach(questionId => {
            const question = questions.find(q => q.id === questionId);
            const value = watchedValues[questionId];

            if (question?.branchingLogic && value) {
                const rule = question.branchingLogic.find(r => r.onValue === value);
                if (rule?.action === 'jump') {
                    const targetElement = document.getElementById(rule.targetElementId);
                    if (targetElement) {
                        // Needs a slight delay to allow the DOM to update if the target was conditionally hidden
                        setTimeout(() => {
                            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                    }
                }
            }
        });

    }, [watchedValues, questions]);


    const onSubmit = async (data: z.infer<typeof surveySchema>) => {
        if (!firestore) return;
        
        const serializedData = { ...data };
        Object.keys(serializedData).forEach(key => {
            if (serializedData[key] instanceof Date) {
                serializedData[key] = format(serializedData[key] as Date, 'yyyy-MM-dd');
            }
        });

        const cleanedData = Object.fromEntries(Object.entries(serializedData).filter(([_, v]) => v !== undefined && v !== null && (typeof v !== 'number' || v > 0) ));

        const answers = Object.entries(cleanedData).map(([questionId, value]) => ({
            questionId,
            value,
        }));

        if (answers.length === 0) {
            toast({ variant: 'destructive', title: 'Empty Submission', description: 'Please answer at least one question.' });
            return;
        }

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
            {survey.elements.map((el, index) => (
                <ElementRenderer 
                    key={el.id}
                    element={el}
                    index={index}
                    control={form.control}
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
