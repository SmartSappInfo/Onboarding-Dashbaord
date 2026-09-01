'use client';

/**
 * ARCHITECTURE:
 * Floating Contextual Action Bar (Phase 2 - Professional Canvas Editor)
 * 
 * Dynamically provides context-sensitive quick tools for single text, images, shapes,
 * or multi-selected element groups (Align, Distribute, Group, Ungroup).
 * 
 * CAUTION:
 * Touch targets must be >= 36px (or >= 44px on mobile viewports).
 * Strict typing (0% any).
 */

import * as React from 'react';
import type { CreativeElement, AlignmentType, DistributionType } from '@/lib/creative/creative-types';
import { THUMBNAIL_FONT_OPTIONS } from '@/lib/creative/creative-types';
import { Button } from '@/components/ui/button';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Scissors,
  Copy,
  Trash2,
  Group,
  Ungroup,
  Sparkles,
  Bold,
  Sliders,
  Crop,
  Smartphone,
  Circle,
  Square,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ContextualActionBarProps {
  selectedElements: CreativeElement[];
  onUpdateElement: (id: string, patch: Partial<CreativeElement>, commitToHistory?: boolean) => void;
  onAlignSelected: (alignment: AlignmentType) => void;
  onDistributeSelected: (axis: DistributionType) => void;
  onGroupSelected: () => void;
  onUngroupSelected: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onRemoveBackground?: (imageUrl: string) => void;
  onAiRewrite?: (text: string) => void;
}

export function ContextualActionBar({
  selectedElements,
  onUpdateElement,
  onAlignSelected,
  onDistributeSelected,
  onGroupSelected,
  onUngroupSelected,
  onDuplicateSelected,
  onDeleteSelected,
  onRemoveBackground,
  onAiRewrite,
}: ContextualActionBarProps) {
  if (selectedElements.length === 0) return null;

  const isMulti = selectedElements.length > 1;
  const single = selectedElements[0];
  const isGrouped = isMulti && selectedElements.every((el) => el.groupId && el.groupId === selectedElements[0].groupId);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-1.5 shadow-2xl flex items-center gap-1 max-w-[95vw] overflow-x-auto scrollbar-none animate-in fade-in zoom-in-95 duration-150">
      {/* ------------------------------------------------------------- */}
      {/* Multi-Selection Mode: Align, Distribute, Group, Batch Delete */}
      {/* ------------------------------------------------------------- */}
      {isMulti ? (
        <>
          <div className="text-[11px] font-bold text-slate-400 px-2 flex items-center gap-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{selectedElements.length} Elements</span>
          </div>

          <div className="w-[1px] h-5 bg-slate-800 mx-1 shrink-0" />

          {/* Alignment Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-bold active:scale-[0.97]"
              >
                <AlignCenter className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Align
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="bg-slate-950 border-slate-800 text-slate-200 rounded-xl p-1">
              <DropdownMenuItem onClick={() => onAlignSelected('left')} className="cursor-pointer text-xs font-bold flex gap-2">
                <AlignLeft className="w-3.5 h-3.5" /> Align Left
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAlignSelected('center')} className="cursor-pointer text-xs font-bold flex gap-2">
                <AlignCenter className="w-3.5 h-3.5" /> Align Center (H)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAlignSelected('right')} className="cursor-pointer text-xs font-bold flex gap-2">
                <AlignRight className="w-3.5 h-3.5" /> Align Right
              </DropdownMenuItem>
              <div className="w-full h-[1px] bg-slate-850 my-1" />
              <DropdownMenuItem onClick={() => onAlignSelected('top')} className="cursor-pointer text-xs font-bold flex gap-2">
                <AlignJustify className="w-3.5 h-3.5 rotate-90" /> Align Top
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAlignSelected('middle')} className="cursor-pointer text-xs font-bold flex gap-2">
                <AlignJustify className="w-3.5 h-3.5" /> Align Middle (V)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAlignSelected('bottom')} className="cursor-pointer text-xs font-bold flex gap-2">
                <AlignJustify className="w-3.5 h-3.5 -rotate-90" /> Align Bottom
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Distribute Menu (if 3+ items) */}
          {selectedElements.length >= 3 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-bold active:scale-[0.97]"
                >
                  <Sliders className="w-3.5 h-3.5 mr-1 text-teal-400" /> Space
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="bg-slate-950 border-slate-800 text-slate-200 rounded-xl p-1">
                <DropdownMenuItem onClick={() => onDistributeSelected('horizontal')} className="cursor-pointer text-xs font-bold">
                  Distribute Horizontally
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDistributeSelected('vertical')} className="cursor-pointer text-xs font-bold">
                  Distribute Vertically
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Group / Ungroup Button */}
          {isGrouped ? (
            <Button
              onClick={onUngroupSelected}
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-bold active:scale-[0.97]"
            >
              <Ungroup className="w-3.5 h-3.5 mr-1 text-amber-400" /> Ungroup
            </Button>
          ) : (
            <Button
              onClick={onGroupSelected}
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-bold active:scale-[0.97]"
            >
              <Group className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Group
            </Button>
          )}

          <div className="w-[1px] h-5 bg-slate-800 mx-1 shrink-0" />

          {/* Duplicate & Delete Batch */}
          <Button
            onClick={onDuplicateSelected}
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-bold"
            title="Duplicate Selection"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button
            onClick={onDeleteSelected}
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-xl text-xs font-bold"
            title="Delete Selection"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </>
      ) : (
        /* ------------------------------------------------------------- */
        /* Single Element Mode: Contextual tools for Text, Image, Shape   */
        /* ------------------------------------------------------------- */
        <>
          {single.type === 'text' && (
            <>
              {/* Font Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs font-bold text-white hover:bg-slate-800 rounded-xl max-w-[120px] truncate"
                  >
                    {single.fontFamily || 'Impact'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-slate-950 border-slate-800 text-slate-200 rounded-xl max-h-60 overflow-y-auto">
                  {THUMBNAIL_FONT_OPTIONS.map((f: string) => (
                    <DropdownMenuItem
                      key={f}
                      onClick={() => onUpdateElement(single.id, { fontFamily: f })}
                      className="cursor-pointer text-xs font-bold"
                    >
                      {f}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Color Picker */}
              <div className="flex items-center px-1.5">
                <input
                  type="color"
                  value={single.fill || '#ffffff'}
                  onChange={(e) => onUpdateElement(single.id, { fill: e.target.value })}
                  className="w-6 h-6 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                  title="Text Fill Color"
                />
              </div>

              {/* Bold Toggle */}
              <Button
                onClick={() =>
                  onUpdateElement(single.id, {
                    fontWeight: single.fontWeight === 'bold' || single.fontWeight === '900' ? 'normal' : 'bold',
                  })
                }
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 w-8 p-0 rounded-xl',
                  single.fontWeight === 'bold' || single.fontWeight === '900'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400'
                )}
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </Button>

              {/* AI Rewrite Trigger */}
              {onAiRewrite && single.text && (
                <Button
                  onClick={() => onAiRewrite(single.text || '')}
                  size="sm"
                  className="h-8 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs rounded-xl border border-emerald-500/30"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> AI Rewrite
                </Button>
              )}
            </>
          )}

          {single.type === 'image' && (
            <>
              {/* Frame Shape Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-xl"
                  >
                    <Crop className="w-3.5 h-3.5 mr-1 text-teal-400" /> Frame
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-slate-950 border-slate-800 text-slate-200 rounded-xl">
                  <DropdownMenuItem onClick={() => onUpdateElement(single.id, { frameShape: 'none', clipPath: undefined })} className="text-xs font-bold flex gap-2">
                    <Square className="w-3.5 h-3.5" /> Original Rectangle
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onUpdateElement(single.id, { frameShape: 'circle', clipPath: 'circle(50% at 50% 50%)' })} className="text-xs font-bold flex gap-2">
                    <Circle className="w-3.5 h-3.5" /> Circle Avatar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onUpdateElement(single.id, { frameShape: 'squircle', borderRadius: 24 })} className="text-xs font-bold flex gap-2">
                    <Square className="w-3.5 h-3.5 rounded-md" /> Squircle Card
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onUpdateElement(single.id, { frameShape: 'phone_mockup' })} className="text-xs font-bold flex gap-2">
                    <Smartphone className="w-3.5 h-3.5" /> Phone Mockup Frame
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Remove BG Cutout */}
              {onRemoveBackground && single.imageSrc && (
                <Button
                  onClick={() => onRemoveBackground(single.imageSrc || '')}
                  size="sm"
                  className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl"
                >
                  <Scissors className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Cutout
                </Button>
              )}
            </>
          )}

          <div className="w-[1px] h-5 bg-slate-800 mx-1 shrink-0" />

          {/* Quick Duplicate / Delete for Single Element */}
          <Button
            onClick={onDuplicateSelected}
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-slate-400 hover:text-white rounded-xl"
            title="Duplicate"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button
            onClick={onDeleteSelected}
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-slate-400 hover:text-red-400 rounded-xl"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}
