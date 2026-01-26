'use client';

import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import MediaUploader from './media-uploader';

export default function UploadButton() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsSheetOpen(true)}>
        <PlusCircle className="mr-2 h-4 w-4" />
        Upload Media
      </Button>
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full max-w-3xl sm:max-w-3xl p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle>Upload Media</SheetTitle>
            <SheetDescription>
              Drag and drop files here or click to browse. Max 50MB per file.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-grow p-6 overflow-hidden">
            <MediaUploader closeSheet={() => setIsSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
