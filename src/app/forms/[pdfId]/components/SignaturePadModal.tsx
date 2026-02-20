'use client';

import * as React from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, Camera, Eraser } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface SignaturePadModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
}

export default function SignaturePadModal({ open, onClose, onSave }: SignaturePadModalProps) {
    const { toast } = useToast();
    const [step, setStep] = React.useState<'input' | 'confirm'>('input');
    const [signatureData, setSignatureData] = React.useState<string | null>(null);

    const sigPadRef = React.useRef<SignatureCanvas | null>(null);
    const initialsCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const photoCanvasRef = React.useRef<HTMLCanvasElement>(null);
    
    const [activeTab, setActiveTab] = React.useState('draw');
    const [typedInitials, setTypedInitials] = React.useState('');
    const [uploadedImage, setUploadedImage] = React.useState<string | null>(null);
    const [isConsented, setIsConsented] = React.useState(false);
    const [hasDrawn, setHasDrawn] = React.useState(false);

    // Camera states
    const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
    const [capturedImage, setCapturedImage] = React.useState<string | null>(null);

     // Effect to handle camera access
    React.useEffect(() => {
        let stream: MediaStream | null = null;
        
        const getCameraPermission = async () => {
            if (hasCameraPermission) return; // Don't ask again if already granted
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                setHasCameraPermission(true);
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (error) {
                console.error('Error accessing camera:', error);
                setHasCameraPermission(false);
                toast({
                    variant: 'destructive',
                    title: 'Camera Access Denied',
                    description: 'Please enable camera permissions in your browser settings.',
                });
            }
        };

        const stopCamera = () => {
            if (videoRef.current?.srcObject) {
                const mediaStream = videoRef.current.srcObject as MediaStream;
                mediaStream.getTracks().forEach(track => track.stop());
                videoRef.current.srcObject = null;
            }
             if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };

        if (open && activeTab === 'photo') {
            getCameraPermission();
        } else {
            stopCamera();
        }
        
        return () => {
           stopCamera();
        };
    }, [open, activeTab, hasCameraPermission, toast]);

    const handleClear = () => {
        if (activeTab === 'draw' && sigPadRef.current) {
            sigPadRef.current.clear();
            setHasDrawn(false);
        }
        if (activeTab === 'type') setTypedInitials('');
        if (activeTab === 'upload') setUploadedImage(null);
        if (activeTab === 'photo') setCapturedImage(null);
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
    
    const handleCapture = () => {
        if (videoRef.current && photoCanvasRef.current) {
            const canvas = photoCanvasRef.current;
            const video = videoRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
            setCapturedImage(canvas.toDataURL('image/png'));
        }
    };

    const handleProceedToConfirm = () => {
        let dataUrl: string | null = null;

        if (activeTab === 'draw' && sigPadRef.current && !sigPadRef.current.isEmpty()) {
            dataUrl = sigPadRef.current.getTrimmedCanvas().toDataURL('image/png');
        } else if (activeTab === 'type' && initialsCanvasRef.current && typedInitials) {
            const canvas = initialsCanvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = '60px "Mrs Saint Delafield"';
                ctx.fillStyle = 'black';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(typedInitials, canvas.width / 2, canvas.height / 2);
                dataUrl = canvas.toDataURL('image/png');
            }
        } else if (activeTab === 'upload' && uploadedImage) {
            dataUrl = uploadedImage;
        } else if (activeTab === 'photo' && capturedImage) {
            dataUrl = capturedImage;
        }

        if (dataUrl) {
            setSignatureData(dataUrl);
            setStep('confirm');
        } else {
            toast({
                variant: 'destructive',
                title: 'No Signature Provided',
                description: 'Please create a signature before proceeding.',
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

    const isSignatureProvided = 
        (activeTab === 'draw' && hasDrawn) ||
        (activeTab === 'type' && typedInitials.length > 0) ||
        (activeTab === 'upload' && uploadedImage !== null) ||
        (activeTab === 'photo' && capturedImage !== null);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                {step === 'input' && (
                    <>
                        <DialogHeader className="text-center sm:text-center">
                            <DialogTitle>Provide Your Signature</DialogTitle>
                            <DialogDescription>Choose one of the methods below to create your signature.</DialogDescription>
                        </DialogHeader>
                        
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="draw">Draw</TabsTrigger>
                                <TabsTrigger value="type">Type</TabsTrigger>
                                <TabsTrigger value="upload">Upload</TabsTrigger>
                                <TabsTrigger value="photo">Take Photo</TabsTrigger>
                            </TabsList>
                            <TabsContent value="draw">
                                <div className="border rounded-md bg-white mt-4 relative">
                                    <SignatureCanvas
                                        ref={sigPadRef}
                                        penColor="black"
                                        canvasProps={{
                                            className: 'w-full h-48 rounded-md',
                                        }}
                                        onBegin={() => setHasDrawn(true)}
                                    />
                                </div>
                            </TabsContent>
                            <TabsContent value="type">
                                <div className="mt-4 space-y-4">
                                    <Label htmlFor="initials-input" className="block text-center text-muted-foreground uppercase text-xs tracking-widest">Type your name or initials</Label>
                                    <Input 
                                        id="initials-input" 
                                        value={typedInitials} 
                                        onChange={(e) => setTypedInitials(e.target.value)} 
                                        className="text-5xl text-center font-signature h-auto py-6 border-none shadow-none focus-visible:ring-0 bg-transparent" 
                                        placeholder="Jane Doe" 
                                    />
                                    <canvas ref={initialsCanvasRef} width="400" height="150" className="hidden" />
                                </div>
                            </TabsContent>
                            <TabsContent value="upload">
                                <div className="mt-4">
                                    {!uploadedImage ? (
                                        <label htmlFor="signature-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted">
                                            <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                                            <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                            <p className="text-xs text-muted-foreground">PNG or JPG</p>
                                            <Input id="signature-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/png, image/jpeg" />
                                        </label>
                                    ) : (
                                        <div className="mt-4 p-2 border rounded-md relative flex items-center justify-center bg-muted h-48">
                                            <Image src={uploadedImage} alt="Signature Preview" fill className="object-contain p-2" />
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                            <TabsContent value="photo">
                                <div className="mt-4 space-y-4">
                                    {hasCameraPermission === false && <Alert variant="destructive"><AlertDescription className="text-center">Camera access is required. Please enable it in your browser settings and refresh.</AlertDescription></Alert>}
                                    {hasCameraPermission && !capturedImage && <video ref={videoRef} className="w-full aspect-video rounded-md bg-black" autoPlay muted playsInline />}
                                    {capturedImage && <Image src={capturedImage} alt="Captured signature" width={400} height={225} className="w-full aspect-video object-contain rounded-md border bg-muted" />}
                                    
                                    <div className="flex justify-center gap-4">
                                        {!capturedImage && <Button onClick={handleCapture} disabled={!hasCameraPermission}><Camera className="mr-2 h-4 w-4" />Capture</Button>}
                                        {capturedImage && <Button variant="outline" onClick={() => setCapturedImage(null)}>Retake Photo</Button>}
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                        
                        <DialogFooter className="mt-6 sm:justify-between">
                             <Button variant="ghost" onClick={handleClear} disabled={!isSignatureProvided}>
                                <Eraser className="mr-2 h-4 w-4"/>
                                Clear
                            </Button>
                            <Button onClick={handleProceedToConfirm} disabled={!isSignatureProvided}>
                                Next
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {step === 'confirm' && (
                    <>
                        <DialogHeader className="text-center sm:text-center">
                            <DialogTitle>Confirm Your Signature</DialogTitle>
                            <DialogDescription>Please review your signature and provide consent to sign.</DialogDescription>
                        </DialogHeader>

                        <div className="my-6 flex flex-col items-center gap-6">
                            <div className="p-4 border rounded-md bg-muted w-full max-w-sm h-32 flex items-center justify-center">
                                {signatureData && <Image src={signatureData} alt="Final signature preview" width={200} height={100} className="object-contain" />}
                            </div>
                            <Alert variant="default">
                                <AlertDescription className="text-xs text-center">
                                    By selecting “Sign Now” you consent to electronically sign this document. This signature is equivalent to a handwritten signature under applicable electronic transaction laws. Ensure all details are accurate before continuing. This action cannot be undone.
                                </AlertDescription>
                            </Alert>
                             <div className="flex items-center justify-center space-x-2 w-full">
                                <Switch id="consent-toggle" checked={isConsented} onCheckedChange={setIsConsented} />
                                <Label htmlFor="consent-toggle" className="text-sm font-medium">I have reviewed and I consent to sign.</Label>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStep('input')}>Back</Button>
                            <Button onClick={handleFinalSign} disabled={!isConsented || !signatureData}>Sign Now</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
