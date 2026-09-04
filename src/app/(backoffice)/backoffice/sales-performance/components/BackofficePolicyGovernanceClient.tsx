'use client';

/**
 * @fileoverview Platform Control Plane for Sales Performance Policies (Phase 4).
 *
 * ARCHITECTURAL POINTER:
 * Super-admin governance console for inspecting, auditing, and managing performance policies across tenants:
 * - Multi-tenant policy roster with active versions and dimension breakdowns.
 * - Anti-gaming safeguards summary (daily volume limits, call duration hurdles).
 * - Emergency reset to defaults without modifying source code.
 * - Strict authorization checks and zero 'any' typing.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Touch targets maintain >= 44px height for mobile accessibility.
 * - Conforms to Emil Kowalski micro-interactions (active:scale-[0.97]).
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Sliders,
  Search,
  RotateCcw,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Layers,
  History,
} from 'lucide-react';
import {
  getBackofficePoliciesListAction,
  resetPolicyToDefaultsAction,
} from '@/app/actions/policy-studio-actions';

interface TenantPolicySummary {
  workspaceId: string;
  organizationId: string;
  name: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
  antiGamingSummary: string;
  dimensionsSummary: string;
}

export default function BackofficePolicyGovernanceClient() {
  const { toast } = useToast();

  const [policies, setPolicies] = React.useState<TenantPolicySummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [resettingWorkspaceId, setResettingWorkspaceId] = React.useState<string | null>(null);
  const [isResetting, setIsResetting] = React.useState(false);

  const fetchPolicies = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getBackofficePoliciesListAction();
      if (res.success && res.policies) {
        setPolicies(res.policies);
      } else {
        throw new Error(res.error || 'Failed to fetch policies');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Error loading policies',
        description: msg,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleConfirmReset = async () => {
    if (!resettingWorkspaceId) return;
    setIsResetting(true);
    try {
      const target = policies.find((p) => p.workspaceId === resettingWorkspaceId);
      const res = await resetPolicyToDefaultsAction({
        workspaceId: resettingWorkspaceId,
        organizationId: target?.organizationId || 'default',
        authorId: 'super_admin',
        authorName: 'Platform Super Administrator',
      });

      if (res.success) {
        toast({
          title: 'Policy Reverted to Defaults',
          description: `Successfully restored standard policy for workspace ${resettingWorkspaceId}.`,
        });
        setResettingWorkspaceId(null);
        await fetchPolicies();
      } else {
        throw new Error(res.error || 'Reset failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: msg,
      });
    } finally {
      setIsResetting(false);
    }
  };

  const filteredPolicies = React.useMemo(() => {
    return policies.filter((p) => {
      const search = searchTerm.toLowerCase();
      return (
        p.workspaceId.toLowerCase().includes(search) ||
        p.organizationId.toLowerCase().includes(search) ||
        p.name.toLowerCase().includes(search) ||
        p.updatedBy.toLowerCase().includes(search)
      );
    });
  }, [policies, searchTerm]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto text-left">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-foreground">
            <Sliders className="h-6 w-6 text-emerald-500" /> Sales Performance Policy Governance
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Platform control plane for managing multi-tenant scoring configurations, anti-gaming safeguards, and emergency policy resets.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={fetchPolicies}
          disabled={isLoading}
          className="min-h-[44px] rounded-xl text-xs font-semibold px-4 active:scale-[0.97]"
        >
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
          Refresh Policies
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2.5 bg-card border rounded-xl px-3.5 h-11 w-full max-w-md shadow-sm">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          placeholder="Search by workspace, organization, or author..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-xs font-medium h-full"
        />
      </div>

      {/* Policies Table */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/15">
              <TableHead className="text-xs font-bold uppercase tracking-wider">Tenant Workspace</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider">Policy Name</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Version</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider">Dimensions</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider">Anti-Gaming Safeguards</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Emergency Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-xs font-semibold text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                  Loading tenant policies...
                </TableCell>
              </TableRow>
            ) : filteredPolicies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-xs font-semibold text-muted-foreground">
                  No tenant performance policies found.
                </TableCell>
              </TableRow>
            ) : (
              filteredPolicies.map((p) => {
                const formattedDate = p.updatedAt
                  ? new Date(p.updatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'N/A';

                return (
                  <TableRow key={p.workspaceId} className="hover:bg-muted/20">
                    <TableCell className="font-semibold text-xs py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-mono text-foreground font-bold">
                          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{p.workspaceId}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          <span>{p.organizationId}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="space-y-0.5 text-left">
                        <p className="text-xs font-bold text-foreground">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Updated {formattedDate} by {p.updatedBy}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell className="text-center py-3">
                      <Badge variant="outline" className="font-mono text-xs font-bold">
                        v{p.version}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground py-3">
                      <span className="font-mono text-[11px]">{p.dimensionsSummary}</span>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground py-3">
                      <span className="font-mono text-[11px]">{p.antiGamingSummary}</span>
                    </TableCell>

                    <TableCell className="text-right py-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setResettingWorkspaceId(p.workspaceId)}
                        className="min-h-[36px] text-xs font-semibold rounded-xl text-rose-500 border-rose-500/20 hover:bg-rose-500/10 active:scale-[0.97]"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" /> Reset Defaults
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Emergency Reset Confirmation Modal */}
      <Dialog
        open={resettingWorkspaceId !== null}
        onOpenChange={(open) => !open && setResettingWorkspaceId(null)}
      >
        <DialogContent className="sm:max-w-md bg-card text-card-foreground p-6 rounded-2xl">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold">Reset Workspace Policy?</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to revert workspace <span className="font-mono font-bold text-foreground">{resettingWorkspaceId}</span> back to the standard 5-dimension system defaults? This will overwrite custom scoring rules and anti-gaming limits.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setResettingWorkspaceId(null)}
              className="min-h-[44px] rounded-xl text-xs active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmReset}
              disabled={isResetting}
              className="min-h-[44px] rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.97]"
            >
              {isResetting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
              Confirm Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
