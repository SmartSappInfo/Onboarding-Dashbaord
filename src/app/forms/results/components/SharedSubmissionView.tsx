'use client';

import * as React from 'react';
import type { PDFForm, Submission, PDFFormField } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, Loader2, Printer, Lock } from 'lucide-react';
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
        const pdfjs = await pdfjsPromise;
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;
        const loaded = await pdfjs.getDocument({ url: pdfForm.downloadUrl }).promise;
        setPdfDoc(loaded);
    };
    load();
  }, [pdfForm.downloadUrl, isUnlocked]);

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
        const response = await fetch(`/api/pdfs/${pdfForm.id}/generate/${submission.id}`);
        if (!response.ok) throw new Error('Failed to generate PDF');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${pdfForm.name}-submission.pdf`; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url);
        toast({ title: 'Download Successful' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Download Failed' });
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
    <div className="h-screen flex flex-col overflow-hidden bg-muted/20">
       <header className="h-16 border-b bg-background px-4 flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Results
                </Button>
                <div className="h-6 w-px bg-border mx-2" />
                <div className="hidden sm:block">
                    <h1 className="font-bold text-sm leading-none">Record: {submission.id.substring(0,8)}</h1>
                    <p className="text-[10px] text-muted-foreground mt-1">Submitted on {format(new Date(submission.submittedAt), "PPP")}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden sm:flex">
                    <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
                <Button size="sm" onClick={handleDownload} disabled={isDownloading}>
                    {isDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                    Download PDF
                </Button>
            </div>
      </header>

      <div className="flex-grow overflow-hidden relative">
        <ScrollArea className="h-full w-full">
            <div ref={pageContainerRef} className="p-4 sm:p-8 flex flex-col items-center min-w-full">
                {!pdfDoc ? (
                    <div className="space-y-4"><Skeleton className="w-[8.5in] h-[11in] bg-card rounded-lg" /></div>
                ) : (
                    <div className="flex flex-col gap-8 pb-20">
                        {Array.from({ length: pdfDoc.numPages }).map((_, i) => (
                            <PageRenderer key={i} pdf={pdfDoc} pageNumber={i+1} fields={pdfForm.fields} formData={submission.formData} />
                        ))}
                    </div>
                )}
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}

function PageRenderer({ pdf, pageNumber, fields, formData }: { pdf: PDFDocumentProxy; pageNumber: number; fields: PDFFormField[], formData: { [key: string]: any } }) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
    const [isRendering, setIsRendering] = React.useState(true);

    React.useEffect(() => {
        const render = async () => {
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1.5, rotation: page.rotate });
            setDimensions({ width: viewport.width, height: viewport.height });
            if (canvasRef.current) {
                const canvas = canvasRef.current;
                canvas.height = viewport.height; canvas.width = viewport.width;
                await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
                setIsRendering(false);
            }
        };
        render();
    }, [pdf, pageNumber]);

    return (
        <div className="relative bg-white border shadow-2xl" style={{ width: dimensions.width, height: dimensions.height }}>
            {isRendering && <Skeleton className="absolute inset-0" />}
            <canvas ref={canvasRef} className="w-full h-full block" />
            {!isRendering && (
                <div className="absolute inset-0 pointer-events-none">
                    {fields.filter(f => f.pageNumber === pageNumber).map(field => {
                        const val = formData[field.id]; if (!val) return null;
                        return (
                            <div key={field.id} style={{ position: 'absolute', left: `${field.position.x}%`, top: `${field.position.y}%`, width: `${field.dimensions.width}%`, height: `${field.dimensions.height}%`, display: 'flex' }}>
                                {field.type === 'signature' ? <img src={val} alt="Sig" className="w-full h-full object-contain object-left-top" /> : <span className="text-[14px] px-1 font-medium text-black whitespace-nowrap">{field.type === 'date' ? format(new Date(val), 'PPP') : val}</span>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
