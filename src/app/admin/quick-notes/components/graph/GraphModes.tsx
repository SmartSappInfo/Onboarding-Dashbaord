'use client';

import * as React from 'react';
import { Compass, Focus, Route, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GraphMode } from '@/lib/quick-notes-types';

interface GraphModesProps {
  currentMode: GraphMode;
  onModeChange: (mode: GraphMode) => void;
  selectedNodeLabel?: string;
  className?: string;
}

const MODES: Array<{
  id: GraphMode;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    id: 'explore',
    label: 'Explore',
    description: 'Workspace-wide relationship network',
    icon: Compass,
  },
  {
    id: 'focus',
    label: 'Focus',
    description: 'Neighborhood radius around active node',
    icon: Focus,
  },
  {
    id: 'path',
    label: 'Path',
    description: 'Shortest relationship path between two objects',
    icon: Route,
  },
  {
    id: 'evidence',
    label: 'Evidence',
    description: 'Ideas and their supporting proof & customer quotes',
    icon: ShieldAlert,
  },
];

export function GraphModes({
  currentMode,
  onModeChange,
  selectedNodeLabel: _selectedNodeLabel,
  className = '',
}: GraphModesProps) {
  return (
    <div className={`flex items-center gap-1.5 p-1 bg-muted/60 border border-border/80 rounded-xl ${className}`}>
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;

        return (
          <Button
            key={mode.id}
            type="button"
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onModeChange(mode.id)}
            className={`min-h-[44px] sm:min-h-[34px] px-3 gap-1.5 text-xs font-medium rounded-lg transition-all active:scale-[0.98] ${
              isActive
                ? 'shadow-xs bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title={mode.description}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{mode.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
