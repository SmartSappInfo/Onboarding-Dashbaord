
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type PDFForm } from '@/lib/types';
import PdfFormRenderer from '@/app/forms/[pdfId]/components/PdfFormRenderer';

interface PdfPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pdfForm: PDFForm;
}

export default function PdfPreviewDialog({ isOpen, onClose, pdfForm }: PdfPreviewDialogProps) {
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-4 border-b">
                    <DialogTitle>Form Preview</DialogTitle>
                    <DialogDescription>
                        This is an interactive preview. Submissions are disabled.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-hidden bg-muted">
                    <ScrollArea className="h-full">
                        <div className="p-4 sm:p-8">
                             {/* The renderer expects isPreview prop to disable submission */}
                            <PdfFormRenderer pdfForm={pdfForm} isPreview={true} />
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter className="p-6 pt-4 border-t">
                    <Button onClick={onClose}>Close Preview</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
