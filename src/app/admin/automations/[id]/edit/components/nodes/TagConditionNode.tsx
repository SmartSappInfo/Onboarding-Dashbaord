'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Tag } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const LOGIC_LABELS: Record<string, string> = {
  has_tag: 'Has Tag',
  has_all_tags: 'Has All Tags',
  has_any_tag: 'Has Any Tag',
  not_has_tag: 'Not Has Tag',
};

/**
 * TagConditionNode — visual node for the automation canvas.
 * Evaluates tag-based conditions during flow execution.
 * Requirements: FR4.2.1, FR4.2.2
 */
export function TagConditionNode({ data, selected }: any) {
  const logic: string = data.logic || '';
  const tagIds: string[] = data.tagIds || [];

  return (
 <div className={cn('relative transition-all duration-500', selected ? 'scale-105' : 'scale-100')}>
      <Handle
        type="target"
        position={Position.Top}
 className="w-3 h-3 bg-violet-500 border-2 border-white !-top-1.5 shadow-md"
      />

      <Card
 className={cn(
          'w-64 rounded-2xl border-2 transition-all duration-300 bg-card overflow-hidden shadow-sm text-left',
          selected
            ? 'border-violet-500 shadow-2xl ring-4 ring-violet-500/10'
            : 'border-violet-200'
        )}
      >
 <div className="bg-violet-500 p-3 flex items-center justify-between border-b border-violet-600/20">
 <div className="flex items-center gap-2 text-white">
 <Tag className="h-4 w-4" />
 <span className="text-[10px] font-semibold ">Tag Condition</span>
          </div>
 <div className="h-1.5 w-1.5 rounded-full bg-card opacity-40" />
        </div>

 <div className="p-4 space-y-2">
 <p className="text-xs font-semibold text-foreground leading-tight">
            {data.label || 'Tag Condition'}
          </p>
 <div className="flex flex-wrap gap-1.5 pt-1">
            {logic ? (
              <Badge
                variant="outline"
 className="text-[7px] font-semibold px-1.5 h-4 border-violet-100 bg-violet-50 text-violet-600"
              >
                {LOGIC_LABELS[logic] ?? logic.replace(/_/g, ' ')}
              </Badge>
            ) : (
              <Badge
                variant="outline"
 className="text-[7px] font-semibold px-1.5 h-4 bg-background0 border-none text-muted-foreground"
              >
                Select Logic
              </Badge>
            )}
            <Badge
              variant="outline"
 className="text-[7px] font-semibold px-1.5 h-4 bg-background0 border-none"
            >
              {tagIds.length} tag{tagIds.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
      </Card>

      {/* True Path */}
 <div className="absolute -bottom-6 left-1/4 flex flex-col items-center">
 <span className="text-[8px] font-semibold text-emerald-600 mb-1">True</span>
        <Handle
          type="source"
          position={Position.Bottom}
          id="true"
 className="w-3 h-3 bg-emerald-500 border-2 border-white shadow-md"
          style={{ left: '25%' }}
        />
      </div>

      {/* False Path */}
 <div className="absolute -bottom-6 right-1/4 flex flex-col items-center">
 <span className="text-[8px] font-semibold text-rose-600 mb-1">False</span>
        <Handle
          type="source"
          position={Position.Bottom}
          id="false"
 className="w-3 h-3 bg-rose-500 border-2 border-white shadow-md"
          style={{ left: '75%' }}
        />
      </div>
    </div>
  );
}
