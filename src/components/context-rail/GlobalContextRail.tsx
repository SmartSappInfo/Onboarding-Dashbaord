'use client';

/**
 * @fileOverview Global Context Rail Component (Phase 8 Milestone 4 Task 4)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border-l border-border/80 bg-card text-card-foreground shadow-2xl`
 * - Demarcated Header: `<SheetHeader>` with `min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4`
 * - Zero Raw Descriptions: user guidance exclusively routes through `<CardInfoTooltip text="..." />` alongside title
 * - Accessible Screen Reader: `<SheetDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]`
 *
 * Security & Governance (Rules 4, 7, 8, 13, 21, 22, 30, 47, 60, 68/§81):
 * - Rule 4: Zero any / Zero any[] strict typing.
 * - Rule 7: Mobile touch targets min-h-[44px].
 * - Rule 8 & 47: Anti-IDOR tenant isolation.
 * - Rule 13 & 30: Untrusted content wrapped in `<untrusted_reference_data>` container.
 * - Rule 21 & 22: Two-Phase approval proposals with SHA-256 hash badges.
 * - Rule 68 / §81: No Dead Ends navigation links across all modules.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  X,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Bot,
  Brain,
  ShieldCheck,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { useContextRail } from './ContextRailContext';
import { EntityDossierModule } from './modules/EntityDossierModule';
import { RelatedEntitiesModule } from './modules/RelatedEntitiesModule';
import { InstitutionalMemoryModule } from './modules/InstitutionalMemoryModule';
import { RelationshipHealthModule } from './modules/RelationshipHealthModule';
import { ActiveRunsModule } from './modules/ActiveRunsModule';
import { PendingApprovalsModule } from './modules/PendingApprovalsModule';

export function GlobalContextRail() {
  const {
    isOpen,
    close,
    data,
    isLoading,
    error,
    refresh,
    activeEntityId,
    activeEntityType,
  } = useContextRail();

  // Collapsible section state
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    dossier: true,
    health: true,
    memory: true,
    related: false,
    runs: true,
    approvals: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        data-testid="global-context-rail"
        className="w-full sm:max-w-md md:max-w-lg p-0 gap-0 flex flex-col border-l border-border/80 bg-card text-card-foreground shadow-2xl z-50 overflow-hidden"
      >
        {/* Demarcated Header (theme.md §8) */}
        <SheetHeader className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0 text-left">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <SheetTitle className="text-sm font-semibold text-foreground truncate">
                Context Intelligence
              </SheetTitle>
              <CardInfoTooltip text="Live 360° institutional intelligence, relationship telemetry, and autonomous execution oversight." />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={refresh}
              disabled={isLoading}
              aria-label="Refresh context data"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground active:scale-[0.97]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close context rail"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground active:scale-[0.97]"
              >
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">
            Contextual Intelligence Drawer providing entity dossier, relationship health, institutional memory citations, related entities, active runs, and pending approvals.
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 divide-y divide-border/60">
          {/* Loading Skeleton */}
          {isLoading && !data && (
            <div data-testid="context-rail-loading" className="space-y-4 pt-2">
              <div className="h-24 rounded-xl bg-muted/30 animate-pulse border border-border/40" />
              <div className="h-28 rounded-xl bg-muted/30 animate-pulse border border-border/40" />
              <div className="h-32 rounded-xl bg-muted/30 animate-pulse border border-border/40" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div
              data-testid="context-rail-error"
              className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 space-y-2"
            >
              <div className="flex items-center gap-2 font-medium text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Failed to load contextual intelligence</span>
              </div>
              <p className="text-xs opacity-90">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                className="mt-2 h-7 text-xs border-rose-500/30 hover:bg-rose-500/20 active:scale-[0.97]"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Active Data Modules */}
          {data && (
            <>
              {/* Section 1: Entity Dossier */}
              <div className="pt-3 first:pt-0 space-y-2">
                <button
                  type="button"
                  onClick={() => toggleSection('dossier')}
                  className="w-full flex items-center justify-between py-1 text-xs font-semibold text-foreground/80 hover:text-foreground focus:outline-none"
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    Entity Dossier
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                      openSections.dossier ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openSections.dossier && <EntityDossierModule dossier={data.dossier} />}
              </div>

              {/* Section 2: Relationship Health */}
              <div className="pt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => toggleSection('health')}
                  className="w-full flex items-center justify-between py-1 text-xs font-semibold text-foreground/80 hover:text-foreground focus:outline-none"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Relationship Telemetry
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                      openSections.health ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openSections.health && <RelationshipHealthModule health={data.health} />}
              </div>

              {/* Section 3: Pending Approvals (High Priority) */}
              {data.pendingApprovals.length > 0 && (
                <div className="pt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => toggleSection('approvals')}
                    className="w-full flex items-center justify-between py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:opacity-90 focus:outline-none"
                  >
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Pending Approvals ({data.pendingApprovals.length})
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        openSections.approvals ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openSections.approvals && (
                    <PendingApprovalsModule approvals={data.pendingApprovals} />
                  )}
                </div>
              )}

              {/* Section 4: Active Agent Runs */}
              <div className="pt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => toggleSection('runs')}
                  className="w-full flex items-center justify-between py-1 text-xs font-semibold text-foreground/80 hover:text-foreground focus:outline-none"
                >
                  <span className="flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                    Active Agent Runs ({data.activeRuns.length})
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                      openSections.runs ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openSections.runs && <ActiveRunsModule runs={data.activeRuns} />}
              </div>

              {/* Section 5: Institutional Memory & Citations */}
              <div className="pt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => toggleSection('memory')}
                  className="w-full flex items-center justify-between py-1 text-xs font-semibold text-foreground/80 hover:text-foreground focus:outline-none"
                >
                  <span className="flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-primary" />
                    Institutional Memory ({data.memories.length})
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                      openSections.memory ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openSections.memory && (
                  <InstitutionalMemoryModule memories={data.memories} />
                )}
              </div>

              {/* Section 6: Related Entities Mesh */}
              <div className="pt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => toggleSection('related')}
                  className="w-full flex items-center justify-between py-1 text-xs font-semibold text-foreground/80 hover:text-foreground focus:outline-none"
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    Related Entities ({data.relatedEntities.length})
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                      openSections.related ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openSections.related && (
                  <RelatedEntitiesModule relatedEntities={data.relatedEntities} />
                )}
              </div>
            </>
          )}
        </div>

        {/* Demarcated Footer (theme.md §8 & Rule 68/§81 No Dead Ends) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between shrink-0">
          <div className="text-[11px] text-muted-foreground font-mono">
            {activeEntityType ? `${activeEntityType}: ${activeEntityId}` : 'Context Active'}
          </div>

          <div className="flex items-center gap-2">
            {activeEntityId && (
              <Link
                href={`/admin/entities/${activeEntityId}?tab=ai`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors active:scale-[0.97] min-h-[36px]"
              >
                <span>Ask AI Desk</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
            <SheetClose asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl active:scale-[0.97] text-xs h-9 min-h-[36px]"
              >
                Close
              </Button>
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
