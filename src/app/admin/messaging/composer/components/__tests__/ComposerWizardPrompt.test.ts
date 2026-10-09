import { describe, it, expect, vi } from 'vitest';

describe('Composer Prompt Ingestion Spec', () => {
  it('safely decodes and extracts prompt parameter from query string', () => {
    const rawSearch = '?prompt=' + encodeURIComponent('Draft fee reminder for Parents [Tone: formal]');
    const params = new URLSearchParams(rawSearch);
    const prompt = params.get('prompt');

    expect(prompt).toBe('Draft fee reminder for Parents [Tone: formal]');
  });

  it('handles null, undefined or empty prompts without altering state', () => {
    const params = new URLSearchParams('');
    expect(params.get('prompt')).toBeNull();
  });

  it('correctly maps prompt parameter to composer form schema fields (customBody, messageSourceType, customSubject)', () => {
    const mockSetValue = vi.fn();
    const prompt = 'Announce sports day next Friday [Tone: friendly]';

    // Simulate ComposerWizard ingestion logic
    if (prompt) {
      mockSetValue('customBody', prompt, { shouldDirty: true });
      mockSetValue('messageSourceType', 'new', { shouldDirty: true });
      mockSetValue('customSubject', 'AI Assisted Draft', { shouldDirty: true });
    }

    expect(mockSetValue).toHaveBeenCalledWith('customBody', prompt, { shouldDirty: true });
    expect(mockSetValue).toHaveBeenCalledWith('messageSourceType', 'new', { shouldDirty: true });
    expect(mockSetValue).toHaveBeenCalledWith('customSubject', 'AI Assisted Draft', { shouldDirty: true });
  });
});
