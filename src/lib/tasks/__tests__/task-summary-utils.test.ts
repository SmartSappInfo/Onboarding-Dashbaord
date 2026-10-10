import { describe, it, expect } from 'vitest';
import { generateTaskBaseSummary, sanitizeTaskErrorMessage } from '../task-summary-utils';

describe('task-summary-utils', () => {
  describe('generateTaskBaseSummary', () => {
    it('summarizes task title, target institution, and time (time only, not date)', () => {
      const summary = generateTaskBaseSummary({
        title: 'Phone Call',
        entityName: 'St. Patrick High',
        timeStr: '2:30 PM',
      });
      expect(summary).toBe('Phone Call for St. Patrick High at 2:30 PM');
    });

    it('formats time from a Date object without including date numbers or months', () => {
      const date = new Date('2026-10-10T15:45:00');
      const summary = generateTaskBaseSummary({
        title: 'Site Visit',
        entityName: 'Greenwood Academy',
        time: date,
      });
      // Should match "Site Visit for Greenwood Academy at [time] PM/AM"
      expect(summary).toMatch(/^Site Visit for Greenwood Academy at \d{1,2}:\d{2}\s+(AM|PM)$/i);
      expect(summary).not.toContain('2026');
      expect(summary).not.toContain('Oct');
    });

    it('handles missing title by defaulting to Task', () => {
      const summary = generateTaskBaseSummary({
        title: '',
        entityName: 'Lincoln College',
        timeStr: '11:00 AM',
      });
      expect(summary).toBe('Task for Lincoln College at 11:00 AM');
    });

    it('handles missing target entity by summarizing title and time', () => {
      const summary = generateTaskBaseSummary({
        title: 'Quarterly Review',
        entityName: '',
        timeStr: '4:00 PM',
      });
      expect(summary).toBe('Quarterly Review at 4:00 PM');
    });

    it('handles missing time by summarizing title and target entity', () => {
      const summary = generateTaskBaseSummary({
        title: 'Document Inspection',
        entityName: 'Apex Health',
      });
      expect(summary).toBe('Document Inspection for Apex Health');
    });

    it('returns empty string when all inputs are empty or blank', () => {
      expect(generateTaskBaseSummary({ title: '', entityName: '', timeStr: '' })).toBe('');
      expect(generateTaskBaseSummary({})).toBe('');
    });
  });

  describe('sanitizeTaskErrorMessage', () => {
    it('translates taskId Too small zod validation error into clear user feedback', () => {
      const raw = 'Invalid input: taskId: Too small: expected string to have >=1 characters';
      const sanitized = sanitizeTaskErrorMessage(raw);
      expect(sanitized).toBe('Unable to update task because the task reference is invalid. Please try creating a new task.');
    });

    it('cleans generic Invalid input prefix into readable instruction', () => {
      const raw = 'Invalid input: title: String must contain at least 1 character(s)';
      const sanitized = sanitizeTaskErrorMessage(raw);
      expect(sanitized).toBe('Please review task details: title: String must contain at least 1 character(s)');
    });

    it('provides safe fallback on null or empty message', () => {
      expect(sanitizeTaskErrorMessage(null)).toBe('Unable to save task. Please verify your details and try again.');
      expect(sanitizeTaskErrorMessage('')).toBe('Unable to save task. Please verify your details and try again.');
    });

    it('preserves clean user-facing error messages as-is', () => {
      const message = 'Workspace permissions required to edit tasks.';
      expect(sanitizeTaskErrorMessage(message)).toBe(message);
    });
  });
});
