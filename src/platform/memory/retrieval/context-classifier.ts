/**
 * @fileOverview Context & Intent Query Classifier (Phase 4 Milestone 2)
 *
 * ARCHITECTURAL INVARIANTS (Rules 4, 8, 10, 16):
 * 1. Analyzes natural language objectives to extract target entity types, domains,
 *    explicit entity IDs, temporal windows, and clean search terms (Roadmap §19).
 * 2. Fail-closed multi-tenant validation (Rule 8).
 * 3. Zero-`any` standard with strict Zod v4 schemas.
 *
 * @testability Covered in `src/platform/__tests__/memory/context-classifier.test.ts`.
 */

import { z } from 'zod';
import { MEMORY_ERROR_CODES, SensitivityLevelSchema } from '../contracts/memory-types';

export const ContextIntentSchema = z.enum([
  'meeting_prep',
  'deal_review',
  'contact_research',
  'billing_inquiry',
  'support_resolution',
  'policy_lookup',
  'general_knowledge',
]);
export type ContextIntent = z.infer<typeof ContextIntentSchema>;

export const ClassifiedContextQuerySchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  rawQuery: z.string().min(1),
  cleanSearchTerms: z.string(),
  intent: ContextIntentSchema,
  domains: z.array(z.string()),
  targetEntityTypes: z.array(z.string()),
  extractedIds: z.object({
    contactIds: z.array(z.string()).default([]),
    dealIds: z.array(z.string()).default([]),
    meetingIds: z.array(z.string()).default([]),
    invoiceIds: z.array(z.string()).default([]),
  }),
  temporalWindow: z.enum(['immediate', 'upcoming', 'recent', 'historical', 'all']),
  maxSensitivity: SensitivityLevelSchema.default('confidential'),
});
export type ClassifiedContextQuery = z.infer<typeof ClassifiedContextQuerySchema>;

export interface ClassifyQueryInput {
  query: string;
  organizationId: string;
  workspaceId: string;
}

export function classifyContextQuery(input: ClassifyQueryInput): ClassifiedContextQuery {
  const { query, organizationId, workspaceId } = input;

  if (!organizationId || !workspaceId) {
    throw new Error(MEMORY_ERROR_CODES.TENANT_REQUIRED);
  }

  const raw = (query || '').trim();
  const lower = raw.toLowerCase();

  // Extract explicit IDs using prefix conventions
  const dealIds = (raw.match(/deal_[a-zA-Z0-9_-]+/g) || []);
  const contactIds = (raw.match(/con_[a-zA-Z0-9_-]+/g) || []);
  const meetingIds = (raw.match(/meet_[a-zA-Z0-9_-]+/g) || []);
  const invoiceIds = (raw.match(/inv_[a-zA-Z0-9_-]+/g) || []);

  // Intent classification
  let intent: ContextIntent = 'general_knowledge';
  const domains: string[] = [];
  const targetEntityTypes: string[] = [];
  let temporalWindow: 'immediate' | 'upcoming' | 'recent' | 'historical' | 'all' = 'all';

  if (lower.includes('meeting') || lower.includes('prep') || lower.includes('call')) {
    intent = 'meeting_prep';
    domains.push('crm', 'scheduling');
    targetEntityTypes.push('meeting');
    if (lower.includes('tomorrow') || lower.includes('next week') || lower.includes('upcoming')) {
      temporalWindow = 'upcoming';
    }
  } else if (lower.includes('deal') || lower.includes('pipeline') || lower.includes('proposal') || lower.includes('closing')) {
    intent = 'deal_review';
    domains.push('crm', 'deals');
    targetEntityTypes.push('deal');
  } else if (lower.includes('invoice') || lower.includes('payment') || lower.includes('billing') || lower.includes('due')) {
    intent = 'billing_inquiry';
    domains.push('billing', 'finance');
    targetEntityTypes.push('invoice');
  } else if (lower.includes('contact') || lower.includes('who is') || lower.includes('profile')) {
    intent = 'contact_research';
    domains.push('crm', 'contacts');
    targetEntityTypes.push('contact');
  } else if (lower.includes('policy') || lower.includes('rule') || lower.includes('guideline') || lower.includes('refund')) {
    intent = 'policy_lookup';
    domains.push('knowledge', 'compliance');
    targetEntityTypes.push('document');
  }

  if (dealIds.length > 0 && !targetEntityTypes.includes('deal')) targetEntityTypes.push('deal');
  if (contactIds.length > 0 && !targetEntityTypes.includes('contact')) targetEntityTypes.push('contact');
  if (meetingIds.length > 0 && !targetEntityTypes.includes('meeting')) targetEntityTypes.push('meeting');
  if (invoiceIds.length > 0 && !targetEntityTypes.includes('invoice')) targetEntityTypes.push('invoice');

  // Strip stop terms and IDs to extract clean search terms
  let cleanTerms = lower
    .replace(/deal_[a-zA-Z0-9_-]+/g, '')
    .replace(/con_[a-zA-Z0-9_-]+/g, '')
    .replace(/meet_[a-zA-Z0-9_-]+/g, '')
    .replace(/inv_[a-zA-Z0-9_-]+/g, '')
    .replace(/\b(help|me|prepare|for|tomorrow|meeting|with|regarding|and|the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanTerms) cleanTerms = lower;

  return {
    organizationId,
    workspaceId,
    rawQuery: raw,
    cleanSearchTerms: cleanTerms,
    intent,
    domains: Array.from(new Set(domains)),
    targetEntityTypes: Array.from(new Set(targetEntityTypes)),
    extractedIds: {
      contactIds: Array.from(new Set(contactIds)),
      dealIds: Array.from(new Set(dealIds)),
      meetingIds: Array.from(new Set(meetingIds)),
      invoiceIds: Array.from(new Set(invoiceIds)),
    },
    temporalWindow,
    maxSensitivity: 'confidential',
  };
}
