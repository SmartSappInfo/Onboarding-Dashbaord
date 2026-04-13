
'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Play, Settings2, Mail, Clock, Building, Zap, ArrowRight, MousePointer2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

/**
 * @fileOverview Refined Action Node for Automation Canvas.
 * Provides high-visibility feedback on the specific task being executed.
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
 <span className="text-[10px] font-semibold ">Execute Action</span>
                    </div>
 {selected && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                </div>
 <div className="p-4 space-y-3">
 <div className="space-y-1">
 <p className="text-xs font-semibold text-foreground leading-tight truncate">{data.label || 'Task Step'}</p>
 <p className="text-[9px] font-bold text-muted-foreground opacity-60">Logic Implementation</p>
                    </div>
                    
                    {actionType && (
 <div className="space-y-2">
 <div className="flex flex-wrap gap-1.5">
                                <Badge variant="outline" className="text-[7px] font-semibold uppercase px-1.5 h-4 border-blue-100 bg-blue-50 text-blue-600">
                                    {actionType.replace('_', ' ')}
                                </Badge>
                                {config.priority && (
                                    <Badge variant="outline" className="text-[7px] font-semibold uppercase px-1.5 h-4 bg-muted/50 border-none">
                                        {config.priority}
                                    </Badge>
                                )}
                            </div>
                            
                            {actionType === 'SEND_MESSAGE' && config.recipient && (
 <div className="flex items-center gap-1.5 text-[8px] font-bold text-muted-foreground truncate italic bg-muted/30 p-1 rounded">
 <MousePointer2 className="h-2.5 w-2.5 opacity-40" />
                                    To: {config.recipient}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Card>
 <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500 border-2 border-white !-bottom-1.5 shadow-md" />
        </div>
    );
}
