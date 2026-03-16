
'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MediaAsset } from '@/lib/types';

import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Film, LayoutList } from 'lucide-react';
import MediaAssetCard from './components/media-asset-card';
import UploadButton from './components/upload-button';
import AddLinkButton from './components/add-link-button';
import { useWorkspace } from '@/context/WorkspaceContext';

const TABS = [
  { id: 'images', label: 'Images' },
  { id: 'videos', label: 'Videos' },
  { id: 'audio', label: 'Audio' },
  { id: 'documents', label: 'Documents' },
  { id: 'links', label: 'Links' },
];

export default function MediaClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('images');
  
  const mediaCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'media');
  }, [firestore]);

  const mediaQuery = useMemoFirebase(() => {
    if (!mediaCol || !activeWorkspaceId) return null;
    return query(
        mediaCol, 
        where('workspaceId', '==', activeWorkspaceId),
        orderBy('createdAt', 'desc')
    );
  }, [mediaCol, activeWorkspaceId]);
  
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

    const s = searchTerm.toLowerCase();
    return tabFiltered.filter(asset =>
      asset.name.toLowerCase().includes(s) || 
      asset.linkTitle?.toLowerCase().includes(s)
    );
  }, [assets, activeTab, searchTerm]);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
      <div className="max-w-7xl mx-auto space-y-8 text-left">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex flex-col items-start">
                <h1 className="text-3xl font-black uppercase tracking-tight">Media Hub</h1>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Workspace Assets for {activeWorkspaceId}</p>
            </div>
            <div className="flex justify-end items-center gap-3 shrink-0">
                <AddLinkButton />
                <UploadButton />
            </div>
        </div>

        <Card className="border-none shadow-sm ring-1 ring-border rounded-3xl overflow-hidden bg-card">
            <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4 text-left">
                <div className="relative flex-grow w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                    <Input 
                        placeholder="Filter your assets..." 
                        className="pl-11 h-12 rounded-2xl bg-muted/20 border-none font-bold text-sm shadow-none focus:ring-1 focus:ring-primary/20" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="shrink-0 w-full md:w-auto">
                    <TabsList className="bg-muted/30 h-12 p-1 rounded-2xl border w-full">
                        {TABS.map(tab => (
                            <TabsTrigger 
                                key={tab.id} 
                                value={tab.id} 
                                className="rounded-xl font-bold text-[11px] tracking-wide px-6 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md transition-all"
                            >
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </CardContent>
        </Card>

        <div className="min-h-[600px]">
          {error && (
            <Card className="border-destructive/20 bg-destructive/5 mb-8">
                <CardContent className="p-6 flex items-center gap-3 text-destructive">
                    <LayoutList className="h-5 w-5" />
                    <p className="font-bold text-sm uppercase tracking-tight">Repository Sync Failure: {error.message}</p>
                </CardContent>
            </Card>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-[2rem]" />
              ))
            ) : filteredAssets.length > 0 ? (
              filteredAssets.map(asset => (
                <MediaAssetCard key={asset.id} asset={asset} />
              ))
            ) : (
              <div className="col-span-full py-32 text-center border-4 border-dashed rounded-[4rem] bg-card/50 flex flex-col items-center justify-center gap-4 opacity-30">
                <Film className="h-16 w-16" />
                <p className="font-black uppercase tracking-widest text-xs">No {activeTab} in this workspace</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
