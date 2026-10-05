'use client';

/**
 * @fileoverview Enterprise Compliance, GDPR Retention & Audit Exports for SmartSapp Meetings 2.0.
 *
 * ARCHITECTURE & DESIGN SYSTEM ALIGNMENT:
 * - Strictly conforms to theme.md §8 (Standardized header taxonomy, zero raw descriptions).
 * - Universal <CardInfoTooltip> beside titles with sr-only <CardDescription>.
 * - Mobile touch targets >= 44px (or responsive sm:min-h-[36px]/[38px]).
 * - Rounded-2xl card surfaces with high-contrast border definition.
 * - Zero 'any' policy strictly enforced.
 * - Phase 11 M1 · T8: auto-purge toggles + retention mode (preview only / delete on schedule).
 *   Changes that can delete more data need a confirmation bound to the exact preview (Rules 21/22);
 *   saves send the version the page loaded so concurrent edits are refused (Rule 18).
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck,
  Download,
  Lock,
  HardDrive,
  Save,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  getWorkspaceCompliancePolicyAction,
  saveWorkspaceCompliancePolicyAction,
  exportMeetingAuditLogsAction,
  evaluateRetentionPurgeAction,
  previewRetentionImpactAction,
} from '@/app/actions/meeting-compliance-actions';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

  const [_policy, setPolicy] = React.useState<CompliancePolicy | null>(null);
  const [allowedDomainsInput, setAllowedDomainsInput] = React.useState('');
  const [blockedDomainsInput, setBlockedDomainsInput] = React.useState('');
  const [retentionDays, setRetentionDays] = React.useState('90');
  const [requirePasscode, setRequirePasscode] = React.useState(false);
  const [enforceConsent, setEnforceConsent] = React.useState(false);
  const [autoPurgeTranscripts, setAutoPurgeTranscripts] = React.useState(false);
  const [autoPurgeRecordings, setAutoPurgeRecordings] = React.useState(false);
  const [enforceRetention, setEnforceRetention] = React.useState(false);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = React.useState<string | undefined>(undefined);
  const [impact, setImpact] = React.useState<{ meetings: number; transcripts: number; recordings: number; truncated: boolean; candidateSetHash: string } | null>(null);
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
        setAutoPurgeTranscripts(Boolean(res.policy.autoPurgeTranscripts));
        setAutoPurgeRecordings(Boolean(res.policy.autoPurgeRecordings));
        setEnforceRetention(res.policy.retentionMode === 'enforced');
        // A stored policy has a real updatedAt; the default (unsaved) policy does not need one.
        setLoadedUpdatedAt(res.policy.updatedBy ? res.policy.updatedAt : undefined);
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

  const buildPolicy = (): CompliancePolicy => ({
    workspaceId: activeWorkspaceId ?? '',
    allowedEmailDomains: allowedDomainsInput.split(',').map(s => s.trim()).filter(Boolean),
    blockedEmailDomains: blockedDomainsInput.split(',').map(s => s.trim()).filter(Boolean),
    retentionPeriodDays: parseInt(retentionDays, 10) || 0,
    autoPurgeTranscripts,
    autoPurgeRecordings,
    retentionMode: enforceRetention ? 'enforced' : 'shadow',
    requireMeetingPasscode: requirePasscode,
    enforceHostConsentForAI: enforceConsent,
    updatedAt: new Date().toISOString(),
  });

  const save = async (confirmedImpactHash?: string) => {
    if (!activeWorkspaceId) return;
    setIsSaving(true);
    try {
      const res = await saveWorkspaceCompliancePolicyAction(buildPolicy(), { expectedUpdatedAt: loadedUpdatedAt, confirmedImpactHash });
      if (res.success) {
        setImpact(null);
        toast({ title: 'Settings saved' });
        fetchPolicy();
      } else if (res.code === 'IMPACT_NOT_CONFIRMED') {
        // Show exactly what would be removed; the save is bound to this preview.
        const preview = await previewRetentionImpactAction(activeWorkspaceId, {
          retentionPeriodDays: parseInt(retentionDays, 10) || 0,
          autoPurgeTranscripts,
          autoPurgeRecordings,
        });
        if (!preview.success || !preview.preview) throw new Error(preview.error || 'Could not prepare the preview.');
        setImpact(preview.preview);
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Save Failed', description: getErrorMessage(err) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    await save();
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
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Evaluation Failed', description: getErrorMessage(err) });
    } finally {
      setIsEvaluating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with CardInfoTooltip (zero raw descriptions) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Enterprise Compliance & Audit Exports
          </h2>
          <CardInfoTooltip text="Configure booking domain whitelists, GDPR data retention lifecycles, and export immutable CSV audit trails." />
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
        <Card className="rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm p-6 space-y-4">
          <CardHeader className="p-0 pb-3 border-b border-border/80 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold text-foreground">
                Booking Domain Whitelist & Blacklist
              </CardTitle>
            </div>
            <CardInfoTooltip text="Restrict who can schedule sessions on your public booking links by allowing or blocking specific email domains." />
            <CardDescription className="sr-only">
              Restrict who can schedule sessions on your public booking links.
            </CardDescription>
          </CardHeader>

          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground">Allowed Email Domains (Comma separated)</Label>
              <Input
                value={allowedDomainsInput}
                onChange={e => setAllowedDomainsInput(e.target.value)}
                placeholder="@school.edu, @acme.com (leave empty for open access)"
                className="rounded-xl text-xs min-h-[44px] sm:min-h-[36px]"
              />
              <p className="text-[10px] text-muted-foreground">Only contacts with these email domains will be allowed to book.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground">Blocked Email Domains (Comma separated)</Label>
              <Input
                value={blockedDomainsInput}
                onChange={e => setBlockedDomainsInput(e.target.value)}
                placeholder="@tempmail.com, @throwaway.net"
                className="rounded-xl text-xs min-h-[44px] sm:min-h-[36px]"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/80">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold text-foreground">Require Meeting Passcode</Label>
                <p className="text-[10px] text-muted-foreground">Enforce random passcodes for guest entry</p>
              </div>
              <Switch checked={requirePasscode} onCheckedChange={setRequirePasscode} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/80">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold text-foreground">Require meeting consent</Label>
                <p className="text-[10px] text-muted-foreground">Record consent before transcription and AI analysis</p>
              </div>
              <Switch checked={enforceConsent} onCheckedChange={setEnforceConsent} />
            </div>
          </div>
        </Card>

        {/* Card 2: GDPR / HIPAA Data Retention */}
        <Card className="rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm p-6 space-y-4">
          <CardHeader className="p-0 pb-3 border-b border-border/80 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold text-foreground">
                GDPR / HIPAA Data Retention Policy
              </CardTitle>
            </div>
            <CardInfoTooltip text="Automatically purge old recordings and transcripts beyond compliance window to comply with GDPR and HIPAA." />
            <CardDescription className="sr-only">
              Automatically purge old recordings and transcripts beyond compliance window.
            </CardDescription>
          </CardHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="font-semibold text-foreground">Retention Period (Days)</Label>
              <Input
                type="number"
                value={retentionDays}
                onChange={e => setRetentionDays(e.target.value)}
                placeholder="90"
                className="rounded-xl text-xs min-h-[44px] sm:min-h-[36px]"
              />
              <p className="text-[10px] text-muted-foreground">
                Enter 0 to retain indefinitely. Minimum safety floor is 30 days. Pinned recordings are exempt.
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between min-h-[44px]">
                <Label className="text-xs font-semibold text-foreground">Remove old transcripts</Label>
                <Switch checked={autoPurgeTranscripts} onCheckedChange={setAutoPurgeTranscripts} />
              </div>
              <div className="flex items-center justify-between min-h-[44px]">
                <Label className="text-xs font-semibold text-foreground">Remove old recordings</Label>
                <Switch checked={autoPurgeRecordings} onCheckedChange={setAutoPurgeRecordings} />
              </div>
              <div className="flex items-center justify-between min-h-[44px] border-t border-border/80 pt-2">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-foreground">Delete on schedule</Label>
                  <p className="text-[10px] text-muted-foreground">Off: preview only, nothing is deleted. Legal holds are never removed.</p>
                </div>
                <Switch checked={enforceRetention} onCheckedChange={setEnforceRetention} />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Preview what would be removed</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleEvaluatePurge}
                  disabled={isEvaluating}
                  className="rounded-xl min-h-[36px] text-xs px-3 active:scale-[0.97]"
                >
                  {isEvaluating ? 'Checking...' : 'Preview'}
                </Button>
              </div>

              {retentionResult && (
                <div className="text-[11px] text-muted-foreground space-y-1 pt-2 border-t border-border/80">
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

      <AlertDialog open={impact !== null} onOpenChange={(open) => { if (!open) setImpact(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete old meeting data on schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              {impact
                ? `The next run will remove ${impact.transcripts} transcript${impact.transcripts === 1 ? '' : 's'} and ${impact.recordings} recording${impact.recordings === 1 ? '' : 's'} from ${impact.meetings} meeting${impact.meetings === 1 ? '' : 's'}${impact.truncated ? ' (first batch; more later)' : ''}. This can't be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl min-h-[44px]" disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl min-h-[44px] bg-destructive text-destructive-foreground"
              disabled={isSaving}
              onClick={(e) => { e.preventDefault(); if (impact) void save(impact.candidateSetHash); }}
            >
              {isSaving ? 'Saving…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
