'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Layers,
  ToggleRight,
  FileStack,
  Database,
  Image,
  Wrench,
  ScrollText,
  Settings,
  Shield,
} from 'lucide-react';
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
import { useBackoffice } from '../context/BackofficeProvider';
import type { BackofficeModule } from '@/lib/backoffice/backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice Sidebar Navigation
// Premium dark-mode design with role-based visibility.
// ─────────────────────────────────────────────────

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  module: BackofficeModule;
}

const platformNavItems: NavItem[] = [
  { href: '/backoffice', icon: LayoutDashboard, label: 'Dashboard', module: 'dashboard' },
  { href: '/backoffice/organizations', icon: Building2, label: 'Organizations', module: 'organizations' },
  { href: '/backoffice/workspaces', icon: Layers, label: 'Workspaces', module: 'workspaces' },
];

const controlNavItems: NavItem[] = [
  { href: '/backoffice/features', icon: ToggleRight, label: 'Features & Rollouts', module: 'features' },
  { href: '/backoffice/templates', icon: FileStack, label: 'Templates', module: 'templates' },
  { href: '/backoffice/fields', icon: Database, label: 'Fields & Variables', module: 'fields' },
  { href: '/backoffice/assets', icon: Image, label: 'Assets', module: 'assets' },
];

const operationsNavItems: NavItem[] = [
  { href: '/backoffice/operations', icon: Wrench, label: 'Operations', module: 'operations' },
  { href: '/backoffice/audit', icon: ScrollText, label: 'Audit Logs', module: 'audit' },
  { href: '/backoffice/settings', icon: Settings, label: 'Settings', module: 'settings' },
];

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  const { can } = useBackoffice();

  const visibleItems = items.filter((item) => can(item.module, 'view'));

  if (visibleItems.length === 0) return null;

  return (
    <SidebarGroup className="px-0">
      <SidebarGroupLabel className="text-left text-emerald-600/60 dark:text-emerald-400/40 font-semibold text-[10px] mb-2 px-6 uppercase tracking-widest group-data-[collapsible=icon]:hidden">
        {label}
      </SidebarGroupLabel>
      <SidebarMenu className="gap-1 px-3 group-data-[collapsible=icon]:px-2">
        {visibleItems.map((item) => {
          const isActive =
            item.href === '/backoffice'
              ? pathname === '/backoffice'
              : pathname.startsWith(item.href);

          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={item.label}
                className="text-muted-foreground hover:text-foreground hover:bg-muted/60 data-[active=true]:bg-emerald-500/15 data-[active=true]:text-emerald-600 dark:data-[active=true]:text-emerald-400 data-[active=true]:shadow-lg data-[active=true]:shadow-emerald-500/5 rounded-xl h-11 transition-all duration-200"
              >
                <Link href={item.href}>
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="font-semibold text-xs tracking-wide group-data-[collapsible=icon]:hidden">
                    {item.label}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export default function BackofficeSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="icon"
      className="bg-card text-foreground border-r border-border shadow-2xl print:hidden"
    >
      {/* Header: Branding */}
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
        <Link
          href="/backoffice"
          className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center"
          aria-label="Backoffice Dashboard"
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Shield className="h-5 w-5 text-foreground" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-sm tracking-tight text-foreground">SmartSapp</span>
            <span className="text-[9px] font-semibold text-emerald-600/80 dark:text-emerald-400/70 uppercase tracking-[0.2em]">
              Control Plane
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="mt-2 overflow-x-hidden">
        <NavGroup label="Platform" items={platformNavItems} pathname={pathname} />
        <div className="mt-4">
          <NavGroup label="Control" items={controlNavItems} pathname={pathname} />
        </div>
        <div className="mt-4">
          <NavGroup label="Operations" items={operationsNavItems} pathname={pathname} />
        </div>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-4 border-t border-border bg-black/5 dark:bg-black/20">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Back to Workspace App"
              className="text-muted-foreground hover:text-foreground transition-all h-10 group-data-[collapsible=icon]:justify-center"
            >
              <Link href="/admin">
                <Layers className="h-4 w-4 shrink-0" />
                <span className="font-semibold text-[10px] group-data-[collapsible=icon]:hidden">
                  Workspace App
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
