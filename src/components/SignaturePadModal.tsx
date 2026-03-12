'use client';

import * as React from 'react';
import SignatureCanvas from 'react-signature-canvas';
import Webcam from 'react-webcam';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Upload, Camera, Eraser, Scan, Check, RefreshCw, Sparkles, Wand2, Info, ShieldCheck, ArrowLeft, ArrowRight, Type, Pipette, Sun, Contrast, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { processSignatureImage, processPhotoImage } from '@/lib/signature-processing';
import { Badge } from '@/components/ui/badge';

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
    const [brightness, setBrightness] = React.useState(0);
    const [contrast, setContrast] = React.useState(0);
    const [isProcessing, setIsProcessing] = React.useState(false);

    // Camera states
    const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);

    React.useEffect(() => {
        if (open) {
            setStep('input');
            setActiveTab('scan');
        }
    }, [open]);

    // REAL-TIME REFINEMENT ENGINE
    React.useEffect(() => {
        if (step === 'refine' && rawCapturedImage) {
            const refine = async () => {
                try {
                    if (mode === 'signature') {
                        const result = await processSignatureImage(rawCapturedImage, inkSensitivity, strokeWeight);
                        setProcessedResult(result.dataUrl);
                    } else {
                        const result = await processPhotoImage(rawCapturedImage, brightness, contrast);
                        setProcessedResult(result.dataUrl);
                    }
                } catch (e) {
                    console.error("Refinement failed", e);
                }
            };
            const debounceTimer = setTimeout(refine, 100);
            return () => clearTimeout(debounceTimer);
        }
    }, [inkSensitivity, strokeWeight, brightness, contrast, step, rawCapturedImage, mode]);

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
        setProcessedResult(null);
        setTypedInitials('');
        setUploadedImage(null);
        sigPadRef.current?.clear();
        setIsConsented(false);
        setHasDrawn(false);
        setInkSensitivity(150);
        setStrokeWeight(0);
        setBrightness(0);
        setContrast(0);
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
            setIsProcessing(true);
            setStep('refine');
            
            try {
                if (mode === 'signature') {
                    const result = await processSignatureImage(imageSrc, inkSensitivity, strokeWeight);
                    setProcessedResult(result.dataUrl);
                } else {
                    const result = await processPhotoImage(imageSrc, brightness, contrast);
                    setProcessedResult(result.dataUrl);
                }
            } catch (e) {
                toast({ variant: 'destructive', title: 'Processing Error', description: 'Could not isolate capture.' });
            } finally {
                setIsProcessing(false);
            }
        }
    }, [webcamRef, inkSensitivity, strokeWeight, brightness, contrast, mode, toast]);

    const handleProceedToConfirm = () => {
        let dataUrl: string | null = null;

        if (activeTab === 'draw' && sigPadRef.current && !sigPadRef.current.isEmpty()) {
            dataUrl = sigPadRef.current.getTrimmedCanvas().toDataURL('image/png');
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
                dataUrl = canvas.toDataURL('image/png');
            }
        } else if (activeTab === 'upload' && uploadedImage) {
            dataUrl = uploadedImage;
        } else if (activeTab === 'scan' && processedResult) {
            dataUrl = processedResult;
        }

        if (dataUrl) {
            setProcessedResult(dataUrl);
            setStep('confirm');
        } else {
            toast({
                variant: 'destructive',
                title: 'No Input Detected',
                description: 'Please provide an image or capture a scan before proceeding.',
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
            reader.onload = (event) => setUploadedImage(event.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const isInputProvided = 
        (activeTab === 'draw' && hasDrawn) ||
        (activeTab === 'type' && typedInitials.length > 0) ||
        (activeTab === 'upload' && uploadedImage !== null);

    const onUserMedia = () => setHasCameraPermission(true);
    const onUserMediaError = () => {
        setHasCameraPermission(false);
        toast({
            variant: 'destructive',
            title: 'Camera Access Required',
            description: 'Please enable camera permissions to use the scan feature.',
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-[2rem]">
                <DialogHeader className="p-6 pb-2 shrink-0">
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight text-center">
                        {mode === 'photo' ? 'Document/Identity Capture' : 'Institutional Signature'}
                    </DialogTitle>
                    <DialogDescription className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {step === 'input' ? 'Select identity protocol' : 
                         step === 'refine' ? `Fine-tune ${mode} fidelity` :
                         'Verify and authorize'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden relative">
                    <AnimatePresence mode="wait">
                        {step === 'input' ? (
                            <motion.div 
                                key="input" 
                                initial={{ opacity: 0, x: 20 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                exit={{ opacity: 0, x: -20 }}
                                className="h-full flex flex-col p-6 pt-2"
                            >
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                                    <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-xl mb-6 shadow-inner">
                                        <TabsTrigger value="scan" className="gap-2 font-black uppercase text-[10px] tracking-widest transition-all"><Scan className="h-3 w-3" /> Scan</TabsTrigger>
                                        <TabsTrigger value="draw" className="gap-2 font-black uppercase text-[10px] tracking-widest transition-all"><Eraser className="h-3 w-3" /> Draw</TabsTrigger>
                                        <TabsTrigger value="type" className="gap-2 font-black uppercase text-[10px] tracking-widest transition-all"><Type className="h-3 w-3" /> Type</TabsTrigger>
                                        <TabsTrigger value="upload" className="gap-2 font-black uppercase text-[10px] tracking-widest transition-all"><Upload className="h-3 w-3" /> Upload</TabsTrigger>
                                    </TabsList>

                                    <div className="flex-1 overflow-hidden relative min-h-[300px]">
                                        <TabsContent value="scan" className="m-0 h-full flex flex-col items-center justify-center relative">
                                            <div className="w-full h-full relative group rounded-[2rem] overflow-hidden bg-slate-900 border-2 border-white/5 shadow-2xl">
                                                <Webcam
                                                    audio={false}
                                                    ref={webcamRef}
                                                    screenshotFormat="image/png"
                                                    onUserMedia={onUserMedia}
                                                    onUserMediaError={onUserMediaError}
                                                    videoConstraints={{ facingMode: "environment" }}
                                                    className="w-full h-full object-cover"
                                                />
                                                
                                                <div className="absolute inset-0 pointer-events-none">
                                                    <div className="absolute inset-0 bg-black/40" style={{ clipPath: 'polygon(0% 0%, 0% 100%, 15% 100%, 15% 25%, 85% 25%, 85% 75%, 15% 75%, 15% 100%, 100% 100%, 100% 0%)' }} />
                                                    <div className="absolute top-[25%] left-[15%] w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl shadow-[0_0_15px_rgba(59,95,255,0.5)]" />
                                                    <div className="absolute top-[25%] right-[15%] w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl shadow-[0_0_15px_rgba(59,95,255,0.5)]" />
                                                    <div className="absolute bottom-[25%] left-[15%] w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl shadow-[0_0_15px_rgba(59,95,255,0.5)]" />
                                                    <div className="absolute bottom-[25%] right-[15%] w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl shadow-[0_0_15px_rgba(59,95,255,0.5)]" />
                                                    <motion.div animate={{ top: ['25%', '75%', '25%'] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="absolute left-[15%] right-[15%] h-0.5 bg-primary/50 shadow-[0_0_10px_rgba(59,95,255,0.8)] z-10" />
                                                </div>

                                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
                                                    <button onClick={handleCapture} className="w-16 h-16 rounded-full bg-white border-4 border-primary/20 flex items-center justify-center group active:scale-95 transition-all shadow-2xl">
                                                        <div className="w-12 h-12 rounded-full border-2 border-slate-200 bg-primary group-hover:scale-90 transition-transform shadow-inner flex items-center justify-center">
                                                            <Camera className="h-6 w-6 text-white" />
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="draw" className="m-0 h-full">
                                            <div className="space-y-4 h-full flex flex-col">
                                                <Label className="block text-center text-muted-foreground uppercase text-[9px] font-black tracking-[0.2em]">Manual Ink Entry</Label>
                                                <div className="flex-1 border-2 border-dashed border-primary/20 rounded-2xl bg-white relative overflow-hidden shadow-inner">
                                                    <SignatureCanvas ref={sigPadRef} penColor="black" canvasProps={{ className: 'w-full h-full cursor-crosshair', willreadfrequently: "true" }} onBegin={() => setHasDrawn(true)} />
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="type" className="m-0 h-full flex flex-col justify-center gap-6">
                                            <div className="space-y-4">
                                                <Label className="block text-center text-muted-foreground uppercase text-[9px] font-black tracking-[0.2em]">Synthetic Protocol</Label>
                                                <Input value={typedInitials} onChange={(e) => setTypedInitials(e.target.value)} className="text-4xl sm:text-7xl text-center font-signature h-auto py-12 border-none shadow-none focus-visible:ring-0 bg-transparent placeholder:opacity-10 font-bold" placeholder="Jane Doe" autoFocus />
                                                <canvas ref={initialsCanvasRef} width="1200" height="450" className="hidden" />
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="upload" className="m-0 h-full">
                                            <div className="h-full flex flex-col">
                                                {!uploadedImage ? (
                                                    <label htmlFor="signature-upload" className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-2xl cursor-pointer bg-primary/[0.02] hover:bg-primary/5 p-8 text-center transition-all duration-500 group">
                                                        <div className="p-4 bg-white rounded-2xl shadow-xl mb-4 group-hover:scale-110 transition-transform shadow-primary/5"><Upload className="w-8 h-8 text-primary" /></div>
                                                        <p className="text-sm font-black uppercase tracking-tight">Institutional Upload</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase mt-1 font-bold">PDF, PNG or JPG supported</p>
                                                        <Input id="signature-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/png, image/jpeg" />
                                                    </label>
                                                ) : (
                                                    <div className="flex-1 relative rounded-2xl overflow-hidden border-2 border-primary/20 bg-muted shadow-inner p-4 flex items-center justify-center">
                                                        <Image src={uploadedImage} alt="Preview" fill className="object-contain p-4" />
                                                        <Button variant="secondary" size="sm" onClick={() => setUploadedImage(null)} className="absolute bottom-4 right-4 rounded-xl font-bold gap-2 shadow-lg"><RefreshCw className="h-4 w-4" /> Change File</Button>
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </motion.div>
                        ) : step === 'refine' ? (
                            <motion.div 
                                key="refine" 
                                initial={{ opacity: 0, x: 20 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                exit={{ opacity: 0, x: -20 }}
                                className="h-full flex flex-col p-8 space-y-8"
                            >
                                <div className={cn(
                                    "flex-1 relative rounded-[2.5rem] overflow-hidden border-2 border-primary/20 bg-muted shadow-inner flex items-center justify-center",
                                    mode === 'signature' && "pattern-checkerboard"
                                )}>
                                    {isProcessing ? (
                                        <div className="flex flex-col items-center gap-4">
                                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">Analyzing Architecture...</p>
                                        </div>
                                    ) : processedResult ? (
                                        <div className="relative w-full h-full p-8 flex items-center justify-center">
                                            <Image src={processedResult} alt="Isolated" width={mode === 'signature' ? 400 : 600} height={300} className="object-contain drop-shadow-2xl" />
                                            {mode === 'signature' && <div className="absolute top-4 right-4 bg-primary text-white p-1 rounded-full animate-in zoom-in shadow-xl"><Check className="h-3 w-3" /></div>}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-muted/20 p-6 rounded-[2rem] border shadow-inner">
                                    {mode === 'signature' ? (
                                        <>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-1">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                        <Pipette className="h-3 w-3" /> Ink Density
                                                    </Label>
                                                    <Badge variant="outline" className="font-black tabular-nums h-5 bg-white text-[10px]">{inkSensitivity}</Badge>
                                                </div>
                                                <Slider value={[inkSensitivity]} onValueChange={([val]) => setInkSensitivity(val)} min={50} max={230} step={1} className="py-2" />
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-1">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                        <Wand2 className="h-3 w-3" /> Stroke Weight
                                                    </Label>
                                                    <Badge variant="outline" className="font-black tabular-nums h-5 bg-white text-[10px]">{strokeWeight}</Badge>
                                                </div>
                                                <Slider value={[strokeWeight]} onValueChange={([val]) => setStrokeWeight(val)} min={0} max={4} step={0.5} className="py-2" />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-1">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                        <Sun className="h-3 w-3" /> Brightness
                                                    </Label>
                                                    <Badge variant="outline" className="font-black tabular-nums h-5 bg-white text-[10px]">{brightness > 0 ? `+${brightness}` : brightness}</Badge>
                                                </div>
                                                <Slider value={[brightness]} onValueChange={([val]) => setBrightness(val)} min={-50} max={50} step={1} className="py-2" />
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-1">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                        <Contrast className="h-3 w-3" /> Contrast
                                                    </Label>
                                                    <Badge variant="outline" className="font-black tabular-nums h-5 bg-white text-[10px]">{contrast > 0 ? `+${contrast}` : contrast}</Badge>
                                                </div>
                                                <Slider value={[contrast]} onValueChange={([val]) => setContrast(val)} min={-50} max={50} step={1} className="py-2" />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="confirm" 
                                initial={{ opacity: 0, x: 20 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                exit={{ opacity: 0, x: -20 }}
                                className="p-8 space-y-10 text-center h-full flex flex-col justify-center"
                            >
                                <div className={cn(
                                    "p-8 bg-slate-50 border-2 border-dashed rounded-[3rem] shadow-inner relative flex items-center justify-center min-h-[200px]",
                                    mode === 'signature' && "pattern-checkerboard"
                                )}>
                                    {processedResult && <Image src={processedResult} alt="Verification" width={400} height={200} className="object-contain drop-shadow-2xl" />}
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="p-6 rounded-[2rem] bg-blue-50 border border-blue-100 flex items-start gap-4 text-left shadow-sm">
                                        <div className="p-2 bg-white rounded-xl text-blue-600 shadow-sm border border-blue-100 shrink-0"><Info className="h-5 w-5" /></div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-blue-900 uppercase tracking-tight">Legal Consent Disclosure</p>
                                            <p className="text-[10px] font-bold text-blue-800/70 leading-relaxed uppercase tracking-widest">
                                                By executing this command, you acknowledge that this electronic identity profile is legally binding and will be permanently associated with this institutional record.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-center gap-3 pt-2">
                                        <Switch id="consent-toggle" checked={isConsented} onCheckedChange={setIsConsented} className="scale-125" />
                                        <Label htmlFor="consent-toggle" className="text-base font-black uppercase tracking-tight cursor-pointer px-2">Verify & Commit Identity</Label>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex flex-col sm:flex-row gap-3">
                    {step === 'input' ? (
                        <>
                            <Button variant="ghost" onClick={handleClear} className="font-bold rounded-xl h-12 px-6 gap-2"><Eraser className="h-4 w-4" /> Reset</Button>
                            <div className="flex-1" />
                            <Button variant="ghost" onClick={onClose} className="font-bold rounded-xl h-12 px-8">Discard</Button>
                            <Button onClick={handleProceedToConfirm} disabled={!isInputProvided} className="rounded-xl font-black px-12 h-12 shadow-xl uppercase tracking-widest text-xs active:scale-95 transition-all">Resolve & Continue</Button>
                        </>
                    ) : step === 'refine' ? (
                        <>
                            <Button variant="ghost" onClick={() => setStep('input')} className="font-bold rounded-xl h-12 px-8 gap-2 hover:bg-white"><ArrowLeft className="h-4 w-4" /> Recapture</Button>
                            <div className="flex-1" />
                            <Button onClick={() => setStep('confirm')} disabled={!processedResult} className="rounded-xl font-black px-12 h-12 shadow-xl bg-primary text-white uppercase tracking-widest text-xs gap-3 active:scale-95 transition-all">Audit Result <ArrowRight className="h-4 w-4" /></Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setStep('refine')} className="font-bold rounded-xl h-12 px-8 gap-2 hover:bg-white"><ArrowLeft className="h-4 w-4" /> Adjust Fidelity</Button>
                            <div className="flex-1" />
                            <Button onClick={handleFinalSave} disabled={!isConsented || !processedResult} className="rounded-[1.5rem] font-black h-14 px-16 shadow-2xl bg-primary text-white uppercase tracking-widest text-sm transition-all active:scale-95 gap-3"><ShieldCheck className="h-5 w-5" /> Execute Secure Save</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
