'use client';

import { useMemo } from 'react';
import type { Tag } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TagBadgesProps {
  tagIds: string[];
  allTags: Tag[];
  maxVisible?: number;
  onTagClick?: (tagId: string) => void;
  className?: string;
  size?: 'sm' | 'xs';
}

export function TagBadges({
  tagIds,
  allTags,
  maxVisible = 3,
  onTagClick,
  className,
  size = 'xs',
}: TagBadgesProps) {
  const tagObjects = useMemo(
    () => tagIds.map(id => allTags.find(t => t.id === id)).filter(Boolean) as Tag[],
    [tagIds, allTags]
  );

  if (tagObjects.length === 0) return null;

  const visible = tagObjects.slice(0, maxVisible);
  const overflow = tagObjects.length - maxVisible;

  return (
    <TooltipProvider>
      <div
        className={cn('flex flex-wrap items-center gap-1', className)}
        role={onTagClick ? 'group' : undefined}
        aria-label={onTagClick ? 'Contact tags — click to filter' : 'Contact tags'}
      >
        {visible.map(tag => (
          <Tooltip key={tag.id}>
            <TooltipTrigger asChild>
              {onTagClick ? (
                // Render as a button for keyboard + screen reader access when clickable
                <button
                  onClick={() => onTagClick(tag.id)}
                  className={cn(
                    'inline-flex items-center rounded-full font-bold uppercase border-none text-white',
                    'cursor-pointer hover:opacity-80 transition-opacity',
                    // 44px touch target on mobile
                    'min-h-[44px] sm:min-h-0',
                    'touch-manipulation',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                    size === 'xs' ? 'text-[9px] px-1.5 h-4' : 'text-[10px] px-2 h-5',
                  )}
                  style={{
                    backgroundColor: tag.color,
                    ['--tw-ring-color' as string]: tag.color,
                  }}
                  aria-label={`Filter by tag: ${tag.name}`}
                >
                  {tag.name}
                </button>
              ) : (
                <Badge
                  className={cn(
                    'text-white border-none font-bold uppercase cursor-default',
                    size === 'xs' ? 'text-[9px] px-1.5 h-4' : 'text-[10px] px-2 h-5',
                  )}
                  style={{ backgroundColor: tag.color }}
                  aria-label={`Tag: ${tag.name}`}
                >
                  {tag.name}
                </Badge>
              )}
            </TooltipTrigger>
            <TooltipContent className="max-w-[180px]">
              <p className="font-bold text-xs">{tag.name}</p>
              {tag.description && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{tag.description}</p>
              )}
              <p className="text-[9px] uppercase font-black text-muted-foreground mt-1">{tag.category}</p>
              {onTagClick && (
                <p className="text-[9px] text-primary font-bold mt-1">Click to filter</p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}

        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  'font-bold uppercase cursor-default border-dashed',
                  size === 'xs' ? 'text-[9px] px-1.5 h-4' : 'text-[10px] px-2 h-5'
                )}
                aria-label={`${overflow} more tag${overflow !== 1 ? 's' : ''}`}
              >
                +{overflow} more
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px]">
              <p className="font-black text-[10px] uppercase tracking-widest mb-1">Additional Tags</p>
              <div className="flex flex-wrap gap-1" role="list" aria-label="Additional tags">
                {tagObjects.slice(maxVisible).map(tag => (
                  <Badge
                    key={tag.id}
                    className="text-white border-none font-bold text-[9px] uppercase"
                    style={{ backgroundColor: tag.color }}
                    role="listitem"
                    aria-label={tag.name}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
