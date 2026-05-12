
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
    Download, 
    Copy, 
    Check, 
    X,
    QrCode,
    FileImage,
    FileCode,
    Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MeetingQRDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    meetingTitle: string;
    publicUrl: string;
}

export default function MeetingQRDialog({
    open,
    onOpenChange,
    meetingTitle,
    publicUrl
}: MeetingQRDialogProps) {
    const { toast } = useToast();
    const qrContainerRef = useRef<HTMLDivElement>(null);
    const [qrEngine, setQrEngine] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(true);
    const [copied, setCopied] = useState(false);
    const [fullUrl, setFullUrl] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setFullUrl(`${window.location.origin}${publicUrl}`);
        }
    }, [publicUrl]);

    useEffect(() => {
        if (!open || !fullUrl) return;

        const initQr = async () => {
            setIsGenerating(true);
            try {
                const QRCodeStyling = (await import('qr-code-styling')).default;
                
                const qrCode = new QRCodeStyling({
                    width: 300,
                    height: 300,
                    type: 'svg',
                    data: fullUrl,
                    margin: 10,
                    qrOptions: {
                        typeNumber: 0,
                        mode: 'Byte',
                        errorCorrectionLevel: 'Q'
                    },
                    imageOptions: {
                        hideBackgroundDots: true,
                        imageSize: 0.4,
                        margin: 0
                    },
                    dotsOptions: {
                        color: '#2563eb', // primary blue
                        type: 'extra-rounded'
                    },
                    backgroundOptions: {
                        color: '#ffffff',
                    },
                    cornersSquareOptions: {
                        color: '#1e40af', // darker blue
                        type: 'extra-rounded'
                    },
                    cornersDotOptions: {
                        color: '#1e40af',
                        type: 'dot'
                    }
                });

                if (qrContainerRef.current) {
                    qrContainerRef.current.innerHTML = '';
                    qrCode.append(qrContainerRef.current);
                    setQrEngine(qrCode);
                }
            } catch (error) {
                console.error('Failed to generate QR code:', error);
            } finally {
                setIsGenerating(false);
            }
        };

        initQr();
    }, [open, fullUrl]);

    const handleDownload = async (extension: 'png' | 'svg') => {
        if (!qrEngine) return;
        
        try {
            await qrEngine.download({
                name: `QR-${meetingTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
                extension: extension
            });
            toast({
                title: "QR Code Downloaded",
                description: `Successfully exported as ${extension.toUpperCase()}.`
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Download Failed",
                description: "There was an error generating the download file."
            });
        }
    };

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        toast({
            title: "URL Copied",
            description: "Meeting link copied to clipboard."
        });
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] rounded-[2.5rem] overflow-hidden border-none shadow-2xl p-0">
                <div className="bg-primary/5 p-8 border-b border-primary/10">
                    <DialogHeader>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-primary/10 rounded-2xl">
                                <QrCode className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold tracking-tight">Meeting QR Access</DialogTitle>
                                <DialogDescription className="text-xs font-medium">
                                    Instant mobile access for {meetingTitle}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="p-8 space-y-8 bg-background">
                    {/* QR Code Container */}
                    <div className="relative aspect-square w-full max-w-[280px] mx-auto rounded-3xl bg-white border shadow-inner flex items-center justify-center p-4 overflow-hidden group">
                        {isGenerating && (
                            <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                            </div>
                        )}
                        <div ref={qrContainerRef} className="w-full h-full flex items-center justify-center transition-transform group-hover:scale-105 duration-500" />
                    </div>

                    {/* URL Bar */}
                    <div className="bg-muted/50 rounded-2xl p-3 flex items-center gap-3 border border-border/50">
                        <div className="flex-1 truncate text-[10px] font-mono text-muted-foreground px-2">
                            {fullUrl}
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-xl shrink-0"
                            onClick={handleCopyUrl}
                        >
                            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-4">
                        <Button 
                            onClick={() => handleDownload('png')} 
                            className="h-14 rounded-2xl font-bold gap-2 shadow-lg shadow-primary/10 transition-all active:scale-95"
                            variant="default"
                        >
                            <FileImage className="h-5 w-5" />
                            PNG Image
                        </Button>
                        <Button 
                            onClick={() => handleDownload('svg')} 
                            variant="outline"
                            className="h-14 rounded-2xl font-bold gap-2 border-2 transition-all active:scale-95"
                        >
                            <FileCode className="h-5 w-5" />
                            Vector SVG
                        </Button>
                    </div>
                </div>

                <div className="px-8 pb-8 bg-background flex justify-center">
                    <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-primary" />
                        Print this QR on flyers or posters for instant session registration.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
