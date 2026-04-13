
'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Clock, Hourglass } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

/**
 * @fileOverview Temporal Delay Node for Automation Canvas.
 * Introduces a wait period into the protocol.
 */
export function DelayNode({ data, selected }: any) {
    const config = data.config || {};

    return (
 <div className={cn(
            "relative transition-all duration-500",
            selected ? "scale-105" : "scale-100"
        )}>
 <Handle type="target" position={Position.Top} className="w-3 h-3 bg-purple-500 border-2 border-white !-top-1.5 shadow-md" />
            
 <Card className={cn(
                "w-64 rounded-2xl border-2 transition-all duration-300 bg-white overflow-hidden shadow-sm text-left",
                selected ? "border-purple-500 shadow-2xl ring-4 ring-purple-500/10" : "border-purple-200"
            )}>
 <div className="bg-purple-500 p-3 flex items-center justify-between border-b border-purple-600/20">
 <div className="flex items-center gap-2 text-white">
 <Clock className="h-4 w-4" />
 <span className="text-[10px] font-semibold ">Protocol Pause</span>
                    </div>
 <Hourglass className="h-3.5 w-3.5 text-white/40" />
                </div>
 <div className="p-4 space-y-2">
 <p className="text-xs font-semibold text-foreground leading-tight">{data.label || 'Wait Period'}</p>
 <div className="flex items-center gap-2 pt-1">
                        <Badge variant="outline" className="text-[8px] font-semibold uppercase px-2 h-5 bg-purple-50 text-purple-600 border-purple-100">
                            {config.value || 0} {config.unit || 'Minutes'}
                        </Badge>
                    </div>
                </div>
            </Card>
            
 <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-purple-500 border-2 border-white !-bottom-1.5 shadow-md" />
        </div>
    );
}
