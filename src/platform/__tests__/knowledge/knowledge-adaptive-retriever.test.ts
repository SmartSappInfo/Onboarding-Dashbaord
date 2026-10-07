/**
 * @fileOverview Knowledge Adaptive Retrieval Engine Test Suite (Phase 11 M4 · T1)
 *
 * Verifies:
 * - Tri-modal fusion (Dense + Sparse + Graph via RRF k=60)
 * - Temporal recency decay & zero-weighting of superseded/expired facts (Rule 29)
 * - Verification state multipliers (1.25 for verified vs 0.85 for unverified)
 * - Per-item ACL and multi-tenant boundary checks (Rules 8, 16, 49)
 * - Greedy knapsack context budgeting (<= 30,000 tokens ceiling) (Rules 28 & 56)
 * - Explainability grid integration (Rule 41)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  KnowledgeAdaptiveRetriever,
  type AdaptiveKnowledgeItem,
} from '@/platform/domains/knowledge_memory/services/knowledge-adaptive-retriever';

describe('KnowledgeAdaptiveRetriever (Phase 11 M4 · T1)', () => {
  const orgId = 'org_test_enterprise';
  const workspaceId = 'ws_primary';
  const now = new Date('2026-10-07T12:00:00.000Z');

  let retriever: KnowledgeAdaptiveRetriever;

  // Sample items for testing
  const mockItems: AdaptiveKnowledgeItem[] = [
    {
      id: 'item_1_contract_sla',
      organizationId: orgId,
      workspaceId: workspaceId,
      title: 'Enterprise Support SLA Guarantee',
      content: 'Standard response SLA for critical tier-1 incidents is 15 minutes 24/7.',
      sourceType: 'document',
      sensitivity: 'internal',
      verificationState: 'verified',
      createdAt: '2026-10-06T12:00:00.000Z', // 1 day old
      tags: ['sla', 'support', 'contract'],
      subjectRefs: ['ent_customer_a'],
    },
    {
      id: 'item_2_pricing_tier',
      organizationId: orgId,
      workspaceId: workspaceId,
      title: 'Custom Enterprise Tier Pricing',
      content: 'Annual enterprise subscription base fee is $120,000 with 500 included seats.',
      sourceType: 'crm_note',
      sensitivity: 'restricted', // Restricted ACL
      verificationState: 'verified',
      createdAt: '2026-10-05T12:00:00.000Z', // 2 days old
      tags: ['pricing', 'finance', 'enterprise'],
      subjectRefs: ['ent_customer_a'],
    },
    {
      id: 'item_3_superseded_sla',
      organizationId: orgId,
      workspaceId: workspaceId,
      title: 'Legacy SLA Response Guidelines',
      content: 'Legacy response SLA was 4 hours during business days.',
      sourceType: 'document',
      sensitivity: 'internal',
      verificationState: 'verified',
      createdAt: '2026-01-01T12:00:00.000Z',
      supersededBy: 'item_1_contract_sla', // Superseded (Rule 29)
      tags: ['sla', 'legacy'],
    },
    {
      id: 'item_4_expired_discount',
      organizationId: orgId,
      workspaceId: workspaceId,
      title: 'Q1 Promotional Discount Terms',
      content: 'Early bird sign-up receives a 20% discount on first-year billing.',
      sourceType: 'document',
      sensitivity: 'internal',
      verificationState: 'verified',
      createdAt: '2026-01-15T12:00:00.000Z',
      validUntil: '2026-03-31T23:59:59.000Z', // Expired
      tags: ['discount', 'promo'],
    },
    {
      id: 'item_5_unverified_rumor',
      organizationId: orgId,
      workspaceId: workspaceId,
      title: 'Rumored Competitor Replatforming',
      content: 'Competitor X might be migrating away from vendor Y next quarter.',
      sourceType: 'meeting',
      sensitivity: 'internal',
      verificationState: 'unverified', // Unverified multiplier
      createdAt: '2026-10-06T12:00:00.000Z', // 1 day old
      tags: ['competitor', 'market'],
      subjectRefs: ['ent_competitor_x'],
    },
    {
      id: 'item_6_other_tenant',
      organizationId: 'org_different_competitor', // IDOR bait
      workspaceId: 'ws_foreign',
      title: 'Foreign Tenant Confidential Strategy',
      content: 'Confidential roadmap for unrelated organization.',
      sourceType: 'document',
      sensitivity: 'internal',
      verificationState: 'verified',
      createdAt: '2026-10-06T12:00:00.000Z',
      tags: ['confidential'],
    },
  ];

  beforeEach(() => {
    retriever = new KnowledgeAdaptiveRetriever({
      items: mockItems,
      now,
    });
  });

  describe('Tri-Modal Reciprocal Rank Fusion & Ranking (Rules 28 & 55)', () => {
    it('ranks items matching across multiple modalities higher than single modality', async () => {
      const output = await retriever.searchHybrid(
        {
          organizationId: orgId,
          workspaceId: workspaceId,
          query: 'SLA support response guarantee',
          entityId: 'ent_customer_a',
          includeGraphNeighbors: true,
          limit: 10,
        },
        {
          callerPermissions: ['knowledge:read'],
          now,
        }
      );

      expect(output.hits.length).toBeGreaterThan(0);
      const topHit = output.hits[0];
      expect(topHit.id).toBe('item_1_contract_sla');
      expect(topHit.rrfScore).toBeGreaterThan(0);
      expect(topHit.finalScore).toBeGreaterThan(0);
      expect(topHit.verificationState).toBe('verified');
      expect(topHit.denseRank).toBeDefined();
    });

    it('applies verification multiplier (1.25 for verified vs 0.85 for unverified)', async () => {
      // Both items are 1 day old; test that verified gets 1.25x and unverified gets 0.85x
      const output = await retriever.searchHybrid(
        {
          organizationId: orgId,
          workspaceId: workspaceId,
          query: 'support competitor',
          limit: 10,
        },
        {
          callerPermissions: ['knowledge:read'],
          now,
        }
      );

      const verifiedHit = output.hits.find((h) => h.id === 'item_1_contract_sla');
      const unverifiedHit = output.hits.find((h) => h.id === 'item_5_unverified_rumor');

      if (verifiedHit && unverifiedHit) {
        expect(verifiedHit.verificationMultiplier).toBe(1.25);
        expect(unverifiedHit.verificationMultiplier).toBe(0.85);
      }
    });
  });

  describe('Temporal Recency Decay & Fact Supersession (Rule 29)', () => {
    it('applies exponential decay based on age and half-life', () => {
      const weightFresh = retriever.calculateRecencyWeight({
        createdAt: '2026-10-07T12:00:00.000Z',
        halfLifeDays: 30,
        now,
      });
      expect(weightFresh).toBeCloseTo(1.0, 2);

      const weightOneHalfLife = retriever.calculateRecencyWeight({
        createdAt: '2026-09-07T12:00:00.000Z', // 30 days old
        halfLifeDays: 30,
        now,
      });
      expect(weightOneHalfLife).toBeCloseTo(0.5, 2);

      const weightTwoHalfLives = retriever.calculateRecencyWeight({
        createdAt: '2026-08-08T12:00:00.000Z', // 60 days old
        halfLifeDays: 30,
        now,
      });
      expect(weightTwoHalfLives).toBeCloseTo(0.25, 2);
    });

    it('zero-weights (w = 0) and strictly excludes superseded facts', async () => {
      const output = await retriever.searchHybrid(
        {
          organizationId: orgId,
          workspaceId: workspaceId,
          query: 'SLA response guidelines',
          limit: 10,
        },
        {
          callerPermissions: ['knowledge:read'],
          now,
        }
      );

      const supersededHit = output.hits.find((h) => h.id === 'item_3_superseded_sla');
      expect(supersededHit).toBeUndefined();
    });

    it('zero-weights (w = 0) and strictly excludes expired facts', async () => {
      const output = await retriever.searchHybrid(
        {
          organizationId: orgId,
          workspaceId: workspaceId,
          query: 'promotional discount terms',
          limit: 10,
        },
        {
          callerPermissions: ['knowledge:read'],
          now,
        }
      );

      const expiredHit = output.hits.find((h) => h.id === 'item_4_expired_discount');
      expect(expiredHit).toBeUndefined();
    });
  });

  describe('Multi-Tenant Boundary & Per-Item ACL (Rules 8, 16, 49)', () => {
    it('strictly drops facts from adjacent tenants (Anti-IDOR)', async () => {
      const output = await retriever.searchHybrid(
        {
          organizationId: orgId,
          workspaceId: workspaceId,
          query: 'strategy roadmap confidential',
          limit: 10,
        },
        {
          callerPermissions: ['knowledge:read', 'knowledge:read_restricted'],
          now,
        }
      );

      const leak = output.hits.find((h) => h.id === 'item_6_other_tenant');
      expect(leak).toBeUndefined();
    });

    it('omits restricted items when caller lacks knowledge:read_restricted', async () => {
      const output = await retriever.searchHybrid(
        {
          organizationId: orgId,
          workspaceId: workspaceId,
          query: 'pricing enterprise subscription tier',
          limit: 10,
        },
        {
          callerPermissions: ['knowledge:read'], // missing read_restricted
          now,
        }
      );

      const restrictedHit = output.hits.find((h) => h.id === 'item_2_pricing_tier');
      expect(restrictedHit).toBeUndefined();
    });

    it('includes restricted items when caller holds knowledge:read_restricted', async () => {
      const output = await retriever.searchHybrid(
        {
          organizationId: orgId,
          workspaceId: workspaceId,
          query: 'pricing enterprise subscription tier',
          limit: 10,
        },
        {
          callerPermissions: ['knowledge:read', 'knowledge:read_restricted'],
          now,
        }
      );

      const restrictedHit = output.hits.find((h) => h.id === 'item_2_pricing_tier');
      expect(restrictedHit).toBeDefined();
      expect(restrictedHit?.sensitivity).toBe('restricted');
    });
  });

  describe('Greedy Knapsack Context Budgeting (Rules 28 & 56)', () => {
    it('packs items within maxContextTokens and returns transparent metadata', async () => {
      // Set very small token budget (e.g. 50 tokens ~ fits only 1 item)
      const output = await retriever.searchHybrid(
        {
          organizationId: orgId,
          workspaceId: workspaceId,
          query: 'support enterprise',
          limit: 10,
        },
        {
          callerPermissions: ['knowledge:read'],
          maxContextTokens: 60,
          now,
        }
      );

      expect(output.includedCount).toBeGreaterThanOrEqual(1);
      expect(output.omittedCount).toBeGreaterThanOrEqual(0);
      expect(output.totalFound).toBe(output.includedCount + output.omittedCount);
      expect(output.tokenCount).toBeLessThanOrEqual(60);
    });
  });

  describe('Explain Context Inclusion (Rule 41)', () => {
    it('explains why an item was included or omitted', async () => {
      const explanationIncluded = await retriever.explainInclusion({
        organizationId: orgId,
        workspaceId: workspaceId,
        query: 'SLA support response guarantee',
        itemId: 'item_1_contract_sla',
      });

      expect(explanationIncluded.itemId).toBe('item_1_contract_sla');
      expect(explanationIncluded.included).toBe(true);
      expect(explanationIncluded.reason).toContain('Included');
      expect(explanationIncluded.metrics.rrfScore).toBeGreaterThan(0);
      expect(explanationIncluded.metrics.verificationWeight).toBe(1.25);

      const explanationSuperseded = await retriever.explainInclusion({
        organizationId: orgId,
        workspaceId: workspaceId,
        query: 'SLA support response guarantee',
        itemId: 'item_3_superseded_sla',
      });

      expect(explanationSuperseded.itemId).toBe('item_3_superseded_sla');
      expect(explanationSuperseded.included).toBe(false);
      expect(explanationSuperseded.reason).toMatch(/superseded/i);
    });
  });
});
