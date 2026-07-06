import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { anthropic } from '@genkit-ai/anthropic';
import { openAICompatible } from '@genkit-ai/compat-oai';
import { adminDb } from '@/lib/firebase-admin';
import { openSecret } from '@/lib/backoffice/secret-vault';

// System default instance using environment variables
export const ai = genkit({
  plugins: [
    googleAI(),
    anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'placeholder-key-to-prevent-load-time-error' }), // System default Anthropic
  ],
  model: 'anthropic/claude-3-5-sonnet',
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
    if (snap.exists) {
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
export async function getModel(params: {
  organizationId?: string;
  provider: string; // 'googleai', 'anthropic', 'openrouter'
  modelId: string;
}) {
  let { organizationId, provider, modelId } = params;

  // Map legacy 'openai' provider to 'anthropic' and update modelId
  if (provider === 'openai') {
    provider = 'anthropic';
    if (modelId.startsWith('gpt-')) {
      modelId = 'claude-3-5-sonnet';
    }
  }

  // Map fictional gemini-3.5-flash model to real gemini-2.5-flash model
  if (provider === 'googleai' && modelId === 'gemini-3.5-flash') {
    modelId = 'gemini-2.5-flash';
  }

  let apiKey: string | undefined;

  // 1. Fetch Organization Key if orgId is provided (Highest Priority)
  if (organizationId) {
    try {
      const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
      if (orgDoc.exists) {
        const data = orgDoc.data();
        if (provider === 'googleai') apiKey = data?.geminiApiKey;
        else if (provider === 'anthropic') apiKey = data?.claudeApiKey;
        else if (provider === 'openrouter') apiKey = data?.openRouterApiKey;

        if (apiKey) {
          console.log(`[AI] Using Organization-specific key for provider "${provider}" (Org: ${organizationId})`);
        }
      }
    } catch (error) {
      console.error('[AI] Error fetching organization AI key:', error);
    }
  }

  // 2. Fetch Backoffice Global keys (1st Fallback)
  if (!apiKey) {
    const globalKeys = await getGlobalBackofficeKeys();
    if (provider === 'googleai') apiKey = globalKeys.geminiApiKey;
    else if (provider === 'anthropic') apiKey = globalKeys.claudeApiKey;
    else if (provider === 'openrouter') apiKey = globalKeys.openRouterApiKey;

    if (apiKey) {
      console.log(`[AI] Using Backoffice global fallback key for provider "${provider}"`);
    }
  }

  // 3. Fetch Environment Variables (2nd Fallback)
  if (!apiKey) {
    if (provider === 'googleai') apiKey = process.env.GEMINI_API_KEY;
    else if (provider === 'anthropic') apiKey = process.env.ANTHROPIC_API_KEY;
    else if (provider === 'openrouter') apiKey = process.env.OPENROUTER_API_KEY;

    if (apiKey) {
      console.log(`[AI] Using Environment fallback key for provider "${provider}"`);
    }
  }

  // 4. Fallback to system default if no key is found at all
  if (!apiKey) {
    console.warn(`[AI] No API key found for provider "${provider}", falling back to system default instance`);
    if (provider === 'googleai') {
      return { modelString: `googleai/${modelId}` };
    }
    if (provider === 'anthropic') {
      return { modelString: `anthropic/${modelId}` };
    }
    return { modelString: `${provider}/${modelId}` };
  }

  // 5. Get or create cached Genkit instance with custom API key
  const customAi = getOrCreateGenkitInstance(provider, apiKey);
  const modelString = `${provider}/${modelId}`;

  // Wrap customAi in a Proxy to intercept and automatically recover from 401 authentication errors
  const wrappedAi = new Proxy(customAi, {
    get(target, prop, receiver) {
      if (prop === 'generate') {
        const originalGenerate = target.generate.bind(target);
        return async function(options: Parameters<typeof target.generate>[0]) {
          try {
            return await originalGenerate(options);
          } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const isAuthError = errorMsg.includes('401') || 
                                errorMsg.includes('UNAUTHENTICATED') || 
                                errorMsg.includes('x-api-key') || 
                                errorMsg.includes('authentication_error') ||
                                errorMsg.includes('permission_denied') ||
                                errorMsg.includes('403');
                                
            if (isAuthError) {
              console.warn(`[AI] Custom API key generation failed with auth error: "${errorMsg}". Falling back to system default instance.`);
              const defaultModel = provider === 'googleai' 
                ? 'googleai/gemini-2.5-flash' 
                : 'anthropic/claude-3-5-sonnet';
              return await ai.generate({
                ...options,
                model: defaultModel
              } as Parameters<typeof ai.generate>[0]);
            }
            throw error;
          }
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  }) as ReturnType<typeof genkit>;

  return { modelString, customAi: wrappedAi };
}
