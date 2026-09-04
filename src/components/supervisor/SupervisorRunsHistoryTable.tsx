'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 7: Supervisor Mission History Table
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Historical Mission Observability:
 *    - Lists recent missions with duration, step metrics, and status.
 * 2. Mobile Accessibility:
 *    - Touch targets >= 44px (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Tactile buttons with `active:scale-[0.97]`.
 * 4. Strict Zero-`any` & Zero-`unknown` Standard.
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Clock,
  ExternalLink,
  Bot,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import type { AgentRun } from '@/lib/supervisor/types';

export interface SupervisorRunsHistoryTableProps {
  runs: AgentRun[];
  onSelectRun: (run: AgentRun) => void;
  isLoading?: boolean;
}

export function SupervisorRunsHistoryTable({
  runs,
  onSelectRun,
  isLoading = false,
}: SupervisorRunsHistoryTableProps) {
  const [search, setSearch] = React.useState('');

  const filteredRuns = React.useMemo(() => {
    if (!search.trim()) return runs;
    const q = search.toLowerCase();
    return runs.filter(
      (r) =>
        r.objective.toLowerCase().includes(q) ||
        (r.subject?.id && r.subject.id.toLowerCase().includes(q))
    );
  }, [runs, search]);

  const getStatusBadge = (status: AgentRun['status']) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> COMPLETED
          </Badge>
        );
      case 'needs_approval':
        return (
          <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900 text-xs flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> APPROVAL NEEDED
          </Badge>
        );
      case 'executing':
      case 'planning':
        return (
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs flex items-center gap-1">
            <Clock className="w-3 h-3 animate-spin" /> EXECUTING
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> FAILED
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600 text-xs">
            {status.toUpperCase()}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search past missions by goal or subject..."
            className="pl-9 min-h-[44px] text-xs bg-white border-slate-200"
          />
        </div>
      </div>

      {/* Runs Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow>
              <TableHead className="text-xs font-semibold text-slate-700">Mission Objective</TableHead>
              <TableHead className="text-xs font-semibold text-slate-700">Subject</TableHead>
              <TableHead className="text-xs font-semibold text-slate-700">Status</TableHead>
              <TableHead className="text-xs font-semibold text-slate-700">Steps</TableHead>
              <TableHead className="text-xs font-semibold text-slate-700">Duration</TableHead>
              <TableHead className="text-xs font-semibold text-slate-700">Date</TableHead>
              <TableHead className="text-right text-xs font-semibold text-slate-700">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRuns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-slate-400 text-xs">
                  {isLoading ? 'Loading mission history...' : 'No past supervisor missions found.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredRuns.map((run) => (
                <TableRow key={run.id} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell className="py-3 max-w-xs">
                    <span className="text-xs font-semibold text-slate-900 block truncate">
                      {run.objective}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {run.id}
                    </span>
                  </TableCell>

                  <TableCell className="py-3">
                    {run.subject ? (
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {run.subject.type}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400">Workspace</span>
                    )}
                  </TableCell>

                  <TableCell className="py-3">{getStatusBadge(run.status)}</TableCell>

                  <TableCell className="py-3 text-xs text-slate-700 font-mono">
                    {run.metrics.completedSteps} / {run.metrics.totalSteps}
                  </TableCell>

                  <TableCell className="py-3 text-xs text-slate-500 font-mono">
                    {run.metrics.durationMs ? `${run.metrics.durationMs}ms` : '—'}
                  </TableCell>

                  <TableCell className="py-3 text-xs text-slate-500">
                    {new Date(run.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>

                  <TableCell className="text-right py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSelectRun(run)}
                      className="min-h-[44px] text-xs active:scale-[0.97] transition-transform text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    >
                      <span>Inspect</span>
                      <ExternalLink className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
