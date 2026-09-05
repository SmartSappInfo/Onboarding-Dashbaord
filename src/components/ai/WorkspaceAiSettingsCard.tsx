'use client';

/**
 * @fileOverview Dedicated Workspace AI Model Configuration Card (<WorkspaceAiSettingsCard>).
 *
 * ARCHITECTURAL INVARIANTS:
 * - Authoritative UI for configuring the active workspace's default, reasoning, and fast LLMs.
 * - Single Source of Truth: All model lists, providers, and capabilities are pulled from AiModelRegistry.
 * - Persistence: Mutates `workspaces/{workspaceId}.aiSettings` via `updateWorkspaceAiSettingsAction`.
 * - Tactile Micro-Interactions: Emil Kowalski active:scale-[0.97] press states and smooth transitions.
 * - Mobile Accessibility: Touch targets strictly >= 44px (min-h-[44px]).
 * - Strict Typing: Zero any, zero unknown, zero any[].
 */

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import {
  AiModelRegistry,
  type AiModelDefinition,
  type AiProviderId,
} from '@/lib/ai/model-registry';
import { updateWorkspaceAiSettingsAction } from '@/lib/ai/actions/workspace-ai-actions';
import { Sparkles, Brain, Zap, ShieldCheck, Loader2, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkspaceAiSettings } from '@/lib/types';

export interface WorkspaceAiSettingsCardProps {
  workspaceId: string;
  initialSettings?: WorkspaceAiSettings;
  className?: string;
}

export function WorkspaceAiSettingsCard({
  workspaceId,
  initialSettings,
  className,
}: WorkspaceAiSettingsCardProps) {
  const { toast } = useToast();
  const { activeWorkspace } = useTenant();

  const currentSettings = initialSettings || activeWorkspace?.aiSettings;
  const flagship = AiModelRegistry.getFlagshipModel();

  const [provider, setProvider] = React.useState<AiProviderId>(
    currentSettings?.preferredProvider || flagship.provider
  );
  const [preferredModelId, setPreferredModelId] = React.useState<string>(
    currentSettings?.preferredModelId || flagship.id
  );
  const [reasoningModelId, setReasoningModelId] = React.useState<string>(
    currentSettings?.reasoningModelId || ''
  );
  const [fastModelId, setFastModelId] = React.useState<string>(
    currentSettings?.fastModelId || ''
  );
  const [isSaving, setIsSaving] = React.useState(false);

  // Synchronize when active workspace updates
  React.useEffect(() => {
    if (currentSettings) {
      setProvider(currentSettings.preferredProvider || flagship.provider);
      setPreferredModelId(currentSettings.preferredModelId || flagship.id);
      setReasoningModelId(currentSettings.reasoningModelId || '');
      setFastModelId(currentSettings.fastModelId || '');
    }
  }, [currentSettings, flagship]);

  const handleProviderChange = (newProvider: AiProviderId) => {
    setProvider(newProvider);
    const modelsForProvider = AiModelRegistry.getModelsByProvider(newProvider);
    const currentBelongs = modelsForProvider.some((m) => m.id === preferredModelId);
    if (!currentBelongs) {
      const defaultForProvider = AiModelRegistry.getDefaultModelForTier('default', newProvider);
      setPreferredModelId(defaultForProvider.id);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;

    setIsSaving(true);
    try {
      const targetModel = AiModelRegistry.getModelById(preferredModelId);
      const effectiveProvider = targetModel?.provider || provider;

      const result = await updateWorkspaceAiSettingsAction({
        workspaceId,
        preferredProvider: effectiveProvider,
        preferredModelId,
        reasoningModelId: reasoningModelId || undefined,
        fastModelId: fastModelId || undefined,
      });

      if (result.success) {
        toast({
          title: 'Workspace AI Settings Saved',
          description: `Updated default model to ${targetModel?.name || preferredModelId}.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: result.error || 'Failed to update workspace AI settings.',
          actionConfig: {
            path: `/admin/settings?workspaceId=${workspaceId}`,
            label: 'Settings',
          },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Error Saving AI Settings',
        description: msg,
        actionConfig: {
          path: `/admin/settings?workspaceId=${workspaceId}`,
          label: 'Settings',
        },
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedDefaultDef = AiModelRegistry.getModelById(preferredModelId);
  const allModels = AiModelRegistry.getAllModels();

  return (
    <Card className={cn('rounded-[2rem] border-none shadow-sm ring-1 ring-border overflow-hidden', className)}>
      <CardHeader className="bg-primary/5 border-b p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                Workspace AI Engine
              </CardTitle>
              <CardDescription>
                Single source of truth for all autonomous flows, prompts, and specialists in this workspace.
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-none hidden sm:inline-flex">
            Workspace Governance
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 sm:p-8 space-y-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Preferred Provider */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Primary AI Provider
              </label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value as AiProviderId)}
                className="w-full rounded-xl min-h-[44px] border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
              >
                {AiModelRegistry.getProviders().map((prov) => (
                  <option key={prov.id} value={prov.id}>
                    {prov.name} ({prov.id})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Determines the default LLM infrastructure family for general workspace queries.
              </p>
            </div>

            {/* Preferred Default Model */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Default Balanced Model
              </label>
              <select
                value={preferredModelId}
                onChange={(e) => setPreferredModelId(e.target.value)}
                className="w-full rounded-xl min-h-[44px] border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
              >
                {AiModelRegistry.getModelsByProvider(provider).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} {model.isFlagship ? '★ (Flagship)' : `[${model.tier}]`}
                  </option>
                ))}
              </select>
              {selectedDefaultDef && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  <span className="font-semibold text-foreground">{selectedDefaultDef.name}:</span>{' '}
                  {selectedDefaultDef.description} (Context: {selectedDefaultDef.capabilities.maxContextTokens.toLocaleString()} tokens)
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-border/50">
            {/* Reasoning Model Override */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-indigo-500" />
                Deep Reasoning Tier (Optional)
              </label>
              <select
                value={reasoningModelId}
                onChange={(e) => setReasoningModelId(e.target.value)}
                className="w-full rounded-xl min-h-[44px] border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
              >
                <option value="">Auto-resolve from provider defaults</option>
                {allModels
                  .filter((m) => m.tier === 'reasoning' || m.capabilities.structuredOutput)
                  .map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.provider})
                    </option>
                  ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Applied to complex multi-step planning, supervisor goal decomposition, and swarm consensus synthesis.
              </p>
            </div>

            {/* Fast Model Override */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                High-Speed Fast Tier (Optional)
              </label>
              <select
                value={fastModelId}
                onChange={(e) => setFastModelId(e.target.value)}
                className="w-full rounded-xl min-h-[44px] border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
              >
                <option value="">Auto-resolve from provider defaults</option>
                {allModels
                  .filter((m) => m.tier === 'fast')
                  .map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.provider})
                    </option>
                  ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Applied to low-latency summarization, keyword extraction, and high-frequency bulk classification.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Changes apply immediately to all team members in this workspace.
            </span>
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-xl font-semibold px-8 shadow-sm bg-primary text-white text-xs min-h-[44px] active:scale-[0.97] transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating AI Settings...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Save AI Settings
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
