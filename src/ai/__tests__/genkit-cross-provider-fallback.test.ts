// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.unmock('@/ai/genkit');

const { mockAnthropicGenerate, mockGoogleAiGenerate } = vi.hoisted(() => ({
  mockAnthropicGenerate: vi.fn(),
  mockGoogleAiGenerate: vi.fn(),
}));

vi.mock('genkit', () => ({
  genkit: vi.fn(({ plugins }) => {
    // If googleAI is in plugins
    const hasGoogleAI = plugins?.some((p: { name?: string }) => p?.name === 'googleai');
    if (hasGoogleAI) {
      return {
        generate: mockGoogleAiGenerate,
      };
    }
    return {
      generate: mockAnthropicGenerate,
    };
  }),
}));

vi.mock('@genkit-ai/google-genai', () => ({
  googleAI: vi.fn(() => ({ name: 'googleai' })),
}));

vi.mock('@genkit-ai/anthropic', () => ({
  anthropic: vi.fn(() => ({ name: 'anthropic' })),
}));

vi.mock('@genkit-ai/compat-oai', () => ({
  openAICompatible: vi.fn(() => ({ name: 'openrouter' })),
}));

vi.mock('@/lib/backoffice/audit-logger', () => ({
  logBackofficeAction: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((colName: string) => ({
      doc: vi.fn((docId: string) => ({
        get: vi.fn(async () => {
          if (colName === 'organizations' && docId === 'org_test_fallback') {
            return {
              exists: true,
              data: () => ({
                geminiApiKey: 'sealed_gemini_key_123',
                claudeApiKey: 'sealed_claude_key_expired',
              }),
            };
          }
          if (colName === 'system_settings' && docId === 'ai_keys') {
            return {
              exists: true,
              data: () => ({
                geminiApiKey: 'sealed_backoffice_gemini_key',
              }),
            };
          }
          return { exists: false, data: () => undefined };
        }),
      })),
    })),
  },
}));

vi.mock('@/lib/backoffice/secret-vault', () => ({
  openSecret: vi.fn((val: unknown) => (typeof val === 'string' ? `unsealed_${val}` : undefined)),
}));

import { getModel } from '../genkit';

describe('Genkit Multi-Provider Cross-Fallback Proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes to a Google AI Genkit instance when Anthropic generation fails with 401 error', async () => {
    // Anthropic fails with auth error
    mockAnthropicGenerate.mockRejectedValueOnce(new Error('401 UNAUTHENTICATED: Invalid x-api-key provided'));

    // Google AI succeeds on fallback
    mockGoogleAiGenerate.mockResolvedValueOnce({
      output: { message: 'Successfully recovered via Gemini Flash fallback!' },
    });

    const modelInstance = await getModel({
      organizationId: 'org_test_fallback',
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
    });

    expect(modelInstance.customAi).toBeDefined();

    const result = await modelInstance.customAi?.generate({
      model: modelInstance.modelString,
      prompt: 'Hello AI',
    });

    expect(mockAnthropicGenerate).toHaveBeenCalledTimes(1);
    expect(mockGoogleAiGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'googleai/gemini-2.5-flash',
        prompt: 'Hello AI',
      })
    );
    expect(result?.output).toEqual({
      message: 'Successfully recovered via Gemini Flash fallback!',
    });
  });

  it('re-throws error if all fallback candidates fail', async () => {
    mockAnthropicGenerate.mockRejectedValueOnce(new Error('401 UNAUTHENTICATED: Key revoked'));
    mockGoogleAiGenerate.mockRejectedValue(new Error('Quota exceeded'));

    const modelInstance = await getModel({
      organizationId: 'org_test_fallback',
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet',
    });

    await expect(
      modelInstance.customAi?.generate({
        model: modelInstance.modelString,
        prompt: 'Test failing',
      })
    ).rejects.toThrow('401 UNAUTHENTICATED');
  });
});
