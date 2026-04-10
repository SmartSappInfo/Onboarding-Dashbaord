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
        if (provider === 'googleai') apiKey = data?.geminiApiKey;
        else if (provider === 'openai') apiKey = data?.openaiApiKey;
        else if (provider === 'openrouter') apiKey = data?.openRouterApiKey;
      }
    } catch (error) {
      console.error('Error fetching organization AI key:', error);
    }
  }

  // 2. Fallback to environment variables if no org key found
  if (!apiKey) {
    if (provider === 'googleai') apiKey = process.env.GEMINI_API_KEY;
    else if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY;
    else if (provider === 'openrouter') apiKey = process.env.OPENROUTER_API_KEY;
  }

  // 3. Construct the dynamic model instance
  if (!apiKey) {
    throw new Error(`AI configuration error: API key for provider "${provider}" is missing. Please configure it in Organization Settings or environment variables.`);
  }

  // Since Genkit plugins are usually registered globally, we use the plugin 
  // factory directly to create a model instance with the specific API key.
  if (provider === 'googleai') {
    const plugin = googleAI({ apiKey });
    return await plugin.model(modelId);
  }

  if (provider === 'openai' || provider === 'openrouter') {
    const baseURL = provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined;
    const plugin = openAICompatible({ 
      name: provider,
      apiKey, 
      configuration: { baseURL } 
    });
    return await plugin.model(modelId);
  }

  // Fallback to default ai model using plugins
  if (provider === 'googleai') {
    return await googleAI().model(modelId);
  }
  return await openAICompatible({ name: 'openai' }).model(modelId);
}
