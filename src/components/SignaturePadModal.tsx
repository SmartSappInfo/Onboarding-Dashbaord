
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
import { Upload, Camera, Eraser, Scan, Check, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SignaturePadModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
    mode?: 'signature' | 'photo';
}

export default function SignaturePadModal({ open, onClose, onSave, mode = 'signature' }: SignaturePadModalProps) {
    const { toast } = useToast();
    const [step, setStep] = React.useState<'input' | 'confirm'>('input');
    const [signatureData, setSignatureData] = React.useState<string | null>(null);

    const sigPadRef = React.useRef<SignatureCanvas | null>(null);
    const initialsCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const webcamRef = React.useRef<Webcam>(null);
    
    const [activeTab, setActiveTab] = React.useState('scan');
    const [typedInitials, setTypedInitials] = React.useState('');
    const [uploadedImage, setUploadedImage] = React.useState<string | null>(null);
    const [isConsented, setIsConsented] = React.useState(false);
    const [hasDrawn, setHasDrawn] = React.useState(false);

    // Camera states
    const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
    const [capturedImage, setCapturedImage] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (open) {
            setStep('input');
            setActiveTab('scan');
        }
    }, [open]);

    const handleClear = () => {
        if (activeTab === 'draw' && sigPadRef.current) {
            sigPadRef.current.clear();
            setHasDrawn(false);
        }
        if (activeTab === 'type') setTypedInitials('');
        if (activeTab === 'upload') setUploadedImage(null);
        if (activeTab === 'scan') setCapturedImage(null);
    };

    const resetState = () => {
        setStep('input');
        setSignatureData(null);
        setTypedInitials('');
        setUploadedImage(null);
        setCapturedImage(null);
        sigPadRef.current?.clear();
        setIsConsented(false);
        setHasDrawn(false);
    };

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            resetState();
            onClose();
        }
    };
    
    const handleCapture = React.useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setCapturedImage(imageSrc);
        }
    }, [webcamRef]);

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
        } else if (activeTab === 'scan' && capturedImage) {
            dataUrl = capturedImage;
        }

        if (dataUrl) {
            setSignatureData(dataUrl);
            setStep('confirm');
        } else {
            toast({
                variant: 'destructive',
                title: 'No Input Detected',
                description: 'Please provide a signature or capture a scan before proceeding.',
            });
        }
    };

    const handleFinalSign = () => {
        if (signatureData) {
            onSave(signatureData);
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
        (activeTab === 'upload' && uploadedImage !== null) ||
        (activeTab === 'scan' && capturedImage !== null);

    const onUserMedia = () => {
        setHasCameraPermission(true);
    };

    const onUserMediaError = () => {
        setHasCameraPermission(false);
        toast({
            variant: 'destructive',
            title: 'Camera Access Required',
            description: 'Please enable camera permissions to scan your signature.',
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-[2rem]">
                <DialogHeader className="p-6 pb-2 shrink-0">
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight text-center">
                        {mode === 'photo' ? 'Capture Identity' : 'Provide Signature'}
                    </DialogTitle>
                    <DialogDescription className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {step === 'input' ? 'Choose your preferred identity method' : 'Verify and provide legal consent'}
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
                                    <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-xl mb-6">
                                        <TabsTrigger value="scan" className="gap-2 font-black uppercase text-[10px] tracking-widest"><Scan className="h-3 w-3" /> Scan</TabsTrigger>
                                        <TabsTrigger value="draw" className="gap-2 font-black uppercase text-[10px] tracking-widest"><Eraser className="h-3 w-3" /> Draw</TabsTrigger>
                                        <TabsTrigger value="type" className="gap-2 font-black uppercase text-[10px] tracking-widest"><Check className="h-3 w-3" /> Type</TabsTrigger>
                                        <TabsTrigger value="upload" className="gap-2 font-black uppercase text-[10px] tracking-widest"><Upload className="h-3 w-3" /> Upload</TabsTrigger>
                                    </TabsList>

                                    <div className="flex-1 overflow-hidden relative min-h-[300px]">
                                        <TabsContent value="scan" className="m-0 h-full flex flex-col items-center justify-center relative">
                                            {capturedImage ? (
                                                <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-primary/20 bg-muted shadow-inner">
                                                    <Image src={capturedImage} alt="Captured" fill className="object-contain p-4" />
                                                    <Button 
                                                        variant="secondary" 
                                                        size="sm" 
                                                        onClick={() => setCapturedImage(null)}
                                                        className="absolute bottom-4 right-4 rounded-xl font-bold gap-2 shadow-lg"
                                                    >
                                                        <RefreshCw className="h-4 w-4" /> Retake
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="w-full h-full relative group rounded-2xl overflow-hidden bg-slate-900 border-2 border-white/5 shadow-2xl">
                                                    <Webcam
                                                        audio={false}
                                                        ref={webcamRef}
                                                        screenshotFormat="image/png"
                                                        onUserMedia={onUserMedia}
                                                        onUserMediaError={onUserMediaError}
                                                        videoConstraints={{ facingMode: "environment" }}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    
                                                    {/* Scanning Frame Overlay */}
                                                    <div className="absolute inset-0 pointer-events-none">
                                                        <div className="absolute inset-0 bg-black/40" style={{ clipPath: 'polygon(0% 0%, 0% 100%, 15% 100%, 15% 25%, 85% 25%, 85% 75%, 15% 75%, 15% 100%, 100% 100%, 100% 0%)' }} />
                                                        
                                                        {/* Corners */}
                                                        <div className="absolute top-[25%] left-[15%] w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl shadow-[0_0_15px_rgba(59,95,255,0.5)]" />
                                                        <div className="absolute top-[25%] right-[15%] w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl shadow-[0_0_15px_rgba(59,95,255,0.5)]" />
                                                        <div className="absolute bottom-[25%] left-[15%] w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl shadow-[0_0_15px_rgba(59,95,255,0.5)]" />
                                                        <div className="absolute bottom-[25%] right-[15%] w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl shadow-[0_0_15px_rgba(59,95,255,0.5)]" />
                                                        
                                                        {/* Scanning Line Animation */}
                                                        <motion.div 
                                                            animate={{ top: ['25%', '75%', '25%'] }}
                                                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                                            className="absolute left-[15%] right-[15%] h-0.5 bg-primary/50 shadow-[0_0_10px_rgba(59,95,255,0.8)] z-10"
                                                        />
                                                    </div>

                                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
                                                        <button 
                                                            onClick={handleCapture}
                                                            className="w-16 h-16 rounded-full bg-white border-4 border-primary/20 flex items-center justify-center group active:scale-95 transition-all shadow-2xl"
                                                        >
                                                            <div className="w-12 h-12 rounded-full border-2 border-slate-200 bg-primary group-hover:scale-90 transition-transform shadow-inner flex items-center justify-center">
                                                                <Camera className="h-6 w-6 text-white" />
                                                            </div>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="draw" className="m-0 h-full">
                                            <div className="space-y-4 h-full flex flex-col">
                                                <Label className="block text-center text-muted-foreground uppercase text-[9px] font-black tracking-[0.2em]">Sign within the blueprint area</Label>
                                                <div className="flex-1 border-2 border-dashed border-primary/20 rounded-2xl bg-white relative overflow-hidden shadow-inner">
                                                    <SignatureCanvas
                                                        ref={sigPadRef}
                                                        penColor="black"
                                                        canvasProps={{
                                                            className: 'w-full h-full cursor-crosshair',
                                                            willreadfrequently: "true"
                                                        }}
                                                        onBegin={() => setHasDrawn(true)}
                                                    />
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="type" className="m-0 h-full flex flex-col justify-center gap-6">
                                            <div className="space-y-4">
                                                <Label className="block text-center text-muted-foreground uppercase text-[9px] font-black tracking-[0.2em]">Type your full legal name</Label>
                                                <Input 
                                                    value={typedInitials} 
                                                    onChange={(e) => setTypedInitials(e.target.value)} 
                                                    className="text-4xl sm:text-7xl text-center font-signature h-auto py-12 border-none shadow-none focus-visible:ring-0 bg-transparent placeholder:opacity-10" 
                                                    placeholder="Jane Doe" 
                                                    autoFocus
                                                />
                                                <canvas ref={initialsCanvasRef} width="1200" height="450" className="hidden" />
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="upload" className="m-0 h-full">
                                            <div className="h-full flex flex-col">
                                                {!uploadedImage ? (
                                                    <label htmlFor="signature-upload" className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-2xl cursor-pointer bg-primary/[0.02] hover:bg-primary/5 p-8 text-center transition-all duration-500 group">
                                                        <div className="p-4 bg-white rounded-2xl shadow-xl mb-4 group-hover:scale-110 transition-transform">
                                                            <Upload className="w-8 h-8 text-primary" />
                                                        </div>
                                                        <p className="text-sm font-black uppercase tracking-tight">Upload Scan Profile</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase mt-1 font-bold">PNG or JPG preferred</p>
                                                        <Input id="signature-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/png, image/jpeg" />
                                                    </label>
                                                ) : (
                                                    <div className="flex-1 relative rounded-2xl overflow-hidden border-2 border-primary/20 bg-muted shadow-inner p-4 flex items-center justify-center">
                                                        <Image src={uploadedImage} alt="Preview" fill className="object-contain p-4" />
                                                        <Button 
                                                            variant="secondary" 
                                                            size="sm" 
                                                            onClick={() => setUploadedImage(null)}
                                                            className="absolute bottom-4 right-4 rounded-xl font-bold gap-2 shadow-lg"
                                                        >
                                                            <RefreshCw className="h-4 w-4" /> Change File
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="confirm" 
                                initial={{ opacity: 0, x: 20 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                exit={{ opacity: 0, x: -20 }}
                                className="p-8 space-y-10 text-center"
                            >
                                <div className="p-8 bg-slate-50 border-2 border-dashed rounded-[3rem] shadow-inner relative flex items-center justify-center min-h-[200px]">
                                    {signatureData && <Image src={signatureData} alt="Verification" width={400} height={200} className="object-contain" />}
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="p-6 rounded-[2rem] bg-blue-50 border border-blue-100 flex items-start gap-4 text-left shadow-sm">
                                        <div className="p-2 bg-white rounded-xl text-blue-600 shadow-sm border border-blue-100"><Info className="h-5 w-5" /></div>
                                        <p className="text-xs font-bold text-blue-800 leading-relaxed uppercase tracking-tighter">
                                            By selecting “Confirm” you acknowledge that this electronic identity profile will be applied to the document as a legally binding signature.
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-center gap-3">
                                        <Switch id="consent-toggle" checked={isConsented} onCheckedChange={setIsConsented} className="scale-125" />
                                        <Label htmlFor="consent-toggle" className="text-base font-black uppercase tracking-tight cursor-pointer">I verify and consent</Label>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex flex-col sm:flex-row gap-3">
                    {step === 'input' ? (
                        <>
                            <Button variant="ghost" onClick={handleClear} disabled={!isInputProvided} className="font-bold rounded-xl h-12 px-6 gap-2">
                                <Eraser className="h-4 w-4" /> Clear
                            </Button>
                            <div className="flex-1" />
                            <Button variant="ghost" onClick={onClose} className="font-bold rounded-xl h-12 px-8">Cancel</Button>
                            <Button onClick={handleProceedToConfirm} disabled={!isInputProvided} className="rounded-xl font-black px-12 h-12 shadow-lg uppercase tracking-widest text-xs">
                                Review & Continue
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setStep('input')} className="font-bold rounded-xl h-12 px-8 gap-2">
                                <ArrowLeft className="h-4 w-4" /> Back
                            </Button>
                            <div className="flex-1" />
                            <Button 
                                onClick={handleFinalSign} 
                                disabled={!isConsented || !signatureData}
                                className="rounded-[1.5rem] font-black h-14 px-16 shadow-2xl bg-primary text-white uppercase tracking-widest text-sm transition-all active:scale-95"
                            >
                                <ShieldCheck className="mr-2 h-5 w-5" />
                                Execute Signature
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
