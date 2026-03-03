
'use client';

import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDoc, collection, getDoc, doc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import type { Survey, SurveyQuestion, SurveyElement, SurveyLogicBlock, SurveyLayoutBlock, SurveyResultRule, Webhook } from '@/lib/types';
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
import { CalendarIcon, Star, Upload, File as FileIcon, X, Check, Loader2, ArrowRight, AlertCircle, Zap, Trophy as TrophyIcon, Asterisk, Globe, Mail, Smartphone, Bell, CheckCircle2, XCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import VideoEmbed from '@/components/video-embed';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { SmartSappIcon, SmartSappLogo } from '@/components/icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { sendMessage } from '@/lib/messaging-engine';
import { triggerInternalNotification } from '@/lib/notification-engine';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { logActivity } from '@/lib/activity-logger';

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
        
        if (q.type === 'text' || q.type === 'long-text' || q.type === 'email' || q.type === 'phone') {
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
    if (typeof value === 'object' && value !== null) return Object.keys(value).length === 0;
    return false;
}

const StarRating = ({ value, onChange, disabled }: { value: number, onChange: (value: number) => void, disabled?: boolean }) => {
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
                <Star
                    key={star}
                    className={cn(
                        'w-10 h-10 cursor-pointer',
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
                <Button variant="outline" className={cn("w-full sm:w-[300px] justify-start text-left font-normal h-12 bg-white rounded-xl text-base", !dateValue && "text-muted-foreground")} disabled={disabled}>
                    <CalendarIcon className="mr-3 h-5 w-5" />
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
        <div className="space-y-3">
            <div className="flex items-center gap-3 text-base">
                <FileIcon className="h-5 w-5 text-muted-foreground" />
                <span className="truncate flex-1 font-medium">{fileName}</span>
                {uploadProgress === 100 ? <span className="text-green-600 font-bold">Done!</span> : <span className="font-bold">{Math.round(uploadProgress)}%</span>}
            </div>
            <Progress value={uploadProgress} className="h-2" />
            {error && <p className="text-sm text-destructive font-medium">{error}</p>}
        </div>
    );
  }

  if (value && fileName) {
    return (
      <div className="flex items-center gap-4 p-3 border border-primary/20 rounded-xl bg-primary/5">
        <FileIcon className="h-5 w-5 text-primary" />
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm font-bold truncate flex-1 hover:underline">{fileName}</a>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={handleRemoveFile} disabled={disabled}>
            <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button asChild variant="outline" disabled={disabled} className="h-12 px-6 rounded-xl border-2 border-dashed bg-white hover:bg-slate-50 transition-all text-base font-bold uppercase tracking-tight">
        <div className="cursor-pointer">
            <Upload className="mr-3 h-4 w-4 text-primary" />
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
        const isTextInput = ['text', 'long-text', 'email', 'phone'].includes(question.type);
        
        const handleValueChange = (val: any, onChange: (v: any) => void) => {
            onChange(val);
            clearError(question.id);
            if (question.autoAdvance && onAutoAdvance && (question.type === 'multiple-choice' || question.type === 'yes-no')) {
                setTimeout(onAutoAdvance, 300);
            }
        };

        return (
            <div id={question.id} className={cn("space-y-4", textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left')}>
                <div className="space-y-1.5">
                    <Label className="text-xl font-bold block leading-snug text-foreground">
                        <span dangerouslySetInnerHTML={{ __html: question.title }} />
                        {isRequired && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {question.placeholder && !isTextInput && (
                        <p className="text-base text-muted-foreground font-medium whitespace-pre-wrap leading-relaxed">
                            {question.placeholder}
                        </p>
                    )}
                </div>
                <div className="mt-1">
                    {(question.type === 'text' || question.type === 'email' || question.type === 'phone') && (
                        <Controller control={control} name={question.id} render={({ field }) => (
                            <Input 
                                {...field} 
                                value={field.value || ''} 
                                type={question.type === 'email' ? 'email' : question.type === 'phone' ? 'tel' : 'text'}
                                onChange={(e) => handleValueChange(e.target.value, field.onChange)}
                                placeholder={question.placeholder || (question.type === 'email' ? 'email@example.com' : question.type === 'phone' ? 'e.g. +233 20 000 0000' : "Type your answer here...")} 
                                className={cn("text-base h-12 bg-white border-2 border-slate-200 focus:border-primary focus-visible:ring-0 transition-all rounded-xl px-4 shadow-none", errors[question.id] && "border-destructive")} 
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
                                className={cn("text-base min-h-[140px] bg-white border-2 border-slate-200 focus:border-primary focus-visible:ring-0 transition-all rounded-xl p-4 shadow-none", errors[question.id] && "border-destructive")} 
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
                                        "flex cursor-pointer items-center gap-4 rounded-xl border-2 py-2.5 px-4 text-base font-medium transition-all hover:bg-slate-50 active:scale-[0.98]",
                                        field.value === 'Yes' ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-slate-100 bg-white",
                                        errors[question.id] && "border-destructive bg-destructive/5"
                                    )}>
                                        <RadioGroupItem value="Yes" id={`${question.id}-yes`} className="size-5 border-2" />
                                        Yes
                                    </Label>
                                    <Label htmlFor={`${question.id}-no`} className={cn(
                                        "flex cursor-pointer items-center gap-4 rounded-xl border-2 py-2.5 px-4 text-base font-medium transition-all hover:bg-slate-50 active:scale-[0.98]",
                                        field.value === 'No' ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-slate-100 bg-white",
                                        errors[question.id] && "border-destructive bg-destructive/5"
                                    )}>
                                        <RadioGroupItem value="No" id={`${question.id}-no`} className="size-5 border-2" />
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
                                            "flex cursor-pointer items-center gap-4 rounded-xl border-2 py-2.5 px-4 text-base font-medium transition-all hover:bg-slate-50 active:scale-[0.98]",
                                            field.value === opt ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-slate-100 bg-white",
                                            errors[question.id] && "border-destructive bg-destructive/5"
                                        )}>
                                            <RadioGroupItem value={opt} id={`${question.id}-${opt}`} className="size-5 border-2" />
                                            <span className="flex-1 leading-tight">{opt}</span>
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
                                                "flex cursor-pointer items-center gap-4 rounded-xl border-2 py-2.5 px-4 text-base font-medium transition-all hover:bg-slate-50 active:scale-[0.98]",
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
                                                            handleValueChange({ ...(field.value || {}), other: field.value?.other || '' }, field.onChange);
                                                            field.onChange({ ...(field.value || {}), options: newOptions });
                                                        } else {
                                                            const currentVal = field.value || [];
                                                            const newVal = checked ? [...currentVal, opt] : currentVal.filter((v:string) => v !== opt);
                                                            handleValueChange(newVal, field.onChange);
                                                        }
                                                    }}
                                                    className="size-5 border-2"
                                                />
                                                <span className="flex-1 leading-tight">{opt}</span>
                                            </Label>
                                        )
                                    })}
                                    {question.allowOther && (
                                        <div className={cn(
                                            "flex items-center gap-4 rounded-xl border-2 py-2.5 px-4 transition-all active:scale-[0.98]",
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
                                                className="size-5 border-2"
                                            />
                                            <Input
                                                id={`${question.id}-other-input`}
                                                placeholder="Other (please specify)"
                                                className="h-9 flex-1 border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0 font-medium"
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
                                    <SelectTrigger className={cn("w-full sm:w-1/2 text-base h-12 bg-white border-2 border-slate-200 rounded-xl px-4", textAlign === 'center' && 'mx-auto', errors[question.id] && "border-destructive")}>
                                        <SelectValue placeholder="Select an option" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
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
                            <div className={cn("flex flex-col", textAlign === 'center' ? 'items-center' : textAlign === 'right' ? 'items-end' : 'items-start')}>
                                <div className={cn("p-2 rounded-2xl", errors[question.id] && "ring-2 ring-destructive bg-destructive/5")}>
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
                            <Controller control={control} name={question.id} render={({ field }) => <Input type="time" step="1" className={cn("w-full sm:w-fit bg-white border-2 border-slate-200 appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none text-base h-12 px-4 font-bold rounded-xl shadow-none focus:border-primary focus-visible:ring-0", errors[question.id] && "border-destructive")} {...field} value={field.value || ''} onChange={(e) => handleValueChange(e.target.value, field.onChange)} />} />
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
                                            surveyId={surveyId}
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
                                className="text-sm font-bold text-destructive mt-3 flex items-center gap-1.5 px-1 uppercase tracking-tighter"
                            >
                                <X className="h-4 w-4" />
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
                const sizeClass = Tag === 'h1' ? "text-3xl sm:text-4xl font-bold" : Tag === 'h3' ? "text-xl font-bold" : "text-2xl font-bold";
                return (
                    <Tag id={block.id} className={cn(sizeClass, alignmentClass, "mt-2 mb-4 leading-tight whitespace-pre-wrap")}>
                        <span dangerouslySetInnerHTML={{ __html: block.title || '' }} />
                    </Tag>
                );
            }
            case 'description':
                return (
                    <div id={block.id} className={cn("text-muted-foreground my-4 text-base sm:text-lg leading-relaxed font-medium whitespace-pre-wrap", alignmentClass)}>
                        <div dangerouslySetInnerHTML={{ __html: block.text || '' }} />
                    </div>
                );
            case 'divider':
                return <hr className="my-6 sm:my-8 border-slate-100" />;
            case 'image':
                return block.url ? (
                    <div className={cn("relative my-6 rounded-xl overflow-hidden shadow-xl border-4 border-white", textAlign === 'center' ? 'mx-auto max-w-2xl' : '')}>
                        <img src={block.url} alt={block.title || 'Survey Image'} className="w-full h-auto" />
                    </div>
                ) : null;
            case 'video':
                 return block.url ? <div className={cn("my-6 shadow-xl rounded-xl overflow-hidden border-4 border-white", textAlign === 'center' ? 'mx-auto max-w-2xl' : '')}><VideoEmbed url={block.url} /></div> : null;
            case 'audio':
                return block.url ? <div className="my-6 p-6 bg-slate-50 border border-slate-100 rounded-xl"><audio controls src={block.url} className="w-full text-sm">Your browser does not support the audio element.</audio></div> : null;
            case 'document':
                return (
                    <div className={cn("my-6", alignmentClass)}>
                        <Button asChild variant="outline" className="h-12 px-8 rounded-xl border-2 font-bold shadow-sm transition-all hover:bg-slate-50 text-base uppercase tracking-tight"><a href={block.url} target="_blank" rel="noopener noreferrer"><FileIcon className="mr-2.5 h-5 w-5 text-primary"/> Download Document</a></Button>
                    </div>
                );
            case 'embed':
                return block.html ? <div className="my-6 rounded-xl overflow-hidden border shadow-sm" dangerouslySetInnerHTML={{ __html: block.html }} /> : null;
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

function SurveyStepper({ pages, pageStatuses, currentIndex, onStepClick }: { pages: SurveyElement[][], pageStatuses: {isValid: boolean}[], currentIndex: number, onStepClick: (idx: number) => void }) {
    const hasCover = pages[0].length === 0;
    const actualPagesCount = hasCover ? pages.length - 1 : pages.length;
    if (actualPagesCount <= 1) return null;
    if (hasCover && currentIndex === 0) return null;
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
                            <button 
                                type="button" 
                                onClick={() => onStepClick(actualIdx)}
                                className="relative z-10 flex flex-col items-center group focus:outline-none"
                            >
                                <motion.div
                                    initial={false}
                                    animate={{
                                        backgroundColor: isCompleted ? (isInvalid ? '#ef4444' : '#22c55e') : isActive ? '#3B5FFF' : '#fff',
                                        borderColor: isCompleted ? (isInvalid ? '#ef4444' : '#22c55e') : isActive ? '#3B5FFF' : '#e2e8f0',
                                        scale: isActive ? 1.2 : 1,
                                    }}
                                    className={cn(
                                        "w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-md transition-all group-hover:scale-110 active:scale-95",
                                        (isCompleted || isActive) ? "text-white" : "text-muted-foreground"
                                    )}
                                >
                                    {isCompleted && !isInvalid ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        <span className="text-xs font-black">{index + 1}</span>
                                    )}
                                </motion.div>
                                <div className="mt-3 text-center px-1 w-full max-w-[100px]">
                                    <p className={cn(
                                        "text-[10px] font-black uppercase tracking-widest leading-tight line-clamp-2 h-8 transition-colors",
                                        isActive ? "text-foreground block" : "text-muted-foreground opacity-60 hidden sm:block group-hover:opacity-100",
                                        isCompleted && isInvalid && "text-destructive opacity-100"
                                    )}>
                                        {title}
                                    </p>
                                </div>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

type AutomationStatus = { 
    id: string; 
    label: string; 
    status: 'pending' | 'success' | 'failed' | 'skipped'; 
    error?: string; 
    icon: React.ElementType;
};

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
                    if(isValid(parsedDate)) acc[q.id] = parsedDate;
                } else acc[q.id] = q.defaultValue;
            } else {
                if (q.type === 'checkboxes') acc[q.id] = q.allowOther ? { options: [], other: '' } : [];
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
    const [lastSubmissionId, setLastSubmissionId] = React.useState<string | null>(null);

    // Automation Status Tracking
    const [automationStatuses, setAutomationStatuses] = React.useState<AutomationStatus[]>([]);
    const [isStatusModalOpen, setIsStatusModalOpen] = React.useState(false);

    const [showMissingFieldsModal, setShowMissingFieldsModal] = React.useState(false);
    const [missingFields, setMissingFields] = React.useState<{ id: string, label: string, pageIndex: number }[]>([]);

    const pages = React.useMemo(() => {
        const p: SurveyElement[][] = [];
        let currentPage: SurveyElement[] = [];
        if (survey.showCoverPage && survey.showSurveyTitles !== false) p.push([]); 
        survey.elements.forEach(element => {
            if (element.type === 'section' && (element as any).renderAsPage && currentPage.length > 0) {
                p.push(currentPage);
                currentPage = [element];
            } else currentPage.push(element);
        });
        if (currentPage.length > 0) p.push(currentPage);
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
                case 'show': targetElementIds?.forEach(id => { if (initialStates[id]) initialStates[id].isVisible = true; }); break;
                case 'hide': targetElementIds?.forEach(id => { if (initialStates[id]) initialStates[id].isVisible = false; }); break;
                case 'require': targetElementIds?.forEach(id => { if (initialStates[id]) initialStates[id].isRequired = true; }); break;
                case 'disableSubmit': newSubmitDisabled = true; break;
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
                if (optIndex !== undefined && optIndex !== -1) total += (q.optionScores?.[optIndex] || 0);
            } else if (q.type === 'checkboxes') {
                const selected = q.allowOther ? (answer?.options || []) : (Array.isArray(answer) ? answer : []);
                if (Array.isArray(selected)) {
                    selected.forEach(val => {
                        const optIndex = q.options?.indexOf(val);
                        if (optIndex !== undefined && optIndex !== -1) total += (q.optionScores?.[optIndex] || 0);
                    });
                }
            }
        });
        return total;
    };

    const resolveOutcome = (score: number | undefined): SurveyResultRule | undefined => {
        if (score === undefined || !survey.resultRules) return undefined;
        return [...survey.resultRules].sort((a, b) => a.priority - b.priority).find(rule => score >= rule.minScore && score <= rule.maxScore);
    };

    const validateAllRequired = (data: any) => {
        const missing: { id: string, label: string, pageIndex: number }[] = [];
        survey.elements.filter(isQuestion).forEach(q => {
            const state = elementStates[q.id];
            if (state?.isVisible && state?.isRequired) {
                if (isValueEmpty(data[q.id], q.type)) {
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
        const missing = validateAllRequired(form.getValues());
        if (missing.length > 0) {
            setMissingFields(missing);
            setShowMissingFieldsModal(true);
        } else {
            toast({
                variant: 'destructive',
                title: 'Check your answers',
                description: 'Some fields require your attention.',
            });
        }
    };

    const updateAutomationStatus = (id: string, status: AutomationStatus['status'], error?: string) => {
        setAutomationStatuses(prev => prev.map(s => s.id === id ? { ...s, status, error } : s));
    };

    const handleAcknowledgeSuccess = () => {
        setIsStatusModalOpen(false);
        if (survey.scoringEnabled && lastSubmissionId) {
            router.push(`/surveys/${survey.slug}/result/${lastSubmissionId}`);
        } else {
            onSubmitted();
        }
    };

    const onSubmit = async (data: z.infer<typeof surveySchema>) => {
        if (isPreview) { onSubmitted(); return; }
        
        survey.elements.filter(isQuestion).forEach(q => form.clearErrors(q.id));
        const missing = validateAllRequired(data);
        if (missing.length > 0) {
            setMissingFields(missing); 
            setShowMissingFieldsModal(true); 
            return;
        }

        if (!firestore) return;
        setIsSubmitting(true);
        
        const score = calculateScore(data);
        const outcome = resolveOutcome(score);

        // Better contact harvesting (Check specific types AND labels as fallback)
        const emailQuestion = survey.elements.filter(isQuestion).find(q => q.type === 'email' || q.title.toLowerCase().includes('email'));
        const phoneQuestion = survey.elements.filter(isQuestion).find(q => q.type === 'phone' || q.title.toLowerCase().includes('phone') || q.title.toLowerCase().includes('contact'));
        
        const respondentEmail = emailQuestion ? data[emailQuestion.id] : null;
        const respondentPhone = phoneQuestion ? data[phoneQuestion.id] : null;

        // Initialize status tracker
        const initialTasks: AutomationStatus[] = [
            { id: 'db', label: 'Institutional Persistence', status: 'pending', icon: Zap },
        ];

        if (survey.webhookEnabled && survey.webhookId) {
            initialTasks.push({ id: 'webhook', label: 'Cloud Webhook Gateway', status: 'pending', icon: Globe });
        }

        // We always show these tasks in the tracker, but they might be marked as 'skipped' if no contact provided
        if (outcome?.emailTemplateId && outcome.emailTemplateId !== 'none') {
            initialTasks.push({ id: 'email_ack', label: 'Email Confirmation (Respondent)', status: 'pending', icon: Mail });
        }
        if (outcome?.smsTemplateId && outcome.smsTemplateId !== 'none') {
            initialTasks.push({ id: 'sms_ack', label: 'SMS Confirmation (Respondent)', status: 'pending', icon: Smartphone });
        }
        
        if (survey.adminAlertsEnabled) {
            initialTasks.push({ id: 'admin_alert', label: 'Internal Team Notification', status: 'pending', icon: Bell });
        }

        setAutomationStatuses(initialTasks);
        setIsStatusModalOpen(true);

        const serializedData = { ...data };
        Object.keys(serializedData).forEach(key => { if (serializedData[key] instanceof Date) serializedData[key] = format(serializedData[key] as Date, 'yyyy-MM-dd'); });
        
        const variables: Record<string, any> = {
            survey_title: survey.title,
            score: score || 0,
            max_score: survey.maxScore || 100,
            submission_date: format(new Date(), 'PPPP'),
            outcome_label: outcome?.label || 'Default',
        };

        // Deep harvesting: Map all form answers to technical tags
        survey.elements.filter(isQuestion).forEach(q => {
            const val = serializedData[q.id];
            if (val !== undefined) {
                variables[q.id] = typeof val === 'object' ? JSON.stringify(val) : String(val);
            }
        });

        const cleanedData = Object.fromEntries(Object.entries(serializedData).filter(([_, v]) => v !== undefined && v !== null));
        const answers = Object.entries(cleanedData).map(([questionId, value]) => ({ questionId, value }));
        const responseData = { surveyId: survey.id, submittedAt: new Date().toISOString(), answers, score };
        const responsesCollection = collection(firestore, `surveys/${survey.id}/responses`);
        
        form.control.disabled = true;

        try {
            // Task 1: Persistent Save
            const docRef = await addDoc(responsesCollection, responseData);
            setLastSubmissionId(docRef.id);
            updateAutomationStatus('db', 'success');

            const automationPromises = [];

            // Webhook Pipeline
            if (survey.webhookEnabled && survey.webhookId) {
                const webhookTask = async () => {
                    try {
                        const webhookDoc = await getDoc(doc(firestore, 'webhooks', survey.webhookId!));
                        if (!webhookDoc.exists()) throw new Error("Endpoint missing");
                        const webhook = webhookDoc.data() as Webhook;
                        const res = await fetch(webhook.url, { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'application/json' }, 
                            body: JSON.stringify({ 
                                ...variables, 
                                answers: cleanedData, 
                                submission_id: docRef.id,
                                survey_id: survey.id
                            }) 
                        });
                        if (!res.ok) throw new Error(`Status ${res.status}`);
                        updateAutomationStatus('webhook', 'success');
                    } catch (e: any) {
                        updateAutomationStatus('webhook', 'failed', e.message);
                    }
                };
                automationPromises.push(webhookTask());
            }

            // Respondent Acknowledgment (Outcome Specific)
            if (outcome?.emailTemplateId && outcome.emailTemplateId !== 'none') {
                const emailTask = async () => {
                    if (!respondentEmail) {
                        updateAutomationStatus('email_ack', 'skipped', 'No email address detected in form data.');
                        return;
                    }
                    try {
                        const res = await sendMessage({ 
                            templateId: outcome.emailTemplateId!, 
                            senderProfileId: outcome.emailSenderProfileId || 'default', 
                            recipient: String(respondentEmail), 
                            variables 
                        });
                        if (!res.success) throw new Error(res.error);
                        updateAutomationStatus('email_ack', 'success');
                    } catch (e: any) {
                        updateAutomationStatus('email_ack', 'failed', e.message);
                    }
                };
                automationPromises.push(emailTask());
            }

            if (outcome?.smsTemplateId && outcome.smsTemplateId !== 'none') {
                const smsTask = async () => {
                    if (!respondentPhone) {
                        updateAutomationStatus('sms_ack', 'skipped', 'No phone number detected in form data.');
                        return;
                    }
                    try {
                        const res = await sendMessage({ 
                            templateId: outcome.smsTemplateId!, 
                            senderProfileId: outcome.smsSenderProfileId || 'default', 
                            recipient: String(respondentPhone), 
                            variables 
                        });
                        if (!res.success) throw new Error(res.error);
                        updateAutomationStatus('sms_ack', 'success');
                    } catch (e: any) {
                        updateAutomationStatus('sms_ack', 'failed', e.message);
                    }
                };
                automationPromises.push(smsTask());
            }

            // Administrative Notifications
            if (survey.adminAlertsEnabled) {
                const adminTask = async () => {
                    try {
                        await triggerInternalNotification({
                            schoolId: '',
                            notifyManager: survey.adminAlertNotifyManager,
                            specificUserIds: survey.adminAlertSpecificUserIds,
                            emailTemplateId: survey.adminAlertEmailTemplateId,
                            smsTemplateId: survey.adminAlertSmsTemplateId,
                            channel: survey.adminAlertChannel,
                            variables: { ...variables, event_type: 'Survey Completion' }
                        });
                        updateAutomationStatus('admin_alert', 'success');
                    } catch (e: any) {
                        updateAutomationStatus('admin_alert', 'failed', e.message);
                    }
                };
                automationPromises.push(adminTask());
            }

            // Mandatory System Activity Audit
            logActivity({
                schoolId: '',
                userId: null,
                type: 'form_submission',
                source: 'public',
                description: `Respondent completed survey: "${survey.title}"`,
                metadata: { surveyId: survey.id, submissionId: docRef.id, score, outcome: outcome?.label }
            });

            await Promise.allSettled(automationPromises);
            setIsSubmitting(false);

        } catch (error: any) {
            updateAutomationStatus('db', 'failed', error.message);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: responsesCollection.path, operation: 'create', requestResourceData: responseData }));
            setIsSubmitting(false);
        } finally { 
            form.control.disabled = false; 
        }
    };

    const handleNext = async () => {
        const currentElements = pages[currentPageIndex];
        if (currentElements.length === 0) { setCurrentPageIndex(1); window.scrollTo(0, 0); return; }
        const formData = form.getValues();
        const pageSection = currentElements[0]?.type === 'section' ? (currentElements[0] as SurveyLayoutBlock) : null;
        if (pageSection?.validateBeforeNext) {
            const questionsOnPage = currentElements.filter(isQuestion);
            questionsOnPage.forEach(q => form.clearErrors(q.id));
            const invalidQuestionsOnPage = questionsOnPage.filter(q => {
                const state = elementStates[q.id];
                if (!state?.isVisible || !state?.isRequired) return false;
                return isValueEmpty(formData[q.id], q.type);
            });
            if (invalidQuestionsOnPage.length > 0) {
                invalidQuestionsOnPage.forEach(q => form.setError(q.id, { type: 'manual', message: 'This field is required.' }));
                return; 
            }
        }
        let nextPageIndex = currentPageIndex + 1; 
        const logicBlocks = survey.elements.filter(isLogic);
        let jumpAction = false;
        for (const block of logicBlocks) {
            if (pages.findIndex(p => p.some(el => el.id === block.id)) > currentPageIndex) continue;
            for (const rule of block.rules) {
                if (evaluateCondition(formData[rule.sourceQuestionId], rule.operator, rule.targetValue) && rule.action.type === 'jump' && rule.action.targetElementId) {
                    const targetIdx = pages.findIndex(p => p.some(el => el.id === rule.action.targetElementId));
                    if (targetIdx > currentPageIndex) { nextPageIndex = targetIdx; jumpAction = true; break; }
                }
            }
            if (jumpAction) break;
        }
        if (nextPageIndex < pages.length) { setCurrentPageIndex(nextPageIndex); window.scrollTo(0, 0); }
    };

    const handlePrev = () => { setCurrentPageIndex(prev => prev - 1); window.scrollTo(0, 0); };

    const handleStepClick = (targetIndex: number) => {
        if (targetIndex === currentPageIndex) return;
        if (targetIndex > currentPageIndex) {
            const currentElements = pages[currentPageIndex];
            const pageSection = currentElements[0]?.type === 'section' ? (currentElements[0] as SurveyLayoutBlock) : null;
            if (pageSection?.validateBeforeNext) {
                const formData = form.getValues();
                const invalidQuestionsOnPage = currentElements.filter(isQuestion).filter(q => {
                    const state = elementStates[q.id];
                    if (!state?.isVisible || !state?.isRequired) return false;
                    return isValueEmpty(formData[q.id], q.type);
                });
                if (invalidQuestionsOnPage.length > 0) {
                    invalidQuestionsOnPage.forEach(q => form.setError(q.id, { type: 'manual', message: 'This field is required.' }));
                    toast({ variant: 'destructive', title: 'Action Required', description: 'Please complete the required fields in this section.' });
                    return;
                }
            }
        }
        setCurrentPageIndex(targetIndex);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const handleOkMissingFields = () => {
        setShowMissingFieldsModal(false);
        if (missingFields.length > 0) {
            const first = missingFields[0];
            setCurrentPageIndex(first.pageIndex);
            setTimeout(() => {
                const el = document.getElementById(first.id);
                if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.querySelector('input, select, textarea, button')?.focus(); }
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
                {showTitles && (
                    <>
                        {survey.bannerImageUrl && (
                            <div className="relative w-full rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white bg-white">
                                <img src={survey.bannerImageUrl} alt={survey.title || ''} className="w-full h-auto block" />
                            </div>
                        )}
                        <div className="space-y-5 max-w-3xl mx-auto px-4">
                            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">{survey.title}</h1>
                            <div className="text-lg sm:text-xl text-muted-foreground leading-relaxed prose prose-slate font-medium whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: survey.description }} />
                        </div>
                    </>
                )}
                <button type="button" className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-base ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-10 font-bold rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 w-full sm:w-auto mt-6 uppercase tracking-wide" onClick={handleNext}>
                    {survey.startButtonText || "Let's Start"} <ArrowRight className="ml-2 h-6 w-6" />
                </button>
            </div>
        )
    }

    return (
        <div className="pb-24">
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4 sm:space-y-12">
                {pageSection && (
                    <div className="text-center space-y-4 mb-8 sm:mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-tight" dangerouslySetInnerHTML={{ __html: pageSection.title || '' }} />
                        {pageSection.description && (
                            <div className="text-muted-foreground text-lg sm:text-xl leading-relaxed max-w-3xl mx-auto font-medium italic whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: pageSection.description }} />
                        )}
                    </div>
                )}

                <SurveyStepper pages={pages} pageStatuses={pageStatuses} currentIndex={currentPageIndex} onStepClick={handleStepClick} />
                
                <Card className="border-t-8 border-t-primary shadow-2xl rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden bg-white">
                    <CardContent className="p-6 sm:p-10 space-y-10 sm:space-y-12">
                        <div className="space-y-10 sm:space-y-12">
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

                 <div className={cn("flex flex-col sm:flex-row items-center mt-12 gap-4 px-4", isMultiPage ? "sm:justify-between" : "sm:justify-end")}>
                    {isMultiPage && currentPageIndex > 0 && (
                        <Button type="button" variant="outline" size="lg" className="h-14 px-10 rounded-2xl font-bold text-muted-foreground hover:text-foreground w-full sm:w-auto text-base uppercase tracking-tight" onClick={handlePrev} disabled={isSubmitting}>
                            Previous
                        </Button>
                    )}
                     {isMultiPage && currentPageIndex < pages.length - 1 && (
                         <Button type="button" size="lg" className="h-14 px-10 rounded-2xl font-bold shadow-xl w-full sm:w-auto sm:ml-auto transition-transform hover:scale-105 text-base uppercase tracking-tight" onClick={handleNext} disabled={isSubmitting}>
                            Next <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                     )}
                    {currentPageIndex === pages.length - 1 && (
                        <Button type="submit" size="lg" className={cn("h-14 px-12 rounded-2xl font-bold shadow-2xl transition-all hover:scale-105 w-full sm:w-auto bg-primary text-primary-foreground text-base uppercase tracking-tight", isMultiPage && "sm:ml-auto")} disabled={isSubmitting || isSubmitDisabled}>
                            {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting...</> : isSubmitDisabled ? 'Submission Disabled' : 'Submit Survey'}
                        </Button>
                    )}
                </div>
            </form>

            <Dialog open={showMissingFieldsModal} onOpenChange={setShowMissingFieldsModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle className="h-6 w-6 text-destructive" />
                        </div>
                        <DialogTitle className="text-center text-xl font-bold">Required Questions Missing</DialogTitle>
                        <DialogDescription className="text-center pt-2 text-sm font-medium">
                            Please answer the following questions before submitting:
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[30vh] border rounded-md my-4">
                        <ul className="p-4 space-y-3">
                            {missingFields.map((field, idx) => (
                                <li key={idx} className="flex items-center gap-3 text-sm font-medium">
                                    <div className="h-2 w-2 rounded-full bg-destructive" />
                                    <span className="font-bold">{field.label}</span>
                                </li>
                            ))}
                        </ul>
                    </ScrollArea>
                    <DialogFooter>
                        <Button onClick={handleOkMissingFields} className="w-full font-bold h-12 rounded-xl text-base">Go Fix These</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isStatusModalOpen} onOpenChange={(open) => { if (!open && !isSubmitting) handleAcknowledgeSuccess(); }}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl">
                    <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                <Zap className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-tight">Submission Processing</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest">Executing post-submission protocols...</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="p-8 space-y-6">
                        {automationStatuses.map((task) => (
                            <div key={task.id} className="flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "p-2 rounded-xl transition-all",
                                        task.status === 'success' ? "bg-emerald-100 text-emerald-600" :
                                        task.status === 'failed' ? "bg-rose-100 text-rose-600" : 
                                        task.status === 'skipped' ? "bg-amber-100 text-amber-600" :
                                        "bg-muted text-muted-foreground opacity-40"
                                    )}>
                                        <task.icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-foreground uppercase tracking-tight">{task.label}</p>
                                        {task.error && <p className="text-[9px] font-bold text-rose-600 uppercase mt-0.5">{task.error}</p>}
                                        {task.status === 'skipped' && <p className="text-[9px] font-bold text-amber-600 uppercase mt-0.5">Not applicable</p>}
                                    </div>
                                </div>
                                <div className="shrink-0">
                                    {task.status === 'pending' ? (
                                        <Loader2 className="h-5 w-5 animate-spin text-primary opacity-40" />
                                    ) : task.status === 'success' ? (
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500 animate-in zoom-in duration-300" />
                                    ) : task.status === 'skipped' ? (
                                        <Info className="h-5 w-5 text-amber-500" />
                                    ) : (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <XCircle className="h-5 w-5 text-rose-500" />
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-rose-600 text-white border-none font-bold text-[10px]">
                                                    {task.error || 'System Timeout'}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <DialogFooter className="p-6 bg-muted/30 border-t">
                        <Button 
                            onClick={handleAcknowledgeSuccess} 
                            disabled={isSubmitting}
                            className="w-full h-14 rounded-2xl font-black text-lg uppercase tracking-[0.1em] shadow-xl active:scale-95 transition-all"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Working...</>
                            ) : (
                                <><Check className="mr-2 h-5 w-5" /> Continue to Results</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
