
'use client';
import * as React from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { useDebounce } from '@/hooks/use-debounce';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TextCursorInput, ImageIcon, Crop, Percent, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface ImageEditingState {
  filename: string;
  croppedAreaPixels: Area;
  resize?: { width: number; height: number };
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
  zoom: number;
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
  const [crop, setCrop] = React.useState(initialState?.crop || { x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(initialState?.zoom || 1);
  
  const getInitialRatio = () => {
      if (initialState?.aspect === undefined) return "none";
      const originalAspect = imageDimensions.width / imageDimensions.height;
      if (Math.abs(initialState.aspect - originalAspect) < 0.01) return "original";
      
      const found = aspectRatios.find(r => r.value !== "none" && r.value !== "original" && Math.abs(parseFloat(r.value) - initialState.aspect!) < 0.01);
      return found ? found.value : "none";
  };

  const [selectedRatio, setSelectedRatio] = React.useState<string>(getInitialRatio());
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);
  const [croppedAreaPercent, setCroppedAreaPercent] = React.useState<Area | null>(null);
  
  const [filename, setFilename] = React.useState(initialState?.filename || originalFileName.split('.').slice(0, -1).join('.'));
  const [targetWidth, setTargetWidth] = React.useState(initialState?.resize?.width || imageDimensions.width);
  const [targetHeight, setTargetHeight] = React.useState(initialState?.resize?.height || imageDimensions.height);
  const [quality, setQuality] = React.useState(initialState?.quality || 80);
  const [format, setFormat] = React.useState<'jpeg' | 'png' | 'webp'>(initialState?.format || 'webp');
  
  const containerRef = React.useRef<HTMLDivElement>(null);

  const aspectValue = React.useMemo(() => {
    if (selectedRatio === "none") return undefined;
    if (selectedRatio === "original") return imageDimensions.width / imageDimensions.height;
    return parseFloat(selectedRatio);
  }, [selectedRatio, imageDimensions]);

  React.useEffect(() => {
    if (selectedRatio === "original") {
      setTargetWidth(imageDimensions.width);
      setTargetHeight(imageDimensions.height);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    } else if (selectedRatio !== "none") {
        const ratio = parseFloat(selectedRatio);
        setTargetHeight(Math.round(targetWidth / ratio));
    }
  }, [selectedRatio, imageDimensions, targetWidth]);

  const handleWidthChange = (val: number) => {
      setTargetWidth(val);
      if (aspectValue) {
          setTargetHeight(Math.round(val / aspectValue));
      }
  };

  const debouncedState = useDebounce({
    filename,
    croppedAreaPixels,
    resize: { width: targetWidth, height: targetHeight },
    quality,
    format,
    zoom,
    crop,
    aspect: aspectValue
  }, 500);

  React.useEffect(() => {
    if (debouncedState.croppedAreaPixels || isGif) {
      onStateChange(debouncedState as ImageEditingState);
    }
  }, [debouncedState, onStateChange, isGif]);

  const onCropComplete = React.useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    if (isGif) return;
    setCroppedAreaPercent(croppedArea);
    setCroppedAreaPixels(croppedAreaPixels);
  }, [isGif]);

  const handleResize = (corner: 'tl' | 'tr' | 'bl' | 'br', deltaX: number, deltaY: number) => {
    if (isGif || !containerRef.current || !croppedAreaPercent) return;
    const sensitivity = 0.01;
    let zoomDelta = 0;
    if (corner === 'br' || corner === 'tl') zoomDelta = (deltaX + deltaY) * sensitivity;
    if (corner === 'tr' || corner === 'bl') zoomDelta = (deltaX - deltaY) * sensitivity;
    setZoom(prev => Math.min(3, Math.max(1, prev + zoomDelta)));
  };
  
  return (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="md:col-span-2 relative bg-muted rounded-md min-h-[300px] md:min-h-[450px] overflow-hidden" ref={containerRef}>
          {imageUrl && (
 <div className="absolute inset-0">
                <Cropper
                    image={imageUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={isGif ? undefined : aspectValue}
                    onCropChange={isGif ? () => {} : setCrop}
                    onZoomChange={isGif ? () => {} : setZoom}
                    onCropComplete={onCropComplete}
                    showGrid={!isGif}
                />
                
                {croppedAreaPercent && !isGif && (
 <div className="absolute inset-0 pointer-events-none z-10">
                        <div 
 className="absolute border-2 border-primary/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                            style={{
                                left: `${croppedAreaPercent.x}%`,
                                top: `${croppedAreaPercent.y}%`,
                                width: `${croppedAreaPercent.width}%`,
                                height: `${croppedAreaPercent.height}%`,
                            }}
                        >
                            {['tl', 'tr', 'bl', 'br'].map((corner) => (
                                <motion.div
                                    key={corner}
                                    drag
                                    dragMomentum={false}
                                    dragElastic={0}
                                    onDrag={(_, info) => handleResize(corner as any, info.delta.x, info.delta.y)}
 className={cn(
                                        "absolute w-4 h-4 bg-primary border-2 border-white rounded-sm pointer-events-auto cursor-nwse-resize shadow-lg",
                                        corner === 'tl' && "-top-2 -left-2",
                                        corner === 'tr' && "-top-2 -right-2 cursor-nesw-resize",
                                        corner === 'bl' && "-bottom-2 -left-2 cursor-nesw-resize",
                                        corner === 'br' && "-bottom-2 -right-2"
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
          )}
        </div>
 <div className="space-y-6">
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
                        onChange={(e) => setTargetHeight(parseInt(e.target.value, 10) || 0)}
                        disabled={selectedRatio !== "none"} 
 className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 font-bold text-center disabled:opacity-50"
                    />
                </div>
                </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-semibold text-muted-foreground">Aspect Ratio</Label>
                    <Select value={selectedRatio} onValueChange={setSelectedRatio}>
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
 <Label htmlFor="zoom" className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground"><Crop className="w-3 h-3"/> Zoom Level</Label>
 <div className="px-2">
 <Slider id="zoom" value={[zoom]} onValueChange={([val]) => setZoom(val)} min={1} max={3} step={0.01} className="py-4" />
                    </div>
                </div>
 <div className="space-y-2">
 <Label htmlFor="quality" className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground"><Percent className="w-3 h-3" /> Compression Quality</Label>
 <div className="px-2">
 <Slider id="quality" value={[quality]} onValueChange={([val]) => setQuality(val)} min={10} max={100} step={5} className="py-4" />
                    </div>
                </div>
            </div>

 <div className="space-y-2 text-xs text-muted-foreground rounded-2xl bg-primary/5 border border-primary/10 p-4 shadow-inner">
 <p className="font-semibold text-primary mb-2 flex items-center gap-2">
 {isGif ? <Sparkles className="h-3 w-3" /> : null}
                    {isGif ? 'Binary Asset Meta' : 'Original File Meta'}
                </p>
 <div className="flex justify-between font-medium"><span>Dimensions:</span> <span className="font-bold text-foreground">{imageDimensions.width} × {imageDimensions.height}</span></div>
 <div className="flex justify-between font-medium pt-1"><span>File Size:</span> <span className="font-bold text-foreground">{formatBytes(originalFileSize)}</span></div>
 {isGif && <div className="mt-3 pt-3 border-t border-primary/10 text-[9px] font-bold text-orange-600">Animation frames preserved</div>}
            </div>
        </div>
    </div>
  )
}
