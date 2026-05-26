/**
 * @fileOverview Pure utility functions for form submissions.
 * No Firebase imports. No side effects. All functions are independently testable.
 */

import type { FormSubmission, AppField } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Field Value Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a raw submission field value into a human-readable string.
 */
export function formatFieldValue(value: unknown, fieldType?: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (fieldType === 'date' || fieldType === 'datetime') {
    try {
      const d = new Date(value as string);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Extracts a preview string of the first 2-3 notable field values from a submission.
 */
export function getSubmissionPreview(
  data: Record<string, unknown>,
  fields: AppField[],
  maxFields = 3
): string {
  const priorityVars = ['contact_name', 'contact_email', 'school_name'];
  const ordered = [
    ...priorityVars.filter(v => v in data),
    ...Object.keys(data).filter(k => !priorityVars.includes(k)),
  ].slice(0, maxFields);

  return ordered
    .map(key => {
      const field = fields.find(f => f.variableName === key);
      const label = field?.label ?? key;
      return `${label}: ${formatFieldValue(data[key])}`;
    })
    .join(' · ') || 'No data';
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escapes a value for safe inclusion in a CSV cell.
 */
function csvEscape(value: unknown): string {
  const str = formatFieldValue(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts an array of form submissions to a CSV string.
 * Headers are derived from the form's AppFields (using label, falling back to variableName).
 * Pure function — no side effects, easily unit-tested.
 */
export function submissionsToCSV(
  submissions: FormSubmission[],
  fields: AppField[]
): string {
  if (submissions.length === 0) return '';

  // Build ordered column list: known fields first, then any extras from data
  const fieldVarNames = fields.map(f => f.variableName);
  const allKeys = Array.from(
    new Set([...fieldVarNames, ...submissions.flatMap(s => Object.keys(s.data))])
  );

  const headers = [
    'Submitted At',
    'Submission ID',
    'Entity ID',
    'Source Page ID',
    ...allKeys.map(key => {
      const field = fields.find(f => f.variableName === key);
      return field?.label ?? key;
    }),
  ];

  const rows = submissions.map(s => [
    csvEscape(s.submittedAt),
    csvEscape(s.id),
    csvEscape(s.entityId ?? ''),
    csvEscape(s.sourcePageId ?? ''),
    ...allKeys.map(key => csvEscape(s.data[key])),
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Submission Data Normalisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips keys from submission data that don't correspond to any known field variable name.
 * Used to sanitise raw form payloads before persisting them.
 */
export function normaliseSubmissionData(
  raw: Record<string, unknown>,
  allowedVariableNames: string[]
): Record<string, unknown> {
  const allowed = new Set(allowedVariableNames);
  return Object.fromEntries(
    Object.entries(raw).filter(([key]) => allowed.has(key))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats Calculation
// ─────────────────────────────────────────────────────────────────────────────

export interface SubmissionStats {
  total: number;
  thisWeek: number;
  thisMonth: number;
  entityResolvedCount: number;
  entityResolvedPct: string;
}

/**
 * Computes display statistics from a list of submissions.
 */
export function computeSubmissionStats(submissions: FormSubmission[]): SubmissionStats {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

  let thisWeek = 0;
  let thisMonth = 0;
  let entityResolvedCount = 0;

  for (const s of submissions) {
    const d = new Date(s.submittedAt);
    if (d >= weekAgo) thisWeek++;
    if (d >= monthAgo) thisMonth++;
    if (s.entityId) entityResolvedCount++;
  }

  const total = submissions.length;
  const entityResolvedPct = total > 0
    ? `${Math.round((entityResolvedCount / total) * 100)}%`
    : '—';

  return { total, thisWeek, thisMonth, entityResolvedCount, entityResolvedPct };
}
