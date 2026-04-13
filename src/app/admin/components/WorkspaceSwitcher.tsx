'use client';

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { 
    Zap, 
    Target, 
    ChevronDown, 
    Check,
    PlusCircle,
    Layout
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
import type { ContactScope } from '@/lib/types';

/**
 * @fileOverview Refined Workspace Switcher.
 * Filters authorized workspaces within the active Organization context.
 */

/**
 * Maps contactScope values to user-friendly labels
 */
function getScopeLabel(scope: ContactScope | undefined): string | null {
    if (!scope) return null;
    
    const scopeMap: Record<ContactScope, string> = {
        institution: 'Schools',
        family: 'Families',
        person: 'People'
    };
    
    return scopeMap[scope];
}

export default function WorkspaceSwitcher() {
    const { 
        activeWorkspaceId, 
        activeWorkspace, 
        setActiveWorkspace, 
        accessibleWorkspaces, 
        isLoading 
    } = useTenant();

    if (isLoading) {
        return (
 <div className="h-10 w-40 animate-pulse bg-muted rounded-xl border border-border/50" />
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
 <span className="text-[10px] font-semibold leading-none mb-0.5 opacity-60">Workspace</span>
 <span className="text-xs font-semibold tracking-tight truncate leading-none max-w-[100px]">
                            {activeWorkspace?.name || 'Choose track'}
                        </span>
                    </div>
 <ChevronDown size={14} className="opacity-40" />
                </Button>
            </DropdownMenuTrigger>
            
            {accessibleWorkspaces.length > 0 && (
 <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 border-none shadow-2xl animate-in zoom-in-95 duration-200">
 <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground px-3 py-2 flex items-center gap-2">
 <Layout size={12} className="text-primary" />
                        Operational Tracks
                    </DropdownMenuLabel>
                    
 <DropdownMenuSeparator className="mb-2" />

 <div className="max-h-[300px] overflow-y-auto no-scrollbar">
                        {accessibleWorkspaces.map(w => {
                            const scopeLabel = getScopeLabel(w.contactScope);
                            
                            return (
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
 <div className="flex items-center gap-2">
 <p className="font-semibold text-xs truncate">{w.name}</p>
                                            {scopeLabel && (
 <span className={cn(
                                                    "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                                                    activeWorkspaceId === w.id 
                                                        ? "bg-white/20 text-white" 
                                                        : "bg-muted text-muted-foreground"
                                                )}>
                                                    {scopeLabel}
                                                </span>
                                            )}
                                        </div>
 <p className={cn(
                                            "text-[9px] font-bold uppercase tracking-tighter opacity-60", 
                                            activeWorkspaceId === w.id ? "text-white" : "text-muted-foreground"
                                        )}>
                                            {w.description || 'Institutional track'}
                                        </p>
                                    </div>
                                    {activeWorkspaceId === w.id && <Check size={14} />}
                                </DropdownMenuItem>
                            );
                        })}
                    </div>

 <DropdownMenuSeparator className="my-2" />
                    
 <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3 cursor-pointer text-primary hover:bg-primary/5">
                        <Link href="/admin/settings">
 <div className="p-1.5 bg-primary/10 rounded-lg"><PlusCircle size={14} /></div>
 <span className="font-bold text-[10px] ">Manage Workspaces</span>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            )}
        </DropdownMenu>
    );
}
