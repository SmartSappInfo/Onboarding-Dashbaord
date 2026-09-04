'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 5: Cross-Module Context Bar Component
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Unified Context Awareness (UI PRD Section 71):
 *    - Surfaces the active subject context across SmartSapp modules (CRM, Deals, Meetings).
 * 2. Mobile Accessibility & Touch Targets:
 *    - Adheres to >= 44px touch target standard (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Compression physics on active states (`active:scale-[0.97]`).
 * 4. Zero-`any` Standard:
 *    - Strictly typed with `ContextSubjectType`.
 *
 * @testability Visual header component verified across desktop and mobile headers.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ChevronDown,
  Building2,
  Briefcase,
  Calendar,
  Layers,
  ShieldAlert,
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ContextSubjectType } from '@/lib/memory/context-types';

export interface CrossModuleContextItem {
  id: string;
  type: ContextSubjectType;
  name: string;
  href?: string;
  badge?: string;
}

export interface CrossModuleContextBarProps {
  currentSubjectName: string;
  currentSubjectType: ContextSubjectType;
  relatedItems?: CrossModuleContextItem[];
  conflictCount?: number;
  onOpenContextPanel?: () => void;
  className?: string;
}

const TYPE_ICONS: Record<ContextSubjectType, React.ComponentType<{ className?: string }>> = {
  entity: Building2,
  deal: Briefcase,
  meeting: Calendar,
  campaign: Layers,
  user: Building2,
  workspace: Layers,
  organization: Layers,
};

export function CrossModuleContextBar({
  currentSubjectName,
  currentSubjectType,
  relatedItems = [],
  conflictCount = 0,
  onOpenContextPanel,
  className,
}: CrossModuleContextBarProps) {
  const Icon = TYPE_ICONS[currentSubjectType] || Building2;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-xl bg-card border border-border/80 p-1.5 shadow-xs transition-all duration-150',
        className
      )}
    >
      {/* Subject Context Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 min-h-[44px] px-3 gap-2 text-xs font-medium text-foreground hover:bg-muted/60 active:scale-[0.97] transition-all"
          >
            <div className="p-1 rounded-md bg-primary/10 text-primary">
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col items-start text-left">
              <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground leading-none">
                AI Context
              </span>
              <span className="text-xs font-semibold text-foreground line-clamp-1 max-w-[160px] sm:max-w-[220px]">
                {currentSubjectName}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            Current Focus
          </DropdownMenuLabel>
          <DropdownMenuItem className="gap-2 font-medium">
            <Icon className="w-4 h-4 text-primary" />
            <span className="truncate">{currentSubjectName}</span>
          </DropdownMenuItem>

          {relatedItems.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                Linked Contexts
              </DropdownMenuLabel>
              {relatedItems.map((item) => {
                const ItemIcon = TYPE_ICONS[item.type] || Building2;
                return (
                  <DropdownMenuItem key={item.id} asChild>
                    {item.href ? (
                      <Link href={item.href} className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-2 truncate">
                          <ItemIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="truncate">{item.name}</span>
                        </div>
                        {item.badge && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-2 truncate">
                          <ItemIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="truncate">{item.name}</span>
                        </div>
                        {item.badge && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Conflict Badge Alert */}
      {conflictCount > 0 && (
        <Badge
          variant="destructive"
          className="text-[11px] h-7 px-2 font-medium flex items-center gap-1 animate-pulse"
          title={`${conflictCount} active contradiction(s) require review`}
        >
          <ShieldAlert className="w-3 h-3" />
          {conflictCount} Conflict{conflictCount > 1 ? 's' : ''}
        </Badge>
      )}

      {/* Open Context Panel Action Trigger */}
      {onOpenContextPanel && (
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenContextPanel}
          className="h-10 min-h-[44px] px-3 gap-1.5 text-xs font-medium text-primary border-primary/20 hover:bg-primary/5 active:scale-[0.97] transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Inspect Context</span>
        </Button>
      )}
    </div>
  );
}
