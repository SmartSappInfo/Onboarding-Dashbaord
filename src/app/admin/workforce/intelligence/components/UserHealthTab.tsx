'use client';

/**
 * @fileOverview User Health & Strain Tab Component (Phase 11)
 *
 * Displays individual workforce health scores, engagement consistency,
 * least-privilege compliance, and CRM workload balance.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Table with Emil Kowalski spring easing.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Activity, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { UserHealthScore, UserHealthStatus } from '@/lib/types';

interface UserHealthTabProps {
  scores: UserHealthScore[];
}

export function UserHealthTab({ scores }: UserHealthTabProps) {
  const statusBadge = (status: UserHealthStatus) => {
    switch (status) {
      case 'flourishing':
        return (
          <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold uppercase tracking-wider">
            Flourishing
          </Badge>
        );
      case 'healthy':
        return (
          <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/30 font-bold uppercase tracking-wider">
            Healthy
          </Badge>
        );
      case 'strained':
        return (
          <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30 font-bold uppercase tracking-wider">
            Strained
          </Badge>
        );
      case 'at_risk':
        return (
          <Badge variant="destructive" className="text-[9px] font-bold uppercase tracking-wider">
            At Risk
          </Badge>
        );
      case 'dormant':
        return (
          <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider">
            Dormant
          </Badge>
        );
    }
  };

  return (
    <Card className="border bg-card shadow-xs overflow-hidden">
      <CardHeader className="p-4 pb-3 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <div>
            <CardTitle className="text-sm font-bold">Workforce Health & Strain Index</CardTitle>
            <CardDescription className="text-xs">
              Multi-signal score evaluating telemetry consistency, onboarding velocity, and CRM workload
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/10">
            <TableRow>
              <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Member</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Health Score</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Status</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Activity</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Entitlement</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3 text-right pr-4">CRM Efficiency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scores.length > 0 ? (
              scores.map((u) => (
                <TableRow key={u.personId} className="text-xs hover:bg-muted/10 transition-colors">
                  <TableCell className="pl-4 py-3">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-foreground block">{u.personName}</span>
                      <span className="text-[10px] text-muted-foreground block">{u.personEmail}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-foreground">{u.score}</span>
                      <span className="text-[10px] text-muted-foreground">/100</span>
                    </div>
                  </TableCell>

                  <TableCell>{statusBadge(u.status)}</TableCell>

                  <TableCell>
                    <span className="font-mono text-xs">{u.activityConsistency}%</span>
                  </TableCell>

                  <TableCell>
                    <span className="font-mono text-xs">{u.leastPrivilegeScore}%</span>
                  </TableCell>

                  <TableCell className="text-right pr-4">
                    <span className="font-mono text-xs font-semibold">{u.crmEfficiencyScore}%</span>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-xs text-muted-foreground">
                  No member health scores available yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

export default UserHealthTab;
