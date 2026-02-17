
'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { File as FileIcon, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPdfForm } from '@/lib/pdf-actions';

const ACCEPTED_FILE_TYPES = ['application/pdf'];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface PdfUploaderProps {
  onUploadSuccess: (pdfId: string) => void;
}

export default function PdfUploader({ onUploadSuccess }: PdfUploaderProps) {
  const [stagedFile, setStagedFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const storage = getStorage();
  const { user } = useUser();
  const { toast } = useToast();

  const validateFile = (file: File): boolean => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Only PDF files are allowed.' });
      return false;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({ variant: 'destructive', title: 'File Too Large', description: `File exceeds the ${MAX_FILE_SIZE_MB}MB size limit.` });
      return false;
    }
    return true;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (validateFile(file)) {
      setStagedFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUploading) return;
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleUpload = async () => {
    if (!stagedFile || !user) {
      toast({ variant: 'destructive', title: 'Error', description: 'No file selected or you are not logged in.' });
      return;
    }
    
    setIsUploading(true);
    setProgress(0);

    const fileId = `pdf_${Date.now()}`;
    const storagePath = `pdfs/${fileId}-${stagedFile.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, stagedFile);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const currentProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(currentProgress);
      },
      (error) => {
        console.error("Upload failed:", error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload the file.' });
        setIsUploading(false);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const result = await createPdfForm({
            name: stagedFile.name.replace(/\.pdf$/i, ''),
            originalFileName: stagedFile.name,
            storagePath: storagePath,
            downloadUrl: downloadURL,
          }, user.uid);

          if (result.success && result.id) {
            toast({ title: 'Upload Successful', description: `${stagedFile.name} has been uploaded.` });
            onUploadSuccess(result.id);
          } else {
            throw new Error(result.error || 'Failed to create database record.');
          }
        } catch (error) {
          console.error("Error creating Firestore document:", error);
          toast({ variant: 'destructive', title: 'Processing Failed', description: 'Could not save the PDF record.' });
        } finally {
          setIsUploading(false);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      {!stagedFile && (
        <div onDragEnter={handleDrag} className="relative">
          <Input ref={inputRef} id="pdf-upload" type="file" accept="application/pdf" onChange={(e) => handleFiles(e.target.files)} className="hidden" disabled={isUploading} />
          <label htmlFor="pdf-upload" className={cn("flex min-h-[250px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors", dragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/30 hover:bg-muted/50', isUploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Drag & drop your PDF here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            <p className="text-xs text-muted-foreground mt-4">Maximum file size: {MAX_FILE_SIZE_MB}MB</p>
          </label>
          {dragActive && <div className="absolute inset-0" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div>}
        </div>
      )}

      {stagedFile && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-secondary/50">
            <FileIcon className="h-8 w-8 text-secondary-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{stagedFile.name}</p>
              <p className="text-xs text-muted-foreground">{Math.round(stagedFile.size / 1024)} KB</p>
            </div>
            {!isUploading && (
              <Button variant="ghost" size="sm" onClick={() => setStagedFile(null)}>Change File</Button>
            )}
          </div>
          
          {isUploading && <Progress value={progress} className="w-full" />}

          <div className="flex justify-end pt-4">
            <Button onClick={handleUpload} disabled={isUploading || !stagedFile} className="w-full sm:w-auto" size="lg">
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {isUploading ? `Uploading... ${Math.round(progress)}%` : 'Upload & Continue'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
