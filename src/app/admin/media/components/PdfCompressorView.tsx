'use client';

import { useState, useCallback } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, UploadTask } from 'firebase/storage';
import { addDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { CompressorDropzone } from './compressor-dropzone';
import { CompressorStats } from './compressor-stats';
import { compressPdf } from '@/lib/pdf-compressor';
import { CompressionResult } from '@/lib/pdf-compressor.types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Layers, ShieldAlert, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type CompressionStep = 'idle' | 'selected' | 'compressing' | 'completed' | 'error';
type CompressionPreset = 'lossless' | 'balanced' | 'max';

interface PresetOption {
  id: CompressionPreset;
  title: string;
  description: string;
  badge: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: 'max',
    title: 'Maximum Compression',
    description: 'Max size reduction, lower image resolution (90 DPI). Perfect for email or mobile apps.',
    badge: 'Smallest File'
  },
  {
    id: 'balanced',
    title: 'Balanced Compression',
    description: 'Optimal compromise between details and file size (~120 DPI). Recommended for standard use.',
    badge: 'Recommended'
  },
  {
    id: 'lossless',
    title: 'Lossless Optimizer',
    description: 'Original image quality. Only strips metadata and defragments structure. Ideal for high-end print files.',
    badge: 'Clean Metadata'
  }
];

export default function PdfCompressorView() {
  const [step, setStep] = useState<CompressionStep>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<CompressionPreset>('balanced');
  const [progress, setProgress] = useState<number>(0);
  const [progressDetails, setProgressDetails] = useState<string>('');
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Library save status
  const [isSavingToLibrary, setIsSavingToLibrary] = useState<boolean>(false);
  const [librarySaved, setLibrarySaved] = useState<boolean>(false);

  const { activeWorkspaceId } = useWorkspace();
  const firestore = useFirestore();
  const { user } = useUser();
  const storage = getStorage();
  const { toast } = useToast();

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setStep('selected');
  }, []);

  const handleCompression = async () => {
    if (!selectedFile) return;
    setStep('compressing');
    setProgress(0);
    setProgressDetails('Initializing local compressor Web Worker...');

    try {
      const output = await compressPdf(selectedFile, preset, (pct, phase, detail) => {
        setProgress(pct);
        setProgressDetails(detail || `Processing phase: ${phase}...`);
      });

      setResult(output);
      setStep('completed');
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'PDF compression process crashed.');
      setStep('error');
    }
  };

  const handleDownload = () => {
    if (!result || !selectedFile) return;
    
    const blob = new Blob([result.pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Append suffix to indicate compression
    const originalName = selectedFile.name;
    const baseName = originalName.substring(0, originalName.lastIndexOf('.pdf')) || originalName;
    
    link.href = url;
    link.download = `${baseName}-compressed.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Revoke memory reference
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleSaveToLibrary = async () => {
    if (!result || !selectedFile || !user || !firestore || !activeWorkspaceId) {
      toast({
        variant: 'destructive',
        title: 'Save Operation Aborted',
        description: 'Ensure you are signed in and an active workspace is selected.'
      });
      return;
    }

    setIsSavingToLibrary(true);

    try {
      const originalName = selectedFile.name;
      const baseName = originalName.substring(0, originalName.lastIndexOf('.pdf')) || originalName;
      const finalFilename = `${baseName}-compressed-${Date.now()}.pdf`;
      const storagePath = `media/document/${Date.now()}-${finalFilename}`;
      
      const storageRef = ref(storage, storagePath);
      const fileBlob = new Blob([result.pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      
      const uploadTask: UploadTask = uploadBytesResumable(storageRef, fileBlob);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          null, // Don't block UI with secondary upload progress; button is disabled
          reject,
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              const newAssetData: {
                name: string;
                originalName: string;
                url: string;
                fullPath: string;
                type: 'document';
                mimeType: string;
                size: number;
                uploadedBy: string;
                workspaceIds: string[];
                createdAt: string;
              } = {
                name: `${baseName}-compressed.pdf`,
                originalName: selectedFile.name,
                url: downloadURL,
                fullPath: storagePath,
                type: 'document',
                mimeType: 'application/pdf',
                size: result.compressedSize,
                uploadedBy: user.uid,
                workspaceIds: [activeWorkspaceId],
                createdAt: new Date().toISOString()
              };

              await addDoc(collection(firestore, 'media'), newAssetData);
              resolve();
            } catch (err) {
              reject(err);
            }
          }
        );
      });

      setLibrarySaved(true);
      toast({
        title: 'Asset Added',
        description: 'The compressed PDF was successfully registered in the Media Library.'
      });
    } catch (err: unknown) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: err instanceof Error ? err.message : 'Failed to save document to storage.'
      });
    } finally {
      setIsSavingToLibrary(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setStep('idle');
    setProgress(0);
    setProgressDetails('');
    setLibrarySaved(false);
    setIsSavingToLibrary(false);
    setErrorMessage('');
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-1 py-4">
      <AnimatePresence mode="wait">
        {step === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="text-center max-w-lg mx-auto space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
                <Cpu className="h-5 w-5 text-primary" /> Browser PDF Compression
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Compress your workspace files completely on your device. We do not upload your files to any external server during compression, keeping your documents 100% private.
              </p>
            </div>
            <CompressorDropzone onFileSelect={handleFileSelect} />
          </motion.div>
        )}

        {step === 'selected' && selectedFile && (
          <motion.div
            key="selected"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Header & Back Action */}
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <Button
                variant="ghost"
                onClick={handleReset}
                className="h-9 px-3 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-muted/10 active:scale-97"
              >
                <ArrowLeft className="h-4 w-4" /> Cancel Selection
              </Button>
              <span className="text-xs font-semibold text-muted-foreground">
                File: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>

            {/* Presets Grid */}
            <div className="space-y-3 text-left">
              <span className="text-xs font-bold tracking-tight text-muted-foreground uppercase pl-1">
                Select Compression Strength
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PRESET_OPTIONS.map((option) => {
                  const isSelected = preset === option.id;
                  return (
                    <div
                      key={option.id}
                      onClick={() => setPreset(option.id)}
                      className={cn(
                        "relative p-5 border-2 rounded-2xl cursor-pointer transition-all duration-200 hover:bg-muted/5 text-left",
                        isSelected
                          ? "border-primary bg-primary/[0.02]"
                          : "border-border hover:border-muted-foreground/35 bg-transparent"
                      )}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-extrabold text-sm tracking-tight text-foreground">
                            {option.title}
                          </h4>
                          <span className={cn(
                            "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                            isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          )}>
                            {option.badge}
                          </span>
                        </div>
                        <p className="text-xs leading-normal text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Start Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleCompression}
                className="h-12 rounded-xl font-bold text-sm tracking-tight px-8 shadow-md hover:shadow-lg active:scale-97 transition-all"
              >
                Execute Compression
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'compressing' && (
          <motion.div
            key="compressing"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="min-h-[300px] flex flex-col items-center justify-center space-y-6"
          >
            <div className="relative p-6 rounded-full bg-primary/5 border border-primary/10 shadow-sm animate-pulse">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>

            <div className="text-center space-y-3 max-w-sm">
              <h3 className="text-sm font-bold tracking-tight text-foreground">
                Optimizing Document Streams
              </h3>
              
              {/* Progress bar container */}
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border">
                <motion.div
                  className="bg-primary h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold px-0.5">
                <span className="truncate max-w-[240px] text-left">{progressDetails}</span>
                <span className="shrink-0">{progress}%</span>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'completed' && result && selectedFile && (
          <motion.div
            key="completed"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <CompressorStats
              fileName={selectedFile.name}
              originalSize={result.originalSize}
              compressedSize={result.compressedSize}
              savingsPercentage={result.savingsPercentage}
              imagesOptimized={result.imagesOptimized}
              onDownload={handleDownload}
              onSaveToLibrary={handleSaveToLibrary}
              onReset={handleReset}
              isSavingToLibrary={isSavingToLibrary}
              librarySaved={librarySaved}
            />
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="min-h-[300px] flex flex-col items-center justify-center space-y-6 p-8 border border-dashed border-destructive/20 bg-destructive/[0.01] rounded-2xl"
          >
            <div className="p-4 bg-destructive/10 rounded-full border border-destructive/25 text-destructive">
              <ShieldAlert className="h-8 w-8" />
            </div>

            <div className="text-center space-y-2 max-w-sm">
              <h3 className="text-sm font-bold text-foreground">Compression Process Failed</h3>
              <p className="text-xs text-muted-foreground leading-normal">{errorMessage}</p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="h-10 rounded-xl font-bold text-xs border-border/80 active:scale-97"
                onClick={handleReset}
              >
                Back to Dropzone
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
