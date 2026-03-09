'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useUser, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Check, Loader2, Sparkles, RefreshCcw, Play, ArrowLeft, ArrowRight, Palette, Layout, Eye, Save, Mail, Send, AlertCircle, ShieldAlert, Globe, Lock, ShieldCheck, Zap, FileText, Settings2, Share2, PlusCircle
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
import InternalNotificationConfig from '@/app/admin/components/internal-notification-config';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { syncVariableRegistry } from '@/lib/messaging-actions';
import QuickTemplateDialog from '@/app/admin/messaging/components/quick-template-dialog';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';

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
  // Public Notification
  confirmationMessagingEnabled: z.boolean().default(false),
  confirmationTemplateId: z.string().optional(),
  confirmationSenderProfileId: z.string().optional(),
  // Internal Notification
  adminAlertsEnabled: z.boolean().default(false),
  adminAlertChannel: z.enum(['email', 'sms', 'both']).default('both'),
  adminAlertNotifyManager: z.boolean().default(false),
  adminAlertSpecificUserIds: z.array(z.string()).default([]),
  adminAlertEmailTemplateId: z.string().optional(),
  adminAlertSmsTemplateId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const stepTransition = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { type: 'spring', damping: 25, stiffness: 200 }
};

const Stepper = ({ currentStep, onStepClick }: { currentStep: number, onStepClick: (step: number) => void }) => {
    const steps = [
        { name: 'Details', icon: Settings2 },
        { name: 'Builder', icon: Layout },
        { name: 'Publish', icon: Share2 }
    ];

    return (
        <div className="flex justify-center items-center mb-12 max-w-2xl mx-auto px-4">
            {steps.map((step, index) => {
                const stepNum = index + 1;
                const Icon = step.icon;
                const isActive = currentStep === stepNum;
                const isCompleted = currentStep > stepNum;

                return (
                    <React.Fragment key={step.name}>
                        <button 
                            type="button" 
                            onClick={() => onStepClick(stepNum)}
                            className="flex flex-col items-center group outline-none"
                            disabled={index === steps.length - 1 && currentStep < 3}
                        >
                            <div
                                className={cn(
                                    'flex items-center justify-center w-10 h-10 rounded-2xl border-2 transition-all duration-300 shadow-sm group-hover:scale-110',
                                    isCompleted ? 'bg-primary border-primary text-primary-foreground' : 
                                    isActive ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-background border-border text-muted-foreground',
                                )}
                            >
                                {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-5 h-5" />}
                            </div>
                            <p className={cn(
                                'mt-3 text-[10px] font-black uppercase tracking-widest transition-colors', 
                                isActive || isCompleted ? 'text-primary' : 'text-muted-foreground opacity-60 group-hover:opacity-100'
                            )}>
                                {step.name}
                            </p>
                        </button>
                        {index < steps.length - 1 && (
                            <div className="flex-1 mx-4 h-[2px] relative overflow-hidden bg-muted rounded-full">
                                <motion.div 
                                    initial={false}
                                    animate={{ width: isCompleted ? '100%' : '0%' }}
                                    className="absolute left-0 top-0 h-full bg-primary"
                                />
                            </div>
                        )}
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
  const [autosaveStatus, setAutosaveStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const [isQuickCreateOpen, setIsQuickCreateOpen] = React.useState(false);
  const [hasInitialized, setHasInitialized] = React.useState(false);

  const storageKey = `pdf-autosave-${pdfId}`;

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
        adminAlertsEnabled: false,
        adminAlertChannel: 'both',
        adminAlertNotifyManager: false,
        adminAlertSpecificUserIds: [],
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
    return query(collection(firestore, 'message_templates'), where('isActive', '==', true), where('category', '==', 'forms'));
  }, [firestore]);
  const { data: templates } = useCollection<MessageTemplate>(templatesQuery);

  const profilesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sender_profiles'), where('isActive', '==', true), where('channel', '==', 'email'));
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
  const watchedForm = watch();
  const debouncedForm = useDebounce(watchedForm, 2000);

  const pdfDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return doc(firestore, 'pdfs', pdfId);
  }, [firestore, pdfId]);

  const { data: pdf, isLoading } = useDoc<PDFForm>(pdfDocRef);
  
  useSetBreadcrumb(pdf?.name, `/admin/pdfs/${pdfId}`);

  React.useEffect(() => {
    if (pdf && !hasInitialized) {
      const initialFields = JSON.parse(JSON.stringify(pdf.fields || []));
      setFields(initialFields);
      setNamingFieldId(pdf.namingFieldId || null);
      resetHistory(initialFields);
      
      const VALID_PATTERNS = ['none', 'dots', 'grid', 'circuit', 'topography', 'cubes', 'gradient'];
      const pattern = pdf.backgroundPattern && VALID_PATTERNS.includes(pdf.backgroundPattern) 
          ? pdf.backgroundPattern 
          : 'none';

      const initialData = {
        name: pdf.name || '',
        publicTitle: pdf.publicTitle || pdf.name || '',
        schoolId: pdf.schoolId || null,
        schoolName: pdf.schoolName || null,
        status: pdf.status || 'draft',
        slug: pdf.slug || pdf.id,
        logoUrl: pdf.logoUrl || '',
        backgroundColor: pdf.backgroundColor || '#F1F5F9',
        backgroundPattern: pattern as any,
        patternColor: pdf.patternColor || '#3B5FFF',
        webhookEnabled: pdf.webhookEnabled || false,
        webhookId: pdf.webhookId || '',
        passwordProtected: pdf.passwordProtected || false,
        password: pdf.password || '',
        confirmationMessagingEnabled: pdf.confirmationMessagingEnabled || false,
        confirmationTemplateId: pdf.confirmationTemplateId || '',
        confirmationSenderProfileId: pdf.confirmationSenderProfileId || '',
        adminAlertsEnabled: pdf.adminAlertsEnabled || false,
        adminAlertChannel: pdf.adminAlertChannel || 'both',
        adminAlertNotifyManager: pdf.adminAlertNotifyManager || false,
        adminAlertSpecificUserIds: pdf.adminAlertSpecificUserIds || [],
        adminAlertEmailTemplateId: pdf.adminAlertEmailTemplateId || '',
        adminAlertSmsTemplateId: pdf.adminAlertSmsTemplateId || '',
      };

      reset(initialData);
      setHasInitialized(true);

      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
          try {
              const parsed = JSON.parse(savedData);
              if (JSON.stringify(parsed.fields) !== JSON.stringify(initialFields) || JSON.stringify(parsed.details) !== JSON.stringify(initialData)) {
                  toast({
                      title: "Unsaved Changes Found",
                      description: "Would you like to restore your last session?",
                      action: (
                          <Button variant="default" size="sm" type="button" onClick={() => {
                              setFields(parsed.fields || []);
                              setNamingFieldId(parsed.namingFieldId || null);
                              reset(parsed.details);
                              localStorage.removeItem(storageKey);
                              toast({ title: "Restored", description: "Your changes have been applied." });
                          }}>
                              Restore
                          </Button>
                      ),
                      duration: 8000,
                  });
              }
          } catch (e) {
              console.error("Autosave parse error:", e);
          }
      }
    }
  }, [pdf, reset, resetHistory, pdfId, storageKey, toast, hasInitialized]);

  React.useEffect(() => {
      const currentDetails = getValues();
      const saveState = {
          fields,
          namingFieldId,
          details: currentDetails,
          updatedAt: new Date().toISOString()
      };

      if (fields.length > 0 || form.formState.isDirty) {
          setAutosaveStatus('saving');
          localStorage.setItem(storageKey, JSON.stringify(saveState));
          const timer = setTimeout(() => setAutosaveStatus('saved'), 800);
          const idleTimer = setTimeout(() => setAutosaveStatus('idle'), 3000);
          return () => { clearTimeout(timer); clearTimeout(idleTimer); };
      }
  }, [debouncedFields, debouncedForm, namingFieldId, storageKey, getValues]);

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
      if (data.status === 'published') {
          syncVariableRegistry().catch(e => console.error("Registry Sync failed:", e));
      }
      localStorage.removeItem(storageKey);
      if (redirect) router.push('/admin/pdfs');
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
    
    const isStepValid = await trigger(fieldsToValidate);
    if (!isStepValid) {
        toast({ variant: 'destructive', title: 'Validation Error' });
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

            if (mode === 'overwrite') setFields(newSuggestions);
            else setFields(prev => [...prev, ...newSuggestions]);
            
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
        <div className="h-full flex flex-col bg-muted/30">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                <div className="w-full md:w-[95%] lg:w-[90%] mx-auto max-w-7xl">
                    <div className="mb-8 flex justify-end items-center">
                        {step === 2 && (
                            <div className="flex items-center gap-3 pb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                {autosaveStatus === 'saving' ? (
                                    <span className="flex items-center gap-1.5 text-primary animate-pulse">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Saving Progress...
                                    </span>
                                ) : autosaveStatus === 'saved' ? (
                                    <span className="flex items-center gap-1.5 text-green-600">
                                        <Check className="h-3 w-3" /> Changes Cached
                                    </span>
                                ) : (
                                    <span className="opacity-40">Local Backup Active</span>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <Stepper currentStep={step} onStepClick={handleStepChange} />

                    <form 
                        onSubmit={form.handleSubmit(onFinalSubmit)} 
                        className="pb-32"
                        onKeyDown={(e) => { if (e.key === 'Enter' && step < 3 && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault(); }}
                    >
                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div key="step1" {...stepTransition}>
                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                        <Card className="xl:col-span-2 shadow-sm border-none ring-1 ring-border">
                                            <CardHeader className="bg-muted/30 border-b pb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded-xl">
                                                        <FileText className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-lg font-black uppercase tracking-tight">Document Identity</CardTitle>
                                                        <CardDescription className="text-xs font-medium">Naming and classification details for the form.</CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-8 bg-background">
                                                <Controller
                                                    name="name"
                                                    control={form.control}
                                                    render={({ field }) => (
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Internal Title (Administrative)</Label>
                                                            <Input {...field} placeholder="e.g. 2024 Enrollment Form" className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 transition-all font-bold text-lg" />
                                                            <p className="text-[10px] text-muted-foreground italic px-1">Visible only to administrators within the workspace.</p>
                                                        </div>
                                                    )}
                                                />
                                                <Controller
                                                    name="publicTitle"
                                                    control={form.control}
                                                    render={({ field }) => (
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">User-Facing Header</Label>
                                                            <Input {...field} placeholder="e.g. School Admission Application" className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 transition-all font-bold text-lg" />
                                                            <p className="text-[10px] text-muted-foreground italic px-1">This title is prominent on the public signing page.</p>
                                                        </div>
                                                    )}
                                                />
                                                <Controller
                                                    name="schoolId"
                                                    control={form.control}
                                                    render={({ field }) => (
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Associated Organization</Label>
                                                            <Select 
                                                                onValueChange={(val) => {
                                                                    const school = schools?.find(s => s.id === val);
                                                                    field.onChange(val);
                                                                    setValue('schoolName', school ? school.name : 'SmartSapp');
                                                                }} 
                                                                value={field.value || 'none'}
                                                            >
                                                                <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 transition-all font-bold">
                                                                    <SelectValue placeholder="Select a school..." />
                                                                </SelectTrigger>
                                                                <SelectContent className="rounded-xl">
                                                                    <SelectItem value="none">Independent (No School)</SelectItem>
                                                                    {schools?.map(school => (
                                                                        <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}
                                                />
                                            </CardContent>
                                        </Card>

                                        <div className="space-y-8">
                                            <Card className="shadow-sm border-none ring-1 ring-border">
                                                <CardHeader className="bg-muted/30 border-b pb-6 px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-primary/10 rounded-xl">
                                                            <Palette className="h-5 w-5 text-primary" />
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-lg font-black uppercase tracking-tight">Visual Identity</CardTitle>
                                                            <CardDescription className="text-xs font-medium">Branding and theme customization.</CardDescription>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-6 space-y-8 bg-background">
                                                    <Controller
                                                        name="logoUrl"
                                                        control={form.control}
                                                        render={({ field }) => (
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Brand Logo</Label>
                                                                <MediaSelect {...field} filterType="image" className="rounded-2xl" />
                                                            </div>
                                                        )}
                                                    />
                                                    <div className="space-y-4 pt-4 border-t border-border/50">
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Background Theme</Label>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <Controller
                                                                name="backgroundColor"
                                                                control={form.control}
                                                                render={({ field }) => (
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[9px] font-bold uppercase text-muted-foreground/60 ml-1">Base Color</Label>
                                                                        <div className="flex gap-2 p-1.5 bg-muted/30 rounded-xl border border-border/50 transition-all focus-within:ring-1 focus-within:ring-primary/20">
                                                                            <Input type="color" {...field} value={field.value || "#F1F5F9"} className="w-8 h-8 p-0 border-none bg-transparent rounded-lg cursor-pointer overflow-hidden" />
                                                                            <Input value={field.value} onChange={e => field.onChange(e.target.value)} className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0 font-mono text-[10px] uppercase p-0" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            />
                                                            <Controller
                                                                name="patternColor"
                                                                control={form.control}
                                                                render={({ field }) => (
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[9px] font-bold uppercase text-muted-foreground/60 ml-1">Pattern Tint</Label>
                                                                        <div className="flex gap-2 p-1.5 bg-muted/30 rounded-xl border border-border/50 transition-all focus-within:ring-1 focus-within:ring-primary/20">
                                                                            <Input type="color" {...field} value={field.value || "#3B5FFF"} className="w-8 h-8 p-0 border-none bg-transparent rounded-lg cursor-pointer overflow-hidden" />
                                                                            <Input value={field.value} onChange={e => field.onChange(e.target.value)} className="h-8 border-none bg-transparent shadow-none font-mono text-[10px] uppercase p-0" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            />
                                                        </div>
                                                        <Controller
                                                            name="backgroundPattern"
                                                            control={form.control}
                                                            render={({ field }) => (
                                                                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                                    <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold transition-all">
                                                                        <SelectValue placeholder="Pattern Style..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl">
                                                                        <SelectItem value="none">Solid Color</SelectItem>
                                                                        <SelectItem value="dots">Dots</SelectItem>
                                                                        <SelectItem value="grid">Grid</SelectItem>
                                                                        <SelectItem value="circuit">Circuit</SelectItem>
                                                                        <SelectItem value="topography">Topography</SelectItem>
                                                                        <SelectItem value="cubes">Cubes</SelectItem>
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
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div key="step2" {...stepTransition} className="h-full">
                                    <div className="h-[80vh] border-none ring-1 ring-border rounded-[2rem] overflow-hidden shadow-2xl bg-background">
                                        <FieldMapper
                                            pdf={pdf} fields={fields} setFields={setFields} namingFieldId={namingFieldId} setNamingFieldId={setNamingFieldId}
                                            onSave={() => {}} isSaving={isSaving} onPreview={() => setIsPreviewOpen(true)} isStatusChanging={isStatusChanging}
                                            onStatusChange={(s) => setValue('status', s, { shouldDirty: true })} onDetect={() => fields.length > 0 ? setIsDetectionModeOpen(true) : handleDetectClick('overwrite')}
                                            isDetecting={isDetecting} undo={handleUndo} redo={handleRedo} canUndo={canUndo} canRedo={canRedo}
                                            password={watch('password')} setPassword={(val) => setValue('password', val, { shouldDirty: true })}
                                            passwordProtected={watch('passwordProtected')} setPasswordProtected={(val) => setValue('passwordProtected', val, { shouldDirty: true })}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div key="step3" {...stepTransition}>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                        <div className="space-y-8">
                                            <Card className="shadow-sm overflow-hidden border-none ring-1 ring-border">
                                                <CardHeader className="bg-muted/30 border-b pb-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-primary/10 rounded-xl"><Globe className="h-5 w-5 text-primary" /></div>
                                                        <div><CardTitle className="text-lg font-black uppercase tracking-tight">Finalize & Integrate</CardTitle><CardDescription className="text-xs font-medium">Set document visibility and external connections.</CardDescription></div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-0">
                                                    <div className="p-6 bg-background">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <Controller name="status" control={form.control} render={({ field }) => (
                                                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Status</Label><Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 transition-all font-bold"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
                                                            )} />
                                                            <Controller name="slug" control={form.control} render={({ field }) => (
                                                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">URL Backhalf</Label><div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-muted/20 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-inner"><div className="bg-muted px-3 flex items-center text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60 border-r">/forms/</div><Input {...field} className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent font-bold" /></div></div>
                                                            )} />
                                                        </div>
                                                    </div>
                                                    <div className="px-6 pb-6 space-y-4">
                                                        <div className={cn("rounded-2xl border-2 transition-all duration-300", watch('passwordProtected') ? "border-primary/20 bg-primary/5" : "border-border/50 bg-background")}>
                                                            <div className="flex items-center justify-between p-4"><div className="flex items-center gap-3"><div className={cn("p-2 rounded-lg transition-colors", watch('passwordProtected') ? "bg-primary text-white" : "bg-muted text-muted-foreground")}><Lock className="h-4 w-4" /></div><div className="space-y-0.5"><Label className="text-sm font-black uppercase tracking-tight">Password Protection</Label><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Restrict access via global password</p></div></div><Controller name="passwordProtected" control={form.control} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} /></div>
                                                            <AnimatePresence>{watch('passwordProtected') && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="px-4 pb-4 pt-0"><Controller name="password" control={form.control} render={({ field }) => (<Input {...field} type="password" placeholder="Set access password..." className="h-10 rounded-xl bg-white border-primary/20 shadow-inner" />)} /></div></motion.div>)}</AnimatePresence>
                                                        </div>
                                                        <WebhookManager />
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card className="shadow-xl border-2 border-primary/10 bg-primary/5 overflow-hidden">
                                                <CardHeader className="bg-primary/5 pb-6 border-b border-primary/10">
                                                    <div className="flex items-center gap-3"><div className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20"><Send className="h-5 w-5" /></div><div><CardTitle className="text-lg font-black tracking-tight uppercase">Public Confirmation</CardTitle><CardDescription className="text-xs font-bold text-primary/60 uppercase tracking-widest">Dispatch messaging after signing</CardDescription></div></div>
                                                </CardHeader>
                                                <CardContent className="p-6 space-y-6">
                                                    <div className="p-5 bg-white border border-primary/20 rounded-[2rem] shadow-sm flex items-center justify-between transition-all hover:shadow-md">
                                                        <div className="flex items-center gap-4"><div className="p-3 bg-primary/10 rounded-2xl text-primary"><Mail className="h-6 w-6" /></div><div className="space-y-0.5"><Label className="text-base font-black uppercase tracking-tight">Public Acknowledgement</Label><p className="text-xs text-muted-foreground font-medium">Notify parent/respondent</p></div></div><Controller name="confirmationMessagingEnabled" control={form.control} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} className="scale-110" />} /></div>
                                                    <AnimatePresence>{watch('confirmationMessagingEnabled') && (<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="space-y-6"><div className="grid gap-4"><div className="space-y-2"><div className="flex justify-between items-center px-1"><Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Template</Label><Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[9px] font-black uppercase tracking-tighter text-primary gap-1" onClick={() => setIsQuickCreateOpen(true)}><PlusCircle className="h-3 w-3" /> New Template</Button></div><Controller name="confirmationTemplateId" control={form.control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value || 'none'}><SelectTrigger className="h-12 bg-white rounded-2xl shadow-sm border-primary/10 font-bold transition-all"><SelectValue placeholder="Select template..." /></SelectTrigger><SelectContent className="rounded-2xl"><SelectItem value="none">No Template Selected</SelectItem>{templates?.filter(t => t.isActive).map(t => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent></Select>)} /></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-primary/60 ml-1">Resolved From Identity</Label><Controller name="confirmationSenderProfileId" control={form.control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value || 'none'}><SelectTrigger className="h-12 bg-white rounded-2xl shadow-sm border-primary/10 font-bold transition-all"><ShieldCheck className="h-4 w-4 mr-2 text-primary/40" /><SelectValue placeholder="Auto-Resolve (Default)" /></SelectTrigger><SelectContent className="rounded-2xl"><SelectItem value="none">Auto-Resolve (Channel Default)</SelectItem>{profiles?.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} ({p.identifier})</SelectItem>))}</SelectContent></Select>)} /></div></div></motion.div>)}</AnimatePresence>
                                                </CardContent>
                                            </Card>
                                        </div>
                                        <div className="space-y-8"><InternalNotificationConfig prefix="adminAlert" category="forms" /></div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </form>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-[80] p-4 sm:p-6 bg-background/80 backdrop-blur-lg border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <div className="w-full md:w-[95%] lg:w-[90%] mx-auto max-w-7xl flex items-center justify-between gap-4">
                    <Button type="button" variant="ghost" onClick={() => router.push('/admin/pdfs')} className="font-bold text-muted-foreground hover:bg-muted/50 rounded-xl px-6 h-12">Cancel</Button>
                    <div className="flex items-center gap-4">{step > 1 && (<Button type="button" variant="outline" onClick={() => handleStepChange(step - 1)} className="font-bold border-border/50 rounded-xl px-6 h-12 gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>)}{step < 3 ? (<Button type="button" onClick={handleNext} className="gap-2 px-10 h-12 font-black shadow-xl rounded-xl transition-all active:scale-95 group">Next Phase <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Button>) : (<Button type="submit" disabled={isSaving} onClick={form.handleSubmit(onFinalSubmit)} className="gap-2 px-12 h-14 font-black shadow-2xl bg-primary text-white hover:bg-primary/90 rounded-[1.25rem] transition-all active:scale-95 text-lg">{isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />} Finalize & Save</Button>)}</div>
                </div>
            </div>
        </div>

        <PdfPreviewDialog isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} pdfForm={{ ...pdf, fields, namingFieldId, ...watch() } as PDFForm} />
        <QuickTemplateDialog open={isQuickCreateOpen} onOpenChange={setIsQuickCreateOpen} channel="email" category="forms" fixedSourceId={pdfId} onCreated={(id) => setValue('confirmationTemplateId', id, { shouldDirty: true })} />
        <AlertDialog open={isDetectionModeOpen} onOpenChange={setIsDetectionModeOpen}><AlertDialogContent className="sm:max-w-md"><AlertDialogHeader><div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4"><Sparkles className="h-6 w-6 text-primary" /></div><AlertDialogTitle className="text-center font-black">AI Field Detection</AlertDialogTitle><AlertDialogDescription className="text-center">You already have {fields.length} fields. How should the AI proceed?</AlertDialogDescription></AlertDialogHeader><div className="grid gap-4 py-4"><Button variant="outline" type="button" className="h-auto flex-col items-start gap-1 p-4 text-left rounded-xl transition-all hover:bg-primary/5 group" onClick={() => handleDetectClick('continue')}><div className="flex items-center gap-2 font-bold group-hover:text-primary transition-colors"><Play className="h-4 w-4 text-primary" />Continue Designing</div><span className="text-[10px] text-muted-foreground font-normal uppercase tracking-wider">Keep existing work and find missing fields.</span></Button><Button variant="outline" type="button" className="h-auto flex-col items-start gap-1 p-4 text-left rounded-xl border-destructive/20 hover:bg-destructive/5 group" onClick={() => handleDetectClick('overwrite')}><div className="flex items-center gap-2 font-bold text-destructive"><RefreshCcw className="h-4 w-4" />Re-design from Scratch</div><span className="text-[10px] text-muted-foreground font-normal uppercase tracking-wider">Wipe the canvas and let AI build the entire form.</span></Button></div><AlertDialogFooter><AlertDialogCancel type="button" className="w-full rounded-xl">Cancel</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </FormProvider>
  );
}
