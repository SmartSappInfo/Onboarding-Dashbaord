/**
 * @fileOverview Unit tests for Task Copilot Engine (Phase 4D).
 * Validates:
 * - Natural-language task prompt parsing into structured proposal.
 * - Due date and relative time extraction.
 * - Priority and category inference.
 * - Checklist extraction from multi-step prompts.
 * - Ambiguity detection for ambiguous assignees.
 * - Checklist generation for existing tasks.
 */

import { describe, it, expect } from 'vitest';
import { parseTaskPrompt, suggestTaskChecklist } from '../task-copilot-flow';

describe('Task Copilot Engine (Phase 4D)', () => {
  it('parses simple task with relative due date and call category', async () => {
    const proposal = await parseTaskPrompt({
      prompt: 'Call Sarah tomorrow at 10am to review contract proposal',
      referenceDate: '2026-10-09',
    });

    expect(proposal.title).toMatch(/call sarah|review contract proposal/i);
    expect(proposal.category).toBe('call');
    expect(proposal.dueDate).toBe('2026-10-10'); // Tomorrow relative to 2026-10-09
    expect(proposal.confidenceScore).toBeGreaterThanOrEqual(0.7);
  });

  it('detects high priority and extracts inline checklist items', async () => {
    const proposal = await parseTaskPrompt({
      prompt:
        'URGENT: Staging database migration checklist: backup postgres, run migrations, verify foreign keys, notify team',
      referenceDate: '2026-10-09',
    });

    expect(proposal.priority).toBe('urgent');
    expect(proposal.suggestedChecklist.length).toBeGreaterThanOrEqual(3);
    expect(proposal.suggestedChecklist).toContain('backup postgres');
  });

  it('detects ambiguity when multiple members match assignee name', async () => {
    const proposal = await parseTaskPrompt({
      prompt: 'Follow up with Alex about onboarding slides',
      referenceDate: '2026-10-09',
      contextMembers: [
        { id: 'u1', name: 'Alex Johnson' },
        { id: 'u2', name: 'Alex Rivera' },
      ],
    });

    expect(proposal.detectedAmbiguities.length).toBeGreaterThanOrEqual(1);
    const ambiguity = proposal.detectedAmbiguities[0];
    expect(ambiguity.field).toBe('assignedTo');
    expect(ambiguity.options).toEqual(['Alex Johnson', 'Alex Rivera']);
  });

  it('generates structured checklist suggestions for a task', async () => {
    const checklist = await suggestTaskChecklist('task-1', 'Deploy new landing page to production');

    expect(checklist.taskId).toBe('task-1');
    expect(checklist.items.length).toBeGreaterThanOrEqual(3);
  });
});
