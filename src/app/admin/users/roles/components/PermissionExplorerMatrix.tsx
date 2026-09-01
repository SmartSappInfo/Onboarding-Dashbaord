'use client';

/**
 * @fileOverview Permission Explorer Matrix (Authorization 2.0)
 *
 * Interactive 2D grid displaying all organization roles against the canonical system
 * permission catalog with section tabs, search filtering, and risk tiering badges.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Read-only matrix for fast audit and governance comparison.
 * - Mobile ergonomics: horizontal kinetic scroll with sticky headers and responsive touch targets.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import {
  Search,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Role, PermissionDefinition, PermissionsSchema, PermissionRiskLevel } from '@/lib/types';
import { CANONICAL_PERMISSIONS_CATALOG } from '@/lib/services/authorization/permission-registry-service';
import { evaluatePermission, normalizePermissionsSchema } from '@/lib/permissions-engine';

interface PermissionExplorerMatrixProps {
  roles: Role[];
  activeSection?: keyof PermissionsSchema;
}

const SECTIONS: { id: keyof PermissionsSchema; label: string }[] = [
  { id: 'operations', label: 'Operations' },
  { id: 'finance', label: 'Finance Hub' },
  { id: 'studios', label: 'Studios' },
  { id: 'management', label: 'Management' },
];

const RISK_BADGES: Record<PermissionRiskLevel, { label: string; className: string }> = {
  low: { label: 'Low Risk', className: 'bg-muted text-muted-foreground border-border' },
  medium: { label: 'Medium', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  high: { label: 'High', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  critical: { label: 'Critical', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold' },
};

export function PermissionExplorerMatrix({ roles }: PermissionExplorerMatrixProps) {
  const [activeSection, setActiveSection] = React.useState<keyof PermissionsSchema>('operations');
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredPermissions = React.useMemo(() => {
    return CANONICAL_PERMISSIONS_CATALOG.filter((perm) => {
      if (perm.section !== activeSection) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        perm.name.toLowerCase().includes(q) ||
        perm.id.toLowerCase().includes(q) ||
        perm.description.toLowerCase().includes(q) ||
        perm.feature.toLowerCase().includes(q)
      );
    });
  }, [activeSection, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Matrix Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border">
        <Tabs
          value={activeSection}
          onValueChange={(val) => setActiveSection(val as keyof PermissionsSchema)}
          className="w-full sm:w-auto"
        >
          <TabsList className="h-9 bg-muted/40 p-0.5 w-full sm:w-auto grid grid-cols-2 sm:flex">
            {SECTIONS.map((sec) => (
              <TabsTrigger
                key={sec.id}
                value={sec.id}
                className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:shadow-xs"
              >
                {sec.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search permissions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8.5 text-xs bg-muted/20 border-border"
          />
        </div>
      </div>

      {/* 2D Matrix Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <Table className="relative">
            <TableHeader className="bg-muted/40 sticky top-0 z-20 backdrop-blur-md">
              <TableRow className="border-b">
                <TableHead className="w-[300px] min-w-[260px] pl-4 py-3 text-[10px] uppercase tracking-widest font-bold sticky left-0 bg-card/95 z-30 shadow-r">
                  Permission / Capability
                </TableHead>
                <TableHead className="w-[90px] text-center text-[10px] uppercase tracking-widest font-bold">
                  Risk
                </TableHead>
                {roles.map((r) => (
                  <TableHead key={r.id} className="min-w-[120px] text-center py-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                        <span className="text-xs font-semibold text-foreground truncate max-w-[100px]">
                          {r.name}
                        </span>
                      </div>
                      <span className="text-[9px] text-muted-foreground">{r.category || 'Role'}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPermissions.length > 0 ? (
                filteredPermissions.map((perm) => {
                  const riskInfo = RISK_BADGES[perm.riskLevel];

                  return (
                    <TableRow key={perm.id} className="hover:bg-muted/10 transition-colors">
                      {/* Permission Title & Feature */}
                      <TableCell className="pl-4 py-3 sticky left-0 bg-card/95 z-10 shadow-r">
                        <div className="space-y-0.5">
                          <span className="text-xs font-semibold text-foreground block">{perm.name}</span>
                          <span className="font-mono text-[9px] text-muted-foreground block">{perm.id}</span>
                          <p className="text-[10px] text-muted-foreground/80 line-clamp-1">{perm.description}</p>
                        </div>
                      </TableCell>

                      {/* Risk Level Badge */}
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', riskInfo.className)}>
                          {riskInfo.label}
                        </Badge>
                      </TableCell>

                      {/* Role Grants Grid */}
                      {roles.map((r) => {
                        const norm = normalizePermissionsSchema(r.permissionsSchema);
                        const isGranted = evaluatePermission(
                          norm,
                          perm.section,
                          perm.feature,
                          perm.action
                        );

                        return (
                          <TableCell key={r.id} className="text-center py-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center">
                                    {isGranted ? (
                                      <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle2 className="w-4 h-4" />
                                      </div>
                                    ) : (
                                      <div className="p-1 text-muted-foreground/30">
                                        <XCircle className="w-3.5 h-3.5" />
                                      </div>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  {isGranted
                                    ? `Granted to ${r.name}`
                                    : `Not granted to ${r.name}`}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={roles.length + 2} className="h-32 text-center text-xs text-muted-foreground">
                    No permissions match your filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export default PermissionExplorerMatrix;
