'use client';

import * as React from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Ratio, Crop, Image as ImageIcon, Percent, TextCursorInput, Loader2 } from 'lucide-react';
import { StagedFile } from './media-uploader';
import { useDebounce } from '@/hooks/use-debounce';
import { processImage } from '@/lib/image-processing';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImageEditorDialogProps {
  file: StagedFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (fileId: string, edits: StagedFile['edits']) => void;
}

const staticAspectRatios = [
    { label: "Custom", value: "none" },
    { label: "1:1", value: String(1/1) },
    { label: "4:3", value: String(4/3) },
    { label: "3:2", value: String(3/2) },
    { label: "16:9", value: String(16/9) },
    { label: "2:1", value: String(2/1) },
];


export default function ImageEditorDialog({ file, open, onOpenChange, onSave }: ImageEditorDialogProps) {
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [aspectString, setAspectString] = React.useState('16/9');
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);

  const [name, setName] = React.useState('');
  const [targetWidth, setTargetWidth] = React.useState(1280);
  const [quality, setQuality] = React.useState(80);
  
  const [estimatedSize, setEstimatedSize] = React.useState<string | null>(null);
  const [isEstimating, setIsEstimating] = React.useState(false);
  
  const debouncedCrop = useDebounce(croppedAreaPixels, 500);
  const debouncedWidth = useDebounce(targetWidth, 500);
  const debouncedQuality = useDebounce(quality, 500);
  
  const aspectRatios = React.useMemo(() => {
      if (!file) return staticAspectRatios;
      return [
        { label: "Original Size", value: "original" },
        ...staticAspectRatios,
      ]
  }, [file]);


  React.useEffect(() => {
    if (file) {
        if (file.edits) {
            const { edits } = file;
            setCrop(edits.crop);
            setZoom(edits.zoom);
            
            const originalAspect = file.originalWidth! / file.originalHeight!;
            const isOriginal = Math.abs(edits.aspect - originalAspect) < 0.01 && edits.targetWidth === file.originalWidth;

            if (isOriginal) {
                setAspectString('original');
            } else {
                const foundRatio = staticAspectRatios.find(r => r.value !== 'none' && Math.abs(parseFloat(r.value) - edits.aspect) < 0.01);
                setAspectString(foundRatio ? foundRatio.value : 'none');
            }
            
            setName(edits.name);
            setTargetWidth(edits.targetWidth);
            setQuality(edits.quality);
        } else {
            // Set defaults from original file
            setAspectString('16/9');
            setName(file.file.name.split('.').slice(0, -1).join('.'));
            setTargetWidth(file.originalWidth!);
            setZoom(1);
            setCrop({x: 0, y: 0});
            setQuality(80);
        }
    }
  }, [file]);

  React.useEffect(() => {
      if (file && aspectString === 'original') {
          setTargetWidth(file.originalWidth!);
      }
  }, [aspectString, file]);
  
  React.useEffect(() => {
    if (!file?.originalDataUrl || !debouncedCrop || !open) return;

    const estimate = async () => {
        setIsEstimating(true);
        try {
            const { blob } = await processImage(
                file.originalDataUrl!,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCrop, debouncedWidth, debouncedQuality, file?.originalDataUrl, open]);

  const onCropComplete = React.useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = () => {
    if (file && croppedAreaPixels) {
      const finalAspect = aspectNumber ?? (croppedAreaPixels.width / croppedAreaPixels.height);
      onSave(file.id, {
        name,
        crop,
        croppedAreaPixels,
        zoom,
        aspect: finalAspect,
        targetWidth,
        quality,
      });
      onOpenChange(false);
    }
  };
  
  const aspectNumber = React.useMemo(() => {
    if (aspectString === 'none') return undefined;
    if (aspectString === 'original') {
        return file ? file.originalWidth! / file.originalHeight! : undefined;
    }
    try {
        return parseFloat(aspectString);
    } catch {
        return undefined;
    }
  }, [aspectString, file]);

  const targetHeight = aspectNumber && targetWidth > 0 ? Math.round(targetWidth / aspectNumber) : 0;

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }


  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Edit Image</DialogTitle>
          <DialogDescription>Crop, resize, and optimize your image before uploading.</DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
            <div className="md:col-span-2 relative bg-muted rounded-md min-h-[300px] md:min-h-[450px]">
              {file.originalDataUrl && (
                <Cropper
                  image={file.originalDataUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspectNumber}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>
            <div className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="filename" className="flex items-center gap-2"><TextCursorInput/> File Name (.webp)</Label>
                    <Input id="filename" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><ImageIcon /> Dimensions</Label>
                  <div className="flex items-center gap-2">
                      <Input id="width" type="number" value={targetWidth} onChange={(e) => setTargetWidth(parseInt(e.target.value, 10) || 0)} disabled={aspectString === 'original'} />
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
                    <Label htmlFor="zoom" className="flex items-center gap-2"><Crop/> Zoom</Label>
                    <Slider id="zoom" value={[zoom]} onValueChange={([val]) => setZoom(val)} min={1} max={3} step={0.1} />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="quality" className="flex items-center gap-2"><Percent /> Quality</Label>
                    <Slider id="quality" value={[quality]} onValueChange={([val]) => setQuality(val)} min={10} max={100} step={5} />
                </div>
                <div className="space-y-4 text-sm text-muted-foreground rounded-lg border p-3">
                    <p className="font-semibold text-foreground">Original:</p>
                    <div className="flex justify-between"><span>Dimensions:</span> <span>{file.originalWidth} x {file.originalHeight}</span></div>
                    <div className="flex justify-between"><span>Size:</span> <span>{formatBytes(file.file.size)}</span></div>
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
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 border-t">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
