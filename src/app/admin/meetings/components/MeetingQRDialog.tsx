
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
    Copy, 
    Check, 
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
    DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';

import type QRCodeStylingType from 'qr-code-styling';

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
    const [qrEngine, setQrEngine] = useState<QRCodeStylingType | null>(null);
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
        } catch {
            toast({
                variant: "destructive",
                title: "Download Failed",
                description: "There was an error generating the download file."
            });
        }
    };

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(fullUrl)
            .then(() => {
                setCopied(true);
                toast({
                    title: "URL Copied",
                    description: "Meeting link copied to clipboard."
                });
                setTimeout(() => setCopied(false), 2000);
            })
            .catch((err) => {
                console.error("Failed to copy URL:", err);
                toast({
                    variant: "destructive",
                    title: "Copy Failed",
                    description: "Could not access clipboard. Please copy manually."
                });
            });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl sm:max-w-[450px] p-0 overflow-hidden">
                <DialogHeader demarcated>
                    <div className="flex items-center gap-2">
                        <QrCode className="h-5 w-5 text-primary" />
                        <DialogTitle className="text-lg font-bold tracking-tight">Meeting QR Access</DialogTitle>
                        <CardInfoTooltip text="Scan with mobile camera for instant session registration or download print-ready assets." />
                    </div>
                    <DialogDescription className="sr-only">
                        Instant mobile access for {meetingTitle}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-5 bg-background">
                    {/* QR Code Container */}
                    <div className="relative aspect-square w-full max-w-[260px] mx-auto rounded-2xl bg-white border border-border shadow-xs flex items-center justify-center p-3 overflow-hidden group">
                        {isGenerating && (
                            <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-xs flex items-center justify-center">
                                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            </div>
                        )}
                        <div ref={qrContainerRef} className="w-full h-full flex items-center justify-center transition-transform group-hover:scale-105 duration-300" />
                    </div>

                    {/* URL Bar */}
                    <div className="bg-muted/40 rounded-xl p-2.5 flex items-center gap-2.5 border border-border/60">
                        <div className="flex-1 truncate text-xs font-mono text-muted-foreground px-1">
                            {fullUrl}
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg shrink-0 active:scale-[0.97]"
                            onClick={handleCopyUrl}
                        >
                            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-3">
                        <Button 
                            onClick={() => handleDownload('png')} 
                            className="min-h-[44px] rounded-xl font-semibold gap-2 shadow-xs transition-all active:scale-[0.97]"
                            variant="default"
                        >
                            <FileImage className="h-4 w-4" />
                            PNG Image
                        </Button>
                        <Button 
                            onClick={() => handleDownload('svg')} 
                            variant="outline"
                            className="min-h-[44px] rounded-xl font-semibold gap-2 transition-all active:scale-[0.97]"
                        >
                            <FileCode className="h-4 w-4" />
                            Vector SVG
                        </Button>
                    </div>
                </div>

                <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5">
                    <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Print on flyers or posters
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl min-h-[44px] sm:min-h-[36px] active:scale-[0.97]"
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
