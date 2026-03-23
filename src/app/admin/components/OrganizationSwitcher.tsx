'use client';

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { 
    Building, 
    ChevronDown, 
    Check,
    Globe,
    ShieldAlert
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
 * @fileOverview Global Organization Switcher for Super Admins.
 * Allows switching between Organizations to manage partitioned data.
 */
export default function OrganizationSwitcher() {
    const { 
        activeOrganizationId, 
        activeOrganization, 
        setActiveOrganization, 
        availableOrganizations, 
        isSuperAdmin,
        isLoading 
    } = useTenant();

    if (!isSuperAdmin) return null;

    if (isLoading) {
        return <div className="h-10 w-48 animate-pulse bg-muted rounded-xl border border-border/50" />;
    }

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="outline" 
                    className="h-10 px-4 rounded-xl gap-3 border-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all shadow-sm"
                >
                    <div className="p-1.5 bg-primary text-white rounded-lg shadow-lg">
                        <Globe size={14} />
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                        <span className="text-[9px] font-black uppercase tracking-widest leading-none mb-0.5 opacity-60">System Context</span>
                        <span className="text-xs font-black uppercase tracking-tight truncate leading-none max-w-[120px]">
                            {activeOrganization?.name || 'Select Org'}
                        </span>
                    </div>
                    <ChevronDown size={14} className="opacity-40" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 rounded-2xl p-2 border-none shadow-2xl animate-in zoom-in-95 duration-200">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2 flex items-center gap-2">
                    <ShieldAlert size={12} className="text-primary" />
                    Sovereign Context Switcher
                </DropdownMenuLabel>
                
                <DropdownMenuSeparator className="mb-2" />

                <div className="max-h-[300px] overflow-y-auto no-scrollbar">
                    {availableOrganizations.map(org => (
                        <DropdownMenuItem 
                            key={org.id}
                            onClick={() => setActiveOrganization(org.id)}
                            className={cn(
                                "rounded-xl p-3 gap-4 group transition-all mb-1",
                                activeOrganizationId === org.id ? "bg-primary text-white shadow-xl shadow-primary/20" : "hover:bg-muted/50"
                            )}
                        >
                            <div className={cn(
                                "p-2 rounded-lg", 
                                activeOrganizationId === org.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                            )}>
                                <Building size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-xs uppercase truncate">{org.name}</p>
                                <p className={cn(
                                    "text-[9px] font-bold uppercase tracking-tighter opacity-60", 
                                    activeOrganizationId === org.id ? "text-white" : "text-muted-foreground"
                                )}>
                                    ID: {org.id}
                                </p>
                            </div>
                            {activeOrganizationId === org.id && <Check size={14} />}
                        </DropdownMenuItem>
                    ))}
                </div>

                <DropdownMenuSeparator className="my-2" />
                <div className="px-3 py-2">
                    <p className="text-[8px] font-bold text-muted-foreground leading-relaxed uppercase tracking-tighter">
                        Switching Organization re-partitions all dashboard metrics and data tables to the selected tenant.
                    </p>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
