
'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Play, Settings2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function ActionNode({ data, selected }: any) {
    return (
        <div className={cn(
            "relative transition-all duration-500",
            selected ? "scale-105" : "scale-100"
        )}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 border-2 border-white !-top-1.5 shadow-md" />
            <Card className={cn(
                "w-64 rounded-2xl border-2 transition-all duration-300 bg-white overflow-hidden shadow-sm",
                selected ? "border-blue-500 shadow-2xl ring-4 ring-blue-500/10" : "border-blue-200"
            )}>
                <div className="bg-blue-500 p-3 flex items-center justify-between border-b border-blue-600/20">
                    <div className="flex items-center gap-2 text-white">
                        <Play className="h-4 w-4 fill-white" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Execute Action</span>
                    </div>
                    <Settings2 className="h-3.5 w-3.5 text-white/40" />
                </div>
                <div className="p-4 space-y-1 text-left">
                    <p className="text-xs font-black uppercase text-foreground leading-tight">{data.label || 'Protocol Step'}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">Type: Automated Output</p>
                </div>
            </Card>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500 border-2 border-white !-bottom-1.5 shadow-md" />
        </div>
    );
}
