'use client';

import * as React from 'react';
import DashboardCard from './DashboardCard';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Workflow, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PipelineStageData {
  name: string;
  count: number;
  students: number;
  color: string;
}

interface PipelineWidgetProps {
  pipelineId: string;
  pipelineName: string;
  stages: PipelineStageData[];
}

/**
 * Per-pipeline dashboard widget.
 * Shows a compact horizontal bar chart of stage distribution for a single pipeline.
 */
export function PipelineWidget({ 
  pipelineId, 
  pipelineName, 
  stages,
  terminology = { singular: 'Entity', plural: 'Entities' }
}: PipelineWidgetProps & { terminology?: { singular: string, plural: string } }) {
  const totalCount = React.useMemo(() => 
    stages.reduce((sum, s) => sum + s.count, 0), 
  [stages]);

  if (totalCount === 0) {
    return (
      <DashboardCard title={pipelineName}>
        <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-3">
          <div className="p-3 bg-muted/50 rounded-xl">
            <Workflow className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">No {terminology.plural.toLowerCase()} in this pipeline yet.</p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title={pipelineName}>
      <div className="space-y-5">
        {/* Stacked horizontal bar */}
        <div className="relative h-5 rounded-full overflow-hidden bg-muted/30 flex">
          {stages.filter(s => s.count > 0).map((stage, i) => {
            const widthPercent = (stage.count / totalCount) * 100;
            return (
              <div
                key={`${stage.name}-${i}`}
                className="h-full transition-all duration-500 relative group"
                style={{ 
                  width: `${widthPercent}%`, 
                  backgroundColor: stage.color,
                  minWidth: widthPercent > 0 ? '4px' : '0'
                }}
                title={`${stage.name}: ${stage.count} (${widthPercent.toFixed(1)}%)`}
              >
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-colors" />
              </div>
            );
          })}
        </div>

        {/* Summary stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums">{totalCount}</span>
            <span className="text-[10px] font-semibold text-muted-foreground">
              {totalCount === 1 ? terminology.singular : terminology.plural}
            </span>
          </div>
          <Badge variant="secondary" className="text-[8px] font-bold uppercase px-2 h-5">
            {stages.length} Stages
          </Badge>
        </div>

        {/* Stage breakdown */}
        <div className="space-y-2">
          {stages.filter(s => s.count > 0).map((stage, i) => {
            const pct = ((stage.count / totalCount) * 100).toFixed(0);
            return (
              <div 
                key={`${stage.name}-${i}`} 
                className="flex items-center justify-between group/row p-1.5 -mx-1.5 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div 
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-xs font-medium text-foreground truncate">{stage.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{pct}%</span>
                  <span className="text-xs font-bold tabular-nums">{stage.count}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Link to pipeline */}
        <Button asChild variant="ghost" size="sm" className="w-full h-8 rounded-xl text-[10px] font-bold text-primary hover:bg-primary/5 mt-2 gap-2">
          <Link href="/admin/pipeline">
            View Pipeline <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>
    </DashboardCard>
  );
}
