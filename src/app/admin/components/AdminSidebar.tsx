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
    ChevronRight,
    Lock,
    Sparkles
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
    { href: wrapHref('/admin/pipeline'), icon: Workflow, label: dealPlural || 'Deals', visible: isFeatureEnabled('pipeline'), disabled: !can('operations', 'pipeline', 'view') },
    { href: wrapHref('/admin/tasks'), icon: CheckSquare, label: 'Tasks', visible: isFeatureEnabled('tasks'), disabled: !can('operations', 'tasks', 'view') },
    { href: wrapHref('/admin/meetings'), icon: Calendar, label: 'Meetings', visible: isFeatureEnabled('meetings'), disabled: !can('operations', 'meetings', 'view') },
    { href: wrapHref('/admin/automations'), icon: Zap, label: 'Automations', visible: isFeatureEnabled('automations'), disabled: !can('operations', 'automations', 'view') },
    { href: wrapHref('/admin/reports'), icon: BarChart3, label: 'Intelligence', visible: isFeatureEnabled('reports'), disabled: !can('operations', 'intelligence', 'view') },
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
    { href: wrapHref('/admin/surveys'), icon: ClipboardList, label: 'Surveys', visible: isFeatureEnabled('surveys'), disabled: !can('studios', 'surveys', 'view') },
    { href: wrapHref('/admin/pdfs'), icon: FileText, label: 'Doc Signing', visible: isFeatureEnabled('pdfs'), disabled: !can('studios', 'docSigning', 'view') },
    { href: wrapHref('/admin/messaging'), icon: MessageSquareText, label: 'Messaging', visible: isFeatureEnabled('messaging'), disabled: !can('studios', 'messaging', 'view') },
    { href: wrapHref('/admin/forms'), icon: ClipboardSignature, label: 'Forms', visible: isFeatureEnabled('forms'), disabled: !can('studios', 'forms', 'view') },
    { href: wrapHref('/admin/contacts/tags'), icon: Tags, label: 'Tags', visible: isFeatureEnabled('tags'), disabled: !can('studios', 'tags', 'view') },
    { href: wrapHref('/admin/qr-studio'), icon: QrCode, label: 'QR Studio', visible: isFeatureEnabled('qr_studio'), disabled: !can('studios', 'qrStudio', 'view') },
    { href: wrapHref('/admin/verify-studio'), icon: ShieldCheck, label: 'Verify Studio', visible: isFeatureEnabled('verify_studio'), disabled: !can('studios', 'verifyStudio', 'view') },
  ], [wrapHref, isFeatureEnabled, can]);

  const systemNavItems = React.useMemo(() => [
    { href: wrapHref('/admin/activities'), icon: History, label: 'Activities', visible: can('management', 'activities', 'view') },
    { href: wrapHref('/admin/users'), icon: Users, label: 'Users', visible: can('management', 'users', 'view') },
    { href: wrapHref('/admin/entities/lead-scoring'), icon: Sparkles, label: 'Lead Cleanup', visible: isFeatureEnabled('entities'), disabled: !can('operations', 'campuses', 'view') },
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

  return (
    <Sidebar collapsible="icon" className="bg-background/80 backdrop-blur-xl text-foreground border-r border-border/50 shadow-2xl print:hidden z-40 transition-all duration-300">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2 border-b border-border/10">
         <UnifiedOrgWorkspaceSwitcher variant="sidebar" />
      </SidebarHeader>
      
      <SidebarContent className="mt-2 overflow-x-hidden scrollbar-none hover:scrollbar-thin scrollbar-thumb-muted-foreground/20">
        {renderNavGroup("Operations", coreNavItems, true)}
        {renderNavGroup("Studios", studioNavItems, true)}
        {renderNavGroup("Finance Hub", financeNavItems, false)}
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
