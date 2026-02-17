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

export default function UploadPDFButton() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const router = useRouter();

  const handleUploadSuccess = (pdfId: string) => {
    setIsSheetOpen(false);
    router.push(`/admin/pdfs/${pdfId}/edit`);
  };

  return (
    <>
      <Button onClick={() => setIsSheetOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Upload Document
      </Button>
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
