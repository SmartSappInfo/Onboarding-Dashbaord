
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import MediaLibraryBrowser from './MediaLibraryBrowser';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { MediaAsset } from '@/lib/types';

const TABS: MediaAsset['type'][] = ['image', 'video', 'audio', 'document', 'link'];
const TAB_NAMES: Record<MediaAsset['type'], string> = {
  image: 'Images',
  video: 'Videos',
  audio: 'Audio',
  document: 'Documents',
  link: 'Links',
};


interface MediaSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAsset: (asset: MediaAsset) => void;
  filterType?: MediaAsset['type'];
  workspaceId?: string; // Optional: restrict to specific workspace
  title?: string;
  description?: string;
}

export default function MediaSelectorDialog({ 
  open, 
  onOpenChange, 
  onSelectAsset, 
  filterType,
  workspaceId: forcedWorkspaceId,
  title = "Media Library",
  description
}: MediaSelectorDialogProps) {
  const { activeWorkspaceId } = useWorkspace();
  const effectiveWorkspaceId = forcedWorkspaceId || activeWorkspaceId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
    <DialogHeader className="px-8 pt-8 pb-6 border-b bg-muted/30 shrink-0">
      <DialogTitle className="text-2xl font-semibold tracking-tight">{title}</DialogTitle>
      <DialogDescription className="text-xs font-bold text-muted-foreground text-left">
        {description || (effectiveWorkspaceId 
            ? `Choose an institutional asset for the ${effectiveWorkspaceId} workspace or upload a new one.`
            : "Browse available assets across the platform."
        )}
      </DialogDescription>
    </DialogHeader>
    
    <MediaLibraryBrowser 
      onSelectAsset={onSelectAsset}
      filterType={filterType}
      workspaceId={effectiveWorkspaceId}
    />
    
    <div className="p-4 border-t bg-muted/30 shrink-0 flex justify-end">
      <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold rounded-xl px-8">Close Library</Button>
    </div>
  </DialogContent>
    </Dialog>
  );
}
