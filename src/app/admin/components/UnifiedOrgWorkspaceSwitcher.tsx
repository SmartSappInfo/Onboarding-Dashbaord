'use client';

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { 
    Building, 
    ChevronDown, 
    Check,
    Settings,
    PlusCircle,
    Zap,
    Target,
    Users,
    User,
    Building2,
    ChevronRight
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import type { ContactScope } from '@/lib/types';

/**
 * Unified Organization and Workspace Switcher
 * 
 * Displays in the app title area showing:
 * - Organization logo and name
 * - Current workspace (if selected)
 * 
 * Dropdown reveals:
 * - All organizations (for super admins)
 * - Workspaces under each organization (expandable sub-menu)
 * - Manage Organizations button
 * - Manage Workspaces button
 */

const ENTITY_TYPE_ICONS = {
    institution: Building2,
    family: Users,
    person: User,
};

function getScopeLabel(scope: ContactScope | undefined): string | null {
    if (!scope) return null;
    
    const scopeMap: Record<ContactScope, string> = {
        institution: 'Schools',
        family: 'Families',
        person: 'People'
    };
    
    return scopeMap[scope];
}

export default function UnifiedOrgWorkspaceSwitcher() {
    const { 
        activeOrganizationId, 
        activeOrganization, 
        activeWorkspaceId, 
        activeWorkspace,
        setActiveOrganization, 
        setActiveWorkspace, 
        availableOrganizations, 
        accessibleWorkspaces,
        isSuperAdmin,
        isLoading 
    } = useTenant();

    const [expandedOrgId, setExpandedOrgId] = React.useState<string | null>(null);

    if (isLoading) {
        return (
            <div className="h-12 w-64 animate-pulse bg-muted rounded-xl border border-border/50" />
        );
    }

    const handleOrganizationSwitch = (orgId: string) => {
        if (isSuperAdmin) {
            setActiveOrganization(orgId);
            // Auto-select first workspace in the new organization
            const orgWorkspaces = availableOrganizations
                .find(o => o.id === orgId)
                ?.id === orgId ? accessibleWorkspaces : [];
            
            if (orgWorkspaces.length > 0) {
                setActiveWorkspace(orgWorkspaces[0].id);
            }
        }
    };

    const scopeLabel = getScopeLabel(activeWorkspace?.contactScope);
    const ScopeIcon = activeWorkspace?.contactScope 
        ? ENTITY_TYPE_ICONS[activeWorkspace.contactScope] 
        : Zap;

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="outline" 
                    className="h-12 px-4 rounded-xl gap-3 border-2 transition-all duration-300 shadow-sm hover:shadow-md"
                    style={{ 
                        borderColor: activeWorkspace?.color ? `${activeWorkspace.color}20` : '#3B5FFF20',
                        backgroundColor: activeWorkspace?.color ? `${activeWorkspace.color}05` : '#3B5FFF05',
                    }}
                >
                    {/* Organization Logo/Icon */}
                    <div className="flex items-center gap-2">
                        {activeOrganization?.logoUrl ? (
                            <img 
                                src={activeOrganization.logoUrl} 
                                alt={activeOrganization.name}
                                className="h-8 w-8 rounded-lg object-cover shadow-sm"
                            />
                        ) : (
                            <div className="p-1.5 bg-primary text-white rounded-lg shadow-sm">
                                <Building className="h-5 w-5" />
                            </div>
                        )}
                    </div>

                    {/* Organization & Workspace Info */}
                    <div className="flex flex-col items-start min-w-0 text-left">
                        <span className="text-[9px] font-black uppercase tracking-widest leading-none mb-1 opacity-60">
                            {activeOrganization?.name || 'Organization'}
                        </span>
                        {activeWorkspace && (
                            <div className="flex items-center gap-1.5">
                                <div 
                                    className="p-0.5 rounded transition-all"
                                    style={{ backgroundColor: activeWorkspace.color || '#3B5FFF' }}
                                >
                                    <ScopeIcon className="h-3 w-3 text-white" />
                                </div>
                                <span className="text-xs font-black uppercase tracking-tight truncate leading-none max-w-[120px]">
                                    {activeWorkspace.name}
                                </span>
                                {scopeLabel && (
                                    <Badge variant="secondary" className="text-[8px] font-bold uppercase px-1 h-3.5">
                                        {scopeLabel}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <ChevronDown className="h-4 w-4 opacity-40 ml-auto" />
                </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent 
                align="start" 
                className="w-80 rounded-2xl p-2 border-none shadow-2xl animate-in zoom-in-95 duration-200"
            >
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">
                    {isSuperAdmin ? 'System Context' : 'Workspace Selection'}
                </DropdownMenuLabel>
                
                <DropdownMenuSeparator className="mb-2" />

                <ScrollArea className="max-h-[400px]">
                    <div className="space-y-1">
                        {isSuperAdmin ? (
                            // Super Admin: Show all organizations with workspace sub-menus
                            availableOrganizations.map(org => {
                                const orgWorkspaces = accessibleWorkspaces.filter(w => w.organizationId === org.id);
                                const isActiveOrg = activeOrganizationId === org.id;

                                return (
                                    <DropdownMenuSub key={org.id}>
                                        <DropdownMenuSubTrigger
                                            className={cn(
                                                "rounded-xl p-3 gap-3 transition-all",
                                                isActiveOrg && "bg-primary/5 text-primary"
                                            )}
                                        >
                                            <div className={cn(
                                                "p-2 rounded-lg shrink-0", 
                                                isActiveOrg ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                            )}>
                                                {org.logoUrl ? (
                                                    <img src={org.logoUrl} alt={org.name} className="h-4 w-4 rounded object-cover" />
                                                ) : (
                                                    <Building className="h-4 w-4" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 text-left">
                                                <p className="font-black text-xs uppercase truncate">{org.name}</p>
                                                <p className="text-[9px] font-medium text-muted-foreground">
                                                    {orgWorkspaces.length} workspace{orgWorkspaces.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                            {isActiveOrg && <Check className="h-4 w-4 ml-auto" />}
                                        </DropdownMenuSubTrigger>
                                        
                                        <DropdownMenuSubContent className="w-72 rounded-xl p-2 border-none shadow-xl">
                                            <div className="px-3 py-2 mb-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                    {org.name} Workspaces
                                                </p>
                                            </div>
                                            
                                            {orgWorkspaces.length === 0 ? (
                                                <div className="px-3 py-6 text-center">
                                                    <p className="text-xs text-muted-foreground">No workspaces available</p>
                                                </div>
                                            ) : (
                                                <ScrollArea className="max-h-[300px]">
                                                    {orgWorkspaces.map(w => {
                                                        const isActive = activeWorkspaceId === w.id && isActiveOrg;
                                                        const wScopeLabel = getScopeLabel(w.contactScope);
                                                        const WScopeIcon = w.contactScope ? ENTITY_TYPE_ICONS[w.contactScope] : Zap;

                                                        return (
                                                            <DropdownMenuItem
                                                                key={w.id}
                                                                onClick={() => {
                                                                    if (!isActiveOrg) {
                                                                        handleOrganizationSwitch(org.id);
                                                                    }
                                                                    setActiveWorkspace(w.id);
                                                                }}
                                                                className={cn(
                                                                    "rounded-lg p-3 gap-3 mb-1 transition-all",
                                                                    isActive && "bg-primary text-white shadow-md"
                                                                )}
                                                                style={isActive ? { backgroundColor: w.color } : {}}
                                                            >
                                                                <div className={cn(
                                                                    "p-1.5 rounded-lg shrink-0",
                                                                    isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                                                                )}>
                                                                    <WScopeIcon className="h-4 w-4" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="font-black text-xs uppercase truncate">{w.name}</p>
                                                                        {wScopeLabel && (
                                                                            <Badge 
                                                                                variant={isActive ? "secondary" : "outline"}
                                                                                className={cn(
                                                                                    "text-[8px] font-bold uppercase px-1 h-3.5",
                                                                                    isActive && "bg-white/20 text-white border-white/30"
                                                                                )}
                                                                            >
                                                                                {wScopeLabel}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    {w.description && (
                                                                        <p className={cn(
                                                                            "text-[9px] font-medium truncate mt-0.5",
                                                                            isActive ? "text-white/70" : "text-muted-foreground"
                                                                        )}>
                                                                            {w.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                {isActive && <Check className="h-4 w-4 ml-auto" />}
                                                            </DropdownMenuItem>
                                                        );
                                                    })}
                                                </ScrollArea>
                                            )}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                );
                            })
                        ) : (
                            // Regular User: Show only accessible workspaces
                            accessibleWorkspaces.map(w => {
                                const isActive = activeWorkspaceId === w.id;
                                const wScopeLabel = getScopeLabel(w.contactScope);
                                const WScopeIcon = w.contactScope ? ENTITY_TYPE_ICONS[w.contactScope] : Zap;

                                return (
                                    <DropdownMenuItem
                                        key={w.id}
                                        onClick={() => setActiveWorkspace(w.id)}
                                        className={cn(
                                            "rounded-xl p-3 gap-3 mb-1 transition-all",
                                            isActive && "bg-primary text-white shadow-md"
                                        )}
                                        style={isActive ? { backgroundColor: w.color } : {}}
                                    >
                                        <div className={cn(
                                            "p-2 rounded-lg shrink-0",
                                            isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                                        )}>
                                            <WScopeIcon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-black text-xs uppercase truncate">{w.name}</p>
                                                {wScopeLabel && (
                                                    <Badge 
                                                        variant={isActive ? "secondary" : "outline"}
                                                        className={cn(
                                                            "text-[8px] font-bold uppercase px-1.5 h-4",
                                                            isActive && "bg-white/20 text-white border-white/30"
                                                        )}
                                                    >
                                                        {wScopeLabel}
                                                    </Badge>
                                                )}
                                            </div>
                                            {w.description && (
                                                <p className={cn(
                                                    "text-[9px] font-medium truncate mt-0.5",
                                                    isActive ? "text-white/70" : "text-muted-foreground"
                                                )}>
                                                    {w.description}
                                                </p>
                                            )}
                                        </div>
                                        {isActive && <Check className="h-4 w-4 ml-auto" />}
                                    </DropdownMenuItem>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>

                <DropdownMenuSeparator className="my-2" />
                
                {/* Management Actions */}
                <div className="space-y-1">
                    {isSuperAdmin && (
                        <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3 cursor-pointer text-primary hover:bg-primary/5">
                            <Link href="/admin/settings/organizations">
                                <div className="p-1.5 bg-primary/10 rounded-lg">
                                    <Settings className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-[10px] uppercase tracking-widest">Manage Organizations</span>
                            </Link>
                        </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3 cursor-pointer text-primary hover:bg-primary/5">
                        <Link href="/admin/settings">
                            <div className="p-1.5 bg-primary/10 rounded-lg">
                                <PlusCircle className="h-4 w-4" />
                            </div>
                            <span className="font-bold text-[10px] uppercase tracking-widest">Manage Workspaces</span>
                        </Link>
                    </DropdownMenuItem>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
