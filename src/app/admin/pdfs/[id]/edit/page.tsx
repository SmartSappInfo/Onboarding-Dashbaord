
'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useUser, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Check, Loader2, Sparkles, RefreshCcw, Play, ArrowLeft, ArrowRight, Palette, Layout, Eye, Save, Mail, Send, AlertCircle, ShieldAlert, Globe, Lock, ShieldCheck, Zap, FileText, Settings2, Share2, PlusCircle
} from 'lucide-react';
import { type PDFForm, type PDFFormField, type WorkspaceEntity, type Entity, type MessageTemplate, type SenderProfile } from '@/lib/types';
import { savePdfForm, updatePdfFormStatus } from '@/lib/pdf-actions';
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
import { MediaSelect } from '@/app/admin/entities/components/media-select';
import WebhookManager from '@/app/admin/surveys/components/webhook-manager';
import InternalNotificationConfig from '@/app/admin/components/internal-notification-config';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { syncVariableRegistry } from '@/lib/messaging-actions';
import QuickTemplateDialog from '@/app/admin/messaging/components/quick-template-dialog';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { useWorkspace } from '@/context/WorkspaceContext';
import { MultiSelect } from '@/components/ui/multi-select';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Internal name must be at least 2 characters.' }),
  publicTitle: z.string().min(2, { message: 'Public title must be at least 2 characters.' }),
  entityId: z.string().optional().nullable(),
  entityName: z.string().optional().nullable(),
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
  isContractDocument: z.boolean().default(false),
  workspaceIds: z.array(z.string()).min(1, 'At least one workspace required.'),
  confirmationMessagingEnabled: z.boolean().default(false),
  confirmationTemplateId: z.string().optional(),
  confirmationSenderProfileId: z.string().optional(),
  adminAlertsEnabled: z.boolean().default(false),
  adminAlertChannel: z.enum(['email', 'sms', 'both']).default('both'),
  adminAlertNotifyManager: z.boolean().default(false),
  adminAlertSpecificUserIds: z.array(z.string()).default([]),
  adminAlertEmailTemplateId: z.string().optional(),
  adminAlertSmsTemplateId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const stepTransition = { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -20 }, transition: { type: 'spring' as const, damping: 25, stiffness: 200 } };

const Stepper = ({ currentStep, onStepClick }: { currentStep: number, onStepClick: (step: number) => void }) => {
    const steps = [{ name: 'Details', icon: Settings2 }, { name: 'Builder', icon: Layout }, { name: 'Publish', icon: Share2 }];
    return (
        <div className="flex justify-center items-center mb-12 max-w-2xl mx-auto px-4">
            {steps.map((step, index) => {
                const stepNum = index + 1;
                const Icon = step.icon;
                const isActive = currentStep === stepNum;
                const isCompleted = currentStep > stepNum;
                return (
                    <React.Fragment key={step.name}>
                        <button type="button" onClick={() => onStepClick(stepNum)} className="flex flex-col items-center group outline-none" disabled={index === steps.length - 1 && currentStep < 3}>
                            <div className={cn('flex items-center justify-center w-10 h-10 rounded-2xl border-2 transition-all duration-300 shadow-sm group-hover:scale-110', isCompleted ? 'bg-primary border-primary text-primary-foreground' : isActive ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-background border-border text-muted-foreground')}><Icon className="w-5 h-5" /></div>
                            <p className={cn('mt-3 text-[10px] font-black uppercase tracking-widest transition-colors', isActive || isCompleted ? 'text-primary' : 'text-muted-foreground opacity-60 group-hover:opacity-100')}>{step.name}</p>
                        </button>
                        {index < steps.length - 1 && (<div className="flex-1 mx-4 h-[2px] relative overflow-hidden bg-muted rounded-full"><motion.div initial={false} animate={{ width: isCompleted ? '100%' : '0%' }} className="absolute left-0 top-0 h-full bg-primary" /></div>)}
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
  const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();

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
  const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        name: '', publicTitle: '', entityId: null, entityName: null, status: 'draft', slug: '', logoUrl: '', backgroundColor: '#F1F5F9', backgroundPattern: 'none', patternColor: '#3B5FFF', webhookEnabled: false, webhookId: '', passwordProtected: false, password: '', isContractDocument: false, confirmationMessagingEnabled: false, confirmationTemplateId: '', confirmationSenderProfileId: '', adminAlertsEnabled: false, adminAlertChannel: 'both', adminAlertNotifyManager: false, adminAlertSpecificUserIds: [], workspaceIds: [activeWorkspaceId]
    }
  });

  const { reset, watch, setValue, getValues, trigger } = form;
  const schoolsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'workspace_entities'), where('workspaceId', '==', activeWorkspaceId), orderBy('displayName', 'asc')) : null, [firestore, activeWorkspaceId]);
  const { data: entities } = useCollection<WorkspaceEntity>(schoolsQuery);

  const selectedSchool = React.useMemo(() => entities?.find(s => s.id === watchedSchoolId), [entities, watchedSchoolId]);

  const { state: historyState, set: setHistory, undo: undoHistory, redo: redoHistory, canUndo, canRedo, reset: resetHistory } = useUndoRedo<PDFFormField[]>([]);

  const isProgrammaticChange = React.useRef(false);
  const debouncedFields = useDebounce(fields, 800);
  const watchedForm = watch();
  const debouncedForm = useDebounce(watchedForm, 2000);

  const pdfDocRef = useMemoFirebase(() => firestore && pdfId ? doc(firestore, 'pdfs', pdfId) : null, [firestore, pdfId]);
  const { data: pdf, isLoading } = useDoc<PDFForm>(pdfDocRef);

  const livePdf = React.useMemo(() => {
    if (!pdf) return {} as PDFForm;
    return {
      ...pdf,
      ...watchedForm,
      fields,
      namingFieldId
    } as PDFForm;
  }, [pdf, watchedForm, fields, namingFieldId]);
  
  useSetBreadcrumb(pdf?.name, `/admin/pdfs/${pdfId}`);

  React.useEffect(() => {
    if (pdf && !hasInitialized) {
      const initialFields = JSON.parse(JSON.stringify(pdf.fields || []));
      setFields(initialFields);
      setNamingFieldId(pdf.namingFieldId || null);
      resetHistory(initialFields);
      
      const pattern = pdf.backgroundPattern || 'none';

      reset({
        ...pdf,
        internalName: pdf.name || '',
        workspaceIds: pdf.workspaceIds || [activeWorkspaceId],
        backgroundPattern: pattern as any,
      } as any);
      setHasInitialized(true);
    }
  }, [pdf, reset, resetHistory, activeWorkspaceId, hasInitialized]);

  const performSave = async (data: FormData, redirect: boolean = false) => {
    setIsSaving(true);
    const result = await savePdfForm(pdfId, { ...data, fields, namingFieldId });
    if (result.success) {
      toast({ title: 'Document Saved' });
      if (data.status === 'published') syncVariableRegistry().catch(console.error);
      if (redirect) router.push('/admin/pdfs');
    } else {
      toast({ variant: 'destructive', title: 'Save Failed' });
    }
    setIsSaving(false);
  };

  const handleUndo = () => { if (canUndo) { isProgrammaticChange.current = true; undoHistory(); } };
  const handleRedo = () => { if (canRedo) { isProgrammaticChange.current = true; redoHistory(); } };

  const handleNext = async () => {
    let fieldsToValidate: any[] = [];
    if (step === 1) fieldsToValidate = ['name', 'publicTitle', 'logoUrl', 'backgroundColor', 'backgroundPattern', 'patternColor'];
    const isStepValid = await trigger(fieldsToValidate);
    if (!isStepValid) { toast({ variant: 'destructive', title: 'Validation Error' }); return; }
    setStep(step + 1);
  };

  const handleStepChange = async (targetStep: number) => {
    if (targetStep === step) return;
    if (targetStep > step) { const isStepValid = await trigger(); if (!isStepValid) return; }
    setStep(targetStep);
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
        const result = await detectPdfFields({ pdfDataUri: base64data, existingFields: mode === 'continue' ? fields : undefined });
        if (result.fields?.length > 0) {
            const newSuggestions = result.fields.map(suggestion => ({ ...suggestion, id: `ai_${Date.now()}_${Math.random().toString(36).substr(2,5)}`, isSuggestion: true }));
            if (mode === 'overwrite') setFields(newSuggestions);
            else setFields(prev => [...prev, ...newSuggestions]);
            toast({ title: 'AI Detection Complete', description: `${result.fields.length} potential fields found.` });
        }
    } catch (error: any) { toast({ variant: 'destructive', title: 'AI Detection Failed' }); } finally { setIsDetecting(false); }
  };

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!pdf) return <div className="text-center py-20"><p>Document not found.</p></div>;

  return (
    <FormProvider {...form}>
        <div className="h-full flex flex-col bg-muted/30">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                <div className="w-full md:w-[95%] lg:w-[90%] mx-auto max-w-7xl">
                    <Stepper currentStep={step} onStepClick={handleStepChange} />
                    <form onSubmit={form.handleSubmit((d) => performSave(d, true))} className="pb-32">
                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div key="step1" {...stepTransition}>
                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                        <Card className="xl:col-span-2 shadow-sm border-none ring-1 ring-border text-left">
                                            <CardHeader className="bg-muted/30 border-b pb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded-xl"><FileText className="h-5 w-5 text-primary" /></div>
                                                    <div><CardTitle className="text-lg font-black uppercase tracking-tight">Document Identity</CardTitle><CardDescription className="text-xs font-medium">Naming and hub association details.</CardDescription></div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-8 bg-background">
                                                <Controller name="workspaceIds" control={form.control} render={({ field }) => (
                                                    <div className="space-y-4">
                                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary ml-1 flex items-center gap-2"><Layout className="h-3 w-3" /> Shared Context (Workspaces)</Label>
                                                        <MultiSelect options={workspaceOptions} value={field.value || []} onChange={field.onChange} placeholder="Share across hubs..." />
                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight leading-relaxed">Determines which workspace directories this form template is visible in.</p>
                                                    </div>
                                                )} />
                                                <Separator />
                                                <Controller name="name" control={form.control} render={({ field }) => (
                                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Internal Title</Label><Input {...field} placeholder="e.g. 2024 Enrollment Form" className="h-12 rounded-xl bg-muted/20 border-none shadow-none font-bold text-lg" /></div>
                                                )} />
                                                <Controller name="publicTitle" control={form.control} render={({ field }) => (
                                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">User-Facing Header</Label><Input {...field} placeholder="e.g. School Admission Application" className="h-12 rounded-xl bg-muted/20 border-none shadow-none font-bold text-lg" /></div>
                                                )} />
                                                <Controller name="entityId" control={form.control} render={({ field }) => (
                                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sample Data Context</Label><Select onValueChange={(val) => { const ent = entities?.find(s => s.id === val); field.onChange(val === 'none' ? null : val); setValue('entityName', ent ? ent.displayName : 'SmartSapp'); }} value={field.value || 'none'}><SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none font-bold"><SelectValue placeholder="Select context..." /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="none">Generic (No Context)</SelectItem>{entities?.map(ent => (<SelectItem key={ent.id} value={ent.id}>{ent.displayName}</SelectItem>))}</SelectContent></Select></div>
                                                )} />
                                            </CardContent>
                                        </Card>
                                        <div className="space-y-8 text-left">
                                            <Card className="shadow-sm border-none ring-1 ring-border">
                                                <CardHeader className="bg-muted/30 border-b pb-6 px-6"><div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><Palette className="h-5 w-5 text-primary" /></div><div><CardTitle className="text-lg font-black uppercase tracking-tight">Visual Identity</CardTitle></div></div></CardHeader>
                                                <CardContent className="p-6 space-y-8 bg-background">
                                                    <Controller name="logoUrl" control={form.control} render={({ field }) => (<div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Brand Logo</Label><MediaSelect {...field} filterType="image" className="rounded-2xl" /></div>)} />
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            {step === 2 && (
                                <motion.div key="step2" {...stepTransition} className="h-full">
                                    <div className="h-[80vh] border-none ring-1 ring-border rounded-[2rem] overflow-hidden shadow-2xl bg-background">
                                        <FieldMapper pdf={livePdf} fields={fields} setFields={setFields} namingFieldId={namingFieldId} setNamingFieldId={setNamingFieldId} onSave={() => {}} isSaving={isSaving} onPreview={() => setIsPreviewOpen(true)} isStatusChanging={isStatusChanging} onStatusChange={(s) => setValue('status', s, { shouldDirty: true })} onDetect={() => fields.length > 0 ? setIsDetectionModeOpen(true) : handleDetectClick('overwrite')} isDetecting={isDetecting} undo={handleUndo} redo={handleRedo} canUndo={canUndo} canRedo={canRedo} password={watch('password')} setPassword={(val) => setValue('password', val, { shouldDirty: true })} passwordProtected={watch('passwordProtected')} setPasswordProtected={(val) => setValue('passwordProtected', val, { shouldDirty: true })} school={selectedSchool} />
                                    </div>
                                </motion.div>
                            )}
                            {step === 3 && (
                                <motion.div key="step3" {...stepTransition}>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start text-left">
                                        <div className="space-y-8">
                                            <Card className="shadow-sm overflow-hidden border-none ring-1 ring-border">
                                                <CardHeader className="bg-muted/30 border-b pb-6"><div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><Globe className="h-5 w-5 text-primary" /></div><div><CardTitle className="text-lg font-black uppercase tracking-tight">Finalize & Integrate</CardTitle></div></div></CardHeader>
                                                <CardContent className="p-0">
                                                    <div className="p-6 bg-background">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <Controller name="status" control={form.control} render={({ field }) => (
                                                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Status</Label><Select onValueChange={field.onChange} value={field.value}>
                                                                    <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none font-bold">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl">
                                                                        <SelectItem value="draft">Draft</SelectItem>
                                                                        <SelectItem value="published">Published</SelectItem>
                                                                        <SelectItem value="archived">Archived</SelectItem>
                                                                    </SelectContent>
                                                                </Select></div>
                                                            )} />
                                                            <Controller name="slug" control={form.control} render={({ field }) => (
                                                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">URL Backhalf</Label><div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-muted/20 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-inner"><div className="bg-muted px-3 flex items-center text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60 border-r">/forms/</div><Input {...field} className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent font-bold" /></div></div>
                                                            )} />
                                                        </div>
                                                    </div>
                                                    <div className="px-6 pb-6 space-y-4">
                                                        <div className={cn("rounded-2xl border-2 transition-all duration-300", watch('isContractDocument') ? "border-primary/20 bg-primary/5" : "border-border/50 bg-background")}><div className="flex items-center justify-between p-4"><div className="flex items-center gap-3"><div className={cn("p-2 rounded-lg", watch('isContractDocument') ? "bg-primary text-white" : "bg-muted text-muted-foreground")}><ShieldCheck className="h-4 w-4" /></div><div className="space-y-0.5"><Label className="text-sm font-black uppercase tracking-tight">Contract Template</Label><p className="text-[10px] text-muted-foreground font-medium">Mark as a binding agreement</p></div></div><Controller name="isContractDocument" control={form.control} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} /></div></div>
                                                        <WebhookManager />
                                                    </div>
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
                    <Button type="button" variant="ghost" onClick={() => router.push('/admin/pdfs')} className="font-bold text-muted-foreground rounded-xl px-6 h-12">Cancel</Button>
                    <div className="flex items-center gap-4">{step > 1 && (<Button type="button" variant="outline" onClick={() => handleStepChange(step - 1)} className="font-bold border-border/50 rounded-xl px-6 h-12 gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>)}{step < 3 ? (<Button type="button" onClick={handleNext} className="gap-2 px-10 h-12 font-black shadow-xl rounded-xl transition-all active:scale-95 group">Next Phase <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Button>) : (<Button type="submit" disabled={isSaving} onClick={form.handleSubmit((d) => performSave(d, true))} className="gap-2 px-12 h-14 font-black shadow-2xl bg-primary text-white hover:bg-primary/90 rounded-[1.25rem] transition-all active:scale-95 text-lg">{isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />} Finalize & Save</Button>)}</div>
                </div>
            </div>
        </div>
        <PdfPreviewDialog isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} pdfForm={{ ...pdf, fields, namingFieldId, ...watch() } as PDFForm} school={selectedSchool} />
    </FormProvider>
  );
}

function Separator({ className }: { className?: string }) { return <div className={cn("h-px w-full bg-border", className)} />; }
