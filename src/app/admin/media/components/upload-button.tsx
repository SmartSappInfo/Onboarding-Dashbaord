'use client';

import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import MediaUploader from './media-uploader';

interface UploadButtonProps {
  workspaceId?: string;
}

export default function UploadButton({ workspaceId }: UploadButtonProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleUploadSuccess = () => {
    setIsSheetOpen(false);
  }

  return (
    <>
      <Button onClick={() => setIsSheetOpen(true)}>
        <PlusCircle className="mr-2 h-4 w-4" />
        Upload Media
      </Button>
      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="w-screen h-[100dvh] max-w-none p-0 m-0 border-none rounded-none flex flex-col shadow-2xl overflow-hidden bg-background">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/10 shrink-0 relative">
            <DialogTitle className="text-2xl font-semibold tracking-tight w-3/4">Upload Media</DialogTitle>
            <DialogDescription>
              Drag and drop files, edit, and upload. Max 100MB per file (10MB for audio).
            </DialogDescription>
            <div id="uploader-header-portal" className="absolute top-6 right-16 z-[100]"></div>
          </DialogHeader>
          <div className="flex-grow p-6 overflow-y-auto">
            <MediaUploader 
              onUploadSuccess={handleUploadSuccess} 
              defaultWorkspaceId={workspaceId}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
