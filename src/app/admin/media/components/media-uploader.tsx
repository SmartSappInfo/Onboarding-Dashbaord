
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UploadCloud, File as FileIcon, X, CheckCircle, AlertCircle, Trash2, Edit, CheckSquare, Ratio, Crop, ImageIcon, Percent, TextCursorInput, Loader2 } from 'lucide-react';
import Cropper, { type Area } from 'react-easy-crop';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getImageDimensions, processImage } from '@/lib/image-processing';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDebounce } from '@/hooks/use-debounce';


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

const aspectRatios = [
    { label: "Original", value: "none" },
    { label: "1:1", value: "1/1" },
    { label: "4:3", value: "4/3" },
    { label: "3:2", value: "3/2" },
    { label: "16:9", value: "16/9" },
    { label: "2:1", value: "2/1" },
    { label: "4:2", value: "4/2" },
];

export default function MediaUploader({ closeSheet }: { closeSheet: () => void }) {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedFile, setSelectedFile] = useState<StagedFile | null>(null);

  // Editor State
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectString, setAspectString] = useState('16/9');
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [name, setName] = useState('');
  const [targetWidth, setTargetWidth] = useState(1280);
  const [quality, setQuality] = useState(80);
  
  const [estimatedSize, setEstimatedSize] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  const debouncedCrop = useDebounce(croppedAreaPixels, 500);
  const debouncedWidth = useDebounce(targetWidth, 500);
  const debouncedQuality = useDebounce(quality, 500);

  const updateSelectedFileEdits = (newEdits: Partial<StagedFile['edits']>) => {
    if (!selectedFile) return;
    setStagedFiles(prev => prev.map(sf => {
      if (sf.id !== selectedFile.id) return sf;
      const updatedEdits = { ...sf.edits, ...newEdits } as StagedFile['edits'];
      return { ...sf, edits: updatedEdits };
    }));
  };

  useEffect(() => {
    if (selectedFile?.isImage) {
      if (selectedFile.edits) {
        const { edits } = selectedFile;
        setCrop(edits.crop);
        setZoom(edits.zoom);
        const foundRatio = aspectRatios.find(r => r.value !== 'none' && Math.abs(eval(r.value) - edits.aspect) < 0.01);
        setAspectString(foundRatio ? foundRatio.value : 'none');
        setName(edits.name);
        setTargetWidth(edits.targetWidth);
        setQuality(edits.quality);
      } else {
        const initialAspect = selectedFile.originalWidth! / selectedFile.originalHeight!;
        const foundRatio = aspectRatios.find(r => r.value !== 'none' && Math.abs(eval(r.value) - initialAspect) < 0.01);
        const defaultAspect = foundRatio ? foundRatio.value : '16/9';
        
        const newEdits = {
            name: selectedFile.file.name.split('.').slice(0, -1).join('.'),
            crop: { x: 0, y: 0 },
            zoom: 1,
            aspect: eval(defaultAspect),
            targetWidth: selectedFile.originalWidth!,
            quality: 80,
            croppedAreaPixels: { x: 0, y: 0, width: selectedFile.originalWidth!, height: selectedFile.originalHeight! },
        };
        updateSelectedFileEdits(newEdits);
      }
    }
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedFile?.originalDataUrl || !debouncedCrop) return;

    const estimate = async () => {
        setIsEstimating(true);
        try {
            const { blob } = await processImage(
                selectedFile.originalDataUrl!,
                debouncedCrop,
                debouncedWidth,
                debouncedQuality,
                'estimate'
            );
            setEstimatedSize(formatBytes(blob.size));
        } catch (e) {
            console.error("Estimation failed", e);
            setEstimatedSize("N/A");
        } finally {
            setIsEstimating(false);
        }
    };

    estimate();
  }, [debouncedCrop, debouncedWidth, debouncedQuality, selectedFile?.originalDataUrl]);


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
        const updatedList = [...prev, ...trulyNewFiles];
        if (!selectedFile && trulyNewFiles.length > 0) {
            setSelectedFile(trulyNewFiles.find(f => f.isImage) || trulyNewFiles[0]);
        }
        return updatedList;
    });
  }, [toast, selectedFile]);

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

  const removeFile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setStagedFiles(prev => {
        const newList = prev.filter(sf => sf.id !== id);
        if (selectedFile?.id === id) {
            const firstImage = newList.find(f => f.isImage);
            setSelectedFile(firstImage || newList[0] || null);
        }
        return newList;
    });
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
                finalName = fileToUpload.name.split('.').slice(0, -1).join('.').replace(/\s/g, '_');
                if(stagedFile.isImage) {
                    finalWidth = stagedFile.originalWidth;
                    finalHeight = stagedFile.originalHeight;
                }
            }
            
            const mediaType = getMediaType(fileToUpload.type);
            const storagePath = `media/${mediaType}/${Date.now()}-${finalName}`;
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
  
  const aspectNumber = useMemo(() => {
    if (aspectString === 'none') return undefined;
    try {
        return eval(aspectString);
    } catch {
        return undefined;
    }
  }, [aspectString]);

  const targetHeight = aspectNumber && targetWidth > 0 ? Math.round(targetWidth / aspectNumber) : 0;

  return (
    <div className="grid md:grid-cols-3 gap-6 h-full">
      <div className="md:col-span-1 h-full flex flex-col gap-4">
        <div
            onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
            className={cn(
            "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors",
            isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
            )}
            onClick={() => document.getElementById('file-input')?.click()}
        >
            <UploadCloud className="w-8 h-8 text-muted-foreground" />
            <p className="mt-2 font-semibold text-sm">Click or drag and drop</p>
            <input id="file-input" type="file" multiple className="hidden" onChange={(e) => handleFileSelection(e.target.files)} accept={ACCEPTED_MIME_TYPES.join(',')} />
        </div>

        <div className="flex-grow relative">
            {stagedFiles.length > 0 ? (
                <ScrollArea className="absolute inset-0 pr-4">
                    <div className="space-y-4">
                    {stagedFiles.map(sf => (
                        <div 
                            key={sf.id} role="button" tabIndex={0}
                            onClick={() => setSelectedFile(sf)}
                            onKeyDown={(e) => e.key === "Enter" && setSelectedFile(sf)}
                            className={cn(
                                "flex items-center gap-4 p-3 rounded-lg border bg-card transition-colors cursor-pointer hover:bg-muted/50",
                                selectedFile?.id === sf.id && 'ring-2 ring-primary border-primary'
                            )}
                        >
                            <FileIcon className="w-8 h-8 text-muted-foreground shrink-0" />
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-medium truncate">{sf.file.name}</p>
                                <p className="text-xs text-muted-foreground">{formatBytes(sf.file.size)}</p>
                                {sf.status === 'uploading' && <Progress value={sf.progress} className="h-1.5 mt-1.5" />}
                                {sf.status === 'error' && <p className="text-xs text-destructive mt-1 truncate">{sf.error}</p>}
                            </div>
                            <div className="flex items-center shrink-0">
                                {sf.isImage && sf.edits && sf.status === 'pending' && <CheckSquare className="w-5 h-5 text-primary" />}
                                {sf.status === 'pending' && !isUploading && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 ml-2" onClick={(e) => removeFile(e, sf.id)}>
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
        <div className="flex justify-end gap-4 shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={closeSheet} disabled={isUploading}>Cancel</Button>
            <Button onClick={handleUpload} disabled={isUploading || stagedFiles.filter(sf => sf.status === 'pending').length === 0}>
            {isUploading ? 'Uploading...' : `Upload ${stagedFiles.filter(f => f.status === 'pending').length} File(s)`}
            </Button>
      </div>
      </div>
      
      <div className="md:col-span-2 h-full flex flex-col gap-4">
        <div className="flex-grow relative bg-muted rounded-md min-h-[300px]">
            {selectedFile?.isImage && selectedFile.originalDataUrl && (
                <Cropper
                  image={selectedFile.originalDataUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspectNumber}
                  onCropChange={setCrop}
                  onZoomChange={(val) => { setZoom(val); updateSelectedFileEdits({ zoom: val }); }}
                  onCropComplete={(_, croppedAreaPixels) => {
                    setCroppedAreaPixels(croppedAreaPixels);
                    updateSelectedFileEdits({ croppedAreaPixels });
                  }}
                />
            )}
            {!selectedFile?.isImage && (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <p>{selectedFile ? 'Editing not available for this file type.' : 'Select a file to begin'}</p>
                </div>
            )}
        </div>
        
        {selectedFile?.isImage && (
            <ScrollArea className="h-full max-h-[280px] shrink-0">
                <div className="space-y-6 p-1 pr-4">
                    <div className="space-y-2">
                        <Label htmlFor="filename" className="flex items-center gap-2"><TextCursorInput/> File Name (.webp)</Label>
                        <Input id="filename" value={name} onChange={(e) => {setName(e.target.value); updateSelectedFileEdits({ name: e.target.value })}} />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><ImageIcon /> Dimensions</Label>
                      <div className="flex items-center gap-2">
                          <Input id="width" type="number" value={targetWidth} onChange={(e) => {const val = parseInt(e.target.value, 10) || 0; setTargetWidth(val); updateSelectedFileEdits({targetWidth: val})}} />
                          <span className="text-muted-foreground">x</span>
                          <Input id="height" type="number" value={targetHeight} disabled />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Ratio /> Aspect Ratio</Label>
                      <Select value={aspectString} onValueChange={setAspectString}>
                          <SelectTrigger>
                              <SelectValue placeholder="Select aspect ratio" />
                          </SelectTrigger>
                          <SelectContent>
                              {aspectRatios.map(ratio => (
                                  <SelectItem key={ratio.value} value={ratio.value}>{ratio.label}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="zoom" className="flex items-center gap-2"><Crop/> Zoom ({zoom.toFixed(2)}x)</Label>
                        <Slider id="zoom" value={[zoom]} onValueChange={([val]) => {setZoom(val); updateSelectedFileEdits({ zoom: val })}} min={1} max={3} step={0.1} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="quality" className="flex items-center gap-2"><Percent /> Quality ({quality}%)</Label>
                        <Slider id="quality" value={[quality]} onValueChange={([val]) => {setQuality(val); updateSelectedFileEdits({ quality: val })}} min={10} max={100} step={5} />
                    </div>
                    <div className="space-y-4 text-sm text-muted-foreground rounded-lg border p-3">
                        <p className="font-semibold text-foreground">Original:</p>
                        <div className="flex justify-between"><span>Dimensions:</span> <span>{selectedFile.originalWidth} x {selectedFile.originalHeight}</span></div>
                        <div className="flex justify-between"><span>Size:</span> <span>{formatBytes(selectedFile.file.size)}</span></div>
                        <div className="border-t pt-2 mt-2">
                            <p className="font-semibold text-foreground">Estimated Output:</p>
                            <div className="flex justify-between"><span>Dimensions:</span> <span>{targetWidth} x {targetHeight}</span></div>
                            <div className="flex justify-between items-center">
                                <span>File Size:</span>
                                <span className="font-mono text-foreground flex items-center">
                                  {isEstimating && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
                                  {isEstimating ? '...' : estimatedSize || 'N/A'}
                                </span>
                              </div>
                        </div>
                    </div>
                </div>
            </ScrollArea>
        )}
      </div>
    </div>
  );
}
