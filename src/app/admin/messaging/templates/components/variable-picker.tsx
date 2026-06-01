'use client';

import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Database } from 'lucide-react';
import type { VariableDefinition } from '@/lib/types';

interface VariablePickerProps {
    variables: VariableDefinition[];
    templateCategory: string;
    onSelect: (key: string) => void;
    align?: 'start' | 'center' | 'end';
}

export function VariablePicker({ variables, templateCategory, onSelect, align = 'end' }: VariablePickerProps) {
    const entityVars = React.useMemo(() => {
        return variables.filter(v => v.key.startsWith('contact_') || v.category === 'contact' || v.category === 'custom');
    }, [variables]);

    const brandingVars = React.useMemo(() => {
        return variables.filter(v => v.category === 'common');
    }, [variables]);

    const featureVars = React.useMemo(() => {
        return variables.filter(v => v.category === templateCategory);
    }, [variables, templateCategory]);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground shrink-0"
                    title="Insert Variable"
                >
                    <Database className="h-3.5 w-3.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align={align} className="w-64 p-2 rounded-xl shadow-2xl border max-h-[300px] overflow-y-auto z-50 bg-background select-text">
                <div className="space-y-3 text-left">
                    <div className="px-2 py-1 border-b">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Insert Token</span>
                    </div>
                    
                    {featureVars.length > 0 && (
                        <div className="space-y-1">
                            <span className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest px-2 block">
                                {templateCategory.toUpperCase()} VARIABLES
                            </span>
                            {featureVars.map(v => (
                                <button
                                    key={v.key}
                                    type="button"
                                    onClick={() => onSelect(v.key)}
                                    className="w-full text-left px-2 py-1 text-[10px] rounded hover:bg-muted font-semibold truncate block text-indigo-600"
                                    title={v.label}
                                >
                                    {v.label} <span className="font-mono text-muted-foreground text-[8px]">({`{{${v.key}}}`})</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="space-y-1">
                        <span className="text-[8px] font-bold text-primary uppercase tracking-widest px-2 block">ENTITY FIELDS</span>
                        {entityVars.slice(0, 10).map(v => (
                            <button
                                key={v.key}
                                type="button"
                                onClick={() => onSelect(v.key)}
                                className="w-full text-left px-2 py-1 text-[10px] rounded hover:bg-muted font-semibold truncate block text-foreground"
                                title={v.label}
                            >
                                {v.label} <span className="font-mono text-muted-foreground text-[8px]">({`{{${v.key}}}`})</span>
                            </button>
                        ))}
                    </div>

                    {brandingVars.length > 0 && (
                        <div className="space-y-1">
                            <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest px-2 block">BRAND & CONSTANTS</span>
                            {brandingVars.map(v => (
                                <button
                                    key={v.key}
                                    type="button"
                                    onClick={() => onSelect(v.key)}
                                    className="w-full text-left px-2 py-1 text-[10px] rounded hover:bg-muted font-semibold truncate block text-emerald-600"
                                    title={v.label}
                                >
                                    {v.label} <span className="font-mono text-muted-foreground text-[8px]">({`{{${v.key}}}`})</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
