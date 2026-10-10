'use client';

import * as React from 'react';
import { useState } from 'react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useWorkspace } from '@/context/WorkspaceContext';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import Link from 'next/link';
import { Image as ImageIcon, Search, Wand2, Plus, Edit3, Sparkles } from 'lucide-react';
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
    return designs.filter((d) => Boolean(d.name?.toLowerCase().includes(s)));
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
        {/* Header with title tooltip and integrated filter/action controls */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold text-foreground">
              AI Thumbnail Studio
            </h1>
            <CardInfoTooltip text="Create scroll-stopping, high-CTR video cover thumbnails with AI." />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            <div className="relative w-full sm:w-60 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
              <Input
                placeholder="Search designs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 min-h-[44px] bg-card border border-border text-foreground placeholder:text-muted-foreground rounded-xl shadow-xs transition-all font-medium text-xs w-full"
              />
            </div>
            <Button
              variant="outline"
              asChild
              className="rounded-xl font-bold shadow-xs h-11 min-h-[44px] px-5 transition-all active:scale-[0.97] text-xs shrink-0 w-full sm:w-auto border-border/80 bg-card hover:bg-muted/50"
            >
              <Link href="/admin/creative-studio">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Creative Studio
              </Link>
            </Button>
            <Button
              onClick={handleCreateNew}
              className="rounded-xl font-bold shadow-md h-11 min-h-[44px] px-6 transition-all active:scale-[0.97] text-xs shrink-0 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Thumbnail
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="aspect-video rounded-2xl bg-muted/40 animate-pulse border border-border/80 shadow-xs" />
            ))}
          </div>
        ) : filteredDesigns.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 border border-border/80 rounded-2xl bg-card text-center space-y-4 shadow-xs">
            <div className="p-4 bg-muted/40 border border-border/80 rounded-2xl text-muted-foreground">
              <ImageIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Thumbnails Found</h3>
              <p className="text-xs font-medium text-muted-foreground mt-1">
                Start from a CTR layout formula or describe your topic to the AI Architect.
              </p>
            </div>
            <Button
              onClick={handleCreateNew}
              className="rounded-xl font-bold shadow-md h-10 px-5 transition-all active:scale-[0.97] text-xs"
            >
              <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Design with AI
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filteredDesigns.map((d) => (
              <Card
                key={d.id}
                className="group relative border border-border/80 bg-card rounded-2xl overflow-hidden hover:border-border transition-all flex flex-col shadow-xs"
              >
                <div className="aspect-video bg-muted/30 relative overflow-hidden flex items-center justify-center border-b border-border/80">
                  {d.thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img 
                      src={d.thumbnailUrl} 
                      alt={d.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-semibold">
                      No Preview
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                    <Button
                      onClick={() => handleEdit(d)}
                      size="sm"
                      variant="secondary"
                      className="rounded-xl font-bold text-xs h-8 px-4 transition-all active:scale-[0.97] shadow-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between bg-card">
                  <div className="font-bold text-xs text-card-foreground truncate" title={d.name}>{d.name}</div>
                  <div className="text-[10px] text-muted-foreground font-medium mt-2">
                    Updated {new Date(d.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </Card>
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
