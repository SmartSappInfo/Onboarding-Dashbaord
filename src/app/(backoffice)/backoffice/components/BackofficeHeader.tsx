'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LogOut, User as UserIcon, ChevronRight } from 'lucide-react';
import { useUser, useAuth } from '@/firebase';
import { useBackoffice } from '../context/BackofficeProvider';
import { ThemeToggle } from '@/components/theme-toggle';

// ─────────────────────────────────────────────────
// Backoffice Header
// Top bar with breadcrumb, "CONTROL PLANE" badge,
// and user dropdown with backoffice role display.
// ─────────────────────────────────────────────────

/**
 * Maps pathname segments to human-readable breadcrumb labels.
 */
const SEGMENT_LABELS: Record<string, string> = {
  backoffice: 'Dashboard',
  organizations: 'Organizations',
  workspaces: 'Workspaces',
  features: 'Features & Rollouts',
  templates: 'Templates',
  fields: 'Fields & Variables',
  assets: 'Assets',
  operations: 'Operations',
  audit: 'Audit Logs',
  settings: 'Settings',
  entitlements: 'Entitlements',
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  tenant_admin_ops: 'Tenant Ops',
  release_admin: 'Release Admin',
  template_admin: 'Template Admin',
  support_admin: 'Support Admin',
  security_auditor: 'Security Auditor',
  migration_admin: 'Migration Admin',
  readonly_auditor: 'Read Only',
};

function getInitials(name?: string) {
  if (!name) return <UserIcon size={14} />;
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export default function BackofficeHeader() {
  const pathname = usePathname();
  const { user } = useUser();
  const auth = useAuth();
  const { roles } = useBackoffice();

  // Build breadcrumb from pathname
  const segments = pathname
    .replace('/backoffice', '')
    .split('/')
    .filter(Boolean);

  const breadcrumbs = [
    { label: 'Control Plane', href: '/backoffice' },
    ...segments.map((seg, i) => ({
      label: SEGMENT_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1),
      href: '/backoffice/' + segments.slice(0, i + 1).join('/'),
    })),
  ];

  return (
    <header className="h-16 flex shrink-0 items-center gap-4 px-6 border-b border-border bg-background/80 backdrop-blur-xl">
      <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />

      {/* Breadcrumb */}
      <nav className="flex-1 min-w-0 flex items-center gap-1.5" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={crumb.href}>
            {i > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0" />
            )}
            <span
              className={`text-xs font-semibold truncate ${
                i === breadcrumbs.length - 1
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {crumb.label}
            </span>
          </React.Fragment>
        ))}
      </nav>

      {/* Right side: Badge + User */}
      <div className="flex items-center gap-3 shrink-0">
        <Badge
          variant="outline"
          className="text-[8px] uppercase font-bold tracking-[0.15em] px-2.5 h-5 bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hidden sm:flex"
        >
          Control Plane
        </Badge>

        <div className="h-6 w-px bg-border mx-1" />

        <ThemeToggle />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-xl p-0 hover:bg-accent transition-all cursor-pointer"
              aria-label="User menu"
            >
              <Avatar className="h-9 w-9 border-2 border-emerald-500/20 shadow-sm">
                <AvatarImage
                  src={user?.photoURL ?? undefined}
                  alt={user?.displayName ?? 'User'}
                />
                <AvatarFallback className="bg-emerald-500/10 text-emerald-400 font-semibold text-xs">
                  {getInitials(user?.displayName ?? undefined)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 p-2 rounded-2xl border-border bg-card shadow-lg"
            align="end"
          >
            <DropdownMenuLabel className="font-normal px-2 py-3">
              <div className="flex flex-col space-y-1 text-left">
                <p className="text-sm font-semibold tracking-tight leading-none text-foreground">
                  {user?.displayName}
                </p>
                <p className="text-[10px] leading-none text-muted-foreground font-bold tracking-tight">
                  {user?.email}
                </p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {roles.map((role) => (
                    <Badge
                      key={role}
                      variant="outline"
                      className="text-[7px] uppercase font-bold px-1.5 h-4 bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    >
                      {ROLE_LABELS[role] ?? role}
                    </Badge>
                  ))}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={() => auth.signOut()}
              className="rounded-xl p-2.5 gap-3 cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              <span className="font-bold text-xs">Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
