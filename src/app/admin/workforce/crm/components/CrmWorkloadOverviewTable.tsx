'use client';

/**
 * @fileOverview CRM Workload & Asset Allocation Table (Phase 7)
 *
 * Displays organization-wide CRM entity distribution per representative
 * with 1-click ownership transfer triggers.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Table with Emil Kowalski spring easing on actions.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, DollarSign, Users, Briefcase, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CrmWorkloadSummary } from '@/lib/types';

interface CrmWorkloadOverviewTableProps {
  workloads: CrmWorkloadSummary[];
  isLoading: boolean;
  onSelectTransfer: (workload: CrmWorkloadSummary) => void;
}

export function CrmWorkloadOverviewTable({
  workloads,
  isLoading,
  onSelectTransfer,
}: CrmWorkloadOverviewTableProps) {
  return (
    <Card className="border bg-card shadow-xs overflow-hidden">
      <CardHeader className="p-4 pb-3 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-primary" />
          <div>
            <CardTitle className="text-sm font-bold">Representative Asset Allocation</CardTitle>
            <CardDescription className="text-xs">
              Deals pipeline value, contact volumes, and operational workload distribution
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/10">
            <TableRow>
              <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Team Member</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Pipeline Deals</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Contacts & Leads</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Tasks & Automations</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Orphan Risk</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3 text-right pr-4">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="p-4">
                    <div className="h-8 bg-muted/40 animate-pulse rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : workloads.length > 0 ? (
              workloads.map((wl) => (
                <TableRow key={wl.personId} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="pl-4 py-3">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-xs text-foreground block">{wl.personName}</span>
                      <span className="text-[10px] text-muted-foreground block">{wl.personEmail}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-foreground block">
                        ${wl.totalPipelineValue.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {wl.dealCount} active deals
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-xs font-medium text-foreground">
                      {wl.contactCount} records
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-xs space-x-2 text-muted-foreground">
                      <span>{wl.openTaskCount} tasks</span>
                      <span>•</span>
                      <span>{wl.automationCount} automations</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    {wl.hasOrphanRisk ? (
                      <Badge variant="outline" className="text-[9px] uppercase tracking-wider bg-amber-500/10 text-amber-600 border-amber-500/30">
                        {wl.totalActiveEntities} Assets Held
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        Zero Risk
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right pr-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectTransfer(wl)}
                      disabled={!wl.hasOrphanRisk}
                      className="text-xs h-7 px-2.5 font-semibold active:scale-[0.97]"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Transfer
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                  No representative workloads found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

export default CrmWorkloadOverviewTable;
