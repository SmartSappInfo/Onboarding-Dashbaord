
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

/**
 * @fileOverview Media Hub Client.
 * Displays a workspace-bound gallery of digital assets using server-side filtering.
 */

const TABS = [
  { id: 'images', label: 'Images', type: 'image' },
  { id: 'videos', label: 'Videos', type: 'video' },
  { id: 'audio', label: 'Audio', type: 'audio' },
  { id: 'documents', label: 'Documents', type: 'document' },
  { id: 'links', label: 'Links', type: 'link' },
];

export default function MediaClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId, isLoading: isWorkspaceLoading } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('images');
  
  const currentType = useMemo(() => 
    TABS.find(t => t.id === activeTab)?.type || 'image', 
  [activeTab]);

  const mediaCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'media');
  }, [firestore]);

  // HIGH PERFORMANCE: Filter by workspace AND type on the server
  const mediaQuery = useMemoFirebase(() => {
    if (!mediaCol || !activeWorkspaceId) return null;
    return query(
        mediaCol, 
        where('workspaceIds', 'array-contains', activeWorkspaceId),
        where('type', '==', currentType),
        orderBy('createdAt', 'desc')
    );
  }, [mediaCol, activeWorkspaceId, currentType]);
  
  const { data: assets, isLoading: isMediaLoading, error } = useCollection<MediaAsset>(mediaQuery);

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    
    // type is already filtered on server, we only handle search here
    if (!searchTerm) {
      return assets;
    }

    const s = searchTerm.toLowerCase();
    return assets.filter(asset =>
      asset.name.toLowerCase().includes(s) || 
      asset.linkTitle?.toLowerCase().includes(s)
    );
  }, [assets, searchTerm]);

  const isLoading = isWorkspaceLoading || isMediaLoading;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-8 text-left">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex flex-col items-start">
                <h1 className="text-3xl font-black uppercase tracking-tight">Media Hub</h1>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                    Workspace Assets for {activeWorkspaceId || 'Global Hub'}
                </p>
            </div>
            <div className="flex justify-end items-center gap-3 shrink-0">
                <AddLinkButton />
                <UploadButton />
            </div>
        </div>

        <Card className="border-none shadow-sm ring-1 ring-border rounded-[2.5rem] overflow-hidden glass-card bg-card">
            <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4 text-left">
                <div className="relative flex-grow w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                    <Input 
                        placeholder="Filter your assets..." 
                        className="pl-11 h-12 rounded-2xl bg-background/50 border-none font-bold text-sm shadow-none focus:ring-1 focus:ring-primary/20" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="shrink-0 w-full md:w-auto">
                    <TabsList className="bg-card/20 h-12 p-1 rounded-2xl border w-full">
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
                <CardContent className="p-6 flex items-center gap-3 text-destructive text-left">
                    <LayoutList className="h-5 w-5" />
                    <div className="space-y-1">
                        <p className="font-bold text-sm uppercase tracking-tight">Repository Sync Failure</p>
                        <p className="text-xs opacity-70 leading-relaxed">The system encountered an error while polling the media registry. This is usually due to a missing search index in Firestore.</p>
                    </div>
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
              <div className="col-span-full py-32 text-center border-4 border-dashed rounded-[4rem] bg-background/20 flex flex-col items-center justify-center gap-4 opacity-30">
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
