'use client';

/**
 * @fileoverview SmartSapp Survey Intelligence 2.0 — Backoffice AI Survey Architect Governance Matrix
 *
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Control-Plane Dispatch Governance: Governs client file extraction guardrails, default model tiers,
 *    and enabled archetype starter chips without requiring code redeployments.
 * 2. Mobile Ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press.
 * 3. Strict Zero-Any Invariant: Completely typed configuration state and callbacks.
 */

import * as React from 'react';
import type { SystemAiArchitectGovernanceConfig } from '@/lib/surveys/survey-ai-architect-governance-actions';
import {
  getSystemAiArchitectGovernanceAction,
  saveSystemAiArchitectGovernanceAction,
  DEFAULT_AI_ARCHITECT_GOVERNANCE_CONFIG,
} from '@/lib/surveys/survey-ai-architect-governance-actions';
import { ARCHETYPE_PRESETS } from '@/lib/surveys/survey-source-extractor';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Save,
  ShieldCheck,
  Zap,
  FileText,
  Sliders,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export function SystemAiArchitectGovernanceMatrix() {
  const { toast } = useToast();

  const [config, setConfig] = React.useState<SystemAiArchitectGovernanceConfig>(
    DEFAULT_AI_ARCHITECT_GOVERNANCE_CONFIG
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const fetchConfig = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getSystemAiArchitectGovernanceAction();
      if (res.success && res.config) {
        setConfig(res.config);
      }
    } catch (err: unknown) {
      console.error('[SystemAiArchitectGovernanceMatrix] Fetch error:', err);
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
      const res = await saveSystemAiArchitectGovernanceAction(config);
      if (res.success) {
        toast({
          title: 'AI Architect Governance Saved',
          description: 'Client extraction limits, model defaults, and archetype catalog updated.',
          actionConfig: {
            path: '/admin/surveys/new/ai',
            label: 'Test Studio',
          },
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: res.error || 'Failed to update AI architect governance.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: msg,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleArchetype = (archetypeId: string) => {
    setConfig((prev) => {
      const exists = prev.enabledArchetypeIds.includes(archetypeId);
      const updated = exists
        ? prev.enabledArchetypeIds.filter((id) => id !== archetypeId)
        : [...prev.enabledArchetypeIds, archetypeId];
      return { ...prev, enabledArchetypeIds: updated };
    });
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading AI Architect Governance Matrix...
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="p-5 sm:p-6 border-b border-border/60 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold tracking-tight">
                  AI Survey Architect Governance Matrix
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Configure client extraction safety bounds, default model tiers, and active archetype capsules.
                </CardDescription>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-11 px-5 rounded-xl font-semibold text-xs gap-2 active:scale-[0.97] transition-all shadow-sm self-start sm:self-auto"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save Matrix'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-6">
        {/* Safety & Extraction Guardrails */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-bold tracking-tight text-foreground">
              Client Extraction & Memory Guardrails
            </h3>
            <Badge variant="outline" className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10">
              Active Protection
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2 p-3.5 rounded-xl bg-background border border-border/70">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Max File Upload (MB)
              </Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={config.maxFileUploadSizeMb}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    maxFileUploadSizeMb: Math.max(1, parseInt(e.target.value, 10) || 1),
                  }))
                }
                className="h-11 font-mono text-sm rounded-lg"
              />
              <p className="text-[10px] text-muted-foreground">
                Prevents browser tab memory exhaustion when parsing large PDFs.
              </p>
            </div>

            <div className="space-y-2 p-3.5 rounded-xl bg-background border border-border/70">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                Max PDF Pages Extracted
              </Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={config.maxPdfPagesLimit}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    maxPdfPagesLimit: Math.max(1, parseInt(e.target.value, 10) || 1),
                  }))
                }
                className="h-11 font-mono text-sm rounded-lg"
              />
              <p className="text-[10px] text-muted-foreground">
                Caps pages extracted via pdfjs-dist before truncating.
              </p>
            </div>

            <div className="space-y-2 p-3.5 rounded-xl bg-background border border-border/70">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" />
                Character Cap per Document
              </Label>
              <Input
                type="number"
                min={1000}
                max={100000}
                step={1000}
                value={config.maxSourceCharacterLimit}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    maxSourceCharacterLimit: Math.max(1000, parseInt(e.target.value, 10) || 1000),
                  }))
                }
                className="h-11 font-mono text-sm rounded-lg"
              />
              <p className="text-[10px] text-muted-foreground">
                Prevents prompt token overflow in downstream LLM calls.
              </p>
            </div>
          </div>
        </div>

        {/* Model & Copilot Preferences */}
        <div className="pt-4 border-t border-border/60 space-y-4">
          <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Model Tier & Generation Preferences
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-border/70">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">
                  Default Generation Tier
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {config.defaultModelTier === 'fast'
                    ? 'Fast (Gemini Flash / Claude Haiku) — High speed & low latency'
                    : 'Flagship (Gemini Pro / Claude Sonnet) — Maximum reasoning depth'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={config.defaultModelTier === 'fast' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setConfig((prev) => ({ ...prev, defaultModelTier: 'fast' }))}
                  className="h-9 px-3 rounded-lg text-xs font-semibold active:scale-[0.97]"
                >
                  Fast
                </Button>
                <Button
                  type="button"
                  variant={config.defaultModelTier === 'flagship' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setConfig((prev) => ({ ...prev, defaultModelTier: 'flagship' }))}
                  className="h-9 px-3 rounded-lg text-xs font-semibold active:scale-[0.97]"
                >
                  Flagship
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-border/70">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">
                  Prompt Polish Copilot
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Enable the &ldquo;✨ Polish Prompt&rdquo; assistant in the studio command bar.
                </p>
              </div>
              <Switch
                checked={config.enablePromptPolishCopilot}
                onCheckedChange={(checked) =>
                  setConfig((prev) => ({ ...prev, enablePromptPolishCopilot: checked }))
                }
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </div>
        </div>

        {/* Archetypes Catalog */}
        <div className="pt-4 border-t border-border/60 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Active Quick-Start Archetype Catalog
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toggle which archetype starter pills appear on the Survey Architect Studio canvas.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-muted-foreground">
              {config.enabledArchetypeIds.length} of {ARCHETYPE_PRESETS.length} Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ARCHETYPE_PRESETS.map((preset) => {
              const isActive = config.enabledArchetypeIds.includes(preset.id);
              return (
                <div
                  key={preset.id}
                  role="checkbox"
                  aria-checked={isActive}
                  tabIndex={0}
                  onClick={() => toggleArchetype(preset.id)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleArchetype(preset.id);
                    }
                  }}
                  className={`cursor-pointer select-none p-3.5 rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98] ${
                    isActive
                      ? 'border-primary/40 bg-primary/[0.04] shadow-sm'
                      : 'border-border/60 bg-background/50 opacity-60 hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider">
                      {preset.badge}
                    </Badge>
                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center transition-colors ${
                        isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <h4 className="text-xs font-bold text-foreground">{preset.title}</h4>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                    {preset.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
export default SystemAiArchitectGovernanceMatrix;
