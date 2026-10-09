'use client';

/**
 * @fileOverview Capability Catalog Table (Phase 5 Milestone 4 Task 4)
 *
 * Implements:
 * - Rule 4: Zero any / Zero any[] strict typing.
 * - Rule 14: Visual drift indicators with pulse cues.
 * - Rule 17: Non-delegable action warning shield badges.
 * - Responsive table layout with mobile-first touch targets (min-h-[44px]).
 * - Multi-criteria client-side search & filtering across domains, risks, and verification status.
 */

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Search,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Eye,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { McpCapabilitySummary } from '@/app/actions/mcp-actions';

export interface CapabilityCatalogTableProps {
  capabilities: McpCapabilitySummary[];
  onInspect: (toolId: string) => void;
  onToggleState?: (toolId: string, enabled: boolean) => Promise<void>;
  isLoading?: boolean;
}

const DOMAINS = ['all', 'crm_contacts', 'knowledge', 'messaging', 'deals_revenue', 'identity_access', 'tasks_productivity'];
const STATUSES = ['all', 'verified', 'drift_detected', 'unapproved'];

export function CapabilityCatalogTable({
  capabilities,
  onInspect,
  onToggleState,
  isLoading = false,
}: CapabilityCatalogTableProps) {
  const [search, setSearch] = React.useState('');
  const [domainFilter, setDomainFilter] = React.useState('all');
  const [riskFilter, setRiskFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    return capabilities.filter((c) => {
      if (domainFilter !== 'all' && c.domain.toLowerCase() !== domainFilter.toLowerCase()) {
        return false;
      }
      if (riskFilter !== 'all' && c.riskLevel !== riskFilter) {
        return false;
      }
      if (statusFilter !== 'all' && c.fingerprintStatus !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.id.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [capabilities, domainFilter, riskFilter, statusFilter, search]);

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'L4_PRIVILEGED_DESTRUCTIVE':
        return (
          <Badge variant="destructive" className="font-mono text-[11px] uppercase">
            L4 Destructive
          </Badge>
        );
      case 'L3_EXTERNAL_SIDE_EFFECT':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-mono text-[11px] uppercase">
            L3 Side Effect
          </Badge>
        );
      case 'L2_STATE_MUTATION':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-mono text-[11px] uppercase">
            L2 Mutation
          </Badge>
        );
      case 'L1_TRANSIENT':
        return (
          <Badge variant="secondary" className="font-mono text-[11px] uppercase">
            L1 Transient
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-mono text-[11px] uppercase">
            L0 Read
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: McpCapabilitySummary['fingerprintStatus']) => {
    switch (status) {
      case 'verified':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-mono text-[11px] flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Verified
          </Badge>
        );
      case 'drift_detected':
        return (
          <Badge variant="destructive" className="font-mono text-[11px] flex items-center gap-1 animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            Drift Detected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 font-mono text-[11px] flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Unapproved
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search capabilities by name, ID, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-10 text-xs bg-card/80 border-border/80 rounded-xl"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/60">
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors capitalize ${
                  statusFilter === status
                    ? 'bg-background shadow-xs font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Domain Quick Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-muted-foreground font-medium flex items-center gap-1 shrink-0 mr-1">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Domain:
        </span>
        {DOMAINS.map((domain) => (
          <Button
            key={domain}
            size="sm"
            variant={domainFilter === domain ? 'default' : 'outline'}
            onClick={() => setDomainFilter(domain)}
            className="h-7 text-xs rounded-lg font-mono active:scale-[0.97]"
          >
            {domain}
          </Button>
        ))}
      </div>

      {/* Catalog Table */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold text-xs py-3.5">Capability</TableHead>
              <TableHead className="font-semibold text-xs py-3.5">Domain</TableHead>
              <TableHead className="font-semibold text-xs py-3.5">Risk & Safety</TableHead>
              <TableHead className="font-semibold text-xs py-3.5">Fingerprint</TableHead>
              <TableHead className="font-semibold text-xs py-3.5 text-center">Active</TableHead>
              <TableHead className="font-semibold text-xs py-3.5 text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="h-16 text-center animate-pulse bg-muted/10" />
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-xs">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Wrench className="h-6 w-6 text-muted-foreground/60" />
                    <p>No capabilities match the selected search or filter criteria.</p>
                    {(search || domainFilter !== 'all' || riskFilter !== 'all' || statusFilter !== 'all') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSearch('');
                          setDomainFilter('all');
                          setRiskFilter('all');
                          setStatusFilter('all');
                        }}
                        className="text-xs h-8 text-primary"
                      >
                        Reset Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((cap) => (
                <TableRow key={cap.id} className="transition-colors hover:bg-muted/50 even:bg-muted/30 dark:even:bg-muted/15">
                  {/* Capability Details */}
                  <TableCell className="py-3.5">
                    <div className="space-y-0.5">
                      <div className="font-medium text-xs sm:text-sm text-foreground flex items-center gap-2">
                        <span>{cap.name}</span>
                        <span className="text-xs font-mono text-muted-foreground font-normal">v{cap.version}</span>
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground truncate max-w-md select-all">
                        {cap.id}
                      </div>
                    </div>
                  </TableCell>

                  {/* Domain */}
                  <TableCell className="py-3.5">
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {cap.domain}
                    </Badge>
                  </TableCell>

                  {/* Risk Level & Safety Flags */}
                  <TableCell className="py-3.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {getRiskBadge(cap.riskLevel)}
                      {cap.isNonDelegable && (
                        <span
                          title="Non-Delegable Action (Rule 17): Autonomous agent execution blocked"
                          className="inline-flex items-center text-amber-600 dark:text-amber-400"
                        >
                          <ShieldAlert className="h-4 w-4" />
                        </span>
                      )}
                      {cap.supportsDryRun && (
                        <span title="Supports Dry Run" className="inline-flex items-center text-muted-foreground">
                          <Eye className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Fingerprint Status */}
                  <TableCell className="py-3.5">
                    {getStatusBadge(cap.fingerprintStatus)}
                  </TableCell>

                  {/* Toggle Active Switch */}
                  <TableCell className="py-3.5 text-center">
                    <Switch
                      checked={cap.enabled}
                      onCheckedChange={(checked) => onToggleState?.(cap.id, checked)}
                      aria-label={`Toggle ${cap.name}`}
                    />
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-3.5 text-right pr-6">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onInspect(cap.id)}
                      className="h-8 text-xs gap-1.5 rounded-xl active:scale-[0.97] min-h-[44px] sm:min-h-[32px]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer Metrics */}
      <div className="text-xs text-muted-foreground px-2 flex items-center justify-between">
        <span>Showing {filtered.length} of {capabilities.length} registered capabilities</span>
        <span className="font-mono text-[11px]">Cloud Run Stateless MCP v2.1.0</span>
      </div>
    </div>
  );
}
