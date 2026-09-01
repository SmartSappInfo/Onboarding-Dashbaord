/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Structure Navigator (Left Panel)
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Survey Structure Hierarchy & Quick Traversal.
 * 2. Provides:
 *    - Linear & section tree navigation.
 *    - Search & filter across questions.
 *    - Badges for Required (*), Scoring (Points), Logic Branching (Jump), and Hidden states.
 *    - Fast Reordering (Move Up / Move Down) and Selection syncing with Canvas and Right Inspector.
 * 3. Strict Zero-Any Invariant.
 * 4. Touch-optimized (min-h-[44px], active:scale-[0.97]).
 */

'use client';

import * as React from 'react';
import {
  Type,
  FileText,
  CheckSquare,
  List,
  Star,
  Calendar,
  Clock,
  Upload,
  Mail,
  Phone,
  Hash,
  Link as LinkIcon,
  Grid,
  ListOrdered,
  Sliders,
  Award,
  PenTool,
  ShieldCheck,
  Split,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  Search,
  Plus,
  FolderTree,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SurveyElement, SurveyQuestion, SurveyLayoutBlock, SurveyLogicBlock } from '@/lib/types';

interface StructureNavigatorProps {
  elements: SurveyElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  onAddQuestion: (type?: SurveyQuestion['type']) => void;
  className?: string;
}

export function getQuestionIcon(type: string) {
  switch (type) {
    case 'text':
    case 'long-text':
      return Type;
    case 'multiple-choice':
    case 'checkboxes':
    case 'dropdown':
    case 'yes-no':
      return List;
    case 'rating':
    case 'csat':
      return Star;
    case 'nps':
      return Award;
    case 'matrix':
      return Grid;
    case 'ranking':
      return ListOrdered;
    case 'slider':
      return Sliders;
    case 'date':
      return Calendar;
    case 'time':
      return Clock;
    case 'file-upload':
      return Upload;
    case 'email':
      return Mail;
    case 'phone':
      return Phone;
    case 'number':
    case 'calculated':
      return Hash;
    case 'link':
      return LinkIcon;
    case 'signature':
      return PenTool;
    case 'consent':
      return ShieldCheck;
    case 'logic':
      return Split;
    case 'heading':
    case 'description':
    case 'section':
      return FileText;
    default:
      return Type;
  }
}

export function StructureNavigator({
  elements,
  selectedId,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onAddQuestion,
  className,
}: StructureNavigatorProps) {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredElements = React.useMemo(() => {
    if (!searchQuery.trim()) return elements.map((el, idx) => ({ element: el, originalIndex: idx }));
    const q = searchQuery.toLowerCase();
    return elements
      .map((el, idx) => ({ element: el, originalIndex: idx }))
      .filter(({ element }) => {
        const title = element.title || ('text' in element ? (element as SurveyLayoutBlock).text : '') || '';
        return title.toLowerCase().includes(q) || element.type.toLowerCase().includes(q);
      });
  }, [elements, searchQuery]);

  let questionCounter = 0;

  return (
    <div className={cn('flex flex-col h-full bg-background border-r border-border/60 select-none', className)}>
      {/* Header */}
      <div className="p-3 border-b border-border/50 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Structure Tree</span>
          </div>
          <Badge variant="secondary" className="text-[10px] font-mono">
            {elements.length} blocks
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter blocks..."
            className="h-8 pl-8 text-xs rounded-lg bg-muted/30 border-border/50"
          />
        </div>
      </div>

      {/* Block Tree List */}
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="space-y-1">
          {filteredElements.map(({ element, originalIndex }) => {
            const isSelected = selectedId === element.id;
            const Icon = getQuestionIcon(element.type);
            const isQuestion = !['heading', 'description', 'divider', 'image', 'video', 'section', 'logic'].includes(
              element.type
            );

            if (isQuestion) {
              questionCounter += 1;
            }

            const questionObj = isQuestion ? (element as SurveyQuestion) : null;
            const isRequired = questionObj?.isRequired;
            const hasScoring = questionObj?.enableScoring;
            const isHidden = element.hidden;
            const isLogic = element.type === 'logic';
            const isSection = element.type === 'section';

            const displayTitle =
              element.title ||
              ('text' in element ? (element as SurveyLayoutBlock).text : '') ||
              `Untitled ${element.type}`;

            return (
              <div
                key={element.id}
                onClick={() => onSelect(element.id)}
                className={cn(
                  'group relative flex items-center justify-between p-2 rounded-xl text-xs font-medium cursor-pointer transition-all duration-150 min-h-[44px]',
                  isSelected
                    ? 'bg-primary/10 text-primary font-semibold shadow-xs border border-primary/20'
                    : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground',
                  isSection && 'bg-muted/40 font-bold border-l-2 border-primary',
                  isLogic && 'bg-amber-500/5 border border-amber-500/20 text-amber-600 dark:text-amber-400'
                )}
              >
                {/* Left info */}
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  <div
                    className={cn(
                      'p-1.5 rounded-lg shrink-0',
                      isSelected ? 'bg-primary/20 text-primary' : 'bg-muted/80 text-muted-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {isQuestion && (
                      <span className="text-[10px] font-mono font-bold text-muted-foreground/70 shrink-0">
                        Q{originalIndex + 1}
                      </span>
                    )}
                    <span className="truncate">{displayTitle}</span>
                  </div>
                </div>

                {/* Right Badges & Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  {isRequired && (
                    <span className="text-destructive font-bold text-xs" title="Required">
                      *
                    </span>
                  )}
                  {hasScoring && (
                    <span className="text-[10px]" title="Scored">
                      🏆
                    </span>
                  )}
                  {isLogic && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/30 text-amber-600">
                      Rule
                    </Badge>
                  )}
                  {isHidden && <EyeOff className="h-3 w-3 text-muted-foreground/50" />}

                  {/* Hover Reordering & Actions */}
                  <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Move element up"
                            disabled={originalIndex === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoveUp(originalIndex);
                            }}
                            className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground disabled:opacity-30 active:scale-[0.97]"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Move Up</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Move element down"
                            disabled={originalIndex === elements.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoveDown(originalIndex);
                            }}
                            className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground disabled:opacity-30 active:scale-[0.97]"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Move Down</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Duplicate element"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicate(originalIndex);
                            }}
                            className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground active:scale-[0.97]"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Duplicate</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="Delete element"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(originalIndex);
                            }}
                            className="p-1 rounded hover:bg-destructive/10 text-destructive active:scale-[0.97]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Delete</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredElements.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No blocks matching "{searchQuery}"
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Add Actions */}
      <div className="p-2 border-t border-border/50 flex items-center gap-1.5 bg-muted/20">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onAddQuestion('multiple-choice')}
          className="flex-1 h-8 text-xs gap-1.5 rounded-lg active:scale-[0.97]"
        >
          <Plus className="h-3.5 w-3.5 text-primary" />
          Add Question
        </Button>
      </div>
    </div>
  );
}