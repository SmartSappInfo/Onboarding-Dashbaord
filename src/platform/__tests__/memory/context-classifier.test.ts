import { describe, it, expect } from 'vitest';
import {
  classifyContextQuery,
  ClassifiedContextQuerySchema,
} from '@/platform/memory/retrieval/context-classifier';

describe('Context Classifier (Roadmap §19 & Rule 10)', () => {
  it('classifies a meeting prep query with entity IDs, intent, and domain', () => {
    const query = 'Help me prepare for tomorrow meeting with Bright Future Academy regarding deal deal_987 and contact con_123';
    const classified = classifyContextQuery({
      query,
      organizationId: 'org-test',
      workspaceId: 'ws-test',
    });

    expect(classified.intent).toBe('meeting_prep');
    expect(classified.domains).toContain('crm');
    expect(classified.targetEntityTypes).toContain('deal');
    expect(classified.targetEntityTypes).toContain('contact');
    expect(classified.extractedIds.dealIds).toContain('deal_987');
    expect(classified.extractedIds.contactIds).toContain('con_123');
    expect(classified.temporalWindow).toBe('upcoming');
    expect(classified.cleanSearchTerms).toContain('bright future academy');
    expect(ClassifiedContextQuerySchema.safeParse(classified).success).toBe(true);
  });

  it('fails closed when organizationId or workspaceId is missing (Rule 8)', () => {
    expect(() =>
      classifyContextQuery({
        query: 'What is the pricing?',
        organizationId: '',
        workspaceId: 'ws-test',
      })
    ).toThrow('MEMORY_TENANT_REQUIRED');

    expect(() =>
      classifyContextQuery({
        query: 'What is the pricing?',
        organizationId: 'org-test',
        workspaceId: '',
      })
    ).toThrow('MEMORY_TENANT_REQUIRED');
  });

  it('detects billing and commercial intent from keyword cues', () => {
    const classified = classifyContextQuery({
      query: 'Check payment status and past due invoices for Kumasi High School',
      organizationId: 'org-test',
      workspaceId: 'ws-test',
    });

    expect(classified.intent).toBe('billing_inquiry');
    expect(classified.domains).toContain('billing');
    expect(classified.targetEntityTypes).toContain('invoice');
  });

  it('detects deal review and policy lookup intents accurately', () => {
    const dealQuery = classifyContextQuery({
      query: 'Review active deal pipeline and closing proposals for next quarter',
      organizationId: 'org-test',
      workspaceId: 'ws-test',
    });
    expect(dealQuery.intent).toBe('deal_review');
    expect(dealQuery.domains).toContain('deals');

    const policyQuery = classifyContextQuery({
      query: 'What is the refund policy and discount guidelines?',
      organizationId: 'org-test',
      workspaceId: 'ws-test',
    });
    expect(policyQuery.intent).toBe('policy_lookup');
    expect(policyQuery.targetEntityTypes).toContain('document');
  });
});
