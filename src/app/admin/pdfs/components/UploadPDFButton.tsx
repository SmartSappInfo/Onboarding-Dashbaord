
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
import { useWorkspace } from '@/context/WorkspaceContext';

export default function UploadPDFButton() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isMediaDialogOpen, setIsMediaDialogOpen] = useState(false);
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();

  const handleUploadSuccess = (pdfId: string) => {
    setIsSheetOpen(false);
    router.push(`/admin/pdfs/${pdfId}/edit`);
  };

  const handleMediaSelect = async (asset: MediaAsset) => {
    if (!user || !activeWorkspaceId) {
        toast({ variant: 'destructive', title: 'Context Missing', description: 'Authentication and Workspace required.' });
        return;
    }
    
    setIsMediaDialogOpen(false);
    
    const result = await createPdfForm({
        name: asset.name.replace(/\.pdf$/i, ''),
        originalFileName: asset.name,
        storagePath: asset.fullPath || '',
        downloadUrl: asset.url,
    }, user.uid, [activeWorkspaceId]);

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
          <Button className="gap-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg h-11 px-6">
            <Plus className="h-4 w-4" />
            Add Document
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-2xl border-none shadow-2xl p-2">
          <DropdownMenuItem onClick={() => setIsSheetOpen(true)} className="rounded-xl p-2.5 gap-3">
            <Upload className="mr-2 h-4 w-4 text-primary" />
            <span className="font-bold text-sm">Upload from Computer</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsMediaDialogOpen(true)} className="rounded-xl p-2.5 gap-3">
            <Library className="mr-2 h-4 w-4 text-primary" />
            <span className="font-bold text-sm">Choose from Media</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col h-full border-none shadow-2xl rounded-l-[3rem]">
          <SheetHeader className="p-8 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                    <FileText className="h-6 w-6" />
                </div>
                <div className="text-left">
                    <SheetTitle className="text-2xl font-black uppercase tracking-tight">Import Document</SheetTitle>
                    <SheetDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Initializing record for {activeWorkspaceId}.</SheetDescription>
                </div>
            </div>
          </SheetHeader>
          <div className="flex-grow p-8 overflow-y-auto bg-background">
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

function FileText(props: any) { return <Plus {...props} /> }
