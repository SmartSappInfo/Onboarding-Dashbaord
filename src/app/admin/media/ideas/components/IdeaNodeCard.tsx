'use client';

/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Idea Canvas Node Card
 *
 * Renders an interactive, draggable/editable node card for the Idea Canvas Studio (Screen 64).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (RULE 10):
 * 1. Performance & Memoization: Wrapped in `React.memo` to prevent unnecessary re-renders during canvas pan/zoom.
 * 2. Mobile Accessibility: Touch targets enforce `min-h-[44px] min-w-[44px]` with `active:scale-[0.97]`.
 * 3. Strict Typing Standard: Zero `any`, `any[]`, or `unknown`.
 */

import React, { memo } from 'react';
import type { IdeaCanvasNode, IdeaCanvasNodeType } from '@/lib/types/media-2.0';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Lightbulb,
  HelpCircle,
  Hash,
  Anchor,
  FileText,
  Bookmark,
  Send,
  MousePointerClick,
  Sparkles,
  Trash2,
  Move,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface IdeaNodeCardProps {
  node: IdeaCanvasNode;
  isSelected?: boolean;
  onSelect?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, updates: Partial<IdeaCanvasNode>) => void;
  className?: string;
}

const TYPE_CONFIGS: Record<
  IdeaCanvasNodeType,
  { label: string; icon: React.ReactNode; bg: string; border: string; text: string }
> = {
  audience: {
    label: 'Audience',
    icon: <Users className="h-3.5 w-3.5" />,
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-300 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
  },
  topic: {
    label: 'Topic',
    icon: <Hash className="h-3.5 w-3.5" />,
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-300 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-300',
  },
  hook: {
    label: 'Hook',
    icon: <Anchor className="h-3.5 w-3.5" />,
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-300 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  idea: {
    label: 'Idea',
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-300 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
  },
  cta: {
    label: 'Call to Action',
    icon: <MousePointerClick className="h-3.5 w-3.5" />,
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-300 dark:border-rose-800',
    text: 'text-rose-700 dark:text-rose-300',
  },
  question: {
    label: 'Question',
    icon: <HelpCircle className="h-3.5 w-3.5" />,
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    border: 'border-cyan-300 dark:border-cyan-800',
    text: 'text-cyan-700 dark:text-cyan-300',
  },
  asset: {
    label: 'Asset',
    icon: <FileText className="h-3.5 w-3.5" />,
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    border: 'border-indigo-300 dark:border-indigo-800',
    text: 'text-indigo-700 dark:text-indigo-300',
  },
  reference: {
    label: 'Reference',
    icon: <Bookmark className="h-3.5 w-3.5" />,
    bg: 'bg-slate-50 dark:bg-slate-900',
    border: 'border-slate-300 dark:border-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
  },
  campaign: {
    label: 'Campaign',
    icon: <Send className="h-3.5 w-3.5" />,
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-300 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-300',
  },
  persona: {
    label: 'Persona',
    icon: <Users className="h-3.5 w-3.5" />,
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    border: 'border-pink-300 dark:border-pink-800',
    text: 'text-pink-700 dark:text-pink-300',
  },
  insight: {
    label: 'AI Insight',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    border: 'border-yellow-300 dark:border-yellow-800',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
};

export const IdeaNodeCard = memo(function IdeaNodeCard({
  node,
  isSelected,
  onSelect,
  onDelete,
  className,
}: IdeaNodeCardProps) {
  const config = TYPE_CONFIGS[node.type] || TYPE_CONFIGS.idea;

  return (
    <Card
      onClick={() => onSelect?.(node.id)}
      className={cn(
        'w-64 sm:w-72 shadow-sm transition-all duration-200 cursor-pointer border select-none',
        config.bg,
        config.border,
        isSelected && 'ring-2 ring-blue-500 shadow-md scale-[1.02]',
        'hover:shadow hover:border-slate-400 dark:hover:border-slate-600',
        className
      )}
    >
      <CardContent className="p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-1">
          <Badge
            variant="outline"
            className={cn('text-xs font-semibold px-2 py-0.5 flex items-center gap-1.5', config.text, config.border)}
          >
            {config.icon}
            {config.label}
          </Badge>
          <div className="flex items-center gap-1">
            <span className="text-slate-400 dark:text-slate-600 cursor-grab active:cursor-grabbing p-1">
              <Move className="h-3.5 w-3.5" />
            </span>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(node.id);
                }}
                className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded active:scale-[0.97]"
                aria-label="Delete idea card"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
          {node.title}
        </h4>

        {node.description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
            {node.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
});
