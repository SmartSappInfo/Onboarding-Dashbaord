'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useFirestore, useUser, FirestorePermissionError, errorEmitter } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { File as FileIcon, Upload, Loader2, Info, Layout } from 'lucide-react';
import type { MediaAsset, MediaCategory } from '@/lib/types';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { ImageEditor, type ImageEditingState } from './ImageEditor';
import { processImage, getImageDimensions } from '@/lib/image-processing';
import { useWorkspace } from '@/context/WorkspaceContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { UploadDropzone } from './upload-dropzone';
import { WorkspaceDestinationSelector } from './workspace-destination-selector';
import { StagedFileItem, type FileState } from './staged-file-item';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];
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
const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const mediaAssetTypeEnum = z.enum(['image', 'video', 'audio', 'document']);

interface MediaUploaderProps {
  onUploadSuccess: () => void;
  onUploadComplete?: (asset: MediaAsset) => void;
  acceptedFileTypes?: ('image' | 'video' | 'audio' | 'document')[];
  defaultWorkspaceId?: string;
}

export default function MediaUploader({ 
  onUploadSuccess, 
  onUploadComplete, 
  acceptedFileTypes = ['image', 'video', 'audio', 'document'],
  defaultWorkspaceId
}: MediaUploaderProps) {
  const [stagedFiles, setStagedFiles] = useState<FileState[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([]);
  const [categories, setCategories] = useState<MediaCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('General');
  
  const storage = getStorage();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspaceId, allowedWorkspaces, isSuperAdmin } = useWorkspace();

  // Subscribe to category updates
  useEffect(() => {
    if (!firestore || !activeWorkspaceId) return;
    
    const categoriesQuery = query(
      collection(firestore, 'media_categories'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(categoriesQuery, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MediaCategory[];
      
      // Fallback/Default categories if empty
      if (cats.length === 0) {
        setCategories([
          { id: 'general', name: 'General', workspaceId: activeWorkspaceId, createdAt: '' },
          { id: 'marketing', name: 'Marketing', workspaceId: activeWorkspaceId, createdAt: '' },
          { id: 'messaging', name: 'Messaging', workspaceId: activeWorkspaceId, createdAt: '' },
        ]);
      } else {
        setCategories(cats);
      }
    });

    return () => unsubscribe();
  }, [firestore, activeWorkspaceId]);

  // Initialize selected workspace
  useEffect(() => {
    if (defaultWorkspaceId) {
        setSelectedWorkspaces([defaultWorkspaceId]);
    } else if (activeWorkspaceId && selectedWorkspaces.length === 0) {
        setSelectedWorkspaces([activeWorkspaceId]);
    }
  }, [activeWorkspaceId, defaultWorkspaceId, selectedWorkspaces.length]);

  const workspaceOptions = React.useMemo(() => 
    allowedWorkspaces.map(w => ({ label: w.name, value: w.id })), 
  [allowedWorkspaces]);

  // Keep track of object URLs to clean up on unmount
  const objectUrls = useRef<Set<string>>(new Set());
  
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById('uploader-header-portal'));
  }, []);

  useEffect(() => {
    return () => {
      objectUrls.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

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
  };
  
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
    if (mediaType === 'audio' && file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Audio File Too Large', description: `${file.name} exceeds the 10MB audio size limit.` });
      return false;
    }
    return true;
  };
  
  const handleFiles = async (newFiles: FileList | null) => {
    if (!newFiles) return;
    const validatedFiles = Array.from(newFiles).filter(validateFile);
    
    const processedFiles: FileState[] = [];

    // Process all files in parallel before updating state to avoid race conditions
    await Promise.all(validatedFiles.map(async (file) => {
      const mediaType = getMediaType(file);
      const fileId = `${file.name}-${file.lastModified}-${file.size}`;
      
      // Skip if already staged
      if (stagedFiles.some(f => f.id === fileId)) return;

      if (mediaType === 'image') {
        try {
            const { width, height, dataUrl } = await getImageDimensions(file);
            objectUrls.current.add(dataUrl);
            processedFiles.push({
                id: fileId,
                file,
                status: 'pending',
                progress: 0,
                dimensions: { width, height },
                dataUrl,
            });
        } catch(e) {
            toast({ variant: 'destructive', title: 'Could not read image file', description: file.name });
        }
      } else {
         processedFiles.push({ id: fileId, file, status: 'pending', progress: 0 });
      }
    }));

    if (processedFiles.length > 0) {
        setStagedFiles(current => [...current, ...processedFiles]);
    }
  };

  useEffect(() => {
    if (stagedFiles.length > 0 && activeFileId === null) {
      setActiveFileId(stagedFiles[0].id);
    }
    if (stagedFiles.length === 0) {
      setActiveFileId(null);
    }
  }, [stagedFiles, activeFileId]);
  
  const removeFile = useCallback((e: React.MouseEvent, idToRemove: string) => {
    e.stopPropagation();
    setStagedFiles(files => {
      const fileToRemove = files.find(f => f.id === idToRemove);
      // Free object URL memory
      if (fileToRemove?.dataUrl && fileToRemove.dataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(fileToRemove.dataUrl);
      }
      return files.filter(file => file.id !== idToRemove);
    });
    
    if (activeFileId === idToRemove) {
      setActiveFileId(null);
    }
  }, [activeFileId]);

  const handleUpload = async () => {
    const isGlobalAllowed = isSuperAdmin || defaultWorkspaceId === 'global';
    
    if (stagedFiles.length === 0 || !user || !firestore || (selectedWorkspaces.length === 0 && !isGlobalAllowed)) {
        if(!user) toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in.' });
        if(selectedWorkspaces.length === 0 && !isGlobalAllowed) toast({ variant: 'destructive', title: 'Workspace Selection Required', description: 'Select at least one workspace.' });
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

        const isGif = fileState.file.type === 'image/gif' || fileState.file.name.toLowerCase().endsWith('.gif');

        if (mediaType === 'image' && fileState.editingState?.croppedAreaPixels && fileState.dataUrl && !isGif) {
          const { editingState } = fileState;
          const { file, width, height } = await processImage(
            fileState.dataUrl,
            editingState.croppedAreaPixels, 
            editingState.resize?.width || fileState.dimensions!.width,
            editingState.quality,
            editingState.filename,
            editingState.resize?.height,
            editingState.format,
            editingState.rotation
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
          finalMimeType = fileState.file.type || (mediaType === 'document' ? 'application/pdf' : 'application/octet-stream');
          finalFilename = fileState.editingState?.filename 
            ? `${fileState.editingState.filename}.${fileState.file.name.split('.').pop()}` 
            : fileState.file.name;
          
          if (fileState.dimensions) {
              finalWidth = fileState.dimensions.width;
              finalHeight = fileState.dimensions.height;
          }
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
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                
                interface NewAssetPayload {
                  name: string;
                  originalName: string;
                  url: string;
                  fullPath: string;
                  type: 'image' | 'video' | 'audio' | 'document';
                  mimeType: string;
                  size: number;
                  uploadedBy: string;
                  workspaceIds: string[];
                  category: string;
                  createdAt: string;
                  width?: number;
                  height?: number;
                  format?: string;
                }

                const newAssetData: NewAssetPayload = {
                  name: finalFilename,
                  originalName: fileState.file.name,
                  url: downloadURL,
                  fullPath: storagePath,
                  type: mediaType,
                  mimeType: finalMimeType,
                  size: blobToUpload.size,
                  uploadedBy: user.uid,
                  workspaceIds: selectedWorkspaces,
                  category: selectedCategory,
                  createdAt: new Date().toISOString()
                };

                if (finalWidth !== undefined) newAssetData.width = finalWidth;
                if (finalHeight !== undefined) newAssetData.height = finalHeight;
                if (mediaType === 'image' && fileState.editingState?.format) {
                    newAssetData.format = fileState.editingState.format;
                }

                const docRef = await addDoc(collection(firestore, 'media'), newAssetData);

                if (onUploadComplete) {
                  onUploadComplete({ id: docRef.id, ...newAssetData } as MediaAsset);
                }
                setStagedFiles(prev => prev.map((fs) => fs.id === fileState.id ? { ...fs, status: 'completed' } : fs));
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          );
        });
        return true;
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
        return false;
      }
    });

    const results = await Promise.all(uploadPromises);
    const allSucceeded = results.every(res => res === true);
    if (allSucceeded) {
      toast({ title: "Success", description: "All files uploaded successfully." });
      // Free memory for object URLs before clearing
      stagedFiles.forEach(file => {
          if (file.dataUrl && file.dataUrl.startsWith('blob:')) {
            URL.revokeObjectURL(file.dataUrl);
          }
      });
      setStagedFiles([]);
      onUploadSuccess();
    } else {
      toast({ variant: "destructive", title: "Upload Incomplete", description: "Some files failed to upload." });
    }
    setIsUploading(false);
  };
  
  const activeFileState = activeFileId ? stagedFiles.find(f => f.id === activeFileId) : null;
  const activeFileMime = activeFileState?.file.type;
  const isImageActive = activeFileState && getMediaType(activeFileState.file) === 'image';
  const isGifActive = activeFileMime === 'image/gif';
  
  const handleStateChange = useCallback((newState: ImageEditingState) => {
    setStagedFiles(prev => prev.map(fs => fs.id === activeFileId ? { ...fs, editingState: newState } : fs));
  }, [activeFileId]);

  const renderWorkspaceSelector = () => (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Category:</span>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-40 h-10 rounded-xl bg-background border border-border font-bold text-xs shadow-sm hover:bg-muted/10 transition-colors">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.name} className="font-semibold text-xs">
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <WorkspaceDestinationSelector 
          options={workspaceOptions}
          selectedWorkspaces={selectedWorkspaces}
          onChange={setSelectedWorkspaces}
          isSuperAdmin={isSuperAdmin}
      />
    </div>
  );

  return (
    <div className="flex flex-col space-y-6 w-full h-full relative">
      {portalTarget ? createPortal(renderWorkspaceSelector(), portalTarget) : (
          <div className="mb-4">
              {renderWorkspaceSelector()}
          </div>
      )}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* Left Column: Dropzone or Editor */}
        <div className={cn("flex flex-col gap-4 transition-all duration-300 h-full", stagedFiles.length > 0 ? "lg:col-span-8" : "lg:col-span-12")}>
            <AnimatePresence mode="wait">
                {!activeFileState && (
                    <motion.div
                        key="dropzone"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="h-full flex flex-col"
                    >
                        <UploadDropzone 
                            onFilesDropped={handleFiles} 
                            isUploading={isUploading} 
                            maxSizeMB={MAX_FILE_SIZE_MB} 
                        />
                    </motion.div>
                )}

                {activeFileState && isImageActive && activeFileState.dimensions && activeFileState.dataUrl && (
                    <motion.div
                        key="image-editor"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-col flex-1 h-full min-h-0 space-y-4 bg-muted/20 p-4 rounded-2xl border border-border"
                    >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                            <h3 className="font-semibold text-sm">Image Editor</h3>
                            <Button variant="ghost" size="sm" className="h-7 text-xs rounded-full" onClick={() => setActiveFileId(null)}>
                                Back to Upload
                            </Button>
                        </div>
                        {isGifActive && (
                            <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-3">
                                <Info className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                                <p className="text-xs font-bold text-orange-800 tracking-tight leading-relaxed">
                                    GIF Animation Preservation active. Resizing and cropping are disabled for GIFs to maintain frame integrity.
                                </p>
                            </div>
                        )}
                        <ImageEditor 
                            imageUrl={activeFileState.dataUrl}
                            originalFileName={activeFileState.file.name}
                            originalFileSize={activeFileState.file.size}
                            imageDimensions={activeFileState.dimensions}
                            initialState={activeFileState.editingState}
                            onStateChange={handleStateChange}
                            isGif={isGifActive}
                        />
                    </motion.div>
                )}
                
                {activeFileState && !isImageActive && (
                    <motion.div
                        key="file-preview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center h-64 bg-muted/30 rounded-2xl border border-dashed border-border gap-3 text-muted-foreground"
                    >
                        <div className="p-4 bg-background rounded-full shadow-sm">
                            <FileIcon className="h-10 w-10 text-primary"/>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-foreground truncate max-w-[250px]">{activeFileState.file.name}</p>
                            <p className="text-xs mt-1">This file type cannot be edited visually.</p>
                        </div>
                        <Button variant="outline" size="sm" className="mt-2 rounded-xl h-8 text-xs font-semibold" onClick={() => setActiveFileId(null)}>
                            View Dropzone
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {/* Right Column: Staged Files List */}
        {stagedFiles.length > 0 && (
            <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="lg:col-span-4 flex flex-col bg-muted/10 rounded-2xl border border-border overflow-hidden h-[400px] lg:h-auto"
            >
                <div className="p-4 border-b border-border bg-card/50 flex justify-between items-center shrink-0">
                    <h4 className="font-bold text-sm tracking-tight">Staged Files ({stagedFiles.length})</h4>
                    <span className="text-xs font-medium text-muted-foreground">
                        {stagedFiles.filter(f => f.status === 'completed').length} / {stagedFiles.length}
                    </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    <AnimatePresence>
                        {stagedFiles.map((fileState) => (
                            <StagedFileItem 
                                key={fileState.id}
                                fileState={fileState}
                                isActive={activeFileId === fileState.id}
                                isUploading={isUploading}
                                onSelect={setActiveFileId}
                                onRemove={removeFile}
                                isImage={getMediaType(fileState.file) === 'image'}
                            />
                        ))}
                    </AnimatePresence>
                </div>

                <div className="p-4 bg-card border-t border-border shrink-0">
                    <Button 
                        onClick={handleUpload} 
                        disabled={isUploading || stagedFiles.length === 0} 
                        className="w-full h-11 rounded-xl font-bold shadow-lg shadow-primary/20"
                    >
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {isUploading ? 'Uploading...' : `Upload to ${selectedWorkspaces.length || 'Global'} Hubs`}
                    </Button>
                </div>
            </motion.div>
        )}
      </div>
    </div>
  );
}
