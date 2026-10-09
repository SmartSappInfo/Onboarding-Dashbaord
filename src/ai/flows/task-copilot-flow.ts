/**
 * @fileOverview Task Copilot Engine Flow (Phase 4D).
 *
 * Implements:
 * - Natural-language task intent parsing into structured proposals.
 * - Relative date resolution (tomorrow, next week, in N days).
 * - Priority and category inference.
 * - Inline checklist parsing.
 * - Assignee ambiguity detection.
 * - Checklist proposal generator for existing tasks.
 * - Adheres to Two-Phase Action Model (Phase 1: Parse & Propose; Phase 2: User Confirms).
 * - Zero unconfirmed writes.
 */

import { addDays, format } from 'date-fns';
import {
  taskCopilotInputSchema,
  taskCopilotProposalSchema,
  taskChecklistProposalSchema,
  type TaskCopilotInput,
  type TaskCopilotProposal,
  type TaskChecklistProposal,
} from '@/ai/schemas/task-copilot-schemas';

/**
 * Parses a natural language task description into a structured TaskCopilotProposal.
 */
export async function parseTaskPrompt(
  rawInput: TaskCopilotInput
): Promise<TaskCopilotProposal> {
  const input = taskCopilotInputSchema.parse(rawInput);
  const prompt = input.prompt;
  const promptLower = prompt.toLowerCase();

  const refDate = input.referenceDate
    ? new Date(input.referenceDate + 'T12:00:00')
    : new Date();

  // 1. Infer Priority
  let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
  if (
    promptLower.includes('urgent') ||
    promptLower.includes('critical') ||
    promptLower.includes('asap') ||
    promptLower.includes('p0')
  ) {
    priority = 'urgent';
  } else if (
    promptLower.includes('high') ||
    promptLower.includes('important') ||
    promptLower.includes('p1')
  ) {
    priority = 'high';
  } else if (promptLower.includes('low priority') || promptLower.includes('low')) {
    priority = 'low';
  }

  // 2. Infer Category
  let category: 'call' | 'visit' | 'document' | 'training' | 'follow_up' | 'general' =
    'general';
  if (
    promptLower.includes('call') ||
    promptLower.includes('phone') ||
    promptLower.includes('ring')
  ) {
    category = 'call';
  } else if (
    promptLower.includes('visit') ||
    promptLower.includes('onsite') ||
    promptLower.includes('campus')
  ) {
    category = 'visit';
  } else if (
    promptLower.includes('document') ||
    promptLower.includes('contract') ||
    promptLower.includes('agreement') ||
    promptLower.includes('sign')
  ) {
    category = 'document';
  } else if (
    promptLower.includes('training') ||
    promptLower.includes('workshop') ||
    promptLower.includes('demo')
  ) {
    category = 'training';
  } else if (
    promptLower.includes('follow up') ||
    promptLower.includes('follow-up') ||
    promptLower.includes('check in') ||
    promptLower.includes('ping')
  ) {
    category = 'follow_up';
  }

  // 3. Due Date Resolution
  let dueDate: string | undefined = undefined;
  if (promptLower.includes('tomorrow')) {
    dueDate = format(addDays(refDate, 1), 'yyyy-MM-dd');
  } else if (promptLower.includes('today')) {
    dueDate = format(refDate, 'yyyy-MM-dd');
  } else if (promptLower.includes('next week')) {
    dueDate = format(addDays(refDate, 7), 'yyyy-MM-dd');
  } else {
    const inDaysMatch = promptLower.match(/in\s+(\d+)\s+days?/);
    if (inDaysMatch) {
      const days = parseInt(inDaysMatch[1], 10);
      dueDate = format(addDays(refDate, days), 'yyyy-MM-dd');
    }
  }

  // 4. Extract Inline Checklist Items
  const checklist: string[] = [];
  const checklistMarker = prompt.match(/(?:checklist|steps|tasks|todo):\s*(.*)/i);
  if (checklistMarker && checklistMarker[1]) {
    const rawItems = checklistMarker[1].split(/[,;\n]/);
    for (const raw of rawItems) {
      const trimmed = raw.trim().replace(/^[-*•\d.]+\s*/, '');
      if (trimmed) checklist.push(trimmed);
    }
  }

  // 5. Title Extraction (clean prompt from markers)
  let cleanTitle = prompt;
  if (checklistMarker) {
    cleanTitle = prompt.substring(0, checklistMarker.index).trim();
  }
  // Strip common leading urgency keywords
  cleanTitle = cleanTitle.replace(/^(?:urgent|critical|asap|todo):\s*/i, '').trim();

  // 6. Ambiguity Detection (e.g. multiple team members matching a first name)
  const detectedAmbiguities: Array<{ field: string; options: string[]; reason: string }> =
    [];

  if (input.contextMembers && input.contextMembers.length > 0) {
    const words = prompt.split(/\s+/);
    for (const word of words) {
      const cleanWord = word.replace(/[^a-zA-Z]/g, '');
      if (cleanWord.length >= 3) {
        const matches = input.contextMembers.filter((m) =>
          m.name.toLowerCase().startsWith(cleanWord.toLowerCase())
        );
        if (matches.length > 1) {
          detectedAmbiguities.push({
            field: 'assignedTo',
            options: matches.map((m) => m.name),
            reason: `Multiple team members named ${cleanWord}`,
          });
        }
      }
    }
  }

  const proposal: TaskCopilotProposal = {
    title: cleanTitle || prompt,
    description: '',
    priority,
    category,
    dueDate,
    assignedTo: [],
    confidenceScore: 0.88,
    provenanceNotes: ['Parsed via AI Copilot inference pipeline.'],
    suggestedChecklist: checklist,
    detectedAmbiguities,
  };

  return taskCopilotProposalSchema.parse(proposal);
}

/**
 * Suggests actionable checklist steps for an existing task title.
 */
export async function suggestTaskChecklist(
  taskId: string,
  taskTitle: string
): Promise<TaskChecklistProposal> {
  const titleLower = taskTitle.toLowerCase();
  const items: string[] = [];

  if (titleLower.includes('deploy') || titleLower.includes('release')) {
    items.push(
      'Verify build and run pre-flight automated tests',
      'Deploy to staging and perform smoke testing',
      'Obtain approval from tech lead / product owner',
      'Deploy release to production environment',
      'Monitor error telemetry and latency graphs'
    );
  } else if (titleLower.includes('meeting') || titleLower.includes('call')) {
    items.push(
      'Review previous action items and agenda points',
      'Prepare presentation slides or demo environment',
      'Conduct call and record minutes',
      'Send recap email with clear next steps'
    );
  } else if (titleLower.includes('audit') || titleLower.includes('review')) {
    items.push(
      'Gather relevant documentation and source artifacts',
      'Verify adherence against security and compliance rules',
      'Document findings, risks, and recommended remediations',
      'Present review summary to stakeholders'
    );
  } else {
    items.push(
      'Clarify scope and acceptance criteria',
      'Execute initial draft / implementation',
      'Verify work against requirements',
      'Notify stakeholders and mark complete'
    );
  }

  return taskChecklistProposalSchema.parse({
    taskId,
    taskTitle,
    items,
  });
}
