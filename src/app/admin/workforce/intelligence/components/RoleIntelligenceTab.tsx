'use client';

/**
 * @fileOverview Role & Permission Intelligence Tab Component (Phase 11)
 *
 * Evaluates role efficiency, permission usage density, and redundancy scores
 * across workspace roles.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Table with Emil Kowalski spring easing.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, AlertTriangle, CheckCircle2, Scissors, GitMerge, Trash2 } from 'lucide-react';
import type { RoleIntelligenceSummary, RoleEffectivenessRating } from '@/lib/types';

interface RoleIntelligenceTabProps {
  roles: RoleIntelligenceSummary[];
}

export function RoleIntelligenceTab({ roles }: RoleIntelligenceTabProps) {
  const ratingBadge = (rating: RoleEffectivenessRating) => {
    switch (rating) {
      case 'optimal':
        return (
          <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1 font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" /> Optimal
          </Badge>
        );
      case 'trim_permissions':
        return (
          <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1 font-bold uppercase tracking-wider">
            <Scissors className="w-3 h-3" /> Trim Permissions
          </Badge>
        );
      case 'merge_role':
        return (
          <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/30 gap-1 font-bold uppercase tracking-wider">
            <GitMerge className="w-3 h-3" /> Merge Role
          </Badge>
        );
      case 'deprecate':
        return (
          <Badge variant="destructive" className="text-[9px] gap-1 font-bold uppercase tracking-wider">
            <Trash2 className="w-3 h-3" /> Deprecate
          </Badge>
        );
    }
  };

  return (
    <Card className="border bg-card shadow-xs overflow-hidden">
      <CardHeader className="p-4 pb-3 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div>
            <CardTitle className="text-sm font-bold">Role Effectiveness & Permission Density</CardTitle>
            <CardDescription className="text-xs">
              Analyzes entitlement utilization, redundancy, and right-sizing recommendations
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/10">
            <TableRow>
              <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Role</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Assigned Users</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Active Permissions</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Utilization Rate</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3">Redundancy</TableHead>
              <TableHead className="text-[10px] uppercase font-bold py-3 text-right pr-4">Recommendation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((r) => (
              <TableRow key={r.roleId} className="text-xs hover:bg-muted/10 transition-colors">
                <TableCell className="pl-4 py-3 font-semibold text-foreground">
                  {r.roleName}
                </TableCell>
                <TableCell>{r.assignedMembersCount} members</TableCell>
                <TableCell className="font-mono text-xs">{r.activePermissionsCount} keys</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="font-bold">{r.utilizationRate}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs">{r.redundancyScore}%</span>
                </TableCell>
                <TableCell className="text-right pr-4">{ratingBadge(r.rating)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

export default RoleIntelligenceTab;
