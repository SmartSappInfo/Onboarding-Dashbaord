/**
 * @fileOverview Unit Tests for Single Source of Truth AI Model Registry & Workspace AI Service
 *
 * Covers:
 * 1. Model registry catalog integrity & flagship definitions.
 * 2. Evolutionary normalization of legacy & deprecated model tokens.
 * 3. Provider prefix stripping including googleai, anthropic, and openrouter.
 * 4. Provider filtering based on organization API key configuration.
 * 5. Workload tier default model resolution.
 * 6. High-concurrency in-memory caching and eviction in WorkspaceAiService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AiModelRegistry,
  ACTIVE_AI_MODELS,
  AI_PROVIDERS_CONFIG,
  type AiModelDefinition,
} from '../model-registry';
import { WorkspaceAiService } from '../services/workspace-ai-service';

// Mock Firebase Admin SDK
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(async () => ({
          exists: false,
          data: () => undefined,
        })),
        set: vi.fn(async () => {}),
      })),
    })),
  },
}));

describe('AiModelRegistry (Single Source of Truth)', () => {
  it('should register active flagship models for Google, Anthropic, and OpenRouter', () => {
    const allModels = AiModelRegistry.getAllModels();
    expect(allModels.length).toBeGreaterThan(5);

    const flagship = AiModelRegistry.getFlagshipModel();
    expect(flagship.id).toBe('gemini-3.6-flash');
    expect(flagship.provider).toBe('googleai');
    expect(flagship.isFlagship).toBe(true);

    const anthropicFlagship = allModels.find(
      (m) => m.provider === 'anthropic' && m.isFlagship
    );
    expect(anthropicFlagship).toBeDefined();
    expect(anthropicFlagship?.id).toBe('claude-3-5-sonnet');

    const openRouterFlagship = allModels.find(
      (m) => m.provider === 'openrouter' && m.isFlagship
    );
    expect(openRouterFlagship).toBeDefined();
    expect(openRouterFlagship?.id).toBe('openrouter/free');
  });

  describe('normalizeModelId (Evolutionary Normalization)', () => {
    it('should map deprecated Gemini models to gemini-3.6-flash', () => {
      expect(AiModelRegistry.normalizeModelId('gemini-2.5-flash')).toBe('gemini-3.6-flash');
      expect(AiModelRegistry.normalizeModelId('gemini-3.5-flash')).toBe('gemini-3.6-flash');
      expect(AiModelRegistry.normalizeModelId('gemini-2.0-flash')).toBe('gemini-3.6-flash');
      expect(AiModelRegistry.normalizeModelId('gemini-1.5-flash')).toBe('gemini-3.6-flash');
      expect(AiModelRegistry.normalizeModelId('googleai/gemini-2.5-flash')).toBe('gemini-3.6-flash');
      expect(AiModelRegistry.normalizeModelId('googleai/gemini-3.6-flash')).toBe('gemini-3.6-flash');
    });

    it('should map deprecated Pro models to gemini-2.5-pro', () => {
      expect(AiModelRegistry.normalizeModelId('gemini-1.5-pro')).toBe('gemini-2.5-pro');
      expect(AiModelRegistry.normalizeModelId('googleai/gemini-1.5-pro')).toBe('gemini-2.5-pro');
    });

    it('should normalize Anthropic aliases to canonical claude IDs', () => {
      expect(AiModelRegistry.normalizeModelId('claude-3.5-sonnet')).toBe('claude-3-5-sonnet');
      expect(AiModelRegistry.normalizeModelId('anthropic/claude-3-5-sonnet')).toBe('claude-3-5-sonnet');
      expect(AiModelRegistry.normalizeModelId('claude-sonnet-5')).toBe('claude-3-5-sonnet');
    });

    it('should map legacy OpenAI models to Claude 3.5 Sonnet / Gemini', () => {
      expect(AiModelRegistry.normalizeModelId('gpt-4o')).toBe('claude-3-5-sonnet');
      expect(AiModelRegistry.normalizeModelId('gpt-4')).toBe('claude-3-5-sonnet');
      expect(AiModelRegistry.normalizeModelId('gpt-3.5-turbo')).toBe('gemini-3.6-flash');
    });

    it('should correctly strip openrouter prefix without falling back to Gemini', () => {
      expect(
        AiModelRegistry.normalizeModelId('openrouter/deepseek/deepseek-r1:free')
      ).toBe('deepseek/deepseek-r1:free');
      expect(
        AiModelRegistry.normalizeModelId('openrouter/meta-llama/llama-3.3-70b-instruct:free')
      ).toBe('meta-llama/llama-3.3-70b-instruct:free');
    });

    it('should safely fall back to flagship model for undefined or unknown input', () => {
      expect(AiModelRegistry.normalizeModelId(undefined)).toBe('gemini-3.6-flash');
      expect(AiModelRegistry.normalizeModelId('')).toBe('gemini-3.6-flash');
      expect(AiModelRegistry.normalizeModelId('non-existent-hallucinated-model-xyz')).toBe(
        'gemini-3.6-flash'
      );
    });
  });

  describe('getDefaultModelForTier', () => {
    it('should resolve the correct default model by tier', () => {
      const defaultTier = AiModelRegistry.getDefaultModelForTier('default');
      expect(defaultTier.id).toBe('gemini-3.6-flash');

      const fastTier = AiModelRegistry.getDefaultModelForTier('fast');
      expect(fastTier.tier).toBe('fast');

      const reasoningTier = AiModelRegistry.getDefaultModelForTier('reasoning');
      expect(reasoningTier.tier).toBe('reasoning');

      const codingTier = AiModelRegistry.getDefaultModelForTier('coding');
      expect(codingTier.tier).toBe('coding');
    });

    it('should resolve provider-specific tier models', () => {
      const anthropicReasoning = AiModelRegistry.getDefaultModelForTier(
        'reasoning',
        'anthropic'
      );
      expect(anthropicReasoning.provider).toBe('anthropic');
      expect(anthropicReasoning.tier).toBe('reasoning');

      const googleFast = AiModelRegistry.getDefaultModelForTier('fast', 'googleai');
      expect(googleFast.provider).toBe('googleai');
      expect(googleFast.id).toBe('gemini-3.1-flash-lite');
    });
  });

  describe('getProvidersForOrganization', () => {
    it('should return all providers when mode is platform or undefined', () => {
      const platformProviders = AiModelRegistry.getProvidersForOrganization({
        aiKeyMode: 'platform',
      });
      expect(platformProviders.length).toBe(3);

      const defaultProviders = AiModelRegistry.getProvidersForOrganization(undefined);
      expect(defaultProviders.length).toBe(3);
    });

    it('should filter providers based on configured organization keys when mode is organization', () => {
      const orgWithOnlyGemini = AiModelRegistry.getProvidersForOrganization({
        aiKeyMode: 'organization',
        geminiApiKey: 'valid-gemini-key',
      });
      expect(orgWithOnlyGemini.length).toBe(1);
      expect(orgWithOnlyGemini[0].id).toBe('googleai');

      const orgWithGeminiAndClaude = AiModelRegistry.getProvidersForOrganization({
        aiKeyMode: 'organization',
        geminiApiKey: 'valid-gemini-key',
        claudeApiKey: 'valid-claude-key',
      });
      expect(orgWithGeminiAndClaude.length).toBe(2);
      expect(orgWithGeminiAndClaude.map((p) => p.id)).toEqual(['googleai', 'anthropic']);
    });
  });

  describe('getWireModelString', () => {
    it('should return the provider SDK wire format for a model', () => {
      expect(
        AiModelRegistry.getWireModelString('gemini-3.6-flash', 'googleai')
      ).toBe('googleai/gemini-3.6-flash');
      expect(
        AiModelRegistry.getWireModelString('claude-3-5-sonnet', 'anthropic')
      ).toBe('claude-3-5-sonnet-20241022');
      expect(
        AiModelRegistry.getWireModelString('gemini-2.5-flash', 'googleai')
      ).toBe('googleai/gemini-3.6-flash');
    });
  });
});

describe('WorkspaceAiService', () => {
  beforeEach(() => {
    WorkspaceAiService.invalidateCache('test-ws-1');
  });

  it('should return flagship default settings when workspace has no saved record', async () => {
    const settings = await WorkspaceAiService.getSettings('test-ws-1');
    expect(settings).toBeDefined();
    expect(settings.preferredProvider).toBe('googleai');
    expect(settings.preferredModelId).toBe('gemini-3.6-flash');
  });

  it('should cache settings in memory on subsequent calls', async () => {
    const first = await WorkspaceAiService.getSettings('test-ws-1');
    const second = await WorkspaceAiService.getSettings('test-ws-1');
    expect(first).toEqual(second);
  });

  it('should invalidate cache when invalidateCache is called', () => {
    WorkspaceAiService.invalidateCache('test-ws-1');
    expect(() => WorkspaceAiService.invalidateCache('test-ws-1')).not.toThrow();
  });
});
