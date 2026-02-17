
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

export default function UploadPDFButton() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsSheetOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Upload PDF
      </Button>
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col h-full">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle>Upload a New PDF Form</SheetTitle>
            <SheetDescription>
              Upload a PDF file to begin mapping fields for public use.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-grow p-6 overflow-y-auto">
            <PdfUploader onUploadSuccess={() => setIsSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
