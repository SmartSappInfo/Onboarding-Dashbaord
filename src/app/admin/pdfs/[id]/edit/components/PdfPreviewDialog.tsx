'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
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
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 border border-border/80 shadow-2xl overflow-hidden sm:rounded-2xl bg-card text-card-foreground">
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 shrink-0">
          <div className="flex items-center gap-2">
            <DialogTitle className="font-bold text-base tracking-tight">Outcome Simulation</DialogTitle>
            <CardInfoTooltip
              text={`Interactive preview resolving dynamic tags for ${entity?.displayName || 'Global Context'}.`}
            />
          </div>
          <DialogDescription className="sr-only">
            Interactive preview resolving dynamic tags.
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
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">
          <Button
            onClick={onClose}
            variant="outline"
            className="rounded-xl font-bold px-8 min-h-[44px] active:scale-[0.97]"
          >
            Exit Simulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
