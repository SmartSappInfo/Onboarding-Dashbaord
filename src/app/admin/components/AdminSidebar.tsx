'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
    LayoutDashboard, 
    Layout,
    School, 
    Settings, 
    Calendar, 
    ExternalLink, 
    Film, 
    ClipboardList, 
    Users, 
    Workflow, 
    History, 
    FileText, 
    MessageSquareText,
    PhoneCall,
    Globe,
    CheckSquare,
    Zap,
    BarChart3,
    NotebookPen,
    Receipt,
    Package,
    Timer,
    Settings2,
    FileCheck,
    Tags,
    ClipboardSignature,
    Database,
    ShieldEllipsis,
    Mail,
    Cog,
    QrCode,
    Bot,
    Code,
    Unplug,
    ShieldCheck,
    ChevronRight,
    Lock,
    Sparkles,
    Sliders,
    Image,
    ArrowLeft,
    Building,
    Check,
    User,
    Building2
} from 'lucide-react';
import UnifiedOrgWorkspaceSwitcher from './UnifiedOrgWorkspaceSwitcher';
import { useTerminology } from '@/hooks/use-terminology';
import { useFeatures } from '@/hooks/use-features';
import { useTenant } from '@/context/TenantContext';
import { usePermissions } from '@/hooks/use-permissions';
import { useBackofficeAccess } from '@/hooks/use-backoffice-access';
import type { ContactScope } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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

export function AdminSidebar({ className }: { className?: string } = {}) {
  const pathname = usePathname();
  const { plural, dealPlural } = useTerminology();
  const { 
    activeOrganizationId, 
    activeOrganization, 
    activeWorkspaceId, 
    activeWorkspace,
    setActiveWorkspace,
    switchOrganizationAndWorkspace,
    availableOrganizations,
    allAccessibleWorkspaces,
    isSuperAdmin,
  } = useTenant();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  const [activePanel, setActivePanel] = React.useState<'menu' | 'orgs' | 'workspaces'>('menu');
  const [selectedOrgId, setSelectedOrgId] = React.useState<string>('');

  React.useEffect(() => {
    if (activeOrganizationId) {
      setSelectedOrgId(activeOrganizationId);
    }
  }, [activeOrganizationId]);

  React.useEffect(() => {
    if (!isMobile) {
      setActivePanel('menu');
    }
  }, [isMobile]);

  const handleMobileSwitcherClick = () => {
    if (!isMobile) return;
    if (isSuperAdmin) {
      setActivePanel('orgs');
    } else {
      setSelectedOrgId(activeOrganizationId || '');
      setActivePanel('workspaces');
    }
  };

  const handleWorkspaceSwitch = (workspaceId: string, orgId?: string) => {
    if (orgId) {
      switchOrganizationAndWorkspace(orgId, workspaceId);
      router.push(`/admin?track=${workspaceId}`);
    } else {
      setActiveWorkspace(workspaceId);
      router.push(`/admin?track=${workspaceId}`);
    }
  };
  const { isFeatureEnabled } = useFeatures();
  const { can, isSystemAdmin } = usePermissions();
  const { hasBackofficeAccess } = useBackofficeAccess();



  const wrapHref = React.useCallback((href: string) => {
    if (!activeWorkspaceId) return href;
    const separator = href.includes('?') ? '&' : '?';
    return `${href}${separator}track=${activeWorkspaceId}`;
  }, [activeWorkspaceId]);

  // Robust active check that ignores query parameters
  const isActive = React.useCallback((href: string) => {
    const basePath = href.split('?')[0];
    return pathname === basePath || (basePath !== '/admin' && pathname.startsWith(basePath + '/'));
  }, [pathname]);

  const coreNavItems = React.useMemo(() => [
    { href: wrapHref('/admin'), icon: LayoutDashboard, label: 'Dashboard', visible: true, disabled: !can('operations', 'dashboard', 'view') },
    { href: wrapHref('/admin/entities'), icon: School, label: plural, visible: isFeatureEnabled('entities'), disabled: !can('operations', 'campuses', 'view') },
    { href: wrapHref('/admin/lead-intelligence'), icon: Sparkles, label: 'Lead Intelligence', visible: isFeatureEnabled('entities'), disabled: !can('operations', 'campuses', 'view') },
    { href: wrapHref('/admin/pipeline'), icon: Workflow, label: dealPlural || 'Deals', visible: isFeatureEnabled('pipeline'), disabled: !can('operations', 'pipeline', 'view') },
    { href: wrapHref('/admin/tasks'), icon: CheckSquare, label: 'Tasks', visible: isFeatureEnabled('tasks'), disabled: !can('operations', 'tasks', 'view') },
    { href: wrapHref('/admin/meetings'), icon: Calendar, label: 'Meetings', visible: isFeatureEnabled('meetings'), disabled: !can('operations', 'meetings', 'view') },
    { href: wrapHref('/admin/automations'), icon: Zap, label: 'Automations', visible: isFeatureEnabled('automations'), disabled: !can('operations', 'automations', 'view') },
    { href: wrapHref('/admin/reports'), icon: BarChart3, label: 'Intelligence', visible: isFeatureEnabled('reports'), disabled: !can('operations', 'intelligence', 'view') },
    { href: wrapHref('/admin/analytics/sales-effort'), icon: BarChart3, label: 'Sales Effort', visible: isFeatureEnabled('reports'), disabled: !can('operations', 'intelligence', 'view') },
    { href: wrapHref('/admin/quick-notes'), icon: NotebookPen, label: 'Quick Notes', visible: isFeatureEnabled('quick_notes'), disabled: !can('operations', 'quickNotes', 'view') },
  ], [wrapHref, isFeatureEnabled, can, plural, dealPlural]);

  const financeNavItems = React.useMemo(() => [
    { href: wrapHref('/admin/finance/contracts'), icon: FileCheck, label: 'Agreements', visible: isFeatureEnabled('agreements'), disabled: !can('finance', 'agreements', 'view') },
    { href: wrapHref('/admin/finance/invoices'), icon: Receipt, label: 'Invoices', visible: isFeatureEnabled('invoices'), disabled: !can('finance', 'invoices', 'view') },
    { href: wrapHref('/admin/finance/packages'), icon: Package, label: 'Packages', visible: isFeatureEnabled('packages'), disabled: !can('finance', 'packages', 'view') },
    { href: wrapHref('/admin/finance/periods'), icon: Timer, label: 'Cycles', visible: isFeatureEnabled('billing_periods'), disabled: !can('finance', 'cycles', 'view') },
    { href: wrapHref('/admin/finance/settings'), icon: Settings2, label: 'Billing Setup', visible: isFeatureEnabled('billing_setup'), disabled: !can('finance', 'billingSetup', 'view') },
  ], [wrapHref, isFeatureEnabled, can]);

  const studioNavItems = React.useMemo(() => [
    { href: wrapHref('/admin/portals'), icon: Globe, label: 'Public Portals', visible: isFeatureEnabled('portals'), disabled: !can('studios', 'publicPortals', 'view') },
    { href: wrapHref('/admin/pages'), icon: Layout, label: 'Landing Pages', visible: isFeatureEnabled('portals'), disabled: !can('studios', 'landingPages', 'view') },
    { href: wrapHref('/admin/media'), icon: Film, label: 'Media', visible: isFeatureEnabled('media'), disabled: !can('studios', 'media', 'view') },
    { href: wrapHref('/admin/media/thumbnails'), icon: Image, label: 'Thumbnail Studio', visible: isFeatureEnabled('media'), disabled: !can('studios', 'media', 'view') },
    { href: wrapHref('/admin/surveys'), icon: ClipboardList, label: 'Surveys', visible: isFeatureEnabled('surveys'), disabled: !can('studios', 'surveys', 'view') },
    { href: wrapHref('/admin/pdfs'), icon: FileText, label: 'Doc Signing', visible: isFeatureEnabled('pdfs'), disabled: !can('studios', 'docSigning', 'view') },
    { href: wrapHref('/admin/messaging'), icon: MessageSquareText, label: 'Messaging', visible: isFeatureEnabled('messaging'), disabled: !can('studios', 'messaging', 'view') },
    { href: wrapHref('/admin/messaging/call-centre'), icon: PhoneCall, label: 'Call Centre', visible: isFeatureEnabled('messaging'), disabled: !can('studios', 'messaging', 'view') },
    { href: wrapHref('/admin/forms'), icon: ClipboardSignature, label: 'Forms', visible: isFeatureEnabled('forms'), disabled: !can('studios', 'forms', 'view') },
    { href: wrapHref('/admin/contacts/tags'), icon: Tags, label: 'Tags', visible: isFeatureEnabled('tags'), disabled: !can('studios', 'tags', 'view') },
    { href: wrapHref('/admin/qr-studio'), icon: QrCode, label: 'QR Studio', visible: isFeatureEnabled('qr_studio'), disabled: !can('studios', 'qrStudio', 'view') },
    { href: wrapHref('/admin/verify-studio'), icon: ShieldCheck, label: 'Verify Studio', visible: isFeatureEnabled('verify_studio'), disabled: !can('studios', 'verifyStudio', 'view') },
  ], [wrapHref, isFeatureEnabled, can]);

  const socialNavItems = React.useMemo(() => [
    { href: wrapHref('/admin/social'), icon: LayoutDashboard, label: 'Dashboard', visible: isFeatureEnabled('social_intelligence'), disabled: !can('studios', 'socialIntelligence', 'view') },
    { href: wrapHref('/admin/social/composer'), icon: Sparkles, label: 'Composer', visible: isFeatureEnabled('social_intelligence'), disabled: !can('studios', 'socialIntelligence', 'view') },
    { href: wrapHref('/admin/social/calendar'), icon: Calendar, label: 'Calendar', visible: isFeatureEnabled('social_intelligence'), disabled: !can('studios', 'socialIntelligence', 'view') },
    { href: wrapHref('/admin/social/inbox'), icon: MessageSquareText, label: 'Social Inbox', visible: isFeatureEnabled('social_intelligence'), disabled: !can('studios', 'socialIntelligence', 'view') },
    { href: wrapHref('/admin/social/accounts'), icon: Settings, label: 'Connected Profiles', visible: isFeatureEnabled('social_intelligence'), disabled: !can('studios', 'socialIntelligence', 'view') },
  ], [wrapHref, isFeatureEnabled, can]);

  const systemNavItems = React.useMemo(() => [
    { href: wrapHref('/admin/activities'), icon: History, label: 'Activities', visible: can('management', 'activities', 'view') },
    { href: wrapHref('/admin/users'), icon: Users, label: 'Users', visible: can('management', 'users', 'view') },
    { href: wrapHref('/admin/entities/lead-scoring'), icon: Sparkles, label: 'Lead Scores', visible: isFeatureEnabled('entities'), disabled: !can('operations', 'campuses', 'view') },
    { href: wrapHref('/admin/users/roles'), icon: ShieldEllipsis, label: 'Roles & Permissions', visible: isSystemAdmin },
    { href: wrapHref('/admin/settings/invitation'), icon: Mail, label: 'Messaging', visible: can('management', 'systemSettings', 'view') },
    { href: wrapHref('/admin/settings/fields'), icon: Database, label: 'Fields & Variables', visible: can('management', 'fields', 'view') },
    { href: wrapHref('/admin/ai-prompts'), icon: Bot, label: 'AI Prompts', visible: can('management', 'systemSettings', 'view') },
    { href: wrapHref('/admin/settings/sales-performance'), icon: Sliders, label: 'Effort Rules', visible: can('management', 'systemSettings', 'view') },
    { href: wrapHref('/admin/settings'), icon: Settings, label: 'System', visible: can('management', 'systemSettings', 'view') },
    { href: wrapHref('/admin/settings/developer'), icon: Code, label: 'Developer API', visible: can('management', 'systemSettings', 'view') },
    { href: wrapHref('/admin/webhooks'), icon: Unplug, label: 'Webhooks', visible: can('management', 'systemSettings', 'view') },
    { href: '/backoffice', icon: Cog, label: 'Backoffice', visible: hasBackofficeAccess, external: true },
  ], [wrapHref, can, isSystemAdmin, hasBackofficeAccess]);

  const renderNavGroup = (title: string, items: any[], defaultOpen = false) => {
    const visibleItems = items.filter(i => i.visible);
    if (visibleItems.length === 0) return null;

    return (
      <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
        <SidebarGroup className="px-0 py-2">
          <CollapsibleTrigger asChild>
            <SidebarGroupLabel className="cursor-pointer hover:text-foreground text-left text-primary/60 dark:text-primary/40 font-bold text-[10px] mb-2 px-6 uppercase tracking-widest group-data-[collapsible=icon]:hidden flex items-center justify-between">
              {title}
              <ChevronRight className="h-3 w-3 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
            <SidebarMenu className="gap-1.5 px-3 group-data-[collapsible=icon]:px-2">
              {visibleItems.map((item) => {
                const active = !item.disabled && isActive(item.href);
                const isLocked = !!item.disabled;

                // Locked/disabled state: show with reduced opacity and lock icon
                if (isLocked) {
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        tooltip={`${item.label} — Requires permission`}
                        className="text-muted-foreground/40 rounded-xl h-10 cursor-not-allowed relative overflow-hidden select-none hover:bg-transparent"
                      >
                        <div className="flex items-center gap-3 pointer-events-none">
                          <item.icon className="h-[18px] w-[18px] shrink-0 opacity-40" />
                          <span className="text-xs tracking-wide group-data-[collapsible=icon]:hidden truncate opacity-50">{item.label}</span>
                          <Lock className="h-3 w-3 ml-auto opacity-30 shrink-0 group-data-[collapsible=icon]:hidden" />
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={active} 
                      tooltip={item.label} 
                      className={cn(
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-xl h-10 transition-all duration-300 group/item relative overflow-hidden",
                        active && "bg-primary/10 text-primary shadow-lg shadow-primary/5 font-semibold"
                      )}
                    >
                      {item.external ? (
                        <a href={item.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
                          {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-primary rounded-r-full" />}
                          <item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform duration-300", active ? "scale-110" : "group-hover/item:scale-110")} />
                          <span className="text-xs tracking-wide group-data-[collapsible=icon]:hidden truncate">{item.label}</span>
                        </a>
                      ) : (
                        <Link href={item.href} className="flex items-center gap-3">
                          {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-primary rounded-r-full" />}
                          <item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform duration-300", active ? "scale-110" : "group-hover/item:scale-110")} />
                          <span className="text-xs tracking-wide group-data-[collapsible=icon]:hidden truncate">{item.label}</span>
                        </Link>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    );
  };

  const renderOrganizationsPanel = () => {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="p-4 border-b border-border/10 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setActivePanel('menu')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select Organization</span>
        </div>
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-1.5">
            {availableOrganizations.map(org => {
              const orgWorkspaces = allAccessibleWorkspaces.filter(w => w.organizationId === org.id);
              const isActive = activeOrganizationId === org.id;

              return (
                <button
                  key={org.id}
                  onClick={() => {
                    setSelectedOrgId(org.id);
                    setActivePanel('workspaces');
                  }}
                  className={cn(
                    "w-full rounded-xl p-3 gap-3 flex items-center transition-all border border-transparent text-left",
                    isActive ? "bg-primary/5 border-primary/20" : "hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-lg shrink-0", 
                    isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {org.logoUrl ? (
                      <img src={org.logoUrl} alt={org.name} className="h-4 w-4 rounded object-cover" />
                    ) : (
                      <Building className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs truncate">{org.name}</p>
                    <p className="text-[9px] font-medium text-muted-foreground">
                      {orgWorkspaces.length} workspace{orgWorkspaces.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50 ml-auto" />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderWorkspacesPanel = () => {
    const selectedOrg = availableOrganizations.find(o => o.id === selectedOrgId);
    const orgWorkspaces = allAccessibleWorkspaces.filter(w => w.organizationId === selectedOrgId);

    return (
      <div className="flex flex-col h-full bg-background">
        <div className="p-4 border-b border-border/10 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => {
              if (isSuperAdmin) {
                setActivePanel('orgs');
              } else {
                setActivePanel('menu');
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">
            {selectedOrg?.name || 'Workspaces'}
          </span>
        </div>
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-1.5">
            {orgWorkspaces.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">No workspaces available</div>
            ) : (
              orgWorkspaces.map(w => {
                const isActive = activeWorkspaceId === w.id && activeOrganizationId === selectedOrgId;
                const isDefault = selectedOrg?.defaultWorkspaceId === w.id;
                const wScopeLabel = getScopeLabel(w.contactScope);
                const WScopeIcon = w.contactScope ? (ENTITY_TYPE_ICONS[w.contactScope as 'institution' | 'family' | 'person'] || Zap) : Zap;

                return (
                  <button
                    key={w.id}
                    onClick={() => {
                      if (isActive) {
                        setActivePanel('menu');
                        setOpenMobile(false);
                        return;
                      }
                      handleWorkspaceSwitch(w.id, selectedOrgId === activeOrganizationId ? undefined : selectedOrgId);
                      setActivePanel('menu');
                      setOpenMobile(false);
                    }}
                    className={cn(
                      "w-full rounded-xl p-3 gap-3 mb-1 transition-all flex items-center text-left border border-transparent",
                      isActive ? "bg-primary text-white shadow-md" : "hover:bg-muted/50"
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
                        <p className="font-semibold text-xs truncate">{w.name}</p>
                        {isDefault && (
                          <div className="h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] shrink-0" title="Default Workspace" />
                        )}
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
                          "text-[9px] font-medium truncate mt-0.5",
                          isActive ? "text-white/70" : "text-muted-foreground"
                        )}>
                          {w.description}
                        </p>
                      )}
                    </div>
                    {isActive && <Check className="h-4 w-4 ml-auto" />}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  if (!isMobile) {
    return (
      <Sidebar collapsible="icon" className={cn("bg-background/80 backdrop-blur-xl text-foreground border-r border-border/50 shadow-2xl print:hidden z-40 transition-all duration-300", className)}>
        <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2 border-b border-border/10 flex flex-row items-center justify-between">
           <div className="flex-1 min-w-0">
             <UnifiedOrgWorkspaceSwitcher variant="sidebar" />
           </div>
        </SidebarHeader>
        
        <SidebarContent className="mt-2 overflow-x-hidden scrollbar-none hover:scrollbar-thin scrollbar-thumb-muted-foreground/20">
          {renderNavGroup("Operations", coreNavItems, true)}
          {renderNavGroup("Studios", studioNavItems, true)}
          {renderNavGroup("Finance Hub", financeNavItems, false)}
          {renderNavGroup("Social Hub", socialNavItems, false)}
          <div className="mt-auto pt-4 mb-2">
              {renderNavGroup("Management", systemNavItems, false)}
          </div>
        </SidebarContent>
        
        <SidebarFooter className="p-4 border-t border-border/30 bg-muted/20 backdrop-blur-md">
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Go to public site" className="text-muted-foreground hover:text-foreground transition-all h-10 group-data-[collapsible=icon]:justify-center rounded-xl hover:bg-muted/60">
                        <Link href="/" target="_blank" className="flex items-center gap-3">
                            <ExternalLink className="h-[18px] w-[18px] shrink-0" />
                            <span className="font-semibold text-xs group-data-[collapsible=icon]:hidden">Live Site</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon" className={cn("bg-background/80 backdrop-blur-xl text-foreground border-r border-border/50 shadow-2xl print:hidden z-40 transition-all duration-300", className)}>
      <div className="relative w-full h-full overflow-hidden flex flex-col">
        
        {/* Panel 1: Main Menu */}
        <div 
          className={cn(
            "absolute inset-0 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            activePanel === 'menu' ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarHeader className="p-4 border-b border-border/10 flex flex-row items-center justify-between">
             <div className="flex-1 min-w-0">
               <SidebarMenu>
                 <SidebarMenuItem>
                   <SidebarMenuButton
                     size="lg"
                     onClick={handleMobileSwitcherClick}
                     className="rounded-xl h-14 bg-card/5 hover:bg-card/10 border border-border/50 transition-all group"
                   >
                     <div className="flex aspect-square size-10 items-center justify-center rounded-lg bg-card text-sidebar-primary-foreground shadow-xl group-hover:scale-110 transition-transform overflow-hidden">
                       {activeOrganization?.logoUrl ? (
                         <img src={activeOrganization.logoUrl} alt={activeOrganization.name} className="h-full w-full object-cover" />
                       ) : (
                         <Building className="size-5 text-primary" />
                       )}
                     </div>
                     <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                       <span className="truncate font-semibold tracking-tighter text-foreground text-base">
                         {activeOrganization?.name || 'Organization'}
                       </span>
                       <span className="truncate text-[10px] font-bold text-muted-foreground leading-none mt-0.5">
                         {activeWorkspace?.name || 'No Workspace selected'}
                       </span>
                     </div>
                     <ChevronRight className="ml-auto size-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                   </SidebarMenuButton>
                 </SidebarMenuItem>
               </SidebarMenu>
             </div>
             <SidebarTrigger className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 ml-2" />
          </SidebarHeader>

          <SidebarContent className="mt-2 overflow-x-hidden scrollbar-none">
            {renderNavGroup("Operations", coreNavItems, true)}
            {renderNavGroup("Studios", studioNavItems, true)}
            {renderNavGroup("Finance Hub", financeNavItems, false)}
            {renderNavGroup("Social Hub", socialNavItems, false)}
            <div className="mt-auto pt-4 mb-2">
                {renderNavGroup("Management", systemNavItems, false)}
            </div>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-border/30 bg-muted/20 backdrop-blur-md">
              <SidebarMenu>
                  <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Go to public site" className="text-muted-foreground hover:text-foreground transition-all h-10 rounded-xl hover:bg-muted/60">
                          <Link href="/" target="_blank" className="flex items-center gap-3">
                              <ExternalLink className="h-[18px] w-[18px] shrink-0" />
                              <span className="font-semibold text-xs">Live Site</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
              </SidebarMenu>
          </SidebarFooter>
        </div>

        {/* Panel 2: Organizations Selector (Superadmin Only) */}
        {isSuperAdmin && (
          <div 
            className={cn(
              "absolute inset-0 flex flex-col bg-background transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
              activePanel === 'orgs' ? "translate-x-0" : (activePanel === 'menu' ? "translate-x-full" : "-translate-x-full")
            )}
          >
            {renderOrganizationsPanel()}
          </div>
        )}

        {/* Panel 3: Workspaces Selector */}
        <div 
          className={cn(
            "absolute inset-0 flex flex-col bg-background transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            activePanel === 'workspaces' ? "translate-x-0" : "translate-x-full"
          )}
        >
          {renderWorkspacesPanel()}
        </div>

      </div>
    </Sidebar>
  );
}
