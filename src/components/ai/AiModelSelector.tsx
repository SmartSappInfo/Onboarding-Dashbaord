'use client';

/**
 * @fileOverview Unified Workspace AI Model Selector Component (<AiModelSelector>).
 * 
 * ARCHITECTURAL INVARIANTS:
 * - Single Source of Truth: Exclusively retrieves provider & model catalogs from `AiModelRegistry`.
 * - Workspace Persistence: Reading and mutations bind directly to the active workspace's `aiSettings`.
 * - Emil Kowalski Micro-Interactions: Supports `active:scale-[0.97]` tactile press feedback,
 *   sub-300ms easing transitions, and hardware-accelerated transforms.
 * - Mobile-First Touch Targets: Select trigger and item targets adhere strictly to >= 44px (`min-h-[44px]`).
 * - Plain Everyday UI English: Clear, friendly badges without technical jargon or HTML leaks.
 * - Strict Typing: Zero `any`, zero `unknown`, zero `any[]`.
 */

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@/components/ui/select';
import { Sparkles, Brain, Zap, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AiModelRegistry,
  type AiModelDefinition,
  type AiModelTier,
  type AiProviderId,
} from '@/lib/ai/model-registry';
import { useWorkspaceAiModel } from '@/hooks/use-workspace-ai-model';

/**
 * Provider icon map for clean visual rendering.
 */
const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Zap,
  Brain,
};

/**
 * Backward-compatible export of AI_PROVIDERS derived dynamically from the central registry.
 * Preserves legacy callers without duplicating model metadata.
 */
export const AI_PROVIDERS = AiModelRegistry.getProviders().map((provider) => ({
  id: provider.id,
  name: provider.name,
  icon: PROVIDER_ICONS[provider.iconName] || Sparkles,
  color: provider.textColor,
  bgColor: provider.bgColor,
  models: provider.models.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
  })),
}));

export interface AiModelSelectorProps {
  /** Optional workspace ID override; defaults to active workspace from context */
  workspaceId?: string;
  /** Filter models by operational tier */
  tier?: AiModelTier | 'all';
  /** Hides the top metadata label */
  hideLabel?: boolean;
  /** Container CSS classes */
  className?: string;
  /** Optional callback fired when model is changed */
  onModelChange?: (model: AiModelDefinition) => void;
}

export default function AiModelSelector({
  workspaceId,
  tier = 'all',
  hideLabel = false,
  className,
  onModelChange,
}: AiModelSelectorProps) {
  const { activeOrganization } = useTenant();
  const { modelId, modelDefinition, setModel, isUpdating } = useWorkspaceAiModel(workspaceId);

  // Filter providers based on organization's credentials
  const availableProviders = React.useMemo(() => {
    return AiModelRegistry.getProvidersForOrganization(activeOrganization);
  }, [activeOrganization]);

  // Filter models by tier if specified
  const filteredProviders = React.useMemo(() => {
    if (tier === 'all') {
      return availableProviders;
    }
    return availableProviders
      .map((p) => ({
        ...p,
        models: p.models.filter((m) => m.tier === tier),
      }))
      .filter((p) => p.models.length > 0);
  }, [availableProviders, tier]);

  const handleSelect = React.useCallback(
    async (newModelId: string) => {
      const success = await setModel(newModelId);
      if (success && onModelChange) {
        const resolved = AiModelRegistry.getModelById(newModelId);
        if (resolved) {
          onModelChange(resolved);
        }
      }
    },
    [setModel, onModelChange]
  );

  const currentProvider = React.useMemo(() => {
    return (
      filteredProviders.find((p) => p.id === modelDefinition.provider) ||
      filteredProviders[0] ||
      AiModelRegistry.getProviders()[0]
    );
  }, [filteredProviders, modelDefinition.provider]);

  const CurrentProviderIcon =
    PROVIDER_ICONS[currentProvider?.iconName || 'Sparkles'] || Sparkles;

  // Fallback badge if no providers match organization requirements
  if (filteredProviders.length === 0) {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        {!hideLabel && (
          <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">
            Workspace AI Model
          </label>
        )}
        <div className="flex items-center gap-2.5 p-3 min-h-[44px] bg-blue-500/5 border border-blue-500/15 text-blue-600 dark:text-blue-400 rounded-2xl text-xs font-semibold w-full max-w-[280px]">
          <Sparkles className="w-4 h-4 shrink-0 text-blue-500" />
          <span className="truncate">System Default: {modelDefinition.name}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {!hideLabel && (
        <div className="flex items-center justify-between ml-1">
          <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            Workspace AI Model
          </label>
          {modelDefinition.isFlagship && (
            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
              Flagship
            </span>
          )}
        </div>
      )}

      <Select
        value={modelId}
        onValueChange={handleSelect}
        disabled={isUpdating}
      >
        <SelectTrigger
          aria-label="Select Workspace AI Model"
          className={cn(
            'w-full max-w-[300px] min-h-[44px] h-11 rounded-2xl bg-background border border-border/70 shadow-sm',
            'hover:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all duration-200',
            'active:scale-[0.97] font-medium text-left group'
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div
              className={cn(
                'p-1.5 rounded-xl transition-colors shrink-0',
                currentProvider.bgColor
              )}
            >
              <CurrentProviderIcon className={cn('h-3.5 w-3.5', currentProvider.textColor)} />
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <span className="text-xs font-bold text-foreground truncate leading-tight">
                {modelDefinition.name}
              </span>
              <span className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                {currentProvider.name}
              </span>
            </div>
          </div>
        </SelectTrigger>

        <SelectContent
          className="rounded-2xl border border-border/80 shadow-2xl p-2 bg-background/95 backdrop-blur-xl max-h-[380px]"
          style={{ zIndex: 100000 }}
        >
          {filteredProviders.map((provider) => {
            const ProviderIcon = PROVIDER_ICONS[provider.iconName] || Sparkles;
            return (
              <SelectGroup key={provider.id}>
                <SelectLabel className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">
                  <ProviderIcon className={cn('h-3 w-3', provider.textColor)} />
                  {provider.name}
                </SelectLabel>

                {provider.models.map((model) => {
                  const isSelected = model.id === modelId;
                  return (
                    <SelectItem
                      key={model.id}
                      value={model.id}
                      className={cn(
                        'min-h-[44px] rounded-xl py-2 px-3 focus:bg-primary/5 cursor-pointer transition-all duration-150',
                        'active:scale-[0.98]'
                      )}
                    >
                      <div className="flex items-start justify-between w-full gap-2 pr-1">
                        <div className="flex flex-col min-w-0 text-left">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs tracking-tight text-foreground">
                              {model.name}
                            </span>
                            {model.isFlagship && (
                              <span className="text-[8px] font-bold px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 rounded">
                                Recommended
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                            {model.description}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
