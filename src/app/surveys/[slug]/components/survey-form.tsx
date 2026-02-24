'use client';

import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDoc, collection } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import type { Survey, SurveyQuestion, SurveyElement, SurveyLogicBlock, SurveyLayoutBlock, SurveyResultRule } from '@/lib/types';
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
import { CalendarIcon, Star, Upload, File as FileIcon, X, Check, Loader2, ArrowRight } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import VideoEmbed from '@/components/video-embed';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { SmartSappLogo } from '@/components/icons';

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
                <Button variant="outline" className={cn("w-full sm:w-[280px] justify-start text-left font-normal h-11", !dateValue && "text-muted-foreground")} disabled={disabled}>
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
      <Button asChild variant="outline" disabled={disabled} className="h-11">
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


const ElementRenderer = ({ 
    element, 
    control, 
    errors, 
    isVisible, 
    isRequired, 
    surveyId,
    onAutoAdvance
}: { 
    element: SurveyElement; 
    control: any, 
    errors: any; 
    isVisible: boolean; 
    isRequired: boolean; 
    surveyId: string; 
    onAutoAdvance?: () => void;
}) => {

    if (isLogic(element) || !isVisible) {
        return null;
    }
    
    if (isQuestion(element)) {
        const question = element;
        const textAlign = question.style?.textAlign || 'left';
        
        const handleRadioChange = (val: string, onChange: (v: string) => void) => {
            onChange(val);
            if (question.autoAdvance && onAutoAdvance) {
                setTimeout(onAutoAdvance, 300);
            }
        };

        return (
            <div id={question.id} className={cn("space-y-4", textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left')}>
                <Label className="text-lg font-bold block leading-tight text-foreground/90">
                    <span dangerouslySetInnerHTML={{ __html: question.title }} />
                    {isRequired && <span className="text-destructive ml-1">*</span>}
                </Label>
                <div className="mt-2">
                    {question.type === 'text' && (
                        <Controller control={control} name={question.id} render={({ field }) => <Input {...field} value={field.value || ''} placeholder={question.placeholder} className="text-base h-12 bg-white border-border/50" />} />
                    )}
                    {question.type === 'long-text' && (
                        <Controller control={control} name={question.id} render={({ field }) => <Textarea {...field} value={field.value || ''} placeholder={question.placeholder} className="text-base min-h-[120px] bg-white border-border/50" />} />
                    )}
                    {question.type === 'yes-no' && (
                        <Controller
                            control={control}
                            name={question.id}
                            render={({ field }) => (
                                    <RadioGroup onValueChange={(v) => handleRadioChange(v, field.onChange)} value={field.value} className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4", textAlign === 'center' && 'mx-auto max-w-lg')}>
                                    <Label htmlFor={`${question.id}-yes`} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-4 text-base font-normal transition-all hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                        <RadioGroupItem value="Yes" id={`${question.id}-yes`} />
                                        Yes
                                    </Label>
                                    <Label htmlFor={`${question.id}-no`} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-4 text-base font-normal transition-all hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5">
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
                                <RadioGroup onValueChange={(v) => handleRadioChange(v, field.onChange)} value={field.value} className={cn("space-y-3", textAlign === 'center' && 'mx-auto max-w-lg')}>
                                    {question.options?.map(opt => (
                                        <Label key={opt} htmlFor={`${question.id}-${opt}`} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-4 text-base font-normal transition-all hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5">
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
                                <div className={cn("space-y-3", textAlign === 'center' && 'mx-auto max-w-lg')}>
                                    {question.options?.map(opt => {
                                        const isChecked = question.allowOther ? field.value?.options?.includes(opt) : field.value?.includes(opt);
                                        return (
                                            <Label key={opt} htmlFor={`${question.id}-${opt}`} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 text-base font-normal transition-all hover:bg-accent", isChecked && "border-primary bg-primary/5")}>
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
                                        <div className={cn("flex items-center gap-3 rounded-xl border bg-white p-4 transition-all", (field.value?.other || '') && "border-primary bg-primary/5")}>
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
                                                className="h-8 flex-1 border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0 font-normal"
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
                                    <SelectTrigger className={cn("w-full sm:w-1/2 text-base h-12 bg-white border-border/50", textAlign === 'center' && 'mx-auto')}>
                                        <SelectValue placeholder="Select an option" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {question.options?.map(opt => (
                                            <SelectItem key={opt} value={opt} className="text-base font-normal">{opt}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    )}
                    {question.type === 'rating' && (
                        <Controller control={control} name={question.id} render={({ field }) => (
                            <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}>
                                <StarRating {...field} />
                            </div>
                        )} />
                    )}
                    {question.type === 'date' && (
                        <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}>
                            <Controller control={control} name={question.id} render={({ field }) => <DatePicker {...field} />} />
                        </div>
                    )}
                    {question.type === 'time' && (
                        <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}>
                            <Controller control={control} name={question.id} render={({ field }) => <Input type="time" step="1" className="w-full sm:w-fit bg-white border-border/50 appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none text-base h-12 px-4 font-normal" {...field} value={field.value || ''} />} />
                        </div>
                    )}
                    {question.type === 'file-upload' && (
                        <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}>
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
                        </div>
                    )}
                    {errors[question.id] && (
                        <p className="text-sm font-bold text-destructive mt-2 flex items-center gap-1.5">
                            <X className="h-3.5 w-3.5" />
                            { (errors as any)[question.id]?.message }
                        </p>
                    )}
                </div>
            </div>
        )
    } else {
        const block = element as SurveyLayoutBlock;
        const textAlign = block.style?.textAlign || 'left';
        const alignmentClass = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left';

        switch (block.type) {
            case 'section':
                return null; // Sections handled by the card wrapper
            case 'heading': {
                const Tag = block.variant || 'h2';
                const sizeClass = Tag === 'h1' ? "text-4xl font-black" : Tag === 'h3' ? "text-xl font-bold" : "text-3xl font-bold";
                return (
                    <Tag id={block.id} className={cn(sizeClass, alignmentClass, "mt-2 mb-4")}>
                        <span dangerouslySetInnerHTML={{ __html: block.title || '' }} />
                    </Tag>
                );
            }
            case 'description':
                return (
                    <div id={block.id} className={cn("text-muted-foreground my-4 text-lg leading-relaxed", alignmentClass)}>
                        <div dangerouslySetInnerHTML={{ __html: block.text || '' }} />
                    </div>
                );
            case 'divider':
                return <hr className="my-8 border-border/50" />;
            case 'image':
                return block.url ? (
                    <div className={cn("relative aspect-video my-6 rounded-2xl overflow-hidden shadow-md", textAlign === 'center' ? 'mx-auto max-w-2xl' : '')}>
                        <Image src={block.url} alt={block.title || 'Survey Image'} layout="fill" objectFit="contain" />
                    </div>
                ) : null;
            case 'video':
                 return block.url ? <div className={cn("my-6 shadow-md rounded-2xl overflow-hidden", textAlign === 'center' ? 'mx-auto max-w-2xl' : '')}><VideoEmbed url={block.url} /></div> : null;
            case 'audio':
                return block.url ? <div className="my-6 p-4 bg-muted/30 rounded-xl"><audio controls src={block.url} className="w-full">Your browser does not support the audio element.</audio></div> : null;
            case 'document':
                 return (
                    <div className={cn("my-6", alignmentClass)}>
                        <Button asChild variant="outline" className="h-11 px-6 rounded-xl"><a href={block.url} target="_blank" rel="noopener noreferrer"><FileIcon className="mr-2 h-4 w-4"/> Download Document</a></Button>
                    </div>
                 );
            case 'embed':
                return block.html ? <div className="my-6 rounded-xl overflow-hidden" dangerouslySetInnerHTML={{ __html: block.html }} /> : null;
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
    const hasCover = pages[0].length === 0;
    const actualPagesCount = hasCover ? pages.length - 1 : pages.length;
    if (actualPagesCount <= 1) return null;

    if (hasCover && currentIndex === 0) return null;

    const displayIndex = hasCover ? currentIndex - 1 : currentIndex;
    const displayPages = hasCover ? pages.slice(1) : pages;

    return (
        <div className="w-full mb-12 overflow-x-auto pb-4 no-scrollbar">
            <div className="min-w-full flex items-start justify-center gap-0 sm:gap-2">
                {displayPages.map((page, index) => {
                    const section = page[0] as SurveyLayoutBlock;
                    const title = section?.stepperTitle || section?.title || `Step ${index + 1}`;
                    const isCompleted = index < displayIndex;
                    const isActive = index === displayIndex;
                    const isLast = index === displayPages.length - 1;

                    return (
                        <div key={index} className="flex-1 relative flex flex-col items-center">
                            {!isLast && (
                                <div className="absolute left-[50%] right-[-50%] top-3 h-[1px] bg-muted z-0">
                                    <motion.div 
                                        initial={false}
                                        animate={{ width: isCompleted ? '100%' : '0%' }}
                                        className="h-full bg-green-500"
                                    />
                                </div>
                            )}

                            <div className="relative z-10 flex items-center justify-center">
                                <motion.div
                                    initial={false}
                                    animate={{
                                        backgroundColor: isCompleted ? 'hsl(var(--primary))' : isActive ? 'hsl(var(--primary))' : 'hsl(var(--background))',
                                        borderColor: isCompleted ? 'hsl(var(--primary))' : isActive ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                                        scale: isActive ? 1.1 : 1,
                                    }}
                                    className={cn(
                                        "w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-sm transition-colors",
                                        isCompleted ? "bg-green-500 border-green-500 text-white" : isActive ? "border-primary bg-primary text-white" : "bg-card border-border text-muted-foreground"
                                    )}
                                >
                                    {isCompleted ? (
                                        <Check className="w-3 h-3" />
                                    ) : (
                                        <span className="text-[10px] font-bold">{index + 1}</span>
                                    )}
                                </motion.div>
                            </div>

                            <div className="mt-2 text-center px-2 min-w-[80px]">
                                <p className={cn(
                                    "text-[10px] font-bold leading-tight line-clamp-2 h-8",
                                    isActive ? "text-foreground" : "text-muted-foreground"
                                )}>
                                    {title}
                                </p>
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
    const router = useRouter();
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

        if (survey.showCoverPage) {
            p.push([]); 
        }

        survey.elements.forEach(element => {
            if (element.type === 'section' && (element as any).renderAsPage && currentPage.length > 0) {
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
    }, [survey.elements, survey.showCoverPage]);

    const isMultiPage = pages.length > 1;

    React.useEffect(() => {
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
              }
            }
          });
        });
    
        setElementStates(initialStates);
        setIsSubmitDisabled(newSubmitDisabled);
    
      }, [watchedValues, survey.elements]);


    const calculateScore = (data: any) => {
        if (!survey.scoringEnabled) return undefined;
        let total = 0;
        survey.elements.filter(isQuestion).forEach(q => {
            if (!q.enableScoring) return;
            const answer = data[q.id];
            if (q.type === 'yes-no') {
                if (answer === 'Yes') total += q.yesScore || 0;
                if (answer === 'No') total += q.noScore || 0;
            } else if (q.type === 'multiple-choice' || q.type === 'dropdown') {
                const optIndex = q.options?.indexOf(answer);
                if (optIndex !== undefined && optIndex !== -1) {
                    total += (q.optionScores?.[optIndex] || 0);
                }
            } else if (q.type === 'checkboxes') {
                const selected = q.allowOther ? answer.options : answer;
                if (Array.isArray(selected)) {
                    selected.forEach(val => {
                        const optIndex = q.options?.indexOf(val);
                        if (optIndex !== undefined && optIndex !== -1) {
                            total += (q.optionScores?.[optIndex] || 0);
                        }
                    });
                }
            }
        });
        return total;
    };

    const resolveOutcome = (score: number | undefined): SurveyResultRule | undefined => {
        if (score === undefined || !survey.resultRules) return undefined;
        return [...survey.resultRules]
            .sort((a, b) => a.priority - b.priority)
            .find(rule => score >= rule.minScore && score <= rule.maxScore);
    };

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

        const score = calculateScore(data);
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

        const responseData = {
            surveyId: survey.id,
            submittedAt: new Date().toISOString(),
            answers,
            score,
        };

        const responsesCollection = collection(firestore, `surveys/${survey.id}/responses`);
        form.control.disabled = true;

        try {
            const docRef = await addDoc(responsesCollection, responseData);
            toast({ title: 'Success', description: 'Your response has been submitted.' });
            
            if (survey.scoringEnabled) {
                const rule = resolveOutcome(score);
                if (rule) {
                    router.push(`/surveys/${survey.slug}/result/${docRef.id}`);
                    return;
                }
            }
            
            onSubmitted();
        } catch (error) {
             const permissionError = new FirestorePermissionError({
                path: responsesCollection.path,
                operation: 'create',
                requestResourceData: responseData,
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to submit response.' });
        } finally {
            form.control.disabled = false;
        }
    };

    const handleNext = async () => {
        const currentElements = pages[currentPageIndex];
        if (currentElements.length === 0) {
            setCurrentPageIndex(1);
            window.scrollTo(0, 0);
            return;
        }

        const questionIdsOnPage = currentElements.filter(isQuestion).map(q => q.id);
        const isValid = await form.trigger(questionIdsOnPage);

        if (isValid) {
            let nextPageIndex = currentPageIndex + 1; 

            const logicBlocks = survey.elements.filter(isLogic);
            let jumpAction = false;
            
            for (const block of logicBlocks) {
                const blockPageIndex = pages.findIndex(p => p.some(el => el.id === block.id));
                if (blockPageIndex > currentPageIndex) continue;

                for (const rule of block.rules) {
                    const answer = form.getValues(rule.sourceQuestionId);
                    if (evaluateCondition(answer, rule.operator, rule.targetValue)) {
                        if (rule.action.type === 'jump' && rule.action.targetElementId) {
                            const targetPageIndex = pages.findIndex(p => p.some(el => el.id === rule.action.targetElementId));
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

            if (nextPageIndex < pages.length) {
                setCurrentPageIndex(nextPageIndex);
                window.scrollTo(0, 0);
            }
        } else {
            toast({ variant: 'destructive', title: 'Please fill out all required fields on this page.' });
        }
    };

    const handlePrev = () => {
        setCurrentPageIndex(prev => prev - 1);
        window.scrollTo(0, 0);
    };

    const currentElements = pages[currentPageIndex];
    const isCoverPage = currentElements.length === 0;
    const pageSection = !isCoverPage && currentElements[0]?.type === 'section' ? currentElements[0] : null;

    if (isCoverPage) {
        return (
            <div className="flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex justify-center mb-8">
                    {survey.logoUrl ? (
                        <div className="relative h-12 w-48">
                            <Image src={survey.logoUrl} alt="Logo" fill className="object-contain" />
                        </div>
                    ) : (
                        <SmartSappLogo className="h-12" />
                    )}
                </div>
                {survey.bannerImageUrl && (
                    <div className="relative w-full aspect-[3/1] rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
                        <Image src={survey.bannerImageUrl} alt={survey.title || ''} fill className="object-cover" priority />
                    </div>
                )}
                <div className="space-y-4 max-w-2xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">{survey.title}</h1>
                    <div className="text-xl text-muted-foreground leading-relaxed prose prose-slate" dangerouslySetInnerHTML={{ __html: survey.description }} />
                </div>
                <Button size="lg" className="h-14 px-10 text-xl font-bold rounded-xl shadow-xl transition-transform hover:scale-105 active:scale-95" onClick={handleNext}>
                    {survey.startButtonText || "Let's Start"} <ArrowRight className="ml-2 h-6 w-6" />
                </Button>
            </div>
        )
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <SurveyStepper pages={pages} currentIndex={currentPageIndex} />
            
            {pageSection && (
                <div className="text-center space-y-2 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">{(pageSection as any).title}</h2>
                    {(pageSection as any).description && (
                        <p className="text-muted-foreground text-base leading-relaxed max-w-2xl mx-auto italic">
                            {(pageSection as any).description}
                        </p>
                    )}
                </div>
            )}

            <Card className="border border-primary/20 shadow-xl rounded-3xl overflow-hidden bg-[#F0F7FF]/90 backdrop-blur-sm">
                <CardContent className="p-6 sm:p-12 space-y-12">
                    <div className="space-y-12">
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
                                    onAutoAdvance={currentPageIndex < pages.length - 1 ? handleNext : undefined}
                                />
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

             <div className={cn("flex items-center mt-8", isMultiPage ? "justify-between" : "justify-end")}>
                {isMultiPage && currentPageIndex > 0 && (
                    <Button type="button" variant="outline" size="lg" className="h-12 px-8 rounded-xl font-bold" onClick={handlePrev} disabled={form.formState.isSubmitting}>
                        Previous
                    </Button>
                )}
                 {isMultiPage && currentPageIndex < pages.length - 1 && (
                     <Button type="button" size="lg" className="h-12 px-8 rounded-xl font-bold ml-auto" onClick={handleNext} disabled={form.formState.isSubmitting}>
                        Next <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                 )}
                {currentPageIndex === pages.length - 1 && (
                    <Button type="submit" size="lg" className={cn("h-12 px-10 rounded-xl font-black shadow-lg transition-all hover:scale-105", isMultiPage && "ml-auto")} disabled={form.formState.isSubmitting || isSubmitDisabled}>
                        {form.formState.isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : isSubmitDisabled ? 'Submission Disabled' : 'Submit Survey'}
                    </Button>
                )}
            </div>
        </form>
    );
}
