'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Check, Loader2, Sparkles, RefreshCcw, Play, ArrowLeft, ArrowRight, Palette, Layout, Link as LinkIcon, Eye, Save
} from 'lucide-react';
import { type PDFForm, type PDFFormField } from '@/lib/types';
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

const formSchema = z.object({
  name: z.string().min(2, { message: 'Internal name must be at least 2 characters.' }),
  publicTitle: z.string().min(2, { message: 'Public title must be at least 2 characters.' }),
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
                            className={cn(
                                "flex flex-col items-center group outline-none",
                                index === steps.length - 1 && "flex-shrink-0"
                            )}
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
        status: 'draft',
        slug: '',
        logoUrl: '',
        backgroundColor: '#F1F5F9',
        backgroundPattern: 'none',
        patternColor: '#3B5FFF',
        webhookEnabled: false,
        passwordProtected: false,
    }
  });

  const { reset, watch, setValue, getValues, trigger } = form;

  // Undo/Redo Logic for Fields
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

  // Sync fields to history
  React.useEffect(() => {
    if (isProgrammaticChange.current) return;
    setHistory(debouncedFields);
  }, [debouncedFields, setHistory]);

  // Apply history changes back to fields
  React.useEffect(() => {
    if (isProgrammaticChange.current) {
        setFields(historyState);
        isProgrammaticChange.current = false;
    }
  }, [historyState]);

  const handleSave = async (data: FormData) => {
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

    // Determine display fields: Key field (first) + next 2 non-signature fields
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
      router.push('/admin/pdfs');
    } else {
      toast({ variant: 'destructive', title: 'Save Failed' });
    }
    setIsSaving(false);
  };

  const handleNext = async () => {
    let fieldsToValidate: any[] = [];
    if (step === 1) fieldsToValidate = ['name', 'publicTitle', 'logoUrl', 'backgroundColor', 'backgroundPattern', 'patternColor'];
    if (step === 2) fieldsToValidate = []; // Builder has internal validation if needed
    
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

                <form onSubmit={form.handleSubmit(handleSave)} className="space-y-8">
                    
                    {/* Step 1: Details */}
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
                                                                <Input type="color" {...field} className="w-10 h-10 p-1 rounded-lg shadow-sm" />
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
                                                                <Input type="color" {...field} className="w-10 h-10 p-1 rounded-lg shadow-sm" />
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

                    {/* Step 2: Builder */}
                    <div className={cn("h-[80vh] border rounded-2xl overflow-hidden", step !== 2 && 'hidden')}>
                        <FieldMapper
                            pdf={pdf}
                            fields={fields}
                            setFields={setFields}
                            namingFieldId={namingFieldId}
                            setNamingFieldId={setNamingFieldId}
                            onSave={() => handleSave(getValues())}
                            isSaving={isSaving}
                            onPreview={() => setIsPreviewOpen(true)}
                            isStatusChanging={isStatusChanging}
                            onStatusChange={(s) => setValue('status', s, { shouldDirty: true })}
                            onDetect={() => fields.length > 0 ? setIsDetectionModeOpen(true) : handleDetectClick('overwrite')}
                            isDetecting={isDetecting}
                            undo={undoHistory}
                            redo={redoHistory}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            password={watch('password')}
                            setPassword={(val) => setValue('password', val, { shouldDirty: true })}
                            passwordProtected={watch('passwordProtected')}
                            setPasswordProtected={(val) => setValue('passwordProtected', val, { shouldDirty: true })}
                        />
                    </div>

                    {/* Step 3: Publish */}
                    <div className={cn("space-y-8", step !== 3 && 'hidden')}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Finalize & Integrate</CardTitle>
                                <CardDescription>Set the document status and connect external automations.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <Controller
                                        name="status"
                                        control={form.control}
                                        render={({ field }) => (
                                            <div className="space-y-2">
                                                <Label>Status</Label>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger className="h-11">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
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
                                                <Label>URL Backhalf</Label>
                                                <div className="flex h-11 border rounded-xl overflow-hidden shadow-sm">
                                                    <div className="bg-muted px-3 flex items-center text-[10px] font-mono text-muted-foreground border-r">/forms/</div>
                                                    <Input {...field} className="border-none rounded-none shadow-none focus-visible:ring-0 h-full" />
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-1">This creates the public link for the form.</p>
                                            </div>
                                        )}
                                    />
                                </div>

                                <Separator />

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 bg-muted/30 border rounded-2xl">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                                <ShieldAlert className="h-4 w-4 text-primary" />
                                                Password Protection
                                            </Label>
                                            <p className="text-xs text-muted-foreground">Restrict access to this document via a global password.</p>
                                        </div>
                                        <Controller
                                            name="passwordProtected"
                                            control={form.control}
                                            render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                                        />
                                    </div>
                                    {watch('passwordProtected') && (
                                        <Controller
                                            name="password"
                                            control={form.control}
                                            render={({ field }) => (
                                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                                    <Label className="text-xs font-bold">Access Password</Label>
                                                    <Input {...field} type="password" placeholder="Enter password..." className="h-11" />
                                                </div>
                                            )}
                                        />
                                    )}
                                </div>

                                <Separator />

                                <WebhookManager />
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex justify-between items-center mt-12 pb-20">
                        <Button type="button" variant="ghost" onClick={() => router.push('/admin/pdfs')}>Cancel</Button>
                        <div className="flex items-center gap-4">
                            {step > 1 && <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)}>Previous</Button>}
                            {step < 3 ? (
                                <Button type="button" onClick={handleNext} className="gap-2 px-8 font-bold">
                                    Next <ArrowRight className="h-4 w-4" />
                                </Button>
                            ) : (
                                <Button type="submit" disabled={isSaving} className="gap-2 px-10 font-black shadow-xl">
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save Document
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

const ShieldAlert = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
    <path d="M12 8v4"/><path d="M12 16h.01"/>
  </svg>
);
