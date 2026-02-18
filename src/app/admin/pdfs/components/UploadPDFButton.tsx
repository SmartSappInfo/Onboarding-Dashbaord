'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import PdfUploader from './PdfUploader';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function UploadPDFButton() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const router = useRouter();

  const handleUploadSuccess = (pdfId: string) => {
    setIsSheetOpen(false);
    router.push(`/admin/pdfs/${pdfId}/edit`);
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={() => setIsSheetOpen(true)} size="icon" className="shrink-0">
              <Upload className="h-4 w-4" />
              <span className="sr-only">Upload Document</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Upload New Document</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col h-full">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle>Upload a New Document</SheetTitle>
            <SheetDescription>
              Upload a PDF document to begin mapping fields for public use.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-grow p-6 overflow-y-auto">
            <PdfUploader onUploadSuccess={handleUploadSuccess} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
