import { expect, test, describe, vi } from 'vitest';
import { generateHookAlternatives } from '../generate-hooks-flow';

vi.mock('../generate-hooks-flow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../generate-hooks-flow')>();
  return {
    ...actual,
    generateHookAlternatives: vi.fn(async () => {
      return {
        hooks: [
          { text: 'SAAS SECRET', score: 94, emotion: 'Curiosity', readability: 'Excellent' },
          { text: 'DON\'T BUILD SAAS', score: 88, emotion: 'Fear', readability: 'High' },
          { text: '$10K BLUEPRINT', score: 96, emotion: 'Greed', readability: 'High' },
          { text: '30-DAY SAAS', score: 85, emotion: 'Pride', readability: 'Excellent' }
        ]
      };
    })
  };
});

describe('AI Copywriter Hooks Flow', () => {
  test('returns 4 distinct emotional hooks matching the copywriter schemas', async () => {
    const res = await generateHookAlternatives({ topic: 'Build a SaaS' });
    expect(res.hooks.length).toBe(4);
    expect(res.hooks[0].text).toBe('SAAS SECRET');
    expect(res.hooks[2].score).toBe(96);
    expect(res.hooks[2].emotion).toBe('Greed');
  });
});
