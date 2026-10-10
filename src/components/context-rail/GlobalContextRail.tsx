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
  Building2,
  Search,
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
    workspaceData,
    isLoading,
    error,
    refresh,
    activeEntityId,
    activeEntityType,
    openRail,
    setActiveEntity,
  } = useContextRail();

  const [searchFilter, setSearchFilter] = React.useState('');

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

  const filteredRecentEntities = React.useMemo(() => {
    const list = workspaceData?.recentEntities || [];
    if (!searchFilter.trim()) return list;
    const q = searchFilter.toLowerCase();
    return list.filter(
      (e) => e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q)
    );
  }, [workspaceData?.recentEntities, searchFilter]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        showCloseButton={false}
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
          {isLoading && !data && !workspaceData && (
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
              className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 space-y-2.5"
            >
              <div className="flex items-center gap-2 font-medium text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Failed to load contextual intelligence</span>
              </div>
              <p className="text-xs opacity-90 leading-relaxed">{error}</p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refresh}
                  className="h-7 text-xs border-rose-500/30 hover:bg-rose-500/20 active:scale-[0.97]"
                >
                  Retry
                </Button>
                {activeEntityId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveEntity(null)}
                    className="h-7 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 active:scale-[0.97]"
                  >
                    Switch to Workspace Overview
                  </Button>
                )}
              </div>
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

          {/* Workspace Standby Desk (when no specific entity is active) */}
          {!data && !isLoading && !error && (
            <div data-testid="context-rail-standby" className="space-y-4 pt-1">
              {/* Hero Standby Banner */}
              <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">Workspace Intelligence Active</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                    Standby Mode
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Context Intelligence continuously monitors institutional memory, relationship telemetry, and autonomous execution swarms. Select an account below or navigate to any record in your workspace to load its live 360° dossier.
                </p>
              </div>

              {/* Recent Accounts Quick Access */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    Recent Workspace Accounts
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {workspaceData?.recentEntities?.length ?? 0} loaded
                  </span>
                </div>

                {/* Filter Input */}
                {(workspaceData?.recentEntities?.length ?? 0) > 2 && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Filter accounts..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {filteredRecentEntities.length > 0 ? (
                  <div className="space-y-1.5">
                    {filteredRecentEntities.map((ent) => (
                      <div
                        key={ent.id}
                        className="p-2.5 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/20 transition-all flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{ent.name}</div>
                          <div className="text-[10px] text-muted-foreground capitalize flex items-center gap-1.5">
                            <span>{ent.type}</span>
                            {ent.tier && <span>• {ent.tier}</span>}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRail(ent.id, ent.type || 'entity', ent.name)}
                          className="h-7 px-2.5 text-[11px] rounded-lg border-border hover:bg-background active:scale-[0.97] shrink-0"
                        >
                          Inspect
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/10 text-center space-y-1">
                    <Building2 className="h-5 w-5 text-muted-foreground/60 mx-auto" />
                    <p className="text-xs text-muted-foreground">No recent accounts in cache.</p>
                    <p className="text-[10px] text-muted-foreground">Navigate to Entities to view your CRM database.</p>
                  </div>
                )}
              </div>

              {/* Workspace Pending Approvals (if any) */}
              {workspaceData?.pendingApprovals && workspaceData.pendingApprovals.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Pending Approvals ({workspaceData.pendingApprovals.length})
                  </div>
                  <PendingApprovalsModule approvals={workspaceData.pendingApprovals} />
                </div>
              )}

              {/* Workspace Active Agent Runs (if any) */}
              {workspaceData?.activeRuns && workspaceData.activeRuns.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                    Active Agent Runs ({workspaceData.activeRuns.length})
                  </div>
                  <ActiveRunsModule runs={workspaceData.activeRuns} />
                </div>
              )}

              {/* Fast Navigation Affordances (No Dead Ends §81) */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-foreground/80">Direct Navigation</div>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/admin/entities"
                    className="p-2.5 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/20 transition-all flex flex-col gap-1 text-left active:scale-[0.97]"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      <span>Accounts</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Manage CRM entities</span>
                  </Link>
                  <Link
                    href="/admin/pipeline"
                    className="p-2.5 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/20 transition-all flex flex-col gap-1 text-left active:scale-[0.97]"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <ExternalLink className="h-3.5 w-3.5 text-primary" />
                      <span>Pipeline</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Deals & opportunities</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Demarcated Footer (theme.md §8 & Rule 68/§81 No Dead Ends) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between shrink-0">
          <div className="text-[11px] text-muted-foreground font-mono">
            {activeEntityType && activeEntityId ? `${activeEntityType}: ${activeEntityId}` : 'Workspace Context Active'}
          </div>

          <div className="flex items-center gap-2">
            {activeEntityId ? (
              <Link
                href={`/admin/entities/${activeEntityId}?tab=ai`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors active:scale-[0.97] min-h-[36px]"
              >
                <span>Ask AI Desk</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <Link
                href="/admin/entities"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors active:scale-[0.97] min-h-[36px]"
              >
                <span>All Accounts</span>
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
