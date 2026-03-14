
'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Play, Settings2, ArrowRight, Mail, Clock, Building } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

/**
 * @fileOverview Functional Action Node for Automation Canvas.
 * Represents a discrete task performed by the system.
 */
export function ActionNode({ data, selected }: any) {
    const actionType = data.actionType;
    const config = data.config || {};

    const getIcon = () => {
        switch(actionType) {
            case 'SEND_MESSAGE': return Mail;
            case 'CREATE_TASK': return Clock;
            case 'UPDATE_SCHOOL': return Building;
            default: return Play;
        }
    };

    const Icon = getIcon();

    return (
        <div className={cn(
            "relative transition-all duration-500",
            selected ? "scale-105" : "scale-100"
        )}>
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 border-2 border-white !-top-1.5 shadow-md" />
            <Card className={cn(
                "w-64 rounded-2xl border-2 transition-all duration-300 bg-white overflow-hidden shadow-sm text-left",
                selected ? "border-blue-500 shadow-2xl ring-4 ring-blue-500/10" : "border-blue-200"
            )}>
                <div className="bg-blue-500 p-3 flex items-center justify-between border-b border-blue-600/20">
                    <div className="flex items-center gap-2 text-white">
                        <Icon className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Execute Action</span>
                    </div>
                    <Settings2 className={cn("h-3.5 w-3.5 transition-all", selected ? "text-white" : "text-white/40")} />
                </div>
                <div className="p-4 space-y-2">
                    <p className="text-xs font-black uppercase text-foreground leading-tight truncate">{data.label || 'Task Step'}</p>
                    {actionType && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            <Badge variant="outline" className="text-[7px] font-black uppercase px-1.5 h-4 border-blue-100 bg-blue-50 text-blue-600">
                                {actionType.replace('_', ' ')}
                            </Badge>
                            {config.priority && (
                                <Badge variant="outline" className="text-[7px] font-black uppercase px-1.5 h-4 opacity-60">
                                    {config.priority}
                                </Badge>
                            )}
                        </div>
                    )}
                </div>
            </Card>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500 border-2 border-white !-bottom-1.5 shadow-md" />
        </div>
    );
}
