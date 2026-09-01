'use client';

/**
 * @fileOverview Separation of Duties (SoD) Rule & Conflict Manager (Governance 2.0)
 *
 * Configures toxic role pairing rules and scans the organization for conflicting privilege combinations.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Dialog with Emil Kowalski spring easing (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  ShieldAlert,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Scan,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SeparationOfDutyRule, SoDConflict, SoDRuleSeverity, Role } from '@/lib/types';
import {
  listSoDRulesAction,
  createOrUpdateSoDRuleAction,
  deleteSoDRuleAction,
  scanSoDConflictsAction,
} from '@/app/actions/governance-actions';

interface SoDRulesManagerProps {
  roles: Role[];
}

export function SoDRulesManager({ roles }: SoDRulesManagerProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [rules, setRules] = React.useState<SeparationOfDutyRule[]>([]);
  const [conflicts, setConflicts] = React.useState<SoDConflict[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = React.useState(false);
  const [ruleName, setRuleName] = React.useState('');
  const [ruleDesc, setRuleDesc] = React.useState('');
  const [roleA, setRoleA] = React.useState('');
  const [roleB, setRoleB] = React.useState('');
  const [severity, setSeverity] = React.useState<SoDRuleSeverity>('high');
  const [mode, setMode] = React.useState<'block' | 'warn'>('block');
  const [isSaving, setIsSaving] = React.useState(false);

  const loadRules = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await listSoDRulesAction({ idToken, organizationId: activeOrganizationId });
      if (res.success) {
        setRules(res.rules);
      }
    } catch (err: unknown) {
      console.warn('[SoDRulesManager] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId]);

  React.useEffect(() => {
    loadRules();
  }, [loadRules]);

  // Run Conflict Scan
  const handleScanConflicts = async () => {
    if (!authUser || !activeOrganizationId) return;

    setIsScanning(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await scanSoDConflictsAction({ idToken, organizationId: activeOrganizationId });

      if (res.success) {
        setConflicts(res.conflicts);
        toast({
          title: 'SoD Conflict Scan Complete',
          description: `Detected ${res.conflicts.length} toxic role pairing conflicts.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      toast({ title: 'Scan Error', description: msg, variant: 'destructive' });
    } finally {
      setIsScanning(false);
    }
  };

  // Save Rule
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !activeOrganizationId) return;

    if (!ruleName.trim() || !roleA || !roleB) {
      toast({ title: 'Validation Error', description: 'Please fill in all rule fields.', variant: 'destructive' });
      return;
    }
    if (roleA === roleB) {
      toast({ title: 'Validation Error', description: 'Rule must specify two distinct roles.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const idToken = await authUser.getIdToken();
      const roleObjA = roles.find((r) => r.id === roleA);
      const roleObjB = roles.find((r) => r.id === roleB);

      const res = await createOrUpdateSoDRuleAction({
        idToken,
        organizationId: activeOrganizationId,
        data: {
          name: ruleName.trim(),
          description: ruleDesc.trim(),
          roleIdA: roleA,
          roleNameA: roleObjA?.name || roleA,
          roleIdB: roleB,
          roleNameB: roleObjB?.name || roleB,
          severity,
          enforcementMode: mode,
        },
      });

      if (res.success) {
        toast({ title: 'SoD Rule Created' });
        setModalOpen(false);
        setRuleName('');
        setRuleDesc('');
        loadRules();
      } else {
        throw new Error(res.error || 'Failed to save rule');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast({ title: 'Save Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Rule
  const handleDeleteRule = async (ruleId: string, name: string) => {
    if (!authUser || !activeOrganizationId) return;

    const ok = await confirm({
      title: `Delete SoD Rule '${name}'?`,
      description: 'Toxic role combination check will no longer be enforced.',
      confirmText: 'Delete Rule',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const idToken = await authUser.getIdToken();
      const res = await deleteSoDRuleAction({
        idToken,
        organizationId: activeOrganizationId,
        ruleId,
      });

      if (res.success) {
        toast({ title: 'Rule Deleted' });
        loadRules();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      toast({ title: 'Delete Failed', description: msg, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Separation of Duties (SoD) Guardrails</h3>
            <p className="text-xs text-muted-foreground">
              Prevent toxic role combinations and audit toxic privilege pairings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleScanConflicts}
            disabled={isScanning}
            className="text-xs h-8.5 px-3 active:scale-[0.97]"
          >
            <Scan className={cn('w-3.5 h-3.5 mr-1.5', isScanning && 'animate-spin')} /> Run Conflict Scan
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="text-xs h-8.5 px-3.5 font-semibold active:scale-[0.97]"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add SoD Rule
          </Button>
        </div>
      </div>

      {/* Conflict Scanner Results Banner */}
      {conflicts.length > 0 && (
        <Card className="border-rose-500/30 bg-rose-500/5 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              <CardTitle className="text-sm font-bold text-rose-700 dark:text-rose-400">
                Detected {conflicts.length} Toxic Role Pairing Conflicts
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              The following members hold conflicting permissions that violate organizational security guardrails
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2 text-xs">
            <div className="divide-y divide-border/40">
              {conflicts.map((c, i) => (
                <div key={i} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground">{c.personName}</span>
                    <span className="text-muted-foreground block">
                      Violates rule &quot;{c.ruleName}&quot;: Holds both <strong className="text-foreground">{c.conflictingRoleNames[0]}</strong> and <strong className="text-foreground">{c.conflictingRoleNames[1]}</strong>
                    </span>
                  </div>
                  <Badge variant="destructive" className="text-[9px] uppercase tracking-wider w-fit">
                    {c.severity} Severity
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rules.length > 0 ? (
          rules.map((r) => (
            <Card key={r.id} className="border bg-card shadow-xs hover:border-primary/40 transition-all">
              <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold">{r.name}</CardTitle>
                    <Badge
                      variant={r.severity === 'critical' || r.severity === 'high' ? 'destructive' : 'outline'}
                      className="text-[9px] uppercase tracking-wider"
                    >
                      {r.severity}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs line-clamp-1">{r.description}</CardDescription>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteRule(r.id, r.name)}
                  className="h-7 w-7 text-muted-foreground hover:text-rose-500 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </CardHeader>

              <CardContent className="p-4 pt-2 space-y-2 text-xs border-t bg-muted/5">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Incompatible Roles:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">{r.roleNameA}</Badge>
                    <span className="text-muted-foreground font-bold">+</span>
                    <Badge variant="secondary" className="text-[10px]">{r.roleNameB}</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between text-muted-foreground pt-1 border-t">
                  <span>Enforcement Mode:</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {r.enforcementMode}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full p-12 text-center border rounded-xl bg-muted/10 text-xs text-muted-foreground">
            No Separation of Duties rules defined. Click &quot;Add SoD Rule&quot; to establish toxic role boundaries.
          </div>
        )}
      </div>

      {/* Modal: Create SoD Rule */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border shadow-2xl">
          <form onSubmit={handleSaveRule}>
            <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
              <DialogTitle className="text-base font-bold">Add Separation of Duties Constraint</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Define two incompatible roles that cannot be assigned to the same user
              </DialogDescription>
            </DialogHeader>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Rule Name</Label>
                <Input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Incompatible: Billing Officer + Payout Approver"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">First Role (Role A)</Label>
                  <Select value={roleA} onValueChange={setRoleA}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Role A..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id} className="text-xs">
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Second Role (Role B)</Label>
                  <Select value={roleB} onValueChange={setRoleB}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Role B..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id} className="text-xs">
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Severity</Label>
                  <Select value={severity} onValueChange={(v) => setSeverity(v as SoDRuleSeverity)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical" className="text-xs">Critical</SelectItem>
                      <SelectItem value="high" className="text-xs">High</SelectItem>
                      <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                      <SelectItem value="low" className="text-xs">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Enforcement Action</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as 'block' | 'warn')}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="block" className="text-xs">Strictly Block Assignment</SelectItem>
                      <SelectItem value="warn" className="text-xs">Warn with Justification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Description</Label>
                <Textarea
                  value={ruleDesc}
                  onChange={(e) => setRuleDesc(e.target.value)}
                  placeholder="Security rationale for separating these roles..."
                  className="text-xs min-h-[60px]"
                />
              </div>
            </div>

            <DialogFooter className="p-4 border-t bg-muted/20 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={isSaving}
                className="text-xs h-9 px-4 active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving || !ruleName.trim() || !roleA || !roleB}
                className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...
                  </>
                ) : (
                  'Create SoD Rule'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SoDRulesManager;
