
'use client';

import { useState } from 'react';
import { Upload, Plus, Library } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import MediaSelectorDialog from '../../media/components/media-selector-dialog';
import type { MediaAsset } from '@/lib/types';
import { useUser } from '@/firebase';
import { createPdfForm } from '@/lib/pdf-actions';
import { useToast } from '@/hooks/use-toast';

export default function UploadPDFButton() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isMediaDialogOpen, setIsMediaDialogOpen] = useState(false);
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();

  const handleUploadSuccess = (pdfId: string) => {
    setIsSheetOpen(false);
    router.push(`/admin/pdfs/${pdfId}/edit`);
  };

  const handleMediaSelect = async (asset: MediaAsset) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in.' });
        return;
    }
    
    setIsMediaDialogOpen(false);
    
    const result = await createPdfForm({
        name: asset.name.replace(/\.pdf$/i, ''),
        originalFileName: asset.originalName || asset.name,
        storagePath: asset.fullPath || '',
        downloadUrl: asset.url,
    }, user.uid);

    if (result.success && result.id) {
        toast({ title: 'Success', description: `"${asset.name}" added from library.` });
        router.push(`/admin/pdfs/${result.id}/edit`);
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to add document.' });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Document
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setIsSheetOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            <span>Upload from Computer</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsMediaDialogOpen(true)}>
            <Library className="mr-2 h-4 w-4" />
            <span>Choose from Media</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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

      <MediaSelectorDialog
        open={isMediaDialogOpen}
        onOpenChange={setIsMediaDialogOpen}
        onSelectAsset={handleMediaSelect}
        filterType="document"
      />
    </>
  );
}
