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

// Shared PDF.js promise
const pdfjsPromise = import('pdfjs-dist');

const generateValidationSchema = (fields: PDFFormField[]) => {
    const schemaObject = fields.reduce((acc, field) => {
        if (field.type === 'static-text' || field.type === 'variable') return acc;

        let fieldSchema: z.ZodTypeAny = z.string().optional().nullable().or(z.literal(''));
        
        if (field.type === 'email') {
            const emailSchema = z.string().email({ message: "Please enter a valid email address." });
            fieldSchema = field.required ? emailSchema : emailSchema.optional().or(z.literal(''));
        } else if (field.type === 'phone') {
            const phoneSchema = z.string().regex(/^\+?[\d\s\-()]{10,}$/, "Please enter a valid phone number (at least 10 digits).");
            fieldSchema = field.required ? phoneSchema : phoneSchema.optional().or(z.literal(''));
        } else if (field.required) {
            fieldSchema = z.string({
                required_error: `${field.label || 'This field'} is required.`
            }).min(1, { message: `${field.label || 'This field'} is required.` });
        }
        
        acc[field.id] = fieldSchema;
        return acc;
    }, {} as Record<string, z.ZodTypeAny>);
    return z.object(schemaObject);
}

const BackgroundPattern = ({ pattern, color }: { pattern?: PDFForm['backgroundPattern'], color?: string }) => {
    if (!pattern || pattern === 'none') return null;

    if (pattern === 'gradient') {
        return (
            <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1] via-[#a855f7] to-[#ec4899] opacity-90" />
        );
    }

    const patterns: Record<string, React.ReactNode> = {
        dots: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1" fill={color || "currentColor"} opacity="0.1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
        ),
        grid: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke={color || "currentColor"} strokeWidth="1" opacity="0.05" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
        ),
        circuit: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="circuit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path d="M0 10h20v10H0zM30 30h40v10H30zM80 50h20v10H80zM10 70h30v10H10zM60 80h20v10H60z" fill="none" stroke={color || "currentColor"} strokeWidth="0.5" opacity="0.05" />
                        <circle cx="20" cy="15" r="2" fill={color || "currentColor"} opacity="0.1" />
                        <circle cx="70" cy="35" r="2" fill={color || "currentColor"} opacity="0.1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#circuit)" />
            </svg>
        ),
        topography: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="topo" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path d="M0 50c20-10 40-10 60 0s40 10 60 0M0 20c20-10 40-10 60 0s40 10 60 0M0 80c20-10 40-10 60 0s40 10 60 0" fill="none" stroke={color || "currentColor"} strokeWidth="1" opacity="0.05" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#topo)" />
            </svg>
        ),
        cubes: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="cubes" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                        <path d="M30 0l30 15v30L30 60 0 45V15z" fill="none" stroke={color || "currentColor"} strokeWidth="1" opacity="0.05" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#cubes)" />
            </svg>
        )
    };

    return (
        <div className="absolute inset-0 pointer-events-none text-foreground/20">
            {patterns[pattern]}
        </div>
    );
};

const DatePicker = ({ value, onChange, disabled, className, style, placeholder }: { 
    value?: any, 
    onChange: (date?: Date) => void, 
    disabled?: boolean, 
    className?: string,
    style?: React.CSSProperties,
    placeholder?: string 
}) => {
    let dateValue: Date | undefined = undefined;
    if (value) {
        const parsed = value instanceof Date ? value : parseISO(value);
        if (isValid(parsed)) {
            dateValue = parsed;
        }
    }
    
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button 
                    variant="ghost" 
                    disabled={disabled}
                    className={cn(
                        "w-full h-full min-h-0 p-0.5 border-transparent bg-transparent hover:bg-primary/5 transition-all justify-start text-left font-normal rounded-none",
                        !dateValue && "text-muted-foreground/40",
                        className
                    )}
                    style={style}
                >
                    <span className="truncate">
                        {dateValue ? format(dateValue, "PPP") : (placeholder || 'Pick date')}
                    </span>
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

export default function PdfFormRenderer({ pdfForm, school, isPreview = false }: { pdfForm: PDFForm, school?: School, isPreview?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const firestore = useFirestore();

  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [submissionId, setSubmissionId] = React.useState<string | null>(searchParams.get('submissionId'));
  const [isSubmitted, setIsSubmitted] = React.useState(!!searchParams.get('submissionId'));
  const [showDownloadBubble, setShowDownloadBubble] = React.useState(false);
  
  const [mediaCaptureState, setMediaCaptureState] = React.useState<{ fieldId: string, mode: 'signature' | 'photo' } | null>(null);
  const [isDataEntryOpen, setIsDataEntryOpen] = React.useState(false);
  const [activeDataFieldId, ReactsetActiveDataFieldId] = React.useState<string | null>(null);
  
  const [zoom, setZoom] = React.useState(1.0);
  const [baseScale, setBaseScale] = React.useState(1.3);
  
  const touchStartDist = React.useRef<number | null>(null);
  const startZoom = React.useRef<number>(1.0);
  const zoomRef = React.useRef(zoom);
  React.useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [pendingFormData, setPendingFormData] = React.useState<any>(null);

  const [showMissingFieldsModal, setShowMissingFieldsModal] = React.useState(false);
  const [missingFields, setMissingFields] = React.useState<{ id: string, label: string, pageIndex: number }[]>([]);

  const pageContainerRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  // ANALYTICS SESSION TRACKING
  const [sessionId] = React.useState(() => {
    if (typeof window === 'undefined' || isPreview) return null;
    const key = `pdf_sess_${pdfForm.id}`;
    let id = sessionStorage.getItem(key);
    if (!id) {
        id = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem(key, id);
    }
    return id;
  });

  const recordPagePulse = React.useCallback((pageNumber: number) => {
    if (!sessionId || !firestore || isPreview) return;
    
    const key = `pdf_max_page_${pdfForm.id}`;
    const currentMaxStr = sessionStorage.getItem(key) || '0';
    const currentMax = parseInt(currentMaxStr, 10);

    if (pageNumber >= currentMax) {
        sessionStorage.setItem(key, String(pageNumber));
        const sessionRef = doc(firestore, 'pdf_sessions', sessionId);
        setDoc(sessionRef, {
            pdfId: pdfForm.id,
            maxPageReached: pageNumber,
            updatedAt: new Date().toISOString(),
            isSubmitted: false
        }, { merge: true }).catch(err => console.warn("Analytics pulse failed:", err));
    }
  }, [sessionId, firestore, pdfForm.id, isPreview]);

  // Track scroll progress for funnel analytics
  React.useEffect(() => {
    if (!sessionId || !pdfDoc || isPreview) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const pageNumAttr = entry.target.getAttribute('data-page-number');
                if (pageNumAttr) {
                    recordPagePulse(parseInt(pageNumAttr, 10));
                }
            }
        });
    }, { threshold: 0.3 });

    // We wait a bit for pages to render before observing
    const timer = setTimeout(() => {
        const pages = document.querySelectorAll('.page-capture-wrapper');
        pages.forEach(p => observer.observe(p));
    }, 2000);

    return () => {
        clearTimeout(timer);
        observer.disconnect();
    };
  }, [sessionId, pdfDoc, isPreview, recordPagePulse]);

  const validationSchema = React.useMemo(() => generateValidationSchema(pdfForm.fields), [pdfForm.fields]);

  const methods = useForm({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
  });

  const { register, handleSubmit, watch, setValue, getValues, formState: { isValid, errors }, control } = methods;

  const watchedValues = watch();

  React.useEffect(() => {
    const now = new Date();
    const currentDate = format(now, 'yyyy-MM-dd');
    const currentTime = format(now, 'HH:mm');

    pdfForm.fields.forEach(field => {
      if (field.type === 'static-text' || field.type === 'variable') return;
      const currentValue = getValues(field.id);
      if (!currentValue) {
        if (field.type === 'date') {
          setValue(field.id, currentDate, { shouldValidate: true });
        } else if (field.type === 'time') {
          setValue(field.id, currentTime, { shouldValidate: true });
        }
      }
    });
  }, [pdfForm.fields, setValue, getValues]);

  React.useEffect(() => {
    if (isSubmitted) {
        setShowDownloadBubble(true);
    }
  }, [isSubmitted]);

  React.useEffect(() => {
    pdfForm.fields.forEach(field => {
        if (field.type !== 'static-text' && field.type !== 'variable') {
            register(field.id);
        }
    });
  }, [pdfForm.fields, register]);

  React.useEffect(() => {
    const updateBaseScale = () => {
        if (typeof window !== 'undefined') {
            const width = window.innerWidth;
            if (width < 640) setBaseScale(0.9);
            else if (width < 1024) setBaseScale(1.1);
            else setBaseScale(1.3);
        }
    };
    updateBaseScale();
    window.addEventListener('resize', updateBaseScale);
    return () => window.removeResizeListener('resize', updateBaseScale);
  }, []);

  React.useEffect(() => {
    const loadPdf = async () => {
        try {
            const pdfjs = await pdfjsPromise;
            const pdfjsVersion = '4.4.168';
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
            const loadingTask = pdfjs.getDocument({ url: pdfForm.downloadUrl });
            const loadedPdf = await loadingTask.promise;
            setPdfDoc(loadedPdf);
        } catch (error: any) {
            console.error("PDF Loading Error:", error);
            toast({ variant: 'destructive', title: 'Error Loading PDF', description: 'Could not load document template.' });
        }
    };
    if (pdfForm.downloadUrl) {
      loadPdf();
    }
  }, [pdfForm.downloadUrl, toast]);
  
  const handlePreSubmit = (data: any) => {
    if (isPreview) {
        toast({ title: 'Preview Mode', description: 'Submission is disabled in preview.' });
        return;
    }
    setPendingFormData(data);
    setShowConfirmDialog(true);
  };

  const onInvalid = (errors: any) => {
    const missing = pdfForm.fields
        .filter(f => f.type !== 'static-text' && f.type !== 'variable' && errors[f.id])
        .map(f => ({ id: f.id, label: f.label || f.placeholder || 'Unnamed Field' }));
    
    if (missing.length > 0) {
        setMissingFields(missing);
        setShowMissingFieldsModal(true);
    }
  };

  const handleOkMissingFields = () => {
    setShowMissingFieldsModal(false);
    if (missingFields.length > 0) {
        const firstId = missingFields[0].id;
        const field = pdfForm.fields.find(f => f.id === firstId);
        if (field?.type === 'signature' || field?.type === 'photo') {
            const element = document.getElementById(firstId);
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            ReactsetActiveDataFieldId(firstId);
            setIsDataEntryOpen(true);
        }
    }
  };

  const onConfirmSubmission = async () => {
    if (!pendingFormData) return;
    
    setIsSubmitting(true);
    setShowConfirmDialog(false);

    try {
        const response = await fetch('/api/pdfs/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                pdfId: pdfForm.id, 
                formData: pendingFormData,
                schoolId: school?.id // Pass schoolId for unique contract tracking
            }),
        });

        const result = await response.json();

        if (response.ok) {
            setSubmissionId(result.submissionId);
            setIsSubmitted(true);
            
            // Final Analytics Sync
            if (sessionId && firestore) {
                updateDoc(doc(firestore, 'pdf_sessions', sessionId), {
                    isSubmitted: true,
                    updatedAt: new Date().toISOString()
                }).catch(console.warn);
            }

            toast({ title: 'Submission Successful', description: 'Your data has been securely saved.' });
            
            const params = new URLSearchParams(searchParams);
            params.set('submissionId', result.submissionId);
            router.replace(`${pathname}?${params.toString()}`);
        } else {
            throw new Error(result.error || 'Failed to submit form.');
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Submission Error', description: e.message });
    } finally {
        setIsSubmitting(false);
        setPendingFormData(null);
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
        
        if (!pageElements || !pageElements.length) {
            throw new Error("No pages found to capture. Please ensure the document is fully loaded.");
        }

        toast({ title: 'Preparing Download', description: 'Processing document pages...' });

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        for (let i = 0; i < pageElements.length; i++) {
            const el = pageElements[i] as HTMLElement;
            const captureScale = isIOS || isMobile ? 1.5 : 2;

            const canvas = await html2canvas(el, {
                scale: captureScale,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
            const image = await pdfBundle.embedJpg(imgBytes);
            
            const page = pdfBundle.addPage([595.28, 841.89]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: 595.28,
                height: 841.89,
            });
        }

        const pdfBytes = await pdfBundle.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const fileName = `${pdfForm.name || 'signed'}-document.pdf`;

        if (isIOS) {
            window.location.assign(url);
        } else {
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                if (document.body.contains(a)) document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 500);
        }
        
        toast({ title: 'Download Started' });
    } catch (e: any) {
        console.error("Download error:", e);
        toast({ variant: 'destructive', title: 'Download Failed', description: e.message });
    } finally {
        setIsDownloading(false);
    }
  };

  const handleFieldClick = (field: PDFFormField) => {
    if (isSubmitting || isSubmitted || field.type === 'static-text' || field.type === 'variable') return;
    
    if (field.type === 'signature' || field.type === 'photo') {
        setMediaCaptureState({ fieldId: field.id, mode: field.type === 'photo' ? 'photo' : 'signature' });
    } else if (isMobile) {
        ReactsetActiveDataFieldId(field.id);
        setIsDataEntryOpen(true);
    }
  }

  const renderField = (field: PDFFormField) => {
    const value = watchedValues[field.id];
    // Sync font scaling with the canvas scale (baseScale * zoom)
    const currentTotalScale = baseScale * zoom;
    const baseFontSize = field.fontSize || 11;
    const dynamicFontSize = `${Math.round(baseFontSize * currentTotalScale)}px`;
    
    const hAlign = field.alignment || 'center';
    const vAlign = field.verticalAlignment || 'center';

    const fieldStyle: React.CSSProperties = {
        fontSize: dynamicFontSize,
        color: field.color || 'inherit',
        fontWeight: field.bold ? 'bold' : 'normal',
        fontStyle: field.italic ? 'italic' : 'normal',
        textDecoration: field.underline ? 'underline' : 'none',
        textAlign: hAlign || 'left',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: vAlign === 'center' ? 'center' : vAlign === 'bottom' ? 'flex-end' : 'flex-start',
        alignItems: hAlign === 'center' ? 'center' : hAlign === 'right' ? 'flex-end' : 'flex-start',
        textTransform: field.textTransform === 'capitalize' ? 'none' : (field.textTransform || 'none')
    };

    const applyTransform = (val: string) => {
        if (field.textTransform === 'uppercase') return val.toUpperCase();
        if (field.textTransform === 'capitalize') return toTitleCase(val);
        return val;
    };

    if (field.type === 'static-text') {
        return (
            <div className="w-full h-full flex overflow-visible" style={fieldStyle}>
                <span className={cn("px-1 whitespace-nowrap bg-transparent", field.bold ? "font-bold" : "font-medium")}>
                    {applyTransform(field.staticText || '')}
                </span>
            </div>
        );
    }

    if (field.type === 'variable') {
        const resolvedValue = resolveVariableValue(field.variableKey || '', school) || `{{${field.variableKey || 'context'}}}`;
        return (
            <div className="w-full h-full flex overflow-visible" style={fieldStyle}>
                <span className={cn("px-1 whitespace-nowrap bg-transparent", field.bold ? "font-bold" : "font-medium")}>
                    {applyTransform(resolvedValue)}
                </span>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="w-full h-full flex overflow-visible" style={fieldStyle}>
                {(field.type === 'signature' || field.type === 'photo') ? (
                    value && <img src={value} alt="Media" className="w-full h-full object-contain" crossOrigin="anonymous" />
                ) : (
                    <span className={cn("px-1 whitespace-nowrap bg-transparent", field.bold ? "text-black" : "text-black/80")}>
                        {field.type === 'date' && value ? format(new Date(value), 'PPP') : applyTransform(String(value || ''))}
                    </span>
                )}
            </div>
        );
    }

    const isInteractiveMedia = field.type === 'signature' || field.type === 'photo';

    if (!isMobile && !isInteractiveMedia) {
        return (
            <div className="w-full h-full group/desktop-field relative" style={fieldStyle}>
                {field.type === 'dropdown' ? (
                    <Controller
                        name={field.id}
                        control={control}
                        render={({ field: selectField }) => (
                            <Select onValueChange={selectField.onChange} value={selectField.value}>
                                <SelectTrigger className={cn("w-full h-full min-h-0 p-0.5 border-transparent bg-transparent hover:bg-primary/5 hover:border-primary/20 focus:ring-0 focus:border-primary/40 shadow-none rounded-none", field.bold && "font-bold")} style={{ fontSize: 'inherit', color: field.color || 'inherit' }}>
                                    <SelectValue placeholder={field.placeholder || field.label} />
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {(field.options || []).map((opt, i) => (
                                        <SelectItem key={i} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                ) : field.type === 'date' ? (
                    <Controller
                        name={field.id}
                        control={control}
                        render={({ field: dateField }) => (
                            <DatePicker 
                                value={dateField.value} 
                                onChange={(d) => dateField.onChange(d?.toISOString())}
                                placeholder={field.placeholder || field.label}
                                style={{ fontSize: 'inherit', fontWeight: 'inherit', fontStyle: 'inherit', textDecoration: 'inherit', color: field.color || 'inherit' }}
                                className={cn(errors[field.id] && "bg-destructive/5")}
                            />
                        )}
                    />
                ) : (
                    <Input
                        {...register(field.id)}
                        type={field.type === 'time' ? 'time' : 'text'}
                        placeholder={field.placeholder || field.label}
                        className={cn(
                            "w-full h-full min-h-0 p-0.5 border-transparent bg-transparent hover:bg-primary/5 hover:border-primary/20 focus:ring-0 focus:border-primary/40 shadow-none rounded-none transition-all",
                            errors[field.id] && "border-destructive/40 bg-destructive/5"
                        )}
                        style={{ fontSize: 'inherit', fontWeight: 'inherit', fontStyle: 'inherit', textDecoration: 'inherit', textAlign: 'inherit', color: field.color || 'inherit', textTransform: field.textTransform === 'capitalize' ? 'none' : (field.textTransform || 'none') }}
                    />
                )}
                {field.type === 'time' && <Clock className="h-3 w-3 absolute right-1 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none group-hover:desktop-field:opacity-60" />}
            </div>
        );
    }

    return (
        <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleFieldClick(field)}
            className={cn(
                "w-full h-full text-left transition-all relative group/field",
                isInteractiveMedia 
                    ? "border border-dashed border-muted-foreground rounded flex items-center justify-center bg-muted/20 hover:bg-muted/40" 
                    : "border border-transparent hover:border-primary/40 hover:bg-primary/5 rounded-sm p-1",
                errors[field.id] && "border-destructive bg-destructive/5"
            )}
            style={fieldStyle}
        >
            <div className="absolute -top-6 left-0 opacity-0 group-hover/field:opacity-100 transition-opacity whitespace-nowrap bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none z-50 shadow-lg">
                Click to {isInteractiveMedia ? (field.type === 'photo' ? 'Capture' : 'Sign') : 'Edit'}
            </div>

            {value ? (
                isInteractiveMedia ? (
                    <img src={value} alt="Captured" className="w-full h-full object-contain" />
                ) : (
                    <span className="block truncate w-full" style={{ fontSize: 'inherit', color: field.color || 'inherit' }}>
                        {field.type === 'date' ? format(new Date(value), 'PPP') : applyTransform(String(value || ''))}
                    </span>
                )
            ) : (
                <div className={cn("flex items-center gap-1 opacity-40", hAlign === 'center' ? 'justify-center' : hAlign === 'right' ? 'justify-end' : 'justify-start')}>
                    {!isInteractiveMedia && <Edit3 className="h-3 w-3 text-muted-foreground shrink-0" />}
                    <span 
                        className="text-muted-foreground uppercase truncate"
                        style={{ fontSize: `${Math.max(6, Math.round(baseFontSize * currentTotalScale * 0.8))}px` }}
                    >
                        {field.placeholder || (field.type === 'photo' ? 'Capture' : field.type === 'signature' ? 'Sign' : field.label)}
                    </span>
                </div>
            )}
        </button>
    );
  }

  const hasSignature = pdfForm.fields.some(f => f.type === 'signature');
  const bgColor = pdfForm.backgroundColor || '#F1F5F9';

  return (
    <FormProvider {...methods}>
        <div className="light flex flex-col h-[100dvh] overflow-hidden text-foreground selection:bg-primary/20 relative" style={{ backgroundColor: bgColor }}>
            <BackgroundPattern pattern={pdfForm.backgroundPattern} color={pdfForm.patternColor} />
            
            <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b px-4 h-14 flex items-center gap-2 shadow-sm shrink-0">
                {pdfForm.logoUrl ? (
                    <div className="relative h-9 w-12 shrink-0">
                        <Image src={pdfForm.logoUrl} alt="Logo" fill className="object-contain object-left" />
                    </div>
                ) : (
                    <SmartSappIcon className="h-8 w-8 text-primary shrink-0" />
                )}
                <div className="flex flex-col min-w-0 -ml-1">
                    <h1 className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-md leading-tight text-sm sm:text-base">{pdfForm.publicTitle || pdfForm.name}</h1>
                    <p className="text-[10px] text-muted-foreground leading-none">{pdfForm.schoolName || 'SmartSapp'}</p>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2 relative">
                    {!isSubmitted ? (
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="hidden sm:flex rounded-xl font-bold gap-2"
                                onClick={() => setIsDataEntryOpen(true)}
                                disabled={isSubmitting || isPreview}
                            >
                                <LayoutList className="h-4 w-4" />
                                Form View
                            </Button>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="inline-block">
                                            <Button 
                                                type="button" 
                                                size="sm" 
                                                disabled={isSubmitting || isPreview} 
                                                onClick={handleSubmit(handlePreSubmit, onInvalid)}
                                                className="rounded-xl font-bold px-6"
                                            >
                                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                                Done
                                            </Button>
                                        </div>
                                    </TooltipTrigger>
                                    {!isValid && (
                                        <TooltipContent>
                                            <p>Please complete all required fields before submitting.</p>
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600 hidden sm:block" />
                            <Button 
                                type="button" 
                                size="sm" 
                                disabled={isDownloading} 
                                onClick={handleDownload}
                                className="rounded-xl font-bold"
                            >
                                {isDownloading ? <Loader2 className="sm:mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Download Signed PDF
                            </Button>
                        </div>
                    )}

                    <AnimatePresence>
                        {showDownloadBubble && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: [0, -10, 0] }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ 
                                    opacity: { duration: 0.3 },
                                    y: { repeat: Infinity, duration: 2, ease: "easeInOut" }
                                }}
                                className="absolute top-12 right-0 z-50 pointer-events-none"
                            >
                                <div className="bg-primary text-white px-4 py-3 rounded-2xl shadow-2xl relative min-w-[220px] border border-white/20">
                                    <div className="absolute -top-1.5 right-8 w-3 h-3 bg-primary rotate-45 rounded-sm" />
                                    <p className="text-[10px] font-black uppercase tracking-widest leading-tight text-center">
                                        Your Form Has been Submitted.<br/>
                                        <span className="text-white/80">Download Your Copy Here</span>
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </header>

            <main className="flex-grow relative overflow-hidden overscroll-behavior-none z-10">
                <ScrollArea 
                    className="h-full w-full"
                    viewportRef={viewportRef}
                >
                    <div 
                        ref={pageContainerRef}
                        className="p-2 sm:p-8 flex flex-col items-center min-w-full touch-pan-x touch-pan-y" 
                        style={{ minWidth: 'fit-content' }}
                    >
                        {!pdfDoc ? (
                            <div className="space-y-4">
                                <Skeleton className="w-[8.5in] h-[11in] max-w-full rounded-lg shadow-lg bg-card" />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 sm:gap-8 pb-8">
                                {Array.from({ length: pdfDoc.numPages }).map((_, index) => (
                                    <div key={index} className="page-capture-wrapper" data-page-number={index + 1}>
                                        <PageRenderer
                                            pdf={pdfDoc}
                                            pageNumber={index + 1}
                                            fields={pdfForm.fields}
                                            renderField={renderField}
                                            scale={baseScale * zoom}
                                        />
                                    </div>
                                ))}
                                
                                <footer className="py-12 text-center text-xs sm:text-sm text-muted-foreground w-full">
                                    <p>Powered by <a href="https://www.smartsapp.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">SmartSapp</a></p>
                                    <p>&copy; 2026 SmartSapp</p>
                                </footer>
                            </div>
                        )}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>

                <div className="fixed right-4 bottom-24 z-50 flex flex-col items-center gap-3">
                    <div className="flex flex-col items-center bg-background/60 backdrop-blur-sm rounded-full border border-primary/20 py-4 px-2 shadow-2xl h-48">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 rounded-full mb-2 shrink-0" 
                                        onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
                                    >
                                        <ZoomIn className="h-4 w-4 text-primary" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">Zoom In</TooltipContent>
                            </Tooltip>
                            
                            <Slider
                                orientation="vertical"
                                min={0.5}
                                max={3.0}
                                step={0.05}
                                value={[zoom]}
                                onValueChange={([val]) => setZoom(val)}
                                className="flex-grow py-2"
                            />

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 rounded-full mt-2 shrink-0" 
                                        onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
                                    >
                                        <ZoomOut className="h-4 w-4 text-primary" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">Zoom Out</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <div className="bg-primary/80 text-primary-foreground px-2 py-1 rounded-md text-[10px] font-bold shadow-lg tabular-nums border border-primary/20 backdrop-blur-sm">
                        {Math.round(zoom * 100)}%
                    </div>
                </div>
            </main>

            <SignaturePadModal
                open={!!mediaCaptureState}
                onClose={() => setMediaCaptureState(null)}
                onSave={(dataUrl) => {
                    if (mediaCaptureState) {
                        setValue(mediaCaptureState.fieldId, dataUrl, { shouldDirty: true, shouldValidate: true });
                    }
                    setMediaCaptureState(null);
                }}
                mode={mediaCaptureState?.mode || 'signature'}
            />

            <DataEntryModal 
                open={isDataEntryOpen}
                onOpenChange={setIsDataEntryOpen}
                pdfForm={pdfForm}
                activeFieldId={activeDataFieldId}
            />

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

            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent className="sm:max-w-md">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            {hasSignature ? (
                                <div className="bg-primary/10 p-2 rounded-full">
                                    <ShieldAlert className="h-6 w-6 text-primary" />
                                </div>
                            ) : (
                                <div className="bg-yellow-100 p-2 rounded-full">
                                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                                </div>
                            )}
                            <AlertDialogTitle>Confirm Final Submission</AlertDialogTitle>
                        </div>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4 pt-2 text-sm text-muted-foreground">
                                {hasSignature ? (
                                    <div className="space-y-4">
                                        <div className="font-semibold text-foreground">Important Legal Notice:</div>
                                        <div>By confirming, you acknowledge that the electronic signatures provided in this document are the legally binding equivalent of your handwritten signature.</div>
                                        <div className="bg-muted p-3 rounded-md text-xs italic">
                                            "I understand that this electronic record has the same legal effect, validity, and enforceability as a manually signed paper document."
                                        </div>
                                    </div>
                                ) : (
                                    <div>Are you ready to submit your responses? Please review your entries one last time.</div>
                                )}
                                <div className="text-destructive font-medium border-t pt-4 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    This submission is final and irreversible.
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancel and Review</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={onConfirmSubmission} 
                            disabled={isSubmitting}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Confirm and Submit
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    </FormProvider>
  );
}

function PageRenderer({ pdf, pageNumber, fields, renderField, scale }: { 
    pdf: PDFDocumentProxy; 
    pageNumber: number; 
    fields: PDFFormField[]; 
    renderField: (field: PDFFormField) => React.ReactNode;
    scale: number;
}) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const renderTaskRef = React.useRef<any>(null);
    const [isRendering, setIsRendering] = React.useState(true);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });

    React.useEffect(() => {
        let isMounted = true;
        const render = async () => {
            setIsRendering(true);
            try {
                if (renderTaskRef.current) {
                    renderTaskRef.current.cancel();
                }

                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale, rotation: page.rotate });
                
                if (!isMounted) return;
                setDimensions({ width: viewport.width, height: viewport.height });

                if (canvasRef.current) {
                    const canvas = canvasRef.current;
                    const context = canvas.getContext('2d');
                    if (context) {
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        
                        const renderTask = page.render({ canvasContext: context, viewport });
                        renderTaskRef.current = renderTask;
                        
                        await renderTask.promise;
                    }
                }
            } catch (e: any) {
                if (e.name === 'RenderingCancelledException') return;
                console.error(`Failed to render page ${pageNumber}`, e);
            } finally {
                if (isMounted) setIsRendering(false);
            }
        };
        render();
        return () => { 
            isMounted = false; 
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [pdf, pageNumber, scale]);

    return (
        <div 
            className="relative mx-auto shadow-2xl bg-white border border-border transition-all duration-300 flex-shrink-0" 
            style={{ width: dimensions.width, height: dimensions.height }}
        >
            {isRendering && <Skeleton className="absolute inset-0 z-10" />}
            <canvas ref={canvasRef} className="block w-full h-full" />
            {dimensions.width > 0 && (
                <div className="absolute inset-0 z-20 pointer-events-none">
                    {fields.filter(f => f.pageNumber === pageNumber).map(field => (
                        <div 
                            key={field.id} 
                            id={field.id}
                            className="pointer-events-auto"
                            style={{ 
                                position: 'absolute', 
                                left: `${field.position.x}%`, 
                                top: `${field.position.y}%`, 
                                width: `${field.dimensions.width}%`, 
                                height: `${field.dimensions.height}%` 
                            }}
                        >
                            {renderField(field)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
