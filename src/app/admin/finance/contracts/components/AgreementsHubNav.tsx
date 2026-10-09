'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Four-Section Navigation Architecture for the Agreements Hub (Phase 1).
 *    Consolidates 8 crowded top-level tabs into 4 primary workflow hubs:
 *    Contracts, Templates, Obligations, and Insights, with an Administration dropdown.
 *
 * 2. Invariants & Rules Maintained:
 *    - Rule 4: Zero `any` or `any[]` typing. Strict union types for all tab keys.
 *    - Rule 7: Mobile-first responsive layout with min-h-[44px] touch targets,
 *      smooth horizontal scrolling, and everyday UI English.
 *    - Rule 16 & 17: Non-delegable admin privileges. Administration items are gated
 *      by user permissions ('system_admin' or 'admin_role' or 'contracts_admin').
 *    - Emil Kowalski tactile animations: `active:scale-[0.97]`.
 *    - Theme Preservation: Retains minimalistic blue-and-white theme tokens.
 *
 * 3. Caution Areas:
 *    - When an administration tab ('governance', 'migration', 'developer') is active,
 *      the Administration dropdown trigger MUST visually highlight to avoid navigation
 *      desynchronization (Failure Mode Analysis 3.1).
 */

import React from 'react';
import { 
  FileCheck, 
  FileText, 
  CheckSquare, 
  BarChart3, 
  Settings, 
  ChevronDown, 
  ShieldCheck, 
  Rocket, 
  Code2,
  Layers,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type AgreementsTabKey = 
  | 'contracts' 
  | 'templates' 
  | 'obligations' 
  | 'insights' 
  | 'governance' 
  | 'migration' 
  | 'developer';

export type ContractsSubViewKey = 'register' | 'campaigns';

export interface AgreementsHubNavProps {
  activeTab: AgreementsTabKey;
  onTabChange: (tab: AgreementsTabKey) => void;
  userPermissions?: string[];
  contractsSubView?: ContractsSubViewKey;
  onContractsSubViewChange?: (view: ContractsSubViewKey) => void;
  className?: string;
}

interface PrimaryTabItem {
  id: AgreementsTabKey;
  label: string;
  icon: React.ElementType;
}

const PRIMARY_TABS: PrimaryTabItem[] = [
  { id: 'contracts', label: 'Contracts', icon: FileCheck },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'obligations', label: 'Obligations', icon: CheckSquare },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
];

export function AgreementsHubNav({
  activeTab,
  onTabChange,
  userPermissions = [],
  contractsSubView = 'register',
  onContractsSubViewChange,
  className,
}: AgreementsHubNavProps) {
  // Check if current user has permission to see administration tools
  const canAccessAdmin = 
    userPermissions.includes('system_admin') || 
    userPermissions.includes('admin_role') ||
    userPermissions.includes('contracts_admin') ||
    userPermissions.includes('owner');

  // Check if an administration sub-tab is currently active
  const isAdminActive = ['governance', 'migration', 'developer'].includes(activeTab);

  const getAdminActiveLabel = () => {
    switch (activeTab) {
      case 'governance': return 'Governance';
      case 'migration': return 'Migration';
      case 'developer': return 'Developer';
      default: return 'Administration';
    }
  };

  return (
    <div className={cn("w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3", className)}>
      {/* Primary Segmented Navigation */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/80 overflow-x-auto no-scrollbar scroll-smooth">
        {PRIMARY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all select-none min-h-[40px] sm:min-h-[36px]",
                "active:scale-[0.97]",
                isActive
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
              <span>{tab.label}</span>
            </button>
          );
        })}

        {/* Administration Dropdown Menu */}
        {canAccessAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all select-none min-h-[40px] sm:min-h-[36px]",
                  "active:scale-[0.97]",
                  isAdminActive
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                )}
              >
                <Settings className={cn("h-4 w-4", isAdminActive ? "text-primary" : "text-muted-foreground")} />
                <span>{getAdminActiveLabel()}</span>
                <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl border border-border/80 bg-card p-1.5 shadow-xl">
              <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
                Administration Tools
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1" />
              
              <DropdownMenuItem
                onClick={() => onTabChange('governance')}
                className={cn(
                  "gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer",
                  activeTab === 'governance' && "bg-primary/10 text-primary font-semibold"
                )}
              >
                <ShieldCheck className="h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span>Enterprise & Governance</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Compliance & audits</span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onTabChange('migration')}
                className={cn(
                  "gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer",
                  activeTab === 'migration' && "bg-primary/10 text-primary font-semibold"
                )}
              >
                <Rocket className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <div className="flex flex-col">
                  <span>GA Cutover & Migration</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Legacy data sync</span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onTabChange('developer')}
                className={cn(
                  "gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer",
                  activeTab === 'developer' && "bg-primary/10 text-primary font-semibold"
                )}
              >
                <Code2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <div className="flex flex-col">
                  <span>Developer & SDK</span>
                  <span className="text-[10px] text-muted-foreground font-normal">API keys & webhooks</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Secondary Sub-View Switcher when inside 'contracts' */}
      {activeTab === 'contracts' && onContractsSubViewChange && (
        <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-muted/30 border border-border/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onContractsSubViewChange('register')}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all select-none min-h-[32px]",
              "active:scale-[0.97]",
              contractsSubView === 'register'
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span>Institution Register</span>
          </button>
          <button
            type="button"
            onClick={() => onContractsSubViewChange('campaigns')}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all select-none min-h-[32px]",
              "active:scale-[0.97]",
              contractsSubView === 'campaigns'
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>Bulk Campaigns</span>
          </button>
        </div>
      )}
    </div>
  );
}
