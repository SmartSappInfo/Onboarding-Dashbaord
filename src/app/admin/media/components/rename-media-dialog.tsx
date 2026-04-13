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
 <DialogContent className="sm:max-w-md rounded-2xl">
                <form onSubmit={handleSave}>
                    <DialogHeader>
 <div className="flex items-center gap-3 mb-2">
 <div className="p-2 bg-primary/10 rounded-xl">
 <TextCursorInput className="h-5 w-5 text-primary" />
                            </div>
 <DialogTitle className="text-xl font-semibold tracking-tight">Rename Asset</DialogTitle>
                        </div>
 <DialogDescription className="text-xs font-medium text-muted-foreground ">
                            Update the internal label for this media element.
                        </DialogDescription>
                    </DialogHeader>
 <div className="py-6 space-y-4">
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
 <DialogFooter className="bg-muted/30 p-4 -mx-6 -mb-6 mt-2">
 <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="font-bold">Cancel</Button>
 <Button type="submit" disabled={isSaving || !name.trim()} className="rounded-xl font-bold px-8 shadow-lg gap-2">
 {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Apply Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
