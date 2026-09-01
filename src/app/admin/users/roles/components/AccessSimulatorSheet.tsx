'use client';

/**
 * @fileOverview Access Simulator & What-If Sandbox (Authorization 2.0)
 *
 * Slide-over sandbox allowing administrators to dry-run test arbitrary role combinations,
 * preview additive permission unions, and inspect risk metrics prior to assignment.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Sheet with Emil Kowalski spring easing (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Instant responsive client evaluation with server action fallback.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelect } from '@/components/ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Search,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Role, PermissionsSchema, Workspace } from '@/lib/types';
import {
  mergePermissionsSchemas,
  normalizePermissionsSchema,
  evaluatePermission,
  getBlankPermissions,
} from '@/lib/permissions-engine';
import {
  PermissionRegistryService,
  CANONICAL_PERMISSIONS_CATALOG,
} from '@/lib/services/authorization/permission-registry-service';

interface AccessSimulatorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  roles: Role[];
  workspaces: Workspace[];
}

export function AccessSimulatorSheet({
  isOpen,
  onClose,
  roles,
  workspaces,
}: AccessSimulatorSheetProps) {
  const [selectedRoleIds, setSelectedRoleIds] = React.useState<string[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Reset when opened
  React.useEffect(() => {
    if (isOpen && selectedRoleIds.length === 0 && roles.length > 0) {
      setSelectedRoleIds([roles[0].id]);
    }
  }, [isOpen, roles, selectedRoleIds.length]);

  // Compute merged simulation schema
  const simulatedSchema = React.useMemo(() => {
    const schemas: PermissionsSchema[] = [];
    selectedRoleIds.forEach((rId) => {
      const r = roles.find((role) => role.id === rId);
      if (r?.permissionsSchema) {
        schemas.push(normalizePermissionsSchema(r.permissionsSchema));
      }
    });

    return schemas.length > 0 ? mergePermissionsSchemas(schemas) : getBlankPermissions();
  }, [selectedRoleIds, roles]);

  // Compute risk & capability metrics
  const metrics = React.useMemo(() => {
    return PermissionRegistryService.calculateRiskMetrics(simulatedSchema);
  }, [simulatedSchema]);

  // Filtered permission results
  const evaluatedCatalog = React.useMemo(() => {
    return CANONICAL_PERMISSIONS_CATALOG.map((perm) => {
      const isGranted = evaluatePermission(
        simulatedSchema,
        perm.section,
        perm.feature,
        perm.action
      );
      return { ...perm, isGranted };
    }).filter((perm) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        perm.name.toLowerCase().includes(q) ||
        perm.id.toLowerCase().includes(q) ||
        perm.description.toLowerCase().includes(q)
      );
    });
  }, [simulatedSchema, searchQuery]);

  const roleOptions = React.useMemo(
    () => roles.map((r) => ({ label: r.name, value: r.id })),
    [roles]
  );

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col justify-between bg-card border-l shadow-2xl z-[100]"
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Header */}
          <SheetHeader className="p-5 pb-4 border-b bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold">Access Simulator Sandbox</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Test combining multiple roles to preview effective capabilities and risk metrics
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Body */}
          <div className="p-5 space-y-5">
            {/* Role MultiSelect */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Select Roles to Combine
              </Label>
              <MultiSelect
                options={roleOptions}
                selected={selectedRoleIds}
                onChange={setSelectedRoleIds}
                placeholder="Choose roles to simulate..."
                className="w-full text-xs"
              />
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-4 gap-2">
              <Card className="border shadow-xs bg-muted/20 text-center p-2.5">
                <span className="text-[10px] text-muted-foreground block">Operations</span>
                <span className="text-lg font-bold text-foreground">
                  {metrics.capabilitySummary.operations}
                </span>
              </Card>
              <Card className="border shadow-xs bg-muted/20 text-center p-2.5">
                <span className="text-[10px] text-muted-foreground block">Finance</span>
                <span className="text-lg font-bold text-foreground">
                  {metrics.capabilitySummary.finance}
                </span>
              </Card>
              <Card className="border shadow-xs bg-muted/20 text-center p-2.5">
                <span className="text-[10px] text-muted-foreground block">Studios</span>
                <span className="text-lg font-bold text-foreground">
                  {metrics.capabilitySummary.studios}
                </span>
              </Card>
              <Card className="border shadow-xs bg-muted/20 text-center p-2.5">
                <span className="text-[10px] text-muted-foreground block">Management</span>
                <span className="text-lg font-bold text-foreground">
                  {metrics.capabilitySummary.management}
                </span>
              </Card>
            </div>

            {/* Risk Breakdown */}
            <div className="p-3 rounded-xl border bg-card/60 flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground">Risk Profile:</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] bg-muted">
                  Low: {metrics.riskBreakdown.low}
                </Badge>
                <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                  Med: {metrics.riskBreakdown.medium}
                </Badge>
                <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                  High: {metrics.riskBreakdown.high}
                </Badge>
                <Badge variant="outline" className="text-[9px] bg-rose-500/10 text-rose-600 border-rose-500/30 font-bold">
                  Critical: {metrics.riskBreakdown.critical}
                </Badge>
              </div>
            </div>

            {/* Permissions Granted vs Denied List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Capability Grants ({evaluatedCatalog.filter((p) => p.isGranted).length} Granted / {evaluatedCatalog.filter((p) => !p.isGranted).length} Denied)
                </Label>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter evaluated capabilities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8.5 text-xs bg-muted/20 border-border"
                />
              </div>

              <div className="border rounded-xl divide-y max-h-80 overflow-y-auto bg-card">
                {evaluatedCatalog.map((perm) => (
                  <div
                    key={perm.id}
                    className="p-2.5 flex items-center justify-between gap-3 hover:bg-muted/10 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground truncate">{perm.name}</span>
                        <span className="text-[9px] font-mono text-muted-foreground uppercase">
                          ({perm.section})
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{perm.description}</p>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {perm.isGranted ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[9px] gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Granted
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[9px] gap-1 opacity-60">
                          <XCircle className="w-3 h-3" /> Denied
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedRoleIds([])}
            className="text-xs h-9 text-muted-foreground active:scale-[0.97]"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Clear Roles
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
          >
            Close Simulator
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default AccessSimulatorSheet;
