'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from '@/components/ui/sidebar';
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
    Globe,
    CheckSquare,
    Zap,
    BarChart3,
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
    Code,
    Unplug,
    ShieldCheck,
    ChevronRight
} from 'lucide-react';
import UnifiedOrgWorkspaceSwitcher from './UnifiedOrgWorkspaceSwitcher';
import { useTerminology } from '@/hooks/use-terminology';
import { useFeatures } from '@/hooks/use-features';
import { useTenant } from '@/context/TenantContext';
import { usePermissions } from '@/hooks/use-permissions';
import { useBackofficeAccess } from '@/hooks/use-backoffice-access';
import type { AppFeatureId } from '@/lib/types';
import { cn } from '@/lib/utils';

export function AdminSidebar() {
  const pathname = usePathname();
  const { plural, dealPlural } = useTerminology();
  const { activeWorkspaceId } = useTenant();
  const { isFeatureEnabled } = useFeatures();
  const { can, isSystemAdmin } = usePermissions();
  const { hasBackofficeAccess } = useBackofficeAccess();

  // Feature-aware visibility
  const isVisible = React.useCallback((hasPermission: boolean, featureId?: AppFeatureId) => {
    if (!hasPermission) return false;
    if (!featureId) return true;
    return isFeatureEnabled(featureId);
  }, [isFeatureEnabled]);

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
    { href: wrapHref('/admin'), icon: LayoutDashboard, label: 'Dashboard', visible: isVisible(can('operations', 'dashboard', 'view')) },
    { href: wrapHref('/admin/entities'), icon: School, label: plural, visible: isVisible(can('operations', 'campuses', 'view'), 'entities') },
    { href: wrapHref('/admin/pipeline'), icon: Workflow, label: dealPlural || 'Deals', visible: isVisible(can('operations', 'pipeline', 'view'), 'pipeline') },
    { href: wrapHref('/admin/tasks'), icon: CheckSquare, label: 'Tasks', visible: isVisible(can('operations', 'tasks', 'view'), 'tasks') },
    { href: wrapHref('/admin/meetings'), icon: Calendar, label: 'Meetings', visible: isVisible(can('operations', 'meetings', 'view'), 'meetings') },
    { href: wrapHref('/admin/automations'), icon: Zap, label: 'Automations', visible: isVisible(can('operations', 'automations', 'view'), 'automations') },
    { href: wrapHref('/admin/reports'), icon: BarChart3, label: 'Intelligence', visible: isVisible(can('operations', 'intelligence', 'view'), 'reports') },
  ], [wrapHref, isVisible, can, plural, dealPlural]);

  const financeNavItems = React.useMemo(() => [
    { href: wrapHref('/admin/finance/contracts'), icon: FileCheck, label: 'Agreements', visible: isVisible(can('finance', 'agreements', 'view'), 'agreements') },
    { href: wrapHref('/admin/finance/invoices'), icon: Receipt, label: 'Invoices', visible: isVisible(can('finance', 'invoices', 'view'), 'invoices') },
    { href: wrapHref('/admin/finance/packages'), icon: Package, label: 'Packages', visible: isVisible(can('finance', 'packages', 'view'), 'packages') },
    { href: wrapHref('/admin/finance/periods'), icon: Timer, label: 'Cycles', visible: isVisible(can('finance', 'cycles', 'view'), 'billing_periods') },
    { href: wrapHref('/admin/finance/settings'), icon: Settings2, label: 'Billing Setup', visible: isVisible(can('finance', 'billingSetup', 'view'), 'billing_setup') },
  ], [wrapHref, isVisible, can]);

  const studioNavItems = React.useMemo(() => [
    { href: wrapHref('/admin/portals'), icon: Globe, label: 'Public Portals', visible: isVisible(can('studios', 'publicPortals', 'view'), 'portals') },
    { href: wrapHref('/admin/pages'), icon: Layout, label: 'Landing Pages', visible: isVisible(can('studios', 'landingPages', 'view'), 'portals') },
    { href: wrapHref('/admin/media'), icon: Film, label: 'Media', visible: isVisible(can('studios', 'media', 'view'), 'media') },
    { href: wrapHref('/admin/surveys'), icon: ClipboardList, label: 'Surveys', visible: isVisible(can('studios', 'surveys', 'view'), 'surveys') },
    { href: wrapHref('/admin/pdfs'), icon: FileText, label: 'Doc Signing', visible: isVisible(can('studios', 'docSigning', 'view'), 'pdfs') },
    { href: wrapHref('/admin/messaging'), icon: MessageSquareText, label: 'Messaging', visible: isVisible(can('studios', 'messaging', 'view'), 'messaging') },
    { href: wrapHref('/admin/forms'), icon: ClipboardSignature, label: 'Forms', visible: isVisible(can('studios', 'forms', 'view'), 'forms') },
    { href: wrapHref('/admin/contacts/tags'), icon: Tags, label: 'Tags', visible: isVisible(can('studios', 'tags', 'view'), 'tags') },
    { href: wrapHref('/admin/qr-studio'), icon: QrCode, label: 'QR Studio', visible: isVisible(can('studios', 'qrStudio', 'view'), 'qr_studio') },
    { href: wrapHref('/admin/verify-studio'), icon: ShieldCheck, label: 'Verify Studio', visible: isVisible(can('studios', 'verifyStudio', 'view'), 'verify_studio') },
  ], [wrapHref, isVisible, can]);

  const systemNavItems = React.useMemo(() => [
    { href: wrapHref('/admin/activities'), icon: History, label: 'Activities', visible: can('management', 'activities', 'view') },
    { href: wrapHref('/admin/users'), icon: Users, label: 'Users', visible: can('management', 'users', 'view') },
    { href: wrapHref('/admin/users/roles'), icon: ShieldEllipsis, label: 'Roles & Permissions', visible: isSystemAdmin },
    { href: wrapHref('/admin/settings/invitation'), icon: Mail, label: 'Messaging', visible: can('management', 'systemSettings', 'view') },
    { href: wrapHref('/admin/settings/fields'), icon: Database, label: 'Fields & Variables', visible: can('management', 'fields', 'view') },
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
                const active = isActive(item.href);
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

  return (
    <Sidebar collapsible="icon" className="bg-background/80 backdrop-blur-xl text-foreground border-r border-border/50 shadow-2xl print:hidden z-40 transition-all duration-300">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2 border-b border-border/10">
         <UnifiedOrgWorkspaceSwitcher variant="sidebar" />
      </SidebarHeader>
      
      <SidebarContent className="mt-2 overflow-x-hidden scrollbar-none hover:scrollbar-thin scrollbar-thumb-muted-foreground/20">
        {renderNavGroup("Operations", coreNavItems, true)}
        {renderNavGroup("Finance Hub", financeNavItems, true)}
        {renderNavGroup("Studios", studioNavItems, false)}
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
