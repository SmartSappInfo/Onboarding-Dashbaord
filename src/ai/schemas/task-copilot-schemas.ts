/**
 * @fileOverview Zod Schemas for AI Task Copilot (Phase 4D)
 *
 * Implements Rule 4 (Strict Typing), Rule 13 (Trust Boundary Matrix),
 * Rule 21/22 (Two-Phase Action Model), and Rule 23 (Resource Governance).
 *
 * Zero `any` or `any[]` invariant.
 */

import { z } from 'zod';

export const taskCopilotInputSchema = z.object({
  prompt: z.string().trim().min(3, 'Prompt must be at least 3 characters.').max(500, 'Prompt cannot exceed 500 characters.'),
  userTimezone: z.string().optional().default('UTC'),
  referenceDate: z.string().optional(),
  contextMembers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    })
  ).optional(),
});

export const taskCopilotProposalSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  description: z.string().default(''),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  category: z.enum(['call', 'visit', 'document', 'training', 'follow_up', 'general']).default('follow_up'),
  dueDate: z.string().optional(),
  assignedTo: z.array(z.string()).default([]),
  entityId: z.string().optional(),
  entityName: z.string().optional(),
  confidenceScore: z.number().min(0).max(1).default(0.9),
  provenanceNotes: z.array(z.string()).default([]),
  suggestedChecklist: z.array(z.string()).default([]),
  detectedAmbiguities: z.array(
    z.object({
      field: z.string(),
      options: z.array(z.string()),
      reason: z.string(),
    })
  ).default([]),
});

export const taskChecklistProposalSchema = z.object({
  taskId: z.string().min(1),
  taskTitle: z.string().min(1),
  items: z.array(z.string().min(1)).min(1, 'At least one step required.').max(10, 'Max 10 steps allowed.'),
});

export type TaskCopilotInput = z.input<typeof taskCopilotInputSchema>;
export type TaskCopilotProposal = z.infer<typeof taskCopilotProposalSchema>;
export type TaskChecklistProposal = z.infer<typeof taskChecklistProposalSchema>;
