'use client';
import * as React from 'react';
import ReactCrop, { type Crop, type PixelCrop, type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useDebounce } from '@/hooks/use-debounce';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TextCursorInput, ImageIcon, Percent, Sparkles, ZoomIn, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils';

export interface Area {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface ImageEditingState {
  filename: string;
  croppedAreaPixels: Area;
  resize?: { width: number; height: number };
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
  zoom: number;
  rotation?: number;
  crop: {x: number, y: number};
  aspect?: number;
}

interface ImageEditorProps {
  imageUrl: string;
  originalFileName: string;
  originalFileSize: number;
  imageDimensions: { width: number; height: number; };
  initialState?: Partial<ImageEditingState>;
  onStateChange: (newState: ImageEditingState) => void;
  isGif?: boolean;
}

const aspectRatios = [
    { label: "None (Free)", value: "none" },
    { label: "Original", value: "original" },
    { label: "1:1 Square", value: "1" },
    { label: "4:3 Standard", value: "1.3333" },
    { label: "3:2 Classic", value: "1.5" },
    { label: "16:9 Widescreen", value: "1.7777" },
];

export function ImageEditor({ imageUrl, originalFileName, originalFileSize, imageDimensions, initialState, onStateChange, isGif }: ImageEditorProps) {
  const getInitialRatio = () => {
      if (initialState?.aspect === undefined) return "none";
      const originalAspect = imageDimensions.width / imageDimensions.height;
      if (Math.abs(initialState.aspect - originalAspect) < 0.01) return "original";
      
      const found = aspectRatios.find(r => r.value !== "none" && r.value !== "original" && Math.abs(parseFloat(r.value) - initialState.aspect!) < 0.01);
      return found ? found.value : "none";
  };

  const [selectedRatio, setSelectedRatio] = React.useState<string>(getInitialRatio());
  
  const [crop, setCrop] = React.useState<Crop>({
      unit: '%',
      x: 0,
      y: 0,
      width: 100,
      height: 100
  });
  
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);
  
  const [filename, setFilename] = React.useState(initialState?.filename || originalFileName.split('.').slice(0, -1).join('.'));
  const [targetWidth, setTargetWidth] = React.useState(initialState?.resize?.width || imageDimensions.width);
  const [targetHeight, setTargetHeight] = React.useState(initialState?.resize?.height || imageDimensions.height);
  const [quality, setQuality] = React.useState(initialState?.quality || 80);
  const [format, setFormat] = React.useState<'jpeg' | 'png' | 'webp'>(initialState?.format || 'webp');
  const [zoom, setZoom] = React.useState(initialState?.zoom || 1);
  const [rotation, setRotation] = React.useState(initialState?.rotation || 0);
  
  const imgRef = React.useRef<HTMLImageElement>(null);

  const aspectValue = React.useMemo(() => {
    if (selectedRatio === "none") return undefined;
    if (selectedRatio === "original") return imageDimensions.width / imageDimensions.height;
    return parseFloat(selectedRatio);
  }, [selectedRatio, imageDimensions]);

  const snapCropToAspect = React.useCallback((asp: number) => {
    const imgAspect = imageDimensions.width / imageDimensions.height;
    let newWidth = 100;
    let newHeight = 100;
    if (asp > imgAspect) {
         newHeight = (imgAspect / asp) * 100;
    } else {
         newWidth = (asp / imgAspect) * 100;
    }
    setCrop({ unit: '%', x: (100 - newWidth) / 2, y: (100 - newHeight) / 2, width: newWidth, height: newHeight });
  }, [imageDimensions]);

  const handleRatioChange = (val: string) => {
    setSelectedRatio(val);
    if (val === "original") {
        setTargetWidth(imageDimensions.width);
        setTargetHeight(imageDimensions.height);
        setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
    } else if (val !== "none") {
        const ratio = parseFloat(val);
        setTargetHeight(Math.round(targetWidth / ratio));
        snapCropToAspect(ratio);
    }
  };

  const handleWidthChange = (val: number) => {
      setTargetWidth(val);
      if (aspectValue) {
          setTargetHeight(Math.round(val / aspectValue));
      }
  };

  const handleHeightChange = (val: number) => {
      setTargetHeight(val);
  };

  const debouncedState = useDebounce({
    filename,
    croppedAreaPixels,
    resize: { width: targetWidth, height: targetHeight },
    quality,
    format,
    rotation,
    crop: { x: crop.x, y: crop.y },
    aspect: aspectValue
  }, 500);

  React.useEffect(() => {
    if (debouncedState.croppedAreaPixels || isGif) {
      const finalCroppedArea = debouncedState.croppedAreaPixels || { x: 0, y: 0, width: imageDimensions.width, height: imageDimensions.height };
      onStateChange({ ...debouncedState, croppedAreaPixels: finalCroppedArea } as ImageEditingState);
    }
  }, [debouncedState, onStateChange, isGif, imageDimensions]);

  const onCropComplete = (crop: PixelCrop, percentCrop: PercentCrop) => {
    if (isGif) return;
    
    if (percentCrop) {
        setCroppedAreaPixels({
            x: Math.round((percentCrop.x * imageDimensions.width) / 100),
            y: Math.round((percentCrop.y * imageDimensions.height) / 100),
            width: Math.round((percentCrop.width * imageDimensions.width) / 100),
            height: Math.round((percentCrop.height * imageDimensions.height) / 100)
        });
    }
  };

  const estimatedSize = React.useMemo(() => {
    const pixels = targetWidth * targetHeight;
    let factor = 1;
    if (format === 'webp') factor = 0.5;
    if (format === 'jpeg') factor = 0.8;
    if (format === 'png') factor = 2;
    const rawBytes = pixels * 4;
    const estimated = rawBytes * (quality / 100) * factor * 0.1;
    return formatBytes(estimated);
  }, [targetWidth, targetHeight, quality, format]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-0">
        <div className="md:col-span-2 relative bg-muted rounded-md min-h-[300px] h-full overflow-hidden flex items-center justify-center p-4">
          {imageUrl && (
              <div className="overflow-auto h-full w-full flex items-center justify-center p-2">
                  <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }} className="transition-transform duration-150">
                      <ReactCrop
                        crop={crop}
                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                        onComplete={onCropComplete}
                        aspect={isGif ? undefined : aspectValue}
                        className={cn("flex items-center justify-center", isGif && "pointer-events-none")}
                        locked={isGif}
                      >
                        <img 
                            ref={imgRef}
                            src={imageUrl} 
                            alt="Editor" 
                            style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }}
                            className="max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-150"
                            onLoad={() => {
                                if (initialState?.croppedAreaPixels) {
                                    const { x, y, width, height } = initialState.croppedAreaPixels;
                                    setCrop({
                                        unit: '%',
                                        x: (x / imageDimensions.width) * 100,
                                        y: (y / imageDimensions.height) * 100,
                                        width: (width / imageDimensions.width) * 100,
                                        height: (height / imageDimensions.height) * 100,
                                    });
                                    setCroppedAreaPixels(initialState.croppedAreaPixels);
                                } else {
                                    setCroppedAreaPixels({ x: 0, y: 0, width: imageDimensions.width, height: imageDimensions.height });
                                }
                            }}
                        />
                      </ReactCrop>
                  </div>
              </div>
          )}
        </div>
        <div className="space-y-6 h-full overflow-y-auto pr-2 pb-6">
            <div className="space-y-2">
                <Label htmlFor="filename" className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground"><TextCursorInput className="w-3 h-3"/> File Name</Label>
                <div className="flex items-center gap-2">
                    <Input id="filename" value={filename} onChange={(e) => setFilename(e.target.value)} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-bold" />
                    {!isGif && (
                        <Select value={format} onValueChange={(v: 'jpeg' | 'png' | 'webp') => setFormat(v)}>
                            <SelectTrigger className="w-[100px] h-11 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-bold">
                                <SelectValue/>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="webp">.webp</SelectItem>
                                <SelectItem value="jpeg">.jpg</SelectItem>
                                <SelectItem value="png">.png</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                    {isGif && <Badge variant="outline" className="h-11 rounded-xl px-4 font-semibold">.GIF</Badge>}
                </div>
            </div>

            <div className={cn("space-y-6", isGif && "opacity-40 pointer-events-none")}>
                <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground"><ImageIcon className="w-3 h-3" /> Output Dimensions</Label>
                    <div className="flex items-center gap-2">
                        <Input 
                            id="width" 
                            type="number" 
                            value={targetWidth} 
                            onChange={(e) => handleWidthChange(parseInt(e.target.value, 10) || 0)} 
                            className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-bold text-center"
                        />
                        <span className="text-muted-foreground font-semibold">×</span>
                        <Input 
                            id="height" 
                            type="number" 
                            value={targetHeight} 
                            onChange={(e) => handleHeightChange(parseInt(e.target.value, 10) || 0)}
                            disabled={selectedRatio !== "none"} 
                            className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-bold text-center disabled:opacity-50"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-semibold text-muted-foreground">Aspect Ratio</Label>
                    <Select value={selectedRatio} onValueChange={handleRatioChange}>
                        <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-bold">
                            <SelectValue placeholder="Select aspect ratio" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {aspectRatios.map(ratio => (
                                <SelectItem key={ratio.label} value={ratio.value}>{ratio.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground"><RotateCw className="w-3 h-3" /> Rotation ({rotation}°)</Label>
                    <div className="px-2">
                        <Slider value={[rotation]} onValueChange={([val]) => setRotation(val)} min={-180} max={180} step={1} className="py-4" />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground"><ZoomIn className="w-3 h-3" /> Zoom ({zoom.toFixed(1)}x)</Label>
                    <div className="px-2">
                        <Slider value={[zoom]} onValueChange={([val]) => setZoom(val)} min={1} max={3} step={0.1} className="py-4" />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="quality" className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground"><Percent className="w-3 h-3" /> Compression Quality</Label>
                    <div className="px-2">
                        <Slider id="quality" value={[quality]} onValueChange={([val]) => setQuality(val)} min={10} max={100} step={5} className="py-4" />
                    </div>
                </div>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground rounded-2xl bg-primary/5 border border-primary/10 p-4 shadow-inner mt-4">
                <p className="font-semibold text-primary mb-2 flex items-center gap-2">
                    {isGif ? <Sparkles className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                    {isGif ? 'Binary Asset Meta' : 'Final File Meta (Estimated)'}
                </p>
                <div className="flex justify-between font-medium"><span>Dimensions:</span> <span className="font-bold text-foreground">{targetWidth} × {targetHeight}</span></div>
                <div className="flex justify-between font-medium pt-1"><span>File Size:</span> <span className="font-bold text-foreground">{isGif ? formatBytes(originalFileSize) : estimatedSize}</span></div>
                {isGif && <div className="mt-3 pt-3 border-t border-primary/10 text-[9px] font-bold text-orange-600">Animation frames preserved</div>}
                {!isGif && <div className="mt-3 pt-3 border-t border-primary/10 text-[9px] font-bold text-muted-foreground">Original: {imageDimensions.width}x{imageDimensions.height}</div>}
            </div>
        </div>
    </div>
  )
}
