'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Mobile Bottom Navigation Dock for the Agreements Hub (Phase 1).
 *    Provides quick, thumb-friendly navigation across primary contract sections
 *    on small screens (sm:hidden), matching the mobile design mockup.
 *
 * 2. Invariants & Rules Maintained:
 *    - Rule 4: Zero `any` or `any[]` typing.
 *    - Rule 7: Optimized for mobile users with min-h-[44px] touch targets,
 *      clear active indicators, and everyday UI English.
 *    - Emil Kowalski tactile animations: `active:scale-[0.97]`.
 *    - Theme Preservation: Uses standard border-border, bg-card/95, and text-primary tokens.
 *
 * 3. Caution Areas:
 *    - Ensure `fixed bottom-0` does not obscure content; parent page must include
 *      adequate bottom padding (e.g. `pb-24 sm:pb-12`).
 */

import React from 'react';
import Link from 'next/link';
import { 
  Home, 
  FileCheck, 
  FileText, 
  CheckSquare, 
  MoreHorizontal,
  BarChart3,
  ShieldCheck,
  Rocket,
  Code2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgreementsTabKey } from './AgreementsHubNav';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface AgreementsMobileBottomNavProps {
  activeTab: AgreementsTabKey;
  onTabChange: (tab: AgreementsTabKey) => void;
  userPermissions?: string[];
  className?: string;
}

export const AgreementsMobileBottomNav = React.memo(function AgreementsMobileBottomNav({
  activeTab,
  onTabChange,
  userPermissions = [],
  className,
}: AgreementsMobileBottomNavProps) {
  const canAccessAdmin = 
    userPermissions.includes('system_admin') || 
    userPermissions.includes('admin_role') ||
    userPermissions.includes('contracts_admin') ||
    userPermissions.includes('owner');

  const isMoreActive = ['insights', 'governance', 'migration', 'developer'].includes(activeTab);

  return (
    <nav
      aria-label="Mobile Navigation Dock"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 sm:hidden",
        "bg-card/95 backdrop-blur-md border-t border-border/80 shadow-lg",
        "px-3 py-1 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around",
        className
      )}
    >
      {/* Home Link */}
      <Link
        href="/admin"
        className={cn(
          "flex flex-col items-center justify-center flex-1 py-1.5 min-h-[44px] text-muted-foreground",
          "transition-all active:scale-[0.97]"
        )}
      >
        <Home className="h-5 w-5 mb-0.5" />
        <span className="text-[10px] font-medium">Home</span>
      </Link>

      {/* Contracts Tab */}
      <button
        type="button"
        onClick={() => onTabChange('contracts')}
        className={cn(
          "flex flex-col items-center justify-center flex-1 py-1.5 min-h-[44px] transition-all active:scale-[0.97]",
          activeTab === 'contracts' ? "text-primary font-bold" : "text-muted-foreground"
        )}
      >
        <FileCheck className={cn("h-5 w-5 mb-0.5", activeTab === 'contracts' && "stroke-[2.5px]")} />
        <span className="text-[10px]">Contracts</span>
      </button>

      {/* Templates Tab */}
      <button
        type="button"
        onClick={() => onTabChange('templates')}
        className={cn(
          "flex flex-col items-center justify-center flex-1 py-1.5 min-h-[44px] transition-all active:scale-[0.97]",
          activeTab === 'templates' ? "text-primary font-bold" : "text-muted-foreground"
        )}
      >
        <FileText className={cn("h-5 w-5 mb-0.5", activeTab === 'templates' && "stroke-[2.5px]")} />
        <span className="text-[10px]">Templates</span>
      </button>

      {/* Obligations Tab */}
      <button
        type="button"
        onClick={() => onTabChange('obligations')}
        className={cn(
          "flex flex-col items-center justify-center flex-1 py-1.5 min-h-[44px] transition-all active:scale-[0.97]",
          activeTab === 'obligations' ? "text-primary font-bold" : "text-muted-foreground"
        )}
      >
        <CheckSquare className={cn("h-5 w-5 mb-0.5", activeTab === 'obligations' && "stroke-[2.5px]")} />
        <span className="text-[10px]">Obligations</span>
      </button>

      {/* More / Insights & Administration */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex flex-col items-center justify-center flex-1 py-1.5 min-h-[44px] transition-all active:scale-[0.97]",
              isMoreActive ? "text-primary font-bold" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className={cn("h-5 w-5 mb-0.5", isMoreActive && "stroke-[2.5px]")} />
            <span className="text-[10px]">More</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56 mb-2 rounded-2xl border border-border/80 bg-card p-1.5 shadow-2xl">
          <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
            Additional Sections
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1" />

          {/* Insights / Analytics */}
          <DropdownMenuItem
            onClick={() => onTabChange('insights')}
            className={cn(
              "gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium cursor-pointer min-h-[44px]",
              activeTab === 'insights' && "bg-primary/10 text-primary font-semibold"
            )}
          >
            <BarChart3 className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span>Insights & Reports</span>
              <span className="text-[10px] text-muted-foreground font-normal">Analytics & velocity</span>
            </div>
          </DropdownMenuItem>

          {canAccessAdmin && (
            <>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuLabel className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-0.5">
                Admin Settings
              </DropdownMenuLabel>

              <DropdownMenuItem
                onClick={() => onTabChange('governance')}
                className={cn(
                  "gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium cursor-pointer min-h-[44px]",
                  activeTab === 'governance' && "bg-primary/10 text-primary font-semibold"
                )}
              >
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Enterprise & Governance</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onTabChange('migration')}
                className={cn(
                  "gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium cursor-pointer min-h-[44px]",
                  activeTab === 'migration' && "bg-primary/10 text-primary font-semibold"
                )}
              >
                <Rocket className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>GA Cutover & Migration</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onTabChange('developer')}
                className={cn(
                  "gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium cursor-pointer min-h-[44px]",
                  activeTab === 'developer' && "bg-primary/10 text-primary font-semibold"
                )}
              >
                <Code2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>Developer Platform & SDK</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
});
