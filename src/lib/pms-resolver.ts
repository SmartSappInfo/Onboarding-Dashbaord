import { adminDb } from './firebase-admin';
import { BasePromptConfig } from './pms-types';
const NATIVE_DEFAULTS: Record<string, BasePromptConfig> = {
  summarizeEntityNotesFlow: {
    systemPrompt: 'You are an expert CRM analyst. Summarize the following interaction history.',
    userPromptTemplate: 'You are an expert CRM analyst. Summarize the following interaction history for an entity named "{{entityName}}".\n\nNotes History:\n{{notesContext}}\n\nProvide a concise, professional executive briefing.',
    variables: ['entityName', 'notesContext'],
    aiModels: ['googleai/gemini-2.0-flash']
  }
};

/**

 * Replaces {{variable}} placeholders with actual values.
 */
export function compileTemplate(template: string, variables: Record<string, string>): string {
  let compiled = template;
  for (const [key, value] of Object.entries(variables)) {
    // Escapes special characters for RegExp
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    compiled = compiled.replace(new RegExp(`{{\\s*${escapedKey}\\s*}}`, 'g'), value);
  }
  return compiled;
}

interface ResolvedPrompt {
  systemInstructions: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  aiModels: string[];
}

interface CacheEntry {
  config: BasePromptConfig;
  expiresAt: number;
}

const configCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 1000; // 15 seconds in-memory TTL

async function fetchPromptConfigFromDb(
  flowName: string,
  organizationId: string,
  workspaceId: string
): Promise<BasePromptConfig | null> {
  // 1. Check Workspace Override
  if (workspaceId) {
    const wsSnap = await adminDb
      .collection('prompts')
      .where('workspaceId', '==', workspaceId)
      .where('flowName', '==', flowName)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (!wsSnap.empty) {
      return wsSnap.docs[0].data() as BasePromptConfig;
    }
  }

  // 2. Check Organization Override
  if (organizationId) {
    const orgSnap = await adminDb
      .collection('prompts')
      .where('organizationId', '==', organizationId)
      .where('workspaceId', '==', '')
      .where('flowName', '==', flowName)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (!orgSnap.empty) {
      return orgSnap.docs[0].data() as BasePromptConfig;
    }
  }

  // 3. Check Global Template (Backoffice)
  const globalSnap = await adminDb.collection('global_prompts').doc(flowName).get();
  if (globalSnap.exists) {
    return globalSnap.data() as BasePromptConfig;
  }

  return null;
}

/**
 * Resolves a prompt by checking:
 * 1. Workspace override
 * 2. Organization override
 * 3. Global template (Backoffice)
 * 4. Hardcoded codebase default
 * 
 * Uses configuration caching to prevent database roundtrips.
 */
export async function resolveAndCompilePrompt(
  flowName: string,
  organizationId: string,
  workspaceId: string,
  variables: Record<string, string>
): Promise<ResolvedPrompt> {
  const cacheKey = `${flowName}:${organizationId}:${workspaceId}`;
  let config: BasePromptConfig | null = null;

  try {
    const cached = configCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      config = cached.config;
    } else {
      config = await fetchPromptConfigFromDb(flowName, organizationId, workspaceId);
      if (config) {
        configCache.set(cacheKey, { config, expiresAt: Date.now() + CACHE_TTL_MS });
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`>>> [PMS] Resolver cache/DB read failed for "${flowName}":`, msg);
  }

  const resolved: BasePromptConfig = config || NATIVE_DEFAULTS[flowName] || {
    systemPrompt: 'You are a helpful assistant.',
    userPromptTemplate: 'Process this request: {{input}}',
    variables: ['input'],
    aiModels: ['googleai/gemini-2.0-flash']
  };

  return {
    systemInstructions: compileTemplate(resolved.systemPrompt, variables),
    userPrompt: compileTemplate(resolved.userPromptTemplate, variables),
    temperature: resolved.temperature,
    maxTokens: resolved.maxTokens,
    aiModels: resolved.aiModels || ['googleai/gemini-2.0-flash']
  };
}
