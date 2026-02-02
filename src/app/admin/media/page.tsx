'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, getFirestore } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MediaAsset } from '@/lib/types';

import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import MediaAssetCard from './components/media-asset-card';
import UploadButton from './components/upload-button';
import AddLinkButton from './components/add-link-button';

const TABS = ['images', 'videos', 'audio', 'documents', 'links'];

export default function MediaLibraryPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('images');
  
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
    
    const tabFiltered = assets.filter(asset => {
        if (activeTab === 'images') return asset.type === 'image';
        if (activeTab === 'videos') return asset.type === 'video';
        if (activeTab === 'audio') return asset.type === 'audio';
        if (activeTab === 'documents') return asset.type === 'document';
        if (activeTab === 'links') return asset.type === 'link';
        return false;
    });

    if (!searchTerm) {
      return tabFiltered;
    }

    return tabFiltered.filter(asset =>
      asset.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [assets, activeTab, searchTerm]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="w-full max-w-sm">
            <Input
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="flex items-center gap-2">
          <AddLinkButton />
          <UploadButton />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
            {TABS.map(tab => (
              <TabsTrigger key={tab} value={tab} className="capitalize">{tab}</TabsTrigger>
            ))}
        </TabsList>

        {TABS.map(tab => (
          <TabsContent key={tab} value={tab} className="mt-0 rounded-lg border bg-card p-4 shadow-sm">
            {error && <div className="text-destructive">Error loading media: {error.message}</div>}
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))
              ) : filteredAssets.length > 0 ? (
                filteredAssets.map(asset => (
                  <MediaAssetCard key={asset.id} asset={asset} />
                ))
              ) : (
                <div className="col-span-full py-20 text-center text-muted-foreground">
                  No {tab} found.
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
