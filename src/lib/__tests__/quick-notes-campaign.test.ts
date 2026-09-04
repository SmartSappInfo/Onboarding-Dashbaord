import { describe, it, expect } from 'vitest';
import {
  extractObjectionClusters,
  calculateCampaignRelevanceScore,
  filterCampaignConcepts,
  formatBattlecardSnippet,
  getCampaignChannelMeta,
  getCampaignConceptStatusMeta,
  getObjectionCategoryMeta,
} from '../quick-notes-domain';
import type { CampaignConcept, ObjectionBattlecard } from '../quick-notes-types';

describe('Phase 8: Campaign & Deal Intelligence Domain Tests', () => {
  const mockNotes = [
    {
      id: 'note-1',
      title: 'Call with St. Mary School',
      content: 'The principal mentioned that our pricing plan is too expensive for their annual budget. They requested a discount.',
    },
    {
      id: 'note-2',
      title: 'Feedback from Oakridge Academy',
      content: 'Oakridge is currently using another vendor for billing automation. They like their current SLA.',
    },
    {
      id: 'note-3',
      title: 'Discovery with Maple High',
      content: 'They are concerned about security compliance and student data privacy. They need uptime guarantees.',
    },
    {
      id: 'note-4',
      title: 'Follow-up with Pinecrest',
      content: 'The board approved the budget, but implementation is delayed. They are not ready until next quarter.',
    },
  ];

  it('extracts objection clusters from qualitative notes correctly', () => {
    const clusters = extractObjectionClusters(mockNotes);
    expect(clusters.length).toBeGreaterThanOrEqual(3);

    const pricingCluster = clusters.find((c) => c.category === 'pricing');
    expect(pricingCluster).toBeDefined();
    expect(pricingCluster?.count).toBe(2);
    expect(pricingCluster?.sourceNoteIds).toContain('note-1');

    const competitorCluster = clusters.find((c) => c.category === 'competitor');
    expect(competitorCluster).toBeDefined();
    expect(competitorCluster?.sourceNoteIds).toContain('note-2');

    const trustCluster = clusters.find((c) => c.category === 'trust');
    expect(trustCluster).toBeDefined();
    expect(trustCluster?.sourceNoteIds).toContain('note-3');
  });

  it('calculates campaign relevance score accurately based on keyword alignment', () => {
    const mockConcept: CampaignConcept = {
      id: 'concept-1',
      workspaceId: 'ws-1',
      title: 'Automated Fee Collection for Private Schools',
      targetAudience: 'Private School Administrators and Bursars',
      targetPersonaSummary: 'Busy school owners looking to reduce overdue parent tuition payments without confrontation.',
      valueProposition: 'Recover 95% of overdue tuition within 14 days via automated WhatsApp reminders.',
      valuePillars: ['Zero manual reconciliations', 'Direct WhatsApp payment links', 'Automated parent receipts'],
      coreMessageHook: 'Stop chasing school fees manually. Let automated WhatsApp reminders do the collection for you.',
      objectionRebuttals: [
        {
          id: 'reb-1',
          objection: 'Parents will not pay via WhatsApp',
          rebuttal: '92% of Ghanaian parents already transact on Mobile Money; WhatsApp payment links reduce friction by 4x.',
          counterProofPoints: ['Instant Momo prompt', 'Zero login required'],
          frequencyCount: 12,
          sourceQuotes: ['Parents prefer Momo over bank visits'],
          confidence: 0.90,
        },
      ],
      recommendedChannels: ['whatsapp', 'sms'],
      callToAction: 'Schedule a 10-minute demo for your school board.',
      sourceKnowledgeIds: ['note-1'],
      status: 'approved',
      createdBy: 'user-1',
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
    };

    const highMatch = calculateCampaignRelevanceScore(mockConcept, ['Private', 'School', 'Tuition', 'WhatsApp']);
    expect(highMatch).toBeGreaterThanOrEqual(85);

    const lowMatch = calculateCampaignRelevanceScore(mockConcept, ['Mining', 'Heavy Machinery', 'Factory']);
    expect(lowMatch).toBeLessThan(70);
  });

  it('filters and sorts campaign concepts properly', () => {
    const concepts: CampaignConcept[] = [
      {
        id: 'c-1',
        workspaceId: 'ws-1',
        title: 'SMS Term Notification Blitz',
        targetAudience: 'Parents',
        targetPersonaSummary: 'Parents',
        valueProposition: 'Instant alerts',
        valuePillars: ['Fast'],
        coreMessageHook: 'Stay updated',
        objectionRebuttals: [],
        recommendedChannels: ['sms'],
        callToAction: 'Click to view',
        sourceKnowledgeIds: [],
        status: 'draft',
        relevanceScore: 65,
        createdBy: 'user-1',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      },
      {
        id: 'c-2',
        workspaceId: 'ws-1',
        title: 'WhatsApp Admission Recovery',
        targetAudience: 'School Heads',
        targetPersonaSummary: 'School Owners',
        valueProposition: 'Recover student admissions',
        valuePillars: ['High ROI'],
        coreMessageHook: 'Fill every classroom seat',
        objectionRebuttals: [],
        recommendedChannels: ['whatsapp'],
        callToAction: 'Book consultation',
        sourceKnowledgeIds: [],
        status: 'approved',
        relevanceScore: 92,
        createdBy: 'user-1',
        createdAt: '2026-09-02T10:00:00Z',
        updatedAt: '2026-09-02T10:00:00Z',
      },
    ];

    const approvedOnly = filterCampaignConcepts(concepts, { status: 'approved' });
    expect(approvedOnly.length).toBe(1);
    expect(approvedOnly[0].id).toBe('c-2');

    const whatsappOnly = filterCampaignConcepts(concepts, { channel: 'whatsapp' });
    expect(whatsappOnly.length).toBe(1);
    expect(whatsappOnly[0].id).toBe('c-2');

    const sortedByRelevance = filterCampaignConcepts(concepts, { sortBy: 'relevanceScore', sortOrder: 'desc' });
    expect(sortedByRelevance[0].id).toBe('c-2');
  });

  it('formats objection battlecards into markdown snippets correctly', () => {
    const battlecard: ObjectionBattlecard = {
      id: 'bc-1',
      workspaceId: 'ws-1',
      topic: 'High Annual Subscription Cost',
      category: 'pricing',
      objection: 'The onboarding fee is too high for our budget right now.',
      rebuttalScript: 'SmartSapp pays for itself in term 1 by reducing tuition default rates from 18% to under 4%.',
      killerQuestion: 'How much revenue does your school lose each term due to uncollected tuition fees?',
      proofPoints: [
        'Average school recovers GHS 42,000 in term 1 default reduction',
        'Zero setup fee on annual commitments',
      ],
      frequencyScore: 88,
      sourceNoteIds: ['note-1'],
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
    };

    const snippet = formatBattlecardSnippet(battlecard);
    expect(snippet).toContain('### 🛡️ Battlecard: High Annual Subscription Cost');
    expect(snippet).toContain('The onboarding fee is too high');
    expect(snippet).toContain('How much revenue does your school lose');
    expect(snippet).toContain('Average school recovers GHS 42,000');
  });

  it('returns valid display metadata for channels and categories', () => {
    const channelMeta = getCampaignChannelMeta('whatsapp');
    expect(channelMeta.label).toBe('WhatsApp');
    expect(channelMeta.badgeClass).toContain('emerald');

    const statusMeta = getCampaignConceptStatusMeta('deployed_to_campaign');
    expect(statusMeta.label).toBe('Deployed to Studio');

    const catMeta = getObjectionCategoryMeta('pricing');
    expect(catMeta.label).toBe('Pricing & Budget');
  });
});
