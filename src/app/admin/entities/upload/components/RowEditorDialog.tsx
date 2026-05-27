'use client';

import * as React from 'react';
import { Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RowEditorDialogProps {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    rowIndex: number;
    data: any;
    onSave: (idx: number, updated: any) => void;
}

export function RowEditorDialog({
    open,
    onOpenChange,
    rowIndex,
    data,
    onSave,
}: RowEditorDialogProps) {
    const [localData, setLocalData] = React.useState<any>(data);

    React.useEffect(() => {
        if (open) {
            setLocalData(data);
        }
    }, [open, data]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl rounded-2xl p-0 overflow-hidden border border-border shadow-2xl bg-card">
                <DialogHeader className="p-8 bg-card/20 border-b shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary text-white rounded-xl shadow-lg">
                            <Pencil size={24} />
                        </div>
                        <div className="text-left">
                            <DialogTitle className="text-xl font-semibold">Edit Record</DialogTitle>
                            <DialogDescription className="text-xs font-bold opacity-60">
                                Manual Correction for Row #{rowIndex + 1}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-[400px]">
                        <div className="p-8 space-y-6">
                            {Object.entries(localData || {}).map(([key, val]) => (
                                <div key={key} className="space-y-1.5">
                                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">{key}</Label>
                                    <Input 
                                        value={String(val || '')} 
                                        onChange={e => setLocalData((p: any) => ({ ...p, [key]: e.target.value }))} 
                                        className="h-11 rounded-xl bg-background/50 border-none font-bold shadow-inner" 
                                    />
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter className="p-6 bg-card/20 border-t flex justify-between">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold animate-none">Cancel</Button>
                    <Button onClick={() => onSave(rowIndex, localData)} className="rounded-xl font-semibold px-8 shadow-xl bg-primary text-white text-xs animate-none">Apply Corrections</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
