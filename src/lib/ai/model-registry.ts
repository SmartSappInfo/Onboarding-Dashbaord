/**
 * @fileOverview Single Source of Truth AI Model Registry (AiModelRegistry).
 * 
 * ARCHITECTURAL INVARIANTS:
 * - Authoritative catalog of all supported LLMs, providers, capabilities, and operational tiers.
 * - No feature or flow should ever hardcode model strings (e.g. 'gemini-3.6-flash').
 * - When model versions evolve or deprecate, updating this file (or the Backoffice System Defaults)
 *   automatically propagates across all UI selectors, background flows, and Genkit runners.
 * - Pure TypeScript module safe for both Server (RSC / Server Actions / Genkit) and Client environments.
 * 
 * CAUTION FOR FUTURE MAINTAINERS:
 * - When adding new models, ensure `providerModelString` matches the exact API string required by
 *   the provider SDK (e.g. 'claude-3-5-sonnet-20241022' for Anthropic, 'googleai/gemini-3.6-flash' for Genkit Google AI).
 * - Always register evolutionary mappings in `LEGACY_MODEL_NORMALIZATION_MAP` so legacy persisted
 *   database IDs seamlessly resolve to modern models without data migration locks.
 */

export type AiProviderId = 'googleai' | 'anthropic' | 'openrouter';

export type AiModelTier = 'default' | 'reasoning' | 'fast' | 'coding' | 'multimodal';

export interface AiModelCapabilities {
  structuredOutput: boolean;
  toolCalling: boolean;
  vision: boolean;
  codeExecution: boolean;
  maxContextTokens: number;
}

export interface AiModelDefinition {
  id: string;                    // Canonical identifier, e.g. 'gemini-3.6-flash'
  name: string;                  // Human-readable display name, e.g. 'Gemini 3.6 Flash'
  provider: AiProviderId;
  providerModelString: string;   // Wire model identifier (e.g. 'googleai/gemini-3.6-flash')
  description: string;           // Concise UI description
  tier: AiModelTier;             // Primary workload tier
  capabilities: AiModelCapabilities;
  isFlagship?: boolean;          // Primary recommended model for provider
  isDeprecated?: boolean;        // Soft deprecation flag
}

export interface AiProviderDefinition {
  id: AiProviderId;
  name: string;
  badgeColor: string;
  bgColor: string;
  textColor: string;
  iconName: 'Sparkles' | 'Zap' | 'Brain';
  models: readonly AiModelDefinition[];
}

/**
 * Curated list of active models.
 */
export const ACTIVE_AI_MODELS: readonly AiModelDefinition[] = [
  // --- Google Gemini Models ---
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    provider: 'googleai',
    providerModelString: 'googleai/gemini-3.6-flash',
    description: 'Active flagship model. High-speed, exceptional structured output & low latency.',
    tier: 'default',
    capabilities: {
      structuredOutput: true,
      toolCalling: true,
      vision: true,
      codeExecution: true,
      maxContextTokens: 1_000_000,
    },
    isFlagship: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    provider: 'googleai',
    providerModelString: 'googleai/gemini-3.1-flash-lite',
    description: 'Ultra-fast, cost-efficient model for high-frequency lightweight tasks.',
    tier: 'fast',
    capabilities: {
      structuredOutput: true,
      toolCalling: true,
      vision: false,
      codeExecution: false,
      maxContextTokens: 500_000,
    },
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'googleai',
    providerModelString: 'googleai/gemini-2.5-pro',
    description: 'Deep analytical reasoning and comprehensive multi-modal understanding.',
    tier: 'reasoning',
    capabilities: {
      structuredOutput: true,
      toolCalling: true,
      vision: true,
      codeExecution: true,
      maxContextTokens: 2_000_000,
    },
  },

  // --- Anthropic Claude Models ---
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    providerModelString: 'claude-3-5-sonnet-20241022',
    description: 'Industry-leading reasoning, nuanced writing, and complex tool orchestration.',
    tier: 'reasoning',
    capabilities: {
      structuredOutput: true,
      toolCalling: true,
      vision: true,
      codeExecution: false,
      maxContextTokens: 200_000,
    },
    isFlagship: true,
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    providerModelString: 'claude-3-5-haiku-20241022',
    description: 'Rapid responsiveness with high intelligence for agentic workflows.',
    tier: 'fast',
    capabilities: {
      structuredOutput: true,
      toolCalling: true,
      vision: false,
      codeExecution: false,
      maxContextTokens: 200_000,
    },
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    providerModelString: 'claude-3-opus-20240229',
    description: 'Deep synthesis and philosophical reasoning for highly complex dilemmas.',
    tier: 'reasoning',
    capabilities: {
      structuredOutput: true,
      toolCalling: true,
      vision: true,
      codeExecution: false,
      maxContextTokens: 200_000,
    },
  },

  // --- OpenRouter Free Tier ---
  {
    id: 'openrouter/free',
    name: 'Auto Free Router',
    provider: 'openrouter',
    providerModelString: 'openrouter/free',
    description: 'Automatically routes to the highest-availability free open-source model.',
    tier: 'default',
    capabilities: {
      structuredOutput: true,
      toolCalling: false,
      vision: false,
      codeExecution: false,
      maxContextTokens: 32_000,
    },
    isFlagship: true,
  },
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 (Free)',
    provider: 'openrouter',
    providerModelString: 'deepseek/deepseek-r1:free',
    description: 'Open reasoning model specializing in algorithmic derivation and logic.',
    tier: 'reasoning',
    capabilities: {
      structuredOutput: true,
      toolCalling: false,
      vision: false,
      codeExecution: false,
      maxContextTokens: 64_000,
    },
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B (Free)',
    provider: 'openrouter',
    providerModelString: 'meta-llama/llama-3.3-70b-instruct:free',
    description: 'Powerful 70B general instruct model with strong conversational depth.',
    tier: 'default',
    capabilities: {
      structuredOutput: true,
      toolCalling: false,
      vision: false,
      codeExecution: false,
      maxContextTokens: 128_000,
    },
  },
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    name: 'Llama 3.2 3B (Free)',
    provider: 'openrouter',
    providerModelString: 'meta-llama/llama-3.2-3b-instruct:free',
    description: 'Ultra-lightweight edge model for rapid textual extraction.',
    tier: 'fast',
    capabilities: {
      structuredOutput: false,
      toolCalling: false,
      vision: false,
      codeExecution: false,
      maxContextTokens: 32_000,
    },
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct:free',
    name: 'Qwen 2.5 Coder 32B (Free)',
    provider: 'openrouter',
    providerModelString: 'qwen/qwen-2.5-coder-32b-instruct:free',
    description: 'Dedicated coding and technical schema synthesis model.',
    tier: 'coding',
    capabilities: {
      structuredOutput: true,
      toolCalling: false,
      vision: false,
      codeExecution: false,
      maxContextTokens: 64_000,
    },
  },
] as const;

/**
 * Evolutionary normalization mapping for historical or deprecated model identifiers.
 * Guarantees that stale Firestore preferences or legacy config tokens never cause 404s.
 */
const LEGACY_MODEL_NORMALIZATION_MAP: Record<string, string> = {
  // Deprecated Google Gemini models -> Flagship Gemini 3.6 Flash
  'gemini-2.5-flash': 'gemini-3.6-flash',
  'gemini-3.5-flash': 'gemini-3.6-flash',
  'gemini-2.0-flash': 'gemini-3.6-flash',
  'gemini-2.0-flash-exp': 'gemini-3.6-flash',
  'gemini-1.5-flash': 'gemini-3.6-flash',
  'gemini-1.5-flash-8b': 'gemini-3.1-flash-lite',
  'gemini-3.0-flash': 'gemini-3.6-flash',
  'googleai/gemini-2.5-flash': 'gemini-3.6-flash',
  'googleai/gemini-3.5-flash': 'gemini-3.6-flash',
  'googleai/gemini-2.0-flash': 'gemini-3.6-flash',
  'googleai/gemini-1.5-flash': 'gemini-3.6-flash',
  'googleai/gemini-1.5-flash-8b': 'gemini-3.1-flash-lite',
  'googleai/gemini-3.6-flash': 'gemini-3.6-flash',

  // Pro tier normalization
  'gemini-1.5-pro': 'gemini-2.5-pro',
  'googleai/gemini-1.5-pro': 'gemini-2.5-pro',
  'googleai/gemini-2.5-pro': 'gemini-2.5-pro',

  // Anthropic aliases
  'claude-3.5-sonnet': 'claude-3-5-sonnet',
  'claude-sonnet-5': 'claude-3-5-sonnet',
  'anthropic/claude-3-5-sonnet': 'claude-3-5-sonnet',
  'anthropic/claude-3-5-haiku': 'claude-3-5-haiku',
  'anthropic/claude-3-opus': 'claude-3-opus',

  // Legacy OpenAI mappings -> Claude 3.5 Sonnet
  'gpt-4o': 'claude-3-5-sonnet',
  'gpt-4': 'claude-3-5-sonnet',
  'gpt-4-turbo': 'claude-3-5-sonnet',
  'gpt-3.5-turbo': 'gemini-3.6-flash',
};

/**
 * Provider catalog metadata.
 */
export const AI_PROVIDERS_CONFIG: readonly AiProviderDefinition[] = [
  {
    id: 'googleai',
    name: 'Google Gemini',
    badgeColor: 'bg-blue-500/10 border-blue-500/20 text-blue-600',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-500',
    iconName: 'Sparkles',
    models: ACTIVE_AI_MODELS.filter((m) => m.provider === 'googleai'),
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    badgeColor: 'bg-orange-500/10 border-orange-500/20 text-orange-600',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-500',
    iconName: 'Zap',
    models: ACTIVE_AI_MODELS.filter((m) => m.provider === 'anthropic'),
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (Free Tier)',
    badgeColor: 'bg-purple-500/10 border-purple-500/20 text-purple-600',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-500',
    iconName: 'Brain',
    models: ACTIVE_AI_MODELS.filter((m) => m.provider === 'openrouter'),
  },
] as const;

/**
 * Single source of truth model registry interface.
 */
export const AiModelRegistry = {
  /**
   * Returns all active models.
   */
  getAllModels(): readonly AiModelDefinition[] {
    return ACTIVE_AI_MODELS;
  },

  /**
   * Retrieves a model definition by its canonical or normalized ID.
   */
  getModelById(id: string): AiModelDefinition | undefined {
    const normalized = this.normalizeModelId(id);
    return ACTIVE_AI_MODELS.find((m) => m.id === normalized);
  },

  /**
   * Retrieves all active models belonging to a specific provider.
   */
  getModelsByProvider(provider: AiProviderId): readonly AiModelDefinition[] {
    return ACTIVE_AI_MODELS.filter((m) => m.provider === provider);
  },

  /**
   * Returns all supported provider definitions with their associated models.
   */
  getProviders(): readonly AiProviderDefinition[] {
    return AI_PROVIDERS_CONFIG;
  },

  /**
   * Returns providers filtered by an organization's configured API key mode.
   * If the organization uses platform keys ('platform'), all providers with server
   * fallback credentials are returned. If 'organization', only providers with explicit
   * organization keys are returned.
   */
  getProvidersForOrganization(org?: {
    aiKeyMode?: 'organization' | 'platform' | 'custom';
    geminiApiKey?: string;
    claudeApiKey?: string;
    openRouterApiKey?: string;
  }): readonly AiProviderDefinition[] {
    if (!org) {
      return AI_PROVIDERS_CONFIG;
    }

    const mode = org.aiKeyMode || 'platform';
    if (mode === 'platform') {
      // Platform defaults enable all system-supported providers
      return AI_PROVIDERS_CONFIG;
    }

    return AI_PROVIDERS_CONFIG.filter((provider) => {
      if (provider.id === 'googleai') return Boolean(org.geminiApiKey);
      if (provider.id === 'anthropic') return Boolean(org.claudeApiKey);
      if (provider.id === 'openrouter') return Boolean(org.openRouterApiKey);
      return false;
    });
  },

  /**
   * Evolutionary normalization: converts legacy, deprecated, or aliased model strings
   * to active, supported canonical model identifiers.
   */
  normalizeModelId(rawId?: string): string {
    if (!rawId) {
      return this.getFlagshipModel().id;
    }

    const trimmed = rawId.trim();
    if (LEGACY_MODEL_NORMALIZATION_MAP[trimmed]) {
      return LEGACY_MODEL_NORMALIZATION_MAP[trimmed];
    }

    // Direct match check
    const direct = ACTIVE_AI_MODELS.find((m) => m.id === trimmed);
    if (direct) {
      return direct.id;
    }

    // Strip provider prefix if present
    const cleanId = trimmed.replace(/^(googleai|anthropic|openrouter)\//, '');
    if (LEGACY_MODEL_NORMALIZATION_MAP[cleanId]) {
      return LEGACY_MODEL_NORMALIZATION_MAP[cleanId];
    }

    const cleanMatch = ACTIVE_AI_MODELS.find((m) => m.id === cleanId);
    if (cleanMatch) {
      return cleanMatch.id;
    }

    // Safe fallback to flagship
    return this.getFlagshipModel().id;
  },

  /**
   * Resolves the recommended default model for a given workload tier.
   */
  getDefaultModelForTier(tier: AiModelTier, provider?: AiProviderId): AiModelDefinition {
    if (provider) {
      const match = ACTIVE_AI_MODELS.find((m) => m.provider === provider && m.tier === tier);
      if (match) return match;
      const providerFlagship = ACTIVE_AI_MODELS.find((m) => m.provider === provider && m.isFlagship);
      if (providerFlagship) return providerFlagship;
    }

    const tierFlagship = ACTIVE_AI_MODELS.find((m) => m.tier === tier && m.isFlagship);
    if (tierFlagship) return tierFlagship;

    const tierMatch = ACTIVE_AI_MODELS.find((m) => m.tier === tier);
    if (tierMatch) return tierMatch;

    return this.getFlagshipModel();
  },

  /**
   * Returns the system-wide flagship balanced model (Gemini 3.6 Flash).
   */
  getFlagshipModel(): AiModelDefinition {
    const flagship = ACTIVE_AI_MODELS.find((m) => m.id === 'gemini-3.6-flash');
    if (!flagship) {
      throw new Error('[AiModelRegistry] Invariant violation: Flagship model gemini-3.6-flash missing');
    }
    return flagship;
  },

  /**
   * Maps a model ID to its wire format for Genkit / provider APIs.
   */
  getWireModelString(modelId: string, provider: AiProviderId): string {
    const model = this.getModelById(modelId);
    if (model) {
      return model.providerModelString;
    }
    const normalized = this.normalizeModelId(modelId);
    return `${provider}/${normalized}`;
  },
};
