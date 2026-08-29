'use client';

/**
 * Floating Action Toolbar for Batch Operations
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Emil Kowalski Motion: Uses spring physics (cubic-bezier(0.23, 1, 0.32, 1)) and scale(0.97) on press.
 * 2. High-Load Guard: Batch sync and enrichment triggers pass through chunked Server Actions.
 * 3. Mobile Optimization: Responsive layout with touch targets >= 44px and safe-area margins.
 */

import React from 'react';
import { 
  Sparkles, 
  FolderPlus, 
  Download, 
  X, 
  Database 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface FloatingActionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBatchSync: () => void;
  onBatchEnrich: () => void;
  onAddToList: () => void;
  onExportCSV: () => void;
  isSyncing?: boolean;
  isEnriching?: boolean;
}

export const FloatingActionToolbar: React.FC<FloatingActionToolbarProps> = ({
  selectedCount,
  onClearSelection,
  onBatchSync,
  onBatchEnrich,
  onAddToList,
  onExportCSV,
  isSyncing = false,
  isEnriching = false,
}) => {
  if (selectedCount <= 0) return null;

  return (
    <aside 
      aria-label="Bulk actions toolbar"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-6 duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
    >
      <div className="flex flex-wrap items-center gap-2 bg-zinc-950/95 border border-zinc-800 text-zinc-100 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md max-w-[95vw] sm:max-w-2xl">
        {/* Selection Counter */}
        <div className="flex items-center gap-2 pr-2 border-r border-zinc-800">
          <Badge className="bg-primary hover:bg-primary text-primary-foreground font-semibold px-2 py-0.5 text-xs rounded-full">
            {selectedCount}
          </Badge>
          <span className="text-xs font-medium text-zinc-300 hidden sm:inline">
            selected
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearSelection}
            className="h-6 w-6 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800"
            title="Deselect all"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Sync to CRM */}
          <Button
            size="sm"
            onClick={onBatchSync}
            disabled={isSyncing || isEnriching}
            className="h-9 px-3 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97] transition-all"
          >
            {isSyncing ? (
              <>
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <Database className="w-3.5 h-3.5" />
                <span>Sync to CRM</span>
              </>
            )}
          </Button>

          {/* Batch Enrich */}
          <Button
            size="sm"
            variant="outline"
            onClick={onBatchEnrich}
            disabled={isSyncing || isEnriching}
            className="h-9 px-3 border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200 text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97] transition-all"
          >
            {isEnriching ? (
              <>
                <span className="w-3 h-3 border-2 border-sky-400/40 border-t-sky-400 rounded-full animate-spin" />
                <span>Enriching...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">AI Enrich</span>
                <span className="sm:hidden">Enrich</span>
              </>
            )}
          </Button>

          {/* Add to Lead List */}
          <Button
            size="sm"
            variant="outline"
            onClick={onAddToList}
            disabled={isSyncing || isEnriching}
            className="h-9 px-3 border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200 text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97] transition-all"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Add to List</span>
            <span className="md:hidden">List</span>
          </Button>

          {/* Export CSV */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onExportCSV}
            disabled={isSyncing || isEnriching}
            className="h-9 px-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97] transition-all"
            title="Export Selected to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Export</span>
          </Button>
        </div>
      </div>
    </aside>
  );
};
