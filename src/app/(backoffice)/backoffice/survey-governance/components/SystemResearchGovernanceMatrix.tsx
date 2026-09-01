'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Backoffice Global Research & Retention Governance Matrix
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Control-Plane Research Governance: Global PII retention thresholds, sample sizes, and experiment rules.
 * 2. Mobile Ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press.
 * 3. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import type { SystemResearchGovernanceConfig } from '@/lib/types';
import {
  getSystemResearchGovernanceAction,
  saveSystemResearchGovernanceAction,
} from '@/lib/surveys/survey-retention-actions';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert,
  Save,
  CheckCircle2,
  Lock,
  Layers,
  FlaskConical,
  Scale,
  RefreshCw,
  Loader2,
  Calendar,
  Sparkles,
} from 'lucide-react';

export function SystemResearchGovernanceMatrix() {
  const { toast } = useToast();

  const [config, setConfig] = React.useState<SystemResearchGovernanceConfig>({
    minSampleSizeForSignificance: 30,
    defaultAnonymizePiiDays: 90,
    allowHardDelete: true,
    requireAuditLogging: true,
    maxActiveExperimentsPerWorkspace: 10,
  });

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const fetchConfig = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getSystemResearchGovernanceAction();
      if (res.success && res.config) {
        setConfig(res.config);
      }
    } catch (err) {
      console.error('[SystemResearchGovernanceMatrix] Fetch error:', err);
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
      const res = await saveSystemResearchGovernanceAction(config);
      if (res.success) {
        toast({
          title: 'Research Governance Saved',
          description: 'Global research thresholds and data retention policies updated.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: res.error || 'Failed to update research governance',
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
        <p className="text-xs text-muted-foreground font-semibold">Loading Global Research Governance...</p>
      </div>
    );
  }

  return (
    <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden text-left">
      <CardHeader className="pb-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Research & Data Retention Governance Control Matrix
                <Badge variant="outline" className="text-[10px] font-mono text-purple-600 border-purple-300">
                  Phase 8
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Enforce organization-wide research sample thresholds, statistical confidence standards, and PII retention policies.
              </CardDescription>
            </div>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="h-9 px-4 gap-1.5 text-xs font-semibold active:scale-[0.97]"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Governance Baseline
        </Button>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1: Statistical Research Standards */}
          <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Statistical Research Standards
              </span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Minimum Sample Size for Statistical Significance ($N$)</Label>
                <Input
                  type="number"
                  value={config.minSampleSizeForSignificance}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      minSampleSizeForSignificance: Number(e.target.value) || 30,
                    }))
                  }
                  className="h-9 text-xs rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  Minimum number of completed wave submissions required before declaring statistically significant delta ($p &lt; 0.05$).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Max Active A/B Experiments per Workspace</Label>
                <Input
                  type="number"
                  value={config.maxActiveExperimentsPerWorkspace}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      maxActiveExperimentsPerWorkspace: Number(e.target.value) || 10,
                    }))
                  }
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Data Retention & Privacy Rules */}
          <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Data Retention & Privacy Enforcement
              </span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Default PII Anonymization Schedule (Days)</Label>
                <Input
                  type="number"
                  value={config.defaultAnonymizePiiDays}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      defaultAnonymizePiiDays: Number(e.target.value) || 90,
                    }))
                  }
                  className="h-9 text-xs rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  Responses older than this period will have contact names, emails, and phone numbers sanitized to protect respondent privacy.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold cursor-pointer">Allow Permanent Hard Purge</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Allow workspaces to configure automated permanent deletion after retention cutoffs.
                  </p>
                </div>
                <Switch
                  checked={config.allowHardDelete}
                  onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, allowHardDelete: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold cursor-pointer">Mandatory Audit Logging</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Log retention actions in workspace activity feeds for compliance tracking.
                  </p>
                </div>
                <Switch
                  checked={config.requireAuditLogging}
                  onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, requireAuditLogging: checked }))}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
