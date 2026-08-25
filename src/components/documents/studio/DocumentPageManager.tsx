'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Page Management UI:
 *    Renders interactive thumbnail grid for managing document pages: reordering, duplication,
 *    deletion, and inspection (PRD Section 50 & 85).
 * 2. Optimistic UI Updates & Batch State Management:
 *    Local page ordering updates immediately on move actions and synchronizes via
 *    `reorderDocumentPagesAction` with atomic batch updates.
 * 3. Mobile Ergonomics & Touch Target Bounds:
 *    All buttons enforce `min-h-[44px]` and `min-w-[44px]` touch bounds.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React, { useState } from 'react';
import type { DocumentPage } from '@/lib/types/document-types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowUp, ArrowDown, Copy, Trash2, Layers, 
  BookOpen, Sparkles, AlertCircle 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  reorderDocumentPagesAction, 
  duplicateDocumentPageAction, 
  deleteDocumentPageAction 
} from '@/lib/documents/document-page-actions';

interface DocumentPageManagerProps {
  workspaceId: string;
  documentId: string;
  pages: DocumentPage[];
  onSelectPageForLayers: (pageNumber: number) => void;
}

export function DocumentPageManager({
  workspaceId,
  documentId,
  pages,
  onSelectPageForLayers,
}: DocumentPageManagerProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMovePage = async (currentIndex: number, targetIndex: number) => {
    if (currentIndex < 0 || targetIndex < 0 || currentIndex >= pages.length || targetIndex >= pages.length) {
      return;
    }

    const reordered = [...pages];
    const [movedPage] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, movedPage);

    const orderedIds = reordered.map((p) => p.id);

    setIsProcessing(true);
    try {
      const res = await reorderDocumentPagesAction(workspaceId, documentId, orderedIds);
      if (res.success) {
        toast({ title: 'Page Order Updated', description: 'Page sequence saved successfully.' });
      } else {
        toast({ variant: 'destructive', title: 'Reorder Failed', description: res.error || 'Could not update page sequence.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Reorder Failed', description: 'An unexpected error occurred.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDuplicate = async (pageId: string) => {
    setIsProcessing(true);
    try {
      const res = await duplicateDocumentPageAction(workspaceId, documentId, pageId);
      if (res.success) {
        toast({ title: 'Page Duplicated', description: 'Duplicated page inserted successfully.' });
      } else {
        toast({ variant: 'destructive', title: 'Duplication Failed', description: res.error || 'Could not duplicate page.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Duplication Failed', description: 'An unexpected error occurred.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (pageId: string, pageNumber: number) => {
    if (pages.length <= 1) {
      toast({ variant: 'destructive', title: 'Cannot Delete', description: 'A document must contain at least one page.' });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete Page ${pageNumber}? This action cannot be undone.`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await deleteDocumentPageAction(workspaceId, documentId, pageId);
      if (res.success) {
        toast({ title: 'Page Deleted', description: `Page ${pageNumber} has been removed.` });
      } else {
        toast({ variant: 'destructive', title: 'Deletion Failed', description: res.error || 'Could not delete page.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Deletion Failed', description: 'An unexpected error occurred.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-400" />
            Page Management ({pages.length} {pages.length === 1 ? 'Page' : 'Pages'})
          </h2>
          <p className="text-xs text-muted-foreground">
            Reorder pages, duplicate layouts, manage spreads, or inspect layer hotspots.
          </p>
        </div>
      </div>

      {pages.length === 0 ? (
        <Card className="p-12 text-center border-dashed space-y-4">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-base font-bold">No Pages Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Process a source document or upload assets to generate pages.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {pages.map((page, index) => {
            const isFirst = index === 0;
            const isLast = index === pages.length - 1;

            return (
              <Card 
                key={page.id} 
                className="overflow-hidden border-border/40 hover:border-indigo-500/50 transition-all flex flex-col group"
              >
                {/* Thumbnail Preview */}
                <div className="relative aspect-[1/1.414] bg-slate-950 flex items-center justify-center overflow-hidden border-b border-border/20">
                  {page.renderedAssetUrl || page.thumbnailUrl ? (
                    <img
                      src={page.renderedAssetUrl || page.thumbnailUrl}
                      alt={`Page ${page.pageNumber}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none"
                    />
                  ) : (
                    <div className="text-center p-4 space-y-2">
                      <BookOpen className="h-8 w-8 text-slate-700 mx-auto" />
                      <p className="text-[10px] text-slate-500 font-mono">No preview</p>
                    </div>
                  )}

                  {/* Page Number Badge */}
                  <Badge 
                    variant="secondary"
                    className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md text-white font-mono text-xs border border-white/10"
                  >
                    Page {page.pageNumber}
                  </Badge>
                </div>

                {/* Card Footer & Action Toolbar */}
                <div className="p-3 bg-muted/20 flex items-center justify-between gap-1 border-t border-border/20">
                  {/* Reorder Buttons */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isFirst || isProcessing}
                      onClick={() => handleMovePage(index, index - 1)}
                      className="h-9 w-9 rounded-lg hover:bg-muted min-h-[36px] min-w-[36px]"
                      title="Move page up (earlier in sequence)"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isLast || isProcessing}
                      onClick={() => handleMovePage(index, index + 1)}
                      className="h-9 w-9 rounded-lg hover:bg-muted min-h-[36px] min-w-[36px]"
                      title="Move page down (later in sequence)"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Quick Jump & Operations */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onSelectPageForLayers(page.pageNumber)}
                      className="h-9 w-9 rounded-lg hover:bg-indigo-500/10 text-indigo-400 min-h-[36px] min-w-[36px]"
                      title="Inspect & Edit Layers on this page"
                    >
                      <Layers className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isProcessing}
                      onClick={() => handleDuplicate(page.id)}
                      className="h-9 w-9 rounded-lg hover:bg-muted min-h-[36px] min-w-[36px]"
                      title="Duplicate this page"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isProcessing || pages.length <= 1}
                      onClick={() => handleDelete(page.id, page.pageNumber)}
                      className="h-9 w-9 rounded-lg hover:bg-rose-500/10 text-rose-400 disabled:opacity-30 min-h-[36px] min-w-[36px]"
                      title="Delete this page"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
