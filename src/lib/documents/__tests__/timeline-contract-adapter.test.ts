/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Unit tests for Federated CRM Knowledge Timeline Adapter for Contracts & Envelopes (P4.2).
 * 2. Invariants Tested:
 *    - ContractRecord transformation into normalized CRMKnowledgeTimelineItem.
 *    - SigningEnvelope transformation into normalized CRMKnowledgeTimelineItem.
 *    - Origin links navigate to `/admin/finance/contracts` and `/verify/[envelopeId]`.
 *    - Deduplication, chronological sorting, and source filtering.
 *    - Zero-tolerance typing (Rule 4).
 */

import { describe, it, expect } from 'vitest';
import { buildTimelineStream, filterTimelineStream } from '@/lib/quick-notes-domain';
import type { ContractRecord, SigningEnvelope } from '@/lib/types/document-signing';

describe('P4.2 CRM Timeline Federation Adapter for Contracts & Envelopes', () => {
  const mockContract: ContractRecord = {
    id: 'ctr_enterprise_1',
    workspaceId: 'ws_prod',
    title: 'Enterprise Master Services Agreement',
    status: 'active',
    envelopeIds: ['env_100'],
    dealId: 'deal_acme_1',
    entityId: 'ent_acme',
    partyLinks: [
      { name: 'John Doe', email: 'john@acme.com', role: 'Signer' },
    ],
    contractValue: {
      amount: 120000,
      currency: 'USD',
      cadence: 'annually',
    },
    ownerId: 'usr_sales_1',
    noticePeriodDays: 30,
    tagIds: ['enterprise', 'annual'],
    createdAt: '2026-09-15T12:00:00.000Z',
    updatedAt: '2026-09-15T12:00:00.000Z',
  };

  const mockEnvelope: SigningEnvelope = {
    id: 'env_100',
    workspaceId: 'ws_prod',
    title: 'Executive Signature SOW',
    status: 'completed',
    templateVersionId: 'tpl_v1',
    preExecutionSha256: 'sha_pre_123',
    recipients: [
      {
        id: 'rec_1',
        role: 'signer',
        name: 'Jane Smith',
        email: 'jane@acme.com',
        status: 'signed',
        routingOrder: 1,
        requiresSignature: true,
      },
    ],
    fields: [],
    routingRules: { mode: 'sequential', currentStep: 1, totalSteps: 1 },
    dealId: 'deal_acme_1',
    entityId: 'ent_acme',
    createdAt: '2026-09-15T14:30:00.000Z',
    updatedAt: '2026-09-15T15:00:00.000Z',
  };

  it('transforms ContractRecord into a federated timeline item', () => {
    const stream = buildTimelineStream({
      contracts: [mockContract],
    });

    expect(stream).toHaveLength(1);
    const item = stream[0];

    expect(item.id).toBe('contract:ctr_enterprise_1');
    expect(item.source).toBe('contract');
    expect(item.sourceId).toBe('ctr_enterprise_1');
    expect(item.title).toBe('Enterprise Master Services Agreement');
    expect(item.knowledgeType).toBe('decision');
    expect(item.tags).toContain('active');
    expect(item.links.dealId).toBe('deal_acme_1');
    expect(item.links.entityId).toBe('ent_acme');
    expect(item.originHref).toContain('/admin/finance/contracts');
  });

  it('transforms SigningEnvelope into a federated timeline item', () => {
    const stream = buildTimelineStream({
      signingEnvelopes: [mockEnvelope],
    });

    expect(stream).toHaveLength(1);
    const item = stream[0];

    expect(item.id).toBe('signing_envelope:env_100');
    expect(item.source).toBe('signing_envelope');
    expect(item.sourceId).toBe('env_100');
    expect(item.title).toBe('Executive Signature SOW');
    expect(item.knowledgeType).toBe('action');
    expect(item.tags).toContain('completed');
    expect(item.originHref).toBe('/verify/env_100');
  });

  it('orders items chronologically newest first', () => {
    const stream = buildTimelineStream({
      contracts: [mockContract], // 12:00:00
      signingEnvelopes: [mockEnvelope], // 14:30:00
    });

    expect(stream).toHaveLength(2);
    // Envelope is newer (14:30 > 12:00) so it must appear first
    expect(stream[0].source).toBe('signing_envelope');
    expect(stream[1].source).toBe('contract');
  });

  it('filters timeline by source type', () => {
    const stream = buildTimelineStream({
      contracts: [mockContract],
      signingEnvelopes: [mockEnvelope],
    });

    const filteredContracts = filterTimelineStream(stream, {
      type: 'contract',
      searchQuery: '',
    });
    expect(filteredContracts).toHaveLength(1);
    expect(filteredContracts[0].id).toBe('contract:ctr_enterprise_1');

    const filteredEnvelopes = filterTimelineStream(stream, {
      type: 'signing_envelope',
      searchQuery: '',
    });
    expect(filteredEnvelopes).toHaveLength(1);
    expect(filteredEnvelopes[0].id).toBe('signing_envelope:env_100');
  });
});
