'use client';

import * as React from 'react';
import { Image as ImageIcon, Search, Plus, Trash2, Link as LinkIcon, FileCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listAllAssets, deleteAssetRecord } from '@/lib/backoffice/backoffice-asset-actions';
import { useBackoffice } from '../../context/BackofficeProvider';
import type { PlatformAsset, PlatformAssetCategory } from '@/lib/backoffice/backoffice-types';

export default function AssetLibraryClient() {
  const { can, profile } = useBackoffice();
  const [assets, setAssets] = React.useState<PlatformAsset[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('all');

  React.useEffect(() => {
    load();
  }, []);

  async function load() {
    setIsLoading(true);
    const res = await listAllAssets();
    if (res.success && res.data) {
      setAssets(res.data);
    }
    setIsLoading(false);
  }

  const filteredAssets = React.useMemo(() => {
    return assets.filter(a => {
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === 'all' || a.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [assets, search, categoryFilter]);

  const categories = React.useMemo(() => {
     return Array.from(new Set(assets.map(a => a.category))).sort();
  }, [assets]);

  const handleDelete = async (asset: PlatformAsset) => {
     if (!profile) return;
     if (!confirm(`Delete asset "${asset.name}"? This action cannot be undone.`)) return;
     
     const res = await deleteAssetRecord(asset.id, {
       userId: profile.id,
       name: profile.name,
       email: profile.email,
       role: 'super_admin'
     });
     
     if (res.success) load();
     else alert('Failed to delete asset. ' + res.error);
  };

  const formatSize = (bytes: number) => {
     if (bytes === 0) return '0 B';
     const k = 1024;
     const sizes = ['B', 'KB', 'MB', 'GB'];
     const i = Math.floor(Math.log(bytes) / Math.log(k));
     return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Global Assets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage system-wide static files, default icons, logic assets, and documents.
          </p>
        </div>
        {can('assets', 'create') && (
           <Button className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-10 px-4">
              <Plus className="h-4 w-4 mr-2" /> Upload Asset
           </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 rounded-xl focus:border-emerald-500/50 focus:ring-emerald-500/20"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 h-10 bg-muted/50 border-border text-foreground rounded-xl">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[1,2,3,4].map(i => <div key={i} className="h-48 bg-accent/40 rounded-xl animate-pulse border border-border" />)}
          </div>
      ) : filteredAssets.length === 0 ? (
          <div className="text-center py-20 bg-muted/30 rounded-2xl border border-border border-dashed relative overflow-hidden">
             <div className="absolute inset-0 bg-[radial-gradient(#1E293B_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
             <ImageIcon className="h-12 w-12 text-slate-600 mx-auto mb-4 relative z-10" />
             <p className="text-lg font-semibold text-foreground relative z-10">Asset Library is Empty</p>
             <p className="text-sm text-muted-foreground mt-1 relative z-10">Upload system logos or default templates to begin.</p>
          </div>
      ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
             {filteredAssets.map(asset => (
                <div key={asset.id} className="group rounded-xl border border-border/70 bg-accent/20 overflow-hidden flex flex-col hover:border-emerald-500/40 transition-colors">
                   {/* Preview Area */}
                   <div className="h-32 bg-background/80 flex items-center justify-center p-4 relative overflow-hidden">
                      {asset.mimeType.startsWith('image/') ? (
                         // eslint-disable-next-line @next/next/no-img-element
                         <img src={asset.thumbnailUrl || asset.url} alt={asset.name} className="max-w-full max-h-full object-contain" />
                      ) : (
                         <FileCheck className="h-10 w-10 text-slate-600" />
                      )}
                      
                      {asset.isDefault && (
                         <div className="absolute top-2 right-2 flex gap-1">
                             <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] uppercase px-1.5 h-5 shadow-lg blur-0 backdrop-blur-md">
                                Default
                             </Badge>
                         </div>
                      )}
                      
                      <div className="absolute inset-0 bg-background/80 items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex backdrop-blur-sm">
                         <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-white/10 text-foreground hover:bg-white/20" onClick={() => window.open(asset.url, '_blank')}>
                            <LinkIcon className="h-4 w-4" />
                         </Button>
                         {can('assets', 'delete') && (
                            <Button size="icon" variant="destructive" className="h-8 w-8 rounded-full" onClick={() => handleDelete(asset)}>
                               <Trash2 className="h-4 w-4" />
                            </Button>
                         )}
                      </div>
                   </div>
                   
                   {/* Metadata Area */}
                   <div className="p-3 bg-accent/40 flex-1 flex flex-col justify-between">
                      <div>
                         <h4 className="text-sm font-semibold text-foreground truncate" title={asset.name}>{asset.name}</h4>
                         <p className="text-[10px] text-muted-foreground capitalize truncate mt-0.5">{asset.category.replace('-', ' ')}</p>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                         <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{formatSize(asset.sizeBytes || 0)}</span>
                         <span className="text-[10px] text-muted-foreground">{asset.usageCount || 0} Uses</span>
                      </div>
                   </div>
                </div>
             ))}
          </div>
      )}
    </div>
  );
}
