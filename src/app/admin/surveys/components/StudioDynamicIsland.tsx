'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Studio Dynamic Island (Floating Action Dock)
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Global Studio View Modes & Canvas Actions.
 * 2. Mobile-first design:
 *    - Desktop: Floats top-center above the canvas with frosted glass blur.
 *    - Mobile: Docks as an accessible bottom floating strip (min-h-[44px], active:scale-[0.97]).
 * 3. Grouped segments:
 *    - History: Undo / Redo
 *    - Canvas Display: Focus mode, Page breaks, Strict validation, Title bolding, Option columns
 *    - Intelligence & Tools: Structure Tree toggle, Logic Studio, AI Auditor, Question Bank, Version History, Deployments
 *    - Preview: Instant Live Preview toggle
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import {
  Undo,
  Redo,
  FoldVertical,
  UnfoldVertical,
  Layout,
  ShieldCheck,
  Bold,
  Columns,
  FolderTree,
  Split,
  Sparkles,
  Library,
  History,
  Share2,
  Eye,
  EyeOff,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import AiChatEditor from './ai-chat-editor';

interface StudioDynamicIslandProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isAccordion: boolean;
  onToggleAccordion: () => void;
  allPagesEnabled: boolean;
  onToggleAllPageBreaks: () => void;
  allValidationEnabled: boolean;
  onToggleAllValidation: () => void;
  isTitleBold: boolean;
  onToggleTitleBold: () => void;
  optionsColumns: number;
  onToggleColumns: () => void;
  isStructureTreeOpen: boolean;
  onToggleStructureTree: () => void;
  onOpenLogicStudio: () => void;
  onOpenQualityAuditor: () => void;
  onOpenQuestionBank: () => void;
  onOpenVersionHistory: () => void;
  onOpenDeployments: () => void;
  isPreviewMode: boolean;
  onTogglePreviewMode: () => void;
  currentVersionNumber?: number;
  className?: string;
}

export function StudioDynamicIsland({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isAccordion,
  onToggleAccordion,
  allPagesEnabled,
  onToggleAllPageBreaks,
  allValidationEnabled,
  onToggleAllValidation,
  isTitleBold,
  onToggleTitleBold,
  optionsColumns,
  onToggleColumns,
  isStructureTreeOpen,
  onToggleStructureTree,
  onOpenLogicStudio,
  onOpenQualityAuditor,
  onOpenQuestionBank,
  onOpenVersionHistory,
  onOpenDeployments,
  isPreviewMode,
  onTogglePreviewMode,
  currentVersionNumber = 1,
  className,
}: StudioDynamicIslandProps) {
  return (
    <div className={cn('sticky top-2 z-30 flex justify-center px-2 pointer-events-none select-none', className)}>
      <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 p-1.5 sm:px-3 rounded-full bg-background/90 dark:bg-slate-900/90 backdrop-blur-xl border border-border/80 shadow-2xl transition-all duration-300 hover:shadow-primary/5 hover:border-primary/30 max-w-full overflow-x-auto no-scrollbar">
        <TooltipProvider delayDuration={150}>
          {/* SEGMENT 1: HISTORY (Undo / Redo) */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Undo"
                  disabled={!canUndo}
                  onClick={onUndo}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 disabled:opacity-30 transition-all active:scale-[0.97]"
                >
                  <Undo className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-semibold">Undo</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Redo"
                  disabled={!canRedo}
                  onClick={onRedo}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 disabled:opacity-30 transition-all active:scale-[0.97]"
                >
                  <Redo className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-semibold">Redo</TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="h-4 mx-0.5 bg-border/60" />

          {/* SEGMENT 2: CANVAS DISPLAY & VIEW MODES */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Toggle Focus Mode"
                  onClick={onToggleAccordion}
                  className={cn(
                    'p-1.5 rounded-full transition-all active:scale-[0.97]',
                    isAccordion ? 'bg-primary/10 text-primary font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  )}
                >
                  {isAccordion ? <FoldVertical className="h-3.5 w-3.5" /> : <UnfoldVertical className="h-3.5 w-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-semibold">
                {isAccordion ? 'Accordion Focus Mode (Active)' : 'Expanded View Mode'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Toggle Page Breaks"
                  onClick={onToggleAllPageBreaks}
                  className={cn(
                    'p-1.5 rounded-full transition-all active:scale-[0.97]',
                    allPagesEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  )}
                >
                  <Layout className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-semibold">
                {allPagesEnabled ? 'Page Breaks: Enabled on all sections' : 'Toggle Section Page Breaks'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Toggle Strict Validation"
                  onClick={onToggleAllValidation}
                  className={cn(
                    'p-1.5 rounded-full transition-all active:scale-[0.97]',
                    allValidationEnabled ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-semibold">
                {allValidationEnabled ? 'Strict Section Validation (Active)' : 'Toggle Section Validation'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Question Title Weight"
                  onClick={onToggleTitleBold}
                  className={cn(
                    'p-1.5 rounded-full transition-all active:scale-[0.97]',
                    isTitleBold ? 'bg-primary/10 text-primary font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  )}
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-semibold">
                {isTitleBold ? 'Question Titles: Bold' : 'Question Titles: Regular'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Option Columns Grid"
                  onClick={onToggleColumns}
                  className={cn(
                    'p-1.5 rounded-full transition-all active:scale-[0.97] flex items-center gap-1',
                    optionsColumns > 1 ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  )}
                >
                  <Columns className="h-3.5 w-3.5" />
                  {optionsColumns > 1 && (
                    <span className="text-[9px] font-mono font-bold leading-none">{optionsColumns}</span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-semibold">
                Options Layout: {optionsColumns} {optionsColumns > 1 ? 'Columns' : 'Column'}
              </TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="h-4 mx-0.5 bg-border/60" />

          {/* SEGMENT 3: STUDIO TOOLS & INTELLIGENCE */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Toggle Structure Tree"
                  onClick={onToggleStructureTree}
                  className={cn(
                    'p-1.5 rounded-full transition-all active:scale-[0.97]',
                    isStructureTreeOpen ? 'bg-primary/10 text-primary shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  )}
                >
                  <FolderTree className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-semibold">
                {isStructureTreeOpen ? 'Hide Structure Tree' : 'Show Structure Tree'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Visual Logic Studio"
                  onClick={onOpenLogicStudio}
                  className="p-1.5 rounded-full text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-all active:scale-[0.97]"
                >
                  <Split className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-semibold">Visual Logic Studio</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="AI Quality Auditor"
                  onClick={onOpenQualityAuditor}
                  className="p-1.5 rounded-full text-primary hover:bg-primary/10 transition-all active:scale-[0.97]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-semibold">AI Quality Auditor</TooltipContent>
            </Tooltip>

            {/* Overflow Dropdown for Secondary Tools */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More Studio Tools"
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all active:scale-[0.97]"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-52 rounded-2xl p-1.5 shadow-2xl border border-border/80">
                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-2 py-1">
                  Studio Tools
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={onOpenQuestionBank}
                  className="rounded-xl text-xs font-medium cursor-pointer gap-2 py-2"
                >
                  <Library className="h-4 w-4 text-muted-foreground" />
                  <span>Question Library Bank</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onOpenVersionHistory}
                  className="rounded-xl text-xs font-medium cursor-pointer gap-2 py-2"
                >
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span>Version History (v{currentVersionNumber})</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onOpenDeployments}
                  className="rounded-xl text-xs font-medium cursor-pointer gap-2 py-2"
                >
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                  <span>Distribution & Links</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <AiChatEditor variant="icon" />
          </div>

          <Separator orientation="vertical" className="h-4 mx-0.5 bg-border/60" />

          {/* SEGMENT 4: PREVIEW MODE TRIGGER */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={onTogglePreviewMode}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-[0.97]',
                isPreviewMode
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-muted/50 text-foreground hover:bg-muted'
              )}
            >
              {isPreviewMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 text-primary" />}
              <span>{isPreviewMode ? 'Exit Preview' : 'Live Preview'}</span>
            </button>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
