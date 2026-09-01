'use client';

/**
 * @fileOverview Least-Privilege & Permission Utilization Heatmap (Analytics 2.0)
 *
 * Identifies over-privileged roles and dormant permissions based on 90-day action telemetry.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Highlights permissions with 0 action executions to guide Phase 5 Access Certification Reviews.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ShieldAlert, Sparkles, Flame, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Role } from '@/lib/types';

interface LeastPrivilegeRoleReport {
  roleId: string;
  roleName: string;
  totalPermissions: number;
  usedPermissions: number;
  dormantPermissions: number;
  utilizationRate: number;
  records: Array<{
    id: string;
    organizationId: string;
    roleId: string;
    roleName: string;
    permissionId: string;
    actionCount90d: number;
    lastUsedAt?: string;
    isDormant: boolean;
  }>;
}

interface LeastPrivilegeHeatmapProps {
  rolesReport: LeastPrivilegeRoleReport[];
  isLoading: boolean;
}

export function LeastPrivilegeHeatmap({
  rolesReport,
  isLoading,
}: LeastPrivilegeHeatmapProps) {
  const [selectedRoleId, setSelectedRoleId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (rolesReport.length > 0 && !selectedRoleId) {
      setSelectedRoleId(rolesReport[0].roleId);
    }
  }, [rolesReport, selectedRoleId]);

  const currentRole = rolesReport.find((r) => r.roleId === selectedRoleId);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rolesReport.map((role) => (
          <Card
            key={role.roleId}
            onClick={() => setSelectedRoleId(role.roleId)}
            className={cn(
              'border bg-card shadow-xs cursor-pointer transition-all hover:border-primary/50',
              selectedRoleId === role.roleId && 'border-primary ring-1 ring-primary'
            )}
          >
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-foreground">{role.roleName}</CardTitle>
                <Badge
                  variant={role.utilizationRate < 50 ? 'destructive' : 'outline'}
                  className="text-[9px] uppercase tracking-wider"
                >
                  {role.utilizationRate}% Utilized
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {role.usedPermissions} of {role.totalPermissions} permissions executed in last 90d
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <Progress value={role.utilizationRate} className="h-1.5" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Selected Role Permissions Breakdown */}
      {currentRole && (
        <Card className="border bg-card shadow-xs overflow-hidden">
          <CardHeader className="p-4 pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" />
                <CardTitle className="text-sm font-bold">
                  Permission Usage Matrix: {currentRole.roleName}
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Review active vs dormant permissions to enforce least-privilege principles
              </CardDescription>
            </div>

            {currentRole.dormantPermissions > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                {currentRole.dormantPermissions} Dormant Permissions Identified
              </Badge>
            )}
          </CardHeader>

          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {currentRole.records.map((rec) => (
                <div
                  key={rec.permissionId}
                  className={cn(
                    'p-3 rounded-lg border transition-all flex flex-col justify-between gap-2',
                    rec.actionCount90d > 0
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-muted/10 border-border/60'
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-bold text-foreground text-[11px] truncate">
                        {rec.permissionId}
                      </span>
                      {rec.actionCount90d > 0 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Badge variant="outline" className="text-[8px] uppercase tracking-wider text-muted-foreground">
                          Dormant
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {rec.actionCount90d > 0
                        ? `Executed ${rec.actionCount90d} times in last 90 days`
                        : '0 executions recorded in last 90 days'}
                    </p>
                  </div>

                  <div className="text-[9px] text-muted-foreground pt-1 border-t flex justify-between">
                    <span>Last Used:</span>
                    <span className="font-mono">
                      {rec.lastUsedAt ? new Date(rec.lastUsedAt).toLocaleDateString() : 'Never'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default LeastPrivilegeHeatmap;
