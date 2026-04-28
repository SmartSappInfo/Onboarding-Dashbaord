'use client';

import * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { QrCode, Download, Save, Radio, Lock, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import QRPreview, { downloadQR } from '@/app/admin/qr-studio/components/qr-preview';
import { createQRCode } from '@/lib/qr-actions';

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
    const [isSaving, setIsSaving] = React.useState(false);
    const [savedId, setSavedId] = React.useState<string | null>(null);

    // Reset state when sheet opens with new data
    React.useEffect(() => {
        if (open) {
            setName(`${userName} — ${surveyTitle}`);
            setMode('dynamic');
            setIsSaving(false);
            setSavedId(null);
        }
    }, [open, userName, surveyTitle]);

    const handleDownload = async () => {
        try {
            await downloadQR(url, {}, 'png', name.replace(/[^a-zA-Z0-9-_ ]/g, ''));
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
            const result = await createQRCode({
                organizationId,
                workspaceId,
                name,
                description: `Attribution QR for ${userName} on "${surveyTitle}"`,
                mode,
                type: 'url',
                destination: { url },
                tracking: { enabled: mode === 'dynamic' },
                createdBy: currentUser,
            });
            setSavedId(result.id);
            toast({
                title: 'Saved to QR Studio',
                description: 'You can now edit the design and track scans.',
            });
        } catch (err: any) {
            toast({ title: 'Save Failed', description: err.message || 'Unknown error', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-hidden flex flex-col">
                {/* Header */}
                <SheetHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <QrCode className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-left">
                            <SheetTitle className="text-sm font-semibold tracking-tight">Generate QR Code</SheetTitle>
                            <SheetDescription className="text-[10px] font-bold text-muted-foreground/60 tracking-tight">
                                For: {userName} · Attribution Link
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* QR Name */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">QR Code Name</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-sm"
                        />
                    </div>

                    {/* Mode Toggle */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">QR Mode</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setMode('dynamic')}
                                className={cn(
                                    "flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left",
                                    mode === 'dynamic'
                                        ? "border-primary bg-primary/5 shadow-md"
                                        : "border-border/50 bg-muted/10 hover:border-primary/30"
                                )}
                            >
                                <Radio className={cn("h-4 w-4", mode === 'dynamic' ? "text-primary" : "text-muted-foreground")} />
                                <div>
                                    <p className="text-[11px] font-black">Dynamic</p>
                                    <p className="text-[9px] text-muted-foreground font-medium">Trackable & editable</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('static')}
                                className={cn(
                                    "flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left",
                                    mode === 'static'
                                        ? "border-primary bg-primary/5 shadow-md"
                                        : "border-border/50 bg-muted/10 hover:border-primary/30"
                                )}
                            >
                                <Lock className={cn("h-4 w-4", mode === 'static' ? "text-primary" : "text-muted-foreground")} />
                                <div>
                                    <p className="text-[11px] font-black">Static</p>
                                    <p className="text-[9px] text-muted-foreground font-medium">Direct link, no tracking</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Destination URL (read-only) */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Destination URL</Label>
                        <div className="px-3 py-2.5 rounded-xl bg-muted/30 border border-border/50 text-[10px] font-mono text-muted-foreground break-all select-all">
                            {url}
                        </div>
                    </div>

                    {/* QR Preview */}
                    <div className="space-y-3">
                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Preview</Label>
                        <div className="flex items-center justify-center p-6 bg-white rounded-2xl border border-border/50 shadow-inner">
                            <QRPreview data={url} size={220} />
                        </div>
                        <p className="text-[9px] text-muted-foreground font-medium text-center italic">
                            Default styling. Save to QR Studio for full design customization.
                        </p>
                    </div>

                    {/* Success State */}
                    {savedId && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                            <div className="flex-1">
                                <p className="text-[11px] font-black text-emerald-700">Saved to QR Studio</p>
                                <p className="text-[9px] text-emerald-600 font-medium">Open QR Studio to customize the design and view scan analytics.</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="shrink-0 h-8 px-3 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-500/10 font-bold text-[10px]"
                                onClick={() => window.open('/admin/qr-studio', '_blank')}
                            >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Open
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="border-t p-4 bg-muted/20 flex items-center gap-3">
                    <Button
                        variant="outline"
                        className="flex-1 h-11 rounded-xl font-bold text-xs gap-2"
                        onClick={handleDownload}
                    >
                        <Download className="h-4 w-4" />
                        Download PNG
                    </Button>
                    <Button
                        className="flex-1 h-11 rounded-xl font-bold text-xs gap-2 shadow-lg shadow-primary/20"
                        onClick={handleSaveToStudio}
                        disabled={isSaving || !!savedId}
                    >
                        {isSaving ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                        ) : savedId ? (
                            <><CheckCircle2 className="h-4 w-4" /> Saved</>
                        ) : (
                            <><Save className="h-4 w-4" /> Save to QR Studio</>
                        )}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
