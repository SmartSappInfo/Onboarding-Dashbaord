'use client';

import * as React from 'react';
import type { PDFForm, Submission, PDFFormField } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, Loader2, Printer, Lock, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { SmartSappIcon } from '@/components/icons';
import { cn, resolveVariableValue, toTitleCase } from '@/lib/utils';

const pdfjsPromise = import('pdfjs-dist');

const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

const AUTH_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export default function SharedSubmissionView({ pdfForm, submission }: { pdfForm: PDFForm, submission: Submission }) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [isInitializing, setIsInitializing] = React.useState(true);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const storageKey = React.useMemo(() => `results_auth_${pdfForm.id}`, [pdfForm.id]);

  const authForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '' },
  });

  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const pageContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const checkAuth = () => {
      if (!pdfForm.resultsPassword) {
        setIsUnlocked(true);
        setIsInitializing(false);
        return;
      }

      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const { timestamp } = JSON.parse(stored);
          if (Date.now() - timestamp < AUTH_EXPIRY_MS) {
            setIsUnlocked(true);
          } else {
            localStorage.removeItem(storageKey);
          }
        } catch (e) {
          localStorage.removeItem(storageKey);
        }
      }
      setIsInitializing(false);
    };

    checkAuth();
  }, [storageKey, pdfForm.resultsPassword]);

  React.useEffect(() => {
    if (!isUnlocked) return;
    const load = async () => {
        try {
            const pdfjs = await pdfjsPromise;
            const pdfjsVersion = '4.4.168';
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
            const loaded = await pdfjs.getDocument({ url: pdfForm.downloadUrl }).promise;
            setPdfDoc(loaded);
        } catch (e) {
            console.error("Renderer: Failed to load PDF", e);
            toast({ variant: 'destructive', title: 'Error Loading Document' });
        }
    };
    load();
  }, [pdfForm.downloadUrl, isUnlocked, toast]);

  const onAuthSubmit = (data: z.infer<typeof passwordSchema>) => {
    if (data.password === pdfForm.resultsPassword) {
      localStorage.setItem(storageKey, JSON.stringify({ timestamp: Date.now() }));
      setIsUnlocked(true);
      setAuthError(null);
    } else {
      setAuthError('Incorrect password. Please try again.');
      authForm.reset();
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
        const html2canvas = (await import('html2canvas')).default;
        const { PDFDocument } = await import('pdf-lib');
        
        const pdfBundle = await PDFDocument.create();
        const pageElements = pageContainerRef.current?.querySelectorAll('.page-capture-wrapper');
        
        if (!pageElements || !pageElements.length) {
            throw new Error("No pages found to capture. Please ensure the document is fully loaded.");
        }

        toast({ title: 'Preparing Download', description: 'Generating high-fidelity PDF...' });

        for (let i = 0; i < pageElements.length; i++) {
            const el = pageElements[i] as HTMLElement;
            
            const canvas = await html2canvas(el, {
                scale: 2,
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
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = `${pdfForm.name}-signed.pdf`; 
        document.body.appendChild(a); 
        a.click(); 
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({ title: 'Download Successful' });
    } catch (e: any) {
        console.error("Download error:", e);
        toast({ variant: 'destructive', title: 'Download Failed', description: 'Could not generate the signed document.' });
    } finally { setIsDownloading(false); }
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/20">
        <Dialog open={!isUnlocked} onOpenChange={() => {}}>
          <DialogContent 
            className="sm:max-w-md" 
            onPointerDownOutside={(e) => e.preventDefault()} 
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <div className="flex justify-center mb-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <Lock className="h-10 w-10 text-primary" />
                </div>
              </div>
              <DialogTitle className="text-center text-xl">Shared Results Access</DialogTitle>
              <DialogDescription className="text-center">
                Please enter the password provided to you to view this record.
              </DialogDescription>
            </DialogHeader>
            <Form {...authForm}>
              <form onSubmit={authForm.handleSubmit(onAuthSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={authForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Results Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter password..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {authError && <p className="text-sm font-medium text-destructive text-center">{authError}</p>}
                <DialogFooter>
                  <Button type="submit" className="w-full" disabled={authForm.formState.isSubmitting}>
                     {authForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Access Results
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-muted/20 text-left">
       <header className="h-16 border-b bg-background px-4 flex items-center justify-between shrink-0 shadow-sm print:hidden z-30">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                <Button variant="ghost" size="sm" onClick={() => router.back()} className="h-9 px-2 sm:px-3">
                    <ArrowLeft className="sm:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline font-bold">Back</span>
                </Button>
                <div className="hidden sm:block h-6 w-px bg-border mx-1" />
                <div className="min-w-0 px-2">
                    <h1 className="font-black text-sm sm:text-base leading-none truncate pr-2 uppercase tracking-tight">
                      Record: {submission.id.substring(0,8)}
                    </h1>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1 font-bold uppercase tracking-widest truncate">
                      {pdfForm.schoolName || 'SmartSapp'} · Submitted on {format(new Date(submission.submittedAt), "MMM d, yyyy")}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" onClick={handleDownload} disabled={isDownloading} className="h-9 rounded-xl font-black shadow-lg px-6 uppercase text-[10px] tracking-widest">
                    {isDownloading ? <Loader2 className="sm:mr-2 h-4 w-4 animate-spin" /> : <Download className="sm:mr-2 h-4 w-4" />}
                    <span className="hidden sm:inline">Download Signed PDF</span>
                    <span className="sm:hidden">Download</span>
                </Button>
            </div>
      </header>

      <div className="flex-grow overflow-hidden relative bg-muted/30">
        <ScrollArea className="h-full w-full print-area">
            <div ref={pageContainerRef} className="p-4 sm:p-8 flex flex-col items-center min-w-full touch-pan-x touch-pan-y" style={{ minWidth: 'fit-content' }}>
                {!pdfDoc ? (
                    <div className="space-y-4"><Skeleton className="w-[8.5in] h-[11in] bg-card rounded-lg shadow-lg" /></div>
                ) : (
                    <div className="flex flex-col gap-4 sm:gap-8 pb-24 print:gap-0 print:pb-0">
                        {Array.from({ length: pdfDoc.numPages }).map((_, i) => (
                            <div key={i} className="page-capture-wrapper">
                                <PageRenderer 
                                    pdf={pdfDoc} 
                                    pageNumber={i+1} 
                                    fields={pdfForm.fields} 
                                    formData={submission.formData} 
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <ScrollBar orientation="horizontal" className="print:hidden" />
        </ScrollArea>
      </div>
      
      <footer className="sm:hidden h-8 bg-background border-t flex items-center justify-center px-4 shrink-0 print:hidden">
          <div className="flex items-center gap-1 opacity-50">
              <SmartSappIcon className="h-3 w-3" />
              <span className="text-[8px] font-medium">Powered by SmartSapp</span>
          </div>
      </footer>
    </div>
  );
}

function PageRenderer({ pdf, pageNumber, fields, formData }: { pdf: PDFDocumentProxy; pageNumber: number; fields: PDFFormField[], formData: { [key: string]: any } }) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
    const [isRendering, setIsRendering] = React.useState(true);

    React.useEffect(() => {
        let isMounted = true;
        const render = async () => {
            try {
                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: 1.5, rotation: page.rotate });
                
                if (!isMounted) return;
                setDimensions({ width: viewport.width, height: viewport.height });
                
                if (canvasRef.current) {
                    const canvas = canvasRef.current;
                    const context = canvas.getContext('2d');
                    if (context) {
                        canvas.height = viewport.height; 
                        canvas.width = viewport.width;
                        await page.render({ canvasContext: context, viewport }).promise;
                        if (isMounted) setIsRendering(false);
                    }
                }
            } catch (e) {
                console.error("PageRenderer error:", e);
            }
        };
        render();
        return () => { isMounted = false; };
    }, [pdf, pageNumber]);

    return (
        <div className="relative bg-white border shadow-2xl flex-shrink-0" style={{ width: dimensions.width, height: dimensions.height }}>
            {isRendering && <Skeleton className="absolute inset-0 z-10" />}
            <canvas ref={canvasRef} className="w-full h-full block" />
            {dimensions.width > 0 && (
                <div className="absolute inset-0 z-20 pointer-events-none">
                    {fields.filter(f => f.pageNumber === pageNumber).map(field => {
                        const storedValue = formData[field.id];
                        let val = storedValue;
                        
                        // Fallback resolution for non-stored fields (static/variables) if necessary
                        if (val === undefined || val === null) {
                            if (field.type === 'static-text') val = field.staticText;
                        }

                        if (!val) return null;
                        
                        // Scale font by the fixed scale (1.5) used for the canvas in this view
                        const dynamicFontSize = `${Math.round((field.fontSize || 11) * 1.5)}px`;
                        const verticalAlign = field.verticalAlignment || 'center';

                        const applyTransform = (v: string) => {
                            if (field.textTransform === 'uppercase') return v.toUpperCase();
                            if (field.textTransform === 'capitalize') return toTitleCase(v);
                            return v;
                        };

                        return (
                            <div 
                                key={field.id} 
                                style={{ 
                                    position: 'absolute', 
                                    left: `${field.position.x}%`, 
                                    top: `${field.position.y}%`, 
                                    width: `${field.dimensions.width}%`, 
                                    height: `${field.dimensions.height}%`, 
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: verticalAlign === 'center' ? 'center' : verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
                                    alignItems: field.alignment === 'center' ? 'center' : field.alignment === 'right' ? 'flex-end' : 'flex-start'
                                }}
                            >
                                {field.type === 'signature' || field.type === 'photo' ? (
                                    <img src={val} alt="Media" className="w-full h-full object-contain object-left-top" crossOrigin="anonymous" />
                                ) : (
                                    <span 
                                        className={cn("px-1 whitespace-nowrap bg-transparent", field.bold ? "font-bold text-black" : "font-medium text-black/80")}
                                        style={{ fontSize: dynamicFontSize, textAlign: field.alignment || 'left' }}
                                    >
                                        {field.type === 'date' ? format(new Date(val), 'PPP') : applyTransform(String(val))}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
