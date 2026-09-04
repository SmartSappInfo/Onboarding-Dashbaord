'use client';

import * as React from 'react';
import {
  Play,
  Pause,
  Layers,
  RotateCcw,
  ListTree,
  Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GraphControlsProps {
  physicsEnabled: boolean;
  onTogglePhysics: () => void;
  clustersVisible: boolean;
  onToggleClusters: () => void;
  isListView: boolean;
  onToggleListView: () => void;
  onResetLayout: () => void;
  className?: string;
}

export function GraphControls({
  physicsEnabled,
  onTogglePhysics,
  clustersVisible,
  onToggleClusters,
  isListView,
  onToggleListView,
  onResetLayout,
  className = '',
}: GraphControlsProps) {
  return (
    <div
      className={`flex items-center gap-1 p-1 bg-background/90 backdrop-blur-md border border-border shadow-xs rounded-xl ${className}`}
    >
      {/* Toggle Physics / Freeze */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onTogglePhysics}
        className="min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] sm:w-9 sm:h-9 rounded-lg text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all"
        title={physicsEnabled ? 'Pause physics layout' : 'Resume dynamic physics'}
      >
        {physicsEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-500" />}
      </Button>

      {/* Cluster Grouping */}
      <Button
        type="button"
        variant={clustersVisible ? 'secondary' : 'ghost'}
        size="icon"
        onClick={onToggleClusters}
        className="min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] sm:w-9 sm:h-9 rounded-lg text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all"
        title="Toggle cluster grouping"
      >
        <Layers className="w-4 h-4" />
      </Button>

      {/* Reset Layout */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onResetLayout}
        className="min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] sm:w-9 sm:h-9 rounded-lg text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all"
        title="Reset graph layout"
      >
        <RotateCcw className="w-4 h-4" />
      </Button>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* Accessible List View Toggle (Section 84 Spec) */}
      <Button
        type="button"
        variant={isListView ? 'default' : 'ghost'}
        size="sm"
        onClick={onToggleListView}
        className="min-h-[44px] sm:min-h-[36px] px-3 gap-1.5 text-xs font-medium rounded-lg active:scale-[0.97] transition-all"
        title={isListView ? 'Show Visual Network Graph' : 'Show Accessible Structured Relationship List'}
      >
        {isListView ? (
          <>
            <Network className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Visual Graph</span>
          </>
        ) : (
          <>
            <ListTree className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Accessible List</span>
          </>
        )}
      </Button>
    </div>
  );
}
