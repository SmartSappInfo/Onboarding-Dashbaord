'use client';

import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDoc, collection } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import type { Survey, SurveyQuestion, SurveyElement, SurveyLogicBlock, SurveyLayoutBlock } from '@/lib/types';
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
import { CalendarIcon, Star, Upload, File as FileIcon, X, Check, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import VideoEmbed from '@/components/video-embed';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';

interface SurveyFormProps {
    survey: Survey;
    onSubmitted: () => void;
    isPreview?: boolean;
}

const isQuestion = (element: SurveyElement): element is SurveyQuestion => 'isRequired' in element;
const isLogic = (element: SurveyElement): element is SurveyLogicBlock => element.type === 'logic';

const generateSchema = (elements: SurveyElement[]) => {
    const questions = elements.filter(isQuestion);
    const baseSchemaObject = questions.reduce((acc, q) => {
        let schema: z.ZodTypeAny = z.any();
        
        if (q.type === 'text' || q.type === 'long-text') {
            let textSchema = z.string();
            if (q.minLength !== undefined) {
                textSchema = textSchema.min(q.minLength, { message: `Must be at least ${q.minLength} characters.` });
            }
            if (q.maxLength !== undefined) {
                textSchema = textSchema.max(q.maxLength, { message: `Cannot exceed ${q.maxLength} characters.` });
            }
            schema = textSchema;
        }

        if (q.type === 'file-upload') {
            schema = z.string().url().optional();
        }

        acc[q.id] = schema.optional();
        return acc;
    }, {} as Record<string, z.ZodTypeAny>);

    return z.object(baseSchemaObject);
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
    const dateValue = value && isValid(value) ? value : undefined;
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal", !dateValue && "text-muted-foreground")} disabled={disabled}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateValue ? format(dateValue, "PPP") : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateValue}
                  onSelect={onChange}
                  initialFocus
                  captionLayout="dropdown"
                />
            </PopoverContent>
        </Popover>
    );
}

const FileUpload = ({ value, onChange, disabled, surveyId }: { value?: string; onChange: (value?: string) => void; disabled?: boolean; surveyId: string }) => {
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    if (value && !fileName) {
      try {
        if (value.startsWith('https://firebasestorage.googleapis.com')) {
          const url = new URL(value);
          const path = decodeURIComponent(url.pathname);
          const name = path.substring(path.lastIndexOf('/') + 1);
          if (name.includes('-')) {
            const nameWithoutTimestamp = name.substring(name.indexOf('-') + 1);
            setFileName(nameWithoutTimestamp);
          } else {
            setFileName(name);
          }
        }
      } catch (e) {
        console.error("Could not parse file URL:", e);
      }
    } else if (!value && fileName) {
      setFileName(null);
      setUploadProgress(null);
      setError(null);
    }
  }, [value, fileName]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadProgress(0);
    setFileName(file.name);
    onChange(undefined);

    const storage = getStorage();
    const storagePath = `survey-uploads/${surveyId}/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (uploadError) => {
        console.error("Upload failed:", uploadError);
        setError("Upload failed. Please try again.");
        setUploadProgress(null);
        setFileName(null);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          onChange(downloadURL);
          setUploadProgress(100);
          setTimeout(() => {
            setUploadProgress(null);
          }, 1500);
        } catch (urlError) {
          console.error("Failed to get download URL:", urlError);
          setError("Could not retrieve file URL.");
          setUploadProgress(null);
          setFileName(null);
        }
      }
    );
  };
  
  const handleRemoveFile = () => {
      onChange(undefined);
  };
  
  if (uploadProgress !== null && fileName) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
                <FileIcon className="h-5 w-5 text-muted-foreground" />
                <span className="truncate flex-1">{fileName}</span>
                {uploadProgress === 100 ? <span className="text-green-600 font-medium">Done!</span> : <span>{Math.round(uploadProgress)}%</span>}
            </div>
            <Progress value={uploadProgress} />
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
  }

  if (value && fileName) {
    return (
      <div className="flex items-center gap-2 p-2 border rounded-md bg-secondary">
        <FileIcon className="h-5 w-5 text-secondary-foreground" />
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm font-medium truncate flex-1 hover:underline">{fileName}</a>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRemoveFile} disabled={disabled}>
            <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button asChild variant="outline" disabled={disabled}>
        <div>
            <Upload className="mr-2 h-4 w-4" />
            <span>Upload a file</span>
        </div>
      </Button>
      <Input
        type="file"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={handleFileChange}
        disabled={disabled}
      />
    </div>
  );
};


const ElementRenderer = ({ element, control, errors, isVisible, isRequired, surveyId }: { element: SurveyElement; control: any, errors: any; isVisible: boolean; isRequired: boolean; surveyId: string; }) => {

    if (isLogic(element) || !isVisible) {
        return null;
    }
    
    if (isQuestion(element)) {
        const question = element;
        return (
            <Card id={question.id}>
                <CardContent className="pt-6">
                    <Label className="text-lg font-semibold">
                        {question.title}
                        {isRequired && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <div className="mt-4">
                        {question.type === 'text' && (
                            <Controller control={control} name={question.id} render={({ field }) => <Input {...field} value={field.value || ''} placeholder={question.placeholder} className="text-base" />} />
                        )}
                        {question.type === 'long-text' && (
                            <Controller control={control} name={question.id} render={({ field }) => <Textarea {...field} value={field.value || ''} placeholder={question.placeholder} className="text-base" />} />
                        )}
                        {question.type === 'yes-no' && (
                            <Controller
                                control={control}
                                name={question.id}
                                render={({ field }) => (
                                     <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Label htmlFor={`${question.id}-yes`} className="flex cursor-pointer items-center gap-3 rounded-md border p-4 text-base font-medium transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                            <RadioGroupItem value="Yes" id={`${question.id}-yes`} />
                                            Yes
                                        </Label>
                                        <Label htmlFor={`${question.id}-no`} className="flex cursor-pointer items-center gap-3 rounded-md border p-4 text-base font-medium transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                            <RadioGroupItem value="No" id={`${question.id}-no`} />
                                            No
                                        </Label>
                                    </RadioGroup>
                                )}
                            />
                        )}
                        {question.type === 'multiple-choice' && (
                            <Controller
                                control={control}
                                name={question.id}
                                render={({ field }) => (
                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-3">
                                        {question.options?.map(opt => (
                                            <Label key={opt} htmlFor={`${question.id}-${opt}`} className="flex cursor-pointer items-center gap-3 rounded-md border p-4 text-base font-medium transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                                <RadioGroupItem value={opt} id={`${question.id}-${opt}`} />
                                                {opt}
                                            </Label>
                                        ))}
                                    </RadioGroup>
                                )}
                            />
                        )}
                        {question.type === 'checkboxes' && (
                            <Controller
                                name={question.id}
                                control={control}
                                render={({ field }) => {
                                    return (
                                    <div className="space-y-3">
                                        {question.options?.map(opt => {
                                            const isChecked = question.allowOther ? field.value?.options?.includes(opt) : field.value?.includes(opt);
                                            return (
                                                <Label key={opt} htmlFor={`${question.id}-${opt}`} className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-4 text-base font-medium transition-colors hover:bg-accent", isChecked && "border-primary bg-primary/10")}>
                                                    <Checkbox
                                                        id={`${question.id}-${opt}`}
                                                        checked={isChecked}
                                                        onCheckedChange={(checked) => {
                                                            if (question.allowOther) {
                                                                const currentOptions = field.value?.options || [];
                                                                const newOptions = checked ? [...currentOptions, opt] : currentOptions.filter((v:string) => v !== opt);
                                                                field.onChange({ ...(field.value || {}), options: newOptions });
                                                            } else {
                                                                const currentVal = field.value || [];
                                                                const newVal = checked ? [...currentVal, opt] : currentVal.filter((v:string) => v !== opt);
                                                                field.onChange(newVal);
                                                            }
                                                        }}
                                                    />
                                                     <span className="flex-1 -mt-1">{opt}</span>
                                                </Label>
                                            )
                                        })}
                                        {question.allowOther && (
                                            <div className={cn("flex items-center gap-3 rounded-md border p-4 transition-colors", (field.value?.other || '') && "border-primary bg-primary/10")}>
                                                <Checkbox
                                                    id={`${question.id}-other-checkbox`}
                                                    checked={!!(field.value?.other || '')}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setTimeout(() => document.getElementById(`${question.id}-other-input`)?.focus(), 0);
                                                        } else {
                                                            field.onChange({ ...(field.value || {}), other: '' });
                                                        }
                                                    }}
                                                />
                                                <Input
                                                    id={`${question.id}-other-input`}
                                                    placeholder="Other (please specify)"
                                                    className="h-8 flex-1 border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
                                                    value={field.value?.other || ''}
                                                    onChange={(e) => field.onChange({ ...(field.value || {}), other: e.target.value })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}}
                            />
                        )}
                        {question.type === 'dropdown' && (
                            <Controller
                                control={control}
                                name={question.id}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="w-full sm:w-1/2 text-base h-11">
                                            <SelectValue placeholder="Select an option" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {question.options?.map(opt => (
                                                <SelectItem key={opt} value={opt} className="text-base">{opt}</SelectItem>
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
                            <Controller control={control} name={question.id} render={({ field }) => <Input type="time" step="1" className="w-fit bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none text-base h-11" {...field} value={field.value || ''} />} />
                        )}
                        {question.type === 'file-upload' && (
                            <Controller
                                control={control}
                                name={question.id}
                                render={({ field }) => (
                                    <FileUpload
                                        value={field.value}
                                        onChange={field.onChange}
                                        disabled={false}
                                        surveyId={surveyId}
                                    />
                                )}
                            />
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
        const block = element as SurveyLayoutBlock;
        switch (block.type) {
            case 'section':
                 if (block.renderAsPage) return null; // Handled by page-level component
                return <h2 id={block.id} className="text-2xl font-bold mt-12 mb-6 border-b-2 border-primary pb-2">{block.title}</h2>;
            case 'heading':
                return <h2 id={block.id} className="text-2xl font-bold mt-8 mb-4 border-b pb-2">{block.title}</h2>;
            case 'description':
                return <p className="text-muted-foreground my-4 text-base">{block.text}</p>;
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

const evaluateCondition = (answer: any, operator: SurveyLogicBlock['rules'][0]['operator'], targetValue: any): boolean => {
    const strAnswer = String(answer ?? '');

    switch (operator) {
        case 'isEqualTo': return strAnswer === String(targetValue);
        case 'isNotEqualTo': return strAnswer !== String(targetValue);
        case 'contains': return strAnswer.includes(String(targetValue));
        case 'doesNotContain': return !strAnswer.includes(String(targetValue));
        case 'startsWith': return strAnswer.startsWith(String(targetValue));
        case 'doesNotStartWith': return !strAnswer.startsWith(String(targetValue));
        case 'endsWith': return strAnswer.endsWith(String(targetValue));
        case 'doesNotEndWith': return !strAnswer.endsWith(String(targetValue));
        case 'isEmpty': return strAnswer.trim() === '';
        case 'isNotEmpty': return strAnswer.trim() !== '';
        case 'isGreaterThan': return Number(answer) > Number(targetValue);
        case 'isLessThan': return Number(answer) < Number(targetValue);
        default: return false;
    }
}

type ElementState = { isVisible: boolean; isRequired: boolean };

const getInitialElementStates = (elements: SurveyElement[]): Record<string, ElementState> => {
    const initialStates: Record<string, ElementState> = {};
    elements.forEach(el => {
        if (isLogic(el)) return;
        initialStates[el.id] = {
            isVisible: !el.hidden,
            isRequired: isQuestion(el) ? el.isRequired : false,
        };
    });
    return initialStates;
};

function SurveyStepper({ pages, currentIndex }: { pages: SurveyElement[][], currentIndex: number }) {
    if (pages.length <= 1) return null;

    return (
        <div className="w-full mb-12 overflow-x-auto pb-4 no-scrollbar">
            <div className="min-w-full flex items-start justify-center gap-0 sm:gap-2">
                {pages.map((page, index) => {
                    const section = page[0] as SurveyLayoutBlock;
                    const title = section?.stepperTitle || section?.title || `Step ${index + 1}`;
                    const isCompleted = index < currentIndex;
                    const isActive = index === currentIndex;
                    const isLast = index === pages.length - 1;

                    return (
                        <div key={index} className="flex-1 relative flex flex-col items-center">
                            {/* Connecting Line */}
                            {!isLast && (
                                <div className="absolute left-[50%] right-[-50%] top-5 h-0.5 bg-muted z-0">
                                    <motion.div 
                                        initial={false}
                                        animate={{ width: isCompleted ? '100%' : '0%' }}
                                        className="h-full bg-green-500"
                                    />
                                </div>
                            )}

                            {/* Circle */}
                            <div className="relative z-10 flex items-center justify-center">
                                <motion.div
                                    initial={false}
                                    animate={{
                                        backgroundColor: isCompleted ? 'hsl(var(--primary))' : isActive ? 'hsl(var(--primary))' : 'hsl(var(--background))',
                                        borderColor: isCompleted ? 'hsl(var(--primary))' : isActive ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                                        scale: isActive ? 1.1 : 1,
                                    }}
                                    className={cn(
                                        "w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-sm transition-colors",
                                        isCompleted ? "bg-green-500 border-green-500 text-white" : isActive ? "border-primary bg-primary text-white" : "bg-card border-border text-muted-foreground"
                                    )}
                                >
                                    {isCompleted ? (
                                        <Check className="w-6 h-6" />
                                    ) : (
                                        <span className="text-sm font-bold">{index + 1}</span>
                                    )}
                                </motion.div>
                            </div>

                            {/* Labels */}
                            <div className="mt-3 text-center px-2 min-w-[80px]">
                                <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-0.5">Step {index + 1}</p>
                                <p className={cn(
                                    "text-xs font-bold leading-tight line-clamp-2 h-8",
                                    isActive ? "text-foreground" : "text-muted-foreground"
                                )}>
                                    {title}
                                </p>
                                <Badge 
                                    variant="outline" 
                                    className={cn(
                                        "mt-2 text-[9px] h-5 uppercase tracking-tighter px-1.5",
                                        isCompleted ? "bg-green-50 text-green-700 border-green-200" : isActive ? "bg-primary/10 text-primary border-primary/20" : "opacity-50"
                                    )}
                                >
                                    {isCompleted ? 'Completed' : isActive ? 'In Progress' : 'Pending'}
                                </Badge>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function SurveyForm({ survey, onSubmitted, isPreview = false }: SurveyFormProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const surveySchema = React.useMemo(() => generateSchema(survey.elements), [survey.elements]);
    
    const defaultValues = React.useMemo(() => {
        return survey.elements.filter(isQuestion).reduce((acc, q) => {
            if (q.defaultValue !== undefined) {
                if (q.type === 'date' && typeof q.defaultValue === 'string') {
                    const parsedDate = parseISO(q.defaultValue);
                    if(isValid(parsedDate)) {
                        acc[q.id] = parsedDate;
                    }
                } else {
                    acc[q.id] = q.defaultValue;
                }
            } else {
                if (q.type === 'checkboxes') {
                    acc[q.id] = q.allowOther ? { options: [], other: '' } : [];
                }
                if (q.type === 'rating') acc[q.id] = 0;
            }
            return acc;
        }, {} as any);
    }, [survey.elements]);

    const form = useForm<z.infer<typeof surveySchema>>({
        resolver: zodResolver(surveySchema),
        defaultValues: defaultValues
    });
    
    const watchedValues = useWatch({ control: form.control });
    
    const [elementStates, setElementStates] = React.useState<Record<string, ElementState>>(
      () => getInitialElementStates(survey.elements)
    );
    const [isSubmitDisabled, setIsSubmitDisabled] = React.useState(false);
    const [currentPageIndex, setCurrentPageIndex] = React.useState(0);

    const pages = React.useMemo(() => {
        const p: SurveyElement[][] = [];
        let currentPage: SurveyElement[] = [];

        survey.elements.forEach(element => {
            if (element.type === 'section' && element.renderAsPage && currentPage.length > 0) {
                p.push(currentPage);
                currentPage = [element];
            } else {
                currentPage.push(element);
            }
        });

        if (currentPage.length > 0) {
            p.push(currentPage);
        }
        return p.length > 0 ? p : [[]];
    }, [survey.elements]);

    const isMultiPage = pages.length > 1;

    React.useEffect(() => {
        // Reset states based on default properties before applying logic
        const initialStates: Record<string, ElementState> = getInitialElementStates(survey.elements);
    
        let newSubmitDisabled = false;
        const logicBlocks = survey.elements.filter(isLogic);
        
        logicBlocks.forEach(block => {
          block.rules.forEach(rule => {
            const answer = watchedValues[rule.sourceQuestionId];
            
            if (evaluateCondition(answer, rule.operator, rule.targetValue)) {
              const { type, targetElementIds } = rule.action;
              switch (type) {
                case 'show':
                  targetElementIds?.forEach(id => { if (initialStates[id]) initialStates[id].isVisible = true; });
                  break;
                case 'hide':
                  targetElementIds?.forEach(id => { if (initialStates[id]) initialStates[id].isVisible = false; });
                  break;
                case 'require':
                  targetElementIds?.forEach(id => { if (initialStates[id]) initialStates[id].isRequired = true; });
                  break;
                case 'disableSubmit':
                  newSubmitDisabled = true;
                  break;
                // The 'jump' action is handled in `handleNext`
              }
            }
          });
        });
    
        setElementStates(initialStates);
        setIsSubmitDisabled(newSubmitDisabled);
    
      }, [watchedValues, survey.elements]);


    const onSubmit = async (data: z.infer<typeof surveySchema>) => {
        if (isPreview) {
            toast({ title: 'Preview Submission', description: 'This is a preview. No data was saved.' });
            onSubmitted();
            return;
        }

        if (!firestore) return;
        
        let isValid = true;
        survey.elements.filter(isQuestion).forEach(q => {
            const state = elementStates[q.id];
            if (state?.isVisible && state?.isRequired) {
                const value = data[q.id];
                const isEmpty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
                if (isEmpty) {
                    form.setError(q.id, { type: 'manual', message: 'This field is required.' });
                    isValid = false;
                }
            }
        });

        if (!isValid) {
            toast({ variant: 'destructive', title: 'Please fill out all required fields.'});
            return;
        }

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

    const handleNext = async () => {
        const questionIdsOnPage = pages[currentPageIndex].filter(isQuestion).map(q => q.id);
        const isValid = await form.trigger(questionIdsOnPage);

        if (isValid) {
            let nextPageIndex = currentPageIndex + 1; // Default to next page

            // Check for jump logic
            const logicBlocks = survey.elements.filter(isLogic);
            let jumpAction = false;
            
            for (const block of logicBlocks) {
                // Logic must be on the current page or a previous one to be evaluated
                const blockPageIndex = pages.findIndex(p => p.some(el => el.id === block.id));
                if (blockPageIndex > currentPageIndex) continue;

                for (const rule of block.rules) {
                    const answer = form.getValues(rule.sourceQuestionId);
                    if (evaluateCondition(answer, rule.operator, rule.targetValue)) {
                        if (rule.action.type === 'jump' && rule.action.targetElementId) {
                            const targetPageIndex = pages.findIndex(p => p.some(el => el.id === rule.action.targetElementId));
                            // Only jump forward
                            if (targetPageIndex > -1 && targetPageIndex > currentPageIndex) {
                                nextPageIndex = targetPageIndex;
                                jumpAction = true;
                                break;
                            }
                        }
                    }
                }
                if (jumpAction) break;
            }

            setCurrentPageIndex(nextPageIndex);
            window.scrollTo(0, 0);
        } else {
            toast({ variant: 'destructive', title: 'Please fill out all required fields on this page.' });
        }
    };

    const handlePrev = () => {
        setCurrentPageIndex(prev => prev - 1);
        window.scrollTo(0, 0);
    };

    const currentElements = pages[currentPageIndex];
    const pageSection = currentElements[0]?.type === 'section' && currentElements[0].renderAsPage ? currentElements[0] : null;

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <SurveyStepper pages={pages} currentIndex={currentPageIndex} />
            
            {pageSection && (
                 <div className="mb-8 text-center">
                    <h2 className="text-2xl font-bold">{pageSection.title}</h2>
                    {pageSection.description && <p className="text-muted-foreground mt-1">{pageSection.description}</p>}
                </div>
            )}

            {currentElements.map((el) => {
                 if (el.id === pageSection?.id) return null;
                return (
                    <ElementRenderer 
                        key={el.id}
                        element={el}
                        control={form.control}
                        errors={form.formState.errors}
                        isVisible={elementStates[el.id]?.isVisible ?? !el.hidden}
                        isRequired={elementStates[el.id]?.isRequired ?? (isQuestion(el) && el.isRequired)}
                        surveyId={survey.id}
                    />
                )
            })}

             <div className={cn("flex items-center", isMultiPage ? "justify-between" : "justify-end")}>
                {isMultiPage && currentPageIndex > 0 && (
                    <Button type="button" variant="outline" onClick={handlePrev} disabled={form.formState.isSubmitting}>
                        Previous
                    </Button>
                )}
                 {isMultiPage && currentPageIndex < pages.length - 1 && (
                     <Button type="button" onClick={handleNext} disabled={form.formState.isSubmitting} className="ml-auto">
                        Next
                    </Button>
                 )}
                {currentPageIndex === pages.length - 1 && (
                    <Button type="submit" size="lg" disabled={form.formState.isSubmitting || isSubmitDisabled} className={cn(isMultiPage && "ml-auto")}>
                        {form.formState.isSubmitting ? 'Submitting...' : isSubmitDisabled ? 'Submission Disabled' : 'Submit Survey'}
                    </Button>
                )}
            </div>
        </form>
    );
}
