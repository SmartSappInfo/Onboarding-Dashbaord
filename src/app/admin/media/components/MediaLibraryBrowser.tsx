'use client';

import { useState, useMemo } from 'react';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { MediaAsset } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import MediaAssetCard from './media-asset-card';
import UploadButton from './upload-button';
import AddLinkButton from './add-link-button';
import { Search, FolderOpen, Filter, HardDrive, Youtube, Zap, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';

export type SourceFilterType = 'ALL' | 'HOSTED' | 'LINKED';
export type SetupFilterType = 'ALL' | 'CONFIGURED' | 'STANDBY';

const TABS: MediaAsset['type'][] = ['image', 'video', 'audio', 'document', 'link'];
const TAB_NAMES: Record<MediaAsset['type'], string> = {
  image: 'Images',
  video: 'Videos',
  audio: 'Audio',
  document: 'Documents',
  link: 'Links',
};

interface MediaLibraryBrowserProps {
  onSelectAsset: (asset: MediaAsset) => void;
  filterType?: MediaAsset['type'];
  workspaceId?: string;
  isCompact?: boolean;
}

export default function MediaLibraryBrowser({ 
  onSelectAsset, 
  filterType,
  workspaceId: forcedWorkspaceId,
  isCompact = false
}: MediaLibraryBrowserProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId, isSuperAdmin } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilterType>('ALL');
  const [setupFilter, setSetupFilter] = useState<SetupFilterType>('ALL');
  const [activeTab, setActiveTab] = useState(filterType || 'image');
  
  const effectiveWorkspaceId = forcedWorkspaceId || activeWorkspaceId;

  const mediaCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'media');
  }, [firestore]);

  const mediaQuery = useMemoFirebase(() => {
    if (!mediaCol) return null;
    
    // Base query filtered by type
    let q = query(mediaCol, where('type', '==', activeTab), orderBy('createdAt', 'desc'));

    // Apply workspace filter only if we're not in a "global" super-admin context
    // OR if a specific workspace was requested.
    if (effectiveWorkspaceId && effectiveWorkspaceId !== 'global') {
        q = query(mediaCol, where('workspaceIds', 'array-contains', effectiveWorkspaceId), where('type', '==', activeTab), orderBy('createdAt', 'desc'));
    } else if (effectiveWorkspaceId === 'global' || isSuperAdmin) {
        // For global or super admin, we show all assets of this type
        q = query(mediaCol, where('type', '==', activeTab), orderBy('createdAt', 'desc'));
    } else {
        // If no workspace and not super admin, they shouldn't see anything
        return null;
    }

    return q;
  }, [mediaCol, effectiveWorkspaceId, activeTab, isSuperAdmin]);
  
  const { data: assets, isLoading, error } = useCollection<MediaAsset>(mediaQuery);

  /**
   * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
   * To prevent listener proliferation (creating N Firestore listeners for N asset cards),
   * we subscribe to media_shares ONCE per workspace and compute a Set of configured asset IDs.
   * We pass isConfigured={configuredAssetIds.has(asset.id)} into <MediaAssetCard />.
   */
  const sharesQuery = useMemoFirebase(() => {
    if (!firestore || !effectiveWorkspaceId) return null;
    return query(collection(firestore, 'media_shares'), where('workspaceId', '==', effectiveWorkspaceId));
  }, [firestore, effectiveWorkspaceId]);

  const { data: sharesData } = useCollection<{ id: string; assetId: string }>(sharesQuery);

  const configuredAssetIds = useMemo(() => {
    const set = new Set<string>();
    if (sharesData) {
      sharesData.forEach((s) => {
        if (s.assetId) set.add(s.assetId);
      });
    }
    return set;
  }, [sharesData]);

  /**
   * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
   * Multi-dimensional client-side filtering combines search term, Source Filter (Hosted MP4 vs Linked Video),
   * and Setup Status Filter (Active Page vs Standby Asset) without triggering extra Firestore read queries.
   */
  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    
    return assets.filter(asset => {
      // 1. Text Search Filter
      if (searchTerm.trim() && !asset.name.toLowerCase().includes(searchTerm.toLowerCase().trim())) {
        return false;
      }

      // 2. Source Filter (Cloud-Hosted MP4 vs Linked YouTube/Vimeo/Loom)
      const url = asset.url.toLowerCase();
      const isLinked = asset.type === 'link' || 
        url.includes('youtube.com') || 
        url.includes('youtu.be') || 
        url.includes('vimeo.com') || 
        url.includes('loom.com');

      if (sourceFilter === 'HOSTED' && isLinked) {
        return false;
      }
      if (sourceFilter === 'LINKED' && !isLinked) {
        return false;
      }

      // 3. Setup Status Filter (Configured vs Standby)
      const isConfigured = configuredAssetIds.has(asset.id);
      if (setupFilter === 'CONFIGURED' && !isConfigured) {
        return false;
      }
      if (setupFilter === 'STANDBY' && isConfigured) {
        return false;
      }

      return true;
    });
  }, [assets, searchTerm, sourceFilter, setupFilter, configuredAssetIds]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-background">
      <div className={cn(
        "p-6 border-b bg-background flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0",
        isCompact && "p-4 gap-2"
      )}>
      {!filterType && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MediaAsset['type'])} className="w-full sm:w-auto">
          <TabsList className="bg-background border shadow-sm h-10 p-1 rounded-xl">
            {TABS.map(tab => (
              <TabsTrigger 
                key={tab} 
                value={tab} 
                className="rounded-lg font-semibold text-[10px] px-4" 
              >
                {TAB_NAMES[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      
      {filterType && (
        <div className="flex flex-col text-left">
          <h3 className="text-lg font-bold tracking-tight capitalize">{activeTab} Library</h3>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">Choose an institutional asset</p>
        </div>
      )}
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className={cn("relative w-full sm:w-64 group", isCompact && "sm:w-48")}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40 group-focus-within:text-primary group-focus-within:opacity-100 transition-all" />
            <Input
              placeholder="Filter by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-9 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-xs"
            />
          </div>

          {/* Source & Setup Filter Controls */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`h-10 px-3 rounded-xl border font-bold text-xs gap-1.5 shrink-0 transition-all min-h-[44px] ${
                  sourceFilter !== 'ALL' || setupFilter !== 'ALL'
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/10 text-primary shadow-sm'
                    : 'border-border bg-background hover:bg-muted/50 text-foreground'
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {sourceFilter !== 'ALL'
                    ? sourceFilter === 'HOSTED' ? 'Hosted MP4' : 'Linked Videos'
                    : setupFilter !== 'ALL'
                    ? setupFilter === 'CONFIGURED' ? 'Active Pages' : 'Standby Assets'
                    : 'Filter Assets'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-border shadow-2xl">
              <DropdownMenuLabel className="text-[10px] font-black text-muted-foreground uppercase px-3 py-1">
                Source Type
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setSourceFilter('ALL')}
                className={`rounded-xl px-3 py-2 text-xs font-bold gap-2 cursor-pointer ${sourceFilter === 'ALL' ? 'bg-primary/10 text-primary font-black' : ''}`}
              >
                All Video Sources
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSourceFilter('HOSTED')}
                className={`rounded-xl px-3 py-2 text-xs font-bold gap-2 cursor-pointer ${sourceFilter === 'HOSTED' ? 'bg-primary/10 text-primary font-black' : ''}`}
              >
                <HardDrive className="h-3.5 w-3.5 text-indigo-400" />
                Cloud-Hosted MP4
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSourceFilter('LINKED')}
                className={`rounded-xl px-3 py-2 text-xs font-bold gap-2 cursor-pointer ${sourceFilter === 'LINKED' ? 'bg-primary/10 text-primary font-black' : ''}`}
              >
                <Youtube className="h-3.5 w-3.5 text-red-500" />
                Linked / Embeds
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1.5" />

              <DropdownMenuLabel className="text-[10px] font-black text-muted-foreground uppercase px-3 py-1">
                Page Setup Status
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setSetupFilter('ALL')}
                className={`rounded-xl px-3 py-2 text-xs font-bold gap-2 cursor-pointer ${setupFilter === 'ALL' ? 'bg-primary/10 text-primary font-black' : ''}`}
              >
                All Setup Statuses
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSetupFilter('CONFIGURED')}
                className={`rounded-xl px-3 py-2 text-xs font-bold gap-2 cursor-pointer ${setupFilter === 'CONFIGURED' ? 'bg-primary/10 text-primary font-black' : ''}`}
              >
                <Zap className="h-3.5 w-3.5 text-emerald-500" />
                Active Pages (Configured)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSetupFilter('STANDBY')}
                className={`rounded-xl px-3 py-2 text-xs font-bold gap-2 cursor-pointer ${setupFilter === 'STANDBY' ? 'bg-primary/10 text-primary font-black' : ''}`}
              >
                <span className="h-2 w-2 rounded-full bg-slate-400 ml-0.5 mr-0.5" />
                Standby Assets (Unconfigured)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-2 shrink-0">
            <AddLinkButton />
            <UploadButton workspaceId={effectiveWorkspaceId} />
          </div>
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        <ScrollArea className="h-full w-full">
          <div className={cn("p-6 sm:p-8 text-left", isCompact && "p-4")}>
            {error && (
              <div className="p-8 text-center text-destructive bg-destructive/5 rounded-2xl border border-destructive/20 mb-6">
                <p className="font-bold text-sm tracking-tight">Sync Failure: {error.message}</p>
              </div>
            )}
            
            <div className={cn(
              "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6",
              isCompact && "gap-4 grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            )}>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-[2rem]" />
                ))
              ) : filteredAssets.length > 0 ? (
                filteredAssets.map(asset => (
                  <MediaAssetCard 
                    key={asset.id} 
                    asset={asset} 
                    isConfigured={configuredAssetIds.has(asset.id)}
                    onCardClick={onSelectAsset} 
                  />
                ))
              ) : (
                <div className="col-span-full py-32 text-center flex flex-col items-center justify-center gap-6 opacity-40 border-4 border-dashed rounded-[3rem] bg-muted/5">
                  <div className="h-20 w-20 rounded-[2.5rem] bg-background shadow-sm flex items-center justify-center">
                    <FolderOpen className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-sm tracking-tight text-foreground">No {activeTab}s found in library</p>
                    <p className="text-[10px] font-medium text-muted-foreground">Upload a new file to get started.</p>
                  </div>
                  <UploadButton workspaceId={effectiveWorkspaceId} />
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
