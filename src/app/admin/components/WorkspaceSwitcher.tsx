
'use client';

import * as React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { 
    Zap, 
    Target, 
    ChevronDown, 
    Check,
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
import Link from 'next/link';

export default function WorkspaceSwitcher() {
    const { activeWorkspaceId, activeWorkspace, setActiveWorkspace, allowedWorkspaces, isLoading } = useWorkspace();

    if (isLoading || allowedWorkspaces.length === 0) {
        return (
            <div className="h-10 w-40 animate-pulse bg-muted rounded-xl border-2" />
        );
    }

    const wColor = activeWorkspace?.color || '#3B5FFF';

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="outline" 
                    className="h-10 px-4 rounded-xl gap-3 border-2 transition-all duration-500 shadow-sm overflow-hidden relative"
                    style={{ 
                        borderColor: `${wColor}20`, 
                        backgroundColor: `${wColor}05`, 
                        color: wColor 
                    }}
                >
                    <div 
                        className="p-1.5 rounded-lg transition-all duration-500 text-white shadow-lg"
                        style={{ backgroundColor: wColor }}
                    >
                        {activeWorkspaceId === 'prospect' ? <Target size={14} /> : <Zap size={14} />}
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none mb-0.5 opacity-60">Workspace</span>
                        <span className="text-xs font-black uppercase tracking-tight truncate leading-none">
                            {activeWorkspace?.name || 'Workspace'}
                        </span>
                    </div>
                    <ChevronDown size={14} className="opacity-40" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 border-none shadow-2xl animate-in zoom-in-95 duration-200">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">Select Hub</DropdownMenuLabel>
                
                {allowedWorkspaces.map(w => (
                    <DropdownMenuItem 
                        key={w.id}
                        onClick={() => setActiveWorkspace(w.id)}
                        className={cn(
                            "rounded-xl p-3 gap-4 group transition-all mb-1",
                            activeWorkspaceId === w.id ? "bg-primary text-white shadow-xl shadow-primary/20" : "hover:bg-muted/50"
                        )}
                        style={activeWorkspaceId === w.id ? { backgroundColor: w.color } : {}}
                    >
                        <div className={cn(
                            "p-2 rounded-lg", 
                            activeWorkspaceId === w.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                        )}>
                            {w.id === 'prospect' ? <Target size={16} /> : <Zap size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-xs uppercase">{w.name}</p>
                            <p className={cn(
                                "text-[9px] font-bold uppercase tracking-tighter opacity-60", 
                                activeWorkspaceId === w.id ? "text-white" : "text-muted-foreground"
                            )}>
                                {w.description || 'Departmental hub'}
                            </p>
                        </div>
                        {activeWorkspaceId === w.id && <Check size={14} />}
                    </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator className="my-2" />
                
                <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3 cursor-pointer text-primary hover:bg-primary/5">
                    <Link href="/admin/settings">
                        <div className="p-1.5 bg-primary/10 rounded-lg"><PlusCircle size={14} /></div>
                        <span className="font-bold text-[10px] uppercase tracking-widest">Manage Workspaces</span>
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
