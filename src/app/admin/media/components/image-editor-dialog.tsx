
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
import { Switch } from '@/components/ui/switch';
import { AspectRatio, Crop, FileJson, Image as ImageIcon, Percent, TextCursorInput } from 'lucide-react';
import { StagedFile } from './media-uploader';

interface ImageEditorDialogProps {
  file: StagedFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (fileId: string, edits: StagedFile['edits']) => void;
}

export default function ImageEditorDialog({ file, open, onOpenChange, onSave }: ImageEditorDialogProps) {
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [aspect, setAspect] = React.useState(16 / 9);
  const [lockAspect, setLockAspect] = React.useState(true);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);

  const [name, setName] = React.useState('');
  const [targetWidth, setTargetWidth] = React.useState(1280);
  const [quality, setQuality] = React.useState(80);

  React.useEffect(() => {
    if (file?.edits) {
      const { edits } = file;
      setCrop(edits.crop);
      setZoom(edits.zoom);
      setAspect(edits.aspect);
      setName(edits.name);
      setTargetWidth(edits.targetWidth);
      setQuality(edits.quality);
    } else if (file) {
      // Set defaults from original file
      setAspect(file.originalWidth! / file.originalHeight!);
      setName(file.file.name.split('.').slice(0, -1).join('.'));
      setTargetWidth(file.originalWidth!);
      setZoom(1);
      setCrop({x: 0, y: 0});
      setQuality(80);
    }
  }, [file]);

  const onCropComplete = React.useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = () => {
    if (file && croppedAreaPixels) {
      onSave(file.id, {
        name,
        crop,
        croppedAreaPixels,
        zoom,
        aspect,
        targetWidth,
        quality,
      });
      onOpenChange(false);
    }
  };
  
  const targetHeight = lockAspect ? Math.round(targetWidth / aspect) : targetWidth;

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
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
          <DialogDescription>Crop, resize, and optimize your image before uploading.</DialogDescription>
        </DialogHeader>

        <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
          <div className="md:col-span-2 relative bg-muted rounded-md overflow-hidden">
            {file.originalDataUrl && (
              <Cropper
                image={file.originalDataUrl}
                crop={crop}
                zoom={zoom}
                aspect={lockAspect ? aspect : undefined}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          <div className="space-y-6 overflow-y-auto pr-2">
              <div className="space-y-2">
                  <Label htmlFor="filename" className="flex items-center gap-2"><TextCursorInput/> File Name (.webp)</Label>
                  <Input id="filename" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
               <div className="space-y-2">
                  <Label className="flex items-center gap-2"><ImageIcon /> Dimensions</Label>
                  <div className="flex items-center gap-2">
                      <Input id="width" type="number" value={targetWidth} onChange={(e) => setTargetWidth(parseInt(e.target.value, 10))} />
                       <span className="text-muted-foreground">x</span>
                      <Input id="height" type="number" value={targetHeight} disabled />
                  </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><AspectRatio /> Aspect Ratio</Label>
                <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                        <Label htmlFor="lock-aspect">Lock Aspect Ratio</Label>
                    </div>
                    <Switch id="lock-aspect" checked={lockAspect} onCheckedChange={setLockAspect} />
                </div>
              </div>

               <div className="space-y-2">
                  <Label htmlFor="zoom" className="flex items-center gap-2"><Crop/> Zoom</Label>
                  <Slider id="zoom" value={[zoom]} onValueChange={([val]) => setZoom(val)} min={1} max={3} step={0.1} />
              </div>

               <div className="space-y-2">
                  <Label htmlFor="quality" className="flex items-center gap-2"><Percent /> Quality</Label>
                  <Slider id="quality" value={[quality]} onValueChange={([val]) => setQuality(val)} min={10} max={100} step={5} />
              </div>
               <div className="space-y-2 text-sm text-muted-foreground rounded-lg border p-3">
                   <p className="font-semibold text-foreground">Original:</p>
                   <div className="flex justify-between"><span>Dimensions:</span> <span>{file.originalWidth} x {file.originalHeight}</span></div>
                   <div className="flex justify-between"><span>Size:</span> <span>{formatBytes(file.file.size)}</span></div>
               </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
