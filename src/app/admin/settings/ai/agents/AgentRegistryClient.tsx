'use client';

/**
 * @fileOverview Agent Persona Registry Operator Console Client (Phase 15 Milestone 4 Task 6)
 *
 * Implements Roadmap §23, Rule 7 (Mobile-first >= 44px), Rule 12 (Immutable Risk Ceilings),
 * Rule 16 (Least-Privilege Scoping), Rule 23 (Resource Budgets), and theme.md §8.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  Bot,
  Search,
  Filter,
  ShieldCheck,
  Lock,
  Layers,
  Sparkles,
  ChevronRight,
  Clock,
  Coins,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { AgentPersonaDetailModal } from '@/components/registry/AgentPersonaDetailModal';
import type { AgentPersonaSummary } from '@/platform/registry/contracts/registry-types';
import { cn } from '@/lib/utils';

export interface AgentRegistryClientProps {
  initialPersonas: readonly AgentPersonaSummary[];
}

export function AgentRegistryClient({
  initialPersonas,
}: AgentRegistryClientProps) {
  const [personas] = React.useState<readonly AgentPersonaSummary[]>(initialPersonas);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [selectedDomain, setSelectedDomain] = React.useState<string>('ALL');
  const [selectedRisk, setSelectedRisk] = React.useState<string>('ALL');

  // Modal inspection state
  const [selectedPersona, setSelectedPersona] = React.useState<AgentPersonaSummary | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);

  // 300ms debounce
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Derived KPI metrics
  const totalCount = personas.length;
  const readOnlyCount = React.useMemo(
    () => personas.filter((p) => p.maxAutonomousRiskLevel === 'L0_READ').length,
    [personas]
  );
  const mutatingCount = React.useMemo(
    () => personas.filter((p) => p.maxAutonomousRiskLevel !== 'L0_READ').length,
    [personas]
  );

  // Unique domains list
  const availableDomains = React.useMemo(() => {
    const domains = new Set<string>();
    personas.forEach((p) => {
      p.allowedDomains.forEach((d) => domains.add(d));
    });
    return Array.from(domains).sort();
  }, [personas]);

  // Filtered personas list
  const filteredPersonas = React.useMemo(() => {
    return personas.filter((persona) => {
      if (selectedDomain !== 'ALL' && !persona.allowedDomains.includes(selectedDomain)) {
        return false;
      }
      if (selectedRisk !== 'ALL' && persona.maxAutonomousRiskLevel !== selectedRisk) {
        return false;
      }
      if (debouncedQuery.trim()) {
        const q = debouncedQuery.toLowerCase();
        const matchesId = persona.id.toLowerCase().includes(q);
        const matchesName = persona.name.toLowerCase().includes(q);
        const matchesRole = persona.role.toLowerCase().includes(q);
        const matchesDesc = persona.description.toLowerCase().includes(q);
        if (!matchesId && !matchesName && !matchesRole && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }, [personas, selectedDomain, selectedRisk, debouncedQuery]);

  const handleOpenDetail = (p: AgentPersonaSummary) => {
    setSelectedPersona(p);
    setIsDetailModalOpen(true);
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'L0_READ':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
      case 'L1_INTERNAL_DRAFT':
        return 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'L2_STATE_MUTATION':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'L3_EXTERNAL_COMMUNICATION_FINANCE':
        return 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400';
      case 'L4_PRIVILEGED_DESTRUCTIVE':
        return 'border-destructive/30 bg-destructive/10 text-destructive';
      default:
        return 'border-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Bot className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Agent Persona Registry
            </h1>
            <CardInfoTooltip text="Catalog of 26 canonical agent personas with deterministic resource budgets, domain namespaces, and immutable least-privilege risk ceilings." />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Backoffice strategic asset catalog governing specialized autonomous agents across CRM, Sales, Meetings, Finance, School Ops, and Supervisor mesh.
          </p>
        </div>
      </div>

      {/* Zone 1: Executive KPI Header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Canonical Personas</span>
            <Layers className="h-4 w-4 text-muted-foreground/70" />
          </div>
          <div className="text-2xl font-bold text-foreground">{totalCount}</div>
          <div className="text-xs text-muted-foreground">Standardized platform identities</div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Read-Only Personas</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {readOnlyCount}
          </div>
          <div className="text-xs text-muted-foreground">L0_READ research specialists</div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Mutating Specialists</span>
            <Lock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {mutatingCount}
          </div>
          <div className="text-xs text-muted-foreground">Governed by Two-Phase Interceptors</div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Domain Namespaces</span>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {availableDomains.length}
          </div>
          <div className="text-xs text-muted-foreground">Scoped domain authorizations</div>
        </div>
      </div>

      {/* Zone 2: Filter Toolbar */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search personas by name, role, ID, or description..."
              className="pl-9 min-h-[44px] rounded-xl bg-background border-border/80"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Filter by Domain"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="min-h-[44px] rounded-xl bg-background border border-border/80 px-3.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Domains</option>
              {availableDomains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Risk Level"
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="min-h-[44px] rounded-xl bg-background border border-border/80 px-3.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="L0_READ">L0_READ</option>
              <option value="L1_INTERNAL_DRAFT">L1_INTERNAL_DRAFT</option>
              <option value="L2_STATE_MUTATION">L2_STATE_MUTATION</option>
              <option value="L3_EXTERNAL_COMMUNICATION_FINANCE">L3_EXTERNAL_COMMUNICATION_FINANCE</option>
            </select>
          </div>
        </div>
      </div>

      {/* Zone 3: Interactive Table */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/80 bg-muted/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">Persona & Role</th>
                <th className="px-4 py-3.5">Risk Ceiling</th>
                <th className="px-4 py-3.5">Allowed Domains</th>
                <th className="px-4 py-3.5">Budgets (Time / Tokens / Tools)</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredPersonas.length > 0 ? (
                filteredPersonas.map((persona) => (
                  <tr key={persona.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3.5 max-w-sm">
                      <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        {persona.name}
                        <span className="text-[11px] font-mono text-muted-foreground">v{persona.version}</span>
                      </div>
                      <div className="text-xs text-primary font-medium mt-0.5">
                        {persona.role}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {persona.description}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant="outline" className={cn('text-xs font-mono', getRiskBadgeColor(persona.maxAutonomousRiskLevel))}>
                        {persona.maxAutonomousRiskLevel}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {persona.allowedDomains.map((d) => (
                          <Badge key={d} variant="outline" className="text-[11px] font-mono">
                            {d}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {Math.round(persona.maxDurationMs / 1000)}s
                        </span>
                        <span className="flex items-center gap-1">
                          <Coins className="h-3 w-3" /> {persona.maxTokens >= 1000 ? `${persona.maxTokens / 1000}k` : persona.maxTokens}
                        </span>
                        <span className="flex items-center gap-1">
                          <Wrench className="h-3 w-3" /> {persona.maxToolCalls} tools
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDetail(persona)}
                        className="rounded-xl active:scale-[0.97] min-h-[36px] px-3 text-xs gap-1"
                      >
                        Inspect
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    No agent personas match the selected filters or search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent Persona Detail Modal */}
      <AgentPersonaDetailModal
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        persona={selectedPersona}
      />
    </div>
  );
}
