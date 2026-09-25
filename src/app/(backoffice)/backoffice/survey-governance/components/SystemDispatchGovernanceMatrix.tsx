'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Backoffice Global Dispatch & Blast Governance Matrix
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Control-Plane Dispatch Governance: Governs volume safeguards, rate limiting, and domain verification without code edits.
 * 2. Mobile Ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press.
 * 3. Strict Zero-Any Invariant: Strictly typed configuration interfaces and callbacks.
 */

import * as React from 'react';
import type { SystemDispatchGovernanceConfig } from '@/lib/surveys/survey-campaign-actions';
import {
  getSystemDispatchGovernanceAction,
  saveSystemDispatchGovernanceAction,
} from '@/lib/surveys/survey-campaign-actions';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  Save,
  ShieldCheck,
  Zap,
  Lock,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

export function SystemDispatchGovernanceMatrix() {
  const { toast } = useToast();

  const [config, setConfig] = React.useState<SystemDispatchGovernanceConfig>({
    highVolumeThreshold: 50,
    rateLimitThroughput: 30,
    requireImmediateConfirmation: true,
    enforceVerifiedDomain: false,
    enableAuditLogging: true,
    defaultSenderAlias: 'SmartSapp Notifications',
  });

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const fetchConfig = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getSystemDispatchGovernanceAction();
      if (res.success && res.config) {
        setConfig(res.config);
      }
    } catch (err: unknown) {
      console.error('[SystemDispatchGovernanceMatrix] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveSystemDispatchGovernanceAction(config);
      if (res.success) {
        toast({
          title: 'Dispatch Governance Saved',
          description: 'Global volume thresholds, rate limits, and gateway policies updated.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: res.error || 'Failed to update dispatch governance',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while saving governance settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-semibold">Loading Global Dispatch Governance...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Dispatch &amp; Blast Governance Matrix
          </h2>
          <p className="text-xs text-muted-foreground">
            Configure system-wide message throttling, blast safeguards, and gateway delivery standards across all tenants.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="h-11 px-6 rounded-xl font-bold text-xs gap-2 shadow-md active:scale-[0.97] transition-all bg-primary text-white"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Dispatch Policies
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── CARD 1: Blast Volume Safeguards ── */}
        <Card className="rounded-2xl border border-border/80 shadow-xs">
          <CardHeader className="bg-muted/10 border-b border-border/60 p-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Volume Safeguards &amp; Confirmations</CardTitle>
                <CardDescription className="text-xs">
                  Govern safeguard prompts that trigger before large-scale message dispatches.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            {/* Threshold Slider / Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">High-Volume Modal Threshold</Label>
                <Badge variant="outline" className="font-mono text-xs font-bold text-amber-600 border-amber-500/30">
                  {config.highVolumeThreshold} recipients
                </Badge>
              </div>
              <Input
                type="number"
                min={10}
                max={1000}
                step={5}
                value={config.highVolumeThreshold}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    highVolumeThreshold: Math.max(10, parseInt(e.target.value) || 10),
                  }))
                }
                className="h-11 rounded-xl text-xs font-semibold"
              />
              <p className="text-[11px] text-muted-foreground">
                Dispatches exceeding this recipient count will mandate an explicit confirmation modal before execution.
              </p>
            </div>

            {/* Require Immediate Confirmation Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/20 border border-border/50">
              <div className="space-y-0.5 pr-4">
                <Label className="text-xs font-bold">Mandate Immediate Blast Safeguard</Label>
                <p className="text-[11px] text-muted-foreground">
                  Always require users to confirm immediate broadcasts when threshold is reached.
                </p>
              </div>
              <Switch
                checked={config.requireImmediateConfirmation}
                onCheckedChange={(val) =>
                  setConfig((prev) => ({ ...prev, requireImmediateConfirmation: val }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* ── CARD 2: Gateway Rate Limits & Throughput ── */}
        <Card className="rounded-2xl border border-border/80 shadow-xs">
          <CardHeader className="bg-muted/10 border-b border-border/60 p-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Throughput &amp; Rate Limits</CardTitle>
                <CardDescription className="text-xs">
                  Protect gateway IPs and provider accounts against spam throttling.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            {/* Rate limit input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Max Dispatch Rate (msgs/sec)</Label>
                <Badge variant="outline" className="font-mono text-xs font-bold text-emerald-600 border-emerald-500/30">
                  {config.rateLimitThroughput} msgs/s
                </Badge>
              </div>
              <Input
                type="number"
                min={5}
                max={100}
                step={5}
                value={config.rateLimitThroughput}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    rateLimitThroughput: Math.max(5, parseInt(e.target.value) || 5),
                  }))
                }
                className="h-11 rounded-xl text-xs font-semibold"
              />
              <p className="text-[11px] text-muted-foreground">
                Batch chunks will be sliced according to this rate limit to ensure high deliverability and avoid provider 429 errors.
              </p>
            </div>

            {/* Enforce Verified Domain */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/20 border border-border/50">
              <div className="space-y-0.5 pr-4">
                <Label className="text-xs font-bold">Enforce Verified Sender Domains</Label>
                <p className="text-[11px] text-muted-foreground">
                  Block dispatches from unverified email domains to protect domain reputation.
                </p>
              </div>
              <Switch
                checked={config.enforceVerifiedDomain}
                onCheckedChange={(val) =>
                  setConfig((prev) => ({ ...prev, enforceVerifiedDomain: val }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* ── CARD 3: Audit Logging & Default Alias ── */}
        <Card className="rounded-2xl border border-border/80 shadow-xs lg:col-span-2">
          <CardHeader className="bg-muted/10 border-b border-border/60 p-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Compliance, Auditing &amp; Defaults</CardTitle>
                <CardDescription className="text-xs">
                  Configure default organization branding and compliance audit trails.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Global Fallback Sender Name</Label>
              <Input
                type="text"
                value={config.defaultSenderAlias || ''}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, defaultSenderAlias: e.target.value }))
                }
                placeholder="SmartSapp Notifications"
                className="h-11 rounded-xl text-xs font-semibold"
              />
              <p className="text-[11px] text-muted-foreground">
                Fallback sender alias when an individual survey or campaign lacks a custom profile name.
              </p>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/20 border border-border/50 h-fit self-end">
              <div className="space-y-0.5 pr-4">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-blue-600" />
                  Mandatory Audit Logging
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Record all dispatch payloads, sender profiles, and timestamps to the system audit stream.
                </p>
              </div>
              <Switch
                checked={config.enableAuditLogging}
                onCheckedChange={(val) =>
                  setConfig((prev) => ({ ...prev, enableAuditLogging: val }))
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
