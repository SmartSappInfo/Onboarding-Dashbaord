
'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { HelpCircle, Check, X, ArrowRightLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

/**
 * @fileOverview High-fidelity Condition Node for Automation Canvas.
 * Represents a logical fork in the operational protocol.
 */
export function ConditionNode({ data, selected }: any) {
    const config = data.config || {};

    return (
 <div className={cn(
            "relative transition-all duration-500",
            selected ? "scale-105" : "scale-100"
        )}>
 <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500 border-2 border-white !-top-1.5 shadow-md" />
            
 <Card className={cn(
                "w-64 rounded-2xl border-2 transition-all duration-300 bg-white overflow-hidden shadow-sm text-left",
                selected ? "border-amber-500 shadow-2xl ring-4 ring-amber-500/10" : "border-amber-200"
            )}>
 <div className="bg-amber-500 p-3 flex items-center justify-between border-b border-amber-600/20">
 <div className="flex items-center gap-2 text-white">
 <ArrowRightLeft className="h-4 w-4" />
 <span className="text-[10px] font-semibold ">Evaluate Logic</span>
                    </div>
 <div className="h-1.5 w-1.5 rounded-full bg-white opacity-40" />
                </div>
 <div className="p-4 space-y-2">
 <p className="text-xs font-semibold text-foreground leading-tight">{data.label || 'Decision Branch'}</p>
 <div className="flex flex-wrap gap-1.5 pt-1">
                        <Badge variant="outline" className="text-[7px] font-semibold uppercase px-1.5 h-4 border-amber-100 bg-amber-50 text-amber-600">
                            {config.operator?.replace('_', ' ') || 'Select Rule'}
                        </Badge>
                    </div>
                </div>
            </Card>

            {/* True Path Output */}
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

            {/* False Path Output */}
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
