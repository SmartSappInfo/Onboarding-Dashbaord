import { describe, it, expect } from 'vitest';
import {
  getTimeOfDayGreeting,
  extractFirstName,
  formatGreetingHeadline,
  buildHeroSubtitle,
} from '../greeting-utils';

describe('greeting-utils', () => {
  describe('getTimeOfDayGreeting', () => {
    it('returns "Good morning" between 05:00 and 11:59', () => {
      expect(getTimeOfDayGreeting(new Date('2026-10-09T05:00:00'))).toBe('Good morning');
      expect(getTimeOfDayGreeting(new Date('2026-10-09T09:30:00'))).toBe('Good morning');
      expect(getTimeOfDayGreeting(new Date('2026-10-09T11:59:59'))).toBe('Good morning');
    });

    it('returns "Good afternoon" between 12:00 and 16:59', () => {
      expect(getTimeOfDayGreeting(new Date('2026-10-09T12:00:00'))).toBe('Good afternoon');
      expect(getTimeOfDayGreeting(new Date('2026-10-09T14:45:00'))).toBe('Good afternoon');
      expect(getTimeOfDayGreeting(new Date('2026-10-09T16:59:59'))).toBe('Good afternoon');
    });

    it('returns "Good evening" between 17:00 and 04:59', () => {
      expect(getTimeOfDayGreeting(new Date('2026-10-09T17:00:00'))).toBe('Good evening');
      expect(getTimeOfDayGreeting(new Date('2026-10-09T22:15:00'))).toBe('Good evening');
      expect(getTimeOfDayGreeting(new Date('2026-10-09T00:00:00'))).toBe('Good evening');
      expect(getTimeOfDayGreeting(new Date('2026-10-09T04:59:59'))).toBe('Good evening');
    });
  });

  describe('extractFirstName', () => {
    it('extracts first name from full name string', () => {
      expect(extractFirstName('Sarah Mensah')).toBe('Sarah');
      expect(extractFirstName('Kwame Kofi Asante')).toBe('Kwame');
    });

    it('handles single names cleanly', () => {
      expect(extractFirstName('Sarah')).toBe('Sarah');
      expect(extractFirstName('  Sarah  ')).toBe('Sarah');
    });

    it('returns fallback when name is null, undefined, or empty', () => {
      expect(extractFirstName(null)).toBe('Team Member');
      expect(extractFirstName(undefined)).toBe('Team Member');
      expect(extractFirstName('')).toBe('Team Member');
      expect(extractFirstName('   ')).toBe('Team Member');
      expect(extractFirstName(undefined, 'Admin')).toBe('Admin');
    });
  });

  describe('formatGreetingHeadline', () => {
    it('combines greeting, first name, and wave emoji', () => {
      const morningDate = new Date('2026-10-09T08:00:00');
      expect(formatGreetingHeadline('Sarah Mensah', morningDate)).toBe('Good morning, Sarah 👋');
      expect(formatGreetingHeadline(null, morningDate)).toBe('Good morning, Team Member 👋');
    });
  });

  describe('buildHeroSubtitle', () => {
    it('incorporates singular entity terminology in lowercase', () => {
      expect(buildHeroSubtitle('School')).toBe(
        'Your AI-powered messaging hub for stronger school communities and better engagement.'
      );
      expect(buildHeroSubtitle('Campus')).toBe(
        'Your AI-powered messaging hub for stronger campus communities and better engagement.'
      );
    });

    it('falls back to school when entity term is missing or empty', () => {
      expect(buildHeroSubtitle(undefined)).toBe(
        'Your AI-powered messaging hub for stronger school communities and better engagement.'
      );
      expect(buildHeroSubtitle('')).toBe(
        'Your AI-powered messaging hub for stronger school communities and better engagement.'
      );
    });
  });
});
