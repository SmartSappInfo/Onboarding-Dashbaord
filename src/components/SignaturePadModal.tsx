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
import { Upload, Camera, Eraser, Scan, Check, RefreshCw, Sparkles, Wand2, Info, ShieldCheck, ArrowLeft, ArrowRight, Type, Pipette, Sun, Contrast, Loader2, X } from 'lucide-react';
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
                toast({ variant: 'destructive', title: 'Processing Error' });
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
            title: 'Camera Error',
            description: 'Please check your permissions.',
        });
    };

    const showClearButton = activeTab === 'draw' || activeTab === 'type';

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-[1.5rem]">
                <DialogHeader className="p-6 pb-2 shrink-0">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight text-center">
                        {mode === 'photo' ? 'Photo Identity' : 'Digital Signature'}
                    </DialogTitle>
                    <DialogDescription className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {step === 'input' ? 'Choose input method' : step === 'refine' ? 'Refine Quality' : 'Verify'}
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
                                    <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 h-10 rounded-xl mb-6">
                                        <TabsTrigger value="scan" className="text-[9px] font-black uppercase tracking-tighter">Scan</TabsTrigger>
                                        <TabsTrigger value="draw" className="text-[9px] font-black uppercase tracking-tighter">Draw</TabsTrigger>
                                        <TabsTrigger value="type" className="text-[9px] font-black uppercase tracking-tighter">Type</TabsTrigger>
                                        <TabsTrigger value="upload" className="text-[9px] font-black uppercase tracking-tighter">Upload</TabsTrigger>
                                    </TabsList>

                                    <div className="flex-1 overflow-hidden relative">
                                        <TabsContent value="scan" className="m-0 h-full flex flex-col items-center">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 text-center">Point the Camera to Your Signature to Scan</p>
                                            <div className="w-full aspect-video relative rounded-2xl overflow-hidden bg-slate-900 border shadow-inner">
                                                <Webcam
                                                    audio={false}
                                                    ref={webcamRef}
                                                    screenshotFormat="image/png"
                                                    onUserMedia={onUserMedia}
                                                    onUserMediaError={onUserMediaError}
                                                    videoConstraints={{ aspectRatio: 1.7777777778, facingMode: "environment" }}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8">
                                                    <div className="w-full h-full border-2 border-dashed border-white/20 rounded-xl relative">
                                                        <motion.div 
                                                            animate={{ top: ['10%', '90%', '10%'] }} 
                                                            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }} 
                                                            className="absolute left-0 right-0 h-0.5 bg-primary/50 shadow-[0_0_10px_rgba(59,95,255,0.8)]" 
                                                        />
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                                                    <button onClick={handleCapture} className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-2xl active:scale-95 transition-all">
                                                        <div className="w-10 h-10 rounded-full border-2 border-slate-200 bg-primary flex items-center justify-center">
                                                            <Camera className="h-5 w-5 text-white" />
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="draw" className="m-0 h-full flex flex-col">
                                            <div className="w-full aspect-video border-2 border-dashed border-primary/20 rounded-2xl bg-white relative overflow-hidden shadow-inner">
                                                <SignatureCanvas 
                                                    ref={sigPadRef} 
                                                    penColor="black" 
                                                    canvasProps={{ className: 'w-full h-full cursor-crosshair', willReadFrequently: true }} 
                                                    onBegin={() => setHasDrawn(true)} 
                                                />
                                            </div>
                                            <p className="text-[8px] font-black uppercase text-center mt-3 text-muted-foreground tracking-widest">Draw directly inside the field</p>
                                        </TabsContent>

                                        <TabsContent value="type" className="m-0 h-full flex flex-col justify-center">
                                            <Input 
                                                value={typedInitials} 
                                                onChange={(e) => setTypedInitials(e.target.value)} 
                                                className="text-5xl text-center font-signature h-auto py-12 border-none shadow-none focus-visible:ring-0 bg-transparent placeholder:opacity-10" 
                                                placeholder="Full Name" 
                                                autoFocus 
                                            />
                                            <canvas ref={initialsCanvasRef} width="1200" height="675" className="hidden" />
                                        </TabsContent>

                                        <TabsContent value="upload" className="m-0 h-full">
                                            {!uploadedImage ? (
                                                <label htmlFor="sig-upload" className="w-full aspect-video border-2 border-dashed border-primary/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer bg-primary/[0.02] hover:bg-primary/5 transition-all group">
                                                    <Upload className="h-8 w-8 text-primary mb-2 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Select Image File</span>
                                                    <Input id="sig-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/png, image/jpeg" />
                                                </label>
                                            ) : (
                                                <div className="w-full aspect-video relative rounded-2xl overflow-hidden border bg-muted shadow-inner flex items-center justify-center">
                                                    <Image src={uploadedImage} alt="Preview" fill className="object-contain p-4" />
                                                    <Button variant="secondary" size="sm" onClick={() => setUploadedImage(null)} className="absolute bottom-3 right-3 rounded-lg font-bold text-[9px] uppercase"><RefreshCw className="h-3 w-3 mr-1" /> Change</Button>
                                                </div>
                                            )}
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </motion.div>
                        ) : step === 'refine' ? (
                            <motion.div 
                                key="refine" 
                                initial={{ opacity: 0, x: 10 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                className="h-full flex flex-col p-6 space-y-6"
                            >
                                <div className="w-full aspect-video relative rounded-2xl overflow-hidden border bg-muted shadow-inner flex items-center justify-center">
                                    {isProcessing ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40" />
                                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">Normalizing...</p>
                                        </div>
                                    ) : processedResult ? (
                                        <Image src={processedResult} alt="Isolated" width={400} height={225} className="object-contain drop-shadow-xl" />
                                    ) : null}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border shadow-inner">
                                    {mode === 'signature' ? (
                                        <>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-primary tracking-tighter">Density</Label>
                                                <Slider value={[inkSensitivity]} onValueChange={([v]) => setInkSensitivity(v)} min={50} max={230} step={1} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-primary tracking-tighter">Weight</Label>
                                                <Slider value={[strokeWeight]} onValueChange={([v]) => setStrokeWeight(v)} min={0} max={4} step={0.5} />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-primary tracking-tighter">Brightness</Label>
                                                <Slider value={[brightness]} onValueChange={([v]) => setBrightness(v)} min={-50} max={50} step={1} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-primary tracking-tighter">Contrast</Label>
                                                <Slider value={[contrast]} onValueChange={([v]) => setContrast(v)} min={-50} max={50} step={1} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="confirm" 
                                initial={{ opacity: 0, scale: 0.95 }} 
                                animate={{ opacity: 1, scale: 1 }} 
                                className="p-6 text-center space-y-8 h-full flex flex-col justify-center"
                            >
                                <div className="p-8 bg-white border border-dashed rounded-2xl shadow-inner relative flex items-center justify-center min-h-[200px]">
                                    {processedResult && <Image src={processedResult} alt="Final" width={300} height={150} className="object-contain drop-shadow-xl" />}
                                </div>
                                <div className="flex items-center justify-center gap-3 pt-4">
                                    <Switch id="con-toggle" checked={isConsented} onCheckedChange={setIsConsented} />
                                    <Label htmlFor="con-toggle" className="text-sm font-black uppercase tracking-tight cursor-pointer">Verify Legal Signature</Label>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex flex-col sm:flex-row gap-3">
                    {step === 'input' ? (
                        <>
                            {showClearButton && <Button variant="ghost" size="sm" onClick={handleClear} className="font-bold text-[10px] uppercase h-10 px-4"><Eraser className="h-3 w-3 mr-1.5" /> Clear</Button>}
                            <div className="flex-1" />
                            <Button variant="ghost" onClick={onClose} className="font-bold h-10 px-6">Discard</Button>
                            <Button onClick={handleProceedToConfirm} disabled={!isInputProvided && activeTab !== 'scan'} className="rounded-xl font-black h-10 px-8 shadow-lg uppercase text-[10px] tracking-widest">Continue</Button>
                        </>
                    ) : step === 'refine' ? (
                        <>
                            <Button variant="ghost" onClick={() => setStep('input')} className="font-bold h-10 px-6 gap-2"><ArrowLeft className="h-3 w-3" /> Back</Button>
                            <div className="flex-1" />
                            <Button onClick={() => setStep('confirm')} disabled={!processedResult} className="rounded-xl font-black h-10 px-8 shadow-lg bg-primary text-white uppercase text-[10px] tracking-widest">Review</Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setStep('refine')} className="font-bold h-10 px-6 gap-2"><ArrowLeft className="h-3 w-3" /> Adjust</Button>
                            <div className="flex-1" />
                            <Button onClick={handleFinalSave} disabled={!isConsented || !processedResult} className="rounded-xl font-black h-12 px-12 shadow-xl bg-primary text-white uppercase tracking-widest text-xs gap-3 active:scale-95 transition-all"><ShieldCheck className="h-5 w-5" /> Confirm & Apply</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
