'use client';

import * as React from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SignaturePadModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
}

export default function SignaturePadModal({ open, onClose, onSave }: SignaturePadModalProps) {
    const sigPadRef = React.useRef<SignatureCanvas | null>(null);
    
    const handleClear = () => {
        sigPadRef.current?.clear();
    };

    const handleSave = () => {
        if (sigPadRef.current) {
            const dataUrl = sigPadRef.current.getTrimmedCanvas().toDataURL('image/png');
            onSave(dataUrl);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Please Sign Below</DialogTitle>
                </DialogHeader>
                <div className="border rounded-md bg-white">
                    <SignatureCanvas
                        ref={sigPadRef}
                        penColor='black'
                        canvasProps={{ className: 'w-full h-48' }}
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={handleClear}>Clear</Button>
                    <Button onClick={handleSave}>Save Signature</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
