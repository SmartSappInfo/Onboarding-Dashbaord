import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { openAICompatible } from '@genkit-ai/compat-oai';
import { adminDb } from '@/lib/firebase-admin';

// System default instance using environment variables
export const ai = genkit({
  plugins: [
    googleAI(),
    openAICompatible({ name: 'openai' }), // System default OpenAI (uses OPENAI_API_KEY)
  ],
  model: 'googleai/gemini-3-flash-preview',
});

/**
 * Resolves a model instance with the correct API key for an organization.
 * Falls back to system defaults if no organization key is provided.
 */
export async function getModel(params: {
  organizationId?: string;
  provider: string; // 'googleai', 'openai', 'openrouter'
  modelId: string;
}) {
  const { organizationId, provider, modelId } = params;

  let apiKey: string | undefined;
  let aiKeyMode: 'platform' | 'custom' = 'platform';

  // 1. Fetch Organization Key if orgId is provided (High Priority)
  if (organizationId) {
    try {
      const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
      if (orgDoc.exists) {
        const data = orgDoc.data();
        
        // Use organization keys if they exist, regardless of mode
        if (provider === 'googleai') apiKey = data?.geminiApiKey;
        else if (provider === 'openai') apiKey = data?.openaiApiKey;
        else if (provider === 'openrouter') apiKey = data?.openRouterApiKey;

        if (apiKey) {
          console.log(`[AI] Using Organization-specific key for provider "${provider}" (Org: ${organizationId})`);
        }
      }
    } catch (error) {
      console.error('Error fetching organization AI key:', error);
    }
  }

  // 2. Fall back to Platform Keys if no Organization key was found (Medium Priority)
  if (!apiKey) {
    if (provider === 'googleai') apiKey = process.env.GEMINI_API_KEY;
    else if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY;
    else if (provider === 'openrouter') apiKey = process.env.OPENROUTER_API_KEY;

    if (apiKey) {
      console.log(`[AI] Using Platform default key for provider "${provider}"`);
    }
  }

  // 3. If no API key is available, fall back to system defaults
  if (!apiKey) {
    console.warn(`No API key found for provider "${provider}", falling back to system default`);
    if (provider === 'googleai') {
      return { modelString: `googleai/${modelId}` };
    }
    return { modelString: `${provider}/${modelId}` };
  }

  // 4. Create a new genkit instance with the specific API key for this request
  if (provider === 'googleai') {
    const customAi = genkit({ plugins: [googleAI({ apiKey })] });
    return { modelString: `googleai/${modelId}`, customAi };
  }

  // Handle openrouter and openai with openAICompatible
  const baseURL = provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined;

  const customAi = genkit({
    plugins: [
      openAICompatible({
        name: provider,
        apiKey,
        baseURL,
      })
    ]
  });

  return { modelString: `${provider}/${modelId}`, customAi };
}
