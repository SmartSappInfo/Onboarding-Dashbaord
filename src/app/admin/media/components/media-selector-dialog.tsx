'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MediaAsset } from '@/lib/types';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import MediaAssetCard from './media-asset-card';
import UploadButton from './upload-button';

const TABS: MediaAsset['type'][] = ['image', 'video', 'audio', 'document'];
const TAB_NAMES: Record<MediaAsset['type'], string> = {
  image: 'Images',
  video: 'Videos',
  audio: 'Audio',
  document: 'Documents',
};


interface MediaSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAsset: (asset: MediaAsset) => void;
  filterType?: MediaAsset['type'];
}

export default function MediaSelectorDialog({ open, onOpenChange, onSelectAsset, filterType }: MediaSelectorDialogProps) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(filterType || 'image');

  const mediaCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'media');
  }, [firestore]);

  const mediaQuery = useMemoFirebase(() => {
    if (!mediaCol) return null;
    return query(mediaCol, orderBy('createdAt', 'desc'));
  }, [mediaCol]);
  
  const { data: assets, isLoading, error } = useCollection<MediaAsset>(mediaQuery);

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    
    let currentAssets = assets.filter(asset => asset.type === activeTab);
    
    if (!searchTerm) {
      return currentAssets;
    }

    return currentAssets.filter(asset =>
      asset.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [assets, activeTab, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Select a Media Asset</DialogTitle>
          <DialogDescription>
            Choose an asset from your library or upload a new one.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between gap-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList>
                        {TABS.map(tab => (
                        <TabsTrigger key={tab} value={tab} className="capitalize" disabled={!!filterType && filterType !== tab}>{TAB_NAMES[tab]}</TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
                <div className="w-full max-w-xs">
                    <Input
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                 <UploadButton />
            </div>
            <div className="flex-grow relative border rounded-lg">
                <ScrollArea className="absolute inset-0">
                    <div className="p-4">
                    {error && <div className="text-destructive">Error loading media: {error.message}</div>}
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {isLoading ? (
                            Array.from({ length: 10 }).map((_, i) => (
                            <Skeleton key={i} className="aspect-square rounded-lg" />
                            ))
                        ) : filteredAssets.length > 0 ? (
                            filteredAssets.map(asset => (
                                <MediaAssetCard key={asset.id} asset={asset} onCardClick={onSelectAsset} />
                            ))
                        ) : (
                            <div className="col-span-full py-20 text-center text-muted-foreground">
                                No {activeTab}s found.
                            </div>
                        )}
                    </div>
                    </div>
                </ScrollArea>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
