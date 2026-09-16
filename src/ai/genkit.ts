/**
 * @fileOverview Unified AI Genkit Runtime Engine.
 * 
 * ARCHITECTURAL INVARIANTS:
 * - Single point of model resolution (`getModel`) across the entire platform.
 * - Key Resolution Hierarchy: Organization Custom Key -> Backoffice DB Key -> Environment Variable -> System Default.
 * - Instance caching in `genkitInstancesRegistry` prevents redundant plugin initialization overhead.
 * - Transparent proxy fallback handling intercepts authentication (401/403/UNAUTHENTICATED),
 *   model not found (404), quota exhaustion (429), and service unavailability (503 / high demand),
 *   gracefully downgrading to resilient models (Gemini 3 Flash or Gemini 3.1 Flash-Lite) without
 *   breaking user workflows.
 * - Strict typing throughout: zero `any` or `any[]`.
 * 
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Do NOT wrap `googleAI({ apiKey })` in shallow object spreads; Genkit v2 verifies plugin
 *   instance symbols/prototypes, and shallow copying destroys plugin registration causing 404 NOT_FOUND.
 * - All organization and system API keys stored in Firestore are sealed (encrypted at rest).
 *   Always decrypt via `openSecret()` before passing to provider plugins.
 * 
 * @testability Exported `getModel` function can be exercised directly or tested against mock keys.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { anthropic } from '@genkit-ai/anthropic';
import { openAICompatible } from '@genkit-ai/compat-oai';
import { adminDb } from '@/lib/firebase-admin';
import { openSecret } from '@/lib/backoffice/secret-vault';
import { logBackofficeAction } from '@/lib/backoffice/audit-logger';
import {
  AiModelRegistry,
  type AiModelTier,
  type AiProviderId,
} from '@/lib/ai/model-registry';
import { WorkspaceAiService } from '@/lib/ai/services/workspace-ai-service';

// System default instance using environment variables
export const ai = genkit({
  plugins: [
    googleAI({ apiKey: process.env.GEMINI_API_KEY }),
    anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'placeholder-key-to-prevent-load-time-error' }), // System default Anthropic
  ],
  model: 'anthropic/claude-3-5-sonnet-20241022',
});

// In-memory cache for custom Genkit instances to avoid plugin initialization overhead
const genkitInstancesRegistry = new Map<string, ReturnType<typeof genkit>>();

function getOrCreateGenkitInstance(provider: string, apiKey: string): ReturnType<typeof genkit> {
  const cacheKey = `${provider}:${apiKey}`;
  if (genkitInstancesRegistry.has(cacheKey)) {
    return genkitInstancesRegistry.get(cacheKey)!;
  }

  let instance: ReturnType<typeof genkit>;
  if (provider === 'googleai') {
    instance = genkit({
      plugins: [googleAI({ apiKey })],
    });
  } else if (provider === 'anthropic') {
    instance = genkit({
      plugins: [anthropic({ apiKey })],
    });
  } else if (provider === 'openrouter') {
    instance = genkit({
      plugins: [
        openAICompatible({
          name: 'openrouter',
          apiKey,
          baseURL: 'https://openrouter.ai/api/v1',
        }),
      ],
    });
  } else {
    instance = ai;
  }

  genkitInstancesRegistry.set(cacheKey, instance);
  return instance;
}

interface Keys {
  geminiApiKey?: string;
  claudeApiKey?: string;
  openRouterApiKey?: string;
}

interface GlobalKeysCache {
  keys: Keys;
  expiresAt: number;
}

let globalKeysCache: GlobalKeysCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getGlobalBackofficeKeys(): Promise<Keys> {
  const now = Date.now();
  if (globalKeysCache && globalKeysCache.expiresAt > now) {
    return globalKeysCache.keys;
  }

  try {
    const docRef = adminDb.collection('system_settings').doc('ai_keys');
    const snap = await docRef.get();
    if (snap?.exists) {
      const data = snap.data();
      // Keys are sealed at rest (envelopes); openSecret also tolerates legacy
      // plaintext values that predate the encryption migration.
      const keys: Keys = {
        geminiApiKey: openSecret(data?.geminiApiKey),
        claudeApiKey: openSecret(data?.claudeApiKey),
        openRouterApiKey: openSecret(data?.openRouterApiKey),
      };
      globalKeysCache = {
        keys,
        expiresAt: now + CACHE_TTL_MS,
      };
      return keys;
    }
  } catch (error) {
    console.error('[AI] Error fetching global backoffice AI keys:', error);
  }

  return {};
}

/**
 * Resolves a model instance with the correct API key for an organization.
 * Hierarchy: Organization Custom Key -> Backoffice DB Key -> Environment Variable -> System Default
 */
export interface GetModelParams {
  workspaceId?: string;
  organizationId?: string;
  provider?: string; // 'googleai', 'anthropic', 'openrouter'
  modelId?: string;
  tier?: AiModelTier;
}

/**
 * Resolves a model instance with the correct API key for a workspace or organization.
 * Single Source of Truth: Integrates WorkspaceAiService & AiModelRegistry.
 * Hierarchy: Organization Custom Key -> Backoffice DB Key -> Environment Variable -> System Default
 */
export async function getModel(
  params?: GetModelParams | string
) {
  let workspaceId: string | undefined;
  let organizationId: string | undefined;
  let provider: AiProviderId | undefined;
  let requestedModelId: string | undefined;
  let tier: AiModelTier | undefined;

  if (typeof params === 'string') {
    requestedModelId = params;
  } else if (params) {
    workspaceId = params.workspaceId;
    organizationId = params.organizationId;
    if (params.provider === 'googleai' || params.provider === 'anthropic' || params.provider === 'openrouter') {
      provider = params.provider;
    }
    requestedModelId = params.modelId;
    tier = params.tier;
  }

  // 1. Resolve workspace-specific AI settings if workspaceId is provided
  if (workspaceId) {
    try {
      const wsSettings = await WorkspaceAiService.getSettings(workspaceId);
      if (!organizationId && wsSettings.organizationId) {
        organizationId = wsSettings.organizationId;
      }

      if (!requestedModelId) {
        if (!provider) {
          provider = wsSettings.preferredProvider;
        }

        if (tier === 'reasoning') {
          requestedModelId = wsSettings.reasoningModelId || AiModelRegistry.getDefaultModelForTier('reasoning', provider).id;
        } else if (tier === 'fast') {
          requestedModelId = wsSettings.fastModelId || AiModelRegistry.getDefaultModelForTier('fast', provider).id;
        } else {
          // Tier 'default' or unspecified
          const prefId = wsSettings.preferredModelId;
          const prefDef = prefId ? AiModelRegistry.getModelById(prefId) : undefined;
          // If preferred model is a deep reasoning model (which lacks free tier quota), avoid forcing it for default tier tasks
          if (prefDef && prefDef.tier === 'reasoning' && tier === 'default') {
            requestedModelId = AiModelRegistry.getDefaultModelForTier('default', provider).id;
          } else {
            requestedModelId = prefId || AiModelRegistry.getDefaultModelForTier('default', provider).id;
          }
        }
      }
    } catch (wsErr) {
      console.warn(`[AI] Failed to resolve workspace settings for "${workspaceId}", falling back:`, wsErr);
    }
  }

  // 2. If modelId is still not specified, resolve from tier or fallback to flagship
  if (!requestedModelId) {
    const tierDef = tier
      ? AiModelRegistry.getDefaultModelForTier(tier, provider)
      : AiModelRegistry.getFlagshipModel();
    requestedModelId = tierDef.id;
    if (!provider) {
      provider = tierDef.provider;
    }
  }

  // 3. Central Single Source of Truth Normalization
  const normalizedModelId = AiModelRegistry.normalizeModelId(requestedModelId);
  const modelDef = AiModelRegistry.getModelById(normalizedModelId);

  let finalProvider: AiProviderId = provider || 'googleai';
  let modelString: string;

  if (modelDef) {
    finalProvider = modelDef.provider;
    modelString = modelDef.providerModelString;
  } else {
    modelString = `${finalProvider}/${normalizedModelId}`;
  }

  let apiKey: string | undefined;

  // 4. Fetch Organization Key if organizationId is provided (Highest Priority)
  if (organizationId) {
    try {
      const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
      if (orgDoc.exists) {
        const data = orgDoc.data();
        if (finalProvider === 'googleai') apiKey = openSecret(data?.geminiApiKey);
        else if (finalProvider === 'anthropic') apiKey = openSecret(data?.claudeApiKey);
        else if (finalProvider === 'openrouter') apiKey = openSecret(data?.openRouterApiKey);

        if (apiKey) {
          console.log(`[AI] Using Organization-specific key for provider "${finalProvider}" (Org: ${organizationId})`);
        }
      }
    } catch (error) {
      console.error('[AI] Error fetching organization AI key:', error);
    }
  }

  // 5. Fetch Backoffice Global keys (1st Fallback)
  if (!apiKey) {
    const globalKeys = await getGlobalBackofficeKeys();
    if (finalProvider === 'googleai') apiKey = globalKeys.geminiApiKey;
    else if (finalProvider === 'anthropic') apiKey = globalKeys.claudeApiKey;
    else if (finalProvider === 'openrouter') apiKey = globalKeys.openRouterApiKey;

    if (apiKey) {
      console.log(`[AI] Using Backoffice global fallback key for provider "${finalProvider}"`);
    }
  }

  // 6. Fetch Environment Variables (2nd Fallback)
  if (!apiKey) {
    if (finalProvider === 'googleai') apiKey = process.env.GEMINI_API_KEY;
    else if (finalProvider === 'anthropic') apiKey = process.env.ANTHROPIC_API_KEY;
    else if (finalProvider === 'openrouter') apiKey = process.env.OPENROUTER_API_KEY;

    if (apiKey) {
      console.log(`[AI] Using Environment fallback key for provider "${finalProvider}"`);
    }
  }

  // 7. Fallback to system default if no key is found at all
  if (!apiKey) {
    console.warn(`[AI] No API key found for provider "${finalProvider}", falling back to system default instance`);
    return {
      modelString,
      provider: finalProvider,
      modelId: normalizedModelId,
      modelDefinition: modelDef,
      toString: () => modelString,
      [Symbol.toPrimitive]: () => modelString,
    };
  }

  // 8. Get or create cached Genkit instance with custom API key
  const customAi = getOrCreateGenkitInstance(finalProvider, apiKey);

  // Wrap customAi in a Proxy to intercept and automatically recover from auth, quota, or deprecated errors
  const wrappedAi = new Proxy(customAi, {
    get(target, prop, receiver) {
      if (prop === 'generate') {
        const originalGenerate = target.generate.bind(target);
        return async function(options: Parameters<typeof target.generate>[0]) {
          try {
            return await originalGenerate(options);
          } catch (error) {
            const resolvedOptions = await options;
            const errorMsg = error instanceof Error ? error.message : String(error);
            const lowerError = errorMsg.toLowerCase();
            const isAuthOrNotFoundError = 
              errorMsg.includes('401') || 
              errorMsg.includes('UNAUTHENTICATED') || 
              errorMsg.includes('x-api-key') || 
              errorMsg.includes('authentication_error') ||
              errorMsg.includes('permission_denied') ||
              errorMsg.includes('PERMISSION_DENIED') ||
              errorMsg.includes('403') ||
              errorMsg.includes('404') ||
              lowerError.includes('leaked') ||
              lowerError.includes('no longer available') ||
              lowerError.includes('not_found') ||
              lowerError.includes('not found') ||
              lowerError.includes('no model') ||
              lowerError.includes('notfound');

            const isQuotaError = 
              errorMsg.includes('429') || 
              lowerError.includes('quota') || 
              lowerError.includes('resource_exhausted') ||
              lowerError.includes('rate limit');

            const isUnavailableError =
              errorMsg.includes('503') ||
              lowerError.includes('unavailable') ||
              lowerError.includes('high demand') ||
              lowerError.includes('overloaded');
                                
            if (isAuthOrNotFoundError || isQuotaError || isUnavailableError) {
              const summaryErr = errorMsg.length > 120 ? `${errorMsg.slice(0, 117)}...` : errorMsg;
              console.warn(`[AI] Primary generation failed (${summaryErr}). Initiating resilient multi-model fallback.`);

              // Non-blocking telemetry log
              logBackofficeAction(
                { userId: 'system_proxy', email: 'system@smartsapp.com', name: 'AI Key Proxy', role: 'super_admin' },
                'ai_key.fallback',
                'provider',
                finalProvider,
                {
                  scope: organizationId ? 'organization' : 'platform',
                  scopeId: organizationId,
                  metadata: {
                    error: summaryErr,
                    modelId: normalizedModelId,
                  }
                }
              ).catch((e: unknown) => console.error('[AI] Telemetry logging failed:', e));

              // Ordered fallback candidate models on current key:
              // 1. Flagship: Gemini 3 Flash (High speed, balanced)
              // 2. High-Capacity Fast: Gemini 3.1 Flash-Lite (High throughput, unaffected by Pro quota locks)
              // 3. Stable Fallback: Gemini 2.5 Flash
              const fallbackCandidates: string[] = [
                'googleai/gemini-3-flash-preview',
                'googleai/gemini-3.1-flash-lite-preview',
                'googleai/gemini-2.5-flash',
              ].filter((candidate) => candidate !== resolvedOptions.model);

              // Attempt fallback across candidates on CURRENT key
              for (const candidate of fallbackCandidates) {
                try {
                  console.log(`[AI] Attempting resilient fallback model on current key: "${candidate}"`);
                  return await originalGenerate({
                    ...resolvedOptions,
                    model: candidate,
                  });
                } catch (candidateErr) {
                  const candidateMsg = candidateErr instanceof Error ? candidateErr.message : String(candidateErr);
                  console.warn(`[AI] Fallback candidate "${candidate}" unavailable (${candidateMsg.slice(0, 80)}). Trying next candidate...`);
                }
              }

              // If current key exhausted candidates, attempt with global Backoffice key if distinct
              try {
                const globalKeys = await getGlobalBackofficeKeys();
                const geminiKey = globalKeys.geminiApiKey || process.env.GEMINI_API_KEY;
                if (geminiKey && geminiKey !== apiKey) {
                  const fallbackInstance = getOrCreateGenkitInstance('googleai', geminiKey);
                  for (const candidate of fallbackCandidates) {
                    try {
                      return await fallbackInstance.generate({
                        ...resolvedOptions,
                        model: candidate,
                      });
                    } catch {
                      // Continue to next candidate on global key
                    }
                  }
                }
              } catch (fallbackErr) {
                const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
                console.warn(`[AI] Global Backoffice fallback resolution notice: ${fbMsg.slice(0, 80)}`);
              }

              // If environment key is distinct, attempt final fallback
              if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== apiKey) {
                for (const candidate of fallbackCandidates) {
                  try {
                    return await ai.generate({
                      ...resolvedOptions,
                      model: candidate,
                    });
                  } catch {
                    // Continue
                  }
                }
              }
            }
            throw error;
          }
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  }) as ReturnType<typeof genkit>;

  return {
    modelString,
    customAi: wrappedAi,
    provider: finalProvider,
    modelId: normalizedModelId,
    modelDefinition: modelDef,
    toString: () => modelString,
    [Symbol.toPrimitive]: () => modelString,
  };
}
