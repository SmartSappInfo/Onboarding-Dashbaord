import { describe, it, expect } from 'vitest';

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
});
