'use client';

import * as React from 'react';
import { useForm, Controller, useWatch, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFForm, PDFFormField, WorkspaceEntity, Entity } from '@/lib/types';
import SignaturePadModal from './SignaturePadModal';
import DataEntryModal from './DataEntryModal';
import AlreadySignedGate from './AlreadySignedGate';
import { 
    Loader2, 
    Download, 
    CheckCircle2, 
    Send, 
    ShieldAlert, 
    AlertTriangle, 
    AlertCircle,
    ZoomIn, 
    ZoomOut, 
    Edit3, 
    LayoutList, 
    X, 
    ChevronDown, 
    Clock, 
    Save,
    Calendar as CalendarIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { format, isValid, parseISO } from 'date-fns';
import { SmartSappIcon, SmartSappLogo } from '@/components/icons';
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
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { cn, resolveVariableValue, toTitleCase } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useFirestore } from '@/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { saveAgreementProgressAction, finalizeAgreementAction } from '@/lib/pdf-actions';

const pdfjsPromise = import('pdfjs-dist');

const generateValidationSchema = (fields: PDFFormField[]) => {
    const schemaObject = fields.reduce((acc, field) => {
        if (field.type === 'static-text' || field.type === 'variable') return acc;
        let fieldSchema: z.ZodTypeAny = z.string().optional().nullable().or(z.literal(''));
        if (field.type === 'email') {
            const emailSchema = z.string().email({ message: "Invalid email." });
            fieldSchema = field.required ? emailSchema : emailSchema.optional().or(z.literal(''));
        } else if (field.type === 'phone') {
            const phoneSchema = z.string().min(10, "Phone required.");
            fieldSchema = field.required ? phoneSchema : phoneSchema.optional().or(z.literal(''));
        } else if (field.required) {
            fieldSchema = z.string({ required_error: "Required." }).min(1, { message: "Required." });
        }
        acc[field.id] = fieldSchema;
        return acc;
    }, {} as Record<string, z.ZodTypeAny>);
    return z.object(schemaObject);
}

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

const BackgroundPattern = ({ pattern, color }: { pattern?: PDFForm['backgroundPattern'], color?: string }) => {
    if (!pattern || pattern === 'none') return null;
    const patterns: Record<string, React.ReactNode> = {
        dots: <svg width="100%" height="100%"><defs><pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill={color || "currentColor"} opacity="0.1" /></pattern></defs><rect width="100%" height="100%" fill="url(#dots)" /></svg>,
        grid: <svg width="100%" height="100%"><defs><pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke={color || "currentColor"} strokeWidth="1" opacity="0.05" /></pattern></defs><rect width="100%" height="100%" fill="url(#grid)" /></svg>,
        gradient: <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1] via-[#a855f7] to-[#ec4899] opacity-90" />
    };
    return <div className="absolute inset-0 pointer-events-none text-foreground/20">{patterns[pattern]}</div>;
};

const DatePicker = ({ value, onChange, disabled, className, style, placeholder }: { value?: any, onChange: (date?: Date) => void, disabled?: boolean, className?: string, style?: React.CSSProperties, placeholder?: string }) => {
    let dateValue = value && isValid(value instanceof Date ? value : parseISO(value)) ? (value instanceof Date ? value : parseISO(value)) : undefined;
    return (
        <Popover><PopoverTrigger asChild><Button variant="ghost" disabled={disabled} className={cn("w-full h-full min-h-0 p-0.5 border-transparent bg-transparent hover:bg-primary/5 transition-all justify-start text-left font-normal rounded-none", !dateValue && "text-muted-foreground/40", className)} style={style}><span className="truncate">{dateValue ? format(dateValue, "PPP") : (placeholder || 'Pick date')}</span></Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateValue} onSelect={onChange} initialFocus captionLayout="dropdown" /></PopoverContent></Popover>
    );
}

export default function PdfFormRenderer({ pdfForm, entity, identity, initialData = {}, isLocked = false, isPreview = false, existingSubmissionId }: { pdfForm: PDFForm, entity?: WorkspaceEntity, identity?: Entity, initialData?: Record<string, any>, isLocked?: boolean, isPreview?: boolean, existingSubmissionId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isFinalizedView, setIsFinalizedView] = React.useState(isLocked);
  const [createdSubmissionId, setCreatedSubmissionId] = React.useState<string | null>(null);
  
  const [mediaCaptureState, setMediaCaptureState] = React.useState<{ fieldId: string, mode: 'signature' | 'photo' } | null>(null);
  const [isDataEntryOpen, setIsDataEntryOpen] = React.useState(false);
  const [activeDataFieldId, setActiveDataFieldId] = React.useState<string | null>(null);
  
  const [zoom, setZoom] = React.useState(1.0);
  const [baseScale, setBaseScale] = React.useState(1.3);
  
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [pendingFormData, setPendingFormData] = React.useState<any>(null);
  const [showMissingFieldsModal, setShowMissingFieldsModal] = React.useState(false);
  const [missingFields, setMissingFields] = React.useState<{ id: string, label: string, pageIndex: number }[]>([]);

  const pageContainerRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const zoomRef = React.useRef(zoom);
  React.useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  const touchStartDist = React.useRef<number | null>(null);
  const startZoom = React.useRef<number>(1.0);

  const validationSchema = React.useMemo(() => generateValidationSchema(pdfForm.fields), [pdfForm.fields]);
  const methods = useForm({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
    defaultValues: initialData
  });

  const { register, handleSubmit, watch, setValue, getValues, formState: { errors }, control, trigger: validate } = methods;
  const watchedValues = watch();

  // Auto-populate empty date fields with today's date on mount
  React.useEffect(() => {
    let hasUpdated = false;
    pdfForm.fields.forEach(field => {
        if (field.type === 'date' && !watchedValues[field.id]) {
            setValue(field.id, new Date().toISOString(), { shouldValidate: true, shouldDirty: false });
            hasUpdated = true;
        }
    });
  }, [pdfForm.fields, setValue]);

  const isFormComplete = React.useMemo(() => {
      return pdfForm.fields
        .filter(f => f.type !== 'static-text' && f.type !== 'variable')
        .every(f => {
            if (!f.required) return true;
            return !isValueEmpty(watchedValues[f.id], f.type);
        });
  }, [pdfForm.fields, watchedValues]);

  React.useEffect(() => {
    if (pdfForm.downloadUrl) {
        import('pdfjs-dist').then(pdfjs => {
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;
            pdfjs.getDocument({ url: pdfForm.downloadUrl }).promise.then(setPdfDoc).catch(() => toast({ variant: 'destructive', title: 'Error Loading Template' }));
        });
    }
  }, [pdfForm.downloadUrl, toast]);

  const updateBaseScale = React.useCallback(() => {
    if (typeof window !== 'undefined') {
        const width = window.innerWidth;
        if (width < 640) setBaseScale(0.9);
        else if (width < 1024) setBaseScale(1.1);
        else setBaseScale(1.3);
    }
  }, []);

  React.useEffect(() => {
    updateBaseScale();
    window.addEventListener('resize', updateBaseScale);
    return () => window.removeEventListener('resize', updateBaseScale);
  }, [updateBaseScale]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = -e.deltaY;
        const factor = Math.exp(delta * 0.005);
        setZoom(prev => Math.min(Math.max(prev * factor, 0.5), 3.0));
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        touchStartDist.current = dist;
        startZoom.current = zoomRef.current;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDist.current !== null) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        const factor = dist / touchStartDist.current;
        const newZoom = Math.min(Math.max(startZoom.current * factor, 0.5), 3.0);
        setZoom(newZoom);
      }
    };

    const onTouchEnd = () => {
      touchStartDist.current = null;
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('touchstart', onTouchStart, { passive: false });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd);
    
    return () => {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
    };
  }, [setZoom]);

  const handleSaveProgress = async () => {
      if (isPreview || !entity) return;
      setIsSubmitting(true);
      const data = getValues();
      const res = await saveAgreementProgressAction(pdfForm.id, entity.entityId, data);
      if (res.success) toast({ title: 'Progress Saved', description: 'Institutional data cached.' });
      else toast({ variant: 'destructive', title: 'Save Failed', description: res.error });
      setIsSubmitting(false);
  };

  const handlePreSubmit = (data: any) => {
    if (isPreview) { toast({ title: 'Preview Mode' }); return; }
    const flattenedData = { ...data };
    pdfForm.fields.forEach(field => {
        if (field.type === 'static-text' && field.staticText) {
            flattenedData[field.id] = field.staticText;
        } else if (field.type === 'variable' && field.variableKey) {
            // Priority: resolved from identity context, fallback to entity denormalized fields
            const resolved = resolveVariableValue(field.variableKey, identity || entity);
            if (resolved !== null) flattenedData[field.id] = resolved;
        }
    });
    setPendingFormData(flattenedData);
    setShowConfirmDialog(true);
  };

  const onInvalid = () => {
    const missing: { id: string, label: string, pageIndex: number }[] = [];
    const formData = getValues();
    pdfForm.fields.filter(f => f.type !== 'static-text' && f.type !== 'variable').forEach(field => {
        if (field.required && isValueEmpty(formData[field.id], field.type)) {
            missing.push({ id: field.id, label: field.label || field.placeholder || 'Field', pageIndex: field.pageNumber });
        }
    });
    if (missing.length > 0) {
        setMissingFields(missing);
        setShowMissingFieldsModal(true);
    } else {
        toast({ variant: 'destructive', title: 'Action Required', description: 'Please review the marked fields on the document.' });
    }
  };

  const onConfirmSubmission = async () => {
    if (!pendingFormData) return;
    setIsSubmitting(true);
    setShowConfirmDialog(false);

    try {
        if (entity) {
            const res = await finalizeAgreementAction(pdfForm.id, entity.entityId, pendingFormData);
            if (res.success && res.submissionId) {
                setCreatedSubmissionId(res.submissionId);
                setIsFinalizedView(true);
                toast({ title: 'Agreement Finalized', description: 'Document locked and archived.' });
            } else throw new Error(res.error);
        } else {
            const res = await fetch('/api/pdfs/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pdfId: pdfForm.id, formData: pendingFormData })
            });
            const result = await res.json();
            if (res.ok) {
                setCreatedSubmissionId(result.submissionId);
                setIsFinalizedView(true);
            } else throw new Error(result.error);
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Submission Failed', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleOkMissingFields = () => {
    setShowMissingFieldsModal(false);
    if (missingFields.length > 0) {
        const first = missingFields[0];
        const el = document.getElementById(first.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const renderField = (field: PDFFormField) => {
    const value = watchedValues[field.id];
    const currentTotalScale = baseScale * zoom;
    const dynamicFontSize = `${Math.round((field.fontSize || 11) * currentTotalScale)}px`;
    const fieldStyle: React.CSSProperties = { fontSize: dynamicFontSize, color: field.color || 'inherit', fontWeight: field.bold ? 'bold' : 'normal', fontStyle: field.italic ? 'italic' : 'normal', textDecoration: field.underline ? 'underline' : 'none', textAlign: field.alignment || 'left', display: 'flex', flexDirection: 'column', justifyContent: field.verticalAlignment === 'bottom' ? 'flex-end' : field.verticalAlignment === 'top' ? 'flex-start' : 'center', alignItems: field.alignment === 'right' ? 'flex-end' : field.alignment === 'center' ? 'center' : field.alignment === 'left' ? 'flex-start' : 'flex-start', textTransform: field.textTransform === 'capitalize' ? 'none' : (field.textTransform || 'none') };
    const applyTransform = (val: string) => field.textTransform === 'uppercase' ? val.toUpperCase() : field.textTransform === 'capitalize' ? toTitleCase(val) : val;

    if (field.type === 'static-text' || field.type === 'variable' || isFinalizedView) {
        let text = field.type === 'static-text' ? field.staticText : field.type === 'variable' ? resolveVariableValue(field.variableKey || '', school) : value;
        return <div className="w-full h-full flex overflow-visible" style={fieldStyle}>{(field.type === 'signature' || field.type === 'photo') ? (text && <img src={text} alt="M" className="w-full h-full object-contain" />) : <span className={cn("px-1 whitespace-nowrap bg-transparent", field.bold ? "font-bold text-black" : "text-black/80")}>{field.type === 'date' && text ? format(new Date(text), 'PPP') : applyTransform(String(text || ''))}</span>}</div>;
    }

    if (!isMobile && field.type !== 'signature' && field.type !== 'photo') {
        return (
            <div className="w-full h-full group/desktop-field relative" style={fieldStyle}>
                {field.type === 'dropdown' ? (
                    <Controller name={field.id} control={control} render={({ field: sf }) => (<Select onValueChange={sf.onChange} value={sf.value}><SelectTrigger className="w-full h-full min-h-0 p-0.5 border-transparent bg-transparent rounded-none shadow-none focus:ring-0" style={{ fontSize: 'inherit', color: field.color || 'inherit' }}><SelectValue placeholder={field.label} /></SelectTrigger><SelectContent className="rounded-xl">{(field.options || []).map((o, i) => (<SelectItem key={i} value={o}>{o}</SelectItem>))}</SelectContent></Select>)} />
                ) : field.type === 'date' ? (
                    <Controller name={field.id} control={control} render={({ field: df }) => (<DatePicker value={df.value} onChange={(d) => df.onChange(d?.toISOString())} placeholder={field.label} style={{ fontSize: 'inherit', color: field.color || 'inherit' }} className={cn(errors[field.id] && "bg-destructive/5")} />)} />
                ) : (
                    <Input {...register(field.id)} type={field.type === 'time' ? 'time' : 'text'} placeholder={field.placeholder || field.label} className={cn("w-full h-full min-h-0 p-0.5 border-transparent bg-transparent rounded-none shadow-none focus-visible:ring-0", errors[field.id] && "bg-destructive/5")} style={{ fontSize: 'inherit', textAlign: 'inherit', color: field.color || 'inherit' }} />
                )}
            </div>
        );
    }

    return (
        <button type="button" onClick={() => (field.type === 'signature' || field.type === 'photo') ? setMediaCaptureState({ fieldId: field.id, mode: field.type }) : (setActiveDataFieldId(field.id), setIsDataEntryOpen(true))} className={cn("w-full h-full text-left transition-all border border-transparent hover:bg-primary/5 rounded-sm p-1", (field.type === 'signature' || field.type === 'photo') && "border-dashed border-muted-foreground", errors[field.id] && "border-destructive bg-destructive/5")} style={fieldStyle}>
            {value ? ((field.type === 'signature' || field.type === 'photo') ? <img src={value} alt="M" className="w-full h-full object-contain" /> : <span className="truncate w-full">{field.type === 'date' ? format(new Date(value), 'PPP') : applyTransform(String(value))}</span>) : <span className="opacity-40 text-[8px] uppercase">{field.placeholder || field.label}</span>}
        </button>
    );
  }

  if (isFinalizedView) {
      const activeSubmissionId = existingSubmissionId || createdSubmissionId;
      return (
          <div className="min-h-screen flex flex-col bg-slate-50 relative overflow-hidden">
              <BackgroundPattern pattern={pdfForm.backgroundPattern} color={pdfForm.patternColor} />
              <AlreadySignedGate 
                entityName={identity?.name || entity?.displayName} 
                logoUrl={entity?.primaryEmail} // Placeholder for logo until Entity schema handles it
                pdfName={pdfForm.name} 
                onView={() => router.push(`/forms/results/${pdfForm.slug || pdfForm.id}/${activeSubmissionId}`)} 
              />
          </div>
      );
  }

  return (
    <FormProvider {...methods}>
        <div className="light flex flex-col h-[100dvh] overflow-hidden relative" style={{ backgroundColor: pdfForm.backgroundColor || '#F1F5F9' }}>
            <BackgroundPattern pattern={pdfForm.backgroundPattern} color={pdfForm.patternColor} />
            <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b px-4 h-14 flex items-center gap-2 shadow-sm shrink-0 text-left">
                {entity?.primaryEmail ? <div className="relative h-9 w-12 shrink-0"><CheckCircle2 className="text-primary h-6 w-6" /></div> : <SmartSappIcon className="h-8 w-8 text-primary" />}
                <div className="flex flex-col min-w-0 -ml-1">
                    <h1 className="font-black truncate max-w-[200px] leading-tight text-xs uppercase tracking-tight">
                        {identity?.name || entity?.displayName || pdfForm.publicTitle}
                    </h1>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter leading-none">{pdfForm.publicTitle}</p>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                    {!isFormComplete ? (
                        <Button variant="outline" size="sm" onClick={handleSaveProgress} disabled={isSubmitting || isPreview || !entity} className="rounded-xl font-bold h-10 px-4 flex items-center gap-2 transition-all active:scale-95 border-primary/20 text-primary">
                            {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isMobile ? 'Save' : 'Save Progress'}
                        </Button>
                    ) : (
                        <Button type="button" size="sm" onClick={handleSubmit(handlePreSubmit, onInvalid)} className="rounded-xl font-black shadow-lg px-6 h-10 uppercase text-[10px] tracking-widest gap-2 bg-primary animate-in zoom-in duration-300">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            {isMobile ? 'Finalize' : 'Finalize Agreement'}
                        </Button>
                    )}
                </div>
            </header>
            <main className="flex-grow relative overflow-hidden z-10">
                <ScrollArea className="h-full w-full" viewportRef={viewportRef}>
                    <div ref={pageContainerRef} className="p-2 sm:p-8 flex flex-col items-center min-w-full touch-pan-x touch-pan-y" style={{ minWidth: 'fit-content' }}>
                        {!pdfDoc ? <Skeleton className="w-[8.5in] h-[11in] rounded-lg shadow-lg bg-card" /> : (
                            <div className="flex flex-col gap-4 sm:gap-8 pb-8">
                                {Array.from({ length: pdfDoc.numPages }).map((_, index) => (
                                    <div key={index} className="page-capture-wrapper" data-page-number={index + 1}>
                                        <PageRenderer pdf={pdfDoc} pageNumber={index + 1} fields={pdfForm.fields} renderField={renderField} scale={baseScale * zoom} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>

                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-[60] flex flex-col items-center gap-3 print:hidden">
                    <div className="flex flex-col items-center bg-background/95 backdrop-blur-sm rounded-full border p-2 shadow-2xl h-48">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" type="button" className="h-8 w-8 rounded-full mb-2 shrink-0" onClick={() => setZoom(p => Math.min(p + 0.1, 3))}>
                                        <ZoomIn className="h-4 w-4 text-primary" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">Zoom In</TooltipContent>
                            </Tooltip>
                            <Slider orientation="vertical" min={0.5} max={3} step={0.05} value={[zoom]} onValueChange={([v]) => setZoom(v)} className="flex-grow py-2" />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" type="button" className="h-8 w-8 rounded-full mt-2 shrink-0" onClick={() => setZoom(p => Math.max(p - 0.1, 0.5))}>
                                        <ZoomOut className="h-4 w-4 text-primary" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">Zoom Out</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <div className="bg-primary text-primary-foreground px-2 py-1 rounded-md text-[10px] font-bold shadow-lg tabular-nums border border-primary/20">
                        {Math.round(zoom * 100)}%
                    </div>
                </div>
            </main>
            <SignaturePadModal open={!!mediaCaptureState} onClose={() => setMediaCaptureState(null)} onSave={(dataUrl) => setValue(mediaCaptureState!.fieldId, dataUrl, { shouldDirty: true, shouldValidate: true })} mode={mediaCaptureState?.mode || 'signature'} />
            <DataEntryModal open={isDataEntryOpen} onOpenChange={setIsDataEntryOpen} pdfForm={pdfForm} activeFieldId={activeDataFieldId} />
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader><div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4"><ShieldAlert className="h-6 w-6 text-primary" /></div><AlertDialogTitle>Execute Final Agreement?</AlertDialogTitle><AlertDialogDescription>This document will be locked from further edits. Electronic signatures are legally binding equivalent to handwritten ones.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Review</AlertDialogCancel><AlertDialogAction onClick={onConfirmSubmission} className="bg-primary">Confirm & Finalize</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={showMissingFieldsModal} onOpenChange={setShowMissingFieldsModal}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader><div className="mx-auto bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-6 w-6 text-destructive" /></div><DialogTitle className="text-center font-black">Missing Required Information</DialogTitle><DialogDescription className="text-center text-sm font-medium">The following fields must be completed before you can finalize this agreement:</DialogDescription></DialogHeader>
                    <ScrollArea className="max-h-[30vh] border rounded-xl my-4"><ul className="p-4 space-y-3">{missingFields.map((field, idx) => (<li key={idx} className="flex items-center gap-3 text-sm font-medium"><div className="h-2 w-2 rounded-full bg-destructive shrink-0" /><span className="font-bold truncate">{field.label}</span><span className="text-[10px] uppercase font-black opacity-40 ml-auto">Page {field.pageIndex + 1}</span></li>))}</ul></ScrollArea>
                    <DialogFooter><Button onClick={handleOkMissingFields} className="w-full font-bold h-12 rounded-xl text-base shadow-lg">Go Fix These</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </FormProvider>
  );
}

function PageRenderer({ pdf, pageNumber, fields, renderField, scale }: { pdf: PDFDocumentProxy; pageNumber: number; fields: PDFFormField[]; renderField: (field: PDFFormField) => React.ReactNode; scale: number; }) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
    React.useEffect(() => {
        let isMounted = true;
        pdf.getPage(pageNumber).then(page => {
            const viewport = page.getViewport({ scale, rotation: page.rotate });
            if (!isMounted) return;
            setDimensions({ width: viewport.width, height: viewport.height });
            if (canvasRef.current) {
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d')!;
                canvas.height = viewport.height; canvas.width = viewport.width;
                page.render({ canvasContext: context, viewport });
            }
        });
        return () => { isMounted = false; };
    }, [pdf, pageNumber, scale]);
    return (
        <div className="relative mx-auto shadow-2xl bg-white border border-border transition-all flex-shrink-0" style={{ width: dimensions.width, height: dimensions.height }}><canvas ref={canvasRef} className="block w-full h-full" /><div className="absolute inset-0 z-20 pointer-events-none">{fields.filter(f => f.pageNumber === pageNumber).map(f => (<div key={f.id} id={f.id} className="pointer-events-auto" style={{ position: 'absolute', left: `${f.position.x}%`, top: `${f.position.y}%`, width: `${f.dimensions.width}%`, height: `${f.dimensions.height}%` }}>{renderField(f)}</div>))}</div></div>
    );
}
