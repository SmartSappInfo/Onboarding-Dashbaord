'use client';

/**
 * @fileOverview Client React Hook for Workspace AI Model State (useWorkspaceAiModel).
 * 
 * ARCHITECTURAL INVARIANTS:
 * - Single source of truth for the workspace's active AI model.
 * - Reads persistently from `activeWorkspace.aiSettings` provided by TenantContext.
 * - Updates flow through `updateWorkspaceAiSettingsAction` to mutate Firestore and local cache.
 * - Normalizes legacy tokens through `AiModelRegistry.normalizeModelId()` on the fly.
 * - Strict Typing: Zero `any`, zero `unknown`, zero `any[]`.
 */

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';
import {
  AiModelRegistry,
  type AiModelDefinition,
  type AiProviderId,
} from '@/lib/ai/model-registry';
import { updateWorkspaceAiSettingsAction } from '@/lib/ai/actions/workspace-ai-actions';
import { useToast } from '@/hooks/use-toast';

export interface UseWorkspaceAiModelReturn {
  provider: AiProviderId;
  modelId: string;
  modelDefinition: AiModelDefinition;
  workspaceId: string;
  setModel: (newModelId: string) => Promise<boolean>;
  isUpdating: boolean;
}

export function useWorkspaceAiModel(workspaceIdOverride?: string): UseWorkspaceAiModelReturn {
  const { activeWorkspace, activeWorkspaceId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = React.useState(false);

  const effectiveWorkspaceId = workspaceIdOverride || activeWorkspaceId || '';

  // Local optimistic override for instant responsive UI before Firestore roundtrip
  const [optimisticModelId, setOptimisticModelId] = React.useState<string | null>(null);

  // Clear optimistic override when workspace switches
  React.useEffect(() => {
    setOptimisticModelId(null);
  }, [effectiveWorkspaceId]);

  // Reset optimistic state once remote state catches up
  React.useEffect(() => {
    if (optimisticModelId && activeWorkspace?.aiSettings?.preferredModelId === optimisticModelId) {
      setOptimisticModelId(null);
    }
  }, [optimisticModelId, activeWorkspace?.aiSettings?.preferredModelId]);

  // Resolve active raw model ID
  const rawModelId =
    optimisticModelId ||
    activeWorkspace?.aiSettings?.preferredModelId ||
    '';

  const canonicalModelId = React.useMemo(() => {
    return AiModelRegistry.normalizeModelId(rawModelId);
  }, [rawModelId]);

  const modelDefinition = React.useMemo(() => {
    const found = AiModelRegistry.getModelById(canonicalModelId);
    return found || AiModelRegistry.getFlagshipModel();
  }, [canonicalModelId]);

  const provider = modelDefinition.provider;

  const setModel = React.useCallback(
    async (newModelId: string): Promise<boolean> => {
      if (!effectiveWorkspaceId) {
        toast({
          variant: 'destructive',
          title: 'Workspace required',
          description: 'No active workspace was found to save the AI model setting.',
          actionConfig: {
            path: '/admin/settings/workspace',
            label: 'Select Workspace',
          },
        });
        return false;
      }

      const normalized = AiModelRegistry.normalizeModelId(newModelId);
      const targetModel = AiModelRegistry.getModelById(normalized);
      if (!targetModel) {
        toast({
          variant: 'destructive',
          title: 'Unknown Model',
          description: `The model "${newModelId}" is not recognized by the registry.`,
          actionConfig: {
            path: '/admin/settings/workspace',
            label: 'Model Settings',
          },
        });
        return false;
      }

      // Apply optimistic update immediately
      setOptimisticModelId(normalized);
      setIsUpdating(true);

      try {
        const result = await updateWorkspaceAiSettingsAction({
          workspaceId: effectiveWorkspaceId,
          userId: user?.uid,
          preferredProvider: targetModel.provider,
          preferredModelId: targetModel.id,
        });

        if (result.success) {
          toast({
            title: 'Workspace AI Model Updated',
            description: `Switched default model to ${targetModel.name}.`,
          });
          return true;
        } else {
          // Revert optimistic update on failure
          setOptimisticModelId(null);
          toast({
            variant: 'destructive',
            title: 'Update Failed',
            description: result.error || 'Failed to update workspace AI settings.',
            actionConfig: result.actionConfig || {
              path: '/admin/settings/workspace',
              label: 'Workspace Settings',
            },
          });
          return false;
        }
      } catch (err) {
        setOptimisticModelId(null);
        const msg = err instanceof Error ? err.message : String(err);
        toast({
          variant: 'destructive',
          title: 'Update Error',
          description: msg,
          actionConfig: {
            path: '/admin/settings/workspace',
            label: 'Retry Settings',
          },
        });
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [effectiveWorkspaceId, user?.uid, toast]
  );

  return {
    provider,
    modelId: canonicalModelId,
    modelDefinition,
    workspaceId: effectiveWorkspaceId,
    setModel,
    isUpdating,
  };
}
