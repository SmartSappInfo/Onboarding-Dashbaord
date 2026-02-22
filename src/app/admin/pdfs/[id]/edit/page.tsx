'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Pencil, Save, Loader2, Sparkles, Copy, Check, X } from 'lucide-react';
import { type PDFForm, type PDFFormField } from '@/lib/types';
import { updatePdfFormMapping, updatePdfFormStatus, updatePdfFormName, updatePdfFormSlug } from '@/lib/pdf-actions';
import { useToast } from '@/hooks/use-toast';
import FieldMapper from './components/FieldMapper';
import PdfPreviewDialog from './components/PdfPreviewDialog';
import { detectPdfFields } from '@/ai/flows/detect-pdf-fields-flow';
import { identifyPrimaryField } from '@/ai/flows/identify-primary-field-flow';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { useUndoRedo } from '@/hooks/use-undo-redo';
import { useDebounce } from '@/hooks/use-debounce';

export default function EditPdfPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const pdfId = params.id as string;
  const firestore = useFirestore();
  const { user } = useUser();

  const [fields, setFields] = React.useState<PDFFormField[]>([]);
  const [namingFieldId, setNamingFieldId] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState('');
  const [passwordProtected, setPasswordProtected] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDetecting, setIsDetecting] = React.useState(false);
  const [isStatusChanging, setIsStatusChanging] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editableTitle, setEditableTitle] = React.useState('');
  const [editableSlug, setEditableSlug] = React.useState('');
  const [isSavingSlug, setIsSavingSlug] = React.useState(false);
  const [isEditingSlug, setIsEditingSlug] = React.useState(false);
  const [tempSlug, setTempSlug] = React.useState('');

  // Undo/Redo Logic
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
  const debouncedFields = useDebounce(fields, 800); // 800ms debounce for history snapshots

  const pdfDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return doc(firestore, 'pdfs', pdfId);
  }, [firestore, pdfId]);

  const { data: pdf, isLoading } = useDoc<PDFForm>(pdfDocRef);
  
  React.useEffect(() => {
    if (pdf) {
      const initialFields = JSON.parse(JSON.stringify(pdf.fields || []));
      setFields(initialFields);
      setNamingFieldId(pdf.namingFieldId || null);
      resetHistory(initialFields);
      setPassword(pdf.password || '');
      setPasswordProtected(pdf.passwordProtected || false);
      setEditableTitle(pdf.name);
      setEditableSlug(pdf.slug || pdf.id);
      setTempSlug(pdf.slug || pdf.id);
    }
  }, [pdf, resetHistory]);

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

  const handleUndo = React.useCallback(() => {
    if (canUndo) {
        isProgrammaticChange.current = true;
        undoHistory();
    }
  }, [canUndo, undoHistory]);

  const handleRedo = React.useCallback(() => {
    if (canRedo) {
        isProgrammaticChange.current = true;
        redoHistory();
    }
  }, [canRedo, redoHistory]);

  // Global Keyboard Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                handleRedo();
            } else {
                handleUndo();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            handleRedo();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleSave = async () => {
    setIsSaving(true);
    
    let finalNamingFieldId = namingFieldId;

    // AI Detection: Only run if no naming field is manually selected and we have fields
    if (!finalNamingFieldId && fields.length > 0) {
        try {
            const aiResult = await identifyPrimaryField({ 
                fields: fields.map(f => ({ id: f.id, label: f.label, type: f.type })) 
            });
            if (aiResult.suggestedFieldId) {
                finalNamingFieldId = aiResult.suggestedFieldId;
                setNamingFieldId(finalNamingFieldId);
                toast({ title: 'AI Field Detection', description: `Automatically using "${fields.find(f => f.id === finalNamingFieldId)?.label || 'Field'}" for file naming.` });
            }
        } catch (e) {
            console.warn("AI Naming Field Detection failed:", e);
        }
    }

    const result = await updatePdfFormMapping(pdfId, {
      fields,
      namingFieldId: finalNamingFieldId,
      password: passwordProtected ? password : '',
      passwordProtected,
    });

    if (result.success) {
      toast({ title: 'Field map saved successfully!' });
    } else {
      toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
    }
    setIsSaving(false);
  };

  const handleSlugSave = async () => {
    if (!pdf || tempSlug === pdf.slug) {
        setIsEditingSlug(false);
        return;
    }
    setIsSavingSlug(true);
    const result = await updatePdfFormSlug(pdfId, tempSlug);
    if (result.success) {
        setEditableSlug(result.slug!);
        toast({ title: 'URL Slug updated!' });
        setIsEditingSlug(false);
    } else {
        setTempSlug(pdf.slug || pdf.id);
        toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
    }
    setIsSavingSlug(false);
  };

  const handleDetectFields = async () => {
    if (isDetecting || !pdf?.downloadUrl) return;
    setIsDetecting(true);
    toast({ title: 'AI Field Detection', description: 'Analyzing your PDF. This might take a moment...' });
    
    try {
        const response = await fetch(pdf.downloadUrl);
        if (!response.ok) throw new Error("Failed to fetch PDF data.");
        const blob = await response.blob();
        
        const base64data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file."));
            reader.readAsDataURL(blob);
        });

        const result = await detectPdfFields({ pdfDataUri: base64data });
        if (result.fields && result.fields.length > 0) {
            const newFields: (PDFFormField & { isSuggestion?: boolean })[] = result.fields.map(suggestion => ({ 
                ...suggestion, 
                id: `ai_${Date.now()}_${Math.random().toString(36).substr(2,5)}`, 
                isSuggestion: true, 
            }));
            setFields(prev => [...prev.filter((f: any) => !f.isSuggestion), ...newFields]);
            toast({ title: 'AI Suggestions Added', description: `${result.fields.length} potential fields detected.` });
        } else {
            toast({ variant: 'destructive', title: 'No Fields Detected', description: 'The AI could not find any fields in this document.' });
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'AI Detection Failed', description: error.message || 'An unknown error occurred.' });
    } finally {
        setIsDetecting(false);
    }
  };
  
  const handleStatusChange = async (newStatus: PDFForm['status']) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'You must be logged in.' });
        return;
    }
    setIsStatusChanging(true);
    const result = await updatePdfFormStatus(pdf!.id, newStatus, user.uid);
    if (result.success) {
        toast({ title: 'Status Updated' });
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsStatusChanging(false);
  };

  const handleTitleSave = async () => {
    if (!pdf || editableTitle.trim() === '' || editableTitle.trim() === pdf.name) {
      setIsEditingTitle(false);
      return;
    }
    const result = await updatePdfFormName(pdf.id, editableTitle);
    if (result.success) {
      toast({ title: 'Title updated successfully!' });
    } else {
      toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
      setEditableTitle(pdf.name); // Revert on failure
    }
    setIsEditingTitle(false);
  };


  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col">
        <div className="flex-shrink-0">
          <Skeleton className="h-8 w-1/4" />
        </div>
        <div className="flex-grow min-h-0 mt-4">
          <Skeleton className="h-[calc(100%-4rem)] w-full" />
        </div>
      </div>
    )
  }

  if (!pdf) {
      return (
        <div className="text-center py-20">
            <p>Document not found.</p>
        </div>
      );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = `${origin}/forms/${editableSlug}`;

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="flex-shrink-0 border-b p-2 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" onClick={() => router.push('/admin/pdfs')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="flex flex-col min-w-0">
                {isEditingTitle ? (
                  <Input
                    value={editableTitle}
                    onChange={(e) => setEditableTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setIsEditingTitle(false);}}
                    className="text-lg font-semibold h-9"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-1 group min-w-0">
                    <h1 className="text-lg font-semibold truncate" title={pdf.name}>{pdf.name}</h1>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 flex-shrink-0" onClick={() => setIsEditingTitle(true)}>
                      < Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-[-2px]">
                    <div className="flex items-center gap-0.5 truncate">
                        <span>{origin}/forms/</span>
                        {isEditingSlug ? (
                            <div className="flex items-center gap-1">
                                <Input 
                                    value={tempSlug} 
                                    onChange={e => setTempSlug(e.target.value)} 
                                    onBlur={handleSlugSave}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSlugSave(); if (e.key === 'Escape') setIsEditingSlug(false);}}
                                    className="h-5 text-[10px] py-0 px-1 w-32"
                                    autoFocus
                                />
                                {isSavingSlug && <Loader2 className="h-3 w-3 animate-spin" />}
                            </div>
                        ) : (
                            <button 
                                onClick={() => setIsEditingSlug(true)}
                                className="font-medium text-foreground hover:underline cursor-pointer flex items-center gap-1"
                            >
                                {editableSlug}
                                <Pencil className="h-2 w-2 opacity-0 group-hover:opacity-100" />
                            </button>
                        )}
                    </div>
                    {!isEditingSlug && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 hover:text-primary transition-colors shrink-0" 
                            onClick={() => {
                                navigator.clipboard.writeText(publicUrl);
                                toast({ title: 'Link Copied', description: 'Public form URL copied to clipboard.' });
                            }}
                        >
                            <Copy className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <RainbowButton onClick={handleDetectFields} disabled={isDetecting} className="h-9 px-3 sm:px-4">
                {isDetecting ? (
                    <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                ) : (
                    <Sparkles className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">{isDetecting ? 'Analyzing...' : 'AI-Detect Fields'}</span>
            </RainbowButton>
            <Button onClick={handleSave} disabled={isSaving} className="px-3 sm:px-4">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin sm:mr-2" /> : <Save className="mr-2 h-4 w-4 sm:mr-2" />}
                <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
            </Button>
        </div>
      </div>

      <div className="flex-grow min-h-0">
        <FieldMapper
            pdf={pdf}
            fields={fields}
            setFields={setFields}
            namingFieldId={namingFieldId}
            setNamingFieldId={setNamingFieldId}
            password={password}
            setPassword={setPassword}
            passwordProtected={passwordProtected}
            setPasswordProtected={setPasswordProtected}
            onStatusChange={handleStatusChange}
            isStatusChanging={isStatusChanging}
            onPreview={() => setIsPreviewOpen(true)}
            onSave={handleSave}
            isSaving={isSaving}
            onDetect={handleDetectFields}
            isDetecting={isDetecting}
            undo={handleUndo}
            redo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
        />
      </div>

      <PdfPreviewDialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfForm={{ ...pdf, fields: fields, namingFieldId, password, passwordProtected, slug: editableSlug }}
      />
    </div>
  );
}
