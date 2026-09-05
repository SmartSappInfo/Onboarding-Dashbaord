'use client';

/**
 * @fileOverview Backward-compatible Live AI Model Hook (useLiveAiModel).
 * 
 * ARCHITECTURAL INVARIANTS:
 * - Seamlessly routes to the Single Source of Truth (`useWorkspaceAiModel`)
 *   so that all existing components (15+ callers across prompts, surveys, builder, modals)
 *   automatically consume the workspace's selected model without breaking changes.
 * - Guarantees evolutionary model normalization through `AiModelRegistry`.
 * - Strict Typing: Zero `any`, zero `unknown`, zero `any[]`.
 */

import { useWorkspaceAiModel } from './use-workspace-ai-model';
import { AiModelRegistry, type AiModelDefinition, type AiProviderId } from '@/lib/ai/model-registry';

export interface UseLiveAiModelReturn {
  provider: AiProviderId;
  modelId: string;
  loading: boolean;
  modelDefinition: AiModelDefinition;
  setModel: (newModelId: string) => Promise<boolean>;
}

export function useLiveAiModel(): UseLiveAiModelReturn {
  const { provider, modelId, modelDefinition, setModel, isUpdating } = useWorkspaceAiModel();

  return {
    provider,
    modelId: modelId || AiModelRegistry.getFlagshipModel().id,
    loading: isUpdating,
    modelDefinition,
    setModel,
  };
}
