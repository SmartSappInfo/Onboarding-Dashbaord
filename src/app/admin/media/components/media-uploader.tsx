
'use client';

import { useState, useCallback } from 'react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UploadCloud, File as FileIcon, X, CheckCircle, AlertCircle, Trash2, Edit, CheckSquare } from 'lucide-react';
import { Area } from 'react-easy-crop';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import ImageEditorDialog from './image-editor-dialog';
import { getImageDimensions, processImage } from '@/lib/image-processing';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg',
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const getMediaType = (mimeType: string): 'image' | 'video' | 'audio' | 'document' => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
};

export interface StagedFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  id: string;
  isImage?: boolean;
  originalDataUrl?: string;
  originalWidth?: number;
  originalHeight?: number;
  edits?: {
    name: string;
    crop: { x: number; y: number };
    croppedAreaPixels: Area;
    zoom: number;
    aspect: number;
    targetWidth: number;
    quality: number;
  };
}

export default function MediaUploader({ closeSheet }: { closeSheet: () => void }) {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [editingFile, setEditingFile] = useState<StagedFile | null>(null);

  const handleFileSelection = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const newFilesPromises = Array.from(files).map(async file => {
        if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
          toast({ variant: 'destructive', title: 'Invalid File Type', description: `${file.name} is not a supported file type.` });
          return null;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast({ variant: 'destructive', title: 'File Too Large', description: `${file.name} exceeds the 50MB size limit.` });
          return null;
        }

        const isImage = file.type.startsWith('image/');
        let imageDetails: Partial<StagedFile> = {};
        if (isImage) {
            try {
                const { width, height, dataUrl } = await getImageDimensions(file);
                imageDetails = {
                    isImage,
                    originalDataUrl: dataUrl,
                    originalWidth: width,
                    originalHeight: height,
                };
            } catch (error) {
                toast({ variant: 'destructive', title: 'Could not read image', description: file.name });
                return null;
            }
        }
        
        return {
            file,
            progress: 0,
            status: 'pending' as const,
            id: `${file.name}-${file.size}-${file.lastModified}`,
            ...imageDetails
        };
    });

    const newFiles = (await Promise.all(newFilesPromises)).filter(Boolean) as StagedFile[];

    setStagedFiles(prev => {
        const existingIds = new Set(prev.map(f => f.id));
        const trulyNewFiles = newFiles.filter(f => !existingIds.has(f.id));
        return [...prev, ...trulyNewFiles];
    });
  }, [toast]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
    if (event.dataTransfer.files) {
        handleFileSelection(event.dataTransfer.files);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
  };

  const removeFile = (id: string) => {
    setStagedFiles(prev => prev.filter(sf => sf.id !== id));
  };
  
  const handleEditSave = (fileId: string, edits: StagedFile['edits']) => {
      setStagedFiles(prev => prev.map(sf => sf.id === fileId ? { ...sf, edits } : sf));
  };

  const handleUpload = async () => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to upload files.' });
      return;
    }
    const pendingFiles = stagedFiles.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) {
        toast({ title: "No new files to upload." });
        return;
    }
    
    setIsUploading(true);

    const uploadPromises = pendingFiles.map(async (stagedFile) => {
        setStagedFiles(prev => prev.map(sf => sf.id === stagedFile.id ? { ...sf, status: 'uploading', progress: 5 } : sf));

        try {
            let fileToUpload: File;
            let finalWidth: number | undefined;
            let finalHeight: number | undefined;
            let finalName: string;

            if (stagedFile.isImage && stagedFile.edits && stagedFile.originalDataUrl) {
                const { name, croppedAreaPixels, targetWidth, quality } = stagedFile.edits;
                finalName = name;
                const { file, width, height } = await processImage(stagedFile.originalDataUrl, croppedAreaPixels, targetWidth, quality, name);
                fileToUpload = file;
                finalWidth = width;
                finalHeight = height;
            } else {
                fileToUpload = stagedFile.file;
                finalName = fileToUpload.name.split('.').slice(0, -1).join('.');
                if(stagedFile.isImage) {
                    finalWidth = stagedFile.originalWidth;
                    finalHeight = stagedFile.originalHeight;
                }
            }
            
            const mediaType = getMediaType(fileToUpload.type);
            const storagePath = `media/${mediaType}/${Date.now()}-${finalName.replace(/\s/g, '_')}`;
            const storage = getStorage();
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

            return new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = 5 + (snapshot.bytesTransferred / snapshot.totalBytes) * 95;
                        setStagedFiles(prev => prev.map(sf => sf.id === stagedFile.id ? { ...sf, progress } : sf));
                    },
                    (error) => {
                        setStagedFiles(prev => prev.map(sf => sf.id === stagedFile.id ? { ...sf, status: 'error', error: error.message } : sf));
                        reject(error);
                    },
                    async () => {
                        try {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            
                            const mediaCollection = collection(firestore, 'media');
                            const mediaDocData = {
                                name: finalName,
                                url: downloadURL,
                                fullPath: storagePath,
                                type: mediaType,
                                mimeType: fileToUpload.type,
                                size: fileToUpload.size,
                                width: finalWidth,
                                height: finalHeight,
                                uploadedBy: user.uid,
                                createdAt: new Date().toISOString(),
                            };

                            addDoc(mediaCollection, mediaDocData)
                                .then(() => {
                                    setStagedFiles(prev => prev.map(sf => sf.id === stagedFile.id ? { ...sf, status: 'success' } : sf));
                                    resolve();
                                })
                                .catch((firestoreError) => {
                                    const permissionError = new FirestorePermissionError({
                                        path: mediaCollection.path,
                                        operation: 'create',
                                        requestResourceData: mediaDocData,
                                    });
                                    errorEmitter.emit('permission-error', permissionError);
                                    setStagedFiles(prev => prev.map(sf => sf.id === stagedFile.id ? { ...sf, status: 'error', error: firestoreError.message || 'Failed to save to database.' } : sf));
                                    reject(firestoreError);
                                });
                            
                        } catch (storageError: any) {
                             setStagedFiles(prev => prev.map(sf => sf.id === stagedFile.id ? { ...sf, status: 'error', error: storageError.message || 'Failed to retrieve file URL.' } : sf));
                            reject(storageError);
                        }
                    }
                );
            });
        } catch (processError: any) {
             setStagedFiles(prev => prev.map(sf => sf.id === stagedFile.id ? { ...sf, status: 'error', error: processError.message || 'Failed to process image.' } : sf));
        }
    });

    try {
        await Promise.all(uploadPromises);
        toast({ title: 'Upload Complete', description: 'All pending files have been processed and uploaded.' });
        
        setTimeout(() => {
            const hasErrors = stagedFiles.some(f => f.status === 'error');
            if (!hasErrors) {
                closeSheet();
            } else {
                 setStagedFiles(prev => prev.filter(sf => sf.status !== 'success'));
            }
        }, 2000);

    } catch (error) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'Some files could not be uploaded.' });
    } finally {
        setIsUploading(false);
    }
  };
  
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  return (
    <>
    <div className="flex flex-col h-full gap-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors",
          isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
        )}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <UploadCloud className="w-10 h-10 text-muted-foreground" />
        <p className="mt-4 font-semibold">Click to upload or drag and drop</p>
        <p className="text-sm text-muted-foreground">Supports Images, Videos, Audio, and Documents.</p>
        <input
            id="file-input"
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelection(e.target.files)}
            accept={ACCEPTED_MIME_TYPES.join(',')}
        />
      </div>

      <div className="flex-grow relative">
        {stagedFiles.length > 0 ? (
            <ScrollArea className="absolute inset-0 pr-4">
                <div className="space-y-4">
                {stagedFiles.map(sf => (
                    <div key={sf.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                    <FileIcon className="w-8 h-8 text-muted-foreground shrink-0" />
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate">{sf.file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(sf.file.size)}</p>
                        {sf.status === 'uploading' && <Progress value={sf.progress} className="h-1.5 mt-1.5" />}
                        {sf.status === 'error' && <p className="text-xs text-destructive mt-1 truncate">{sf.error}</p>}
                    </div>
                    <div className="flex items-center shrink-0">
                         {sf.isImage && sf.status === 'pending' && !isUploading && (
                           <Button variant="outline" size="sm" className="h-8 mr-2" onClick={() => setEditingFile(sf)}>
                               {sf.edits ? <CheckSquare className="w-4 h-4 text-primary" /> : <Edit className="w-4 h-4" />}
                               <span className="ml-2">{sf.edits ? 'Edited' : 'Edit'}</span>
                            </Button>
                         )}
                        {sf.status === 'pending' && !isUploading && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFile(sf.id)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                        {sf.status === 'uploading' && <span className="text-xs text-muted-foreground">{Math.round(sf.progress)}%</span>}
                        {sf.status === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                        {sf.status === 'error' && <AlertCircle className="w-5 h-5 text-destructive" />}
                    </div>
                    </div>
                ))}
                </div>
            </ScrollArea>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No files selected yet.
          </div>
        )}
      </div>
      
      <div className="flex justify-end gap-4 shrink-0 pt-4">
        <Button variant="outline" onClick={closeSheet} disabled={isUploading}>Cancel</Button>
        <Button onClick={handleUpload} disabled={isUploading || stagedFiles.filter(sf => sf.status === 'pending').length === 0}>
          {isUploading ? 'Uploading...' : `Upload ${stagedFiles.filter(f => f.status === 'pending').length} File(s)`}
        </Button>
      </div>
    </div>
    <ImageEditorDialog 
        file={editingFile}
        open={!!editingFile}
        onOpenChange={(open) => !open && setEditingFile(null)}
        onSave={handleEditSave}
    />
    </>
  );
}
