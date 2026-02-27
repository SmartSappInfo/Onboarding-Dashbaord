'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Check, Loader2, Sparkles, RefreshCcw, Play, ArrowLeft, ArrowRight, Palette, Layout, Link as LinkIcon, Eye, Save, Mail, Send, AlertCircle, ShieldAlert, Globe, Lock, ShieldCheck, Zap
} from 'lucide-react';
import { type PDFForm, type PDFFormField, type School, type MessageTemplate, type SenderProfile } from '@/lib/types';
import { savePdfForm, updatePdfFormStatus, updatePdfFormSlug } from '@/lib/pdf-actions';
import { useToast } from '@/hooks/use-toast';
import { FormProvider, useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import FieldMapper from './components/FieldMapper';
import PdfPreviewDialog from './components/PdfPreviewDialog';
import { detectPdfFields } from '@/ai/flows/detect-pdf-fields-flow';
import { identifyPrimaryField } from '@/ai/flows/identify-primary-field-flow';
import { useUndoRedo } from '@/hooks/use-undo-redo';
import { useDebounce } from '@/hooks/use-debounce';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { MediaSelect } from '@/app/admin/schools/components/media-select';
import WebhookManager from '@/app/admin/surveys/components/webhook-manager';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Internal name must be at least 2 characters.' }),
  publicTitle: z.string().min(2, { message: 'Public title must be at least 2 characters.' }),
  schoolId: z.string().optional().nullable(),
  schoolName: z.string().optional().nullable(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  backgroundColor: z.string().optional(),
  backgroundPattern: z.enum(['none', 'dots', 'grid', 'circuit', 'topography', 'cubes', 'gradient']).default('none'),
  patternColor: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  slug: z.string().min(3, 'Slug must be at least 3 characters.').regex(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens.'}),
  webhookEnabled: z.boolean().default(false),
  webhookId: z.string().optional(),
  passwordProtected: z.boolean().default(false),
  password: z.string().optional(),
  // Messaging
  confirmationMessagingEnabled: z.boolean().default(false),
  confirmationTemplateId: z.string().optional(),
  confirmationSenderProfileId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const Stepper = ({ currentStep, onStepClick }: { currentStep: number, onStepClick: (step: number) => void }) => {
    const steps = ['Details', 'Builder', 'Publish'];

    return (
        <div className="flex justify-center items-center mb-12">
            {steps.map((step, index) => {
                const stepNum = index + 1;
                return (
                    <React.Fragment key={step}>
                        <button 
                            type="button"
                            onClick={() => onStepClick(stepNum)}
                            className="flex flex-col items-center group outline-none"
                            disabled={index === steps.length - 1 && currentStep < 3}
                        >
                            <div
                                className={cn(
                                    'flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all group-hover:scale-110',
                                    currentStep > stepNum ? 'bg-primary border-primary text-primary-foreground' : '',
                                    currentStep === stepNum ? 'border-primary' : 'border-border',
                                )}
                            >
                                {currentStep > stepNum ? <Check className="w-3 h-3" /> : <span className={cn('text-[10px] font-bold', currentStep === stepNum ? 'text-primary' : 'text-muted-foreground')}>{stepNum}</span>}
                            </div>
                            <p className={cn('mt-2 text-[10px] uppercase tracking-wider transition-colors', currentStep >= stepNum ? 'font-bold text-primary' : 'text-muted-foreground font-medium group-hover:text-primary/70')}>{step}</p>
                        </button>
                        {index < steps.length - 1 && <div className="flex-1 h-[1px] bg-border mx-4"></div>}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default function EditPdfPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { toast } = useToast();
  const pdfId = params.id as string;
  const firestore = useFirestore();
  const { user } = useUser();

  const [step, setStep] = React.useState(1);
  const [fields, setFields] = React.useState<PDFFormField[]>([]);
  const [namingFieldId, setNamingFieldId] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDetecting, setIsDetecting] = React.useState(false);
  const [isStatusChanging, setIsStatusChanging] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isDetectionModeOpen, setIsDetectionModeOpen] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        name: '',
        publicTitle: '',
        schoolId: null,
        schoolName: null,
        status: 'draft',
        slug: '',
        logoUrl: '',
        backgroundColor: '#F1F5F9',
        backgroundPattern: 'none',
        patternColor: '#3B5FFF',
        webhookEnabled: false,
        webhookId: '',
        passwordProtected: false,
        password: '',
        confirmationMessagingEnabled: false,
        confirmationTemplateId: '',
        confirmationSenderProfileId: '',
    }
  });

  const { reset, watch, setValue, getValues, trigger } = form;

  const schoolsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'schools'), orderBy('name', 'asc'));
  }, [firestore]);
  const { data: schools } = useCollection<School>(schoolsQuery);

  const templatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'message_templates'), orderBy('name', 'asc'));
  }, [firestore]);
  const { data: templates } = useCollection<MessageTemplate>(templatesQuery);

  const profilesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sender_profiles'), orderBy('name', 'asc'));
  }, [firestore]);
  const { data: profiles } = useCollection<SenderProfile>(profilesQuery);

  const {
    state: historyState,
    set: setHistory,
    undo: undoHistory,
    redo: redoHistory,
    canUndo,
    canRedo,
    reset: resetHistory
  } = useUndoRedo<PDFFormField[]>([]);

  const isProgrammaticChange = React.useRef(false);
  const debouncedFields = useDebounce(fields, 800);

  const pdfDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return doc(firestore, 'pdfs', pdfId);
  }, [firestore, pdfId]);

  const { data: pdf, isLoading } = useDoc<PDFForm>(pdfDocRef);
  
  React.useEffect(() => {
    if (pdf && !form.formState.isDirty) {
      const initialFields = JSON.parse(JSON.stringify(pdf.fields || []));
      setFields(initialFields);
      setNamingFieldId(pdf.namingFieldId || null);
      resetHistory(initialFields);
      
      reset({
        name: pdf.name || '',
        publicTitle: pdf.publicTitle || pdf.name || '',
        schoolId: pdf.schoolId || null,
        schoolName: pdf.schoolName || null,
        status: pdf.status || 'draft',
        slug: pdf.slug || pdf.id,
        logoUrl: pdf.logoUrl || '',
        backgroundColor: pdf.backgroundColor || '#F1F5F9',
        backgroundPattern: (pdf.backgroundPattern as any) || 'none',
        patternColor: pdf.patternColor || '#3B5FFF',
        webhookEnabled: pdf.webhookEnabled || false,
        webhookId: pdf.webhookId || '',
        passwordProtected: pdf.passwordProtected || false,
        password: pdf.password || '',
        confirmationMessagingEnabled: pdf.confirmationMessagingEnabled || false,
        confirmationTemplateId: pdf.confirmationTemplateId || '',
        confirmationSenderProfileId: pdf.confirmationSenderProfileId || '',
      });
    }
  }, [pdf, reset, resetHistory]);

  React.useEffect(() => {
    const urlStep = searchParams.get('step');
    if (urlStep) {
        const parsed = parseInt(urlStep, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 3) setStep(parsed);
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (isProgrammaticChange.current) return;
    setHistory(debouncedFields);
  }, [debouncedFields, setHistory]);

  React.useEffect(() => {
    if (isProgrammaticChange.current) {
        setFields(historyState);
        isProgrammaticChange.current = false;
    }
  }, [historyState]);

  const performSave = async (data: FormData, redirect: boolean = false) => {
    setIsSaving(true);
    
    let finalNamingFieldId = namingFieldId;

    if (!finalNamingFieldId && fields.length > 0) {
        try {
            const aiResult = await identifyPrimaryField({ 
                fields: fields.map(f => ({ id: f.id, label: f.label, type: f.type })) 
            });
            if (aiResult.suggestedFieldId) {
                finalNamingFieldId = aiResult.suggestedFieldId;
                setNamingFieldId(finalNamingFieldId);
            }
        } catch (e) {
            console.warn("AI Naming Field Detection failed:", e);
        }
    }

    const displayFieldIds: string[] = [];
    if (finalNamingFieldId) displayFieldIds.push(finalNamingFieldId);
    const otherFields = fields
        .filter(f => f.id !== finalNamingFieldId && f.type !== 'signature')
        .slice(0, 3 - displayFieldIds.length)
        .map(f => f.id);
    displayFieldIds.push(...otherFields);

    const result = await savePdfForm(pdfId, {
      ...data,
      fields,
      namingFieldId: finalNamingFieldId,
      displayFieldIds,
    });

    if (result.success) {
      toast({ title: 'Document Saved' });
      if (redirect) {
        router.push('/admin/pdfs');
      }
    } else {
      toast({ variant: 'destructive', title: 'Save Failed' });
    }
    setIsSaving(false);
  };

  const handleUndo = () => {
    if (canUndo) {
        isProgrammaticChange.current = true;
        undoHistory();
    }
  };

  const handleRedo = () => {
    if (canRedo) {
        isProgrammaticChange.current = true;
        redoHistory();
    }
  };

  const onFinalSubmit = async (data: FormData) => {
    await performSave(data, true);
  };

  const handleNext = async () => {
    let fieldsToValidate: any[] = [];
    if (step === 1) fieldsToValidate = ['name', 'publicTitle', 'logoUrl', 'backgroundColor', 'backgroundPattern', 'patternColor'];
    if (step === 2) fieldsToValidate = [];
    
    const isStepValid = await trigger(fieldsToValidate);
    if (!isStepValid) {
        toast({ variant: 'destructive', title: 'Validation Error', description: 'Please fix the errors before proceeding.' });
        return;
    }

    const nextStep = step + 1;
    setStep(nextStep);
    router.push(`${pathname}?step=${nextStep}`, { scroll: false });
  };

  const handleStepChange = async (targetStep: number) => {
    if (targetStep === step) return;
    if (targetStep > step) {
        const isStepValid = await trigger();
        if (!isStepValid) return;
    }
    setStep(targetStep);
    router.push(`${pathname}?step=${targetStep}`, { scroll: false });
  };

  const handleDetectClick = async (mode: 'overwrite' | 'continue') => {
    if (isDetecting || !pdf?.downloadUrl) return;
    setIsDetectionModeOpen(false);
    setIsDetecting(true);
    
    try {
        const response = await fetch(pdf.downloadUrl);
        const blob = await response.blob();
        const base64data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });

        const result = await detectPdfFields({ 
            pdfDataUri: base64data,
            existingFields: mode === 'continue' ? fields : undefined
        });

        if (result.fields?.length > 0) {
            const newSuggestions = result.fields.map(suggestion => ({ 
                ...suggestion, 
                id: `ai_${Date.now()}_${Math.random().toString(36).substr(2,5)}`, 
                isSuggestion: true, 
            }));

            if (mode === 'overwrite') {
                setFields(newSuggestions);
            } else {
                setFields(prev => [...prev, ...newSuggestions]);
            }
            toast({ title: 'AI Detection Complete', description: `${result.fields.length} potential fields found.` });
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'AI Detection Failed' });
    } finally {
        setIsDetecting(false);
    }
  };

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!pdf) return <div className="text-center py-20"><p>Document not found.</p></div>;

  return (
    <FormProvider {...form}>
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="w-full md:w-[90%] mx-auto">
                <Button asChild variant="ghost" className="mb-4 -ml-4">
                    <Link href="/admin/pdfs">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Documents
                    </Link>
                </Button>
                
                <Stepper currentStep={step} onStepClick={handleStepChange} />

                <form 
                    onSubmit={form.handleSubmit(onFinalSubmit)} 
                    className="space-y-8"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && step < 3) {
                            const target = e.target as HTMLElement;
                            if (target.tagName !== 'TEXTAREA') {
                                e.preventDefault();
                            }
                        }
                    }}
                >
                    <div className={cn(step !== 1 && 'hidden')}>
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                            <Card className="xl:col-span-2">
                                <CardHeader>
                                    <CardTitle>Document Details</CardTitle>
                                    <CardDescription>Internal and public naming for your document.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <Controller
                                        name="name"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="space-y-2">
                                                <Label>Internal Name (Administrative)</Label>
                                                <Input {...field} placeholder="e.g. 2024 Enrollment Form" />
                                                <p className="text-xs text-muted-foreground">Used only within the admin workspace.</p>
                                            </div>
                                        )}
                                    />
                                    <Controller
                                        name="publicTitle"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="space-y-2">
                                                <Label>Public Title</Label>
                                                <Input {...field} placeholder="e.g. School Admission Application" />
                                                <p className="text-xs text-muted-foreground">This title is visible to users on the signing page.</p>
                                            </div>
                                        )}
                                    />
                                    <Controller
                                        name="schoolId"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="space-y-2">
                                                <Label>Associated School / Organization</Label>
                                                <Select 
                                                    onValueChange={(val) => {
                                                        const school = schools?.find(s => s.id === val);
                                                        field.onChange(val);
                                                        setValue('schoolName', school ? school.name : 'SmartSapp');
                                                    }} 
                                                    value={field.value || 'none'}
                                                >
                                                    <SelectTrigger className="h-11">
                                                        <SelectValue placeholder="Select a school..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">No School (Default: SmartSapp)</SelectItem>
                                                        {schools?.map(school => (
                                                            <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-xs text-muted-foreground">The school name will appear beneath the title on public pages.</p>
                                            </div>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            <div className="space-y-8">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Appearance</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <Controller
                                            name="logoUrl"
                                            control={form.control}
                                            render={({ field }) => (
                                                <div className="space-y-2">
                                                    <Label>Brand Logo</Label>
                                                    <MediaSelect {...field} filterType="image" />
                                                </div>
                                            )}
                                        />
                                        <div className="space-y-4">
                                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Background Design</Label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <Controller
                                                    name="backgroundColor"
                                                    control={form.control}
                                                    render={({ field }) => (
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px]">Base Color</Label>
                                                            <div className="flex gap-2">
                                                                <Input type="color" {...field} value={field.value || "#F1F5F9"} className="w-10 h-10 p-1 rounded-lg shadow-sm" />
                                                                <Input value={field.value} onChange={e => field.onChange(e.target.value)} className="font-mono text-[10px]" />
                                                            </div>
                                                        </div>
                                                    )}
                                                />
                                                <Controller
                                                    name="patternColor"
                                                    control={form.control}
                                                    render={({ field }) => (
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px]">Pattern Color</Label>
                                                            <div className="flex gap-2">
                                                                <Input type="color" {...field} value={field.value || "#3B5FFF"} className="w-10 h-10 p-1 rounded-lg shadow-sm" />
                                                                <Input value={field.value} onChange={e => field.onChange(e.target.value)} className="font-mono text-[10px]" />
                                                            </div>
                                                        </div>
                                                    )}
                                                />
                                            </div>
                                            <Controller
                                                name="backgroundPattern"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <SelectTrigger className="h-10 text-xs">
                                                            <SelectValue placeholder="Style..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Solid Color</SelectItem>
                                                            <SelectItem value="dots">Dots</SelectItem>
                                                            <SelectItem value="grid">Grid</SelectItem>
                                                            <SelectItem value="circuit">Circuit</SelectItem>
                                                            <SelectItem value="topography">Topography</SelectItem>
                                                            <SelectItem value="gradient">Gradient</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>

                    <div className={cn("h-[80vh] border rounded-2xl overflow-hidden", step !== 2 && 'hidden')}>
                        <FieldMapper
                            pdf={pdf}
                            fields={fields}
                            setFields={setFields}
                            namingFieldId={namingFieldId}
                            setNamingFieldId={setNamingFieldId}
                            onSave={() => performSave(getValues(), false)}
                            isSaving={isSaving}
                            onPreview={() => setIsPreviewOpen(true)}
                            isStatusChanging={isStatusChanging}
                            onStatusChange={(s) => setValue('status', s, { shouldDirty: true })}
                            onDetect={() => fields.length > 0 ? setIsDetectionModeOpen(true) : handleDetectClick('overwrite')}
                            isDetecting={isDetecting}
                            undo={handleUndo}
                            redo={handleRedo}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            password={watch('password')}
                            setPassword={(val) => setValue('password', val, { shouldDirty: true })}
                            passwordProtected={watch('passwordProtected')}
                            setPasswordProtected={(val) => setValue('passwordProtected', val, { shouldDirty: true })}
                        />
                    </div>

                    <div className={cn("space-y-8", step !== 3 && 'hidden')}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            <Card className="shadow-sm overflow-hidden border-none ring-1 ring-border">
                                <CardHeader className="bg-muted/30 border-b pb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-xl">
                                            <Globe className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-black tracking-tight">Finalize & Integrate</CardTitle>
                                            <CardDescription className="text-xs font-medium">Set the document visibility and external connections.</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {/* Primary Access Group */}
                                    <div className="p-6 bg-background">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <Controller
                                                name="status"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Status</Label>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 transition-all font-bold">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                <SelectItem value="draft">Draft</SelectItem>
                                                                <SelectItem value="published">Published</SelectItem>
                                                                <SelectItem value="archived">Archived</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            />
                                            <Controller
                                                name="slug"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">URL Backhalf</Label>
                                                        <div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-muted/20 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                                                            <div className="bg-muted px-3 flex items-center text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60 border-r">/forms/</div>
                                                            <Input {...field} className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent font-bold" />
                                                        </div>
                                                    </div>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="px-6 pb-6 space-y-4">
                                        {/* Security Feature Card */}
                                        <div className={cn(
                                            "rounded-2xl border-2 transition-all duration-300",
                                            watch('passwordProtected') ? "border-primary/20 bg-primary/5" : "border-border/50 bg-background"
                                        )}>
                                            <div className="flex items-center justify-between p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("p-2 rounded-lg transition-colors", watch('passwordProtected') ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                                        <Lock className="h-4 w-4" />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <Label className="text-sm font-black uppercase tracking-tight">Password Protection</Label>
                                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Restrict access via global password</p>
                                                    </div>
                                                </div>
                                                <Controller
                                                    name="passwordProtected"
                                                    control={form.control}
                                                    render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                                                />
                                            </div>
                                            <AnimatePresence>
                                                {watch('passwordProtected') && (
                                                    <motion.div 
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="px-4 pb-4 pt-0">
                                                            <Controller
                                                                name="password"
                                                                control={form.control}
                                                                render={({ field }) => (
                                                                    <Input {...field} type="password" placeholder="Set access password..." className="h-10 rounded-xl bg-white border-primary/20 shadow-inner" />
                                                                )}
                                                            />
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <WebhookManager />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-xl border-2 border-primary/10 bg-primary/5 overflow-hidden">
                                <CardHeader className="bg-primary/5 pb-6 border-b border-primary/10">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
                                            <Send className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-black tracking-tight">Auto-Confirmation</CardTitle>
                                            <CardDescription className="text-xs font-bold text-primary/60 uppercase tracking-widest">Dispatch messaging after signing</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    <div className="p-5 bg-white border border-primary/20 rounded-[2rem] shadow-sm flex items-center justify-between transition-all hover:shadow-md">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                                <Mail className="h-6 w-6" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-black uppercase tracking-tight">Confirmation Message</Label>
                                                <p className="text-xs text-muted-foreground font-medium">Notify the user upon successful submission</p>
                                            </div>
                                        </div>
                                        <Controller
                                            name="confirmationMessagingEnabled"
                                            control={form.control}
                                            render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} className="scale-110" />}
                                        />
                                    </div>

                                    <AnimatePresence>
                                        {watch('confirmationMessagingEnabled') && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                className="space-y-6"
                                            >
                                                <div className="grid gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60 ml-1">Message Template</Label>
                                                        <Controller
                                                            name="confirmationTemplateId"
                                                            control={form.control}
                                                            render={({ field }) => (
                                                                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                                    <SelectTrigger className="h-12 bg-white rounded-2xl shadow-sm border-primary/10 focus:ring-primary/20 font-bold transition-all">
                                                                        <SelectValue placeholder="Select template..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-2xl">
                                                                        <SelectItem value="none">No Template Selected</SelectItem>
                                                                        {templates?.filter(t => t.category === 'forms' && t.isActive).map(t => (
                                                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60 ml-1">Sender Identity</Label>
                                                        <Controller
                                                            name="confirmationSenderProfileId"
                                                            control={form.control}
                                                            render={({ field }) => (
                                                                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                                    <SelectTrigger className="h-12 bg-white rounded-2xl shadow-sm border-primary/10 focus:ring-primary/20 font-bold transition-all">
                                                                        <SelectValue placeholder="Select sender..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-2xl">
                                                                        <SelectItem value="none">No Sender Selected</SelectItem>
                                                                        {profiles?.filter(p => p.isActive).map(p => (
                                                                            <SelectItem key={p.id} value={p.id}>{p.name} ({p.identifier})</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div className="p-4 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 flex gap-3">
                                                    <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Automation Note</p>
                                                        <p className="text-[10px] font-medium text-primary/70 leading-relaxed uppercase tracking-tighter">
                                                            The system will automatically extract the recipient's contact details from the submitted form data.
                                                        </p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-12 pb-20">
                        <Button type="button" variant="ghost" onClick={() => router.push('/admin/pdfs')} className="font-bold text-muted-foreground">Cancel</Button>
                        <div className="flex items-center gap-4">
                            {step > 1 && <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} className="font-bold border-border/50">Previous</Button>}
                            {step < 3 ? (
                                <Button type="button" onClick={handleNext} className="gap-2 px-8 font-black shadow-lg">
                                    Next Phase <ArrowRight className="h-4 w-4" />
                                </Button>
                            ) : (
                                <Button type="submit" disabled={isSaving} className="gap-2 px-12 h-12 font-black shadow-2xl bg-primary text-white hover:bg-primary/90 rounded-2xl">
                                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                    Finalize & Save Document
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <PdfPreviewDialog
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            pdfForm={{ ...pdf, fields, namingFieldId, ...watch() } as PDFForm}
        />

        <AlertDialog open={isDetectionModeOpen} onOpenChange={setIsDetectionModeOpen}>
            <AlertDialogContent className="sm:max-w-md">
                <AlertDialogHeader>
                    <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                        <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <AlertDialogTitle className="text-center font-black">AI Field Detection</AlertDialogTitle>
                    <AlertDialogDescription className="text-center">
                        You already have {fields.length} fields. How should the AI proceed?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-4 py-4">
                    <Button variant="outline" className="h-auto flex-col items-start gap-1 p-4 text-left" onClick={() => handleDetectClick('continue')}>
                        <div className="flex items-center gap-2 font-bold"><Play className="h-4 w-4 text-primary" />Continue Designing</div>
                        <span className="text-xs text-muted-foreground font-normal">Keep existing work and let AI find missing fields.</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col items-start gap-1 p-4 text-left border-destructive/20 hover:bg-destructive/5" onClick={() => handleDetectClick('overwrite')}>
                        <div className="flex items-center gap-2 font-bold text-destructive"><RefreshCcw className="h-4 w-4" />Re-design from Scratch</div>
                        <span className="text-xs text-muted-foreground font-normal">Wipe the canvas and let AI build the entire form.</span>
                    </Button>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel className="w-full">Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </FormProvider>
  );
}
