
'use client';
import * as React from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { useDebounce } from '@/hooks/use-debounce';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TextCursorInput, ImageIcon, Crop, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils';

export interface ImageEditingState {
  filename: string;
  croppedAreaPixels: Area;
  resize?: { width: number; };
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
  zoom: number;
  crop: {x: number, y: number};
  aspect: number;
}

interface ImageEditorProps {
  imageUrl: string;
  originalFileName: string;
  originalFileSize: number;
  imageDimensions: { width: number; height: number; };
  initialState?: Partial<ImageEditingState>;
  onStateChange: (newState: ImageEditingState) => void;
}

const aspectRatios = [
    { label: "Original", value: 0 },
    { label: "1:1", value: 1/1 },
    { label: "4:3", value: 4/3 },
    { label: "3:2", value: 3/2 },
    { label: "16:9", value: 16/9 },
];

export function ImageEditor({ imageUrl, originalFileName, originalFileSize, imageDimensions, initialState, onStateChange }: ImageEditorProps) {
  const [crop, setCrop] = React.useState(initialState?.crop || { x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(initialState?.zoom || 1);
  const [aspect, setAspect] = React.useState(initialState?.aspect || 16/9);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);
  
  const [filename, setFilename] = React.useState(initialState?.filename || originalFileName.split('.').slice(0, -1).join('.'));
  const [targetWidth, setTargetWidth] = React.useState(initialState?.resize?.width || imageDimensions.width);
  const [quality, setQuality] = React.useState(initialState?.quality || 80);
  const [format, setFormat] = React.useState<'jpeg' | 'png' | 'webp'>(initialState?.format || 'webp');
  
  const debouncedState = useDebounce({
    filename,
    croppedAreaPixels,
    resize: { width: targetWidth },
    quality,
    format,
    zoom,
    crop,
    aspect
  }, 500);

  React.useEffect(() => {
    if (debouncedState.croppedAreaPixels) {
      onStateChange(debouncedState as ImageEditingState);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedState]);

  const onCropComplete = React.useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);
  
  const targetHeight = aspect > 0 && targetWidth > 0 ? Math.round(targetWidth / aspect) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 relative bg-muted rounded-md min-h-[300px] md:min-h-[450px]">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect || undefined}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="filename" className="flex items-center gap-2"><TextCursorInput/> File Name</Label>
                <div className="flex items-center gap-2">
                    <Input id="filename" value={filename} onChange={(e) => setFilename(e.target.value)} />
                    <Select value={format} onValueChange={(v: 'jpeg' | 'png' | 'webp') => setFormat(v)}>
                        <SelectTrigger className="w-[120px]">
                            <SelectValue/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="webp">.webp</SelectItem>
                            <SelectItem value="jpeg">.jpg</SelectItem>
                            <SelectItem value="png">.png</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
             <div className="space-y-2">
              <Label className="flex items-center gap-2"><ImageIcon /> Dimensions</Label>
              <div className="flex items-center gap-2">
                  <Input id="width" type="number" value={targetWidth} onChange={(e) => setTargetWidth(parseInt(e.target.value, 10) || 0)} />
                  <span className="text-muted-foreground">x</span>
                  <Input id="height" type="number" value={targetHeight} disabled />
              </div>
            </div>
            <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select value={String(aspect)} onValueChange={(v) => setAspect(Number(v))}>
                  <SelectTrigger>
                      <SelectValue placeholder="Select aspect ratio" />
                  </SelectTrigger>
                  <SelectContent>
                      {aspectRatios.map(ratio => (
                          <SelectItem key={ratio.label} value={String(ratio.value)}>{ratio.label}</SelectItem>
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
            <div className="space-y-2 text-sm text-muted-foreground rounded-lg border p-3">
                <p className="font-semibold text-foreground">Original:</p>
                <div className="flex justify-between"><span>Dimensions:</span> <span>{imageDimensions.width} x {imageDimensions.height}</span></div>
                <div className="flex justify-between"><span>Size:</span> <span>{formatBytes(originalFileSize)}</span></div>
            </div>
        </div>
    </div>
  )
}
