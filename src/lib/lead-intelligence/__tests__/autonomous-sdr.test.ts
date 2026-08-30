import { describe, it, expect } from 'vitest';
import { AutonomousSDREngine } from '../sdr/AutonomousSDREngine';
import type { Prospect } from '../types';

describe('AutonomousSDREngine (Phase 12 Unit Tests)', () => {
  const sampleProspects: Prospect[] = [
    {
      id: 'p_accra_high',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      name: 'St. Peter International School',
      domain: 'stpeter.edu.gh',
      phone: '0244123456',
      address: 'East Legon, Accra, Ghana',
      industry: 'Education',
      rating: 4.9,
      source: 'google_places',
      websiteScan: {
        url: 'https://stpeter.edu.gh',
        technologies: ['WordPress', 'PHP'], // No Paystack -> payment gap
        hasFacebook: true,
        hasInstagram: true,
        hasLinkedIn: true,
        hasTwitter: false,
        sslValid: true,
        scannedAt: '2026-08-28T10:00:00Z'
      },
      contacts: [
        {
          name: 'Rev. Dr. Samuel Mensah',
          email: 'smensah@stpeter.edu.gh',
          phone: '+233244123456',
          role: 'Headmaster & Proprietor',
          confidence: 98,
          verificationStatus: 'verified',
          deliverabilityScore: 99
        }
      ],
      scoring: {
        overallScore: 92,
        needScore: 19,
        digitalMaturity: 15,
        buyingIntent: 24,
        budgetProbability: 15,
        decisionMakerFound: 15,
        engagement: 14
      },
      activeSignalsCount: 2,
      syncStatus: 'unregistered',
      createdAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-29T12:00:00Z'
    },
    {
      id: 'p_kumasi_mid',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      name: 'Kumasi Tech Academy',
      domain: 'kumasitech.com',
      phone: '+233201987654',
      address: 'Bantama, Kumasi, Ghana',
      industry: 'Education',
      rating: 4.1,
      source: 'csv_import',
      websiteScan: {
        url: 'https://kumasitech.com',
        technologies: ['Wix', 'Hubtel'],
        hasFacebook: true,
        hasInstagram: false,
        hasLinkedIn: false,
        hasTwitter: false,
        sslValid: true,
        scannedAt: '2026-08-28T10:00:00Z'
      },
      contacts: [],
      scoring: {
        overallScore: 58,
        needScore: 10,
        digitalMaturity: 10,
        buyingIntent: 8,
        budgetProbability: 10,
        decisionMakerFound: 0,
        engagement: 10
      },
      activeSignalsCount: 0,
      syncStatus: 'synced',
      syncedEntityId: 'ent_kumasi_tech',
      createdAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-29T12:00:00Z'
    }
  ];

  it('should format WhatsApp URL with E.164 phone sanitization and encoded text', () => {
    const url = AutonomousSDREngine.formatWhatsAppUrl('0244123456', 'Hello from SmartSapp!');
    expect(url).toBe('https://wa.me/233244123456?text=Hello%20from%20SmartSapp!');

    const intlUrl = AutonomousSDREngine.formatWhatsAppUrl('+233 (0) 20 198 7654', 'Quick check');
    expect(intlUrl).toBe('https://wa.me/233201987654?text=Quick%20check');
  });

  it('should generate 5-action activation recommendations with AI rationale', () => {
    const recs = AutonomousSDREngine.generateActivationRecommendations(sampleProspects[0], 'Kwame');
    expect(recs.length).toBe(5);

    const taskRec = recs.find(r => r.type === 'create_task');
    expect(taskRec).toBeDefined();
    expect(taskRec?.isRecommended).toBe(true);

    const dealRec = recs.find(r => r.type === 'create_deal');
    expect(dealRec).toBeDefined();
    expect(dealRec?.isRecommended).toBe(true); // Score 92 >= 80

    const emailRec = recs.find(r => r.type === 'send_email');
    expect(emailRec).toBeDefined();
    expect(emailRec?.isRecommended).toBe(true); // Verified email exists
    expect(emailRec?.rationale).toContain('verified SMTP mailbox');
  });

  it('should synthesize daily morning rep briefing and prioritize high-urgency accounts', () => {
    const briefing = AutonomousSDREngine.generateDailyRepBriefing(sampleProspects, 'rep_kwame', 'Kwame');
    
    expect(briefing.repName).toBe('Kwame');
    expect(briefing.totalNeedingAttention).toBe(2);
    expect(briefing.highIntentCount).toBe(1); // p_accra_high
    expect(briefing.scoreIncreasedCount).toBe(1); // p_accra_high >= 75
    expect(briefing.winnerLookalikeCount).toBe(1); // p_accra_high >= 85
    expect(briefing.priorityProspectIds[0]).toBe('p_accra_high');
  });

  it('should build single-prospect priority queue item with clear "Why Now?" reason', () => {
    const item = AutonomousSDREngine.buildPriorityQueueItem(sampleProspects[0]);
    
    expect(item.prospect.id).toBe('p_accra_high');
    expect(item.whyNowReason).toContain('intent signal');
    expect(item.suggestedChannel).toBe('whatsapp');
    expect(item.recommendedPlaybook).toBeDefined();
  });

  it('should generate personalized grounded outreach drafts for human review', () => {
    const contact = sampleProspects[0].contacts[0];
    
    // WhatsApp draft
    const waDraft = AutonomousSDREngine.generatePersonalizedDraft(sampleProspects[0], 'whatsapp', contact);
    expect(waDraft.channel).toBe('whatsapp');
    expect(waDraft.recipientPhone).toBe('+233244123456');
    expect(waDraft.whatsappUrl).toContain('wa.me/233244123456');
    expect(waDraft.groundingPoints.length).toBeGreaterThan(0);
    expect(waDraft.status).toBe('draft');

    // Email draft
    const emailDraft = AutonomousSDREngine.generatePersonalizedDraft(sampleProspects[0], 'email', contact);
    expect(emailDraft.channel).toBe('email');
    expect(emailDraft.subject).toContain('St. Peter International School');
    expect(emailDraft.mailtoUrl).toContain('mailto:smensah@stpeter.edu.gh');
  });
});
