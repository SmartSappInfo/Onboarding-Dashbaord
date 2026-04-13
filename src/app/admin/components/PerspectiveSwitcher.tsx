
'use client';

import * as React from 'react';
import { usePerspective } from '@/context/PerspectiveContext';
import { 
    Zap, 
    Target, 
    ChevronDown, 
    Check,
    Layout,
    PlusCircle
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

/**
 * @fileOverview Perspective Command Component.
 * Dynamically renders the perspective switcher based on Firestore configuration.
 */
export default function PerspectiveSwitcher() {
    const { activeTrack, activePerspective, setActiveTrack, allowedPerspectives, isLoading } = usePerspective();

    if (isLoading || allowedPerspectives.length === 0) {
        return (
 <div className="h-10 w-40 animate-pulse bg-muted rounded-xl border-2" />
        );
    }

    const pColor = activePerspective?.color || '#3B5FFF';

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="outline" 
 className="h-10 px-4 rounded-xl gap-3 border-2 transition-all duration-500 shadow-sm overflow-hidden relative"
                    style={{ 
                        borderColor: `${pColor}20`, 
                        backgroundColor: `${pColor}05`, 
                        color: pColor 
                    }}
                >
                    <div 
 className="p-1.5 rounded-lg transition-all duration-500 text-white shadow-lg"
                        style={{ backgroundColor: pColor }}
                    >
                        {activeTrack === 'prospect' ? <Target size={14} /> : <Zap size={14} />}
                    </div>
 <div className="flex flex-col items-start min-w-0">
 <span className="text-[10px] font-semibold leading-none mb-0.5 opacity-60">Perspective</span>
 <span className="text-xs font-semibold tracking-tight truncate leading-none">
                            {activePerspective?.name || 'Workspace'}
                        </span>
                    </div>
 <ChevronDown size={14} className="opacity-40" />
                </Button>
            </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 border-none shadow-2xl animate-in zoom-in-95 duration-200">
 <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground px-3 py-2">Select Workspace</DropdownMenuLabel>
                
                {allowedPerspectives.map(p => (
                    <DropdownMenuItem 
                        key={p.id}
                        onClick={() => setActiveTrack(p.id)}
 className={cn(
                            "rounded-xl p-3 gap-4 group transition-all mb-1",
                            activeTrack === p.id ? "bg-primary text-white shadow-xl shadow-primary/20" : "hover:bg-background0"
                        )}
                        style={activeTrack === p.id ? { backgroundColor: p.color } : {}}
                    >
 <div className={cn(
                            "p-2 rounded-lg", 
                            activeTrack === p.id ? "bg-card/20 text-white" : "bg-muted text-muted-foreground"
                        )}>
                            {p.id === 'prospect' ? <Target size={16} /> : <Zap size={16} />}
                        </div>
 <div className="flex-1 min-w-0">
 <p className="font-semibold text-xs ">{p.name}</p>
 <p className={cn(
                                "text-[9px] font-bold uppercase tracking-tighter opacity-60", 
                                activeTrack === p.id ? "text-white" : "text-muted-foreground"
                            )}>
                                {p.description || 'Institutional track'}
                            </p>
                        </div>
                        {activeTrack === p.id && <Check size={14} />}
                    </DropdownMenuItem>
                ))}

 <DropdownMenuSeparator className="my-2" />
                
 <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3 cursor-pointer text-primary hover:bg-primary/5">
                    <Link href="/admin/settings">
 <div className="p-1.5 bg-primary/10 rounded-lg"><PlusCircle size={14} /></div>
 <span className="font-bold text-[10px] ">Manage Hubs</span>
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
