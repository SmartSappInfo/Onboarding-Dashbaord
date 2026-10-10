import { describe, it, expect } from 'vitest';
import { calculateContactHygieneScore } from '../contact-hygiene';

describe('calculateContactHygieneScore', () => {
  it('returns High Quality (100%) when all contact fields and engagement are valid', () => {
    const result = calculateContactHygieneScore({
      email: 'rosline@solidrock.edu',
      phone: '+233244123456',
      name: 'Rosline Ackah',
      entityName: 'Solid Rock Academy',
      status: 'active',
      deliveredCount: 5,
    });

    expect(result.score).toBe(100);
    expect(result.label).toBe('High Quality');
    expect(result.color).toContain('emerald');
  });

  it('calculates score accurately with partial fields (e.g. email and phone only)', () => {
    const result = calculateContactHygieneScore({
      email: 'user@example.com',
      phone: '0244123456',
      name: '',
      entityName: '',
    });

    // 25 (email) + 25 (phone) = 50%
    expect(result.score).toBe(50);
    expect(result.label).toBe('Fair');
    expect(result.color).toContain('blue');
  });

  it('returns Needs Review when contact has only an invalid or minimal field', () => {
    const result = calculateContactHygieneScore({
      email: 'invalid-email',
      phone: '123', // too short (< 7 digits)
      name: 'A', // too short (< 2 chars)
    });

    // clamped to minimum 10
    expect(result.score).toBe(10);
    expect(result.label).toBe('Needs Review');
    expect(result.color).toContain('amber');
  });

  it('rewards delivered message history in hygiene evaluation', () => {
    const withoutHistory = calculateContactHygieneScore({
      email: 'test@domain.com',
      name: 'Jane Doe',
    });

    const withHistory = calculateContactHygieneScore({
      email: 'test@domain.com',
      name: 'Jane Doe',
      deliveredCount: 3,
    });

    expect(withHistory.score).toBeGreaterThan(withoutHistory.score);
    expect(withHistory.score - withoutHistory.score).toBe(10);
  });
});
