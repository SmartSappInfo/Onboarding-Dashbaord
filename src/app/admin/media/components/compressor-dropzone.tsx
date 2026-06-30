'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface CompressorDropzoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function CompressorDropzone({ onFileSelect, disabled = false }: CompressorDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const validateAndProcessFile = (file: File) => {
    setError(null);
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Invalid file type. Only PDF files are supported.');
      return;
    }
    onFileSelect(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full space-y-4">
      <motion.div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        whileHover={!disabled ? { scale: 1.005 } : {}}
        whileTap={!disabled ? { scale: 0.995 } : {}}
        className={cn(
          "relative flex flex-col items-center justify-center min-h-[320px] p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 select-none",
          isDragActive
            ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(var(--primary-rgb),0.05)]"
            : "border-border hover:border-muted-foreground/50 hover:bg-muted/10 bg-transparent",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />

        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className={cn(
            "p-4 rounded-2xl bg-card border border-border shadow-sm transition-transform duration-300",
            isDragActive ? "scale-110 text-primary border-primary/20 rotate-3" : "text-muted-foreground"
          )}>
            {isDragActive ? (
              <Upload className="h-10 w-10 animate-bounce" />
            ) : (
              <FileText className="h-10 w-10" />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">
              {isDragActive ? "Drop your PDF here..." : "Drag & Drop your PDF file here"}
            </p>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              Or click to browse files from your computer. Files are compressed completely in your browser.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="rounded-xl font-bold px-6 border-border/80 hover:bg-card shadow-sm active:scale-97"
            onClick={(e) => {
              e.stopPropagation();
              triggerFileInput();
            }}
          >
            Select Document
          </Button>
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex items-start gap-3 text-destructive"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold leading-none">Validation Error</p>
            <p className="text-xs opacity-80 leading-relaxed">{error}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
