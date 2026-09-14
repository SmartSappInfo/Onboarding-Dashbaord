import { describe, it, expect } from 'vitest';
import {
  isSlashTriggerMatch,
  resolveSlashInsertion,
  sanitizeSearchQuery,
} from '@/app/admin/automations/components/MappableInputField';

/**
 * ARCHITECTURAL VERIFICATION SUITE: Rule 10 Alignment
 * Tests slash trigger detection and variable insertion geometry for MappableInputField.
 */
describe('MappableInputField - Slash Trigger Engine', () => {
  describe('isSlashTriggerMatch', () => {
    it('returns true when "/" is typed at the very beginning of text', () => {
      expect(isSlashTriggerMatch('/', 1)).toBe(true);
    });

    it('returns true when "/" is typed after whitespace', () => {
      // Space before slash
      expect(isSlashTriggerMatch('Hello /', 7)).toBe(true);
      // Newline before slash (user screenshot scenario)
      const newlineText = 'Kindly Check to ensure contact details are correct:\n/';
      expect(isSlashTriggerMatch(newlineText, newlineText.length)).toBe(true);
      // Tab before slash
      expect(isSlashTriggerMatch('\t/', 2)).toBe(true);
    });

    it('returns true when "/" is preceded by opening brackets', () => {
      expect(isSlashTriggerMatch('(/', 2)).toBe(true);
      expect(isSlashTriggerMatch('echo [/', 7)).toBe(true);
      expect(isSlashTriggerMatch('{/', 2)).toBe(true);
    });

    it('returns false when "/" is embedded inside a word (e.g. and/or, w/o)', () => {
      // "and/or" - cursor right after slash at index 4
      expect(isSlashTriggerMatch('and/or', 4)).toBe(false);
      // "w/o" - cursor right after slash at index 2
      expect(isSlashTriggerMatch('w/o', 2)).toBe(false);
      // "path/to" - cursor right after slash at index 5
      expect(isSlashTriggerMatch('path/to', 5)).toBe(false);
    });

    it('returns false when "/" is preceded by digits (e.g. 1/2, 2024/09)', () => {
      expect(isSlashTriggerMatch('1/2', 2)).toBe(false);
      expect(isSlashTriggerMatch('2024/09', 5)).toBe(false);
    });

    it('returns false when "/" is part of a URL or double-slash', () => {
      expect(isSlashTriggerMatch('//', 2)).toBe(false);
      expect(isSlashTriggerMatch('http://', 6)).toBe(false);
      expect(isSlashTriggerMatch('https://', 7)).toBe(false);
    });

    it('returns false for invalid cursor positions or non-slash characters', () => {
      expect(isSlashTriggerMatch('hello', 0)).toBe(false);
      expect(isSlashTriggerMatch('hello', 3)).toBe(false);
      expect(isSlashTriggerMatch('hello', 10)).toBe(false);
      expect(isSlashTriggerMatch('', 1)).toBe(false);
    });
  });

  describe('resolveSlashInsertion', () => {
    it('cleanly replaces triggering slash with {{variable}} at the end of text', () => {
      const text = 'Kindly check details:\n/';
      const cursor = text.length; // cursor right after '/'
      const result = resolveSlashInsertion(text, cursor, cursor, 'first_name', true, cursor - 1);

      expect(result.nextValue).toBe('Kindly check details:\n{{first_name}}');
      expect(result.nextCursorPos).toBe('Kindly check details:\n{{first_name}}'.length);
    });

    it('cleanly replaces triggering slash when slash is at the very beginning of the field', () => {
      const text = '/';
      const result = resolveSlashInsertion(text, 1, 1, 'contact.email', true, 0);

      expect(result.nextValue).toBe('{{contact.email}}');
      expect(result.nextCursorPos).toBe('{{contact.email}}'.length);
    });

    it('replaces triggering slash in the middle of text and preserves downstream text', () => {
      const text = 'Hello / world';
      const cursorPos = 7; // after '/'
      const slashIndex = 6; // index of '/'
      const result = resolveSlashInsertion(text, cursorPos, cursorPos, 'user_name', true, slashIndex);

      expect(result.nextValue).toBe('Hello {{user_name}} world');
      expect(result.nextCursorPos).toBe('Hello {{user_name}}'.length);
    });

    it('handles slash trigger when slashIndex ref was null but char before cursor is "/"', () => {
      const text = 'Subject: /';
      const cursor = 10;
      const result = resolveSlashInsertion(text, cursor, cursor, 'ticket_id', true, null);

      expect(result.nextValue).toBe('Subject: {{ticket_id}}');
      expect(result.nextCursorPos).toBe('Subject: {{ticket_id}}'.length);
    });

    it('does NOT delete any characters when variable was chosen via button click (isSlashTrigger = false)', () => {
      const text = 'Hello / world';
      const cursorPos = 13; // at end of world
      const result = resolveSlashInsertion(text, cursorPos, cursorPos, 'company', false, null);

      expect(result.nextValue).toBe('Hello / world{{company}}');
      expect(result.nextCursorPos).toBe('Hello / world{{company}}'.length);
    });

    it('replaces active range selection when triggered via button or bracket', () => {
      const text = 'Hello [REPLACE_ME] world';
      const start = 6;
      const end = 18;
      const result = resolveSlashInsertion(text, start, end, 'first_name', false, null);

      expect(result.nextValue).toBe('Hello {{first_name}} world');
      expect(result.nextCursorPos).toBe('Hello {{first_name}}'.length);
    });
  });

  describe('sanitizeSearchQuery', () => {
    it('strips single or multiple leading slashes from search query', () => {
      expect(sanitizeSearchQuery('/')).toBe('');
      expect(sanitizeSearchQuery('//')).toBe('');
      expect(sanitizeSearchQuery('///')).toBe('');
      expect(sanitizeSearchQuery('/email')).toBe('email');
      expect(sanitizeSearchQuery('//phone')).toBe('phone');
    });

    it('preserves query strings without leading slashes', () => {
      expect(sanitizeSearchQuery('first_name')).toBe('first_name');
      expect(sanitizeSearchQuery('headers.accept')).toBe('headers.accept');
      expect(sanitizeSearchQuery('active entity')).toBe('active entity');
    });

    it('trims surrounding whitespace while stripping leading slash', () => {
      expect(sanitizeSearchQuery('   /name   ')).toBe('name');
      expect(sanitizeSearchQuery('   /   ')).toBe('');
      expect(sanitizeSearchQuery('')).toBe('');
    });
  });
});
