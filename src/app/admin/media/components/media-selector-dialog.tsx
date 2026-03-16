
'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MediaAsset } from '@/lib/types';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import MediaAssetCard from './media-asset-card';
import UploadButton from './upload-button';
import AddLinkButton from './add-link-button';
import { Search, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/context/WorkspaceContext';

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
}

export default function MediaSelectorDialog({ open, onOpenChange, onSelectAsset, filterType }: MediaSelectorDialogProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(filterType || 'image');

  const mediaCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'media');
  }, [firestore]);

  const mediaQuery = useMemoFirebase(() => {
    if (!mediaCol || !activeWorkspaceId) return null;
    return query(
        mediaCol, 
        where('workspaceIds', 'array-contains', activeWorkspaceId),
        where('type', '==', activeTab),
        orderBy('createdAt', 'desc')
    );
  }, [mediaCol, activeWorkspaceId, activeTab]);
  
  const { data: assets, isLoading, error } = useCollection<MediaAsset>(mediaQuery);

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    
    // type is already filtered on server
    if (!searchTerm) {
      return assets;
    }

    return assets.filter(asset =>
      asset.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [assets, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
        <DialogHeader className="px-8 pt-8 pb-6 border-b bg-muted/30 shrink-0">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">Media Library</DialogTitle>
          <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-left">
            Choose an institutional asset for the <strong>{activeWorkspaceId}</strong> workspace or upload a new one.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-background">
            <div className="p-6 border-b bg-muted/5 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full sm:w-auto">
                    <TabsList className="bg-background border shadow-sm h-10 p-1 rounded-xl">
                        {TABS.map(tab => (
                        <TabsTrigger 
                            key={tab} 
                            value={tab} 
                            className="rounded-lg font-black uppercase text-[10px] tracking-widest px-4" 
                            disabled={!!filterType && filterType !== tab}
                        >
                            {TAB_NAMES[tab]}
                        </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40 group-focus-within:text-primary group-focus-within:opacity-100 transition-all" />
                        <Input
                            placeholder="Filter by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-10 pl-9 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"
                        />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <AddLinkButton />
                        <UploadButton />
                    </div>
                </div>
            </div>

            <div className="flex-1 relative min-h-0">
                <ScrollArea className="h-full w-full">
                    <div className="p-6 sm:p-8 text-left">
                        {error && (
                            <div className="p-8 text-center text-destructive bg-destructive/5 rounded-2xl border border-destructive/20 mb-6">
                                <p className="font-bold text-sm uppercase tracking-tight">Sync Failure: {error.message}</p>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {isLoading ? (
                                Array.from({ length: 15 }).map((_, i) => (
                                    <Skeleton key={i} className="aspect-square rounded-[2rem]" />
                                ))
                            ) : filteredAssets.length > 0 ? (
                                filteredAssets.map(asset => (
                                    <MediaAssetCard key={asset.id} asset={asset} onCardClick={onSelectAsset} />
                                ))
                            ) : (
                                <div className="col-span-full py-32 text-center flex flex-col items-center justify-center gap-4 opacity-30 border-4 border-dashed rounded-[3rem]">
                                    <FolderOpen className="h-16 w-16" />
                                    <p className="font-black uppercase tracking-widest text-xs">No {activeTab}s found in library</p>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </div>
        
        <div className="p-4 border-t bg-muted/30 shrink-0 flex justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold rounded-xl px-8">Close Library</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
