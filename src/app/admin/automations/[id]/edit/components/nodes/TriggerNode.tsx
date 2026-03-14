
'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Zap, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * @fileOverview High-fidelity Trigger Node for Automation Canvas.
 * Anchors the start of every operational flow.
 */
export function TriggerNode({ data, selected }: any) {
    return (
        <div className={cn(
            "relative transition-all duration-500",
            selected ? "scale-105" : "scale-100"
        )}>
            <Card className={cn(
                "w-64 rounded-2xl border-2 transition-all duration-300 bg-white overflow-hidden shadow-sm",
                selected ? "border-emerald-500 shadow-2xl ring-4 ring-emerald-500/10" : "border-emerald-200"
            )}>
                <div className="bg-emerald-500 p-3 flex items-center justify-between border-b border-emerald-600/20">
                    <div className="flex items-center gap-2 text-white">
                        <Zap className="h-4 w-4 fill-white" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Trigger</span>
                    </div>
                    <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                </div>
                <div className="p-4 space-y-1">
                    <p className="text-xs font-black uppercase text-foreground leading-tight">{data.label || 'Event Entry'}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">Source: Platform Internal</p>
                </div>
            </Card>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500 border-2 border-white !-bottom-1.5 shadow-md" />
        </div>
    );
}
