
'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Zap, Target, Building, CheckSquare, Database, Globe, Play } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const TRIGGER_ICONS: Record<string, any> = {
    'SCHOOL_CREATED': Building,
    'SCHOOL_STAGE_CHANGED': Zap,
    'TASK_COMPLETED': CheckSquare,
    'SURVEY_SUBMITTED': Database,
    'PDF_SIGNED': Target,
    'WEBHOOK_RECEIVED': Globe,
    'MEETING_CREATED': Play,
};

/**
 * @fileOverview High-fidelity Trigger Node for Automation Canvas.
 * Represents the entry point of an institutional protocol.
 */
export function TriggerNode({ data, selected }: any) {
    const trigger = data.trigger;
    const Icon = TRIGGER_ICONS[trigger] || Zap;

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
                        <span className="text-[10px] font-black uppercase tracking-widest">Protocol Entry</span>
                    </div>
                    <div className="flex gap-1">
                        <div className="h-1 w-1 rounded-full bg-white opacity-40" />
                        <div className="h-1 w-1 rounded-full bg-white opacity-40" />
                    </div>
                </div>
                <div className="p-4 space-y-3 text-left">
                    <div className="space-y-1">
                        <p className="text-xs font-black uppercase text-foreground leading-tight">{data.label || 'Event Detected'}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60 tracking-widest italic">Source Signal</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "p-1.5 rounded-lg border shadow-sm",
                            trigger === 'WEBHOOK_RECEIVED' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                        )}>
                            <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-0.5">Event Type</span>
                            <span className="text-[10px] font-bold uppercase truncate max-w-[140px]">{trigger?.replace('_', ' ') || 'Awaiting Selection'}</span>
                        </div>
                    </div>
                </div>
            </Card>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500 border-2 border-white !-bottom-1.5 shadow-md" />
        </div>
    );
}
