'use client';

import * as React from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload } from 'lucide-react';

interface SignaturePadModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
}

export default function SignaturePadModal({ open, onClose, onSave }: SignaturePadModalProps) {
    const sigPadRef = React.useRef<SignatureCanvas | null>(null);
    const [activeTab, setActiveTab] = React.useState('draw');
    const [typedInitials, setTypedInitials] = React.useState('');
    const [uploadedImage, setUploadedImage] = React.useState<string | null>(null);
    const [isConsented, setIsConsented] = React.useState(false);
    const initialsCanvasRef = React.useRef<HTMLCanvasElement>(null);

    React.useEffect(() => {
        if (activeTab === 'type' && initialsCanvasRef.current && typedInitials) {
            const canvas = initialsCanvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = 'italic bold 72px "Times New Roman", serif';
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(typedInitials, canvas.width / 2, canvas.height / 2);
            }
        }
    }, [typedInitials, activeTab]);
    
    const handleClear = () => {
        if (activeTab === 'draw' && sigPadRef.current) {
            sigPadRef.current.clear();
        } else if (activeTab === 'type') {
            setTypedInitials('');
        } else if (activeTab === 'upload') {
            setUploadedImage(null);
        }
    };

    const handleSave = () => {
        let dataUrl = '';
        if (activeTab === 'draw' && sigPadRef.current && !sigPadRef.current.isEmpty()) {
            dataUrl = sigPadRef.current.getTrimmedCanvas().toDataURL('image/png');
        } else if (activeTab === 'type' && initialsCanvasRef.current && typedInitials) {
            dataUrl = initialsCanvasRef.current.toDataURL('image/png');
        } else if (activeTab === 'upload' && uploadedImage) {
            dataUrl = uploadedImage;
        }

        if (dataUrl) {
            onSave(dataUrl);
            resetState();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setUploadedImage(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    }

    const resetState = () => {
        handleClear();
        setIsConsented(false);
        setTypedInitials('');
        setUploadedImage(null);
    }

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            resetState();
            onClose();
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Provide Your Signature</DialogTitle>
                    <DialogDescription>
                        Choose one of the methods below to sign the document.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="draw">Draw</TabsTrigger>
                        <TabsTrigger value="type">Type</TabsTrigger>
                        <TabsTrigger value="upload">Upload</TabsTrigger>
                    </TabsList>
                    <TabsContent value="draw">
                        <div className="border rounded-md bg-white mt-4">
                            <SignatureCanvas
                                ref={sigPadRef}
                                penColor='black'
                                canvasProps={{ className: 'w-full h-48 rounded-md' }}
                            />
                        </div>
                    </TabsContent>
                    <TabsContent value="type">
                        <div className="mt-4 space-y-4">
                            <Label htmlFor="initials-input">Type your initials</Label>
                            <Input
                                id="initials-input"
                                value={typedInitials}
                                onChange={(e) => setTypedInitials(e.target.value.substring(0, 4))}
                                maxLength={4}
                                className="text-4xl text-center font-serif italic h-auto py-4"
                                placeholder="J.D."
                            />
                             <canvas ref={initialsCanvasRef} width="400" height="150" className="hidden" />
                        </div>
                    </TabsContent>
                    <TabsContent value="upload">
                         <div className="mt-4">
                             <label htmlFor="signature-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                    <p className="text-xs text-muted-foreground">PNG, JPG, or GIF</p>
                                    <p className="text-xs text-muted-foreground mt-1">You can also use your phone's camera.</p>
                                </div>
                                <Input id="signature-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" />
                            </label>

                             {uploadedImage && (
                                <div className="mt-4 p-2 border rounded-md relative">
                                    <p className="text-sm font-medium mb-2">Preview:</p>
                                    <img src={uploadedImage} alt="Signature Preview" className="max-h-32 mx-auto" />
                                </div>
                            )}
                         </div>
                    </TabsContent>
                </Tabs>
                
                <div className="flex justify-end mt-2">
                    <Button variant="ghost" onClick={handleClear} size="sm">Clear</Button>
                </div>

                <DialogFooter className="flex-col items-start gap-4 mt-6">
                    <Alert variant="default" className="text-xs text-muted-foreground">
                        <AlertDescription>
                            By selecting “Sign Now” you consent to electronically sign this document. This signature is equivalent to a handwritten signature under applicable electronic transaction laws.
                            <br/><br/>
                            Ensure all details are accurate before continuing. This action cannot be undone.
                        </AlertDescription>
                    </Alert>
                    <div className="flex items-center space-x-2">
                        <Switch id="consent-toggle" checked={isConsented} onCheckedChange={setIsConsented} />
                        <Label htmlFor="consent-toggle" className="text-sm">
                            I have reviewed all the details and I consent to sign.
                        </Label>
                    </div>
                    <div className="flex w-full justify-end gap-2">
                        <Button variant="outline" onClick={onClose}>Review Again</Button>
                        <Button onClick={handleSave} disabled={!isConsented}>Sign Now</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
