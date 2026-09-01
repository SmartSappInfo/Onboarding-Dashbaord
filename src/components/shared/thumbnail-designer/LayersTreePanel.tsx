'use client';

/**
 * ARCHITECTURE:
 * Hierarchical Layers Tree Panel (Phase 2 - Professional Canvas Editor)
 * 
 * Renders structured layer tree with collapsible groups, multi-selection sync,
 * lock/hide toggles, reordering controls, and semantic role badges.
 * 
 * CAUTION:
 * Touch targets must be >= 36px for mobile usability.
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useMemo } from 'react';
import type { CreativeElement } from '@/lib/creative/creative-types';
import {
  Layers,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Trash2,
  Group,
  Ungroup,
  Type,
  Image as ImageIcon,
  Square,
  Smile,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface LayersTreePanelProps {
  elements: CreativeElement[];
  selectedIds: string[];
  onSelectElement: (id: string | null, multi?: boolean) => void;
  onUpdateElement: (id: string, patch: Partial<CreativeElement>, commitToHistory?: boolean) => void;
  onDeleteElement: (id: string) => void;
  onReorderElement: (id: string, direction: 'up' | 'down' | 'front' | 'back') => void;
  onGroupSelected: () => void;
  onUngroupSelected: () => void;
  onToggleGroupLock: (groupId: string) => void;
  onToggleGroupVisibility: (groupId: string) => void;
}

export function LayersTreePanel({
  elements,
  selectedIds,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onReorderElement,
  onGroupSelected,
  onUngroupSelected,
  onToggleGroupLock,
  onToggleGroupVisibility,
}: LayersTreePanelProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Group elements by groupId
  const { groupedTree, standaloneElements } = useMemo(() => {
    const groups: Record<string, CreativeElement[]> = {};
    const standalones: CreativeElement[] = [];

    // Reverse elements for top-to-bottom visual display
    const reversed = [...elements].reverse();

    for (const el of reversed) {
      if (el.groupId) {
        if (!groups[el.groupId]) groups[el.groupId] = [];
        groups[el.groupId].push(el);
      } else {
        standalones.push(el);
      }
    }

    return { groupedTree: groups, standaloneElements: standalones };
  }, [elements]);

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const getElementIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <Type className="w-3.5 h-3.5 text-emerald-400" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-teal-400" />;
      case 'rect':
      case 'circle':
      case 'arrow':
        return <Square className="w-3.5 h-3.5 text-amber-400" />;
      case 'emoji':
        return <Smile className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  const isSelected = (id: string) => selectedIds.includes(id);

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      {/* Top Header Actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Layers Hierarchy</span>
        </div>

        <div className="flex items-center gap-1">
          {selectedIds.length >= 2 && (
            <Button
              onClick={onGroupSelected}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10 rounded-lg"
            >
              <Group className="w-3 h-3 mr-1" /> Group
            </Button>
          )}
          {selectedIds.some((id) => elements.find((el) => el.id === id)?.groupId) && (
            <Button
              onClick={onUngroupSelected}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] font-bold text-amber-400 hover:bg-amber-500/10 rounded-lg"
            >
              <Ungroup className="w-3 h-3 mr-1" /> Ungroup
            </Button>
          )}
        </div>
      </div>

      {elements.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 border border-slate-850 rounded-2xl bg-slate-900/20">
          No elements on canvas.
        </div>
      ) : (
        <div className="space-y-2">
          {/* 1. Grouped Folders */}
          {Object.entries(groupedTree).map(([groupId, groupElements]) => {
            const isCollapsed = collapsedGroups[groupId];
            const isGroupLocked = groupElements.every((el) => el.isLocked);
            const isGroupHidden = groupElements.every((el) => el.isHidden);
            const isAnySelected = groupElements.some((el) => isSelected(el.id));

            return (
              <div
                key={groupId}
                className={cn(
                  'rounded-2xl border transition-colors overflow-hidden',
                  isAnySelected ? 'border-emerald-500/40 bg-slate-900/80' : 'border-slate-800 bg-slate-900/40'
                )}
              >
                {/* Group Header */}
                <div
                  onClick={() => toggleGroupCollapse(groupId)}
                  className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-850 text-xs font-bold text-slate-200 select-none"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />}
                    <Group className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Group ({groupElements.length})</span>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onToggleGroupLock(groupId)}
                      className="p-1 rounded text-slate-500 hover:text-white"
                      title={isGroupLocked ? 'Unlock Group' : 'Lock Group'}
                    >
                      {isGroupLocked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => onToggleGroupVisibility(groupId)}
                      className="p-1 rounded text-slate-500 hover:text-white"
                      title={isGroupHidden ? 'Show Group' : 'Hide Group'}
                    >
                      {isGroupHidden ? <EyeOff className="w-3.5 h-3.5 text-rose-400" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Group Children */}
                {!isCollapsed && (
                  <div className="pl-4 pr-2 pb-2 space-y-1.5 border-t border-slate-850 pt-1.5">
                    {groupElements.map((el) => renderElementRow(el))}
                  </div>
                )}
              </div>
            );
          })}

          {/* 2. Standalone Elements */}
          {standaloneElements.map((el) => renderElementRow(el))}
        </div>
      )}
    </div>
  );

  function renderElementRow(el: CreativeElement) {
    const active = isSelected(el.id);
    return (
      <div
        key={el.id}
        onClick={(e) => {
          e.stopPropagation();
          onSelectElement(el.id, e.shiftKey || e.metaKey || e.ctrlKey);
        }}
        className={cn(
          'p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer text-xs font-bold transition-all select-none active:scale-[0.99]',
          active
            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-sm'
            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {getElementIcon(el.type)}
          <span className="truncate">
            {el.type === 'text' ? el.text || 'Text' : el.type.toUpperCase()}
          </span>
          {el.semanticRole && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 font-mono">
              {el.semanticRole}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {/* Layer Reorder Steppers */}
          <button
            onClick={() => onReorderElement(el.id, 'up')}
            className="p-1 rounded text-slate-500 hover:text-white"
            title="Bring Forward"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onReorderElement(el.id, 'down')}
            className="p-1 rounded text-slate-500 hover:text-white"
            title="Send Backward"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Lock Toggle */}
          <button
            onClick={() => onUpdateElement(el.id, { isLocked: !el.isLocked })}
            className="p-1 rounded text-slate-500 hover:text-white"
          >
            {el.isLocked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>

          {/* Hide Toggle */}
          <button
            onClick={() => onUpdateElement(el.id, { isHidden: !el.isHidden })}
            className="p-1 rounded text-slate-500 hover:text-white"
          >
            {el.isHidden ? <EyeOff className="w-3.5 h-3.5 text-rose-400" /> : <Eye className="w-3.5 h-3.5" />}
          </button>

          {/* Delete */}
          <button
            onClick={() => onDeleteElement(el.id)}
            className="p-1 rounded text-slate-500 hover:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }
}
