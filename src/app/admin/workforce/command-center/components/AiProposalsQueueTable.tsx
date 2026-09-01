'use client';

/**
 * @fileOverview AI Proposals Queue Table Component (Phase 9)
 *
 * Displays pending and historical AI action proposals with blast radius badges,
 * status tracking, and 1-click impact inspection triggers.
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
import {
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Flame,
  AlertTriangle,
} from 'lucide-react';
import type { AiAdminActionProposal, AiProposalStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AiProposalsQueueTableProps {
  proposals: AiAdminActionProposal[];
  isLoading: boolean;
  onInspect: (proposal: AiAdminActionProposal) => void;
}

export function AiProposalsQueueTable({
  proposals,
  isLoading,
  onInspect,
}: AiProposalsQueueTableProps) {
  const statusBadge = (status: AiProposalStatus) => {
    switch (status) {
      case 'pending_approval':
      case 'proposed':
        return (
          <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1">
            <Clock className="w-3 h-3" /> Needs Approval
          </Badge>
        );
      case 'executing':
        return (
          <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold bg-blue-500/10 text-blue-600 border-blue-500/30">
            Executing...
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-bold bg-rose-500/10 text-rose-600 border-rose-500/30 gap-1">
            <XCircle className="w-3 h-3" /> Rejected
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="text-[9px] uppercase tracking-wider font-bold">
            Failed
          </Badge>
        );
    }
  };

  return (
    <Card className="border bg-card shadow-xs overflow-hidden">
      <CardHeader className="p-4 pb-3 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <CardTitle className="text-sm font-bold">Administrative Action Proposals</CardTitle>
            <CardDescription className="text-xs">
              Simulated administrative actions pending human approval and execution history
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/10">
            <TableRow>
              <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Proposal Details</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Action Type</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Blast Radius</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Status</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3 text-right pr-4">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5} className="p-4">
                    <div className="h-8 bg-muted/40 animate-pulse rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : proposals.length > 0 ? (
              proposals.map((prop) => (
                <TableRow key={prop.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="pl-4 py-3 max-w-xs">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-xs text-foreground block line-clamp-1">{prop.title}</span>
                      <span className="text-[10px] text-muted-foreground block line-clamp-1">
                        &ldquo;{prop.naturalLanguagePrompt}&rdquo;
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary" className="text-[9px] uppercase font-bold">
                      {prop.actionType.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-foreground block">
                        {prop.impactPreview.affectedUserCount} users
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Blast: {prop.impactPreview.blastRadius}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>{statusBadge(prop.status)}</TableCell>

                  <TableCell className="text-right pr-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onInspect(prop)}
                      className="text-xs h-7 px-2.5 font-semibold active:scale-[0.97]"
                    >
                      Inspect & Review <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-xs text-muted-foreground">
                  No administrative proposals found. Enter a prompt above to generate one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

export default AiProposalsQueueTable;
