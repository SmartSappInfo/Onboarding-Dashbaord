'use client';

/**
 * ARCHITECTURE:
 * Asset Library Client (Creative Studio 2.0 - Phase 1)
 * 
 * Central asset repository for uploaded media, isolated AI cutouts,
 * brand watermarks, and vector shapes.
 * 
 * CAUTION:
 * Mobile responsive layout with min-h-[44px] touch targets.
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useMemo } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { CreativeAsset } from '@/lib/creative/creative-types';
import { removeImageBackgroundAction } from '@/app/actions/media-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FolderOpen,
  Search,
  Upload,
  Image as ImageIcon,
  Scissors,
  Copy,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import MediaUploader from '@/app/admin/media/components/media-uploader';

export function AssetLibraryClient() {
  const { activeWorkspaceId } = useWorkspace();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showUploader, setShowUploader] = useState(false);
  const [processingCutoutId, setProcessingCutoutId] = useState<string | null>(null);

  const assetsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'creative_assets'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: assets, isLoading } = useCollection<CreativeAsset>(assetsQuery);

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    return assets.filter((a) => {
      const matchSearch =
        !searchTerm.trim() ||
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.tags && a.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())));

      const matchType = selectedType === 'all' || a.type === selectedType;
      return matchSearch && matchType;
    });
  }, [assets, searchTerm, selectedType]);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: 'URL Copied', description: 'Asset URL copied to clipboard.' });
  };

  const handleExtractCutout = async (asset: CreativeAsset) => {
    setProcessingCutoutId(asset.id);
    try {
      await removeImageBackgroundAction(asset.previewUrl);
      toast({ title: 'Subject Isolated', description: 'Background removed successfully.' });
    } catch {
      toast({ title: 'Cutout Failed', description: 'Could not isolate subject.', variant: 'destructive' });
    } finally {
      setProcessingCutoutId(null);
    }
  };

  const TYPE_TABS = [
    { id: 'all', label: 'All Assets' },
    { id: 'image', label: 'Images' },
    { id: 'cutout', label: 'AI Cutouts' },
    { id: 'logo', label: 'Brand Logos' },
    { id: 'icon', label: 'Icons' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-2">
            <FolderOpen className="w-3.5 h-3.5" /> Workspace Repository
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Asset Library</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1">
            Store, organize, and isolate subjects for all your marketing and visual projects.
          </p>
        </div>

        <Button
          onClick={() => setShowUploader(!showUploader)}
          className="bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-slate-950 font-black rounded-xl text-xs h-10 px-5 shadow-lg shadow-emerald-500/20 transition-all min-h-[44px]"
        >
          <Upload className="w-4 h-4 mr-1.5" /> {showUploader ? 'Close Uploader' : 'Upload Asset'}
        </Button>
      </div>

      {/* Media Uploader Drawer */}
      {showUploader && activeWorkspaceId && (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="text-sm font-bold text-white">Upload New Creative Asset</div>
          <MediaUploader
            defaultWorkspaceId={activeWorkspaceId}
            onUploadSuccess={() => {
              setShowUploader(false);
              toast({ title: 'Upload Complete', description: 'New asset added to workspace.' });
            }}
          />
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedType(tab.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all min-h-[36px] active:scale-[0.97]',
                selectedType === tab.id
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search assets..."
            className="pl-10 h-10 bg-slate-900 border-slate-800 text-xs font-semibold text-slate-200 rounded-xl"
          />
        </div>
      </div>

      {/* Assets Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="aspect-square rounded-2xl bg-slate-900 animate-pulse border border-slate-850" />
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="p-12 border border-slate-850 rounded-3xl bg-slate-900/20 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-slate-200">No Assets Found</div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Upload images, cutouts, or brand logos to reuse them across all your canvas designs.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className="group relative border border-slate-850 bg-slate-900/40 rounded-2xl overflow-hidden hover:border-slate-700 transition-all flex flex-col shadow-lg"
            >
              <div className="aspect-square bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-850">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.previewUrl}
                  alt={asset.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    onClick={() => handleCopyUrl(asset.previewUrl)}
                    size="sm"
                    className="h-8 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
                    title="Copy URL"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    onClick={() => handleExtractCutout(asset)}
                    disabled={processingCutoutId === asset.id}
                    size="sm"
                    className="h-8 px-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg text-xs font-bold"
                    title="Isolate Subject (AI Cutout)"
                  >
                    {processingCutoutId === asset.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Scissors className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-slate-900/50">
                <div className="font-bold text-xs text-white truncate" title={asset.name}>
                  {asset.name}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">
                  {asset.type}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
