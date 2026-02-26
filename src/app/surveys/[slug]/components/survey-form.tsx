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
import { CalendarIcon, Star, Upload, File as FileIcon, X, Check, Loader2, ArrowRight, AlertCircle, Zap, Trophy as TrophyIcon, Asterisk } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import VideoEmbed from '@/components/video-embed';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { SmartSappIcon } from '@/components/icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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

/**
 * Unified helper to check if a survey field value is effectively empty.
 */
const isValueEmpty = (value: any, questionType: string): boolean => {
    if (value === undefined || value === null || value === '') return true;
    
    if (Array.isArray(value)) return value.length === 0;
    
    if (questionType === 'rating' && (value === 0 || value === '0')) return true;
    
    if (questionType === 'checkboxes' && typeof value === 'object') {
        const options = (value as any).options;
        const other = (value as any).other;
        if (options !== undefined || other !== undefined) {
            return (!options || options.length === 0) && !other;
        }
    }
    
    if (value instanceof Date) return !isValid(value);
    
    if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length === 0;
    }
    
    return false;
}

const StarRating = ({ value, onChange, disabled }: { value: number, onChange: (value: number) => void, disabled?: boolean }) => {
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
                <Star
                    key={star}
                    className={cn(
                        'w-7 h-7 cursor-pointer',
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
                <Button variant="outline" className={cn("w-full sm:w-[240px] justify-start text-left font-normal h-11 bg-white rounded-xl", !dateValue && "text-muted-foreground")} disabled={disabled}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateValue ? format(dateValue, "PPP") : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
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
    if (file) {
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
    }
  };
  
  const handleRemoveFile = () => {
      onChange(undefined);
  };
  
  if (uploadProgress !== null && fileName) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
                <FileIcon className="h-4 w-4 text-muted-foreground" />
                <span className="truncate flex-1 font-medium">{fileName}</span>
                {uploadProgress === 100 ? <span className="text-green-600 font-bold">Done!</span> : <span className="font-bold">{Math.round(uploadProgress)}%</span>}
            </div>
            <Progress value={uploadProgress} className="h-1.5" />
            {error && <p className="text-xs text-destructive font-medium">{error}</p>}
        </div>
    );
  }

  if (value && fileName) {
    return (
      <div className="flex items-center gap-2 p-2 border border-primary/20 rounded-xl bg-primary/5">
        <FileIcon className="h-4 w-4 text-primary" />
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs font-bold truncate flex-1 hover:underline">{fileName}</a>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={handleRemoveFile} disabled={disabled}>
            <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button asChild variant="outline" disabled={disabled} className="h-11 px-5 rounded-xl border-2 border-dashed bg-white hover:bg-slate-50 transition-all text-[10.4px] font-bold uppercase tracking-tight">
        <div className="cursor-pointer">
            <Upload className="mr-2 h-3.5 w-3.5 text-primary" />
            <span>Upload a file</span>
        </div>
      </Button>
      <input
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
    onAutoAdvance,
    clearError
}: { 
    element: SurveyElement; 
    control: any, 
    errors: any; 
    isVisible: boolean; 
    isRequired: boolean; 
    surveyId: string; 
    onAutoAdvance?: () => void;
    clearError: (id: string) => void;
}) => {

    if (isLogic(element) || !isVisible) {
        return null;
    }
    
    if (isQuestion(element)) {
        const question = element;
        const textAlign = question.style?.textAlign || 'left';
        const isTextInput = ['text', 'long-text'].includes(question.type);
        
        const handleValueChange = (val: any, onChange: (v: any) => void) => {
            onChange(val);
            clearError(question.id);
            if (question.autoAdvance && onAutoAdvance && (question.type === 'multiple-choice' || question.type === 'yes-no')) {
                setTimeout(onAutoAdvance, 300);
            }
        };

        return (
            <div id={question.id} className={cn("space-y-2", textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left')}>
                <div className="space-y-1">
                    <Label className="text-[12.8px] font-bold block leading-tight text-foreground">
                        <span dangerouslySetInnerHTML={{ __html: question.title }} />
                        {isRequired && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {question.placeholder && !isTextInput && (
                        <p className="text-[10px] text-muted-foreground font-medium whitespace-pre-wrap leading-tight">
                            {question.placeholder}
                        </p>
                    )}
                </div>
                <div className="mt-1">
                    {question.type === 'text' && (
                        <Controller control={control} name={question.id} render={({ field }) => (
                            <Input 
                                {...field} 
                                value={field.value || ''} 
                                onChange={(e) => handleValueChange(e.target.value, field.onChange)}
                                placeholder={question.placeholder || "Type your answer here..."} 
                                className={cn("text-[11.2px] h-11 bg-white border-2 border-slate-200 focus:border-primary focus-visible:ring-0 transition-all rounded-xl px-4 shadow-none", errors[question.id] && "border-destructive")} 
                            />
                        )} />
                    )}
                    {question.type === 'long-text' && (
                        <Controller control={control} name={question.id} render={({ field }) => (
                            <Textarea 
                                {...field} 
                                value={field.value || ''} 
                                onChange={(e) => handleValueChange(e.target.value, field.onChange)}
                                placeholder={question.placeholder || "Share your thoughts..."} 
                                className={cn("text-[11.2px] min-h-[120px] bg-white border-2 border-slate-200 focus:border-primary focus-visible:ring-0 transition-all rounded-xl p-4 shadow-none", errors[question.id] && "border-destructive")} 
                            />
                        )} />
                    )}
                    {question.type === 'yes-no' && (
                        <Controller
                            control={control}
                            name={question.id}
                            render={({ field }) => (
                                <RadioGroup onValueChange={(v) => handleValueChange(v, field.onChange)} value={field.value} className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3", textAlign === 'center' && 'mx-auto max-w-lg')}>
                                    <Label htmlFor={`${question.id}-yes`} className={cn(
                                        "flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 text-[11.2px] font-medium transition-all hover:bg-slate-50 active:scale-[0.98]",
                                        field.value === 'Yes' ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-slate-100 bg-white",
                                        errors[question.id] && "border-destructive bg-destructive/5"
                                    )}>
                                        <RadioGroupItem value="Yes" id={`${question.id}-yes`} className="size-4 border-2" />
                                        Yes
                                    </Label>
                                    <Label htmlFor={`${question.id}-no`} className={cn(
                                        "flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 text-[11.2px] font-medium transition-all hover:bg-slate-50 active:scale-[0.98]",
                                        field.value === 'No' ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-slate-100 bg-white",
                                        errors[question.id] && "border-destructive bg-destructive/5"
                                    )}>
                                        <RadioGroupItem value="No" id={`${question.id}-no`} className="size-4 border-2" />
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
                                <RadioGroup onValueChange={(v) => handleValueChange(v, field.onChange)} value={field.value} className={cn("space-y-2", textAlign === 'center' && 'mx-auto max-w-xl')}>
                                    {question.options?.map(opt => (
                                        <Label key={opt} htmlFor={`${question.id}-${opt}`} className={cn(
                                            "flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 text-[11.2px] font-medium transition-all hover:bg-slate-50 active:scale-[0.98]",
                                            field.value === opt ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-slate-100 bg-white",
                                            errors[question.id] && "border-destructive bg-destructive/5"
                                        )}>
                                            <RadioGroupItem value={opt} id={`${question.id}-${opt}`} className="size-4 border-2" />
                                            <span className="flex-1">{opt}</span>
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
                                <div className={cn("space-y-2", textAlign === 'center' && 'mx-auto max-w-xl')}>
                                    {question.options?.map(opt => {
                                        const isChecked = question.allowOther ? field.value?.options?.includes(opt) : field.value?.includes(opt);
                                        return (
                                            <Label key={opt} htmlFor={`${question.id}-${opt}`} className={cn(
                                                "flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 text-[11.2px] font-medium transition-all hover:bg-slate-50 active:scale-[0.98]",
                                                isChecked ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-slate-100 bg-white",
                                                errors[question.id] && "border-destructive bg-destructive/5"
                                            )}>
                                                <Checkbox
                                                    id={`${question.id}-${opt}`}
                                                    checked={isChecked}
                                                    onCheckedChange={(checked) => {
                                                        if (question.allowOther) {
                                                            const currentOptions = field.value?.options || [];
                                                            const newOptions = checked ? [...currentOptions, opt] : currentOptions.filter((v:string) => v !== opt);
                                                            handleValueChange({ ...(field.value || {}), options: newOptions }, field.onChange);
                                                        } else {
                                                            const currentVal = field.value || [];
                                                            const newVal = checked ? [...currentVal, opt] : currentVal.filter((v:string) => v !== opt);
                                                            handleValueChange(newVal, field.onChange);
                                                        }
                                                    }}
                                                    className="size-4 border-2"
                                                />
                                                <span className="flex-1">{opt}</span>
                                            </Label>
                                        )
                                    })}
                                    {question.allowOther && (
                                        <div className={cn(
                                            "flex items-center gap-3 rounded-xl border-2 p-4 transition-all active:scale-[0.98]",
                                            (field.value?.other || '') ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-slate-100 bg-white",
                                            errors[question.id] && "border-destructive bg-destructive/5"
                                        )}>
                                            <Checkbox
                                                id={`${question.id}-other-checkbox`}
                                                checked={!!(field.value?.other || '')}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setTimeout(() => document.getElementById(`${question.id}-other-input`)?.focus(), 0);
                                                    } else {
                                                        handleValueChange({ ...(field.value || {}), other: '' }, field.onChange);
                                                    }
                                                }}
                                                className="size-4 border-2"
                                            />
                                            <Input
                                                id={`${question.id}-other-input`}
                                                placeholder="Other (please specify)"
                                                className="h-7 flex-1 border-0 bg-transparent p-0 text-[11.2px] shadow-none focus-visible:ring-0 font-medium"
                                                value={field.value?.other || ''}
                                                onChange={(e) => handleValueChange({ ...(field.value || {}), other: e.target.value }, field.onChange)}
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
                                <Select onValueChange={(v) => handleValueChange(v, field.onChange)} value={field.value}>
                                    <SelectTrigger className={cn("w-full sm:w-1/2 text-[11.2px] h-11 bg-white border-2 border-slate-200 rounded-xl px-4", textAlign === 'center' && 'mx-auto', errors[question.id] && "border-destructive")}>
                                        <SelectValue placeholder="Select an option" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {question.options?.map(opt => (
                                            <SelectItem key={opt} value={opt} className="text-[11.2px] font-normal">{opt}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    )}
                    {question.type === 'rating' && (
                        <Controller control={control} name={question.id} render={({ field }) => (
                            <div className={cn("flex flex-col", textAlign === 'center' ? 'items-center' : textAlign === 'right' ? 'items-end' : 'items-start')}>
                                <div className={cn("p-1.5 rounded-xl", errors[question.id] && "ring-2 ring-destructive bg-destructive/5")}>
                                    <StarRating value={field.value || 0} onChange={(v) => handleValueChange(v, field.onChange)} />
                                </div>
                            </div>
                        )} />
                    )}
                    {question.type === 'date' && (
                        <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}>
                            <Controller control={control} name={question.id} render={({ field }) => (
                                <div className={cn("rounded-xl", errors[question.id] && "ring-2 ring-destructive")}>
                                    <DatePicker value={field.value} onChange={(v) => handleValueChange(v, field.onChange)} />
                                </div>
                            )} />
                        </div>
                    )}
                    {question.type === 'time' && (
                        <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}>
                            <Controller control={control} name={question.id} render={({ field }) => <Input type="time" step="1" className={cn("w-full sm:w-fit bg-white border-2 border-slate-200 appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none text-[11.2px] h-11 px-4 font-bold rounded-xl shadow-none focus:border-primary focus-visible:ring-0", errors[question.id] && "border-destructive")} {...field} value={field.value || ''} onChange={(e) => handleValueChange(e.target.value, field.onChange)} />} />
                        </div>
                    )}
                    {question.type === 'file-upload' && (
                        <div className={cn("flex", textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start')}>
                            <Controller
                                control={control}
                                name={question.id}
                                render={({ field }) => (
                                    <div className={cn("rounded-xl", errors[question.id] && "ring-2 ring-destructive bg-destructive/5")}>
                                        <FileUpload
                                            value={field.value}
                                            onChange={(v) => handleValueChange(v, field.onChange)}
                                            disabled={false}
                                            surveyId={survey.id}
                                        />
                                    </div>
                                )}
                            />
                        </div>
                    )}
                    <AnimatePresence>
                        {errors[question.id] && (
                            <motion.p 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-[10px] font-black text-destructive mt-2.5 flex items-center gap-1 px-1 uppercase tracking-tighter"
                            >
                                <X className="h-3 w-3" />
                                { (errors as any)[question.id]?.message }
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        )
    } else {
        const block = element as SurveyLayoutBlock;
        const textAlign = block.style?.textAlign || 'left';
        const alignmentClass = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left';

        switch (block.type) {
            case 'section':
                return null;
            case 'heading': {
                const Tag = block.variant || 'h2';
                const sizeClass = Tag === 'h1' ? "text-[19.2px] sm:text-[25.6px] font-black" : Tag === 'h3' ? "text-[11.2px] sm:text-[12.8px] font-bold" : "text-[14.4px] sm:text-[16px] font-bold";
                return (
                    <Tag id={block.id} className={cn(sizeClass, alignmentClass, "mt-1 mb-3 leading-tight whitespace-pre-wrap")}>
                        <span dangerouslySetInnerHTML={{ __html: block.title || '' }} />
                    </Tag>
                );
            }
            case 'description':
                return (
                    <div id={block.id} className={cn("text-muted-foreground my-3 text-[9.6px] sm:text-[11.2px] leading-relaxed font-medium whitespace-pre-wrap", alignmentClass)}>
                        <div dangerouslySetInnerHTML={{ __html: block.text || '' }} />
                    </div>
                );
            case 'divider':
                return <hr className="my-4 sm:my-6 border-slate-100" />;
            case 'image':
                return block.url ? (
                    <div className={cn("relative my-5 rounded-xl overflow-hidden shadow-xl border-4 border-white", textAlign === 'center' ? 'mx-auto max-w-2xl' : '')}>
                        <img src={block.url} alt={block.title || 'Survey Image'} className="w-full h-auto" />
                    </div>
                ) : null;
            case 'video':
                 return block.url ? <div className={cn("my-5 shadow-xl rounded-xl overflow-hidden border-4 border-white", textAlign === 'center' ? 'mx-auto max-w-2xl' : '')}><VideoEmbed url={block.url} /></div> : null;
            case 'audio':
                return block.url ? <div className="my-5 p-5 bg-slate-50 border border-slate-100 rounded-xl"><audio controls src={block.url} className="w-full text-xs">Your browser does not support the audio element.</audio></div> : null;
            case 'document':
                return (
                    <div className={cn("my-5", alignmentClass)}>
                        <Button asChild variant="outline" className="h-11 px-7 rounded-xl border-2 font-bold shadow-sm transition-all hover:bg-slate-50 text-[10.4px] uppercase tracking-tight"><a href={block.url} target="_blank" rel="noopener noreferrer"><FileIcon className="mr-2 h-4 w-4 text-primary"/> Download Document</a></Button>
                    </div>
                );
            case 'embed':
                return block.html ? <div className="my-5 rounded-xl overflow-hidden border shadow-sm" dangerouslySetInnerHTML={{ __html: block.html }} /> : null;
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

function SurveyStepper({ pages, pageStatuses, currentIndex }: { pages: SurveyElement[][], pageStatuses: {isValid: boolean}[], currentIndex: number }) {
    const hasCover = pages[0].length === 0;
    const actualPagesCount = hasCover ? pages.length - 1 : pages.length;
    if (actualPagesCount <= 1) return null;

    if (hasCover && currentIndex === 0) return null;

    const displayIndex = hasCover ? currentIndex - 1 : currentIndex;
    const displayPages = hasCover ? pages.slice(1) : pages;

    return (
        <div className="w-full mb-1 pt-6 pb-1 no-scrollbar overflow-x-auto">
            <div className="w-full flex items-start justify-center gap-1 sm:gap-4 px-2 min-w-fit">
                {displayPages.map((page, index) => {
                    const section = page[0] as SurveyLayoutBlock;
                    const title = section?.stepperTitle || section?.title || `Step ${index + 1}`;
                    const actualIdx = index + (hasCover ? 1 : 0);
                    const isCompleted = actualIdx < currentIndex;
                    const isActive = actualIdx === currentIndex;
                    const isInvalid = !pageStatuses[actualIdx].isValid;
                    const isLast = index === displayPages.length - 1;

                    return (
                        <div key={index} className="flex-1 relative flex flex-col items-center min-w-[60px]">
                            {!isLast && (
                                <div className="absolute left-[50%] right-[-50%] top-4 h-[2px] bg-slate-200 z-0">
                                    <motion.div 
                                        initial={false}
                                        animate={{ width: isCompleted ? '100%' : '0%' }}
                                        className={cn("h-full", isInvalid ? "bg-destructive" : "bg-primary")}
                                    />
                                </div>
                            )}

                            <div className="relative z-10 flex items-center justify-center">
                                <motion.div
                                    initial={false}
                                    animate={{
                                        backgroundColor: isCompleted ? (isInvalid ? '#ef4444' : '#22c55e') : isActive ? '#3B5FFF' : '#fff',
                                        borderColor: isCompleted ? (isInvalid ? '#ef4444' : '#22c55e') : isActive ? '#3B5FFF' : '#e2e8f0',
                                        scale: isActive ? 1.2 : 1,
                                    }}
                                    className={cn(
                                        "w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-md transition-colors",
                                        (isCompleted || isActive) ? "text-white" : "text-muted-foreground"
                                    )}
                                >
                                    {isCompleted && !isInvalid ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        <span className="text-xs font-black">{index + 1}</span>
                                    )}
                                </motion.div>
                            </div>

                            <div className="mt-3 text-center px-1 w-full">
                                <p className={cn(
                                    "text-[10px] font-black uppercase tracking-widest leading-tight line-clamp-2 h-8",
                                    isActive ? "text-foreground block" : "text-muted-foreground opacity-60 hidden sm:block",
                                    isCompleted && isInvalid && "text-destructive opacity-100"
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
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const [showMissingFieldsModal, setShowMissingFieldsModal] = React.useState(false);
    const [missingFields, setMissingFields] = React.useState<{ id: string, label: string, pageIndex: number }[]>([]);

    const isAllSectionsStrict = React.useMemo(() => {
        const sections = survey.elements.filter(el => el.type === 'section');
        if (sections.length === 0) return false;
        return sections.every((s: any) => s.validateBeforeNext);
    }, [survey.elements]);

    const pages = React.useMemo(() => {
        const p: SurveyElement[][] = [];
        let currentPage: SurveyElement[] = [];

        if (survey.showCoverPage && survey.showSurveyTitles !== false) {
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
    }, [survey.elements, survey.showCoverPage, survey.showSurveyTitles]);

    const pageStatuses = React.useMemo(() => {
        return pages.map((pageElements) => {
            if (pageElements.length === 0) return { isValid: true };

            const hasIncompleteRequired = pageElements
                .filter(isQuestion)
                .some(q => {
                    const state = elementStates[q.id];
                    if (!state?.isVisible || !state?.isRequired) return false;
                    
                    const value = watchedValues[q.id];
                    return isValueEmpty(value, q.type);
                });
            
            return { isValid: !hasIncompleteRequired };
        });
    }, [pages, watchedValues, elementStates]);

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

    const validateAllRequired = (data: any) => {
        const missing: { id: string, label: string, pageIndex: number }[] = [];
        
        survey.elements.filter(isQuestion).forEach(q => {
            const state = elementStates[q.id];
            if (state?.isVisible && state?.isRequired) {
                const value = data[q.id];
                
                if (isValueEmpty(value, q.type)) {
                    form.setError(q.id, { type: 'manual', message: 'This field is required.' });
                    const pageIdx = pages.findIndex(p => p.some(el => el.id === q.id));
                    const cleanLabel = q.title.replace(/<[^>]*>?/gm, '').trim();
                    missing.push({ id: q.id, label: cleanLabel || 'Question', pageIndex: pageIdx });
                }
            }
        });
        
        return missing;
    };

    const onInvalid = (errors: any) => {
        const data = form.getValues();
        const missing = validateAllRequired(data);
        
        if (missing.length > 0) {
            if (!isAllSectionsStrict) {
                setMissingFields(missing);
                setShowMissingFieldsModal(true);
            } else {
                const firstErrorId = missing[0].id;
                const pageIdx = missing[0].pageIndex;
                if (pageIdx !== -1 && pageIdx !== currentPageIndex) {
                    setCurrentPageIndex(pageIdx);
                }
                setTimeout(() => {
                    const element = document.getElementById(firstErrorId);
                    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 500);
            }
        } else {
            const firstErrorId = Object.keys(errors)[0];
            const pageIdx = pages.findIndex(p => p.some(el => el.id === firstErrorId));
            if (pageIdx !== -1 && pageIdx !== currentPageIndex) {
                setCurrentPageIndex(pageIdx);
            }
            setTimeout(() => {
                const element = document.getElementById(firstErrorId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 500);
        }
    };

    const onSubmit = async (data: z.infer<typeof surveySchema>) => {
        if (isPreview) {
            toast({ title: 'Preview Submission', description: 'This is a preview. No data was saved.' });
            onSubmitted();
            return;
        }

        survey.elements.filter(isQuestion).forEach(q => form.clearErrors(q.id));

        const missing = validateAllRequired(data);
        if (missing.length > 0) {
            if (!isAllSectionsStrict) {
                setMissingFields(missing);
                setShowMissingFieldsModal(true);
            } else {
                onInvalid({});
            }
            return;
        }

        if (!firestore) return;

        setIsSubmitting(true);
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
            
            // Webhook Data Push
            if (survey.webhookUrl) {
                const outcome = resolveOutcome(score);
                const webhookPayload: Record<string, any> = {
                    survey_title: survey.title,
                    survey_id: survey.id,
                    submission_id: docRef.id,
                    submitted_at: responseData.submittedAt,
                    score: score,
                    outcome_label: outcome?.label || 'Default',
                };

                // Add the absolute result URL to the payload
                if (typeof window !== 'undefined') {
                    webhookPayload.result_url = `${window.location.origin}/surveys/${survey.slug}/result/${docRef.id}`;
                }

                // Construct flattened question answers
                survey.elements.filter(isQuestion).forEach(q => {
                    const answerValue = cleanedData[q.id];
                    if (answerValue !== undefined) {
                        const key = q.title.replace(/<[^>]*>?/gm, '').trim() || q.id;
                        let val = answerValue;
                        if (q.type === 'checkboxes' && typeof answerValue === 'object') {
                            val = answerValue.options?.join(', ');
                            if (answerValue.other) val += `, Other: ${answerValue.other}`;
                        } else if (Array.isArray(answerValue)) {
                            val = answerValue.join(', ');
                        }
                        webhookPayload[key] = val;
                    }
                });

                // Non-blocking fire and forget push
                fetch(survey.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(webhookPayload),
                }).catch(err => console.error("Webhook push failed:", err));
            }

            // Artificial delay for UX visibility of the preloader
            await new Promise(resolve => setTimeout(resolve, 800));

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
            setIsSubmitting(false);
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

        const formData = form.getValues();

        const pageSection = currentElements[0]?.type === 'section' ? (currentElements[0] as SurveyLayoutBlock) : null;
        if (pageSection?.validateBeforeNext) {
            const questionsOnPage = currentElements.filter(isQuestion);
            
            questionsOnPage.forEach(q => form.clearErrors(q.id));

            const invalidQuestionsOnPage = questionsOnPage
                .filter(q => {
                    const state = elementStates[q.id];
                    if (!state?.isVisible || !state?.isRequired) return false;
                    
                    const value = formData[q.id];
                    return isValueEmpty(value, q.type);
                });
            
            if (invalidQuestionsOnPage.length > 0) {
                invalidQuestionsOnPage.forEach(q => {
                    form.setError(q.id, { type: 'manual', message: 'This field is required.' });
                });
                return; 
            }
        }

        let nextPageIndex = currentPageIndex + 1; 

        const logicBlocks = survey.elements.filter(isLogic);
        let jumpAction = false;
        
        for (const block of logicBlocks) {
            const blockPageIndex = pages.findIndex(p => p.some(el => el.id === block.id));
            if (blockPageIndex > currentPageIndex) continue;

            for (const rule of block.rules) {
                const answer = formData[rule.sourceQuestionId];
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
    };

    const handlePrev = () => {
        setCurrentPageIndex(prev => prev - 1);
        window.scrollTo(0, 0);
    };

    const handleOkMissingFields = () => {
        setShowMissingFieldsModal(false);
        if (missingFields.length > 0) {
            const first = missingFields[0];
            setCurrentPageIndex(first.pageIndex);
            setTimeout(() => {
                const element = document.getElementById(first.id);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const input = element.querySelector('input, select, textarea, button');
                    if (input instanceof HTMLElement) {
                        input.focus();
                    }
                }
            }, 1000);
        }
    };

    const currentElements = pages[currentPageIndex];
    const isCoverPage = currentElements.length === 0;
    const pageSection = !isCoverPage && currentElements[0]?.type === 'section' ? (currentElements[0] as SurveyLayoutBlock) : null;
    const showTitles = survey.showSurveyTitles !== false;

    if (isCoverPage) {
        return (
            <div className="flex flex-col items-center text-center space-y-6 sm:space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <div className="flex justify-center mb-1 sm:mb-4">
                    {survey.logoUrl ? (
                        <div className="relative h-10 w-40 sm:h-14 sm:w-56">
                            <Image src={survey.logoUrl} alt="Logo" fill className="object-contain" />
                        </div>
                    ) : (
                        <SmartSappLogo className="h-10 sm:h-14" />
                    )}
                </div>
                {showTitles && (
                    <>
                        {survey.bannerImageUrl && (
                            <div className="relative w-full rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white bg-white">
                                <img 
                                    src={survey.bannerImageUrl} 
                                    alt={survey.title || ''} 
                                    className="w-full h-auto block" 
                                />
                            </div>
                        )}
                        <div className="space-y-5 max-w-3xl mx-auto px-4">
                            <h1 className="text-[14.4px] sm:text-[16px] md:text-[19.2px] font-bold tracking-tighter text-foreground leading-[1.1]">{survey.title}</h1>
                            <div className="text-[9.6px] sm:text-[11.2px] text-muted-foreground leading-relaxed prose prose-slate font-medium whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: survey.description }} />
                        </div>
                    </>
                )}
                <button type="button" className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-[11.2px] ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-7 sm:text-base font-bold rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 w-full sm:w-auto mt-6" onClick={handleNext}>
                    {survey.startButtonText || "Let's Start"} <ArrowRight className="ml-2 h-6 w-6" />
                </button>
            </div>
        )
    }

    return (
        <div className="pb-24">
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-3 sm:space-y-10">
                {pageSection && (
                    <div className="text-center space-y-3 mb-6 sm:mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <h2 className="text-[16.8px] sm:text-[24px] font-semibold tracking-tight text-foreground" dangerouslySetInnerHTML={{ __html: pageSection.title || '' }} />
                        {pageSection.description && (
                            <div className="text-muted-foreground text-[11.2px] sm:text-[14.4px] leading-relaxed max-w-3xl mx-auto font-medium italic whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: pageSection.description }} />
                        )}
                    </div>
                )}

                <SurveyStepper pages={pages} pageStatuses={pageStatuses} currentIndex={currentPageIndex} />
                
                <Card className="border-t-8 border-t-primary shadow-2xl rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden bg-white">
                    <CardContent className="p-5 sm:p-8 space-y-6 sm:space-y-8">
                        <div className="space-y-6 sm:space-y-8">
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
                                        clearError={(id) => form.clearErrors(id)}
                                    />
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                 <div className={cn("flex flex-col sm:flex-row items-center mt-10 gap-3 px-4", isMultiPage ? "sm:justify-between" : "sm:justify-end")}>
                    {isMultiPage && currentPageIndex > 0 && (
                        <Button type="button" variant="ghost" size="lg" className="h-12 px-8 rounded-2xl font-black text-muted-foreground hover:text-foreground hover:bg-slate-100 w-full sm:w-auto text-[11.2px] uppercase tracking-tight" onClick={handlePrev} disabled={isSubmitting}>
                            Previous
                        </Button>
                    )}
                     {isMultiPage && currentPageIndex < pages.length - 1 && (
                         <Button type="button" size="lg" className="h-12 px-8 rounded-2xl font-black shadow-xl w-full sm:w-auto sm:ml-auto transition-transform hover:scale-105 text-[11.2px] uppercase tracking-tight" onClick={handleNext} disabled={isSubmitting}>
                            Next <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                     )}
                    {currentPageIndex === pages.length - 1 && (
                        <Button type="submit" size="lg" className={cn("h-12 px-10 rounded-2xl font-black shadow-2xl transition-all hover:scale-105 w-full sm:w-auto bg-primary text-primary-foreground text-[11.2px] uppercase tracking-tight", isMultiPage && "sm:ml-auto")} disabled={isSubmitting || isSubmitDisabled}>
                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : isSubmitDisabled ? 'Submission Disabled' : 'Submit Survey'}
                        </Button>
                    )}
                </div>
            </form>

            <AnimatePresence>
                {isSubmitting && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md"
                    >
                        <motion.div 
                            animate={{ 
                                scale: [1, 1.1, 1],
                                opacity: [0.8, 1, 0.8]
                            }}
                            transition={{ 
                                duration: 2, 
                                repeat: Infinity, 
                                ease: "easeInOut" 
                            }}
                            className="flex flex-col items-center gap-6"
                        >
                            <SmartSappIcon className="h-20 w-20 text-primary drop-shadow-2xl" />
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-black tracking-tighter text-foreground">Submitting your response</h3>
                                <p className="text-muted-foreground font-medium text-sm">Please wait while we secure your data...</p>
                            </div>
                            <Loader2 className="h-6 w-6 animate-spin text-primary mt-4" />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Dialog open={showMissingFieldsModal} onOpenChange={setShowMissingFieldsModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle className="h-6 w-6 text-destructive" />
                        </div>
                        <DialogTitle className="text-center text-lg">Required Fields Missing</DialogTitle>
                        <DialogDescription className="text-center pt-1.5 text-xs font-medium">
                            Please complete the following fields before submitting your survey:
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[30vh] border rounded-md my-4">
                        <ul className="p-4 space-y-2">
                            {missingFields.map((field, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-xs font-medium">
                                    <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                                    <span className="font-bold">{field.label}</span>
                                </li>
                            ))}
                        </ul>
                    </ScrollArea>
                    <DialogFooter>
                        <Button onClick={handleOkMissingFields} className="w-full font-bold h-11 rounded-xl text-sm">OK, take me there</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}