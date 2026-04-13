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
  model: 'googleai/gemini-2.0-flash',
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

  // 1. Fetch Organization Key if orgId is provided
  if (organizationId) {
    try {
      const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
      if (orgDoc.exists) {
        const data = orgDoc.data();
        // For safety during testing: if an environment variable exists, force-override the database value!
        if (provider === 'googleai') apiKey = process.env.GEMINI_API_KEY || data?.geminiApiKey;
        else if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY || data?.openaiApiKey;
        else if (provider === 'openrouter') apiKey = process.env.OPENROUTER_API_KEY || data?.openRouterApiKey;
      }
    } catch (error) {
      console.error('Error fetching organization AI key:', error);
    }
  }

  // 2. Fallback explicitly to environment variables if still totally missing
  if (!apiKey) {
    if (provider === 'googleai') apiKey = process.env.GEMINI_API_KEY;
    else if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY;
    else if (provider === 'openrouter') apiKey = process.env.OPENROUTER_API_KEY;
  }

  // 3. Construct the dynamic model instance
  if (!apiKey) {
    throw new Error(`AI configuration error: API key for provider "${provider}" is missing. Please configure it in Organization Settings or environment variables.`);
  }

  // 4. Return a localized model action tailored correctly for this request
  if (provider === 'googleai') {
    const instance = genkit({
      plugins: [googleAI({ apiKey })]
    });
    return (instance as any).model(`googleai/${modelId}`);
  }

  // Handle openrouter and openai with openAICompatible
  const baseURL = provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined;
  
  const instance = genkit({
      plugins: [
          (openAICompatible as any)({ 
            name: provider,
            apiKey, 
            baseURL,
            models: [modelId]
          })
      ]
  });

  return (instance as any).model(`${provider}/${modelId}`);
}
