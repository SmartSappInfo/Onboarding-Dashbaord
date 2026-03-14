'use client';

import * as React from 'react';
import { usePerspective } from '@/context/PerspectiveContext';
import { 
    Zap, 
    Target, 
    ChevronDown, 
    Check,
    ArrowRightLeft
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

/**
 * @fileOverview Perspective Command Component.
 * High-fidelity switcher for toggling between Onboarding and Prospect workspaces.
 */
export default function PerspectiveSwitcher() {
    const { activeTrack, setActiveTrack, allowedTracks, isLoading } = usePerspective();

    if (isLoading || allowedTracks.length <= 1) return null;

    const isProspect = activeTrack === 'prospect';

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="outline" 
                    className={cn(
                        "h-10 px-4 rounded-xl gap-3 border-2 transition-all duration-500 shadow-sm overflow-hidden relative",
                        isProspect ? "border-emerald-500/20 bg-emerald-50/50 text-emerald-700" : "border-primary/20 bg-primary/5 text-primary"
                    )}
                >
                    <div className={cn(
                        "p-1.5 rounded-lg transition-all duration-500",
                        isProspect ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-primary text-white shadow-lg shadow-primary/20"
                    )}>
                        {isProspect ? <Target size={14} /> : <Zap size={14} />}
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none mb-0.5">Perspective</span>
                        <span className="text-xs font-black uppercase tracking-tight truncate leading-none">
                            {isProspect ? 'Prospects Hub' : 'Onboarding Center'}
                        </span>
                    </div>
                    <ChevronDown size={14} className="opacity-40" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 border-none shadow-2xl animate-in zoom-in-95 duration-200">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">Select Workspace</DropdownMenuLabel>
                
                <DropdownMenuItem 
                    onClick={() => setActiveTrack('onboarding')}
                    className={cn(
                        "rounded-xl p-3 gap-4 group transition-all",
                        activeTrack === 'onboarding' ? "bg-primary text-white shadow-xl shadow-primary/20" : "hover:bg-primary/5"
                    )}
                >
                    <div className={cn("p-2 rounded-lg", activeTrack === 'onboarding' ? "bg-white text-primary" : "bg-primary/10 text-primary")}>
                        <Zap size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-xs uppercase">Onboarding</p>
                        <p className={cn("text-[9px] font-bold uppercase tracking-tighter opacity-60", activeTrack === 'onboarding' ? "text-white" : "text-muted-foreground")}>Technical Implementation</p>
                    </div>
                    {activeTrack === 'onboarding' && <Check size={14} />}
                </DropdownMenuItem>

                <DropdownMenuItem 
                    onClick={() => setActiveTrack('prospect')}
                    className={cn(
                        "rounded-xl p-3 gap-4 mt-1 group transition-all",
                        activeTrack === 'prospect' ? "bg-emerald-600 text-white shadow-xl shadow-emerald-200" : "hover:bg-emerald-50"
                    )}
                >
                    <div className={cn("p-2 rounded-lg", activeTrack === 'prospect' ? "bg-white text-emerald-600" : "bg-emerald-100 text-emerald-600")}>
                        <Target size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-xs uppercase">Prospects</p>
                        <p className={cn("text-[9px] font-bold uppercase tracking-tighter opacity-60", activeTrack === 'prospect' ? "text-white" : "text-muted-foreground")}>Lead Acquisition Hub</p>
                    </div>
                    {activeTrack === 'prospect' && <Check size={14} />}
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-2" />
                
                <div className="p-2 px-3">
                    <p className="text-[8px] font-bold text-muted-foreground uppercase leading-relaxed tracking-widest italic opacity-40">
                        Perspective switching isolates school data, tasks, and dashboards for operational clarity.
                    </p>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
