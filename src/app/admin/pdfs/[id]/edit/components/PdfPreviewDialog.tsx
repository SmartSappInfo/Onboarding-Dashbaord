'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type PDFForm, type WorkspaceEntity } from '@/lib/types';
import PdfFormRenderer from '@/app/forms/[pdfId]/components/PdfFormRenderer';

interface PdfPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pdfForm: PDFForm;
  entity?: WorkspaceEntity;
}

export default function PdfPreviewDialog({ isOpen, onClose, pdfForm, entity }: PdfPreviewDialogProps) {
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden rounded-[2.5rem]">
 <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
                    <DialogTitle>Outcome Simulation</DialogTitle>
                    <DialogDescription>
                        Interactive preview resolving dynamic tags for <strong>{entity?.displayName || 'Global Context'}</strong>.
                    </DialogDescription>
                </DialogHeader>
 <div className="flex-grow overflow-hidden bg-background relative">
 <ScrollArea className="h-full">
 <div className="p-4 sm:p-8">
                             {/* The renderer expects isPreview prop to disable submission */}
                            <PdfFormRenderer pdfForm={pdfForm} entity={entity} isPreview={true} />
                        </div>
                    </ScrollArea>
                </div>
 <DialogFooter className="p-6 pt-4 border-t bg-card shrink-0">
 <Button onClick={onClose} variant="outline" className="rounded-xl font-bold px-8">Exit Simulation</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
