'use client';

import * as React from 'react';
import { useState } from 'react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkspace } from '@/context/WorkspaceContext';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Image as ImageIcon, Search, Wand2, Plus, Edit3 } from 'lucide-react';
import type { ThumbnailDesign } from '@/lib/thumbnail/thumbnail-types';
import ThumbnailDesignerDialog from '@/components/shared/thumbnail-designer/ThumbnailDesignerDialog';

export default function ThumbnailsClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId, isLoading: isWorkspaceLoading } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  const [designerOpen, setDesignerOpen] = useState(false);
  const [editingDesign, setEditingDesign] = useState<ThumbnailDesign | undefined>(undefined);

  const designsCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'thumbnail_designs');
  }, [firestore]);

  const designsQuery = useMemoFirebase(() => {
    if (!designsCol || !activeWorkspaceId) return null;
    return query(
      designsCol,
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('updatedAt', 'desc')
    );
  }, [designsCol, activeWorkspaceId]);

  const { data: designs, isLoading: isDesignsLoading } = useCollection<ThumbnailDesign>(designsQuery);

  const filteredDesigns = React.useMemo(() => {
    if (!designs) return [];
    if (!searchTerm.trim()) return designs;
    const s = searchTerm.toLowerCase();
    return designs.filter((d) => d.name.toLowerCase().includes(s));
  }, [designs, searchTerm]);

  const handleEdit = (design: ThumbnailDesign) => {
    setEditingDesign(design);
    setDesignerOpen(true);
  };

  const handleCreateNew = () => {
    setEditingDesign(undefined);
    setDesignerOpen(true);
  };

  const handleSaveComplete = () => {
    setDesignerOpen(false);
  };

  const isLoading = isWorkspaceLoading || isDesignsLoading;

  return (
    <PageContainerFluid>
      <div className="h-full overflow-y-auto w-full text-left space-y-6 pb-24 animate-in fade-in duration-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-450 via-teal-400 to-blue-500 bg-clip-text text-transparent">
              AI Thumbnail Studio
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              Create scroll-stopping, high-CTR video cover thumbnails with AI.
            </p>
          </div>
          <Button onClick={handleCreateNew} className="bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] font-bold rounded-xl text-xs h-10 px-5 transition-all">
            <Plus className="w-4 h-4 mr-1" /> Create Thumbnail
          </Button>
        </div>

        {/* Search filter bar */}
        <div className="flex gap-3 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
            <Input
              placeholder="Search designs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 bg-slate-900 border-slate-800 text-xs font-semibold text-slate-200 rounded-xl"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="aspect-video rounded-2xl bg-slate-900 animate-pulse border border-slate-850" />
            ))}
          </div>
        ) : filteredDesigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border border-slate-800 rounded-3xl bg-slate-900/10 text-center space-y-4">
            <div className="p-4 bg-slate-900 border border-slate-850 rounded-2xl text-slate-500">
              <ImageIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-200">No Thumbnails Found</h3>
              <p className="text-xs font-medium text-slate-400 mt-1">
                Start from a CTR layout formula or describe your topic to the AI Architect.
              </p>
            </div>
            <Button onClick={handleCreateNew} className="bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-xs font-bold rounded-xl h-9 px-4 transition-all">
              <Wand2 className="w-3.5 h-3.5 mr-1" /> Design with AI
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filteredDesigns.map((d) => (
              <div
                key={d.id}
                className="group relative border border-slate-800 bg-slate-900/30 rounded-2xl overflow-hidden hover:border-slate-700 transition-all flex flex-col shadow-lg"
              >
                <div className="aspect-video bg-slate-950 relative overflow-hidden flex items-center justify-center">
                  {d.thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img 
                      src={d.thumbnailUrl} 
                      alt={d.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs font-bold bg-slate-900/50">
                      No Preview
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button onClick={() => handleEdit(d)} size="sm" className="bg-white text-slate-900 hover:bg-slate-100 rounded-lg font-bold text-xs h-8 px-4 transition-colors">
                      <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between bg-slate-900/40">
                  <div className="font-bold text-xs text-slate-200 truncate" title={d.name}>{d.name}</div>
                  <div className="text-[10px] text-slate-400 font-medium mt-2">
                    Updated {new Date(d.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {designerOpen && activeWorkspaceId && (
          <ThumbnailDesignerDialog
            open={designerOpen}
            onOpenChange={setDesignerOpen}
            workspaceId={activeWorkspaceId}
            initialDesign={editingDesign}
            onSave={handleSaveComplete}
          />
        )}
      </div>
    </PageContainerFluid>
  );
}
