'use client';

import * as React from 'react';
import SignatureCanvas from 'react-signature-canvas';
import Webcam from 'react-webcam';
import Cropper, { type Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
    Upload, Camera, Eraser, Scan, Check, RefreshCw, Sparkles, Wand2, Info, 
    ShieldCheck, ArrowLeft, ArrowRight, Type, Pipette, Sun, Contrast, 
    Loader2, X, Crop, Move, ZoomIn, RotateCcw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { processSignatureImage, processPhotoImage } from '@/lib/signature-processing';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SignaturePadModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
    mode?: 'signature' | 'photo';
}

export default function SignaturePadModal({ open, onClose, onSave, mode = 'signature' }: SignaturePadModalProps) {
    const { toast } = useToast();
    const [step, setStep] = React.useState<'input' | 'refine' | 'confirm'>('input');
    const [rawCapturedImage, setRawCapturedImage] = React.useState<string | null>(null);
    const [filteredBaseImageUrl, setFilteredBaseImageUrl] = React.useState<string | null>(null);
    const [processedResult, setProcessedResult] = React.useState<string | null>(null);

    const sigPadRef = React.useRef<SignatureCanvas | null>(null);
    const initialsCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const webcamRef = React.useRef<Webcam>(null);
    
    const [activeTab, setActiveTab] = React.useState('scan');
    const [typedInitials, setTypedInitials] = React.useState('');
    const [uploadedImage, setUploadedImage] = React.useState<string | null>(null);
    const [isConsented, setIsConsented] = React.useState(false);
    const [hasDrawn, setHasDrawn] = React.useState(false);

    // Refinement parameters
    const [inkSensitivity, setInkSensitivity] = React.useState(150);
    const [strokeWeight, setStrokeWeight] = React.useState(0);
    const [smoothing, setSmoothing] = React.useState(0);
    const [brightness, setBrightness] = React.useState(0);
    const [contrast, setContrast] = React.useState(0);
    
    // Spatial parameters (Cropper)
    const [crop, setCrop] = React.useState({ x: 0, y: 0 });
    const [zoom, setZoom] = React.useState(1);
    const [rotation, setRotation] = React.useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);
    
    const [isProcessingPreview, setIsProcessingPreview] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setStep('input');
            setActiveTab('scan');
        }
    }, [open]);

    // REAL-TIME REFINEMENT ENGINE (Live Preview Generator)
    React.useEffect(() => {
        if (step === 'refine' && rawCapturedImage) {
            const generatePreview = async () => {
                setIsProcessingPreview(true);
                try {
                    if (mode === 'signature') {
                        const result = await processSignatureImage(
                            rawCapturedImage, 
                            inkSensitivity, 
                            strokeWeight, 
                            smoothing,
                            undefined, // No crop yet, let Cropper handle it
                            0, // Let Cropper handle rotation visually
                            true // skipAutoCrop for stable coords
                        );
                        setFilteredBaseImageUrl(result.dataUrl);
                    } else {
                        const result = await processPhotoImage(rawCapturedImage, brightness, contrast);
                        setFilteredBaseImageUrl(result.dataUrl);
                    }
                } catch (e) {
                    console.error("Preview generation failed", e);
                } finally {
                    setIsProcessingPreview(false);
                }
            };
            const debounceTimer = setTimeout(generatePreview, 100);
            return () => clearTimeout(debounceTimer);
        }
    }, [inkSensitivity, strokeWeight, smoothing, brightness, contrast, step, rawCapturedImage, mode]);

    const handleClear = () => {
        if (activeTab === 'draw' && sigPadRef.current) {
            sigPadRef.current.clear();
            setHasDrawn(false);
        }
        if (activeTab === 'type') setTypedInitials('');
        if (activeTab === 'upload') setUploadedImage(null);
        if (activeTab === 'scan') setRawCapturedImage(null);
    };

    const resetState = () => {
        setStep('input');
        setRawCapturedImage(null);
        setFilteredBaseImageUrl(null);
        setProcessedResult(null);
        setTypedInitials('');
        setUploadedImage(null);
        sigPadRef.current?.clear();
        setIsConsented(false);
        setHasDrawn(false);
        setInkSensitivity(150);
        setStrokeWeight(0);
        setSmoothing(0);
        setBrightness(0);
        setContrast(0);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
        setCroppedAreaPixels(null);
    };

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            resetState();
            onClose();
        }
    };
    
    const handleCapture = React.useCallback(async () => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setRawCapturedImage(imageSrc);
            setStep('refine');
        }
    }, [webcamRef]);

    const handleOnCropComplete = React.useCallback((_: Area, pixels: Area) => {
        setCroppedAreaPixels(pixels);
    }, []);

    const handleProceedToConfirm = async () => {
        if (activeTab === 'draw' && sigPadRef.current && !sigPadRef.current.isEmpty()) {
            setProcessedResult(sigPadRef.current.getTrimmedCanvas().toDataURL('image/png'));
            setStep('confirm');
        } else if (activeTab === 'type' && initialsCanvasRef.current && typedInitials) {
            const canvas = initialsCanvasRef.current;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = '135px "Mrs Saint Delafield"';
                ctx.fillStyle = 'black';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(typedInitials, canvas.width / 2, canvas.height / 2);
                setProcessedResult(canvas.toDataURL('image/png'));
                setStep('confirm');
            }
        } else if (rawCapturedImage) {
            // Final High-Fidelity Process with Crop and Rotation applied
            setIsProcessingPreview(true);
            try {
                if (mode === 'signature') {
                    const result = await processSignatureImage(
                        rawCapturedImage, 
                        inkSensitivity, 
                        strokeWeight, 
                        smoothing,
                        croppedAreaPixels || undefined,
                        rotation,
                        false // Auto-crop/tighten enabled for final result
                    );
                    setProcessedResult(result.dataUrl);
                } else {
                    const result = await processPhotoImage(rawCapturedImage, brightness, contrast);
                    setProcessedResult(result.dataUrl);
                }
                setStep('confirm');
            } catch (e) {
                toast({ variant: 'destructive', title: 'Processing Failed' });
            } finally {
                setIsProcessingPreview(false);
            }
        } else {
            toast({
                variant: 'destructive',
                title: 'Input Missing',
                description: 'Please provide a signature before proceeding.',
            });
        }
    };

    const handleFinalSave = () => {
        if (processedResult) {
            onSave(processedResult);
            resetState();
            onClose();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const src = event.target?.result as string;
                setRawCapturedImage(src);
                setUploadedImage(src);
                setStep('refine');
            };
            reader.readAsDataURL(file);
        }
    };

    const isInputProvided = 
        (activeTab === 'draw' && hasDrawn) ||
        (activeTab === 'type' && typedInitials.length > 0) ||
        (activeTab === 'upload' && uploadedImage !== null);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[95vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-[2.5rem] bg-card">
                <DialogHeader className="p-6 pb-2 shrink-0">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight text-center">
                        {mode === 'photo' ? 'Photo Identity' : 'Digital Signature'}
                    </DialogTitle>
                    <DialogDescription className="text-center text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                        {step === 'input' ? 'Choose input method' : step === 'refine' ? 'Refine & Frame' : 'Verify Result'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden relative">
                    <AnimatePresence mode="wait">
                        {step === 'input' ? (
                            <motion.div 
                                key="input" 
                                initial={{ opacity: 0, y: 10 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                exit={{ opacity: 0, y: -10 }}
                                className="h-full flex flex-col p-6 pt-0"
                            >
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                                    <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 h-10 rounded-xl mb-6 shadow-inner">
                                        <TabsTrigger value="scan" className="text-[9px] font-black uppercase tracking-tighter">Scan</TabsTrigger>
                                        <TabsTrigger value="draw" className="text-[9px] font-black uppercase tracking-tighter">Draw</TabsTrigger>
                                        <TabsTrigger value="type" className="text-[9px] font-black uppercase tracking-tighter">Type</TabsTrigger>
                                        <TabsTrigger value="upload" className="text-[9px] font-black uppercase tracking-tighter">Upload</TabsTrigger>
                                    </TabsList>

                                    <div className="flex-1 overflow-hidden relative">
                                        <TabsContent value="scan" className="m-0 h-full flex flex-col items-center">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 text-center">Point the Camera to Your Signature to Scan</p>
                                            <div className="w-full aspect-video relative rounded-2xl overflow-hidden bg-slate-900 border shadow-2xl group">
                                                <Webcam
                                                    audio={false}
                                                    ref={webcamRef}
                                                    screenshotFormat="image/png"
                                                    videoConstraints={{ aspectRatio: 1.7777777778, facingMode: "environment" }}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-12">
                                                    <div className="w-full h-full border-2 border-dashed border-white/20 rounded-xl relative">
                                                        <motion.div 
                                                            animate={{ top: ['10%', '90%', '10%'] }} 
                                                            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }} 
                                                            className="absolute left-0 right-0 h-0.5 bg-primary/50 shadow-[0_0_15px_rgba(59,95,255,0.8)]" 
                                                        />
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                                                    <button onClick={handleCapture} className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-2xl active:scale-95 transition-all group-hover:scale-105">
                                                        <div className="w-12 h-12 rounded-full border-2 border-slate-200 bg-primary flex items-center justify-center">
                                                            <Camera className="h-6 w-6 text-white" />
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="draw" className="m-0 h-full flex flex-col">
                                            <ScrollArea className="w-full h-[400px] border-2 border-dashed border-primary/20 rounded-2xl bg-white relative overflow-hidden shadow-inner">
                                                <SignatureCanvas 
                                                    ref={sigPadRef} 
                                                    penColor="black" 
                                                    canvasProps={{ className: 'w-full h-[900px] cursor-crosshair', willReadFrequently: true }} 
                                                    onBegin={() => setHasDrawn(true)} 
                                                />
                                            </ScrollArea>
                                            <p className="text-[8px] font-black uppercase text-center mt-3 text-muted-foreground tracking-[0.2em]">Draw directly inside the viewport</p>
                                        </TabsContent>

                                        <TabsContent value="type" className="m-0 h-full flex flex-col justify-center text-center">
                                            <Input 
                                                value={typedInitials} 
                                                onChange={(e) => setTypedInitials(e.target.value)} 
                                                className="text-5xl text-center font-signature h-auto py-16 border-none shadow-none focus-visible:ring-0 bg-transparent placeholder:opacity-10" 
                                                placeholder="Full Name" 
                                                autoFocus 
                                            />
                                            <canvas ref={initialsCanvasRef} width="1200" height="675" className="hidden" />
                                        </TabsContent>

                                        <TabsContent value="upload" className="m-0 h-full">
                                            <label htmlFor="sig-upload" className="w-full aspect-video border-2 border-dashed border-primary/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer bg-primary/[0.02] hover:bg-primary/5 transition-all group shadow-inner">
                                                <Upload className="h-10 w-10 text-primary mb-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Import Institutional Scan (.jpg, .png)</span>
                                                <Input id="sig-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/png, image/jpeg" />
                                            </label>
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </motion.div>
                        ) : step === 'refine' ? (
                            <motion.div 
                                key="refine" 
                                initial={{ opacity: 0, x: 10 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                className="h-full flex flex-col p-6 pt-0 space-y-6"
                            >
                                {/* INTERACTIVE REFINEMENT WORKSPACE */}
                                <div className="w-full aspect-video relative flex items-center justify-center gap-4 group">
                                    {/* Left: Zoom Controller */}
                                    <div className="hidden sm:flex flex-col items-center justify-center gap-2 h-full w-12 bg-muted/30 rounded-full border p-2 shadow-inner">
                                        <ZoomIn className="h-3 w-3 text-muted-foreground" />
                                        <div className="flex-1 w-1.5 bg-muted rounded-full relative overflow-hidden">
                                            <Slider 
                                                orientation="vertical" 
                                                value={[zoom]} 
                                                onValueChange={([v]) => setZoom(v)} 
                                                min={1} max={3} step={0.1}
                                                className="h-full"
                                            />
                                        </div>
                                        <span className="text-[8px] font-black">{zoom.toFixed(1)}x</span>
                                    </div>

                                    <div className="flex-1 relative aspect-video rounded-3xl overflow-hidden bg-white border-2 border-primary/20 shadow-2xl group ring-1 ring-black/5">
                                        <Cropper
                                            image={filteredBaseImageUrl || rawCapturedImage!}
                                            crop={crop}
                                            zoom={zoom}
                                            rotation={rotation}
                                            aspect={16 / 9}
                                            onCropChange={setCrop}
                                            onZoomChange={setZoom}
                                            onRotationChange={setRotation}
                                            onCropComplete={handleOnCropComplete}
                                            showGrid={true}
                                            style={{
                                                containerStyle: { borderRadius: '1.5rem' },
                                                cropAreaStyle: { border: '2px solid hsl(var(--primary))', boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)' }
                                            }}
                                        />
                                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-3">
                                            {isProcessingPreview && (
                                                <Badge className="bg-primary/80 backdrop-blur-md uppercase text-[8px] font-black tracking-widest animate-pulse">
                                                    <Loader2 className="h-2.5 w-2.5 mr-1.5 animate-spin" /> Live Processing...
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Rotation Controller */}
                                    <div className="hidden sm:flex flex-col items-center justify-center gap-2 h-full w-12 bg-muted/30 rounded-full border p-2 shadow-inner">
                                        <RotateCcw className="h-3 w-3 text-muted-foreground" />
                                        <div className="flex-1 w-1.5 bg-muted rounded-full relative overflow-hidden">
                                            <Slider 
                                                orientation="vertical" 
                                                value={[rotation]} 
                                                onValueChange={([v]) => setRotation(v)} 
                                                min={-180} max={180} step={1}
                                                className="h-full"
                                            />
                                        </div>
                                        <span className="text-[8px] font-black">{rotation}°</span>
                                    </div>
                                </div>

                                {/* STUDIO REFINEMENT CONTROLS */}
                                <div className="space-y-4 px-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <Label className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                                    <Sun className="h-3 w-3" /> Ink Density
                                                </Label>
                                                <span className="text-[9px] font-mono opacity-40">{inkSensitivity}</span>
                                            </div>
                                            <Slider value={[inkSensitivity]} onValueChange={([v]) => setInkSensitivity(v)} min={50} max={230} step={1} className="py-1" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <Label className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                                    <Wand2 className="h-3 w-3" /> Stroke Weight
                                                </Label>
                                                <span className="text-[9px] font-mono opacity-40">+{strokeWeight}px</span>
                                            </div>
                                            <Slider value={[strokeWeight]} onValueChange={([v]) => setStrokeWeight(v)} min={0} max={4} step={0.5} className="py-1" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <Label className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                                    <Sparkles className="h-3 w-3" /> Smoothing
                                                </Label>
                                                <span className="text-[9px] font-mono opacity-40">{smoothing}x</span>
                                            </div>
                                            <Slider value={[smoothing]} onValueChange={([v]) => setSmoothing(v)} min={0} max={5} step={1} className="py-1" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="confirm" 
                                initial={{ opacity: 0, scale: 0.95 }} 
                                animate={{ opacity: 1, scale: 1 }} 
                                className="p-8 text-center space-y-8 h-full flex flex-col justify-center bg-slate-50"
                            >
                                <div className="p-12 bg-white border-2 border-dashed border-border rounded-[3rem] shadow-2xl relative flex items-center justify-center min-h-[350px] group overflow-hidden">
                                    {processedResult ? (
                                        <div className="relative w-full h-full flex items-center justify-center p-4">
                                            <img 
                                                src={processedResult} 
                                                alt="Final Processed Identity" 
                                                className="max-w-[70%] max-h-[70%] object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.2)] transition-transform duration-700 hover:scale-110" 
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Normalizing Asset...</p>
                                        </div>
                                    )}
                                    <div className="absolute top-4 left-4">
                                        <Badge variant="outline" className="bg-white/80 backdrop-blur-md text-[8px] font-black uppercase tracking-widest border-primary/20 text-primary">Final Audit View</Badge>
                                    </div>
                                </div>
                                <div className="flex items-center justify-center gap-4 pt-4">
                                    <div className={cn(
                                        "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer shadow-sm",
                                        isConsented ? "bg-emerald-50 border-emerald-500 shadow-emerald-500/10 scale-105" : "bg-white border-slate-200"
                                    )} onClick={() => setIsConsented(!isConsented)}>
                                        <Switch checked={isConsented} onCheckedChange={setIsConsented} />
                                        <Label className="text-sm font-black uppercase tracking-tight cursor-pointer">Verify Signature Identity</Label>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex flex-col sm:flex-row gap-3">
                    {step === 'input' ? (
                        <>
                            {(activeTab === 'draw' || activeTab === 'type') && <Button variant="ghost" size="sm" onClick={handleClear} className="font-bold text-[10px] uppercase h-10 px-4"><Eraser className="h-3 w-3 mr-1.5" /> Clear</Button>}
                            <div className="flex-1" />
                            <Button variant="ghost" onClick={onClose} className="font-bold h-10 px-8 rounded-xl">Discard</Button>
                            <Button onClick={handleProceedToConfirm} disabled={!isInputProvided} className="rounded-xl font-black h-10 px-10 shadow-lg uppercase text-[10px] tracking-widest transition-all active:scale-95">Continue</Button>
                        </>
                    ) : step === 'refine' ? (
                        <>
                            <Button variant="ghost" onClick={() => setStep('input')} className="font-bold h-10 px-8 rounded-xl gap-2"><ArrowLeft className="h-3 w-3" /> Start Over</Button>
                            <div className="flex-1" />
                            <Button onClick={handleProceedToConfirm} disabled={isProcessingPreview} className="rounded-xl font-black h-10 px-10 shadow-lg bg-primary text-white uppercase text-[10px] tracking-widest transition-all active:scale-95">
                                {isProcessingPreview ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                Process Final
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setStep('refine')} className="font-bold h-10 px-8 rounded-xl gap-2"><ArrowLeft className="h-3 w-3" /> Adjust Frame</Button>
                            <div className="flex-1" />
                            <Button onClick={handleFinalSave} disabled={!isConsented || !processedResult} className="rounded-xl font-black h-12 px-12 shadow-xl bg-emerald-600 hover:bg-emerald-700 text-white uppercase tracking-widest text-[10px] gap-3 active:scale-95 transition-all">
                                <ShieldCheck className="h-5 w-5" /> Execute Signature
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
