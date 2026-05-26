import { describe, it, expect } from 'vitest';
import {
  formatFieldValue,
  getSubmissionPreview,
  submissionsToCSV,
  normaliseSubmissionData,
  computeSubmissionStats,
} from '../forms-utils';
import type { FormSubmission, AppField } from '../types';

describe('Forms Utilities', () => {
  describe('formatFieldValue', () => {
    it('should format empty or null values to em dash', () => {
      expect(formatFieldValue(null)).toBe('—');
      expect(formatFieldValue(undefined)).toBe('—');
      expect(formatFieldValue('')).toBe('—');
    });

    it('should format array values to comma separated list', () => {
      expect(formatFieldValue(['apple', 'banana'])).toBe('apple, banana');
    });

    it('should format boolean values', () => {
      expect(formatFieldValue(true)).toBe('Yes');
      expect(formatFieldValue(false)).toBe('No');
    });

    it('should format date and datetime values', () => {
      const dateStr = '2026-05-22T12:00:00.000Z';
      expect(formatFieldValue(dateStr, 'date')).toBe('22 May 2026');
      expect(formatFieldValue(dateStr, 'datetime')).toBe('22 May 2026');
    });

    it('should fall back to raw string for invalid dates', () => {
      expect(formatFieldValue('invalid-date', 'date')).toBe('invalid-date');
    });

    it('should stringify numbers and standard strings', () => {
      expect(formatFieldValue(123)).toBe('123');
      expect(formatFieldValue('hello')).toBe('hello');
    });
  });

  describe('getSubmissionPreview', () => {
    const fields = [
      { id: 'f1', name: 'contact_name', variableName: 'contact_name', label: 'Name', type: 'short_text', workspaceId: 'ws-1', organizationId: 'org-1', status: 'active', isNative: false, compatibilityScope: ['person'], createdAt: '' },
      { id: 'f2', name: 'contact_email', variableName: 'contact_email', label: 'Email', type: 'email', workspaceId: 'ws-1', organizationId: 'org-1', status: 'active', isNative: false, compatibilityScope: ['person'], createdAt: '' },
      { id: 'f3', name: 'school_name', variableName: 'school_name', label: 'School Name', type: 'short_text', workspaceId: 'ws-1', organizationId: 'org-1', status: 'active', isNative: false, compatibilityScope: ['person'], createdAt: '' },
      { id: 'f4', name: 'custom_field', variableName: 'custom_field', label: 'Custom Option', type: 'short_text', workspaceId: 'ws-1', organizationId: 'org-1', status: 'active', isNative: false, compatibilityScope: ['person'], createdAt: '' },
    ] as unknown as AppField[];

    it('should prioritize name, email, and school_name in the preview', () => {
      const data = {
        custom_field: 'Some custom val',
        contact_name: 'John Doe',
        contact_email: 'john@example.com',
      };
      const preview = getSubmissionPreview(data, fields, 3);
      expect(preview).toContain('Name: John Doe');
      expect(preview).toContain('Email: john@example.com');
      expect(preview).toContain('Custom Option: Some custom val');
      // Verify correct order or containment
      expect(preview.startsWith('Name: John Doe')).toBe(true);
    });

    it('should fall back to key if field definition is missing', () => {
      const data = {
        unknown_key: 'Secret',
      };
      const preview = getSubmissionPreview(data, fields, 1);
      expect(preview).toBe('unknown_key: Secret');
    });

    it('should handle empty data', () => {
      expect(getSubmissionPreview({}, fields)).toBe('No data');
    });
  });

  describe('submissionsToCSV', () => {
    const fields = [
      { id: 'f1', name: 'name', variableName: 'name', label: 'Full Name', type: 'short_text', workspaceId: 'ws-1', organizationId: 'org-1', status: 'active', isNative: false, compatibilityScope: ['person'], createdAt: '' },
      { id: 'f2', name: 'age', variableName: 'age', label: 'Age', type: 'number', workspaceId: 'ws-1', organizationId: 'org-1', status: 'active', isNative: false, compatibilityScope: ['person'], createdAt: '' },
    ] as unknown as AppField[];

    const submissions: FormSubmission[] = [
      {
        id: 's1',
        formId: 'form-1',
        submittedAt: '2026-05-22T10:00:00Z',
        data: { name: 'John Doe', age: 30 },
        workspaceId: 'ws-1',
        organizationId: 'org-1',
      },
      {
        id: 's2',
        formId: 'form-1',
        submittedAt: '2026-05-22T10:05:00Z',
        data: { name: 'Jane Smith, Jr.', age: 28, extra: 'value' },
        workspaceId: 'ws-1',
        organizationId: 'org-1',
      },
    ];

    it('should output empty string if no submissions', () => {
      expect(submissionsToCSV([], fields)).toBe('');
    });

    it('should generate headers and escape cells correctly', () => {
      const csv = submissionsToCSV(submissions, fields);
      const lines = csv.split('\n');
      
      // Header check
      expect(lines[0]).toBe('Submitted At,Submission ID,Entity ID,Source Page ID,Full Name,Age,extra');
      
      // First line check
      expect(lines[1]).toBe('2026-05-22T10:00:00Z,s1,—,—,John Doe,30,—');
      
      // Second line check (comma in Jane Smith, Jr. should trigger escaping)
      expect(lines[2]).toBe('2026-05-22T10:05:00Z,s2,—,—,"Jane Smith, Jr.",28,value');
    });
  });

  describe('normaliseSubmissionData', () => {
    it('should only keep allowed keys', () => {
      const raw = {
        name: 'Alice',
        malicious_field: 'DROP DATABASE',
        age: 25,
      };
      const sanitised = normaliseSubmissionData(raw, ['name', 'age']);
      expect(sanitised).toEqual({ name: 'Alice', age: 25 });
      expect(sanitised).not.toHaveProperty('malicious_field');
    });
  });

  describe('computeSubmissionStats', () => {
    it('should compute stats correct counts and percentages', () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 2).toISOString();
      
      const submissions: FormSubmission[] = [
        { id: '1', formId: 'f', submittedAt: weekAgo, data: {}, workspaceId: 'w', organizationId: 'o', entityId: 'e1' },
        { id: '2', formId: 'f', submittedAt: monthAgo, data: {}, workspaceId: 'w', organizationId: 'o' },
      ];

      const stats = computeSubmissionStats(submissions);
      expect(stats.total).toBe(2);
      expect(stats.thisWeek).toBe(1);
      expect(stats.entityResolvedCount).toBe(1);
      expect(stats.entityResolvedPct).toBe('50%');
    });

    it('should handle zero submissions gracefully', () => {
      const stats = computeSubmissionStats([]);
      expect(stats.total).toBe(0);
      expect(stats.entityResolvedPct).toBe('—');
    });
  });
});
