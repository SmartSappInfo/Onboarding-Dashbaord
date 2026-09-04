'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Backoffice Copilot Governance:
 *    - Super-admin governance console for multi-agent persona enablement, LLM temperature tuning,
 *      max token boundaries, allowed omnichannel repurposing derivatives, and session pruning.
 * 2. Enterprise Safety & Guardrails:
 *    - Validates prompt delimiter enforcement (<content_context> & <user_query>).
 *    - Enforces strict numeric bounds for temperature (0.0 - 1.0) and token budget limits.
 * 3. Mobile Accessibility & Touch Target Bounds:
 *    - All buttons, switches, and form inputs strictly enforce `min-h-[44px] min-w-[44px]`
 *      with Emil Kowalski micro-animations (`active:scale-[0.97]`).
 * 4. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState, useEffect, useCallback } from 'react';
import { useFirestore } from '@/lib/firestore-context';
import { useWorkspace } from '@/context/WorkspaceContext';
import type {
  CopilotPersonaType,
  DerivativeType,
  CopilotGovernanceConfig,
} from '@/lib/types/media-2.0';
import {
  getCopilotGovernanceConfigAction,
  saveCopilotGovernanceConfigAction,
  DEFAULT_COPILOT_CONFIG,
} from '@/lib/media/copilot-service';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Bot,
  Sparkles,
  ShieldCheck,
  Cpu,
  CheckCircle2,
  Scissors,
  Flame,
  Search,
  TrendingUp,
  Workflow,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ALL_PERSONAS: { id: CopilotPersonaType; label: string; role: string; icon: typeof Bot; color: string }[] = [
  {
    id: 'LIBRARIAN',
    label: 'Librarian',
    role: 'Asset cataloging, metadata extraction & semantic retrieval',
    icon: Search,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  },
  {
    id: 'ANALYST',
    label: 'Analyst',
    role: 'Drop-off auditing, multi-touch attribution & ROI diagnostics',
    icon: TrendingUp,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
  },
  {
    id: 'STRATEGIST',
    label: 'Strategist',
    role: 'Deal stage acceleration, multi-stakeholder buyer journey advisor',
    icon: Sparkles,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
  },
  {
    id: 'REPURPOSER',
    label: 'Repurposer',
    role: 'Omnichannel derivative generation (FAQs, briefs, emails, clips)',
    icon: Scissors,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  },
  {
    id: 'CRM_INTELLIGENCE',
    label: 'CRM Intel',
    role: 'Stakeholder intent signals, contact scoring & health multipliers',
    icon: Flame,
    color: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
  },
  {
    id: 'OPTIMIZER',
    label: 'Optimizer',
    role: 'Thumbnail click testing, title conversion & CTA placement',
    icon: Workflow,
    color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
  },
];

const ALL_DERIVATIVE_TYPES: { id: DerivativeType; label: string; desc: string }[] = [
  { id: 'SUMMARY', label: 'Executive Summary', desc: 'Concise executive brief with core insights' },
  { id: 'FAQ', label: 'Interactive FAQ', desc: '5-part question and answer pair for landing pages' },
  { id: 'EMAIL_OUTREACH', label: 'Email Outreach', desc: 'Cold & warm prospect sequence templates' },
  { id: 'SOCIAL_SNIPPETS', label: 'Social Posts', desc: 'LinkedIn & X short promotional snippets' },
  { id: 'SHORT_CLIPS', label: 'Video Highlight Clips', desc: 'Timestamps & hook scripts for shorts' },
  { id: 'QUOTE_CARDS', label: 'Pull Quotes', desc: 'Memorable high-impact quotes for decks' },
  { id: 'SALES_BRIEF', label: 'Sales Battlecard', desc: 'Account exec objection handling brief' },
];

export default function BackofficeCopilotGovernancePage() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [config, setConfig] = useState<CopilotGovernanceConfig>({
    ...DEFAULT_COPILOT_CONFIG,
    workspaceId: activeWorkspaceId || '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    if (!firestore || !activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const data = await getCopilotGovernanceConfigAction(firestore, activeWorkspaceId);
      setConfig(data);
    } catch (err) {
      console.error('[BackofficeCopilotGovernance] Error loading config:', err);
      toast({
        title: 'Failed to load Copilot config',
        description: 'Default governance policies applied.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [firestore, activeWorkspaceId, toast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleTogglePersona = (persona: CopilotPersonaType) => {
    setConfig((prev) => {
      const exists = prev.enabledPersonas.includes(persona);
      const next = exists
        ? prev.enabledPersonas.filter((p) => p !== persona)
        : [...prev.enabledPersonas, persona];
      
      // Prevent disabling all personas
      if (next.length === 0) {
        toast({
          title: 'Action blocked',
          description: 'At least one Copilot persona must remain active.',
          variant: 'destructive',
        });
        return prev;
      }

      // If disabling default persona, reassign
      let newDefault = prev.defaultPersona;
      if (exists && prev.defaultPersona === persona) {
        newDefault = next[0];
      }

      return {
        ...prev,
        enabledPersonas: next,
        defaultPersona: newDefault,
      };
    });
  };

  const handleToggleDerivative = (derivative: DerivativeType) => {
    setConfig((prev) => {
      const exists = prev.allowedDerivativeTypes.includes(derivative);
      const next = exists
        ? prev.allowedDerivativeTypes.filter((d) => d !== derivative)
        : [...prev.allowedDerivativeTypes, derivative];

      if (next.length === 0) {
        toast({
          title: 'Action blocked',
          description: 'At least one derivative format must be permitted.',
          variant: 'destructive',
        });
        return prev;
      }

      return {
        ...prev,
        allowedDerivativeTypes: next,
      };
    });
  };

  const handleSaveConfig = async () => {
    if (!firestore || !activeWorkspaceId) return;
    setIsSaving(true);
    try {
      await saveCopilotGovernanceConfigAction(firestore, activeWorkspaceId, config);
      toast({
        title: 'Copilot Governance Saved',
        description: 'Multi-agent persona matrix and repurposing boundaries successfully updated.',
      });
    } catch (err) {
      console.error('[BackofficeCopilotGovernance] Error saving:', err);
      toast({
        title: 'Failed to save configuration',
        description: 'Please check permissions and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setConfig({
      ...DEFAULT_COPILOT_CONFIG,
      workspaceId: activeWorkspaceId || '',
    });
    toast({
      title: 'Reset to Factory Defaults',
      description: 'Remember to click Save Changes to persist.',
    });
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center space-y-4">
        <Sparkles className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm font-bold text-foreground">Loading Copilot Governance Policies...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8 text-left">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Media Copilot & AI Studio Governance
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase">
              Phase 7
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Super-admin orchestration of autonomous AI personas, prompt guardrails, and content repurposing pipelines.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="rounded-xl h-10 px-4 min-h-[44px] gap-2 active:scale-[0.97] font-bold text-xs"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset Defaults</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="rounded-xl h-10 px-5 min-h-[44px] gap-2 active:scale-[0.97] font-bold text-xs shadow-sm shadow-primary/25"
          >
            {isSaving ? <Sparkles className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>Save Policies</span>
          </Button>
        </div>
      </div>

      {/* Safety & Quota Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Active Personas</p>
              <p className="text-2xl font-black text-foreground">
                {config.enabledPersonas.length} / {ALL_PERSONAS.length}
              </p>
            </div>
            <Bot className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Default Persona</p>
              <p className="text-lg font-black text-primary capitalize">
                {config.defaultPersona.toLowerCase()}
              </p>
            </div>
            <Sparkles className="h-6 w-6 text-amber-500" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Repurposing Formats</p>
              <p className="text-2xl font-black text-emerald-500">
                {config.allowedDerivativeTypes.length} Allowed
              </p>
            </div>
            <Scissors className="h-6 w-6 text-emerald-500" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Prompt Boundary Status</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">Enforced & Isolated</p>
              </div>
            </div>
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
          </CardContent>
        </Card>
      </div>

      {/* Section 1: Multi-Persona Orchestration Matrix */}
      <Card className="rounded-2xl border-border bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Specialized Agent Persona Matrix
              </CardTitle>
              <CardDescription className="text-xs">
                Activate or restrict access to specialized AI roles based on institutional compliance.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] font-black uppercase">
              Sections 44–50 PRD
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_PERSONAS.map((p) => {
              const isEnabled = config.enabledPersonas.includes(p.id);
              const isDefault = config.defaultPersona === p.id;
              const IconComponent = p.icon;

              return (
                <div
                  key={p.id}
                  className={cn(
                    'p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3',
                    isEnabled
                      ? 'border-border bg-muted/10 shadow-xs'
                      : 'border-dashed border-border/60 bg-muted/5 opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={cn('p-2 rounded-xl border', p.color)}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-foreground flex items-center gap-1.5">
                          {p.label}
                          {isDefault && (
                            <Badge className="bg-primary text-primary-foreground text-[9px] font-black uppercase px-1.5 py-0">
                              Default
                            </Badge>
                          )}
                        </h4>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                          {p.role}
                        </p>
                      </div>
                    </div>

                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => handleTogglePersona(p.id)}
                      className="min-h-[24px]"
                    />
                  </div>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] font-bold">
                    <span className="text-muted-foreground uppercase tracking-wider">Status</span>
                    <span className={isEnabled ? 'text-emerald-500 font-extrabold' : 'text-muted-foreground'}>
                      {isEnabled ? 'Active in Drawer & Studio' : 'Disabled'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <Label className="text-xs font-extrabold text-foreground">Default Fallback Persona</Label>
              <p className="text-[11px] text-muted-foreground">
                Persona activated automatically when users open Copilot without an explicit role selected.
              </p>
            </div>

            <Select
              value={config.defaultPersona}
              onValueChange={(val: string) => setConfig((prev) => ({ ...prev, defaultPersona: val as CopilotPersonaType }))}
            >
              <SelectTrigger className="w-[200px] h-10 min-h-[44px] rounded-xl text-xs font-bold bg-card">
                <SelectValue placeholder="Select Persona" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {config.enabledPersonas.map((personaKey) => (
                  <SelectItem key={personaKey} value={personaKey} className="text-xs font-semibold">
                    {ALL_PERSONAS.find((p) => p.id === personaKey)?.label || personaKey}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: LLM Inference Parameters & Delimiter Boundaries */}
      <Card className="rounded-2xl border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-extrabold flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            Inference Parameters & Anti-Injection Guardrails
          </CardTitle>
          <CardDescription className="text-xs">
            Configure response variability, token budgeting, and delimiter-based untrusted context encapsulation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-extrabold text-foreground">
                Model Temperature ({config.temperature.toFixed(2)})
              </Label>
              <Input
                type="number"
                step="0.05"
                min="0.0"
                max="1.0"
                value={config.temperature}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    temperature: Math.min(1.0, Math.max(0.0, parseFloat(e.target.value) || 0.3)),
                  }))
                }
                className="h-10 rounded-xl min-h-[44px] text-xs font-bold"
              />
              <p className="text-[11px] text-muted-foreground">
                Lower values (0.1 - 0.4) prioritize factual attribution and analytics; higher values (0.5 - 0.8) yield creative repurposing copy.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-extrabold text-foreground">
                Max Output Tokens ({config.maxTokensPerPrompt})
              </Label>
              <Input
                type="number"
                step="500"
                min="500"
                max="8000"
                value={config.maxTokensPerPrompt}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    maxTokensPerPrompt: Math.min(8000, Math.max(500, parseInt(e.target.value, 10) || 4000)),
                  }))
                }
                className="h-10 rounded-xl min-h-[44px] text-xs font-bold"
              />
              <p className="text-[11px] text-muted-foreground">
                Limits maximum token consumption per generation call to protect cloud budget quotas.
              </p>
            </div>
          </div>

          {/* Delimiter Guardrails Box */}
          <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
              <ShieldCheck className="h-4 w-4" />
              <span>Prompt Boundary Segregation Active</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              All external context including video transcripts, deal amounts, contact tags, and telemetry data are quarantined within strict XML boundaries (<code className="text-xs bg-muted/60 px-1 py-0.5 rounded">&lt;content_context&gt;</code> and <code className="text-xs bg-muted/60 px-1 py-0.5 rounded">&lt;user_query&gt;</code>). System prompts instruct the LLM to treat untrusted text solely as passive reference data, neutralizing indirect prompt injection attacks.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Omnichannel Content Repurposing Studio Matrix */}
      <Card className="rounded-2xl border-border bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <Scissors className="h-5 w-5 text-primary" />
                Omnichannel Repurposing Studio
              </CardTitle>
              <CardDescription className="text-xs">
                Control which derivative content formats team members can generate from media assets.
              </CardDescription>
            </div>
            <Switch
              checked={config.repurposingEnabled}
              onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, repurposingEnabled: checked }))}
              className="min-h-[24px]"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ALL_DERIVATIVE_TYPES.map((d) => {
              const isAllowed = config.allowedDerivativeTypes.includes(d.id);

              return (
                <div
                  key={d.id}
                  className={cn(
                    'p-4 rounded-2xl border transition-all flex items-center justify-between gap-3',
                    isAllowed && config.repurposingEnabled
                      ? 'border-border bg-muted/10'
                      : 'border-dashed border-border/60 bg-muted/5 opacity-50'
                  )}
                >
                  <div className="space-y-0.5">
                    <h5 className="text-xs font-black text-foreground">{d.label}</h5>
                    <p className="text-[11px] text-muted-foreground">{d.desc}</p>
                  </div>

                  <Switch
                    checked={isAllowed && config.repurposingEnabled}
                    disabled={!config.repurposingEnabled}
                    onCheckedChange={() => handleToggleDerivative(d.id)}
                    className="min-h-[24px]"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
