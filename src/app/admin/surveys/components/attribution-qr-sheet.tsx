'use client';

import * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { QrCode, Download, Save, Radio, Lock, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadQR } from '@/app/admin/qr-studio/components/qr-preview';
import { createQRCode, getQRCodeByUrl, updateQRCode } from '@/lib/qr-actions';
import type { QRDesign } from '@/lib/types';
import { DEFAULT_QR_DESIGN } from '@/lib/qr-constants';
import QRDesigner from '@/app/admin/qr-studio/components/designer/qr-designer';

interface AttributionQRSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    url: string;
    userName: string;
    surveyTitle: string;
    workspaceId: string;
    organizationId: string;
    currentUser: { userId: string; name: string; email: string };
}

export default function AttributionQRSheet({
    open,
    onOpenChange,
    url,
    userName,
    surveyTitle,
    workspaceId,
    organizationId,
    currentUser,
}: AttributionQRSheetProps) {
    const { toast } = useToast();
    const [name, setName] = React.useState(`${userName} — ${surveyTitle}`);
    const [mode, setMode] = React.useState<'dynamic' | 'static'>('dynamic');
    const [design, setDesign] = React.useState<QRDesign>(DEFAULT_QR_DESIGN);
    
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [existingQrId, setExistingQrId] = React.useState<string | null>(null);
    const [isSuccess, setIsSuccess] = React.useState(false);

    // Fetch existing QR code on open
    React.useEffect(() => {
        if (!open) return;
        
        let isMounted = true;
        setIsLoading(true);
        setIsSuccess(false);

        async function fetchExisting() {
            try {
                if (!workspaceId || !organizationId || !url) return;
                const existing = await getQRCodeByUrl(organizationId, workspaceId, url);
                
                if (isMounted) {
                    if (existing) {
                        setName(existing.name);
                        setMode(existing.mode);
                        if (existing.design) setDesign(existing.design);
                        setExistingQrId(existing.id);
                    } else {
                        setName(`${userName} — ${surveyTitle}`);
                        setMode('dynamic');
                        setDesign(DEFAULT_QR_DESIGN);
                        setExistingQrId(null);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch existing QR:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        fetchExisting();

        return () => { isMounted = false; };
    }, [open, url, workspaceId, organizationId, userName, surveyTitle]);

    const handleDownload = async () => {
        try {
            await downloadQR(url, design, 'png', name.replace(/[^a-zA-Z0-9-_ ]/g, ''));
            toast({ title: 'QR Downloaded', description: 'PNG file saved to your downloads.' });
        } catch {
            toast({ title: 'Download Failed', description: 'Could not generate QR image.', variant: 'destructive' });
        }
    };

    const handleSaveToStudio = async () => {
        if (!workspaceId || !organizationId) {
            toast({ title: 'Missing Context', description: 'Workspace or organization not found.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            if (existingQrId) {
                // Update existing
                await updateQRCode(organizationId, workspaceId, existingQrId, {
                    name,
                    mode,
                    design
                });
                toast({ title: 'QR Code Updated', description: 'Your design changes have been saved.' });
            } else {
                // Create new
                const result = await createQRCode({
                    organizationId,
                    workspaceId,
                    name,
                    description: `Attribution QR for ${userName} on "${surveyTitle}"`,
                    mode,
                    type: 'url',
                    destination: { url },
                    design,
                    tracking: { enabled: mode === 'dynamic' },
                    createdBy: currentUser,
                });
                setExistingQrId(result.id);
                toast({ title: 'Saved to QR Studio', description: 'QR Code created successfully.' });
            }
            setIsSuccess(true);
            setTimeout(() => setIsSuccess(false), 3000);
        } catch (err: any) {
            toast({ title: 'Save Failed', description: err.message || 'Unknown error', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full xl:w-[90vw] sm:max-w-6xl p-0 overflow-hidden flex flex-col sm:border-l sm:rounded-l-3xl shadow-2xl">
                {/* Header */}
                <SheetHeader className="px-6 py-4 border-b bg-muted/10 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <QrCode className="h-5 w-5 text-primary" />
                            </div>
                            <div className="text-left">
                                <SheetTitle className="text-sm font-semibold tracking-tight">QR Studio Designer</SheetTitle>
                                <SheetDescription className="text-xs font-medium text-muted-foreground tracking-tight">
                                    Customizing for: <span className="font-bold text-foreground">{userName}</span>
                                </SheetDescription>
                            </div>
                        </div>
                    </div>
                </SheetHeader>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-2 sm:px-6 py-6 bg-muted/5">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm font-medium">Loading QR design...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col xl:flex-row gap-8">
                            {/* Left Col: Setup */}
                            <div className="w-full xl:w-[320px] shrink-0 space-y-6">
                                {/* Name Input */}
                                <div className="space-y-2 p-4 bg-card border rounded-2xl shadow-sm">
                                    <Label className="text-xs font-bold text-muted-foreground ml-1 uppercase tracking-wider">QR Code Name</Label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="h-10 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-semibold text-sm"
                                    />
                                </div>

                                {/* Mode Select */}
                                <div className="space-y-2 p-4 bg-card border rounded-2xl shadow-sm">
                                    <Label className="text-xs font-bold text-muted-foreground ml-1 uppercase tracking-wider">QR Mode</Label>
                                    <div className="grid grid-cols-1 gap-2 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => setMode('dynamic')}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                                                mode === 'dynamic'
                                                    ? "border-primary bg-primary/5 shadow-sm"
                                                    : "border-border/50 bg-muted/10 hover:border-primary/30"
                                            )}
                                        >
                                            <div className={cn("p-1.5 rounded-lg", mode === 'dynamic' ? "bg-primary/20" : "bg-muted")}>
                                                <Radio className={cn("h-4 w-4", mode === 'dynamic' ? "text-primary" : "text-muted-foreground")} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold">Dynamic</p>
                                                <p className="text-[10px] text-muted-foreground font-medium">Trackable & editable</p>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMode('static')}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                                                mode === 'static'
                                                    ? "border-primary bg-primary/5 shadow-sm"
                                                    : "border-border/50 bg-muted/10 hover:border-primary/30"
                                            )}
                                        >
                                            <div className={cn("p-1.5 rounded-lg", mode === 'static' ? "bg-primary/20" : "bg-muted")}>
                                                <Lock className={cn("h-4 w-4", mode === 'static' ? "text-primary" : "text-muted-foreground")} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold">Static</p>
                                                <p className="text-[10px] text-muted-foreground font-medium">Direct link, no tracking</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                                
                                {/* URL Info */}
                                <div className="p-4 bg-card border rounded-2xl shadow-sm space-y-2">
                                    <Label className="text-xs font-bold text-muted-foreground ml-1 uppercase tracking-wider">Destination</Label>
                                    <div className="px-3 py-2 rounded-xl bg-muted/30 border border-border/50 text-xs font-mono text-muted-foreground break-all select-all">
                                        {url}
                                    </div>
                                </div>
                            </div>

                            {/* Right Col: Designer */}
                            <div className="flex-1 bg-card border rounded-3xl p-4 sm:p-6 shadow-sm overflow-hidden">
                                <QRDesigner
                                    data={url}
                                    design={design}
                                    onDesignChange={setDesign}
                                    orgId={organizationId}
                                    wsId={workspaceId}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="border-t px-6 py-4 bg-background flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-semibold text-xs px-6 h-11 w-full sm:w-auto">
                            Cancel
                        </Button>
                        {!isLoading && existingQrId && (
                            <Button variant="outline" className="rounded-xl font-bold text-xs h-11 border-primary/20 text-primary hover:bg-primary/5 w-full sm:w-auto" onClick={() => window.open(`/admin/qr-studio/${existingQrId}`, '_blank')}>
                                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                                View Analytics
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Button
                            variant="outline"
                            className="h-11 rounded-xl font-bold text-xs px-6 w-full sm:w-auto"
                            onClick={handleDownload}
                            disabled={isLoading}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                        </Button>
                        <Button
                            className="h-11 rounded-xl font-bold text-xs px-8 shadow-lg shadow-primary/20 w-full sm:w-auto transition-all"
                            onClick={handleSaveToStudio}
                            disabled={isLoading || isSaving || isSuccess}
                        >
                            {isSaving ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                            ) : isSuccess ? (
                                <><CheckCircle2 className="h-4 w-4 mr-2" /> Saved!</>
                            ) : (
                                <><Save className="h-4 w-4 mr-2" /> {existingQrId ? 'Update Design' : 'Save to QR Studio'}</>
                            )}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
