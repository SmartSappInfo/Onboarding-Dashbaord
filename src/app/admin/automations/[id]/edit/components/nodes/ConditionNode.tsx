
'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { ArrowRightLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

/**
 * @fileOverview High-fidelity Condition Node for Automation Canvas.
 * Represents a logical fork in the operational protocol.
 */
export function ConditionNode({ data, selected }: any) {
    const config = data.config || {};

    const groups = config.groups || [];
    const relation = (config.relation || 'and').toUpperCase();
    
    const summary = React.useMemo(() => {
        if (groups.length === 0) {
            const legacyConditions = config.conditions || [];
            if (legacyConditions.length === 0) {
                if (config.operator) {
                    return `${config.field || 'Field'}: ${config.operator.replace('_', ' ')}`;
                }
                return 'Select Rule';
            }
            if (legacyConditions.length === 1) {
                const c = legacyConditions[0];
                return `${c.field || 'Field'}: ${c.operator?.replace('_', ' ') || ''}`;
            }
            return `${legacyConditions.length} Rules (${(config.relation || 'and').toUpperCase()})`;
        }

        let totalConditions = 0;
        groups.forEach((g: any) => {
            totalConditions += (g.conditions || []).length;
        });

        if (totalConditions === 1) {
            const firstCond = groups[0]?.conditions?.[0] || {};
            return `${firstCond.field || 'Field'}: ${firstCond.operator?.replace('_', ' ') || ''}`;
        }

        return `${totalConditions} Rules (${relation})`;
    }, [groups, relation, config.operator, config.field, config.conditions]);

    return (
        <div className={cn(
            "relative transition-all duration-500",
            selected ? "scale-105" : "scale-100"
        )}>
            <Handle 
                type="target" 
                position={Position.Top} 
                className="bg-amber-500 border-2 border-white shadow-lg transition-colors hover:bg-amber-600" 
                style={{ width: '16px', height: '16px', top: '-8px' }}
            />
            
            <Card className={cn(
                "w-64 rounded-2xl border-2 transition-all duration-300 bg-card overflow-hidden shadow-sm text-left",
                selected ? "border-amber-500 shadow-2xl ring-4 ring-amber-500/10" : "border-amber-200"
            )}>
                <div className="bg-amber-500 p-3 flex items-center justify-between border-b border-amber-600/20">
                    <div className="flex items-center gap-2 text-white">
                        <ArrowRightLeft className="h-4 w-4" />
                        <span className="text-[10px] font-semibold ">Evaluate Logic</span>
                    </div>
                    <div className="h-1.5 w-1.5 rounded-full bg-card opacity-40" />
                </div>
                <div className="p-4 space-y-2">
                    <p className="text-xs font-semibold text-foreground leading-tight">{data.label || 'Decision Branch'}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        <Badge variant="outline" className="text-[7px] font-semibold uppercase px-1.5 h-4 border-amber-100 bg-amber-50 text-amber-600 max-w-[220px] truncate">
                            {summary}
                        </Badge>
                    </div>
                </div>
            </Card>

            {/* True Path Output */}
            <Handle 
                type="source" 
                position={Position.Bottom} 
                id="true"
                className="bg-emerald-500 border-2 border-white shadow-lg transition-colors hover:bg-emerald-600" 
                style={{ width: '16px', height: '16px', bottom: '-8px', left: '25%' }}
            />
            <span className="absolute text-[10px] font-bold text-emerald-600 select-none animate-fade-in" style={{ bottom: '-22px', left: '25%', transform: 'translateX(-180%)' }}>
                True
            </span>

            {/* False Path Output */}
            <Handle 
                type="source" 
                position={Position.Bottom} 
                id="false"
                className="bg-rose-500 border-2 border-white shadow-lg transition-colors hover:bg-rose-600" 
                style={{ width: '16px', height: '16px', bottom: '-8px', left: '75%' }}
            />
            <span className="absolute text-[10px] font-bold text-rose-600 select-none animate-fade-in" style={{ bottom: '-22px', left: '75%', transform: 'translateX(80%)' }}>
                False
            </span>
        </div>
    );
}
