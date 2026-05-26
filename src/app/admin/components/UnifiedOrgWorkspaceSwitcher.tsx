'use client';

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { usePathname, useRouter } from 'next/navigation';
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
    ChevronRight,
    ExternalLink,
    ShieldAlert,
    ArrowRight,
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
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { useSidebar, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import type { ContactScope } from '@/lib/types';
import { 
    getPermissionForRoute, 
    canAccessRoute, 
    getAccessibleRoutes, 
    getRouteHref 
} from '@/lib/route-permissions';

interface UnifiedOrgWorkspaceSwitcherProps {
    variant?: 'sidebar' | 'header';
}

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
 * - Manage Organizations button (at bottom)
 * - Manage Workspaces button (inside each org sub-menu)
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

export default function UnifiedOrgWorkspaceSwitcher({ variant = 'header' }: UnifiedOrgWorkspaceSwitcherProps) {
    const { 
        activeOrganizationId, 
        activeOrganization, 
        activeWorkspaceId, 
        activeWorkspace,
        setActiveOrganization, 
        setActiveWorkspace, 
        switchOrganizationAndWorkspace,
        availableOrganizations, 
        accessibleWorkspaces,
        allAccessibleWorkspaces,
        isSuperAdmin,
        getPermissionsSchemaForWorkspace,
        isLoading 
    } = useTenant();
    const { state } = useSidebar();
    const router = useRouter();
    const pathname = usePathname();

    const [expandedOrgId, setExpandedOrgId] = React.useState<string | null>(null);

    // Access interception state
    type InterceptState = {
        targetWorkspaceId: string;
        targetOrgId?: string;
        blockedFeatureLabel: string;
        alternatives: { label: string; href: string }[];
    };
    const [interceptState, setInterceptState] = React.useState<InterceptState | null>(null);

    /**
     * Intercept workspace switch: check if the user can access the current page
     * in the target workspace. If not, show a permission alert with alternatives.
     */
    const handleWorkspaceSwitch = React.useCallback((targetWorkspaceId: string, targetOrgId?: string) => {
        const routeCheck = getPermissionForRoute(pathname);

        // If we can't determine required permission, just switch
        if (!routeCheck) {
            if (targetOrgId) setActiveOrganization(targetOrgId);
            setActiveWorkspace(targetWorkspaceId);
            return;
        }

        // Get schema for the target workspace
        const targetSchema = getPermissionsSchemaForWorkspace(targetWorkspaceId);
        const hasAccess = canAccessRoute(targetSchema, routeCheck, isSuperAdmin);

        if (hasAccess) {
            if (targetOrgId) setActiveOrganization(targetOrgId);
            setActiveWorkspace(targetWorkspaceId);
            return;
        }

        // Build alternatives: find 2 routes the user CAN access in the target workspace
        const accessibleChecks = getAccessibleRoutes(targetSchema, isSuperAdmin, 2);
        const alternatives = accessibleChecks.map(check => ({
            label: check.label,
            href: getRouteHref(check, targetWorkspaceId),
        }));

        // Show the interception dialog instead of switching
        setInterceptState({
            targetWorkspaceId,
            targetOrgId,
            blockedFeatureLabel: routeCheck.label,
            alternatives,
        });
    }, [pathname, getPermissionsSchemaForWorkspace, isSuperAdmin, setActiveOrganization, setActiveWorkspace]);

    const confirmSwitch = React.useCallback(() => {
        if (!interceptState) return;
        if (interceptState.targetOrgId) setActiveOrganization(interceptState.targetOrgId);
        setActiveWorkspace(interceptState.targetWorkspaceId);
        router.push(`/admin?track=${interceptState.targetWorkspaceId}`);
        setInterceptState(null);
    }, [interceptState, setActiveOrganization, setActiveWorkspace, router]);

    const handleOrganizationSwitch = (orgId: string) => {
        if (!isSuperAdmin) return;
        
        const org = availableOrganizations.find(o => o.id === orgId);
        if (!org) return;

        const orgWorkspaces = allAccessibleWorkspaces.filter(w => w.organizationId === orgId);
        
        if (orgWorkspaces.length > 0) {
            const targetWorkspaceId = org.defaultWorkspaceId && orgWorkspaces.find(w => w.id === org.defaultWorkspaceId)
                ? org.defaultWorkspaceId
                : orgWorkspaces[0].id;
            handleWorkspaceSwitch(targetWorkspaceId, orgId);
        } else {
            setActiveOrganization(orgId);
            router.push('/admin/settings');
        }
    };

    const scopeLabel = getScopeLabel(activeWorkspace?.contactScope);
    const ScopeIcon = activeWorkspace?.contactScope 
        ? ENTITY_TYPE_ICONS[activeWorkspace.contactScope] 
        : Zap;

    if (isLoading) {
        return (
            <div className="h-12 w-64 animate-pulse bg-muted rounded-xl border border-border/50" />
        );
    }

    const trigger = variant === 'sidebar' ? (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                        size="lg"
                        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-xl h-14 bg-card/5 hover:bg-card/10 border border-border/50 transition-all group"
                    >
                        <div className="flex aspect-square size-10 items-center justify-center rounded-lg bg-card text-sidebar-primary-foreground shadow-xl group-hover:scale-110 transition-transform overflow-hidden">
                            {activeOrganization?.logoUrl ? (
                                <img src={activeOrganization.logoUrl} alt={activeOrganization.name} className="h-full w-full object-cover" />
                            ) : (
                                <Building className="size-5 text-primary" />
                            )}
                        </div>
                        <div className="grid flex-1 text-left text-sm leading-tight ml-1 group-data-[collapsible=icon]:hidden">
                            <span className="truncate font-semibold tracking-tighter text-foreground text-base">
                                {activeOrganization?.name || 'Organization'}
                            </span>
                            <span className="truncate text-[10px] font-bold text-muted-foreground leading-none mt-0.5">
                                {activeWorkspace?.name || 'No Workspace selected'}
                            </span>
                        </div>
 <ChevronRight className="ml-auto size-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all group-data-[collapsible=icon]:hidden" />
                    </SidebarMenuButton>
                </DropdownMenuTrigger>
            </SidebarMenuItem>
        </SidebarMenu>
    ) : (
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
 <span className="text-[9px] font-semibold leading-none mb-1 opacity-60">
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
 <span className="text-xs font-semibold tracking-tight truncate leading-none max-w-[120px]">
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
    );

    return (
        <>
        <DropdownMenu modal={false}>
            {trigger}
            
            <DropdownMenuContent 
                align="start" 
 className="w-80 rounded-2xl p-2 border-none shadow-2xl animate-in zoom-in-95 duration-200"
            >
 <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground px-3 py-2">
                    {isSuperAdmin ? 'System Context' : 'Workspace Selection'}
                </DropdownMenuLabel>
                
 <DropdownMenuSeparator className="mb-2" />

 <ScrollArea className="max-h-[400px]">
 <div className="space-y-1">
                        {isSuperAdmin ? (
                            // Super Admin: Show all organizations with workspace sub-menus
                            availableOrganizations.map(org => {
                                const orgWorkspaces = allAccessibleWorkspaces.filter(w => w.organizationId === org.id);
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
                                            <div 
 className="flex-1 min-w-0 text-left cursor-pointer group/org"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOrganizationSwitch(org.id);
                                                }}
                                            >
 <div className="flex items-center gap-1">
 <p className="font-semibold text-xs truncate group-hover/org:text-primary transition-colors">{org.name}</p>
 <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover/org:opacity-100 text-primary transition-all" />
                                                </div>
 <p className="text-[9px] font-medium text-muted-foreground">
                                                    {orgWorkspaces.length} workspace{orgWorkspaces.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
 {isActiveOrg && <Check className="h-4 w-4 ml-auto" />}
                                        </DropdownMenuSubTrigger>
                                        
 <DropdownMenuSubContent className="w-72 rounded-xl p-2 border-none shadow-xl">
 <div className="px-3 py-2 mb-2 flex items-center justify-between">
 <p className="text-[10px] font-semibold text-muted-foreground">
                                                    {org.name} Workspaces
                                                </p>
                                            </div>
                                            
                                            {orgWorkspaces.length === 0 ? (
 <div className="px-3 py-6 text-center">
 <p className="text-xs text-muted-foreground">No workspaces available</p>
                                                </div>
                                            ) : (
                                                <div className="max-h-[300px] overflow-y-auto overflow-x-hidden no-scrollbar pr-1">
                                                    {orgWorkspaces.map(w => {
                                                        const isActive = activeWorkspaceId === w.id && isActiveOrg;
                                                        const isDefault = org.defaultWorkspaceId === w.id;
                                                        const wScopeLabel = getScopeLabel(w.contactScope);
                                                        const WScopeIcon = w.contactScope ? ENTITY_TYPE_ICONS[w.contactScope] : Zap;

                                                        return (
                                                            <DropdownMenuItem
                                                                key={w.id}
                                                                onClick={() => {
                                                                    handleWorkspaceSwitch(w.id, isActiveOrg ? undefined : org.id);
                                                                }}
                                                                className={cn(
                                                                    "rounded-lg p-3 gap-3 mb-1 transition-all",
                                                                    isActive && "bg-primary text-white shadow-md"
                                                                )}
                                                                style={isActive ? { backgroundColor: w.color } : {}}
                                                            >
                                                                <div className={cn(
                                                                    "p-1.5 rounded-lg shrink-0",
                                                                    isActive ? "bg-card/20 text-white" : "bg-muted text-muted-foreground"
                                                                )}>
                                                                    <WScopeIcon className="h-4 w-4" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                                                            <p className="font-semibold text-xs whitespace-normal break-words">{w.name}</p>
                                                                            {isDefault && (
                                                                                <div className="h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] shrink-0" title="Default Workspace" />
                                                                            )}
                                                                        </div>
                                                                        {wScopeLabel && (
                                                                            <Badge 
                                                                                variant={isActive ? "secondary" : "outline"}
                                                                                className={cn(
                                                                                    "text-[8px] font-bold uppercase px-1 h-3.5",
                                                                                    isActive && "bg-card/20 text-white border-white/30"
                                                                                )}
                                                                            >
                                                                                {wScopeLabel}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    {w.description && (
                                                                        <p className={cn(
                                                                            "text-[9px] font-medium whitespace-normal break-words mt-0.5",
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
                                                </div>
                                            )}

 <DropdownMenuSeparator className="my-2" />
                                            
                                            <DropdownMenuItem 
                                                onClick={() => {
                                                    const orgWorkspaces = allAccessibleWorkspaces.filter(w => w.organizationId === org.id);
                                                    const targetW = org.id === activeOrganizationId 
                                                        ? orgWorkspaces.find(w => w.id === activeWorkspaceId) || orgWorkspaces[0]
                                                        : orgWorkspaces.find(w => w.id === org.defaultWorkspaceId) || orgWorkspaces[0];
                                                    
                                                    if (targetW) {
                                                        switchOrganizationAndWorkspace(org.id, targetW.id);
                                                        router.push(`/admin/settings?track=${targetW.id}&workspaceId=${targetW.id}`);
                                                    } else {
                                                        setActiveOrganization(org.id);
                                                        router.push('/admin/settings');
                                                    }
                                                }}
 className="rounded-lg p-2 gap-3 cursor-pointer text-primary hover:bg-primary/5"
                                            >
 <div className="p-1.5 bg-primary/10 rounded-lg">
 <Settings className="h-3.5 w-3.5" />
                                                </div>
 <span className="font-bold text-[9px] ">Manage Workspaces</span>
                                            </DropdownMenuItem>
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
                                        onClick={() => handleWorkspaceSwitch(w.id)}
 className={cn(
                                            "rounded-xl p-3 gap-3 mb-1 transition-all",
                                            isActive && "bg-primary text-white shadow-md"
                                        )}
                                        style={isActive ? { backgroundColor: w.color } : {}}
                                    >
 <div className={cn(
                                            "p-2 rounded-lg shrink-0",
                                            isActive ? "bg-card/20 text-white" : "bg-muted text-muted-foreground"
                                        )}>
 <WScopeIcon className="h-4 w-4" />
                                        </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <p className="font-semibold text-xs truncate">{w.name}</p>
                                                {wScopeLabel && (
                                                    <Badge 
                                                        variant={isActive ? "secondary" : "outline"}
 className={cn(
                                                            "text-[8px] font-bold uppercase px-1.5 h-4",
                                                            isActive && "bg-card/20 text-white border-white/30"
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
 <span className="font-bold text-[10px] ">Manage Organizations</span>
                            </Link>
                        </DropdownMenuItem>
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>

        {/* Workspace Access Interception Dialog */}
        <AlertDialog open={!!interceptState} onOpenChange={(open) => { if (!open) setInterceptState(null); }}>
            <AlertDialogContent className="max-w-md rounded-2xl border-none shadow-2xl bg-background/95 backdrop-blur-xl ring-1 ring-border">
                <AlertDialogHeader className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl ring-1 ring-amber-200">
                            <ShieldAlert className="h-5 w-5" />
                        </div>
                        <AlertDialogTitle className="text-lg font-black tracking-tight">
                            Access Restricted
                        </AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
                        You don't have access to{' '}
                        <span className="font-bold text-foreground">
                            {interceptState?.blockedFeatureLabel}
                        </span>{' '}
                        in this workspace.
                        {interceptState?.alternatives && interceptState.alternatives.length > 0 && (
                            <span> Here are pages you can access:</span>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {/* Alternative navigation options */}
                {interceptState?.alternatives && interceptState.alternatives.length > 0 && (
                    <div className="space-y-2 my-1">
                        {interceptState.alternatives.map((alt) => (
                            <Link
                                key={alt.href}
                                href={alt.href}
                                onClick={() => {
                                    if (interceptState.targetOrgId) setActiveOrganization(interceptState.targetOrgId);
                                    setActiveWorkspace(interceptState.targetWorkspaceId);
                                    setInterceptState(null);
                                }}
                                className="flex items-center justify-between w-full p-3 rounded-xl bg-muted/40 hover:bg-primary/5 hover:text-primary border border-border hover:border-primary/20 transition-all group"
                            >
                                <span className="text-sm font-semibold">{alt.label}</span>
                                <ArrowRight className="h-4 w-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                            </Link>
                        ))}
                    </div>
                )}

                <AlertDialogFooter className="gap-2 mt-2">
                    <AlertDialogCancel className="rounded-xl">
                        Cancel
                    </AlertDialogCancel>
                    <Button
                        variant="outline"
                        onClick={confirmSwitch}
                        className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300"
                    >
                        Switch Anyway
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
