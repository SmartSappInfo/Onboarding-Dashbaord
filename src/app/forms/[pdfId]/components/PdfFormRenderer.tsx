
'use client';

import * as React from 'react';
import { useForm, Controller, useWatch, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFForm, PDFFormField, School } from '@/lib/types';
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
import { SmartSappIcon } from '@/components/icons';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

export default function PdfFormRenderer({ pdfForm, school, initialData = {}, isLocked = false, isPreview = false }: { pdfForm: PDFForm, school?: School, initialData?: Record<string, any>, isLocked?: boolean, isPreview?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const firestore = useFirestore();

  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isFinalizedView, setIsFinalizedView] = React.useState(isLocked);
  const [showDownloadBubble, setShowDownloadBubble] = React.useState(false);
  
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

  const validationSchema = React.useMemo(() => generateValidationSchema(pdfForm.fields), [pdfForm.fields]);
  const methods = useForm({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
    defaultValues: initialData
  });

  const { register, handleSubmit, watch, setValue, getValues, formState: { isValid, errors }, control } = methods;
  const watchedValues = watch();

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

  const handleSaveProgress = async () => {
      if (isPreview || !school) return;
      setIsSubmitting(true);
      const data = getValues();
      const res = await saveAgreementProgressAction(pdfForm.id, school.id, data);
      if (res.success) toast({ title: 'Progress Saved', description: 'Institutional data cached.' });
      else toast({ variant: 'destructive', title: 'Save Failed', description: res.error });
      setIsSubmitting(false);
  };

  const handlePreSubmit = (data: any) => {
    if (isPreview) { toast({ title: 'Preview Mode' }); return; }
    setPendingFormData(data);
    setShowConfirmDialog(true);
  };

  const onConfirmSubmission = async () => {
    if (!pendingFormData || !school) return;
    setIsSubmitting(true);
    setShowConfirmDialog(false);

    try {
        const res = await finalizeAgreementAction(pdfForm.id, school.id, pendingFormData);
        if (res.success) {
            setIsFinalizedView(true);
            setShowDownloadBubble(true);
            toast({ title: 'Agreement Finalized', description: 'Document locked and archived.' });
        } else throw new Error(res.error);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Finalization Failed', description: e.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    setShowDownloadBubble(false);
    setIsDownloading(true);
    try {
        const html2canvas = (await import('html2canvas')).default;
        const { PDFDocument } = await import('pdf-lib');
        const pdfBundle = await PDFDocument.create();
        const pageElements = pageContainerRef.current?.querySelectorAll('.page-capture-wrapper');
        for (let i = 0; i < (pageElements?.length || 0); i++) {
            const el = pageElements![i] as HTMLElement;
            const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
            const image = await pdfBundle.embedJpg(await fetch(canvas.toDataURL('image/jpeg', 0.9)).then(res => res.arrayBuffer()));
            const page = pdfBundle.addPage([595.28, 841.89]);
            page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
        }
        const url = window.URL.createObjectURL(new Blob([await pdfBundle.save()], { type: 'application/pdf' }));
        const a = document.createElement('a'); a.href = url; a.download = `${pdfForm.name}-Signed.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e: any) { toast({ variant: 'destructive', title: 'Download Failed' }); } finally { setIsDownloading(false); }
  };

  const renderField = (field: PDFFormField) => {
    const value = watchedValues[field.id];
    const currentTotalScale = baseScale * zoom;
    const dynamicFontSize = `${Math.round((field.fontSize || 11) * currentTotalScale)}px`;
    const fieldStyle: React.CSSProperties = { fontSize: dynamicFontSize, color: field.color || 'inherit', fontWeight: field.bold ? 'bold' : 'normal', fontStyle: field.italic ? 'italic' : 'normal', textDecoration: field.underline ? 'underline' : 'none', textAlign: field.alignment || 'left', display: 'flex', flexDirection: 'column', justifyContent: field.verticalAlignment === 'bottom' ? 'flex-end' : field.verticalAlignment === 'top' ? 'flex-start' : 'center', alignItems: field.alignment === 'right' ? 'flex-end' : field.alignment === 'center' ? 'center' : 'flex-start', textTransform: field.textTransform === 'capitalize' ? 'none' : (field.textTransform || 'none') };
    const applyTransform = (val: string) => field.textTransform === 'uppercase' ? val.toUpperCase() : field.textTransform === 'capitalize' ? toTitleCase(val) : val;

    if (field.type === 'static-text' || field.type === 'variable' || isFinalizedView) {
        let text = field.type === 'static-text' ? field.staticText : field.type === 'variable' ? resolveVariableValue(field.variableKey || '', school) : value;
        return <div className="w-full h-full flex overflow-visible" style={fieldStyle}>{(field.type === 'signature' || field.type === 'photo') ? (text && <img src={text} alt="M" className="w-full h-full object-contain" />) : <span className={cn("px-1 whitespace-nowrap bg-transparent", field.bold ? "text-black" : "text-black/80")}>{field.type === 'date' && text ? format(new Date(text), 'PPP') : applyTransform(String(text || ''))}</span>}</div>;
    }

    if (!isMobile && field.type !== 'signature' && field.type !== 'photo') {
        return (
            <div className="w-full h-full group/desktop-field relative" style={fieldStyle}>
                {field.type === 'dropdown' ? (
                    <Controller name={field.id} control={control} render={({ field: sf }) => (<Select onValueChange={sf.onChange} value={sf.value}><SelectTrigger className="w-full h-full min-h-0 p-0.5 border-transparent bg-transparent rounded-none" style={{ fontSize: 'inherit', color: field.color || 'inherit' }}><SelectValue placeholder={field.label} /></SelectTrigger><SelectContent className="rounded-xl">{(field.options || []).map((o, i) => (<SelectItem key={i} value={o}>{o}</SelectItem>))}</SelectContent></Select>)} />
                ) : field.type === 'date' ? (
                    <Controller name={field.id} control={control} render={({ field: df }) => (<DatePicker value={df.value} onChange={(d) => df.onChange(d?.toISOString())} placeholder={field.label} style={{ fontSize: 'inherit', color: field.color || 'inherit' }} className={cn(errors[field.id] && "bg-destructive/5")} />)} />
                ) : (
                    <Input {...register(field.id)} type={field.type === 'time' ? 'time' : 'text'} placeholder={field.placeholder || field.label} className={cn("w-full h-full min-h-0 p-0.5 border-transparent bg-transparent rounded-none", errors[field.id] && "bg-destructive/5")} style={{ fontSize: 'inherit', textAlign: 'inherit', color: field.color || 'inherit' }} />
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
      return (
          <div className="min-h-screen flex flex-col bg-slate-50 relative overflow-hidden">
              <BackgroundPattern pattern={pdfForm.backgroundPattern} color={pdfForm.patternColor} />
              <AlreadySignedGate schoolName={school?.name} logoUrl={school?.logoUrl} pdfName={pdfForm.name} onView={() => setIsFinalizedView(false)} />
          </div>
      );
  }

  return (
    <FormProvider {...methods}>
        <div className="light flex flex-col h-[100dvh] overflow-hidden relative" style={{ backgroundColor: pdfForm.backgroundColor || '#F1F5F9' }}>
            <BackgroundPattern pattern={pdfForm.backgroundPattern} color={pdfForm.patternColor} />
            <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b px-4 h-14 flex items-center gap-2 shadow-sm shrink-0">
                {school?.logoUrl ? <div className="relative h-9 w-12 shrink-0"><Image src={school.logoUrl} alt="Logo" fill className="object-contain" /></div> : <SmartSappIcon className="h-8 w-8 text-primary" />}
                <div className="flex flex-col min-w-0 -ml-1 text-left"><h1 className="font-bold truncate max-w-[200px] leading-tight text-sm">{school?.name || pdfForm.publicTitle}</h1><p className="text-[10px] text-muted-foreground leading-none">{pdfForm.publicTitle}</p></div>
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleSaveProgress} disabled={isSubmitting || isPreview} className="hidden sm:flex rounded-xl font-bold gap-2"><Save className="h-4 w-4" /> Save Draft</Button>
                    <Button type="button" size="sm" onClick={isFormComplete ? handleSubmit(handlePreSubmit, onInvalid) : handleSaveProgress} className="rounded-xl font-bold px-6">
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isFormComplete ? <Send className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                        {isFormComplete ? 'Finalize' : 'Save'}
                    </Button>
                </div>
            </header>
            <main className="flex-grow relative overflow-hidden z-10"><ScrollArea className="h-full w-full" viewportRef={viewportRef}><div ref={pageContainerRef} className="p-2 sm:p-8 flex flex-col items-center min-w-full touch-pan-x touch-pan-y" style={{ minWidth: 'fit-content' }}>{!pdfDoc ? <Skeleton className="w-[8.5in] h-[11in] rounded-lg shadow-lg bg-card" /> : <div className="flex flex-col gap-4 sm:gap-8 pb-8">{Array.from({ length: pdfDoc.numPages }).map((_, index) => (<div key={index} className="page-capture-wrapper" data-page-number={index + 1}><PageRenderer pdf={pdfDoc} pageNumber={index + 1} fields={pdfForm.fields} renderField={renderField} scale={baseScale * zoom} /></div>))}</div>}</div><ScrollBar orientation="horizontal" /></ScrollArea></main>
            <SignaturePadModal open={!!mediaCaptureState} onClose={() => setMediaCaptureState(null)} onSave={(dataUrl) => setValue(mediaCaptureState!.fieldId, dataUrl, { shouldDirty: true, shouldValidate: true })} mode={mediaCaptureState?.mode || 'signature'} />
            <DataEntryModal open={isDataEntryOpen} onOpenChange={setIsDataEntryOpen} pdfForm={pdfForm} activeFieldId={activeDataFieldId} />
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}><AlertDialogContent className="rounded-2xl"><AlertDialogHeader><div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4"><ShieldAlert className="h-6 w-6 text-primary" /></div><AlertDialogTitle>Execute Final Agreement?</AlertDialogTitle><AlertDialogDescription>This document will be locked from further edits. Electronic signatures are legally binding equivalent to handwritten ones.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Review</AlertDialogCancel><AlertDialogAction onClick={onConfirmSubmission} className="bg-primary">Confirm & Finalize</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
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
                canvas.height = viewport.height; canvas.width = viewport.width;
                page.render({ canvasContext: canvas.getContext('2d')!, viewport });
            }
        });
        return () => { isMounted = false; };
    }, [pdf, pageNumber, scale]);
    return (<div className="relative mx-auto shadow-2xl bg-white border border-border transition-all flex-shrink-0" style={{ width: dimensions.width, height: dimensions.height }}><canvas ref={canvasRef} className="block w-full h-full" /><div className="absolute inset-0 z-20 pointer-events-none">{fields.filter(f => f.pageNumber === pageNumber).map(f => (<div key={f.id} id={f.id} className="pointer-events-auto" style={{ position: 'absolute', left: `${f.position.x}%`, top: `${f.position.y}%`, width: `${f.dimensions.width}%`, height: `${f.dimensions.height}%` }}>{renderField(f)}</div>))}</div></div>);
}

const isValueEmpty = (value: any, questionType: string): boolean => {
    if (value === undefined || value === null || value === '') return true;
    if (Array.isArray(value)) return value.length === 0;
    return false;
}
