'use client';

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, TextCursorInput } from 'lucide-react';
import { updateMediaName } from '@/lib/media-actions';
import { useToast } from '@/hooks/use-toast';
import type { MediaAsset } from '@/lib/types';

interface RenameMediaDialogProps {
    asset: MediaAsset;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function RenameMediaDialog({ asset, open, onOpenChange }: RenameMediaDialogProps) {
    const { toast } = useToast();
    const [name, setName] = React.useState(asset.name);
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (open) setName(asset.name);
    }, [open, asset.name]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || name.trim() === asset.name) {
            onOpenChange(false);
            return;
        }

        setIsSaving(true);
        const result = await updateMediaName(asset.id, name.trim());
        
        if (result.success) {
            toast({ title: 'Asset Renamed', description: `New name: ${name.trim()}` });
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: 'Rename Failed', description: result.error });
        }
        setIsSaving(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                <form onSubmit={handleSave}>
                    <DialogHeader className="p-8 bg-muted/30 border-b shrink-0 text-left">
                        <div className="flex flex-col items-start gap-2">
                            <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-sm mb-2">
                                <TextCursorInput className="h-6 w-6" aria-hidden="true" />
                            </div>
                            <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">Rename Asset</DialogTitle>
                            <DialogDescription className="text-xs font-bold text-muted-foreground opacity-90">
                                Update the internal label for this media element.
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                    <div className="p-8 space-y-4 bg-background">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Asset Name</Label>
                            <Input 
                                value={name} 
                                onChange={(e) => setName(e.target.value)}
                                className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-lg px-4"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between items-center sm:justify-between">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving} className="rounded-xl font-bold h-12 px-8 cursor-pointer hover:bg-muted/50 transition-colors duration-200">Cancel</Button>
                        <Button type="submit" disabled={isSaving || !name.trim()} className="rounded-xl font-bold h-12 px-10 shadow-lg cursor-pointer transition-all duration-200 active:scale-95 gap-2">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                            Apply Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
