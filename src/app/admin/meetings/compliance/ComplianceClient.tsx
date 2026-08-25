'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck,
  Download,
  Trash2,
  Lock,
  FileSpreadsheet,
  AlertTriangle,
  Sparkles,
  HardDrive,
  Save,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  getWorkspaceCompliancePolicyAction,
  saveWorkspaceCompliancePolicyAction,
  exportMeetingAuditLogsAction,
  evaluateRetentionPurgeAction,
} from '@/app/actions/meeting-compliance-actions';
import type {
  CompliancePolicy,
  RetentionEvaluationResult,
} from '@/lib/meetings/types/compliance';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export function ComplianceClient() {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [policy, setPolicy] = React.useState<CompliancePolicy | null>(null);
  const [allowedDomainsInput, setAllowedDomainsInput] = React.useState('');
  const [blockedDomainsInput, setBlockedDomainsInput] = React.useState('');
  const [retentionDays, setRetentionDays] = React.useState('90');
  const [requirePasscode, setRequirePasscode] = React.useState(false);
  const [enforceConsent, setEnforceConsent] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // Retention evaluation
  const [retentionResult, setRetentionResult] = React.useState<RetentionEvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  const fetchPolicy = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await getWorkspaceCompliancePolicyAction(activeWorkspaceId);
      if (res.success && res.policy) {
        setPolicy(res.policy);
        setAllowedDomainsInput((res.policy.allowedEmailDomains || []).join(', '));
        setBlockedDomainsInput((res.policy.blockedEmailDomains || []).join(', '));
        setRetentionDays((res.policy.retentionPeriodDays || 0).toString());
        setRequirePasscode(Boolean(res.policy.requireMeetingPasscode));
        setEnforceConsent(Boolean(res.policy.enforceHostConsentForAI));
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to load compliance policy',
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, toast]);

  React.useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId) return;

    setIsSaving(true);
    try {
      const allowedEmailDomains = allowedDomainsInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const blockedEmailDomains = blockedDomainsInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const updated: CompliancePolicy = {
        workspaceId: activeWorkspaceId,
        allowedEmailDomains,
        blockedEmailDomains,
        retentionPeriodDays: parseInt(retentionDays, 10) || 0,
        requireMeetingPasscode: requirePasscode,
        enforceHostConsentForAI: enforceConsent,
        updatedAt: new Date().toISOString(),
      };

      const res = await saveWorkspaceCompliancePolicyAction(updated);
      if (res.success) {
        toast({ title: 'Compliance Policies Saved!' });
        fetchPolicy();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Save Failed', description: getErrorMessage(err) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = async () => {
    if (!activeWorkspaceId) return;
    setIsExporting(true);
    try {
      const res = await exportMeetingAuditLogsAction(activeWorkspaceId);
      if (res.success && res.csvContent) {
        const blob = new Blob([res.csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `smartsapp_meetings_audit_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({ title: 'Audit logs exported successfully!' });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Export Failed', description: getErrorMessage(err) });
    } finally {
      setIsExporting(false);
    }
  };

  const handleEvaluatePurge = async () => {
    if (!activeWorkspaceId) return;
    setIsEvaluating(true);
    try {
      const days = parseInt(retentionDays, 10) || 90;
      const res = await evaluateRetentionPurgeAction(activeWorkspaceId, days);
      if (res.success && res.result) {
        setRetentionResult(res.result);
        toast({ title: 'GDPR Retention Evaluated' });
      }
    } catch (err) {
      console.warn('[evaluate purge]', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48 rounded-xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Enterprise Compliance & Audit Exports
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure booking domain whitelists, GDPR data retention lifecycles, and export immutable CSV audit trails.
          </p>
        </div>

        <Button
          onClick={handleExportCSV}
          disabled={isExporting}
          className="rounded-xl min-h-[44px] gap-2 font-semibold shadow-sm active:scale-[0.97]"
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export Audit Logs (CSV)'}
        </Button>
      </div>

      <form onSubmit={handleSavePolicy} className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        {/* Card 1: Domain Whitelists & Access Controls */}
        <Card className="rounded-3xl border shadow-sm p-6 space-y-4">
          <CardHeader className="p-0 pb-2 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Booking Domain Whitelist & Blacklist
            </CardTitle>
            <CardDescription className="text-xs">
              Restrict who can schedule sessions on your public booking links.
            </CardDescription>
          </CardHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="font-semibold">Allowed Email Domains (Comma separated)</Label>
              <Input
                value={allowedDomainsInput}
                onChange={e => setAllowedDomainsInput(e.target.value)}
                placeholder="@school.edu, @acme.com (leave empty for open access)"
                className="rounded-xl text-xs h-10"
              />
              <p className="text-[10px] text-muted-foreground">Only contacts with these email domains will be allowed to book.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Blocked Email Domains (Comma separated)</Label>
              <Input
                value={blockedDomainsInput}
                onChange={e => setBlockedDomainsInput(e.target.value)}
                placeholder="@tempmail.com, @throwaway.net"
                className="rounded-xl text-xs h-10"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Require Meeting Passcode</Label>
                <p className="text-[10px] text-muted-foreground">Enforce random passcodes for guest entry</p>
              </div>
              <Switch checked={requirePasscode} onCheckedChange={setRequirePasscode} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Enforce Host Consent for AI Briefs</Label>
                <p className="text-[10px] text-muted-foreground">Require host confirmation before AI intelligence generation</p>
              </div>
              <Switch checked={enforceConsent} onCheckedChange={setEnforceConsent} />
            </div>
          </div>
        </Card>

        {/* Card 2: GDPR / HIPAA Data Retention */}
        <Card className="rounded-3xl border shadow-sm p-6 space-y-4">
          <CardHeader className="p-0 pb-2 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              GDPR / HIPAA Data Retention Policy
            </CardTitle>
            <CardDescription className="text-xs">
              Automatically purge old recordings and transcripts beyond compliance window.
            </CardDescription>
          </CardHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-semibold">Retention Period (Days)</Label>
              <Input
                type="number"
                value={retentionDays}
                onChange={e => setRetentionDays(e.target.value)}
                placeholder="90"
                className="rounded-xl text-xs h-10"
              />
              <p className="text-[10px] text-muted-foreground">
                Enter 0 to retain indefinitely. Minimum safety floor is 30 days. Pinned recordings are exempt.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-muted/30 border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Dry-Run Retention Purge Simulator</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleEvaluatePurge}
                  disabled={isEvaluating}
                  className="rounded-xl h-8 text-xs active:scale-[0.97]"
                >
                  {isEvaluating ? 'Evaluating...' : 'Simulate Purge'}
                </Button>
              </div>

              {retentionResult && (
                <div className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t">
                  <p>
                    Eligible for purge: <strong>{retentionResult.eligibleMeetingIds.length}</strong> meetings
                  </p>
                  <p>
                    Recordings: <strong>{retentionResult.eligibleRecordingsCount}</strong> | Transcripts: <strong>{retentionResult.eligibleTranscriptsCount}</strong>
                  </p>
                  <p className="text-emerald-600 font-semibold">
                    Estimated storage freed: ~{retentionResult.estimatedStorageFreedMb} MB
                  </p>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-xl min-h-[44px] text-xs font-semibold gap-2 active:scale-[0.97]"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving Policies...' : 'Save Compliance Policies'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
