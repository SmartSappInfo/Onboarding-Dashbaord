import { describe, it, expect } from 'vitest';
import { analyzeHeadline } from '../services/headline-iq';

describe('HeadlineIQ Static Scoring Engine', () => {
  it('should handle empty input gracefully', () => {
    const result = analyzeHeadline('');
    expect(result.score).toBe(0);
    expect(result.checklist[0].message).toContain('begin analysis');
  });

  it('should score an optimal length headline without tags or power words around 50-80', () => {
    const result = analyzeHeadline('This is a standard subject line that matches length.');
    // 50 (base) + 30 (length) = 80
    expect(result.score).toBe(80);
    expect(result.checklist.some(c => c.type === 'success' && c.message.includes('optimal length'))).toBe(true);
  });

  it('should penalize a subject line that is too short', () => {
    const result = analyzeHeadline('Hi');
    expect(result.score).toBeLessThan(50); // 50 - 20 = 30
    expect(result.checklist.some(c => c.type === 'error' && c.message.includes('short'))).toBe(true);
  });

  it('should penalize a subject line that is too long', () => {
    const result = analyzeHeadline('This is an extremely long subject line that exceeds the maximum recommended character length of eighty characters in total');
    expect(result.score).toBeLessThan(50);
    expect(result.checklist.some(c => c.type === 'error' && c.message.includes('Too long'))).toBe(true);
  });

  it('should give a boost for personalization variables', () => {
    const result = analyzeHeadline('Welcome to the team, {{contact_name}}!');
    // 50 (base) + 30 (optimal length) + 15 (personalization) = 95
    expect(result.score).toBe(95);
    expect(result.checklist.some(c => c.type === 'success' && c.message.includes('Personalization is active'))).toBe(true);
  });

  it('should match power words and boost score', () => {
    const result = analyzeHeadline('Discover the proven secret to unlock growth');
    // 50 (base) + 30 (optimal length) + 20 (4 power words: discover, proven, secret, unlock) = 100
    expect(result.score).toBe(100);
    expect(result.checklist.some(c => c.type === 'success' && c.message.includes('power/emotional'))).toBe(true);
  });

  it('should penalize spam words', () => {
    const result = analyzeHeadline('Get guaranteed cash 100% free');
    // 50 (base) + 30 (optimal length) - 45 (spam: guaranteed, cash, 100% free) = 35
    expect(result.score).toBeLessThan(50);
    expect(result.checklist.some(c => c.type === 'error' && c.message.includes('spam'))).toBe(true);
  });

  it('should penalize all-caps titles', () => {
    const result = analyzeHeadline('WELCOME TO THE NEW ONBOARDING PORTAL');
    expect(result.checklist.some(c => c.type === 'error' && c.message.includes('caps'))).toBe(true);
  });

  it('should penalize excess punctuation', () => {
    const result = analyzeHeadline('Are you ready to join us today!!!');
    expect(result.checklist.some(c => c.type === 'warning' && c.message.includes('exclamation'))).toBe(true);
  });
});
