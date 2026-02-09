'use client';
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useFirestore, useUser, FirestorePermissionError, errorEmitter } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { File as FileIcon, X, CheckCircle, Upload, Loader2, Pencil } from 'lucide-react';
import type { MediaAsset } from '@/lib/types';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { ImageEditor, type ImageEditingState } from './ImageEditor';
import { processImage } from '@/lib/image-processing';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];
// For now, only images can be edited. Other types will be uploaded directly.
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/flac'];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const mediaAssetTypeEnum = z.enum(['image', 'video', 'audio', 'document']);

interface FileState {
  id: string;
  file: File;
  status: 'pending' | 'editing' | 'processing' | 'completed' | 'error';
  progress: number;
  editingState?: ImageEditingState;
  dimensions?: { width: number; height: number };
}

interface MediaUploaderProps {
  onUploadSuccess: () => void;
  onUploadComplete?: (asset: MediaAsset) => void;
  acceptedFileTypes?: ('image' | 'video' | 'audio' | 'document')[];
}

export default function MediaUploader({ onUploadSuccess, onUploadComplete, acceptedFileTypes = ['image', 'video', 'audio', 'document'] }: MediaUploaderProps) {
  const [stagedFiles, setStagedFiles] = useState<FileState[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const storage = getStorage();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const getMediaType = (file: File): z.infer<typeof mediaAssetTypeEnum> | null => {
    const mimeType = file.type;
    if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image';
    if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'video';
    if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return 'audio';
    if (ALLOWED_DOCUMENT_TYPES.includes(mimeType)) return 'document';
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension) {
        if (['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'].includes(extension)) return 'image';
        if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(extension)) return 'video';
        if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(extension)) return 'audio';
        if (['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'xls', 'xlsx', 'csv'].includes(extension)) return 'document';
    }
    return null;
  }
  
  const validateFile = (file: File): boolean => {
    const mediaType = getMediaType(file);
    if (!mediaType) {
        toast({ variant: 'destructive', title: 'Unsupported File Format', description: `The format of ${file.name} is not supported.` });
        return false;
    }
    if (!acceptedFileTypes.includes(mediaType)) {
      toast({ variant: 'destructive', title: 'Invalid File Type', description: `This uploader only accepts ${acceptedFileTypes.join(', ')} files.` });
      return false;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({ variant: 'destructive', title: 'File Too Large', description: `${file.name} exceeds the ${MAX_FILE_SIZE_MB}MB size limit.` });
      return false;
    }
    return true;
  }
  
  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const validatedFiles = Array.from(newFiles).filter(validateFile);
    
    validatedFiles.forEach(file => {
      const mediaType = getMediaType(file);
      const fileId = `${file.name}-${file.lastModified}-${file.size}`;
      
      if (stagedFiles.some(f => f.id === fileId)) return;

      if (mediaType === 'image') {
        const image = new Image();
        image.src = URL.createObjectURL(file);
        image.onload = () => {
          setStagedFiles(currentFiles => [...currentFiles, {
            id: fileId,
            file,
            status: 'pending',
            progress: 0,
            dimensions: { width: image.width, height: image.height },
          }]);
          URL.revokeObjectURL(image.src);
        };
      } else {
         setStagedFiles(currentFiles => [...currentFiles, { id: fileId, file, status: 'pending', progress: 0 }]);
      }
    });
  };

  useEffect(() => {
    // Automatically select the first file for editing if none is active
    if (stagedFiles.length > 0 && activeFileId === null) {
      setActiveFileId(stagedFiles[0].id);
    }
    if (stagedFiles.length === 0) {
      setActiveFileId(null);
    }
  }, [stagedFiles, activeFileId]);
  
  const removeFile = (e: React.MouseEvent, idToRemove: string) => {
    e.stopPropagation();
    setStagedFiles(files => files.filter(file => file.id !== idToRemove));
    if(activeFileId === idToRemove) {
      setActiveFileId(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (isUploading) return;
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (stagedFiles.length === 0 || !user || !firestore) {
        if(!user) toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in.' });
        if(!firestore) toast({ variant: 'destructive', title: 'Database Error', description: 'Cannot connect to the database.' });
        return;
    }
    setIsUploading(true);

    const uploadPromises = stagedFiles.map(async (fileState) => {
      try {
        setStagedFiles(prev => prev.map((fs) => fs.id === fileState.id ? { ...fs, status: 'processing' } : fs));
        
        let blobToUpload: Blob;
        let finalFilename: string;
        let finalWidth: number | undefined;
        let finalHeight: number | undefined;
        let finalMimeType: string;
        let finalFile: File;

        const mediaType = getMediaType(fileState.file);
        if (!mediaType) throw new Error("Invalid file type");

        if (mediaType === 'image' && fileState.editingState?.croppedAreaPixels) {
          const { editingState } = fileState;
          const { file, width, height } = await processImage(
            fileState.file, 
            editingState.croppedAreaPixels, 
            editingState.resize?.width || fileState.dimensions!.width,
            editingState.quality,
            editingState.filename
          );
          blobToUpload = file;
          finalFile = file;
          finalWidth = width;
          finalHeight = height;
          finalMimeType = file.type;
          finalFilename = file.name;
        } else {
          blobToUpload = fileState.file;
          finalFile = fileState.file;
          finalMimeType = fileState.file.type;
          finalFilename = fileState.editingState?.filename 
            ? `${fileState.editingState.filename}.${fileState.file.name.split('.').pop()}` 
            : fileState.file.name;
        }

        const storagePath = `media/${mediaType}/${Date.now()}-${finalFilename}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, finalFile);
        
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setStagedFiles(prev => prev.map((fs) => fs.id === fileState.id ? { ...fs, progress } : fs));
            },
            reject,
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              const newAssetData: Omit<MediaAsset, 'id' | 'createdAt'> = {
                name: finalFilename,
                originalName: fileState.file.name,
                url: downloadURL,
                fullPath: storagePath,
                type: mediaType,
                mimeType: finalMimeType,
                size: blobToUpload.size,
                width: finalWidth,
                height: finalHeight,
                format: mediaType === 'image' && fileState.editingState ? fileState.editingState.format : undefined,
                uploadedBy: user.uid,
              };

              const docRef = await addDoc(collection(firestore, 'media'), {
                  ...newAssetData,
                  createdAt: new Date().toISOString()
              });

              if (onUploadComplete) {
                const docSnap = { id: docRef.id, ...newAssetData, createdAt: new Date().toISOString() }
                onUploadComplete(docSnap as MediaAsset);
              }
              setStagedFiles(prev => prev.map((fs) => fs.id === fileState.id ? { ...fs, status: 'completed' } : fs));
              resolve();
            }
          );
        });
      } catch (error) {
        console.error(`Upload failed for ${fileState.file.name}:`, error);
        setStagedFiles(prev => prev.map((fs) => fs.id === fileState.id ? { ...fs, status: 'error' } : fs));
        if (error instanceof Error) {
          const permissionError = new FirestorePermissionError({
            path: 'media',
            operation: 'create',
          });
          errorEmitter.emit('permission-error', permissionError);
        }
      }
    });

    await Promise.allSettled(uploadPromises);
    const allSucceeded = stagedFiles.every(fs => fs.status === 'completed');
    if (allSucceeded) {
      toast({ title: "Success", description: "All files uploaded." });
      setStagedFiles([]);
      onUploadSuccess();
    } else {
      toast({ variant: "destructive", title: "Upload Incomplete", description: "Some files failed to upload." });
    }
    setIsUploading(false);
  };
  
  const activeFileState = activeFileId ? stagedFiles.find(f => f.id === activeFileId) : null;
  const isImageActive = activeFileState && getMediaType(activeFileState.file) === 'image';
  
  const handleStateChange = useCallback((newState: ImageEditingState) => {
    setStagedFiles(prev => prev.map((fs) => fs.id === activeFileId ? { ...fs, editingState: newState } : fs));
  }, [activeFileId]);

  return (
    <div className="space-y-4">
      {!activeFileState && (
        <form onSubmit={e => e.preventDefault()} onDragEnter={handleDrag} className="relative">
          <Input ref={inputRef} id="file-upload" type="file" multiple onChange={e => handleFiles(e.target.files)} className="hidden" disabled={isUploading} />
          <label htmlFor="file-upload" className={cn("flex min-h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors", dragActive ? "border-primary bg-primary/10" : "border-muted-foreground/30 hover:bg-muted/50", isUploading ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Drag & drop files here or browse</p>
            <p className="text-xs text-muted-foreground mt-2">Maximum file size: {MAX_FILE_SIZE_MB}MB</p>
          </label>
          {dragActive && <div className="absolute inset-0" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div>}
        </form>
      )}

      {activeFileState && isImageActive && activeFileState.dimensions && (
        <ImageEditor 
          file={activeFileState.file}
          imageDimensions={activeFileState.dimensions}
          initialState={activeFileState.editingState}
          onStateChange={handleStateChange}
        />
      )}
      
      {activeFileState && !isImageActive && (
          <div className="flex items-center justify-center h-48 bg-muted rounded-lg flex-col gap-2 text-muted-foreground">
            <FileIcon className="h-12 w-12"/>
            <p className="font-medium">{activeFileState.file.name}</p>
            <p className="text-sm">This file type cannot be edited.</p>
          </div>
      )}

      {stagedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Staged Files ({stagedFiles.length})</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2 border rounded-lg p-2">
            {stagedFiles.map((fileState) => (
              <div 
                key={fileState.id} 
                className={cn("flex items-center gap-2 p-2 border rounded-lg bg-background cursor-pointer", activeFileId === fileState.id && "ring-2 ring-primary")}
                role="button"
                tabIndex={0}
                onClick={() => setActiveFileId(fileState.id)}
                onKeyDown={(e) => e.key === 'Enter' && setActiveFileId(fileState.id)}
              >
                <FileIcon className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileState.file.name}</p>
                  {fileState.status === 'pending' && <p className="text-xs text-muted-foreground">{(fileState.file.size / 1024).toFixed(2)} KB</p>}
                  {fileState.status === 'processing' && <Progress value={fileState.progress} className="h-2 mt-1" />}
                  {fileState.status === 'completed' && <div className="flex items-center gap-1 text-sm text-green-600"><CheckCircle className="h-4 w-4" /><span>Completed</span></div>}
                  {fileState.status === 'error' && <p className="text-xs text-destructive">Upload failed</p>}
                </div>
                {!isUploading && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => removeFile(e, fileState.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {stagedFiles.length > 0 && (
        <div className="flex justify-end pt-4">
          <Button onClick={handleUpload} disabled={isUploading || stagedFiles.length === 0} className="w-full sm:w-auto">
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {isUploading ? 'Uploading...' : `Upload ${stagedFiles.length} file(s)`}
          </Button>
        </div>
      )}
    </div>
  );
}
