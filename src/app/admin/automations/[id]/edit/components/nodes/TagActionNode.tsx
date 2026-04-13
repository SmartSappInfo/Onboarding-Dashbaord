'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { TagIcon, PlusCircle, MinusCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * TagActionNode — visual node for the automation canvas.
 * Applies or removes tags from a contact during flow execution.
 * Requirements: FR4.3.1, FR4.3.2
 */
export function TagActionNode({ data, selected }: any) {
  const action: 'add_tags' | 'remove_tags' = data.action || 'add_tags';
  const tagIds: string[] = data.tagIds || [];

  const isAdd = action === 'add_tags';
  const colorScheme = isAdd
    ? {
        border: selected ? 'border-emerald-500' : 'border-emerald-200',
        ring: 'ring-emerald-500/10',
        header: 'bg-emerald-500 border-emerald-600/20',
        handle: 'bg-emerald-500',
        badge: 'border-emerald-100 bg-emerald-50 text-emerald-700',
        shadow: selected ? 'shadow-2xl' : 'shadow-sm',
      }
    : {
        border: selected ? 'border-rose-500' : 'border-rose-200',
        ring: 'ring-rose-500/10',
        header: 'bg-rose-500 border-rose-600/20',
        handle: 'bg-rose-500',
        badge: 'border-rose-100 bg-rose-50 text-rose-700',
        shadow: selected ? 'shadow-2xl' : 'shadow-sm',
      };

  const ActionIcon = isAdd ? PlusCircle : MinusCircle;

  return (
 <div className={cn('relative transition-all duration-500', selected ? 'scale-105' : 'scale-100')}>
      <Handle
        type="target"
        position={Position.Top}
 className={cn('w-3 h-3 border-2 border-white !-top-1.5 shadow-md', colorScheme.handle)}
      />

      <Card
 className={cn(
          'w-64 rounded-2xl border-2 transition-all duration-300 bg-white overflow-hidden text-left',
          colorScheme.border,
          colorScheme.shadow,
          selected && `ring-4 ${colorScheme.ring}`
        )}
      >
 <div className={cn('p-3 flex items-center justify-between border-b', colorScheme.header)}>
 <div className="flex items-center gap-2 text-white">
 <ActionIcon className="h-4 w-4" />
 <span className="text-[10px] font-semibold ">
              {isAdd ? 'Add Tags' : 'Remove Tags'}
            </span>
          </div>
 <div className="h-1.5 w-1.5 rounded-full bg-white opacity-40" />
        </div>

 <div className="p-4 space-y-2">
 <p className="text-xs font-semibold text-foreground leading-tight">
            {data.label || (isAdd ? 'Add Tags' : 'Remove Tags')}
          </p>
 <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge
              variant="outline"
 className={cn('text-[7px] font-semibold px-1.5 h-4', colorScheme.badge)}
            >
              {isAdd ? 'Add' : 'Remove'}
            </Badge>
            <Badge
              variant="outline"
 className="text-[7px] font-semibold px-1.5 h-4 bg-muted/50 border-none"
            >
              {tagIds.length} tag{tagIds.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
      </Card>

      <Handle
        type="source"
        position={Position.Bottom}
 className={cn('w-3 h-3 border-2 border-white !-bottom-1.5 shadow-md', colorScheme.handle)}
      />
    </div>
  );
}
